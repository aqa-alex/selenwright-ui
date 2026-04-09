import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createConnection as createNetConnection } from "node:net";
import path from "node:path";
import { connect as createTlsConnection } from "node:tls";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const target = process.env.SELENWRIGHT_TARGET || "http://localhost:4444";
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const consoleStreamPath = "/api/stream/console";
const consoleWatchIntervalMs = Number(process.env.SELENWRIGHT_WATCH_INTERVAL_MS || 3000);
const consoleHeartbeatIntervalMs = 15000;
const upstreamRequestTimeoutMs = readTimeoutMs(process.env.SELENWRIGHT_UPSTREAM_TIMEOUT_MS, 5000);
const upstreamArtifactTimeoutMs = readTimeoutMs(process.env.SELENWRIGHT_ARTIFACT_TIMEOUT_MS, 15000);
const terminateAttemptTimeoutMs = readTimeoutMs(process.env.SELENWRIGHT_TERMINATE_TIMEOUT_MS, 3000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const apiRoutes = new Map([
  ["/api/config", { accept: "application/json", upstream: "/config" }],
  ["/api/downloads", { accept: "application/json", upstream: "/downloads/?json" }],
  ["/api/history/settings", { accept: "application/json", upstream: "/history/settings" }],
  ["/api/meta", { type: "meta" }],
  ["/api/status", { accept: "application/json", upstream: "/status" }],
  ["/api/logs", { accept: "application/json", upstream: "/logs/?json" }],
  ["/api/videos", { accept: "application/json", upstream: "/video/?json" }],
]);
const consoleStreamClients = new Set();
let consoleSnapshotCache = null;
let consoleSnapshotInFlight = null;
let consoleSnapshotSignature = "";
let consoleWatchTimer = null;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function readTimeoutMs(rawValue, fallbackMs) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

function formatTimeoutMs(timeoutMs) {
  return timeoutMs % 1000 === 0 ? `${timeoutMs / 1000}s` : `${timeoutMs}ms`;
}

function createUpstreamTimeoutError(contextLabel, timeoutMs, cause) {
  const error = new Error(`${contextLabel} timed out after ${formatTimeoutMs(timeoutMs)}.`);
  error.cause = cause;
  error.code = "UPSTREAM_TIMEOUT";
  return error;
}

function isUpstreamTimeoutError(error) {
  return Boolean(error) && typeof error === "object" && error.code === "UPSTREAM_TIMEOUT";
}

async function fetchWithTimeout(resource, options = {}, timeoutMs, contextLabel) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createUpstreamTimeoutError(contextLabel, timeoutMs, error);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function startConsoleWatcher() {
  if (consoleWatchTimer || !consoleStreamClients.size) {
    return;
  }

  void refreshConsoleSnapshot();
  consoleWatchTimer = setInterval(() => {
    void refreshConsoleSnapshot();
  }, consoleWatchIntervalMs);
}

function stopConsoleWatcher() {
  if (consoleStreamClients.size || !consoleWatchTimer) {
    return;
  }

  clearInterval(consoleWatchTimer);
  consoleWatchTimer = null;
}

async function refreshConsoleSnapshot() {
  if (consoleSnapshotInFlight) {
    return consoleSnapshotInFlight;
  }

  consoleSnapshotInFlight = (async () => {
    const nextSnapshot = await fetchConsoleSnapshot();
    const nextSignature = stableSerialize(nextSnapshot);

    if (nextSignature === consoleSnapshotSignature) {
      return consoleSnapshotCache;
    }

    consoleSnapshotSignature = nextSignature;
    consoleSnapshotCache = {
      ...nextSnapshot,
      fetchedAt: new Date().toISOString(),
    };
    broadcastConsoleSnapshot(consoleSnapshotCache);
    return consoleSnapshotCache;
  })();

  try {
    return await consoleSnapshotInFlight;
  } finally {
    consoleSnapshotInFlight = null;
  }
}

function broadcastConsoleSnapshot(snapshot) {
  const message = formatSseEvent("snapshot", snapshot);
  for (const client of consoleStreamClients) {
    try {
      client.response.write(message);
    } catch {
      closeConsoleClient(client);
    }
  }
}

function formatSseEvent(eventName, payload) {
  const lines = JSON.stringify(payload).split("\n");
  return `event: ${eventName}\ndata: ${lines.join("\ndata: ")}\n\n`;
}

function handleConsoleStream(req, res) {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    res.writeHead(405, { Allow: "GET", "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }

  res.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write(`retry: ${Math.max(1000, consoleWatchIntervalMs)}\n\n`);

  const client = {
    heartbeatTimer: setInterval(() => {
      res.write(": keep-alive\n\n");
    }, consoleHeartbeatIntervalMs),
    response: res,
  };

  consoleStreamClients.add(client);
  startConsoleWatcher();

  if (consoleSnapshotCache) {
    res.write(formatSseEvent("snapshot", consoleSnapshotCache));
  } else {
    void refreshConsoleSnapshot();
  }

  req.on("close", () => {
    closeConsoleClient(client);
  });

  req.on("error", () => {
    closeConsoleClient(client);
  });
}

function closeConsoleClient(client) {
  if (!consoleStreamClients.has(client)) {
    return;
  }

  consoleStreamClients.delete(client);
  clearInterval(client.heartbeatTimer);
  stopConsoleWatcher();
}

function handleLiveLogStream(req, res, requestUrl) {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    res.writeHead(405, { Allow: "GET", "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }

  const rawSessionId = requestUrl.pathname.slice("/api/logs/live/".length);
  if (!rawSessionId) {
    sendJson(res, 400, {
      error: "bad_request",
      message: "Session id is required",
    });
    return;
  }

  res.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write("retry: 1500\n\n");

  const upstreamUrl = buildUpstreamLiveLogUrl(requestUrl);
  const upstreamSocket = createProxySocket(upstreamUrl);
  const decoder = new TextDecoder();
  let responseClosed = false;
  let handshakeComplete = false;
  let upstreamBuffer = Buffer.alloc(0);
  let fragmentedOpcode = 0;
  let fragmentedFrames = [];

  const safeWriteSse = (payload) => {
    if (responseClosed) {
      return false;
    }

    try {
      res.write(payload);
      return true;
    } catch {
      closeResponse();
      destroyUpstreamSocket();
      return false;
    }
  };

  const heartbeatTimer = setInterval(() => {
    if (!responseClosed) {
      safeWriteSse(": keep-alive\n\n");
    }
  }, consoleHeartbeatIntervalMs);

  const closeResponse = () => {
    if (responseClosed) {
      return;
    }

    responseClosed = true;
    clearInterval(heartbeatTimer);
    res.end();
  };

  const destroyUpstreamSocket = () => {
    upstreamSocket.removeAllListeners("close");
    upstreamSocket.removeAllListeners("data");
    upstreamSocket.removeAllListeners("end");
    upstreamSocket.removeAllListeners("error");
    upstreamSocket.destroy();
  };

  const sendStatus = (status, message, extra = {}) => {
    safeWriteSse(formatSseEvent("status", { status, message, ...extra }));
  };

  const sendChunk = (chunk) => {
    if (responseClosed || !chunk) {
      return;
    }

    safeWriteSse(formatSseEvent("chunk", { chunk }));
  };

  const failStream = (message, extra = {}) => {
    sendStatus("error", message, extra);
    closeResponse();
    destroyUpstreamSocket();
  };

  const completeStream = (message, extra = {}) => {
    sendStatus("closed", message, extra);
    closeResponse();
    destroyUpstreamSocket();
  };

  const forwardPayload = (opcode, payload) => {
    if (!payload.length) {
      return;
    }

    const text = decoder.decode(payload);
    if (opcode === 0x1 || opcode === 0x2) {
      sendChunk(text);
    }
  };

  req.on("close", () => {
    closeResponse();
    destroyUpstreamSocket();
  });

  req.on("error", () => {
    closeResponse();
    destroyUpstreamSocket();
  });

  upstreamSocket.once("error", () => {
    const message = handshakeComplete ? "Live log stream dropped." : "Live log stream unavailable.";
    failStream(message);
  });

  upstreamSocket.on("data", (chunk) => {
    try {
      upstreamBuffer = Buffer.concat([upstreamBuffer, chunk]);

      if (!handshakeComplete) {
        const handshake = consumeUpstreamWebSocketHandshake(upstreamBuffer);
        if (!handshake) {
          return;
        }

        if (!handshake.ok) {
          failStream(handshake.message, { statusCode: handshake.statusCode });
          return;
        }

        handshakeComplete = true;
        upstreamBuffer = handshake.remaining;
      }

      while (true) {
        const frame = readWebSocketFrame(upstreamBuffer);
        if (!frame) {
          break;
        }

        upstreamBuffer = frame.remaining;

        if (frame.opcode === 0x8) {
          const closeInfo = parseWebSocketCloseFrame(frame.payload);
          completeStream(closeInfo.reason || "Live log stream closed.", closeInfo);
          return;
        }

        if (frame.opcode === 0x9) {
          upstreamSocket.write(createClientWebSocketFrame(0xA, frame.payload));
          continue;
        }

        if (frame.opcode === 0xA) {
          continue;
        }

        if (frame.opcode === 0x0) {
          if (!fragmentedFrames.length) {
            continue;
          }

          fragmentedFrames.push(frame.payload);
          if (frame.fin) {
            forwardPayload(fragmentedOpcode, Buffer.concat(fragmentedFrames));
            fragmentedOpcode = 0;
            fragmentedFrames = [];
          }
          continue;
        }

        if (frame.opcode === 0x1 || frame.opcode === 0x2) {
          if (!frame.fin) {
            fragmentedOpcode = frame.opcode;
            fragmentedFrames = [frame.payload];
            continue;
          }

          forwardPayload(frame.opcode, frame.payload);
        }
      }
    } catch (error) {
      failStream(error instanceof Error ? error.message : "Failed to decode live log stream.");
    }
  });

  upstreamSocket.on("end", () => {
    if (!responseClosed) {
      completeStream("Live log stream closed.");
    }
  });

  upstreamSocket.on("close", () => {
    if (!responseClosed) {
      completeStream("Live log stream closed.");
    }
  });

  const connectEvent =
    upstreamUrl.protocol === "https:" || upstreamUrl.protocol === "wss:"
      ? "secureConnect"
      : "connect";

  upstreamSocket.once(connectEvent, () => {
    upstreamSocket.write(buildUpstreamWebSocketHandshake(upstreamUrl));
  });
}

function buildUpstreamWebSocketHandshake(upstreamUrl) {
  const key = randomBytes(16).toString("base64");
  const origin = buildUpstreamOrigin(upstreamUrl);

  return [
    `GET ${upstreamUrl.pathname}${upstreamUrl.search} HTTP/1.1`,
    `Host: ${upstreamUrl.host}`,
    "Connection: Upgrade",
    "Upgrade: websocket",
    `Origin: ${origin}`,
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "\r\n",
  ].join("\r\n");
}

function buildUpstreamOrigin(upstreamUrl) {
  const protocol = upstreamUrl.protocol === "https:" || upstreamUrl.protocol === "wss:" ? "https:" : "http:";
  return `${protocol}//${upstreamUrl.host}`;
}

function consumeUpstreamWebSocketHandshake(buffer) {
  const boundary = buffer.indexOf("\r\n\r\n");
  if (boundary === -1) {
    return null;
  }

  const headerBlock = buffer.subarray(0, boundary).toString("utf8");
  const statusLine = headerBlock.split("\r\n", 1)[0] || "";
  const statusMatch = statusLine.match(/^HTTP\/1\.[01]\s+(\d{3})/);
  const statusCode = Number.parseInt(statusMatch?.[1] || "0", 10);

  if (statusCode !== 101) {
    return {
      message: statusCode ? `Live log stream unavailable (${statusCode}).` : "Live log stream unavailable.",
      ok: false,
      statusCode,
    };
  }

  return {
    ok: true,
    remaining: buffer.subarray(boundary + 4),
  };
}

function readWebSocketFrame(buffer) {
  if (buffer.length < 2) {
    return null;
  }

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const fin = Boolean(firstByte & 0x80);
  const opcode = firstByte & 0x0f;
  const masked = Boolean(secondByte & 0x80);
  let offset = 2;
  let payloadLength = secondByte & 0x7f;

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }

    const extendedLength = Number(buffer.readBigUInt64BE(offset));
    if (!Number.isSafeInteger(extendedLength)) {
      throw new Error("Live log frame is too large to decode safely.");
    }
    payloadLength = extendedLength;
    offset += 8;
  }

  const maskLength = masked ? 4 : 0;
  if (buffer.length < offset + maskLength + payloadLength) {
    return null;
  }

  const mask = masked ? buffer.subarray(offset, offset + 4) : null;
  const payloadStart = offset + maskLength;
  const payloadEnd = payloadStart + payloadLength;
  const payload = Buffer.from(buffer.subarray(payloadStart, payloadEnd));

  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }

  return {
    fin,
    opcode,
    payload,
    remaining: buffer.subarray(payloadEnd),
  };
}

function createClientWebSocketFrame(opcode, payload = Buffer.alloc(0)) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const mask = randomBytes(4);
  let headerLength = 2;

  if (body.length >= 126 && body.length <= 0xffff) {
    headerLength += 2;
  } else if (body.length > 0xffff) {
    headerLength += 8;
  }

  const frame = Buffer.alloc(headerLength + 4 + body.length);
  frame[0] = 0x80 | (opcode & 0x0f);

  let offset = 2;
  if (body.length < 126) {
    frame[1] = 0x80 | body.length;
  } else if (body.length <= 0xffff) {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(body.length, offset);
    offset += 2;
  } else {
    frame[1] = 0x80 | 127;
    frame.writeBigUInt64BE(BigInt(body.length), offset);
    offset += 8;
  }

  mask.copy(frame, offset);
  offset += 4;

  for (let index = 0; index < body.length; index += 1) {
    frame[offset + index] = body[index] ^ mask[index % 4];
  }

  return frame;
}

function parseWebSocketCloseFrame(payload) {
  if (!payload.length) {
    return {
      clean: true,
      code: 1000,
      reason: "",
    };
  }

  const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1000;
  const reason = payload.length > 2 ? new TextDecoder().decode(payload.subarray(2)) : "";
  return {
    clean: true,
    code,
    reason,
  };
}

async function fetchConsoleSnapshot() {
  const [configResult, statusResult, logsResult, videosResult, downloadsResult, historySettingsResult] = await Promise.allSettled([
    fetchUpstreamJson("/config"),
    fetchUpstreamJson("/status"),
    fetchUpstreamJson("/logs/?json"),
    fetchUpstreamJson("/video/?json"),
    fetchUpstreamJson("/downloads/?json"),
    fetchUpstreamJson("/history/settings"),
  ]);

  return {
    config: normalizeSnapshotResult(configResult, "Configuration endpoint unavailable"),
    downloads: normalizeSnapshotResult(downloadsResult, "Downloads endpoint unavailable"),
    historySettings: normalizeSnapshotResult(
      historySettingsResult,
      "Artifact history settings unavailable",
    ),
    logs: normalizeSnapshotResult(logsResult, "Logs endpoint unavailable"),
    status: normalizeSnapshotResult(statusResult, "Status endpoint unavailable"),
    target,
    videos: normalizeSnapshotResult(videosResult, "Videos endpoint unavailable"),
  };
}

async function fetchUpstreamJson(upstreamPath) {
  const response = await fetchWithTimeout(
    new URL(upstreamPath, target),
    {
      headers: { accept: "application/json" },
    },
    upstreamRequestTimeoutMs,
    `Upstream ${upstreamPath}`,
  );

  if (!response.ok) {
    throw new Error(`Request failed for ${upstreamPath} (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const body = await readUpstreamTextWithTimeout(
      response,
      upstreamRequestTimeoutMs,
      `Upstream ${upstreamPath} response`,
    );
    throw new Error(
      `Expected application/json from ${upstreamPath}, got ${contentType || "unknown content-type"}: ${truncateBodyPreview(body)}`,
    );
  }

  return readUpstreamJsonWithTimeout(response, upstreamRequestTimeoutMs, `Upstream ${upstreamPath} response`);
}

function normalizeSnapshotResult(result, fallbackError) {
  if (result.status === "fulfilled") {
    return {
      ok: true,
      value: result.value,
    };
  }

  return {
    error: result.reason instanceof Error ? result.reason.message : fallbackError,
    ok: false,
  };
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function resolveStaticFile(urlPath) {
  const trimmedPath = urlPath === "/" ? "/index.html" : urlPath;
  const decoded = decodeURIComponent(trimmedPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.join(rootDir, normalized);

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
    return absolutePath;
  }

  if (!path.extname(absolutePath)) {
    return path.join(rootDir, "index.html");
  }

  return null;
}

function resolveApiRoute(requestUrl) {
  const route = apiRoutes.get(requestUrl.pathname);
  if (route) {
    return route;
  }

  if (requestUrl.pathname.startsWith("/api/sessions/")) {
    const rawSessionId = requestUrl.pathname.slice("/api/sessions/".length);
    if (!rawSessionId) {
      return {
        error: {
          message: "Session id is required",
          statusCode: 400,
        },
      };
    }

    return {
      sessionId: rawSessionId,
      type: "terminate-session",
    };
  }

  if (requestUrl.pathname.startsWith("/api/logs/file/")) {
    const rawFilename = requestUrl.pathname.slice("/api/logs/file/".length);
    if (!rawFilename) {
      return {
        error: {
          message: "Log filename is required",
          statusCode: 400,
        },
      };
    }

    return {
      accept: "text/plain",
      buildUpstreamUrl: () => buildUpstreamLogFileUrl(requestUrl),
    };
  }

  if (requestUrl.pathname.startsWith("/api/downloads/file/")) {
    const rawPath = requestUrl.pathname.slice("/api/downloads/file/".length);
    if (!rawPath) {
      return {
        error: {
          message: "Download path is required",
          statusCode: 400,
        },
      };
    }

    return {
      accept: "application/octet-stream",
      buildUpstreamUrl: () => buildUpstreamDownloadFileUrl(requestUrl),
    };
  }

  return null;
}

function resolveUpgradeHandler(requestUrl) {
  if (requestUrl.pathname.startsWith("/api/vnc/")) {
    return buildUpstreamVncUrl;
  }

  if (requestUrl.pathname.startsWith("/api/logs/live/")) {
    return buildUpstreamLiveLogUrl;
  }

  return null;
}

function buildUpstreamVncUrl(requestUrl) {
  const sessionPath = requestUrl.pathname.slice("/api/vnc/".length);
  return new URL(`/vnc/${sessionPath}${requestUrl.search}`, target);
}

function buildUpstreamLogFileUrl(requestUrl) {
  const rawFilename = requestUrl.pathname.slice("/api/logs/file/".length);
  const encodedFilename = encodePathSegment(rawFilename);
  return new URL(`/logs/${encodedFilename}${requestUrl.search}`, target);
}

function buildUpstreamLiveLogUrl(requestUrl) {
  const rawSessionId = requestUrl.pathname.slice("/api/logs/live/".length);
  const encodedSessionId = encodePathSegment(rawSessionId);
  return new URL(`/logs/${encodedSessionId}${requestUrl.search}`, target);
}

function buildUpstreamDownloadFileUrl(requestUrl) {
  const rawPath = requestUrl.pathname.slice("/api/downloads/file/".length);
  const encodedPath = encodePathPreservingSlashes(rawPath);
  return new URL(`/downloads/${encodedPath}${requestUrl.search}`, target);
}

function encodePathSegment(value) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function encodePathPreservingSlashes(value) {
  return String(value || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodePathSegment(segment))
    .join("/");
}

function createProxySocket(upstreamUrl) {
  const upstreamPort =
    upstreamUrl.port || (upstreamUrl.protocol === "https:" || upstreamUrl.protocol === "wss:" ? 443 : 80);

  if (upstreamUrl.protocol === "https:" || upstreamUrl.protocol === "wss:") {
    return createTlsConnection({
      host: upstreamUrl.hostname,
      port: upstreamPort,
      servername: upstreamUrl.hostname,
    });
  }

  return createNetConnection({
    host: upstreamUrl.hostname,
    port: upstreamPort,
  });
}

function sendUpgradeFailure(socket, statusCode, statusText) {
  if (socket.destroyed) {
    return;
  }

  socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function handleWebSocketProxyUpgrade(req, socket, head, buildUpstreamUrl) {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const upgradeHeader = req.headers.upgrade;

  if (upgradeHeader?.toLowerCase() !== "websocket") {
    sendUpgradeFailure(socket, 426, "Upgrade Required");
    return;
  }

  const upstreamUrl = buildUpstreamUrl(requestUrl);
  const upstreamSocket = createProxySocket(upstreamUrl);
  let clientClosed = false;
  let proxyReady = false;

  const upstreamHeaders = [
    `GET ${upstreamUrl.pathname}${upstreamUrl.search} HTTP/1.1`,
    `Host: ${upstreamUrl.host}`,
    "Connection: Upgrade",
    "Upgrade: websocket",
  ];

  const originHeader = req.headers.origin || buildSyntheticOrigin(req);
  if (originHeader) {
    upstreamHeaders.push(`origin: ${originHeader}`);
  }

  for (const headerName of [
    "sec-websocket-key",
    "sec-websocket-version",
    "sec-websocket-extensions",
    "sec-websocket-protocol",
    "user-agent",
    "cookie",
  ]) {
    const headerValue = req.headers[headerName];
    if (headerValue) {
      upstreamHeaders.push(`${headerName}: ${headerValue}`);
    }
  }

  upstreamHeaders.push("\r\n");

  upstreamSocket.once("error", () => {
    if (!clientClosed && !proxyReady) {
      sendUpgradeFailure(socket, 502, "Bad Gateway");
      return;
    }

    socket.destroy();
  });

  const connectEvent =
    upstreamUrl.protocol === "https:" || upstreamUrl.protocol === "wss:"
      ? "secureConnect"
      : "connect";

  upstreamSocket.once(connectEvent, () => {
    proxyReady = true;
    upstreamSocket.write(upstreamHeaders.join("\r\n"));
    if (head.length) {
      upstreamSocket.write(head);
    }
    socket.pipe(upstreamSocket);
    upstreamSocket.pipe(socket);
  });

  socket.once("close", () => {
    clientClosed = true;
    upstreamSocket.destroy();
  });

  socket.once("error", () => {
    clientClosed = true;
    upstreamSocket.destroy();
  });
}

function buildSyntheticOrigin(req) {
  const hostHeader = req.headers.host;
  if (!hostHeader) {
    return "";
  }

  return `http://${hostHeader}`;
}

async function handleApi(req, res, route, requestUrl) {
  if (route.error) {
    sendJson(res, route.error.statusCode, {
      error: "bad_request",
      message: route.error.message,
    });
    return;
  }

  if (route.type === "meta") {
    sendJson(res, 200, { target });
    return;
  }

  if (route.type === "terminate-session") {
    await handleSessionTerminate(req, res, route, requestUrl);
    return;
  }

  try {
    const upstreamUrl = route.buildUpstreamUrl
      ? route.buildUpstreamUrl(requestUrl)
      : new URL(route.upstream, target);
    const requestBody = await readRequestBody(req);
    const requestHeaders = { accept: route.accept || "application/json" };
    const timeoutMs = resolveProxyTimeoutMs(route);
    if (req.headers["content-type"]) {
      requestHeaders["content-type"] = req.headers["content-type"];
    }
    const upstreamResponse = await fetchWithTimeout(
      upstreamUrl,
      {
        body: requestBody.length && req.method !== "GET" && req.method !== "HEAD" ? requestBody : undefined,
        headers: requestHeaders,
        method: req.method || "GET",
      },
      timeoutMs,
      `${req.method || "GET"} ${upstreamUrl.pathname}`,
    );

    const contentType =
      upstreamResponse.headers.get("content-type") ||
      (route.accept === "text/plain" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8");

    const expectsJson = (route.accept || "").includes("application/json");
    if (expectsJson && !contentType.toLowerCase().includes("application/json")) {
      const body = await readUpstreamTextWithTimeout(
        upstreamResponse,
        timeoutMs,
        `${req.method || "GET"} ${upstreamUrl.pathname} response`,
      );
      sendJson(res, 502, {
        error: "upstream_contract_error",
        message: `Expected application/json from ${upstreamUrl.pathname}, got ${contentType || "unknown content-type"}: ${truncateBodyPreview(body)}`,
        target,
      });
      return;
    }

    res.writeHead(upstreamResponse.status, {
      "Content-Type": contentType,
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    if (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("javascript")) {
      const text = await readUpstreamTextWithTimeout(
        upstreamResponse,
        timeoutMs,
        `${req.method || "GET"} ${upstreamUrl.pathname} response`,
      );
      res.end(text);
      return;
    }

    const buffer = Buffer.from(
      await readUpstreamArrayBufferWithTimeout(
        upstreamResponse,
        timeoutMs,
        `${req.method || "GET"} ${upstreamUrl.pathname} response`,
      ),
    );
    res.end(buffer);
  } catch (error) {
    sendJson(res, isUpstreamTimeoutError(error) ? 504 : 502, {
      error: isUpstreamTimeoutError(error) ? "upstream_timeout" : "upstream_unavailable",
      message: error instanceof Error ? error.message : "Failed to reach Selenwright target",
      target,
    });
  }
}

async function handleSessionTerminate(req, res, route, requestUrl) {
  if ((req.method || "GET").toUpperCase() !== "DELETE") {
    res.writeHead(405, { Allow: "DELETE", "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "method_not_allowed", message: "Use DELETE to terminate a session." }));
    return;
  }

  const protocol = (requestUrl.searchParams.get("protocol") || "").toLowerCase();
  const attempts = [];

  for (const candidate of buildTerminateSessionCandidates(route.sessionId, protocol)) {
    try {
      const upstreamResponse = await fetchWithTimeout(
        candidate.url,
        {
          headers: {
            accept: "application/json, text/plain;q=0.9, */*;q=0.1",
          },
          method: candidate.method,
        },
        terminateAttemptTimeoutMs,
        `${candidate.method} ${candidate.url.pathname}`,
      );
      const responseText =
        upstreamResponse.status === 204
          ? ""
          : await readUpstreamTextWithTimeout(
              upstreamResponse,
              terminateAttemptTimeoutMs,
              `${candidate.method} ${candidate.url.pathname} response`,
            );
      const message = extractUpstreamResponseMessage(responseText);

      if (upstreamResponse.ok) {
        sendJson(res, 200, {
          message: message || "Session terminated",
          ok: true,
          sessionId: route.sessionId,
          upstream: {
            method: candidate.method,
            path: candidate.url.pathname,
            status: upstreamResponse.status,
          },
        });
        return;
      }

      attempts.push({
        message: message || `Request failed (${upstreamResponse.status})`,
        method: candidate.method,
        path: candidate.url.pathname,
        status: upstreamResponse.status,
      });
    } catch (error) {
      attempts.push({
        message: error instanceof Error ? error.message : "Failed to reach upstream target",
        method: candidate.method,
        path: candidate.url.pathname,
        status: 0,
      });
    }
  }

  sendJson(res, 502, {
    error: "session_terminate_failed",
    message: buildTerminateFailureMessage(route.sessionId, attempts),
    sessionId: route.sessionId,
    target,
  });
}

function resolveProxyTimeoutMs(route) {
  if (route?.timeoutMs) {
    return route.timeoutMs;
  }

  if (route?.accept === "application/octet-stream" || route?.accept === "text/plain") {
    return upstreamArtifactTimeoutMs;
  }

  return upstreamRequestTimeoutMs;
}

function buildTerminateSessionCandidates(sessionId, protocol) {
  const encodedSessionId = encodePathSegment(sessionId);
  const candidates = [];
  const pushCandidate = (method, pathName) => {
    candidates.push({
      method,
      url: new URL(pathName, target),
    });
  };

  if (protocol === "selenium") {
    pushCandidate("DELETE", `/wd/hub/session/${encodedSessionId}`);
  } else {
    pushCandidate("DELETE", `/session/${encodedSessionId}`);
    pushCandidate("DELETE", `/sessions/${encodedSessionId}`);
    pushCandidate("DELETE", `/playwright/session/${encodedSessionId}`);
    pushCandidate("DELETE", `/playwright/sessions/${encodedSessionId}`);
    pushCandidate("POST", `/session/${encodedSessionId}/terminate`);
    pushCandidate("POST", `/sessions/${encodedSessionId}/terminate`);
    pushCandidate("POST", `/playwright/session/${encodedSessionId}/terminate`);
  }

  pushCandidate("DELETE", `/wd/hub/session/${encodedSessionId}`);
  pushCandidate("DELETE", `/session/${encodedSessionId}`);
  pushCandidate("DELETE", `/sessions/${encodedSessionId}`);
  pushCandidate("POST", `/session/${encodedSessionId}/terminate`);
  pushCandidate("POST", `/sessions/${encodedSessionId}/terminate`);

  return dedupeTerminateCandidates(candidates);
}

function dedupeTerminateCandidates(candidates) {
  const seen = new Set();

  return candidates.filter((candidate) => {
    const key = `${candidate.method} ${candidate.url.pathname}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractUpstreamResponseMessage(responseText) {
  const trimmed = String(responseText || "").trim();
  if (!trimmed) {
    return "";
  }

  try {
    const payload = JSON.parse(trimmed);
    if (payload && typeof payload === "object") {
      if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message.trim();
      }
      if (typeof payload.reason === "string" && payload.reason.trim()) {
        return payload.reason.trim();
      }
    }
  } catch {
    // Fall back to a short text preview when upstream returns plain text.
  }

  return truncateBodyPreview(trimmed);
}

function buildTerminateFailureMessage(sessionId, attempts) {
  if (!attempts.length) {
    return `Unable to terminate session ${sessionId}.`;
  }

  const summary = attempts
    .slice(0, 3)
    .map((attempt) => `${attempt.method} ${attempt.path}${attempt.status ? ` (${attempt.status})` : ""}: ${attempt.message}`)
    .join(" | ");

  return `Unable to terminate session ${sessionId}. Tried ${attempts.length} upstream routes. ${summary}`;
}

async function readUpstreamTextWithTimeout(response, timeoutMs, contextLabel) {
  return withTimeout(response.text(), timeoutMs, contextLabel);
}

async function readUpstreamJsonWithTimeout(response, timeoutMs, contextLabel) {
  return withTimeout(response.json(), timeoutMs, contextLabel);
}

async function readUpstreamArrayBufferWithTimeout(response, timeoutMs, contextLabel) {
  return withTimeout(response.arrayBuffer(), timeoutMs, contextLabel);
}

async function withTimeout(promise, timeoutMs, contextLabel) {
  let timer = 0;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(createUpstreamTimeoutError(contextLabel, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function truncateBodyPreview(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "<empty body>";
  }
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 117)}...`;
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname === consoleStreamPath) {
    handleConsoleStream(req, res);
    return;
  }

  if (requestUrl.pathname.startsWith("/api/logs/live/")) {
    handleLiveLogStream(req, res, requestUrl);
    return;
  }

  const route = resolveApiRoute(requestUrl);

  if (route) {
    await handleApi(req, res, route, requestUrl);
    return;
  }

  if (resolveUpgradeHandler(requestUrl)) {
    res.writeHead(426, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Upgrade Required");
    return;
  }

  const filePath = resolveStaticFile(requestUrl.pathname);
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  const contentType = mimeTypes[extension] || "application/octet-stream";

  res.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
});

server.on("upgrade", (req, socket, head) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const buildUpstreamUrl = resolveUpgradeHandler(requestUrl);

  if (buildUpstreamUrl) {
    handleWebSocketProxyUpgrade(req, socket, head, buildUpstreamUrl);
    return;
  }

  socket.destroy();
});

server.listen(port, host, () => {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  console.log(`${packageJson.name} listening on http://${host}:${port}`);
  console.log(`Proxy target: ${target}`);
});

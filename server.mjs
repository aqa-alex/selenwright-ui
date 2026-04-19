import { createReadStream, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createConnection as createNetConnection } from "node:net";
import path from "node:path";
import { connect as createTlsConnection } from "node:tls";
import { fileURLToPath } from "node:url";
import { readWebSocketFrame } from "./server-ws-frame.mjs";
import { isOriginAllowed } from "./server-origin.mjs";
import { formatForwardedHeaderLines } from "./server-ws-auth.mjs";
import {
  allowedOrigins,
  apiOnlyMode,
  consoleHeartbeatIntervalMs,
  consoleStreamPath,
  consoleWatchIntervalMs,
  demoMode,
  host,
  maxSseClientAgeMs,
  maxSseClients,
  maxWsFragmentedBytes,
  maxWsFrameBytes,
  port,
  target,
  terminateAttemptTimeoutMs,
  upstreamArtifactTimeoutMs,
  upstreamRequestTimeoutMs,
} from "./server/config.mjs";
import { withSecurityHeaders } from "./server/security.mjs";
import {
  fetchWithTimeout,
  isUpstreamTimeoutError,
  readRequestBody,
  readUpstreamArrayBufferWithTimeout,
  readUpstreamTextWithTimeout,
  sendJson,
  truncateBodyPreview,
} from "./server/http-utils.mjs";
import { mimeTypes, resolveStaticFile, resolveStaticRootDir } from "./server/static.mjs";
import { fetchConsoleSnapshot, stableSerialize } from "./server/snapshot.mjs";
import { buildDemoConsoleSnapshot } from "./server/demo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

const staticRootDir = resolveStaticRootDir();

const apiRoutes = new Map([
  ["/api/config", { accept: "application/json", upstream: "/config" }],
  ["/api/downloads", { accept: "application/json", upstream: "/downloads/?json" }],
  ["/api/history/settings", { accept: "application/json", upstream: "/history/settings" }],
  ["/api/meta", { type: "meta" }],
  ["/api/status", { accept: "application/json", upstream: "/status" }],
  ["/api/logs", { accept: "application/json", upstream: "/logs/?json" }],
  ["/api/videos", { accept: "application/json", upstream: "/video/?json" }],
  ["/api/browsers/discovered", { accept: "application/json", upstream: "/browsers/discovered" }],
  ["/api/browsers/adopt", { accept: "application/json", upstream: "/browsers/adopt" }],
  ["/api/browsers/dismiss", { accept: "application/json", upstream: "/browsers/dismiss" }],
  ["/api/browsers/rescan", { accept: "application/json", upstream: "/browsers/rescan" }],
  ["/api/stack/status", { accept: "application/json", upstream: "/stack/status" }],
  ["/api/stack/pull", { accept: "application/json", upstream: "/stack/pull", timeoutMs: 150_000 }],
  ["/api/stack/recreate", { accept: "application/json", upstream: "/stack/recreate", timeoutMs: 150_000 }],
  ["/api/whoami", { accept: "application/json", upstream: "/whoami" }],
  ["/api/login", { accept: "application/json", upstream: "/login" }],
  ["/api/logout", { accept: "application/json", upstream: "/logout" }],
  // Admin-managed API token endpoints. buildUpstreamUrl is used instead of a
  // static `upstream:` so `?owner=` (list/filter, bulk revoke) is forwarded.
  ["/api/admin/tokens", {
    accept: "application/json",
    buildUpstreamUrl: (requestUrl) => new URL(`/api/admin/tokens${requestUrl.search}`, target),
  }],
  ["/api/admin/users", {
    accept: "application/json",
    buildUpstreamUrl: (requestUrl) => new URL(`/api/admin/users${requestUrl.search}`, target),
  }],
]);
const consoleStreamClients = new Set();
let consoleSnapshotCache = null;
let consoleSnapshotInFlight = null;
let consoleSnapshotSignature = "";
let consoleWatchTimer = null;

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
      const writeResult = client.response.write(message);
      if (!writeResult) {
        closeConsoleClient(client);
      }
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
    res.writeHead(405, withSecurityHeaders({ Allow: "GET", "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Method Not Allowed");
    return;
  }

  if (consoleStreamClients.size >= maxSseClients) {
    res.writeHead(503, withSecurityHeaders({
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": "5",
    }));
    res.end("Console SSE is at capacity. Try again shortly.");
    return;
  }

  res.writeHead(200, withSecurityHeaders({
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  }));
  res.flushHeaders?.();
  res.write(`retry: ${Math.max(1000, consoleWatchIntervalMs)}\n\n`);

  const client = {
    connectedAt: Date.now(),
    heartbeatTimer: 0,
    response: res,
  };
  client.heartbeatTimer = setInterval(() => {
    if (Date.now() - client.connectedAt > maxSseClientAgeMs) {
      try {
        res.write(formatSseEvent("shutdown", { reason: "max_age" }));
      } catch {
      }
      closeConsoleClient(client);
      return;
    }
    try {
      if (!res.write(": keep-alive\n\n")) {
        closeConsoleClient(client);
      }
    } catch {
      closeConsoleClient(client);
    }
  }, consoleHeartbeatIntervalMs);

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
  try {
    client.response.end();
  } catch {
  }
}

function handleLiveLogStream(req, res, requestUrl) {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    res.writeHead(405, withSecurityHeaders({ Allow: "GET", "Content-Type": "text/plain; charset=utf-8" }));
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

  res.writeHead(200, withSecurityHeaders({
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  }));
  res.flushHeaders?.();
  res.write("retry: 1500\n\n");

  const upstreamUrl = buildUpstreamLiveLogUrl(requestUrl);
  const upstreamSocket = createProxySocket(upstreamUrl);
  const decoder = new TextDecoder();
  let responseClosed = false;
  let handshakeComplete = false;
  let upstreamBuffer = Buffer.alloc(0);
  let fragmentedOpcode = null;
  let fragmentedFrames = [];
  let fragmentedBytes = 0;

  const safeWriteSse = (payload) => {
    if (responseClosed) {
      return false;
    }

    try {
      const ok = res.write(payload);
      if (!ok) {
        closeResponse();
        destroyUpstreamSocket();
        return false;
      }
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
        const frame = readWebSocketFrame(upstreamBuffer, { maxFrameBytes: maxWsFrameBytes });
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

          fragmentedBytes += frame.payload.length;
          if (fragmentedBytes > maxWsFragmentedBytes) {
            sendUpstreamCloseCode(upstreamSocket, 1009, "fragmented message too large");
            failStream(
              `Fragmented WebSocket message exceeded ${maxWsFragmentedBytes} bytes.`,
            );
            return;
          }
          fragmentedFrames.push(frame.payload);
          if (frame.fin) {
            forwardPayload(fragmentedOpcode, Buffer.concat(fragmentedFrames));
            fragmentedOpcode = null;
            fragmentedFrames = [];
            fragmentedBytes = 0;
          }
          continue;
        }

        if (frame.opcode === 0x1 || frame.opcode === 0x2) {
          if (!frame.fin) {
            fragmentedOpcode = frame.opcode;
            fragmentedFrames = [frame.payload];
            fragmentedBytes = frame.payload.length;
            if (fragmentedBytes > maxWsFragmentedBytes) {
              sendUpstreamCloseCode(upstreamSocket, 1009, "fragmented message too large");
              failStream(
                `Fragmented WebSocket message exceeded ${maxWsFragmentedBytes} bytes.`,
              );
              return;
            }
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
    upstreamSocket.write(buildUpstreamWebSocketHandshake(upstreamUrl, req.headers));
  });
}

function buildUpstreamWebSocketHandshake(upstreamUrl, clientHeaders) {
  const key = randomBytes(16).toString("base64");
  const origin = buildUpstreamOrigin(upstreamUrl);

  const lines = [
    `GET ${upstreamUrl.pathname}${upstreamUrl.search} HTTP/1.1`,
    `Host: ${upstreamUrl.host}`,
    "Connection: Upgrade",
    "Upgrade: websocket",
    `Origin: ${origin}`,
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    ...formatForwardedHeaderLines(clientHeaders),
    "\r\n",
  ];
  return lines.join("\r\n");
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

function sendUpstreamCloseCode(socket, code, reason) {
  if (socket.destroyed) {
    return;
  }
  try {
    const reasonBytes = Buffer.from(reason || "", "utf8");
    const payload = Buffer.alloc(2 + reasonBytes.length);
    payload.writeUInt16BE(code, 0);
    reasonBytes.copy(payload, 2);
    socket.write(createClientWebSocketFrame(0x8, payload));
  } catch {
  }
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

  if (requestUrl.pathname.startsWith("/api/video/")) {
    const rawFilename = requestUrl.pathname.slice("/api/video/".length);
    if (!rawFilename) {
      return {
        error: {
          message: "Video filename is required",
          statusCode: 400,
        },
      };
    }

    return {
      accept: "application/octet-stream",
      buildUpstreamUrl: () => buildUpstreamVideoFileUrl(requestUrl),
    };
  }

  if (requestUrl.pathname.startsWith("/api/admin/tokens/")) {
    const rawTokenId = requestUrl.pathname.slice("/api/admin/tokens/".length);
    if (!rawTokenId || rawTokenId.includes("/")) {
      return {
        error: {
          message: "Token id is required",
          statusCode: 400,
        },
      };
    }

    const encodedTokenId = encodePathSegment(rawTokenId);
    return {
      accept: "application/json",
      buildUpstreamUrl: (url) =>
        new URL(`/api/admin/tokens/${encodedTokenId}${url.search}`, target),
    };
  }

  if (requestUrl.pathname.startsWith("/api/clipboard/")) {
    const rawSessionId = requestUrl.pathname.slice("/api/clipboard/".length);
    if (!rawSessionId) {
      return {
        error: {
          message: "Session id is required",
          statusCode: 400,
        },
      };
    }

    return {
      accept: "text/plain",
      buildUpstreamUrl: () => buildUpstreamClipboardUrl(requestUrl),
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
  const rawSessionPath = requestUrl.pathname.slice("/api/vnc/".length);
  const encodedSessionPath = encodePathPreservingSlashes(rawSessionPath);
  return new URL(`/vnc/${encodedSessionPath}${requestUrl.search}`, target);
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

function buildUpstreamVideoFileUrl(requestUrl) {
  const rawFilename = requestUrl.pathname.slice("/api/video/".length);
  const encodedFilename = encodePathSegment(rawFilename);
  return new URL(`/video/${encodedFilename}${requestUrl.search}`, target);
}

function buildUpstreamClipboardUrl(requestUrl) {
  const rawSessionId = requestUrl.pathname.slice("/api/clipboard/".length);
  const encodedSessionId = encodePathSegment(rawSessionId);
  return new URL(`/clipboard/${encodedSessionId}${requestUrl.search}`, target);
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
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
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

  upstreamHeaders.push(`origin: ${buildUpstreamOrigin(upstreamUrl)}`);

  for (const headerName of [
    "sec-websocket-key",
    "sec-websocket-version",
    "sec-websocket-extensions",
    "sec-websocket-protocol",
    "user-agent",
  ]) {
    const headerValue = req.headers[headerName];
    if (headerValue) {
      upstreamHeaders.push(`${headerName}: ${headerValue}`);
    }
  }

  upstreamHeaders.push(...formatForwardedHeaderLines(req.headers));
  upstreamHeaders.push("\r\n");

  upstreamSocket.on("error", () => {
    if (!clientClosed && !proxyReady) {
      sendUpgradeFailure(socket, 502, "Bad Gateway");
      return;
    }

    if (!socket.destroyed) {
      socket.destroy();
    }
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

  socket.on("error", () => {
    clientClosed = true;
    if (!upstreamSocket.destroyed) {
      upstreamSocket.destroy();
    }
  });

  socket.once("close", () => {
    clientClosed = true;
    if (!upstreamSocket.destroyed) {
      upstreamSocket.destroy();
    }
  });

  upstreamSocket.once("close", () => {
    if (!socket.destroyed) {
      socket.destroy();
    }
  });
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
    sendJson(res, 200, { target: demoMode ? "demo" : target });
    return;
  }

  if (route.type === "terminate-session") {
    await handleSessionTerminate(req, res, route, requestUrl);
    return;
  }

  try {
    if (demoMode && route.upstream) {
      const demoSnapshot = buildDemoConsoleSnapshot();
      const demoRoutes = {
        "/config": demoSnapshot.config.value,
        "/status": demoSnapshot.status.value,
        "/logs/?json": demoSnapshot.logs.value,
        "/video/?json": demoSnapshot.videos.value,
        "/downloads/?json": demoSnapshot.downloads.value,
        "/history/settings": demoSnapshot.historySettings.value,
        "/whoami": { user: "demo", isAdmin: true, authMode: "none", authenticated: true },
      };
      const demoData = demoRoutes[route.upstream];
      if (demoData !== undefined) {
        sendJson(res, 200, demoData);
        return;
      }
    }

    const upstreamUrl = route.buildUpstreamUrl
      ? route.buildUpstreamUrl(requestUrl)
      : new URL(route.upstream, target);
    const requestBody = await readRequestBody(req);
    const requestHeaders = { accept: route.accept || "application/json" };
    const timeoutMs = resolveProxyTimeoutMs(route);
    if (req.headers["content-type"]) {
      requestHeaders["content-type"] = req.headers["content-type"];
    }
    if (req.headers["authorization"]) {
      requestHeaders["authorization"] = req.headers["authorization"];
    }
    if (req.headers["cookie"]) {
      requestHeaders["cookie"] = req.headers["cookie"];
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

    const responseHeaders = withSecurityHeaders({
      "Content-Type": contentType,
    });
    const setCookieValues = upstreamResponse.headers.getSetCookie?.() ?? [];
    for (const value of setCookieValues) {
      if (!responseHeaders["set-cookie"]) {
        responseHeaders["set-cookie"] = [];
      }
      responseHeaders["set-cookie"].push(value);
    }
    res.writeHead(upstreamResponse.status, responseHeaders);

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
    if (error instanceof Error && error.code === "REQUEST_TOO_LARGE") {
      sendJson(res, 413, {
        error: "request_too_large",
        message: error.message,
      });
      return;
    }
    sendJson(res, isUpstreamTimeoutError(error) ? 504 : 502, {
      error: isUpstreamTimeoutError(error) ? "upstream_timeout" : "upstream_unavailable",
      message: error instanceof Error ? error.message : "Failed to reach Selenwright target",
      target,
    });
  }
}

async function handleSessionTerminate(req, res, route, requestUrl) {
  if ((req.method || "GET").toUpperCase() !== "DELETE") {
    res.writeHead(405, withSecurityHeaders({ Allow: "DELETE", "Content-Type": "application/json; charset=utf-8" }));
    res.end(JSON.stringify({ error: "method_not_allowed", message: "Use DELETE to terminate a session." }));
    return;
  }

  const protocol = (requestUrl.searchParams.get("protocol") || "").toLowerCase();
  if (protocol !== "selenium" && protocol !== "playwright") {
    sendJson(res, 400, {
      error: "bad_request",
      message: "Query parameter `protocol` must be either `selenium` or `playwright`.",
    });
    return;
  }

  const encodedSessionId = encodePathSegment(route.sessionId);
  const upstreamPath = protocol === "playwright"
    ? `/playwright/session/${encodedSessionId}`
    : `/wd/hub/session/${encodedSessionId}`;
  const upstreamUrl = new URL(upstreamPath, target);

  try {
    const upstreamResponse = await fetchWithTimeout(
      upstreamUrl,
      {
        headers: {
          accept: "application/json, text/plain;q=0.9, */*;q=0.1",
        },
        method: "DELETE",
      },
      terminateAttemptTimeoutMs,
      `DELETE ${upstreamUrl.pathname}`,
    );
    const responseText =
      upstreamResponse.status === 204
        ? ""
        : await readUpstreamTextWithTimeout(
            upstreamResponse,
            terminateAttemptTimeoutMs,
            `DELETE ${upstreamUrl.pathname} response`,
          );
    const message = extractUpstreamResponseMessage(responseText);

    if (upstreamResponse.ok) {
      sendJson(res, 200, {
        message: message || "Session terminated",
        ok: true,
        sessionId: route.sessionId,
      });
      return;
    }

    sendJson(res, 502, {
      error: "session_terminate_failed",
      message: message || `Unable to terminate session (${upstreamResponse.status}).`,
      sessionId: route.sessionId,
    });
  } catch (error) {
    sendJson(res, 502, {
      error: "session_terminate_failed",
      message: error instanceof Error ? error.message : "Failed to reach upstream target",
      sessionId: route.sessionId,
    });
  }
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
  }

  return truncateBodyPreview(trimmed);
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);

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
    res.writeHead(426, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Upgrade Required");
    return;
  }

  if (apiOnlyMode) {
    res.writeHead(404, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Not found");
    return;
  }

  const filePath = resolveStaticFile(staticRootDir, requestUrl.pathname);
  if (!filePath) {
    res.writeHead(404, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  const contentType = mimeTypes[extension] || "application/octet-stream";

  res.writeHead(200, withSecurityHeaders({
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  }));

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
});

server.on("upgrade", (req, socket, head) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
  const buildUpstreamUrl = resolveUpgradeHandler(requestUrl);

  if (!buildUpstreamUrl) {
    socket.destroy();
    return;
  }

  if (!isOriginAllowed(req.headers.origin, req.headers.host, allowedOrigins)) {
    sendUpgradeFailure(socket, 403, "Forbidden");
    return;
  }

  handleWebSocketProxyUpgrade(req, socket, head, buildUpstreamUrl);
});

server.listen(port, host, () => {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  console.log(`${packageJson.name} listening on http://${host}:${port}`);
  console.log(apiOnlyMode ? "Static mode: disabled (API proxy only)" : `Static root: ${path.relative(rootDir, staticRootDir) || "."}`);
  console.log(demoMode ? "Demo mode: serving built-in demo data" : `Proxy target: ${target}`);
});

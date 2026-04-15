import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createConnection as createNetConnection } from "node:net";
import path from "node:path";
import { connect as createTlsConnection } from "node:tls";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAX_WS_FRAME_BYTES,
  readWebSocketFrame,
} from "./server-ws-frame.mjs";
import { isOriginAllowed, parseAllowedOrigins } from "./server-origin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const distDir = path.join(rootDir, "dist");

const DEFAULT_UPSTREAM_TARGET = "http://127.0.0.1:4444";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;

const target = process.env.SELENWRIGHT_TARGET || DEFAULT_UPSTREAM_TARGET;
const port = Number(process.env.PORT || DEFAULT_PORT);
const host = process.env.HOST || DEFAULT_HOST;
const apiOnlyMode = process.env.SELENWRIGHT_API_ONLY === "true";
const consoleStreamPath = "/api/stream/console";
const consoleWatchIntervalMs = Number(process.env.SELENWRIGHT_WATCH_INTERVAL_MS || 3000);
const consoleHeartbeatIntervalMs = 15000;
const upstreamRequestTimeoutMs = readTimeoutMs(process.env.SELENWRIGHT_UPSTREAM_TIMEOUT_MS, 5000);
const upstreamArtifactTimeoutMs = readTimeoutMs(process.env.SELENWRIGHT_ARTIFACT_TIMEOUT_MS, 15000);
const terminateAttemptTimeoutMs = readTimeoutMs(process.env.SELENWRIGHT_TERMINATE_TIMEOUT_MS, 3000);
const demoMode = process.env.DEMO_MODE === "true";
const staticRootDir = resolveStaticRootDir();
const maxRequestBodyBytes = Number(process.env.SELENWRIGHT_MAX_BODY_BYTES || 1024 * 1024);
const maxSseClients = Number(process.env.SELENWRIGHT_MAX_SSE_CLIENTS || 64);
const maxSseClientAgeMs = Number(process.env.SELENWRIGHT_MAX_SSE_CLIENT_AGE_MS || 4 * 60 * 60 * 1000);
const maxWsFrameBytes = Number(
  process.env.SELENWRIGHT_WS_MAX_FRAME_BYTES || DEFAULT_MAX_WS_FRAME_BYTES,
);
const maxWsFragmentedBytes = Number(
  process.env.SELENWRIGHT_WS_MAX_FRAGMENTED_BYTES || 4 << 20,
);
const allowedOrigins = parseAllowedOrigins(process.env.SELENWRIGHT_ALLOWED_ORIGINS);

const baseSecurityHeaders = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
};

const htmlContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

function withSecurityHeaders(headers = {}) {
  const contentType = headers["Content-Type"] || headers["content-type"] || "";
  const merged = { ...baseSecurityHeaders, ...headers };
  if (/html/i.test(contentType) && !merged["Content-Security-Policy"]) {
    merged["Content-Security-Policy"] = htmlContentSecurityPolicy;
  }
  return merged;
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
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
  res.writeHead(statusCode, withSecurityHeaders({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  }));
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
      const writeResult = client.response.write(message);
      if (!writeResult) {
        // Slow client — drop rather than buffer indefinitely.
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
        // response may already be destroyed
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
    // response may already be destroyed
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
        // Slow client — buffer is already queuing; drop to avoid unbounded memory.
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
    // Upstream may already be torn down; caller will destroy the socket.
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

function buildDemoConsoleSnapshot() {
  const now = new Date();
  const t = (offsetMs) => new Date(now.getTime() - offsetMs).toISOString();

  return {
    config: {
      ok: true,
      value: {
        browserCatalog: [
          { name: "chromium", versions: [{ version: "latest", image: "chromium:latest" }] },
          { name: "chrome", versions: [{ version: "latest", image: "chrome:latest" }, { version: "130", image: "chrome:130" }] },
          { name: "firefox", versions: [{ version: "latest", image: "firefox:latest" }, { version: "130", image: "firefox:130" }] },
        ],
      },
    },
    downloads: { ok: true, value: [] },
    historySettings: { ok: true, value: { enabled: true, retentionDays: 7 } },
    logs: {
      ok: true,
      value: [
        { filename: "demo-abc123.log", sessionId: "demo-abc123", browser: "chromium", protocol: "playwright", size: 42800, createdAt: t(2 * 60 * 1000) },
        { filename: "demo-def456.log", sessionId: "demo-def456", browser: "chromium", protocol: "playwright", size: 18300, createdAt: t(8 * 60 * 1000) },
        { filename: "demo-ghi789.log", sessionId: "demo-ghi789", browser: "firefox", protocol: "selenium", size: 5100, createdAt: t(3600 * 1000) },
      ],
    },
    status: {
      ok: true,
      value: {
        browsers: {
          chromium: {
            latest: {
              default: {
                count: 2,
                sessions: [
                  { id: "demo-abc123", started: t(2 * 60 * 1000), vnc: true, caps: { version: "latest" } },
                  { id: "demo-def456", started: t(8 * 60 * 1000), vnc: true, caps: { version: "latest" } },
                ],
              },
            },
          },
          firefox: {
            latest: {
              default: {
                count: 1,
                sessions: [
                  { id: "demo-jkl012", started: t(15 * 60 * 1000), caps: { version: "latest" } },
                ],
              },
            },
          },
        },
        pending: 0,
        queued: 1,
        total: 4,
        used: 3,
        value: { message: "Demo mode — no upstream connected", ready: true },
      },
    },
    target: "demo",
    videos: {
      ok: true,
      value: [
        { filename: "demo-abc123.mp4", sessionId: "demo-abc123", browser: "chromium", protocol: "playwright", size: 1258000, durationMs: 93000, createdAt: t(2 * 60 * 1000) },
      ],
    },
  };
}

async function fetchConsoleSnapshot() {
  if (demoMode) return { ...buildDemoConsoleSnapshot(), fetchedAt: new Date().toISOString() };

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

function resolveStaticRootDir() {
  const explicitRoot = process.env.SELENWRIGHT_STATIC_ROOT;
  if (explicitRoot) {
    return path.resolve(rootDir, explicitRoot);
  }

  const builtIndexPath = path.join(distDir, "index.html");
  if (existsSync(builtIndexPath)) {
    return distDir;
  }

  return rootDir;
}

function resolveStaticFile(urlPath) {
  const trimmedPath = urlPath === "/" ? "/index.html" : urlPath;
  let decoded;
  try {
    decoded = decodeURIComponent(trimmedPath);
  } catch {
    return null;
  }
  const absolutePath = path.resolve(staticRootDir, `.${decoded.startsWith("/") ? decoded : `/${decoded}`}`);
  const rootWithSep = staticRootDir.endsWith(path.sep) ? staticRootDir : staticRootDir + path.sep;

  if (absolutePath !== staticRootDir && !absolutePath.startsWith(rootWithSep)) {
    return null;
  }

  if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
    return absolutePath;
  }

  // SPA fallback: only for extension-less paths that look like client routes.
  if (!path.extname(absolutePath)) {
    return path.join(staticRootDir, "index.html");
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

  // Issue our own Origin for the upstream handshake rather than forwarding the
  // browser-side origin; upstream CORS logic (if any) should see us, not the UI.
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

    res.writeHead(upstreamResponse.status, withSecurityHeaders({
      "Content-Type": contentType,
    }));

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

  if (protocol === "playwright") {
    sendJson(res, 501, {
      error: "terminate_not_supported",
      message:
        "Playwright sessions are driven over WebSocket and cannot be terminated via HTTP. Close the client connection instead.",
      sessionId: route.sessionId,
    });
    return;
  }

  const encodedSessionId = encodePathSegment(route.sessionId);
  const upstreamUrl = new URL(`/wd/hub/session/${encodedSessionId}`, target);

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
    // Fall back to a short text preview when upstream returns plain text.
  }

  return truncateBodyPreview(trimmed);
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
  const contentLength = Number(req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > maxRequestBodyBytes) {
    const error = new Error(`Request body exceeds ${maxRequestBodyBytes} bytes`);
    error.code = "REQUEST_TOO_LARGE";
    throw error;
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxRequestBodyBytes) {
      const error = new Error(`Request body exceeds ${maxRequestBodyBytes} bytes`);
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
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

  const filePath = resolveStaticFile(requestUrl.pathname);
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

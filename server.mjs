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
  demoMode,
  host,
  maxWsFragmentedBytes,
  maxWsFrameBytes,
  port,
  target,
} from "./server/config.mjs";
import { withSecurityHeaders } from "./server/security.mjs";
import { formatSseEvent, sendJson } from "./server/http-utils.mjs";
import { mimeTypes, resolveStaticFile, resolveStaticRootDir } from "./server/static.mjs";
import {
  buildUpstreamLiveLogUrl,
  resolveApiRoute,
  resolveUpgradeHandler,
} from "./server/api-routes.mjs";
import { handleApi } from "./server/api-proxy.mjs";
import { handleConsoleStream } from "./server/console-hub.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

const staticRootDir = resolveStaticRootDir();

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

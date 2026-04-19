import {
  consoleHeartbeatIntervalMs,
  maxWsFragmentedBytes,
  maxWsFrameBytes,
} from "./config.mjs";
import { withSecurityHeaders } from "./security.mjs";
import { formatSseEvent, sendJson } from "./http-utils.mjs";
import { buildUpstreamLiveLogUrl } from "./api-routes.mjs";
import { readWebSocketFrame } from "../server-ws-frame.mjs";
import {
  buildUpstreamWebSocketHandshake,
  consumeUpstreamWebSocketHandshake,
  createClientWebSocketFrame,
  parseWebSocketCloseFrame,
  sendUpstreamCloseCode,
} from "./ws-handshake.mjs";
import { createProxySocket } from "./ws-proxy.mjs";

export function handleLiveLogStream(req, res, requestUrl) {
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

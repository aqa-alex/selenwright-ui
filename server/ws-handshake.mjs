import { randomBytes } from "node:crypto";
import { formatForwardedHeaderLines } from "../server-ws-auth.mjs";

export function buildUpstreamOrigin(upstreamUrl) {
  const protocol = upstreamUrl.protocol === "https:" || upstreamUrl.protocol === "wss:" ? "https:" : "http:";
  return `${protocol}//${upstreamUrl.host}`;
}

export function buildUpstreamWebSocketHandshake(upstreamUrl, clientHeaders) {
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

export function consumeUpstreamWebSocketHandshake(buffer) {
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

export function createClientWebSocketFrame(opcode, payload = Buffer.alloc(0)) {
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

export function sendUpstreamCloseCode(socket, code, reason) {
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

export function parseWebSocketCloseFrame(payload) {
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


export const DEFAULT_MAX_WS_FRAME_BYTES = 1 << 20; // 1 MiB

export function readWebSocketFrame(buffer, { maxFrameBytes = DEFAULT_MAX_WS_FRAME_BYTES } = {}) {
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
      throw new Error("WebSocket frame is too large to decode safely.");
    }
    payloadLength = extendedLength;
    offset += 8;
  }

  if (maxFrameBytes > 0 && payloadLength > maxFrameBytes) {
    throw new Error(
      `WebSocket frame exceeds configured maximum (${payloadLength} > ${maxFrameBytes} bytes).`,
    );
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

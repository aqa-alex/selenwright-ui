import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_WS_FRAME_BYTES,
  readWebSocketFrame,
} from "../../server-ws-frame.mjs";

function buildUnmaskedTextFrame(payload: Buffer): Buffer {
  const fin = 0x80;
  const opcode = 0x1;
  const firstByte = fin | opcode;

  if (payload.length < 126) {
    const frame = Buffer.alloc(2 + payload.length);
    frame[0] = firstByte;
    frame[1] = payload.length;
    payload.copy(frame, 2);
    return frame;
  }

  if (payload.length <= 0xffff) {
    const frame = Buffer.alloc(4 + payload.length);
    frame[0] = firstByte;
    frame[1] = 126;
    frame.writeUInt16BE(payload.length, 2);
    payload.copy(frame, 4);
    return frame;
  }

  const frame = Buffer.alloc(10 + payload.length);
  frame[0] = firstByte;
  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(payload.length), 2);
  payload.copy(frame, 10);
  return frame;
}

function buildHeaderWithDeclaredLength(declaredLength: number): Buffer {
  const fin = 0x80;
  const opcode = 0x1;
  const firstByte = fin | opcode;

  if (declaredLength <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = firstByte;
    header[1] = 126;
    header.writeUInt16BE(declaredLength, 2);
    return header;
  }
  const header = Buffer.alloc(10);
  header[0] = firstByte;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(declaredLength), 2);
  return header;
}

describe("readWebSocketFrame", () => {
  it("decodes a small unmasked text frame", () => {
    const payload = Buffer.from("hello", "utf8");
    const frame = buildUnmaskedTextFrame(payload);

    const result = readWebSocketFrame(frame);

    expect(result).not.toBeNull();
    expect(result?.opcode).toBe(0x1);
    expect(result?.fin).toBe(true);
    expect(result?.payload.toString("utf8")).toBe("hello");
    expect(result?.remaining.length).toBe(0);
  });

  it("returns null when the buffer does not yet contain a complete frame", () => {
    const payload = Buffer.from("incomplete", "utf8");
    const frame = buildUnmaskedTextFrame(payload);

    expect(readWebSocketFrame(frame.subarray(0, 3))).toBeNull();
  });

  it("rejects frames whose declared length exceeds maxFrameBytes", () => {
    const oversized = buildHeaderWithDeclaredLength(2 * 1024 * 1024);

    expect(() => readWebSocketFrame(oversized)).toThrow(/exceeds configured maximum/);
  });

  it("respects a custom maxFrameBytes override", () => {
    const payload = Buffer.from("x".repeat(200), "utf8");
    const frame = buildUnmaskedTextFrame(payload);

    expect(() => readWebSocketFrame(frame, { maxFrameBytes: 100 })).toThrow(
      /exceeds configured maximum/,
    );

    const result = readWebSocketFrame(frame, { maxFrameBytes: 1024 });
    expect(result?.payload.length).toBe(200);
  });

  it("rejects 64-bit payload lengths that cannot be indexed safely", () => {
    const header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt("18446744073709551615"), 2); // 2^64 - 1

    expect(() => readWebSocketFrame(header)).toThrow(/too large to decode safely/);
  });

  it("exposes a conservative DEFAULT_MAX_WS_FRAME_BYTES", () => {
    expect(DEFAULT_MAX_WS_FRAME_BYTES).toBe(1 << 20);
  });
});

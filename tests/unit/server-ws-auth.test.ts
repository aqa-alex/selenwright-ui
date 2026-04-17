import { describe, expect, it } from "vitest";
import {
  formatForwardedHeaderLines,
  sanitizeHeaderValue,
} from "../../server-ws-auth.mjs";

describe("sanitizeHeaderValue", () => {
  it("returns trimmed strings", () => {
    expect(sanitizeHeaderValue("  sid=abc  ")).toBe("sid=abc");
  });

  it("rejects non-string values", () => {
    expect(sanitizeHeaderValue(undefined)).toBe("");
    expect(sanitizeHeaderValue(null)).toBe("");
    expect(sanitizeHeaderValue(42)).toBe("");
  });

  it("rejects values with CR/LF/NUL to block header injection", () => {
    expect(sanitizeHeaderValue("sid=abc\r\nX-Evil: 1")).toBe("");
    expect(sanitizeHeaderValue("sid=abc\nX-Evil: 1")).toBe("");
    expect(sanitizeHeaderValue("sid=abc\0")).toBe("");
  });
});

describe("formatForwardedHeaderLines", () => {
  it("returns empty array when headers are missing or empty", () => {
    expect(formatForwardedHeaderLines(undefined)).toEqual([]);
    expect(formatForwardedHeaderLines({})).toEqual([]);
  });

  it("forwards cookie and authorization by default", () => {
    expect(
      formatForwardedHeaderLines({
        cookie: "selenwright_session=abc",
        authorization: "Basic YWxpY2U6cHc=",
      }),
    ).toEqual([
      "cookie: selenwright_session=abc",
      "authorization: Basic YWxpY2U6cHc=",
    ]);
  });

  it("ignores unrelated headers", () => {
    expect(
      formatForwardedHeaderLines({
        cookie: "selenwright_session=abc",
        "x-evil": "should not leak",
      }),
    ).toEqual(["cookie: selenwright_session=abc"]);
  });

  it("skips values that fail sanitization", () => {
    expect(
      formatForwardedHeaderLines({
        cookie: "sid=abc\r\nInjected: 1",
        authorization: "Basic YWxpY2U6cHc=",
      }),
    ).toEqual(["authorization: Basic YWxpY2U6cHc="]);
  });

  it("joins array cookie values into a single header line", () => {
    expect(
      formatForwardedHeaderLines({
        cookie: ["a=1", "b=2"],
      }),
    ).toEqual(["cookie: a=1; b=2"]);
  });
});

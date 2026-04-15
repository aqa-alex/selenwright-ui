import { describe, expect, it } from "vitest";
import { isOriginAllowed, parseAllowedOrigins } from "../../server-origin.mjs";

describe("parseAllowedOrigins", () => {
  it("returns null for empty input so callers fall back to same-origin mode", () => {
    expect(parseAllowedOrigins(undefined)).toBeNull();
    expect(parseAllowedOrigins("")).toBeNull();
    expect(parseAllowedOrigins("   ")).toBeNull();
  });

  it("splits on commas and trims whitespace", () => {
    expect(
      parseAllowedOrigins("https://a.example , https://b.example ,https://c.example"),
    ).toEqual([
      "https://a.example",
      "https://b.example",
      "https://c.example",
    ]);
  });

  it("drops empty segments", () => {
    expect(parseAllowedOrigins("https://a.example,,,https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});

describe("isOriginAllowed", () => {
  it("accepts requests without an Origin header (non-browser clients)", () => {
    expect(isOriginAllowed(undefined, "127.0.0.1:4173", null)).toBe(true);
    expect(isOriginAllowed("", "127.0.0.1:4173", null)).toBe(true);
  });

  it("same-origin mode matches only when Origin.host equals the Host header", () => {
    expect(
      isOriginAllowed("http://127.0.0.1:4173", "127.0.0.1:4173", null),
    ).toBe(true);

    // Different host.
    expect(
      isOriginAllowed("https://evil.example", "127.0.0.1:4173", null),
    ).toBe(false);

    // Different port on the same host counts as a different origin.
    expect(
      isOriginAllowed("http://127.0.0.1:9999", "127.0.0.1:4173", null),
    ).toBe(false);
  });

  it("returns false on a malformed Origin header in same-origin mode", () => {
    expect(isOriginAllowed("not-a-url", "127.0.0.1:4173", null)).toBe(false);
  });

  it("allowlist mode accepts exact matches and rejects everything else", () => {
    const allow = ["https://ops.example", "https://staff.example"];
    expect(isOriginAllowed("https://ops.example", "proxy.internal", allow)).toBe(true);
    expect(isOriginAllowed("https://staff.example", "proxy.internal", allow)).toBe(true);

    // Even when host matches, allowlist is the only source of truth once set.
    expect(isOriginAllowed("https://proxy.internal", "proxy.internal", allow)).toBe(false);
    expect(isOriginAllowed("https://attacker.example", "proxy.internal", allow)).toBe(false);
  });
});

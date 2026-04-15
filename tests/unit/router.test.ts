import { describe, expect, it } from "vitest";
import { buildSessionPath, parseRoute } from "../../src/app/router";

describe("buildSessionPath", () => {
  it("encodes reserved URL characters in the session id", () => {
    expect(buildSessionPath("session-01")).toBe("/sessions/session-01");
    expect(buildSessionPath("a/b c")).toBe("/sessions/a%2Fb%20c");
    expect(buildSessionPath("a#b?c")).toBe("/sessions/a%23b%3Fc");
  });
});

describe("parseRoute", () => {
  it("decodes the session id slice from a session-detail pathname", () => {
    expect(parseRoute("/sessions/a%2Fb%20c")).toEqual({
      name: "session-detail",
      sessionId: "a/b c",
    });
  });

  it("falls back to the raw slice when the id is not valid percent-encoded", () => {
    expect(parseRoute("/sessions/%ZZ")).toEqual({
      name: "session-detail",
      sessionId: "%ZZ",
    });
  });

  it("maps the static routes to their names", () => {
    expect(parseRoute("/")).toEqual({ name: "sessions" });
    expect(parseRoute("/sessions")).toEqual({ name: "sessions" });
    expect(parseRoute("/artifacts/logs")).toEqual({ name: "logs" });
    expect(parseRoute("/unknown")).toEqual({ name: "not-found" });
  });
});

import { describe, expect, it } from "vitest";
import {
  buildClipboardUrl,
  buildSessionDetailHref,
  buildVncWebSocketUrl,
  formatDocumentTitle,
  formatPageTitle,
  formatSessionLabel,
  getInitialVncStatus,
  getViewerModeLabel,
  readVncViewerParams,
} from "../../src/vnc/vncViewer";

describe("vnc viewer helpers", () => {
  it("builds websocket endpoints for http and https origins", () => {
    expect(buildVncWebSocketUrl("fixture session", "http://127.0.0.1:4173")).toBe(
      "ws://127.0.0.1:4173/api/vnc/fixture%20session",
    );
    expect(buildVncWebSocketUrl("fixture/session", "https://example.test")).toBe(
      "wss://example.test/api/vnc/fixture%2Fsession",
    );
    expect(buildVncWebSocketUrl("", "https://example.test")).toBe("");
  });

  it("formats session labels and page titles without adding fallback copy", () => {
    const params = readVncViewerParams("?session=session-01&name=Worker&browser=chromium");

    expect(params).toEqual({
      browserName: "chromium",
      sessionId: "session-01",
      sessionName: "Worker",
    });
    expect(formatPageTitle(params)).toBe("Worker · Chromium VNC");
    expect(formatSessionLabel(params)).toBe("Worker · session-01");
    expect(formatDocumentTitle(params.sessionId)).toBe("VNC session-01 · Selenwright UI");
  });

  it("keeps missing session and viewer mode labels stable", () => {
    expect(formatPageTitle({ browserName: "", sessionId: "", sessionName: "" })).toBe(
      "Session VNC",
    );
    expect(formatSessionLabel({ sessionId: "", sessionName: "" })).toBe("Unknown session");
    expect(buildSessionDetailHref("")).toBe("/sessions");
    expect(buildSessionDetailHref("session-01")).toBe("/sessions/session-01");
    expect(getInitialVncStatus("")).toEqual({
      message: "Session id is missing",
      state: "error",
    });
    expect(getViewerModeLabel(true)).toBe("Read only");
    expect(getViewerModeLabel(false)).toBe("Control enabled");
  });

  it("builds clipboard proxy paths and encodes the session id", () => {
    expect(buildClipboardUrl("session-01")).toBe("/api/clipboard/session-01");
    expect(buildClipboardUrl("fixture session")).toBe("/api/clipboard/fixture%20session");
    expect(buildClipboardUrl("a/b")).toBe("/api/clipboard/a%2Fb");
    expect(buildClipboardUrl("")).toBe("");
  });
});

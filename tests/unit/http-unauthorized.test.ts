import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, setUnauthorizedHandler } from "../../src/app/api/http";

describe("http 401 handler", () => {
  const realFetch = globalThis.fetch;
  const hadWindow = "window" in globalThis;

  beforeAll(() => {
    // http.ts uses window.setTimeout/clearTimeout; vitest env is "node" without jsdom,
    // so alias window → globalThis to satisfy those references.
    if (!hadWindow) {
      (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
    }
  });

  afterAll(() => {
    if (!hadWindow) {
      delete (globalThis as unknown as { window?: typeof globalThis }).window;
    }
  });

  beforeEach(() => {
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    setUnauthorizedHandler(null);
  });

  function stubResponse(status: number): Response {
    return new Response("", { status });
  }

  it("fires the handler on 401 from a data endpoint", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(stubResponse(401))) as typeof fetch;
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    const res = await fetchWithTimeout("/api/sessions/abc?protocol=playwright", { method: "DELETE" });

    expect(res.status).toBe(401);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire the handler on 401 from /api/whoami", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(stubResponse(401))) as typeof fetch;
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await fetchWithTimeout("/api/whoami");

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire the handler on 401 from /api/login", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(stubResponse(401))) as typeof fetch;
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await fetchWithTimeout("/api/login", { method: "POST" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire the handler on 401 from /api/logout", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(stubResponse(401))) as typeof fetch;
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await fetchWithTimeout("/api/logout", { method: "POST" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire the handler on non-401 responses", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(stubResponse(403))) as typeof fetch;
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await fetchWithTimeout("/api/sessions/abc");

    expect(handler).not.toHaveBeenCalled();
  });

  it("swallows exceptions thrown by the handler", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(stubResponse(401))) as typeof fetch;
    setUnauthorizedHandler(() => {
      throw new Error("boom");
    });

    const res = await fetchWithTimeout("/api/sessions/abc");

    expect(res.status).toBe(401);
  });

  it("reads path from a URL resource", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(stubResponse(401))) as typeof fetch;
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await fetchWithTimeout(new URL("http://localhost:4173/api/whoami"));

    expect(handler).not.toHaveBeenCalled();
  });
});

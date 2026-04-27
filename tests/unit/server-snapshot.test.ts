import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error — server module is plain ESM .mjs; types not provided
import { fetchConsoleSnapshot } from "../../server/snapshot.mjs";

describe("fetchConsoleSnapshot upstream auth forwarding", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.SELENWRIGHT_TARGET ??= "http://upstream.test";
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  }

  it("forwards cookie + authorization headers to every upstream call", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    globalThis.fetch = vi.fn(async (resource, init) => {
      const url = typeof resource === "string" ? resource : resource.toString();
      const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ headers: { ...rawHeaders }, url });
      return jsonResponse({});
    }) as typeof fetch;

    await fetchConsoleSnapshot({
      authorization: "Bearer abc123",
      cookie: "selenwright_session=deadbeef",
    });

    expect(calls.length).toBe(6);
    for (const call of calls) {
      expect(call.headers.cookie).toBe("selenwright_session=deadbeef");
      expect(call.headers.authorization).toBe("Bearer abc123");
      expect(call.headers.accept).toBe("application/json");
    }
  });

  it("omits auth headers when none provided (e.g. no clients connected yet)", async () => {
    const calls: { headers: Record<string, string> }[] = [];
    globalThis.fetch = vi.fn(async (_resource, init) => {
      const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ headers: { ...rawHeaders } });
      return jsonResponse({});
    }) as typeof fetch;

    await fetchConsoleSnapshot();

    expect(calls.length).toBe(6);
    for (const call of calls) {
      expect(call.headers.cookie).toBeUndefined();
      expect(call.headers.authorization).toBeUndefined();
      expect(call.headers.accept).toBe("application/json");
    }
  });

  it("forwards only the headers actually present (cookie alone, no token)", async () => {
    const calls: { headers: Record<string, string> }[] = [];
    globalThis.fetch = vi.fn(async (_resource, init) => {
      const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ headers: { ...rawHeaders } });
      return jsonResponse({});
    }) as typeof fetch;

    await fetchConsoleSnapshot({ cookie: "selenwright_session=x" });

    expect(calls.length).toBe(6);
    for (const call of calls) {
      expect(call.headers.cookie).toBe("selenwright_session=x");
      expect(call.headers.authorization).toBeUndefined();
    }
  });
});

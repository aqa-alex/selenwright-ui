import { environmentManager, QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, effectScope } from "vue";
import type { UserIdentity } from "../../src/app/api/identity";
import { useConsolePolling } from "../../src/app/composables/useConsolePolling";
import {
  ARTIFACTS_POLL_INTERVAL_MS,
  STATUS_POLL_INTERVAL_MS,
  useConsoleSnapshotQuery,
} from "../../src/app/queries/useConsoleSnapshotQuery";
import { useTerminateSessionMutation } from "../../src/app/queries/useTerminateSessionMutation";
import { useIdentityStore } from "../../src/app/stores/identity";

const NOW_ISO = "2026-10-12T10:00:00.000Z";

interface UpstreamState {
  failing: Set<string>;
  logs: string[];
  sessionsByUser: Record<string, string[]>;
  user: string;
}

let upstream: UpstreamState;
let requests: string[];

function statusPayload(sessionIds: string[]) {
  return {
    browsers: {
      chrome: {
        latest: {
          default: {
            count: sessionIds.length,
            sessions: sessionIds.map((id) => ({
              caps: { version: "latest" },
              id,
              started: NOW_ISO,
            })),
          },
        },
      },
    },
    pending: 0,
    queued: 0,
    total: 5,
    used: sessionIds.length,
    value: { message: "Ready", ready: true },
  };
}

function respond(path: string): unknown {
  switch (path) {
    case "/api/meta":
      return { target: "http://upstream.test" };
    case "/api/status":
      return statusPayload(upstream.sessionsByUser[upstream.user] ?? []);
    case "/api/config":
      return { limits: [{ key: "maxSessions", label: "Max sessions", value: "5" }] };
    case "/api/history/settings":
      return { available: true, enabled: true, retentionDays: 2 };
    case "/api/logs":
      return upstream.logs.map((filename) => ({
        createdAt: NOW_ISO,
        filename,
        sessionId: filename.replace(/\.log$/, ""),
        size: 10,
      }));
    case "/api/videos":
    case "/api/downloads":
      return [];
    default:
      return {};
  }
}

function countRequests(path: string): number {
  return requests.filter((request) => request === path).length;
}

function identity(overrides: Partial<UserIdentity> = {}): UserIdentity {
  return {
    authenticated: true,
    authMode: "embedded",
    groups: [],
    isAdmin: true,
    user: "alice",
    ...overrides,
  };
}

const globals = globalThis as unknown as { window?: typeof globalThis };
const hadWindow = "window" in globalThis;
const realFetch = globalThis.fetch;

beforeAll(() => {
  // http.ts uses window.setTimeout/clearTimeout; vitest env is "node" without jsdom.
  if (!hadWindow) {
    globals.window = globalThis;
  }
  // TanStack decides "server" (no refetchInterval) from `window` at import time.
  environmentManager.setIsServer(() => false);
});

afterAll(() => {
  if (!hadWindow) {
    delete globals.window;
  }
  environmentManager.setIsServer(() => typeof window === "undefined");
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
  requests = [];
  upstream = {
    failing: new Set(),
    logs: ["first.log"],
    sessionsByUser: { alice: ["alice-session"], bob: ["bob-session"] },
    user: "alice",
  };
  globalThis.fetch = vi.fn(async (resource: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(resource), "http://ui.test");
    const method = (init?.method || "GET").toUpperCase();
    requests.push(method === "GET" ? url.pathname : `${method} ${url.pathname}`);
    if (method === "DELETE") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    }
    if (upstream.failing.has(url.pathname)) {
      return new Response(JSON.stringify({ error: "upstream_unavailable" }), {
        headers: { "content-type": "application/json" },
        status: 502,
      });
    }
    return new Response(JSON.stringify(respond(url.pathname)), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  }) as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = realFetch;
});

function mountConsole(initialIdentity: UserIdentity | null = identity()) {
  const app = createApp({});
  app.use(createPinia());
  app.use(VueQueryPlugin, {
    queryClient: new QueryClient({
      defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false, staleTime: 15_000 } },
    }),
  });
  const identityStore = app.runWithContext(() => useIdentityStore());
  if (initialIdentity) {
    identityStore.setIdentity(initialIdentity);
  }
  const scope = effectScope();
  const mounted = app.runWithContext(() =>
    scope.run(() => {
      useConsolePolling();
      return {
        snapshot: useConsoleSnapshotQuery(),
        terminate: useTerminateSessionMutation(),
      };
    }),
  )!;
  return { ...mounted, identityStore, unmount: () => scope.stop() };
}

async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe("console polling", () => {
  it("polls status every few seconds but loads configuration and history settings once", async () => {
    const { unmount } = mountConsole();
    await advance(0);

    await advance(STATUS_POLL_INTERVAL_MS * 3);

    expect(countRequests("/api/status")).toBe(4);
    expect(countRequests("/api/config")).toBe(1);
    expect(countRequests("/api/history/settings")).toBe(1);
    expect(countRequests("/api/meta")).toBe(1);
    expect(countRequests("/api/logs")).toBe(1);
    unmount();
  });

  it("refreshes artifact lists on a slow interval", async () => {
    const { unmount } = mountConsole();
    await advance(0);

    await advance(ARTIFACTS_POLL_INTERVAL_MS);

    expect(countRequests("/api/logs")).toBe(2);
    expect(countRequests("/api/videos")).toBe(2);
    expect(countRequests("/api/downloads")).toBe(2);
    unmount();
  });

  it("refreshes artifact lists as soon as a session finishes", async () => {
    const { snapshot, unmount } = mountConsole();
    await advance(0);
    expect(snapshot.data.value?.logs.map((log) => log.filename)).toEqual(["first.log"]);

    upstream.sessionsByUser.alice = [];
    upstream.logs = ["alice-session.log", "first.log"];
    await advance(STATUS_POLL_INTERVAL_MS);

    expect(countRequests("/api/logs")).toBe(2);
    expect(snapshot.data.value?.logs.map((log) => log.filename)).toEqual([
      "alice-session.log",
      "first.log",
    ]);
    unmount();
  });

  it("builds the console dataset from the polled endpoints", async () => {
    const { snapshot, unmount } = mountConsole();
    await advance(0);

    const dataset = snapshot.data.value;
    expect(dataset?.sessions.map((session) => session.id)).toEqual(["alice-session"]);
    expect(dataset?.logs.map((log) => log.filename)).toEqual(["first.log"]);
    expect(dataset?.configuration.limits).toContainEqual(
      expect.objectContaining({ key: "maxSessions", value: "5" }),
    );
    expect(dataset?.settings.artifactHistory).toMatchObject({ enabled: true, retentionDays: 2 });
    unmount();
  });

  it("does not poll before the user signs in", async () => {
    const { identityStore, unmount } = mountConsole(identity({ authenticated: false, user: "unknown" }));
    await advance(STATUS_POLL_INTERVAL_MS * 3);
    expect(requests).toEqual([]);

    identityStore.setIdentity(identity());
    await advance(0);

    expect(countRequests("/api/status")).toBe(1);
    unmount();
  });

  it("stops polling when the session is lost", async () => {
    const { identityStore, unmount } = mountConsole();
    await advance(0);
    identityStore.resetToAnonymous();
    await advance(0);
    const statusRequestsAfterLogout = countRequests("/api/status");

    await advance(STATUS_POLL_INTERVAL_MS * 3);

    expect(countRequests("/api/status")).toBe(statusRequestsAfterLogout);
    unmount();
  });

  it("does not show the previous user's data after switching users", async () => {
    const { identityStore, snapshot, unmount } = mountConsole();
    await advance(0);
    expect(snapshot.data.value?.sessions.map((session) => session.id)).toEqual(["alice-session"]);

    upstream.user = "bob";
    identityStore.setIdentity(identity({ user: "bob" }));
    await advance(0);

    expect(snapshot.data.value?.sessions.map((session) => session.id)).toEqual(["bob-session"]);
    unmount();
  });

  it("keeps the last artifact list when a refresh fails", async () => {
    const { snapshot, unmount } = mountConsole();
    await advance(0);

    upstream.failing.add("/api/logs");
    await advance(ARTIFACTS_POLL_INTERVAL_MS);

    expect(countRequests("/api/logs")).toBe(2);
    expect(snapshot.data.value?.logs.map((log) => log.filename)).toEqual(["first.log"]);
    unmount();
  });

  it("reports a failed status poll instead of showing stale sessions", async () => {
    const { snapshot, unmount } = mountConsole();
    await advance(0);

    upstream.failing.add("/api/status");
    await advance(STATUS_POLL_INTERVAL_MS);

    expect(snapshot.data.value?.connection.ready).toBe(false);
    expect(snapshot.data.value?.sessions).toEqual([]);
    unmount();
  });

  it("refreshes sessions right after terminating one", async () => {
    const { snapshot, terminate, unmount } = mountConsole();
    await advance(0);
    const statusRequestsBefore = countRequests("/api/status");

    upstream.sessionsByUser.alice = [];
    await terminate.mutateAsync({ id: "alice-session", protocol: "playwright" });
    await advance(0);

    expect(countRequests("/api/status")).toBe(statusRequestsBefore + 1);
    expect(snapshot.data.value?.sessions).toEqual([]);
    unmount();
  });
});

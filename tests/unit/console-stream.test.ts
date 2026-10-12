import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, effectScope, nextTick } from "vue";
import { setUnauthorizedHandler, subscribeToConsoleData } from "../../src/app/api";
import type { UserIdentity } from "../../src/app/api/identity";
import { useConsoleStream } from "../../src/app/composables/useConsoleStream";
import { useIdentityStore } from "../../src/app/stores/identity";

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  closed = false;
  listeners = new Map<string, (event: MessageEvent<string>) => void>();
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(name: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(name, listener);
  }

  close() {
    this.closed = true;
  }

  emitSnapshot(snapshot: unknown) {
    this.listeners.get("snapshot")?.({ data: JSON.stringify(snapshot) } as MessageEvent<string>);
  }
}

function openStreams() {
  return FakeEventSource.instances.filter((source) => !source.closed);
}

function identity(overrides: Partial<UserIdentity>): UserIdentity {
  return {
    authenticated: true,
    authMode: "embedded",
    groups: [],
    isAdmin: false,
    user: "alice",
    ...overrides,
  };
}

const globals = globalThis as unknown as {
  EventSource?: unknown;
  window?: typeof globalThis;
};
const hadWindow = "window" in globalThis;
const realFetch = globalThis.fetch;

beforeAll(() => {
  // http.ts uses window.setTimeout/clearTimeout; vitest env is "node" without jsdom.
  if (!hadWindow) {
    globals.window = globalThis;
  }
});

afterAll(() => {
  if (!hadWindow) {
    delete globals.window;
  }
});

beforeEach(() => {
  FakeEventSource.instances = [];
  globals.EventSource = FakeEventSource;
});

afterEach(() => {
  delete globals.EventSource;
  globalThis.fetch = realFetch;
  setUnauthorizedHandler(null);
});

describe("console stream lifecycle", () => {
  function mountConsoleStream() {
    const app = createApp({});
    app.use(createPinia());
    app.use(VueQueryPlugin, { queryClient: new QueryClient() });
    const scope = effectScope();
    app.runWithContext(() => scope.run(() => useConsoleStream()));
    return {
      identityStore: app.runWithContext(() => useIdentityStore()),
      unmount: () => scope.stop(),
    };
  }

  it("opens the console stream only after the user signs in", async () => {
    const { identityStore, unmount } = mountConsoleStream();

    identityStore.setIdentity(identity({ authenticated: false, user: "unknown" }));
    await nextTick();
    expect(openStreams()).toHaveLength(0);

    identityStore.setIdentity(identity({ user: "alice" }));
    await nextTick();
    expect(openStreams()).toHaveLength(1);

    unmount();
  });

  it("opens the console stream right away when auth is disabled", async () => {
    const { identityStore, unmount } = mountConsoleStream();

    identityStore.setIdentity(identity({ authenticated: false, authMode: "none", user: "unknown" }));
    await nextTick();

    expect(openStreams()).toHaveLength(1);
    unmount();
  });

  it("reopens the console stream when the signed-in user changes", async () => {
    const { identityStore, unmount } = mountConsoleStream();

    identityStore.setIdentity(identity({ user: "alice" }));
    await nextTick();
    const aliceStream = openStreams()[0];

    identityStore.setIdentity(identity({ user: "bob" }));
    await nextTick();

    expect(aliceStream.closed).toBe(true);
    expect(openStreams()).toHaveLength(1);
    expect(openStreams()[0]).not.toBe(aliceStream);
    unmount();
  });

  it("closes the console stream when the session is lost", async () => {
    const { identityStore, unmount } = mountConsoleStream();

    identityStore.setIdentity(identity({ user: "alice" }));
    await nextTick();
    expect(openStreams()).toHaveLength(1);
    identityStore.resetToAnonymous();
    await nextTick();

    expect(openStreams()).toHaveLength(0);
    unmount();
  });

  it("closes the console stream on unmount", async () => {
    const { identityStore, unmount } = mountConsoleStream();

    identityStore.setIdentity(identity({ user: "alice" }));
    await nextTick();
    expect(openStreams()).toHaveLength(1);
    unmount();

    expect(openStreams()).toHaveLength(0);
  });
});

describe("console stream auth loss", () => {
  function stubWhoami(body: unknown) {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    return fetchMock;
  }

  it("sends the user to login when a snapshot reports 401 and the session is gone", async () => {
    stubWhoami({ authenticated: false, authMode: "embedded", groups: [], isAdmin: false, user: "unknown" });
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);

    const subscription = subscribeToConsoleData();
    FakeEventSource.instances[0].emitSnapshot({
      config: { error: "Request failed for /config (401)", ok: false, status: 401 },
    });

    await vi.waitFor(() => expect(unauthorized).toHaveBeenCalledTimes(1));
    subscription.close();
  });

  it("does not probe the session for non-auth upstream failures", async () => {
    const fetchMock = stubWhoami({});

    const subscription = subscribeToConsoleData();
    FakeEventSource.instances[0].emitSnapshot({
      config: { error: "Request failed for /config (502)", ok: false, status: 502 },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).not.toHaveBeenCalled();
    subscription.close();
  });
});

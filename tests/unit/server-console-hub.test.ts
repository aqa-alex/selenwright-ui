import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface SnapshotSection {
  ok: boolean;
  value?: { user: string; version: number };
  error?: string;
}

interface Snapshot {
  config: SnapshotSection;
}

interface TestClient {
  close: () => void;
  snapshots: () => Snapshot[];
}

const SESSION_USERS: Record<string, string> = {
  "selenwright_session=alice": "alice",
  "selenwright_session=bob": "bob",
};

describe("console SSE hub credential isolation", () => {
  const realFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  let upstreamVersion = 1;
  let handleConsoleStream: (req: unknown, res: unknown) => void;
  let openClients: TestClient[] = [];

  beforeEach(async () => {
    process.env.SELENWRIGHT_TARGET = "http://upstream.test";
    process.env.SELENWRIGHT_WATCH_INTERVAL_MS = "20";
    upstreamVersion = 1;
    openClients = [];

    globalThis.fetch = vi.fn(async (_resource, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const user = SESSION_USERS[headers.cookie ?? ""];
      if (!user) {
        return new Response("Unauthorized", {
          headers: { "content-type": "text/plain" },
          status: 401,
        });
      }
      return new Response(JSON.stringify({ user, version: upstreamVersion }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    }) as typeof fetch;

    vi.resetModules();
    // @ts-expect-error — server module is plain ESM .mjs; types not provided
    ({ handleConsoleStream } = await import("../../server/console-hub.mjs"));
  });

  afterEach(() => {
    for (const client of openClients) {
      client.close();
    }
    globalThis.fetch = realFetch;
    process.env = { ...savedEnv };
  });

  function connect(cookie?: string): TestClient {
    const req = Object.assign(new EventEmitter(), {
      headers: cookie ? { cookie } : {},
      method: "GET",
    });
    const chunks: string[] = [];
    const res = {
      end: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => {
        chunks.push(String(chunk));
        return true;
      }),
      writeHead: vi.fn(),
    };
    handleConsoleStream(req, res);

    const client: TestClient = {
      close: () => req.emit("close"),
      snapshots: () =>
        chunks
          .join("")
          .split("\n\n")
          .filter((block) => block.startsWith("event: snapshot"))
          .map((block) =>
            JSON.parse(
              block
                .split("\n")
                .filter((line) => line.startsWith("data: "))
                .map((line) => line.slice("data: ".length))
                .join("\n"),
            ) as Snapshot,
          ),
    };
    openClients.push(client);
    return client;
  }

  function usersSeenBy(client: TestClient): (string | null)[] {
    return client.snapshots().map((snapshot) => snapshot.config.value?.user ?? null);
  }

  async function settle(ms = 120) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  it("never sends a client a snapshot fetched with another client's cookie", async () => {
    const alice = connect("selenwright_session=alice");
    await vi.waitFor(() => expect(alice.snapshots().length).toBeGreaterThan(0));

    const bob = connect("selenwright_session=bob");
    await vi.waitFor(() => expect(bob.snapshots().length).toBeGreaterThan(0));
    await settle();

    expect(new Set(usersSeenBy(alice))).toEqual(new Set(["alice"]));
    expect(new Set(usersSeenBy(bob))).toEqual(new Set(["bob"]));
  });

  it("does not let an earlier client with an expired cookie break a signed-in client", async () => {
    const stale = connect("selenwright_session=expired");
    await vi.waitFor(() => expect(stale.snapshots().length).toBeGreaterThan(0));

    const alice = connect("selenwright_session=alice");
    await settle();

    expect(usersSeenBy(alice)).toContain("alice");
    expect(alice.snapshots().every((snapshot) => snapshot.config.ok)).toBe(true);
  });

  it("does not hand an unauthenticated client data fetched with someone else's cookie", async () => {
    const alice = connect("selenwright_session=alice");
    await vi.waitFor(() => expect(alice.snapshots().length).toBeGreaterThan(0));

    const anonymous = connect();
    await vi.waitFor(() => expect(anonymous.snapshots().length).toBeGreaterThan(0));
    await settle();

    expect(anonymous.snapshots().every((snapshot) => !snapshot.config.ok)).toBe(true);
  });

  it("drops the cached snapshot once the last client disconnects", async () => {
    const first = connect("selenwright_session=alice");
    await vi.waitFor(() => expect(first.snapshots().length).toBeGreaterThan(0));
    first.close();

    upstreamVersion = 2;
    const second = connect("selenwright_session=alice");
    await vi.waitFor(() => expect(second.snapshots().length).toBeGreaterThan(0));

    expect(second.snapshots()[0].config.value?.version).toBe(2);
  });
});

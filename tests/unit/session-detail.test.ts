import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { renderToString } from "@vue/server-renderer";
import { createPinia, setActivePinia } from "pinia";
import { createSSRApp } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import SessionDetailPage from "../../src/app/pages/SessionDetailPage.vue";
import type { SessionDetailPageModel } from "../../src/app/session-detail/sessionDetail";
import {
  buildVncViewerHref,
  canTerminateSession,
  filterLogContent,
  getLiveLogStatusText,
} from "../../src/app/session-detail/sessionDetail";
import type { ConsoleSession } from "../../src/data/service";

describe("SessionDetailPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the missing session fallback", async () => {
    const html = await renderSessionDetailPage({ session: null });

    expect(html).toContain("<h1>Session not found</h1>");
    expect(html).toContain("Unknown session");
    expect(html).toContain('href="/sessions"');
  });

  it("renders derived action targets for VNC, DevTools, and terminate", async () => {
    const session = buildSession({
      artifacts: {
        devtools: true,
        downloads: 2,
        savedLogs: true,
        video: true,
        vnc: true,
      },
      metadata: {
        devtoolsEndpoint: "ws://devtools.example/session-01",
        logFilename: "session-01.log",
      },
      name: "worker",
      protocol: "playwright",
    });
    const html = await renderSessionDetailPage({ session });

    expect(html).toContain("<h1>chromium-session-01</h1>");
    expect(html).toContain("Running playwright session on Chromium 130.");
    expect(html).toContain(
      'href="/vnc.html?browser=chromium&amp;name=worker&amp;session=session-01"',
    );
    expect(html).toContain('data-copy="ws://devtools.example/session-01"');
    expect(html).toMatch(/data-action="terminate-session"[^>]*data-session-id="session-01"/);
    expect(html).toContain("Terminate");
  });

  it("disables terminate for inactive sessions", async () => {
    const session = buildSession({ artifacts: { vnc: true }, status: "completed" });
    const html = await renderSessionDetailPage({ session });

    expect(html).toMatch(/data-action="terminate-session"[^>]*disabled/);
  });

  it("renders saved log filtering and download target", async () => {
    const session = buildSession({
      artifacts: { savedLogs: true },
      metadata: { logFilename: "session-01.log" },
    });
    const html = await renderSessionDetailPage({
      logFiles: {
        "session-01.log": {
          content: "2026-04-10 session start\n2026-04-10 heartbeat",
          error: "",
          loaded: true,
          loading: false,
        },
      },
      logSearch: "heartbeat",
      session,
    });

    expect(html).toContain('placeholder="Search inside log"');
    expect(html).toContain("2026-04-10 heartbeat");
    expect(html).not.toContain("2026-04-10 session start</pre>");
    expect(html).toContain('href="/api/logs/file/session-01.log"');
  });

  it("renders live log reconnect actions", async () => {
    const session = buildSession({
      artifacts: { liveLogs: true, savedLogs: true },
      metadata: { logFilename: "session-01.log" },
    });
    const html = await renderSessionDetailPage({
      liveLogs: {
        ...defaultLiveLogs(),
        error: "Stream closed",
        message: "Live stream closed.",
        sessionId: session.id,
        source: "live",
        status: "closed",
      },
      session,
    });

    expect(html).toContain("Open saved log");
    expect(html).toContain("Stream closed");
    expect(html).toContain("Reconnect");
  });
});

describe("session detail derived helpers", () => {
  it("builds stable action labels and targets", () => {
    const session = buildSession({ artifacts: { vnc: true }, name: "worker" });

    expect(buildVncViewerHref(session)).toBe(
      "/vnc.html?browser=chromium&name=worker&session=session-01",
    );
    expect(canTerminateSession(session, "")).toBe(true);
    expect(canTerminateSession(session, session.id)).toBe(false);
    expect(getLiveLogStatusText({ ...defaultLiveLogs(), status: "streaming" })).toBe(
      "Streaming live log output",
    );
    expect(filterLogContent("first\nheartbeat\nlast", "heart")).toBe("heartbeat");
  });
});

async function renderSessionDetailPage(overrides: Partial<SessionDetailPageModel> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const app = createSSRApp(SessionDetailPage, { model: buildModel(overrides) });
  app.use(VueQueryPlugin, { queryClient });
  return renderToString(app);
}

function buildModel(overrides: Partial<SessionDetailPageModel> = {}): SessionDetailPageModel {
  const session = overrides.session === undefined ? buildSession() : overrides.session;

  return {
    liveLogs: { ...defaultLiveLogs(), ...(overrides.liveLogs || {}) },
    logFiles: overrides.logFiles || {},
    logSearch: overrides.logSearch || "",
    logs: overrides.logs || [],
    preferences: {
      timeFormat: "24h",
      timezone: "utc",
      ...(overrides.preferences || {}),
    },
    routeSessionId: overrides.routeSessionId || session?.id || "missing-session",
    session,
    terminatingSessionId: overrides.terminatingSessionId || "",
  };
}

function defaultLiveLogs() {
  return {
    autoScroll: true,
    content: "",
    error: "",
    message: "Select a running session to stream logs.",
    sessionId: "",
    source: "none",
    status: "idle",
  };
}

type SessionOverrides = Partial<Omit<ConsoleSession, "artifacts" | "metadata">> & {
  artifacts?: Partial<ConsoleSession["artifacts"]>;
  metadata?: Partial<ConsoleSession["metadata"]>;
};

function buildSession(overrides: SessionOverrides = {}): ConsoleSession {
  const artifacts = {
    clipboard: false,
    devtools: false,
    downloads: 0,
    liveLogs: false,
    liveView: false,
    logs: false,
    savedLogs: false,
    video: false,
    vnc: false,
    ...(overrides.artifacts || {}),
  };
  const metadata = {
    clipboardEndpoint: "",
    container: null,
    devtoolsEndpoint: "",
    downloadEndpoint: "",
    liveLogEndpoint: "",
    logEndpoint: "",
    logFileEndpoint: "",
    logFilename: "",
    protocolEndpoint: "",
    quota: "default",
    screen: "1920x1080",
    videoFilename: "",
    vncEndpoint: "",
    ...(overrides.metadata || {}),
  };

  return {
    artifacts,
    browser: "chromium",
    browserVersion: "130",
    capabilities: {
      browserName: "chromium",
      browserVersion: "130",
      enableLog: true,
      enableVNC: false,
      enableVideo: false,
      name: "session",
      screenResolution: "1920x1080",
    },
    clipboardPreview: "",
    durationMs: 60_000,
    endpoint: "",
    finishedAt: null,
    id: "session-01",
    lastActivityAt: "2026-04-10T09:59:30.000Z",
    livePreviewUrl: "",
    metadata,
    name: "session",
    node: "default",
    order: 0,
    protocol: "selenium",
    protocolVersion: "4",
    startedAt: "2026-04-10T09:58:30.000Z",
    status: "running",
    ...overrides,
    artifacts,
    metadata,
  };
}

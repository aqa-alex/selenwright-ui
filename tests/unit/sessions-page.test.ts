import { renderToString } from "@vue/server-renderer";
import { createPinia, setActivePinia } from "pinia";
import { createSSRApp } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import SessionsPage from "../../src/app/pages/SessionsPage.vue";
import type { SessionsPageModel } from "../../src/app/sessions/sessionTable";
import type { ConsoleSession } from "../../src/app/api";

describe("SessionsPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the empty state without table chrome", async () => {
    const html = await renderSessionsPage({ sessions: [] });

    expect(html).toContain("<h1>Sessions</h1>");
    expect(html).toContain("No active sessions");
    expect(html).not.toContain("Session list");
  });

  it("renders the compact filter row with current values", async () => {
    const html = await renderSessionsPage({
      filters: {
        activeOnly: true,
        browser: "firefox",
        protocol: "playwright",
        search: "fixture",
        sort: "started",
        status: "running",
      },
      sessions: [
        buildSession({
          browser: "firefox",
          name: "fixture-target",
          protocol: "playwright",
        }),
      ],
    });

    expect(html).toContain('placeholder="Search session id, name, browser"');
    expect(html).toContain('value="fixture"');
    expect(html).toMatch(/<select[^>]*value="playwright"/);
    expect(html).toMatch(/<select[^>]*value="running"/);
    expect(html).toMatch(/<select[^>]*value="firefox"/);
    expect(html).toMatch(/checked[^>]*type="checkbox"/);
  });

  it("renders selected rows and status badges from the Vue table model", async () => {
    const html = await renderSessionsPage({
      selectedSessionId: "session-02",
      sessions: [
        buildSession({ id: "session-01", name: "alpha" }),
        buildSession({ id: "session-02", name: "beta", status: "failed" }),
      ],
    });

    expect(html).toContain('class="session-row selected"');
    expect(html).toContain('data-session-id="session-02" tabindex="0"');
    expect(html).toContain('class="status-badge status-failed"');
    expect(html).toContain("Failed");
  });

  it("renders the filtered empty state with reset action", async () => {
    const html = await renderSessionsPage({
      filters: {
        activeOnly: false,
        browser: "all",
        protocol: "all",
        search: "no-match",
        sort: "started",
        status: "all",
      },
      sessions: [buildSession({ id: "session-01", name: "alpha" })],
    });

    expect(html).toContain("No matching sessions");
    expect(html).toMatch(/<button[^>]*>\s*Reset filters/);
  });
});

async function renderSessionsPage(overrides: Partial<SessionsPageModel> = {}) {
  const model: SessionsPageModel = {
    filters: {
      activeOnly: false,
      browser: "all",
      protocol: "all",
      search: "",
      sort: "started",
      status: "all",
    },
    preferences: {
      timeFormat: "24h",
      timezone: "utc",
    },
    selectedSessionId: null,
    sessions: [buildSession()],
    ...overrides,
  };

  return renderToString(createSSRApp(SessionsPage, { model }));
}

type SessionOverrides = Partial<Omit<ConsoleSession, "artifacts">> & {
  artifacts?: Partial<ConsoleSession["artifacts"]>;
};

function buildSession(overrides: SessionOverrides = {}): ConsoleSession {
  const artifacts = {
    clipboard: false,
    devtools: false,
    downloads: 0,
    liveLogs: true,
    liveView: false,
    logs: true,
    savedLogs: false,
    video: false,
    vnc: false,
    ...(overrides.artifacts || {}),
  };

  return {
    artifacts,
    browser: "chrome",
    browserVersion: "123.0",
    capabilities: {
      browserName: "chrome",
      browserVersion: "123.0",
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
    metadata: {
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
    },
    name: "session",
    node: "default",
    order: 0,
    protocol: "selenium",
    protocolVersion: "4",
    startedAt: "2026-04-10T09:58:30.000Z",
    status: "running",
    ...overrides,
    artifacts,
  };
}

import { describe, expect, it } from "vitest";
import {
  buildArtifactIndicators,
  buildBrowserFilterOptions,
  buildSessionColumnFilters,
  buildSessionRowSelection,
  buildSessionSorting,
  getFilteredSessionsForState,
} from "../../src/app/sessions/sessionTable";
import type { ConsoleSession } from "../../src/app/api";

describe("session table logic", () => {
  it("filters by search, protocol, status, browser, and active-only state", () => {
    const sessions = [
      buildSession({ browser: "chrome", id: "chrome-01", name: "chrome-runner" }),
      buildSession({
        browser: "firefox",
        id: "firefox-01",
        name: "fixture-target",
        protocol: "playwright",
      }),
      buildSession({
        browser: "firefox",
        id: "firefox-failed",
        name: "fixture-target-failed",
        protocol: "playwright",
        status: "failed",
      }),
    ];

    const filtered = getFilteredSessionsForState(sessions, {
      activeOnly: true,
      browser: "firefox",
      protocol: "playwright",
      search: "target",
      sort: "session",
      status: "running",
    });

    expect(filtered.map((session) => session.id)).toEqual(["firefox-01"]);
  });

  it("sorts by the requested session table key", () => {
    const sessions = [
      buildSession({ durationMs: 1000, id: "short", name: "b-session" }),
      buildSession({ durationMs: 5000, id: "long", name: "a-session" }),
      buildSession({ durationMs: 3000, id: "mid", name: "c-session" }),
    ];

    expect(
      getFilteredSessionsForState(sessions, baseFilters({ sort: "duration" })).map(
        (session) => session.id,
      ),
    ).toEqual(["long", "mid", "short"]);

    expect(
      getFilteredSessionsForState(sessions, baseFilters({ sort: "session" })).map(
        (session) => session.id,
      ),
    ).toEqual(["long", "short", "mid"]);
  });

  it("builds TanStack table state from the current console filters", () => {
    expect(
      buildSessionColumnFilters({
        activeOnly: true,
        browser: "firefox",
        protocol: "playwright",
        search: "fixture",
        sort: "started",
        status: "running",
      }),
    ).toEqual([
      { id: "search", value: "fixture" },
      { id: "protocol", value: "playwright" },
      { id: "status", value: "running" },
      { id: "browser", value: "firefox" },
      { id: "active", value: true },
    ]);
    expect(buildSessionSorting("duration")).toEqual([{ desc: true, id: "duration" }]);
    expect(buildSessionRowSelection("session-01")).toEqual({ "session-01": true });
  });

  it("keeps compact table options and artifact indicators terse", () => {
    const sessions = [
      buildSession({ browser: "firefox" }),
      buildSession({ browser: "chrome" }),
      buildSession({ browser: "chrome" }),
    ];

    expect(buildBrowserFilterOptions(sessions)).toEqual([
      { label: "All", value: "all" },
      { label: "Chrome", value: "chrome" },
      { label: "Firefox", value: "firefox" },
    ]);
    expect(
      buildArtifactIndicators(
        buildSession({
          artifacts: {
            downloads: 2,
            logs: true,
            video: true,
          },
        }),
      ).map((indicator) => indicator.label),
    ).toEqual(["Video", "Logs", "DL 2"]);
  });
});

function baseFilters(overrides: Partial<Parameters<typeof getFilteredSessionsForState>[1]> = {}) {
  return {
    activeOnly: false,
    browser: "all",
    protocol: "all",
    search: "",
    sort: "started",
    status: "all",
    ...overrides,
  };
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
    browserVersion: "latest",
    capabilities: {
      browserName: "chrome",
      browserVersion: "latest",
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

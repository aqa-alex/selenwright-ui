import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConsoleDatasetFromSnapshot } from "../../src/app/api";

const NOW_ISO = "2026-04-10T10:00:00.000Z";

describe("data service normalization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes an active session as running with live logs", () => {
    const session = buildConsoleDatasetFromSnapshot(
      buildStatusSnapshot({
        caps: { version: "latest" },
        id: "active-session",
        started: "2026-04-10T09:59:00.000Z",
        vnc: true,
      }),
    ).sessions[0];

    expect(session.status).toBe("running");
    expect(session.artifacts.liveLogs).toBe(true);
    expect(session.artifacts.logs).toBe(true);
  });

  it("preserves explicit failed status and disables live logs", () => {
    const session = buildConsoleDatasetFromSnapshot(
      buildStatusSnapshot({
        caps: { version: "latest" },
        id: "explicit-status-session",
        started: "2026-04-10T09:59:00.000Z",
        status: "Failed",
      }),
    ).sessions[0];

    expect(session.status).toBe("failed");
    expect(session.artifacts.liveLogs).toBe(false);
    expect(session.artifacts.logs).toBe(false);
  });

  it("enriches artifact availability flags from saved logs and videos", () => {
    const dataset = buildConsoleDatasetFromSnapshot({
      fetchedAt: NOW_ISO,
      logs: {
        ok: true,
        value: [
          {
            browser: "chrome",
            createdAt: "2026-04-10T09:59:20.000Z",
            filename: "artifact-session.log",
            protocol: "selenium",
            sessionId: "artifact-session",
            size: 1024,
          },
        ],
      },
      status: {
        ok: true,
        value: {
          browsers: {
            chrome: {
              latest: {
                default: {
                  count: 1,
                  sessions: [
                    {
                      caps: { version: "latest" },
                      id: "artifact-session",
                      started: "2026-04-10T09:59:00.000Z",
                    },
                  ],
                },
              },
            },
          },
          pending: 0,
          queued: 0,
          total: 1,
          used: 1,
          value: { message: "Ready", ready: true },
        },
      },
      videos: {
        ok: true,
        value: [
          {
            browser: "chrome",
            createdAt: "2026-04-10T09:59:10.000Z",
            durationMs: 33_000,
            filename: "artifact-session.mp4",
            protocol: "selenium",
            sessionId: "artifact-session",
            size: 2048,
          },
        ],
      },
    });

    const session = dataset.sessions[0];
    expect(session.artifacts.savedLogs).toBe(true);
    expect(session.artifacts.logs).toBe(true);
    expect(session.artifacts.video).toBe(true);
    expect(session.capabilities.enableLog).toBe(true);
    expect(session.capabilities.enableVideo).toBe(true);
    expect(session.metadata.logFilename).toBe("artifact-session.log");
    expect(session.metadata.videoFilename).toBe("artifact-session.mp4");
  });

  it("keeps upstream fallback messages when status is unavailable", () => {
    const dataset = buildConsoleDatasetFromSnapshot({
      fetchedAt: NOW_ISO,
      historySettings: {
        ok: false,
        error: "Artifact history settings unavailable",
      },
      status: {
        ok: false,
        error: "Status endpoint unavailable",
      },
    });

    expect(dataset.connection.ready).toBe(false);
    expect(dataset.connection.message).toBe("Live status unavailable");
    expect(dataset.connection.statusEndpointMessage).toBe("Status endpoint unavailable");
    expect(dataset.system.runtimeMessage).toBe("Status endpoint unavailable");
    expect(dataset.system.healthNotes).toEqual(["Status endpoint unavailable"]);
    expect(dataset.settings.artifactHistory.reason).toBe("Artifact history settings unavailable");
  });

  it("normalizes artifact history settings from enabled payloads", () => {
    const dataset = buildConsoleDatasetFromSnapshot({
      fetchedAt: NOW_ISO,
      historySettings: {
        ok: true,
        value: {
          enabled: true,
          retentionDays: "14",
        },
      },
    });

    expect(dataset.settings.artifactHistory).toEqual({
      available: true,
      enabled: true,
      reason: "",
      retentionDays: 14,
    });
  });

  it("derives inventory protocol from the browser catalog, not the browser name", () => {
    const dataset = buildConsoleDatasetFromSnapshot({
      fetchedAt: NOW_ISO,
      config: {
        ok: true,
        value: {
          raw: {
            browserCatalog: [
              {
                name: "firefox",
                versions: [
                  { version: "1.59.1", image: "selenwright/playwright-firefox:1.59.1", protocol: "playwright" },
                ],
              },
              {
                name: "chrome",
                versions: [
                  { version: "stable", image: "selenwright/chrome:stable", protocol: "webdriver" },
                ],
              },
            ],
          },
        },
      },
      status: {
        ok: true,
        value: {
          browsers: {
            firefox: { "1.59.1": {} },
            chrome: { stable: {} },
          },
          pending: 0,
          queued: 0,
          total: 0,
          used: 0,
          value: { message: "Ready", ready: true },
        },
      },
    });

    const firefox = dataset.browsers.find((row) => row.browser === "firefox");
    const chrome = dataset.browsers.find((row) => row.browser === "chrome");
    expect(firefox?.protocol).toBe("playwright");
    expect(chrome?.protocol).toBe("selenium");
  });

  it("respects explicit artifact history availability flags", () => {
    const dataset = buildConsoleDatasetFromSnapshot({
      fetchedAt: NOW_ISO,
      historySettings: {
        ok: true,
        value: {
          available: false,
          enabled: true,
          reason: "Blocked upstream",
          retentionDays: 21,
        },
      },
    });

    expect(dataset.settings.artifactHistory.available).toBe(false);
    expect(dataset.settings.artifactHistory.enabled).toBe(true);
    expect(dataset.settings.artifactHistory.reason).toBe("Blocked upstream");
    expect(dataset.settings.artifactHistory.retentionDays).toBe(21);
  });
});

function buildStatusSnapshot(rawSession: Record<string, unknown>) {
  return {
    fetchedAt: NOW_ISO,
    status: {
      ok: true as const,
      value: {
        browsers: {
          chrome: {
            latest: {
              default: {
                count: 1,
                sessions: [rawSession],
              },
            },
          },
        },
        pending: 0,
        queued: 0,
        total: 1,
        used: 1,
        value: {
          message: "Ready",
          ready: true,
        },
      },
    },
  };
}

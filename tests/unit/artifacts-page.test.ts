import { renderToString } from "@vue/server-renderer";
import { createSSRApp } from "vue";
import ArtifactsPage from "../../src/app/pages/ArtifactsPage.vue";
import type { ArtifactPageModel } from "../../src/app/artifacts/artifactsPage";
import {
  filterLogContent,
  getFilteredArtifactItems,
  getLogPagination,
} from "../../src/app/artifacts/artifactsPage";
import type {
  ConsoleSession,
  DownloadArtifact,
  LogArtifact,
  VideoArtifact,
} from "../../src/data/service";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

describe("ArtifactsPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders video rows with selected state and side-pane metadata", async () => {
    const html = await renderArtifactsPage({
      pageKey: "videos",
      selectedArtifacts: {
        downloads: null,
        logs: null,
        videos: "fixture-session-02.mp4",
      },
      videos: [
        buildVideo({ filename: "fixture-session-01.mp4", sessionId: "fixture-session-01" }),
        buildVideo({ filename: "fixture-session-02.mp4", sessionId: "fixture-session-02" }),
      ],
    });

    expect(html).toContain("<h1>Videos</h1>");
    expect(html).toContain("Videos index");
    expect(html).toContain('class="selected"');
    expect(html).toContain("fixture-session-02.mp4");
    expect(html).toContain("Copy filename");
  });

  it("renders log pagination and filtered log drawer content", async () => {
    const html = await renderArtifactsPage({
      logFiles: {
        "fixture-session-02.log": {
          content: "session start\nheartbeat\nsession end",
          error: "",
          loaded: true,
          loading: false,
        },
      },
      logSearch: "heart",
      logs: [
        buildLog({ filename: "fixture-session-01.log", sessionId: "fixture-session-01" }),
        buildLog({ filename: "fixture-session-02.log", sessionId: "fixture-session-02" }),
      ],
      logsPerPage: 1,
      pageKey: "logs",
      selectedArtifacts: {
        downloads: null,
        logs: "fixture-session-02.log",
        videos: null,
      },
    });

    expect(html).toContain("<h1>Logs</h1>");
    expect(html).toContain("Per page");
    expect(html).toContain("1 / 2");
    expect(html).toContain("heartbeat");
    expect(html).not.toContain("session start</pre>");
    expect(html).toContain('href="/api/logs/file/fixture-session-02.log"');
  });

  it("renders downloads drawer with persisted selection", async () => {
    const html = await renderArtifactsPage({
      downloads: [
        buildDownload({ filename: "fixture-report.json", sessionId: "fixture-session-01" }),
      ],
      pageKey: "downloads",
      selectedArtifacts: {
        downloads: "fixture-report.json",
        logs: null,
        videos: null,
      },
    });

    expect(html).toContain("<h1>Downloads</h1>");
    expect(html).toContain("Details");
    expect(html).toContain('href="/api/downloads/file/fixture-session-01/fixture-report.json"');
    expect(html).toContain("application/json");
  });
});

describe("artifact page helpers", () => {
  it("filters artifacts by selected session", () => {
    const model = buildModel({
      artifactSessionFilter: "fixture-session-02",
      videos: [
        buildVideo({ filename: "fixture-session-01.mp4", sessionId: "fixture-session-01" }),
        buildVideo({ filename: "fixture-session-02.mp4", sessionId: "fixture-session-02" }),
      ],
    });

    expect(getFilteredArtifactItems(model).map((item) => item.filename)).toEqual([
      "fixture-session-02.mp4",
    ]);
  });

  it("paginates logs and filters log content", () => {
    const model = buildModel({
      logs: [
        buildLog({ filename: "a.log" }),
        buildLog({ filename: "b.log" }),
        buildLog({ filename: "c.log" }),
      ],
      logsPage: 2,
      logsPerPage: 2,
      pageKey: "logs",
    });

    expect(getLogPagination(model).pageItems.map((item) => item.filename)).toEqual(["c.log"]);
    expect(filterLogContent("alpha\nbeta\ngamma", "ta")).toBe("beta");
  });
});

async function renderArtifactsPage(overrides: Partial<ArtifactPageModel> = {}) {
  return renderToString(createSSRApp(ArtifactsPage, { model: buildModel(overrides) }));
}

function buildModel(overrides: Partial<ArtifactPageModel> = {}): ArtifactPageModel {
  const selectedArtifacts = {
    downloads: null,
    logs: null,
    videos: null,
    ...(overrides.selectedArtifacts || {}),
  };

  return {
    artifactSessionFilter: "",
    downloads: [],
    logFiles: {},
    logs: [],
    logsPage: 1,
    logsPerPage: 10,
    logSearch: "",
    pageKey: "videos",
    preferences: {
      artifactPaneWidths: { videos: 0.37, logs: 0.37, downloads: 0.37 },
      timeFormat: "24h",
      timezone: "utc",
    },
    selectedArtifacts,
    sessions: [
      buildSession({ id: "fixture-session-01" }),
      buildSession({ id: "fixture-session-02" }),
    ],
    videos: [],
    ...overrides,
    selectedArtifacts,
  };
}

function buildVideo(overrides: Partial<VideoArtifact> = {}): VideoArtifact {
  return {
    browser: "chromium",
    createdAt: "2026-04-10T09:58:00.000Z",
    durationMs: 93_000,
    filename: "fixture-session-01.mp4",
    protocol: "playwright",
    sessionId: "fixture-session-01",
    size: 1_258_000,
    ...overrides,
  };
}

function buildLog(overrides: Partial<LogArtifact> = {}): LogArtifact {
  return {
    browser: "chromium",
    content: "",
    contentError: "",
    contentLoaded: false,
    createdAt: "2026-04-10T09:58:00.000Z",
    filename: "fixture-session-01.log",
    liveStreamAvailable: false,
    protocol: "playwright",
    sessionId: "fixture-session-01",
    size: 12_480,
    ...overrides,
  };
}

function buildDownload(overrides: Partial<DownloadArtifact> = {}): DownloadArtifact {
  return {
    browser: "chromium",
    browserVersion: "latest",
    createdAt: "2026-04-10T09:58:00.000Z",
    downloadUrl: "/api/downloads/file/fixture-session-01/fixture-report.json",
    filename: "fixture-report.json",
    mimeType: "application/json",
    protocol: "playwright",
    relativePath: "fixture-report.json",
    sessionId: "fixture-session-01",
    size: 3_296,
    ...overrides,
  };
}

function buildSession(overrides: Partial<ConsoleSession> = {}): ConsoleSession {
  return {
    artifacts: {
      clipboard: false,
      devtools: false,
      downloads: 0,
      liveLogs: false,
      liveView: false,
      logs: false,
      savedLogs: false,
      video: false,
      vnc: false,
    },
    browser: "chromium",
    browserVersion: "latest",
    capabilities: {
      browserName: "chromium",
      browserVersion: "latest",
      enableLog: false,
      enableVNC: false,
      enableVideo: false,
      name: "session",
      screenResolution: "1920x1080",
    },
    clipboardPreview: "",
    durationMs: 60_000,
    endpoint: "",
    finishedAt: null,
    id: "fixture-session-01",
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
    protocol: "playwright",
    protocolVersion: "latest",
    startedAt: "2026-04-10T09:58:30.000Z",
    status: "running",
    ...overrides,
  };
}

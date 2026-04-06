const referenceNow = new Date("2026-04-05T18:00:00Z");

const sessionSeeds = [
  {
    id: "8f4cf9b1-6c28-49d7-8ad0-364ed1a2d101",
    name: "checkout-chromium-a18",
    protocol: "playwright",
    protocolVersion: "1.49.1",
    browser: "chromium",
    browserVersion: "126.0",
    status: "running",
    startedMinutesAgo: 14,
    lastActivityMinutesAgo: 1,
    quota: "ci",
    vnc: false,
    video: true,
    logs: true,
    downloads: 2,
    clipboard: true,
    devtools: true,
    liveView: true,
    node: "pw-chromium-1-49",
    screen: "1680x1050x24",
    endpoint: "/playwright/chromium/1.49.1",
  },
  {
    id: "c8bc6860-8650-4e16-a35b-3d5b4dfd6f22",
    name: "payments-firefox-r33",
    protocol: "selenium",
    protocolVersion: "webdriver",
    browser: "firefox",
    browserVersion: "125.0",
    status: "running",
    startedMinutesAgo: 28,
    lastActivityMinutesAgo: 4,
    quota: "staging",
    vnc: true,
    video: true,
    logs: true,
    downloads: 1,
    clipboard: false,
    devtools: false,
    liveView: true,
    node: "ff-125-vnc-2",
    screen: "1920x1080x24",
    endpoint: "/wd/hub/session/c8bc6860-8650-4e16-a35b-3d5b4dfd6f22",
  },
  {
    id: "5a2fcb2f-32dd-4cab-a33f-66f7c8ea4dd3",
    name: "admin-webkit-smoke",
    protocol: "playwright",
    protocolVersion: "1.49.1",
    browser: "webkit",
    browserVersion: "17.4",
    status: "pending",
    startedMinutesAgo: 3,
    lastActivityMinutesAgo: 1,
    quota: "qa",
    vnc: false,
    video: false,
    logs: true,
    downloads: 0,
    clipboard: false,
    devtools: false,
    liveView: false,
    node: "pw-webkit-1-49",
    screen: "1440x900x24",
    endpoint: "/playwright/webkit/1.49.1",
  },
  {
    id: "d374f8c8-4373-4da4-87ff-8c2bf5599e44",
    name: "search-chrome-vnc",
    protocol: "selenium",
    protocolVersion: "webdriver",
    browser: "chrome",
    browserVersion: "126.0",
    status: "running",
    startedMinutesAgo: 52,
    lastActivityMinutesAgo: 8,
    quota: "ci",
    vnc: true,
    video: true,
    logs: true,
    downloads: 4,
    clipboard: true,
    devtools: true,
    liveView: true,
    node: "chrome-126-vnc-1",
    screen: "1920x1080x24",
    endpoint: "/wd/hub/session/d374f8c8-4373-4da4-87ff-8c2bf5599e44",
  },
  {
    id: "e8f197f3-00f8-44f5-9508-3f8e977c3555",
    name: "orders-firefox-mobile",
    protocol: "selenium",
    protocolVersion: "webdriver",
    browser: "firefox",
    browserVersion: "124.0",
    status: "queued",
    startedMinutesAgo: 1,
    lastActivityMinutesAgo: 1,
    quota: "mobile",
    vnc: false,
    video: false,
    logs: false,
    downloads: 0,
    clipboard: false,
    devtools: false,
    liveView: false,
    node: "queue-slot-3",
    screen: "1280x720x24",
    endpoint: "/wd/hub/session/e8f197f3-00f8-44f5-9508-3f8e977c3555",
  },
  {
    id: "41c0a011-a9d1-4690-97af-05aa92874366",
    name: "visual-regression-grid",
    protocol: "selenium",
    protocolVersion: "webdriver",
    browser: "edge",
    browserVersion: "126.0",
    status: "running",
    startedMinutesAgo: 83,
    lastActivityMinutesAgo: 2,
    quota: "design",
    vnc: true,
    video: true,
    logs: true,
    downloads: 5,
    clipboard: false,
    devtools: true,
    liveView: true,
    node: "edge-126-vnc-1",
    screen: "1920x1080x24",
    endpoint: "/wd/hub/session/41c0a011-a9d1-4690-97af-05aa92874366",
  },
  {
    id: "0a2d3f5d-8463-44fb-9736-b5f56efe5777",
    name: "auth-chromium-fastlane",
    protocol: "playwright",
    protocolVersion: "1.48.2",
    browser: "chromium",
    browserVersion: "125.0",
    status: "running",
    startedMinutesAgo: 9,
    lastActivityMinutesAgo: 2,
    quota: "ci",
    vnc: false,
    video: false,
    logs: true,
    downloads: 1,
    clipboard: true,
    devtools: true,
    liveView: false,
    node: "pw-chromium-1-48",
    screen: "1600x900x24",
    endpoint: "/playwright/chromium/1.48.2",
  },
  {
    id: "87d91927-9e39-44a2-bb45-c032d842c288",
    name: "billing-chrome-a11y",
    protocol: "selenium",
    protocolVersion: "webdriver",
    browser: "chrome",
    browserVersion: "125.0",
    status: "completed",
    startedMinutesAgo: 136,
    endedMinutesAgo: 30,
    lastActivityMinutesAgo: 30,
    quota: "qa",
    vnc: false,
    video: true,
    logs: true,
    downloads: 3,
    clipboard: false,
    devtools: true,
    liveView: false,
    node: "chrome-125-3",
    screen: "1680x1050x24",
    endpoint: "/wd/hub/session/87d91927-9e39-44a2-bb45-c032d842c288",
  },
  {
    id: "ec8bcfcc-f44a-4cb4-bc88-6244db240a99",
    name: "reporting-webkit-ci",
    protocol: "playwright",
    protocolVersion: "1.49.1",
    browser: "webkit",
    browserVersion: "17.4",
    status: "running",
    startedMinutesAgo: 19,
    lastActivityMinutesAgo: 3,
    quota: "reporting",
    vnc: false,
    video: true,
    logs: true,
    downloads: 2,
    clipboard: false,
    devtools: false,
    liveView: false,
    node: "pw-webkit-1-49",
    screen: "1440x900x24",
    endpoint: "/playwright/webkit/1.49.1",
  },
  {
    id: "3f87ef74-a853-4d5b-ad4d-1d9a44febb10",
    name: "upload-firefox-blob",
    protocol: "selenium",
    protocolVersion: "webdriver",
    browser: "firefox",
    browserVersion: "126.0",
    status: "running",
    startedMinutesAgo: 41,
    lastActivityMinutesAgo: 6,
    quota: "api",
    vnc: true,
    video: false,
    logs: true,
    downloads: 0,
    clipboard: true,
    devtools: false,
    liveView: true,
    node: "ff-126-vnc-1",
    screen: "1600x900x24",
    endpoint: "/wd/hub/session/3f87ef74-a853-4d5b-ad4d-1d9a44febb10",
  },
  {
    id: "bf0c62bb-20d8-41c9-8cc9-594273f86711",
    name: "queue-pressure-check",
    protocol: "playwright",
    protocolVersion: "1.49.1",
    browser: "chromium",
    browserVersion: "126.0",
    status: "queued",
    startedMinutesAgo: 2,
    lastActivityMinutesAgo: 2,
    quota: "ci",
    vnc: false,
    video: false,
    logs: false,
    downloads: 0,
    clipboard: false,
    devtools: false,
    liveView: false,
    node: "queue-slot-4",
    screen: "1280x720x24",
    endpoint: "/playwright/chromium/1.49.1",
  },
  {
    id: "62111a36-a9d1-4f06-86d0-d04278a58212",
    name: "legacy-ie-migration",
    protocol: "selenium",
    protocolVersion: "webdriver",
    browser: "edge",
    browserVersion: "125.0",
    status: "failed",
    startedMinutesAgo: 18,
    endedMinutesAgo: 12,
    lastActivityMinutesAgo: 12,
    quota: "migration",
    vnc: false,
    video: false,
    logs: true,
    downloads: 0,
    clipboard: false,
    devtools: false,
    liveView: false,
    node: "edge-125-2",
    screen: "1366x768x24",
    endpoint: "/wd/hub/session/62111a36-a9d1-4f06-86d0-d04278a58212",
  },
];

const browserInventory = [
  { browser: "chrome", version: "126.0", protocol: "selenium", source: "selenwright/vnc_chrome:126.0", capabilities: "VNC, video, downloads, devtools", status: "ready" },
  { browser: "chrome", version: "125.0", protocol: "selenium", source: "selenwright/chrome:125.0", capabilities: "logs, downloads, devtools", status: "ready" },
  { browser: "chromium", version: "1.49.1", protocol: "playwright", source: "example/playwright-chromium:1.49.1", capabilities: "native websocket, logs", status: "ready" },
  { browser: "chromium", version: "1.48.2", protocol: "playwright", source: "example/playwright-chromium:1.48.2", capabilities: "native websocket, clipboard", status: "ready" },
  { browser: "firefox", version: "126.0", protocol: "selenium", source: "selenwright/firefox:126.0", capabilities: "VNC, logs", status: "ready" },
  { browser: "firefox", version: "125.0", protocol: "selenium", source: "selenwright/firefox:125.0", capabilities: "video, logs", status: "ready" },
  { browser: "webkit", version: "1.49.1", protocol: "playwright", source: "example/playwright-webkit:1.49.1", capabilities: "native websocket, logs", status: "ready" },
  { browser: "edge", version: "126.0", protocol: "selenium", source: "selenwright/edge:126.0", capabilities: "VNC, video, devtools", status: "degraded" },
];

export function createMockDataset() {
  const now = new Date(referenceNow);
  const sessions = sessionSeeds.map((seed, index) => buildSession(seed, now, index));
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));

  const logs = sessions
    .filter((session) => session.artifacts.logs)
    .map((session) => ({
      createdAt: session.status === "completed" || session.status === "failed" ? session.finishedAt || session.startedAt : session.startedAt,
      filename: `${session.id}.log`,
      sessionId: session.id,
      browser: session.browser,
      protocol: session.protocol,
      size: 19000 + session.order * 1700,
      content: buildLogContent(session),
    }));

  const videos = sessions
    .filter((session) => session.artifacts.video)
    .map((session) => ({
      createdAt: session.finishedAt || session.startedAt,
      filename: `${session.id}.mp4`,
      sessionId: session.id,
      browser: session.browser,
      protocol: session.protocol,
      size: 6_000_000 + session.order * 250_000,
      durationMs: session.durationMs,
    }));

  const downloads = sessions.flatMap((session) => {
    const count = session.artifacts.downloads;
    return Array.from({ length: count }, (_, index) => ({
      filename: buildDownloadName(session, index),
      sessionId: session.id,
      browser: session.browser,
      createdAt: new Date(new Date(session.startedAt).getTime() + (index + 1) * 180000).toISOString(),
      size: 45_000 + index * 18_000 + session.order * 5_000,
      mimeType: index % 2 === 0 ? "application/zip" : "text/csv",
    }));
  });

  const used = sessions.filter((session) => session.status === "running").length;
  const queued = sessions.filter((session) => session.status === "queued").length;
  const pending = sessions.filter((session) => session.status === "pending").length;

  const browserUsage = Array.from(
    sessions.reduce((accumulator, session) => {
      const current = accumulator.get(session.browser) || { browser: session.browser, count: 0, running: 0 };
      current.count += 1;
      if (session.status === "running") {
        current.running += 1;
      }
      accumulator.set(session.browser, current);
      return accumulator;
    }, new Map()).values(),
  ).sort((left, right) => right.running - left.running);

  const configuration = {
    featureAvailability: [
      { label: "Video recording", value: "Enabled for container sessions" },
      { label: "Logs", value: "Enabled with session-level capture" },
      { label: "File download proxy", value: "Available for Selenium sessions" },
      { label: "Clipboard API", value: "Available when browser image exposes clipboard bridge" },
      { label: "DevTools API", value: "Chrome-family only" },
    ],
    limits: [
      { label: "Session limit", value: "20 concurrent" },
      { label: "Queue behavior", value: "Enabled" },
      { label: "Idle timeout", value: "60s default, 1h max" },
      { label: "Startup timeout", value: "30s" },
      { label: "Graceful shutdown", value: "300s" },
    ],
    logging: [
      { label: "Log output dir", value: "/opt/selenwright/logs" },
      { label: "Save all logs", value: "Off" },
      { label: "Driver logs", value: "Captured on request" },
    ],
    paths: [
      { label: "Config path", value: "/etc/selenwright/browsers.json" },
      { label: "Video output dir", value: "/opt/selenwright/video" },
      { label: "Upload temp dir", value: "/tmp/selenwright-upload" },
    ],
    raw: {
      browserCatalog: browserInventory,
      flags: {
        disableQueue: false,
        limit: 20,
        logOutputDir: "/opt/selenwright/logs",
        timeout: "60s",
        videoOutputDir: "/opt/selenwright/video",
      },
      reloadStatus: {
        lastReloadTime: "2026-04-05T17:45:00Z",
        source: "config/browsers.json",
      },
    },
  };

  return {
    browsers: browserInventory,
    configuration,
    connection: {
      mode: "demo",
      ready: true,
      target: "http://localhost:4444",
      message: "Demo dataset active",
      statusEndpointMessage: "Selenwright demo model",
    },
    downloads,
    logs,
    sessions,
    system: {
      activeSessions: used + pending,
      browserUsage,
      healthNotes: [
        "Queue depth is elevated for Playwright Chromium.",
        "Edge Selenium image is marked degraded because two recent starts exceeded startup timeout.",
      ],
      lastReloadTime: "2026-04-05T17:45:00Z",
      limits: { total: 20, used, queued, pending },
      runtimeMessage: "Selenwright 2026.04 demo build",
      usageSummary: [
        { label: "Queued requests", value: String(queued) },
        { label: "Pending starts", value: String(pending) },
        { label: "Active sessions", value: String(used + pending) },
        { label: "Ready state", value: "Ready" },
      ],
    },
    videos,
  };
}

function buildSession(seed, now, index) {
  const startedAt = new Date(now.getTime() - seed.startedMinutesAgo * 60000);
  const finishedAt = seed.endedMinutesAgo ? new Date(now.getTime() - seed.endedMinutesAgo * 60000) : null;
  const durationMs = (finishedAt || now).getTime() - startedAt.getTime();
  const clipboardPreview = seed.clipboard ? `Clipboard snapshot for ${seed.name}` : "";

  return {
    artifacts: {
      clipboard: seed.clipboard,
      devtools: seed.devtools,
      downloads: seed.downloads,
      liveView: seed.liveView,
      logs: seed.logs,
      video: seed.video,
      vnc: seed.vnc,
    },
    browser: seed.browser,
    browserVersion: seed.browserVersion,
    capabilities: {
      browserName: seed.browser,
      browserVersion: seed.browserVersion,
      enableLog: seed.logs,
      enableVNC: seed.vnc,
      enableVideo: seed.video,
      name: seed.name,
      screenResolution: seed.screen,
    },
    clipboardPreview,
    durationMs,
    endpoint: seed.endpoint,
    finishedAt: finishedAt ? finishedAt.toISOString() : null,
    id: seed.id,
    lastActivityAt: new Date(now.getTime() - seed.lastActivityMinutesAgo * 60000).toISOString(),
    livePreviewUrl: seed.liveView ? `wss://selenwright.local/vnc/${seed.id}` : "",
    metadata: {
      container: seed.status === "queued" ? null : {
        id: `container-${seed.id.slice(0, 12)}`,
        ip: `10.24.${10 + index}.${20 + index}`,
        exposedPorts: {
          browser: `${4444 + index}`,
          devtools: seed.devtools ? `${9222 + index}` : "",
        },
      },
      devtoolsEndpoint: seed.devtools ? `ws://localhost:4444/devtools/${seed.id}/page` : "",
      downloadEndpoint: `/download/${seed.id}/`,
      clipboardEndpoint: `/clipboard/${seed.id}`,
      logEndpoint: `/logs/${seed.id}.log`,
      protocolEndpoint: seed.endpoint,
      quota: seed.quota,
      screen: seed.screen,
    },
    name: seed.name,
    node: seed.node,
    order: index,
    protocol: seed.protocol,
    protocolVersion: seed.protocolVersion,
    startedAt: startedAt.toISOString(),
    status: seed.status,
    technicalMetadata: {
      capabilitiesJson: JSON.stringify(
        {
          browserName: seed.browser,
          browserVersion: seed.browserVersion,
          protocol: seed.protocol,
          screenResolution: seed.screen,
          "selenoid:options": {
            enableLog: seed.logs,
            enableVNC: seed.vnc,
            enableVideo: seed.video,
            name: seed.name,
          },
        },
        null,
        2,
      ),
      runtimeJson: JSON.stringify(
        {
          containerId: `container-${seed.id.slice(0, 12)}`,
          image: `${seed.protocol === "playwright" ? "example/playwright" : "selenwright"}/${seed.browser}:${seed.protocolVersion}`,
          node: seed.node,
          quota: seed.quota,
          screen: seed.screen,
        },
        null,
        2,
      ),
      websocketEndpoint: seed.protocol === "playwright"
        ? `ws://localhost:4444${seed.endpoint}`
        : seed.devtools
          ? `ws://localhost:4444/devtools/${seed.id}/browser`
          : "",
    },
  };
}

function buildDownloadName(session, index) {
  const nouns = ["trace", "report", "invoice", "artifact", "summary"];
  const extensions = ["zip", "csv", "json"];
  return `${session.name}-${nouns[index % nouns.length]}.${extensions[index % extensions.length]}`;
}

function buildLogContent(session) {
  const lines = [
    `[${session.id}] session accepted (${session.protocol})`,
    `[${session.id}] browser=${session.browser} version=${session.browserVersion}`,
    `[${session.id}] route=${session.endpoint}`,
    `[${session.id}] artifact flags video=${session.artifacts.video} log=${session.artifacts.logs} vnc=${session.artifacts.vnc}`,
    `[${session.id}] last activity checkpoint`,
  ];

  for (let index = 0; index < 18; index += 1) {
    lines.push(
      `[${session.id}] step=${index + 1} command=page.goto latency=${140 + index * 7}ms outcome=${
        session.status === "failed" && index > 12 ? "retry" : "ok"
      }`,
    );
  }

  if (session.status === "failed") {
    lines.push(`[${session.id}] webdriver error=Session not created timeout waiting for browser startup`);
  } else if (session.status === "queued") {
    lines.push(`[${session.id}] queue wait reason=capacity limit reached`);
  } else if (session.status === "pending") {
    lines.push(`[${session.id}] container boot in progress`);
  } else {
    lines.push(`[${session.id}] session healthy`);
  }

  return lines.join("\n");
}


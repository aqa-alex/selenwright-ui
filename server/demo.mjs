export function buildDemoConsoleSnapshot() {
  const now = new Date();
  const t = (offsetMs) => new Date(now.getTime() - offsetMs).toISOString();

  return {
    config: {
      ok: true,
      value: {
        browserCatalog: [
          { name: "chromium", versions: [{ version: "latest", image: "chromium:latest" }] },
          { name: "chrome", versions: [{ version: "latest", image: "chrome:latest" }, { version: "130", image: "chrome:130" }] },
          { name: "firefox", versions: [{ version: "latest", image: "firefox:latest" }, { version: "130", image: "firefox:130" }] },
        ],
      },
    },
    downloads: { ok: true, value: [] },
    historySettings: { ok: true, value: { enabled: true, retentionDays: 7 } },
    logs: {
      ok: true,
      value: [
        { filename: "demo-abc123.log", sessionId: "demo-abc123", browser: "chromium", protocol: "playwright", size: 42800, createdAt: t(2 * 60 * 1000) },
        { filename: "demo-def456.log", sessionId: "demo-def456", browser: "chromium", protocol: "playwright", size: 18300, createdAt: t(8 * 60 * 1000) },
        { filename: "demo-ghi789.log", sessionId: "demo-ghi789", browser: "firefox", protocol: "selenium", size: 5100, createdAt: t(3600 * 1000) },
      ],
    },
    status: {
      ok: true,
      value: {
        browsers: {
          chromium: {
            latest: {
              default: {
                count: 2,
                sessions: [
                  { id: "demo-abc123", started: t(2 * 60 * 1000), vnc: true, caps: { version: "latest" } },
                  { id: "demo-def456", started: t(8 * 60 * 1000), vnc: true, caps: { version: "latest" } },
                ],
              },
            },
          },
          firefox: {
            latest: {
              default: {
                count: 1,
                sessions: [
                  { id: "demo-jkl012", started: t(15 * 60 * 1000), caps: { version: "latest" } },
                ],
              },
            },
          },
        },
        pending: 0,
        queued: 1,
        total: 4,
        used: 3,
        value: { message: "Demo mode — no upstream connected", ready: true },
      },
    },
    target: "demo",
    videos: {
      ok: true,
      value: [
        { filename: "demo-abc123.mp4", sessionId: "demo-abc123", browser: "chromium", protocol: "playwright", size: 1258000, durationMs: 93000, createdAt: t(2 * 60 * 1000) },
      ],
    },
  };
}

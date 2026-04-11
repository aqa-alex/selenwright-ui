export const fixedNowIso = "2026-04-10T10:00:00.000Z";
export const primarySessionId = "fixture-session-01";

export async function installFixedClock(page) {
  await page.addInitScript((iso) => {
    const RealDate = Date;
    const fixedTime = new RealDate(iso).getTime();

    class FixedDate extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedTime]));
      }

      static now() {
        return fixedTime;
      }
    }

    FixedDate.parse = RealDate.parse;
    FixedDate.UTC = RealDate.UTC;
    window.Date = FixedDate;
  }, fixedNowIso);
}

export async function useBaselineApi(page, options = {}) {
  const snapshot = buildConsoleSnapshot(options);
  const endpointPayloads = {
    "/api/config": snapshot.config.value,
    "/api/downloads": snapshot.downloads.value,
    "/api/history/settings": snapshot.historySettings.value,
    "/api/logs": snapshot.logs.value,
    "/api/meta": { target: snapshot.target },
    "/api/status": snapshot.status.value,
    "/api/videos": snapshot.videos.value,
  };

  await page.route("**/api/stream/console", async (route) => {
    await route.fulfill({
      body: `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`,
      contentType: "text/event-stream; charset=utf-8",
      headers: {
        "cache-control": "no-store",
      },
      status: 200,
    });
  });

  for (const [path, payload] of Object.entries(endpointPayloads)) {
    await page.route(`**${path}`, async (route) => {
      await route.fulfill({
        body: JSON.stringify(payload),
        contentType: "application/json; charset=utf-8",
        status: 200,
      });
    });
  }

  await page.route("**/api/logs/file/**", async (route) => {
    await route.fulfill({
      body: [
        "2026-04-10T09:58:00.000Z session start",
        "2026-04-10T09:59:00.000Z browser ready",
        "2026-04-10T10:00:00.000Z heartbeat",
      ].join("\n"),
      contentType: "text/plain; charset=utf-8",
      status: 200,
    });
  });
}

export async function setPreferences(page, preferences = {}) {
  await page.addInitScript((values) => {
    if (values.themeMode) {
      localStorage.setItem("selenwright-ui.theme-mode", values.themeMode);
    }
    if (values.density) {
      localStorage.setItem("selenwright-ui.density", values.density);
    }
  }, preferences);
}

export async function waitForConsoleReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator(".shell, .vnc-page").first().waitFor({ state: "visible" });
}

export async function waitForSessions(page, count) {
  await page.locator(".session-row").first().waitFor({ state: "visible" });
  if (count) {
    await page.locator(".session-row").nth(count - 1).waitFor({ state: "visible" });
  }
}

export function expectedVncEndpoint(origin, sessionId = primarySessionId) {
  const url = new URL(`/api/vnc/${encodeURIComponent(sessionId)}`, origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function buildConsoleSnapshot({ logCount = 2, sessionCount = 14, sessionStatuses = [] } = {}) {
  const sessions = Array.from({ length: sessionCount }, (_, index) => {
    const ordinal = index + 1;
    const padded = String(ordinal).padStart(2, "0");
    const minutesAgo = ordinal * 3;
    const status = sessionStatuses[index] || (ordinal % 7 === 0 ? "Queued" : "Running");
    return {
      caps: { version: ordinal % 3 === 0 ? "130" : "latest" },
      id: `fixture-session-${padded}`,
      started: offsetIso(minutesAgo * 60 * 1000),
      status,
      vnc: ordinal <= 3,
    };
  });

  return {
    config: {
      ok: true,
      value: {
        raw: {
          browserCatalog: [
            { name: "chromium", versions: [{ image: "chromium:latest", version: "latest" }] },
            { name: "chrome", versions: [{ image: "chrome:130", version: "130" }] },
          ],
          flags: {},
          reloadStatus: {},
        },
      },
    },
    downloads: {
      ok: true,
      value: [
        {
          browser: "chromium",
          browserVersion: "latest",
          createdAt: offsetIso(70_000),
          filename: "fixture-report.json",
          mimeType: "application/json",
          protocol: "playwright",
          relativePath: "fixture-report.json",
          sessionId: primarySessionId,
          sizeBytes: 3296,
        },
      ],
    },
    fetchedAt: fixedNowIso,
    historySettings: { ok: true, value: { enabled: true, retentionDays: 7 } },
    logs: {
      ok: true,
      value: Array.from({ length: logCount }, (_, index) => {
        const ordinal = index + 1;
        const padded = String(ordinal).padStart(2, "0");
        const sessionId = index === 0 ? primarySessionId : `fixture-session-${padded}`;
        return {
          browser: "chromium",
          createdAt: offsetIso((index + 1) * 60_000),
          filename: `${sessionId}.log`,
          protocol: "playwright",
          sessionId,
          size: index === 0 ? 12480 : 8096 + index,
        };
      }),
    },
    status: {
      ok: true,
      value: {
        browsers: {
          chrome: {
            130: {
              default: {
                count: 0,
                sessions: [],
              },
            },
          },
          chromium: {
            latest: {
              default: {
                count: sessionCount,
                sessions,
              },
            },
          },
        },
        pending: 0,
        queued: 1,
        total: sessionCount + 1,
        used: sessionCount,
        value: { message: "Fixture status ready", ready: true },
      },
    },
    target: "fixture",
    videos: {
      ok: true,
      value: [
        {
          browser: "chromium",
          createdAt: offsetIso(80_000),
          durationMs: 93_000,
          filename: `${primarySessionId}.mp4`,
          protocol: "playwright",
          sessionId: primarySessionId,
          size: 1_258_000,
        },
      ],
    },
  };
}

function offsetIso(offsetMs) {
  return new Date(new Date(fixedNowIso).getTime() - offsetMs).toISOString();
}

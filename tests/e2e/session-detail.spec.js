import { expect, test } from "@playwright/test";
import {
  installFixedClock,
  primarySessionId,
  setPreferences,
  useBaselineApi,
  waitForConsoleReady,
} from "./fixtures.js";

test("session detail renders unknown session fallback", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/sessions/missing-session");
  await waitForConsoleReady(page);

  await expect(page.getByRole("heading", { level: 1, name: "Session not found" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unknown session" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sessions" })).toHaveAttribute(
    "href",
    "/sessions",
  );
});

test("session detail keeps terminate enabled for active sessions", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto(`/sessions/${primarySessionId}`);
  await waitForConsoleReady(page);

  await expect(page.getByRole("button", { name: "Terminate" })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Open VNC" })).toHaveAttribute(
    "href",
    `/vnc.html?browser=chromium&name=chromium-fixture-&session=${primarySessionId}`,
  );
});

test("session detail disables terminate and exposes saved log copy target", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 1, sessionStatuses: ["Completed"] });

  await page.goto(`/sessions/${primarySessionId}`);
  await waitForConsoleReady(page);

  await expect(page.getByRole("button", { name: "Terminate" })).toBeDisabled();
  await expect(page.locator("#log-viewer-content")).toContainText("heartbeat");
  await expect(page.getByRole("button", { name: "Copy block" })).toHaveAttribute(
    "data-copy",
    /session start/,
  );
  await expect(page.getByRole("link", { exact: true, name: "Download" })).toHaveAttribute(
    "href",
    `/api/logs/file/${primarySessionId}.log`,
  );
});

test("session detail renders live log reconnect action", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await page.route(`**/api/logs/live/${primarySessionId}`, async (route) => {
    await route.fulfill({
      body: 'event: status\ndata: {"status":"closed","message":"Live stream closed."}\n\n',
      contentType: "text/event-stream; charset=utf-8",
      headers: {
        "cache-control": "no-store",
      },
      status: 200,
    });
  });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto(`/sessions/${primarySessionId}`);
  await waitForConsoleReady(page);

  await expect(page.getByRole("button", { name: "Reconnect" })).toBeVisible();
  await expect(page.locator("#session-logs-panel")).toContainText("Live log stream unavailable");
});

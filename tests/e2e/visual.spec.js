import { expect, test } from "@playwright/test";
import {
  installFixedClock,
  primarySessionId,
  setPreferences,
  useBaselineApi,
  waitForConsoleReady,
  waitForSessions,
} from "./fixtures.js";

const screenshotCases = [
  { name: "sessions", path: "/sessions", ready: waitForSessions },
  { name: "session-detail", path: `/sessions/${primarySessionId}`, ready: waitForConsoleReady },
  { name: "artifacts-videos", path: "/artifacts/videos", ready: waitForConsoleReady },
  { name: "artifacts-logs", path: "/artifacts/logs", ready: waitForConsoleReady },
  { name: "artifacts-downloads", path: "/artifacts/downloads", ready: waitForConsoleReady },
  { name: "browsers", path: "/browsers", ready: waitForConsoleReady },
  { name: "configuration", path: "/configuration", ready: waitForConsoleReady },
  { name: "system", path: "/system", ready: waitForConsoleReady },
  { name: "settings", path: "/settings", ready: waitForConsoleReady },
  { name: "vnc", path: "/vnc.html", ready: waitForConsoleReady },
];

for (const themeMode of ["light", "dark"]) {
  for (const screenshotCase of screenshotCases) {
    test(`${screenshotCase.name} ${themeMode} baseline screenshot`, async ({ page }) => {
      await installFixedClock(page);
      await setPreferences(page, { density: "compact", themeMode });
      await useBaselineApi(page, { sessionCount: 14 });

      await page.goto(screenshotCase.path);
      await screenshotCase.ready(page, 14);
      await expect(page.locator("body")).toHaveScreenshot(`${screenshotCase.name}-${themeMode}.png`, {
        animations: "disabled",
      });
    });
  }
}

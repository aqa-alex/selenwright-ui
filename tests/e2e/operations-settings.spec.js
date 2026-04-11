import { expect, test } from "@playwright/test";
import {
  installFixedClock,
  setPreferences,
  useBaselineApi,
  waitForConsoleReady,
} from "./fixtures.js";

test("runtime routes render secondary operational views", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  for (const [path, heading, panel] of [
    ["/browsers", "Browsers", "Chromium"],
    ["/configuration", "Configuration", "Raw configuration"],
    ["/system", "System", "Current usage"],
    ["/settings", "Settings", "Theme mode"],
  ]) {
    await page.goto(path);
    await waitForConsoleReady(page);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText(panel).first()).toBeVisible();
  }
});

test("settings controls persist density detail and time preferences", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/settings");
  await waitForConsoleReady(page);

  await page.getByRole("button", { name: "Comfortable" }).click();
  await page.getByRole("button", { name: "Expanded" }).click();
  await page.getByRole("button", { name: "UTC" }).click();
  await page.getByRole("button", { name: "12h" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-density", "comfortable");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("selenwright-ui.density")))
    .toBe("comfortable");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("selenwright-ui.detail-panel")))
    .toBe("expanded");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("selenwright-ui.timezone")))
    .toBe("utc");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("selenwright-ui.time-format")))
    .toBe("12h");

  await page.goto("/configuration");
  await waitForConsoleReady(page);
  await expect
    .poll(() =>
      page
        .locator('details[data-persist-id="configuration:browser-catalog"]')
        .evaluate((detail) => detail.open),
    )
    .toBe(true);
});

test("configuration raw sections stay collapsed by default", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/configuration");
  await waitForConsoleReady(page);

  await expect
    .poll(() =>
      page
        .locator('details[data-persist-id="configuration:browser-catalog"]')
        .evaluate((detail) => detail.open),
    )
    .toBe(false);
});

test("system page keeps a compact non-dashboard layout", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/system");
  await waitForConsoleReady(page);

  const layout = await page.evaluate(() => ({
    currentUsagePanels: Array.from(document.querySelectorAll(".panel-header h2")).filter(
      (heading) => heading.textContent === "Current usage",
    ).length,
    hasKpiClass: Boolean(document.querySelector('[class*="kpi" i]')),
    summaryCards: document.querySelectorAll(".summary-card").length,
    summaryGrids: document.querySelectorAll(".summary-grid").length,
  }));

  expect(layout.currentUsagePanels).toBe(1);
  expect(layout.hasKpiClass).toBe(false);
  expect(layout.summaryCards).toBe(4);
  expect(layout.summaryGrids).toBe(1);
});

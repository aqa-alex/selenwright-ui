import { expect, test } from "@playwright/test";
import {
  installFixedClock,
  primarySessionId,
  setPreferences,
  useBaselineApi,
  waitForConsoleReady,
  waitForSessions,
} from "./fixtures.js";

test("sessions loads demo fallback data", async ({ page }) => {
  await page.goto("/sessions");

  await expect(page.getByRole("heading", { level: 1, name: "Sessions" })).toBeVisible();
  await expect(page.locator(".session-row")).toHaveCount(3);
  await expect(page.getByText("demo-abc123")).toBeVisible();
});

test("sessions table keeps compact density and avoids horizontal overflow", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/sessions");
  await waitForSessions(page, 14);

  const metrics = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".session-row"));
    const viewportHeight = window.innerHeight;
    const visibleRows = rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= viewportHeight;
    });
    const tableShell = document.querySelector(".table-shell");

    return {
      documentOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      rowHeights: rows.map((row) => row.getBoundingClientRect().height),
      tableOverflows: tableShell ? tableShell.scrollWidth > tableShell.clientWidth + 1 : true,
      visibleRowCount: visibleRows.length,
    };
  });

  expect(metrics.visibleRowCount).toBeGreaterThanOrEqual(10);
  expect(metrics.visibleRowCount).toBeLessThanOrEqual(15);
  expect(metrics.tableOverflows).toBe(false);
  expect(metrics.documentOverflows).toBe(false);
  expect(metrics.rowHeights.every((height) => height >= 52 && height <= 56)).toBe(true);
});

test("shell preserves 56px header and 240px desktop sidebar", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/sessions");
  await waitForSessions(page, 14);

  const shell = await page.evaluate(() => {
    const topbar = document.querySelector(".topbar");
    const sidebar = document.querySelector(".sidebar");

    return {
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
      topbarHeight: topbar ? Math.round(topbar.getBoundingClientRect().height) : 0,
    };
  });

  expect(shell.topbarHeight).toBe(56);
  expect(shell.sidebarWidth).toBe(240);
});

test("keyboard row navigation selects rows and opens detail", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/sessions");
  await waitForSessions(page, 14);

  const rows = page.locator(".session-row");
  await expect(rows.nth(0)).toHaveClass(/selected/);

  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toHaveClass(/selected/);

  await page.keyboard.press("j");
  await expect(rows.nth(2)).toHaveClass(/selected/);

  await page.keyboard.press("k");
  await expect(rows.nth(1)).toHaveClass(/selected/);

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sessions\/fixture-session-02$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("session detail opens from the sessions table", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/sessions");
  await waitForSessions(page, 14);
  await page.locator(".session-row").first().click();

  await expect(page).toHaveURL(new RegExp(`/sessions/${primarySessionId}$`));
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Artifacts" })).toBeVisible();
});

test("artifact routes render videos logs and downloads", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  for (const [path, heading] of [
    ["/artifacts/videos", "Videos"],
    ["/artifacts/logs", "Logs"],
    ["/artifacts/downloads", "Downloads"],
  ]) {
    await page.goto(path);
    await waitForConsoleReady(page);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator(".artifact-layout")).toBeVisible();
  }
});

test("theme modes persist and inline bootstrap applies before app paint", async ({ browser }) => {
  for (const colorScheme of ["light", "dark"]) {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();

    await setPreferences(page, { density: "compact", themeMode: "system" });
    await page.route("**/src/main.ts", async (route) => {
      await route.fulfill({
        body: "window.__selenwrightMainStubLoaded = true;",
        contentType: "text/javascript; charset=utf-8",
        status: 200,
      });
    });

    await page.goto("/sessions", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");

    await context.close();
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  await installFixedClock(page);
  await setPreferences(page, { density: "compact" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/sessions");
  await waitForSessions(page, 14);

  for (const mode of ["Light", "Dark", "System"]) {
    await page.getByRole("button", { name: mode }).first().click();
    const expectedMode = mode.toLowerCase();
    await expect(page.locator("html")).toHaveAttribute("data-theme-mode", expectedMode);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("selenwright-ui.theme-mode")))
      .toBe(expectedMode);
    await page.reload();
    await waitForSessions(page, 14);
    await expect(page.locator("html")).toHaveAttribute("data-theme-mode", expectedMode);
  }

  await context.close();
});

test("vnc viewer shell exposes clipboard drawer and session detail link", async ({ page }) => {
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await page.goto(`/vnc.html?session=${primarySessionId}&name=Fixture&browser=chromium`);

  await expect(page.getByRole("heading", { name: "Fixture · Chromium VNC" })).toBeVisible();
  await expect(page.locator("#vnc-clipboard-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#vnc-clipboard-body")).toBeHidden();
  await expect(page.locator("#vnc-open-session")).toHaveAttribute("href", `/sessions/${primarySessionId}`);
  await expect(page.locator("#vnc-viewer-mode-label")).toHaveText("Read only");
});

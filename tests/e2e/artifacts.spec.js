import { expect, test } from "@playwright/test";
import {
  installFixedClock,
  primarySessionId,
  setPreferences,
  useBaselineApi,
  waitForConsoleReady,
} from "./fixtures.js";

test("artifact pages render dense split panes and selection drawers", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/artifacts/videos");
  await waitForConsoleReady(page);

  await expect(page.getByRole("heading", { level: 1, name: "Videos" })).toBeVisible();
  await expect(page.locator(".artifact-layout--videos")).toBeVisible();
  await expect(page.locator(".artifact-table--videos tbody tr")).toHaveCount(1);
  await expect(page.locator(".artifact-layout__pane--drawer")).toContainText(
    `${primarySessionId}.mp4`,
  );

  await page.goto("/artifacts/downloads");
  await waitForConsoleReady(page);

  await expect(page.getByRole("heading", { level: 1, name: "Downloads" })).toBeVisible();
  await expect(page.locator(".artifact-layout--downloads")).toBeVisible();
  await expect(page.locator(".artifact-layout__pane--drawer")).toContainText(
    "fixture-report.json",
  );
  await expect(page.getByRole("link", { exact: true, name: "Download" })).toHaveAttribute(
    "href",
    "/api/downloads/file/fixture-session-01/fixture-report.json",
  );
});

test("logs artifact selection opens the correct pane content", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/artifacts/logs");
  await waitForConsoleReady(page);

  await page.locator('tr[data-filename="fixture-session-02.log"]').click();

  await expect(page.locator('tr[data-filename="fixture-session-02.log"]')).toHaveClass(
    /selected/,
  );
  await expect(page.getByRole("button", { name: "Copy block" })).toHaveAttribute(
    "data-filename",
    "fixture-session-02.log",
  );
  await expect(page.getByRole("link", { exact: true, name: "Download" })).toHaveAttribute(
    "download",
    "fixture-session-02.log",
  );
});

test("artifact splitter drag and keyboard resize persist", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { themeMode: "light" });
  await useBaselineApi(page, { sessionCount: 14 });

  await page.goto("/artifacts/logs");
  await waitForConsoleReady(page);

  const splitter = page.locator("[data-artifact-splitter]");
  const box = await splitter.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 80, box.y + box.height / 2);
  await page.mouse.up();

  const draggedRatio = await page.evaluate(() =>
    Number(localStorage.getItem("selenwright-ui.artifact-drawer-width.logs")),
  );
  expect(draggedRatio).toBeGreaterThan(0.37);

  await splitter.focus();
  const beforeKeyboard = Number(await splitter.getAttribute("aria-valuenow"));
  await page.keyboard.press("ArrowRight");
  const afterKeyboard = Number(await splitter.getAttribute("aria-valuenow"));
  expect(afterKeyboard).toBeLessThan(beforeKeyboard);

  const persistedRatio = await page.evaluate(() =>
    Number(localStorage.getItem("selenwright-ui.artifact-drawer-width.logs")),
  );
  await page.reload();
  await waitForConsoleReady(page);

  await expect
    .poll(() =>
      page.evaluate(() => Number(localStorage.getItem("selenwright-ui.artifact-drawer-width.logs"))),
    )
    .toBe(persistedRatio);
});

test("logs pagination and per-page control work", async ({ page }) => {
  await installFixedClock(page);
  await setPreferences(page, { themeMode: "light" });
  await useBaselineApi(page, { logCount: 12, sessionCount: 14 });

  await page.goto("/artifacts/logs");
  await waitForConsoleReady(page);

  await expect(page.locator(".artifact-table--logs tbody tr")).toHaveCount(10);
  await expect(page.locator(".pagination-info")).toHaveText("1 / 2");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator(".pagination-info")).toHaveText("2 / 2");
  await expect(page.locator('tr[data-filename="fixture-session-11.log"]')).toBeVisible();

  await page.locator('select[data-input="logs-per-page"]').selectOption("20");
  await expect(page.locator(".artifact-table--logs tbody tr")).toHaveCount(12);
  await expect(page.locator(".pagination-info")).toHaveText("1 / 1");
});

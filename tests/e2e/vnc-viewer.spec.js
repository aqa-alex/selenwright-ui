import { expect, test } from "@playwright/test";
import { primarySessionId, setPreferences } from "./fixtures.js";

test("vnc viewer renders missing session id error state", async ({ page }) => {
  await setPreferences(page, { density: "compact", themeMode: "light" });

  await page.goto("/vnc.html");

  await expect(page.getByRole("heading", { name: "Session VNC" })).toBeVisible();
  await expect(page.locator("#vnc-status")).toHaveText("Session id is missing");
  await expect(page.locator("#vnc-status")).toHaveAttribute("data-state", "error");
  await expect(page.locator("#vnc-clipboard-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#vnc-clipboard-body")).toBeHidden();
  await expect(page.locator("#vnc-open-session")).toHaveAttribute("href", "/sessions");
});

test("vnc viewer clipboard drawer expands on click and enables controls for a session", async ({ page }) => {
  await setPreferences(page, { density: "compact", themeMode: "light" });

  await page.goto(`/vnc.html?session=${primarySessionId}&name=Fixture&browser=chromium`);

  await expect(page.getByRole("heading", { name: "Fixture · Chromium VNC" })).toBeVisible();
  await expect(page.locator("#vnc-session-label")).toHaveText(`Fixture · ${primarySessionId}`);
  await expect(page.locator("#vnc-open-session")).toHaveAttribute("href", `/sessions/${primarySessionId}`);

  const toggle = page.locator("#vnc-clipboard-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#vnc-clipboard-body")).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#vnc-clipboard-body")).toBeVisible();
  await expect(page.locator("#vnc-clipboard-pull")).toBeEnabled();
  await expect(page.locator("#vnc-clipboard-push")).toBeEnabled();
  await expect(page.locator("#vnc-clipboard-textarea")).toBeEnabled();
  await expect(page.locator("#vnc-clipboard-synced")).toHaveText("Not synced");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#vnc-clipboard-body")).toBeHidden();
});

test("vnc viewer read-only toggle changes control state", async ({ page }) => {
  await setPreferences(page, { density: "compact", themeMode: "light" });
  await page.goto(`/vnc.html?session=${primarySessionId}&name=Fixture&browser=chromium`);

  const toggle = page.locator("#vnc-viewer-mode");

  await expect(toggle).toHaveAttribute("data-read-only", "true");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#vnc-viewer-mode-label")).toHaveText("Read only");

  await toggle.click();
  await expect(toggle).toHaveAttribute("data-read-only", "false");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#vnc-viewer-mode-label")).toHaveText("Control enabled");

  await toggle.click();
  await expect(toggle).toHaveAttribute("data-read-only", "true");
  await expect(page.locator("#vnc-viewer-mode-label")).toHaveText("Read only");
});

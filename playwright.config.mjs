import { defineConfig } from "@playwright/test";

const testPort = Number(process.env.PLAYWRIGHT_PORT || 49173);
const testApiPort = Number(process.env.PLAYWRIGHT_API_PORT || 49273);
const baseURL = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.005,
    },
  },
  fullyParallel: false,
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        channel: "chrome",
        viewport: { width: 1470, height: 956 },
      },
    },
  ],
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `DEMO_MODE=true PORT=${testPort} SELENWRIGHT_DEV_API_PORT=${testApiPort} npm run dev`,
    reuseExistingServer: false,
    timeout: 20_000,
    url: `${baseURL}/api/meta`,
  },
});

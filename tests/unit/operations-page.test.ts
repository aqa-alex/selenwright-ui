import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { renderToString } from "@vue/server-renderer";
import { createPinia, setActivePinia } from "pinia";
import { createSSRApp } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import OperationsPage from "../../src/app/pages/OperationsPage.vue";
import type { OperationsPageModel, OperationsRouteName } from "../../src/app/operations/operationsPage";
import {
  type Density,
  type DetailPanel,
  type ThemeMode,
  type TimeFormat,
  type Timezone,
  usePreferencesStore,
} from "../../src/app/stores/preferences";
import { createEmptyDataset } from "../../src/app/api";

describe("OperationsPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders browser inventory grouped by browser", async () => {
    const html = await renderOperationsPage({
      browsers: [
        {
          browser: "chromium",
          protocol: "playwright",
          source: "chromium:latest",
          status: "ready",
          version: "latest",
        },
      ],
      routeName: "browsers",
    });

    expect(html).toContain("<h1>Browsers</h1>");
    expect(html).toContain("Chromium");
    expect(html).toContain('class="protocol-badge protocol-badge-playwright"');
    expect(html).toContain('class="status-badge status-running"');
  });

  it("keeps raw configuration collapsed unless detail panels are expanded", async () => {
    const collapsedHtml = await renderOperationsPage({
      configuration: buildConfiguration(),
      routeName: "configuration",
    });
    const expandedHtml = await renderOperationsPage({
      configuration: buildConfiguration(),
      preferences: { detailPanel: "expanded" },
      routeName: "configuration",
    });

    expect(collapsedHtml).toContain("<h1>Configuration</h1>");
    expect(collapsedHtml).toContain("Browser catalog JSON");
    expect(collapsedHtml).not.toContain('<details data-persist-id="configuration:browser-catalog" open>');
    expect(expandedHtml).toContain('<details data-persist-id="configuration:browser-catalog" open>');
  });

  it("renders system usage as a compact operational view", async () => {
    const html = await renderOperationsPage({
      routeName: "system",
      system: {
        ...createEmptyDataset().system,
        browserUsage: [{ browser: "chromium", count: 14, running: 14 }],
        healthNotes: ["Fixture status ready"],
        usageSummary: [
          { label: "Queued requests", value: "1" },
          { label: "Pending starts", value: "0" },
          { label: "Active sessions", value: "14" },
          { label: "Ready state", value: "Ready" },
        ],
      },
    });

    expect(html).toContain("<h1>System</h1>");
    expect(html.match(/class="summary-card"/g)).toHaveLength(4);
    expect(html).toContain("Browser usage");
    expect(html).toContain("Fixture status ready");
  });

  it("renders settings state changes and dirty artifact history controls", async () => {
    const preferencesStore = usePreferencesStore();
    preferencesStore.$patch({
      density: "comfortable" as Density,
      detailPanel: "expanded" as DetailPanel,
      themeMode: "dark" as ThemeMode,
      timeFormat: "12h" as TimeFormat,
      timezone: "utc" as Timezone,
    });
    const html = await renderOperationsPage({
      artifactHistoryUi: {
        dirty: true,
        draftEnabled: false,
        draftRetentionDays: "21",
        error: "",
        loaded: true,
        saving: false,
      },
      routeName: "settings",
      settings: {
        artifactHistory: {
          available: true,
          enabled: true,
          reason: "",
          retentionDays: 7,
        },
      },
    });

    expect(html).toContain("<h1>Settings</h1>");
    // Comfortable density button is the selected one in the density panel.
    expect(html).toMatch(/Density[\s\S]*?segmented-option selected[^>]*>Comfortable/);
    expect(html).toContain('value="21"');
    // Save button is enabled when the draft is dirty and history is available.
    expect(html).toMatch(/<button[^>]*class="button"(?![^>]*disabled)[^>]*>\s*Save settings/);
  });

  it("disables artifact history controls when the backend setting is unavailable", async () => {
    const html = await renderOperationsPage({
      routeName: "settings",
      settings: {
        artifactHistory: {
          available: false,
          enabled: false,
          reason: "Blocked upstream",
          retentionDays: 7,
        },
      },
    });

    expect(html).toContain("Blocked upstream");
    // Save button is disabled when the backend setting is unavailable.
    expect(html).toMatch(/<button[^>]*class="button"[^>]*disabled[^>]*>\s*Save settings/);
    // The retention-days input is also disabled.
    expect(html).toMatch(/<input[^>]*placeholder="7"[^>]*disabled/);
  });
});

async function renderOperationsPage(overrides: Partial<OperationsPageModel> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const app = createSSRApp(OperationsPage, { model: buildModel(overrides) });
  app.use(VueQueryPlugin, { queryClient });
  return renderToString(app);
}

function buildModel(overrides: Partial<OperationsPageModel> = {}): OperationsPageModel {
  const dataset = createEmptyDataset("fixture");
  const routeName: OperationsRouteName = overrides.routeName || "settings";

  return {
    artifactHistoryUi: {
      dirty: false,
      draftEnabled: true,
      draftRetentionDays: "7",
      error: "",
      loaded: true,
      saving: false,
    },
    browsers: [],
    configuration: dataset.configuration,
    connection: dataset.connection,
    preferences: {
      density: "compact",
      detailPanel: "collapsed",
      themeMode: "system",
      timeFormat: "24h",
      timezone: "utc",
    },
    routeName,
    settings: dataset.settings,
    system: dataset.system,
    ...overrides,
    artifactHistoryUi: {
      dirty: false,
      draftEnabled: true,
      draftRetentionDays: "7",
      error: "",
      loaded: true,
      saving: false,
      ...(overrides.artifactHistoryUi || {}),
    },
    preferences: {
      density: "compact",
      detailPanel: "collapsed",
      themeMode: "system",
      timeFormat: "24h",
      timezone: "utc",
      ...(overrides.preferences || {}),
    },
    routeName,
    settings: {
      artifactHistory: {
        ...dataset.settings.artifactHistory,
        ...(overrides.settings?.artifactHistory || {}),
      },
    },
  };
}

function buildConfiguration(): OperationsPageModel["configuration"] {
  return {
    available: true,
    featureAvailability: [{ key: "downloads", label: "Downloads", value: "true" }],
    limits: [{ key: "maxSessions", label: "Max sessions", value: "20" }],
    logging: [{ key: "level", label: "Level", value: "info" }],
    message: "",
    paths: [{ key: "downloadsPath", label: "Downloads path", value: "/tmp/downloads" }],
    raw: {
      browserCatalog: [
        {
          name: "chromium",
          versions: [{ image: "chromium:latest", version: "latest" }],
        },
      ],
      flags: { video: true },
      reloadStatus: { state: "ready" },
    },
  };
}

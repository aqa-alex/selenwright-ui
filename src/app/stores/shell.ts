import { defineStore } from "pinia";
import type { ShellPreferences, ShellQuickJumpResult, ShellSnapshot } from "../types";
import type { ArtifactPageModel } from "../artifacts/artifactsPage";
import type { OperationsPageModel } from "../operations/operationsPage";
import type { SessionDetailPageModel } from "../session-detail/sessionDetail";
import type { SessionsPageModel } from "../sessions/sessionTable";

const defaultPreferences: ShellPreferences = {
  artifactPaneWidths: {},
  density: "compact",
  detailPanel: "collapsed",
  themeMode: "system",
  timeFormat: "24h",
  timezone: "local",
};

function clonePreferences(preferences: ShellPreferences): ShellPreferences {
  return {
    ...preferences,
    artifactPaneWidths: { ...(preferences.artifactPaneWidths || {}) },
  };
}

function cloneQuickJumpResults(results: ShellQuickJumpResult[]): ShellQuickJumpResult[] {
  return results.map((result) => ({ ...result }));
}

function cloneArtifactPage(model: ArtifactPageModel | null): ArtifactPageModel | null {
  if (!model) {
    return null;
  }

  return {
    ...model,
    downloads: [...model.downloads],
    logFiles: Object.fromEntries(
      Object.entries(model.logFiles).map(([filename, state]) => [filename, { ...state }]),
    ),
    logs: [...model.logs],
    preferences: {
      ...model.preferences,
      artifactPaneWidths: { ...(model.preferences.artifactPaneWidths || {}) },
    },
    selectedArtifacts: { ...model.selectedArtifacts },
    sessions: [...model.sessions],
    videos: [...model.videos],
  };
}

function cloneOperationsPage(model: OperationsPageModel | null): OperationsPageModel | null {
  if (!model) {
    return null;
  }

  return {
    ...model,
    artifactHistoryUi: { ...model.artifactHistoryUi },
    browsers: model.browsers.map((entry) => ({ ...entry })),
    configuration: {
      ...model.configuration,
      featureAvailability: model.configuration.featureAvailability.map((item) => ({ ...item })),
      limits: model.configuration.limits.map((item) => ({ ...item })),
      logging: model.configuration.logging.map((item) => ({ ...item })),
      paths: model.configuration.paths.map((item) => ({ ...item })),
      raw: {
        browserCatalog: model.configuration.raw.browserCatalog.map((entry) => ({
          ...entry,
          versions: entry.versions.map((version) => ({ ...version })),
        })),
        flags: { ...model.configuration.raw.flags },
        reloadStatus: { ...model.configuration.raw.reloadStatus },
      },
    },
    connection: { ...model.connection },
    preferences: {
      ...model.preferences,
      artifactPaneWidths: { ...(model.preferences.artifactPaneWidths || {}) },
    },
    settings: {
      artifactHistory: { ...model.settings.artifactHistory },
    },
    system: {
      ...model.system,
      browserUsage: model.system.browserUsage.map((entry) => ({ ...entry })),
      healthNotes: [...model.system.healthNotes],
      limits: { ...model.system.limits },
      usageSummary: model.system.usageSummary.map((item) => ({ ...item })),
    },
  };
}

function cloneSessionsPage(model: SessionsPageModel | null): SessionsPageModel | null {
  if (!model) {
    return null;
  }

  return {
    ...model,
    filters: { ...model.filters },
    preferences: { ...model.preferences },
    sessions: [...model.sessions],
  };
}

function cloneSessionDetailPage(
  model: SessionDetailPageModel | null,
): SessionDetailPageModel | null {
  if (!model) {
    return null;
  }

  return {
    ...model,
    liveLogs: { ...model.liveLogs },
    logFiles: Object.fromEntries(
      Object.entries(model.logFiles).map(([filename, state]) => [filename, { ...state }]),
    ),
    logs: [...model.logs],
    preferences: { ...model.preferences },
    session: model.session ? { ...model.session } : null,
  };
}

export const useShellStore = defineStore("shell", {
  actions: {
    applySnapshot(snapshot: ShellSnapshot) {
      this.notice = snapshot.notice;
      this.artifactPage = cloneArtifactPage(snapshot.artifactPage);
      this.operationsPage = cloneOperationsPage(snapshot.operationsPage);
      this.pageTitle = snapshot.pageTitle;
      this.preferences = clonePreferences(snapshot.preferences);
      this.quickJumpQuery = snapshot.quickJumpQuery;
      this.quickJumpResults = cloneQuickJumpResults(snapshot.quickJumpResults);
      this.routeName = snapshot.routeName;
      this.sessionDetailPage = cloneSessionDetailPage(snapshot.sessionDetailPage);
      this.sessionsPage = cloneSessionsPage(snapshot.sessionsPage);
    },
  },
  state: (): ShellSnapshot => ({
    artifactPage: null,
    notice: "",
    operationsPage: null,
    pageTitle: "Selenwright",
    preferences: clonePreferences(defaultPreferences),
    quickJumpQuery: "",
    quickJumpResults: [],
    routeName: "sessions",
    sessionDetailPage: null,
    sessionsPage: null,
  }),
});

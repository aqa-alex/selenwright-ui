import type {
  ArtifactHistorySettings,
  BrowserInventoryRow,
  ConfigurationData,
  ConfigurationRawData,
  ConsoleConnectionState,
  ConsoleSystemState,
} from "../api";
import type { StackUpdateState } from "../stores/settings";
import { titleCase } from "../../lib/format";

export type OperationsRouteName = "browsers" | "configuration" | "settings" | "system";

export interface ArtifactHistoryUiState {
  dirty: boolean;
  draftEnabled: boolean;
  draftRetentionDays: string;
  error: string;
  loaded: boolean;
  saving: boolean;
}

export interface OperationsPreferences {
  artifactPaneWidths?: Record<string, number>;
  detailPanel?: string;
  themeMode: string;
  timeFormat?: string;
  timezone?: string;
}

export interface OperationsPageModel {
  artifactHistoryUi: ArtifactHistoryUiState;
  browsers: BrowserInventoryRow[];
  configuration: ConfigurationData;
  connection: ConsoleConnectionState;
  preferences: OperationsPreferences;
  routeName: OperationsRouteName;
  settings: {
    artifactHistory: ArtifactHistorySettings;
  };
  stackUi: StackUpdateState;
  system: ConsoleSystemState;
}

export interface BrowserInventoryGroup {
  browser: string;
  label: string;
  versions: BrowserInventoryRow[];
}

export interface ConfigurationRawSection {
  content: string;
  persistId: string;
  title: string;
}

export function getBrowserInventoryGroups(
  browsers: BrowserInventoryRow[],
): BrowserInventoryGroup[] {
  const groups = new Map<string, BrowserInventoryRow[]>();

  for (const entry of browsers) {
    const versions = groups.get(entry.browser) || [];
    versions.push(entry);
    groups.set(entry.browser, versions);
  }

  return Array.from(groups, ([browser, versions]) => ({
    browser,
    label: titleCase(browser),
    versions,
  }));
}

export function getBrowserStatusBadgeStatus(status: string): string {
  return status === "ready" ? "running" : "pending";
}

export function getConfigurationEmptyLabel(configuration: ConfigurationData): string {
  if (configuration.available) {
    return "No data";
  }

  return configuration.message === "Waiting for configuration data" ? "Waiting" : "Unavailable";
}

export function getConfigurationStatusClass(configuration: ConfigurationData): string {
  if (!configuration.available && configuration.message !== "Waiting for configuration data") {
    return "log-note-error";
  }

  return "";
}

export function getConfigurationRawSections(
  configuration: ConfigurationData,
): ConfigurationRawSection[] {
  if (!hasRawConfigurationData(configuration.raw)) {
    return [];
  }

  return [
    {
      content: stringifyRawConfiguration(configuration.raw.browserCatalog),
      persistId: "configuration:browser-catalog",
      title: "Browser catalog JSON",
    },
    {
      content: stringifyRawConfiguration({
        flags: configuration.raw.flags,
        reloadStatus: configuration.raw.reloadStatus,
      }),
      persistId: "configuration:flags-reload-status",
      title: "Flags and reload status",
    },
  ];
}

export function hasRawConfigurationData(raw: ConfigurationRawData): boolean {
  return Boolean(
    raw.browserCatalog.length || Object.keys(raw.flags).length || Object.keys(raw.reloadStatus).length,
  );
}

function stringifyRawConfiguration(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

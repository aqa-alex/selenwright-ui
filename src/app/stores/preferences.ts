import { defineStore } from "pinia";
import {
  applyTheme,
  loadPreferences,
  saveArtifactPaneWidth as savePaneWidth,
  savePreference,
  watchSystemTheme,
} from "../../lib/preferences";

export type ThemeMode = "system" | "light" | "dark";
export type DetailPanel = "collapsed" | "expanded";
export type TimeFormat = "12h" | "24h";
export type Timezone = "local" | "utc";
export type ArtifactPaneKey = "videos" | "logs" | "downloads";

export type ArtifactPaneWidths = Record<ArtifactPaneKey, number>;

export interface PreferencesState {
  detailPanel: DetailPanel;
  themeMode: ThemeMode;
  timeFormat: TimeFormat;
  timezone: Timezone;
  artifactPaneWidths: ArtifactPaneWidths;
  systemThemeWatcherInstalled: boolean;
}

interface RawPreferences {
  detailPanel: string;
  themeMode: string;
  timeFormat: string;
  timezone: string;
  artifactPaneWidths: ArtifactPaneWidths;
}

function readInitialPreferences(): Omit<PreferencesState, "systemThemeWatcherInstalled"> {
  const raw = loadPreferences() as RawPreferences;
  return {
    detailPanel: raw.detailPanel as DetailPanel,
    themeMode: raw.themeMode as ThemeMode,
    timeFormat: raw.timeFormat as TimeFormat,
    timezone: raw.timezone as Timezone,
    artifactPaneWidths: { ...raw.artifactPaneWidths },
  };
}

export const usePreferencesStore = defineStore("preferences", {
  state: (): PreferencesState => ({
    ...readInitialPreferences(),
    systemThemeWatcherInstalled: false,
  }),
  actions: {
    initialize() {
      applyTheme(this.themeMode);
      if (!this.systemThemeWatcherInstalled) {
        watchSystemTheme(() => {
          if (this.themeMode === "system") {
            applyTheme("system");
          }
        });
        this.systemThemeWatcherInstalled = true;
      }
    },
    setThemeMode(mode: ThemeMode) {
      this.themeMode = mode;
      applyTheme(mode);
    },
    setDetailPanel(value: DetailPanel) {
      this.detailPanel = value;
      savePreference("detailPanel", value);
    },
    setTimeFormat(value: TimeFormat) {
      this.timeFormat = value;
      savePreference("timeFormat", value);
    },
    setTimezone(value: Timezone) {
      this.timezone = value;
      savePreference("timezone", value);
    },
    setArtifactPaneWidth(pageKey: ArtifactPaneKey, ratio: number) {
      const normalized = savePaneWidth(pageKey, ratio);
      this.artifactPaneWidths = {
        ...this.artifactPaneWidths,
        [pageKey]: normalized,
      };
    },
  },
});

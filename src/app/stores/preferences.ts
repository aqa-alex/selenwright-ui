import { defineStore } from "pinia";
import {
  applyDensity,
  applyTheme,
  loadPreferences,
  saveArtifactPaneWidth as savePaneWidth,
  savePreference,
  watchSystemTheme,
} from "../../lib/preferences";

export type ThemeMode = "system" | "light" | "dark";
export type Density = "compact" | "comfortable";
export type DetailPanel = "collapsed" | "expanded";
export type TimeFormat = "12h" | "24h";
export type Timezone = "local" | "utc";
export type ArtifactPaneKey = "videos" | "logs" | "downloads";

export type ArtifactPaneWidths = Record<ArtifactPaneKey, number>;

export interface PreferencesState {
  density: Density;
  detailPanel: DetailPanel;
  themeMode: ThemeMode;
  timeFormat: TimeFormat;
  timezone: Timezone;
  artifactPaneWidths: ArtifactPaneWidths;
  systemThemeWatcherInstalled: boolean;
}

interface RawPreferences {
  density: string;
  detailPanel: string;
  themeMode: string;
  timeFormat: string;
  timezone: string;
  artifactPaneWidths: ArtifactPaneWidths;
}

function readInitialPreferences(): Omit<PreferencesState, "systemThemeWatcherInstalled"> {
  const raw = loadPreferences() as RawPreferences;
  return {
    density: raw.density as Density,
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
    /**
     * Apply current preferences to the DOM and start watching the system
     * colour scheme. Idempotent — safe to call from app bootstrap.
     */
    initialize() {
      applyTheme(this.themeMode);
      applyDensity(this.density);
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
    setDensity(density: Density) {
      this.density = density;
      applyDensity(density);
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

export type ThemeMode = "system" | "light" | "dark";
export type DetailPanel = "collapsed" | "expanded";
export type TimeFormat = "12h" | "24h";
export type Timezone = "local" | "utc";
export type ArtifactPaneKey = "videos" | "logs" | "downloads";

export type ArtifactPaneWidths = Record<ArtifactPaneKey, number>;

export interface PreferencesSnapshot {
  detailPanel: DetailPanel;
  themeMode: ThemeMode;
  timeFormat: TimeFormat;
  timezone: Timezone;
  artifactPaneWidths: ArtifactPaneWidths;
}

const artifactPaneDefaults: ArtifactPaneWidths = {
  videos: 0.37,
  logs: 0.37,
  downloads: 0.37,
};

const defaults: PreferencesSnapshot = {
  detailPanel: "collapsed",
  themeMode: "system",
  timeFormat: "24h",
  timezone: "local",
  artifactPaneWidths: { ...artifactPaneDefaults },
};

const storageKeys = {
  detailPanel: "selenwright-ui.detail-panel",
  themeMode: "selenwright-ui.theme-mode",
  timeFormat: "selenwright-ui.time-format",
  timezone: "selenwright-ui.timezone",
} as const;

type ScalarPreferenceKey = keyof typeof storageKeys;

const artifactPaneStorageKeys: Record<ArtifactPaneKey, string> = {
  downloads: "selenwright-ui.artifact-drawer-width.downloads",
  logs: "selenwright-ui.artifact-drawer-width.logs",
  videos: "selenwright-ui.artifact-drawer-width.videos",
};

let cachedThemeMediaQuery: MediaQueryList | null = null;
function getThemeMediaQuery(): MediaQueryList | null {
  if (cachedThemeMediaQuery) {
    return cachedThemeMediaQuery;
  }
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  cachedThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  return cachedThemeMediaQuery;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}

export function loadPreferences(): PreferencesSnapshot {
  return {
    detailPanel: normalizeDetailPanel(readStorage(storageKeys.detailPanel)),
    themeMode: normalizeThemeMode(readStorage(storageKeys.themeMode)),
    timeFormat: normalizeTimeFormat(readStorage(storageKeys.timeFormat)),
    timezone: normalizeTimezone(readStorage(storageKeys.timezone)),
    artifactPaneWidths: loadArtifactPaneWidths(),
  };
}

export function getDefaultPreferences(): PreferencesSnapshot {
  return {
    ...defaults,
    artifactPaneWidths: { ...defaults.artifactPaneWidths },
  };
}

export function savePreference(key: ScalarPreferenceKey, value: string): void {
  const storageKey = storageKeys[key];
  if (!storageKey) {
    return;
  }
  writeStorage(storageKey, String(value));
}

export function applyPreferences(preferences: PreferencesSnapshot): void {
  applyTheme(preferences.themeMode);
}

export function applyTheme(themeMode: string): void {
  const normalizedThemeMode = normalizeThemeMode(themeMode);
  const mediaQuery = getThemeMediaQuery();
  const resolvedTheme =
    normalizedThemeMode === "system"
      ? mediaQuery && mediaQuery.matches
        ? "dark"
        : "light"
      : normalizedThemeMode;

  if (typeof document !== "undefined") {
    document.documentElement.dataset.themeMode = normalizedThemeMode;
    document.documentElement.dataset.theme = resolvedTheme;
  }
  savePreference("themeMode", normalizedThemeMode);
}

export function saveArtifactPaneWidth(pageKey: ArtifactPaneKey, ratio: number): number {
  const storageKey = artifactPaneStorageKeys[pageKey];
  if (!storageKey) {
    return defaults.artifactPaneWidths.videos;
  }
  const normalizedRatio = normalizeArtifactPaneRatio(ratio);
  writeStorage(storageKey, String(normalizedRatio));
  return normalizedRatio;
}

export function watchSystemTheme(onChange: (theme: "dark" | "light") => void): () => void {
  const mediaQuery = getThemeMediaQuery();
  if (!mediaQuery) {
    return () => {};
  }
  const listener = () => onChange(mediaQuery.matches ? "dark" : "light");
  mediaQuery.addEventListener("change", listener);
  return () => mediaQuery.removeEventListener("change", listener);
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === "system" || value === "light" || value === "dark" ? value : defaults.themeMode;
}

function normalizeDetailPanel(value: unknown): DetailPanel {
  return value === "collapsed" || value === "expanded" ? value : defaults.detailPanel;
}

function normalizeTimeFormat(value: unknown): TimeFormat {
  return value === "12h" || value === "24h" ? value : defaults.timeFormat;
}

function normalizeTimezone(value: unknown): Timezone {
  return value === "local" || value === "utc" ? value : defaults.timezone;
}

function loadArtifactPaneWidths(): ArtifactPaneWidths {
  return {
    videos: normalizeArtifactPaneRatio(readStorage(artifactPaneStorageKeys.videos)),
    logs: normalizeArtifactPaneRatio(readStorage(artifactPaneStorageKeys.logs)),
    downloads: normalizeArtifactPaneRatio(readStorage(artifactPaneStorageKeys.downloads)),
  };
}

function normalizeArtifactPaneRatio(value: unknown): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return artifactPaneDefaults.videos;
  }
  return Math.min(0.95, Math.max(0.05, parsed));
}

const artifactPaneDefaults = {
  videos: 0.37,
  logs: 0.37,
  downloads: 0.37,
};

const defaults = {
  density: 'compact',
  detailPanel: 'collapsed',
  themeMode: 'system',
  timeFormat: '24h',
  timezone: 'local',
  artifactPaneWidths: { ...artifactPaneDefaults },
};

const storageKeys = {
  density: 'selenwright-ui.density',
  detailPanel: 'selenwright-ui.detail-panel',
  themeMode: 'selenwright-ui.theme-mode',
  timeFormat: 'selenwright-ui.time-format',
  timezone: 'selenwright-ui.timezone',
};

const artifactPaneStorageKeys = {
  downloads: 'selenwright-ui.artifact-drawer-width.downloads',
  logs: 'selenwright-ui.artifact-drawer-width.logs',
  videos: 'selenwright-ui.artifact-drawer-width.videos',
};

const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function loadPreferences() {
  return {
    density: normalizeDensity(localStorage.getItem(storageKeys.density)),
    detailPanel: normalizeDetailPanel(
      localStorage.getItem(storageKeys.detailPanel),
    ),
    themeMode: normalizeThemeMode(localStorage.getItem(storageKeys.themeMode)),
    timeFormat: normalizeTimeFormat(
      localStorage.getItem(storageKeys.timeFormat),
    ),
    timezone: normalizeTimezone(localStorage.getItem(storageKeys.timezone)),
    artifactPaneWidths: loadArtifactPaneWidths(),
  };
}

export function getDefaultPreferences() {
  return {
    ...defaults,
    artifactPaneWidths: { ...defaults.artifactPaneWidths },
  };
}

export function savePreference(key, value) {
  const storageKey = storageKeys[key];
  if (!storageKey) {
    return;
  }
  localStorage.setItem(storageKey, String(value));
}

export function applyPreferences(preferences) {
  applyTheme(preferences.themeMode);
  applyDensity(preferences.density);
}

export function applyTheme(themeMode) {
  const normalizedThemeMode = normalizeThemeMode(themeMode);
  const resolvedTheme =
    normalizedThemeMode === 'system'
      ? themeMediaQuery.matches
        ? 'dark'
        : 'light'
      : normalizedThemeMode;

  document.documentElement.dataset.themeMode = normalizedThemeMode;
  document.documentElement.dataset.theme = resolvedTheme;
  savePreference('themeMode', normalizedThemeMode);
}

export function applyDensity(density) {
  const normalizedDensity = normalizeDensity(density);
  document.documentElement.dataset.density = normalizedDensity;
  savePreference('density', normalizedDensity);
}

export function saveArtifactPaneWidth(pageKey, ratio) {
  const storageKey = artifactPaneStorageKeys[pageKey];
  if (!storageKey) {
    return defaults.artifactPaneWidths.videos;
  }

  const normalizedRatio = normalizeArtifactPaneRatio(ratio);
  localStorage.setItem(storageKey, String(normalizedRatio));
  return normalizedRatio;
}

export function watchSystemTheme(onChange) {
  const listener = () => onChange(themeMediaQuery.matches ? 'dark' : 'light');
  themeMediaQuery.addEventListener('change', listener);
  return () => themeMediaQuery.removeEventListener('change', listener);
}

function normalizeThemeMode(value) {
  return ['system', 'light', 'dark'].includes(value)
    ? value
    : defaults.themeMode;
}

function normalizeDensity(value) {
  return ['compact', 'comfortable'].includes(value) ? value : defaults.density;
}

function normalizeDetailPanel(value) {
  return ['collapsed', 'expanded'].includes(value)
    ? value
    : defaults.detailPanel;
}

function normalizeTimeFormat(value) {
  return ['12h', '24h'].includes(value) ? value : defaults.timeFormat;
}

function normalizeTimezone(value) {
  return ['local', 'utc'].includes(value) ? value : defaults.timezone;
}

function loadArtifactPaneWidths() {
  return {
    videos: normalizeArtifactPaneRatio(
      localStorage.getItem(artifactPaneStorageKeys.videos),
    ),
    logs: normalizeArtifactPaneRatio(
      localStorage.getItem(artifactPaneStorageKeys.logs),
    ),
    downloads: normalizeArtifactPaneRatio(
      localStorage.getItem(artifactPaneStorageKeys.downloads),
    ),
  };
}

function normalizeArtifactPaneRatio(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return artifactPaneDefaults.videos;
  }
  return Math.min(0.95, Math.max(0.05, parsed));
}

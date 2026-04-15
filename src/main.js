import {
  subscribeToConsoleData,
  createEmptyDataset,
  loadConsoleData,
  loadLogFileContent,
  saveArtifactHistorySettings,
  subscribeToLiveLogs,
  terminateSession,
} from "./data/service.ts";
import { formatDuration, formatStatus, timeAgo } from "./lib/format.js";
import { saveArtifactPaneWidth } from "./lib/preferences.js";
import { buildSessionPath, navGroups, parseRoute } from "./app/router.ts";
import { navigate } from "./lib/router.js";
import { getFilteredSessionsForState } from "./app/sessions/sessionTable.ts";
import {
  getPreferencesStore,
  getSessionsStore,
  getSettingsStore,
  getUiStore,
  mountConsoleShell,
  setSaveArtifactHistoryHandler,
  updateConsoleShell,
} from "./main.ts";

const defaultPreferencesShape = {
  density: "compact",
  detailPanel: "collapsed",
  themeMode: "system",
  timeFormat: "24h",
  timezone: "local",
  artifactPaneWidths: { videos: 0.37, logs: 0.37, downloads: 0.37 },
};
const state = {
  data: createEmptyDataset(),
  filters: {
    activeOnly: false,
    browser: "all",
    protocol: "all",
    search: "",
    sort: "started",
    status: "all",
  },
  // Mirror of the preferences Pinia store. Kept around so createShellSnapshot
  // can read preferences synchronously; updated via a $subscribe wired up
  // after Vue mounts (see bindPreferencesMirror below).
  preferences: defaultPreferencesShape,
  route: parseRoute(window.location.pathname),
  ui: {
    artifactSessionFilter: "",
    artifactHistory: {
      dirty: false,
      draftEnabled: false,
      draftRetentionDays: "7",
      error: "",
      loaded: false,
      saving: false,
    },
    detailDisclosures: {},
    logFiles: {},
    logSearch: "",
    logsPage: 1,
    logsPerPage: 10,
    liveLogs: createInitialLiveLogState(),
    notice: "",
    quickJumpQuery: "",
    quickJumpResults: [],
    selectedArtifacts: {
      downloads: null,
      logs: null,
      videos: null,
    },
    selectedSessionId: null,
    terminatingSessionId: "",
  },
};

let noticeTimeout = 0;
const restorableTextInputTypes = new Set(["email", "password", "search", "tel", "text", "url"]);
const artifactPageKeys = new Set(["videos", "logs", "downloads"]);
const operationsPageKeys = new Set(["browsers", "configuration", "settings", "system"]);
const artifactDesktopBreakpoint = 1180;
const artifactSplitterWidth = 8;
const artifactMinIndexWidth = 420;
const artifactMinDrawerWidth = 360;
const artifactKeyboardStep = 24;
let artifactResizeState = null;
let consoleDataSubscription = null;
let liveLogSubscription = null;
let liveLogSubscriptionToken = 0;
let liveLogRenderFrame = 0;
let relativeTimeTimer = 0;
let renderVersion = 0;
let suppressDisclosureTracking = false;

const root = document.getElementById("app");
if (root instanceof HTMLElement) {
  mountConsoleShell(root, { onRouteChange: handleRouteChange });
}

bindPreferencesMirror();
bindUiMirror();
bindSessionsMirror();
bindSettingsMirror();
setSaveArtifactHistoryHandler(saveArtifactHistorySettingsFromUi);
bindGlobalEvents();
bindGlobalErrorHandlers();
render();
bootstrap().catch((error) => {
  reportBootstrapError(error);
});

function bindPreferencesMirror() {
  const preferencesStore = getPreferencesStore();
  if (!preferencesStore) {
    return;
  }
  syncPreferencesFromStore(preferencesStore);
  preferencesStore.$subscribe(() => {
    syncPreferencesFromStore(preferencesStore);
    render();
  });
}

function syncPreferencesFromStore(preferencesStore) {
  const next = preferencesStore.$state;
  state.preferences = {
    density: next.density,
    detailPanel: next.detailPanel,
    themeMode: next.themeMode,
    timeFormat: next.timeFormat,
    timezone: next.timezone,
    artifactPaneWidths: { ...next.artifactPaneWidths },
  };
}

function bindUiMirror() {
  const uiStore = getUiStore();
  if (!uiStore) {
    return;
  }
  syncUiFromStore(uiStore);
  uiStore.$subscribe(() => {
    syncUiFromStore(uiStore);
    render();
  });
}

function syncUiFromStore(uiStore) {
  const next = uiStore.$state;
  state.ui.artifactSessionFilter = next.artifactSessionFilter;
  state.ui.logsPage = next.logsPage;
  state.ui.logsPerPage = next.logsPerPage;
  state.ui.logSearch = next.logSearch;
  state.ui.quickJumpQuery = next.quickJumpQuery;
  state.ui.selectedArtifacts = { ...next.selectedArtifacts };
}

function bindSessionsMirror() {
  const sessionsStore = getSessionsStore();
  if (!sessionsStore) {
    return;
  }
  syncSessionsFromStore(sessionsStore);
  sessionsStore.$subscribe(() => {
    syncSessionsFromStore(sessionsStore);
    render();
  });
}

function syncSessionsFromStore(sessionsStore) {
  state.filters = { ...sessionsStore.$state.filters };
}

function bindSettingsMirror() {
  const settingsStore = getSettingsStore();
  if (!settingsStore) {
    return;
  }
  syncSettingsFromStore(settingsStore);
  settingsStore.$subscribe(() => {
    syncSettingsFromStore(settingsStore);
    render();
  });
}

function syncSettingsFromStore(settingsStore) {
  state.ui.artifactHistory = { ...settingsStore.$state.artifactHistory };
}

function reportBootstrapError(error) {
  const message =
    error instanceof Error ? error.message : "Failed to load console data";
  setNotice(message);
  if (typeof console !== "undefined" && typeof console.error === "function") {
    console.error("Bootstrap failed:", error);
  }
}

function bindGlobalErrorHandlers() {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    setNotice(message);
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("Unhandled rejection:", reason);
    }
  });
  window.addEventListener("error", (event) => {
    if (event.error instanceof Error) {
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error("Unhandled error:", event.error);
      }
    }
  });
}

async function bootstrap() {
  await refreshData();
  startConsoleDataSubscription();
  startRelativeTimeTicker();
}

async function refreshData() {
  state.data = mergeLogStateIntoDataset(await loadConsoleData());
  syncArtifactHistoryState(state.data.settings.artifactHistory);
  render();
}

function bindGlobalEvents() {
  const eventRoot = root instanceof HTMLElement ? root : document;

  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerUp);
  window.addEventListener("resize", handleWindowResize);
  eventRoot.addEventListener("click", handleClick);
  eventRoot.addEventListener("pointerdown", handlePointerDown);
  eventRoot.addEventListener("input", handleInput);
  eventRoot.addEventListener("change", handleInput);
  document.addEventListener("keydown", handleKeyDown);
  eventRoot.addEventListener("scroll", handleScroll, true);
  eventRoot.addEventListener("toggle", handleToggle, true);
}

function handlePageHide() {
  stopConsoleDataSubscription();
  stopLiveLogSubscription();
  if (liveLogRenderFrame) {
    window.cancelAnimationFrame(liveLogRenderFrame);
    liveLogRenderFrame = 0;
  }
  window.clearInterval(relativeTimeTimer);
  relativeTimeTimer = 0;
}

function handleRouteChange(pathname = window.location.pathname) {
  stopArtifactResize({ commit: true });
  state.route = parseRoute(pathname);
  if (state.route.name !== "logs") {
    state.ui.logSearch = "";
  }
  render();
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest("a[data-link]");
  if (link) {
    event.preventDefault();
    state.ui.quickJumpQuery = "";
    navigate(link.getAttribute("href"));
    return;
  }

  const actionTarget = target?.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const { action, sessionId, filename } = actionTarget.dataset;

  switch (action) {
    case "copy":
      copyToClipboard(actionTarget.dataset.copy);
      break;
    case "copy-log-content":
      copyCurrentLogContent(filename);
      break;
    case "open-session":
      navigate(buildSessionPath(sessionId));
      break;
    case "focus-session-logs": {
      const logsPanel = document.getElementById("session-logs-panel");
      if (logsPanel instanceof HTMLElement) {
        logsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      break;
    }
    case "reconnect-live-log": {
      const session = getSessionById(state.route.sessionId);
      if (session?.artifacts.liveLogs) {
        stopLiveLogSubscription();
        state.ui.liveLogs = {
          ...state.ui.liveLogs,
          error: "",
          message: "Connecting to live log stream.",
          sessionId: session.id,
          status: "connecting",
        };
        ensureLiveLogSubscription(session);
        render();
      }
      break;
    }
    case "retry-log-file":
      if (filename) {
        delete state.ui.logFiles[filename];
        void ensureLogFileLoaded(filename);
        render();
      }
      break;
    case "terminate-session":
      if (sessionId) {
        void terminateSessionFromUi(sessionId);
      }
      break;
    case "jump-log-end": {
      const viewer = getCurrentLogViewer();
      if (viewer) {
        state.ui.liveLogs.autoScroll = true;
        viewer.scrollTop = viewer.scrollHeight;
      }
      break;
    }
    default:
      break;
  }
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.dataset.input) {
    return;
  }

  switch (target.dataset.input) {
    default:
      break;
  }
}

function syncArtifactHistoryState(settings) {
  const nextSettings = settings || {
    available: false,
    enabled: false,
    reason: "Artifact history settings unavailable",
    retentionDays: 7,
  };
  const settingsStore = getSettingsStore();
  if (!settingsStore) {
    return;
  }
  const draft = settingsStore.$state.artifactHistory;
  if (!draft.loaded || !draft.dirty) {
    settingsStore.syncFromBackend({
      enabled: nextSettings.enabled,
      retentionDays: nextSettings.retentionDays,
    });
  }
}

async function saveArtifactHistorySettingsFromUi() {
  const settingsStore = getSettingsStore();
  if (!settingsStore) {
    return;
  }
  const draft = settingsStore.$state.artifactHistory;
  const retentionInput = draft.draftRetentionDays.trim();
  if (!/^\d+$/.test(retentionInput)) {
    settingsStore.setHistoryError("Retention days must be a whole number.");
    return;
  }

  const nextRetentionDays = Number.parseInt(retentionInput, 10);
  if (nextRetentionDays < 1 || nextRetentionDays > 365) {
    settingsStore.setHistoryError("Retention days must stay between 1 and 365.");
    return;
  }

  settingsStore.setHistorySaving(true);
  settingsStore.setHistoryError("");

  try {
    await saveArtifactHistorySettings({
      enabled: draft.draftEnabled,
      retentionDays: nextRetentionDays,
    });
    settingsStore.syncFromBackend({
      enabled: draft.draftEnabled,
      retentionDays: nextRetentionDays,
    });
    await refreshData();
    setNotice("Artifact history settings saved");
  } catch (error) {
    settingsStore.setHistoryError(
      error instanceof Error ? error.message : "Artifact history settings update failed",
    );
  } finally {
    settingsStore.setHistorySaving(false);
  }
}

async function terminateSessionFromUi(sessionId) {
  const session = getSessionById(sessionId);
  if (!session || state.ui.terminatingSessionId === sessionId) {
    return;
  }

  const confirmed =
    typeof window.confirm === "function"
      ? window.confirm(`Terminate session ${session.name}?`)
      : true;

  if (!confirmed) {
    return;
  }

  state.ui.terminatingSessionId = sessionId;
  render();

  try {
    await terminateSession(sessionId, session.protocol);

    if (state.ui.liveLogs.sessionId === sessionId) {
      stopLiveLogSubscription();
    }

    removeSessionFromCurrentDataset(sessionId);

    if (state.route.name === "session-detail" && state.route.sessionId === sessionId) {
      navigate("/sessions", { replace: true });
    }

    setNotice("Session terminated");
    void refreshDataAfterTerminate();
  } catch (error) {
    setNotice(error instanceof Error ? error.message : "Session terminate failed");
  } finally {
    state.ui.terminatingSessionId = "";
    render();
  }
}

async function refreshDataAfterTerminate() {
  try {
    await refreshData();
  } catch (error) {
    setNotice(error instanceof Error ? error.message : "Session refresh failed");
  }
}

function removeSessionFromCurrentDataset(sessionId) {
  state.data = {
    ...state.data,
    sessions: state.data.sessions.filter((session) => session.id !== sessionId),
  };
}

function handleToggle(event) {
  if (suppressDisclosureTracking) {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLDetailsElement)) {
    return;
  }

  const disclosureId = target.dataset.persistId;
  if (!disclosureId) {
    return;
  }

  state.ui.detailDisclosures[disclosureId] = target.open;
}

function handleScroll(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.matches("[data-live-log-viewer]")) {
    return;
  }

  state.ui.liveLogs.autoScroll = isViewerNearEnd(target);
}

function handleKeyDown(event) {
  const activeElement = document.activeElement;
  const splitter =
    event.target instanceof HTMLElement
      ? event.target.closest("[data-artifact-splitter]")
      : null;

  if (splitter instanceof HTMLElement && handleArtifactSplitterKeyDown(event, splitter)) {
    return;
  }

  const isTyping =
    activeElement instanceof HTMLElement &&
    (activeElement.tagName === "INPUT" ||
      activeElement.tagName === "TEXTAREA" ||
      activeElement.tagName === "SELECT" ||
      activeElement.isContentEditable);

  if (event.key === "/" && !isTyping) {
    event.preventDefault();
    const quickJumpInput = document.querySelector('[data-input="quick-jump"]');
    if (quickJumpInput instanceof HTMLInputElement) {
      quickJumpInput.focus();
      quickJumpInput.select();
    }
    return;
  }

  if (state.ui.quickJumpQuery && event.key === "Escape") {
    state.ui.quickJumpQuery = "";
    render();
    return;
  }

  if (activeElement instanceof HTMLInputElement && activeElement.dataset.input === "quick-jump" && event.key === "Enter") {
    const firstResult = state.ui.quickJumpResults[0];
    if (firstResult) {
      state.ui.quickJumpQuery = "";
      navigate(firstResult.path);
      event.preventDefault();
    }
    return;
  }

  if (isTyping || state.route.name !== "sessions") {
    return;
  }

  const filteredSessions = getFilteredSessionsForState(state.data.sessions, state.filters);
  if (!filteredSessions.length) {
    return;
  }

  const selectedIndex = Math.max(
    0,
    filteredSessions.findIndex((session) => session.id === state.ui.selectedSessionId),
  );

  if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") {
    event.preventDefault();
    const nextIndex = Math.min(selectedIndex + 1, filteredSessions.length - 1);
    state.ui.selectedSessionId = filteredSessions[nextIndex].id;
    render({ focusSelectedSession: true });
  }

  if (event.key === "ArrowUp" || event.key.toLowerCase() === "k") {
    event.preventDefault();
    const nextIndex = Math.max(selectedIndex - 1, 0);
    state.ui.selectedSessionId = filteredSessions[nextIndex].id;
    render({ focusSelectedSession: true });
  }

  if (event.key === "Enter") {
    event.preventDefault();
    navigate(buildSessionPath(filteredSessions[selectedIndex].id));
  }
}

function render(options = {}) {
  reconcileLiveLogState();
  syncSelections();
  state.ui.quickJumpResults = buildQuickJumpResults();
  document.title = getPageTitle(state.route.name);

  if (!(root instanceof HTMLElement)) {
    return;
  }

  const focusedTextInput = options.focusSelectedSession ? null : captureFocusedTextInput();
  const logViewerSnapshot = options.focusSelectedSession ? null : captureLogViewerSnapshot();
  const currentRenderVersion = ++renderVersion;

  void updateConsoleShell(createShellSnapshot()).then(() => {
    if (!(root instanceof HTMLElement) || currentRenderVersion !== renderVersion) {
      return;
    }

    suppressDisclosureTracking = true;
    try {
      syncArtifactPaneLayout(root);
      restorePersistedDetails(root);
    } finally {
      suppressDisclosureTracking = false;
    }

    if (options.focusSelectedSession) {
      const selectedRow = root.querySelector(".session-row.selected");
      if (selectedRow instanceof HTMLElement) {
        selectedRow.focus();
      }
      return;
    }

    restoreFocusedTextInput(root, focusedTextInput);
    restoreLogViewerSnapshot(root, logViewerSnapshot);
    syncLogEffects(root);
    syncRelativeTimeLabels(root);
  });
}

function handlePointerDown(event) {
  if (event.button !== 0 || !isArtifactDesktopMode()) {
    return;
  }

  const splitter =
    event.target instanceof HTMLElement
      ? event.target.closest("[data-artifact-splitter]")
      : null;

  if (!(splitter instanceof HTMLElement)) {
    return;
  }

  const layout = splitter.closest("[data-artifact-layout]");
  if (!(layout instanceof HTMLElement)) {
    return;
  }

  const pageKey = layout.dataset.artifactPage;
  if (!pageKey || !artifactPageKeys.has(pageKey)) {
    return;
  }

  const metrics = measureArtifactPaneBounds(layout);
  if (!metrics) {
    return;
  }

  const drawerWidth = getCurrentDrawerWidth(layout, pageKey, metrics);

  event.preventDefault();
  stopArtifactResize({ commit: true });

  artifactResizeState = {
    drawerWidth,
    layout,
    metrics,
    pageKey,
    pointerId: event.pointerId,
    splitter,
  };

  splitter.dataset.active = "true";
  splitter.focus({ preventScroll: true });
  document.documentElement.classList.add("artifact-resize-active");
}

function handlePointerMove(event) {
  if (!artifactResizeState || event.pointerId !== artifactResizeState.pointerId) {
    return;
  }

  const { layout, pageKey, splitter } = artifactResizeState;
  if (!(layout instanceof HTMLElement) || !layout.isConnected || !isArtifactDesktopMode()) {
    stopArtifactResize({ commit: false });
    return;
  }

  const metrics = measureArtifactPaneBounds(layout);
  if (!metrics) {
    return;
  }

  const splitterCenter = event.clientX - metrics.layoutLeft;
  const rawIndexWidth = splitterCenter - artifactSplitterWidth / 2;
  const rawDrawerWidth = metrics.availableWidth - rawIndexWidth;
  const drawerWidth = clampDrawerWidth(rawDrawerWidth, metrics);

  artifactResizeState.drawerWidth = drawerWidth;
  artifactResizeState.metrics = metrics;

  applyArtifactPaneWidths(layout, splitter, drawerWidth, metrics);
  state.preferences.artifactPaneWidths[pageKey] = drawerWidth / metrics.availableWidth;

  event.preventDefault();
}

function handlePointerUp(event) {
  if (!artifactResizeState || event.pointerId !== artifactResizeState.pointerId) {
    return;
  }

  stopArtifactResize({ commit: true });
}

function handleWindowResize() {
  if (artifactResizeState) {
    stopArtifactResize({ commit: true });
  }
  syncArtifactPaneLayout(document);
}

function handleArtifactSplitterKeyDown(event, splitter) {
  if (!isArtifactDesktopMode()) {
    return false;
  }

  const layout = splitter.closest("[data-artifact-layout]");
  if (!(layout instanceof HTMLElement)) {
    return false;
  }

  const pageKey = layout.dataset.artifactPage;
  if (!pageKey || !artifactPageKeys.has(pageKey)) {
    return false;
  }

  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    return false;
  }

  const metrics = measureArtifactPaneBounds(layout);
  if (!metrics) {
    return false;
  }

  const currentDrawerWidth = getCurrentDrawerWidth(layout, pageKey, metrics);
  let nextDrawerWidth = currentDrawerWidth;

  if (event.key === "ArrowLeft") {
    nextDrawerWidth = currentDrawerWidth + artifactKeyboardStep;
  }

  if (event.key === "ArrowRight") {
    nextDrawerWidth = currentDrawerWidth - artifactKeyboardStep;
  }

  if (event.key === "Home") {
    nextDrawerWidth = metrics.minDrawerWidth;
  }

  if (event.key === "End") {
    nextDrawerWidth = metrics.maxDrawerWidth;
  }

  const clampedDrawerWidth = clampDrawerWidth(nextDrawerWidth, metrics);
  applyArtifactPaneWidths(layout, splitter, clampedDrawerWidth, metrics);
  state.preferences.artifactPaneWidths[pageKey] = persistArtifactPaneRatio(
    pageKey,
    clampedDrawerWidth,
    metrics.availableWidth,
  );

  event.preventDefault();
  return true;
}

function syncArtifactPaneLayout(root) {
  const layouts = root.querySelectorAll("[data-artifact-layout]");
  for (const layout of layouts) {
    if (!(layout instanceof HTMLElement)) {
      continue;
    }

    const pageKey = layout.dataset.artifactPage;
    if (!pageKey || !artifactPageKeys.has(pageKey)) {
      continue;
    }

    const splitter = layout.querySelector("[data-artifact-splitter]");
    if (!(splitter instanceof HTMLElement)) {
      continue;
    }

    if (!isArtifactDesktopMode()) {
      layout.style.removeProperty("--artifact-index-width");
      layout.style.removeProperty("--artifact-drawer-width");
      updateArtifactSplitterAria(
        splitter,
        state.preferences.artifactPaneWidths[pageKey] ?? 0.37,
        0.2,
        0.8,
      );
      continue;
    }

    const metrics = measureArtifactPaneBounds(layout);
    if (!metrics) {
      continue;
    }

    const preferredRatio = state.preferences.artifactPaneWidths[pageKey] ?? 0.37;
    const clampedDrawerWidth = clampDrawerWidth(
      preferredRatio * metrics.availableWidth,
      metrics,
    );

    applyArtifactPaneWidths(layout, splitter, clampedDrawerWidth, metrics);
  }
}

function stopArtifactResize({ commit }) {
  if (!artifactResizeState) {
    return;
  }

  const { drawerWidth, layout, metrics, pageKey, splitter } = artifactResizeState;

  splitter.removeAttribute("data-active");
  document.documentElement.classList.remove("artifact-resize-active");

  if (
    commit &&
    layout instanceof HTMLElement &&
    layout.isConnected &&
    pageKey &&
    artifactPageKeys.has(pageKey)
  ) {
    const nextMetrics = measureArtifactPaneBounds(layout) || metrics;
    if (nextMetrics) {
      const finalDrawerWidth = clampDrawerWidth(drawerWidth, nextMetrics);
      applyArtifactPaneWidths(layout, splitter, finalDrawerWidth, nextMetrics);
      state.preferences.artifactPaneWidths[pageKey] = persistArtifactPaneRatio(
        pageKey,
        finalDrawerWidth,
        nextMetrics.availableWidth,
      );
    }
  }

  artifactResizeState = null;
}

function persistArtifactPaneRatio(pageKey, drawerWidth, availableWidth) {
  if (!availableWidth) {
    return state.preferences.artifactPaneWidths[pageKey] ?? 0.37;
  }

  const ratio = drawerWidth / availableWidth;
  return saveArtifactPaneWidth(pageKey, ratio);
}

function measureArtifactPaneBounds(layout) {
  const layoutRect = layout.getBoundingClientRect();
  const availableWidth = layout.clientWidth - artifactSplitterWidth;

  if (availableWidth <= 0) {
    return null;
  }

  const minDrawerWidth = Math.min(artifactMinDrawerWidth, availableWidth);
  const maxDrawerWidth = Math.max(minDrawerWidth, availableWidth - artifactMinIndexWidth);

  return {
    availableWidth,
    layoutLeft: layoutRect.left,
    maxDrawerWidth,
    minDrawerWidth,
  };
}

function clampDrawerWidth(width, metrics) {
  return Math.min(metrics.maxDrawerWidth, Math.max(metrics.minDrawerWidth, width));
}

function getCurrentDrawerWidth(layout, pageKey, metrics) {
  const inlineWidth = Number.parseFloat(
    layout.style.getPropertyValue("--artifact-drawer-width"),
  );

  if (Number.isFinite(inlineWidth)) {
    return clampDrawerWidth(inlineWidth, metrics);
  }

  const ratio = state.preferences.artifactPaneWidths[pageKey] ?? 0.37;
  return clampDrawerWidth(metrics.availableWidth * ratio, metrics);
}

function applyArtifactPaneWidths(layout, splitter, drawerWidth, metrics) {
  const normalizedDrawerWidth = clampDrawerWidth(drawerWidth, metrics);
  const indexWidth = Math.max(0, metrics.availableWidth - normalizedDrawerWidth);
  const ratio = normalizedDrawerWidth / metrics.availableWidth;
  const minRatio = metrics.minDrawerWidth / metrics.availableWidth;
  const maxRatio = metrics.maxDrawerWidth / metrics.availableWidth;

  layout.style.setProperty("--artifact-index-width", `${indexWidth}px`);
  layout.style.setProperty("--artifact-drawer-width", `${normalizedDrawerWidth}px`);
  updateArtifactSplitterAria(splitter, ratio, minRatio, maxRatio);
}

function updateArtifactSplitterAria(splitter, ratio, minRatio, maxRatio) {
  splitter.setAttribute("aria-valuemin", String(Math.round(minRatio * 100)));
  splitter.setAttribute("aria-valuemax", String(Math.round(maxRatio * 100)));
  splitter.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
}

function isArtifactDesktopMode() {
  return window.innerWidth > artifactDesktopBreakpoint;
}

function isArtifactRoute(routeName) {
  return artifactPageKeys.has(routeName);
}

function isOperationsRoute(routeName) {
  return operationsPageKeys.has(routeName);
}

function createShellSnapshot() {
  return {
    artifactPage: isArtifactRoute(state.route.name) ? createArtifactPageSnapshot(state.route.name) : null,
    notice: state.ui.notice,
    operationsPage: isOperationsRoute(state.route.name) ? createOperationsPageSnapshot(state.route.name) : null,
    pageTitle: getPageTitle(state.route.name),
    preferences: {
      ...state.preferences,
      artifactPaneWidths: { ...(state.preferences.artifactPaneWidths || {}) },
    },
    quickJumpQuery: state.ui.quickJumpQuery,
    quickJumpResults: state.ui.quickJumpResults.map((result) => ({ ...result })),
    routeName: state.route.name,
    sessionDetailPage: state.route.name === "session-detail" ? createSessionDetailPageSnapshot() : null,
    sessionsPage: state.route.name === "sessions" ? createSessionsPageSnapshot() : null,
  };
}

function createOperationsPageSnapshot(routeName) {
  return {
    artifactHistoryUi: { ...state.ui.artifactHistory },
    browsers: [...state.data.browsers],
    configuration: state.data.configuration,
    connection: state.data.connection,
    preferences: {
      ...state.preferences,
      artifactPaneWidths: { ...(state.preferences.artifactPaneWidths || {}) },
    },
    routeName,
    settings: {
      artifactHistory: { ...state.data.settings.artifactHistory },
    },
    system: state.data.system,
  };
}

function createArtifactPageSnapshot(pageKey) {
  return {
    artifactSessionFilter: state.ui.artifactSessionFilter,
    downloads: [...state.data.downloads],
    logFiles: Object.fromEntries(
      Object.entries(state.ui.logFiles).map(([filename, logState]) => [
        filename,
        { ...logState },
      ]),
    ),
    logs: [...state.data.logs],
    logsPage: state.ui.logsPage,
    logsPerPage: state.ui.logsPerPage,
    logSearch: state.ui.logSearch,
    pageKey,
    preferences: {
      artifactPaneWidths: { ...(state.preferences.artifactPaneWidths || {}) },
      timeFormat: state.preferences.timeFormat,
      timezone: state.preferences.timezone,
    },
    selectedArtifacts: { ...state.ui.selectedArtifacts },
    sessions: [...state.data.sessions],
    videos: [...state.data.videos],
  };
}

function createSessionDetailPageSnapshot() {
  return {
    liveLogs: { ...state.ui.liveLogs },
    logFiles: Object.fromEntries(
      Object.entries(state.ui.logFiles).map(([filename, logState]) => [
        filename,
        { ...logState },
      ]),
    ),
    logSearch: state.ui.logSearch,
    logs: [...state.data.logs],
    preferences: {
      timeFormat: state.preferences.timeFormat,
      timezone: state.preferences.timezone,
    },
    routeSessionId: state.route.sessionId,
    session: getSessionById(state.route.sessionId),
    terminatingSessionId: state.ui.terminatingSessionId,
  };
}

function createSessionsPageSnapshot() {
  return {
    filters: { ...state.filters },
    preferences: {
      timeFormat: state.preferences.timeFormat,
      timezone: state.preferences.timezone,
    },
    selectedSessionId: state.ui.selectedSessionId,
    sessions: [...state.data.sessions],
  };
}

function getPageTitle(routeName) {
  const titles = {
    browsers: "Browsers",
    configuration: "Configuration",
    downloads: "Downloads",
    logs: "Logs",
    "not-found": "Not found",
    "session-detail": "Session Details",
    sessions: "Sessions",
    settings: "Settings",
    system: "System",
    videos: "Videos",
  };

  return titles[routeName] || "Selenwright";
}

function syncSelections() {
  if (state.route.name === "session-detail") {
    state.ui.selectedSessionId = state.route.sessionId;
  }

  if (state.route.name === "sessions") {
    const filteredSessions = getFilteredSessionsForState(state.data.sessions, state.filters);
    if (!filteredSessions.find((session) => session.id === state.ui.selectedSessionId)) {
      state.ui.selectedSessionId = filteredSessions[0]?.id || null;
    }
  }

  for (const [pageKey, datasetKey] of [
    ["videos", "videos"],
    ["logs", "logs"],
    ["downloads", "downloads"],
  ]) {
    const items = state.data[datasetKey].filter((item) =>
      state.ui.artifactSessionFilter ? item.sessionId === state.ui.artifactSessionFilter : true,
    );
    if (!items.find((item) => item.filename === state.ui.selectedArtifacts[pageKey])) {
      state.ui.selectedArtifacts[pageKey] = items[0]?.filename || null;
    }
  }
}

function buildQuickJumpResults() {
  const query = state.ui.quickJumpQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }

  const pageResults = navGroups
    .flatMap((group) => group.items)
    .map((item) => ({
      kind: "Page",
      meta: item.href,
      path: item.href,
      title: item.label,
    }))
    .filter((entry) => entry.title.toLowerCase().includes(query) || entry.meta.toLowerCase().includes(query));

  const sessionResults = state.data.sessions
    .filter((session) => {
      const haystack = `${session.name} ${session.id} ${session.browser} ${formatStatus(session.status)}`.toLowerCase();
      return haystack.includes(query);
    })
    .map((session) => ({
      kind: "Session",
      meta: `${session.browser} · ${formatStatus(session.status)}`,
      path: buildSessionPath(session.id),
      title: session.name,
    }));

  return [...pageResults, ...sessionResults].slice(0, 8);
}

async function copyToClipboard(value) {
  const normalizedValue = String(value ?? "");

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(normalizedValue);
      setNotice("Copied to clipboard");
      return true;
    }
  } catch {
    // Fall back to a selection-based copy path when clipboard APIs are unavailable.
  }

  if (copyUsingFallback(normalizedValue)) {
    setNotice("Copied to clipboard");
    return true;
  }

  setNotice("Clipboard write failed");
  return false;
}

function copyUsingFallback(value) {
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const input = document.createElement("textarea");
  input.setAttribute("aria-hidden", "true");
  input.readOnly = true;
  input.value = value;
  input.style.left = "0";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  input.style.position = "fixed";
  input.style.top = "0";

  document.body.append(input);

  try {
    input.focus({ preventScroll: true });
    input.select();
    input.setSelectionRange(0, input.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
    activeElement?.focus({ preventScroll: true });
  }
}

function setNotice(message) {
  window.clearTimeout(noticeTimeout);
  state.ui.notice = message;
  render();
  noticeTimeout = window.setTimeout(() => {
    state.ui.notice = "";
    render();
  }, 1800);
}

function captureFocusedTextInput() {
  const activeElement = document.activeElement;
  if (!isRestorableTextInput(activeElement)) {
    return null;
  }

  const selectionStart = activeElement.selectionStart ?? activeElement.value.length;
  const selectionEnd = activeElement.selectionEnd ?? selectionStart;

  return {
    inputName: activeElement.dataset.input,
    scrollLeft: activeElement.scrollLeft,
    selectionDirection: activeElement.selectionDirection ?? "none",
    selectionEnd,
    selectionStart,
  };
}

function restoreFocusedTextInput(root, snapshot) {
  if (!snapshot) {
    return;
  }

  const nextInput = root.querySelector(`[data-input="${snapshot.inputName}"]`);
  if (!isRestorableTextInput(nextInput)) {
    return;
  }

  const maxOffset = nextInput.value.length;
  const selectionStart = Math.min(snapshot.selectionStart, maxOffset);
  const selectionEnd = Math.min(snapshot.selectionEnd, maxOffset);

  nextInput.focus({ preventScroll: true });
  nextInput.setSelectionRange(selectionStart, selectionEnd, snapshot.selectionDirection);
  nextInput.scrollLeft = snapshot.scrollLeft;
}

function restorePersistedDetails(root) {
  const persistedDetails = root.querySelectorAll("details[data-persist-id]");
  for (const detail of persistedDetails) {
    if (!(detail instanceof HTMLDetailsElement)) {
      continue;
    }

    const disclosureId = detail.dataset.persistId;
    if (!disclosureId || !(disclosureId in state.ui.detailDisclosures)) {
      continue;
    }

    detail.open = state.ui.detailDisclosures[disclosureId];
  }
}

function createInitialLiveLogState() {
  return {
    autoScroll: true,
    content: "",
    error: "",
    message: "Select a running session to stream logs.",
    sessionId: "",
    source: "none",
    status: "idle",
  };
}

function reconcileLiveLogState() {
  const liveState = state.ui.liveLogs;
  if (!liveState.sessionId) {
    return;
  }

  const trackedSession = getSessionById(liveState.sessionId);
  const routeSession =
    state.route.name === "session-detail" ? getSessionById(state.route.sessionId) : null;

  if (liveLogSubscription && (!trackedSession?.artifacts.liveLogs || routeSession?.id !== liveState.sessionId)) {
    stopLiveLogSubscription();
  }

  if (!trackedSession || !trackedSession.artifacts.liveLogs) {
    if (liveState.status !== "inactive") {
      state.ui.liveLogs = {
        ...liveState,
        error: "",
        message: "Session is no longer active.",
        status: "inactive",
      };
    }
  }
}

function mergeLogStateIntoDataset(dataset) {
  for (const log of dataset.logs) {
    const cached = state.ui.logFiles[log.filename];
    if (!cached) {
      continue;
    }

    log.content = cached.content;
    log.contentError = cached.error;
    log.contentLoaded = cached.loaded;
  }

  return dataset;
}

function syncLogEffects(root) {
  void ensureSavedLogLoadedForCurrentRoute();

  const liveSession = getSessionDetailLiveLogSession();
  if (liveSession) {
    ensureLiveLogSubscription(liveSession);
    syncLiveLogViewerPosition(root);
    return;
  }

  stopLiveLogSubscription();
}

function startConsoleDataSubscription() {
  if (consoleDataSubscription) {
    return;
  }

  try {
    consoleDataSubscription = subscribeToConsoleData({
      onDataset(nextDataset) {
        state.data = mergeLogStateIntoDataset(nextDataset);
        syncArtifactHistoryState(state.data.settings.artifactHistory);
        render();
      },
    });
  } catch {
    consoleDataSubscription = null;
  }
}

function stopConsoleDataSubscription() {
  if (!consoleDataSubscription) {
    return;
  }

  consoleDataSubscription.close();
  consoleDataSubscription = null;
}

async function ensureSavedLogLoadedForCurrentRoute() {
  if (state.route.name === "session-detail") {
    return;
  }

  const filename = getCurrentSavedLogFilename();
  if (!filename) {
    return;
  }

  await ensureLogFileLoaded(filename);
}

async function ensureLogFileLoaded(filename) {
  const existing = getLogFileState(filename);
  if (!filename || existing.loading || existing.loaded || existing.error) {
    return;
  }

  state.ui.logFiles[filename] = {
    content: existing.content,
    error: "",
    loaded: false,
    loading: true,
  };
  render();

  try {
    const content = await loadLogFileContent(filename);
    state.ui.logFiles[filename] = {
      content,
      error: "",
      loaded: true,
      loading: false,
    };
  } catch (error) {
    state.ui.logFiles[filename] = {
      content: existing.content,
      error: error instanceof Error ? error.message : "Failed to load log file",
      loaded: false,
      loading: false,
    };
  }

  render();
}

function ensureLiveLogSubscription(session) {
  if (!session?.artifacts.liveLogs) {
    return;
  }

  if (liveLogSubscription && state.ui.liveLogs.sessionId === session.id) {
    return;
  }

  stopLiveLogSubscription();

  state.ui.liveLogs = {
    ...createInitialLiveLogState(),
    autoScroll: state.ui.liveLogs.sessionId === session.id ? state.ui.liveLogs.autoScroll : true,
    content: state.ui.liveLogs.sessionId === session.id ? state.ui.liveLogs.content : "",
    message: "Connecting to live log stream.",
    sessionId: session.id,
    source: "live",
    status: "connecting",
  };

  const token = ++liveLogSubscriptionToken;
  liveLogSubscription = subscribeToLiveLogs(session.id, {
    onChunk(chunk) {
      if (token !== liveLogSubscriptionToken) {
        return;
      }

      appendLiveLogChunk(session.id, chunk);
    },
    onError(error) {
      if (token !== liveLogSubscriptionToken) {
        return;
      }

      state.ui.liveLogs = {
        ...state.ui.liveLogs,
        error: error instanceof Error ? error.message : "Live log stream unavailable",
      };
      queueLiveLogRender();
    },
    onStatusChange(nextStatus) {
      if (token !== liveLogSubscriptionToken) {
        return;
      }

      state.ui.liveLogs = {
        ...state.ui.liveLogs,
        error:
          nextStatus.status === "open" || nextStatus.status === "streaming"
            ? ""
            : state.ui.liveLogs.error,
        message: nextStatus.message,
        sessionId: session.id,
        source: "live",
        status: nextStatus.status,
      };
      render();
    },
  });
}

function stopLiveLogSubscription() {
  if (!liveLogSubscription) {
    return;
  }

  liveLogSubscriptionToken += 1;
  const subscription = liveLogSubscription;
  liveLogSubscription = null;
  subscription.close();
}

function appendLiveLogChunk(sessionId, chunk) {
  if (!chunk) {
    return;
  }

  if (state.ui.liveLogs.sessionId !== sessionId) {
    state.ui.liveLogs = {
      ...createInitialLiveLogState(),
      content: chunk,
      message: "Streaming live log output.",
      sessionId,
      source: "live",
      status: "streaming",
    };
  } else {
    state.ui.liveLogs.content += chunk;
    state.ui.liveLogs.error = "";
    state.ui.liveLogs.status = "streaming";
    state.ui.liveLogs.message = "Streaming live log output.";
  }

  queueLiveLogRender();
}

function queueLiveLogRender() {
  if (liveLogRenderFrame) {
    return;
  }

  liveLogRenderFrame = window.requestAnimationFrame(() => {
    liveLogRenderFrame = 0;
    render();
  });
}

function getCurrentSavedLogFilename() {
  if (state.route.name === "logs") {
    return state.ui.selectedArtifacts.logs;
  }

  if (state.route.name !== "session-detail") {
    return "";
  }

  const session = getSessionById(state.route.sessionId);
  if (!session?.artifacts.savedLogs || session.artifacts.liveLogs) {
    return "";
  }

  return session.metadata.logFilename || "";
}

function getSessionDetailLiveLogSession() {
  if (state.route.name !== "session-detail") {
    return null;
  }

  const session = getSessionById(state.route.sessionId);
  return session?.artifacts.liveLogs ? session : null;
}

function getLogFileState(filename) {
  return state.ui.logFiles[filename] || {
    content: "",
    error: "",
    loaded: false,
    loading: false,
  };
}

function getSessionById(sessionId) {
  return state.data.sessions.find((session) => session.id === sessionId) || null;
}

function copyCurrentLogContent(filename) {
  const logContent = filename ? getLogFileState(filename).content : state.ui.liveLogs.content;
  if (!logContent) {
    setNotice("No log content available");
    return;
  }

  void copyToClipboard(logContent);
}

function captureLogViewerSnapshot() {
  const viewer = getCurrentLogViewer();
  if (!(viewer instanceof HTMLElement)) {
    return null;
  }

  return {
    scrollLeft: viewer.scrollLeft,
    scrollTop: viewer.scrollTop,
  };
}

function restoreLogViewerSnapshot(root, snapshot) {
  if (!snapshot) {
    return;
  }

  const viewer = root.querySelector("[data-log-viewer]");
  if (!(viewer instanceof HTMLElement)) {
    return;
  }

  viewer.scrollLeft = snapshot.scrollLeft;
  viewer.scrollTop = snapshot.scrollTop;
}

function syncLiveLogViewerPosition(root) {
  if (!state.ui.liveLogs.autoScroll) {
    return;
  }

  const viewer = root.querySelector("[data-live-log-viewer]");
  if (!(viewer instanceof HTMLElement)) {
    return;
  }

  viewer.scrollTop = viewer.scrollHeight;
}

function getCurrentLogViewer() {
  return document.querySelector("[data-log-viewer]");
}

function startRelativeTimeTicker() {
  if (relativeTimeTimer) {
    return;
  }

  syncRelativeTimeLabels(document);
  relativeTimeTimer = window.setInterval(() => {
    syncRelativeTimeLabels(document);
  }, 1000);
}

function syncRelativeTimeLabels(root) {
  syncDurationLabels(root);
  syncTimeAgoLabels(root);
}

function syncDurationLabels(root) {
  const durationNodes = root.querySelectorAll("[data-duration-started-at]");
  const now = Date.now();

  for (const node of durationNodes) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const startedAt = Date.parse(node.dataset.durationStartedAt || "");
    if (!Number.isFinite(startedAt)) {
      continue;
    }

    const finishedAt = node.dataset.durationFinishedAt ? Date.parse(node.dataset.durationFinishedAt) : now;
    const durationMs = Math.max(0, (Number.isFinite(finishedAt) ? finishedAt : now) - startedAt);
    node.textContent = formatDuration(durationMs);
  }
}

function syncTimeAgoLabels(root) {
  const relativeTimeNodes = root.querySelectorAll("[data-time-ago]");
  const now = Date.now();

  for (const node of relativeTimeNodes) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const value = node.dataset.timeAgo;
    if (!value) {
      continue;
    }

    node.textContent = timeAgo(value, now);
  }
}

function isViewerNearEnd(viewer) {
  return viewer.scrollHeight - (viewer.scrollTop + viewer.clientHeight) <= 24;
}

function isRestorableTextInput(element) {
  if (element instanceof HTMLTextAreaElement) {
    return Boolean(element.dataset.input);
  }

  return element instanceof HTMLInputElement && Boolean(element.dataset.input) && restorableTextInputTypes.has(element.type);
}

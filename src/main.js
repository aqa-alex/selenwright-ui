import { renderLayout } from "./components/layout.js";
import { createMockDataset } from "./data/mock-data.js";
import { loadConsoleData } from "./data/service.js";
import { formatStatus } from "./lib/format.js";
import {
  applyDensity,
  applyPreferences,
  applyTheme,
  loadPreferences,
  saveArtifactPaneWidth,
  savePreference,
  watchSystemTheme,
} from "./lib/preferences.js";
import { buildSessionPath, navGroups, navigate, parseRoute } from "./lib/router.js";
import { renderDownloadsPage, renderLogsPage, renderVideosPage } from "./pages/artifacts.js";
import { renderBrowsersPage, renderConfigurationPage, renderNotFoundPage, renderSettingsPage, renderSystemPage } from "./pages/operations.js";
import { getFilteredSessions, renderSessionDetailPage, renderSessionsPage } from "./pages/sessions.js";

const initialPreferences = loadPreferences();
const state = {
  data: createMockDataset(),
  filters: {
    activeOnly: false,
    browser: "all",
    protocol: "all",
    search: "",
    sort: "started",
    status: "all",
  },
  preferences: initialPreferences,
  route: parseRoute(window.location.pathname),
  ui: {
    artifactSessionFilter: "",
    logSearch: "",
    logWrap: initialPreferences.logWrap,
    notice: "",
    quickJumpQuery: "",
    quickJumpResults: [],
    selectedArtifacts: {
      downloads: null,
      logs: null,
      videos: null,
    },
    selectedSessionId: null,
  },
};

let noticeTimeout = 0;
const restorableTextInputTypes = new Set(["email", "password", "search", "tel", "text", "url"]);
const artifactPageKeys = new Set(["videos", "logs", "downloads"]);
const artifactDesktopBreakpoint = 1180;
const artifactSplitterWidth = 8;
const artifactMinIndexWidth = 420;
const artifactMinDrawerWidth = 360;
const artifactKeyboardStep = 24;

let artifactResizeState = null;

applyPreferences(state.preferences);
bindGlobalEvents();
render();
bootstrap();

watchSystemTheme(() => {
  if (state.preferences.themeMode === "system") {
    applyTheme("system");
  }
});

async function bootstrap() {
  state.data = await loadConsoleData();
  render();
}

function bindGlobalEvents() {
  window.addEventListener("popstate", handleRouteChange);
  window.addEventListener("selenwright:navigate", handleRouteChange);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerUp);
  window.addEventListener("resize", handleWindowResize);
  document.addEventListener("click", handleClick);
  document.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleInput);
  document.addEventListener("keydown", handleKeyDown);
}

function handleRouteChange() {
  stopArtifactResize({ commit: true });
  state.route = parseRoute(window.location.pathname);
  if (state.route.name !== "logs") {
    state.ui.logSearch = "";
  }
  render();
}

function handleClick(event) {
  const link = event.target.closest("a[data-link]");
  if (link) {
    event.preventDefault();
    state.ui.quickJumpQuery = "";
    navigate(link.getAttribute("href"));
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const { action, page, path, sessionId, sort, value, filename } = actionTarget.dataset;

  switch (action) {
    case "copy":
      copyToClipboard(actionTarget.dataset.copy);
      break;
    case "clear-artifact-session-filter":
      state.ui.artifactSessionFilter = "";
      render();
      break;
    case "open-artifact-page":
      state.ui.artifactSessionFilter = sessionId || "";
      navigate(`/artifacts/${page}`);
      break;
    case "open-quick-jump-result":
      state.ui.quickJumpQuery = "";
      navigate(path);
      break;
    case "open-session":
      navigate(buildSessionPath(sessionId));
      break;
    case "select-artifact":
      state.ui.selectedArtifacts[page] = filename;
      render();
      break;
    case "set-density":
      state.preferences.density = value;
      applyDensity(value);
      render();
      break;
    case "set-detail-panel":
      state.preferences.detailPanel = value;
      savePreference("detailPanel", value);
      render();
      break;
    case "set-log-wrap": {
      const wrapEnabled = value === "wrap";
      state.ui.logWrap = wrapEnabled;
      state.preferences.logWrap = wrapEnabled;
      savePreference("logWrap", wrapEnabled);
      render();
      break;
    }
    case "set-sort":
      state.filters.sort = sort;
      render();
      break;
    case "set-theme":
      state.preferences.themeMode = value;
      applyTheme(value);
      render();
      break;
    case "set-time-format":
      state.preferences.timeFormat = value;
      savePreference("timeFormat", value);
      render();
      break;
    case "set-timezone":
      state.preferences.timezone = value;
      savePreference("timezone", value);
      render();
      break;
    case "jump-log-end": {
      const viewer = document.getElementById("log-viewer-content");
      if (viewer) {
        viewer.scrollTop = viewer.scrollHeight;
      }
      break;
    }
    case "reset-session-filters":
      state.filters = {
        activeOnly: false,
        browser: "all",
        protocol: "all",
        search: "",
        sort: "started",
        status: "all",
      };
      render();
      break;
    default:
      break;
  }
}

function handleInput(event) {
  const target = event.target;
  if (!target.dataset.input) {
    return;
  }

  switch (target.dataset.input) {
    case "active-only":
      state.filters.activeOnly = target.checked;
      render();
      break;
    case "browser-filter":
      state.filters.browser = target.value;
      render();
      break;
    case "log-search":
      state.ui.logSearch = target.value;
      render();
      break;
    case "log-wrap":
      state.ui.logWrap = target.checked;
      state.preferences.logWrap = target.checked;
      savePreference("logWrap", target.checked);
      render();
      break;
    case "protocol-filter":
      state.filters.protocol = target.value;
      render();
      break;
    case "quick-jump":
      state.ui.quickJumpQuery = target.value;
      render();
      break;
    case "session-search":
      state.filters.search = target.value;
      render();
      break;
    case "status-filter":
      state.filters.status = target.value;
      render();
      break;
    default:
      break;
  }
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

  const filteredSessions = getFilteredSessions(state);
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
  syncSelections();
  state.ui.quickJumpResults = buildQuickJumpResults();

  const root = document.getElementById("app");
  if (!root) {
    return;
  }

  const focusedTextInput = options.focusSelectedSession ? null : captureFocusedTextInput();
  root.innerHTML = renderLayout(state, renderCurrentPage());
  syncArtifactPaneLayout(root);

  if (options.focusSelectedSession) {
    const selectedRow = root.querySelector(".session-row.selected");
    if (selectedRow instanceof HTMLElement) {
      selectedRow.focus();
    }
    return;
  }

  restoreFocusedTextInput(root, focusedTextInput);
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

function renderCurrentPage() {
  switch (state.route.name) {
    case "browsers":
      return renderBrowsersPage(state);
    case "configuration":
      return renderConfigurationPage(state);
    case "downloads":
      return renderDownloadsPage(state);
    case "logs":
      return renderLogsPage(state);
    case "session-detail":
      return renderSessionDetailPage(state);
    case "sessions":
      return renderSessionsPage(state);
    case "settings":
      return renderSettingsPage(state);
    case "system":
      return renderSystemPage(state);
    case "videos":
      return renderVideosPage(state);
    default:
      return renderNotFoundPage(state);
  }
}

function syncSelections() {
  if (state.route.name === "session-detail") {
    state.ui.selectedSessionId = state.route.sessionId;
  }

  if (state.route.name === "sessions") {
    const filteredSessions = getFilteredSessions(state);
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
  try {
    await navigator.clipboard.writeText(value);
    setNotice("Copied to clipboard");
  } catch {
    setNotice("Clipboard write failed");
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

function isRestorableTextInput(element) {
  if (element instanceof HTMLTextAreaElement) {
    return Boolean(element.dataset.input);
  }

  return element instanceof HTMLInputElement && Boolean(element.dataset.input) && restorableTextInputTypes.has(element.type);
}

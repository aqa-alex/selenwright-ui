import { formatDuration, timeAgo } from "./lib/format.js";
import { parseRoute } from "./app/router.ts";
import { navigate } from "./lib/router.js";
import {
  getPreferencesStore,
  getShellStore,
  mountConsoleShell,
} from "./main.ts";

const artifactPageKeys = new Set(["videos", "logs", "downloads"]);
const artifactDesktopBreakpoint = 1180;
const artifactSplitterWidth = 8;
const artifactMinIndexWidth = 420;
const artifactMinDrawerWidth = 360;
const artifactKeyboardStep = 24;
let artifactResizeState = null;
let relativeTimeTimer = 0;

const root = document.getElementById("app");
if (root instanceof HTMLElement) {
  mountConsoleShell(root, { onRouteChange: handleRouteChange });
}

bindGlobalEvents();
bindGlobalErrorHandlers();
applyRouteSideEffects(window.location.pathname);
startRelativeTimeTicker();

function bindGlobalEvents() {
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerUp);
  window.addEventListener("resize", handleWindowResize);
  document.addEventListener("click", handleClick);
  document.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("keydown", handleSplitterKeyDown);
}

function handlePageHide() {
  window.clearInterval(relativeTimeTimer);
  relativeTimeTimer = 0;
}

function handleRouteChange(pathname = window.location.pathname) {
  stopArtifactResize({ commit: true });
  applyRouteSideEffects(pathname);
}

function applyRouteSideEffects(pathname) {
  const parsed = parseRoute(pathname);
  const title = getPageTitle(parsed.name);
  document.title = title;
  const shellStore = getShellStore();
  if (shellStore) {
    shellStore.setPageTitle(title);
    shellStore.setRouteName(parsed.name);
  }
  window.requestAnimationFrame(() => {
    if (document.documentElement) {
      syncArtifactPaneLayout(document);
    }
  });
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
    getShellStore()?.setNotice(message);
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

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest("a[data-link]");
  if (link) {
    event.preventDefault();
    navigate(link.getAttribute("href"));
  }
}

function handleSplitterKeyDown(event) {
  const splitter =
    event.target instanceof HTMLElement
      ? event.target.closest("[data-artifact-splitter]")
      : null;
  if (splitter instanceof HTMLElement) {
    handleArtifactSplitterKeyDown(event, splitter);
  }
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

  const { layout, splitter } = artifactResizeState;
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
  persistArtifactPaneRatio(pageKey, clampedDrawerWidth, metrics.availableWidth);

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

    const ratio = getPaneRatio(pageKey);

    if (!isArtifactDesktopMode()) {
      layout.style.removeProperty("--artifact-index-width");
      layout.style.removeProperty("--artifact-drawer-width");
      updateArtifactSplitterAria(splitter, ratio, 0.2, 0.8);
      continue;
    }

    const metrics = measureArtifactPaneBounds(layout);
    if (!metrics) {
      continue;
    }

    const clampedDrawerWidth = clampDrawerWidth(ratio * metrics.availableWidth, metrics);
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
      persistArtifactPaneRatio(pageKey, finalDrawerWidth, nextMetrics.availableWidth);
    }
  }

  artifactResizeState = null;
}

function getPaneRatio(pageKey) {
  const preferencesStore = getPreferencesStore();
  const stored = preferencesStore?.artifactPaneWidths?.[pageKey];
  return typeof stored === "number" ? stored : 0.37;
}

function persistArtifactPaneRatio(pageKey, drawerWidth, availableWidth) {
  if (!availableWidth) return;
  const preferencesStore = getPreferencesStore();
  if (!preferencesStore) return;
  preferencesStore.setArtifactPaneWidth(pageKey, drawerWidth / availableWidth);
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
  const inlineWidth = Number.parseFloat(layout.style.getPropertyValue("--artifact-drawer-width"));
  if (Number.isFinite(inlineWidth)) {
    return clampDrawerWidth(inlineWidth, metrics);
  }
  return clampDrawerWidth(metrics.availableWidth * getPaneRatio(pageKey), metrics);
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

function startRelativeTimeTicker() {
  if (relativeTimeTimer) return;
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
    if (!(node instanceof HTMLElement)) continue;

    const startedAt = Date.parse(node.dataset.durationStartedAt || "");
    if (!Number.isFinite(startedAt)) continue;

    const finishedAt = node.dataset.durationFinishedAt
      ? Date.parse(node.dataset.durationFinishedAt)
      : now;
    const durationMs = Math.max(
      0,
      (Number.isFinite(finishedAt) ? finishedAt : now) - startedAt,
    );
    node.textContent = formatDuration(durationMs);
  }
}

function syncTimeAgoLabels(root) {
  const relativeTimeNodes = root.querySelectorAll("[data-time-ago]");
  const now = Date.now();

  for (const node of relativeTimeNodes) {
    if (!(node instanceof HTMLElement)) continue;

    const value = node.dataset.timeAgo;
    if (!value) continue;

    node.textContent = timeAgo(value, now);
  }
}

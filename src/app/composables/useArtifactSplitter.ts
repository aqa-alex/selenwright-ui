import { onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { usePreferencesStore } from "../stores/preferences";

const artifactPageKeys = new Set(["videos", "logs", "downloads"]);
const artifactDesktopBreakpoint = 1180;
const artifactSplitterWidth = 8;
const artifactMinIndexWidth = 420;
const artifactMinDrawerWidth = 360;
const artifactKeyboardStep = 24;

interface PaneMetrics {
  availableWidth: number;
  layoutLeft: number;
  maxDrawerWidth: number;
  minDrawerWidth: number;
}

interface ResizeState {
  drawerWidth: number;
  layout: HTMLElement;
  metrics: PaneMetrics;
  pageKey: string;
  pointerId: number;
  splitter: HTMLElement;
}

export function useArtifactSplitter() {
  const preferencesStore = usePreferencesStore();
  const route = useRoute();
  let resizeState: ResizeState | null = null;

  function getPaneRatio(pageKey: string): number {
    const stored = preferencesStore.artifactPaneWidths[pageKey as "videos" | "logs" | "downloads"];
    return typeof stored === "number" ? stored : 0.37;
  }

  function persistPaneRatio(pageKey: string, drawerWidth: number, availableWidth: number) {
    if (!availableWidth) return;
    preferencesStore.setArtifactPaneWidth(
      pageKey as "videos" | "logs" | "downloads",
      drawerWidth / availableWidth,
    );
  }

  function isDesktopMode() {
    return window.innerWidth > artifactDesktopBreakpoint;
  }

  function measurePaneBounds(layout: HTMLElement): PaneMetrics | null {
    const layoutRect = layout.getBoundingClientRect();
    const availableWidth = layout.clientWidth - artifactSplitterWidth;
    if (availableWidth <= 0) return null;
    const minDrawerWidth = Math.min(artifactMinDrawerWidth, availableWidth);
    const maxDrawerWidth = Math.max(minDrawerWidth, availableWidth - artifactMinIndexWidth);
    return { availableWidth, layoutLeft: layoutRect.left, maxDrawerWidth, minDrawerWidth };
  }

  function clampDrawerWidth(width: number, metrics: PaneMetrics): number {
    return Math.min(metrics.maxDrawerWidth, Math.max(metrics.minDrawerWidth, width));
  }

  function getCurrentDrawerWidth(layout: HTMLElement, pageKey: string, metrics: PaneMetrics): number {
    const inlineWidth = Number.parseFloat(layout.style.getPropertyValue("--artifact-drawer-width"));
    if (Number.isFinite(inlineWidth)) return clampDrawerWidth(inlineWidth, metrics);
    return clampDrawerWidth(metrics.availableWidth * getPaneRatio(pageKey), metrics);
  }

  function updateSplitterAria(
    splitter: HTMLElement,
    ratio: number,
    minRatio: number,
    maxRatio: number,
  ) {
    splitter.setAttribute("aria-valuemin", String(Math.round(minRatio * 100)));
    splitter.setAttribute("aria-valuemax", String(Math.round(maxRatio * 100)));
    splitter.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  }

  function applyPaneWidths(
    layout: HTMLElement,
    splitter: HTMLElement,
    drawerWidth: number,
    metrics: PaneMetrics,
  ) {
    const normalizedDrawerWidth = clampDrawerWidth(drawerWidth, metrics);
    const indexWidth = Math.max(0, metrics.availableWidth - normalizedDrawerWidth);
    const ratio = normalizedDrawerWidth / metrics.availableWidth;
    const minRatio = metrics.minDrawerWidth / metrics.availableWidth;
    const maxRatio = metrics.maxDrawerWidth / metrics.availableWidth;
    layout.style.setProperty("--artifact-index-width", `${indexWidth}px`);
    layout.style.setProperty("--artifact-drawer-width", `${normalizedDrawerWidth}px`);
    updateSplitterAria(splitter, ratio, minRatio, maxRatio);
  }

  function syncPaneLayout(root: Document | HTMLElement = document) {
    const layouts = root.querySelectorAll<HTMLElement>("[data-artifact-layout]");
    for (const layout of layouts) {
      const pageKey = layout.dataset.artifactPage;
      if (!pageKey || !artifactPageKeys.has(pageKey)) continue;
      const splitter = layout.querySelector<HTMLElement>("[data-artifact-splitter]");
      if (!splitter) continue;
      const ratio = getPaneRatio(pageKey);
      if (!isDesktopMode()) {
        layout.style.removeProperty("--artifact-index-width");
        layout.style.removeProperty("--artifact-drawer-width");
        updateSplitterAria(splitter, ratio, 0.2, 0.8);
        continue;
      }
      const metrics = measurePaneBounds(layout);
      if (!metrics) continue;
      const clamped = clampDrawerWidth(ratio * metrics.availableWidth, metrics);
      applyPaneWidths(layout, splitter, clamped, metrics);
    }
  }

  function stopResize({ commit }: { commit: boolean }) {
    if (!resizeState) return;
    const { drawerWidth, layout, metrics, pageKey, splitter } = resizeState;
    splitter.removeAttribute("data-active");
    document.documentElement.classList.remove("artifact-resize-active");
    if (commit && layout.isConnected && pageKey && artifactPageKeys.has(pageKey)) {
      const nextMetrics = measurePaneBounds(layout) || metrics;
      const finalDrawerWidth = clampDrawerWidth(drawerWidth, nextMetrics);
      applyPaneWidths(layout, splitter, finalDrawerWidth, nextMetrics);
      persistPaneRatio(pageKey, finalDrawerWidth, nextMetrics.availableWidth);
    }
    resizeState = null;
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0 || !isDesktopMode()) return;
    const splitter =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-artifact-splitter]")
        : null;
    if (!splitter) return;
    const layout = splitter.closest<HTMLElement>("[data-artifact-layout]");
    if (!layout) return;
    const pageKey = layout.dataset.artifactPage;
    if (!pageKey || !artifactPageKeys.has(pageKey)) return;
    const metrics = measurePaneBounds(layout);
    if (!metrics) return;
    const drawerWidth = getCurrentDrawerWidth(layout, pageKey, metrics);
    event.preventDefault();
    stopResize({ commit: true });
    resizeState = {
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

  function handlePointerMove(event: PointerEvent) {
    if (!resizeState || event.pointerId !== resizeState.pointerId) return;
    const { layout, splitter } = resizeState;
    if (!layout.isConnected || !isDesktopMode()) {
      stopResize({ commit: false });
      return;
    }
    const metrics = measurePaneBounds(layout);
    if (!metrics) return;
    const splitterCenter = event.clientX - metrics.layoutLeft;
    const rawIndexWidth = splitterCenter - artifactSplitterWidth / 2;
    const rawDrawerWidth = metrics.availableWidth - rawIndexWidth;
    const drawerWidth = clampDrawerWidth(rawDrawerWidth, metrics);
    resizeState.drawerWidth = drawerWidth;
    resizeState.metrics = metrics;
    applyPaneWidths(layout, splitter, drawerWidth, metrics);
    event.preventDefault();
  }

  function handlePointerUp(event: PointerEvent) {
    if (!resizeState || event.pointerId !== resizeState.pointerId) return;
    stopResize({ commit: true });
  }

  function handleKeyDown(event: KeyboardEvent) {
    const splitter =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-artifact-splitter]")
        : null;
    if (!splitter) return;
    if (!isDesktopMode()) return;
    const layout = splitter.closest<HTMLElement>("[data-artifact-layout]");
    if (!layout) return;
    const pageKey = layout.dataset.artifactPage;
    if (!pageKey || !artifactPageKeys.has(pageKey)) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const metrics = measurePaneBounds(layout);
    if (!metrics) return;
    const current = getCurrentDrawerWidth(layout, pageKey, metrics);
    let next = current;
    if (event.key === "ArrowLeft") next = current + artifactKeyboardStep;
    if (event.key === "ArrowRight") next = current - artifactKeyboardStep;
    if (event.key === "Home") next = metrics.minDrawerWidth;
    if (event.key === "End") next = metrics.maxDrawerWidth;
    const clamped = clampDrawerWidth(next, metrics);
    applyPaneWidths(layout, splitter, clamped, metrics);
    persistPaneRatio(pageKey, clamped, metrics.availableWidth);
    event.preventDefault();
  }

  function handleWindowResize() {
    if (resizeState) stopResize({ commit: true });
    syncPaneLayout();
  }

  onMounted(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("resize", handleWindowResize);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
    window.removeEventListener("resize", handleWindowResize);
    document.removeEventListener("pointerdown", handlePointerDown);
    document.removeEventListener("keydown", handleKeyDown);
    stopResize({ commit: true });
  });

  watch(
    () => route.fullPath,
    () => {
      stopResize({ commit: true });
      window.requestAnimationFrame(() => syncPaneLayout());
    },
    { immediate: true },
  );
}

import { onBeforeUnmount, onMounted } from "vue";
import { formatDuration, timeAgo } from "../../lib/format";

const TICK_INTERVAL_MS = 1000;

export function useRelativeTimeTicker() {
  let timer = 0;

  function writeIfChanged(node: HTMLElement, next: string) {
    if (node.textContent !== next) {
      node.textContent = next;
    }
  }

  function syncDurationLabels() {
    const nodes = document.querySelectorAll<HTMLElement>("[data-duration-started-at]");
    const now = Date.now();
    for (const node of nodes) {
      const startedAt = Date.parse(node.dataset.durationStartedAt || "");
      if (!Number.isFinite(startedAt)) continue;
      const finishedAt = node.dataset.durationFinishedAt
        ? Date.parse(node.dataset.durationFinishedAt)
        : now;
      const durationMs = Math.max(
        0,
        (Number.isFinite(finishedAt) ? finishedAt : now) - startedAt,
      );
      writeIfChanged(node, formatDuration(durationMs));
    }
  }

  function syncTimeAgoLabels() {
    const nodes = document.querySelectorAll<HTMLElement>("[data-time-ago]");
    const now = Date.now();
    for (const node of nodes) {
      const value = node.dataset.timeAgo;
      if (!value) continue;
      writeIfChanged(node, timeAgo(value, now));
    }
  }

  function sync() {
    syncDurationLabels();
    syncTimeAgoLabels();
  }

  function startInterval() {
    if (timer) return;
    timer = window.setInterval(sync, TICK_INTERVAL_MS);
  }

  function stopInterval() {
    if (!timer) return;
    window.clearInterval(timer);
    timer = 0;
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopInterval();
      return;
    }
    sync();
    startInterval();
  }

  onMounted(() => {
    sync();
    if (!document.hidden) {
      startInterval();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
  });

  onBeforeUnmount(() => {
    stopInterval();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });
}

import { onBeforeUnmount, onMounted } from "vue";
import { formatDuration, timeAgo } from "../../lib/format.js";

/**
 * Refreshes relative-time labels (`[data-time-ago]`,
 * `[data-duration-started-at]`) every second without re-rendering Vue.
 * Labels still come from server-provided ISO timestamps; this keeps them
 * visually fresh while the upstream snapshot is unchanged.
 *
 * Call once from `App.vue` inside `<script setup>`.
 */
export function useRelativeTimeTicker() {
  let timer = 0;

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
      node.textContent = formatDuration(durationMs);
    }
  }

  function syncTimeAgoLabels() {
    const nodes = document.querySelectorAll<HTMLElement>("[data-time-ago]");
    const now = Date.now();
    for (const node of nodes) {
      const value = node.dataset.timeAgo;
      if (!value) continue;
      node.textContent = timeAgo(value, now);
    }
  }

  function sync() {
    syncDurationLabels();
    syncTimeAgoLabels();
  }

  onMounted(() => {
    sync();
    timer = window.setInterval(sync, 1000);
  });

  onBeforeUnmount(() => {
    if (timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  });
}

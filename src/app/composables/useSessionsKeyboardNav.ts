import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from "vue";
import { useRouter } from "vue-router";
import type { ConsoleSession } from "../../data/service";
import { buildSessionPath } from "../router";
import { useSessionsStore } from "../stores/sessions";

function isTypingTarget(element: EventTarget | null) {
  return (
    element instanceof HTMLElement &&
    (element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.tagName === "SELECT" ||
      element.isContentEditable)
  );
}

function focusSelectedRow() {
  void nextTick().then(() => {
    const row = document.querySelector(".session-row.selected");
    if (row instanceof HTMLElement) {
      row.focus();
    }
  });
}

export function useSessionsKeyboardNav(filteredSessions: Ref<ConsoleSession[]>) {
  const sessionsStore = useSessionsStore();
  const router = useRouter();

  function onKeyDown(event: KeyboardEvent) {
    if (isTypingTarget(document.activeElement)) return;
    const items = filteredSessions.value;
    if (!items.length) return;

    const currentIndex = Math.max(
      0,
      items.findIndex((s) => s.id === sessionsStore.selectedSessionId),
    );

    const key = event.key;
    const lower = key.toLowerCase();

    if (key === "ArrowDown" || lower === "j") {
      event.preventDefault();
      const next = Math.min(currentIndex + 1, items.length - 1);
      sessionsStore.setSelectedSessionId(items[next].id);
      focusSelectedRow();
      return;
    }
    if (key === "ArrowUp" || lower === "k") {
      event.preventDefault();
      const next = Math.max(currentIndex - 1, 0);
      sessionsStore.setSelectedSessionId(items[next].id);
      focusSelectedRow();
      return;
    }
    if (key === "Enter") {
      event.preventDefault();
      void router.push(buildSessionPath(items[currentIndex].id));
    }
  }

  watch(
    filteredSessions,
    (items) => {
      const current = sessionsStore.selectedSessionId;
      if (!items.length) {
        if (current !== null) sessionsStore.setSelectedSessionId(null);
        return;
      }
      if (!current || !items.find((s) => s.id === current)) {
        sessionsStore.setSelectedSessionId(items[0].id);
      }
    },
    { immediate: true },
  );

  onMounted(() => {
    document.addEventListener("keydown", onKeyDown);
  });
  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onKeyDown);
  });
}

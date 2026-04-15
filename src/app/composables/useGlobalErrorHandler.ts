import { onBeforeUnmount, onMounted } from "vue";
import { useShellStore } from "../stores/shell";

const NOTICE_DEDUP_WINDOW_MS = 5_000;
const NOTICE_MIN_INTERVAL_MS = 1_000;

interface NoticeGateState {
  lastMessage: string;
  lastShownAt: number;
}

export function createNoticeGate(now: () => number = Date.now) {
  const state: NoticeGateState = { lastMessage: "", lastShownAt: Number.NEGATIVE_INFINITY };

  return function shouldEmit(message: string): boolean {
    if (!message) return false;
    const nowMs = now();
    const sameAsLast = message === state.lastMessage;
    const sinceLast = nowMs - state.lastShownAt;

    if (sameAsLast && sinceLast < NOTICE_DEDUP_WINDOW_MS) {
      return false;
    }
    if (sinceLast < NOTICE_MIN_INTERVAL_MS) {
      return false;
    }

    state.lastMessage = message;
    state.lastShownAt = nowMs;
    return true;
  };
}

export function useGlobalErrorHandler() {
  const shellStore = useShellStore();
  const gate = createNoticeGate();

  function onUnhandledRejection(event: PromiseRejectionEvent) {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    if (gate(message)) {
      shellStore.setNotice(message);
    }
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("Unhandled rejection:", reason);
    }
  }

  function onError(event: ErrorEvent) {
    if (event.error instanceof Error) {
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error("Unhandled error:", event.error);
      }
    }
  }

  onMounted(() => {
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    window.removeEventListener("error", onError);
  });
}

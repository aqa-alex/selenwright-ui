import { onBeforeUnmount, onMounted } from "vue";
import { useShellStore } from "../stores/shell";

/**
 * Routes unhandled promise rejections into the shell store's notice bar
 * and logs them to the console. Uncaught errors are logged only — they
 * usually fire alongside a Vue error overlay, so surfacing them in the
 * notice bar would double-up.
 *
 * Call once from `App.vue` inside `<script setup>`.
 */
export function useGlobalErrorHandler() {
  const shellStore = useShellStore();

  function onUnhandledRejection(event: PromiseRejectionEvent) {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    shellStore.setNotice(message);
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

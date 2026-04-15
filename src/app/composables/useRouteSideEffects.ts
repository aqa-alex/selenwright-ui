import { watch } from "vue";
import { useRoute } from "vue-router";
import type { RouteName } from "../router";
import { useShellStore } from "../stores/shell";

const routeTitles: Record<string, string> = {
  browsers: "Browsers",
  configuration: "Configuration",
  downloads: "Downloads",
  logs: "Logs",
  "not-found": "Not found",
  "session-detail": "Session Details",
  sessions: "Sessions",
  "sessions-list": "Sessions",
  settings: "Settings",
  system: "System",
  videos: "Videos",
};

function getPageTitle(routeName: string): string {
  return routeTitles[routeName] || "Selenwright";
}

export function useRouteSideEffects() {
  const route = useRoute();
  const shellStore = useShellStore();

  watch(
    () => (route.name ?? "sessions") as string,
    (rawName) => {
      const routeName = (rawName === "sessions-list" ? "sessions" : rawName) as RouteName;
      const title = getPageTitle(routeName);
      if (typeof document !== "undefined") {
        document.title = title;
      }
      shellStore.setPageTitle(title);
      shellStore.setRouteName(routeName);
    },
    { immediate: true },
  );
}

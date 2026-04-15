import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { type App as VueApp, createApp, nextTick } from "vue";
import App from "./App.vue";
import { createConsoleRouter } from "./app/router";
import { setSaveArtifactHistoryHandler as setSaveHandler } from "./app/lib/handlers";
import { usePreferencesStore } from "./app/stores/preferences";
import { useSessionsStore } from "./app/stores/sessions";
import { useSettingsStore } from "./app/stores/settings";
import { useShellStore } from "./app/stores/shell";
import { useUiStore } from "./app/stores/ui";
import type { ShellSnapshot } from "./app/types";
import { setNavigator } from "./lib/router.js";

let routeChangeHandler: ((pathname: string) => void) | null = null;
let removeRouteListener: (() => void) | null = null;
let shellStore: ReturnType<typeof useShellStore> | null = null;
let preferencesStore: ReturnType<typeof usePreferencesStore> | null = null;
let uiStore: ReturnType<typeof useUiStore> | null = null;
let sessionsStore: ReturnType<typeof useSessionsStore> | null = null;
let settingsStore: ReturnType<typeof useSettingsStore> | null = null;
let shellApp: VueApp | null = null;
let shellMounted = false;

const router = createConsoleRouter();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

export function mountConsoleShell(
  container: HTMLElement,
  options: { onRouteChange?: (pathname: string) => void } = {},
) {
  routeChangeHandler = typeof options.onRouteChange === "function" ? options.onRouteChange : null;

  if (shellMounted) {
    return;
  }

  const pinia = createPinia();
  shellStore = useShellStore(pinia);
  preferencesStore = usePreferencesStore(pinia);
  preferencesStore.initialize();
  uiStore = useUiStore(pinia);
  sessionsStore = useSessionsStore(pinia);
  settingsStore = useSettingsStore(pinia);

  shellApp = createApp(App);
  shellApp.use(pinia);
  shellApp.use(VueQueryPlugin, { queryClient });
  shellApp.use(router);
  shellApp.mount(container);

  removeRouteListener = router.afterEach((to) => {
    routeChangeHandler?.(to.fullPath);
  });

  setNavigator(async (pathname: string, { replace = false }: { replace?: boolean } = {}) => {
    const currentPath = router.currentRoute.value.fullPath;
    if (pathname === currentPath) {
      return;
    }

    await (replace ? router.replace(pathname) : router.push(pathname));
  });

  shellMounted = true;
}

export async function updateConsoleShell(snapshot: ShellSnapshot) {
  if (!shellStore) {
    return;
  }

  shellStore.applySnapshot(snapshot);
  await nextTick();
}

export function getPreferencesStore() {
  return preferencesStore;
}

export function getUiStore() {
  return uiStore;
}

export function getSessionsStore() {
  return sessionsStore;
}

export function getSettingsStore() {
  return settingsStore;
}

export function setSaveArtifactHistoryHandler(handler: (() => void | Promise<void>) | null) {
  setSaveHandler(handler);
}

export function unmountConsoleShell() {
  removeRouteListener?.();
  removeRouteListener = null;
  routeChangeHandler = null;
  if (shellApp) {
    try {
      shellApp.unmount();
    } catch {
      // ignore unmount errors during teardown
    }
    shellApp = null;
  }
  shellStore = null;
  preferencesStore = null;
  uiStore = null;
  sessionsStore = null;
  settingsStore = null;
  setSaveHandler(null);
  setNavigator(null);
  shellMounted = false;
}

import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { type App as VueApp, createApp } from "vue";
import App from "./App.vue";
import { createConsoleRouter } from "./app/router";
import { useConsoleStore } from "./app/stores/console";
import { usePreferencesStore } from "./app/stores/preferences";
import { useSessionsStore } from "./app/stores/sessions";
import { useSettingsStore } from "./app/stores/settings";
import { useShellStore } from "./app/stores/shell";
import { useUiStore } from "./app/stores/ui";
import { setNavigator } from "./lib/router.js";

let routeChangeHandler: ((pathname: string) => void) | null = null;
let removeRouteListener: (() => void) | null = null;
let shellStore: ReturnType<typeof useShellStore> | null = null;
let preferencesStore: ReturnType<typeof usePreferencesStore> | null = null;
let uiStore: ReturnType<typeof useUiStore> | null = null;
let sessionsStore: ReturnType<typeof useSessionsStore> | null = null;
let settingsStore: ReturnType<typeof useSettingsStore> | null = null;
let consoleStore: ReturnType<typeof useConsoleStore> | null = null;
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
  consoleStore = useConsoleStore(pinia);

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

export function getShellStore() {
  return shellStore;
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

export function getConsoleStore() {
  return consoleStore;
}

export function unmountConsoleShell() {
  removeRouteListener?.();
  removeRouteListener = null;
  routeChangeHandler = null;
  if (shellApp) {
    try {
      shellApp.unmount();
    } catch {
      /* ignore unmount errors */
    }
    shellApp = null;
  }
  shellStore = null;
  preferencesStore = null;
  uiStore = null;
  sessionsStore = null;
  settingsStore = null;
  consoleStore = null;
  setNavigator(null);
  shellMounted = false;
}

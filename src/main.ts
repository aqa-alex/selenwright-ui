import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createApp, nextTick } from "vue";
import App from "./App.vue";
import { createConsoleRouter } from "./app/router";
import { useShellStore } from "./app/stores/shell";
import type { ShellSnapshot } from "./app/types";
import { setNavigator } from "./lib/router.js";

let routeChangeHandler: ((pathname: string) => void) | null = null;
let removeRouteListener: (() => void) | null = null;
let shellStore: ReturnType<typeof useShellStore> | null = null;
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

  const app = createApp(App);
  app.use(pinia);
  app.use(VueQueryPlugin, { queryClient });
  app.use(router);
  app.mount(container);

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

export function unmountConsoleShell() {
  removeRouteListener?.();
  removeRouteListener = null;
  routeChangeHandler = null;
  shellStore = null;
  setNavigator(null);
  shellMounted = false;
}

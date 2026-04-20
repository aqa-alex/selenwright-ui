import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";
import App from "./App.vue";
import { setUnauthorizedHandler } from "./app/api";
import { createConsoleRouter } from "./app/router";
import { useIdentityStore } from "./app/stores/identity";
import { usePreferencesStore } from "./app/stores/preferences";

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

const pinia = createPinia();
usePreferencesStore(pinia).initialize();

// Global reaction to upstream 401s: drop the cached identity and push the user
// back to /login. Skips the auth-bootstrap endpoints (wired inside http.ts).
// Guarded against reentry during the initial navigation.
let redirectingToLogin = false;
setUnauthorizedHandler(() => {
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  const identity = useIdentityStore(pinia);
  identity.resetToAnonymous();
  const current = router.currentRoute.value;
  if (current.name === "login") {
    redirectingToLogin = false;
    return;
  }
  void router
    .replace({ name: "login", query: { reason: "session_expired" } })
    .finally(() => {
      redirectingToLogin = false;
    });
});

const app = createApp(App);
app.use(pinia);
app.use(VueQueryPlugin, { queryClient });
app.use(router);

const rootEl = document.getElementById("app");
if (rootEl) {
  app.mount(rootEl);
}

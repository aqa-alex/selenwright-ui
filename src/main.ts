import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";
import App from "./App.vue";
import { createConsoleRouter } from "./app/router";
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
// Preferences are read from localStorage and applied to the document
// dataset before any component mounts, so theme / density are in place
// by the time Vue paints.
usePreferencesStore(pinia).initialize();

const app = createApp(App);
app.use(pinia);
app.use(VueQueryPlugin, { queryClient });
app.use(router);

const rootEl = document.getElementById("app");
if (rootEl) {
  app.mount(rootEl);
}

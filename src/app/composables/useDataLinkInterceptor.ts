import { onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";

/**
 * Intercepts plain `<a data-link href="...">` clicks and forwards them
 * to Vue Router so the sidebar and other "link-like" anchors don't
 * trigger full page reloads.
 *
 * Call once from `App.vue` inside `<script setup>`.
 */
export function useDataLinkInterceptor() {
  const router = useRouter();

  function onClick(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>("a[data-link]");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    void router.push(href);
  }

  onMounted(() => {
    document.addEventListener("click", onClick);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("click", onClick);
  });
}

import { onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";

export function useDataLinkInterceptor() {
  const router = useRouter();

  function onClick(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>("a[data-link]");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("/")) return;
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

<script setup lang="ts">
import { computed } from "vue";
import { icon } from "../../components/icons";
import { navGroups } from "../router";
import { useIdentityStore } from "../stores/identity";

const props = defineProps<{
  routeName: string;
}>();

const identityStore = useIdentityStore();

const navigationGroups = computed(() =>
  navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.adminOnly || identityStore.effectiveAdmin)
        .map((item) => ({
          ...item,
          active: isNavItemActive(props.routeName, item.href),
          iconMarkup: icon(item.icon),
        })),
    }))
    .filter((group) => group.items.length > 0),
);

function isNavItemActive(routeName: string, href: string) {
  if (href === "/sessions") {
    return routeName === "sessions" || routeName === "session-detail";
  }
  if (href === "/artifacts/videos") {
    return routeName === "videos";
  }
  if (href === "/artifacts/logs") {
    return routeName === "logs";
  }
  if (href === "/artifacts/downloads") {
    return routeName === "downloads";
  }
  if (href === "/settings/api-tokens") {
    return routeName === "api-tokens";
  }
  return href.endsWith(routeName);
}
</script>

<template>
  <aside class="sidebar" aria-label="Primary navigation">
    <section v-for="group in navigationGroups" :key="group.title" class="sidebar-group">
      <h2>{{ group.title }}</h2>
      <a
        v-for="item in group.items"
        :key="item.href"
        :class="['sidebar-link', { active: item.active }]"
        data-link
        :href="item.href"
      >
        <span class="sidebar-link-icon">
          <span v-html="item.iconMarkup"></span>
        </span>
        <span>{{ item.label }}</span>
      </a>
    </section>
  </aside>
</template>

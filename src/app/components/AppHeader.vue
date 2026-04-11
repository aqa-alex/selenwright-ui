<script setup lang="ts">
import QuickJump from "./QuickJump.vue";
import ThemeSwitcher from "./ThemeSwitcher.vue";
import type { ShellQuickJumpResult } from "../types";

defineProps<{
  quickJumpQuery: string;
  quickJumpResults: ShellQuickJumpResult[];
  themeMode: string;
}>();
</script>

<template>
  <header class="topbar" role="banner">
    <div class="brand-block">
      <a class="brand-link" href="/sessions" data-link>
        <span class="brand-mark">
          <img alt="Selenwright logo" class="brand-favicon" src="/favicon.ico" />
        </span>
        <span class="brand-copy">
          <strong>Selenwright</strong>
          <span>Browser session console</span>
        </span>
      </a>
    </div>
    <div class="topbar-tools">
      <QuickJump :quick-jump-query="quickJumpQuery" :quick-jump-results="quickJumpResults" />
      <ThemeSwitcher :theme-mode="themeMode" />
    </div>
  </header>
</template>

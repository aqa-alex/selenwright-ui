<script setup lang="ts">
import { storeToRefs } from "pinia";
import AppHeader from "./app/components/AppHeader.vue";
import AppSidebar from "./app/components/AppSidebar.vue";
import PageFrame from "./app/components/PageFrame.vue";
import { useConsoleStream } from "./app/composables/useConsoleStream";
import { useShellStore } from "./app/stores/shell";

useConsoleStream();

const shellStore = useShellStore();
const {
  notice,
  pageTitle,
  quickJumpQuery,
  quickJumpResults,
  routeName,
} = storeToRefs(shellStore);
</script>

<template>
  <div class="shell">
    <AppHeader
      :quick-jump-query="quickJumpQuery"
      :quick-jump-results="quickJumpResults"
    />
    <div class="workspace">
      <AppSidebar :route-name="routeName" />
      <PageFrame
        :notice="notice"
        :page-title="pageTitle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import AppHeader from "./app/components/AppHeader.vue";
import AppSidebar from "./app/components/AppSidebar.vue";
import PageFrame from "./app/components/PageFrame.vue";
import { useShellStore } from "./app/stores/shell";

const shellStore = useShellStore();
const {
  artifactPage,
  notice,
  operationsPage,
  pageTitle,
  quickJumpQuery,
  quickJumpResults,
  routeName,
  sessionDetailPage,
  sessionsPage,
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
        :artifact-page="artifactPage"
        :notice="notice"
        :operations-page="operationsPage"
        :page-title="pageTitle"
        :route-name="routeName"
        :session-detail-page="sessionDetailPage"
        :sessions-page="sessionsPage"
      />
    </div>
  </div>
</template>

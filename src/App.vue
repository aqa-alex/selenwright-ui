<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed } from "vue";
import AppHeader from "./app/components/AppHeader.vue";
import AppSidebar from "./app/components/AppSidebar.vue";
import PageFrame from "./app/components/PageFrame.vue";
import { useArtifactSplitter } from "./app/composables/useArtifactSplitter";
import { useConsoleStream } from "./app/composables/useConsoleStream";
import { useDataLinkInterceptor } from "./app/composables/useDataLinkInterceptor";
import { useGlobalErrorHandler } from "./app/composables/useGlobalErrorHandler";
import { useRelativeTimeTicker } from "./app/composables/useRelativeTimeTicker";
import { useRouteSideEffects } from "./app/composables/useRouteSideEffects";
import { useIdentityStore } from "./app/stores/identity";
import { useShellStore } from "./app/stores/shell";

useConsoleStream();
useRouteSideEffects();
useArtifactSplitter();
useRelativeTimeTicker();
useGlobalErrorHandler();
useDataLinkInterceptor();

const identityStore = useIdentityStore();
const shellStore = useShellStore();
const { notice, pageTitle, routeName } = storeToRefs(shellStore);

const showShell = computed(() => routeName.value !== "login" && !identityStore.requiresLogin);
</script>

<template>
  <div v-if="showShell" class="shell">
    <AppHeader />
    <div class="workspace">
      <AppSidebar :route-name="routeName" />
      <PageFrame :notice="notice" :page-title="pageTitle" />
    </div>
  </div>
  <router-view v-else />
</template>

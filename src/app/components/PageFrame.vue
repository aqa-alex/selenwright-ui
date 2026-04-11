<script setup lang="ts">
import ArtifactsPage from "../pages/ArtifactsPage.vue";
import NotFoundPage from "../pages/NotFoundPage.vue";
import OperationsPage from "../pages/OperationsPage.vue";
import SessionsPage from "../pages/SessionsPage.vue";
import type { ArtifactPageModel } from "../artifacts/artifactsPage";
import type { OperationsPageModel } from "../operations/operationsPage";
import SessionDetailPage from "../pages/SessionDetailPage.vue";
import type { SessionDetailPageModel } from "../session-detail/sessionDetail";
import type { SessionsPageModel } from "../sessions/sessionTable";

defineProps<{
  artifactPage: ArtifactPageModel | null;
  notice: string;
  operationsPage: OperationsPageModel | null;
  pageTitle: string;
  routeName: string;
  sessionDetailPage: SessionDetailPageModel | null;
  sessionsPage: SessionsPageModel | null;
}>();
</script>

<template>
  <main class="content" role="main" :aria-label="pageTitle">
    <div v-if="notice" class="inline-notice">{{ notice }}</div>
    <ArtifactsPage v-if="artifactPage" :model="artifactPage" />
    <OperationsPage v-else-if="operationsPage" :model="operationsPage" />
    <SessionsPage v-else-if="sessionsPage" :model="sessionsPage" />
    <SessionDetailPage v-else-if="sessionDetailPage" :model="sessionDetailPage" />
    <NotFoundPage v-else-if="routeName === 'not-found'" />
  </main>
</template>

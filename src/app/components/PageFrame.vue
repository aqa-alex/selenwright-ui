<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { parseRoute, type RouteName } from "../router";
import { useArtifactPageModel } from "../composables/useArtifactPageModel";
import { useOperationsPageModel } from "../composables/useOperationsPageModel";
import { useSessionDetailPageModel } from "../composables/useSessionDetailPageModel";
import { useSessionsPageModel } from "../composables/useSessionsPageModel";
import AdminApiTokensPage from "../pages/AdminApiTokensPage.vue";
import ArtifactsPage from "../pages/ArtifactsPage.vue";
import NotFoundPage from "../pages/NotFoundPage.vue";
import OperationsPage from "../pages/OperationsPage.vue";
import SessionsPage from "../pages/SessionsPage.vue";
import SessionDetailPage from "../pages/SessionDetailPage.vue";
import type { ArtifactPageKey } from "../artifacts/artifactsPage";
import type { OperationsRouteName } from "../operations/operationsPage";

defineProps<{
  notice: string;
  pageTitle: string;
}>();

const route = useRoute();
const parsed = computed(() => parseRoute(route.path));
const routeName = computed<RouteName>(() => parsed.value.name);
const sessionId = computed(() => parsed.value.sessionId || "");

const artifactPageKeys = new Set<RouteName>(["videos", "logs", "downloads"]);
const operationsPageKeys = new Set<RouteName>([
  "browsers",
  "configuration",
  "settings",
  "system",
]);

const isArtifactRoute = computed(() => artifactPageKeys.has(routeName.value));
const isOperationsRoute = computed(() => operationsPageKeys.has(routeName.value));
const isSessionsRoute = computed(() => routeName.value === "sessions");
const isSessionDetailRoute = computed(() => routeName.value === "session-detail");
const isApiTokensRoute = computed(() => routeName.value === "api-tokens");
const isNotFoundRoute = computed(() => routeName.value === "not-found");

const artifactPageKey = computed<ArtifactPageKey>(() => routeName.value as ArtifactPageKey);
const operationsRouteName = computed<OperationsRouteName>(
  () => routeName.value as OperationsRouteName,
);

const artifactModel = useArtifactPageModel(artifactPageKey);
const operationsModel = useOperationsPageModel(operationsRouteName);
const sessionsModel = useSessionsPageModel();
const sessionDetailModel = useSessionDetailPageModel(sessionId);
</script>

<template>
  <main
    class="content"
    role="main"
    :aria-label="pageTitle"
  >
    <div
      v-if="notice"
      class="inline-notice"
    >
      {{ notice }}
    </div>
    <ArtifactsPage
      v-if="isArtifactRoute"
      :model="artifactModel"
    />
    <OperationsPage
      v-else-if="isOperationsRoute"
      :model="operationsModel"
    />
    <SessionsPage
      v-else-if="isSessionsRoute"
      :model="sessionsModel"
    />
    <SessionDetailPage
      v-else-if="isSessionDetailRoute"
      :model="sessionDetailModel"
    />
    <AdminApiTokensPage v-else-if="isApiTokensRoute" />
    <NotFoundPage v-else-if="isNotFoundRoute" />
  </main>
</template>

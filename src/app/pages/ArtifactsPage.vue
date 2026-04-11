<script setup lang="ts">
import { computed } from "vue";
import ArtifactDownloadDrawer from "../artifacts/ArtifactDownloadDrawer.vue";
import ArtifactIndexTable from "../artifacts/ArtifactIndexTable.vue";
import ArtifactLogDrawer from "../artifacts/ArtifactLogDrawer.vue";
import ArtifactVideoDrawer from "../artifacts/ArtifactVideoDrawer.vue";
import type { ArtifactPageModel } from "../artifacts/artifactsPage";
import {
  getArtifactPageCopy,
  getDrawerRatio,
  getFilteredArtifactItems,
  getLogPagination,
  getLogsPerPageOptions,
  getVisibleArtifactItems,
} from "../artifacts/artifactsPage";
import ConsolePanel from "../components/ui/ConsolePanel.vue";

const props = defineProps<{
  model: ArtifactPageModel;
}>();

const copy = computed(() => getArtifactPageCopy(props.model));
const visibleItems = computed(() => getVisibleArtifactItems(props.model));
const filteredItems = computed(() => getFilteredArtifactItems(props.model));
const logPagination = computed(() => getLogPagination(props.model));
const logsPerPageOptions = computed(() => getLogsPerPageOptions());
const drawerPercent = computed(() => Math.round(getDrawerRatio(props.model) * 100));
const drawerTitle = computed(() => {
  if (props.model.pageKey === "videos") {
    return "Preview";
  }
  if (props.model.pageKey === "logs") {
    return "Log viewer";
  }
  return "Details";
});
const showPagination = computed(
  () => props.model.pageKey === "logs" && filteredItems.value.length > 0,
);
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>{{ copy.title }}</h1>
      <p>{{ copy.intro }}</p>
    </div>
    <div v-if="model.artifactSessionFilter" class="page-intro-meta">
      <button class="button secondary" data-action="clear-artifact-session-filter" type="button">
        Clear session filter
      </button>
    </div>
  </div>
  <div
    :class="['artifact-layout', `artifact-layout--${model.pageKey}`]"
    data-artifact-layout
    :data-artifact-page="model.pageKey"
  >
    <div class="artifact-layout__pane artifact-layout__pane--index" data-artifact-pane="index">
      <ConsolePanel :title="copy.indexTitle">
        <template v-if="visibleItems.length">
          <ArtifactIndexTable :model="model" />
          <div v-if="showPagination" class="pagination-bar">
            <label class="filter-select">
              <span>Per page</span>
              <select data-input="logs-per-page" :value="model.logsPerPage">
                <option v-for="option in logsPerPageOptions" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>
            </label>
            <div class="pagination-controls">
              <button
                class="button secondary"
                data-action="logs-prev-page"
                type="button"
                :disabled="logPagination.currentPage <= 1"
              >
                Prev
              </button>
              <span class="pagination-info">
                {{ logPagination.currentPage }} / {{ logPagination.totalPages }}
              </span>
              <button
                class="button secondary"
                data-action="logs-next-page"
                type="button"
                :disabled="logPagination.currentPage >= logPagination.totalPages"
              >
                Next
              </button>
            </div>
          </div>
        </template>
        <div v-else class="empty-state">
          <h2>{{ copy.emptyTitle }}</h2>
          <p>{{ copy.emptyHint }}</p>
        </div>
      </ConsolePanel>
    </div>
    <div
      aria-label="Resize index and viewer panes"
      aria-valuemax="80"
      aria-valuemin="20"
      :aria-valuenow="drawerPercent"
      aria-orientation="vertical"
      class="artifact-layout__splitter"
      :data-artifact-splitter-page="model.pageKey"
      :data-artifact-page="model.pageKey"
      data-artifact-splitter
      role="separator"
      tabindex="0"
    ></div>
    <div class="artifact-layout__pane artifact-layout__pane--drawer" data-artifact-pane="drawer">
      <ConsolePanel :title="drawerTitle">
        <ArtifactVideoDrawer v-if="model.pageKey === 'videos'" :model="model" />
        <ArtifactLogDrawer v-else-if="model.pageKey === 'logs'" :model="model" />
        <ArtifactDownloadDrawer v-else :model="model" />
      </ConsolePanel>
    </div>
  </div>
</template>

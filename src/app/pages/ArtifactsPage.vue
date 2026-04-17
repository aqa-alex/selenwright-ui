<script setup lang="ts">
import { computed } from "vue";
import ArtifactDownloadDrawer from "../artifacts/ArtifactDownloadDrawer.vue";
import ArtifactIndexTable from "../artifacts/ArtifactIndexTable.vue";
import ArtifactLogDrawer from "../artifacts/ArtifactLogDrawer.vue";
import ArtifactVideoDrawer from "../artifacts/ArtifactVideoDrawer.vue";
import type { ArtifactPageModel } from "../artifacts/artifactsPage";
import {
  getArtifactPageCopy,
  getArtifactPagination,
  getArtifactPerPageOptions,
  getDrawerRatio,
  getFilteredArtifactItems,
  getVisibleArtifactItems,
} from "../artifacts/artifactsPage";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import { useAutoSelectArtifact } from "../composables/useAutoSelectArtifact";
import { useUiStore } from "../stores/ui";

const props = defineProps<{
  model: ArtifactPageModel;
}>();

const uiStore = useUiStore();

function onPerPageChange(event: Event) {
  const target = event.target as HTMLSelectElement | null;
  if (!target) return;
  uiStore.setArtifactPageSize(props.model.pageKey, Number(target.value));
}

const copy = computed(() => getArtifactPageCopy(props.model));
const visibleItems = computed(() => getVisibleArtifactItems(props.model));
const filteredItems = computed(() => getFilteredArtifactItems(props.model));
const pagination = computed(() => getArtifactPagination(props.model));
const perPageOptions = computed(() => getArtifactPerPageOptions());
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
const showPagination = computed(() => filteredItems.value.length > 0);

const pageKey = computed(() => props.model.pageKey);
useAutoSelectArtifact(pageKey, filteredItems);
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>{{ copy.title }}</h1>
      <p>{{ copy.intro }}</p>
    </div>
    <div v-if="model.artifactSessionFilter" class="page-intro-meta">
      <button
        class="button secondary"
        type="button"
        @click="uiStore.clearArtifactSessionFilter()"
      >
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
              <select
                :data-input="`${model.pageKey}-per-page`"
                :value="model.perPage"
                @change="onPerPageChange"
              >
                <option v-for="option in perPageOptions" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>
            </label>
            <div class="pagination-controls">
              <button
                class="button secondary"
                type="button"
                :disabled="pagination.currentPage <= 1"
                @click="uiStore.prevArtifactPage(model.pageKey)"
              >
                Prev
              </button>
              <span class="pagination-info">
                {{ pagination.currentPage }} / {{ pagination.totalPages }}
              </span>
              <button
                class="button secondary"
                type="button"
                :disabled="pagination.currentPage >= pagination.totalPages"
                @click="uiStore.nextArtifactPage(model.pageKey)"
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

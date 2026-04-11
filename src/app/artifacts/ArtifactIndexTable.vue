<script setup lang="ts">
import { computed } from "vue";
import type { ArtifactItem, ArtifactPageModel } from "./artifactsPage";
import {
  getArtifactColumns,
  getSessionForArtifact,
  getVisibleArtifactItems,
} from "./artifactsPage";
import { formatBytes, formatDateTime, titleCase } from "../../lib/format.js";

const props = defineProps<{
  model: ArtifactPageModel;
}>();

const columns = computed(() => getArtifactColumns(props.model.pageKey));
const items = computed(() => getVisibleArtifactItems(props.model));
const tableClassName = computed(() => [
  "data-table",
  "artifact-table",
  `artifact-table--${props.model.pageKey}`,
]);

function rowClassName(item: ArtifactItem): string {
  return props.model.selectedArtifacts[props.model.pageKey] === item.filename ? "selected" : "";
}

function browserLabel(item: ArtifactItem): string {
  const session = getSessionForArtifact(props.model, item);
  return titleCase(session ? session.browser : item.browser);
}

function createdLabel(item: ArtifactItem): string {
  return item.createdAt ? formatDateTime(item.createdAt, props.model.preferences) : "—";
}
</script>

<template>
  <div class="table-shell">
    <table :class="tableClassName">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.label">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="`${item.sessionId}:${item.filename}`"
          :class="rowClassName(item)"
          data-action="select-artifact"
          :data-filename="item.filename"
          :data-page="model.pageKey"
        >
          <td class="artifact-table__truncate-cell" :title="item.filename">
            <span class="artifact-table__truncate mono">{{ item.filename }}</span>
          </td>
          <td class="artifact-table__truncate-cell" :title="item.sessionId">
            <span class="artifact-table__truncate mono">{{ item.sessionId }}</span>
          </td>
          <td>{{ browserLabel(item) }}</td>
          <td v-if="model.pageKey === 'videos'">{{ titleCase(item.protocol) }}</td>
          <td>{{ createdLabel(item) }}</td>
          <td class="mono">{{ formatBytes(item.size) }}</td>
          <td class="artifact-table__action-cell">
            <button
              class="button secondary"
              data-action="select-artifact"
              :data-filename="item.filename"
              :data-page="model.pageKey"
              type="button"
            >
              Inspect
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

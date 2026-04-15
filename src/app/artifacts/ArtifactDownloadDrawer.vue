<script setup lang="ts">
import { computed } from "vue";
import type { DownloadArtifact } from "../../data/service";
import { formatBytes, formatDateTime, titleCase } from "../../lib/format";
import ArtifactKeyValueRow from "./ArtifactKeyValueRow.vue";
import type { ArtifactPageModel } from "./artifactsPage";
import { buildDownloadArtifactHref, getSelectedArtifact } from "./artifactsPage";
import { useClipboard } from "../composables/useClipboard";

const props = defineProps<{
  model: ArtifactPageModel;
}>();

const copy = useClipboard();
const selected = computed(() => getSelectedArtifact(props.model) as DownloadArtifact | null);
const created = computed(() =>
  selected.value?.createdAt ? formatDateTime(selected.value.createdAt, props.model.preferences) : "—",
);
</script>

<template>
  <div v-if="selected" class="artifact-drawer-body">
    <div class="key-value-list compact">
      <ArtifactKeyValueRow label="File" :value="selected.filename" />
      <ArtifactKeyValueRow label="Session" :value="selected.sessionId" />
      <ArtifactKeyValueRow label="Browser" :value="titleCase(selected.browser)" />
      <ArtifactKeyValueRow label="Created" :value="created" />
      <ArtifactKeyValueRow label="Size" :value="formatBytes(selected.size)" />
      <ArtifactKeyValueRow label="Type" :value="selected.mimeType" />
    </div>
    <div class="drawer-actions">
      <a
        class="button secondary"
        :download="selected.filename"
        :href="buildDownloadArtifactHref(selected)"
      >
        Download
      </a>
      <button
        class="button secondary"
        :data-copy="selected.filename"
        type="button"
        @click="copy(selected.filename)"
      >
        Copy filename
      </button>
    </div>
  </div>
  <p v-else class="hint-text">Select a file to inspect metadata.</p>
</template>

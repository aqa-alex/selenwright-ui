<script setup lang="ts">
import { computed } from "vue";
import type { VideoArtifact } from "../../data/service";
import { formatBytes, formatDateTime, formatDuration, titleCase } from "../../lib/format.js";
import ArtifactKeyValueRow from "./ArtifactKeyValueRow.vue";
import type { ArtifactPageModel } from "./artifactsPage";
import { getSelectedArtifact } from "./artifactsPage";

const props = defineProps<{
  model: ArtifactPageModel;
}>();

const selected = computed(() => getSelectedArtifact(props.model) as VideoArtifact | null);
const created = computed(() =>
  selected.value?.createdAt ? formatDateTime(selected.value.createdAt, props.model.preferences) : "—",
);
</script>

<template>
  <div v-if="selected" class="artifact-drawer-body">
    <div class="drawer-media-placeholder">
      <div class="video-poster">{{ selected.filename }}</div>
      <p>Preview stays paused by default. Use inspect or download as the primary action.</p>
    </div>
    <div class="key-value-list compact">
      <ArtifactKeyValueRow label="Session" :value="selected.sessionId" />
      <ArtifactKeyValueRow label="Browser" :value="titleCase(selected.browser)" />
      <ArtifactKeyValueRow label="Protocol" :value="titleCase(selected.protocol)" />
      <ArtifactKeyValueRow label="Created" :value="created" />
      <ArtifactKeyValueRow label="Duration" :value="formatDuration(selected.durationMs)" />
      <ArtifactKeyValueRow label="Size" :value="formatBytes(selected.size)" />
    </div>
    <div class="drawer-actions">
      <button
        class="button secondary"
        data-action="copy"
        :data-copy="selected.filename"
        type="button"
      >
        Copy filename
      </button>
      <button class="button secondary" type="button">Download</button>
      <button class="button danger" type="button">Delete</button>
    </div>
  </div>
  <p v-else class="hint-text">Select a video to inspect metadata.</p>
</template>

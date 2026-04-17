<script setup lang="ts">
import { computed } from "vue";
import type { VideoArtifact } from "../api";
import { formatBytes, formatDateTime, formatDuration, titleCase } from "../../lib/format";
import ArtifactKeyValueRow from "./ArtifactKeyValueRow.vue";
import type { ArtifactPageModel } from "./artifactsPage";
import { buildVideoFileApiPath, getSelectedArtifact } from "./artifactsPage";
import { useClipboard } from "../composables/useClipboard";
import { useDeleteVideoMutation } from "../queries/useDeleteVideoMutation";
import { useShellStore } from "../stores/shell";

const props = defineProps<{
  model: ArtifactPageModel;
}>();

const copy = useClipboard();
const shellStore = useShellStore();
const deleteMutation = useDeleteVideoMutation();
const selected = computed(() => getSelectedArtifact(props.model) as VideoArtifact | null);
const created = computed(() =>
  selected.value?.createdAt ? formatDateTime(selected.value.createdAt, props.model.preferences) : "—",
);
const deletePending = computed(() => deleteMutation.isPending.value);

async function onDelete() {
  const current = selected.value;
  if (!current) return;
  const confirmed =
    typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm(`Delete video ${current.filename}?`)
      : true;
  if (!confirmed) return;
  try {
    await deleteMutation.mutateAsync({ filename: current.filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    shellStore.setNotice(message);
  }
}
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
        :data-copy="selected.filename"
        type="button"
        @click="copy(selected.filename)"
      >
        Copy filename
      </button>
      <a
        class="button secondary"
        :download="selected.filename"
        :href="buildVideoFileApiPath(selected.filename)"
      >
        Download
      </a>
      <button
        class="button danger"
        :disabled="deletePending"
        type="button"
        @click="onDelete"
      >
        {{ deletePending ? "Deleting..." : "Delete" }}
      </button>
    </div>
  </div>
  <p v-else class="hint-text">Select a video to inspect metadata.</p>
</template>

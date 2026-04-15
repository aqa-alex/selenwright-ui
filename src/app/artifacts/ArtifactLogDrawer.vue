<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import type { LogArtifact } from "../api";
import type { ArtifactLogFileState, ArtifactPageModel } from "./artifactsPage";
import {
  buildLogDownloadHref,
  filterLogContent,
  getSavedLogEmptyText,
  getSavedLogState,
  getSelectedArtifact,
} from "./artifactsPage";
import { useClipboard } from "../composables/useClipboard";
import { useLogFileContentQuery } from "../queries/useLogFileContentQuery";
import { useUiStore } from "../stores/ui";

const props = defineProps<{
  model: ArtifactPageModel;
}>();

const uiStore = useUiStore();
const copy = useClipboard();
const logViewer = useTemplateRef<HTMLPreElement>("logViewer");

function onLogSearchInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  uiStore.setLogSearch(target.value);
}

const selected = computed(() => getSelectedArtifact(props.model) as LogArtifact | null);
const selectedFilename = computed(() => selected.value?.filename || "");
const cachedLogState = computed<ArtifactLogFileState>(() =>
  selected.value
    ? getSavedLogState(props.model, selected.value.filename)
    : { content: "", error: "", loaded: false, loading: false },
);

const logFileQuery = useLogFileContentQuery(selectedFilename, {
  enabled: computed(
    () =>
      typeof window !== "undefined" &&
      Boolean(selectedFilename.value) &&
      !cachedLogState.value.loaded &&
      !cachedLogState.value.loading &&
      !cachedLogState.value.error,
  ),
});

const queryError = computed(() =>
  logFileQuery.error.value instanceof Error ? logFileQuery.error.value.message : "",
);
const logState = computed<ArtifactLogFileState>(() => {
  const cached = cachedLogState.value;
  if (cached.loaded || cached.loading || cached.error || cached.content) {
    return cached;
  }
  return {
    content: typeof logFileQuery.data.value === "string" ? logFileQuery.data.value : "",
    error: queryError.value,
    loaded: logFileQuery.isSuccess.value,
    loading: logFileQuery.isFetching.value,
  };
});
const filteredContent = computed(() =>
  selected.value ? filterLogContent(logState.value.content, props.model.logSearch) : "",
);
const hasContent = computed(() => Boolean(filteredContent.value));

function refetchLog() {
  void logFileQuery.refetch();
}

function jumpToEnd() {
  const viewer = logViewer.value;
  if (viewer) {
    viewer.scrollTop = viewer.scrollHeight;
  }
}
</script>

<template>
  <div v-if="selected" class="artifact-drawer-body">
    <div class="drawer-toolbar">
      <label class="search-field compact">
        <input
          aria-label="Search inside log"
          placeholder="Search inside log"
          type="search"
          :value="model.logSearch"
          @input="onLogSearchInput"
        />
      </label>
      <div class="log-toolbar-spacer"></div>
    </div>
    <div class="drawer-actions">
      <button
        class="button secondary"
        :data-filename="selected.filename"
        :disabled="!hasContent"
        type="button"
        @click="copy(logState.content)"
      >
        Copy block
      </button>
      <button class="button secondary" type="button" @click="jumpToEnd">
        Jump to end
      </button>
      <button
        v-if="logState.error"
        class="button secondary"
        type="button"
        @click="refetchLog"
      >
        Retry
      </button>
      <a
        class="button secondary"
        :download="selected.filename"
        :href="buildLogDownloadHref(selected.filename)"
      >
        Download
      </a>
    </div>
    <div v-if="logState.loading" class="note-block">
      Loading {{ selected.filename }}&hellip;
    </div>
    <div v-if="logState.error" class="note-block log-note-error">
      {{ logState.error }}
    </div>
    <pre
      v-if="hasContent"
      ref="logViewer"
      class="code-block log-viewer wrap"
      id="log-viewer-content"
    >{{ filteredContent }}</pre>
    <p v-else class="hint-text">
      {{ getSavedLogEmptyText(logState, model.logSearch) }}
    </p>
  </div>
  <p v-else class="hint-text">Select a log file to inspect it.</p>
</template>

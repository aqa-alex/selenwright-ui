<script setup lang="ts">
import { computed } from "vue";
import type { LogArtifact } from "../../data/service";
import type { ArtifactPageModel } from "./artifactsPage";
import {
  buildLogDownloadHref,
  filterLogContent,
  getSavedLogEmptyText,
  getSavedLogState,
  getSelectedArtifact,
} from "./artifactsPage";

const props = defineProps<{
  model: ArtifactPageModel;
}>();

const selected = computed(() => getSelectedArtifact(props.model) as LogArtifact | null);
const logState = computed(() =>
  selected.value
    ? getSavedLogState(props.model, selected.value.filename)
    : { content: "", error: "", loaded: false, loading: false },
);
const filteredContent = computed(() =>
  selected.value ? filterLogContent(logState.value.content, props.model.logSearch) : "",
);
const hasContent = computed(() => Boolean(filteredContent.value));
</script>

<template>
  <div v-if="selected" class="artifact-drawer-body">
    <div class="drawer-toolbar">
      <label class="search-field compact">
        <input
          aria-label="Search inside log"
          data-input="log-search"
          placeholder="Search inside log"
          type="search"
          :value="model.logSearch"
        />
      </label>
      <div class="log-toolbar-spacer"></div>
    </div>
    <div class="drawer-actions">
      <button
        class="button secondary"
        :disabled="!hasContent"
        data-action="copy-log-content"
        :data-filename="selected.filename"
        type="button"
      >
        Copy block
      </button>
      <button class="button secondary" data-action="jump-log-end" type="button">
        Jump to end
      </button>
      <button
        v-if="logState.error"
        class="button secondary"
        data-action="retry-log-file"
        :data-filename="selected.filename"
        type="button"
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
      class="code-block log-viewer wrap"
      data-log-viewer
      id="log-viewer-content"
    >{{ filteredContent }}</pre>
    <p v-else class="hint-text">
      {{ getSavedLogEmptyText(logState, model.logSearch) }}
    </p>
  </div>
  <p v-else class="hint-text">Select a log file to inspect it.</p>
</template>

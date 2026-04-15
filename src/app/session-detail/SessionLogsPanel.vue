<script setup lang="ts">
import { computed } from "vue";
import type { ConsoleSession } from "../../data/service";
import type { SessionDetailLogFileState, SessionDetailPageModel } from "./sessionDetail";
import {
  buildLogDownloadHref,
  filterLogContent,
  getLiveLogEmptyText,
  getLiveLogStatusText,
  getMissingSessionLogText,
  getSavedLogEmptyText,
  getSavedLogState,
} from "./sessionDetail";
import { useOpenArtifactPage } from "../composables/useOpenArtifactPage";
import { useLogFileContentQuery } from "../queries/useLogFileContentQuery";
import { useUiStore } from "../stores/ui";

const props = defineProps<{
  model: SessionDetailPageModel;
  session: ConsoleSession;
}>();

const uiStore = useUiStore();
const openArtifactPage = useOpenArtifactPage();

function onLogSearchInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  uiStore.setLogSearch(target.value);
}

const liveState = computed(() =>
  props.model.liveLogs.sessionId === props.session.id ? props.model.liveLogs : null,
);
const liveContent = computed(() => liveState.value?.content || "");
const showReconnect = computed(
  () =>
    props.session.artifacts.liveLogs &&
    liveState.value &&
    ["closed", "error", "reconnecting"].includes(liveState.value.status),
);
const showLivePanel = computed(() => {
  if (props.session.artifacts.liveLogs) {
    return true;
  }

  return Boolean(
    liveState.value?.source === "live" &&
      (liveState.value.content ||
        liveState.value.status === "inactive" ||
        liveState.value.status === "closed" ||
        liveState.value.status === "error"),
  );
});

const filename = computed(() => props.session.metadata.logFilename);
const cachedLogState = computed(() => getSavedLogState(props.model, filename.value));
const savedLogQuery = useLogFileContentQuery(filename, {
  enabled: computed(
    () =>
      typeof window !== "undefined" &&
      props.session.artifacts.savedLogs &&
      !props.session.artifacts.liveLogs &&
      !cachedLogState.value.loaded &&
      !cachedLogState.value.loading &&
      !cachedLogState.value.error,
  ),
});

const queryError = computed(() =>
  savedLogQuery.error.value instanceof Error ? savedLogQuery.error.value.message : "",
);
const effectiveLogState = computed<SessionDetailLogFileState>(() => {
  const cached = cachedLogState.value;
  if (cached.loaded || cached.loading || cached.error || cached.content) {
    return cached;
  }

  return {
    content: typeof savedLogQuery.data.value === "string" ? savedLogQuery.data.value : "",
    error: queryError.value,
    loaded: savedLogQuery.isSuccess.value,
    loading: savedLogQuery.isFetching.value,
  };
});
const filteredContent = computed(() =>
  filterLogContent(effectiveLogState.value.content, props.model.logSearch),
);
const hasContent = computed(() => Boolean(filteredContent.value));

function refetchLog() {
  void savedLogQuery.refetch();
}
</script>

<template>
  <div v-if="showLivePanel" class="log-preview-panel" id="session-logs-panel">
    <div class="log-preview-header">
      <span>Live stream</span>
      <div class="panel-actions">
        <button
          v-if="session.artifacts.savedLogs"
          class="button secondary"
          type="button"
          @click="openArtifactPage('logs', session.id)"
        >
          Open saved log
        </button>
      </div>
    </div>
    <div class="drawer-toolbar">
      <div class="log-toolbar-status">
        <strong>{{ session.id }}</strong>
        <span>{{ getLiveLogStatusText(liveState) }}</span>
      </div>
    </div>
    <div class="drawer-actions">
      <button
        class="button secondary"
        :disabled="!liveContent"
        data-action="copy-log-content"
        type="button"
      >
        Copy block
      </button>
      <button class="button secondary" data-action="jump-log-end" type="button">
        Jump to end
      </button>
      <button
        v-if="showReconnect"
        class="button secondary"
        data-action="reconnect-live-log"
        type="button"
      >
        Reconnect
      </button>
    </div>
    <div v-if="liveState?.error" class="note-block log-note-error">
      {{ liveState.error }}
    </div>
    <p v-if="!liveContent" class="hint-text">{{ getLiveLogEmptyText(liveState) }}</p>
    <pre
      class="code-block log-viewer wrap"
      :data-live-log-viewer="session.id"
      data-log-viewer
      id="log-viewer-content"
    >{{ liveContent }}</pre>
  </div>

  <div
    v-else-if="session.artifacts.savedLogs"
    class="log-preview-panel"
    id="session-logs-panel"
  >
    <div class="log-preview-header">
      <span>{{ filename }}</span>
      <div class="panel-actions">
        <button
          class="button secondary"
          type="button"
          @click="openArtifactPage('logs', session.id)"
        >
          Open logs
        </button>
      </div>
    </div>
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
        :data-copy="effectiveLogState.content"
        :disabled="!hasContent"
        data-action="copy"
        type="button"
      >
        Copy block
      </button>
      <button class="button secondary" data-action="jump-log-end" type="button">
        Jump to end
      </button>
      <button
        v-if="effectiveLogState.error"
        class="button secondary"
        data-action="retry-log-file"
        :data-filename="filename"
        type="button"
        @click="refetchLog"
      >
        Retry
      </button>
      <a class="button secondary" :download="filename" :href="buildLogDownloadHref(filename)">
        Download
      </a>
    </div>
    <div v-if="effectiveLogState.loading" class="note-block">Loading {{ filename }}&hellip;</div>
    <div v-if="effectiveLogState.error" class="note-block log-note-error">
      {{ effectiveLogState.error }}
    </div>
    <pre
      v-if="hasContent"
      class="code-block log-viewer wrap"
      data-log-viewer
      id="log-viewer-content"
    >{{ filteredContent }}</pre>
    <p v-else class="hint-text">
      {{ getSavedLogEmptyText(effectiveLogState, model.logSearch) }}
    </p>
  </div>

  <div v-else class="log-preview-panel" id="session-logs-panel">
    <div class="log-preview-header">
      <span>No log source</span>
    </div>
    <p class="hint-text">{{ getMissingSessionLogText(session) }}</p>
  </div>
</template>

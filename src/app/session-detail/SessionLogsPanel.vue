<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, nextTick, useTemplateRef, watch } from "vue";
import type { ConsoleSession } from "../api";
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
import { useClipboard } from "../composables/useClipboard";
import { useLiveLog } from "../composables/useLiveLog";
import { useOpenArtifactPage } from "../composables/useOpenArtifactPage";
import { useLogFileContentQuery } from "../queries/useLogFileContentQuery";
import { useConsoleStore } from "../stores/console";
import { useUiStore } from "../stores/ui";

const props = defineProps<{
  model: SessionDetailPageModel;
  session: ConsoleSession;
}>();

const uiStore = useUiStore();
const consoleStore = useConsoleStore();
const { liveLogs: liveLogsRef } = storeToRefs(consoleStore);
const openArtifactPage = useOpenArtifactPage();
const copy = useClipboard();
const sessionIdForLiveLog = computed(() =>
  props.session.artifacts.liveLogs ? props.session.id : null,
);
const { reconnect } = useLiveLog(sessionIdForLiveLog);

function onLogSearchInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  uiStore.setLogSearch(target.value);
}

const liveState = computed(() =>
  liveLogsRef.value.sessionId === props.session.id ? liveLogsRef.value : null,
);
const liveContent = computed(() => liveState.value?.content || "");
const liveViewer = useTemplateRef<HTMLPreElement>("liveViewer");
const savedViewer = useTemplateRef<HTMLPreElement>("savedViewer");

function isViewerNearEnd(viewer: HTMLElement) {
  return viewer.scrollHeight - (viewer.scrollTop + viewer.clientHeight) <= 24;
}

function onLiveScroll(event: Event) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  consoleStore.setLiveLogAutoScroll(isViewerNearEnd(target));
}

function jumpLiveToEnd() {
  consoleStore.setLiveLogAutoScroll(true);
  const viewer = liveViewer.value;
  if (viewer) {
    viewer.scrollTop = viewer.scrollHeight;
  }
}

function jumpSavedToEnd() {
  const viewer = savedViewer.value;
  if (viewer) {
    viewer.scrollTop = viewer.scrollHeight;
  }
}

watch(liveContent, async () => {
  if (!liveLogsRef.value.autoScroll) return;
  await nextTick();
  const viewer = liveViewer.value;
  if (viewer) {
    viewer.scrollTop = viewer.scrollHeight;
  }
});
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
        type="button"
        @click="copy(liveContent)"
      >
        Copy block
      </button>
      <button class="button secondary" type="button" @click="jumpLiveToEnd">
        Jump to end
      </button>
      <button
        v-if="showReconnect"
        class="button secondary"
        type="button"
        @click="reconnect"
      >
        Reconnect
      </button>
    </div>
    <div v-if="liveState?.error" class="note-block log-note-error">
      {{ liveState.error }}
    </div>
    <p v-if="!liveContent" class="hint-text">{{ getLiveLogEmptyText(liveState) }}</p>
    <pre
      ref="liveViewer"
      class="code-block log-viewer wrap"
      id="log-viewer-content"
      @scroll="onLiveScroll"
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
        type="button"
        @click="copy(effectiveLogState.content)"
      >
        Copy block
      </button>
      <button class="button secondary" type="button" @click="jumpSavedToEnd">
        Jump to end
      </button>
      <button
        v-if="effectiveLogState.error"
        class="button secondary"
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
      ref="savedViewer"
      class="code-block log-viewer wrap"
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

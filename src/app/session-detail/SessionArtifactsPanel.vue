<script setup lang="ts">
import { computed } from "vue";
import type { ConsoleSession } from "../../data/service";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import { useOpenArtifactPage } from "../composables/useOpenArtifactPage";

const props = defineProps<{
  session: ConsoleSession;
}>();

const openArtifactPage = useOpenArtifactPage();

const logValue = computed(() => {
  if (props.session.artifacts.savedLogs) {
    return props.session.metadata.logFilename || `${props.session.id}.log`;
  }

  if (props.session.artifacts.liveLogs) {
    return "Live stream available";
  }

  return "Unavailable";
});
</script>

<template>
  <ConsolePanel title="Artifacts">
    <div class="artifact-list">
      <div class="artifact-row">
        <div>
          <strong>Video</strong>
          <span>{{ session.artifacts.video ? `${session.id}.mp4` : "Unavailable" }}</span>
        </div>
        <button
          v-if="session.artifacts.video"
          class="button secondary"
          type="button"
          @click="openArtifactPage('videos', session.id)"
        >
          Open
        </button>
        <span v-else class="secondary-text">Unavailable</span>
      </div>
      <div class="artifact-row">
        <div>
          <strong>Logs</strong>
          <span>{{ logValue }}</span>
        </div>
        <button
          v-if="session.artifacts.savedLogs"
          class="button secondary"
          type="button"
          @click="openArtifactPage('logs', session.id)"
        >
          Open
        </button>
        <span v-else-if="session.artifacts.liveLogs" class="secondary-text">Live in detail</span>
        <span v-else class="secondary-text">Unavailable</span>
      </div>
      <div class="artifact-row">
        <div>
          <strong>Downloads</strong>
          <span>{{ session.artifacts.downloads > 0 ? `${session.artifacts.downloads} files` : "None" }}</span>
        </div>
        <button
          v-if="session.artifacts.downloads > 0"
          class="button secondary"
          type="button"
          @click="openArtifactPage('downloads', session.id)"
        >
          Open
        </button>
        <span v-else class="secondary-text">Unavailable</span>
      </div>
      <div class="artifact-row">
        <div>
          <strong>Clipboard</strong>
          <span>{{ session.artifacts.clipboard ? "Snapshot available" : "Unavailable" }}</span>
        </div>
      </div>
      <div class="artifact-row">
        <div>
          <strong>DevTools</strong>
          <span>{{ session.artifacts.devtools ? "Endpoint available" : "Unavailable" }}</span>
        </div>
      </div>
    </div>
  </ConsolePanel>
</template>

<script setup lang="ts">
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import SessionsTable from "../sessions/SessionsTable.vue";
import SessionsToolbar from "../sessions/SessionsToolbar.vue";
import type { SessionsPageModel } from "../sessions/sessionTable";
import { getFilteredSessionsForState } from "../sessions/sessionTable";
import { useSessionsStore } from "../stores/sessions";
import { computed } from "vue";

const props = defineProps<{
  model: SessionsPageModel;
}>();

const sessionsStore = useSessionsStore();
const hasSessions = computed(() => props.model.sessions.length > 0);
const filteredSessions = computed(() =>
  getFilteredSessionsForState(props.model.sessions, props.model.filters),
);
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Sessions</h1>
      <p>Active and recent browser sessions.</p>
    </div>
  </div>
  <p v-if="!hasSessions" class="page-empty-copy">No active sessions</p>
  <ConsolePanel v-else title="Session list">
    <SessionsToolbar :filters="model.filters" :sessions="model.sessions" />
    <SessionsTable v-if="filteredSessions.length" :model="model" />
    <div v-else class="empty-state">
      <h2>No matching sessions</h2>
      <p>No sessions match the current filters.</p>
      <button class="button secondary" type="button" @click="sessionsStore.resetFilters()">
        Reset filters
      </button>
    </div>
  </ConsolePanel>
</template>

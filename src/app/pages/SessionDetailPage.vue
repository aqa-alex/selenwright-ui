<script setup lang="ts">
import { computed } from "vue";
import { formatStatus } from "../../lib/format.js";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";
import ProtocolBadge from "../session-detail/ProtocolBadge.vue";
import SessionArtifactsPanel from "../session-detail/SessionArtifactsPanel.vue";
import SessionLogsPanel from "../session-detail/SessionLogsPanel.vue";
import SessionOverviewPanel from "../session-detail/SessionOverviewPanel.vue";
import type { SessionDetailPageModel } from "../session-detail/sessionDetail";
import {
  buildSessionDisplayName,
  buildSessionSummary,
  buildVncViewerHref,
  canTerminateSession,
  isTerminatePending,
} from "../session-detail/sessionDetail";

const props = defineProps<{
  model: SessionDetailPageModel;
}>();

const session = computed(() => props.model.session);
const terminatePending = computed(() =>
  session.value ? isTerminatePending(session.value, props.model.terminatingSessionId) : false,
);
const terminateEnabled = computed(() =>
  session.value ? canTerminateSession(session.value, props.model.terminatingSessionId) : false,
);
</script>

<template>
  <template v-if="session">
    <div class="page-intro">
      <div>
        <h1>{{ buildSessionDisplayName(session) }}</h1>
        <p>{{ buildSessionSummary(session, formatStatus(session.status)) }}</p>
      </div>
      <div class="page-intro-meta">
        <ProtocolBadge :protocol="session.protocol" />
        <StatusBadge :label="formatStatus(session.status)" :status="session.status" />
      </div>
    </div>
    <div class="detail-header-row">
      <div class="detail-header-actions">
        <a
          v-if="session.artifacts.vnc"
          class="button secondary"
          :href="buildVncViewerHref(session)"
          rel="noreferrer"
          target="_blank"
        >
          Open VNC
        </a>
        <button v-else class="button secondary" disabled type="button">VNC</button>
        <button
          v-if="session.artifacts.devtools"
          class="button secondary"
          data-action="copy"
          :data-copy="session.metadata.devtoolsEndpoint"
          type="button"
        >
          Copy DevTools endpoint
        </button>
        <button
          class="button danger"
          data-action="terminate-session"
          :data-session-id="session.id"
          :disabled="!terminateEnabled"
          type="button"
        >
          {{ terminatePending ? "Terminating..." : "Terminate" }}
        </button>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-main stack-layout">
        <SessionOverviewPanel :preferences="model.preferences" :session="session" />
        <SessionArtifactsPanel :session="session" />
      </div>
      <aside class="detail-side stack-layout">
        <ConsolePanel title="Logs">
          <SessionLogsPanel :model="model" :session="session" />
        </ConsolePanel>
      </aside>
    </div>
  </template>

  <template v-else>
    <div class="page-intro">
      <div>
        <h1>Session not found</h1>
        <p>The requested session could not be located.</p>
      </div>
    </div>
    <ConsolePanel title="Missing session">
      <div class="empty-state">
        <h2>Unknown session</h2>
        <p>The session id is not present in the current dataset.</p>
        <a class="button secondary" data-link href="/sessions">Back to sessions</a>
      </div>
    </ConsolePanel>
  </template>
</template>

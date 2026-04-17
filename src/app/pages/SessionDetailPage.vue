<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { formatStatus } from "../../lib/format";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import StatusBadge from "../components/ui/StatusBadge.vue";
import ProtocolBadge from "../session-detail/ProtocolBadge.vue";
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
import { useClipboard } from "../composables/useClipboard";
import { useTerminateSessionMutation } from "../queries/useTerminateSessionMutation";
import { useConsoleStore } from "../stores/console";
import { useIdentityStore } from "../stores/identity";
import { useShellStore } from "../stores/shell";
import type { TerminateProtocol } from "../api";

const props = defineProps<{
  model: SessionDetailPageModel;
}>();

const consoleStore = useConsoleStore();
const { terminatingSessionId } = storeToRefs(consoleStore);
const identityStore = useIdentityStore();
const terminateMutation = useTerminateSessionMutation();
const router = useRouter();
const copy = useClipboard();
const shellStore = useShellStore();

const session = computed(() => props.model.session);
const terminatePending = computed(() =>
  session.value ? isTerminatePending(session.value, terminatingSessionId.value) : false,
);
const canManage = computed(() =>
  session.value ? identityStore.canManageSession(session.value) : false,
);
const terminateEnabled = computed(() =>
  session.value
    ? canTerminateSession(session.value, terminatingSessionId.value) && canManage.value
    : false,
);
const terminateTitle = computed(() => {
  if (!canManage.value && session.value) {
    return "You can only terminate your own sessions";
  }
  return undefined;
});

function toTerminateProtocol(protocol: string): TerminateProtocol | null {
  return protocol === "selenium" || protocol === "playwright" ? protocol : null;
}

async function terminate() {
  const current = session.value;
  if (!current) return;
  const proto = toTerminateProtocol(current.protocol);
  if (!proto) return;
  const confirmed =
    typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm(`Terminate session ${current.name}?`)
      : true;
  if (!confirmed) return;
  try {
    await terminateMutation.mutateAsync({ id: current.id, protocol: proto });
    void router.replace("/sessions");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terminate failed";
    shellStore.setNotice(message);
  }
}
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
          rel="noopener noreferrer"
          target="_blank"
        >
          Open VNC
        </a>
        <button v-else class="button secondary" disabled type="button">VNC</button>
        <button
          v-if="session.artifacts.devtools"
          class="button secondary"
          :data-copy="session.metadata.devtoolsEndpoint"
          type="button"
          @click="copy(session.metadata.devtoolsEndpoint)"
        >
          Copy DevTools endpoint
        </button>
        <button
          class="button danger"
          :data-session-id="session.id"
          :disabled="!terminateEnabled"
          :title="terminateTitle"
          type="button"
          @click="terminate"
        >
          {{ terminatePending ? "Terminating..." : "Terminate" }}
        </button>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-main stack-layout">
        <SessionOverviewPanel :preferences="model.preferences" :session="session" />
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

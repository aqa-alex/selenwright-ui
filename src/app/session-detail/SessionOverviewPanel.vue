<script setup lang="ts">
import type { ConsoleSession } from "../../data/service";
import { formatDateTimeLong, formatDuration, timeAgo } from "../../lib/format";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import { titleCaseSessionValue } from "../sessions/sessionTable";
import type { SessionDetailPreferences } from "./sessionDetail";
import ArtifactIndicators from "./ArtifactIndicators.vue";
import ProtocolBadge from "./ProtocolBadge.vue";

defineProps<{
  preferences: SessionDetailPreferences;
  session: ConsoleSession;
}>();
</script>

<template>
  <ConsolePanel title="Overview">
    <dl class="overview-grid">
      <div class="overview-row">
        <dt>Session ID</dt>
        <dd><span class="mono">{{ session.id }}</span></dd>
      </div>
      <div class="overview-row">
        <dt>Protocol</dt>
        <dd><ProtocolBadge :protocol="session.protocol" /></dd>
      </div>
      <div class="overview-row">
        <dt>Browser</dt>
        <dd>{{ titleCaseSessionValue(session.browser) }} {{ session.browserVersion }}</dd>
      </div>
      <div class="overview-row">
        <dt>Started</dt>
        <dd>{{ formatDateTimeLong(session.startedAt, preferences) }}</dd>
      </div>
      <div class="overview-row">
        <dt>Duration</dt>
        <dd>
          <span
            class="mono"
            :data-duration-finished-at="session.finishedAt || ''"
            :data-duration-started-at="session.startedAt"
          >
            {{ formatDuration(session.durationMs) }}
          </span>
        </dd>
      </div>
      <div class="overview-row">
        <dt>Last activity</dt>
        <dd>
          <span :data-time-ago="session.lastActivityAt">
            {{ timeAgo(session.lastActivityAt) }}
          </span>
        </dd>
      </div>
      <div class="overview-row">
        <dt>Quota</dt>
        <dd>{{ session.metadata.quota }}</dd>
      </div>
      <div class="overview-row">
        <dt>Artifacts</dt>
        <dd><ArtifactIndicators :session="session" /></dd>
      </div>
    </dl>
  </ConsolePanel>
</template>

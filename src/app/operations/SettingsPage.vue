<script setup lang="ts">
import { computed } from "vue";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import SegmentedControl from "../components/ui/SegmentedControl.vue";
import type { OperationsPageModel } from "./operationsPage";

const props = defineProps<{
  model: OperationsPageModel;
}>();

const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const densityOptions = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];
const detailPanelOptions = [
  { value: "collapsed", label: "Collapsed" },
  { value: "expanded", label: "Expanded" },
];
const timezoneOptions = [
  { value: "local", label: "Local" },
  { value: "utc", label: "UTC" },
];
const timeFormatOptions = [
  { value: "24h", label: "24h" },
  { value: "12h", label: "12h" },
];

const artifactHistory = computed(() => props.model.settings.artifactHistory);
const artifactHistoryUi = computed(() => props.model.artifactHistoryUi);
const retentionValue = computed(() =>
  artifactHistoryUi.value.loaded
    ? artifactHistoryUi.value.draftRetentionDays
    : String(artifactHistory.value.retentionDays),
);
const controlsDisabled = computed(
  () => artifactHistoryUi.value.saving || !artifactHistory.value.available,
);
const enableSelected = computed(() => artifactHistoryUi.value.draftEnabled);
const backendValueLabel = computed(
  () =>
    `${artifactHistory.value.enabled ? "enabled" : "disabled"}, ${artifactHistory.value.retentionDays} days`,
);
const unavailableReason = computed(
  () =>
    artifactHistory.value.reason ||
    "Artifact history is unavailable with the current backend setup.",
);
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Settings</h1>
      <p>Theme, density, and viewer preferences.</p>
    </div>
  </div>
  <div class="stack-layout">
    <ConsolePanel title="Theme mode">
      <p class="hint-text">Follow system theme or override it manually.</p>
      <SegmentedControl
        action="set-theme"
        :options="themeOptions"
        :selected-value="model.preferences.themeMode"
      />
    </ConsolePanel>
    <ConsolePanel title="Density">
      <p class="hint-text">Compact keeps the sessions list denser without collapsing readability.</p>
      <SegmentedControl
        action="set-density"
        :options="densityOptions"
        :selected-value="model.preferences.density"
      />
    </ConsolePanel>
    <ConsolePanel title="Viewer behavior">
      <div class="settings-grid">
        <div>
          <h3>Detail panels</h3>
          <SegmentedControl
            action="set-detail-panel"
            :options="detailPanelOptions"
            :selected-value="model.preferences.detailPanel || 'collapsed'"
          />
        </div>
        <div>
          <h3>Timezone</h3>
          <SegmentedControl
            action="set-timezone"
            :options="timezoneOptions"
            :selected-value="model.preferences.timezone || 'local'"
          />
        </div>
        <div>
          <h3>Time format</h3>
          <SegmentedControl
            action="set-time-format"
            :options="timeFormatOptions"
            :selected-value="model.preferences.timeFormat || '24h'"
          />
        </div>
      </div>
    </ConsolePanel>
    <ConsolePanel title="Artifact History">
      <div class="settings-grid">
        <div class="settings-field">
          <h3>Retention mode</h3>
          <p class="hint-text">Persist downloads and saved session artifacts after sessions end.</p>
          <div
            :class="['segmented-control', { 'is-disabled': controlsDisabled }]"
            role="group"
            aria-label="Artifact history toggle"
          >
            <button
              :class="['segmented-option', { selected: !enableSelected }]"
              data-action="set-artifact-history-enabled"
              data-value="disabled"
              :disabled="controlsDisabled"
              type="button"
            >
              Disabled
            </button>
            <button
              :class="['segmented-option', { selected: enableSelected }]"
              data-action="set-artifact-history-enabled"
              data-value="enabled"
              :disabled="controlsDisabled"
              type="button"
            >
              Enabled
            </button>
          </div>
        </div>
        <div class="settings-field">
          <h3>Retention days</h3>
          <p class="hint-text">Keep history for 1 to 365 whole days.</p>
          <label
            :class="[
              'search-field',
              'compact',
              'settings-number-field',
              { 'is-disabled': controlsDisabled },
            ]"
          >
            <input
              data-input="artifact-history-retention-days"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="7"
              :disabled="controlsDisabled"
              type="text"
              :value="retentionValue"
            />
          </label>
        </div>
      </div>
      <div class="settings-status-stack">
        <div class="drawer-actions settings-actions">
          <button
            class="button"
            data-action="save-artifact-history-settings"
            :disabled="controlsDisabled || !artifactHistoryUi.dirty"
            type="button"
          >
            {{ artifactHistoryUi.saving ? "Saving…" : "Save settings" }}
          </button>
          <span class="secondary-text">Current backend value: {{ backendValueLabel }}</span>
        </div>
        <div
          v-if="!artifactHistory.available"
          class="note-block settings-status-callout"
        >
          {{ unavailableReason }}
        </div>
        <div
          v-if="artifactHistoryUi.error"
          class="note-block log-note-error settings-status-callout"
        >
          {{ artifactHistoryUi.error }}
        </div>
      </div>
    </ConsolePanel>
    <ConsolePanel title="Connection">
      <div class="key-value-list compact">
        <div class="copyable-row">
          <span>Data source</span>
          <strong>{{ model.connection.mode === "live" ? "Live" : model.connection.mode }}</strong>
        </div>
        <div class="copyable-row">
          <span>Target</span>
          <strong class="mono">{{ model.connection.target }}</strong>
        </div>
      </div>
    </ConsolePanel>
  </div>
</template>

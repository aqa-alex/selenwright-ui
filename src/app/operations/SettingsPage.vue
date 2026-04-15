<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import SegmentedControl from "../components/ui/SegmentedControl.vue";
import {
  type Density,
  type DetailPanel,
  type ThemeMode,
  type TimeFormat,
  type Timezone,
  usePreferencesStore,
} from "../stores/preferences";
import { useSettingsStore } from "../stores/settings";
import { requestSaveArtifactHistory } from "../lib/handlers";
import type { OperationsPageModel } from "./operationsPage";

const props = defineProps<{
  model: OperationsPageModel;
}>();

const settingsStore = useSettingsStore();

const preferencesStore = usePreferencesStore();
const { density, detailPanel, themeMode, timeFormat, timezone } = storeToRefs(preferencesStore);

const themeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const densityOptions: Array<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];
const detailPanelOptions: Array<{ value: DetailPanel; label: string }> = [
  { value: "collapsed", label: "Collapsed" },
  { value: "expanded", label: "Expanded" },
];
const timezoneOptions: Array<{ value: Timezone; label: string }> = [
  { value: "local", label: "Local" },
  { value: "utc", label: "UTC" },
];
const timeFormatOptions: Array<{ value: TimeFormat; label: string }> = [
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
        :options="themeOptions"
        :selected-value="themeMode"
        @select="(value) => preferencesStore.setThemeMode(value as ThemeMode)"
      />
    </ConsolePanel>
    <ConsolePanel title="Density">
      <p class="hint-text">Compact keeps the sessions list denser without collapsing readability.</p>
      <SegmentedControl
        :options="densityOptions"
        :selected-value="density"
        @select="(value) => preferencesStore.setDensity(value as Density)"
      />
    </ConsolePanel>
    <ConsolePanel title="Viewer behavior">
      <div class="settings-grid">
        <div>
          <h3>Detail panels</h3>
          <SegmentedControl
            :options="detailPanelOptions"
            :selected-value="detailPanel"
            @select="(value) => preferencesStore.setDetailPanel(value as DetailPanel)"
          />
        </div>
        <div>
          <h3>Timezone</h3>
          <SegmentedControl
            :options="timezoneOptions"
            :selected-value="timezone"
            @select="(value) => preferencesStore.setTimezone(value as Timezone)"
          />
        </div>
        <div>
          <h3>Time format</h3>
          <SegmentedControl
            :options="timeFormatOptions"
            :selected-value="timeFormat"
            @select="(value) => preferencesStore.setTimeFormat(value as TimeFormat)"
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
              :disabled="controlsDisabled"
              type="button"
              @click="settingsStore.setHistoryEnabled(false)"
            >
              Disabled
            </button>
            <button
              :class="['segmented-option', { selected: enableSelected }]"
              :disabled="controlsDisabled"
              type="button"
              @click="settingsStore.setHistoryEnabled(true)"
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
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="7"
              :disabled="controlsDisabled"
              type="text"
              :value="retentionValue"
              @input="(event) => settingsStore.setHistoryRetentionDays(((event.target as HTMLInputElement).value))"
            />
          </label>
        </div>
      </div>
      <div class="settings-status-stack">
        <div class="drawer-actions settings-actions">
          <button
            class="button"
            :disabled="controlsDisabled || !artifactHistoryUi.dirty"
            type="button"
            @click="requestSaveArtifactHistory()"
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

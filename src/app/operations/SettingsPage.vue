<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import ConsolePanel from "../components/ui/ConsolePanel.vue";
import SegmentedControl from "../components/ui/SegmentedControl.vue";
import {
  type DetailPanel,
  type ThemeMode,
  type TimeFormat,
  type Timezone,
  usePreferencesStore,
} from "../stores/preferences";
import { useSettingsStore } from "../stores/settings";
import { useSaveArtifactHistoryMutation } from "../queries/useSaveArtifactHistoryMutation";
import { useStackStatusQuery } from "../queries/useStackStatusQuery";
import { usePullStackMutation } from "../queries/usePullStackMutation";
import { useRecreateStackMutation } from "../queries/useRecreateStackMutation";
import { useCheckStackUpdatesMutation } from "../queries/useCheckStackUpdatesMutation";
import { useUpdateStackMutation } from "../queries/useUpdateStackMutation";
import { useIdentityStore } from "../stores/identity";
import type { StackVersionInfo } from "../api";
import type { OperationsPageModel } from "./operationsPage";

const props = defineProps<{
  model: OperationsPageModel;
}>();

const identityStore = useIdentityStore();
const settingsStore = useSettingsStore();
const saveArtifactHistoryMutation = useSaveArtifactHistoryMutation();
const stackStatusQuery = useStackStatusQuery();
const pullStackMutation = usePullStackMutation();
const recreateStackMutation = useRecreateStackMutation();
const checkStackUpdatesMutation = useCheckStackUpdatesMutation();
const updateStackMutation = useUpdateStackMutation();

function saveArtifactHistory() {
  const draft = settingsStore.artifactHistory;
  const retentionInput = draft.draftRetentionDays.trim();
  if (!/^\d+$/.test(retentionInput)) {
    settingsStore.setHistoryError("Retention days must be a whole number.");
    return;
  }
  const retentionDays = Number.parseInt(retentionInput, 10);
  if (retentionDays < 1 || retentionDays > 365) {
    settingsStore.setHistoryError("Retention days must stay between 1 and 365.");
    return;
  }
  saveArtifactHistoryMutation.mutate({
    enabled: draft.draftEnabled,
    retentionDays,
  });
}

const preferencesStore = usePreferencesStore();
const { detailPanel, themeMode, timeFormat, timezone } = storeToRefs(preferencesStore);

const themeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
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

const stackStatus = computed(() => stackStatusQuery.data.value ?? null);
const stackUi = computed(() => props.model.stackUi);
const stackAvailable = computed(() => stackStatus.value?.available === true);
const stackBusy = computed(
  () =>
    stackUi.value.pulling ||
    stackUi.value.recreating ||
    stackUi.value.checkingVersions ||
    stackUi.value.updating,
);
const stackPullDisabled = computed(
  () => !identityStore.effectiveAdmin || stackBusy.value,
);
const stackRecreateDisabled = computed(
  () =>
    !identityStore.effectiveAdmin ||
    !stackUi.value.pullResult?.hasUpdate ||
    stackBusy.value,
);
const stackCheckDisabled = computed(
  () => !identityStore.effectiveAdmin || stackBusy.value,
);
const versionByService = computed(() => {
  const map = new Map<string, StackVersionInfo>();
  for (const v of stackUi.value?.versions ?? []) {
    map.set(v.service, v);
  }
  return map;
});
const targetTags = ref<Record<string, string>>({});

function pullImages() {
  pullStackMutation.mutate();
}

function applyUpdate() {
  recreateStackMutation.mutate();
}

function checkUpdates() {
  checkStackUpdatesMutation.mutate();
}

function updateService(service: string) {
  const tag = targetTags.value[service];
  if (!tag) return;
  updateStackMutation.mutate({ services: { [service]: tag } });
}

watch(
  () => stackUi.value?.versions ?? null,
  (versions) => {
    if (!versions) {
      targetTags.value = {};
      return;
    }
    for (const v of versions) {
      if (v.versionCheck === "ok" && v.availableTags && v.availableTags.length > 0) {
        if (!targetTags.value[v.service] || !v.availableTags.includes(targetTags.value[v.service])) {
          targetTags.value[v.service] = v.availableTags[0];
        }
      }
    }
  },
  { immediate: true },
);

watch(
  artifactHistory,
  (settings) => {
    if (!settingsStore.artifactHistory.loaded && settings.available) {
      settingsStore.syncFromBackend({
        enabled: settings.enabled,
        retentionDays: settings.retentionDays,
      });
    }
  },
  { immediate: true },
);

watch(
  () => props.model.connection.ready,
  (ready) => {
    if (ready && settingsStore.stack.recreating) {
      settingsStore.setStackRecreating(false);
      settingsStore.resetStackPull();
      stackStatusQuery.refetch();
    }
  },
);
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Settings</h1>
      <p>Theme and viewer preferences.</p>
    </div>
  </div>
  <div class="stack-layout">
    <ConsolePanel title="Theme mode">
      <p class="hint-text">
        Follow system theme or override it manually.
      </p>
      <SegmentedControl
        :options="themeOptions"
        :selected-value="themeMode"
        @select="(value) => preferencesStore.setThemeMode(value as ThemeMode)"
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
          <p class="hint-text">
            Persist downloads and saved session artifacts after sessions end.
          </p>
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
          <p class="hint-text">
            Keep history for 1 to 365 whole days.
          </p>
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
            >
          </label>
        </div>
      </div>
      <div class="settings-status-stack">
        <div class="drawer-actions settings-actions">
          <button
            class="button"
            :disabled="controlsDisabled || !artifactHistoryUi.dirty"
            type="button"
            @click="saveArtifactHistory"
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
    <ConsolePanel title="Stack">
      <p class="hint-text">
        Check Docker Hub for newer companion-stack releases and upgrade pinned image tags.
      </p>
      <template v-if="stackStatus && stackAvailable">
        <div class="settings-status-stack">
          <div class="drawer-actions settings-actions">
            <button
              class="button"
              :disabled="stackCheckDisabled"
              :title="identityStore.effectiveAdmin ? undefined : 'Admin access required'"
              type="button"
              @click="checkUpdates"
            >
              {{ stackUi.checkingVersions ? "Checking…" : "Check for updates" }}
            </button>
            <span
              v-if="stackUi.versionsCheckedAt"
              class="secondary-text"
            >
              Last checked
              <span :data-time-ago="stackUi.versionsCheckedAt">{{ stackUi.versionsCheckedAt }}</span>
            </span>
          </div>
          <div
            v-if="stackUi.versionsError"
            class="note-block log-note-error settings-status-callout"
          >
            {{ stackUi.versionsError }}
          </div>
        </div>
        <div class="key-value-list compact stack-rows">
          <div
            v-for="svc in stackStatus.services"
            :key="svc.service"
            class="stack-service"
          >
            <div class="copyable-row">
              <span>{{ svc.service }}</span>
              <strong class="mono">{{ svc.image }} <span class="secondary-text">({{ svc.imageIdShort }})</span></strong>
            </div>
            <template v-if="versionByService.get(svc.service)">
              <div
                v-if="versionByService.get(svc.service)!.versionCheck === 'ok' && (versionByService.get(svc.service)!.availableTags?.length ?? 0) > 0"
                class="stack-version-controls"
              >
                <label class="stack-version-label">
                  <span class="secondary-text">Upgrade to</span>
                  <select
                    v-model="targetTags[svc.service]"
                    class="search-field compact stack-version-select"
                    :disabled="stackBusy"
                  >
                    <option
                      v-for="tag in versionByService.get(svc.service)!.availableTags"
                      :key="tag"
                      :value="tag"
                    >
                      {{ tag }}
                    </option>
                  </select>
                </label>
                <button
                  class="button"
                  type="button"
                  :disabled="!identityStore.effectiveAdmin || stackBusy || !targetTags[svc.service]"
                  :title="identityStore.effectiveAdmin ? undefined : 'Admin access required'"
                  @click="updateService(svc.service)"
                >
                  {{ stackUi.updating ? "Updating…" : `Update to ${targetTags[svc.service] || '…'}` }}
                </button>
              </div>
              <div
                v-else-if="versionByService.get(svc.service)!.versionCheck === 'ok'"
                class="secondary-text stack-version-note"
              >
                Up to date with Docker Hub.
              </div>
              <div
                v-else-if="versionByService.get(svc.service)!.versionCheck === 'error'"
                class="secondary-text stack-version-note"
              >
                Version check unavailable: {{ versionByService.get(svc.service)!.versionMessage }}
              </div>
            </template>
          </div>
        </div>
        <div class="settings-status-stack">
          <details class="stack-fallback">
            <summary>Force-pull pinned tags (fallback)</summary>
            <p class="hint-text">
              Re-pulls the tags currently in <code>docker-compose.yml</code> without changing them. Use this for floating tags like <code>:latest</code> or when you've published a new build under the same tag.
            </p>
            <div class="drawer-actions settings-actions">
              <button
                class="button"
                :disabled="stackPullDisabled"
                :title="identityStore.effectiveAdmin ? undefined : 'Admin access required'"
                type="button"
                @click="pullImages"
              >
                {{ stackUi.pulling ? "Pulling…" : "Pull latest images" }}
              </button>
              <button
                class="button"
                :disabled="stackRecreateDisabled"
                :title="identityStore.effectiveAdmin ? undefined : 'Admin access required'"
                type="button"
                @click="applyUpdate"
              >
                Apply update
              </button>
            </div>
            <div
              v-if="stackUi.pullResult"
              class="key-value-list compact stack-rows"
            >
              <div
                v-for="r in stackUi.pullResult.results"
                :key="r.service"
                class="copyable-row"
              >
                <span>{{ r.image }}</span>
                <strong :class="r.updated ? '' : 'secondary-text'">
                  {{ r.error ? r.error : r.updated ? `Updated (${r.currentId})` : "Up to date" }}
                </strong>
              </div>
            </div>
          </details>
          <div
            v-if="stackUi.recreating"
            class="note-block settings-status-callout"
          >
            Applying stack update. The console will reconnect when services are back.
          </div>
          <div
            v-if="stackUi.pullError"
            class="note-block log-note-error settings-status-callout"
          >
            {{ stackUi.pullError }}
          </div>
          <div
            v-if="stackUi.recreateError"
            class="note-block log-note-error settings-status-callout"
          >
            {{ stackUi.recreateError }}
          </div>
          <div
            v-if="stackUi.updateError"
            class="note-block log-note-error settings-status-callout"
          >
            {{ stackUi.updateError }}
          </div>
        </div>
      </template>
      <div
        v-else-if="stackStatus && !stackAvailable"
        class="note-block settings-status-callout"
      >
        {{ stackStatus.reason || "Stack management is not available." }}
      </div>
      <div
        v-else
        class="secondary-text"
      >
        Loading stack status…
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
          <strong class="mono">{{ model.connection.target || "—" }}</strong>
        </div>
      </div>
    </ConsolePanel>
  </div>
</template>

<style scoped>
.stack-rows {
  margin-top: var(--space-3);
}

.stack-rows :deep(.copyable-row) {
  align-items: center;
  display: flex;
  gap: var(--space-3);
  justify-content: space-between;
}

.stack-rows :deep(.copyable-row > span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stack-rows :deep(.copyable-row > strong) {
  flex: 0 0 auto;
  text-align: right;
}

.stack-service {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.stack-version-controls {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}

.stack-version-label {
  align-items: center;
  display: flex;
  gap: var(--space-2);
}

.stack-version-select {
  background: var(--bg-panel);
  border: 1px solid var(--border-default);
  border-radius: var(--control-radius);
  color: var(--text-primary);
  height: 32px;
  min-width: 9rem;
  padding: 0 10px;
}

.stack-version-select:disabled {
  opacity: 0.6;
}

.stack-version-note {
  text-align: right;
}

.stack-fallback {
  border-radius: var(--radius-2);
  border: 1px solid var(--border-muted);
  padding: var(--space-2) var(--space-3);
}

.stack-fallback summary {
  cursor: pointer;
  font-weight: 500;
}

.stack-fallback[open] summary {
  margin-bottom: var(--space-2);
}
</style>

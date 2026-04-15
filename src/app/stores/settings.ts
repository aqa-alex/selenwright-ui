import { defineStore } from "pinia";

export interface ArtifactHistoryDraft {
  draftEnabled: boolean;
  draftRetentionDays: string;
  dirty: boolean;
  error: string;
  loaded: boolean;
  saving: boolean;
}

export interface SettingsState {
  artifactHistory: ArtifactHistoryDraft;
}

const defaultDraft: ArtifactHistoryDraft = {
  draftEnabled: false,
  draftRetentionDays: "7",
  dirty: false,
  error: "",
  loaded: false,
  saving: false,
};

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => ({
    artifactHistory: { ...defaultDraft },
  }),
  actions: {
    setHistoryEnabled(enabled: boolean) {
      this.artifactHistory.draftEnabled = enabled;
      this.artifactHistory.dirty = true;
      this.artifactHistory.error = "";
    },
    setHistoryRetentionDays(value: string) {
      this.artifactHistory.draftRetentionDays = value;
      this.artifactHistory.dirty = true;
      this.artifactHistory.error = "";
    },
    setHistorySaving(saving: boolean) {
      this.artifactHistory.saving = saving;
    },
    setHistoryError(message: string) {
      this.artifactHistory.error = message;
    },
    syncFromBackend(payload: { enabled: boolean; retentionDays: number }) {
      this.artifactHistory.draftEnabled = payload.enabled;
      this.artifactHistory.draftRetentionDays = String(payload.retentionDays);
      this.artifactHistory.dirty = false;
      this.artifactHistory.error = "";
      this.artifactHistory.loaded = true;
    },
    markHistoryLoaded(loaded: boolean) {
      this.artifactHistory.loaded = loaded;
    },
  },
});

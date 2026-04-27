import { defineStore } from "pinia";
import type { StackPullResult, StackVersionInfo } from "../api";

export interface ArtifactHistoryDraft {
  draftEnabled: boolean;
  draftRetentionDays: string;
  dirty: boolean;
  error: string;
  loaded: boolean;
  saving: boolean;
}

export interface StackUpdateState {
  pulling: boolean;
  pullError: string;
  pullResult: StackPullResult | null;
  recreating: boolean;
  recreateError: string;
  versions: StackVersionInfo[] | null;
  versionsCheckedAt: string | null;
  versionsError: string;
  checkingVersions: boolean;
  updateError: string;
  updating: boolean;
}

export interface SettingsState {
  artifactHistory: ArtifactHistoryDraft;
  stack: StackUpdateState;
}

const defaultDraft: ArtifactHistoryDraft = {
  draftEnabled: false,
  draftRetentionDays: "7",
  dirty: false,
  error: "",
  loaded: false,
  saving: false,
};

const defaultStack: StackUpdateState = {
  pulling: false,
  pullError: "",
  pullResult: null,
  recreating: false,
  recreateError: "",
  versions: null,
  versionsCheckedAt: null,
  versionsError: "",
  checkingVersions: false,
  updateError: "",
  updating: false,
};

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => ({
    artifactHistory: { ...defaultDraft },
    stack: { ...defaultStack },
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
    setStackPulling(pulling: boolean) {
      this.stack.pulling = pulling;
    },
    setStackPullError(message: string) {
      this.stack.pullError = message;
    },
    setStackPullResult(result: StackPullResult | null) {
      this.stack.pullResult = result;
    },
    setStackRecreating(recreating: boolean) {
      this.stack.recreating = recreating;
    },
    setStackRecreateError(message: string) {
      this.stack.recreateError = message;
    },
    resetStackPull() {
      this.stack.pullResult = null;
      this.stack.pullError = "";
    },
    setStackCheckingVersions(checking: boolean) {
      this.stack.checkingVersions = checking;
    },
    setStackVersions(payload: { services: StackVersionInfo[]; checkedAt: string }) {
      this.stack.versions = payload.services;
      this.stack.versionsCheckedAt = payload.checkedAt;
      this.stack.versionsError = "";
    },
    setStackVersionsError(message: string) {
      this.stack.versionsError = message;
    },
    clearStackVersions() {
      this.stack.versions = null;
      this.stack.versionsCheckedAt = null;
      this.stack.versionsError = "";
    },
    setStackUpdating(updating: boolean) {
      this.stack.updating = updating;
    },
    setStackUpdateError(message: string) {
      this.stack.updateError = message;
    },
  },
});

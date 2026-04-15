import { defineStore } from "pinia";

export type ArtifactPage = "videos" | "logs" | "downloads";

export type SelectedArtifacts = Record<ArtifactPage, string | null>;

export interface UiState {
  artifactSessionFilter: string;
  logsPage: number;
  logsPerPage: number;
  logSearch: string;
  quickJumpQuery: string;
  selectedArtifacts: SelectedArtifacts;
}

const defaultLogsPerPage = 10;

export const useUiStore = defineStore("ui", {
  state: (): UiState => ({
    artifactSessionFilter: "",
    logsPage: 1,
    logsPerPage: defaultLogsPerPage,
    logSearch: "",
    quickJumpQuery: "",
    selectedArtifacts: {
      downloads: null,
      logs: null,
      videos: null,
    },
  }),
  actions: {
    selectArtifact(page: ArtifactPage, filename: string | null) {
      this.selectedArtifacts = {
        ...this.selectedArtifacts,
        [page]: filename,
      };
    },
    setArtifactSessionFilter(value: string) {
      this.artifactSessionFilter = value;
    },
    clearArtifactSessionFilter() {
      this.artifactSessionFilter = "";
    },
    nextLogsPage() {
      this.logsPage += 1;
    },
    prevLogsPage() {
      this.logsPage = Math.max(1, this.logsPage - 1);
    },
    setLogsPage(page: number) {
      this.logsPage = Math.max(1, page);
    },
    setLogsPerPage(perPage: number) {
      const parsed = Number.isFinite(perPage) ? Math.max(1, Math.floor(perPage)) : defaultLogsPerPage;
      this.logsPerPage = parsed;
      this.logsPage = 1;
    },
    setLogSearch(query: string) {
      this.logSearch = query;
    },
    setQuickJumpQuery(query: string) {
      this.quickJumpQuery = query;
    },
    clearQuickJumpQuery() {
      this.quickJumpQuery = "";
    },
  },
});

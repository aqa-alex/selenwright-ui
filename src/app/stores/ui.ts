import { defineStore } from "pinia";

export type ArtifactPage = "videos" | "logs" | "downloads";

export type SelectedArtifacts = Record<ArtifactPage, string | null>;
export type ArtifactPageNumbers = Record<ArtifactPage, number>;
export type ArtifactPageSizes = Record<ArtifactPage, number>;

export interface UiState {
  artifactSessionFilter: string;
  artifactPageNumbers: ArtifactPageNumbers;
  artifactPageSizes: ArtifactPageSizes;
  logSearch: string;
  quickJumpQuery: string;
  selectedArtifacts: SelectedArtifacts;
}

const defaultPageSize = 10;

function initialPageNumbers(): ArtifactPageNumbers {
  return { downloads: 1, logs: 1, videos: 1 };
}

function initialPageSizes(): ArtifactPageSizes {
  return { downloads: defaultPageSize, logs: defaultPageSize, videos: defaultPageSize };
}

export const useUiStore = defineStore("ui", {
  state: (): UiState => ({
    artifactSessionFilter: "",
    artifactPageNumbers: initialPageNumbers(),
    artifactPageSizes: initialPageSizes(),
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
    nextArtifactPage(pageKey: ArtifactPage) {
      this.artifactPageNumbers = {
        ...this.artifactPageNumbers,
        [pageKey]: this.artifactPageNumbers[pageKey] + 1,
      };
    },
    prevArtifactPage(pageKey: ArtifactPage) {
      this.artifactPageNumbers = {
        ...this.artifactPageNumbers,
        [pageKey]: Math.max(1, this.artifactPageNumbers[pageKey] - 1),
      };
    },
    setArtifactPage(pageKey: ArtifactPage, page: number) {
      this.artifactPageNumbers = {
        ...this.artifactPageNumbers,
        [pageKey]: Math.max(1, page),
      };
    },
    setArtifactPageSize(pageKey: ArtifactPage, perPage: number) {
      const parsed = Number.isFinite(perPage) ? Math.max(1, Math.floor(perPage)) : defaultPageSize;
      this.artifactPageSizes = {
        ...this.artifactPageSizes,
        [pageKey]: parsed,
      };
      this.artifactPageNumbers = {
        ...this.artifactPageNumbers,
        [pageKey]: 1,
      };
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

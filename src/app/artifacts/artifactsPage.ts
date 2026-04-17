import type {
  ConsoleSession,
  DownloadArtifact,
  LogArtifact,
  VideoArtifact,
} from "../api";

export type ArtifactPageKey = "videos" | "logs" | "downloads";
export type ArtifactItem = DownloadArtifact | LogArtifact | VideoArtifact;

export interface ArtifactPagePreferences {
  artifactPaneWidths?: Record<string, number>;
  timeFormat?: string;
  timezone?: string;
}

export interface ArtifactLogFileState {
  content: string;
  error: string;
  loaded: boolean;
  loading: boolean;
}

export interface ArtifactPagination {
  currentPage: number;
  pageItems: ArtifactItem[];
  perPage: number;
  totalPages: number;
}

export interface ArtifactPageModel {
  artifactSessionFilter: string;
  downloads: DownloadArtifact[];
  logFiles: Record<string, ArtifactLogFileState>;
  logs: LogArtifact[];
  page: number;
  perPage: number;
  logSearch: string;
  pageKey: ArtifactPageKey;
  preferences: ArtifactPagePreferences;
  selectedArtifacts: Record<ArtifactPageKey, string | null>;
  sessions: ConsoleSession[];
  videos: VideoArtifact[];
}

export interface ArtifactPageCopy {
  emptyHint: string;
  emptyTitle: string;
  indexTitle: string;
  intro: string;
  title: string;
}

export interface ArtifactTableHeader {
  label: string;
}

export const artifactPageTitles: Record<ArtifactPageKey, string> = {
  downloads: "Downloads",
  logs: "Logs",
  videos: "Videos",
};

const defaultDrawerRatio = 0.37;
const artifactPerPageOptions = [10, 20, 50, 100];

export function getArtifactPageCopy(model: ArtifactPageModel): ArtifactPageCopy {
  const title = artifactPageTitles[model.pageKey];
  return {
    emptyHint: getArtifactEmptyHint(model),
    emptyTitle: `No ${title.toLowerCase()}`,
    indexTitle: `${title} index`,
    intro: `Browse ${title.toLowerCase()} across sessions.`,
    title,
  };
}

export function getArtifactColumns(pageKey: ArtifactPageKey): ArtifactTableHeader[] {
  if (pageKey === "videos") {
    return [
      { label: "Filename" },
      { label: "Session" },
      { label: "Browser" },
      { label: "Protocol" },
      { label: "Created" },
      { label: "Size" },
      { label: "Actions" },
    ];
  }

  return [
    { label: "Filename" },
    { label: "Session" },
    { label: "Browser" },
    { label: "Created" },
    { label: "Size" },
    { label: "Actions" },
  ];
}

export function getArtifactItems(model: ArtifactPageModel): ArtifactItem[] {
  switch (model.pageKey) {
    case "downloads":
      return model.downloads;
    case "logs":
      return model.logs;
    case "videos":
      return model.videos;
  }
}

export function getFilteredArtifactItems(model: ArtifactPageModel): ArtifactItem[] {
  const items = getArtifactItems(model);
  if (!model.artifactSessionFilter) {
    return items;
  }

  return items.filter((item) => item.sessionId === model.artifactSessionFilter);
}

export function getVisibleArtifactItems(model: ArtifactPageModel): ArtifactItem[] {
  return getArtifactPagination(model).pageItems;
}

export function getArtifactPagination(model: ArtifactPageModel): ArtifactPagination {
  const filtered = getFilteredArtifactItems(model);
  const perPage = model.perPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(Math.max(1, model.page), totalPages);
  const start = (currentPage - 1) * perPage;

  return {
    currentPage,
    pageItems: filtered.slice(start, start + perPage),
    perPage,
    totalPages,
  };
}

export function getArtifactPerPageOptions(): number[] {
  return [...artifactPerPageOptions];
}

export function getSelectedArtifact(model: ArtifactPageModel): ArtifactItem | null {
  const selectedFilename = model.selectedArtifacts[model.pageKey];
  if (!selectedFilename) {
    return null;
  }

  return getArtifactItems(model).find((item) => item.filename === selectedFilename) || null;
}

export function getSessionForArtifact(
  model: Pick<ArtifactPageModel, "sessions">,
  item: Pick<ArtifactItem, "sessionId">,
): ConsoleSession | null {
  return model.sessions.find((session) => session.id === item.sessionId) || null;
}

export function getDrawerRatio(model: ArtifactPageModel): number {
  return model.preferences.artifactPaneWidths?.[model.pageKey] ?? defaultDrawerRatio;
}

export function getSavedLogState(
  model: Pick<ArtifactPageModel, "logFiles" | "logs">,
  filename: string,
): ArtifactLogFileState {
  const cached = model.logFiles[filename];
  if (cached) {
    return cached;
  }

  const item = model.logs.find((entry) => entry.filename === filename);
  return {
    content: item?.content || "",
    error: item?.contentError || "",
    loaded: Boolean(item?.contentLoaded),
    loading: false,
  };
}

export function filterLogContent(content: string, query: string): string {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return content;
  }

  return content
    .split("\n")
    .filter((line) => line.toLowerCase().includes(normalizedQuery))
    .join("\n");
}

export function getSavedLogEmptyText(
  logState: Pick<ArtifactLogFileState, "error" | "loaded" | "loading">,
  query: string,
): string {
  if (logState.loading) {
    return "Waiting for log content.";
  }

  if (logState.error) {
    return "Log content is unavailable right now.";
  }

  if (query.trim()) {
    return "No lines match the current search.";
  }

  return logState.loaded ? "This log file is empty." : "Open the file to load its content.";
}

export function buildLogDownloadHref(filename: string): string {
  return `/api/logs/file/${encodeURIComponent(filename)}`;
}

export function buildDownloadArtifactHref(item: DownloadArtifact | null): string {
  return item?.downloadUrl || "#";
}

function getFilteredLogs(model: ArtifactPageModel): LogArtifact[] {
  const items = model.logs;
  if (!model.artifactSessionFilter) {
    return items;
  }

  return items.filter((item) => item.sessionId === model.artifactSessionFilter);
}

function getArtifactEmptyHint(model: ArtifactPageModel): string {
  if (model.pageKey === "logs") {
    return getLogsEmptyHint(model);
  }

  return `No ${artifactPageTitles[model.pageKey].toLowerCase()} match the current selection.`;
}

function getLogsEmptyHint(model: ArtifactPageModel): string {
  const filteredLogs = getFilteredLogs(model);
  if (filteredLogs.length) {
    return "No logs match the current selection.";
  }

  if (model.artifactSessionFilter) {
    return "No saved logs have been persisted for this session yet.";
  }

  return "No saved logs have been persisted yet.";
}

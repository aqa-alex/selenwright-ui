import type { ConsoleSession, LogArtifact } from "../api";
import { activeStatuses, titleCaseSessionValue } from "../sessions/sessionTable";

export interface SessionDetailPreferences {
  timeFormat?: string;
  timezone?: string;
}

export interface SessionDetailLiveLogState {
  autoScroll: boolean;
  content: string;
  error: string;
  message: string;
  sessionId: string;
  source: string;
  status: string;
  truncated: boolean;
}

export interface SessionDetailLogFileState {
  content: string;
  error: string;
  loaded: boolean;
  loading: boolean;
}

export interface SessionDetailPageModel {
  liveLogs: SessionDetailLiveLogState;
  logFiles: Record<string, SessionDetailLogFileState>;
  logSearch: string;
  logs: LogArtifact[];
  preferences: SessionDetailPreferences;
  routeSessionId: string;
  session: ConsoleSession | null;
  terminatingSessionId: string;
}

export function buildSessionDisplayName(session: ConsoleSession): string {
  return `${session.browser}-${session.id}`;
}

export function buildSessionSummary(session: ConsoleSession, statusLabel: string): string {
  return `${statusLabel} ${session.protocol} session on ${titleCaseSessionValue(
    session.browser,
  )} ${session.browserVersion}.`;
}

export function buildVncViewerHref(session: ConsoleSession): string {
  const params = new URLSearchParams({
    browser: session.browser,
    name: session.name,
    session: session.id,
  });

  return `/vnc.html?${params.toString()}`;
}

export function buildLogDownloadHref(filename: string): string {
  return `/api/logs/file/${encodeURIComponent(filename)}`;
}

export function canTerminateSession(
  session: ConsoleSession,
  terminatingSessionId: string,
): boolean {
  return activeStatuses.has(session.status) && terminatingSessionId !== session.id;
}

export function isTerminatePending(
  session: ConsoleSession,
  terminatingSessionId: string,
): boolean {
  return terminatingSessionId === session.id;
}

export function getSavedLogState(
  model: Pick<SessionDetailPageModel, "logFiles" | "logs">,
  filename: string,
): SessionDetailLogFileState {
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
  logState: Pick<SessionDetailLogFileState, "error" | "loaded" | "loading">,
  query: string,
): string {
  if (logState.loading) {
    return "Waiting for log content.";
  }

  if (logState.error) {
    return "Saved log content is unavailable right now.";
  }

  if (query.trim()) {
    return "No lines match the current search.";
  }

  return logState.loaded ? "This log file is empty." : "Open the log to load its content.";
}

export function getMissingSessionLogText(session: ConsoleSession): string {
  if (session.status === "running") {
    return "Live log stream is unavailable right now.";
  }

  return "No saved log has been persisted for this session yet.";
}

export function getLiveLogStatusText(liveState: SessionDetailLiveLogState | null): string {
  if (!liveState) {
    return "Connecting to live log stream.";
  }

  switch (liveState.status) {
    case "open":
      return "Connected, waiting for first line";
    case "streaming":
      return "Streaming live log output";
    case "reconnecting":
      return liveState.message || "Live stream dropped. Reconnecting.";
    case "error":
      return "Live stream unavailable";
    case "inactive":
      return "Session is no longer active";
    case "closed":
      return liveState.message || "Live stream closed.";
    case "connecting":
    case "idle":
    default:
      return liveState.message || "Connecting to live log stream.";
  }
}

export function getLiveLogEmptyText(liveState: SessionDetailLiveLogState | null): string {
  if (!liveState) {
    return "Connecting to live log stream.";
  }

  switch (liveState.status) {
    case "open":
      return "Live stream connected, waiting for first line.";
    case "streaming":
      return "Waiting for live log output.";
    case "error":
      return "Live stream failed. Retry is available.";
    case "reconnecting":
      return liveState.message || "Live stream dropped. Reconnecting.";
    case "inactive":
      return "Session is no longer active.";
    case "closed":
      return "Live log stream closed.";
    case "connecting":
    default:
      return liveState.message || "Connecting to live log stream.";
  }
}

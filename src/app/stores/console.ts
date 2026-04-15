import { defineStore } from "pinia";

export const MAX_LIVE_LOG_CHARS = 512_000;
export const MAX_CACHED_LOG_FILES = 10;

export type LiveLogStatus =
  | "idle"
  | "connecting"
  | "open"
  | "streaming"
  | "reconnecting"
  | "closed"
  | "error"
  | "inactive";

export interface LiveLogState {
  autoScroll: boolean;
  content: string;
  error: string;
  message: string;
  sessionId: string;
  source: "none" | "live";
  status: LiveLogStatus;
  truncated: boolean;
}

export interface LogFileState {
  content: string;
  error: string;
  loaded: boolean;
  loading: boolean;
}

export interface ConsoleState {
  liveLogs: LiveLogState;
  logFiles: Record<string, LogFileState>;
  logFilesOrder: string[];
  terminatingSessionId: string;
}

export function createInitialLiveLogState(): LiveLogState {
  return {
    autoScroll: true,
    content: "",
    error: "",
    message: "Select a running session to stream logs.",
    sessionId: "",
    source: "none",
    status: "idle",
    truncated: false,
  };
}

export function createInitialLogFileState(): LogFileState {
  return {
    content: "",
    error: "",
    loaded: false,
    loading: false,
  };
}

export function applyLiveLogBuffer(
  previous: string,
  chunk: string,
  previousTruncated: boolean,
): { content: string; truncated: boolean } {
  const combined = previous + chunk;
  if (combined.length <= MAX_LIVE_LOG_CHARS) {
    return { content: combined, truncated: previousTruncated };
  }
  return {
    content: combined.slice(combined.length - MAX_LIVE_LOG_CHARS),
    truncated: true,
  };
}

function applyLogFileLru(
  files: Record<string, LogFileState>,
  order: string[],
  filename: string,
  next: LogFileState,
): { files: Record<string, LogFileState>; order: string[] } {
  const trimmedOrder = order.filter((name) => name !== filename);
  trimmedOrder.push(filename);
  const combinedFiles = { ...files, [filename]: next };

  while (trimmedOrder.length > MAX_CACHED_LOG_FILES) {
    const evicted = trimmedOrder.shift();
    if (evicted !== undefined && evicted !== filename) {
      delete combinedFiles[evicted];
    }
  }

  return { files: combinedFiles, order: trimmedOrder };
}

export const useConsoleStore = defineStore("console", {
  state: (): ConsoleState => ({
    liveLogs: createInitialLiveLogState(),
    logFiles: {},
    logFilesOrder: [],
    terminatingSessionId: "",
  }),
  actions: {
    setLiveLogState(partial: Partial<LiveLogState>) {
      this.liveLogs = { ...this.liveLogs, ...partial };
    },
    resetLiveLog() {
      this.liveLogs = createInitialLiveLogState();
    },
    setLiveLogAutoScroll(autoScroll: boolean) {
      this.liveLogs.autoScroll = autoScroll;
    },
    startLiveLogConnecting(sessionId: string) {
      const previous = this.liveLogs;
      const keepPrevious = previous.sessionId === sessionId;
      this.liveLogs = {
        ...createInitialLiveLogState(),
        autoScroll: keepPrevious ? previous.autoScroll : true,
        content: keepPrevious ? previous.content : "",
        truncated: keepPrevious ? previous.truncated : false,
        message: "Connecting to live log stream.",
        sessionId,
        source: "live",
        status: "connecting",
      };
    },
    appendLiveLogChunk(sessionId: string, chunk: string) {
      if (!chunk) {
        return;
      }
      if (this.liveLogs.sessionId !== sessionId) {
        const { content, truncated } = applyLiveLogBuffer("", chunk, false);
        this.liveLogs = {
          ...createInitialLiveLogState(),
          content,
          truncated,
          message: "Streaming live log output.",
          sessionId,
          source: "live",
          status: "streaming",
        };
        return;
      }
      const { content, truncated } = applyLiveLogBuffer(
        this.liveLogs.content,
        chunk,
        this.liveLogs.truncated,
      );
      this.liveLogs = {
        ...this.liveLogs,
        content,
        truncated,
        error: "",
        message: "Streaming live log output.",
        status: "streaming",
      };
    },
    markLiveLogInactive() {
      if (this.liveLogs.status === "inactive") {
        return;
      }
      this.liveLogs = {
        ...this.liveLogs,
        error: "",
        message: "Session is no longer active.",
        status: "inactive",
      };
    },
    setLogFileLoading(filename: string) {
      const existing = this.logFiles[filename] || createInitialLogFileState();
      const { files, order } = applyLogFileLru(
        this.logFiles,
        this.logFilesOrder,
        filename,
        {
          content: existing.content,
          error: "",
          loaded: false,
          loading: true,
        },
      );
      this.logFiles = files;
      this.logFilesOrder = order;
    },
    setLogFileContent(filename: string, content: string) {
      const { files, order } = applyLogFileLru(
        this.logFiles,
        this.logFilesOrder,
        filename,
        {
          content,
          error: "",
          loaded: true,
          loading: false,
        },
      );
      this.logFiles = files;
      this.logFilesOrder = order;
    },
    setLogFileError(filename: string, message: string) {
      const existing = this.logFiles[filename] || createInitialLogFileState();
      const { files, order } = applyLogFileLru(
        this.logFiles,
        this.logFilesOrder,
        filename,
        {
          content: existing.content,
          error: message,
          loaded: false,
          loading: false,
        },
      );
      this.logFiles = files;
      this.logFilesOrder = order;
    },
    clearLogFile(filename: string) {
      if (!(filename in this.logFiles)) {
        return;
      }
      const next = { ...this.logFiles };
      delete next[filename];
      this.logFiles = next;
      this.logFilesOrder = this.logFilesOrder.filter((name) => name !== filename);
    },
    setTerminating(sessionId: string) {
      this.terminatingSessionId = sessionId;
    },
  },
});

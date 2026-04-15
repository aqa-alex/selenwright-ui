import { defineStore } from "pinia";

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

export const useConsoleStore = defineStore("console", {
  state: (): ConsoleState => ({
    liveLogs: createInitialLiveLogState(),
    logFiles: {},
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
      this.liveLogs = {
        ...createInitialLiveLogState(),
        autoScroll: previous.sessionId === sessionId ? previous.autoScroll : true,
        content: previous.sessionId === sessionId ? previous.content : "",
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
        this.liveLogs = {
          ...createInitialLiveLogState(),
          content: chunk,
          message: "Streaming live log output.",
          sessionId,
          source: "live",
          status: "streaming",
        };
        return;
      }
      this.liveLogs = {
        ...this.liveLogs,
        content: this.liveLogs.content + chunk,
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
      this.logFiles = {
        ...this.logFiles,
        [filename]: {
          content: existing.content,
          error: "",
          loaded: false,
          loading: true,
        },
      };
    },
    setLogFileContent(filename: string, content: string) {
      this.logFiles = {
        ...this.logFiles,
        [filename]: {
          content,
          error: "",
          loaded: true,
          loading: false,
        },
      };
    },
    setLogFileError(filename: string, message: string) {
      const existing = this.logFiles[filename] || createInitialLogFileState();
      this.logFiles = {
        ...this.logFiles,
        [filename]: {
          content: existing.content,
          error: message,
          loaded: false,
          loading: false,
        },
      };
    },
    clearLogFile(filename: string) {
      if (!(filename in this.logFiles)) {
        return;
      }
      const next = { ...this.logFiles };
      delete next[filename];
      this.logFiles = next;
    },
    setTerminating(sessionId: string) {
      this.terminatingSessionId = sessionId;
    },
  },
});

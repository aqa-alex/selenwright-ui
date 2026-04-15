import { asString, isRecord } from "./guards";
import type {
  BaseArtifact,
  ConsoleDataset,
  ConsoleSession,
  DownloadArtifact,
  JsonRecord,
  LiveLogHandlers,
  LiveLogSubscription,
  LogArtifact,
  RawArtifactItem,
  RawDownloadItem,
  VideoArtifact,
} from "./types";

const LIVE_LOG_INITIAL_RECONNECT_MS = 1000;
const LIVE_LOG_MAX_RECONNECT_MS = 30_000;
const LIVE_LOG_MAX_RECONNECT_ATTEMPTS = 6;

export async function loadLogFileContent(filename: string): Promise<string> {
  if (!filename) {
    throw new Error("Log filename is required");
  }

  const response = await fetch(buildLogFileApiPath(filename), {
    headers: { accept: "text/plain" },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${filename} (${response.status})`);
  }

  return response.text();
}

export function subscribeToLiveLogs(
  sessionId: string,
  handlers: LiveLogHandlers = {},
): LiveLogSubscription {
  if (!sessionId) {
    throw new Error("Session id is required for live log streaming");
  }

  if (typeof EventSource === "undefined") {
    throw new Error("EventSource is not available in this browser");
  }

  const {
    onChunk = () => {},
    onClose = () => {},
    onError = () => {},
    onStatusChange = () => {},
  } = handlers;

  let disposed = false;
  let sawChunk = false;
  let attempt = 0;
  let reconnectTimer = 0;
  let source: EventSource | null = null;

  const emitStatus = (status: string, message: string, extra: JsonRecord = {}) => {
    onStatusChange({
      attempt,
      message,
      sessionId,
      status,
      ...extra,
    });
  };

  const closeSource = () => {
    if (!source) {
      return;
    }

    source.onopen = null;
    source.onerror = null;
    source.close();
    source = null;
  };

  const cancelPendingReconnect = () => {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = 0;
    }
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer) {
      return;
    }

    if (attempt >= LIVE_LOG_MAX_RECONNECT_ATTEMPTS) {
      const giveUpMessage =
        "Live log stream unavailable after several attempts. Reconnect manually.";
      onError(new Error(giveUpMessage));
      emitStatus("error", giveUpMessage, { gaveUp: true });
      return;
    }

    attempt += 1;
    const delayMs = Math.min(
      LIVE_LOG_MAX_RECONNECT_MS,
      LIVE_LOG_INITIAL_RECONNECT_MS * 2 ** (attempt - 1),
    );
    emitStatus(
      "reconnecting",
      `Reconnecting live log stream (attempt ${attempt}/${LIVE_LOG_MAX_RECONNECT_ATTEMPTS}).`,
      { delayMs },
    );

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = 0;
      connect();
    }, delayMs);
  };

  const parseStreamPayload = (event: MessageEvent<string>): JsonRecord | null => {
    try {
      const payload = JSON.parse(event.data) as unknown;
      return isRecord(payload) ? payload : null;
    } catch {
      return null;
    }
  };

  const connect = () => {
    if (disposed) {
      return;
    }

    closeSource();
    source = new EventSource(buildLiveLogApiPath(sessionId));

    source.addEventListener("chunk", (event: MessageEvent<string>) => {
      const payload = parseStreamPayload(event);
      const chunk = typeof payload?.chunk === "string" ? payload.chunk : "";
      if (!chunk) {
        return;
      }

      sawChunk = true;
      onChunk(chunk);
      emitStatus("streaming", "Streaming live log output.");
    });

    source.addEventListener("status", (event: MessageEvent<string>) => {
      const payload = parseStreamPayload(event);
      if (!payload) {
        return;
      }

      const nextStatus =
        typeof payload.status === "string" ? payload.status : "open";
      const nextMessage =
        typeof payload.message === "string" && payload.message.trim()
          ? payload.message
          : nextStatus === "closed"
            ? "Live log stream closed."
            : nextStatus === "error"
              ? "Live log stream unavailable."
              : "Live stream connected, waiting for first line.";

      if (nextStatus === "closed") {
        onClose(payload);
      }

      if (nextStatus === "error") {
        onError(new Error(nextMessage));
      }

      emitStatus(nextStatus, nextMessage, payload);
    });

    source.onopen = () => {
      attempt = 0;
      emitStatus(
        sawChunk ? "streaming" : "open",
        sawChunk
          ? "Streaming live log output."
          : "Live stream connected, waiting for first line.",
      );
    };

    source.onerror = () => {
      if (disposed) {
        return;
      }

      // Browser EventSource auto-reconnects without backoff. Close the source
      // and schedule a manual exponential retry with a cap.
      closeSource();

      const errorMessage = sawChunk
        ? "Live log stream dropped. Reconnecting."
        : "Live log stream unavailable.";
      onError(
        new Error(sawChunk ? "Live log stream dropped" : "Live log stream unavailable"),
      );
      emitStatus("reconnecting", errorMessage);
      scheduleReconnect();
    };
  };

  connect();

  return {
    close() {
      disposed = true;
      cancelPendingReconnect();
      closeSource();
      emitStatus("closed", "Live log stream closed.", {
        clean: true,
        code: 1000,
        reason: "Client closed",
      });
    },
  };
}

export function buildLogFileApiPath(filename: string): string {
  return `/api/logs/file/${encodeURIComponent(filename)}`;
}

export function buildLiveLogApiPath(sessionId: string): string {
  return `/api/logs/live/${encodeURIComponent(sessionId)}`;
}

export function buildDownloadFileApiPath(sessionId: string, relativePath: string): string {
  const encodedSessionId = encodeURIComponent(sessionId);
  const encodedRelativePath = String(relativePath || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/downloads/file/${encodedSessionId}/${encodedRelativePath}`;
}

export function buildArtifactList(items: RawArtifactItem[], type: "log"): LogArtifact[];
export function buildArtifactList(items: RawArtifactItem[], type: "video"): VideoArtifact[];
export function buildArtifactList(
  items: RawArtifactItem[],
  type: "log" | "video",
): Array<LogArtifact | VideoArtifact> {
  return items
    .filter((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      return isRecord(item) && Boolean(item.filename);
    })
    .map((item) => {
      const isObject = isRecord(item);
      const filename = isObject ? (item.filename as string) : item;
      const sessionId = isObject
        ? (item.sessionId as string)
        : extractSessionIdFromFilename(filename, type);
      const base: BaseArtifact = {
        browser: isObject ? asString(item.browser) || "unknown" : "unknown",
        createdAt: isObject ? asString(item.createdAt) : undefined,
        filename,
        protocol: isObject ? asString(item.protocol) || "unknown" : "unknown",
        sessionId,
        size: isObject ? Number(item.size) || 0 : 0,
      };

      if (type === "video") {
        return {
          ...base,
          durationMs: isObject ? Number(item.durationMs) || 0 : 0,
        } satisfies VideoArtifact;
      }

      return {
        ...base,
        content: "",
        contentLoaded: false,
        contentError: "",
        liveStreamAvailable: false,
      } satisfies LogArtifact;
    });
}

export function buildDownloadList(items: RawDownloadItem[]): DownloadArtifact[] {
  return items
    .filter((item) => isRecord(item) && Boolean(item.filename) && Boolean(item.sessionId))
    .map((item) => ({
      browser: asString(item.browser) || "unknown",
      browserVersion: asString(item.browserVersion) || "unknown",
      createdAt: asString(item.createdAt) || new Date().toISOString(),
      downloadUrl: buildDownloadFileApiPath(
        item.sessionId as string,
        asString(item.relativePath) || (item.filename as string),
      ),
      filename: item.filename as string,
      mimeType: asString(item.mimeType) || "unknown",
      protocol: asString(item.protocol) || "unknown",
      relativePath: asString(item.relativePath) || (item.filename as string),
      sessionId: item.sessionId as string,
      size: Number(item.sizeBytes) || 0,
    }));
}

export function extractSessionIdFromFilename(filename: string, type: "log" | "video"): string {
  const extension = type === "video" ? ".mp4" : ".log";
  return filename.endsWith(extension)
    ? filename.slice(0, -extension.length)
    : "unknown";
}

export function enrichDatasetArtifacts(dataset: ConsoleDataset): void {
  const sessionsById = new Map(dataset.sessions.map((session) => [session.id, session]));

  dataset.logs = dataset.logs.map((artifact) =>
    enrichArtifactRecord(artifact, sessionsById.get(artifact.sessionId), "log"),
  );
  dataset.videos = dataset.videos.map((artifact) =>
    enrichArtifactRecord(artifact, sessionsById.get(artifact.sessionId), "video"),
  );

  const logsBySessionId = new Map(
    dataset.logs.map((artifact) => [artifact.sessionId, artifact]),
  );
  const videosBySessionId = new Map(
    dataset.videos.map((artifact) => [artifact.sessionId, artifact]),
  );

  for (const session of dataset.sessions) {
    const logArtifact = logsBySessionId.get(session.id);
    const videoArtifact = videosBySessionId.get(session.id);
    const liveLogs = isLiveLogAvailable(session);
    const savedLogs = Boolean(logArtifact);

    session.artifacts.liveLogs = liveLogs;
    session.artifacts.savedLogs = savedLogs;
    session.artifacts.logs = savedLogs || liveLogs;
    session.artifacts.video = Boolean(videoArtifact);
    session.capabilities = {
      ...session.capabilities,
      enableLog: session.artifacts.logs,
      enableVideo: session.artifacts.video,
    };
    session.metadata.liveLogEndpoint = liveLogs
      ? buildLiveLogApiPath(session.id)
      : "";
    session.metadata.logFileEndpoint = logArtifact
      ? buildLogFileApiPath(logArtifact.filename)
      : "";
    session.metadata.logFilename = logArtifact?.filename || "";
    session.metadata.videoFilename = videoArtifact?.filename || "";
  }
}

export function enrichArtifactRecord<T extends LogArtifact | VideoArtifact>(
  artifact: T,
  session: ConsoleSession | undefined,
  type: "log" | "video",
): T {
  if (!session) {
    return artifact;
  }

  return {
    ...artifact,
    browser: session.browser,
    createdAt: session.finishedAt || session.startedAt || artifact.createdAt,
    liveStreamAvailable: type === "log" ? isLiveLogAvailable(session) : false,
    protocol: session.protocol,
  };
}

export function isLiveLogAvailable(session: ConsoleSession): boolean {
  return session.status === "running";
}

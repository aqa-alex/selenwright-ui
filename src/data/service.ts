import {
  buildArtifactList,
  buildDownloadList,
  enrichDatasetArtifacts,
} from "../app/api/artifacts";
import {
  createEmptyConfigurationData,
  fetchConfiguration,
  normalizeConfigurationState,
} from "../app/api/configuration";
import { asString, isRecord } from "../app/api/guards";
import { fetchJson } from "../app/api/http";
import {
  buildBrowserInventoryFromStatus,
  buildBrowserUsageFromStatus,
  buildSessionsFromStatus,
} from "../app/api/sessions";
import {
  fetchArtifactHistorySettings,
  normalizeArtifactHistorySettings,
} from "../app/api/settings";
import type {
  ConsoleDataHandlers,
  ConsoleDataset,
  ConsoleDataSubscription,
  ConsoleSnapshot,
  MetaResponse,
  RawArtifactItem,
  RawDownloadItem,
  RawStatusPayload,
  SnapshotResult,
} from "../app/api/types";

export type * from "../app/api/types";
export { loadLogFileContent, subscribeToLiveLogs } from "../app/api/artifacts";
export { saveArtifactHistorySettings } from "../app/api/settings";
export { terminateSession } from "../app/api/sessions";

const DEFAULT_TARGET = "http://localhost:4444";
const CONSOLE_STREAM_PATH = "/api/stream/console";

export function createEmptyDataset(target = DEFAULT_TARGET): ConsoleDataset {
  return {
    browsers: [],
    configuration: createEmptyConfigurationData(),
    connection: {
      mode: "live",
      ready: false,
      target,
      message: "Connecting to Selenwright",
      statusEndpointMessage: "Status endpoint unavailable",
    },
    downloads: [],
    logs: [],
    settings: {
      artifactHistory: {
        available: false,
        enabled: false,
        reason: "Artifact history settings unavailable",
        retentionDays: 7,
      },
    },
    sessions: [],
    system: {
      activeSessions: 0,
      browserUsage: [],
      healthNotes: [],
      lastReloadTime: new Date().toISOString(),
      limits: { total: 0, used: 0, queued: 0, pending: 0 },
      runtimeMessage: "Status endpoint unavailable",
      usageSummary: [
        { label: "Queued requests", value: "0" },
        { label: "Pending starts", value: "0" },
        { label: "Active sessions", value: "0" },
        { label: "Ready state", value: "Not ready" },
      ],
    },
    videos: [],
  };
}

export async function loadConsoleData(): Promise<ConsoleDataset> {
  const snapshot = await fetchConsoleSnapshot();
  return buildConsoleDatasetFromSnapshot(snapshot);
}

export function buildConsoleDatasetFromSnapshot(snapshot: ConsoleSnapshot = {}): ConsoleDataset {
  const target = snapshot.target || DEFAULT_TARGET;
  const dataset = createEmptyDataset(target);
  dataset.system.lastReloadTime = snapshot.fetchedAt || dataset.system.lastReloadTime;
  dataset.configuration = normalizeConfigurationState(snapshot.config);

  const statusState = snapshot.status;
  if (statusState?.ok) {
    const payload = statusState.value || {};
    const total = Number(payload.total) || 0;
    const used = Number(payload.used) || 0;
    const queued = Number(payload.queued) || 0;
    const pending = Number(payload.pending) || 0;

    dataset.connection.ready =
      (payload.value?.ready as boolean | undefined) ?? true;
    dataset.connection.statusEndpointMessage =
      asString(payload.value?.message) || "Connected to status endpoint";
    dataset.connection.message = dataset.connection.ready
      ? "Live status connected"
      : "Live endpoint not ready";
    dataset.system.runtimeMessage = dataset.connection.statusEndpointMessage;
    dataset.system.limits = { total, used, queued, pending };
    dataset.system.activeSessions = used + pending;
    dataset.system.usageSummary = [
      { label: "Queued requests", value: String(queued) },
      { label: "Pending starts", value: String(pending) },
      { label: "Active sessions", value: String(used + pending) },
      { label: "Ready state", value: dataset.connection.ready ? "Ready" : "Not ready" },
    ];

    if (isRecord(payload.browsers)) {
      dataset.system.browserUsage = buildBrowserUsageFromStatus(payload.browsers);
      dataset.browsers = buildBrowserInventoryFromStatus(
        payload.browsers,
        dataset.configuration.raw.browserCatalog,
      );
      dataset.sessions = buildSessionsFromStatus(payload.browsers, snapshot.fetchedAt);
    }
  } else {
    const errorMessage =
      statusState && !statusState.ok
        ? statusState.error || "Status endpoint unavailable"
        : "Status endpoint unavailable";
    dataset.connection.ready = false;
    dataset.connection.message = "Live status unavailable";
    dataset.connection.statusEndpointMessage = errorMessage;
    dataset.system.runtimeMessage = errorMessage;
    dataset.system.healthNotes = [errorMessage];
  }

  if (snapshot.logs?.ok && Array.isArray(snapshot.logs.value)) {
    dataset.logs = buildArtifactList(snapshot.logs.value, "log");
  }

  if (snapshot.videos?.ok && Array.isArray(snapshot.videos.value)) {
    dataset.videos = buildArtifactList(snapshot.videos.value, "video");
  }

  if (snapshot.downloads?.ok && Array.isArray(snapshot.downloads.value)) {
    dataset.downloads = buildDownloadList(snapshot.downloads.value);
  }

  if (snapshot.historySettings?.ok && snapshot.historySettings.value) {
    dataset.settings.artifactHistory = normalizeArtifactHistorySettings(
      snapshot.historySettings.value,
    );
  } else if (snapshot.historySettings && !snapshot.historySettings.ok) {
    dataset.settings.artifactHistory = {
      ...dataset.settings.artifactHistory,
      reason: snapshot.historySettings.error,
    };
  }

  enrichDatasetArtifacts(dataset);

  return dataset;
}

export function subscribeToConsoleData(
  handlers: ConsoleDataHandlers = {},
): ConsoleDataSubscription {
  if (typeof EventSource === "undefined") {
    throw new Error("EventSource is not available in this browser");
  }

  const { onDataset = () => {}, onError = () => {} } = handlers;
  const source = new EventSource(CONSOLE_STREAM_PATH);
  let closed = false;

  source.addEventListener("snapshot", (event: MessageEvent<string>) => {
    try {
      const snapshot = JSON.parse(event.data) as ConsoleSnapshot;
      onDataset(buildConsoleDatasetFromSnapshot(snapshot));
    } catch (error) {
      onError(
        error instanceof Error
          ? error
          : new Error("Failed to parse console stream payload"),
      );
    }
  });

  source.onerror = () => {
    if (!closed) {
      onError(new Error("Console stream disconnected"));
    }
  };

  return {
    close() {
      closed = true;
      source.close();
    },
  };
}

async function fetchConsoleSnapshot(): Promise<ConsoleSnapshot> {
  const [
    metaResult,
    configResult,
    statusResult,
    logsResult,
    videosResult,
    downloadsResult,
    historySettingsResult,
  ] = await Promise.allSettled([
    fetchJson<MetaResponse>("/api/meta"),
    fetchConfiguration(),
    fetchJson<RawStatusPayload>("/api/status"),
    fetchJson<RawArtifactItem[]>("/api/logs"),
    fetchJson<RawArtifactItem[]>("/api/videos"),
    fetchJson<RawDownloadItem[]>("/api/downloads"),
    fetchArtifactHistorySettings(),
  ]);

  const target =
    metaResult.status === "fulfilled" && typeof metaResult.value.target === "string"
      ? metaResult.value.target
      : DEFAULT_TARGET;

  return {
    config: normalizeSnapshotResult(
      configResult,
      "Configuration endpoint unavailable",
    ),
    downloads: normalizeSnapshotResult(
      downloadsResult,
      "Downloads endpoint unavailable",
    ),
    fetchedAt: new Date().toISOString(),
    historySettings: normalizeSnapshotResult(
      historySettingsResult,
      "Artifact history settings unavailable",
    ),
    logs: normalizeSnapshotResult(logsResult, "Logs endpoint unavailable"),
    status: normalizeSnapshotResult(statusResult, "Status endpoint unavailable"),
    target,
    videos: normalizeSnapshotResult(videosResult, "Videos endpoint unavailable"),
  };
}

function normalizeSnapshotResult<T>(
  result: PromiseSettledResult<T>,
  fallbackError: string,
): SnapshotResult<T> {
  if (result.status === "fulfilled") {
    return {
      ok: true,
      value: result.value,
    };
  }

  return {
    error: result.reason instanceof Error ? result.reason.message : fallbackError,
    ok: false,
  };
}

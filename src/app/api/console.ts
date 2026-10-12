import {
  buildArtifactList,
  buildDownloadList,
  enrichDatasetArtifacts,
} from "./artifacts";
import {
  createEmptyConfigurationData,
  normalizeConfigurationState,
} from "./configuration";
import { asString, isRecord } from "./guards";
import {
  buildBrowserInventoryFromStatus,
  buildBrowserUsageFromStatus,
  buildSessionsFromStatus,
} from "./sessions";
import { normalizeArtifactHistorySettings } from "./settings";
import type { ConsoleDataset, ConsoleSnapshot } from "./types";

const DEFAULT_TARGET = "";

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
    sectionErrors: {
      downloads: "",
      logs: "",
      videos: "",
    },
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
      dataset.sessions = buildSessionsFromStatus(
        payload.browsers,
        snapshot.fetchedAt,
        dataset.configuration.raw.browserCatalog,
      );
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
  } else if (snapshot.logs && !snapshot.logs.ok) {
    dataset.sectionErrors.logs = snapshot.logs.error || "Logs endpoint unavailable";
  }

  if (snapshot.videos?.ok && Array.isArray(snapshot.videos.value)) {
    dataset.videos = buildArtifactList(snapshot.videos.value, "video");
  } else if (snapshot.videos && !snapshot.videos.ok) {
    dataset.sectionErrors.videos = snapshot.videos.error || "Videos endpoint unavailable";
  }

  if (snapshot.downloads?.ok && Array.isArray(snapshot.downloads.value)) {
    dataset.downloads = buildDownloadList(snapshot.downloads.value);
  } else if (snapshot.downloads && !snapshot.downloads.ok) {
    dataset.sectionErrors.downloads = snapshot.downloads.error || "Downloads endpoint unavailable";
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

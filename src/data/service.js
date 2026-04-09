const DEFAULT_TARGET = "http://localhost:4444";
const CONSOLE_STREAM_PATH = "/api/stream/console";
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const TERMINATE_REQUEST_TIMEOUT_MS = 8000;

export function createEmptyDataset(target = DEFAULT_TARGET) {
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

export async function loadConsoleData() {
  const snapshot = await fetchConsoleSnapshot();
  return buildConsoleDatasetFromSnapshot(snapshot);
}

export function buildConsoleDatasetFromSnapshot(snapshot = {}) {
  const target = snapshot?.target || DEFAULT_TARGET;
  const dataset = createEmptyDataset(target);
  dataset.system.lastReloadTime = snapshot?.fetchedAt || dataset.system.lastReloadTime;
  dataset.configuration = normalizeConfigurationState(snapshot?.config);

  const statusState = snapshot?.status;
  if (statusState?.ok) {
    const payload = statusState.value || {};
    const total = Number(payload.total) || 0;
    const used = Number(payload.used) || 0;
    const queued = Number(payload.queued) || 0;
    const pending = Number(payload.pending) || 0;

    dataset.connection.ready = payload?.value?.ready ?? true;
    dataset.connection.statusEndpointMessage = payload?.value?.message || "Connected to status endpoint";
    dataset.connection.message = dataset.connection.ready ? "Live status connected" : "Live endpoint not ready";
    dataset.system.runtimeMessage = dataset.connection.statusEndpointMessage;
    dataset.system.limits = { total, used, queued, pending };
    dataset.system.activeSessions = used + pending;
    dataset.system.usageSummary = [
      { label: "Queued requests", value: String(queued) },
      { label: "Pending starts", value: String(pending) },
      { label: "Active sessions", value: String(used + pending) },
      { label: "Ready state", value: dataset.connection.ready ? "Ready" : "Not ready" },
    ];

    if (payload?.browsers && typeof payload.browsers === "object") {
      dataset.system.browserUsage = buildBrowserUsageFromStatus(payload.browsers);
      dataset.browsers = buildBrowserInventoryFromStatus(payload.browsers);
      dataset.sessions = buildSessionsFromStatus(payload.browsers, snapshot?.fetchedAt);
    }
  } else {
    const errorMessage =
      statusState?.error ||
      "Status endpoint unavailable";
    dataset.connection.ready = false;
    dataset.connection.message = "Live status unavailable";
    dataset.connection.statusEndpointMessage = errorMessage;
    dataset.system.runtimeMessage = errorMessage;
    dataset.system.healthNotes = [errorMessage];
  }

  if (snapshot?.logs?.ok && Array.isArray(snapshot.logs.value)) {
    dataset.logs = buildArtifactList(snapshot.logs.value, "log");
  }

  if (snapshot?.videos?.ok && Array.isArray(snapshot.videos.value)) {
    dataset.videos = buildArtifactList(snapshot.videos.value, "video");
  }

  if (snapshot?.downloads?.ok && Array.isArray(snapshot.downloads.value)) {
    dataset.downloads = buildDownloadList(snapshot.downloads.value);
  }

  if (snapshot?.historySettings?.ok && snapshot.historySettings.value) {
    dataset.settings.artifactHistory = normalizeArtifactHistorySettings(snapshot.historySettings.value);
  } else if (snapshot?.historySettings?.error) {
    dataset.settings.artifactHistory = {
      ...dataset.settings.artifactHistory,
      reason: snapshot.historySettings.error,
    };
  }

  enrichDatasetArtifacts(dataset);

  return dataset;
}

export function subscribeToConsoleData(handlers = {}) {
  if (typeof EventSource === "undefined") {
    throw new Error("EventSource is not available in this browser");
  }

  const { onDataset = () => {}, onError = () => {} } = handlers;
  const source = new EventSource(CONSOLE_STREAM_PATH);
  let closed = false;

  source.addEventListener("snapshot", (event) => {
    try {
      const snapshot = JSON.parse(event.data);
      onDataset(buildConsoleDatasetFromSnapshot(snapshot));
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Failed to parse console stream payload"));
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

async function fetchConsoleSnapshot() {
  const [metaResult, configResult, statusResult, logsResult, videosResult, downloadsResult, historySettingsResult] =
    await Promise.allSettled([
      fetchJson("/api/meta"),
      fetchConfiguration(),
      fetchJson("/api/status"),
      fetchJson("/api/logs"),
      fetchJson("/api/videos"),
      fetchJson("/api/downloads"),
      fetchArtifactHistorySettings(),
    ]);

  const target =
    metaResult.status === "fulfilled" && metaResult.value?.target
      ? metaResult.value.target
      : DEFAULT_TARGET;

  return {
    config: normalizeSnapshotResult(configResult, "Configuration endpoint unavailable"),
    downloads: normalizeSnapshotResult(downloadsResult, "Downloads endpoint unavailable"),
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

export async function loadLogFileContent(filename) {
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

export async function saveArtifactHistorySettings(settings) {
  const response = await fetch("/api/history/settings", {
    body: JSON.stringify(settings),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    method: "PUT",
  });

  const payload = await readJsonResponse(response, "Artifact history update");

  if (!response.ok) {
    throw new Error(extractResponseErrorMessage(payload, `Request failed (${response.status})`));
  }

  return normalizeArtifactHistorySettings(payload);
}

export async function terminateSession(sessionId, protocol = "") {
  if (!sessionId) {
    throw new Error("Session id is required");
  }

  const search = new URLSearchParams();
  if (protocol) {
    search.set("protocol", protocol);
  }

  const response = await fetchWithTimeout(
    `/api/sessions/${encodeURIComponent(sessionId)}${search.size ? `?${search.toString()}` : ""}`,
    {
      headers: {
        accept: "application/json",
      },
      method: "DELETE",
    },
    TERMINATE_REQUEST_TIMEOUT_MS,
    `Session ${sessionId} terminate`,
  );

  const payload = await readJsonResponse(response, "Session terminate");

  if (!response.ok) {
    throw new Error(extractResponseErrorMessage(payload, `Request failed for session ${sessionId} (${response.status})`));
  }

  return payload;
}

export function subscribeToLiveLogs(sessionId, handlers = {}) {
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
  let source = null;

  const emitStatus = (status, message, extra = {}) => {
    onStatusChange({
      attempt: 0,
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

  const parseStreamPayload = (event) => {
    try {
      return JSON.parse(event.data);
    } catch {
      return null;
    }
  };

  source = new EventSource(buildLiveLogApiPath(sessionId));

  source.addEventListener("chunk", (event) => {
    const payload = parseStreamPayload(event);
    const chunk = typeof payload?.chunk === "string" ? payload.chunk : "";
    if (!chunk) {
      return;
    }

    sawChunk = true;
    onChunk(chunk);
    emitStatus("streaming", "Streaming live log output.");
  });

  source.addEventListener("status", (event) => {
    const payload = parseStreamPayload(event);
    if (!payload) {
      return;
    }

    const nextStatus = typeof payload.status === "string" ? payload.status : "open";
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
    emitStatus(
      sawChunk ? "streaming" : "open",
      sawChunk ? "Streaming live log output." : "Live stream connected, waiting for first line.",
    );
  };

  source.onerror = () => {
    if (disposed) {
      return;
    }

    const errorMessage = sawChunk ? "Live log stream dropped. Reconnecting." : "Live log stream unavailable.";
    onError(new Error(sawChunk ? "Live log stream dropped" : "Live log stream unavailable"));
    emitStatus("reconnecting", errorMessage);
  };

  return {
    close() {
      disposed = true;
      closeSource();
      emitStatus("closed", "Live log stream closed.", {
        clean: true,
        code: 1000,
        reason: "Client closed",
      });
    },
  };
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(
    url,
    {
      headers: { accept: "application/json" },
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    `Request ${url}`,
  );

  if (!response.ok) {
    throw new Error(`Request failed for ${url} (${response.status})`);
  }

  return readResponseJsonWithTimeout(response, DEFAULT_REQUEST_TIMEOUT_MS, `Request ${url}`);
}

async function fetchConfiguration() {
  const response = await fetchWithTimeout(
    "/api/config",
    {
      headers: { accept: "application/json" },
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Configuration request",
  );
  const payload = await readJsonResponse(response, "Configuration endpoint");

  if (!response.ok) {
    throw new Error(extractResponseErrorMessage(payload, `Request failed for /api/config (${response.status})`));
  }

  return payload;
}

async function fetchArtifactHistorySettings() {
  const response = await fetchWithTimeout(
    "/api/history/settings",
    {
      headers: { accept: "application/json" },
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Artifact history request",
  );
  const payload = await readJsonResponse(response, "Artifact history endpoint");

  if (!response.ok) {
    throw new Error(extractResponseErrorMessage(payload, `Request failed for /api/history/settings (${response.status})`));
  }

  return normalizeArtifactHistorySettings(payload);
}

function buildArtifactList(items, type) {
  return items
    .filter((item) => {
      if (typeof item === "string") return item.trim();
      return item && typeof item === "object" && item.filename;
    })
    .map((item) => {
      const isObject = typeof item === "object";
      const filename = isObject ? item.filename : item;
      const sessionId = isObject ? item.sessionId : extractSessionIdFromFilename(filename, type);
      const base = {
        browser: isObject ? item.browser || "unknown" : "unknown",
        createdAt: isObject ? item.createdAt : undefined,
        filename,
        protocol: isObject ? item.protocol || "unknown" : "unknown",
        sessionId,
        size: isObject ? Number(item.size) || 0 : 0,
      };

      if (type === "video") {
        return { ...base, durationMs: isObject ? Number(item.durationMs) || 0 : 0 };
      }

      return {
        ...base,
        content: "",
        contentLoaded: false,
        contentError: "",
        liveStreamAvailable: false,
      };
    });
}

function extractSessionIdFromFilename(filename, type) {
  const extension = type === "video" ? ".mp4" : ".log";
  return filename.endsWith(extension) ? filename.slice(0, -extension.length) : "unknown";
}

function buildDownloadList(items) {
  return items
    .filter((item) => item && typeof item === "object" && item.filename && item.sessionId)
    .map((item) => ({
      browser: item.browser || "unknown",
      browserVersion: item.browserVersion || "unknown",
      createdAt: item.createdAt || new Date().toISOString(),
      downloadUrl: buildDownloadFileApiPath(item.sessionId, item.relativePath || item.filename),
      filename: item.filename,
      mimeType: item.mimeType || "unknown",
      protocol: item.protocol || "unknown",
      relativePath: item.relativePath || item.filename,
      sessionId: item.sessionId,
      size: Number(item.sizeBytes) || 0,
    }));
}

function normalizeArtifactHistorySettings(value) {
  const hasArtifactHistoryFields =
    isRecord(value) &&
    (Object.prototype.hasOwnProperty.call(value, "enabled") ||
      Object.prototype.hasOwnProperty.call(value, "retentionDays"));
  const hasExplicitAvailability = isRecord(value) && Object.prototype.hasOwnProperty.call(value, "available");

  return {
    available: hasExplicitAvailability ? Boolean(value.available) : hasArtifactHistoryFields,
    enabled: Boolean(value?.enabled),
    reason: typeof value?.reason === "string" ? value.reason : "",
    retentionDays: Number(value?.retentionDays) || 7,
  };
}

function createEmptyConfigurationData(message = "Waiting for configuration data") {
  return {
    available: false,
    featureAvailability: [],
    limits: [],
    logging: [],
    message,
    paths: [],
    raw: {
      browserCatalog: [],
      flags: {},
      reloadStatus: {},
    },
  };
}

function normalizeConfigurationState(configState) {
  if (!configState?.ok) {
    return createEmptyConfigurationData(configState?.error || "Configuration endpoint unavailable");
  }

  if (!isRecord(configState.value)) {
    return createEmptyConfigurationData("Configuration payload invalid.");
  }

  return {
    available: true,
    featureAvailability: normalizeConfigurationItems(configState.value.featureAvailability),
    limits: normalizeConfigurationItems(configState.value.limits),
    logging: normalizeConfigurationItems(configState.value.logging),
    message: "",
    paths: normalizeConfigurationItems(configState.value.paths),
    raw: normalizeConfigurationRaw(configState.value.raw),
  };
}

function normalizeConfigurationItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      return [];
    }

    const key =
      typeof entry.key === "string" && entry.key.trim()
        ? entry.key.trim()
        : `config-item-${index + 1}`;
    const label =
      typeof entry.label === "string" && entry.label.trim()
        ? entry.label.trim()
        : key;

    return [
      {
        key,
        label,
        value: formatConfigurationValue(entry.value),
      },
    ];
  });
}

function normalizeConfigurationRaw(value) {
  if (!isRecord(value)) {
    return createEmptyConfigurationData().raw;
  }

  return {
    browserCatalog: Array.isArray(value.browserCatalog) ? value.browserCatalog : [],
    flags: isRecord(value.flags) ? value.flags : {},
    reloadStatus: isRecord(value.reloadStatus) ? value.reloadStatus : {},
  };
}

function formatConfigurationValue(value) {
  if (typeof value === "string") {
    return value.trim() || "Unavailable";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value == null) {
    return "Unavailable";
  }

  try {
    return JSON.stringify(value) || "Unavailable";
  } catch {
    return String(value);
  }
}

async function readJsonResponse(response, contextLabel) {
  const text = await readResponseTextWithTimeout(response, DEFAULT_REQUEST_TIMEOUT_MS, contextLabel);
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error(`${contextLabel} returned empty response.`);
  }

  try {
    const payload = JSON.parse(trimmed);
    if (isRecord(payload)) {
      return payload;
    }

    throw new Error(`${contextLabel} returned invalid JSON payload.`);
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("returned invalid JSON payload.")) {
      throw error;
    }

    throw new Error(buildNonJsonResponseMessage(contextLabel, trimmed));
  }
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, contextLabel = "Request") {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${contextLabel} timed out after ${formatTimeoutMs(timeoutMs)}.`);
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function formatTimeoutMs(timeoutMs) {
  return timeoutMs % 1000 === 0 ? `${timeoutMs / 1000}s` : `${timeoutMs}ms`;
}

async function readResponseTextWithTimeout(response, timeoutMs, contextLabel) {
  return withTimeout(response.text(), timeoutMs, `${contextLabel} response`);
}

async function readResponseJsonWithTimeout(response, timeoutMs, contextLabel) {
  return withTimeout(response.json(), timeoutMs, `${contextLabel} response`);
}

async function withTimeout(promise, timeoutMs, contextLabel) {
  let timer = 0;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => {
          reject(new Error(`${contextLabel} timed out after ${formatTimeoutMs(timeoutMs)}.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

function extractResponseErrorMessage(payload, fallbackMessage) {
  if (typeof payload?.reason === "string" && payload.reason.trim()) {
    return payload.reason.trim();
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  return fallbackMessage;
}

function buildNonJsonResponseMessage(contextLabel, responseText) {
  const excerpt = summarizeResponseExcerpt(responseText);
  return excerpt
    ? `${contextLabel} returned non-JSON response: ${excerpt}`
    : `${contextLabel} returned non-JSON response.`;
}

function summarizeResponseExcerpt(responseText) {
  const collapsed = String(responseText || "").replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "";
  }

  const excerpt = collapsed.length > 120 ? `${collapsed.slice(0, 117)}...` : collapsed;
  return `"${excerpt}"`;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildDownloadFileApiPath(sessionId, relativePath) {
  const encodedSessionId = encodeURIComponent(sessionId);
  const encodedRelativePath = String(relativePath || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/downloads/file/${encodedSessionId}/${encodedRelativePath}`;
}

function enrichDatasetArtifacts(dataset) {
  const sessionsById = new Map(dataset.sessions.map((session) => [session.id, session]));

  dataset.logs = dataset.logs.map((artifact) => enrichArtifactRecord(artifact, sessionsById.get(artifact.sessionId), "log"));
  dataset.videos = dataset.videos.map((artifact) => enrichArtifactRecord(artifact, sessionsById.get(artifact.sessionId), "video"));

  const logsBySessionId = new Map(dataset.logs.map((artifact) => [artifact.sessionId, artifact]));
  const videosBySessionId = new Map(dataset.videos.map((artifact) => [artifact.sessionId, artifact]));

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
    session.metadata.liveLogEndpoint = liveLogs ? buildLiveLogApiPath(session.id) : "";
    session.metadata.logFileEndpoint = logArtifact ? buildLogFileApiPath(logArtifact.filename) : "";
    session.metadata.logFilename = logArtifact?.filename || "";
    session.metadata.videoFilename = videoArtifact?.filename || "";
  }
}

function enrichArtifactRecord(artifact, session, type) {
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

function buildBrowserInventoryFromStatus(browserTree) {
  const rows = [];

  for (const [browser, versions] of Object.entries(browserTree)) {
    for (const version of Object.keys(versions || {})) {
      rows.push({
        browser,
        version,
        protocol: inferProtocol(browser),
        source: "Configured in Selenwright",
        capabilities: "n/a",
        status: "ready",
      });
    }
  }

  return rows;
}

function inferProtocol(browser) {
  return browser === "chromium" || browser === "webkit" ? "playwright" : "selenium";
}

function buildSessionsFromStatus(browserTree, referenceTime = new Date().toISOString()) {
  const nowIso = referenceTime || new Date().toISOString();
  const sessions = [];

  for (const [browser, versions] of Object.entries(browserTree || {})) {
    for (const [version, quotas] of Object.entries(versions || {})) {
      for (const [quotaName, quotaEntry] of Object.entries(quotas || {})) {
        if (!quotaEntry || !Array.isArray(quotaEntry.sessions)) {
          continue;
        }

        for (const raw of quotaEntry.sessions) {
          const id = raw?.id || cryptoRandomId();
          const encodedId = encodeURIComponent(id);
          const protocol = inferProtocol(browser);
          const startedAt = raw?.started || nowIso;
          const durationMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
          const screen = raw?.screen || "1920x1080x24";
          const vncEnabled = Boolean(raw?.vnc);
          const vncEndpoint = vncEnabled ? `/api/vnc/${encodedId}` : "";
          const resolvedVersion = raw?.caps?.version || version || "latest";
          const endpoint =
            protocol === "playwright"
              ? `/playwright/${browser}/${resolvedVersion}`
              : `/wd/hub/session/${id}`;

          const capabilities = {
            browserName: browser,
            browserVersion: resolvedVersion,
            enableLog: false,
            enableVNC: vncEnabled,
            enableVideo: false,
            name: `${browser}-${id.slice(0, 8)}`,
            screenResolution: screen,
          };

          sessions.push({
            artifacts: {
              clipboard: false,
              devtools: false,
              downloads: 0,
              liveLogs: true,
              liveView: vncEnabled,
              logs: true,
              savedLogs: false,
              video: false,
              vnc: vncEnabled,
            },
            browser,
            browserVersion: resolvedVersion,
            capabilities,
            clipboardPreview: "",
            durationMs,
            endpoint,
            finishedAt: null,
            id,
            lastActivityAt: nowIso,
            livePreviewUrl: vncEndpoint,
            metadata: {
              container: raw?.container
                ? {
                    id: raw.container,
                    ip: raw?.containerInfo?.ip || "",
                    exposedPorts: {},
                  }
                : null,
              devtoolsEndpoint: "",
              downloadEndpoint: `/download/${id}/`,
              clipboardEndpoint: `/clipboard/${id}`,
              liveLogEndpoint: buildLiveLogApiPath(id),
              logEndpoint: `/logs/${id}.log`,
              logFileEndpoint: "",
              logFilename: "",
              protocolEndpoint: endpoint,
              quota: quotaName,
              screen,
              videoFilename: "",
              vncEndpoint,
            },
            name: capabilities.name,
            node: raw?.containerInfo?.id || "",
            order: sessions.length,
            protocol,
            protocolVersion: resolvedVersion,
            startedAt,
            status: raw?.status,
          });
        }
      }
    }
  }

  return sessions.sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
}

function normalizeSnapshotResult(result, fallbackError) {
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

function buildLogFileApiPath(filename) {
  return `/api/logs/file/${encodeURIComponent(filename)}`;
}

function buildLiveLogApiPath(sessionId) {
  return `/api/logs/live/${encodeURIComponent(sessionId)}`;
}

function isLiveLogAvailable(session) {
  return session?.status === "running";
}

function cryptoRandomId() {
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function buildBrowserUsageFromStatus(browserTree) {
  return Object.entries(browserTree)
    .map(([browser, versions]) => {
      let count = 0;
      for (const quotas of Object.values(versions)) {
        if (!quotas || typeof quotas !== "object") {
          continue;
        }
        for (const quotaEntry of Object.values(quotas)) {
          if (quotaEntry && typeof quotaEntry.count === "number") {
            count += quotaEntry.count;
          }
        }
      }
      return { browser, count, running: count };
    })
    .sort((left, right) => right.running - left.running);
}

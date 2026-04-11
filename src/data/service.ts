const DEFAULT_TARGET = "http://localhost:4444";
const CONSOLE_STREAM_PATH = "/api/stream/console";
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const TERMINATE_REQUEST_TIMEOUT_MS = 8000;

type JsonRecord = Record<string, unknown>;

export type ThemeMode = "system" | "light" | "dark";
export type DensityMode = "compact" | "comfortable";
export type DetailPanelMode = "collapsed" | "expanded";
export type TimeFormatMode = "12h" | "24h";
export type TimezoneMode = "local" | "utc";

export interface ConsolePreferences {
  density: DensityMode;
  detailPanel: DetailPanelMode;
  themeMode: ThemeMode;
  timeFormat: TimeFormatMode;
  timezone: TimezoneMode;
  artifactPaneWidths: {
    videos: number;
    logs: number;
    downloads: number;
  };
}

export interface ConfigurationItem {
  key: string;
  label: string;
  value: string;
}

export interface BrowserCatalogVersion {
  version: string;
  image: string;
}

export interface BrowserCatalogEntry {
  name: string;
  versions: BrowserCatalogVersion[];
}

export interface ConfigurationRawData {
  browserCatalog: BrowserCatalogEntry[];
  flags: JsonRecord;
  reloadStatus: JsonRecord;
}

export interface ConfigurationData {
  available: boolean;
  featureAvailability: ConfigurationItem[];
  limits: ConfigurationItem[];
  logging: ConfigurationItem[];
  message: string;
  paths: ConfigurationItem[];
  raw: ConfigurationRawData;
}

export interface ArtifactHistorySettings {
  available: boolean;
  enabled: boolean;
  reason: string;
  retentionDays: number;
}

export interface ArtifactHistorySettingsUpdate {
  enabled: boolean;
  retentionDays: number;
}

export interface ConsoleConnectionState {
  mode: "live";
  ready: boolean;
  target: string;
  message: string;
  statusEndpointMessage: string;
}

export interface BrowserUsageRow {
  browser: string;
  count: number;
  running: number;
}

export interface UsageSummaryItem {
  label: string;
  value: string;
}

export interface ConsoleSystemState {
  activeSessions: number;
  browserUsage: BrowserUsageRow[];
  healthNotes: string[];
  lastReloadTime: string;
  limits: {
    total: number;
    used: number;
    queued: number;
    pending: number;
  };
  runtimeMessage: string;
  usageSummary: UsageSummaryItem[];
}

export interface BrowserInventoryRow {
  browser: string;
  version: string;
  protocol: string;
  source: string;
  status: string;
}

export interface SessionArtifactState {
  clipboard: boolean;
  devtools: boolean;
  downloads: number;
  liveLogs: boolean;
  liveView: boolean;
  logs: boolean;
  savedLogs: boolean;
  video: boolean;
  vnc: boolean;
}

export interface SessionCapabilities {
  browserName: string;
  browserVersion: string;
  enableLog: boolean;
  enableVNC: boolean;
  enableVideo: boolean;
  name: string;
  screenResolution: string;
}

export interface SessionContainerMetadata {
  id: string;
  ip: string;
  exposedPorts: JsonRecord;
}

export interface SessionMetadata {
  container: SessionContainerMetadata | null;
  devtoolsEndpoint: string;
  downloadEndpoint: string;
  clipboardEndpoint: string;
  liveLogEndpoint: string;
  logEndpoint: string;
  logFileEndpoint: string;
  logFilename: string;
  protocolEndpoint: string;
  quota: string;
  screen: string;
  videoFilename: string;
  vncEndpoint: string;
}

export interface ConsoleSession {
  artifacts: SessionArtifactState;
  browser: string;
  browserVersion: string;
  capabilities: SessionCapabilities;
  clipboardPreview: string;
  durationMs: number;
  endpoint: string;
  finishedAt: string | null;
  id: string;
  lastActivityAt: string;
  livePreviewUrl: string;
  metadata: SessionMetadata;
  name: string;
  node: string;
  order: number;
  protocol: string;
  protocolVersion: string;
  startedAt: string;
  status: string;
}

export interface BaseArtifact {
  browser: string;
  createdAt?: string;
  filename: string;
  protocol: string;
  sessionId: string;
  size: number;
}

export interface VideoArtifact extends BaseArtifact {
  durationMs: number;
}

export interface LogArtifact extends BaseArtifact {
  content: string;
  contentLoaded: boolean;
  contentError: string;
  liveStreamAvailable: boolean;
}

export interface DownloadArtifact {
  browser: string;
  browserVersion: string;
  createdAt: string;
  downloadUrl: string;
  filename: string;
  mimeType: string;
  protocol: string;
  relativePath: string;
  sessionId: string;
  size: number;
}

export interface ConsoleDataset {
  browsers: BrowserInventoryRow[];
  configuration: ConfigurationData;
  connection: ConsoleConnectionState;
  downloads: DownloadArtifact[];
  logs: LogArtifact[];
  settings: {
    artifactHistory: ArtifactHistorySettings;
  };
  sessions: ConsoleSession[];
  system: ConsoleSystemState;
  videos: VideoArtifact[];
}

export interface ConsoleDataHandlers {
  onDataset?: (dataset: ConsoleDataset) => void;
  onError?: (error: Error) => void;
}

export interface ConsoleDataSubscription {
  close(): void;
}

export interface LiveLogStatusEvent extends JsonRecord {
  attempt: number;
  message: string;
  sessionId: string;
  status: string;
}

export interface LiveLogHandlers {
  onChunk?: (chunk: string) => void;
  onClose?: (payload: JsonRecord) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: LiveLogStatusEvent) => void;
}

export interface LiveLogSubscription {
  close(): void;
}

export interface SnapshotSuccess<T> {
  ok: true;
  value: T;
}

export interface SnapshotFailure {
  ok: false;
  error: string;
}

export type SnapshotResult<T> = SnapshotSuccess<T> | SnapshotFailure;

interface MetaResponse extends JsonRecord {
  target?: string;
}

interface RawConfigurationPayload extends JsonRecord {
  featureAvailability?: unknown;
  limits?: unknown;
  logging?: unknown;
  paths?: unknown;
  raw?: unknown;
}

type RawArtifactItem = string | JsonRecord;

interface RawDownloadItem extends JsonRecord {
  browser?: unknown;
  browserVersion?: unknown;
  createdAt?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  protocol?: unknown;
  relativePath?: unknown;
  sessionId?: unknown;
  sizeBytes?: unknown;
}

interface RawStatusPayloadValue extends JsonRecord {
  message?: unknown;
  ready?: unknown;
}

interface RawStatusPayload extends JsonRecord {
  browsers?: unknown;
  total?: unknown;
  used?: unknown;
  queued?: unknown;
  pending?: unknown;
  value?: RawStatusPayloadValue | null;
}

interface RawSessionEntry extends JsonRecord {
  caps?: JsonRecord | null;
  container?: unknown;
  containerInfo?: JsonRecord | null;
  id?: unknown;
  screen?: unknown;
  started?: unknown;
  status?: unknown;
  vnc?: unknown;
}

export interface ConsoleSnapshot {
  config?: SnapshotResult<RawConfigurationPayload>;
  downloads?: SnapshotResult<RawDownloadItem[]>;
  fetchedAt?: string;
  historySettings?: SnapshotResult<unknown>;
  logs?: SnapshotResult<RawArtifactItem[]>;
  status?: SnapshotResult<RawStatusPayload>;
  target?: string;
  videos?: SnapshotResult<RawArtifactItem[]>;
}

interface ConfigurationItemInput extends JsonRecord {
  key?: unknown;
  label?: unknown;
  value?: unknown;
}

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

export async function saveArtifactHistorySettings(
  settings: ArtifactHistorySettingsUpdate,
): Promise<ArtifactHistorySettings> {
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
    throw new Error(
      extractResponseErrorMessage(payload, `Request failed (${response.status})`),
    );
  }

  return normalizeArtifactHistorySettings(payload);
}

export async function terminateSession(
  sessionId: string,
  protocol = "",
): Promise<JsonRecord> {
  if (!sessionId) {
    throw new Error("Session id is required");
  }

  const search = new URLSearchParams();
  if (protocol) {
    search.set("protocol", protocol);
  }

  const response = await fetchWithTimeout(
    `/api/sessions/${encodeURIComponent(sessionId)}${
      search.size ? `?${search.toString()}` : ""
    }`,
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
    throw new Error(
      extractResponseErrorMessage(
        payload,
        `Request failed for session ${sessionId} (${response.status})`,
      ),
    );
  }

  return payload;
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
  let source: EventSource | null = null;

  const emitStatus = (status: string, message: string, extra: JsonRecord = {}) => {
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

  const parseStreamPayload = (event: MessageEvent<string>): JsonRecord | null => {
    try {
      const payload = JSON.parse(event.data) as unknown;
      return isRecord(payload) ? payload : null;
    } catch {
      return null;
    }
  };

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

    const errorMessage = sawChunk
      ? "Live log stream dropped. Reconnecting."
      : "Live log stream unavailable.";
    onError(
      new Error(sawChunk ? "Live log stream dropped" : "Live log stream unavailable"),
    );
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

async function fetchJson<T>(url: string): Promise<T> {
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

  return readResponseJsonWithTimeout<T>(
    response,
    DEFAULT_REQUEST_TIMEOUT_MS,
    `Request ${url}`,
  );
}

async function fetchConfiguration(): Promise<RawConfigurationPayload> {
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
    throw new Error(
      extractResponseErrorMessage(
        payload,
        `Request failed for /api/config (${response.status})`,
      ),
    );
  }

  return payload;
}

async function fetchArtifactHistorySettings(): Promise<ArtifactHistorySettings> {
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
    throw new Error(
      extractResponseErrorMessage(
        payload,
        `Request failed for /api/history/settings (${response.status})`,
      ),
    );
  }

  return normalizeArtifactHistorySettings(payload);
}

function buildArtifactList(items: RawArtifactItem[], type: "log"): LogArtifact[];
function buildArtifactList(items: RawArtifactItem[], type: "video"): VideoArtifact[];
function buildArtifactList(
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

function extractSessionIdFromFilename(filename: string, type: "log" | "video"): string {
  const extension = type === "video" ? ".mp4" : ".log";
  return filename.endsWith(extension)
    ? filename.slice(0, -extension.length)
    : "unknown";
}

function buildDownloadList(items: RawDownloadItem[]): DownloadArtifact[] {
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

function normalizeArtifactHistorySettings(value: unknown): ArtifactHistorySettings {
  const hasArtifactHistoryFields =
    isRecord(value) &&
    (Object.prototype.hasOwnProperty.call(value, "enabled") ||
      Object.prototype.hasOwnProperty.call(value, "retentionDays"));
  const hasExplicitAvailability =
    isRecord(value) && Object.prototype.hasOwnProperty.call(value, "available");

  return {
    available: hasExplicitAvailability ? Boolean(value.available) : hasArtifactHistoryFields,
    enabled: Boolean(isRecord(value) ? value.enabled : undefined),
    reason: isRecord(value) ? asString(value.reason) || "" : "",
    retentionDays: Number(isRecord(value) ? value.retentionDays : undefined) || 7,
  };
}

function createEmptyConfigurationData(
  message = "Waiting for configuration data",
): ConfigurationData {
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

function normalizeConfigurationState(
  configState: SnapshotResult<RawConfigurationPayload> | undefined,
): ConfigurationData {
  if (!configState?.ok) {
    return createEmptyConfigurationData(
      configState?.error || "Configuration endpoint unavailable",
    );
  }

  if (!isRecord(configState.value)) {
    return createEmptyConfigurationData("Configuration payload invalid.");
  }

  return {
    available: true,
    featureAvailability: normalizeConfigurationItems(
      configState.value.featureAvailability,
    ),
    limits: normalizeConfigurationItems(configState.value.limits),
    logging: normalizeConfigurationItems(configState.value.logging),
    message: "",
    paths: normalizeConfigurationItems(configState.value.paths),
    raw: normalizeConfigurationRaw(configState.value.raw),
  };
}

function normalizeConfigurationItems(value: unknown): ConfigurationItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      return [];
    }

    const configEntry = entry as ConfigurationItemInput;
    const key =
      typeof configEntry.key === "string" && configEntry.key.trim()
        ? configEntry.key.trim()
        : `config-item-${index + 1}`;
    const label =
      typeof configEntry.label === "string" && configEntry.label.trim()
        ? configEntry.label.trim()
        : key;

    return [
      {
        key,
        label,
        value: formatConfigurationValue(configEntry.value),
      },
    ];
  });
}

function normalizeConfigurationRaw(value: unknown): ConfigurationRawData {
  if (!isRecord(value)) {
    return createEmptyConfigurationData().raw;
  }

  return {
    browserCatalog: Array.isArray(value.browserCatalog)
      ? value.browserCatalog.filter(isBrowserCatalogEntry)
      : [],
    flags: isRecord(value.flags) ? value.flags : {},
    reloadStatus: isRecord(value.reloadStatus) ? value.reloadStatus : {},
  };
}

function formatConfigurationValue(value: unknown): string {
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

async function readJsonResponse(
  response: Response,
  contextLabel: string,
): Promise<JsonRecord> {
  const text = await readResponseTextWithTimeout(
    response,
    DEFAULT_REQUEST_TIMEOUT_MS,
    contextLabel,
  );
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error(`${contextLabel} returned empty response.`);
  }

  try {
    const payload = JSON.parse(trimmed) as unknown;
    if (isRecord(payload)) {
      return payload;
    }

    throw new Error(`${contextLabel} returned invalid JSON payload.`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.endsWith("returned invalid JSON payload.")
    ) {
      throw error;
    }

    throw new Error(buildNonJsonResponseMessage(contextLabel, trimmed));
  }
}

async function fetchWithTimeout(
  resource: RequestInfo | URL,
  options: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  contextLabel = "Request",
): Promise<Response> {
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

function formatTimeoutMs(timeoutMs: number): string {
  return timeoutMs % 1000 === 0 ? `${timeoutMs / 1000}s` : `${timeoutMs}ms`;
}

async function readResponseTextWithTimeout(
  response: Response,
  timeoutMs: number,
  contextLabel: string,
): Promise<string> {
  return withTimeout(response.text(), timeoutMs, `${contextLabel} response`);
}

async function readResponseJsonWithTimeout<T>(
  response: Response,
  timeoutMs: number,
  contextLabel: string,
): Promise<T> {
  return withTimeout(response.json() as Promise<T>, timeoutMs, `${contextLabel} response`);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  contextLabel: string,
): Promise<T> {
  let timer = 0;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => {
          reject(new Error(`${contextLabel} timed out after ${formatTimeoutMs(timeoutMs)}.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

function extractResponseErrorMessage(
  payload: JsonRecord,
  fallbackMessage: string,
): string {
  if (typeof payload.reason === "string" && payload.reason.trim()) {
    return payload.reason.trim();
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  return fallbackMessage;
}

function buildNonJsonResponseMessage(
  contextLabel: string,
  responseText: string,
): string {
  const excerpt = summarizeResponseExcerpt(responseText);
  return excerpt
    ? `${contextLabel} returned non-JSON response: ${excerpt}`
    : `${contextLabel} returned non-JSON response.`;
}

function summarizeResponseExcerpt(responseText: string): string {
  const collapsed = String(responseText || "").replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "";
  }

  const excerpt =
    collapsed.length > 120 ? `${collapsed.slice(0, 117)}...` : collapsed;
  return `"${excerpt}"`;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function buildDownloadFileApiPath(sessionId: string, relativePath: string): string {
  const encodedSessionId = encodeURIComponent(sessionId);
  const encodedRelativePath = String(relativePath || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/downloads/file/${encodedSessionId}/${encodedRelativePath}`;
}

function enrichDatasetArtifacts(dataset: ConsoleDataset): void {
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

function enrichArtifactRecord<T extends LogArtifact | VideoArtifact>(
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

function buildBrowserInventoryFromStatus(
  browserTree: JsonRecord,
  browserCatalog: BrowserCatalogEntry[] = [],
): BrowserInventoryRow[] {
  const catalogMap = new Map<string, Map<string, string>>();
  for (const entry of browserCatalog) {
    if (!entry.name || !Array.isArray(entry.versions)) {
      continue;
    }

    const versionMap = new Map(
      entry.versions
        .filter((version) => version?.version)
        .map((version) => [version.version, version.image || "—"]),
    );
    catalogMap.set(entry.name, versionMap);
  }

  const rows: BrowserInventoryRow[] = [];
  for (const [browser, versions] of Object.entries(browserTree)) {
    if (!isRecord(versions)) {
      continue;
    }

    for (const version of Object.keys(versions)) {
      rows.push({
        browser,
        version,
        protocol: inferProtocol(browser),
        source: catalogMap.get(browser)?.get(version) || "—",
        status: "ready",
      });
    }
  }

  return rows;
}

function inferProtocol(browser: string): string {
  return browser === "chromium" || browser === "webkit"
    ? "playwright"
    : "selenium";
}

function normalizeSessionStatus(raw: RawSessionEntry): string {
  const status = typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "";
  return status || "running";
}

function buildSessionsFromStatus(
  browserTree: JsonRecord,
  referenceTime = new Date().toISOString(),
): ConsoleSession[] {
  const nowIso = referenceTime || new Date().toISOString();
  const sessions: ConsoleSession[] = [];

  for (const [browser, versions] of Object.entries(browserTree)) {
    if (!isRecord(versions)) {
      continue;
    }

    for (const [version, quotas] of Object.entries(versions)) {
      if (!isRecord(quotas)) {
        continue;
      }

      for (const [quotaName, quotaEntry] of Object.entries(quotas)) {
        if (!isRecord(quotaEntry) || !Array.isArray(quotaEntry.sessions)) {
          continue;
        }

        for (const rawCandidate of quotaEntry.sessions) {
          if (!isRecord(rawCandidate)) {
            continue;
          }

          const raw = rawCandidate as RawSessionEntry;
          const id = asString(raw.id) || cryptoRandomId();
          const encodedId = encodeURIComponent(id);
          const protocol = inferProtocol(browser);
          const startedAt = asString(raw.started) || nowIso;
          const durationMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
          const screen = asString(raw.screen) || "1920x1080x24";
          const status = normalizeSessionStatus(raw);
          const vncEnabled = Boolean(raw.vnc);
          const vncEndpoint = vncEnabled ? `/api/vnc/${encodedId}` : "";
          const resolvedVersion =
            asString(raw.caps?.version) || version || "latest";
          const endpoint =
            protocol === "playwright"
              ? `/playwright/${browser}/${resolvedVersion}`
              : `/wd/hub/session/${id}`;

          const capabilities: SessionCapabilities = {
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
              container: raw.container
                ? {
                    id: String(raw.container),
                    ip: asString(raw.containerInfo?.ip) || "",
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
            node: asString(raw.containerInfo?.id) || "",
            order: sessions.length,
            protocol,
            protocolVersion: resolvedVersion,
            startedAt,
            status,
          });
        }
      }
    }
  }

  return sessions.sort(
    (left, right) =>
      new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
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

function buildLogFileApiPath(filename: string): string {
  return `/api/logs/file/${encodeURIComponent(filename)}`;
}

function buildLiveLogApiPath(sessionId: string): string {
  return `/api/logs/live/${encodeURIComponent(sessionId)}`;
}

function isLiveLogAvailable(session: ConsoleSession): boolean {
  return session.status === "running";
}

function cryptoRandomId(): string {
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function buildBrowserUsageFromStatus(browserTree: JsonRecord): BrowserUsageRow[] {
  return Object.entries(browserTree)
    .map(([browser, versions]) => {
      let count = 0;

      if (isRecord(versions)) {
        for (const quotas of Object.values(versions)) {
          if (!isRecord(quotas)) {
            continue;
          }

          for (const quotaEntry of Object.values(quotas)) {
            if (isRecord(quotaEntry) && typeof quotaEntry.count === "number") {
              count += quotaEntry.count;
            }
          }
        }
      }

      return { browser, count, running: count };
    })
    .sort((left, right) => right.running - left.running);
}

function isBrowserCatalogEntry(value: unknown): value is BrowserCatalogEntry {
  if (!isRecord(value) || typeof value.name !== "string" || !Array.isArray(value.versions)) {
    return false;
  }

  return value.versions.every(
    (version) =>
      isRecord(version) &&
      typeof version.version === "string" &&
      (version.image === undefined || typeof version.image === "string"),
  );
}

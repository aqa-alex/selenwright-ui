export type JsonRecord = Record<string, unknown>;

export type ThemeMode = "system" | "light" | "dark";
export type DetailPanelMode = "collapsed" | "expanded";
export type TimeFormatMode = "12h" | "24h";
export type TimezoneMode = "local" | "utc";

export interface ConsolePreferences {
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

export interface DiscoveredBrowserImage {
  digest: string;
  repoTags: string[];
  browser: string;
  version: string;
  protocol: string;
  isDefault: boolean;
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

export interface MetaResponse extends JsonRecord {
  target?: string;
}

export interface RawConfigurationPayload extends JsonRecord {
  featureAvailability?: unknown;
  limits?: unknown;
  logging?: unknown;
  paths?: unknown;
  raw?: unknown;
}

export type RawArtifactItem = string | JsonRecord;

export interface RawDownloadItem extends JsonRecord {
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

export interface RawStatusPayloadValue extends JsonRecord {
  message?: unknown;
  ready?: unknown;
}

export interface RawStatusPayload extends JsonRecord {
  browsers?: unknown;
  total?: unknown;
  used?: unknown;
  queued?: unknown;
  pending?: unknown;
  value?: RawStatusPayloadValue | null;
}

export interface RawSessionEntry extends JsonRecord {
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

export interface ConfigurationItemInput extends JsonRecord {
  key?: unknown;
  label?: unknown;
  value?: unknown;
}

export interface StackServiceStatus {
  service: string;
  image: string;
  imageId: string;
  imageIdShort: string;
  containerId: string;
  status: string;
  created: string;
}

export interface StackStatus {
  available: boolean;
  reason: string;
  services: StackServiceStatus[];
  projectName: string;
}

export interface StackPullServiceResult {
  service: string;
  image: string;
  previousId: string;
  currentId: string;
  updated: boolean;
  error?: string;
}

export interface StackPullResult {
  results: StackPullServiceResult[];
  hasUpdate: boolean;
}

export interface StackRecreateResult {
  accepted: boolean;
  message: string;
}

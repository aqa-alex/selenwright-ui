export type SessionStatus =
  | "completed"
  | "failed"
  | "pending"
  | "queued"
  | "running"
  | "terminated";

export interface FormatPreferences {
  timeFormat?: "12h" | "24h" | string;
  timezone?: "local" | "utc" | string;
}

const statusLabels: Record<SessionStatus, string> = {
  completed: "Completed",
  failed: "Failed",
  pending: "Pending",
  queued: "Queued",
  running: "Running",
  terminated: "Terminated",
};

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) {
    return "—";
  }
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatStatus(status: string): string {
  return statusLabels[status as SessionStatus] || titleCase(status);
}

export function titleCase(value: string): string {
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatDateTime(value: string | number | Date, preferences: FormatPreferences): string {
  const date = new Date(value);
  const useUtc = preferences.timezone === "utc";
  const hour12 = preferences.timeFormat === "12h";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    hour12,
    minute: "2-digit",
    month: "short",
    timeZone: useUtc ? "UTC" : undefined,
  }).format(date);
}

export function formatDateTimeLong(
  value: string | number | Date,
  preferences: FormatPreferences,
): string {
  const date = new Date(value);
  const useUtc = preferences.timezone === "utc";
  const hour12 = preferences.timeFormat === "12h";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    hour12,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZone: useUtc ? "UTC" : undefined,
    year: "numeric",
  }).format(date);
}

export function timeAgo(value: string | number | Date, now: number = Date.now()): string {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    return "—";
  }
  const diff = Math.max(0, now - parsed);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function compareValues(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

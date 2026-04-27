import { demoMode, target, upstreamRequestTimeoutMs } from "./config.mjs";
import {
  fetchWithTimeout,
  readUpstreamJsonWithTimeout,
  readUpstreamTextWithTimeout,
  truncateBodyPreview,
} from "./http-utils.mjs";
import { buildDemoConsoleSnapshot } from "./demo.mjs";

export async function fetchConsoleSnapshot(authHeaders) {
  if (demoMode) return { ...buildDemoConsoleSnapshot(), fetchedAt: new Date().toISOString() };

  const [configResult, statusResult, logsResult, videosResult, downloadsResult, historySettingsResult] = await Promise.allSettled([
    fetchUpstreamJson("/config", authHeaders),
    fetchUpstreamJson("/status", authHeaders),
    fetchUpstreamJson("/logs/?json", authHeaders),
    fetchUpstreamJson("/video/?json", authHeaders),
    fetchUpstreamJson("/downloads/?json", authHeaders),
    fetchUpstreamJson("/history/settings", authHeaders),
  ]);

  return {
    config: normalizeSnapshotResult(configResult, "Configuration endpoint unavailable"),
    downloads: normalizeSnapshotResult(downloadsResult, "Downloads endpoint unavailable"),
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

async function fetchUpstreamJson(upstreamPath, authHeaders) {
  const headers = { accept: "application/json" };
  if (authHeaders?.cookie) headers.cookie = authHeaders.cookie;
  if (authHeaders?.authorization) headers.authorization = authHeaders.authorization;
  const response = await fetchWithTimeout(
    new URL(upstreamPath, target),
    {
      headers,
    },
    upstreamRequestTimeoutMs,
    `Upstream ${upstreamPath}`,
  );

  if (!response.ok) {
    throw new Error(`Request failed for ${upstreamPath} (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const body = await readUpstreamTextWithTimeout(
      response,
      upstreamRequestTimeoutMs,
      `Upstream ${upstreamPath} response`,
    );
    throw new Error(
      `Expected application/json from ${upstreamPath}, got ${contentType || "unknown content-type"}: ${truncateBodyPreview(body)}`,
    );
  }

  return readUpstreamJsonWithTimeout(response, upstreamRequestTimeoutMs, `Upstream ${upstreamPath} response`);
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

export function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

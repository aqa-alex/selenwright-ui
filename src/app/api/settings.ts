import { asString, isRecord } from "./guards";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  extractResponseErrorMessage,
  fetchWithTimeout,
  readJsonResponse,
} from "./http";
import type {
  ArtifactHistorySettings,
  ArtifactHistorySettingsUpdate,
} from "./types";

export async function saveArtifactHistorySettings(
  settings: ArtifactHistorySettingsUpdate,
): Promise<ArtifactHistorySettings> {
  const response = await fetchWithTimeout(
    "/api/history/settings",
    {
      body: JSON.stringify(settings),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "PUT",
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Artifact history update",
  );

  const payload = await readJsonResponse(response, "Artifact history update");

  if (!response.ok) {
    throw new Error(
      extractResponseErrorMessage(payload, `Request failed (${response.status})`),
    );
  }

  return normalizeArtifactHistorySettings(payload);
}

export async function fetchArtifactHistorySettings(): Promise<ArtifactHistorySettings> {
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

export function normalizeArtifactHistorySettings(value: unknown): ArtifactHistorySettings {
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

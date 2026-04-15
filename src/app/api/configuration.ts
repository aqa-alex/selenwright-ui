import { isBrowserCatalogEntry, isRecord } from "./guards";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  extractResponseErrorMessage,
  fetchWithTimeout,
  readJsonResponse,
} from "./http";
import type {
  ConfigurationData,
  ConfigurationItem,
  ConfigurationItemInput,
  ConfigurationRawData,
  RawConfigurationPayload,
  SnapshotResult,
} from "./types";

export async function fetchConfiguration(): Promise<RawConfigurationPayload> {
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

export function createEmptyConfigurationData(
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

export function normalizeConfigurationState(
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

export function normalizeConfigurationItems(value: unknown): ConfigurationItem[] {
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

export function normalizeConfigurationRaw(value: unknown): ConfigurationRawData {
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

export function formatConfigurationValue(value: unknown): string {
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

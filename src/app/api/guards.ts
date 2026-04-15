import type { BrowserCatalogEntry, JsonRecord } from "./types";

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function isBrowserCatalogEntry(value: unknown): value is BrowserCatalogEntry {
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

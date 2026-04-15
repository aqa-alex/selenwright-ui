import { asString, isRecord } from "./guards";
import { buildLiveLogApiPath } from "./paths";
import {
  TERMINATE_REQUEST_TIMEOUT_MS,
  extractResponseErrorMessage,
  fetchWithTimeout,
  readJsonResponse,
} from "./http";
import type {
  BrowserCatalogEntry,
  BrowserInventoryRow,
  BrowserUsageRow,
  ConsoleSession,
  JsonRecord,
  RawSessionEntry,
  SessionCapabilities,
} from "./types";

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

export function buildBrowserInventoryFromStatus(
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

export function inferProtocol(browser: string): string {
  return browser === "chromium" || browser === "webkit"
    ? "playwright"
    : "selenium";
}

export function normalizeSessionStatus(raw: RawSessionEntry): string {
  const status = typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "";
  return status || "running";
}

export function buildSessionsFromStatus(
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
          const id = asString(raw.id) || generateFallbackSessionId();
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
          const encodedVersion = encodeURIComponent(resolvedVersion);
          const encodedBrowser = encodeURIComponent(browser);
          const endpoint =
            protocol === "playwright"
              ? `/playwright/${encodedBrowser}/${encodedVersion}`
              : `/wd/hub/session/${encodedId}`;

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
              downloadEndpoint: `/download/${encodedId}/`,
              clipboardEndpoint: `/clipboard/${encodedId}`,
              liveLogEndpoint: buildLiveLogApiPath(id),
              logEndpoint: `/logs/${encodedId}.log`,
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

export function buildBrowserUsageFromStatus(browserTree: JsonRecord): BrowserUsageRow[] {
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

export function generateFallbackSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export function isLiveLogAvailable(session: ConsoleSession): boolean {
  return session.status === "running";
}

import { createMockDataset } from "./mock-data.js";

export async function loadConsoleData() {
  const dataset = createMockDataset();

  const [metaResult, statusResult, logsResult, videosResult] = await Promise.allSettled([
    fetchJson("/api/meta"),
    fetchJson("/api/status"),
    fetchJson("/api/logs"),
    fetchJson("/api/videos"),
  ]);

  if (metaResult.status === "fulfilled") {
    dataset.connection.target = metaResult.value.target || dataset.connection.target;
  }

  if (statusResult.status === "fulfilled") {
    const payload = statusResult.value;
    dataset.connection.mode = "live";
    dataset.connection.statusEndpointMessage =
      payload?.value?.message || "Connected to live status endpoint";
    dataset.connection.ready = payload?.value?.ready ?? true;
    dataset.connection.message = dataset.connection.ready ? "Live status connected" : "Live endpoint not ready";
    dataset.system.runtimeMessage = dataset.connection.statusEndpointMessage;

    if (typeof payload?.total === "number") {
      dataset.system.limits = {
        pending: payload.pending ?? dataset.system.limits.pending,
        queued: payload.queued ?? dataset.system.limits.queued,
        total: payload.total,
        used: payload.used ?? dataset.system.limits.used,
      };
      dataset.system.activeSessions = (payload.used ?? 0) + (payload.pending ?? 0);
      dataset.system.usageSummary = [
        { label: "Queued requests", value: String(payload.queued ?? 0) },
        { label: "Pending starts", value: String(payload.pending ?? 0) },
        { label: "Active sessions", value: String((payload.used ?? 0) + (payload.pending ?? 0)) },
        { label: "Ready state", value: dataset.connection.ready ? "Ready" : "Not ready" },
      ];
    } else {
      dataset.system.usageSummary = dataset.system.usageSummary.map((entry) =>
        entry.label === "Ready state"
          ? { ...entry, value: dataset.connection.ready ? "Ready" : "Not ready" }
          : entry,
      );
    }

    if (payload?.browsers && typeof payload.browsers === "object") {
      dataset.system.browserUsage = buildBrowserUsageFromStatus(payload.browsers);
    }
  }

  if (logsResult.status === "fulfilled" && Array.isArray(logsResult.value)) {
    mergeArtifactFilenames(dataset.logs, logsResult.value, ".log");
  }

  if (videosResult.status === "fulfilled" && Array.isArray(videosResult.value)) {
    mergeArtifactFilenames(dataset.videos, videosResult.value, ".mp4");
  }

  return dataset;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url} (${response.status})`);
  }

  return response.json();
}

function mergeArtifactFilenames(currentArtifacts, liveFilenames, extension) {
  const liveNames = new Set(liveFilenames);

  for (const artifact of currentArtifacts) {
    if (liveNames.has(artifact.filename)) {
      artifact.live = true;
    }
  }

  for (const filename of liveFilenames) {
    if (!currentArtifacts.find((artifact) => artifact.filename === filename)) {
      currentArtifacts.push({
        browser: "unknown",
        createdAt: new Date().toISOString(),
        filename,
        live: true,
        protocol: "unknown",
        sessionId: filename.endsWith(extension) ? filename.slice(0, -extension.length) : "unknown",
        size: 0,
      });
    }
  }
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

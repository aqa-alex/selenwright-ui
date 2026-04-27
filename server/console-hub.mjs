import {
  consoleHeartbeatIntervalMs,
  consoleWatchIntervalMs,
  maxSseClientAgeMs,
  maxSseClients,
} from "./config.mjs";
import { withSecurityHeaders } from "./security.mjs";
import { formatSseEvent } from "./http-utils.mjs";
import { fetchConsoleSnapshot, stableSerialize } from "./snapshot.mjs";

const consoleStreamClients = new Set();
let consoleSnapshotCache = null;
let consoleSnapshotInFlight = null;
let consoleSnapshotSignature = "";
let consoleWatchTimer = null;

function startConsoleWatcher() {
  if (consoleWatchTimer || !consoleStreamClients.size) {
    return;
  }

  void refreshConsoleSnapshot();
  consoleWatchTimer = setInterval(() => {
    void refreshConsoleSnapshot();
  }, consoleWatchIntervalMs);
}

function stopConsoleWatcher() {
  if (consoleStreamClients.size || !consoleWatchTimer) {
    return;
  }

  clearInterval(consoleWatchTimer);
  consoleWatchTimer = null;
}

// pickAuthHeaders returns cookie+authorization captured from any currently
// connected SSE client. The upstream Go service requires auth on most snapshot
// endpoints; this lets the shared background watcher borrow valid credentials
// from a real client request rather than fetching unauthenticated and 401-ing.
// If no clients are connected, returns null and the upstream call is skipped.
function pickAuthHeaders() {
  for (const client of consoleStreamClients) {
    if (client.cookie || client.authorization) {
      return { cookie: client.cookie, authorization: client.authorization };
    }
  }
  return null;
}

async function refreshConsoleSnapshot() {
  if (consoleSnapshotInFlight) {
    return consoleSnapshotInFlight;
  }

  const authHeaders = pickAuthHeaders();

  consoleSnapshotInFlight = (async () => {
    const nextSnapshot = await fetchConsoleSnapshot(authHeaders);
    const nextSignature = stableSerialize(nextSnapshot);

    if (nextSignature === consoleSnapshotSignature) {
      return consoleSnapshotCache;
    }

    consoleSnapshotSignature = nextSignature;
    consoleSnapshotCache = {
      ...nextSnapshot,
      fetchedAt: new Date().toISOString(),
    };
    broadcastConsoleSnapshot(consoleSnapshotCache);
    return consoleSnapshotCache;
  })();

  try {
    return await consoleSnapshotInFlight;
  } finally {
    consoleSnapshotInFlight = null;
  }
}

function broadcastConsoleSnapshot(snapshot) {
  const message = formatSseEvent("snapshot", snapshot);
  for (const client of consoleStreamClients) {
    try {
      const writeResult = client.response.write(message);
      if (!writeResult) {
        closeConsoleClient(client);
      }
    } catch {
      closeConsoleClient(client);
    }
  }
}

export function handleConsoleStream(req, res) {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    res.writeHead(405, withSecurityHeaders({ Allow: "GET", "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Method Not Allowed");
    return;
  }

  if (consoleStreamClients.size >= maxSseClients) {
    res.writeHead(503, withSecurityHeaders({
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": "5",
    }));
    res.end("Console SSE is at capacity. Try again shortly.");
    return;
  }

  res.writeHead(200, withSecurityHeaders({
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  }));
  res.flushHeaders?.();
  res.write(`retry: ${Math.max(1000, consoleWatchIntervalMs)}\n\n`);

  const client = {
    authorization: req.headers["authorization"] || null,
    connectedAt: Date.now(),
    cookie: req.headers["cookie"] || null,
    heartbeatTimer: 0,
    response: res,
  };
  client.heartbeatTimer = setInterval(() => {
    if (Date.now() - client.connectedAt > maxSseClientAgeMs) {
      try {
        res.write(formatSseEvent("shutdown", { reason: "max_age" }));
      } catch {
      }
      closeConsoleClient(client);
      return;
    }
    try {
      if (!res.write(": keep-alive\n\n")) {
        closeConsoleClient(client);
      }
    } catch {
      closeConsoleClient(client);
    }
  }, consoleHeartbeatIntervalMs);

  consoleStreamClients.add(client);
  startConsoleWatcher();

  if (consoleSnapshotCache) {
    res.write(formatSseEvent("snapshot", consoleSnapshotCache));
  } else {
    void refreshConsoleSnapshot();
  }

  req.on("close", () => {
    closeConsoleClient(client);
  });

  req.on("error", () => {
    closeConsoleClient(client);
  });
}

function closeConsoleClient(client) {
  if (!consoleStreamClients.has(client)) {
    return;
  }

  consoleStreamClients.delete(client);
  clearInterval(client.heartbeatTimer);
  stopConsoleWatcher();
  try {
    client.response.end();
  } catch {
  }
}

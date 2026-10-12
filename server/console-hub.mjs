import {
  consoleHeartbeatIntervalMs,
  consoleWatchIntervalMs,
  maxSseClientAgeMs,
  maxSseClients,
} from "./config.mjs";
import { withSecurityHeaders } from "./security.mjs";
import { formatSseEvent } from "./http-utils.mjs";
import { fetchConsoleSnapshot, stableSerialize } from "./snapshot.mjs";

// Clients are grouped by the credentials they connected with. Each group gets
// its own upstream fetch and snapshot cache, so a client only ever receives
// data the upstream returned for its own cookie/authorization, and a group's
// cache is dropped together with its last client.
const consoleStreamGroups = new Map();
let consoleStreamClientCount = 0;
let consoleWatchTimer = null;

function credentialKey(authorization, cookie) {
  return JSON.stringify([authorization || "", cookie || ""]);
}

function startConsoleWatcher() {
  if (consoleWatchTimer || !consoleStreamClientCount) {
    return;
  }

  consoleWatchTimer = setInterval(() => {
    for (const group of consoleStreamGroups.values()) {
      void refreshConsoleSnapshot(group);
    }
  }, consoleWatchIntervalMs);
}

function stopConsoleWatcher() {
  if (consoleStreamClientCount || !consoleWatchTimer) {
    return;
  }

  clearInterval(consoleWatchTimer);
  consoleWatchTimer = null;
}

async function refreshConsoleSnapshot(group) {
  if (group.inFlight) {
    return group.inFlight;
  }

  group.inFlight = (async () => {
    const nextSnapshot = await fetchConsoleSnapshot(group.auth);
    const nextSignature = stableSerialize(nextSnapshot);

    if (nextSignature === group.signature) {
      return group.cache;
    }

    group.signature = nextSignature;
    group.cache = {
      ...nextSnapshot,
      fetchedAt: new Date().toISOString(),
    };
    broadcastConsoleSnapshot(group);
    return group.cache;
  })();

  try {
    return await group.inFlight;
  } finally {
    group.inFlight = null;
  }
}

function broadcastConsoleSnapshot(group) {
  const message = formatSseEvent("snapshot", group.cache);
  for (const client of group.clients) {
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

  if (consoleStreamClientCount >= maxSseClients) {
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

  const authorization = req.headers["authorization"] || null;
  const cookie = req.headers["cookie"] || null;
  const groupKey = credentialKey(authorization, cookie);
  let group = consoleStreamGroups.get(groupKey);
  if (!group) {
    group = {
      auth: { authorization, cookie },
      cache: null,
      clients: new Set(),
      inFlight: null,
      key: groupKey,
      signature: "",
    };
    consoleStreamGroups.set(groupKey, group);
  }

  const client = {
    connectedAt: Date.now(),
    group,
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

  group.clients.add(client);
  consoleStreamClientCount += 1;
  startConsoleWatcher();

  if (group.cache) {
    res.write(formatSseEvent("snapshot", group.cache));
  } else {
    void refreshConsoleSnapshot(group);
  }

  req.on("close", () => {
    closeConsoleClient(client);
  });

  req.on("error", () => {
    closeConsoleClient(client);
  });
}

function closeConsoleClient(client) {
  const { group } = client;
  if (!group.clients.has(client)) {
    return;
  }

  group.clients.delete(client);
  consoleStreamClientCount -= 1;
  if (!group.clients.size && consoleStreamGroups.get(group.key) === group) {
    consoleStreamGroups.delete(group.key);
  }
  clearInterval(client.heartbeatTimer);
  stopConsoleWatcher();
  try {
    client.response.end();
  } catch {
  }
}

import { DEFAULT_MAX_WS_FRAME_BYTES } from "../server-ws-frame.mjs";
import { parseAllowedOrigins } from "../server-origin.mjs";

export const DEFAULT_UPSTREAM_TARGET = "http://127.0.0.1:4444";
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4173;

export const consoleStreamPath = "/api/stream/console";
export const consoleHeartbeatIntervalMs = 15000;

export function readTimeoutMs(rawValue, fallbackMs) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

export const target = process.env.SELENWRIGHT_TARGET || DEFAULT_UPSTREAM_TARGET;
export const port = Number(process.env.PORT || DEFAULT_PORT);
export const host = process.env.HOST || DEFAULT_HOST;
export const apiOnlyMode = process.env.SELENWRIGHT_API_ONLY === "true";
export const demoMode = process.env.DEMO_MODE === "true";

export const consoleWatchIntervalMs = Number(
  process.env.SELENWRIGHT_WATCH_INTERVAL_MS || 3000,
);
export const upstreamRequestTimeoutMs = readTimeoutMs(
  process.env.SELENWRIGHT_UPSTREAM_TIMEOUT_MS,
  5000,
);
export const upstreamArtifactTimeoutMs = readTimeoutMs(
  process.env.SELENWRIGHT_ARTIFACT_TIMEOUT_MS,
  15000,
);
export const terminateAttemptTimeoutMs = readTimeoutMs(
  process.env.SELENWRIGHT_TERMINATE_TIMEOUT_MS,
  3000,
);

export const maxRequestBodyBytes = Number(
  process.env.SELENWRIGHT_MAX_BODY_BYTES || 1024 * 1024,
);
export const maxSseClients = Number(process.env.SELENWRIGHT_MAX_SSE_CLIENTS || 64);
export const maxSseClientAgeMs = Number(
  process.env.SELENWRIGHT_MAX_SSE_CLIENT_AGE_MS || 4 * 60 * 60 * 1000,
);
export const maxWsFrameBytes = Number(
  process.env.SELENWRIGHT_WS_MAX_FRAME_BYTES || DEFAULT_MAX_WS_FRAME_BYTES,
);
export const maxWsFragmentedBytes = Number(
  process.env.SELENWRIGHT_WS_MAX_FRAGMENTED_BYTES || 4 << 20,
);

export const allowedOrigins = parseAllowedOrigins(process.env.SELENWRIGHT_ALLOWED_ORIGINS);

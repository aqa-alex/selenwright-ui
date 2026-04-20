import { isRecord } from "./guards";
import type { JsonRecord } from "./types";

export const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
export const TERMINATE_REQUEST_TIMEOUT_MS = 8000;
export const ARTIFACT_REQUEST_TIMEOUT_MS = 15_000;

type UnauthorizedHandler = () => void;

// Paths whose 401 must NOT trigger the global unauthorized handler:
// /api/whoami is the identity probe itself (returns 200 with anonymous body
// rather than 401, but belt-and-braces), and /api/login / /api/logout are the
// auth-bootstrap endpoints — firing a logout redirect from them creates a loop.
const UNAUTHORIZED_SKIP_PATHS = new Set([
  "/api/whoami",
  "/api/login",
  "/api/logout",
]);

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

// Explicit escape hatch for callers that detect an auth failure outside the
// normal fetch pipeline — e.g. an EventSource whose 401 never reaches
// fetchWithTimeout. The caller is responsible for verifying the auth failure
// (e.g. by probing /api/whoami) before invoking this so the UI does not
// redirect on transient network blips.
export function triggerUnauthorized(): void {
  if (!unauthorizedHandler) {
    return;
  }
  try {
    unauthorizedHandler();
  } catch {
    // never let a buggy handler break the caller
  }
}

function extractRequestPath(resource: RequestInfo | URL): string {
  try {
    if (typeof resource === "string") {
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "http://localhost";
      return new URL(resource, base).pathname;
    }
    if (resource instanceof URL) {
      return resource.pathname;
    }
    if (typeof Request !== "undefined" && resource instanceof Request) {
      return new URL(resource.url).pathname;
    }
  } catch {
    return "";
  }
  return "";
}

function notifyUnauthorized(resource: RequestInfo | URL): void {
  if (!unauthorizedHandler) {
    return;
  }
  const path = extractRequestPath(resource);
  if (!path || UNAUTHORIZED_SKIP_PATHS.has(path)) {
    return;
  }
  try {
    unauthorizedHandler();
  } catch {
    // never let a buggy handler break the calling request
  }
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(
    url,
    {
      headers: { accept: "application/json" },
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    `Request ${url}`,
  );

  if (!response.ok) {
    throw new Error(`Request failed for ${url} (${response.status})`);
  }

  return readResponseJsonWithTimeout<T>(
    response,
    DEFAULT_REQUEST_TIMEOUT_MS,
    `Request ${url}`,
  );
}

export async function readJsonResponse(
  response: Response,
  contextLabel: string,
): Promise<JsonRecord> {
  const text = await readResponseTextWithTimeout(
    response,
    DEFAULT_REQUEST_TIMEOUT_MS,
    contextLabel,
  );
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error(`${contextLabel} returned empty response.`);
  }

  try {
    const payload = JSON.parse(trimmed) as unknown;
    if (isRecord(payload)) {
      return payload;
    }

    throw new Error(`${contextLabel} returned invalid JSON payload.`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.endsWith("returned invalid JSON payload.")
    ) {
      throw error;
    }

    throw new Error(buildNonJsonResponseMessage(contextLabel, trimmed));
  }
}

export async function fetchWithTimeout(
  resource: RequestInfo | URL,
  options: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  contextLabel = "Request",
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(resource, {
      credentials: "include",
      ...options,
      signal: controller.signal,
    });
    if (response.status === 401) {
      notifyUnauthorized(resource);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${contextLabel} timed out after ${formatTimeoutMs(timeoutMs)}.`);
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function formatTimeoutMs(timeoutMs: number): string {
  return timeoutMs % 1000 === 0 ? `${timeoutMs / 1000}s` : `${timeoutMs}ms`;
}

export async function readResponseTextWithTimeout(
  response: Response,
  timeoutMs: number,
  contextLabel: string,
): Promise<string> {
  return withTimeout(response.text(), timeoutMs, `${contextLabel} response`);
}

export async function readResponseJsonWithTimeout<T>(
  response: Response,
  timeoutMs: number,
  contextLabel: string,
): Promise<T> {
  return withTimeout(response.json() as Promise<T>, timeoutMs, `${contextLabel} response`);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  contextLabel: string,
): Promise<T> {
  let timer = 0;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => {
          reject(new Error(`${contextLabel} timed out after ${formatTimeoutMs(timeoutMs)}.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

export function buildHttpErrorMessage(
  label: string,
  status: number,
): string {
  if (status === 403) {
    return "Permission denied — admin access required.";
  }
  return `${label} failed (${status})`;
}

export function extractResponseErrorMessage(
  payload: JsonRecord,
  fallbackMessage: string,
): string {
  if (typeof payload.reason === "string" && payload.reason.trim()) {
    return payload.reason.trim();
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  return fallbackMessage;
}

export function buildNonJsonResponseMessage(
  contextLabel: string,
  responseText: string,
): string {
  const excerpt = summarizeResponseExcerpt(responseText);
  return excerpt
    ? `${contextLabel} returned non-JSON response: ${excerpt}`
    : `${contextLabel} returned non-JSON response.`;
}

export function summarizeResponseExcerpt(responseText: string): string {
  const collapsed = String(responseText || "").replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "";
  }

  const excerpt =
    collapsed.length > 120 ? `${collapsed.slice(0, 117)}...` : collapsed;
  return `"${excerpt}"`;
}

import { isRecord } from "./guards";
import type { JsonRecord } from "./types";

export const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
export const TERMINATE_REQUEST_TIMEOUT_MS = 8000;
export const ARTIFACT_REQUEST_TIMEOUT_MS = 15_000;

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
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
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

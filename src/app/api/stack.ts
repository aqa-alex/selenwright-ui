import {
  buildHttpErrorMessage,
  DEFAULT_REQUEST_TIMEOUT_MS,
  extractResponseErrorMessage,
  fetchJson,
  fetchWithTimeout,
  readJsonResponse,
} from "./http";
import type { StackPullResult, StackRecreateResult, StackStatus } from "./types";

const PULL_TIMEOUT_MS = 150_000;

export async function fetchStackStatus(): Promise<StackStatus> {
  return fetchJson<StackStatus>("/api/stack/status");
}

export async function pullStackImages(): Promise<StackPullResult> {
  const response = await fetchWithTimeout(
    "/api/stack/pull",
    {
      method: "POST",
      headers: { accept: "application/json" },
    },
    PULL_TIMEOUT_MS,
    "Stack image pull",
  );

  if (response.status === 403) {
    throw new Error(buildHttpErrorMessage("Pull", 403));
  }

  const payload = await readJsonResponse(response, "Stack image pull");

  if (!response.ok) {
    throw new Error(
      extractResponseErrorMessage(payload, `Pull failed (${response.status})`),
    );
  }

  return payload as unknown as StackPullResult;
}

export async function recreateStack(): Promise<StackRecreateResult> {
  const response = await fetchWithTimeout(
    "/api/stack/recreate",
    {
      method: "POST",
      headers: { accept: "application/json" },
    },
    PULL_TIMEOUT_MS,
    "Stack recreate",
  );

  if (response.status === 403) {
    throw new Error(buildHttpErrorMessage("Recreate", 403));
  }

  const payload = await readJsonResponse(response, "Stack recreate");

  if (!response.ok) {
    throw new Error(
      extractResponseErrorMessage(payload, `Recreate failed (${response.status})`),
    );
  }

  return payload as unknown as StackRecreateResult;
}

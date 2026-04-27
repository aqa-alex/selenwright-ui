import {
  buildHttpErrorMessage,
  extractResponseErrorMessage,
  fetchJson,
  fetchWithTimeout,
  readJsonResponse,
} from "./http";
import type {
  StackCheckUpdatesResult,
  StackPullResult,
  StackRecreateResult,
  StackStatus,
  StackUpdateRequest,
  StackUpdateResult,
} from "./types";

const PULL_TIMEOUT_MS = 150_000;
const CHECK_TIMEOUT_MS = 15_000;

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

export async function checkStackUpdates(): Promise<StackCheckUpdatesResult> {
  const response = await fetchWithTimeout(
    "/api/stack/check-updates",
    {
      method: "POST",
      headers: { accept: "application/json" },
    },
    CHECK_TIMEOUT_MS,
    "Stack version check",
  );

  if (response.status === 403) {
    throw new Error(buildHttpErrorMessage("Check updates", 403));
  }

  const payload = await readJsonResponse(response, "Stack version check");

  if (!response.ok) {
    throw new Error(
      extractResponseErrorMessage(payload, `Version check failed (${response.status})`),
    );
  }

  return payload as unknown as StackCheckUpdatesResult;
}

export async function updateStack(
  request: StackUpdateRequest,
): Promise<StackUpdateResult> {
  const response = await fetchWithTimeout(
    "/api/stack/update",
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(request),
    },
    PULL_TIMEOUT_MS,
    "Stack update",
  );

  if (response.status === 403) {
    throw new Error(buildHttpErrorMessage("Update", 403));
  }

  const payload = await readJsonResponse(response, "Stack update");

  if (!response.ok) {
    throw new Error(
      extractResponseErrorMessage(payload, `Update failed (${response.status})`),
    );
  }

  return payload as unknown as StackUpdateResult;
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

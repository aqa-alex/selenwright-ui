import {
  buildHttpErrorMessage,
  extractResponseErrorMessage,
  fetchWithTimeout,
  readJsonResponse,
} from "./http";

const LIST_TIMEOUT_MS = 30_000;
// Pulling N images can be slow on cold cache; align with the stack-pull
// timeout used elsewhere and round up because there's a per-ref timeout
// server-side that bounds individual pulls anyway.
const PULL_TIMEOUT_MS = 300_000;

export interface RegistryRepoListing {
  repo: string;
  tags: string[];
}

export interface RegistryListingError {
  repo: string;
  error: string;
}

export type RegistrySource = "oci" | "hub";

export interface RegistryListing {
  host: string;
  baseUrl: string;
  source: RegistrySource;
  namespace?: string;
  repos: RegistryRepoListing[];
  errors?: RegistryListingError[];
}

export interface RegistryPullRef {
  repo: string;
  tag: string;
}

export interface RegistryPullRequest {
  host: string;
  source?: RegistrySource;
  namespace?: string;
  refs: RegistryPullRef[];
}

export interface RegistryPullItem {
  ref: string;
  ok: boolean;
  error?: string;
}

export interface RegistryPullResult {
  results: RegistryPullItem[];
}

export async function listRegistry(host: string): Promise<RegistryListing> {
  const trimmed = host.trim();
  if (!trimmed) {
    throw new Error("Registry host is required.");
  }

  const url = `/api/registry/list?host=${encodeURIComponent(trimmed)}`;
  const response = await fetchWithTimeout(
    url,
    { method: "GET", headers: { accept: "application/json" } },
    LIST_TIMEOUT_MS,
    "Registry list",
  );

  if (response.status === 403) {
    throw new Error(buildHttpErrorMessage("Registry list", 403));
  }

  const payload = await readJsonResponse(response, "Registry list");

  if (!response.ok) {
    throw new Error(
      extractResponseErrorMessage(payload, `Registry list failed (${response.status})`),
    );
  }

  return payload as unknown as RegistryListing;
}

export async function pullFromRegistry(
  request: RegistryPullRequest,
): Promise<RegistryPullResult> {
  const response = await fetchWithTimeout(
    "/api/registry/pull",
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(request),
    },
    PULL_TIMEOUT_MS,
    "Registry pull",
  );

  if (response.status === 403) {
    throw new Error(buildHttpErrorMessage("Registry pull", 403));
  }

  const payload = await readJsonResponse(response, "Registry pull");

  if (!response.ok) {
    throw new Error(
      extractResponseErrorMessage(payload, `Registry pull failed (${response.status})`),
    );
  }

  return payload as unknown as RegistryPullResult;
}

import { buildHttpErrorMessage, fetchJson, fetchWithTimeout, DEFAULT_REQUEST_TIMEOUT_MS } from "./http";
import type { DiscoveredBrowserImage } from "./types";

export async function fetchDiscoveredBrowsers(): Promise<DiscoveredBrowserImage[]> {
  return fetchJson<DiscoveredBrowserImage[]>("/api/browsers/discovered");
}

export async function adoptBrowser(digest: string): Promise<void> {
  const response = await fetchWithTimeout(
    "/api/browsers/adopt",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digest }),
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Adopt browser",
  );
  if (!response.ok) {
    throw new Error(buildHttpErrorMessage("Adopt", response.status));
  }
}

export async function dismissBrowser(digest: string): Promise<void> {
  const response = await fetchWithTimeout(
    "/api/browsers/dismiss",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digest }),
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Dismiss browser",
  );
  if (!response.ok) {
    throw new Error(buildHttpErrorMessage("Dismiss", response.status));
  }
}

export async function rescanBrowsers(): Promise<DiscoveredBrowserImage[]> {
  const response = await fetchWithTimeout(
    "/api/browsers/rescan",
    {
      method: "POST",
      headers: { accept: "application/json" },
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Rescan browsers",
  );
  if (!response.ok) {
    throw new Error(buildHttpErrorMessage("Rescan", response.status));
  }
  return response.json() as Promise<DiscoveredBrowserImage[]>;
}

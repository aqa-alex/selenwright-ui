import { isRecord } from "./guards";
import {
  buildHttpErrorMessage,
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchJson,
  fetchWithTimeout,
  readJsonResponse,
  readResponseJsonWithTimeout,
} from "./http";

export interface ApiTokenRow {
  id: string;
  owner: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface CreateTokenRequest {
  owner: string;
  name: string;
}

export interface CreateTokenResult {
  id: string;
  token: string;
}

const TOKENS_PATH = "/api/admin/tokens";
const USERS_PATH = "/api/admin/users";

export async function fetchTokens(owner?: string): Promise<ApiTokenRow[]> {
  const query = owner ? `?owner=${encodeURIComponent(owner)}` : "";
  return fetchJson<ApiTokenRow[]>(`${TOKENS_PATH}${query}`);
}

export async function fetchTokenUsers(): Promise<string[]> {
  return fetchJson<string[]>(USERS_PATH);
}

export async function createToken(req: CreateTokenRequest): Promise<CreateTokenResult> {
  const response = await fetchWithTimeout(
    TOKENS_PATH,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Create token",
  );
  if (!response.ok) {
    const msg = await readErrorMessage(response, "Create token");
    throw new Error(msg);
  }
  const payload = await readResponseJsonWithTimeout<unknown>(
    response,
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Create token response",
  );
  if (!isRecord(payload) || typeof payload.id !== "string" || typeof payload.token !== "string") {
    throw new Error("Create token returned unexpected payload.");
  }
  return { id: payload.id, token: payload.token };
}

export async function revokeToken(id: string): Promise<void> {
  const response = await fetchWithTimeout(
    `${TOKENS_PATH}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Revoke token",
  );
  if (!response.ok) {
    throw new Error(buildHttpErrorMessage("Revoke token", response.status));
  }
}

export async function revokeTokensByOwner(owner: string): Promise<number> {
  const response = await fetchWithTimeout(
    `${TOKENS_PATH}?owner=${encodeURIComponent(owner)}`,
    { method: "DELETE" },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Revoke tokens",
  );
  if (!response.ok) {
    throw new Error(buildHttpErrorMessage("Revoke tokens", response.status));
  }
  const payload = await readResponseJsonWithTimeout<unknown>(
    response,
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Revoke tokens response",
  );
  if (isRecord(payload) && typeof payload.revoked === "number") {
    return payload.revoked;
  }
  return 0;
}

async function readErrorMessage(response: Response, context: string): Promise<string> {
  try {
    const payload = await readJsonResponse(response.clone(), context);
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // fall through to the generic message
  }
  return buildHttpErrorMessage(context, response.status);
}

import { isRecord } from "./guards";
import {
  buildHttpErrorMessage,
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchJson,
  fetchWithTimeout,
  readResponseJsonWithTimeout,
  triggerUnauthorized,
} from "./http";

export type AuthMode = "embedded" | "trusted-proxy" | "none";

export interface UserIdentity {
  user: string;
  isAdmin: boolean;
  authMode: AuthMode;
  authenticated: boolean;
  groups: string[];
}

const anonymousIdentity: UserIdentity = {
  user: "unknown",
  isAdmin: false,
  authMode: "none",
  authenticated: false,
  groups: [],
};

const validAuthModes = new Set<string>(["embedded", "trusted-proxy", "none"]);

export async function fetchIdentity(): Promise<UserIdentity> {
  try {
    const payload = await fetchJson<unknown>("/api/whoami");
    return normalizeIdentity(payload);
  } catch {
    return anonymousIdentity;
  }
}

// EventSource does not expose the upstream HTTP status on error — a 401 from
// an SSE stream looks identical to a transient network drop. Stream consumers
// call this after an error to re-check identity via /api/whoami; if the call
// reports anonymous under embedded auth, fan the global unauthorized handler
// so the UI redirects to /login instead of looping reconnects on a dead cookie.
export async function detectStreamAuthLoss(): Promise<void> {
  try {
    const identity = await fetchIdentity();
    if (identity.authMode === "embedded" && !identity.authenticated) {
      triggerUnauthorized();
    }
  } catch {
    // fetchIdentity is already resilient (falls back to anonymousIdentity);
    // swallow any unexpected throw so the SSE reconnect loop stays simple.
  }
}

export async function login(
  username: string,
  password: string,
): Promise<UserIdentity> {
  const response = await fetchWithTimeout(
    "/api/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Login",
  );

  if (response.status === 401) {
    throw new Error("Invalid username or password.");
  }

  if (!response.ok) {
    throw new Error(buildHttpErrorMessage("Login", response.status));
  }

  const payload = await readResponseJsonWithTimeout<unknown>(
    response,
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Login response",
  );

  if (!isRecord(payload)) {
    throw new Error("Unexpected login response.");
  }

  return {
    user: typeof payload.user === "string" ? payload.user : "unknown",
    isAdmin: Boolean(payload.isAdmin),
    authMode: "embedded",
    authenticated: true,
    groups: extractGroups(payload.groups),
  };
}

function extractGroups(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (g): g is string => typeof g === "string" && g.length > 0,
  );
}

export async function logout(): Promise<void> {
  await fetchWithTimeout(
    "/api/logout",
    { method: "POST" },
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Logout",
  );
}

export function normalizeIdentity(value: unknown): UserIdentity {
  if (!isRecord(value)) {
    return anonymousIdentity;
  }

  const authMode =
    typeof value.authMode === "string" && validAuthModes.has(value.authMode)
      ? (value.authMode as AuthMode)
      : "none";

  return {
    user: typeof value.user === "string" ? value.user : "unknown",
    isAdmin: Boolean(value.isAdmin),
    authMode,
    authenticated: Boolean(value.authenticated),
    groups: extractGroups(value.groups),
  };
}

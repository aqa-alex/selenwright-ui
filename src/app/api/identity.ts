import { isRecord } from "./guards";
import {
  buildHttpErrorMessage,
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchJson,
  fetchWithTimeout,
  readResponseJsonWithTimeout,
} from "./http";

export type AuthMode = "embedded" | "trusted-proxy" | "none";

export interface UserIdentity {
  user: string;
  isAdmin: boolean;
  authMode: AuthMode;
  authenticated: boolean;
}

const anonymousIdentity: UserIdentity = {
  user: "unknown",
  isAdmin: false,
  authMode: "none",
  authenticated: false,
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
  };
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
  };
}

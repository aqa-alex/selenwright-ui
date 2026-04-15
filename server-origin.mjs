// Pure helpers for the WebSocket Origin allowlist, extracted from server.mjs
// so they can be unit-tested without starting the HTTP server.

export function parseAllowedOrigins(value) {
  if (!value) {
    return null;
  }
  const entries = String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length ? entries : null;
}

/**
 * Decide whether an incoming WebSocket upgrade is allowed to proceed.
 *
 * - No `origin` header: accept. Browsers always send one on upgrade requests,
 *   so a missing Origin is a non-browser client (curl, a WS library) and
 *   cannot be forged against us via CSRF.
 * - `allowlist` provided: Origin must be an exact match.
 * - No allowlist: same-origin only — Origin's host must match the Host header
 *   the request came in on.
 */
export function isOriginAllowed(origin, hostHeader, allowlist) {
  if (!origin) {
    return true;
  }
  if (allowlist && allowlist.length) {
    return allowlist.includes(origin);
  }
  try {
    return new URL(origin).host === hostHeader;
  } catch {
    return false;
  }
}

// Helpers for propagating the browser's session credentials into the raw
// WebSocket handshake lines we generate when proxying upstream. Values coming
// from `req.headers` are user-controlled, so we strip CR/LF defensively to
// prevent header injection on the upstream socket.

const DEFAULT_FORWARDED_CLIENT_HEADERS = ["cookie", "authorization"];

export function sanitizeHeaderValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  if (/[\r\n\0]/.test(value)) {
    return "";
  }
  return value.trim();
}

export function formatForwardedHeaderLines(
  clientHeaders,
  headerNames = DEFAULT_FORWARDED_CLIENT_HEADERS,
) {
  if (!clientHeaders) {
    return [];
  }

  const lines = [];
  for (const name of headerNames) {
    const raw = clientHeaders[name];
    const safe = sanitizeHeaderValue(Array.isArray(raw) ? raw.join("; ") : raw);
    if (!safe) {
      continue;
    }
    lines.push(`${name}: ${safe}`);
  }
  return lines;
}

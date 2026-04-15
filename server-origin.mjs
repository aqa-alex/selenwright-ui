
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

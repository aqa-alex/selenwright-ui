export function buildLogFileApiPath(filename: string): string {
  return `/api/logs/file/${encodeURIComponent(filename)}`;
}

export function buildLiveLogApiPath(sessionId: string): string {
  return `/api/logs/live/${encodeURIComponent(sessionId)}`;
}

export function buildDownloadFileApiPath(sessionId: string, relativePath: string): string {
  const encodedSessionId = encodeURIComponent(sessionId);
  const encodedRelativePath = String(relativePath || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/downloads/file/${encodedSessionId}/${encodedRelativePath}`;
}

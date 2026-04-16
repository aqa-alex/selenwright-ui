export interface VncViewerParams {
  browserName: string;
  sessionId: string;
  sessionName: string;
}

export type VncStatusState = "connected" | "connecting" | "disconnected" | "error";

export interface VncStatus {
  message: string;
  state: VncStatusState;
}

export function readVncViewerParams(search: string): VncViewerParams {
  const params = new URLSearchParams(search);

  return {
    browserName: params.get("browser") || "",
    sessionId: params.get("session") || "",
    sessionName: params.get("name") || "",
  };
}

export function buildVncWebSocketUrl(sessionId: string, origin: string): string {
  if (!sessionId) {
    return "";
  }

  const url = new URL(`/api/vnc/${encodeURIComponent(sessionId)}`, origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function buildClipboardUrl(sessionId: string): string {
  return sessionId ? `/api/clipboard/${encodeURIComponent(sessionId)}` : "";
}

export function buildSessionDetailHref(sessionId: string): string {
  return sessionId ? `/sessions/${sessionId}` : "/sessions";
}

export function formatDocumentTitle(sessionId: string): string {
  return sessionId ? `VNC ${sessionId} · Selenwright UI` : "VNC Viewer · Selenwright UI";
}

export function formatPageTitle(params: VncViewerParams): string {
  if (params.sessionName && params.browserName) {
    return `${params.sessionName} · ${capitalize(params.browserName)} VNC`;
  }

  if (params.sessionName) {
    return `${params.sessionName} · VNC`;
  }

  return params.sessionId ? `Session ${params.sessionId}` : "Session VNC";
}

export function formatSessionLabel(params: Pick<VncViewerParams, "sessionId" | "sessionName">): string {
  if (params.sessionName && params.sessionId) {
    return `${params.sessionName} · ${params.sessionId}`;
  }

  return params.sessionId || "Unknown session";
}

export function getViewerModeLabel(viewOnly: boolean): string {
  return viewOnly ? "Read only" : "Control enabled";
}

export function getInitialVncStatus(sessionId: string): VncStatus {
  return sessionId
    ? { message: "Connecting", state: "connecting" }
    : { message: "Session id is missing", state: "error" };
}

function capitalize(value: string): string {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

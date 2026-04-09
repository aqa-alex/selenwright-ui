import RFB from "../vendor/novnc-client/core/rfb.js";

const sessionId = new URLSearchParams(window.location.search).get("session") || "";
const sessionName = new URLSearchParams(window.location.search).get("name") || "";
const browserName = new URLSearchParams(window.location.search).get("browser") || "";

const elements = {
  endpoint: document.getElementById("vnc-endpoint"),
  openSession: document.getElementById("vnc-open-session"),
  screen: document.getElementById("vnc-screen"),
  sessionLabel: document.getElementById("vnc-session-label"),
  status: document.getElementById("vnc-status"),
  title: document.getElementById("vnc-page-title"),
  viewerMode: document.getElementById("vnc-viewer-mode"),
  viewerModeLabel: document.getElementById("vnc-viewer-mode-label"),
};

let rfb = null;
let desktopName = "";
let pendingReconnect = 0;
let viewOnly = true;

initialize();

function initialize() {
  const wsUrl = buildWebSocketUrl(sessionId);

  document.title = sessionId ? `VNC ${sessionId} · Selenwright UI` : "VNC Viewer · Selenwright UI";
  elements.endpoint.textContent = wsUrl || "Session id is missing";
  elements.openSession.href = sessionId ? `/sessions/${sessionId}` : "/sessions";
  elements.sessionLabel.textContent = formatSessionLabel();
  elements.title.textContent = formatPageTitle();
  elements.viewerMode?.addEventListener("click", toggleViewerMode);
  renderViewerMode();

  window.addEventListener("beforeunload", () => {
    window.clearTimeout(pendingReconnect);
    disconnectViewer();
  });

  if (!sessionId) {
    setStatus("Session id is missing", "error");
    return;
  }

  connectViewer(wsUrl);
}

function connectViewer(wsUrl) {
  window.clearTimeout(pendingReconnect);
  disconnectViewer();
  elements.screen.replaceChildren();
  setStatus("Connecting to VNC stream", "connecting");

  try {
    rfb = new RFB(elements.screen, wsUrl, { shared: true });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Failed to initialize VNC viewer", "error");
    return;
  }

  rfb.scaleViewport = true;
  rfb.resizeSession = false;
  rfb.viewOnly = viewOnly;

  rfb.addEventListener("connect", handleConnect);
  rfb.addEventListener("desktopname", handleDesktopName);
  rfb.addEventListener("disconnect", handleDisconnect);
  rfb.addEventListener("credentialsrequired", handleCredentialsRequired);
}

function disconnectViewer() {
  if (!rfb) {
    return;
  }

  const activeRfb = rfb;
  rfb = null;

  try {
    activeRfb.disconnect();
  } catch {
    setStatus("Viewer disconnected", "disconnected");
  }
}

function handleConnect() {
  setStatus(desktopName ? `Connected to ${desktopName}` : "Connected to VNC stream", "connected");
}

function handleDesktopName(event) {
  desktopName = event.detail.name || "";
  if (rfb) {
    setStatus(desktopName ? `Connected to ${desktopName}` : "Connected to VNC stream", "connected");
  }
}

function handleDisconnect(event) {
  if (event.detail.clean) {
    setStatus("Viewer disconnected", "disconnected");
    return;
  }

  setStatus("VNC stream closed unexpectedly. Retrying in 2s.", "error");
  pendingReconnect = window.setTimeout(() => {
    if (sessionId) {
      connectViewer(buildWebSocketUrl(sessionId));
    }
  }, 2000);
}

function handleCredentialsRequired() {
  setStatus("This VNC stream requires credentials, which are not configured in the viewer.", "error");
}

function toggleViewerMode() {
  viewOnly = !viewOnly;
  if (rfb) {
    rfb.viewOnly = viewOnly;
  }
  renderViewerMode();
}

function renderViewerMode() {
  if (!elements.viewerMode || !elements.viewerModeLabel) {
    return;
  }

  elements.viewerMode.dataset.readOnly = String(viewOnly);
  elements.viewerMode.setAttribute("aria-pressed", String(viewOnly));
  elements.viewerModeLabel.textContent = viewOnly ? "Read only" : "Control enabled";
}

function setStatus(message, state) {
  elements.status.dataset.state = state;
  elements.status.textContent = message;
}

function buildWebSocketUrl(id) {
  if (!id) {
    return "";
  }

  const url = new URL(`/api/vnc/${encodeURIComponent(id)}`, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function formatPageTitle() {
  if (sessionName && browserName) {
    return `${sessionName} · ${capitalize(browserName)} VNC`;
  }

  if (sessionName) {
    return `${sessionName} · VNC`;
  }

  return sessionId ? `Session ${sessionId}` : "Session VNC";
}

function formatSessionLabel() {
  if (sessionName && sessionId) {
    return `${sessionName} · ${sessionId}`;
  }

  return sessionId || "Unknown session";
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

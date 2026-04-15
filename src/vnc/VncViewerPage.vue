<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import RFB from "../../vendor/novnc-client/core/rfb.js";
import {
  buildSessionDetailHref,
  buildVncWebSocketUrl,
  formatDocumentTitle,
  formatPageTitle,
  formatSessionLabel,
  getInitialVncStatus,
  getViewerModeLabel,
  readVncViewerParams,
  type VncStatus,
} from "./vncViewer";

type VncRfbEvent = Event & {
  detail?: {
    clean?: boolean;
    name?: string;
  };
};

interface VncRfb {
  scaleViewport: boolean;
  resizeSession: boolean;
  viewOnly: boolean;
  addEventListener(type: string, listener: (event: VncRfbEvent) => void): void;
  removeEventListener(type: string, listener: (event: VncRfbEvent) => void): void;
  disconnect(): void;
}

const VNC_INITIAL_RECONNECT_MS = 1000;
const VNC_MAX_RECONNECT_MS = 30_000;
const VNC_MAX_RECONNECT_ATTEMPTS = 6;

const params = readVncViewerParams(window.location.search);
const screenElement = ref<HTMLElement | null>(null);
const desktopName = ref("");
const pendingReconnect = ref(0);
const reconnectAttempt = ref(0);
const status = ref<VncStatus>(getInitialVncStatus(params.sessionId));
const viewOnly = ref(true);
let rfb: VncRfb | null = null;
let attachedListeners: Array<{
  type: string;
  listener: (event: VncRfbEvent) => void;
}> = [];

const endpoint = computed(() =>
  buildVncWebSocketUrl(params.sessionId, window.location.origin),
);
const endpointLabel = computed(() => endpoint.value || "Session id is missing");
const sessionDetailHref = computed(() => buildSessionDetailHref(params.sessionId));
const pageTitle = computed(() => formatPageTitle(params));
const sessionLabel = computed(() => formatSessionLabel(params));
const viewerModeLabel = computed(() => getViewerModeLabel(viewOnly.value));

onMounted(() => {
  document.title = formatDocumentTitle(params.sessionId);
  window.addEventListener("beforeunload", handleBeforeUnload);

  if (!params.sessionId) {
    return;
  }

  connectViewer(endpoint.value);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
  handleBeforeUnload();
});

function connectViewer(wsUrl: string) {
  window.clearTimeout(pendingReconnect.value);
  pendingReconnect.value = 0;
  disconnectViewer();
  screenElement.value?.replaceChildren();
  setStatus(
    reconnectAttempt.value > 0
      ? `Reconnecting to VNC stream (attempt ${reconnectAttempt.value}/${VNC_MAX_RECONNECT_ATTEMPTS}).`
      : "Connecting to VNC stream",
    "connecting",
  );

  if (!screenElement.value) {
    setStatus("Viewer target is unavailable", "error");
    return;
  }

  try {
    rfb = new RFB(screenElement.value, wsUrl, { shared: true }) as VncRfb;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Failed to initialize VNC viewer", "error");
    return;
  }

  rfb.scaleViewport = true;
  rfb.resizeSession = false;
  rfb.viewOnly = viewOnly.value;

  attachListener("connect", handleConnect);
  attachListener("desktopname", handleDesktopName);
  attachListener("disconnect", handleDisconnect);
  attachListener("credentialsrequired", handleCredentialsRequired);
}

function attachListener(type: string, listener: (event: VncRfbEvent) => void) {
  if (!rfb) {
    return;
  }
  rfb.addEventListener(type, listener);
  attachedListeners.push({ type, listener });
}

function detachAllListeners(target: VncRfb) {
  for (const { type, listener } of attachedListeners) {
    try {
      target.removeEventListener(type, listener);
    } catch {
      // RFB may not expose removeEventListener in older builds; ignore.
    }
  }
  attachedListeners = [];
}

function disconnectViewer() {
  if (!rfb) {
    attachedListeners = [];
    return;
  }

  const activeRfb = rfb;
  rfb = null;

  detachAllListeners(activeRfb);

  try {
    activeRfb.disconnect();
  } catch {
    setStatus("Viewer disconnected", "disconnected");
  }
}

function handleConnect() {
  reconnectAttempt.value = 0;
  setStatus(
    desktopName.value ? `Connected to ${desktopName.value}` : "Connected to VNC stream",
    "connected",
  );
}

function handleDesktopName(event: VncRfbEvent) {
  desktopName.value = event.detail?.name || "";
  if (rfb) {
    setStatus(
      desktopName.value ? `Connected to ${desktopName.value}` : "Connected to VNC stream",
      "connected",
    );
  }
}

function handleDisconnect(event: VncRfbEvent) {
  if (event.detail?.clean) {
    reconnectAttempt.value = 0;
    setStatus("Viewer disconnected", "disconnected");
    return;
  }

  if (!params.sessionId) {
    setStatus("VNC stream closed unexpectedly.", "error");
    return;
  }

  if (reconnectAttempt.value >= VNC_MAX_RECONNECT_ATTEMPTS) {
    setStatus(
      "VNC stream unavailable after several reconnect attempts. Reload to retry.",
      "error",
    );
    return;
  }

  reconnectAttempt.value += 1;
  const delayMs = Math.min(
    VNC_MAX_RECONNECT_MS,
    VNC_INITIAL_RECONNECT_MS * 2 ** (reconnectAttempt.value - 1),
  );
  setStatus(
    `VNC stream closed. Reconnecting in ${Math.round(delayMs / 1000)}s (attempt ${reconnectAttempt.value}/${VNC_MAX_RECONNECT_ATTEMPTS}).`,
    "error",
  );
  pendingReconnect.value = window.setTimeout(() => {
    pendingReconnect.value = 0;
    if (params.sessionId) {
      connectViewer(buildVncWebSocketUrl(params.sessionId, window.location.origin));
    }
  }, delayMs);
}

function handleCredentialsRequired() {
  reconnectAttempt.value = VNC_MAX_RECONNECT_ATTEMPTS;
  setStatus("This VNC stream requires credentials, which are not configured in the viewer.", "error");
}

function toggleViewerMode() {
  viewOnly.value = !viewOnly.value;
  if (rfb) {
    rfb.viewOnly = viewOnly.value;
  }
}

function setStatus(message: string, state: VncStatus["state"]) {
  status.value = { message, state };
}

function handleBeforeUnload() {
  window.clearTimeout(pendingReconnect.value);
  pendingReconnect.value = 0;
  reconnectAttempt.value = 0;
  disconnectViewer();
}
</script>

<template>
  <main class="vnc-page">
    <header class="vnc-page__header">
      <div class="vnc-page__title">
        <h1 id="vnc-page-title">{{ pageTitle }}</h1>
        <p>Read-only VNC stream for the selected session.</p>
      </div>
      <a class="button secondary" href="/sessions">Session list</a>
    </header>

    <section class="panel">
      <div class="panel-header">
        <h2>Viewer</h2>
      </div>
      <div class="vnc-toolbar">
        <div class="vnc-toolbar__status">
          <span class="artifact-chip">VNC</span>
          <div class="vnc-status-copy">
            <strong id="vnc-session-label" class="mono">{{ sessionLabel }}</strong>
            <span id="vnc-status" class="vnc-status" :data-state="status.state">
              {{ status.message }}
            </span>
          </div>
        </div>
        <button
          id="vnc-viewer-mode"
          class="viewer-mode-toggle"
          type="button"
          aria-label="Toggle read-only mode"
          :aria-pressed="viewOnly ? 'true' : 'false'"
          :data-read-only="String(viewOnly)"
          @click="toggleViewerMode"
        >
          <svg
            class="icon viewer-mode-toggle__icon viewer-mode-toggle__icon--lock"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="4.25" y="8" width="9.5" height="6.5" rx="1.5"></rect>
            <path d="M6.5 8V6.25a2.5 2.5 0 0 1 5 0V8"></path>
          </svg>
          <svg
            class="icon viewer-mode-toggle__icon viewer-mode-toggle__icon--unlock"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="4.25" y="8" width="9.5" height="6.5" rx="1.5"></rect>
            <path d="M6.5 8V6.25a2.5 2.5 0 0 1 4.2-1.78"></path>
            <path d="M11.8 4.47 13.2 3.1"></path>
          </svg>
          <span id="vnc-viewer-mode-label">{{ viewerModeLabel }}</span>
        </button>
      </div>
      <div class="vnc-screen-shell">
        <div id="vnc-screen" ref="screenElement" class="vnc-screen"></div>
      </div>
      <div class="vnc-footer">
        <span class="vnc-endpoint mono">Endpoint <code id="vnc-endpoint">{{ endpointLabel }}</code></span>
        <a id="vnc-open-session" class="button secondary" :href="sessionDetailHref">
          Open session detail
        </a>
      </div>
    </section>
  </main>
</template>

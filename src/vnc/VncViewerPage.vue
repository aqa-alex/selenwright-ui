<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import RFB from "../../vendor/novnc-client/core/rfb.js";
import {
  buildClipboardUrl,
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

type ClipboardNoticeState = "info" | "error";
interface ClipboardNotice {
  message: string;
  state: ClipboardNoticeState;
}
const CLIPBOARD_NOTICE_TTL_MS = 2500;

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
const clipboardExpanded = ref(false);
const clipboardBuffer = ref("");
const clipboardLastSyncedAt = ref<Date | null>(null);
const clipboardBusy = ref(false);
const clipboardNotice = ref<ClipboardNotice | null>(null);
let clipboardNoticeTimer = 0;
const helpVisible = ref(false);
let helpTimer = 0;
let rfb: VncRfb | null = null;
let attachedListeners: Array<{
  type: string;
  listener: (event: VncRfbEvent) => void;
}> = [];

const endpoint = computed(() =>
  buildVncWebSocketUrl(params.sessionId, window.location.origin),
);
const sessionDetailHref = computed(() => buildSessionDetailHref(params.sessionId));
const pageTitle = computed(() => formatPageTitle(params));
const sessionLabel = computed(() => formatSessionLabel(params));
const viewerModeLabel = computed(() => getViewerModeLabel(viewOnly.value));

const clipboardPreview = computed(() => {
  if (!clipboardBuffer.value) {
    return "";
  }
  const firstLine = clipboardBuffer.value.split("\n")[0] ?? "";
  const trimmed = firstLine.trim();
  if (!trimmed) {
    return "whitespace…";
  }
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
});

const clipboardSyncedLabel = computed(() => {
  if (!clipboardLastSyncedAt.value) {
    return "Not synced";
  }
  const time = clipboardLastSyncedAt.value.toLocaleTimeString(undefined, { hour12: false });
  return `Synced ${time}`;
});

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

function setClipboardNotice(message: string, state: ClipboardNoticeState) {
  if (clipboardNoticeTimer) {
    window.clearTimeout(clipboardNoticeTimer);
    clipboardNoticeTimer = 0;
  }
  clipboardNotice.value = { message, state };
  clipboardNoticeTimer = window.setTimeout(() => {
    clipboardNotice.value = null;
    clipboardNoticeTimer = 0;
  }, CLIPBOARD_NOTICE_TTL_MS);
}

function toggleClipboardDrawer() {
  clipboardExpanded.value = !clipboardExpanded.value;
}

function toggleHelp() {
  window.clearTimeout(helpTimer);
  helpTimer = 0;
  helpVisible.value = !helpVisible.value;
}

function showHelpDelayed() {
  if (helpVisible.value || helpTimer) {
    return;
  }
  helpTimer = window.setTimeout(() => {
    helpVisible.value = true;
    helpTimer = 0;
  }, 1000);
}

function hideHelp() {
  window.clearTimeout(helpTimer);
  helpTimer = 0;
  helpVisible.value = false;
}

async function pullFromSession() {
  if (!params.sessionId || clipboardBusy.value) {
    return;
  }
  clipboardBusy.value = true;
  try {
    const response = await fetch(buildClipboardUrl(params.sessionId), {
      headers: { accept: "text/plain" },
    });
    if (!response.ok) {
      setClipboardNotice(`Pull failed (${response.status})`, "error");
      return;
    }
    const text = await response.text();
    clipboardBuffer.value = text;
    clipboardLastSyncedAt.value = new Date();
    setClipboardNotice(text ? "Pulled from session" : "Session clipboard is empty", "info");
  } catch (error) {
    setClipboardNotice(error instanceof Error ? error.message : "Pull failed", "error");
  } finally {
    clipboardBusy.value = false;
  }
}

async function pushToSession() {
  if (!params.sessionId || clipboardBusy.value) {
    return;
  }
  clipboardBusy.value = true;
  try {
    const response = await fetch(buildClipboardUrl(params.sessionId), {
      body: clipboardBuffer.value,
      headers: { "content-type": "text/plain;charset=UTF-8" },
      method: "POST",
    });
    if (!response.ok) {
      setClipboardNotice(`Push failed (${response.status})`, "error");
      return;
    }
    clipboardLastSyncedAt.value = new Date();
    setClipboardNotice("Pushed to session", "info");
  } catch (error) {
    setClipboardNotice(error instanceof Error ? error.message : "Push failed", "error");
  } finally {
    clipboardBusy.value = false;
  }
}

function handleBeforeUnload() {
  window.clearTimeout(pendingReconnect.value);
  pendingReconnect.value = 0;
  reconnectAttempt.value = 0;
  if (clipboardNoticeTimer) {
    window.clearTimeout(clipboardNoticeTimer);
    clipboardNoticeTimer = 0;
  }
  disconnectViewer();
}
</script>

<template>
  <main class="vnc-page">
    <header class="vnc-page__header">
      <div class="vnc-page__title">
        <h1 id="vnc-page-title">
          {{ pageTitle }}
        </h1>
        <p>Read-only VNC stream for the selected session.</p>
      </div>
      <a
        class="button secondary"
        href="/sessions"
      >Session list</a>
    </header>

    <section class="panel">
      <div class="panel-header">
        <h2>Viewer</h2>
      </div>
      <div class="vnc-toolbar">
        <div class="vnc-toolbar__status">
          <span class="artifact-chip">VNC</span>
          <div class="vnc-status-copy">
            <strong
              id="vnc-session-label"
              class="mono"
            >{{ sessionLabel }}</strong>
            <span
              id="vnc-status"
              class="vnc-status"
              :data-state="status.state"
            >
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
            <rect
              x="4.25"
              y="8"
              width="9.5"
              height="6.5"
              rx="1.5"
            />
            <path d="M6.5 8V6.25a2.5 2.5 0 0 1 5 0V8" />
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
            <rect
              x="4.25"
              y="8"
              width="9.5"
              height="6.5"
              rx="1.5"
            />
            <path d="M6.5 8V6.25a2.5 2.5 0 0 1 4.2-1.78" />
            <path d="M11.8 4.47 13.2 3.1" />
          </svg>
          <span id="vnc-viewer-mode-label">{{ viewerModeLabel }}</span>
        </button>
      </div>
      <div class="vnc-screen-shell">
        <div
          id="vnc-screen"
          ref="screenElement"
          class="vnc-screen"
        />
      </div>
      <div class="vnc-clipboard-drawer-wrap">
        <div
          class="vnc-clipboard-drawer"
          :data-expanded="String(clipboardExpanded)"
        >
          <button
            id="vnc-clipboard-toggle"
            class="vnc-clipboard-drawer__toggle"
            type="button"
            :aria-expanded="clipboardExpanded ? 'true' : 'false'"
            aria-controls="vnc-clipboard-body"
            @click="toggleClipboardDrawer"
          >
            <svg
              class="vnc-clipboard-drawer__chevron"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
            <span class="vnc-clipboard-drawer__title">Session clipboard</span>
            <span
              v-if="clipboardPreview"
              id="vnc-clipboard-preview"
              class="vnc-clipboard-drawer__preview mono"
            >
              {{ clipboardPreview }}
            </span>
            <span
              class="vnc-clipboard-drawer__help"
              :data-visible="String(helpVisible)"
              @click.stop="toggleHelp"
              @mouseenter="showHelpDelayed"
              @mouseleave="hideHelp"
            >?</span>
          </button>
          <div
            v-show="clipboardExpanded"
            id="vnc-clipboard-body"
            class="vnc-clipboard-drawer__body"
          >
            <textarea
              id="vnc-clipboard-textarea"
              v-model="clipboardBuffer"
              class="vnc-clipboard-drawer__textarea mono"
              :disabled="!params.sessionId"
              rows="4"
              spellcheck="false"
              placeholder="Pull from session to load its clipboard, or paste text here and push."
            />
            <div class="vnc-clipboard-drawer__actions">
              <button
                id="vnc-clipboard-pull"
                class="button secondary"
                type="button"
                :disabled="!params.sessionId || clipboardBusy"
                @click="pullFromSession"
              >
                Pull from session
              </button>
              <button
                id="vnc-clipboard-push"
                class="button secondary"
                type="button"
                :disabled="!params.sessionId || clipboardBusy"
                @click="pushToSession"
              >
                Push to session
              </button>
              <span
                v-if="clipboardNotice"
                id="vnc-clipboard-notice"
                class="vnc-clipboard-drawer__meta"
                :data-state="clipboardNotice.state"
                role="status"
              >
                {{ clipboardNotice.message }}
              </span>
              <span
                v-else
                id="vnc-clipboard-synced"
                class="vnc-clipboard-drawer__meta"
              >
                {{ clipboardSyncedLabel }}
              </span>
            </div>
          </div>
        </div>
        <span
          v-if="helpVisible"
          class="vnc-clipboard-drawer__tooltip"
          @mouseenter="showHelpDelayed"
          @mouseleave="hideHelp"
        >
          Push: paste text in window → Push to session → right-click → Paste in VNC.<br>
          Pull: right-click → Copy in VNC → Pull from session.
        </span>
      </div>
      <div class="vnc-footer">
        <a
          id="vnc-open-session"
          class="button secondary"
          :href="sessionDetailHref"
        >
          Open session detail
        </a>
      </div>
    </section>
  </main>
</template>

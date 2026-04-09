import { compareValues, formatDateTime, formatDateTimeLong, formatDuration, formatStatus, timeAgo } from "../lib/format.js";
import { buildSessionPath } from "../lib/router.js";
import { icon } from "../components/icons.js";
import { escapeHtml, renderEmptyState, renderPageIntro, renderPanel } from "../components/layout.js";

const activeStatuses = new Set(["running", "pending", "queued"]);

export function getFilteredSessions(state) {
  const { search, protocol, status, browser, activeOnly, sort } = state.filters;
  const query = search.trim().toLowerCase();
  const sessions = state.data.sessions.filter((session) => {
    if (protocol !== "all" && session.protocol !== protocol) {
      return false;
    }
    if (status !== "all" && session.status !== status) {
      return false;
    }
    if (browser !== "all" && session.browser !== browser) {
      return false;
    }
    if (activeOnly && !activeStatuses.has(session.status)) {
      return false;
    }
    if (!query) {
      return true;
    }

    return [session.id, session.name, session.browser, session.browserVersion, session.protocol]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return sessions.sort((left, right) => sortSessions(left, right, sort));
}

export function renderSessionsPage(state) {
  const filteredSessions = getFilteredSessions(state);
  const selectedId = state.ui.selectedSessionId;
  const hasSessions = state.data.sessions.length > 0;

  if (!hasSessions) {
    return `
      ${renderPageIntro("Sessions", "Active and recent browser sessions.")}
      <p class="page-empty-copy">No active sessions</p>
    `;
  }

  return `
    ${renderPageIntro("Sessions", "Active and recent browser sessions.")}
    ${renderPanel(
      "Session list",
      `
        <div class="toolbar">
          <label class="search-field">
            ${icon("search")}
            <input
              aria-label="Search sessions"
              data-input="session-search"
              placeholder="Search session id, name, browser"
              type="search"
              value="${escapeHtml(state.filters.search)}"
            />
          </label>
          ${renderFilterSelect("protocol-filter", "Protocol", state.filters.protocol, [
            ["all", "All"],
            ["selenium", "Selenium"],
            ["playwright", "Playwright"],
          ])}
          ${renderFilterSelect("status-filter", "Status", state.filters.status, [
            ["all", "All"],
            ["running", "Running"],
            ["pending", "Pending"],
            ["queued", "Queued"],
            ["completed", "Completed"],
            ["failed", "Failed"],
          ])}
          ${renderFilterSelect("browser-filter", "Browser", state.filters.browser, [
            ["all", "All"],
            ...Array.from(new Set(state.data.sessions.map((session) => session.browser))).sort().map((name) => [name, titleCase(name)]),
          ])}
          <label class="toggle-chip">
            <input ${state.filters.activeOnly ? "checked" : ""} data-input="active-only" type="checkbox" />
            <span>Active only</span>
          </label>
        </div>
        ${
          filteredSessions.length
            ? `
              <div class="table-shell">
                <table class="data-table sessions-table">
                  <thead>
                    <tr>
                      ${renderSortableHead("Session", "session")}
                      ${renderSortableHead("Browser", "browser")}
                      ${renderStaticHead("Version")}
                      ${renderSortableHead("Status", "status")}
                      ${renderSortableHead("Started", "started")}
                      ${renderSortableHead("Duration", "duration")}
                      ${renderStaticHead("Artifacts")}
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredSessions
                      .map((session) => {
                        const selected = session.id === selectedId ? "selected" : "";
                        return `
                          <tr
                            class="session-row ${selected}"
                            data-action="open-session"
                            data-session-id="${session.id}"
                            tabindex="${selected ? "0" : "-1"}"
                          >
                            <td>
                              <div class="session-cell">
                                <span class="protocol-icon protocol-${session.protocol}">${icon(session.protocol === "playwright" ? "sessions" : "browsers")}</span>
                                <div>
                                  <strong>${session.name}</strong>
                                  <span class="secondary-text mono">${session.id}</span>
                                </div>
                              </div>
                            </td>
                            <td>${titleCase(session.browser)}</td>
                            <td class="mono">${session.browserVersion}</td>
                            <td>${renderStatusBadge(session.status)}</td>
                            <td>
                              <div class="stacked-cell">
                                <span>${formatDateTime(session.startedAt, state.preferences)}</span>
                                <span class="secondary-text" data-time-ago="${escapeAttribute(session.startedAt)}">${timeAgo(session.startedAt)}</span>
                              </div>
                            </td>
                            <td
                              class="mono"
                              data-duration-finished-at="${escapeAttribute(session.finishedAt || "")}"
                              data-duration-started-at="${escapeAttribute(session.startedAt)}"
                            >${formatDuration(session.durationMs)}</td>
                            <td>${renderArtifactIndicators(session)}</td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
            : renderEmptyState(
                "No matching sessions",
                "No sessions match the current filters.",
                '<button class="button secondary" data-action="reset-session-filters" type="button">Reset filters</button>',
              )
        }
      `,
    )}
  `;
}

export function renderSessionDetailPage(state) {
  const session = state.data.sessions.find((candidate) => candidate.id === state.route.sessionId);
  const terminatePending = session ? state.ui.terminatingSessionId === session.id : false;
  const canTerminate = session ? activeStatuses.has(session.status) : false;

  if (!session) {
    return `
      ${renderPageIntro("Session not found", "The requested session could not be located.")}
      ${renderPanel(
        "Missing session",
        renderEmptyState(
          "Unknown session",
          "The session id is not present in the current dataset.",
          '<a class="button secondary" data-link href="/sessions">Back to sessions</a>',
        ),
      )}
    `;
  }

  return `
    ${renderPageIntro(
      escapeHtml(buildSessionDisplayName(session)),
      `${formatStatus(session.status)} ${session.protocol} session on ${titleCase(session.browser)} ${session.browserVersion}.`,
      `
        ${renderProtocolBadge(session.protocol)}
        ${renderStatusBadge(session.status)}
      `,
    )}
    <div class="detail-header-row">
      <div class="detail-header-actions">
        ${renderVncDetailAction(session)}
        ${session.artifacts.devtools
          ? `<button class="button secondary" data-action="copy" data-copy="${session.metadata.devtoolsEndpoint}" type="button">Copy DevTools endpoint</button>`
          : ""}
        <button
          class="button danger"
          data-action="terminate-session"
          data-session-id="${session.id}"
          ${canTerminate && !terminatePending ? "" : "disabled"}
          type="button"
        >${terminatePending ? "Terminating..." : "Terminate"}</button>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-main stack-layout">
        ${renderPanel(
          "Overview",
          `
            <dl class="overview-grid">
              ${renderOverviewRow("Session ID", `<span class="mono">${session.id}</span>`)}
              ${renderOverviewRow("Protocol", renderProtocolBadge(session.protocol))}
              ${renderOverviewRow("Browser", `${titleCase(session.browser)} ${session.browserVersion}`)}
              ${renderOverviewRow("Started", formatDateTimeLong(session.startedAt, state.preferences))}
              ${renderOverviewRow(
                "Duration",
                `<span class="mono" data-duration-finished-at="${escapeAttribute(session.finishedAt || "")}" data-duration-started-at="${escapeAttribute(session.startedAt)}">${formatDuration(session.durationMs)}</span>`,
              )}
              ${renderOverviewRow(
                "Last activity",
                `<span data-time-ago="${escapeAttribute(session.lastActivityAt)}">${timeAgo(session.lastActivityAt)}</span>`,
              )}
              ${renderOverviewRow("Quota", session.metadata.quota)}
              ${renderOverviewRow("Artifacts", renderArtifactIndicators(session))}
            </dl>
          `,
        )}
        ${renderPanel(
          "Artifacts",
          `
            <div class="artifact-list">
              ${renderArtifactRow("Video", session.artifacts.video ? `${session.id}.mp4` : "Unavailable", "videos", session.id, session.artifacts.video)}
              ${renderLogsArtifactRow(session)}
              ${renderArtifactRow("Downloads", session.artifacts.downloads > 0 ? `${session.artifacts.downloads} files` : "None", "downloads", session.id, session.artifacts.downloads > 0)}
              ${renderArtifactStaticRow("Clipboard", session.artifacts.clipboard ? "Snapshot available" : "Unavailable")}
              ${renderArtifactStaticRow("DevTools", session.artifacts.devtools ? "Endpoint available" : "Unavailable")}
            </div>
          `,
        )}
      </div>
      <aside class="detail-side stack-layout">
        ${renderPanel(
          "Logs",
          renderSessionLogsPanel(state, session),
        )}
      </aside>
    </div>
  `;
}

function renderFilterSelect(inputName, label, selectedValue, options) {
  return `
    <label class="filter-select">
      <span>${label}</span>
      <select data-input="${inputName}">
        ${options
          .map(([value, optionLabel]) => `<option ${selectedValue === value ? "selected" : ""} value="${value}">${optionLabel}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function renderSortableHead(label, sortKey) {
  return `
    <th>
      <button class="sort-button" data-action="set-sort" data-sort="${sortKey}" type="button">
        ${label}
      </button>
    </th>
  `;
}

function renderStaticHead(label) {
  return `<th>${label}</th>`;
}

function renderStatusBadge(status) {
  return `<span class="status-badge status-${status}">${formatStatus(status)}</span>`;
}

function renderProtocolBadge(protocol) {
  return `<span class="protocol-badge protocol-badge-${protocol}">${titleCase(protocol)}</span>`;
}

function renderArtifactIndicators(session) {
  const indicators = [];
  if (session.artifacts.video) indicators.push("Video");
  if (session.artifacts.logs) indicators.push("Logs");
  if (session.artifacts.downloads) indicators.push(`DL ${session.artifacts.downloads}`);
  if (!indicators.length) {
    return '<span class="secondary-text">None</span>';
  }
  return indicators.map((label) => `<span class="artifact-chip">${label}</span>`).join("");
}

function renderOverviewRow(label, value) {
  return `
    <div class="overview-row">
      <dt>${label}</dt>
      <dd>${value}</dd>
    </div>
  `;
}

function renderArtifactRow(label, value, page, sessionId, available) {
  return `
    <div class="artifact-row">
      <div>
        <strong>${label}</strong>
        <span>${value}</span>
      </div>
      ${
        available
          ? `<button class="button secondary" data-action="open-artifact-page" data-page="${page}" data-session-id="${sessionId}" type="button">Open</button>`
          : `<span class="secondary-text">Unavailable</span>`
      }
    </div>
  `;
}

function renderArtifactStaticRow(label, value) {
  return `
    <div class="artifact-row">
      <div>
        <strong>${label}</strong>
        <span>${value}</span>
      </div>
    </div>
  `;
}

function renderArtifactActionRow(label, value, actionMarkup) {
  return `
    <div class="artifact-row">
      <div>
        <strong>${label}</strong>
        <span>${value}</span>
      </div>
      ${actionMarkup || `<span class="secondary-text">Unavailable</span>`}
    </div>
  `;
}

function renderLogsArtifactRow(session) {
  if (session.artifacts.savedLogs) {
    return renderArtifactRow("Logs", session.metadata.logFilename || `${session.id}.log`, "logs", session.id, true);
  }

  if (session.artifacts.liveLogs) {
    return renderArtifactActionRow("Logs", "Live stream available", '<span class="secondary-text">Live in detail</span>');
  }

  return renderArtifactActionRow("Logs", "Unavailable", "");
}

function renderVncDetailAction(session) {
  if (!session.artifacts.vnc) {
    return `<button class="button secondary" disabled type="button">VNC</button>`;
  }

  return renderVncViewerLink(session, "Open VNC");
}

function renderVncViewerLink(session, label) {
  return `<a class="button secondary" href="${buildVncViewerHref(session)}" rel="noreferrer" target="_blank">${label}</a>`;
}

function renderSessionLogsPanel(state, session) {
  const liveState = state.ui.liveLogs.sessionId === session.id ? state.ui.liveLogs : null;

  if (session.artifacts.liveLogs) {
    return renderLiveLogPanel(state, session);
  }

  if (session.artifacts.savedLogs) {
    return renderSavedLogPanel(state, session);
  }

  if (
    liveState?.source === "live" &&
    (liveState.content || liveState.status === "inactive" || liveState.status === "closed" || liveState.status === "error")
  ) {
    return renderLiveLogPanel(state, session);
  }

  return `
    <div class="log-preview-panel" id="session-logs-panel">
      <div class="log-preview-header">
        <span>No log source</span>
      </div>
      <p class="hint-text">${escapeHtml(getMissingSessionLogText(session))}</p>
    </div>
  `;
}

function buildSessionDisplayName(session) {
  return `${session.browser}-${session.id}`;
}

function renderLiveLogPanel(state, session) {
  const liveState = state.ui.liveLogs.sessionId === session.id ? state.ui.liveLogs : null;
  const liveContent = liveState?.content || "";
  const showReconnect =
    session.artifacts.liveLogs &&
    liveState &&
    (liveState.status === "closed" || liveState.status === "error" || liveState.status === "reconnecting");

  return `
    <div class="log-preview-panel" id="session-logs-panel">
      <div class="log-preview-header">
        <span>Live stream</span>
        <div class="panel-actions">
          ${session.artifacts.savedLogs ? `<button class="button secondary" data-action="open-artifact-page" data-page="logs" data-session-id="${session.id}" type="button">Open saved log</button>` : ""}
        </div>
      </div>
      <div class="drawer-toolbar">
        <div class="log-toolbar-status">
          <strong>${session.id}</strong>
          <span>${escapeHtml(getLiveLogStatusText(liveState))}</span>
        </div>
      </div>
      <div class="drawer-actions">
        <button class="button secondary" ${liveContent ? "" : "disabled"} data-action="copy-log-content" type="button">Copy block</button>
        <button class="button secondary" data-action="jump-log-end" type="button">Jump to end</button>
        ${showReconnect ? '<button class="button secondary" data-action="reconnect-live-log" type="button">Reconnect</button>' : ""}
      </div>
      ${liveState?.error ? `<div class="note-block log-note-error">${escapeHtml(liveState.error)}</div>` : ""}
      ${!liveContent ? `<p class="hint-text">${escapeHtml(getLiveLogEmptyText(liveState))}</p>` : ""}
      <pre class="code-block log-viewer wrap" data-live-log-viewer="${escapeAttribute(session.id)}" data-log-viewer id="log-viewer-content">${escapeHtml(liveContent)}</pre>
    </div>
  `;
}

function renderSavedLogPanel(state, session) {
  const filename = session.metadata.logFilename;
  const logState = getSavedLogState(state, filename);
  const filteredContent = filterLogContent(logState.content, state.ui.logSearch);
  const hasContent = Boolean(filteredContent);

  return `
    <div class="log-preview-panel" id="session-logs-panel">
      <div class="log-preview-header">
        <span>${escapeHtml(filename)}</span>
        <div class="panel-actions">
          <button class="button secondary" data-action="open-artifact-page" data-page="logs" data-session-id="${session.id}" type="button">Open logs</button>
        </div>
      </div>
      <div class="drawer-toolbar">
        <label class="search-field compact">
          <input
            aria-label="Search inside log"
            data-input="log-search"
            placeholder="Search inside log"
            type="search"
            value="${escapeHtml(state.ui.logSearch)}"
          />
        </label>
        <div class="log-toolbar-spacer"></div>
      </div>
      <div class="drawer-actions">
        <button class="button secondary" ${hasContent ? "" : "disabled"} data-action="copy-log-content" data-filename="${escapeAttribute(filename)}" type="button">Copy block</button>
        <button class="button secondary" data-action="jump-log-end" type="button">Jump to end</button>
        ${logState.error ? `<button class="button secondary" data-action="retry-log-file" data-filename="${escapeAttribute(filename)}" type="button">Retry</button>` : ""}
        <a class="button secondary" download="${escapeAttribute(filename)}" href="${buildLogDownloadHref(filename)}">Download</a>
      </div>
      ${logState.loading ? `<div class="note-block">Loading ${escapeHtml(filename)}…</div>` : ""}
      ${logState.error ? `<div class="note-block log-note-error">${escapeHtml(logState.error)}</div>` : ""}
      ${
        hasContent
          ? `<pre class="code-block log-viewer wrap" data-log-viewer id="log-viewer-content">${escapeHtml(filteredContent)}</pre>`
          : `<p class="hint-text">${escapeHtml(getSavedLogEmptyText(logState, state.ui.logSearch))}</p>`
      }
    </div>
  `;
}

function sortSessions(left, right, sort) {
  switch (sort) {
    case "browser":
      return compareValues(left.browser, right.browser);
    case "duration":
      return compareValues(right.durationMs, left.durationMs);
    case "session":
      return compareValues(left.name, right.name);
    case "status":
      return compareValues(left.status, right.status);
    case "started":
    default:
      return compareValues(new Date(right.startedAt).getTime(), new Date(left.startedAt).getTime());
  }
}

function titleCase(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function lastLines(content, count) {
  return content.split("\n").slice(-count).join("\n");
}

function getSavedLogState(state, filename) {
  const cached = state.ui.logFiles[filename];
  if (cached) {
    return cached;
  }

  const item = state.data.logs.find((entry) => entry.filename === filename);
  return {
    content: item?.content || "",
    error: item?.contentError || "",
    loaded: Boolean(item?.contentLoaded),
    loading: false,
  };
}

function filterLogContent(content, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return content;
  }

  return content
    .split("\n")
    .filter((line) => line.toLowerCase().includes(normalizedQuery))
    .join("\n");
}

function getSavedLogEmptyText(logState, query) {
  if (logState.loading) {
    return "Waiting for log content.";
  }

  if (logState.error) {
    return "Saved log content is unavailable right now.";
  }

  if (query.trim()) {
    return "No lines match the current search.";
  }

  return logState.loaded ? "This log file is empty." : "Open the log to load its content.";
}

function getMissingSessionLogText(session) {
  if (session.status === "running") {
    return "Live log stream is unavailable right now.";
  }

  return "No saved log has been persisted for this session yet.";
}

function getLiveLogStatusText(liveState) {
  if (!liveState) {
    return "Connecting to live log stream.";
  }

  switch (liveState.status) {
    case "open":
      return "Connected, waiting for first line";
    case "streaming":
      return "Streaming live log output";
    case "reconnecting":
      return liveState.message || "Live stream dropped. Reconnecting.";
    case "error":
      return "Live stream unavailable";
    case "inactive":
      return "Session is no longer active";
    case "closed":
      return liveState.message || "Live stream closed.";
    case "connecting":
    case "idle":
    default:
      return liveState.message || "Connecting to live log stream.";
  }
}

function getLiveLogEmptyText(liveState) {
  if (!liveState) {
    return "Connecting to live log stream.";
  }

  switch (liveState.status) {
    case "open":
      return "Live stream connected, waiting for first line.";
    case "streaming":
      return "Waiting for live log output.";
    case "error":
      return "Live stream failed. Retry is available.";
    case "reconnecting":
      return liveState.message || "Live stream dropped. Reconnecting.";
    case "inactive":
      return "Session is no longer active.";
    case "closed":
      return "Live log stream closed.";
    case "connecting":
    default:
      return liveState.message || "Connecting to live log stream.";
  }
}

function buildLogDownloadHref(filename) {
  return `/api/logs/file/${encodeURIComponent(filename)}`;
}

function escapeAttribute(value) {
  return String(value).replaceAll('"', "&quot;");
}

function buildVncViewerHref(session) {
  const params = new URLSearchParams({
    browser: session.browser,
    name: session.name,
    session: session.id,
  });

  return `/vnc.html?${params.toString()}`;
}

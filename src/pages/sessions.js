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
      ${renderPanel(
        "Session list",
        renderEmptyState(
          "No active sessions",
          "No sessions match the current filters.",
          '<button class="button secondary" data-action="reset-session-filters" type="button">Reset filters</button>',
        ),
      )}
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
                                <span class="secondary-text">${timeAgo(session.startedAt, Date.parse("2026-04-05T18:00:00Z"))}</span>
                              </div>
                            </td>
                            <td class="mono">${formatDuration(session.durationMs)}</td>
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
                "No active sessions",
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
  const detailPanelsOpen = state.preferences.detailPanel === "expanded";

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

  const logPreview = state.data.logs.find((entry) => entry.sessionId === session.id);

  return `
    ${renderPageIntro(
      session.name,
      `${formatStatus(session.status)} ${session.protocol} session on ${titleCase(session.browser)} ${session.browserVersion}.`,
      `
        ${renderProtocolBadge(session.protocol)}
        ${renderStatusBadge(session.status)}
      `,
    )}
    <div class="detail-header-row">
      <div class="detail-header-copy mono">${session.id}</div>
      <div class="detail-header-actions">
        ${renderDetailAction("Logs", "logs", session.id, session.artifacts.logs)}
        ${renderDetailAction("Video", "videos", session.id, session.artifacts.video)}
        ${renderDetailAction("Downloads", "downloads", session.id, session.artifacts.downloads > 0)}
        <button class="button secondary" data-action="copy" data-copy="${session.metadata.clipboardEndpoint}" type="button">Copy clipboard URL</button>
        ${session.artifacts.devtools
          ? `<button class="button secondary" data-action="copy" data-copy="${session.metadata.devtoolsEndpoint}" type="button">Copy DevTools endpoint</button>`
          : ""}
        <button class="button danger" type="button">Terminate</button>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-main">
        ${renderPanel(
          "Overview",
          `
            <dl class="overview-grid">
              ${renderOverviewRow("Session ID", `<span class="mono">${session.id}</span>`)}
              ${renderOverviewRow("Protocol", renderProtocolBadge(session.protocol))}
              ${renderOverviewRow("Browser", `${titleCase(session.browser)} ${session.browserVersion}`)}
              ${renderOverviewRow("Started", formatDateTimeLong(session.startedAt, state.preferences))}
              ${renderOverviewRow("Duration", `<span class="mono">${formatDuration(session.durationMs)}</span>`)}
              ${renderOverviewRow("Last activity", timeAgo(session.lastActivityAt, Date.parse("2026-04-05T18:00:00Z")))}
              ${renderOverviewRow("Quota", session.metadata.quota)}
              ${renderOverviewRow("Artifacts", renderArtifactIndicators(session))}
            </dl>
          `,
        )}
        ${renderPanel(
          "Live View",
          `
            <details ${detailPanelsOpen ? "open" : ""}>
              <summary>${session.artifacts.liveView ? "Preview available" : "No live preview"}</summary>
              <div class="details-body">
                ${
                  session.artifacts.liveView
                    ? `
                      <div class="live-preview-placeholder">
                        <div class="live-preview-screen">${titleCase(session.browser)} live preview</div>
                        <p>VNC and live preview stay collapsed by default to keep the detail page readable.</p>
                        <button class="button secondary" data-action="copy" data-copy="${session.livePreviewUrl}" type="button">Copy VNC endpoint</button>
                      </div>
                    `
                    : "<p class=\"hint-text\">This session does not expose a live preview.</p>"
                }
              </div>
            </details>
          `,
        )}
        ${renderPanel(
          "Logs",
          `
            <div class="log-preview-panel">
              <div class="log-preview-header">
                <span>${logPreview ? `${logPreview.filename}` : "No log file"}</span>
                <div class="panel-actions">
                  ${session.artifacts.logs ? `<button class="button secondary" data-action="open-artifact-page" data-page="logs" data-session-id="${session.id}" type="button">Open logs</button>` : ""}
                </div>
              </div>
              <pre class="log-preview">${logPreview ? escapeHtml(lastLines(logPreview.content, 8)) : "Logs are not available for this session."}</pre>
            </div>
          `,
        )}
        ${renderPanel(
          "Artifacts",
          `
            <div class="artifact-list">
              ${renderArtifactRow("Video", session.artifacts.video ? `${session.id}.mp4` : "Unavailable", "videos", session.id, session.artifacts.video)}
              ${renderArtifactRow("Logs", session.artifacts.logs ? `${session.id}.log` : "Unavailable", "logs", session.id, session.artifacts.logs)}
              ${renderArtifactRow("Downloads", session.artifacts.downloads > 0 ? `${session.artifacts.downloads} files` : "None", "downloads", session.id, session.artifacts.downloads > 0)}
              ${renderArtifactStaticRow("Clipboard", session.artifacts.clipboard ? "Snapshot available" : "Unavailable")}
              ${renderArtifactStaticRow("DevTools", session.artifacts.devtools ? "Endpoint available" : "Unavailable")}
            </div>
          `,
        )}
      </div>
      <aside class="detail-side">
        ${renderPanel(
          "Technical Metadata",
          `
            <details ${detailPanelsOpen ? "open" : ""}>
              <summary>Capabilities</summary>
              <div class="details-body">
                <button class="button secondary" data-action="copy" data-copy="${escapeAttribute(session.technicalMetadata.capabilitiesJson)}" type="button">Copy JSON</button>
                <pre class="code-block">${escapeHtml(session.technicalMetadata.capabilitiesJson)}</pre>
              </div>
            </details>
            <details ${detailPanelsOpen ? "open" : ""}>
              <summary>Endpoints</summary>
              <div class="details-body">
                <div class="key-value-list">
                  ${renderCopyableValue("Protocol route", session.metadata.protocolEndpoint)}
                  ${renderCopyableValue("Log file", session.metadata.logEndpoint)}
                  ${renderCopyableValue("Download route", session.metadata.downloadEndpoint)}
                  ${renderCopyableValue("Clipboard route", session.metadata.clipboardEndpoint)}
                  ${session.metadata.devtoolsEndpoint ? renderCopyableValue("DevTools", session.metadata.devtoolsEndpoint) : ""}
                </div>
              </div>
            </details>
            <details ${detailPanelsOpen ? "open" : ""}>
              <summary>Runtime</summary>
              <div class="details-body">
                <button class="button secondary" data-action="copy" data-copy="${escapeAttribute(session.technicalMetadata.runtimeJson)}" type="button">Copy runtime</button>
                <pre class="code-block">${escapeHtml(session.technicalMetadata.runtimeJson)}</pre>
              </div>
            </details>
          `,
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
  if (session.artifacts.vnc) indicators.push("VNC");
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

function renderDetailAction(label, page, sessionId, enabled) {
  if (!enabled) {
    return `<button class="button secondary" disabled type="button">${label}</button>`;
  }

  return `<button class="button secondary" data-action="open-artifact-page" data-page="${page}" data-session-id="${sessionId}" type="button">Open ${label}</button>`;
}

function renderCopyableValue(label, value) {
  return `
    <div class="copyable-row">
      <span>${label}</span>
      <button class="ghost-button mono" data-action="copy" data-copy="${escapeAttribute(value)}" type="button">${value}</button>
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

function escapeAttribute(value) {
  return String(value).replaceAll('"', "&quot;");
}

import { formatDateTime, titleCase } from "../lib/format.js";
import { escapeHtml, renderPageIntro, renderPanel, renderSegmentedButtons } from "../components/layout.js";

export function renderBrowsersPage(state) {
  const groups = groupBy(state.data.browsers, "browser");

  return `
    ${renderPageIntro("Browsers", "Available browser and version inventory.")}
    <div class="stack-layout">
      ${Object.entries(groups)
        .map(
          ([browser, versions]) => `
            ${renderPanel(
              titleCase(browser),
              `
                <div class="table-shell">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Version</th>
                        <th>Protocol</th>
                        <th>Image / source</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${versions
                        .map(
                          (entry) => `
                            <tr>
                              <td class="mono">${entry.version}</td>
                              <td>${renderProtocolBadge(entry.protocol)}</td>
                              <td class="mono">${entry.source}</td>
                              <td>${renderStatusBadge(entry.status === "ready" ? "running" : "pending", entry.status)}</td>
                            </tr>
                          `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `,
            )}
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderConfigurationPage(state) {
  const { configuration } = state.data;
  const detailOpen = state.preferences.detailPanel === "expanded";
  const isWaitingForConfiguration = configuration.message === "Waiting for configuration data";
  const emptyStateLabel = configuration.available ? "No data" : isWaitingForConfiguration ? "Waiting" : "Unavailable";
  const configurationStatusClass = !configuration.available && !isWaitingForConfiguration ? " log-note-error" : "";

  return `
    ${renderPageIntro("Configuration", "Runtime limits, paths, logging, and feature availability.")}
    <div class="stack-layout">
      ${configuration.available ? "" : `<div class="note-block${configurationStatusClass}">${escapeHtml(configuration.message)}</div>`}
      <div class="two-column-layout">
        ${renderPanel("Limits and timeouts", renderKeyValueList(configuration.limits, emptyStateLabel))}
        ${renderPanel("Paths and storage", renderKeyValueList(configuration.paths, emptyStateLabel))}
        ${renderPanel("Logging", renderKeyValueList(configuration.logging, emptyStateLabel))}
        ${renderPanel("Feature availability", renderKeyValueList(configuration.featureAvailability, emptyStateLabel))}
      </div>
      ${renderPanel("Raw configuration", renderConfigurationRaw(configuration, detailOpen))}
    </div>
  `;
}

export function renderSystemPage(state) {
  const { system } = state.data;

  return `
    ${renderPageIntro("System", "Runtime health, queue depth, and browser usage.")}
    ${renderPanel(
      "Current usage",
      `
        <div class="summary-grid">
          ${system.usageSummary
            .map(
              (item) => `
                <div class="summary-card">
                  <span>${item.label}</span>
                  <strong>${item.value}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
      `,
    )}
    <div class="two-column-layout wide">
      ${renderPanel(
        "Browser usage",
        `
          <div class="table-shell">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Browser</th>
                  <th>Total sessions</th>
                  <th>Running now</th>
                </tr>
              </thead>
              <tbody>
                ${system.browserUsage
                  .map(
                    (entry) => `
                      <tr>
                        <td>${titleCase(entry.browser)}</td>
                        <td>${entry.count}</td>
                        <td>${entry.running}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `,
      )}
      ${renderPanel(
        "Health notes",
        `
          <div class="stack-layout compact">
            ${system.healthNotes.map((note) => `<div class="note-block">${note}</div>`).join("")}
            <div class="note-block">
              <strong>Last reload</strong>
              <span>${formatDateTime(system.lastReloadTime, state.preferences)}</span>
            </div>
            <div class="note-block">
              <strong>Runtime</strong>
              <span>${state.data.connection.statusEndpointMessage}</span>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

export function renderSettingsPage(state) {
  const artifactHistory = state.data.settings.artifactHistory;
  const artifactHistoryUi = state.ui.artifactHistory;
  const retentionValue = artifactHistoryUi.loaded
    ? artifactHistoryUi.draftRetentionDays
    : String(artifactHistory.retentionDays);
  const controlsDisabled = artifactHistoryUi.saving || !artifactHistory.available;
  const enableSelected = artifactHistoryUi.draftEnabled;
  const backendValueLabel = `${artifactHistory.enabled ? "enabled" : "disabled"}, ${artifactHistory.retentionDays} days`;
  const unavailableReason = artifactHistory.reason || "Artifact history is unavailable with the current backend setup.";

  return `
    ${renderPageIntro("Settings", "Theme, density, and viewer preferences.")}
    <div class="stack-layout">
      ${renderPanel(
        "Theme mode",
        `
          <p class="hint-text">Follow system theme or override it manually.</p>
          ${renderSegmentedButtons("set-theme", state.preferences.themeMode, [
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ])}
        `,
      )}
      ${renderPanel(
        "Density",
        `
          <p class="hint-text">Compact keeps the sessions list denser without collapsing readability.</p>
          ${renderSegmentedButtons("set-density", state.preferences.density, [
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
          ])}
        `,
      )}
      ${renderPanel(
        "Viewer behavior",
        `
          <div class="settings-grid">
            <div>
              <h3>Detail panels</h3>
              ${renderSegmentedButtons("set-detail-panel", state.preferences.detailPanel, [
                { value: "collapsed", label: "Collapsed" },
                { value: "expanded", label: "Expanded" },
              ])}
            </div>
            <div>
              <h3>Timezone</h3>
              ${renderSegmentedButtons("set-timezone", state.preferences.timezone, [
                { value: "local", label: "Local" },
                { value: "utc", label: "UTC" },
              ])}
            </div>
            <div>
              <h3>Time format</h3>
              ${renderSegmentedButtons("set-time-format", state.preferences.timeFormat, [
                { value: "24h", label: "24h" },
                { value: "12h", label: "12h" },
              ])}
            </div>
          </div>
        `,
      )}
      ${renderPanel(
        "Artifact History",
        `
          <div class="settings-grid">
            <div class="settings-field">
              <h3>Retention mode</h3>
              <p class="hint-text">Persist downloads and saved session artifacts after sessions end.</p>
              <div class="segmented-control ${controlsDisabled ? "is-disabled" : ""}" role="group" aria-label="Artifact history toggle">
                <button class="segmented-option ${!enableSelected ? "selected" : ""}" data-action="set-artifact-history-enabled" data-value="disabled" ${controlsDisabled ? "disabled" : ""} type="button">Disabled</button>
                <button class="segmented-option ${enableSelected ? "selected" : ""}" data-action="set-artifact-history-enabled" data-value="enabled" ${controlsDisabled ? "disabled" : ""} type="button">Enabled</button>
              </div>
            </div>
            <div class="settings-field">
              <h3>Retention days</h3>
              <p class="hint-text">Keep history for 1 to 365 whole days.</p>
              <label class="search-field compact settings-number-field ${controlsDisabled ? "is-disabled" : ""}">
                <input
                  data-input="artifact-history-retention-days"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  placeholder="7"
                  ${controlsDisabled ? "disabled" : ""}
                  type="text"
                  value="${escapeAttribute(retentionValue)}"
                />
              </label>
            </div>
          </div>
          <div class="settings-status-stack">
            <div class="drawer-actions settings-actions">
              <button class="button" data-action="save-artifact-history-settings" ${controlsDisabled || !artifactHistoryUi.dirty ? "disabled" : ""} type="button">
                ${artifactHistoryUi.saving ? "Saving…" : "Save settings"}
              </button>
              <span class="secondary-text">Current backend value: ${backendValueLabel}</span>
            </div>
            ${artifactHistory.available ? "" : `<div class="note-block settings-status-callout">${escapeHtml(unavailableReason)}</div>`}
            ${artifactHistoryUi.error ? `<div class="note-block log-note-error settings-status-callout">${escapeHtml(artifactHistoryUi.error)}</div>` : ""}
          </div>
        `,
      )}
      ${renderPanel(
        "Connection",
        `
          <div class="key-value-list compact">
            <div class="copyable-row">
              <span>Data source</span>
              <strong>${state.data.connection.mode === "live" ? "Live" : state.data.connection.mode}</strong>
            </div>
            <div class="copyable-row">
              <span>Target</span>
              <strong class="mono">${state.data.connection.target}</strong>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderNotFoundPage() {
  return `
    ${renderPageIntro("Not found", "The requested route is not defined.")}
    ${renderPanel("Missing page", '<p class="hint-text">Return to Sessions from the sidebar.</p>')}
  `;
}

function renderKeyValueList(items, emptyLabel = "No data") {
  if (!items.length) {
    return `<div class="note-block configuration-panel-empty">${escapeHtml(emptyLabel)}</div>`;
  }

  return `
    <div class="key-value-list">
      ${items
        .map(
          (item) => `
            <div class="copyable-row">
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderConfigurationRaw(configuration, detailOpen) {
  if (!hasRawConfigurationData(configuration.raw)) {
    return '<div class="note-block configuration-panel-empty">No raw configuration data</div>';
  }

  return `
    <details data-persist-id="configuration:browser-catalog" ${detailOpen ? "open" : ""}>
      <summary>Browser catalog JSON</summary>
      <div class="details-body">
        <pre class="code-block">${escapeHtml(JSON.stringify(configuration.raw.browserCatalog, null, 2))}</pre>
      </div>
    </details>
    <details data-persist-id="configuration:flags-reload-status" ${detailOpen ? "open" : ""}>
      <summary>Flags and reload status</summary>
      <div class="details-body">
        <pre class="code-block">${escapeHtml(
          JSON.stringify({ flags: configuration.raw.flags, reloadStatus: configuration.raw.reloadStatus }, null, 2),
        )}</pre>
      </div>
    </details>
  `;
}

function hasRawConfigurationData(raw) {
  return Boolean(
    raw.browserCatalog.length || Object.keys(raw.flags).length || Object.keys(raw.reloadStatus).length,
  );
}

function renderProtocolBadge(protocol) {
  return `<span class="protocol-badge protocol-badge-${protocol}">${titleCase(protocol)}</span>`;
}

function renderStatusBadge(status, label) {
  return `<span class="status-badge status-${status}">${label}</span>`;
}

function groupBy(items, key) {
  return items.reduce((accumulator, item) => {
    const groupKey = item[key];
    accumulator[groupKey] ||= [];
    accumulator[groupKey].push(item);
    return accumulator;
  }, {});
}

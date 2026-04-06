import { formatDateTime, titleCase } from "../lib/format.js";
import { renderPageIntro, renderPanel, renderSegmentedButtons } from "../components/layout.js";

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
                        <th>Capabilities</th>
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
                              <td>${entry.capabilities}</td>
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

  return `
    ${renderPageIntro("Configuration", "Runtime limits, paths, logging, and feature availability.")}
    <div class="two-column-layout">
      ${renderPanel("Limits and timeouts", renderKeyValueList(configuration.limits))}
      ${renderPanel("Paths and storage", renderKeyValueList(configuration.paths))}
      ${renderPanel("Logging", renderKeyValueList(configuration.logging))}
      ${renderPanel("Feature availability", renderKeyValueList(configuration.featureAvailability))}
    </div>
    ${renderPanel(
      "Raw configuration",
      `
        <details ${detailOpen ? "open" : ""}>
          <summary>Browser catalog JSON</summary>
          <div class="details-body">
            <pre class="code-block">${JSON.stringify(configuration.raw.browserCatalog, null, 2)}</pre>
          </div>
        </details>
        <details ${detailOpen ? "open" : ""}>
          <summary>Flags and reload status</summary>
          <div class="details-body">
            <pre class="code-block">${JSON.stringify(
              { flags: configuration.raw.flags, reloadStatus: configuration.raw.reloadStatus },
              null,
              2,
            )}</pre>
          </div>
        </details>
      `,
    )}
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
              <h3>Log wrapping</h3>
              ${renderSegmentedButtons("set-log-wrap", state.ui.logWrap ? "wrap" : "nowrap", [
                { value: "nowrap", label: "No wrap" },
                { value: "wrap", label: "Wrap" },
              ])}
            </div>
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
        "Connection",
        `
          <div class="key-value-list compact">
            <div class="copyable-row">
              <span>Data source</span>
              <strong>${state.data.connection.mode === "live" ? "Live + demo fallback" : "Demo fallback"}</strong>
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

export function renderNotFoundPage() {
  return `
    ${renderPageIntro("Not found", "The requested route is not defined.")}
    ${renderPanel("Missing page", '<p class="hint-text">Return to Sessions from the sidebar.</p>')}
  `;
}

function renderKeyValueList(items) {
  return `
    <div class="key-value-list">
      ${items
        .map(
          (item) => `
            <div class="copyable-row">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
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

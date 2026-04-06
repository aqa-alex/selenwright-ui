import {
  formatBytes,
  formatDateTime,
  formatDuration,
  titleCase,
} from '../lib/format.js';
import {
  escapeHtml,
  renderEmptyState,
  renderPageIntro,
  renderPanel,
} from '../components/layout.js';

export function renderVideosPage(state) {
  return renderArtifactPage({
    columns: [
      'Filename',
      'Session',
      'Browser',
      'Protocol',
      'Created',
      'Size',
      'Actions',
    ],
    drawer: renderVideoDrawer(state),
    emptyHint: 'No videos match the current selection.',
    items: getFilteredArtifacts(state, state.data.videos),
    pageKey: 'videos',
    state,
    title: 'Videos',
  });
}

export function renderLogsPage(state) {
  return renderArtifactPage({
    columns: ['Filename', 'Session', 'Browser', 'Created', 'Size', 'Actions'],
    drawer: renderLogDrawer(state),
    emptyHint: 'No logs match the current selection.',
    items: getFilteredArtifacts(state, state.data.logs),
    pageKey: 'logs',
    state,
    title: 'Logs',
  });
}

export function renderDownloadsPage(state) {
  return renderArtifactPage({
    columns: ['Filename', 'Session', 'Browser', 'Created', 'Size', 'Actions'],
    drawer: renderDownloadDrawer(state),
    emptyHint: 'No downloads match the current selection.',
    items: getFilteredArtifacts(state, state.data.downloads),
    pageKey: 'downloads',
    state,
    title: 'Downloads',
  });
}

function renderArtifactPage({
  columns,
  drawer,
  emptyHint,
  items,
  pageKey,
  state,
  title,
}) {
  const sessionFilter = state.ui.artifactSessionFilter;
  const drawerRatio = state.preferences.artifactPaneWidths?.[pageKey] ?? 0.37;
  const drawerPercent = Math.round(drawerRatio * 100);

  return `
    ${renderPageIntro(
      title,
      `Browse ${title.toLowerCase()} across sessions.`,
      sessionFilter
        ? `<button class="button secondary" data-action="clear-artifact-session-filter" type="button">Clear session filter</button>`
        : '',
    )}
    <div class="artifact-layout artifact-layout--${pageKey}" data-artifact-layout data-artifact-page="${pageKey}">
      <div class="artifact-layout__pane artifact-layout__pane--index" data-artifact-pane="index">
        ${renderPanel(
          `${title} index`,
          items.length
            ? `
              <div class="table-shell">
                <table class="data-table artifact-table artifact-table--${pageKey}">
                  <thead>
                    <tr>${columns.map((label) => `<th>${label}</th>`).join('')}</tr>
                  </thead>
                  <tbody>
                    ${items.map((item) => renderArtifactRow(pageKey, item, state)).join('')}
                  </tbody>
                </table>
              </div>
            `
            : renderEmptyState(`No ${title.toLowerCase()}`, emptyHint),
        )}
      </div>
      <div
        aria-label="Resize index and viewer panes"
        aria-valuemax="80"
        aria-valuemin="20"
        aria-valuenow="${drawerPercent}"
        aria-orientation="vertical"
        class="artifact-layout__splitter"
        data-artifact-splitter-page="${pageKey}"
        data-artifact-page="${pageKey}"
        data-artifact-splitter
        role="separator"
        tabindex="0"
      ></div>
      <div class="artifact-layout__pane artifact-layout__pane--drawer" data-artifact-pane="drawer">
        ${drawer}
      </div>
    </div>
  `;
}

function renderArtifactRow(pageKey, item, state) {
  const selected =
    state.ui.selectedArtifacts[pageKey] === item.filename ? 'selected' : '';
  const session = state.data.sessions.find(
    (candidate) => candidate.id === item.sessionId,
  );
  const safeFilename = escapeAttribute(item.filename);

  const sharedCells = `
    ${renderArtifactIdentityCell(item.filename)}
    ${renderArtifactIdentityCell(item.sessionId)}
    <td>${session ? titleCase(session.browser) : titleCase(item.browser)}</td>
    <td>${formatDateTime(item.createdAt, state.preferences)}</td>
    <td class="mono">${formatBytes(item.size)}</td>
  `;

  if (pageKey === 'videos') {
    return `
      <tr class="${selected}" data-action="select-artifact" data-filename="${safeFilename}" data-page="${pageKey}">
        ${renderArtifactIdentityCell(item.filename)}
        ${renderArtifactIdentityCell(item.sessionId)}
        <td>${session ? titleCase(session.browser) : titleCase(item.browser)}</td>
        <td>${titleCase(item.protocol)}</td>
        <td>${formatDateTime(item.createdAt, state.preferences)}</td>
        <td class="mono">${formatBytes(item.size)}</td>
        ${renderArtifactActionCell(pageKey, safeFilename)}
      </tr>
    `;
  }

  return `
    <tr class="${selected}" data-action="select-artifact" data-filename="${safeFilename}" data-page="${pageKey}">
      ${sharedCells}
      ${renderArtifactActionCell(pageKey, safeFilename)}
    </tr>
  `;
}

function renderArtifactIdentityCell(value) {
  const safeValue = escapeHtml(value);
  const safeTitle = escapeAttribute(value);

  return `
    <td class="artifact-table__truncate-cell" title="${safeTitle}">
      <span class="artifact-table__truncate mono">${safeValue}</span>
    </td>
  `;
}

function renderArtifactActionCell(pageKey, safeFilename) {
  return `
    <td class="artifact-table__action-cell">
      <button class="button secondary" data-action="select-artifact" data-filename="${safeFilename}" data-page="${pageKey}" type="button">Inspect</button>
    </td>
  `;
}

function renderVideoDrawer(state) {
  const selected = state.data.videos.find(
    (item) => item.filename === state.ui.selectedArtifacts.videos,
  );

  return renderPanel(
    'Preview',
    selected
      ? renderArtifactDrawerBody(`
          <div class="drawer-media-placeholder">
            <div class="video-poster">${selected.filename}</div>
            <p>Preview stays paused by default. Use inspect or download as the primary action.</p>
          </div>
          <div class="key-value-list compact">
            ${renderKeyValue('Session', selected.sessionId)}
            ${renderKeyValue('Browser', titleCase(selected.browser))}
            ${renderKeyValue('Protocol', titleCase(selected.protocol))}
            ${renderKeyValue('Created', formatDateTime(selected.createdAt, state.preferences))}
            ${renderKeyValue('Duration', formatDuration(selected.durationMs))}
            ${renderKeyValue('Size', formatBytes(selected.size))}
          </div>
          <div class="drawer-actions">
            <button class="button secondary" data-action="copy" data-copy="${selected.filename}" type="button">Copy filename</button>
            <button class="button secondary" type="button">Download</button>
            <button class="button danger" type="button">Delete</button>
          </div>
        `)
      : `<p class="hint-text">Select a video to inspect metadata.</p>`,
  );
}

function renderLogDrawer(state) {
  const selected = state.data.logs.find(
    (item) => item.filename === state.ui.selectedArtifacts.logs,
  );
  const query = state.ui.logSearch.trim().toLowerCase();
  const lines = selected ? selected.content.split('\n') : [];
  const filteredContent = query
    ? lines.filter((line) => line.toLowerCase().includes(query)).join('\n')
    : selected?.content || '';

  return renderPanel(
    'Log viewer',
    selected
      ? renderArtifactDrawerBody(`
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
            <label class="toggle-chip">
              <input ${state.ui.logWrap ? 'checked' : ''} data-input="log-wrap" type="checkbox" />
              <span>Wrap lines</span>
            </label>
          </div>
          <div class="drawer-actions">
            <button class="button secondary" data-action="copy" data-copy="${escapeAttribute(selected.content)}" type="button">Copy block</button>
            <button class="button secondary" data-action="jump-log-end" type="button">Jump to end</button>
            <button class="button secondary" type="button">Download</button>
          </div>
          <pre class="code-block log-viewer ${state.ui.logWrap ? 'wrap' : ''}" id="log-viewer-content">${escapeHtml(filteredContent)}</pre>
        `)
      : `<p class="hint-text">Select a log file to inspect it.</p>`,
  );
}

function renderDownloadDrawer(state) {
  const selected = state.data.downloads.find(
    (item) => item.filename === state.ui.selectedArtifacts.downloads,
  );

  return renderPanel(
    'Details',
    selected
      ? renderArtifactDrawerBody(`
          <div class="key-value-list compact">
            ${renderKeyValue('File', selected.filename)}
            ${renderKeyValue('Session', selected.sessionId)}
            ${renderKeyValue('Browser', titleCase(selected.browser))}
            ${renderKeyValue('Created', formatDateTime(selected.createdAt, state.preferences))}
            ${renderKeyValue('Size', formatBytes(selected.size))}
            ${renderKeyValue('Type', selected.mimeType)}
          </div>
          <div class="drawer-actions">
            <button class="button secondary" type="button">Download</button>
            <button class="button secondary" data-action="copy" data-copy="${selected.filename}" type="button">Copy filename</button>
            <button class="button danger" type="button">Delete</button>
          </div>
        `)
      : `<p class="hint-text">Select a file to inspect metadata.</p>`,
  );
}

function getFilteredArtifacts(state, items) {
  if (!state.ui.artifactSessionFilter) {
    return items;
  }
  return items.filter(
    (item) => item.sessionId === state.ui.artifactSessionFilter,
  );
}

function renderKeyValue(label, value) {
  return `
    <div class="copyable-row">
      <span>${label}</span>
      <strong class="mono">${value}</strong>
    </div>
  `;
}

function renderArtifactDrawerBody(content) {
  return `<div class="artifact-drawer-body">${content}</div>`;
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

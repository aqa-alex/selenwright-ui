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
  const filteredLogs = getFilteredArtifacts(state, state.data.logs);
  const perPage = state.ui.logsPerPage;
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / perPage));
  const currentPage = Math.min(state.ui.logsPage, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageItems = filteredLogs.slice(start, start + perPage);

  return renderArtifactPage({
    columns: ['Filename', 'Session', 'Browser', 'Created', 'Size', 'Actions'],
    drawer: renderLogDrawer(state),
    emptyHint: getLogsEmptyHint(state, filteredLogs),
    items: pageItems,
    pageKey: 'logs',
    pagination: filteredLogs.length
      ? renderLogsPagination(currentPage, totalPages, perPage)
      : null,
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
  pagination = null,
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
              ${pagination ?? ''}
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
  const created = item.createdAt ? formatDateTime(item.createdAt, state.preferences) : '—';

  const sharedCells = `
    ${renderArtifactIdentityCell(item.filename)}
    ${renderArtifactIdentityCell(item.sessionId)}
    <td>${session ? titleCase(session.browser) : titleCase(item.browser)}</td>
    <td>${created}</td>
    <td class="mono">${formatBytes(item.size)}</td>
  `;

  if (pageKey === 'videos') {
    return `
      <tr class="${selected}" data-action="select-artifact" data-filename="${safeFilename}" data-page="${pageKey}">
        ${renderArtifactIdentityCell(item.filename)}
        ${renderArtifactIdentityCell(item.sessionId)}
        <td>${session ? titleCase(session.browser) : titleCase(item.browser)}</td>
        <td>${titleCase(item.protocol)}</td>
        <td>${created}</td>
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
  const created = selected?.createdAt ? formatDateTime(selected.createdAt, state.preferences) : '—';

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
            ${renderKeyValue('Created', created)}
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
  const logState = selected ? getSavedLogState(state, selected.filename) : null;
  const filteredContent = selected
    ? filterLogContent(logState.content, state.ui.logSearch)
    : '';
  const hasContent = Boolean(filteredContent);

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
            <div class="log-toolbar-spacer"></div>
          </div>
          <div class="drawer-actions">
            <button class="button secondary" ${hasContent ? '' : 'disabled'} data-action="copy-log-content" data-filename="${escapeAttribute(selected.filename)}" type="button">Copy block</button>
            <button class="button secondary" data-action="jump-log-end" type="button">Jump to end</button>
            ${logState.error ? `<button class="button secondary" data-action="retry-log-file" data-filename="${escapeAttribute(selected.filename)}" type="button">Retry</button>` : ''}
            <a class="button secondary" download="${escapeAttribute(selected.filename)}" href="${buildLogDownloadHref(selected.filename)}">Download</a>
          </div>
          ${logState.loading ? `<div class="note-block">Loading ${escapeHtml(selected.filename)}…</div>` : ''}
          ${logState.error ? `<div class="note-block log-note-error">${escapeHtml(logState.error)}</div>` : ''}
          ${
            hasContent
              ? `<pre class="code-block log-viewer wrap" data-log-viewer id="log-viewer-content">${escapeHtml(filteredContent)}</pre>`
              : `<p class="hint-text">${escapeHtml(getSavedLogEmptyText(logState, state.ui.logSearch))}</p>`
          }
        `)
      : `<p class="hint-text">Select a log file to inspect it.</p>`,
  );
}

function renderDownloadDrawer(state) {
  const selected = state.data.downloads.find(
    (item) => item.filename === state.ui.selectedArtifacts.downloads,
  );
  const created = selected?.createdAt ? formatDateTime(selected.createdAt, state.preferences) : '—';

  return renderPanel(
    'Details',
    selected
      ? renderArtifactDrawerBody(`
          <div class="key-value-list compact">
            ${renderKeyValue('File', selected.filename)}
            ${renderKeyValue('Session', selected.sessionId)}
            ${renderKeyValue('Browser', titleCase(selected.browser))}
            ${renderKeyValue('Created', created)}
            ${renderKeyValue('Size', formatBytes(selected.size))}
            ${renderKeyValue('Type', selected.mimeType)}
          </div>
          <div class="drawer-actions">
            <a class="button secondary" download="${escapeAttribute(selected.filename)}" href="${buildDownloadArtifactHref(selected)}">Download</a>
            <button class="button secondary" data-action="copy" data-copy="${selected.filename}" type="button">Copy filename</button>
          </div>
        `)
      : `<p class="hint-text">Select a file to inspect metadata.</p>`,
  );
}

function renderLogsPagination(currentPage, totalPages, perPage) {
  const options = [10, 20, 50, 100];
  return `
    <div class="pagination-bar">
      <label class="filter-select">
        <span>Per page</span>
        <select data-input="logs-per-page">
          ${options.map((n) => `<option ${perPage === n ? 'selected' : ''} value="${n}">${n}</option>`).join('')}
        </select>
      </label>
      <div class="pagination-controls">
        <button class="button secondary" data-action="logs-prev-page" type="button"${currentPage <= 1 ? ' disabled' : ''}>Prev</button>
        <span class="pagination-info">${currentPage} / ${totalPages}</span>
        <button class="button secondary" data-action="logs-next-page" type="button"${currentPage >= totalPages ? ' disabled' : ''}>Next</button>
      </div>
    </div>
  `;
}

function getFilteredArtifacts(state, items) {
  if (!state.ui.artifactSessionFilter) {
    return items;
  }
  return items.filter(
    (item) => item.sessionId === state.ui.artifactSessionFilter,
  );
}

function getLogsEmptyHint(state, items) {
  if (items.length) {
    return 'No logs match the current selection.';
  }

  if (state.ui.artifactSessionFilter) {
    return 'No saved logs have been persisted for this session yet.';
  }

  return 'No saved logs have been persisted yet.';
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

function getSavedLogState(state, filename) {
  const cached = state.ui.logFiles[filename];
  if (cached) {
    return cached;
  }

  const item = state.data.logs.find((entry) => entry.filename === filename);
  return {
    content: item?.content || '',
    error: item?.contentError || '',
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
    .split('\n')
    .filter((line) => line.toLowerCase().includes(normalizedQuery))
    .join('\n');
}

function getSavedLogEmptyText(logState, query) {
  if (logState.loading) {
    return 'Waiting for log content.';
  }

  if (logState.error) {
    return 'Log content is unavailable right now.';
  }

  if (query.trim()) {
    return 'No lines match the current search.';
  }

  return logState.loaded ? 'This log file is empty.' : 'Open the file to load its content.';
}

function buildDownloadArtifactHref(item) {
  return item?.downloadUrl || "#";
}

function buildLogDownloadHref(filename) {
  return `/api/logs/file/${encodeURIComponent(filename)}`;
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

import { navGroups } from "../lib/router.js";
import { icon } from "./icons.js";

const pageTitles = {
  browsers: "Browsers",
  configuration: "Configuration",
  downloads: "Downloads",
  logs: "Logs",
  "not-found": "Not found",
  "session-detail": "Session Details",
  sessions: "Sessions",
  settings: "Settings",
  system: "System",
  videos: "Videos",
};

export function renderLayout(state, pageContent) {
  const { preferences } = state;
  const routeName = state.route.name;

  document.title = pageTitles[routeName] || "Selenwright";

  return `
    <div class="shell">
      <header class="topbar" role="banner">
        <div class="brand-block">
          <a class="brand-link" href="/sessions" data-link>
            <span class="brand-mark"><img src="/favicon.ico" alt="Selenwright logo" class="brand-favicon" /></span>
            <span class="brand-copy">
              <strong>Selenwright</strong>
              <span>Browser session console</span>
            </span>
          </a>
        </div>
        <div class="topbar-tools">
          <div class="quick-jump">
            ${icon("search")}
            <input
              aria-label="Global search and quick jump"
              data-input="quick-jump"
              placeholder="Quick jump"
              spellcheck="false"
              type="search"
              value="${escapeHtml(state.ui.quickJumpQuery)}"
            />
            ${renderQuickJumpResults(state)}
          </div>
          <div class="theme-switcher" aria-label="Theme mode">
            ${renderSegmentedButtons("set-theme", preferences.themeMode, [
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ])}
          </div>
        </div>
      </header>
      <div class="workspace">
        <aside class="sidebar" aria-label="Primary navigation">
          ${navGroups
            .map(
              (group) => `
                <section class="sidebar-group">
                  <h2>${group.title}</h2>
                  ${group.items
                    .map((item) => {
                      const active = isNavItemActive(routeName, item.href) ? "active" : "";
                      return `
                        <a class="sidebar-link ${active}" data-link href="${item.href}">
                          <span class="sidebar-link-icon">${icon(item.icon)}</span>
                          <span>${item.label}</span>
                        </a>
                      `;
                    })
                    .join("")}
                </section>
              `,
            )
            .join("")}
        </aside>
        <main class="content" role="main" aria-label="${pageTitles[routeName] || "Selenwright"}">
          ${state.ui.notice ? `<div class="inline-notice">${escapeHtml(state.ui.notice)}</div>` : ""}
          ${pageContent}
        </main>
      </div>
    </div>
  `;
}

export function renderPageIntro(title, description, extra = "") {
  return `
    <div class="page-intro">
      <div>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
      ${extra ? `<div class="page-intro-meta">${extra}</div>` : ""}
    </div>
  `;
}

export function renderPanel(title, body, actions = "") {
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>${title}</h2>
        ${actions ? `<div class="panel-actions">${actions}</div>` : ""}
      </div>
      ${body}
    </section>
  `;
}

export function renderSegmentedButtons(action, selectedValue, options) {
  return `
    <div class="segmented-control" role="group">
      ${options
        .map(
          (option) => `
            <button
              class="segmented-option ${selectedValue === option.value ? "selected" : ""}"
              aria-pressed="${selectedValue === option.value ? "true" : "false"}"
              data-action="${action}"
              data-value="${option.value}"
              type="button"
            >
              ${option.label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderEmptyState(title, hint, actionMarkup = "") {
  return `
    <div class="empty-state">
      <h2>${title}</h2>
      <p>${hint}</p>
      ${actionMarkup}
    </div>
  `;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderQuickJumpResults(state) {
  if (!state.ui.quickJumpQuery.trim()) {
    return "";
  }

  const results = state.ui.quickJumpResults.slice(0, 6);
  if (!results.length) {
    return `
      <div class="quick-jump-results">
        <div class="quick-jump-empty">No matches</div>
      </div>
    `;
  }

  return `
    <div class="quick-jump-results">
      ${results
        .map(
          (result) => `
            <button
              class="quick-jump-result"
              data-action="open-quick-jump-result"
              data-path="${result.path}"
              type="button"
            >
              <span>
                <strong>${result.title}</strong>
                <span>${result.meta}</span>
              </span>
              <span class="quick-jump-kind">${result.kind}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function isNavItemActive(routeName, href) {
  if (href === "/sessions") {
    return routeName === "sessions" || routeName === "session-detail";
  }
  if (href === "/artifacts/videos") {
    return routeName === "videos";
  }
  if (href === "/artifacts/logs") {
    return routeName === "logs";
  }
  if (href === "/artifacts/downloads") {
    return routeName === "downloads";
  }
  return href.endsWith(routeName);
}

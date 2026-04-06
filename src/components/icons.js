const icons = {
  browsers:
    '<path d="M3 5.5a2.5 2.5 0 0 1 2.5-2.5h5A2.5 2.5 0 0 1 13 5.5v5A2.5 2.5 0 0 1 10.5 13h-5A2.5 2.5 0 0 1 3 10.5z"/><path d="M13 6h4v1.5h-4z"/><path d="M13 9h3v1.5h-3z"/>',
  configuration:
    '<path d="M9 3.5h6"/><path d="M9 8h6"/><path d="M9 12.5h6"/><circle cx="5.5" cy="3.5" r="1.5"/><circle cx="5.5" cy="8" r="1.5"/><circle cx="5.5" cy="12.5" r="1.5"/>',
  devtools:
    '<path d="M3 4.5h12v8H3z"/><path d="M6 15.5h6"/><path d="M8 12.5v3"/><path d="M5.5 6.5l2.5 2-2.5 2"/><path d="M10 10.5h2.5"/>',
  downloads:
    '<path d="M8.5 3v7"/><path d="M6 8.5l2.5 2.5L11 8.5"/><path d="M3.5 13h10"/>',
  logs:
    '<path d="M4 3.5h8l3 3v7A1.5 1.5 0 0 1 13.5 15h-9A1.5 1.5 0 0 1 3 13.5v-8A2 2 0 0 1 5 3.5z"/><path d="M11.5 3.5v3h3"/><path d="M5.5 9h6"/><path d="M5.5 11.5h5"/>',
  search:
    '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>',
  sessions:
    '<rect x="3" y="4" width="11" height="9" rx="2"/><path d="M5 7h7"/><path d="M5 10h4"/><path d="M14.5 5.5h1.5v6h-1.5"/>',
  settings:
    '<path d="m8.5 3 .7 1.7 1.8.2-.9 1.5.5 1.8-1.7-.7-1.7.7.5-1.8-.9-1.5 1.8-.2z"/><path d="M8.5 9.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/><path d="M3.5 10.5h2"/><path d="M11.5 10.5h2"/>',
  system:
    '<path d="M4 12V8"/><path d="M8.5 12V5"/><path d="M13 12V9"/><path d="M3 13.5h11"/>',
  theme:
    '<path d="M9.8 3.2a5.8 5.8 0 1 0 4.9 8.8A6.2 6.2 0 0 1 9.8 3.2Z"/>',
  videos:
    '<rect x="3" y="4.5" width="8.5" height="8" rx="2"/><path d="m7 7.2 2.5 1.3L7 9.8z"/><path d="M11.5 7 15 5.5v6L11.5 10z"/>',
};

export function icon(name, label = "") {
  const pathMarkup = icons[name] || icons.sessions;
  const ariaLabel = label ? `aria-label="${label}" role="img"` : 'aria-hidden="true"';
  return `<svg class="icon icon-${name}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" ${ariaLabel}>${pathMarkup}</svg>`;
}


/**
 * Design token system — CSS custom properties edition.
 *
 * T maps every token to a CSS var string so inline styles stay readable:
 *   style={{ background: T.bg, color: T.text }}
 *
 * Theme switching is handled entirely by CSS:
 *   ThemeContext sets document.documentElement.setAttribute("data-theme", mode)
 *   :root defines dark values, [data-theme="light"] overrides them.
 *   No Proxy. No tree remount. No magic.
 *
 * Alpha variants — use the alpha() helper instead of hex-suffix hacks:
 *   alpha(T.red, 27)  →  color-mix(in srgb, var(--t-red) 27%, transparent)
 *   Replaces the old `${T.red}44` pattern (44 hex ≈ 27%).
 */

const T = {
  // Static — never change with theme
  font: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', Consolas, monospace",

  // Dynamic — backed by CSS custom properties in global.css
  sidebar:    "var(--t-sidebar)",
  bg:         "var(--t-bg)",
  card:       "var(--t-card)",
  cardBorder: "var(--t-card-border)",
  border:     "var(--t-border)",
  text:       "var(--t-text)",
  textSub:    "var(--t-text-sub)",
  textDim:    "var(--t-text-dim)",
  green:      "var(--t-green)",
  blue:       "var(--t-blue)",
  orange:     "var(--t-orange)",
  red:        "var(--t-red)",
  yellow:     "var(--t-yellow)",
  teal:       "var(--t-teal)",
  navActive:  "var(--t-nav-active)",
  tabLine:    "var(--t-tab-line)",
  shadowCard: "var(--t-shadow-card)",
};

export default T;

/**
 * alpha(cssVar, percent) — transparent variant of any CSS token.
 *
 * @param {string} cssVar  - e.g. T.red → "var(--t-red)"
 * @param {number} percent - opacity 0-100 (hex-suffix cheat-sheet below)
 *
 * Hex → % quick reference:
 *   11 →  7%   22 → 13%   33 → 20%   44 → 27%
 *   55 → 33%   66 → 40%   88 → 53%
 */
export const alpha = (cssVar, percent) =>
  `color-mix(in srgb, ${cssVar} ${percent}%, transparent)`;

// ── Non-theme static lookups ───────────────────────────────────────────────

export const statusLabel = {
  active: "Attivo", idle: "Fermo", workshop: "Officina",
  waiting_parts: "Attesa Ricambi", in_progress: "In Corso", done: "Completato",
};

export const statusColor = {
  active: "#4ade80", idle: "#facc15", workshop: "#f87171",
  waiting_parts: "#fb923c", in_progress: "#60a5fa", done: "#6ee7b7",
};

export const roleLabel = {
  superadmin: "Super Admin", company_admin: "Admin Azienda",
  fleet_manager: "Fleet Manager", responsabile_officina: "Resp. Officina",
  coordinatore_officina: "Coord. Officina", coordinatore_operativo: "Coord. Operativo",
};

export const moduleLabel = {
  gps: "GPS Live", navigation: "Navigazione", foto_timbrata: "Foto timbrata",
  cdr: "Schede CDR", zone: "Zone", punti: "Punti", percorsi: "Percorsi",
  pdf_export: "Export PDF", workshop: "Officina", fuel: "Carburante",
  suppliers: "Fornitori", costs: "Costi", admin: "Admin",
};

export const levelColor = {
  none: "#3a5a7a", view: "#60a5fa", edit: "#facc15", full: "#4ade80",
};

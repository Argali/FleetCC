const shared = {
  font: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', Consolas, monospace",
};

const darkTokens = {
  sidebar:    "#0a1628",
  bg:         "#1a2332",
  card:       "#243447",
  cardBorder: "#2e4a6a",
  border:     "#263d5a",
  text:       "#e2eaf5",
  textSub:    "#7a9bbf",
  textDim:    "#3d5a7a",
  green:      "#4ade80",
  blue:       "#60a5fa",
  orange:     "#fb923c",
  red:        "#f87171",
  yellow:     "#facc15",
  teal:       "#34d399",
  navActive:  "#0f2540",
  tabLine:    "#3a7bd5",
  shadowCard: "rgba(0,0,0,0.25)",
};

const lightTokens = {
  sidebar:    "#ffffff",
  bg:         "#ECF1F9",
  card:       "#ffffff",
  cardBorder: "#dde3ec",
  border:     "#dde3ec",
  text:       "#0f1b2d",
  textSub:    "#4a6b8f",
  textDim:    "#9aadc4",
  green:      "#16a34a",
  blue:       "#2563eb",
  orange:     "#ea580c",
  red:        "#dc2626",
  yellow:     "#ca8a04",
  teal:       "#0d9488",
  navActive:  "#e8f0ff",
  tabLine:    "#2563eb",
  shadowCard: "rgba(0,0,0,0.08)",
};

export function buildTheme(mode) {
  return { ...shared, ...(mode === "light" ? lightTokens : darkTokens) };
}

// Live proxy — all existing T.bg / T.text reads keep working.
// ThemeContext calls T.__setMode(mode) to swap the palette in place.
const _state = { current: buildTheme("dark") };

const T = new Proxy(_state, {
  get(target, prop) {
    if (prop === "__setMode") return (mode) => { target.current = buildTheme(mode); };
    return target.current[prop];
  },
});

export const statusLabel = { active: "Attivo", idle: "Fermo", workshop: "Officina", waiting_parts: "Attesa Ricambi", in_progress: "In Corso", done: "Completato" };
export const statusColor = { active: "#4ade80", idle: "#facc15", workshop: "#f87171", waiting_parts: "#fb923c", in_progress: "#60a5fa", done: "#6ee7b7" };
export const roleLabel = { superadmin: "Super Admin", company_admin: "Admin Azienda", fleet_manager: "Fleet Manager", responsabile_officina: "Resp. Officina", coordinatore_officina: "Coord. Officina", coordinatore_operativo: "Coord. Operativo" };
export const moduleLabel = { gps: "GPS Live", navigation: "Navigazione", foto_timbrata: "Foto timbrata", cdr: "Schede CDR", zone: "Zone", punti: "Punti", percorsi: "Percorsi", pdf_export: "Export PDF", workshop: "Officina", fuel: "Carburante", suppliers: "Fornitori", costs: "Costi", admin: "Admin" };
export const levelColor = { none: "#3a5a7a", view: "#60a5fa", edit: "#facc15", full: "#4ade80" };

export default T;

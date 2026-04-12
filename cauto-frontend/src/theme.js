const T = {
  sidebar:   "#0a1628",   // darkest layer
  bg:        "#1a2332",   // content area background
  card:      "#243447",   // card background
  cardBorder:"#2e4a6a",   // card border
  border:    "#263d5a",   // general border
  text:      "#e2eaf5",
  textSub:   "#7a9bbf",
  textDim:   "#3d5a7a",
  green:     "#4ade80",
  blue:      "#60a5fa",
  orange:    "#fb923c",
  red:       "#f87171",
  yellow:    "#facc15",
  teal:      "#34d399",
  navActive: "#0f2540",
  tabLine:   "#3a7bd5",
  font:      "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  mono:      "'JetBrains Mono', Consolas, monospace",
};

export const statusLabel={active:"Attivo",idle:"Fermo",workshop:"Officina",waiting_parts:"Attesa Ricambi",in_progress:"In Corso",done:"Completato"};
export const statusColor={active:"#4ade80",idle:"#facc15",workshop:"#f87171",waiting_parts:"#fb923c",in_progress:"#60a5fa",done:"#6ee7b7"};
export const roleLabel={"superadmin":"Super Admin","company_admin":"Admin Azienda","fleet_manager":"Fleet Manager","responsabile_officina":"Resp. Officina","coordinatore_officina":"Coord. Officina","coordinatore_operativo":"Coord. Operativo"};
export const moduleLabel={gps:"GPS Live",workshop:"Officina",fuel:"Carburante",suppliers:"Fornitori",costs:"Costi",admin:"Admin"};
export const levelColor={none:"#3a5a7a",view:"#60a5fa",edit:"#facc15",full:"#4ade80"};

export default T;

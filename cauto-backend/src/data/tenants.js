// ── In-memory multi-tenant store ──────────────────────────────────────────────
// Each tenant tracks: enabled modules, created_at, last_active (UTC ISO string)

const ALL_MODULES = ["gps", "cdr", "zone", "punti", "percorsi", "pdf_export"];

let tenants = [
  {
    id: "cauto",
    name: "Cooperativa CAUTO",
    plan: "enterprise",
    active: true,
    modules: { gps: true, cdr: true, zone: true, punti: true, percorsi: true, pdf_export: true },
    created_at: "2024-01-15T09:00:00.000Z",
    last_active: new Date().toISOString(),
  },
  {
    id: "ecogest",
    name: "EcoGest Brescia",
    plan: "standard",
    active: true,
    modules: { gps: true, cdr: false, zone: true, punti: false, percorsi: true, pdf_export: false },
    created_at: "2024-03-10T08:00:00.000Z",
    last_active: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "verdepulita",
    name: "Verde Pulita SRL",
    plan: "starter",
    active: true,
    modules: { gps: true, cdr: false, zone: false, punti: false, percorsi: false, pdf_export: false },
    created_at: "2024-06-01T10:00:00.000Z",
    last_active: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "ricicloplus",
    name: "Riciclo Plus Bergamo",
    plan: "standard",
    active: false,
    modules: { gps: false, cdr: false, zone: false, punti: false, percorsi: false, pdf_export: false },
    created_at: "2023-11-20T11:00:00.000Z",
    last_active: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

module.exports = {
  ALL_MODULES,
  getAllTenants: () => tenants,
  findTenantById: (id) => tenants.find(t => t.id === id),
  updateTenantModules: (id, modules) => {
    const idx = tenants.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tenants[idx] = { ...tenants[idx], modules: { ...tenants[idx].modules, ...modules } };
    return tenants[idx];
  },
  updateTenantActive: (id, active) => {
    const idx = tenants.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tenants[idx] = { ...tenants[idx], active };
    return tenants[idx];
  },
  touchTenant: (id) => {
    const idx = tenants.findIndex(t => t.id === id);
    if (idx !== -1) tenants[idx] = { ...tenants[idx], last_active: new Date().toISOString() };
  },
};

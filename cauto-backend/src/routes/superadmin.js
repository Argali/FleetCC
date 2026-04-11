const express = require("express");
const { requireAuth, requireSuperAdmin } = require("../middleware/auth");
const tenantsStore = require("../data/tenants");
const usersStore   = require("../data/users");

const router = express.Router();

// All routes require superadmin role
router.use(requireAuth, requireSuperAdmin);

// ── GET /api/superadmin/tenants ───────────────────────────────────────────────
router.get("/tenants", (_req, res) => {
  try {
    res.json({ ok: true, data: tenantsStore.getAllTenants() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PATCH /api/superadmin/tenants/:id/modules ─────────────────────────────────
router.patch("/tenants/:id/modules", (req, res) => {
  try {
    const { modules } = req.body;
    if (!modules || typeof modules !== "object")
      return res.status(400).json({ ok: false, error: "Campo 'modules' obbligatorio (oggetto)" });
    const updated = tenantsStore.updateTenantModules(req.params.id, modules);
    if (!updated) return res.status(404).json({ ok: false, error: "Tenant non trovato" });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PATCH /api/superadmin/tenants/:id/active ──────────────────────────────────
router.patch("/tenants/:id/active", (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== "boolean")
      return res.status(400).json({ ok: false, error: "Campo 'active' deve essere boolean" });
    const updated = tenantsStore.updateTenantActive(req.params.id, active);
    if (!updated) return res.status(404).json({ ok: false, error: "Tenant non trovato" });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/superadmin/analytics ─────────────────────────────────────────────
router.get("/analytics", (_req, res) => {
  try {
    const tenants = tenantsStore.getAllTenants();
    const users   = usersStore.getAllUsers();
    const now     = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const inactiveThreshold = now - SEVEN_DAYS_MS;

    const activeTenants    = tenants.filter(t => t.active);
    const inactiveTenants  = activeTenants.filter(t => new Date(t.last_active).getTime() < inactiveThreshold);
    const activeUsers      = users.filter(u => u.active && u.role !== "superadmin");

    // Module adoption: how many active tenants have each module enabled
    const moduleAdoption = tenantsStore.ALL_MODULES.map(mod => ({
      module: mod,
      count:  activeTenants.filter(t => t.modules[mod]).length,
      total:  activeTenants.length,
      pct:    activeTenants.length
        ? Math.round((activeTenants.filter(t => t.modules[mod]).length / activeTenants.length) * 100)
        : 0,
    }));

    // Per-tenant user count
    const tenantStats = activeTenants.map(t => ({
      id:          t.id,
      name:        t.name,
      plan:        t.plan,
      last_active: t.last_active,
      inactive:    new Date(t.last_active).getTime() < inactiveThreshold,
      user_count:  users.filter(u => u.tenant_id === t.id && u.active).length,
      modules_enabled: Object.values(t.modules).filter(Boolean).length,
    }));

    res.json({
      ok: true,
      data: {
        summary: {
          total_tenants:    tenants.length,
          active_tenants:   activeTenants.length,
          inactive_tenants: inactiveTenants.length,
          total_users:      activeUsers.length,
        },
        module_adoption: moduleAdoption,
        tenant_stats:    tenantStats,
        inactive_alerts: inactiveTenants.map(t => ({
          id:          t.id,
          name:        t.name,
          last_active: t.last_active,
          days_inactive: Math.floor((now - new Date(t.last_active).getTime()) / (24 * 60 * 60 * 1000)),
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

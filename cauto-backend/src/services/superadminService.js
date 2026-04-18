const { AppError } = require("../middleware/errorHandler");
const tenantRepo   = require("../repositories/tenantRepository");
const userRepo     = require("../repositories/userRepository");

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const superadminService = {
  getTenants() {
    return tenantRepo.findAll();
  },

  updateTenantModules(id, modules) {
    if (!modules || typeof modules !== "object" || Array.isArray(modules))
      throw new AppError("Campo 'modules' obbligatorio (oggetto)", 400);
    const invalidKeys = Object.keys(modules).filter(k => !tenantRepo.ALL_MODULES.includes(k));
    if (invalidKeys.length > 0)
      throw new AppError(`Moduli non validi: ${invalidKeys.join(", ")}`, 400);
    const invalidVals = Object.entries(modules).filter(([, v]) => typeof v !== "boolean");
    if (invalidVals.length > 0)
      throw new AppError("I valori dei moduli devono essere true o false", 400);
    const updated = tenantRepo.updateModules(id, modules);
    if (!updated) throw new AppError("Tenant non trovato", 404);
    return updated;
  },

  updateTenantActive(id, active) {
    if (typeof active !== "boolean")
      throw new AppError("Campo 'active' deve essere boolean", 400);
    const updated = tenantRepo.updateActive(id, active);
    if (!updated) throw new AppError("Tenant non trovato", 404);
    return updated;
  },

  getAnalytics() {
    const tenants   = tenantRepo.findAll();
    const users     = userRepo.findAll();
    const now       = Date.now();
    const threshold = now - SEVEN_DAYS_MS;

    const activeTenants   = tenants.filter(t => t.active);
    const inactiveTenants = activeTenants.filter(t => new Date(t.last_active).getTime() < threshold);
    const activeUsers     = users.filter(u => u.active && u.role !== "superadmin");

    const moduleAdoption = tenantRepo.ALL_MODULES.map(mod => {
      const count = activeTenants.filter(t => t.modules[mod]).length;
      return {
        module: mod,
        count,
        total: activeTenants.length,
        pct:   activeTenants.length ? Math.round((count / activeTenants.length) * 100) : 0,
      };
    });

    const tenantStats = activeTenants.map(t => ({
      id:              t.id,
      name:            t.name,
      plan:            t.plan,
      last_active:     t.last_active,
      inactive:        new Date(t.last_active).getTime() < threshold,
      user_count:      users.filter(u => u.tenant_id === t.id && u.active).length,
      modules_enabled: Object.values(t.modules).filter(Boolean).length,
    }));

    return {
      summary: {
        total_tenants:    tenants.length,
        active_tenants:   activeTenants.length,
        inactive_tenants: inactiveTenants.length,
        total_users:      activeUsers.length,
      },
      module_adoption: moduleAdoption,
      tenant_stats:    tenantStats,
      inactive_alerts: inactiveTenants.map(t => ({
        id:            t.id,
        name:          t.name,
        last_active:   t.last_active,
        days_inactive: Math.floor((now - new Date(t.last_active).getTime()) / (24 * 60 * 60 * 1000)),
      })),
    };
  },
};

module.exports = superadminService;

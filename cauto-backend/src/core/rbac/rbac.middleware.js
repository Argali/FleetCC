/**
 * Core RBAC middleware.
 *
 * requirePermission(module, level)
 *   → Express middleware that checks req.user.role against rbacService.can()
 *   → Must be used AFTER requireAuth (needs req.user)
 *
 * Alias: requirePerm (shorter form used in route files)
 */

const rbacService = require("./rbac.service");

/**
 * Returns a middleware that verifies the authenticated user has at least
 * `level` access on `module`.
 *
 * @param {string} module - permissions module name (e.g. "gps", "workshop")
 * @param {string} level  - minimum level required: "view" | "edit" | "full"
 */
function requirePermission(module, level = "view") {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ ok: false, error: "Non autenticato" });
    }
    if (!rbacService.can(role, module, level)) {
      return res.status(403).json({ ok: false, error: "Permesso insufficiente" });
    }
    next();
  };
}

/** Require superadmin role specifically */
function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ ok: false, error: "Riservato al super-amministratore" });
  }
  next();
}

/** Require any one of the listed roles */
function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ ok: false, error: "Accesso negato" });
    }
    next();
  };
}

module.exports = {
  requirePermission,
  requirePerm: requirePermission, // short alias
  requireSuperAdmin,
  requireAnyRole,
};

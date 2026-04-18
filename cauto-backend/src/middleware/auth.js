/**
 * Auth & RBAC middleware — thin shim over src/core/.
 *
 * All logic lives in:
 *   src/core/auth/auth.middleware.js  — requireAuth
 *   src/core/rbac/rbac.middleware.js  — requirePerm, requirePermission,
 *                                       requireSuperAdmin, requireAnyRole
 *
 * This file re-exports them so existing route files that import from
 * "../middleware/auth" continue to work without changes.
 */

const { requireAuth }                                   = require("../core/auth/auth.middleware");
const { requirePermission, requirePerm,
        requireSuperAdmin, requireAnyRole }             = require("../core/rbac/rbac.middleware");

/** requireRole(role) — kept for backward compat; prefer requireAnyRole */
function requireRole(role) {
  return requireAnyRole(role);
}

module.exports = {
  requireAuth,
  requirePermission,
  requirePerm,
  requireSuperAdmin,
  requireAnyRole,
  requireRole,
};

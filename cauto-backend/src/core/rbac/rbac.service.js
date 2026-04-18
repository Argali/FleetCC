/**
 * Core RBAC service.
 *
 * Wraps the existing permissions matrix (src/data/permissions.js) behind
 * a clean, testable API:
 *
 *   can(role, module, level) → boolean
 *
 * Level hierarchy (ascending): none < view < edit < full
 *
 * Superadmin is granted access to every module at every level
 * via a short-circuit (mirrors the frontend guard logic).
 * company_admin and fleet_manager also bypass per-module checks.
 */

const perms = require("../../data/permissions");

/** Roles that bypass per-module permission checks */
const BYPASS_ROLES = new Set(["superadmin", "company_admin", "fleet_manager"]);

const rbacService = {
  /**
   * Check whether a role has at least `level` access on `module`.
   *
   * @param {string} role   - e.g. "fleet_manager"
   * @param {string} module - e.g. "gps"
   * @param {string} level  - "view" | "edit" | "full"
   * @returns {boolean}
   */
  can(role, module, level = "view") {
    if (!role) return false;
    if (BYPASS_ROLES.has(role)) return true;

    const userLevel = perms.getLevel(role, module);
    return perms.hasAccess(userLevel, level);
  },

  /**
   * Return the full permissions matrix (used by admin UI).
   */
  getMatrix() {
    return perms.getMatrix();
  },

  /**
   * Overwrite the permissions matrix (superadmin operation).
   * Throws if any role or level is invalid.
   */
  setMatrix(matrix) {
    perms.setMatrix(matrix);
  },

  /** Expose constants for external validation */
  ROLES:   perms.ROLES,
  MODULES: perms.MODULES,
  LEVELS:  perms.LEVELS,
};

module.exports = rbacService;

/**
 * Auth service — legacy shim.
 *
 * All business logic has moved to src/core/auth/auth.service.js.
 * This file re-exports the same API so existing controllers that still
 * import from "../services/authService" continue to work.
 */

module.exports = require("../core/auth/auth.service");

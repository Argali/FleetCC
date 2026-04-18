/**
 * Auth routes.
 *
 * POST /auth/login   — unified login: body { ms_token } or { email, password }
 * GET  /auth/me      — current user profile (requires auth)
 * POST /auth/logout  — stateless logout (requires auth)
 *
 * Legacy aliases kept for clients that haven't updated yet:
 * POST /auth/azure   — same as /auth/login with ms_token (backward compat)
 */

const express         = require("express");
const { requireAuth } = require("../middleware/auth");
const ctrl            = require("../core/auth/auth.controller");

const router = express.Router();

router.post("/login",  ctrl.login);
router.post("/azure",  ctrl.login);    // backward-compat alias (ms_token path)
router.get ("/me",     requireAuth, ctrl.me);
router.post("/logout", requireAuth, ctrl.logout);

module.exports = router;

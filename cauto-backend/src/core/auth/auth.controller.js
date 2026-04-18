/**
 * Core auth controller.
 *
 * Unified login endpoint — auto-detects the login path from the request body:
 *   { ms_token }           → Microsoft SSO flow
 *   { email, password }    → local password flow
 *
 * Routes:
 *   POST /auth/login   — unified login (replaces /auth/azure + /auth/login)
 *   GET  /auth/me      — current user profile
 *   POST /auth/logout  — stateless; client simply discards the token
 */

const authCoreService = require("./auth.service");

const authCoreController = {
  /**
   * POST /auth/login
   * Body: { ms_token } | { email, password }
   */
  async login(req, res, next) {
    try {
      const { ms_token, email, password } = req.body;

      const result = ms_token
        ? await authCoreService.loginWithMicrosoft(ms_token)
        : await authCoreService.loginWithPassword(email, password);

      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /auth/me
   * Requires requireAuth middleware upstream.
   */
  me(req, res) {
    const result = authCoreService.getMe(req.user);
    res.json({ ok: true, ...result });
  },

  /**
   * POST /auth/logout
   * Stateless — the client just drops the token.
   * Kept as an explicit endpoint for future token-blocklist support.
   */
  logout(_req, res) {
    res.json({ ok: true });
  },
};

module.exports = authCoreController;

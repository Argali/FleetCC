const authService = require("../services/authService");

const authController = {
  async login(req, res, next) {
    try {
      const result = await authService.loginWithPassword(req.body.email, req.body.password);
      res.json({ ok: true, ...result });
    } catch (err) { next(err); }
  },

  async azure(req, res, next) {
    try {
      const result = await authService.loginWithAzure(req.body.id_token);
      res.json({ ok: true, ...result });
    } catch (err) { next(err); }
  },

  me(req, res) {
    const result = authService.getMe(req.user);
    res.json({ ok: true, ...result });
  },

  logout(_req, res) {
    res.json({ ok: true });
  },
};

module.exports = authController;

const superadminService = require("../services/superadminService");

const superadminController = {
  getTenants(_req, res, next) {
    try { res.json({ ok: true, data: superadminService.getTenants() }); }
    catch (err) { next(err); }
  },

  updateModules(req, res, next) {
    try {
      const updated = superadminService.updateTenantModules(req.params.id, req.body.modules);
      res.json({ ok: true, data: updated });
    } catch (err) { next(err); }
  },

  updateActive(req, res, next) {
    try {
      const updated = superadminService.updateTenantActive(req.params.id, req.body.active);
      res.json({ ok: true, data: updated });
    } catch (err) { next(err); }
  },

  getAnalytics(_req, res, next) {
    try { res.json({ ok: true, data: superadminService.getAnalytics() }); }
    catch (err) { next(err); }
  },
};

module.exports = superadminController;

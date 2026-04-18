const permissionService = require("../services/permissionService");

const permissionController = {
  get(req, res, next) {
    try { res.json({ ok: true, ...permissionService.getMatrix(req.user.role) }); }
    catch (err) { next(err); }
  },

  patch(req, res, next) {
    try {
      permissionService.setMatrix(req.body.matrix);
      res.json({ ok: true, ...permissionService.getMatrix(req.user.role) });
    } catch (err) { next(err); }
  },
};

module.exports = permissionController;

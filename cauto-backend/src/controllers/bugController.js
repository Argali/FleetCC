const bugService = require("../services/bugService");

const bugController = {
  async create(req, res, next) {
    try {
      const bug = await bugService.create(req.body, req.user);
      res.json({ ok: true, data: bug });
    } catch (err) { next(err); }
  },

  getAll(_req, res, next) {
    try { res.json({ ok: true, data: bugService.getAll() }); }
    catch (err) { next(err); }
  },

  updateStatus(req, res, next) {
    try {
      const bug = bugService.updateStatus(req.params.id, req.body.status);
      res.json({ ok: true, data: bug });
    } catch (err) { next(err); }
  },
};

module.exports = bugController;

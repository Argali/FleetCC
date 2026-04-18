const workshopService = require("../services/workshopService");

const workshopController = {
  getOrders(_req, res, next) {
    try { res.json({ ok: true, data: workshopService.getOrders() }); }
    catch (err) { next(err); }
  },

  updateOrder(req, res, next) {
    try {
      const updated = workshopService.updateOrder(req.params.id, req.body);
      res.json({ ok: true, data: updated });
    } catch (err) { next(err); }
  },
};

module.exports = workshopController;

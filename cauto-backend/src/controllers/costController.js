const costService = require("../services/costService");

const costController = {
  getMonthly(_req, res) { res.json({ ok: true, data: costService.getMonthly() }); },
};

module.exports = costController;

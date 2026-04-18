const fuelService = require("../services/fuelService");

const fuelController = {
  getEntries(_req, res) { res.json({ ok: true, data: fuelService.getEntries() }); },
  getSummary(_req, res) { res.json({ ok: true, data: fuelService.getSummary() }); },
};

module.exports = fuelController;

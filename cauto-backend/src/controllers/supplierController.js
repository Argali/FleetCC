const supplierService = require("../services/supplierService");

const supplierController = {
  getAll(_req, res) { res.json({ ok: true, data: supplierService.getAll() }); },
};

module.exports = supplierController;

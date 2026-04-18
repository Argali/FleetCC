const supplierRepo = require("../repositories/supplierRepository");

const supplierService = {
  getAll: () => supplierRepo.findAll(),
};

module.exports = supplierService;

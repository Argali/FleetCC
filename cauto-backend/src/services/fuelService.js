const fuelRepo = require("../repositories/fuelRepository");

const fuelService = {
  getEntries: () => fuelRepo.findAllEntries(),
  getSummary: () => fuelRepo.getSummary(),
};

module.exports = fuelService;

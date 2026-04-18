const costRepo = require("../repositories/costRepository");

const costService = {
  getMonthly: () => costRepo.findAllMonthly(),
};

module.exports = costService;

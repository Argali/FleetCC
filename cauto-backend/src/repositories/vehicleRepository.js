const adapter = require("../adapters");

const vehicleRepository = {
  findAll: () => adapter.getVehicles(),
};

module.exports = vehicleRepository;

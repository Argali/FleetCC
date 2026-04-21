const adapter = require("../adapters");

const vehicleRepository = {
  findAll: () => adapter.getVehicles(),

  // Extended methods — only available on adapters that support them (e.g. visirun).
  // Return safe defaults when the adapter doesn't implement them.

  getHistory: (plate, date) =>
    typeof adapter.getHistory === "function"
      ? adapter.getHistory(plate, date)
      : Promise.resolve({ waypoints: [], summary: {} }),

  getStops: (plate, startDateTime, endDateTime) =>
    typeof adapter.getStops === "function"
      ? adapter.getStops(plate, startDateTime, endDateTime)
      : Promise.resolve([]),

  getKpi: (date) =>
    typeof adapter.getKpi === "function"
      ? adapter.getKpi(date)
      : Promise.resolve([]),

  getOdometer: () =>
    typeof adapter.getOdometer === "function"
      ? adapter.getOdometer()
      : Promise.resolve([]),
};

module.exports = vehicleRepository;

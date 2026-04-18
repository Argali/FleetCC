const adapter = require("../adapters");

const routeRepository = {
  findAll:  ()           => adapter.getRoutes(),
  create:   (data)       => adapter.createRoute(data),
  update:   (id, data)   => adapter.updateRoute(id, data) || null,
  delete:   (id)         => adapter.deleteRoute(id),          // returns boolean
};

module.exports = routeRepository;

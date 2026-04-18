const store = require("../data/tenants");

const tenantRepository = {
  findAll:         ()            => store.getAllTenants(),
  findById:        (id)          => store.findTenantById(id) || null,
  updateModules:   (id, modules) => store.updateTenantModules(id, modules) || null,
  updateActive:    (id, active)  => store.updateTenantActive(id, active)   || null,
  touch:           (id)          => store.touchTenant(id),
  ALL_MODULES:     store.ALL_MODULES,
};

module.exports = tenantRepository;

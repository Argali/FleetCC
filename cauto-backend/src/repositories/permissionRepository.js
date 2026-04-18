const store = require("../data/permissions");

const permissionRepository = {
  getMatrix:  ()       => store.getMatrix(),
  setMatrix:  (m)      => store.setMatrix(m),   // throws on invalid input
  getLevel:   (role, mod) => store.getLevel(role, mod),
  hasAccess:  (lvl, req)  => store.hasAccess(lvl, req),
  ROLES:    store.ROLES,
  MODULES:  store.MODULES,
  LEVELS:   store.LEVELS,
};

module.exports = permissionRepository;

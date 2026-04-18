const store = require("../data/users");

const userRepository = {
  findAll:       ()       => store.getAllUsers(),
  findById:      (id)     => store.findUserById(id) || null,
  findByEmail:   (email)  => store.findUserByEmail(email) || null,
  create:        (data)   => store.createUser(data),
  update:        (id, u)  => store.updateUser(id, u) || null,
  // Hard delete not supported — deactivate via update(id, { active: false })
};

module.exports = userRepository;

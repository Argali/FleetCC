const bcrypt = require("bcryptjs");

let users = [
  {
    id: "u1",
    name: "Erwan Kervazo",
    email: "erwan.kervazo@cauto.it",
    password_hash: null,
    role: "fleet_manager",
    tenant_id: "cauto",
    active: true,
    auth_provider: "azure",
  },
  {
    id: "u2",
    name: "Erwan Kervazo",
    email: "erwankervazo@gmail.com",
    password_hash: null,
    role: "fleet_manager",
    tenant_id: "cauto",
    active: true,
    auth_provider: "azure",
  },
  {
    id: "u3",
    name: "Officina",
    email: "officina@cauto.it",
    password_hash: bcrypt.hashSync("workshop123", 10),
    role: "responsabile_officina",
    tenant_id: "cauto",
    active: true,
  },
];

let nextId = 3;

module.exports = {
  getAllUsers: () => users,
  findUserByEmail: (email) => users.find(u => u.email === email.toLowerCase().trim()),
  findUserById: (id) => users.find(u => u.id === id),
  createUser: (data) => {
    const user = { id: `u${nextId++}`, ...data };
    users.push(user);
    return user;
  },
  updateUser: (id, updates) => {
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    return users[idx];
  },
};

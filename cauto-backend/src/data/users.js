const bcrypt = require("bcryptjs");

let users = [
  {
    id: "u0",
    name: "Super Admin",
    email: "superadmin@fleetcc.dev",
    password_hash: bcrypt.hashSync("superadmin2024!", 10),
    role: "superadmin",
    tenant_id: "fleetcc",
    active: true,
  },
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
  {
    id: "u4",
    name: "Admin CAUTO",
    email: "admin@cauto.it",
    password_hash: bcrypt.hashSync("admin2024!", 10),
    role: "company_admin",
    tenant_id: "cauto",
    active: true,
  },
];

let nextId = 5;

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

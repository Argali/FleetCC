const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");

// Seed credentials are read from environment variables.
// Set SEED_SUPERADMIN_PASSWORD, SEED_OFFICINA_PASSWORD, SEED_ADMIN_PASSWORD in .env
// Defaults are only used for local development — never deploy without overriding these.
const SEED_SUPERADMIN_PWD = process.env.SEED_SUPERADMIN_PASSWORD || "change_me_superadmin";
const SEED_OFFICINA_PWD   = process.env.SEED_OFFICINA_PASSWORD   || "change_me_officina";
const SEED_ADMIN_PWD      = process.env.SEED_ADMIN_PASSWORD      || "change_me_admin";

let users = [
  {
    id: "u0",
    name: "Super Admin",
    email: process.env.SEED_SUPERADMIN_EMAIL || "superadmin@fleetcc.dev",
    password_hash: bcrypt.hashSync(SEED_SUPERADMIN_PWD, 10),
    role: "superadmin",
    tenant_id: "fleetcc",
    active: true,
  },
  {
    id: "u1",
    name: process.env.SEED_FM1_NAME  || "Fleet Manager 1",
    email: process.env.SEED_FM1_EMAIL || "fm1@cauto.it",
    password_hash: null,
    role: "fleet_manager",
    tenant_id: "cauto",
    active: true,
    auth_provider: "azure",
  },
  {
    id: "u2",
    name: process.env.SEED_FM2_NAME  || "Fleet Manager 2",
    email: process.env.SEED_FM2_EMAIL || "fm2@cauto.it",
    password_hash: null,
    role: "fleet_manager",
    tenant_id: "cauto",
    active: true,
    auth_provider: "azure",
  },
  {
    id: "u3",
    name: "Officina",
    email: process.env.SEED_OFFICINA_EMAIL || "officina@cauto.it",
    password_hash: bcrypt.hashSync(SEED_OFFICINA_PWD, 10),
    role: "responsabile_officina",
    tenant_id: "cauto",
    active: true,
  },
  {
    id: "u4",
    name: "Admin CAUTO",
    email: process.env.SEED_ADMIN_EMAIL || "admin@cauto.it",
    password_hash: bcrypt.hashSync(SEED_ADMIN_PWD, 10),
    role: "company_admin",
    tenant_id: "cauto",
    active: true,
  },
];

module.exports = {
  getAllUsers: () => users,
  findUserByEmail: (email) => users.find(u => u.email === email.toLowerCase().trim()),
  findUserById: (id) => users.find(u => u.id === id),
  createUser: (data) => {
    const user = { id: randomUUID(), ...data };
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

/**
 * Centralized environment configuration.
 * Validates required vars at startup — fail fast, never silently.
 * Import this module early (before any service) so bad config is caught immediately.
 */

const REQUIRED = ["JWT_SECRET"];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`FATAL: required environment variable "${key}" is not set`);
    process.exit(1);
  }
}

const SEED_DEFAULTS = ["change_me_superadmin", "change_me_officina", "change_me_admin"];
["SEED_SUPERADMIN_PASSWORD", "SEED_OFFICINA_PASSWORD", "SEED_ADMIN_PASSWORD"].forEach(key => {
  const val = process.env[key];
  if (!val || SEED_DEFAULTS.includes(val)) {
    console.warn(`[Config] WARNING: ${key} is using an insecure default — change before production`);
  }
});

const env = {
  // Core
  NODE_ENV:       process.env.NODE_ENV       || "development",
  PORT:           parseInt(process.env.PORT  || "3001", 10),

  // JWT
  JWT_SECRET:     process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",

  // Microsoft / MSAL
  MSAL_CLIENT_ID:  process.env.MSAL_CLIENT_ID  || null,
  MSAL_TENANT_ID:  process.env.MSAL_TENANT_ID  || "common",

  // Routing (Valhalla)
  VALHALLA_URL:    process.env.VALHALLA_URL    || "http://localhost:8002",

  // Frontend CORS
  FRONTEND_URL:    process.env.FRONTEND_URL    || null,

  // Seed credentials
  SEED_SUPERADMIN_EMAIL:    process.env.SEED_SUPERADMIN_EMAIL    || "superadmin@fleetcc.dev",
  SEED_SUPERADMIN_PASSWORD: process.env.SEED_SUPERADMIN_PASSWORD || "change_me_superadmin",
  SEED_OFFICINA_EMAIL:      process.env.SEED_OFFICINA_EMAIL      || "officina@cauto.it",
  SEED_OFFICINA_PASSWORD:   process.env.SEED_OFFICINA_PASSWORD   || "change_me_officina",
  SEED_ADMIN_EMAIL:         process.env.SEED_ADMIN_EMAIL         || "admin@cauto.it",
  SEED_ADMIN_PASSWORD:      process.env.SEED_ADMIN_PASSWORD      || "change_me_admin",
};

module.exports = env;

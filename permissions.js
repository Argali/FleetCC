// src/data/permissions.js
// Access levels: "none" | "view" | "edit" | "full"
// Loaded into memory at startup. PATCH /api/permissions updates it live.
// When DB is ready: persist to a permissions table instead.

const ROLES = ["fleet_manager", "responsabile_officina", "coordinatore_officina", "coordinatore_operativo"];
const MODULES = ["gps", "workshop", "fuel", "suppliers", "costs"];
const LEVELS = ["none", "view", "edit", "full"];

// Default matrix — editable from UI
let matrix = {
  fleet_manager: {
    gps:       "full",
    workshop:  "full",
    fuel:      "full",
    suppliers: "full",
    costs:     "full",
    admin:     "full",   // admin panel — always full for fleet_manager
  },
  responsabile_officina: {
    gps:       "view",
    workshop:  "full",
    fuel:      "none",
    suppliers: "view",
    costs:     "none",
    admin:     "none",
  },
  coordinatore_officina: {
    gps:       "view",
    workshop:  "edit",
    fuel:      "none",
    suppliers: "none",
    costs:     "none",
    admin:     "none",
  },
  coordinatore_operativo: {
    gps:       "full",
    workshop:  "view",
    fuel:      "full",
    suppliers: "view",
    costs:     "view",
    admin:     "none",
  },
};

module.exports = {
  ROLES,
  MODULES,
  LEVELS,

  getMatrix: () => matrix,

  getLevel: (role, module) => matrix[role]?.[module] ?? "none",

  setMatrix: (newMatrix) => {
    // Validate before accepting
    for (const role of Object.keys(newMatrix)) {
      if (!ROLES.includes(role)) throw new Error(`Ruolo non valido: ${role}`);
      for (const [mod, level] of Object.entries(newMatrix[role])) {
        if (!LEVELS.includes(level)) throw new Error(`Livello non valido: ${level} per ${mod}`);
      }
    }
    matrix = newMatrix;
    console.log("[Permissions] Matrix updated");
  },

  // Check if a level meets the minimum required
  // e.g. hasAccess("edit", "view") → true (edit >= view)
  hasAccess: (userLevel, requiredLevel) => {
    return LEVELS.indexOf(userLevel) >= LEVELS.indexOf(requiredLevel);
  },
};

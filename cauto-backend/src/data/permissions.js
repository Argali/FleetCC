const ROLES   = ["fleet_manager","responsabile_officina","coordinatore_officina","coordinatore_operativo"];
const MODULES = ["gps","workshop","fuel","suppliers","costs"];
const LEVELS  = ["none","view","edit","full"];

let matrix = {
  fleet_manager:          { gps:"full",  workshop:"full",  fuel:"full",  suppliers:"full",  costs:"full",  admin:"full"  },
  responsabile_officina:  { gps:"view",  workshop:"full",  fuel:"none",  suppliers:"view",  costs:"none",  admin:"none"  },
  coordinatore_officina:  { gps:"view",  workshop:"edit",  fuel:"none",  suppliers:"none",  costs:"none",  admin:"none"  },
  coordinatore_operativo: { gps:"full",  workshop:"view",  fuel:"full",  suppliers:"view",  costs:"view",  admin:"none"  },
};

module.exports = {
  ROLES, MODULES, LEVELS,
  getMatrix:  () => matrix,
  getLevel:   (role, mod) => matrix[role]?.[mod] ?? "none",
  setMatrix:  (m) => {
    for (const role of Object.keys(m)) {
      if (!ROLES.includes(role)) throw new Error(`Ruolo non valido: ${role}`);
      for (const [mod, level] of Object.entries(m[role]))
        if (!LEVELS.includes(level)) throw new Error(`Livello non valido: ${level}`);
    }
    matrix = m;
  },
  hasAccess:  (userLevel, required) => LEVELS.indexOf(userLevel) >= LEVELS.indexOf(required),
};

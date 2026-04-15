const ROLES   = ["superadmin","company_admin","fleet_manager","responsabile_officina","coordinatore_officina","coordinatore_operativo"];
const MODULES = ["gps","navigation","foto_timbrata","cdr","zone","punti","percorsi","pdf_export","workshop","fuel","suppliers","costs"];
const LEVELS  = ["none","view","edit","full"];

let matrix = {
  superadmin:             { gps:"none", navigation:"none", foto_timbrata:"none", cdr:"none", zone:"none", punti:"none", percorsi:"none", pdf_export:"none", workshop:"none", fuel:"none", suppliers:"none", costs:"none", admin:"full"  },
  company_admin:          { gps:"full", navigation:"full", foto_timbrata:"full", cdr:"full", zone:"full", punti:"full", percorsi:"full", pdf_export:"full", workshop:"full", fuel:"full", suppliers:"full", costs:"full", admin:"full"  },
  fleet_manager:          { gps:"full", navigation:"full", foto_timbrata:"full", cdr:"full", zone:"full", punti:"full", percorsi:"full", pdf_export:"full", workshop:"full", fuel:"full", suppliers:"full", costs:"full", admin:"full"  },
  responsabile_officina:  { gps:"view", navigation:"none", foto_timbrata:"none", cdr:"view", zone:"view", punti:"view", percorsi:"view", pdf_export:"none", workshop:"full", fuel:"none", suppliers:"view", costs:"none", admin:"none"  },
  coordinatore_officina:  { gps:"view", navigation:"none", foto_timbrata:"none", cdr:"view", zone:"view", punti:"view", percorsi:"view", pdf_export:"none", workshop:"edit", fuel:"none", suppliers:"none", costs:"none", admin:"none"  },
  coordinatore_operativo: { gps:"full", navigation:"full", foto_timbrata:"full", cdr:"edit", zone:"edit", punti:"edit", percorsi:"edit", pdf_export:"view", workshop:"view", fuel:"full", suppliers:"view", costs:"view", admin:"none"  },
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

const path = require("path");
const fs   = require("fs");

const DATA_FILE = path.join(__dirname, "../../data/segnalazioni_territorio.json");

const VALID_TIPI   = ["mancata_raccolta", "abbandono", "da_pulire", "altro"];
const VALID_STATUS = ["aperta", "in_lavorazione", "chiusa"];

let segnalazioni = [];
let nextId       = 1;
let nextIntId    = 1;

function load() {
  try {
    const raw    = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    segnalazioni = parsed.segnalazioni || [];
    nextId       = parsed.nextId       || 1;
    nextIntId    = parsed.nextIntId    || 1;
  } catch {
    segnalazioni = [];
    nextId       = 1;
    nextIntId    = 1;
  }
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ segnalazioni, nextId, nextIntId }, null, 2));
  } catch (e) {
    console.error("[SegnTerrRepo] persist failed:", e.message);
  }
}

load();

const segnalazioneTerritorioRepository = {
  VALID_TIPI,
  VALID_STATUS,

  findAll() {
    return [...segnalazioni].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  findById(id) {
    return segnalazioni.find(s => s.id === id) || null;
  },

  create(data) {
    const s = { id: `st${nextId++}`, interventions: [], ...data };
    segnalazioni.push(s);
    persist();
    return { ...s };
  },

  updateStatus(id, status) {
    const idx = segnalazioni.findIndex(s => s.id === id);
    if (idx === -1) return null;
    segnalazioni = segnalazioni.map(s => s.id === id ? { ...s, status } : s);
    persist();
    return segnalazioni.find(s => s.id === id);
  },

  addIntervention(id, intervention) {
    const idx = segnalazioni.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const intObj = { id: `int${nextIntId++}`, ...intervention };
    segnalazioni = segnalazioni.map(s => {
      if (s.id !== id) return s;
      const interventions = [...(s.interventions || []), intObj];
      const status = s.status === "aperta" ? "in_lavorazione" : s.status;
      return { ...s, interventions, status };
    });
    persist();
    return segnalazioni.find(s => s.id === id);
  },

  delete(id) {
    const before = segnalazioni.length;
    segnalazioni = segnalazioni.filter(s => s.id !== id);
    if (segnalazioni.length === before) return false;
    persist();
    return true;
  },
};

module.exports = segnalazioneTerritorioRepository;

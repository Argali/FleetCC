let segnalazioni = [];
let nextId = 1;

const VALID_TIPI   = ["guasto", "incidente", "manutenzione"];
const VALID_STATUS = ["aperta", "in_lavorazione", "chiusa"];

const segnalazioneRepository = {
  VALID_TIPI,
  VALID_STATUS,

  findAll() {
    return [...segnalazioni].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  findById(id) {
    return segnalazioni.find(s => s.id === id) || null;
  },

  create(data) {
    const s = { id: `seg${nextId++}`, ...data };
    segnalazioni.push(s);
    return { ...s };
  },

  updateStatus(id, status) {
    const idx = segnalazioni.findIndex(s => s.id === id);
    if (idx === -1) return null;
    segnalazioni = segnalazioni.map(s => s.id === id ? { ...s, status } : s);
    return segnalazioni.find(s => s.id === id);
  },
};

module.exports = segnalazioneRepository;

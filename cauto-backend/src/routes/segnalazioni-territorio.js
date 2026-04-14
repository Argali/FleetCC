const express = require("express");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const VALID_TIPI = ["mancata_raccolta", "abbandono", "da_pulire", "altro"];

let segnalazioni = [];
let nextId = 1;

// GET /api/segnalazioni-territorio
router.get("/", requireAuth, (_req, res) => {
  const sorted = [...segnalazioni].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ ok: true, data: sorted });
});

// POST /api/segnalazioni-territorio
router.post("/", requireAuth, (req, res) => {
  const { tipo, note, address, lat, lng } = req.body;

  if (!tipo || !VALID_TIPI.includes(tipo))
    return res.status(400).json({ ok: false, error: "Tipo non valido" });
  if (!address && (lat == null || lng == null))
    return res.status(400).json({ ok: false, error: "Indirizzo o coordinate obbligatori" });
  if (tipo === "altro" && !note?.trim())
    return res.status(400).json({ ok: false, error: "Nota obbligatoria per tipo 'Altro'" });

  const s = {
    id:            `st${nextId++}`,
    tipo,
    note:          note?.trim() || null,
    address:       address || null,
    lat:           lat != null ? parseFloat(lat) : null,
    lng:           lng != null ? parseFloat(lng) : null,
    status:        "aperta",
    created_by:    req.user.id,
    created_by_name: req.user.name,
    created_at:    new Date().toISOString(),
  };

  segnalazioni.push(s);
  res.status(201).json({ ok: true, data: s });
});

// PATCH /api/segnalazioni-territorio/:id/status
router.patch("/:id/status", requireAuth, (req, res) => {
  const { status } = req.body;
  const valid = ["aperta", "in_lavorazione", "chiusa"];
  if (!valid.includes(status))
    return res.status(400).json({ ok: false, error: "Stato non valido" });

  const s = segnalazioni.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ ok: false, error: "Segnalazione non trovata" });

  s.status = status;
  res.json({ ok: true, data: s });
});

module.exports = router;
module.exports.getData = () => segnalazioni;

const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const VALID_TIPI   = ["mancata_raccolta", "abbandono", "da_pulire", "altro"];
const VALID_STATUS = ["aperta", "in_lavorazione", "chiusa"];

// ── JSON file persistence ──────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, "../../data/segnalazioni_territorio.json");

let segnalazioni = [];
let nextId       = 1;
let nextIntId    = 1;

function loadData() {
  try {
    const raw    = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    segnalazioni = parsed.segnalazioni || [];
    nextId       = parsed.nextId    || 1;
    nextIntId    = parsed.nextIntId || 1;
  } catch {
    segnalazioni = [];
    nextId       = 1;
    nextIntId    = 1;
  }
}

function saveData() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ segnalazioni, nextId, nextIntId }, null, 2));
  } catch (e) {
    console.error("[segnalazioni-territorio] save failed:", e.message);
  }
}

loadData();

// ── Photo upload for interventions ─────────────────────────────────────────────
const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename:    (_req, _file, cb) => {
    const ext  = path.extname(_file.originalname).toLowerCase();
    cb(null, `seg_int_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage:    photoStorage,
  limits:     { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Formato non supportato. Usa JPG, PNG o WEBP."));
  },
});

// ── GET /api/segnalazioni-territorio ──────────────────────────────────────────
router.get("/", requireAuth, (_req, res) => {
  const sorted = [...segnalazioni].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ ok: true, data: sorted });
});

// ── POST /api/segnalazioni-territorio ─────────────────────────────────────────
router.post("/", requireAuth, (req, res) => {
  const { tipo, note, address, lat, lng } = req.body;

  if (!tipo || !VALID_TIPI.includes(tipo))
    return res.status(400).json({ ok: false, error: "Tipo non valido" });
  if (!address && (lat == null || lng == null))
    return res.status(400).json({ ok: false, error: "Indirizzo o coordinate obbligatori" });
  if (tipo === "altro" && !note?.trim())
    return res.status(400).json({ ok: false, error: "Nota obbligatoria per tipo 'Altro'" });

  const s = {
    id:              `st${nextId++}`,
    tipo,
    note:            note?.trim() || null,
    address:         address || null,
    lat:             lat != null ? parseFloat(lat) : null,
    lng:             lng != null ? parseFloat(lng) : null,
    status:          "aperta",
    created_by:      req.user.id,
    created_by_name: req.user.name,
    created_at:      new Date().toISOString(),
    interventions:   [],
  };

  segnalazioni.push(s);
  saveData();
  res.status(201).json({ ok: true, data: s });
});

// ── PATCH /api/segnalazioni-territorio/:id/status ─────────────────────────────
router.patch("/:id/status", requireAuth, (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status))
    return res.status(400).json({ ok: false, error: "Stato non valido" });

  const s = segnalazioni.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ ok: false, error: "Segnalazione non trovata" });

  s.status = status;
  saveData();
  res.json({ ok: true, data: s });
});

// ── POST /api/segnalazioni-territorio/:id/intervento ──────────────────────────
router.post("/:id/intervento", requireAuth, upload.single("photo"), (req, res) => {
  const s = segnalazioni.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ ok: false, error: "Segnalazione non trovata" });

  const { note } = req.body;
  if (!note?.trim() && !req.file)
    return res.status(400).json({ ok: false, error: "Nota o foto obbligatoria" });

  const intervention = {
    id:           `int${nextIntId++}`,
    note:         note?.trim() || null,
    photo_url:    req.file ? `/uploads/${req.file.filename}` : null,
    done_by:      req.user.id,
    done_by_name: req.user.name,
    done_at:      new Date().toISOString(),
  };

  if (!s.interventions) s.interventions = [];
  s.interventions.push(intervention);

  // Auto-advance from "aperta" to "in_lavorazione" on first intervention
  if (s.status === "aperta") s.status = "in_lavorazione";

  saveData();
  res.status(201).json({ ok: true, data: s });
});

// ── DELETE /api/segnalazioni-territorio/:id ───────────────────────────────────
router.delete("/:id", requireAuth, (req, res) => {
  const idx = segnalazioni.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Segnalazione non trovata" });
  segnalazioni.splice(idx, 1);
  saveData();
  res.json({ ok: true });
});

module.exports = router;
module.exports.getData = () => segnalazioni;

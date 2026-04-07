const express = require("express");
const multer  = require("multer");
const path    = require("path");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `seg_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Formato non supportato. Usa JPG, PNG o WEBP."));
  },
});

let segnalazioni = [];
let nextId = 1;

// GET /api/segnalazioni
router.get("/", requireAuth, (req, res) => {
  const sorted = [...segnalazioni].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ ok: true, data: sorted });
});

// POST /api/segnalazioni  (multipart/form-data)
router.post("/", requireAuth, upload.single("photo"), (req, res) => {
  const { reporter_name, settore, vehicle, plate, description, tipo, available_from } = req.body;
  const validTipo = ["guasto", "incidente", "manutenzione"];

  if (!reporter_name || !settore || !vehicle || !description) {
    return res.status(400).json({ ok: false, error: "Campi obbligatori: nome, settore, veicolo, descrizione" });
  }
  if (tipo && !validTipo.includes(tipo)) {
    return res.status(400).json({ ok: false, error: "Tipo non valido" });
  }

  const s = {
    id:             `seg${nextId++}`,
    reporter_name,
    settore,
    vehicle,
    plate:          plate || null,
    description,
    tipo:           tipo || "guasto",
    available_from: available_from || null,
    photo_url:      req.file ? `/uploads/${req.file.filename}` : null,
    status:         "aperta",
    created_by:     req.user.id,
    created_by_name:req.user.name,
    created_at:     new Date().toISOString(),
  };

  segnalazioni.push(s);
  res.status(201).json({ ok: true, data: s });
});

// PATCH /api/segnalazioni/:id/status
router.patch("/:id/status", requireAuth, (req, res) => {
  const { status } = req.body;
  const valid = ["aperta", "in_lavorazione", "chiusa"];
  if (!valid.includes(status)) return res.status(400).json({ ok: false, error: "Stato non valido" });

  const s = segnalazioni.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ ok: false, error: "Segnalazione non trovata" });

  s.status = status;
  res.json({ ok: true, data: s });
});

module.exports = router;
module.exports.getData = () => segnalazioni;

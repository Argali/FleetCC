const path    = require("path");
const multer  = require("multer");
const segnalazioneTerritorioService = require("../services/segnalazioneTerritorioService");

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename:    (_req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase();
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

const segnalazioneTerritorioController = {
  getAll(_req, res, next) {
    try { res.json({ ok: true, data: segnalazioneTerritorioService.getAll() }); }
    catch (err) { next(err); }
  },

  create(req, res, next) {
    try {
      const data = segnalazioneTerritorioService.create(req.body, req.user);
      res.status(201).json({ ok: true, data });
    } catch (err) { next(err); }
  },

  updateStatus(req, res, next) {
    try {
      const updated = segnalazioneTerritorioService.updateStatus(req.params.id, req.body.status);
      res.json({ ok: true, data: updated });
    } catch (err) { next(err); }
  },

  addIntervention: [
    upload.single("photo"),
    (req, res, next) => {
      try {
        const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const updated  = segnalazioneTerritorioService.addIntervention(
          req.params.id,
          { ...req.body, photo_url: photoUrl },
          req.user,
        );
        res.status(201).json({ ok: true, data: updated });
      } catch (err) { next(err); }
    },
  ],

  delete(req, res, next) {
    try {
      segnalazioneTerritorioService.delete(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = segnalazioneTerritorioController;

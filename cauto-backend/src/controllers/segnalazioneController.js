const path    = require("path");
const multer  = require("multer");
const segnalazioneService = require("../services/segnalazioneService");
const { makeCloudinaryStorage, photoUrl } = require("../utils/cloudinary");

const upload = multer({
  storage:    makeCloudinaryStorage("fleetcc/segnalazioni", "seg"),
  limits:     { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Formato non supportato. Usa JPG, PNG o WEBP."));
  },
});

const segnalazioneController = {
  getAll(_req, res, next) {
    try { res.json({ ok: true, data: segnalazioneService.getAll() }); }
    catch (err) { next(err); }
  },

  create: [
    upload.single("photo"),
    (req, res, next) => {
      try {
        const photo_url = req.file ? photoUrl(req.file) : null;
        const data      = segnalazioneService.create({ ...req.body, photo_url }, req.user);
        res.status(201).json({ ok: true, data });
      } catch (err) { next(err); }
    },
  ],

  updateStatus(req, res, next) {
    try {
      const updated = segnalazioneService.updateStatus(req.params.id, req.body.status);
      res.json({ ok: true, data: updated });
    } catch (err) { next(err); }
  },
};

module.exports = segnalazioneController;

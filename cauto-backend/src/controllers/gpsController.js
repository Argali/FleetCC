const path       = require("path");
const multer     = require("multer");
const gpsService = require("../services/gpsService");

// Excel import — memory storage
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
});

// Stamped photo — disk storage
const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename:    (_req, _file, cb) =>
    cb(null, `gps_photo_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`),
});
const photoUpload = multer({ storage: photoStorage, limits: { fileSize: 15 * 1024 * 1024 } });

const gpsController = {
  async getVehicles(req, res, next) {
    try { res.json({ ok: true, data: await gpsService.getVehicles() }); }
    catch (err) { next(err); }
  },

  async getRoutes(req, res, next) {
    try { res.json({ ok: true, data: await gpsService.getRoutes() }); }
    catch (err) { next(err); }
  },

  async createRoute(req, res, next) {
    try {
      const route = await gpsService.createRoute(req.body);
      res.status(201).json({ ok: true, data: route });
    } catch (err) { next(err); }
  },

  async updateRoute(req, res, next) {
    try {
      const route = await gpsService.updateRoute(req.params.id, req.body);
      res.json({ ok: true, data: route });
    } catch (err) { next(err); }
  },

  async deleteRoute(req, res, next) {
    try {
      await gpsService.deleteRoute(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  // Array of middleware — multer + handler
  importExcel: [
    memUpload.single("file"),
    async (req, res, next) => {
      try {
        if (!req.file) { res.status(400).json({ ok: false, error: "Nessun file ricevuto" }); return; }
        const result = await gpsService.importFromExcel(req.file.buffer);
        res.json({ ok: true, data: result });
      } catch (err) {
        if (err.isOperational) {
          res.status(err.status).json({ ok: false, error: err.message, unrecognized: err.unrecognized });
          return;
        }
        next(err);
      }
    },
  ],

  async snapToRoads(req, res, next) {
    try {
      const result = await gpsService.snapToRoads(req.body.waypoints, req.body.costing);
      res.json({ ok: true, data: result });
    } catch (err) {
      // Return as ok:false rather than 5xx for Valhalla unavailability
      if (err.isOperational) { res.status(err.status).json({ ok: false, error: err.message }); return; }
      next(err);
    }
  },

  async navigate(req, res, next) {
    try {
      const result = await gpsService.navigate(req.body.from, req.body.to, req.body.costing);
      res.json({ ok: true, data: result });
    } catch (err) {
      if (err.isOperational) { res.status(err.status).json({ ok: false, error: err.message }); return; }
      next(err);
    }
  },

  // Array of middleware — multer + handler
  uploadPhoto: [
    (req, res, next) =>
      photoUpload.single("photo")(req, res, (err) => {
        if (err) { res.status(500).json({ ok: false, error: err.message || "Errore upload foto" }); return; }
        if (!req.file) { res.status(400).json({ ok: false, error: "Nessuna foto ricevuta" }); return; }
        next();
      }),
    (req, res) => res.status(201).json({ ok: true, url: `/uploads/${req.file.filename}` }),
  ],

  postDriverLocation(req, res, next) {
    try {
      gpsService.setDriverLocation(req.user.id, req.body.lat, req.body.lng, req.user.name);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  deleteDriverLocation(req, res) {
    gpsService.removeDriverLocation(req.user.id);
    res.json({ ok: true });
  },

  getDriverLocations(req, res) {
    res.json({ ok: true, data: gpsService.getActiveDriverLocations(req.user.id) });
  },
};

module.exports = gpsController;

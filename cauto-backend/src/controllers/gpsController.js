const multer     = require("multer");
const gpsService = require("../services/gpsService");
const { makeCloudinaryStorage, photoUrl } = require("../utils/cloudinary");

// Excel import — memory storage (never goes to Cloudinary)
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
});

// Stamped photo — Cloudinary in production, local disk in dev
const photoUpload = multer({
  storage: makeCloudinaryStorage("fleetcc/gps", "gps_photo"),
  limits:  { fileSize: 15 * 1024 * 1024 },
});

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
    (req, res) => res.status(201).json({ ok: true, url: photoUrl(req.file) }),
  ],

  // ── VisiRun extended endpoints ────────────────────────────────────────────

  async getHistory(req, res, next) {
    try {
      const { plate } = req.params;
      const date      = req.query.date || new Date().toISOString().slice(0, 10);
      const data      = await gpsService.getHistory(plate, date);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async getVehicleStops(req, res, next) {
    try {
      const { plate } = req.params;
      const start     = req.query.start;
      const end       = req.query.end;
      if (!start || !end) {
        res.status(400).json({ ok: false, error: "start e end obbligatori (yyyy-mm-dd hh:mm:ss)" });
        return;
      }
      const data = await gpsService.getVehicleStops(plate, start, end);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async getFleetKpi(req, res, next) {
    try {
      const date = req.query.date || new Date().toISOString().slice(0, 10);
      const data = await gpsService.getFleetKpi(date);
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async getFleetOdometer(req, res, next) {
    try {
      const data = await gpsService.getFleetOdometer();
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

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

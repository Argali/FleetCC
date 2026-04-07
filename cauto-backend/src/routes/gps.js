const express = require("express");
const adapter = require("../adapters");
const { requireAuth, requirePerm } = require("../middleware/auth");

const router = express.Router();

router.get("/vehicles", requireAuth, requirePerm("gps", "view"), async (_req, res) => {
  try {
    res.json({ ok: true, data: await adapter.getVehicles() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/routes", requireAuth, requirePerm("gps", "view"), async (_req, res) => {
  try {
    res.json({ ok: true, data: await adapter.getRoutes() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/routes", requireAuth, requirePerm("gps", "edit"), async (req, res) => {
  try {
    const { name, color, sector, vehicle, status, stops, waypoints } = req.body;
    if (!name || !waypoints) return res.status(400).json({ ok: false, error: "name e waypoints obbligatori" });
    const r = await adapter.createRoute({ name, color: color||"#4ade80", sector: sector||"", vehicle: vehicle||"", status: status||"pianificato", stops: stops||0, waypoints });
    res.status(201).json({ ok: true, data: r });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/routes/:id", requireAuth, requirePerm("gps", "edit"), async (req, res) => {
  try {
    const r = await adapter.updateRoute(req.params.id, req.body);
    if (!r) return res.status(404).json({ ok: false, error: "Percorso non trovato" });
    res.json({ ok: true, data: r });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete("/routes/:id", requireAuth, requirePerm("gps", "edit"), async (req, res) => {
  try {
    const ok = await adapter.deleteRoute(req.params.id);
    if (!ok) return res.status(404).json({ ok: false, error: "Percorso non trovato" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

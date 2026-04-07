// src/routes/permissions.js
const express = require("express");
const { getMatrix, setMatrix, ROLES, MODULES, LEVELS } = require("../data/permissions");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/permissions — returns full matrix + metadata (all roles can read their own access)
router.get("/", requireAuth, (req, res) => {
  res.json({
    ok: true,
    matrix: getMatrix(),
    roles: ROLES,
    modules: MODULES,
    levels: LEVELS,
    // Also return the current user's own access levels
    my_access: getMatrix()[req.user.role] || {},
  });
});

// PATCH /api/permissions — replace full matrix (fleet_manager only)
router.patch("/", requireAuth, requireRole("fleet_manager"), (req, res) => {
  const { matrix } = req.body;
  if (!matrix) return res.status(400).json({ ok: false, error: "Campo 'matrix' richiesto" });
  try {
    setMatrix(matrix);
    res.json({ ok: true, matrix: getMatrix() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;

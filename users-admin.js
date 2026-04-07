// src/routes/users-admin.js
// Full user management — only fleet_manager can access these routes
const express = require("express");
const bcrypt  = require("bcryptjs");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ROLES } = require("../data/permissions");

const router = express.Router();

// In-memory store — same pattern as users.js, replace with DB later
// We import and mutate the USERS array from users.js
const usersStore = require("../data/users");

// GET /api/admin/users
router.get("/users", requireAuth, requireRole("fleet_manager"), (req, res) => {
  const users = usersStore.getAllUsers().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    tenant_id: u.tenant_id,
    active: u.active,
  }));
  res.json({ ok: true, data: users });
});

// POST /api/admin/users — create user
router.post("/users", requireAuth, requireRole("fleet_manager"), (req, res) => {
  const { name, email, password, role, tenant_id } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ ok: false, error: "Campi obbligatori: name, email, password, role" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: `Ruolo non valido. Validi: ${ROLES.join(", ")}` });
  }
  if (usersStore.findUserByEmail(email)) {
    return res.status(409).json({ ok: false, error: "Email già in uso" });
  }

  const newUser = usersStore.createUser({
    name,
    email: email.toLowerCase().trim(),
    password_hash: bcrypt.hashSync(password, 10),
    role,
    tenant_id: tenant_id || req.tenant.id,
    active: true,
  });

  res.status(201).json({
    ok: true,
    data: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, active: newUser.active },
  });
});

// PATCH /api/admin/users/:id — update user (name, role, active, password)
router.patch("/users/:id", requireAuth, requireRole("fleet_manager"), (req, res) => {
  const { name, role, active, password } = req.body;

  if (role && !ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: `Ruolo non valido: ${role}` });
  }

  const updates = {};
  if (name     !== undefined) updates.name    = name;
  if (role     !== undefined) updates.role    = role;
  if (active   !== undefined) updates.active  = active;
  if (password !== undefined) updates.password_hash = bcrypt.hashSync(password, 10);

  const updated = usersStore.updateUser(req.params.id, updates);
  if (!updated) return res.status(404).json({ ok: false, error: "Utente non trovato" });

  res.json({
    ok: true,
    data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, active: updated.active },
  });
});

// DELETE /api/admin/users/:id — deactivate (not hard delete)
router.delete("/users/:id", requireAuth, requireRole("fleet_manager"), (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ ok: false, error: "Non puoi disattivare il tuo stesso account" });
  }
  const updated = usersStore.updateUser(req.params.id, { active: false });
  if (!updated) return res.status(404).json({ ok: false, error: "Utente non trovato" });
  res.json({ ok: true });
});

module.exports = router;

const express = require("express");
const bcrypt  = require("bcryptjs");
const { requireAuth, requireAnyRole } = require("../middleware/auth");
const { ROLES } = require("../data/permissions");
const usersStore = require("../data/users");

const router = express.Router();

// Roles that may NOT be assigned by company_admin (only superadmin can create these)
const SUPER_ONLY_ROLES = ["superadmin", "company_admin"];

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get("/users", requireAuth, requireAnyRole("fleet_manager", "company_admin", "superadmin"), (req, res) => {
  let users = usersStore.getAllUsers();

  // company_admin sees only their own tenant; fleet_manager also sees only own tenant
  // superadmin sees all tenants
  if (req.user.role !== "superadmin") {
    users = users.filter(u => u.tenant_id === req.tenant.id);
  }

  res.json({
    ok: true,
    data: users.map(u => ({
      id: u.id, name: u.name, email: u.email,
      role: u.role, tenant_id: u.tenant_id, active: u.active,
    })),
  });
});

// ── POST /api/admin/users ─────────────────────────────────────────────────────
router.post("/users", requireAuth, requireAnyRole("fleet_manager", "company_admin", "superadmin"), (req, res) => {
  const { name, email, password, role, tenant_id } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ ok: false, error: "Campi obbligatori: name, email, password, role" });
  if (!ROLES.includes(role))
    return res.status(400).json({ ok: false, error: "Ruolo non valido" });

  // Only superadmin can assign superadmin or company_admin roles
  if (req.user.role !== "superadmin" && SUPER_ONLY_ROLES.includes(role))
    return res.status(403).json({ ok: false, error: "Non puoi assegnare questo ruolo" });

  if (usersStore.findUserByEmail(email))
    return res.status(409).json({ ok: false, error: "Email già in uso" });

  // company_admin can only create users in their own tenant
  const assignedTenant = req.user.role === "superadmin"
    ? (tenant_id || req.tenant.id)
    : req.tenant.id;

  const newUser = usersStore.createUser({
    name,
    email: email.toLowerCase().trim(),
    password_hash: bcrypt.hashSync(password, 10),
    role,
    tenant_id: assignedTenant,
    active: true,
  });

  res.status(201).json({
    ok: true,
    data: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, active: newUser.active },
  });
});

// ── PATCH /api/admin/users/:id ────────────────────────────────────────────────
router.patch("/users/:id", requireAuth, requireAnyRole("fleet_manager", "company_admin", "superadmin"), (req, res) => {
  const target = usersStore.findUserById(req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: "Utente non trovato" });

  // Tenant boundary: non-superadmin can only edit users in their own tenant
  if (req.user.role !== "superadmin" && target.tenant_id !== req.tenant.id)
    return res.status(403).json({ ok: false, error: "Accesso negato" });

  const { name, role, active, password } = req.body;
  if (role && !ROLES.includes(role))
    return res.status(400).json({ ok: false, error: `Ruolo non valido: ${role}` });

  // Only superadmin can promote to superadmin/company_admin
  if (req.user.role !== "superadmin" && role && SUPER_ONLY_ROLES.includes(role))
    return res.status(403).json({ ok: false, error: "Non puoi assegnare questo ruolo" });

  const updates = {};
  if (name     !== undefined) updates.name          = name;
  if (role     !== undefined) updates.role          = role;
  if (active   !== undefined) updates.active        = active;
  if (password !== undefined) updates.password_hash = bcrypt.hashSync(password, 10);

  const updated = usersStore.updateUser(req.params.id, updates);
  res.json({ ok: true, data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, active: updated.active } });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete("/users/:id", requireAuth, requireAnyRole("fleet_manager", "company_admin", "superadmin"), (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ ok: false, error: "Non puoi disattivare il tuo stesso account" });

  const target = usersStore.findUserById(req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: "Utente non trovato" });

  if (req.user.role !== "superadmin" && target.tenant_id !== req.tenant.id)
    return res.status(403).json({ ok: false, error: "Accesso negato" });

  const updated = usersStore.updateUser(req.params.id, { active: false });
  res.json({ ok: true });
});

module.exports = router;

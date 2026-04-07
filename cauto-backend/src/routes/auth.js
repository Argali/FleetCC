const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const users   = require("../data/users");
const { requireAuth } = require("../middleware/auth");
const { verifyAzureToken } = require("../middleware/azureAuth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ ok: false, error: "Email e password richiesti" });

  const user = users.findUserByEmail(email);
  if (!user || !user.active)
    return res.status(401).json({ ok: false, error: "Credenziali non valide" });

  if (!bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ ok: false, error: "Credenziali non valide" });

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });

  res.json({
    ok: true,
    token,
    user:   { id: user.id, name: user.name, email: user.email, role: user.role },
    tenant: { id: user.tenant_id },
  });
});

// POST /api/auth/azure — validate Microsoft ID token, return our JWT
router.post("/azure", async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) return res.status(400).json({ ok: false, error: "id_token mancante" });

  let claims;
  try {
    claims = await verifyAzureToken(id_token);
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Token Microsoft non valido" });
  }

  // preferred_username is the UPN (email), fall back to email claim
  const email = (claims.preferred_username || claims.email || "").toLowerCase().trim();
  const name  = claims.name || email;

  if (!email) return res.status(401).json({ ok: false, error: "Impossibile leggere l'email dall'account Microsoft" });

  // Find existing user or auto-create with default role
  let user = users.findUserByEmail(email);
  if (!user) {
    user = users.createUser({
      name,
      email,
      password_hash: null,       // no password — Azure handles auth
      role:          "coordinatore_operativo",
      tenant_id:     "cauto",
      active:        true,
      auth_provider: "azure",
    });
    console.log(`[Auth] Nuovo utente Azure creato: ${email} (ruolo default: coordinatore_operativo)`);
  }

  if (!user.active) return res.status(403).json({ ok: false, error: "Account disattivato" });

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });

  res.json({
    ok: true,
    token,
    user:   { id: user.id, name: user.name, email: user.email, role: user.role },
    tenant: { id: user.tenant_id },
  });
});

router.get("/me", requireAuth, (req, res) => {
  const u = req.user;
  res.json({ ok: true, user: { id: u.id, name: u.name, email: u.email, role: u.role }, tenant: { id: u.tenant_id } });
});

router.post("/logout", requireAuth, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;

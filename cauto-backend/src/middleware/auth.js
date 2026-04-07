const jwt    = require("jsonwebtoken");
const users  = require("../data/users");
const perms  = require("../data/permissions");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Token mancante" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = users.findUserById(payload.sub);
    if (!user || !user.active) return res.status(401).json({ ok: false, error: "Sessione non valida" });
    req.user   = user;
    req.tenant = { id: user.tenant_id };
    next();
  } catch {
    res.status(401).json({ ok: false, error: "Token scaduto o non valido" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role)
      return res.status(403).json({ ok: false, error: "Accesso negato" });
    next();
  };
}

function requirePerm(module, level = "view") {
  return (req, res, next) => {
    const userLevel = perms.getLevel(req.user?.role, module);
    if (!perms.hasAccess(userLevel, level))
      return res.status(403).json({ ok: false, error: "Permesso insufficiente" });
    next();
  };
}

module.exports = { requireAuth, requireRole, requirePerm };

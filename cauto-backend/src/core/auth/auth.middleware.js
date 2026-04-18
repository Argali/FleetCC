/**
 * Core authentication middleware.
 *
 * Reads the internal JWT from the Authorization header, verifies it,
 * loads the user record, and attaches to req:
 *   req.user   — full user object from the store
 *   req.tenant — { id: string } (= user.tenant_id, for multi-tenant scoping)
 *
 * Supports both old token shape { sub, role } and new shape { userId, clientId, role }
 * so that existing sessions survive the migration.
 */

const { AppError }  = require("../../middleware/errorHandler");
const jwtService    = require("./jwt.service");
const userRepo      = require("../../repositories/userRepository");

/**
 * requireAuth — protects any route that needs an authenticated session.
 * Attaches req.user and req.tenant on success; sends 401 on failure.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ ok: false, error: "Token mancante" });

  let payload;
  try {
    payload = jwtService.verify(token);
  } catch (err) {
    // jwtService.verify already throws AppError — convert to response
    return res.status(err.status || 401).json({ ok: false, error: err.message });
  }

  // New shape: { userId, clientId, role }  |  Legacy shape: { sub, role }
  const userId = payload.userId || payload.sub;
  if (!userId) return res.status(401).json({ ok: false, error: "Token non valido" });

  const user = userRepo.findById(userId);
  if (!user || !user.active) {
    return res.status(401).json({ ok: false, error: "Sessione non valida" });
  }

  req.user   = user;
  req.tenant = { id: payload.clientId || user.tenant_id };
  next();
}

module.exports = { requireAuth };

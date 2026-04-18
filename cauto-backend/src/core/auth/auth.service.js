/**
 * Core auth service.
 *
 * Handles two login paths:
 *   1. Microsoft (MSAL) — validates ms_token via JWKS, upserts user, returns internal JWT
 *   2. Password       — bcrypt compare, returns internal JWT
 *
 * Both paths return the same shape:
 *   { token: string, user: PublicUser, tenant: { id: string } }
 *
 * Internal JWTs carry { userId, clientId, role, sub } — see jwt.service.js.
 */

const bcrypt             = require("bcryptjs");
const { AppError }       = require("../../middleware/errorHandler");
const jwtService         = require("./jwt.service");
const { validateMsalToken } = require("./msal.validator");
const userRepo           = require("../../repositories/userRepository");

/** Fields safe to return to the client */
function publicUser(user) {
  return {
    id:       user.id,
    name:     user.name,
    email:    user.email,
    role:     user.role,
    tenantId: user.tenant_id,
  };
}

/**
 * Upsert a user identified by email.
 * If the user doesn't exist yet, they are created with a default role
 * under the specified tenant (defaults to "cauto" for Azure SSO users).
 */
function findOrCreateUser({ email, name, tenantId = "cauto" }) {
  let user = userRepo.findByEmail(email);
  if (!user) {
    user = userRepo.create({
      name,
      email,
      password_hash: null,
      role:          "coordinatore_operativo",
      tenant_id:     tenantId,
      active:        true,
      auth_provider: "azure",
    });
    console.log(`[Auth] New Azure user provisioned: ${email} (tenant: ${tenantId})`);
  }
  return user;
}

const authCoreService = {
  /**
   * Sign in with a Microsoft MSAL id_token or access_token.
   * Validates the token via JWKS, upserts the user, returns internal JWT.
   */
  async loginWithMicrosoft(msToken) {
    if (!msToken) throw new AppError("ms_token mancante", 400);

    const claims = await validateMsalToken(msToken); // throws AppError(401) on failure

    const email = (
      claims.preferred_username ||
      claims.upn               ||
      claims.email             ||
      ""
    ).toLowerCase().trim();

    if (!email) throw new AppError("Impossibile leggere l'email dal token Microsoft", 401);

    const name = claims.name || email;
    const user = findOrCreateUser({ email, name });

    if (!user.active) throw new AppError("Account disattivato", 403);

    const token = jwtService.sign(user);
    return { token, user: publicUser(user), tenant: { id: user.tenant_id } };
  },

  /**
   * Sign in with email + password (local accounts — superadmin etc.).
   */
  async loginWithPassword(email, password) {
    if (!email || !password) throw new AppError("Email e password richiesti", 400);

    const user = userRepo.findByEmail(email);
    if (!user || !user.active) throw new AppError("Credenziali non valide", 401);
    if (!user.password_hash)   throw new AppError("Credenziali non valide", 401);

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) throw new AppError("Credenziali non valide", 401);

    const token = jwtService.sign(user);
    return { token, user: publicUser(user), tenant: { id: user.tenant_id } };
  },

  /**
   * Return the public profile of the authenticated user.
   * `user` is the full record attached by requireAuth.
   */
  getMe(user) {
    return { user: publicUser(user), tenant: { id: user.tenant_id } };
  },
};

module.exports = authCoreService;

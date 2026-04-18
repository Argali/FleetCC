/**
 * Internal JWT service.
 *
 * Payload shape (all APIs rely on this contract):
 *   { userId, clientId, role, sub }
 *
 * - userId  : internal user ID
 * - clientId: tenant ID (used for multi-tenant data isolation)
 * - role    : user role string
 * - sub     : same as userId (standard JWT claim, kept for compatibility)
 *
 * Never accept a Microsoft token here — those are validated separately
 * by msal.validator.js and then exchanged for one of these.
 */

const jwt = require("jsonwebtoken");
const { AppError } = require("../../middleware/errorHandler");
const env = require("../config/env");

const jwtService = {
  /**
   * Sign an internal JWT for a user record.
   * @param {{ id: string, tenant_id: string, role: string }} user
   * @returns {string} signed token
   */
  sign(user) {
    return jwt.sign(
      {
        userId:   user.id,
        clientId: user.tenant_id,
        role:     user.role,
        sub:      user.id,         // standard claim, kept for compat
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );
  },

  /**
   * Verify and decode an internal JWT.
   * Throws AppError(401) if invalid or expired.
   * @param {string} token
   * @returns {{ userId: string, clientId: string, role: string, sub: string }}
   */
  verify(token) {
    try {
      return jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      throw new AppError(
        err.name === "TokenExpiredError" ? "Token scaduto" : "Token non valido",
        401,
      );
    }
  },
};

module.exports = jwtService;

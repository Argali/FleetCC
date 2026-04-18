/**
 * Microsoft MSAL token validator.
 *
 * Validates an ID token or access token issued by Microsoft Identity Platform:
 *   - Signature verified against JWKS endpoint
 *   - Audience checked against MSAL_CLIENT_ID (if configured)
 *   - Issuer checked (any valid Microsoft tenant)
 *   - Expiration enforced by jsonwebtoken
 *
 * Returns decoded claims on success, throws on any failure.
 */

const jwksClient = require("jwks-rsa");
const jwt        = require("jsonwebtoken");
const { AppError } = require("../../middleware/errorHandler");
const env = require("../config/env");

const JWKS_URI = "https://login.microsoftonline.com/common/discovery/v2.0/keys";

// Lazy-init — client is reused across requests
let _client = null;
function getClient() {
  if (!_client) {
    _client = jwksClient({
      jwksUri:             JWKS_URI,
      cache:               true,
      cacheMaxEntries:     10,
      cacheMaxAge:         10 * 60 * 1000, // 10 min
      rateLimit:           true,
      jwksRequestsPerMinute: 10,
    });
  }
  return _client;
}

function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    getClient().getSigningKey(header.kid, (err, key) => {
      if (err) reject(err);
      else resolve(key.getPublicKey());
    });
  });
}

/**
 * Validate a Microsoft-issued token.
 * @param {string} token  - Microsoft ID token or access token
 * @returns {Promise<object>} decoded claims
 * @throws {AppError} 401 on any validation failure
 */
async function validateMsalToken(token) {
  if (!token) throw new AppError("Token Microsoft mancante", 401);

  // Decode header to get kid, then fetch signing key
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded) throw new AppError("Token Microsoft non decodificabile", 401);

  let signingKey;
  try {
    signingKey = await getSigningKey(decoded.header);
  } catch {
    throw new AppError("Impossibile recuperare la chiave JWKS", 401);
  }

  // Valid issuers: v1 and v2 endpoints for any tenant
  const issuerPattern = /^https:\/\/login\.microsoftonline\.com\/[^/]+\/(v2\.0\/?)?$/;

  const verifyOptions = {
    algorithms: ["RS256"],
  };

  // Only validate audience if CLIENT_ID is configured
  if (env.MSAL_CLIENT_ID) {
    verifyOptions.audience = env.MSAL_CLIENT_ID;
  }

  let claims;
  try {
    claims = jwt.verify(token, signingKey, verifyOptions);
  } catch (err) {
    throw new AppError(
      err.name === "TokenExpiredError"
        ? "Token Microsoft scaduto"
        : `Token Microsoft non valido: ${err.message}`,
      401,
    );
  }

  // Verify issuer pattern
  if (claims.iss && !issuerPattern.test(claims.iss)) {
    throw new AppError("Issuer Microsoft non valido", 401);
  }

  return claims;
}

module.exports = { validateMsalToken };

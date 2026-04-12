const jwksRsa = require("jwks-rsa");
const jwt    = require("jsonwebtoken");

const CLIENT_ID = "3c3b2922-0d6c-4f87-a769-55607b3e981e";
const TENANT_ID = "65e803c0-672a-4162-85a7-e1a402843bd2";

// Personal Microsoft accounts use a fixed tenant ID
const MSA_TENANT_ID = "9188040d-6c67-4c5b-b112-36a304b66dad";

const VALID_ISSUERS = [
  `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
  `https://login.microsoftonline.com/${MSA_TENANT_ID}/v2.0`,
];

// common endpoint covers both work and personal accounts
const jwksClient = jwksRsa({
  jwksUri:   "https://login.microsoftonline.com/common/discovery/v2.0/keys",
  cache:     true,
  rateLimit: true,
});

function getSigningKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyAzureToken(idToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getSigningKey,
      {
        audience:   CLIENT_ID,
        issuer:     VALID_ISSUERS,
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

module.exports = { verifyAzureToken };

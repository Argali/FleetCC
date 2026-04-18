const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { AppError } = require("../middleware/errorHandler");
const userRepo     = require("../repositories/userRepository");
const { verifyAzureToken } = require("../middleware/azureAuth");

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

const authService = {
  async loginWithPassword(email, password) {
    if (!email || !password) throw new AppError("Email e password richiesti", 400);
    const user = userRepo.findByEmail(email);
    if (!user || !user.active) throw new AppError("Credenziali non valide", 401);
    if (!bcrypt.compareSync(password, user.password_hash)) throw new AppError("Credenziali non valide", 401);
    const token = signToken(user);
    return { token, user: publicUser(user), tenant: { id: user.tenant_id } };
  },

  async loginWithAzure(idToken) {
    if (!idToken) throw new AppError("id_token mancante", 400);
    let claims;
    try {
      claims = await verifyAzureToken(idToken);
    } catch {
      throw new AppError("Token Microsoft non valido", 401);
    }
    const email = (claims.preferred_username || claims.email || "").toLowerCase().trim();
    const name  = claims.name || email;
    if (!email) throw new AppError("Impossibile leggere l'email dall'account Microsoft", 401);

    let user = userRepo.findByEmail(email);
    if (!user) {
      user = userRepo.create({ name, email, password_hash: null, role: "coordinatore_operativo", tenant_id: "cauto", active: true, auth_provider: "azure" });
      console.log(`[Auth] Nuovo utente Azure: ${email}`);
    }
    if (!user.active) throw new AppError("Account disattivato", 403);
    const token = signToken(user);
    return { token, user: publicUser(user), tenant: { id: user.tenant_id } };
  },

  getMe(user) {
    return { user: publicUser(user), tenant: { id: user.tenant_id } };
  },
};

module.exports = authService;

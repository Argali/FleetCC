const bcrypt       = require("bcryptjs");
const { AppError } = require("../middleware/errorHandler");
const userRepo     = require("../repositories/userRepository");
const permRepo     = require("../repositories/permissionRepository");

const SUPER_ONLY_ROLES = ["superadmin", "company_admin"];

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, tenant_id: u.tenant_id, active: u.active };
}

const userService = {
  listUsers(callerRole, callerTenantId) {
    const all = userRepo.findAll();
    const list = callerRole === "superadmin" ? all : all.filter(u => u.tenant_id === callerTenantId);
    return list.map(publicUser);
  },

  createUser({ name, email, password, role, tenant_id }, caller) {
    if (!name || !email || !password || !role)
      throw new AppError("Campi obbligatori: name, email, password, role", 400);
    if (!permRepo.ROLES.includes(role))
      throw new AppError("Ruolo non valido", 400);
    if (caller.role !== "superadmin" && SUPER_ONLY_ROLES.includes(role))
      throw new AppError("Non puoi assegnare questo ruolo", 403);
    if (userRepo.findByEmail(email))
      throw new AppError("Email già in uso", 409);

    const assignedTenant = caller.role === "superadmin" ? (tenant_id || caller.tenant_id) : caller.tenant_id;
    const created = userRepo.create({
      name,
      email:         email.toLowerCase().trim(),
      password_hash: bcrypt.hashSync(password, 10),
      role,
      tenant_id:     assignedTenant,
      active:        true,
    });
    return publicUser(created);
  },

  updateUser(id, { name, role, active, password }, caller) {
    const target = userRepo.findById(id);
    if (!target) throw new AppError("Utente non trovato", 404);
    if (caller.role !== "superadmin" && target.tenant_id !== caller.tenant_id)
      throw new AppError("Accesso negato", 403);
    if (role && !permRepo.ROLES.includes(role))
      throw new AppError(`Ruolo non valido: ${role}`, 400);
    if (caller.role !== "superadmin" && role && SUPER_ONLY_ROLES.includes(role))
      throw new AppError("Non puoi assegnare questo ruolo", 403);

    const updates = {};
    if (name     !== undefined) updates.name          = name;
    if (role     !== undefined) updates.role          = role;
    if (active   !== undefined) updates.active        = active;
    if (password !== undefined) updates.password_hash = bcrypt.hashSync(password, 10);

    const updated = userRepo.update(id, updates);
    return publicUser(updated);
  },

  deactivateUser(id, caller) {
    if (id === caller.id) throw new AppError("Non puoi disattivare il tuo stesso account", 400);
    const target = userRepo.findById(id);
    if (!target) throw new AppError("Utente non trovato", 404);
    if (caller.role !== "superadmin" && target.tenant_id !== caller.tenant_id)
      throw new AppError("Accesso negato", 403);
    userRepo.update(id, { active: false });
  },
};

module.exports = userService;

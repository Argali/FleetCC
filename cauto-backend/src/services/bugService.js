const { AppError }           = require("../middleware/errorHandler");
const bugRepo                = require("../repositories/bugRepository");
const { sendBugReportEmail } = require("../utils/mailer");

const VALID_CATEGORIES = ["ui", "funzionalita", "performance", "errore", "altro"];
const VALID_STATUSES   = ["new", "in_progress", "resolved", "wontfix"];

const bugService = {
  async create({ title, category, description, steps }, user) {
    if (!title?.trim())       throw new AppError("Titolo obbligatorio", 400);
    if (!description?.trim()) throw new AppError("Descrizione obbligatoria", 400);

    const bug = bugRepo.create({
      title:       title.trim(),
      category:    VALID_CATEGORIES.includes(category) ? category : "altro",
      description: description.trim(),
      steps:       steps?.trim() || "",
      reportedBy:  { id: user.id, name: user.name, email: user.email },
      tenantId:    user.tenant_id,
    });

    // Fire-and-forget — email failure must not fail the request
    sendBugReportEmail({ bug, reporterName: user.name, reporterEmail: user.email })
      .catch(err => console.error("[Mailer] Bug email failed:", err.message));

    return bug;
  },

  getAll() {
    return bugRepo.findAll();
  },

  updateStatus(id, status) {
    if (!VALID_STATUSES.includes(status))
      throw new AppError("Status non valido", 400);
    const bug = bugRepo.updateStatus(id, status);
    if (!bug) throw new AppError("Bug non trovato", 404);
    return bug;
  },
};

module.exports = bugService;

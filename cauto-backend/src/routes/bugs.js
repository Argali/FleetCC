const express = require("express");
const bugsData = require("../data/bugs");
const { requireAuth, requireSuperAdmin } = require("../middleware/auth");
const { sendBugReportEmail } = require("../utils/mailer");

const router = express.Router();

const VALID_CATEGORIES = ["ui", "funzionalita", "performance", "errore", "altro"];
const VALID_STATUSES   = ["new", "in_progress", "resolved", "wontfix"];

// POST /api/bugs — any authenticated user can submit
router.post("/", requireAuth, async (req, res) => {
  const { title, category, description, steps } = req.body;
  if (!title?.trim())       return res.status(400).json({ ok: false, error: "Titolo obbligatorio" });
  if (!description?.trim()) return res.status(400).json({ ok: false, error: "Descrizione obbligatoria" });

  const bug = bugsData.create({
    title:       title.trim(),
    category:    VALID_CATEGORIES.includes(category) ? category : "altro",
    description: description.trim(),
    steps:       steps?.trim() || "",
    reportedBy:  { id: req.user.id, name: req.user.name, email: req.user.email },
    tenantId:    req.user.tenant_id,
  });

  // Fire-and-forget — email failure must not fail the request
  sendBugReportEmail({ bug, reporterName: req.user.name, reporterEmail: req.user.email })
    .catch(err => console.error("[Mailer] Bug email failed:", err.message));

  res.json({ ok: true, data: bug });
});

// GET /api/bugs — superadmin only
router.get("/", requireAuth, requireSuperAdmin, (_req, res) => {
  res.json({ ok: true, data: bugsData.getAll() });
});

// PATCH /api/bugs/:id — superadmin only, update status
router.patch("/:id", requireAuth, requireSuperAdmin, (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status))
    return res.status(400).json({ ok: false, error: "Status non valido" });
  const bug = bugsData.updateStatus(req.params.id, status);
  if (!bug) return res.status(404).json({ ok: false, error: "Bug non trovato" });
  res.json({ ok: true, data: bug });
});

module.exports = router;

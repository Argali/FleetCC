const express         = require("express");
const { requireAuth } = require("../middleware/auth");
const ctrl            = require("../controllers/segnalazioneTerritorioController");

const router = express.Router();

router.get   ("/",               requireAuth, ctrl.getAll);
router.post  ("/",               requireAuth, ctrl.create);
router.patch ("/:id/status",     requireAuth, ctrl.updateStatus);
router.post  ("/:id/intervento", requireAuth, ctrl.addIntervention);
router.delete("/:id",            requireAuth, ctrl.delete);

module.exports = router;

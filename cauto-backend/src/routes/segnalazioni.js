const express         = require("express");
const { requireAuth } = require("../middleware/auth");
const ctrl            = require("../controllers/segnalazioneController");

const router = express.Router();

router.get  ("/",           requireAuth, ctrl.getAll);
router.post ("/",           requireAuth, ctrl.create);
router.patch("/:id/status", requireAuth, ctrl.updateStatus);

module.exports = router;

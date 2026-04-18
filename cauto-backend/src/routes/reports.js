const express         = require("express");
const { requireAuth } = require("../middleware/auth");
const ctrl            = require("../controllers/reportController");

const router = express.Router();

router.get("/segnalazioni", requireAuth, ctrl.segnalazioni);
router.get("/fuel",         requireAuth, ctrl.fuel);
router.get("/workshop",     requireAuth, ctrl.workshop);
router.get("/fleet",        requireAuth, ctrl.fleet);

module.exports = router;

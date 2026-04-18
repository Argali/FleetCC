const express                        = require("express");
const { requireAuth, requireRole }   = require("../middleware/auth");
const ctrl                           = require("../controllers/permissionController");

const router = express.Router();

router.get  ("/", requireAuth,                              ctrl.get);
router.patch("/", requireAuth, requireRole("fleet_manager"), ctrl.patch);

module.exports = router;

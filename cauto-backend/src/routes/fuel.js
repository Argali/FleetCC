const express                      = require("express");
const { requireAuth, requirePerm } = require("../middleware/auth");
const ctrl                         = require("../controllers/fuelController");

const router = express.Router();

router.get("/entries", requireAuth, requirePerm("fuel", "view"), ctrl.getEntries);
router.get("/summary", requireAuth, requirePerm("fuel", "view"), ctrl.getSummary);

module.exports = router;

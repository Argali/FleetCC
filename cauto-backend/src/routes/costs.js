const express                      = require("express");
const { requireAuth, requirePerm } = require("../middleware/auth");
const ctrl                         = require("../controllers/costController");

const router = express.Router();

router.get("/monthly", requireAuth, requirePerm("costs", "view"), ctrl.getMonthly);

module.exports = router;

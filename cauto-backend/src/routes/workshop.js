const express                      = require("express");
const { requireAuth, requirePerm } = require("../middleware/auth");
const ctrl                         = require("../controllers/workshopController");

const router = express.Router();

router.get  ("/orders",     requireAuth, requirePerm("workshop", "view"), ctrl.getOrders);
router.patch("/orders/:id", requireAuth, requirePerm("workshop", "edit"), ctrl.updateOrder);

module.exports = router;

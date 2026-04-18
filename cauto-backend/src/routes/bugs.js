const express                          = require("express");
const { requireAuth, requireSuperAdmin } = require("../middleware/auth");
const ctrl                             = require("../controllers/bugController");

const router = express.Router();

router.post  ("/",    requireAuth,                    ctrl.create);
router.get   ("/",    requireAuth, requireSuperAdmin, ctrl.getAll);
router.patch ("/:id", requireAuth, requireSuperAdmin, ctrl.updateStatus);

module.exports = router;

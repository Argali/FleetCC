const express                          = require("express");
const { requireAuth, requireAnyRole }  = require("../middleware/auth");
const ctrl                             = require("../controllers/userController");

const ADMIN_ROLES = ["fleet_manager", "company_admin", "superadmin"];
const router = express.Router();

router.get   ("/users",     requireAuth, requireAnyRole(...ADMIN_ROLES), ctrl.list);
router.post  ("/users",     requireAuth, requireAnyRole(...ADMIN_ROLES), ctrl.create);
router.patch ("/users/:id", requireAuth, requireAnyRole(...ADMIN_ROLES), ctrl.update);
router.delete("/users/:id", requireAuth, requireAnyRole(...ADMIN_ROLES), ctrl.deactivate);

module.exports = router;

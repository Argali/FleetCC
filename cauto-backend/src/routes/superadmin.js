const express                          = require("express");
const { requireAuth, requireSuperAdmin } = require("../middleware/auth");
const ctrl                             = require("../controllers/superadminController");

const router = express.Router();
router.use(requireAuth, requireSuperAdmin);

router.get  ("/tenants",              ctrl.getTenants);
router.patch("/tenants/:id/modules",  ctrl.updateModules);
router.patch("/tenants/:id/active",   ctrl.updateActive);
router.get  ("/analytics",            ctrl.getAnalytics);

module.exports = router;

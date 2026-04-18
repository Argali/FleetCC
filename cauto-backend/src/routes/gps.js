const express                      = require("express");
const { requireAuth, requirePerm } = require("../middleware/auth");
const ctrl                         = require("../controllers/gpsController");

const router = express.Router();

router.get   ("/vehicles",             requireAuth, requirePerm("gps", "view"), ctrl.getVehicles);
router.get   ("/routes",               requireAuth, requirePerm("gps", "view"), ctrl.getRoutes);
router.post  ("/routes",               requireAuth, requirePerm("gps", "edit"), ctrl.createRoute);
// PUT for full replace, PATCH for partial update (EditoreModule uses PATCH)
router.put   ("/routes/:id",           requireAuth, requirePerm("gps", "edit"), ctrl.updateRoute);
router.patch ("/routes/:id",           requireAuth, requirePerm("gps", "edit"), ctrl.updateRoute);
router.delete("/routes/:id",           requireAuth, requirePerm("gps", "edit"), ctrl.deleteRoute);
router.post  ("/routes/import-excel",  requireAuth, requirePerm("gps", "edit"), ctrl.importExcel);
router.post  ("/routes/snap-to-roads", requireAuth, ctrl.snapToRoads);
router.post  ("/navigate",             requireAuth, ctrl.navigate);
router.post  ("/photo",                requireAuth, ctrl.uploadPhoto);
router.post  ("/driver-location",      requireAuth, ctrl.postDriverLocation);
router.delete("/driver-location",      requireAuth, ctrl.deleteDriverLocation);
router.get   ("/driver-locations",     requireAuth, requirePerm("gps", "view"), ctrl.getDriverLocations);

module.exports = router;

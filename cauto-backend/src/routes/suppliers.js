const express                      = require("express");
const { requireAuth, requirePerm } = require("../middleware/auth");
const ctrl                         = require("../controllers/supplierController");

const router = express.Router();

router.get("/", requireAuth, requirePerm("suppliers", "view"), ctrl.getAll);

module.exports = router;

const express         = require("express");
const { requireAuth } = require("../middleware/auth");
const ctrl            = require("../controllers/authController");

const router = express.Router();

router.post("/login",  ctrl.login);
router.post("/azure",  ctrl.azure);
router.get ("/me",     requireAuth, ctrl.me);
router.post("/logout", requireAuth, ctrl.logout);

module.exports = router;

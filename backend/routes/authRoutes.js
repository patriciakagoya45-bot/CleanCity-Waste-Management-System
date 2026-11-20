const express = require("express");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", authController.login);
router.post("/register/household", authController.registerHousehold);
router.post("/register/claim-household", authController.claimHousehold);
router.get("/me", requireAuth, authController.getCurrentAccount);
router.post("/logout", requireAuth, authController.logout);

module.exports = router;

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateUpdateProfile,
} = require("../middleware/validators");

router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.post("/refresh", authController.refreshToken);
router.post("/forgot-password", validateForgotPassword, authController.forgotPassword);
router.put("/reset-password/:token", validateResetPassword, authController.resetPassword);

router.post("/logout", protect, authController.logout);
router.get("/me", protect, authController.getMe);
router.put("/update-profile", protect, validateUpdateProfile, authController.updateProfile);
router.put("/change-password", protect, validateChangePassword, authController.changePassword);

module.exports = router;
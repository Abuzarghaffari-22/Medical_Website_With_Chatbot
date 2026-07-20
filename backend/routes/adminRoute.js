const express = require("express");
const router  = express.Router();
const adminController = require("../controllers/adminController");
const { protect, restrictTo } = require("../middleware/auth");
const { validateMongoId } = require("../middleware/validators");

router.use(protect, restrictTo("admin"));

router.get("/dashboard",            adminController.getDashboardStats);
router.get("/users",                adminController.getAllUsers);
router.get("/users/:id",    validateMongoId, adminController.getUserById);
router.patch("/users/:id",  validateMongoId, adminController.updateUser);
router.delete("/users/:id", validateMongoId, adminController.deleteUser);
router.get("/appointments",         adminController.getAllAppointments);

module.exports = router;
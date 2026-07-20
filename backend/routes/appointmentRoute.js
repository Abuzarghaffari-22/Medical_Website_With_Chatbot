const express = require("express");
const router  = express.Router();
const appointmentController = require("../controllers/appointmentController");
const { protect, restrictTo } = require("../middleware/auth");
const {
  validateCreateAppointment,
  validateUpdateAppointment,
  validateCancelAppointment,
  validateUpdateStatus,
  validateMongoId,
} = require("../middleware/validators");

router.use(protect);

router.get("/my/upcoming",      appointmentController.getMyUpcoming);
router.get("/available-slots",  appointmentController.getAvailableSlots);

router.route("/")
  .post(validateCreateAppointment, appointmentController.createAppointment)
  .get(appointmentController.getAppointments);

router.route("/:id")
  .get(validateMongoId,  appointmentController.getAppointment)
  .put(validateUpdateAppointment, appointmentController.updateAppointment);

router.patch("/:id/cancel", validateCancelAppointment, appointmentController.cancelAppointment);

router.patch(
  "/:id/status",
  restrictTo("admin", "doctor"),
  validateUpdateStatus,
  appointmentController.updateStatus
);

module.exports = router;
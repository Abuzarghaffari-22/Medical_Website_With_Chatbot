const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/asyncHandler");
const { AppError } = require("../middleware/errorHandler");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const ChatHistory = require("../models/ChatHistory");

router.use(protect);

router.get(
  "/profile",
  asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError("User not found", 404));

    const [appointmentCount, upcomingCount, chatSessionCount] = await Promise.all([
      Appointment.countDocuments({ patientId: req.user.id }),
      Appointment.countDocuments({
        patientId: req.user.id,
        status: { $in: ["pending", "confirmed"] },
        appointmentDate: { $gte: new Date() },
      }),
      ChatHistory.countDocuments({ userId: req.user.id }),
    ]);

    res.json({
      success: true,
      user: user.toSafeObject(),
      stats: { appointmentCount, upcomingCount, chatSessionCount },
    });
  })
);

router.get(
  "/me/appointments/summary",
  asyncHandler(async (req, res) => {
    const [total, upcoming, pending, completed, cancelled] = await Promise.all([
      Appointment.countDocuments({ patientId: req.user.id }),
      Appointment.countDocuments({
        patientId: req.user.id,
        status: { $in: ["pending", "confirmed"] },
        appointmentDate: { $gte: new Date() },
      }),
      Appointment.countDocuments({ patientId: req.user.id, status: "pending" }),
      Appointment.countDocuments({ patientId: req.user.id, status: "completed" }),
      Appointment.countDocuments({ patientId: req.user.id, status: "cancelled" }),
    ]);

    res.json({
      success: true,
      summary: { total, upcoming, pending, completed, cancelled },
    });
  })
);

module.exports = router;
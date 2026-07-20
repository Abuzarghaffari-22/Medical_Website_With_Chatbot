const User = require("../models/User");
const Appointment = require("../models/Appointment");
const ChatHistory = require("../models/ChatHistory");
const { asyncHandler } = require("../middleware/asyncHandler");
const { AppError } = require("../middleware/errorHandler");
const { logger } = require("../utils/logger");
const { escapeRegex, buildPaginationMeta, parsePagination } = require("../utils/queryBuilder");

exports.getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersThisMonth,
    newUsersLastMonth,
    totalAppointments,
    appointmentsToday,
    appointmentsThisMonth,
    pendingAppointments,
    confirmedAppointments,
    cancelledAppointments,
    completedAppointments,
    totalChatSessions,
    chatSessionsThisMonth,
    appointmentsByStatus,
    appointmentsBySpecialty,
    recentAppointments,
    recentUsers,
    dailyAppointmentsTrend,
  ] = await Promise.all([
    User.countDocuments({ role: "patient" }),
    User.countDocuments({ role: "patient", createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ role: "patient", createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
    Appointment.countDocuments(),
    Appointment.countDocuments({
      appointmentDate: { $gte: startOfToday, $lte: endOfToday },
    }),
    Appointment.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Appointment.countDocuments({ status: "pending" }),
    Appointment.countDocuments({ status: "confirmed" }),
    Appointment.countDocuments({ status: "cancelled" }),
    Appointment.countDocuments({ status: "completed" }),
    ChatHistory.countDocuments(),
    ChatHistory.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Appointment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Appointment.aggregate([
      { $group: { _id: "$specialty", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Appointment.find()
      .populate("patientId", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    User.find({ role: "patient" })
      .select("name email createdAt isActive")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Appointment.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const userGrowth =
    newUsersLastMonth > 0
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : newUsersThisMonth > 0
      ? 100
      : 0;

  res.json({
    success: true,
    stats: {
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
        growthPercent: userGrowth,
      },
      appointments: {
        total: totalAppointments,
        today: appointmentsToday,
        thisMonth: appointmentsThisMonth,
        pending: pendingAppointments,
        confirmed: confirmedAppointments,
        cancelled: cancelledAppointments,
        completed: completedAppointments,
      },
      chat: {
        totalSessions: totalChatSessions,
        sessionsThisMonth: chatSessionsThisMonth,
      },
      charts: {
        appointmentsByStatus,
        appointmentsBySpecialty,
        dailyAppointmentsTrend,
      },
    },
    recentActivity: {
      appointments: recentAppointments,
      users: recentUsers,
    },
  });
});

exports.getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  if (req.query.search?.trim()) {
    const safe = escapeRegex(req.query.search.trim());
    filter.$or = [
      { name: new RegExp(safe, "i") },
      { email: new RegExp(safe, "i") },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password -refreshTokens -passwordResetToken -emailVerificationToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    users,
    pagination: buildPaginationMeta(total, page, limit),
  });
});

exports.getUserById = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select("-password -refreshTokens -passwordResetToken -emailVerificationToken");

  if (!user) return next(new AppError("User not found", 404));

  const [appointmentCount, chatSessionCount] = await Promise.all([
    Appointment.countDocuments({ patientId: req.params.id }),
    ChatHistory.countDocuments({ userId: req.params.id }),
  ]);

  res.json({
    success: true,
    user: user.toObject(),
    stats: { appointmentCount, chatSessionCount },
  });
});

exports.updateUser = asyncHandler(async (req, res, next) => {
  const allowedFields = ["isActive", "role", "name", "phone"];
  const updates = {};
  allowedFields.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  if (Object.keys(updates).length === 0) {
    return next(new AppError("No valid fields to update", 400));
  }

  if (req.params.id === req.user.id && updates.role && updates.role !== "admin") {
    return next(new AppError("Cannot change your own admin role", 400));
  }

  if (req.params.id === req.user.id && updates.isActive === false) {
    return next(new AppError("Cannot deactivate your own account", 400));
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select("-password -refreshTokens");

  if (!user) return next(new AppError("User not found", 404));

  logger.info(`Admin ${req.user.id} updated user ${req.params.id}: ${JSON.stringify(updates)}`);
  res.json({ success: true, user });
});

exports.deleteUser = asyncHandler(async (req, res, next) => {
  if (req.params.id === req.user.id) {
    return next(new AppError("Cannot delete your own admin account", 400));
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return next(new AppError("User not found", 404));

  await Promise.all([
    Appointment.deleteMany({ patientId: req.params.id }),
    ChatHistory.deleteMany({ userId: req.params.id }),
  ]);

  logger.info(`Admin ${req.user.id} deleted user ${req.params.id} (${user.email})`);
  res.json({ success: true, message: "User and all associated data deleted successfully" });
});

exports.getAllAppointments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.specialty) filter.specialty = req.query.specialty;

  if (req.query.doctorName?.trim()) {
    filter.doctorName = new RegExp(escapeRegex(req.query.doctorName.trim()), "i");
  }

  if (req.query.from || req.query.to) {
    filter.appointmentDate = {};
    if (req.query.from) {
      const from = new Date(req.query.from);
      if (!isNaN(from)) filter.appointmentDate.$gte = from;
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (!isNaN(to)) filter.appointmentDate.$lte = to;
    }
    if (Object.keys(filter.appointmentDate).length === 0) {
      delete filter.appointmentDate;
    }
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .populate("patientId", "name email phone")
      .sort({ appointmentDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  res.json({
    success: true,
    appointments,
    pagination: buildPaginationMeta(total, page, limit),
  });
});
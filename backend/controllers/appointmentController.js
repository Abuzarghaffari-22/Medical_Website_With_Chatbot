const Appointment = require("../models/Appointment");
const User = require("../models/User");
const { asyncHandler } = require("../middleware/asyncHandler");
const { AppError } = require("../middleware/errorHandler");
const { logger } = require("../utils/logger");
const { buildPaginationMeta, parsePagination, escapeRegex } = require("../utils/queryBuilder");

exports.createAppointment = asyncHandler(async (req, res, next) => {
  const {
    doctorName, specialty, appointmentDate, duration = 30,
    type, reason, symptoms, triageScore, urgencyLevel,
  } = req.body;

  const patientId = req.user.id;
  const parsedDate = new Date(appointmentDate);

  if (parsedDate <= new Date()) {
    return next(new AppError("Appointment date must be in the future", 400));
  }

  const conflict = await Appointment.checkConflict(doctorName, parsedDate, duration);
  if (conflict) {
    return next(
      new AppError(
        `Dr. ${doctorName} already has an appointment at this time. Please choose a different slot.`,
        409
      )
    );
  }

  const pendingCount = await Appointment.countDocuments({
    patientId,
    status: { $in: ["pending", "confirmed"] },
    appointmentDate: { $gte: new Date() },
  });

  if (pendingCount >= 5) {
    return next(
      new AppError(
        "You already have 5 upcoming appointments. Please cancel one before booking another.",
        429
      )
    );
  }

  const appointment = await Appointment.create({
    patientId,
    doctorName,
    specialty,
    appointmentDate: parsedDate,
    duration,
    type,
    reason,
    symptoms,
    triageScore,
    urgencyLevel,
    status: "pending",
  });

  await appointment.populate("patientId", "name email phone");

  logger.info(`Appointment created: ${appointment._id} for patient ${patientId}`);

  res.status(201).json({
    success: true,
    message: "Appointment booked successfully",
    appointment,
  });
});

exports.getAppointments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 50);

  const filter = {};

  if (req.user.role === "patient") {
    filter.patientId = req.user.id;
  }

  if (req.query.status) filter.status = req.query.status;
  if (req.query.specialty) filter.specialty = req.query.specialty;

  if (req.query.doctorName?.trim()) {
    filter.doctorName = new RegExp(escapeRegex(req.query.doctorName.trim()), "i");
  }

  if (req.query.from || req.query.to) {
    filter.appointmentDate = {};
    if (req.query.from) filter.appointmentDate.$gte = new Date(req.query.from);
    if (req.query.to) filter.appointmentDate.$lte = new Date(req.query.to);
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

exports.getAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate("patientId", "name email phone dateOfBirth");

  if (!appointment) return next(new AppError("Appointment not found", 404));

  if (
    req.user.role === "patient" &&
    appointment.patientId._id.toString() !== req.user.id
  ) {
    return next(new AppError("Not authorized to view this appointment", 403));
  }

  res.json({ success: true, appointment });
});

exports.updateAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) return next(new AppError("Appointment not found", 404));

  if (req.user.role === "patient") {
    if (appointment.patientId.toString() !== req.user.id) {
      return next(new AppError("Not authorized to update this appointment", 403));
    }
    if (appointment.status !== "pending") {
      return next(new AppError("You can only update pending appointments", 400));
    }

    const allowedPatientFields = ["reason", "notes", "symptoms", "type"];
    const invalidFields = Object.keys(req.body).filter(
      (f) => !allowedPatientFields.includes(f)
    );
    if (invalidFields.length > 0) {
      return next(
        new AppError(`Patients cannot update: ${invalidFields.join(", ")}`, 400)
      );
    }
  }

  if (req.body.appointmentDate || req.body.doctorName) {
    const newDate = req.body.appointmentDate
      ? new Date(req.body.appointmentDate)
      : appointment.appointmentDate;
    const newDoctor = req.body.doctorName || appointment.doctorName;
    const newDuration = req.body.duration || appointment.duration;

    if (newDate <= new Date()) {
      return next(new AppError("Appointment date must be in the future", 400));
    }

    const conflict = await Appointment.checkConflict(newDoctor, newDate, newDuration, appointment._id);
    if (conflict) {
      return next(new AppError(`Dr. ${newDoctor} is not available at this time`, 409));
    }
  }

  const ADMIN_ALLOWED = ["doctorName", "specialty", "appointmentDate", "duration", "type", "reason", "symptoms", "triageScore", "urgencyLevel", "status", "adminNotes", "notes"];
  const PATIENT_ALLOWED = ["reason", "notes", "symptoms", "type"];
  const allowedFields = req.user.role === "patient" ? PATIENT_ALLOWED : ADMIN_ALLOWED;
  const safeUpdates = {};
  allowedFields.forEach((f) => { if (req.body[f] !== undefined) safeUpdates[f] = req.body[f]; });

  const updated = await Appointment.findByIdAndUpdate(
    req.params.id,
    { $set: safeUpdates },
    { new: true, runValidators: true }
  ).populate("patientId", "name email phone");

  logger.info(`Appointment updated: ${updated._id} by ${req.user.role} ${req.user.id}`);

  res.json({ success: true, message: "Appointment updated", appointment: updated });
});

exports.cancelAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) return next(new AppError("Appointment not found", 404));

  if (
    req.user.role === "patient" &&
    appointment.patientId.toString() !== req.user.id
  ) {
    return next(new AppError("Not authorized to cancel this appointment", 403));
  }

  if (["cancelled", "completed"].includes(appointment.status)) {
    return next(new AppError(`Appointment is already ${appointment.status}`, 400));
  }

  if (req.user.role === "patient") {
    const hoursUntil = (appointment.appointmentDate - new Date()) / 3_600_000;
    if (hoursUntil < 2) {
      return next(
        new AppError(
          "Appointments must be cancelled at least 2 hours in advance. Please call our clinic directly.",
          400
        )
      );
    }
  }

  appointment.status = "cancelled";
  appointment.cancelledBy = req.user.role;
  appointment.cancellationReason = req.body.reason || "No reason provided";
  await appointment.save();

  logger.info(`Appointment cancelled: ${appointment._id} by ${req.user.role} ${req.user.id}`);

  res.json({ success: true, message: "Appointment cancelled successfully", appointment });
});

exports.updateStatus = asyncHandler(async (req, res, next) => {
  const { status, adminNotes } = req.body;

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        status,
        ...(adminNotes && { adminNotes }),
      },
    },
    { new: true, runValidators: true }
  ).populate("patientId", "name email");

  if (!appointment) return next(new AppError("Appointment not found", 404));

  logger.info(`Appointment status → ${status}: ${appointment._id} by ${req.user.id}`);

  res.json({ success: true, message: `Appointment ${status}`, appointment });
});

exports.getMyUpcoming = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find({
    patientId: req.user.id,
    status: { $in: ["pending", "confirmed"] },
    appointmentDate: { $gte: new Date() },
  })
    .sort({ appointmentDate: 1 })
    .limit(10)
    .lean();

  res.json({ success: true, count: appointments.length, appointments });
});

exports.getAvailableSlots = asyncHandler(async (req, res, next) => {
  const { doctorName, date } = req.query;

  if (!doctorName || !date) {
    return next(new AppError("doctorName and date are required", 400));
  }

  const targetDate = new Date(date);
  if (isNaN(targetDate)) {
    return next(new AppError("Invalid date format", 400));
  }

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(8, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(18, 0, 0, 0);

  const allSlots = [];
  const cursor = new Date(startOfDay);
  while (cursor < endOfDay) {
    allSlots.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 30);
  }

  const booked = await Appointment.find({
    doctorName,
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["pending", "confirmed"] },
  }).lean();

  const bookedTimes = new Set(booked.map((a) => a.appointmentDate.getTime()));
  const now = new Date();

  const availableSlots = allSlots
    .filter((slot) => !bookedTimes.has(slot.getTime()) && slot > now)
    .map((slot) => ({
      time: slot.toISOString(),
      label: slot.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    }));

  res.json({ success: true, doctorName, date, slots: availableSlots });
});
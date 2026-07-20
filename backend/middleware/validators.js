const { body, param, query, validationResult } = require("express-validator");
const { AppError } = require("./errorHandler");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = {
      validationErrors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
        value: e.value,
      })),
    };
    return next(new AppError("Validation failed", 422, details));
  }
  next();
};

exports.validateRegister = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters")
    .matches(/^[a-zA-Z\s'\-]+$/).withMessage("Name contains invalid characters"),
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email address")
    .normalizeEmail()
    .isLength({ max: 254 }).withMessage("Email address too long"),
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8, max: 128 }).withMessage("Password must be 8–128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  body("phone")
    .optional()
    .trim()
    .isLength({ min: 7, max: 20 }).withMessage("Phone number must be 7–20 characters")
    .matches(/^[\d\s\+\-\(\)]+$/).withMessage("Invalid phone number format"),
  body("role").customSanitizer(() => undefined),
  validate,
];

exports.validateLogin = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email address")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ max: 128 }).withMessage("Password too long"),
  validate,
];

exports.validateForgotPassword = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email address")
    .normalizeEmail(),
  validate,
];

exports.validateResetPassword = [
  param("token")
    .notEmpty().withMessage("Reset token is required")
    .isLength({ min: 10, max: 200 }).withMessage("Invalid reset token"),
  body("password")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8, max: 128 }).withMessage("Password must be 8–128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain uppercase, lowercase, and a number"),
  validate,
];

exports.validateChangePassword = [
  body("currentPassword")
    .notEmpty().withMessage("Current password is required")
    .isLength({ max: 128 }).withMessage("Password too long"),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8, max: 128 }).withMessage("Password must be 8–128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain uppercase, lowercase, and a number")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must be different from current password");
      }
      return true;
    }),
  validate,
];

exports.validateUpdateProfile = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters")
    .matches(/^[a-zA-Z\s'\-]+$/).withMessage("Name contains invalid characters"),
  body("phone")
    .optional()
    .trim()
    .isLength({ min: 7, max: 20 }).withMessage("Phone number must be 7–20 characters")
    .matches(/^[\d\s\+\-\(\)]+$/).withMessage("Invalid phone number format"),
  body("dateOfBirth")
    .optional()
    .isISO8601().withMessage("Invalid date format")
    .custom((value) => {
      const dob = new Date(value);
      const minAge = new Date();
      minAge.setFullYear(minAge.getFullYear() - 130);
      if (dob < minAge || dob > new Date()) {
        throw new Error("Invalid date of birth");
      }
      return true;
    }),
  body("gender")
    .optional()
    .isIn(["male", "female", "other", "prefer_not_to_say"]).withMessage("Invalid gender value"),
  body("address").optional().isObject().withMessage("Address must be an object"),
  body("medicalHistory").optional().isObject().withMessage("Medical history must be an object"),
  validate,
];

exports.validateCreateAppointment = [
  body("doctorName")
    .trim()
    .notEmpty().withMessage("Doctor name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Doctor name must be 2–100 characters"),
  body("specialty")
    .notEmpty().withMessage("Specialty is required")
    .isIn([
      "General Practice", "Cardiology", "Dermatology", "Endocrinology",
      "Gastroenterology", "Neurology", "Oncology", "Orthopedics",
      "Pediatrics", "Psychiatry", "Pulmonology", "Urology", "Other",
    ]).withMessage("Invalid specialty"),
  body("appointmentDate")
    .notEmpty().withMessage("Appointment date is required")
    .isISO8601().withMessage("Invalid date format. Use ISO8601 (e.g., 2025-06-15T10:00:00Z)")
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Appointment date must be in the future");
      }
      // Prevent appointments more than 1 year in advance
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      if (new Date(value) > maxDate) {
        throw new Error("Appointment cannot be booked more than 1 year in advance");
      }
      return true;
    }),
  body("duration")
    .optional()
    .isIn([15, 30, 45, 60, 90]).withMessage("Duration must be 15, 30, 45, 60, or 90 minutes"),
  body("type")
    .optional()
    .isIn(["in-person", "telemedicine", "follow-up", "emergency"])
    .withMessage("Invalid appointment type"),
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Reason cannot exceed 500 characters"),
  body("symptoms")
    .optional()
    .isArray({ max: 20 }).withMessage("Symptoms must be an array (max 20 items)"),
  body("symptoms.*")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Each symptom cannot exceed 100 characters"),
  validate,
];

exports.validateUpdateAppointment = [
  param("id").isMongoId().withMessage("Invalid appointment ID"),
  body("reason").optional().trim().isLength({ max: 500 }).withMessage("Reason too long"),
  body("notes").optional().trim().isLength({ max: 1000 }).withMessage("Notes too long"),
  body("type")
    .optional()
    .isIn(["in-person", "telemedicine", "follow-up", "emergency"])
    .withMessage("Invalid appointment type"),
  body("appointmentDate")
    .optional()
    .isISO8601().withMessage("Invalid date format"),
  validate,
];

exports.validateCancelAppointment = [
  param("id").isMongoId().withMessage("Invalid appointment ID"),
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Cancellation reason cannot exceed 500 characters"),
  validate,
];

exports.validateUpdateStatus = [
  param("id").isMongoId().withMessage("Invalid appointment ID"),
  body("status")
    .notEmpty().withMessage("Status is required")
    .isIn(["pending", "confirmed", "cancelled", "completed", "no-show"])
    .withMessage("Invalid status value"),
  body("adminNotes")
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage("Admin notes cannot exceed 1000 characters"),
  validate,
];

exports.validateChatMessage = [
  body("message")
    .trim()
    .notEmpty().withMessage("Message cannot be empty")
    .isLength({ min: 1, max: 2000 }).withMessage("Message must be 1–2000 characters"),
  body("sessionId")
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage("Session ID too long")
    .matches(/^[a-zA-Z0-9_\-]+$/).withMessage("Invalid session ID format"),
  validate,
];

exports.validateMongoId = [
  param("id").isMongoId().withMessage("Invalid ID format"),
  validate,
];

exports.validatePagination = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1–100"),
  validate,
];
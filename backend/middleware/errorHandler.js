const { logger } = require("../utils/logger");

class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

const handleCastError = (err) => new AppError(`Invalid ${err.path}: ${err.value}`, 400);
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`${field} '${err.keyValue[field]}' is already in use`, 409);
};
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  return new AppError("Validation failed", 422, { validationErrors: errors });
};
const handleJWTError = () => new AppError("Invalid token. Please log in again.", 401);
const handleJWTExpiredError = () => new AppError("Session expired. Please log in again.", 401);

const sendDevError = (err, res) =>
  res.status(err.statusCode).json({ success: false, status: err.status, message: err.message, details: err.details, stack: err.stack });

const sendProdError = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({ success: false, message: err.message, ...(err.details && { details: err.details }) });
  } else {
    logger.error("CRITICAL ERROR:", err);
    res.status(500).json({ success: false, message: "Something went wrong. Please try again later." });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  logger.error(`[${err.statusCode}] ${err.message} | ${req.method} ${req.originalUrl} | user=${req.user?.id || "anon"}`, { requestId: req.requestId });

  let error = { ...err, message: err.message };
  if (process.env.NODE_ENV === "development") {
    sendDevError(error, res);
  } else {
    if (err.name === "CastError") error = handleCastError(err);
    if (err.code === 11000) error = handleDuplicateKeyError(err);
    if (err.name === "ValidationError") error = handleValidationError(err);
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();
    sendProdError(error, res);
  }
};

module.exports = { AppError, notFound, errorHandler };
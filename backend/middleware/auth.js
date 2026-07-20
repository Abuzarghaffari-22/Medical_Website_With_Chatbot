const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { AppError } = require("./errorHandler");
const { asyncHandler } = require("./asyncHandler");
const { logger } = require("../utils/logger");

exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }
  if (!token) return next(new AppError("Authentication required. Please log in.", 401));

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") return next(new AppError("Session expired. Please log in again.", 401));
    if (err.name === "JsonWebTokenError") return next(new AppError("Invalid token. Please log in again.", 401));
    return next(new AppError("Authentication failed", 401));
  }

  const user = await User.findById(decoded.id).select("-password");
  if (!user) return next(new AppError("User account no longer exists", 401));
  if (!user.isActive) return next(new AppError("Your account has been deactivated", 403));

  req.user = { id: user._id.toString(), name: user.name, email: user.email, role: user.role, age: user.age };
  next();
});

exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    logger.warn(`Unauthorized: user=${req.user.id} role=${req.user.role} required=${roles.join(",")}`);
    return next(new AppError(`Access denied. Required role: ${roles.join(" or ")}`, 403));
  }
  next();
};

exports.optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user?.isActive) {
      req.user = { id: user._id.toString(), name: user.name, email: user.email, role: user.role, age: user.age };
    }
  } catch { /* silent fail */ }
  next();
});
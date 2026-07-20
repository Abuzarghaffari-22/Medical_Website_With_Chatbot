const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");
const User    = require("../models/User");
const { asyncHandler } = require("../middleware/asyncHandler");
const { AppError }     = require("../middleware/errorHandler");
const { logger }       = require("../utils/logger");

let _noopHash = null;
(async () => {
  _noopHash = await bcrypt.hash("noop_placeholder_string", 12);
})();

const bcryptCompareNoop = async () => {
  if (_noopHash) await bcrypt.compare("noop", _noopHash);
};

const sendTokenResponse = async (user, statusCode, req, res) => {
  const accessToken = user.generateAccessToken();
  const userAgent   = req.headers?.["user-agent"] || "";

  user.generateRefreshToken(userAgent);
  await user.save();

  const isProd        = process.env.NODE_ENV === "production";
  const refreshToken  = user.refreshTokens[user.refreshTokens.length - 1].token;

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? "strict" : "lax",
    path:     "/",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  return res.status(statusCode).json({
    success:     true,
    accessToken,
    user:        user.toSafeObject(),
  });
};

exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return next(new AppError("An account with this email already exists", 409));

  const user = new User({
    name:     name.trim(),
    email:    email.toLowerCase().trim(),
    password,
    phone,
    role:     "patient",
  });

  logger.info(`New user registered: ${user.email}`);
  return sendTokenResponse(user, 201, req, res);
});

exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+password +loginAttempts +lockUntil");

  const invalidCredentials = new AppError("Invalid email or password", 401);

  if (!user) {
    await bcryptCompareNoop();
    return next(invalidCredentials);
  }

  if (user.isLocked) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return next(new AppError(`Account locked. Try again in ${mins} minute(s).`, 423));
  }

  if (!user.isActive) {
    return next(new AppError("Account deactivated. Contact support.", 403));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await user.incrementLoginAttempts();
    logger.warn(`Failed login: ${email} | attempts=${user.loginAttempts + 1}`);
    return next(invalidCredentials);
  }

  if (user.loginAttempts > 0) {
    user.loginAttempts = 0;
    user.lockUntil     = undefined;
  }
  user.lastLogin = new Date();

  logger.info(`User logged in: ${user.email} [${user.role}]`);
  return sendTokenResponse(user, 200, req, res);
});

exports.refreshToken = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return next(new AppError("Refresh token not provided", 401));

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return next(new AppError("Invalid or expired refresh token. Please log in again.", 401));
  }

  const user = await User.findById(decoded.id);
  if (!user?.isActive) return next(new AppError("User not found or account deactivated", 401));

  const stored = user.refreshTokens.find(
    (t) => t.token === token && new Date(t.expiresAt) > new Date()
  );

  if (!stored) {
    logger.warn(`Refresh token reuse detected: user=${user._id} — revoking all sessions`);
    user.refreshTokens = [];
    await user.save();
    return next(new AppError("Session invalid. Please log in again.", 401));
  }

  user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);
  return sendTokenResponse(user, 200, req, res);
});

exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (token && req.user) {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { refreshTokens: { token } },
    });
  }

  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? "strict" : "lax",
    path:     "/",
  });

  logger.info(`User logged out: ${req.user?.email}`);
  res.json({ success: true, message: "Logged out successfully" });
});

exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError("User not found", 404));
  res.json({ success: true, user: user.toSafeObject() });
});

exports.updateProfile = asyncHandler(async (req, res, next) => {
  const allowed = ["name", "phone", "dateOfBirth", "gender", "address", "medicalHistory"];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length) return next(new AppError("No valid fields to update", 400));

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!user) return next(new AppError("User not found", 404));

  logger.info(`Profile updated: ${user.email}`);
  res.json({ success: true, user: user.toSafeObject() });
});

exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select("+password");
  if (!user) return next(new AppError("User not found", 404));

  if (!await user.comparePassword(currentPassword)) {
    return next(new AppError("Current password is incorrect", 400));
  }

  user.password      = newPassword;
  user.refreshTokens = [];
  await user.save();

  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("refreshToken", { httpOnly: true, secure: isProd, path: "/" });

  logger.info(`Password changed: ${user.email}`);
  res.json({ success: true, message: "Password changed. Please log in again." });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase() });
  const safeMsg = "If that email exists in our system, a reset link has been sent.";

  if (!user) return res.json({ success: true, message: safeMsg });

  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // TODO: await emailService.sendPasswordReset(user.email, resetToken, req);
  logger.info(`Password reset requested: ${user.email}`);

  res.json({
    success: true,
    message: safeMsg,
    ...(process.env.NODE_ENV === "development" && { resetToken }),
  });
});

exports.resetPassword = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

  const user = await User.findOne({
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) return next(new AppError("Invalid or expired reset token", 400));

  user.password             = req.body.password;
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens        = [];

  await user.save();
  logger.info(`Password reset completed: ${user.email}`);
  return sendTokenResponse(user, 200, req, res);
});
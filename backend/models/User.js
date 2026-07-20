const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const crypto   = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String, required: [true, "Name is required"],
      trim: true, minlength: 2, maxlength: 100,
    },
    email: {
      type: String, required: [true, "Email is required"],
      unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    password: {
      type: String, required: [true, "Password is required"],
      minlength: 8, select: false,
    },
    role: {
      type: String,
      enum: { values: ["patient", "admin", "doctor"], message: "Role must be patient, admin, or doctor" },
      default: "patient",
    },
    phone: {
      type: String, trim: true,
      match: [/^[\d\s\+\-\(\)]{7,20}$/, "Please enter a valid phone number"],
    },
    dateOfBirth: Date,
    gender: { type: String, enum: ["male", "female", "other", "prefer_not_to_say"] },
    address: {
      street: String, city: String, state: String, zipCode: String,
      country: { type: String, default: "US" },
    },
    medicalHistory: {
      allergies:   [String],
      conditions:  [String],
      medications: [String],
      bloodType: {
        type: String,
        enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"],
        default: "unknown",
      },
    },
    isActive:                 { type: Boolean, default: true },
    isEmailVerified:          { type: Boolean, default: false },
    emailVerificationToken:   String,
    emailVerificationExpires: Date,
    passwordResetToken:       String,
    passwordResetExpires:     Date,
    lastLogin:                Date,
    loginAttempts:            { type: Number, default: 0 },
    lockUntil:                Date,
    refreshTokens: [
      {
        token:     String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: Date,
        userAgent: String,
      },
    ],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

userSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
});

userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "15m" }
  );
};

userSchema.methods.generateRefreshToken = function (userAgent = "") {
  const token = jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d" }
  );
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  if (this.refreshTokens.length >= 5) this.refreshTokens.shift();
  this.refreshTokens.push({ token, expiresAt, userAgent });
  return token;
};

userSchema.methods.generatePasswordResetToken = function () {
  const raw = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken   = crypto.createHash("sha256").update(raw).digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return raw;
};

userSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil     = undefined;
    return this.save();
  }

  this.loginAttempts += 1;

  if (this.loginAttempts >= 5 && !this.isLocked) {
    this.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
  }

  return this.save();
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
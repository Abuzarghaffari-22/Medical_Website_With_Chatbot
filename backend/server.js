const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const compression = require("compression");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const { connectDB } = require("./config/db");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { logger, morganStream } = require("./utils/logger");

const authRoutes        = require("./routes/authRoute");
const appointmentRoutes = require("./routes/appointmentRoute");
const chatRoutes        = require("./routes/chatRoute");
const userRoutes        = require("./routes/users");
const adminRoutes       = require("./routes/adminRoute");

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many auth attempts. Please try again later." },
});

app.use("/api", globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/refresh", authLimiter);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.use(cookieParser());

app.use(mongoSanitize());
app.use(xss());

app.use(compression());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined", { stream: morganStream }));
}

app.use((req, res, next) => {
  req.requestId =
    req.headers["x-request-id"] ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Medical Clinic API",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth",         authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/chat",         chatRoutes);
app.use("/api/users",        userRoutes);
app.use("/api/admin",        adminRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`🚀 Medical Clinic API on port ${PORT} [${process.env.NODE_ENV}]`);
});

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully...`);
  server.close(() => {
    mongoose.connection.close().then(() => {
      logger.info("MongoDB connection closed");
      process.exit(0);
    });
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Promise Rejection:", err);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

module.exports = app;
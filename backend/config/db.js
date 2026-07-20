const mongoose = require("mongoose");
const { logger } = require("../utils/logger");

const MONGODB_URI = process.env.MONGODB_URI;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

let retryCount = 0;

const mongooseOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
  autoIndex: process.env.NODE_ENV !== "production",
};

mongoose.connection.on("connected", () => {
  retryCount = 0;
  logger.info(`✅ MongoDB connected: ${sanitizeUri(MONGODB_URI)}`);
});

mongoose.connection.on("error", (err) => {
  logger.error(`MongoDB error: ${err.message}`);
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected");
});

const connectDB = async () => {
  if (!MONGODB_URI) {
    logger.error("MONGODB_URI is not defined in environment variables");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, mongooseOptions);
  } catch (err) {
    retryCount++;
    logger.error(
      `MongoDB connection failed (attempt ${retryCount}/${MAX_RETRIES}): ${err.message}`
    );

    if (retryCount >= MAX_RETRIES) {
      logger.error("Max MongoDB retry attempts reached. Exiting.");
      process.exit(1);
    }

    logger.info(`Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return connectDB();
  }
};

const sanitizeUri = (uri = "") => {
  try {
    const url = new URL(uri);
    if (url.password) url.password = "****";
    if (url.username) url.username = url.username.substring(0, 3) + "***";
    return url.toString();
  } catch {
    return uri.replace(/:\/\/[^@]+@/, "://****@");
  }
};

module.exports = { connectDB };
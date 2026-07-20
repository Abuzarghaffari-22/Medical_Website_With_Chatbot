const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const ChatHistory = require("../models/ChatHistory");
const { asyncHandler } = require("../middleware/asyncHandler");
const { AppError } = require("../middleware/errorHandler");
const { logger } = require("../utils/logger");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT, 10) || 35000;

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_SERVICE_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    "X-Internal-API-Key": process.env.INTERNAL_API_KEY,
  },
});

exports.sendMessage = asyncHandler(async (req, res, next) => {
  const { message, sessionId: reqSessionId } = req.body;
  const userId = req.user.id;

  if (!message?.trim()) {
    return next(new AppError("Message cannot be empty", 400));
  }

  const sessionId = reqSessionId || `sess_${userId}_${uuidv4()}`;

  let session = await ChatHistory.findOne({ sessionId, userId });
  if (!session) {
    session = new ChatHistory({ userId, sessionId });
  }

  const recentMessages = session.getRecentMessages(10);
  const conversationHistory = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.createdAt,
  }));

  const aiPayload = {
    user_id: userId,
    session_id: sessionId,
    message: message.trim(),
    conversation_history: conversationHistory,
    user_context: {
      name: req.user.name,
      age: req.user.age || null,
      role: req.user.role,
    },
  };

  let aiResponse;
  let aiError = null;

  const abortController = new AbortController();
  const abortTimer = setTimeout(() => abortController.abort(), AI_SERVICE_TIMEOUT + 2000);

  try {
    const response = await aiClient.post("/api/chat/", aiPayload, {
      signal: abortController.signal,
    });
    aiResponse = response.data;
  } catch (err) {
    aiError = err;

    if (err.code === "ERR_CANCELED" || err.name === "AbortError") {
      logger.error(`AI service hard timeout (${AI_SERVICE_TIMEOUT}ms) | session=${sessionId}`);
    } else {
      logger.error(`AI service error: ${err.message}`, {
        userId,
        sessionId,
        status: err.response?.status,
        code: err.code,
      });
    }

    aiResponse = buildFallbackResponse(sessionId);
  } finally {
    clearTimeout(abortTimer);
  }

  session.addMessage({
    role: "user",
    content: message.trim(),
    metadata: { sessionId },
  });

  session.addMessage({
    role: "assistant",
    content: aiResponse.response,
    intent: aiResponse.intent
      ? {
          primaryIntent: aiResponse.intent.primary_intent,
          confidence: aiResponse.intent.confidence,
        }
      : undefined,
    symptomAnalysis: aiResponse.symptom_analysis
      ? {
          urgencyLevel: aiResponse.symptom_analysis.urgency_level,
          triageScore: aiResponse.symptom_analysis.triage_score,
          detectedSymptoms: aiResponse.symptom_analysis.detected_symptoms,
        }
      : undefined,
    metadata: aiResponse.metadata,
  });

  await session.save();

  logger.info(
    `Chat processed | user=${userId} | session=${sessionId} | intent=${aiResponse.intent?.primary_intent}`
  );

  res.json({
    success: true,
    sessionId,
    response: aiResponse.response,
    intent: aiResponse.intent,
    symptomAnalysis: aiResponse.symptom_analysis,
    disclaimer: aiResponse.disclaimer,
    quickReplies: aiResponse.quick_replies,
    metadata: {
      ...aiResponse.metadata,
      aiServiceError: !!aiError,
    },
  });
});

exports.getSessions = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    ChatHistory.find({ userId: req.user.id })
      .select("sessionId title messageCount lastActivityAt createdAt tags")
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ChatHistory.countDocuments({ userId: req.user.id }),
  ]);

  res.json({
    success: true,
    sessions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

exports.getSession = asyncHandler(async (req, res, next) => {
  const session = await ChatHistory.findOne({
    sessionId: req.params.sessionId,
    userId: req.user.id,
  });

  if (!session) return next(new AppError("Session not found", 404));

  res.json({ success: true, session });
});

exports.deleteSession = asyncHandler(async (req, res, next) => {
  const session = await ChatHistory.findOneAndDelete({
    sessionId: req.params.sessionId,
    userId: req.user.id,
  });

  if (!session) return next(new AppError("Session not found", 404));

  logger.info(`Chat session deleted | user=${req.user.id} | session=${req.params.sessionId}`);
  res.json({ success: true, message: "Session deleted" });
});

exports.startNewSession = asyncHandler(async (req, res) => {
  const sessionId = `sess_${req.user.id}_${uuidv4()}`;
  res.json({ success: true, sessionId, message: "New session ready" });
});

const buildFallbackResponse = (sessionId) => ({
  success: false,
  session_id: sessionId,
  response:
    "I'm temporarily unavailable. Please contact our clinic directly:\n\n" +
    `📞 ${process.env.CLINIC_PHONE || "+1-800-MEDICARE"}\n` +
    `📧 ${process.env.CLINIC_EMAIL || "info@medicareclinic.com"}\n\n` +
    "🚨 If this is a medical emergency, please call **911** immediately.",
  intent: { primary_intent: "unknown", confidence: 0 },
  quick_replies: ["Contact clinic", "Call us", "Emergency: 911"],
  metadata: { error: true, method: "fallback" },
});
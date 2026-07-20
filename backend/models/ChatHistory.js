const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role:    { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true, maxlength: [5000, "Message content too long"] },
    intent: { primaryIntent: String, confidence: Number },
    symptomAnalysis: {
      urgencyLevel:     String,
      triageScore:      Number,
      detectedSymptoms: [String],
    },
    metadata: { latencyMs: Number, model: String, method: String },
  },
  { timestamps: true, _id: true }
);

const chatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId, ref: "User", required: true,
    },
    sessionId: { type: String, required: true, unique: true, trim: true },
    messages: {
      type: [messageSchema],
      default: [],
      validate: { validator: (arr) => arr.length <= 200, message: "Session cannot exceed 200 messages" },
    },
    title:           { type: String, trim: true, maxlength: 200, default: "New Conversation" },
    isActive:        { type: Boolean, default: true },
    lastActivityAt:  { type: Date, default: Date.now },
    messageCount:    { type: Number, default: 0 },
    tags:            [String],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

chatHistorySchema.index({ userId: 1, lastActivityAt: -1 });
chatHistorySchema.index({ sessionId: 1 }, { unique: true });
chatHistorySchema.index({ userId: 1, isActive: 1 });
chatHistorySchema.index(
  { lastActivityAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

chatHistorySchema.pre("save", function (next) {
  this.messageCount = this.messages.length;
  this.lastActivityAt = new Date();
  next();
});

chatHistorySchema.methods.addMessage = function (messageData) {
  if (this.messages.length === 0 && messageData.role === "user") {
    this.title =
      messageData.content.substring(0, 60) +
      (messageData.content.length > 60 ? "..." : "");
  }
  this.messages.push(messageData);
  return this;
};

chatHistorySchema.methods.getRecentMessages = function (limit = 10) {
  return this.messages.slice(-limit);
};

module.exports = mongoose.model("ChatHistory", chatHistorySchema);
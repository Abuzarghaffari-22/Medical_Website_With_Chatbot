const express    = require("express");
const router     = express.Router();
const rateLimit  = require("express-rate-limit");
const chatController      = require("../controllers/chatController");
const { protect }         = require("../middleware/auth");
const { validateChatMessage } = require("../middleware/validators");

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many messages. Please slow down." },
});

router.use(protect);

router.post("/message",     chatLimiter, validateChatMessage, chatController.sendMessage);
router.post("/new-session",                                    chatController.startNewSession);
router.get("/sessions",                                        chatController.getSessions);
router.get("/sessions/:sessionId",                             chatController.getSession);
router.delete("/sessions/:sessionId",                          chatController.deleteSession);

module.exports = router;
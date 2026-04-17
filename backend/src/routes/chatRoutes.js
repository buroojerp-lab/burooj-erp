// routes/chatRoutes.js  — AI Chatbot endpoint
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { chat, generateInsight } = require('../services/aiChatService');

router.use(authenticate);

// POST /chat  — Send a message
router.post('/', async (req, res) => {
  const { messages, language } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  // Cap history at last 20 messages to stay within token budget
  const trimmed = messages.slice(-20);
  const result  = await chat({ messages: trimmed, userId: req.user.id, language });
  res.json(result);
});

// GET /chat/insight  — Quick AI insight for dashboard
router.get('/insight', async (req, res) => {
  const insight = await generateInsight();
  res.json({ insight });
});

module.exports = router;

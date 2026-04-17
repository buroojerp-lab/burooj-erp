// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { sendWhatsApp, sendDueDateReminders, handleWebhook } = require('../services/whatsappService');
const { query } = require('../config/database');

// Webhook verification (GET)
router.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook callbacks (POST)
router.post('/webhook', async (req, res) => {
  await handleWebhook(req.body);
  res.sendStatus(200);
});

router.use(authenticate);

// POST /whatsapp/send — manual send
router.post('/send', authorize('admin', 'manager', 'accountant'), async (req, res) => {
  const { phone, message, customer_name } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'Phone and message required' });

  const result = await sendWhatsApp({ phone, customMessage: message });
  res.json({ success: true, ...result });
});

// POST /whatsapp/trigger-reminders
router.post('/trigger-reminders', authorize('admin', 'manager'), async (req, res) => {
  await sendDueDateReminders();
  res.json({ message: 'Reminders triggered successfully' });
});

// GET /whatsapp/logs
router.get('/logs', async (req, res) => {
  const { status, type, page = 1, limit = 25 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];

  if (status) { conds.push(`status = $${params.length+1}`); params.push(status); }
  if (type)   { conds.push(`template_type = $${params.length+1}`); params.push(type); }

  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(`SELECT * FROM whatsapp_logs WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, limit, offset]),
    query(`SELECT COUNT(*) FROM whatsapp_logs WHERE ${where}`, params),
  ]);

  res.json({ data: rows.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count), pages: Math.ceil(total.rows[0].count / limit) } });
});

// GET /whatsapp/stats
router.get('/stats', async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) total,
      COUNT(*) FILTER (WHERE status = 'sent') sent,
      COUNT(*) FILTER (WHERE status = 'failed') failed,
      COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) month
    FROM whatsapp_logs
  `);
  res.json(result.rows[0]);
});

module.exports = router;

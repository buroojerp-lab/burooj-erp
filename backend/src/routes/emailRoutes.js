// routes/emailRoutes.js  — Email management endpoints
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { sendEmail, sendMonthlyStatements } = require('../services/emailService');
const { query } = require('../config/database');

router.use(authenticate);

// POST /email/send  — Manual email send
router.post('/send', authorize('admin', 'manager'), async (req, res) => {
  const { to, subject, message } = req.body;
  if (!to || !subject || !message) return res.status(400).json({ error: 'to, subject, message required' });
  const result = await sendEmail({ to, subject, html: `<p style="font-family:Arial;color:#374151;line-height:1.7">${message}</p>` });
  res.json({ success: true, ...result });
});

// POST /email/test  — Test SMTP config
router.post('/test', authorize('admin'), async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'to required' });
  const result = await sendEmail({
    to,
    subject: 'Burooj Heights ERP — Email Test',
    html: `<div style="font-family:Arial;padding:24px;"><h2 style="color:#0098B4;">Email System Working ✅</h2><p style="color:#374151;">This is a test email from Burooj Heights ERP. Your email automation is configured correctly.</p><p style="color:#64748b;font-size:12px;">Sent at: ${new Date().toLocaleString('en-PK')}</p></div>`,
  });
  res.json({ success: true, ...result });
});

// POST /email/trigger-statements  — Manually trigger monthly statements
router.post('/trigger-statements', authorize('admin', 'manager'), async (req, res) => {
  const sent = await sendMonthlyStatements();
  res.json({ success: true, sent, message: `${sent} statements sent` });
});

// GET /email/logs  — View email logs
router.get('/logs', authorize('admin', 'manager'), async (req, res) => {
  const { status, page = 1, limit = 25 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];
  if (status) { conds.push(`status = $${params.length + 1}`); params.push(status); }
  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(`SELECT * FROM email_logs WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, limit, offset]),
    query(`SELECT COUNT(*) FROM email_logs WHERE ${where}`, params),
  ]);
  res.json({ data: rows.rows, pagination: { page: +page, limit: +limit, total: +total.rows[0].count, pages: Math.ceil(total.rows[0].count / limit) } });
});

// GET /email/stats
router.get('/stats', authorize('admin', 'manager'), async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) total,
      COUNT(*) FILTER (WHERE status='sent') sent,
      COUNT(*) FILTER (WHERE status='failed') failed,
      COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) this_month
    FROM email_logs
  `);
  res.json(result.rows[0]);
});

module.exports = router;

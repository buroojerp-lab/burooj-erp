// ============================================================
// BUROOJ ERP — FINANCIAL AUDIT ROUTES
// ============================================================

const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
const {
  generateAudit,
  generateMonthlyAudit,
  generateSemiAnnualAudit,
  generateAnnualAudit,
  generateAuditPDF,
  generateAuditCSV,
  periodRange,
} = require('../services/auditService');

router.use(authenticate);

// ── GET /audit/dashboard — summary stats for the audit page ──
router.get('/dashboard', async (req, res) => {
  const [latestMonthly, latestSemi, latestAnnual, alertsRes, totalReports] = await Promise.all([
    query(`SELECT * FROM audit_reports WHERE type='monthly'    ORDER BY generated_at DESC LIMIT 1`),
    query(`SELECT * FROM audit_reports WHERE type='semi_annual' ORDER BY generated_at DESC LIMIT 1`),
    query(`SELECT * FROM audit_reports WHERE type='annual'     ORDER BY generated_at DESC LIMIT 1`),
    query(`SELECT * FROM audit_alerts WHERE is_read=false ORDER BY created_at DESC LIMIT 10`),
    query(`SELECT COUNT(*) FROM audit_reports`),
  ]);

  res.json({
    latestMonthly:   latestMonthly.rows[0]   || null,
    latestSemiAnnual: latestSemi.rows[0]     || null,
    latestAnnual:    latestAnnual.rows[0]    || null,
    unreadAlerts:    alertsRes.rows,
    totalReports:    parseInt(totalReports.rows[0].count),
  });
});

// ── GET /audit/reports — list all audit reports ──
router.get('/reports', async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const where  = type ? `WHERE type = $1` : '';
  const params = type ? [type] : [];

  const [rows, total] = await Promise.all([
    query(
      `SELECT id, type, period_label, period_start, period_end,
              total_income, total_expenses, net_profit, growth_rate, roi, profit_margin,
              total_bookings, total_units_sold, total_collections, total_outstanding,
              collection_rate, generated_at, trigger_type
       FROM audit_reports
       ${where}
       ORDER BY generated_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM audit_reports ${where}`, params),
  ]);

  res.json({
    data: rows.rows,
    pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count) },
  });
});

// ── GET /audit/reports/:id — single report detail ──
router.get('/reports/:id', async (req, res) => {
  const result = await query(
    'SELECT * FROM audit_reports WHERE id = $1',
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Report not found' });
  res.json({ data: result.rows[0] });
});

// ── POST /audit/generate — manually trigger an audit ──
router.post('/generate', authorize('admin', 'manager', 'accountant'), async (req, res) => {
  const { type = 'monthly', ref_date } = req.body;

  if (!['monthly', 'semi_annual', 'annual'].includes(type)) {
    return res.status(400).json({ error: 'type must be monthly | semi_annual | annual' });
  }

  const refDate = ref_date ? new Date(ref_date) : new Date();
  const report  = await generateAudit(type, refDate, req.user.id);

  res.json({ success: true, data: report });
});

// ── GET /audit/reports/:id/pdf — download PDF ──
router.get('/reports/:id/pdf', async (req, res) => {
  await generateAuditPDF(req.params.id, res);
});

// ── GET /audit/reports/:id/csv — download CSV / Excel ──
router.get('/reports/:id/csv', async (req, res) => {
  await generateAuditCSV(req.params.id, res);
});

// ── GET /audit/alerts — list alerts ──
router.get('/alerts', async (req, res) => {
  const { unread_only = 'false', limit = 50 } = req.query;
  const where = unread_only === 'true' ? 'WHERE is_read = false' : '';

  const result = await query(
    `SELECT * FROM audit_alerts ${where} ORDER BY created_at DESC LIMIT $1`,
    [parseInt(limit)]
  );

  res.json({ data: result.rows });
});

// ── PATCH /audit/alerts/:id/read — mark alert as read ──
router.patch('/alerts/:id/read', async (req, res) => {
  await query('UPDATE audit_alerts SET is_read = true WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ── PATCH /audit/alerts/read-all — mark all alerts read ──
router.patch('/alerts/read-all', async (req, res) => {
  await query('UPDATE audit_alerts SET is_read = true WHERE is_read = false');
  res.json({ success: true });
});

// ── DELETE /audit/reports/:id — delete a report (admin only) ──
router.delete('/reports/:id', authorize('admin'), async (req, res) => {
  await query('DELETE FROM audit_reports WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ── GET /audit/preview — preview metrics without saving ──
router.get('/preview', authorize('admin', 'manager', 'accountant'), async (req, res) => {
  const { type = 'monthly', ref_date } = req.query;
  const refDate = ref_date ? new Date(ref_date) : new Date();
  const p = periodRange(type, refDate);
  res.json({ period: p, type });
});

module.exports = router;

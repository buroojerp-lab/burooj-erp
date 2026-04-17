// routes/reportRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const fmtK = n => n;

router.use(authenticate);

// GET /reports/sales
router.get('/sales', async (req, res) => {
  const { period = 'monthly', year = new Date().getFullYear() } = req.query;

  const groupBy = period === 'monthly'
    ? "DATE_TRUNC('month', b.booking_date)"
    : period === 'quarterly'
    ? "DATE_TRUNC('quarter', b.booking_date)"
    : "DATE_TRUNC('year', b.booking_date)";

  const [totals, byPeriod] = await Promise.all([
    query(`
      SELECT
        COALESCE(SUM(b.final_price), 0) total_revenue,
        COUNT(b.id) total_bookings,
        COALESCE(AVG(b.final_price), 0) avg_deal
      FROM bookings b WHERE EXTRACT(year FROM b.booking_date) = $1`, [year]),
    query(`
      SELECT
        TO_CHAR(${groupBy}, 'Mon YY') label,
        ${groupBy} period_date,
        SUM(b.final_price) revenue,
        COUNT(b.id) bookings
      FROM bookings b
      WHERE EXTRACT(year FROM b.booking_date) = $1
        AND b.status != 'cancelled'
      GROUP BY ${groupBy}
      ORDER BY period_date`, [year]),
  ]);

  res.json({
    totalRevenue: totals.rows[0].total_revenue,
    totalBookings: totals.rows[0].total_bookings,
    avgDeal: totals.rows[0].avg_deal,
    byPeriod: byPeriod.rows,
  });
});

// GET /reports/installments
router.get('/installments', async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const [totals, byMonth] = await Promise.all([
    query(`
      SELECT
        COALESCE(SUM(paid_amount), 0) collected,
        COALESCE(SUM(amount - paid_amount) FILTER (WHERE status != 'paid'), 0) pending,
        COALESCE(SUM(amount) FILTER (WHERE status = 'overdue'), 0) overdue
      FROM installment_schedules
      WHERE EXTRACT(year FROM due_date) = $1`, [year]),
    query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', due_date), 'Mon') month,
        SUM(paid_amount) collected,
        SUM(amount) FILTER (WHERE status = 'overdue') overdue
      FROM installment_schedules
      WHERE EXTRACT(year FROM due_date) = $1
      GROUP BY DATE_TRUNC('month', due_date)
      ORDER BY DATE_TRUNC('month', due_date)`, [year]),
  ]);

  res.json({ ...totals.rows[0], byMonth: byMonth.rows });
});

// GET /reports/units
router.get('/units', async (req, res) => {
  const [statusBreakdown, typeBreakdown] = await Promise.all([
    query(`SELECT status, COUNT(*) count, SUM(total_price) value FROM units GROUP BY status`),
    query(`SELECT unit_type type, COUNT(*) FILTER (WHERE status='available') available, COUNT(*) FILTER (WHERE status='sold') sold FROM units GROUP BY unit_type`),
  ]);

  res.json({ statusBreakdown: statusBreakdown.rows, typeBreakdown: typeBreakdown.rows });
});

// GET /reports/agents
router.get('/agents', async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const result = await query(`
    SELECT
      u.name, a.agent_code,
      COUNT(b.id) bookings_count,
      COALESCE(SUM(b.final_price), 0) total_sales,
      COALESCE(SUM(ac.commission_amt), 0) total_commission,
      COALESCE(AVG(b.final_price), 0) avg_deal
    FROM agents a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN bookings b ON b.agent_id = a.user_id AND EXTRACT(year FROM b.booking_date) = $1
    LEFT JOIN agent_commissions ac ON ac.agent_id = a.id
    GROUP BY a.id, u.name, a.agent_code
    ORDER BY total_sales DESC`, [year]);

  res.json({ agents: result.rows });
});

// GET /reports/financial
router.get('/financial', async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const [income, expenses, balance] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount), 0) total FROM payments WHERE EXTRACT(year FROM payment_date) = $1`, [year]),
    query(`SELECT COALESCE(SUM(amount), 0) total FROM expenses WHERE EXTRACT(year FROM date) = $1`, [year]),
    query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', d), 'Mon') month,
        income, expense, income - expense profit
      FROM (
        SELECT DATE_TRUNC('month', payment_date) d, SUM(amount) income, 0 expense FROM payments
        WHERE EXTRACT(year FROM payment_date) = $1 GROUP BY d
        UNION ALL
        SELECT DATE_TRUNC('month', date), 0, SUM(amount) FROM expenses
        WHERE EXTRACT(year FROM date) = $1 GROUP BY DATE_TRUNC('month', date)
      ) sub
      GROUP BY DATE_TRUNC('month', d), income, expense
      ORDER BY DATE_TRUNC('month', d)`, [year]),
  ]);

  res.json({
    income: income.rows[0].total,
    expenses: expenses.rows[0].total,
    profit: income.rows[0].total - expenses.rows[0].total,
    monthly: balance.rows,
  });
});

module.exports = router;

// routes/financeRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');

router.use(authenticate);

// GET /finance/accounts
router.get('/accounts', async (req, res) => {
  const result = await query(
    `SELECT c.*, COUNT(jl.id) entry_count,
            COALESCE(SUM(jl.debit), 0)  total_debit,
            COALESCE(SUM(jl.credit), 0) total_credit,
            COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) balance
     FROM chart_of_accounts c
     LEFT JOIN journal_lines jl ON jl.account_id = c.id
     WHERE c.is_active = true
     GROUP BY c.id
     ORDER BY c.code`
  );
  res.json({ data: result.rows });
});

// GET /finance/journal-entries
router.get('/journal-entries', async (req, res) => {
  const { page = 1, limit = 25, from_date, to_date } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];

  if (from_date) { conds.push(`e.date >= $${params.length+1}`); params.push(from_date); }
  if (to_date)   { conds.push(`e.date <= $${params.length+1}`); params.push(to_date); }

  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(
      `SELECT e.*, u.name created_by_name,
              COALESCE(SUM(jl.debit), 0) total_debit,
              COALESCE(SUM(jl.credit), 0) total_credit,
              COUNT(jl.id) line_count
       FROM journal_entries e
       LEFT JOIN users u ON u.id = e.created_by
       LEFT JOIN journal_lines jl ON jl.journal_entry_id = e.id
       WHERE ${where}
       GROUP BY e.id, u.name
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM journal_entries e WHERE ${where}`, params),
  ]);

  res.json({
    data: rows.rows,
    pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count) },
  });
});

// GET /finance/journal-entries/:id/lines
router.get('/journal-entries/:id/lines', async (req, res) => {
  const result = await query(
    `SELECT jl.*, c.name account_name, c.code account_code, c.type account_type
     FROM journal_lines jl
     JOIN chart_of_accounts c ON c.id = jl.account_id
     WHERE jl.journal_entry_id = $1`,
    [req.params.id]
  );
  res.json({ data: result.rows });
});

// POST /finance/journal-entries
router.post('/journal-entries', authorize('admin', 'accountant'), async (req, res) => {
  const { date, description, reference, lines } = req.body;

  if (!lines || lines.length < 2) {
    return res.status(400).json({ error: 'At least 2 journal lines required' });
  }

  const totalDebit  = lines.reduce((s, l) => s + parseFloat(l.debit  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return res.status(400).json({ error: `Journal not balanced: Debit ${totalDebit} ≠ Credit ${totalCredit}` });
  }

  await withTransaction(async (client) => {
    const countRes = await client.query('SELECT COUNT(*) FROM journal_entries');
    const entryNo  = `JV-${String(parseInt(countRes.rows[0].count) + 1).padStart(5, '0')}`;

    const entryRes = await client.query(
      `INSERT INTO journal_entries (entry_no, date, description, reference, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [entryNo, date, description, reference, req.user.id]
    );

    for (const line of lines) {
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES ($1,$2,$3,$4,$5)`,
        [entryRes.rows[0].id, line.account_id, line.debit || 0, line.credit || 0, line.description]
      );
    }

    res.status(201).json({ entry: entryRes.rows[0], entryNo });
  });
});

// GET /finance/balance-sheet
router.get('/balance-sheet', async (req, res) => {
  const result = await query(`
    SELECT c.type, c.name, c.code,
           COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) balance
    FROM chart_of_accounts c
    LEFT JOIN journal_lines jl ON jl.account_id = c.id
    WHERE c.is_active = true
    GROUP BY c.id
    ORDER BY c.code
  `);

  const grouped = result.rows.reduce((acc, row) => {
    if (!acc[row.type]) acc[row.type] = [];
    acc[row.type].push(row);
    return acc;
  }, {});

  res.json({ data: grouped });
});

// GET /finance/trial-balance
router.get('/trial-balance', async (req, res) => {
  const result = await query(`
    SELECT c.code, c.name, c.type,
           COALESCE(SUM(jl.debit), 0)  total_debit,
           COALESCE(SUM(jl.credit), 0) total_credit
    FROM chart_of_accounts c
    LEFT JOIN journal_lines jl ON jl.account_id = c.id
    WHERE c.is_active = true
    GROUP BY c.id
    HAVING COALESCE(SUM(jl.debit), 0) > 0 OR COALESCE(SUM(jl.credit), 0) > 0
    ORDER BY c.code
  `);

  const totalDebit  = result.rows.reduce((s, r) => s + parseFloat(r.total_debit),  0);
  const totalCredit = result.rows.reduce((s, r) => s + parseFloat(r.total_credit), 0);

  res.json({ data: result.rows, totalDebit, totalCredit });
});

// GET /finance/cash-flow
router.get('/cash-flow', async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const [inflows, outflows] = await Promise.all([
    query(
      `SELECT TO_CHAR(DATE_TRUNC('month', payment_date), 'Mon YY') label,
              DATE_TRUNC('month', payment_date) month_date,
              SUM(amount) amount
       FROM payments
       WHERE EXTRACT(year FROM payment_date) = $1
       GROUP BY DATE_TRUNC('month', payment_date)
       ORDER BY month_date`, [year]
    ),
    query(
      `SELECT TO_CHAR(DATE_TRUNC('month', date), 'Mon YY') label,
              DATE_TRUNC('month', date) month_date,
              SUM(amount) amount
       FROM expenses
       WHERE EXTRACT(year FROM date) = $1
       GROUP BY DATE_TRUNC('month', date)
       ORDER BY month_date`, [year]
    ),
  ]);

  res.json({ inflows: inflows.rows, outflows: outflows.rows });
});

module.exports = router;


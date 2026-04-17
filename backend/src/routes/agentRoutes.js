// routes/agentRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const bcrypt = require('bcryptjs');

router.use(authenticate);

// GET /agents
router.get('/', async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['a.is_active = true']; const params = [];

  if (search) {
    conds.push(`(u.name ILIKE $${params.length+1} OR a.agent_code ILIKE $${params.length+1})`);
    params.push(`%${search}%`);
  }

  const where = conds.join(' AND ');
  const result = await query(
    `SELECT a.*, u.name, u.phone, u.email, u.avatar_url,
            COUNT(DISTINCT b.id) total_bookings,
            COALESCE(SUM(b.final_price), 0) total_sales,
            COALESCE(SUM(ac.commission_amt), 0) total_commission,
            COUNT(DISTINCT b.id) FILTER (
              WHERE DATE_TRUNC('month', b.booking_date) = DATE_TRUNC('month', NOW())
            ) this_month_bookings
     FROM agents a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN bookings b ON b.agent_id = a.user_id AND b.status != 'cancelled'
     LEFT JOIN agent_commissions ac ON ac.agent_id = a.id
     WHERE ${where}
     GROUP BY a.id, u.name, u.phone, u.email, u.avatar_url
     ORDER BY total_sales DESC NULLS LAST
     LIMIT $${params.length+1} OFFSET $${params.length+2}`,
    [...params, limit, offset]
  );

  res.json({ data: result.rows });
});

// GET /agents/:id
router.get('/:id', async (req, res) => {
  const result = await query(
    `SELECT a.*, u.name, u.phone, u.email,
            COUNT(DISTINCT b.id) total_bookings,
            COALESCE(SUM(b.final_price), 0) total_sales,
            COALESCE(SUM(ac.commission_amt), 0) total_commission
     FROM agents a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN bookings b ON b.agent_id = a.user_id
     LEFT JOIN agent_commissions ac ON ac.agent_id = a.id
     WHERE a.id = $1
     GROUP BY a.id, u.name, u.phone, u.email`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Agent not found' });
  res.json({ agent: result.rows[0] });
});

// POST /agents  — create user + agent record
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  const {
    name, email, phone, cnic, password = 'Agent@123',
    commission_rate = 2.5, joining_date, target_monthly = 0,
  } = req.body;

  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  await withTransaction(async (client) => {
    // Create or find user
    let userId;
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
    } else {
      const hash = await bcrypt.hash(password, 12);
      const userRes = await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role)
         VALUES ($1,$2,$3,$4,'sales_agent') RETURNING id`,
        [name, email, phone, hash]
      );
      userId = userRes.rows[0].id;
    }

    // Generate agent code
    const countRes = await client.query('SELECT COUNT(*) FROM agents');
    const agentCode = `AGT-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;

    const result = await client.query(
      `INSERT INTO agents (user_id, agent_code, commission_rate, joining_date, target_monthly)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, agentCode, commission_rate, joining_date || new Date().toISOString().split('T')[0], target_monthly]
    );

    res.status(201).json({
      agent: result.rows[0],
      agentCode,
      message: `Agent created. Login: ${email} / ${password}`,
    });
  });
});

// PUT /agents/:id
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  const { commission_rate, target_monthly, is_active } = req.body;
  const result = await query(
    `UPDATE agents
     SET commission_rate=COALESCE($1, commission_rate),
         target_monthly=COALESCE($2, target_monthly),
         is_active=COALESCE($3, is_active)
     WHERE id=$4 RETURNING *`,
    [commission_rate, target_monthly, is_active, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Agent not found' });
  res.json({ agent: result.rows[0] });
});

// GET /agents/:id/bookings
router.get('/:id/bookings', async (req, res) => {
  const agent = await query('SELECT user_id FROM agents WHERE id = $1', [req.params.id]);
  if (!agent.rows[0]) return res.status(404).json({ error: 'Agent not found' });

  const result = await query(
    `SELECT b.*, c.name customer_name, u.unit_number, t.name tower_name
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     JOIN units u ON u.id = b.unit_id
     LEFT JOIN towers t ON t.id = u.tower_id
     WHERE b.agent_id = $1 AND b.status != 'cancelled'
     ORDER BY b.booking_date DESC`,
    [agent.rows[0].user_id]
  );
  res.json({ data: result.rows });
});

// GET /agents/:id/commissions
router.get('/:id/commissions', async (req, res) => {
  const result = await query(
    `SELECT ac.*, b.booking_no, c.name customer_name, u.unit_number
     FROM agent_commissions ac
     JOIN bookings b ON b.id = ac.booking_id
     JOIN customers c ON c.id = b.customer_id
     JOIN units u ON u.id = b.unit_id
     WHERE ac.agent_id = $1
     ORDER BY ac.created_at DESC`,
    [req.params.id]
  );
  res.json({ data: result.rows });
});

// POST /agents/:id/commissions/:commId/pay
router.post('/:id/commissions/:commId/pay', authorize('admin', 'accountant'), async (req, res) => {
  const result = await query(
    `UPDATE agent_commissions
     SET status='paid', paid_date=NOW()
     WHERE id=$1 AND agent_id=$2 RETURNING *`,
    [req.params.commId, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Commission not found' });
  res.json({ commission: result.rows[0] });
});

module.exports = router;


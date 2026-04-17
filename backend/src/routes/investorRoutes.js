// routes/investorRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const bcrypt = require('bcryptjs');

router.use(authenticate);

// GET /investors
router.get('/', async (req, res) => {
  const result = await query(
    `SELECT i.*, u.name, u.phone, u.email,
            COUNT(DISTINCT iu.unit_id) units_count,
            ROUND(i.investment_amount * i.rental_return_pct / 100 / 12, 2) monthly_return,
            ROUND(i.investment_amount * i.rental_return_pct / 100, 2) annual_return
     FROM investors i
     JOIN users u ON u.id = i.user_id
     LEFT JOIN investor_units iu ON iu.investor_id = i.id
     WHERE i.is_active = true
     GROUP BY i.id, u.name, u.phone, u.email
     ORDER BY i.investment_amount DESC`
  );
  res.json({ data: result.rows });
});

// GET /investors/:id
router.get('/:id', async (req, res) => {
  // Investors can only see their own profile
  if (req.user.role === 'investor') {
    const mine = await query(
      'SELECT id FROM investors WHERE user_id = $1', [req.user.id]
    );
    if (!mine.rows[0] || mine.rows[0].id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const [investor, units, distributions] = await Promise.all([
    query(
      `SELECT i.*, u.name, u.phone, u.email
       FROM investors i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
      [req.params.id]
    ),
    query(
      `SELECT un.*, iu.share_pct, t.name tower_name
       FROM investor_units iu
       JOIN units un ON un.id = iu.unit_id
       LEFT JOIN towers t ON t.id = un.tower_id
       WHERE iu.investor_id = $1`,
      [req.params.id]
    ),
    query(
      `SELECT * FROM rental_distributions
       WHERE investor_id = $1 ORDER BY created_at DESC LIMIT 24`,
      [req.params.id]
    ),
  ]);

  if (!investor.rows[0]) return res.status(404).json({ error: 'Investor not found' });

  res.json({
    investor: investor.rows[0],
    units: units.rows,
    distributions: distributions.rows,
  });
});

// POST /investors
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  const {
    name, email, phone, cnic, password = 'Investor@123',
    investment_amount, investment_date,
    rental_return_pct = 12,
  } = req.body;

  if (!name || !email || !investment_amount) {
    return res.status(400).json({ error: 'Name, email, investment amount required' });
  }

  await withTransaction(async (client) => {
    // Create user
    const hash = await bcrypt.hash(password, 12);
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await client.query("UPDATE users SET role='investor' WHERE id=$1", [userId]);
    } else {
      const u = await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role)
         VALUES ($1,$2,$3,$4,'investor') RETURNING id`,
        [name, email, phone, hash]
      );
      userId = u.rows[0].id;
    }

    const countRes = await client.query('SELECT COUNT(*) FROM investors');
    const invCode  = `INV-${String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0')}`;

    const result = await client.query(
      `INSERT INTO investors
         (user_id, investor_code, investment_amount, investment_date, rental_return_pct)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, invCode, investment_amount, investment_date || new Date().toISOString().split('T')[0], rental_return_pct]
    );

    res.status(201).json({
      investor: result.rows[0],
      investorCode: invCode,
      message: `Investor created. Login: ${email} / ${password}`,
    });
  });
});

// PUT /investors/:id
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  const { investment_amount, rental_return_pct, is_active } = req.body;
  const result = await query(
    `UPDATE investors
     SET investment_amount=COALESCE($1, investment_amount),
         rental_return_pct=COALESCE($2, rental_return_pct),
         is_active=COALESCE($3, is_active)
     WHERE id=$4 RETURNING *`,
    [investment_amount, rental_return_pct, is_active, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Investor not found' });
  res.json({ investor: result.rows[0] });
});

// POST /investors/:id/units  — assign unit to investor
router.post('/:id/units', authorize('admin', 'manager'), async (req, res) => {
  const { unit_id, share_pct = 100 } = req.body;
  const result = await query(
    `INSERT INTO investor_units (investor_id, unit_id, share_pct)
     VALUES ($1,$2,$3)
     ON CONFLICT (investor_id, unit_id) DO UPDATE SET share_pct = $3
     RETURNING *`,
    [req.params.id, unit_id, share_pct]
  );
  res.status(201).json({ assignment: result.rows[0] });
});

// GET /investors/distributions
router.get('/distributions', async (req, res) => {
  const { month_year, page = 1, limit = 25 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];

  if (month_year) { conds.push(`rd.month_year = $${params.length+1}`); params.push(month_year); }

  // Investors can only see their own
  if (req.user.role === 'investor') {
    const inv = await query('SELECT id FROM investors WHERE user_id = $1', [req.user.id]);
    if (inv.rows[0]) {
      conds.push(`rd.investor_id = $${params.length+1}`);
      params.push(inv.rows[0].id);
    }
  }

  const result = await query(
    `SELECT rd.*, u.name investor_name, u.phone investor_phone
     FROM rental_distributions rd
     JOIN investors i ON i.id = rd.investor_id
     JOIN users u ON u.id = i.user_id
     WHERE ${conds.join(' AND ')}
     ORDER BY rd.created_at DESC
     LIMIT $${params.length+1} OFFSET $${params.length+2}`,
    [...params, limit, offset]
  );
  res.json({ data: result.rows });
});

// POST /investors/distributions/:id/pay
router.post('/distributions/:id/pay', authorize('admin', 'accountant'), async (req, res) => {
  const { payment_method = 'bank' } = req.body;
  const result = await query(
    `UPDATE rental_distributions
     SET status='paid', payment_date=NOW(), payment_method=$1
     WHERE id=$2 RETURNING *`,
    [payment_method, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Distribution not found' });
  res.json({ distribution: result.rows[0] });
});

// GET /investors/summary
router.get('/summary', async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) total_investors,
      COALESCE(SUM(investment_amount), 0) total_investment,
      COALESCE(AVG(rental_return_pct), 12) avg_return_pct,
      COALESCE(SUM(investment_amount * rental_return_pct / 100 / 12), 0) monthly_payout
    FROM investors WHERE is_active = true
  `);
  res.json({ summary: result.rows[0] });
});

module.exports = router;


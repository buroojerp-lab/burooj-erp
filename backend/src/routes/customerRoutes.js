// ════════════════════════════════════════════════
// BUROOJ ERP - REMAINING BACKEND ROUTES
// ════════════════════════════════════════════════

// ── routes/customerRoutes.js ──
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

router.get('/', async (req, res) => {
  const { search, lead_source, page = 1, limit = 25 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];

  if (search) {
    conds.push(`(c.name ILIKE $${params.length+1} OR c.cnic ILIKE $${params.length+1} OR c.phone ILIKE $${params.length+1})`);
    params.push(`%${search}%`);
  }
  if (lead_source) { conds.push(`c.lead_source = $${params.length+1}`); params.push(lead_source); }

  const where = conds.join(' AND ');
  const [rows, total, stats] = await Promise.all([
    query(`
      SELECT c.*,
             u.unit_number, u.unit_type, u.size_sqft,
             b.id booking_id, b.booking_no, b.status booking_status, b.final_price,
             b.down_payment_amount,
             t.name tower_name, f.floor_no,
             COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = b.id), 0) total_paid
      FROM customers c
      LEFT JOIN bookings b ON b.customer_id = c.id AND b.status != 'cancelled'
      LEFT JOIN units u ON u.id = b.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN floors f ON f.id = u.floor_id
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]),
    query(`SELECT COUNT(*) FROM customers c WHERE ${where}`, params),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE b.id IS NOT NULL) with_bookings,
        COUNT(*) FILTER (WHERE DATE_TRUNC('month', c.created_at) = DATE_TRUNC('month', NOW())) this_month,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(DISTINCT b.id)::numeric / COUNT(DISTINCT c.id) * 100)
          ELSE 0 END conversion_rate
      FROM customers c
      LEFT JOIN bookings b ON b.customer_id = c.id AND b.status = 'active'`),
  ]);

  res.json({
    data: rows.rows,
    stats: stats.rows[0],
    pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count), pages: Math.ceil(total.rows[0].count / limit) },
  });
});

router.post('/', async (req, res) => {
  const { name, cnic, phone, email, address, city, occupation, lead_source, ntn, nationality, notes } = req.body;
  if (!name || !cnic || !phone) return res.status(400).json({ error: 'Name, CNIC and phone required' });

  const exists = await query('SELECT id FROM customers WHERE cnic = $1', [cnic]);
  if (exists.rows[0]) return res.status(409).json({ error: 'CNIC already registered' });

  const result = await query(
    `INSERT INTO customers (name, cnic, phone, email, address, city, occupation, lead_source, ntn, nationality, notes, agent_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [name, cnic, phone, email, address, city, occupation, lead_source, ntn, nationality, notes, req.user.id]
  );
  res.status(201).json({ customer: result.rows[0] });
});

router.get('/:id', async (req, res) => {
  const [cust, bookings, payments] = await Promise.all([
    query('SELECT * FROM customers WHERE id = $1', [req.params.id]),
    query(`SELECT b.*, u.unit_number, u.unit_type, u.size_sqft,
              t.name tower_name, f.floor_no, pp.name plan_name,
              COALESCE(SUM(p.amount),0) total_paid,
              (SELECT COUNT(*) FROM installment_schedules WHERE booking_id=b.id) total_count,
              (SELECT COUNT(*) FROM installment_schedules WHERE booking_id=b.id AND status='paid') paid_count
            FROM bookings b
            JOIN units u ON u.id = b.unit_id
            LEFT JOIN towers t ON t.id = u.tower_id
            LEFT JOIN floors f ON f.id = u.floor_id
            LEFT JOIN payment_plans pp ON pp.id = b.payment_plan_id
            LEFT JOIN payments p ON p.booking_id = b.id
            WHERE b.customer_id = $1
            GROUP BY b.id, u.unit_number, u.unit_type, u.size_sqft, t.name, f.floor_no, pp.name`, [req.params.id]),
    query(`SELECT p.*, s.installment_no FROM payments p LEFT JOIN installment_schedules s ON s.id = p.installment_id JOIN bookings b ON b.id = p.booking_id WHERE b.customer_id = $1 ORDER BY p.payment_date DESC LIMIT 20`, [req.params.id]),
  ]);
  if (!cust.rows[0]) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer: cust.rows[0], bookings: bookings.rows, payments: payments.rows });
});

router.delete('/:id', authorize('admin', 'manager'), async (req, res) => {
  const booking = await query(
    "SELECT id FROM bookings WHERE customer_id = $1 AND status NOT IN ('cancelled') LIMIT 1",
    [req.params.id]
  );
  if (booking.rows[0]) {
    return res.status(409).json({ error: 'Cannot delete customer with active bookings. Cancel all bookings first.' });
  }
  await query('DELETE FROM customers WHERE id = $1', [req.params.id]);
  res.json({ message: 'Customer deleted' });
});

router.put('/:id', async (req, res) => {
  const { name, phone, email, address, city, occupation, lead_source, nationality, ntn, notes } = req.body;
  const result = await query(
    `UPDATE customers SET name=COALESCE($1,name), phone=COALESCE($2,phone), email=COALESCE($3,email),
     address=COALESCE($4,address), city=COALESCE($5,city), occupation=COALESCE($6,occupation),
     lead_source=COALESCE($7,lead_source), nationality=COALESCE($8,nationality),
     ntn=COALESCE($9,ntn), notes=COALESCE($10,notes), updated_at=NOW() WHERE id=$11 RETURNING *`,
    [name, phone, email, address, city, occupation, lead_source, nationality, ntn, notes, req.params.id]
  );
  res.json({ customer: result.rows[0] });
});

module.exports = router;

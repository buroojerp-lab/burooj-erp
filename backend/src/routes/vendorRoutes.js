// routes/vendorRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// GET /vendors
router.get('/', async (req, res) => {
  const { search, category, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['is_active = true']; const params = [];

  if (search) {
    conds.push(`(name ILIKE $${params.length+1} OR contact_name ILIKE $${params.length+1})`);
    params.push(`%${search}%`);
  }
  if (category) { conds.push(`category = $${params.length+1}`); params.push(category); }

  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(
      `SELECT v.*,
              COUNT(po.id) total_orders,
              COALESCE(SUM(po.total_amount), 0) total_purchased
       FROM vendors v
       LEFT JOIN purchase_orders po ON po.vendor_id = v.id
       WHERE ${where}
       GROUP BY v.id
       ORDER BY v.name
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM vendors WHERE ${where}`, params),
  ]);

  res.json({
    data: rows.rows,
    pagination: {
      page: parseInt(page), limit: parseInt(limit),
      total: parseInt(total.rows[0].count),
    },
  });
});

// GET /vendors/:id
router.get('/:id', async (req, res) => {
  const result = await query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Vendor not found' });
  res.json({ vendor: result.rows[0] });
});

// POST /vendors
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  const { name, contact_name, phone, email, address, category, tax_no } = req.body;
  if (!name) return res.status(400).json({ error: 'Vendor name required' });

  const result = await query(
    `INSERT INTO vendors (name, contact_name, phone, email, address, category, tax_no)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, contact_name, phone, email, address, category, tax_no]
  );
  res.status(201).json({ vendor: result.rows[0] });
});

// PUT /vendors/:id
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  const { name, contact_name, phone, email, address, category, tax_no, rating, is_active } = req.body;
  const result = await query(
    `UPDATE vendors SET
       name=COALESCE($1,name), contact_name=COALESCE($2,contact_name),
       phone=COALESCE($3,phone), email=COALESCE($4,email),
       address=COALESCE($5,address), category=COALESCE($6,category),
       tax_no=COALESCE($7,tax_no), rating=COALESCE($8,rating),
       is_active=COALESCE($9,is_active)
     WHERE id=$10 RETURNING *`,
    [name, contact_name, phone, email, address, category, tax_no, rating, is_active, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Vendor not found' });
  res.json({ vendor: result.rows[0] });
});

// DELETE /vendors/:id  (soft delete)
router.delete('/:id', authorize('admin', 'manager'), async (req, res) => {
  await query('UPDATE vendors SET is_active = false WHERE id = $1', [req.params.id]);
  res.json({ message: 'Vendor deactivated' });
});

// GET /vendors/categories
router.get('/meta/categories', async (req, res) => {
  const result = await query(
    'SELECT DISTINCT category FROM vendors WHERE category IS NOT NULL ORDER BY category'
  );
  res.json({ categories: result.rows.map(r => r.category) });
});

module.exports = router;


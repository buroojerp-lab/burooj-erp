// routes/procurementRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');

router.use(authenticate);

// GET /procurement/orders
router.get('/orders', async (req, res) => {
  const { status, vendor_id, page = 1, limit = 25 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];

  if (status)    { conds.push(`po.status = $${params.length+1}`);    params.push(status); }
  if (vendor_id) { conds.push(`po.vendor_id = $${params.length+1}`); params.push(vendor_id); }

  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(
      `SELECT po.*, v.name vendor_name, v.phone vendor_phone,
              u.name created_by_name,
              COUNT(pi.id) item_count
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       LEFT JOIN users u ON u.id = po.created_by
       LEFT JOIN po_items pi ON pi.po_id = po.id
       WHERE ${where}
       GROUP BY po.id, v.name, v.phone, u.name
       ORDER BY po.created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM purchase_orders po WHERE ${where}`, params),
  ]);

  res.json({
    data: rows.rows,
    pagination: {
      page: parseInt(page), limit: parseInt(limit),
      total: parseInt(total.rows[0].count),
      pages: Math.ceil(total.rows[0].count / limit),
    },
  });
});

// GET /procurement/orders/:id
router.get('/orders/:id', async (req, res) => {
  const [po, items] = await Promise.all([
    query(
      `SELECT po.*, v.name vendor_name, v.phone vendor_phone, v.email vendor_email,
              u.name created_by_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       LEFT JOIN users u ON u.id = po.created_by
       WHERE po.id = $1`,
      [req.params.id]
    ),
    query(
      'SELECT * FROM po_items WHERE po_id = $1 ORDER BY id',
      [req.params.id]
    ),
  ]);

  if (!po.rows[0]) return res.status(404).json({ error: 'Purchase order not found' });
  res.json({ po: po.rows[0], items: items.rows });
});

// POST /procurement/orders
router.post('/orders', authorize('admin', 'manager'), async (req, res) => {
  const { vendor_id, order_date, delivery_date, notes, items = [] } = req.body;

  if (!vendor_id) return res.status(400).json({ error: 'Vendor required' });
  if (!items.length) return res.status(400).json({ error: 'At least one item required' });

  await withTransaction(async (client) => {
    const countRes = await client.query('SELECT COUNT(*) FROM purchase_orders');
    const poNo = `PO-${new Date().getFullYear()}-${String(parseInt(countRes.rows[0].count) + 1).padStart(4, '0')}`;

    const subtotal  = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0);
    const taxAmount = subtotal * 0.17; // 17% GST
    const total     = subtotal + taxAmount;

    const poRes = await client.query(
      `INSERT INTO purchase_orders
         (po_number, vendor_id, order_date, delivery_date, subtotal, tax_amount, total_amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [poNo, vendor_id, order_date, delivery_date, subtotal, taxAmount, total, notes, req.user.id]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO po_items (po_id, item_name, description, quantity, unit, unit_price)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [poRes.rows[0].id, item.item_name, item.description, item.quantity, item.unit, item.unit_price]
      );
    }

    res.status(201).json({ po: poRes.rows[0], poNo });
  });
});

// PUT /procurement/orders/:id/status
router.put('/orders/:id/status', authorize('admin', 'manager'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'sent', 'confirmed', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
  }

  const result = await query(
    'UPDATE purchase_orders SET status=$1 WHERE id=$2 RETURNING *',
    [status, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'PO not found' });
  res.json({ po: result.rows[0] });
});

// GET /procurement/stats
router.get('/stats', async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) total_orders,
      COUNT(*) FILTER (WHERE status = 'draft') draft,
      COUNT(*) FILTER (WHERE status = 'confirmed') confirmed,
      COUNT(*) FILTER (WHERE status = 'delivered') delivered,
      COALESCE(SUM(total_amount), 0) total_value,
      COALESCE(SUM(total_amount) FILTER (
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
      ), 0) this_month_value
    FROM purchase_orders
  `);
  res.json({ stats: result.rows[0] });
});

module.exports = router;


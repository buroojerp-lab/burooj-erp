// routes/facilityRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// GET /facility/tickets
router.get('/tickets', async (req, res) => {
  const { status, priority, page = 1, limit = 25 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];

  if (status)   { conds.push(`t.status = $${params.length+1}`);   params.push(status); }
  if (priority) { conds.push(`t.priority = $${params.length+1}`); params.push(priority); }

  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(
      `SELECT t.*, u.unit_number, c.name customer_name,
              a.name assigned_to_name
       FROM maintenance_tickets t
       LEFT JOIN units u ON u.id = t.unit_id
       LEFT JOIN customers c ON c.id = t.customer_id
       LEFT JOIN users a ON a.id = t.assigned_to
       WHERE ${where}
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         t.created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM maintenance_tickets t WHERE ${where}`, params),
  ]);

  res.json({
    data: rows.rows,
    pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count) },
  });
});

// GET /facility/tickets/:id
router.get('/tickets/:id', async (req, res) => {
  const result = await query(
    `SELECT t.*, u.unit_number, c.name customer_name, a.name assigned_to_name
     FROM maintenance_tickets t
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN users a ON a.id = t.assigned_to
     WHERE t.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ ticket: result.rows[0] });
});

// POST /facility/tickets
router.post('/tickets', async (req, res) => {
  const { title, description, category, priority, unit_id, customer_id } = req.body;

  if (!title) return res.status(400).json({ error: 'Title required' });

  const countRes = await query('SELECT COUNT(*) FROM maintenance_tickets');
  const ticketNo = `TKT-${String(parseInt(countRes.rows[0].count) + 1).padStart(4, '0')}`;

  const result = await query(
    `INSERT INTO maintenance_tickets
       (ticket_no, title, description, category, priority, unit_id, customer_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [ticketNo, title, description, category, priority || 'medium', unit_id, customer_id]
  );

  res.status(201).json({ ticket: result.rows[0] });
});

// PUT /facility/tickets/:id/status
router.put('/tickets/:id/status', async (req, res) => {
  const { status, resolution_note, assigned_to } = req.body;

  const resolvedAt = status === 'resolved' ? 'NOW()' : 'NULL';
  const result = await query(
    `UPDATE maintenance_tickets
     SET status=$1, resolution_note=COALESCE($2,resolution_note),
         assigned_to=COALESCE($3,assigned_to),
         resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
         updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [status, resolution_note, assigned_to, req.params.id]
  );

  if (!result.rows[0]) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ ticket: result.rows[0] });
});

// PUT /facility/tickets/:id
router.put('/tickets/:id', async (req, res) => {
  const { title, description, category, priority, assigned_to } = req.body;
  const result = await query(
    `UPDATE maintenance_tickets
     SET title=COALESCE($1,title), description=COALESCE($2,description),
         category=COALESCE($3,category), priority=COALESCE($4,priority),
         assigned_to=COALESCE($5,assigned_to), updated_at=NOW()
     WHERE id=$6 RETURNING *`,
    [title, description, category, priority, assigned_to, req.params.id]
  );
  res.json({ ticket: result.rows[0] });
});

// GET /facility/stats
router.get('/stats', async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) total,
      COUNT(*) FILTER (WHERE status = 'open') open,
      COUNT(*) FILTER (WHERE status = 'in_progress') in_progress,
      COUNT(*) FILTER (WHERE status = 'resolved') resolved,
      COUNT(*) FILTER (WHERE priority = 'urgent' AND status = 'open') urgent_open
    FROM maintenance_tickets
  `);
  res.json({ stats: result.rows[0] });
});

module.exports = router;


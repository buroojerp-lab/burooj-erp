// routes/userRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

router.use(authenticate);

// GET /users  (admin/manager only)
router.get('/', authorize('admin', 'manager'), async (req, res) => {
  const { role, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];

  if (role) { conds.push(`role = $${params.length+1}`); params.push(role); }

  const [rows, total] = await Promise.all([
    query(
      `SELECT id, name, email, phone, role, is_active, last_login, created_at
       FROM users WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM users WHERE ${conds.join(' AND ')}`, params),
  ]);

  res.json({
    data: rows.rows,
    pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count) },
  });
});

// GET /users/:id
router.get('/:id', async (req, res) => {
  // Non-admins can only view themselves
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await query(
    'SELECT id, name, email, phone, role, is_active, last_login, avatar_url, created_at FROM users WHERE id = $1',
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
});

// PUT /users/:id  (admin or self)
router.put('/:id', async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, phone, avatar_url } = req.body;
  const result = await query(
    `UPDATE users SET
       name=COALESCE($1,name), phone=COALESCE($2,phone), avatar_url=COALESCE($3,avatar_url),
       updated_at=NOW()
     WHERE id=$4 RETURNING id, name, email, phone, role, avatar_url`,
    [name, phone, avatar_url, req.params.id]
  );
  res.json({ user: result.rows[0] });
});

// PUT /users/:id/toggle  (admin only)
router.put('/:id/toggle', authorize('admin'), async (req, res) => {
  const { is_active } = req.body;
  const result = await query(
    'UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, is_active',
    [is_active, req.params.id]
  );
  res.json({ user: result.rows[0] });
});

// PUT /users/:id/role  (admin only)
router.put('/:id/role', authorize('admin'), async (req, res) => {
  const { role } = req.body;
  const validRoles = ['admin','manager','sales_agent','accountant','investor','customer'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const result = await query(
    'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, name, role',
    [role, req.params.id]
  );
  res.json({ user: result.rows[0] });
});

// DELETE /users/:id (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ message: 'User deleted' });
});

module.exports = router;


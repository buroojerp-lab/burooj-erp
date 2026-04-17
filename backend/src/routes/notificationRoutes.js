// routes/notificationRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// GET /notifications
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (page - 1) * limit;
  const conds = [`user_id = $1`]; const params = [req.user.id];

  if (unread_only === 'true') { conds.push('is_read = false'); }

  const where = conds.join(' AND ');
  const [rows, unreadCount] = await Promise.all([
    query(
      `SELECT * FROM notifications WHERE ${where}
       ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false', [req.user.id]),
  ]);

  res.json({ data: rows.rows, unreadCount: parseInt(unreadCount.rows[0].count) });
});

// PUT /notifications/:id/read
router.put('/:id/read', async (req, res) => {
  await query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  res.json({ message: 'Marked as read' });
});

// PUT /notifications/read-all
router.put('/read-all', async (req, res) => {
  await query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1',
    [req.user.id]
  );
  res.json({ message: 'All notifications marked as read' });
});

// POST /notifications (admin broadcast)
router.post('/', async (req, res) => {
  const { title, body, type, user_ids } = req.body;

  if (!title) return res.status(400).json({ error: 'Title required' });

  const targets = user_ids?.length
    ? user_ids
    : (await query('SELECT id FROM users WHERE is_active = true')).rows.map(r => r.id);

  const inserts = targets.map(uid =>
    query(
      'INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,$4)',
      [uid, title, body, type || 'system']
    )
  );

  await Promise.all(inserts);
  res.status(201).json({ message: `Notification sent to ${targets.length} users` });
});

module.exports = router;


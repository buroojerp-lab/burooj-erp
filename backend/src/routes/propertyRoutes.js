// ── propertyRoutes.js ──
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
const router = express.Router();

router.use(authenticate);

// Towers
router.get('/towers', async (req, res) => {
  const result = await query('SELECT * FROM towers ORDER BY name');
  res.json({ data: result.rows });
});

router.post('/towers', authorize('admin', 'manager'), async (req, res) => {
  const { name, code, total_floors, description } = req.body;
  const result = await query(
    'INSERT INTO towers (name, code, total_floors, description) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, code, total_floors, description]
  );
  res.status(201).json({ tower: result.rows[0] });
});

router.delete('/towers/:id', authorize('admin', 'manager'), async (req, res) => {
  const { id } = req.params;
  const units = await query('SELECT COUNT(*) FROM units WHERE tower_id = $1', [id]);
  if (parseInt(units.rows[0].count) > 0) {
    return res.status(400).json({ error: 'Cannot delete tower with existing units. Remove all units first.' });
  }
  await query('DELETE FROM floors WHERE tower_id = $1', [id]);
  const result = await query('DELETE FROM towers WHERE id = $1 RETURNING *', [id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Tower not found' });
  res.json({ message: 'Tower deleted', tower: result.rows[0] });
});

// Floors
router.get('/floors', async (req, res) => {
  const { tower_id } = req.query;
  const result = await query(
    'SELECT f.*, t.name tower_name FROM floors f JOIN towers t ON t.id = f.tower_id WHERE ($1::uuid IS NULL OR f.tower_id = $1) ORDER BY floor_no',
    [tower_id || null]
  );
  res.json({ data: result.rows });
});

router.post('/floors', authorize('admin', 'manager'), async (req, res) => {
  const { tower_id, floor_no, name } = req.body;
  const result = await query(
    'INSERT INTO floors (tower_id, floor_no, name) VALUES ($1,$2,$3) RETURNING *',
    [tower_id, floor_no, name]
  );
  res.status(201).json({ floor: result.rows[0] });
});

// Units
router.get('/units', async (req, res) => {
  const { status, unit_type, tower_id, floor_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (status)    { conditions.push(`u.status = $${params.length+1}`); params.push(status); }
  if (unit_type) { conditions.push(`u.unit_type = $${params.length+1}`); params.push(unit_type); }
  if (tower_id)  { conditions.push(`u.tower_id = $${params.length+1}`); params.push(tower_id); }
  if (floor_id)  { conditions.push(`u.floor_id = $${params.length+1}`); params.push(floor_id); }

  const where = conditions.join(' AND ');
  const [rows, total] = await Promise.all([
    query(
      `SELECT u.*, t.name tower_name, f.floor_no,
              b.id as booking_id, b.booking_no, c.name customer_name
       FROM units u
       LEFT JOIN towers t ON t.id = u.tower_id
       LEFT JOIN floors f ON f.id = u.floor_id
       LEFT JOIN bookings b ON b.unit_id = u.id AND b.status != 'cancelled'
       LEFT JOIN customers c ON c.id = b.customer_id
       WHERE ${where}
       ORDER BY t.name, f.floor_no, u.unit_number
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM units u WHERE ${where}`, params),
  ]);

  res.json({
    data: rows.rows,
    pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count) },
  });
});

// POST /property/units/merge — merge two available units into one
router.post('/units/merge', authorize('admin', 'manager'), async (req, res) => {
  const { unit_a_id, unit_b_id, new_unit_number } = req.body;
  if (!unit_a_id || !unit_b_id || !new_unit_number) {
    return res.status(400).json({ error: 'unit_a_id, unit_b_id, and new_unit_number are required' });
  }
  if (unit_a_id === unit_b_id) {
    return res.status(400).json({ error: 'Cannot merge a unit with itself' });
  }

  const { withTransaction } = require('../config/database');
  await withTransaction(async (client) => {
    // Fetch both units
    const [resA, resB] = await Promise.all([
      client.query('SELECT * FROM units WHERE id = $1 FOR UPDATE', [unit_a_id]),
      client.query('SELECT * FROM units WHERE id = $1 FOR UPDATE', [unit_b_id]),
    ]);
    const a = resA.rows[0]; const b = resB.rows[0];
    if (!a || !b) throw { status: 404, message: 'One or both units not found' };
    if (a.status !== 'available' || b.status !== 'available') {
      throw { status: 400, message: 'Both units must be available (not sold/reserved) to merge' };
    }

    const mergedSize = parseFloat(a.size_sqft || 0) + parseFloat(b.size_sqft || 0);
    const avgPricePerSqft = ((parseFloat(a.price_per_sqft || 0) + parseFloat(b.price_per_sqft || 0)) / 2).toFixed(2);

    // Create merged unit on same floor/tower as unit_a
    const merged = await client.query(
      `INSERT INTO units (unit_number, tower_id, floor_id, unit_type, size_sqft, price_per_sqft,
        bedrooms, bathrooms, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'available') RETURNING *`,
      [new_unit_number, a.tower_id, a.floor_id, a.unit_type, mergedSize, avgPricePerSqft,
       Math.max(a.bedrooms||0, b.bedrooms||0), Math.max(a.bathrooms||0, b.bathrooms||0),
       `Merged from ${a.unit_number} + ${b.unit_number}`]
    );

    // Mark originals as merged
    await client.query(
      `UPDATE units SET status = 'merged', description = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
      [`Merged into ${new_unit_number}`, [unit_a_id, unit_b_id]]
    );

    res.status(201).json({ merged_unit: merged.rows[0], message: `Units merged into ${new_unit_number}` });
  });
});

router.get('/units/:id', async (req, res) => {
  const result = await query(
    `SELECT u.*, t.name tower_name, f.floor_no FROM units u
     LEFT JOIN towers t ON t.id = u.tower_id
     LEFT JOIN floors f ON f.id = u.floor_id
     WHERE u.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Unit not found' });
  res.json({ unit: result.rows[0] });
});

router.post('/units', authorize('admin', 'manager'), async (req, res) => {
  const { unit_number, tower_id, floor_id, unit_type, size_sqft, price_per_sqft, bedrooms, bathrooms, description, amenities } = req.body;
  const result = await query(
    `INSERT INTO units (unit_number, tower_id, floor_id, unit_type, size_sqft, price_per_sqft, bedrooms, bathrooms, description, amenities)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [unit_number, tower_id, floor_id, unit_type || 'apartment', size_sqft, price_per_sqft, bedrooms || 0, bathrooms || 0, description, JSON.stringify(amenities || [])]
  );
  res.status(201).json({ unit: result.rows[0] });
});

router.put('/units/:id', authorize('admin', 'manager'), async (req, res) => {
  const { unit_number, size_sqft, price_per_sqft, status, bedrooms, bathrooms, description, amenities } = req.body;
  const result = await query(
    `UPDATE units SET unit_number=COALESCE($1,unit_number), size_sqft=COALESCE($2,size_sqft),
     price_per_sqft=COALESCE($3,price_per_sqft), status=COALESCE($4,status),
     bedrooms=COALESCE($5,bedrooms), bathrooms=COALESCE($6,bathrooms),
     description=COALESCE($7,description), amenities=COALESCE($8,amenities), updated_at=NOW()
     WHERE id=$9 RETURNING *`,
    [unit_number, size_sqft, price_per_sqft, status, bedrooms, bathrooms, description, amenities ? JSON.stringify(amenities) : null, req.params.id]
  );
  res.json({ unit: result.rows[0] });
});

module.exports = router;

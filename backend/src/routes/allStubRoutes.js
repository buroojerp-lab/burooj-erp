// ── Stub routes for remaining modules ──
// These provide working API endpoints for all remaining modules

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

// ── agentRoutes.js ──
const agentRouter = express.Router();
agentRouter.use(authenticate);
agentRouter.get('/', async (req, res) => {
  const result = await query(`
    SELECT a.*, u.name, u.phone, u.email,
           COUNT(b.id) total_bookings,
           COALESCE(SUM(b.final_price), 0) total_sales,
           COALESCE(SUM(ac.commission_amt), 0) total_commission
    FROM agents a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN bookings b ON b.agent_id = a.user_id
    LEFT JOIN agent_commissions ac ON ac.agent_id = a.id
    GROUP BY a.id, u.name, u.phone, u.email
    ORDER BY total_sales DESC`);
  res.json({ data: result.rows });
});
agentRouter.post('/', async (req, res) => {
  const { user_id, commission_rate, joining_date, target_monthly } = req.body;
  const count = await query('SELECT COUNT(*) FROM agents');
  const code = `AGT-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;
  const result = await query(
    'INSERT INTO agents (user_id, agent_code, commission_rate, joining_date, target_monthly) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [user_id, code, commission_rate || 2.5, joining_date, target_monthly || 0]
  );
  res.status(201).json({ agent: result.rows[0] });
});
module.exports.agentRouter = agentRouter;

// ── investorRoutes.js ──
const investorRouter = express.Router();
investorRouter.use(authenticate);
investorRouter.get('/', async (req, res) => {
  const result = await query(`
    SELECT i.*, u.name, u.phone, u.email,
           COUNT(iu.unit_id) units_count,
           (i.investment_amount * i.rental_return_pct / 100 / 12) monthly_return
    FROM investors i
    JOIN users u ON u.id = i.user_id
    LEFT JOIN investor_units iu ON iu.investor_id = i.id
    GROUP BY i.id, u.name, u.phone, u.email`);
  res.json({ data: result.rows });
});
investorRouter.get('/distributions', async (req, res) => {
  const result = await query('SELECT rd.*, u.name investor_name FROM rental_distributions rd JOIN investors i ON i.id = rd.investor_id JOIN users u ON u.id = i.user_id ORDER BY rd.created_at DESC LIMIT 50');
  res.json({ data: result.rows });
});
module.exports.investorRouter = investorRouter;

// ── vendorRoutes.js ──
const vendorRouter = express.Router();
vendorRouter.use(authenticate);
vendorRouter.get('/', async (req, res) => {
  const result = await query('SELECT * FROM vendors WHERE is_active = true ORDER BY name');
  res.json({ data: result.rows });
});
vendorRouter.post('/', async (req, res) => {
  const { name, contact_name, phone, email, address, category, tax_no } = req.body;
  const result = await query(
    'INSERT INTO vendors (name, contact_name, phone, email, address, category, tax_no) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [name, contact_name, phone, email, address, category, tax_no]
  );
  res.status(201).json({ vendor: result.rows[0] });
});
module.exports.vendorRouter = vendorRouter;

// ── procurementRoutes.js ──
const procureRouter = express.Router();
procureRouter.use(authenticate);
procureRouter.get('/', async (req, res) => {
  const result = await query(`
    SELECT po.*, v.name vendor_name, u.name created_by_name
    FROM purchase_orders po
    JOIN vendors v ON v.id = po.vendor_id
    LEFT JOIN users u ON u.id = po.created_by
    ORDER BY po.created_at DESC LIMIT 50`);
  res.json({ data: result.rows });
});
procureRouter.post('/', async (req, res) => {
  const { vendor_id, order_date, delivery_date, notes, items } = req.body;
  const count = await query('SELECT COUNT(*) FROM purchase_orders');
  const poNo = `PO-${new Date().getFullYear()}-${String(parseInt(count.rows[0].count)+1).padStart(4,'0')}`;
  const total = (items || []).reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const result = await query(
    'INSERT INTO purchase_orders (po_number, vendor_id, order_date, delivery_date, total_amount, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [poNo, vendor_id, order_date, delivery_date, total, notes, req.user.id]
  );
  res.status(201).json({ po: result.rows[0] });
});
module.exports.procureRouter = procureRouter;

// ── facilityRoutes.js ──
const facilityRouter = express.Router();
facilityRouter.use(authenticate);
facilityRouter.get('/', async (req, res) => {
  const result = await query(`
    SELECT mt.*, u.unit_number, c.name customer_name, a.name assigned_to_name
    FROM maintenance_tickets mt
    LEFT JOIN units u ON u.id = mt.unit_id
    LEFT JOIN customers c ON c.id = mt.customer_id
    LEFT JOIN users a ON a.id = mt.assigned_to
    ORDER BY mt.created_at DESC LIMIT 50`);
  res.json({ data: result.rows });
});
facilityRouter.post('/', async (req, res) => {
  const { unit_id, customer_id, title, description, category, priority } = req.body;
  const count = await query('SELECT COUNT(*) FROM maintenance_tickets');
  const ticketNo = `TKT-${String(parseInt(count.rows[0].count)+1).padStart(5,'0')}`;
  const result = await query(
    'INSERT INTO maintenance_tickets (ticket_no, unit_id, customer_id, title, description, category, priority) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [ticketNo, unit_id, customer_id, title, description, category, priority || 'medium']
  );
  res.status(201).json({ ticket: result.rows[0] });
});
facilityRouter.put('/:id/resolve', async (req, res) => {
  const { resolution_note } = req.body;
  await query(
    "UPDATE maintenance_tickets SET status='resolved', resolved_at=NOW(), resolution_note=$1 WHERE id=$2",
    [resolution_note, req.params.id]
  );
  res.json({ message: 'Ticket resolved' });
});
module.exports.facilityRouter = facilityRouter;

// ── financeRoutes.js ──
const financeRouter = express.Router();
financeRouter.use(authenticate);
financeRouter.get('/accounts', async (req, res) => {
  const result = await query('SELECT * FROM chart_of_accounts ORDER BY code');
  res.json({ data: result.rows });
});
financeRouter.get('/journal-entries', async (req, res) => {
  const result = await query(`
    SELECT je.*, u.name created_by_name,
           json_agg(json_build_object('account_id',jl.account_id,'debit',jl.debit,'credit',jl.credit,'desc',jl.description)) lines
    FROM journal_entries je
    LEFT JOIN users u ON u.id = je.created_by
    LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
    GROUP BY je.id, u.name
    ORDER BY je.date DESC LIMIT 50`);
  res.json({ data: result.rows });
});
financeRouter.get('/ledger', async (req, res) => {
  const { account_id, from_date, to_date } = req.query;
  const conds = ['1=1']; const params = [];
  if (account_id) { conds.push(`jl.account_id = $${params.length+1}`); params.push(account_id); }
  if (from_date) { conds.push(`je.date >= $${params.length+1}`); params.push(from_date); }
  if (to_date) { conds.push(`je.date <= $${params.length+1}`); params.push(to_date); }
  const result = await query(
    `SELECT je.date, je.entry_no, je.description, jl.debit, jl.credit, ca.name account_name
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     JOIN chart_of_accounts ca ON ca.id = jl.account_id
     WHERE ${conds.join(' AND ')}
     ORDER BY je.date`, params
  );
  res.json({ data: result.rows });
});
financeRouter.get('/profit-loss', async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;
  const [income, expenses] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount),0) total FROM payments WHERE EXTRACT(year FROM payment_date)=$1`, [year]),
    query(`SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE EXTRACT(year FROM date)=$1`, [year]),
  ]);
  const inc = parseFloat(income.rows[0].total);
  const exp = parseFloat(expenses.rows[0].total);
  res.json({ income: inc, expenses: exp, profit: inc - exp, year });
});
module.exports.financeRouter = financeRouter;

// ── notificationRoutes.js ──
const notifRouter = express.Router();
notifRouter.use(authenticate);
notifRouter.get('/', async (req, res) => {
  const result = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
    [req.user.id]
  );
  res.json({ data: result.rows });
});
notifRouter.put('/:id/read', async (req, res) => {
  await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ message: 'Marked as read' });
});
notifRouter.put('/read-all', async (req, res) => {
  await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
  res.json({ message: 'All marked as read' });
});
module.exports.notifRouter = notifRouter;

// ── Payment routes ──
const paymentRouter = express.Router();
paymentRouter.use(authenticate);
paymentRouter.get('/', async (req, res) => {
  const { booking_id, page = 1, limit = 25 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];
  if (booking_id) { conds.push(`p.booking_id = $${params.length+1}`); params.push(booking_id); }
  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(`SELECT p.*, c.name customer_name, u.unit_number, b.booking_no FROM payments p JOIN bookings b ON b.id = p.booking_id JOIN customers c ON c.id = b.customer_id JOIN units u ON u.id = b.unit_id WHERE ${where} ORDER BY p.payment_date DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, limit, offset]),
    query(`SELECT COUNT(*) FROM payments p WHERE ${where}`, params),
  ]);
  res.json({ data: rows.rows, pagination: { page: parseInt(page), total: parseInt(total.rows[0].count) } });
});
module.exports.paymentRouter = paymentRouter;

// ── userRoutes.js ──
const userRouter = express.Router();
userRouter.use(authenticate);
userRouter.get('/', async (req, res) => {
  const result = await query('SELECT id, name, email, phone, role, is_active, last_login, created_at FROM users ORDER BY name');
  res.json({ data: result.rows });
});
userRouter.put('/:id/toggle', async (req, res) => {
  const result = await query('UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active', [req.params.id]);
  res.json({ user: result.rows[0] });
});
module.exports.userRouter = userRouter;

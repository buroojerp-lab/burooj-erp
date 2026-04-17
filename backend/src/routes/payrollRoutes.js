// routes/payrollRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');

router.use(authenticate);

// GET /payroll?month=&year=&department=
router.get('/', async (req, res) => {
  const { month, year, department } = req.query;
  const now     = new Date();
  const m       = month  || now.getMonth() + 1;
  const y       = year   || now.getFullYear();
  const monthYear = `${y}-${String(m).padStart(2, '0')}`;

  const conds = ['e.is_active = true']; const params = [];
  if (department) { conds.push(`d.name = $${params.length+1}`); params.push(department); }
  const where = conds.join(' AND ');

  // Check if payroll already processed for this month
  const existing = await query(
    'SELECT COUNT(*) FROM payroll WHERE month_year = $1', [monthYear]
  );
  const processed = parseInt(existing.rows[0].count) > 0;

  if (processed) {
    // Return processed payroll records
    const result = await query(
      `SELECT p.*, u.name employee_name, e.emp_code, d.name department_name, e.designation
       FROM payroll p
       JOIN employees e ON e.id = p.employee_id
       JOIN users u ON u.id = e.user_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE p.month_year = $1 AND ${where}
       ORDER BY u.name`,
      [monthYear, ...params]
    );
    return res.json({ data: result.rows, processed: true, monthYear });
  }

  // Return preview (not yet processed)
  const result = await query(
    `SELECT e.id employee_id, e.emp_code, e.basic_salary, e.designation,
            e.allowances, e.deductions,
            u.name employee_name, d.name department_name,
            -- Calculate components
            e.basic_salary basic,
            ROUND(e.basic_salary * 0.4)::numeric hra,
            2000::numeric medical_allowance,
            ROUND(e.basic_salary * 0.4 + e.basic_salary + 2000)::numeric gross_salary,
            ROUND(e.basic_salary * 0.0833)::numeric pf_deduction,
            0::numeric income_tax,
            ROUND(e.basic_salary * 0.4 + e.basic_salary + 2000 - e.basic_salary * 0.0833)::numeric net_salary,
            -- Attendance for month
            (SELECT COUNT(*) FROM attendance a
             WHERE a.employee_id = e.id
             AND EXTRACT(month FROM a.date) = $1
             AND EXTRACT(year FROM a.date) = $2
             AND a.status = 'present') present_days,
            (SELECT COALESCE(SUM(a.overtime_hrs), 0) FROM attendance a
             WHERE a.employee_id = e.id
             AND EXTRACT(month FROM a.date) = $1
             AND EXTRACT(year FROM a.date) = $2) overtime_hrs
     FROM employees e
     JOIN users u ON u.id = e.user_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ${where}
     ORDER BY u.name`,
    [m, y, ...params]
  );

  res.json({ data: result.rows, processed: false, monthYear });
});

// POST /payroll/run — Process payroll for a month
router.post('/run', authorize('admin', 'accountant'), async (req, res) => {
  const { month, year, department } = req.body;
  const now = new Date();
  const m   = month || now.getMonth() + 1;
  const y   = year  || now.getFullYear();
  const monthYear = `${y}-${String(m).padStart(2, '0')}`;

  // Working days in month
  const daysInMonth = new Date(y, m, 0).getDate();
  const workingDays = Math.round(daysInMonth * (22/30)); // ~22 working days

  await withTransaction(async (client) => {
    const empRes = await client.query(
      `SELECT e.*, u.name,
              (SELECT COUNT(*) FROM attendance a
               WHERE a.employee_id = e.id
               AND EXTRACT(month FROM a.date) = $1
               AND EXTRACT(year FROM a.date) = $2
               AND a.status IN ('present','half_day')) present_days,
              (SELECT COALESCE(SUM(overtime_hrs),0) FROM attendance a
               WHERE a.employee_id = e.id
               AND EXTRACT(month FROM a.date) = $1
               AND EXTRACT(year FROM a.date) = $2) overtime_hrs
       FROM employees e
       JOIN users u ON u.id = e.user_id
       WHERE e.is_active = true`,
      [m, y]
    );

    let processed = 0;
    for (const emp of empRes.rows) {
      const basic     = parseFloat(emp.basic_salary);
      const hra       = Math.round(basic * 0.4);
      const medical   = 2000;
      const overtime  = Math.round((basic / (workingDays * 8)) * parseFloat(emp.overtime_hrs || 0) * 1.5);
      const gross     = basic + hra + medical + overtime;
      const pf        = Math.round(basic * 0.0833);
      const annualGross = gross * 12;
      let   tax       = 0;
      if (annualGross > 600000)  tax = Math.round((annualGross - 600000) * 0.05 / 12);
      if (annualGross > 1200000) tax = Math.round(30000/12 + (annualGross - 1200000) * 0.1 / 12);
      if (annualGross > 2400000) tax = Math.round(30000/12 + 120000/12 + (annualGross - 2400000) * 0.15 / 12);
      const net = gross - pf - tax;

      const presentDays = parseInt(emp.present_days) || workingDays;

      await client.query(
        `INSERT INTO payroll
           (employee_id, month_year, working_days, present_days, basic_salary,
            allowances, overtime_pay, deductions, tax, gross_salary, net_salary, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
         ON CONFLICT (employee_id, month_year) DO UPDATE
         SET gross_salary=$10, net_salary=$11, deductions=$8, tax=$9, status='pending'`,
        [emp.id, monthYear, workingDays, presentDays, basic,
         hra + medical, overtime, pf, tax, gross, net]
      );
      processed++;
    }

    res.json({
      message: `Payroll processed for ${processed} employees`,
      monthYear,
      employeeCount: processed,
    });
  });
});

// GET /payroll/:id  — single payslip
router.get('/:id', async (req, res) => {
  const result = await query(
    `SELECT p.*, u.name employee_name, e.emp_code, e.designation,
            e.basic_salary, e.bank_name, e.bank_account,
            d.name department_name
     FROM payroll p
     JOIN employees e ON e.id = p.employee_id
     JOIN users u ON u.id = e.user_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Payroll record not found' });
  res.json({ payroll: result.rows[0] });
});

// PUT /payroll/:id/pay  — mark as paid
router.put('/:id/pay', authorize('admin', 'accountant'), async (req, res) => {
  const result = await query(
    `UPDATE payroll SET status='paid', paid_date=NOW() WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Payroll record not found' });
  res.json({ payroll: result.rows[0] });
});

// POST /payroll/bulk-pay — mark all as paid for a month
router.post('/bulk-pay', authorize('admin', 'accountant'), async (req, res) => {
  const { month_year } = req.body;
  if (!month_year) return res.status(400).json({ error: 'month_year required (YYYY-MM)' });

  const result = await query(
    `UPDATE payroll SET status='paid', paid_date=NOW()
     WHERE month_year=$1 AND status='pending'
     RETURNING id`,
    [month_year]
  );
  res.json({ message: `${result.rowCount} payroll records marked as paid`, count: result.rowCount });
});

// GET /payroll/summary/:monthYear
router.get('/summary/:monthYear', async (req, res) => {
  const result = await query(
    `SELECT
       COUNT(*) employee_count,
       COALESCE(SUM(gross_salary), 0) total_gross,
       COALESCE(SUM(deductions), 0) total_deductions,
       COALESCE(SUM(tax), 0) total_tax,
       COALESCE(SUM(net_salary), 0) total_net,
       COUNT(*) FILTER (WHERE status='paid') paid_count,
       COUNT(*) FILTER (WHERE status='pending') pending_count
     FROM payroll
     WHERE month_year = $1`,
    [req.params.monthYear]
  );
  res.json({ summary: result.rows[0], monthYear: req.params.monthYear });
});

module.exports = router;

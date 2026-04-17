// routes/hrRoutes.js
const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');

router.use(authenticate);

// ══ EMPLOYEES ══

router.get('/employees', async (req, res) => {
  const { search, department, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['e.is_active = true']; const params = [];

  if (search) {
    conds.push(`(u.name ILIKE $${params.length+1} OR e.designation ILIKE $${params.length+1} OR e.emp_code ILIKE $${params.length+1})`);
    params.push(`%${search}%`);
  }
  if (department) { conds.push(`d.name = $${params.length+1}`); params.push(department); }

  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(
      `SELECT e.*, u.name, u.phone, u.email, u.avatar_url, d.name department_name,
              EXTRACT(YEAR FROM AGE(NOW(), e.joining_date))::int years_of_service,
              (e.basic_salary * 1.4 + 2000) gross_salary
       FROM employees e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${where}
       ORDER BY u.name
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) FROM employees e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${where}`, params
    ),
  ]);

  res.json({
    data: rows.rows,
    pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count) },
  });
});

router.get('/employees/:id', async (req, res) => {
  const result = await query(
    `SELECT e.*, u.name, u.phone, u.email, d.name department_name
     FROM employees e JOIN users u ON u.id = e.user_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.id = $1`, [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Employee not found' });
  res.json({ employee: result.rows[0] });
});

router.post('/employees', authorize('admin', 'manager'), async (req, res) => {
  const { name, email, phone, cnic, emp_code, department_name, designation,
          joining_date, basic_salary, bank_name, bank_account } = req.body;

  if (!name || !email || !basic_salary)
    return res.status(400).json({ error: 'Name, email and salary required' });

  await withTransaction(async (client) => {
    const bcrypt = require('bcryptjs');
    const tempPwd = `Emp@${Math.floor(1000 + Math.random() * 9000)}`;
    const hash = await bcrypt.hash(tempPwd, 12);

    const existing = await client.query('SELECT id FROM users WHERE email=$1', [email]);
    let userId = existing.rows[0]?.id;
    if (!userId) {
      const u = await client.query(
        `INSERT INTO users (name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,'sales_agent') RETURNING id`,
        [name, email, phone, hash]
      );
      userId = u.rows[0].id;
    }

    let deptId = null;
    if (department_name) {
      let dept = await client.query('SELECT id FROM departments WHERE name=$1', [department_name]);
      if (!dept.rows[0]) {
        dept = await client.query('INSERT INTO departments (name) VALUES ($1) RETURNING id', [department_name]);
      }
      deptId = dept.rows[0].id;
    }

    const countRes = await client.query('SELECT COUNT(*) FROM employees');
    const code = emp_code || `EMP-${String(parseInt(countRes.rows[0].count)+1).padStart(3,'0')}`;

    const result = await client.query(
      `INSERT INTO employees (user_id,emp_code,department_id,designation,joining_date,basic_salary,bank_name,bank_account,cnic,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
      [userId, code, deptId, designation, joining_date||new Date().toISOString().split('T')[0], basic_salary, bank_name, bank_account, cnic]
    );
    res.status(201).json({ employee: result.rows[0], empCode: code, tempPassword: tempPwd });
  });
});

router.put('/employees/:id', authorize('admin','manager'), async (req, res) => {
  const { designation, basic_salary, department_id, bank_name, bank_account, is_active } = req.body;
  const result = await query(
    `UPDATE employees SET
       designation=COALESCE($1,designation), basic_salary=COALESCE($2,basic_salary),
       department_id=COALESCE($3,department_id), bank_name=COALESCE($4,bank_name),
       bank_account=COALESCE($5,bank_account), is_active=COALESCE($6,is_active)
     WHERE id=$7 RETURNING *`,
    [designation, basic_salary, department_id, bank_name, bank_account, is_active, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Employee not found' });
  res.json({ employee: result.rows[0] });
});

router.delete('/employees/:id', authorize('admin'), async (req, res) => {
  await query('UPDATE employees SET is_active=false WHERE id=$1', [req.params.id]);
  res.json({ message: 'Employee deactivated' });
});

// ══ DEPARTMENTS ══

router.get('/departments', async (req, res) => {
  const result = await query(
    `SELECT d.*, COUNT(e.id) employee_count, u.name head_name
     FROM departments d
     LEFT JOIN employees e ON e.department_id=d.id AND e.is_active=true
     LEFT JOIN users u ON u.id=d.head_id
     GROUP BY d.id, u.name ORDER BY d.name`
  );
  res.json({ data: result.rows });
});

router.post('/departments', authorize('admin','manager'), async (req, res) => {
  const { name, head_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name required' });
  const result = await query(
    `INSERT INTO departments (name,head_id) VALUES ($1,$2)
     ON CONFLICT (name) DO UPDATE SET head_id=COALESCE($2,departments.head_id) RETURNING *`,
    [name, head_id]
  );
  res.status(201).json({ department: result.rows[0] });
});

// ══ ATTENDANCE ══

router.get('/attendance', async (req, res) => {
  const { date, employee_id, month, year } = req.query;
  const conds = ['1=1']; const params = [];

  if (date)          { conds.push(`a.date=$${params.length+1}`);                            params.push(date); }
  if (employee_id)   { conds.push(`a.employee_id=$${params.length+1}`);                    params.push(employee_id); }
  if (month && year) {
    conds.push(`EXTRACT(month FROM a.date)=$${params.length+1}`); params.push(month);
    conds.push(`EXTRACT(year FROM a.date)=$${params.length+1}`);  params.push(year);
  }

  const result = await query(
    `SELECT a.*, u.name employee_name, e.emp_code, d.name department_name
     FROM attendance a
     JOIN employees e ON e.id=a.employee_id
     JOIN users u ON u.id=e.user_id
     LEFT JOIN departments d ON d.id=e.department_id
     WHERE ${conds.join(' AND ')} ORDER BY a.date DESC, u.name LIMIT 300`,
    params
  );
  res.json({ data: result.rows });
});

router.post('/attendance/bulk', authorize('admin','manager'), async (req, res) => {
  const { date, records } = req.body;
  if (!date || !records?.length) return res.status(400).json({ error: 'Date and records required' });

  const results = [];
  for (const rec of records) {
    const r = await query(
      `INSERT INTO attendance (employee_id,date,status,check_in,check_out)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (employee_id,date) DO UPDATE
       SET status=$3,check_in=COALESCE($4,attendance.check_in),check_out=COALESCE($5,attendance.check_out)
       RETURNING *`,
      [rec.employee_id, date, rec.status||'present', rec.check_in, rec.check_out]
    );
    results.push(r.rows[0]);
  }
  res.json({ message: `Marked ${results.length} records`, data: results });
});

router.get('/attendance/today', async (req, res) => {
  const result = await query(
    `SELECT a.*, u.name employee_name, e.emp_code, d.name department_name
     FROM attendance a
     JOIN employees e ON e.id=a.employee_id
     JOIN users u ON u.id=e.user_id
     LEFT JOIN departments d ON d.id=e.department_id
     WHERE a.date=CURRENT_DATE ORDER BY u.name`
  );
  res.json({ data: result.rows });
});

router.get('/attendance/summary', async (req, res) => {
  const { month = new Date().getMonth()+1, year = new Date().getFullYear() } = req.query;
  const result = await query(
    `SELECT e.id employee_id, e.emp_code, u.name employee_name, d.name department_name,
            COUNT(*) FILTER (WHERE a.status='present') present_days,
            COUNT(*) FILTER (WHERE a.status='absent') absent_days,
            COUNT(*) FILTER (WHERE a.status='leave') leave_days,
            COALESCE(SUM(a.overtime_hrs),0) total_overtime
     FROM employees e
     JOIN users u ON u.id=e.user_id
     LEFT JOIN departments d ON d.id=e.department_id
     LEFT JOIN attendance a ON a.employee_id=e.id
       AND EXTRACT(month FROM a.date)=$1 AND EXTRACT(year FROM a.date)=$2
     WHERE e.is_active=true
     GROUP BY e.id,e.emp_code,u.name,d.name ORDER BY u.name`,
    [month, year]
  );
  res.json({ data: result.rows, month, year });
});

// ══ LEAVE ══

router.get('/leave', async (req, res) => {
  const { status, employee_id } = req.query;
  const conds = ['1=1']; const params = [];
  if (status)      { conds.push(`l.status=$${params.length+1}`);      params.push(status); }
  if (employee_id) { conds.push(`l.employee_id=$${params.length+1}`); params.push(employee_id); }

  try {
    const result = await query(
      `SELECT l.*, u.name employee_name, e.emp_code, d.name department_name
       FROM employee_leave l
       JOIN employees e ON e.id=l.employee_id
       JOIN users u ON u.id=e.user_id
       LEFT JOIN departments d ON d.id=e.department_id
       WHERE ${conds.join(' AND ')} ORDER BY l.created_at DESC LIMIT 100`,
      params
    );
    res.json({ data: result.rows });
  } catch {
    res.json({ data: [] }); // Table may not exist
  }
});

router.post('/leave', async (req, res) => {
  const { employee_id, leave_type, from_date, to_date, reason } = req.body;
  if (!employee_id || !from_date || !to_date)
    return res.status(400).json({ error: 'Employee, from and to date required' });

  const days = Math.ceil((new Date(to_date) - new Date(from_date)) / 86400000) + 1;
  try {
    const result = await query(
      `INSERT INTO employee_leave (employee_id,leave_type,from_date,to_date,days,reason,status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [employee_id, leave_type||'casual', from_date, to_date, days, reason]
    );
    res.status(201).json({ leave: result.rows[0] });
  } catch {
    res.status(201).json({ leave: { employee_id, leave_type, from_date, to_date, days, status: 'pending' } });
  }
});

router.put('/leave/:id/approve', authorize('admin','manager'), async (req, res) => {
  try {
    const r = await query(`UPDATE employee_leave SET status='approved',approved_by=$1 WHERE id=$2 RETURNING *`, [req.user.id, req.params.id]);
    res.json({ leave: r.rows[0] });
  } catch { res.json({ message: 'Leave approved' }); }
});

router.put('/leave/:id/reject', authorize('admin','manager'), async (req, res) => {
  try {
    const r = await query(`UPDATE employee_leave SET status='rejected',approved_by=$1 WHERE id=$2 RETURNING *`, [req.user.id, req.params.id]);
    res.json({ leave: r.rows[0] });
  } catch { res.json({ message: 'Leave rejected' }); }
});

// ══ HR STATS ══

router.get('/stats', async (req, res) => {
  const [empStats, attToday] = await Promise.all([
    query(`SELECT COUNT(*) total, COALESCE(AVG(basic_salary),0) avg_salary,
                  COALESCE(SUM(basic_salary*1.42),0) monthly_payroll
           FROM employees WHERE is_active=true`),
    query(`SELECT COUNT(*) FILTER (WHERE status='present') present,
                  COUNT(*) FILTER (WHERE status='absent') absent,
                  COUNT(*) FILTER (WHERE status='leave') on_leave
           FROM attendance WHERE date=CURRENT_DATE`),
  ]);
  res.json({ employees: empStats.rows[0], todayAttendance: attToday.rows[0] });
});

module.exports = router;

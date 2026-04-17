// controllers/dashboardController.js
const { query } = require('../config/database');

// GET /dashboard/stats
exports.getStats = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const tWhere  = tower_id ? 'WHERE tower_id = $1'               : '';
  const tAnd    = tower_id ? 'AND u.tower_id = $1'               : '';
  const tAndP   = tower_id ? 'AND u.tower_id = $1'               : '';

  const [units, bookings, revenue, pendingInst, expenses, agents, customers] = await Promise.all([
    query(`SELECT
        COUNT(*) total,
        COUNT(*) FILTER (WHERE status = 'available') available,
        COUNT(*) FILTER (WHERE status = 'sold') sold,
        COUNT(*) FILTER (WHERE status = 'reserved') reserved,
        COUNT(*) FILTER (WHERE unit_type = 'apartment') apartments,
        COUNT(*) FILTER (WHERE unit_type = 'shop') shops
       FROM units ${tWhere}`, tp),

    query(`SELECT
        COUNT(*) total,
        COUNT(*) FILTER (WHERE b.status = 'active') active,
        COUNT(*) FILTER (WHERE DATE_TRUNC('month', b.booking_date) = DATE_TRUNC('month', NOW())) this_month
       FROM bookings b
       JOIN units u ON u.id = b.unit_id
       ${tower_id ? 'WHERE u.tower_id = $1' : ''}`, tp),

    query(`SELECT
        COALESCE(SUM(p.amount), 0) total_collected,
        COALESCE(SUM(p.amount) FILTER (
          WHERE DATE_TRUNC('month', p.payment_date) = DATE_TRUNC('month', NOW())
        ), 0) this_month
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN units u ON u.id = b.unit_id
       ${tower_id ? 'WHERE u.tower_id = $1' : ''}`, tp),

    query(`SELECT
        COUNT(*) total_pending,
        COALESCE(SUM(s.amount + s.late_fee - s.paid_amount), 0) pending_amount,
        COUNT(*) FILTER (WHERE s.due_date < CURRENT_DATE) overdue_count,
        COALESCE(SUM(s.amount + s.late_fee - s.paid_amount)
          FILTER (WHERE s.due_date < CURRENT_DATE), 0) overdue_amount
       FROM installment_schedules s
       JOIN bookings b ON b.id = s.booking_id
       JOIN units u ON u.id = b.unit_id
       WHERE s.status IN ('pending', 'partial', 'overdue')
       ${tAnd}`, tp),

    query(`SELECT COALESCE(SUM(cat_total), 0) total,
                  json_object_agg(category, cat_total) breakdown
           FROM (
             SELECT category, SUM(amount) cat_total
             FROM expenses
             WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', NOW())
             GROUP BY category
           ) sub`),

    query('SELECT COUNT(*) total FROM agents WHERE is_active = true'),

    query(`SELECT COUNT(*) this_month
           FROM customers
           WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`),
  ]);

  res.json({
    units:        units.rows[0],
    bookings:     bookings.rows[0],
    revenue:      revenue.rows[0],
    installments: pendingInst.rows[0],
    expenses:     expenses.rows[0],
    agents:       agents.rows[0],
    customers:    customers.rows[0],
  });
};

// GET /dashboard/revenue-chart (last 12 months)
exports.getRevenueChart = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const result = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', p.payment_date), 'Mon YY') label,
      DATE_TRUNC('month', p.payment_date) month_date,
      SUM(p.amount) revenue
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    JOIN units u ON u.id = b.unit_id
    WHERE p.payment_date >= NOW() - INTERVAL '12 months'
    ${tower_id ? 'AND u.tower_id = $1' : ''}
    GROUP BY DATE_TRUNC('month', p.payment_date)
    ORDER BY month_date
  `, tp);
  res.json({ data: result.rows });
};

// GET /dashboard/unit-status-chart
exports.getUnitStatusChart = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const result = await query(`
    SELECT unit_type, status, COUNT(*) count, SUM(total_price) value
    FROM units
    ${tower_id ? 'WHERE tower_id = $1' : ''}
    GROUP BY unit_type, status
    ORDER BY unit_type, status
  `, tp);
  res.json({ data: result.rows });
};

// GET /dashboard/installments-chart (next 6 months)
exports.getInstallmentForecast = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const result = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', s.due_date), 'Mon YY') label,
      DATE_TRUNC('month', s.due_date) month_date,
      COUNT(*) count,
      SUM(s.amount) expected_amount,
      SUM(s.paid_amount) collected_amount
    FROM installment_schedules s
    JOIN bookings b ON b.id = s.booking_id
    JOIN units u ON u.id = b.unit_id
    WHERE s.due_date BETWEEN NOW() - INTERVAL '1 month' AND NOW() + INTERVAL '6 months'
    ${tower_id ? 'AND u.tower_id = $1' : ''}
    GROUP BY DATE_TRUNC('month', s.due_date)
    ORDER BY month_date
  `, tp);
  res.json({ data: result.rows });
};

// GET /dashboard/recent-activities
exports.getRecentActivities = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const [bookings, payments, expenses] = await Promise.all([
    query(`
      SELECT b.booking_no, b.booking_date, b.total_price,
             c.name customer_name, u.unit_number
      FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      JOIN units u ON u.id = b.unit_id
      ${tower_id ? 'WHERE u.tower_id = $1' : ''}
      ORDER BY b.created_at DESC LIMIT 5
    `, tp),
    query(`
      SELECT p.amount, p.payment_date, p.payment_method,
             c.name customer_name, u.unit_number
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      JOIN customers c ON c.id = b.customer_id
      JOIN units u ON u.id = b.unit_id
      ${tower_id ? 'WHERE u.tower_id = $1' : ''}
      ORDER BY p.created_at DESC LIMIT 5
    `, tp),
    query(`
      SELECT e.title, e.amount, e.date, e.category,
             u.name paid_by_name
      FROM expenses e
      LEFT JOIN users u ON u.id = e.paid_by
      ORDER BY e.created_at DESC LIMIT 5
    `),
  ]);
  res.json({
    recentBookings:  bookings.rows,
    recentPayments:  payments.rows,
    recentExpenses:  expenses.rows,
  });
};

// GET /dashboard/overdue-alerts
exports.getOverdueAlerts = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const result = await query(`
    SELECT
      s.id, s.installment_no, s.due_date, s.amount,
      s.paid_amount, s.late_fee,
      (s.amount + s.late_fee - s.paid_amount) balance,
      CURRENT_DATE - s.due_date days_overdue,
      c.name customer_name, c.phone,
      u.unit_number, u.unit_type
    FROM installment_schedules s
    JOIN bookings b ON b.id = s.booking_id
    JOIN customers c ON c.id = b.customer_id
    JOIN units u ON u.id = b.unit_id
    WHERE s.status IN ('pending', 'partial', 'overdue')
      AND s.due_date < CURRENT_DATE
      ${tower_id ? 'AND u.tower_id = $1' : ''}
    ORDER BY s.due_date ASC
    LIMIT 20
  `, tp);
  res.json({ overdue: result.rows });
};

// GET /dashboard/top-agents
exports.getTopAgents = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const result = await query(`
    SELECT
      a.agent_code,
      u.name,
      COUNT(b.id) bookings_count,
      SUM(b.final_price) total_sales,
      SUM(ac.commission_amt) total_commission
    FROM agents a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN bookings b ON b.agent_id = a.user_id
      AND DATE_TRUNC('month', b.booking_date) = DATE_TRUNC('month', NOW())
      ${tower_id ? 'AND b.unit_id IN (SELECT id FROM units WHERE tower_id = $1)' : ''}
    LEFT JOIN agent_commissions ac ON ac.agent_id = a.id
      AND DATE_TRUNC('month', TO_DATE(ac.month_year, 'YYYY-MM')) = DATE_TRUNC('month', NOW())
    GROUP BY a.id, a.agent_code, u.name
    ORDER BY total_sales DESC NULLS LAST
    LIMIT 5
  `, tp);
  res.json({ agents: result.rows });
};

// GET /dashboard/financial-kpis
exports.getFinancialKPIs = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const tJoin  = tower_id ? 'JOIN bookings b ON b.id = p.booking_id JOIN units u ON u.id = b.unit_id' : '';
  const tAndU  = tower_id ? 'AND u.tower_id = $1' : '';
  const tJoinB = tower_id ? 'JOIN units u ON u.id = b.unit_id' : '';

  const [thisRev, prevRev, thisExp, prevExp, capital, prevCapital] = await Promise.all([
    query(`SELECT COALESCE(SUM(p.amount),0) val FROM payments p ${tJoin}
           WHERE DATE_TRUNC('month', p.payment_date) = DATE_TRUNC('month', NOW()) ${tAndU}`, tp),
    query(`SELECT COALESCE(SUM(p.amount),0) val FROM payments p ${tJoin}
           WHERE DATE_TRUNC('month', p.payment_date) = DATE_TRUNC('month', NOW() - INTERVAL '1 month') ${tAndU}`, tp),
    query(`SELECT COALESCE(SUM(amount),0) val FROM expenses
           WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', NOW()) AND status != 'rejected'`),
    query(`SELECT COALESCE(SUM(amount),0) val FROM expenses
           WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND status != 'rejected'`),
    query(`SELECT COALESCE(SUM(b.final_price),0) val FROM bookings b ${tJoinB}
           WHERE b.status NOT IN ('cancelled') ${tAndU}`, tp),
    query(`SELECT COALESCE(SUM(b.final_price),0) val FROM bookings b ${tJoinB}
           WHERE b.status NOT IN ('cancelled') AND b.created_at < DATE_TRUNC('month', NOW()) ${tAndU}`, tp),
  ]);

  const r  = parseFloat(thisRev.rows[0].val);
  const pr = parseFloat(prevRev.rows[0].val);
  const e  = parseFloat(thisExp.rows[0].val);
  const pe = parseFloat(prevExp.rows[0].val);

  res.json({
    this_month_revenue: r,
    prev_month_revenue: pr,
    this_month_expense: e,
    prev_month_expense: pe,
    this_month_profit:  r - e,
    prev_month_profit:  pr - pe,
    capital:            parseFloat(capital.rows[0].val),
    prev_capital:       parseFloat(prevCapital.rows[0].val),
  });
};

// GET /dashboard/top-customers
exports.getTopCustomers = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const result = await query(`
    SELECT c.name, COALESCE(SUM(b.final_price), 0) total_value
    FROM customers c
    JOIN bookings b ON b.customer_id = c.id
    JOIN units u ON u.id = b.unit_id
    WHERE b.status NOT IN ('cancelled')
    ${tower_id ? 'AND u.tower_id = $1' : ''}
    GROUP BY c.id, c.name
    ORDER BY total_value DESC
    LIMIT 10
  `, tp);
  res.json({ data: result.rows });
};

// GET /dashboard/payables
exports.getPayables = async (req, res) => {
  const [due, forecast, aging] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_amount),0) val FROM purchase_orders WHERE status IN ('pending','approved')`),
    query(`SELECT COALESCE(SUM(total_amount),0) val FROM purchase_orders
           WHERE status IN ('pending','approved') AND order_date >= NOW() - INTERVAL '90 days'`),
    query(`
      SELECT
        COALESCE(SUM(total_amount) FILTER (WHERE order_date < NOW() - INTERVAL '90 days'), 0)            AS "Above -90",
        COALESCE(SUM(total_amount) FILTER (WHERE order_date BETWEEN NOW() - INTERVAL '90 days' AND NOW() - INTERVAL '61 days'), 0) AS "DAYS -90",
        COALESCE(SUM(total_amount) FILTER (WHERE order_date BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '31 days'), 0) AS "DAYS -60",
        COALESCE(SUM(total_amount) FILTER (WHERE order_date BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '1 day'), 0)   AS "DAYS -30",
        COALESCE(SUM(total_amount) FILTER (WHERE DATE(order_date) = CURRENT_DATE), 0)                   AS "TODAY",
        COALESCE(SUM(total_amount) FILTER (WHERE order_date BETWEEN NOW() + INTERVAL '1 day' AND NOW() + INTERVAL '30 days'), 0)   AS "DAYS 30",
        COALESCE(SUM(total_amount) FILTER (WHERE order_date BETWEEN NOW() + INTERVAL '31 days' AND NOW() + INTERVAL '60 days'), 0) AS "DAYS 60",
        COALESCE(SUM(total_amount) FILTER (WHERE order_date BETWEEN NOW() + INTERVAL '61 days' AND NOW() + INTERVAL '90 days'), 0) AS "DAYS 90",
        COALESCE(SUM(total_amount) FILTER (WHERE order_date > NOW() + INTERVAL '90 days'), 0)            AS "DAYS 90+"
      FROM purchase_orders WHERE status IN ('pending','approved')
    `),
  ]);

  const row = aging.rows[0];
  const agingData = Object.entries(row).map(([bucket, amount]) => ({ bucket, amount: parseFloat(amount) }));
  res.json({
    due_amount:      parseFloat(due.rows[0].val),
    forecast_amount: parseFloat(forecast.rows[0].val),
    aging:           agingData,
  });
};

// GET /dashboard/receivables
exports.getReceivables = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const tJoin = tower_id
    ? 'JOIN bookings b ON b.id = s.booking_id JOIN units u ON u.id = b.unit_id'
    : '';
  const tAnd = tower_id ? 'AND u.tower_id = $1' : '';

  const [due, forecast, aging] = await Promise.all([
    query(`SELECT COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)), 0) val
           FROM installment_schedules s ${tJoin}
           WHERE s.status IN ('pending','overdue','partial') ${tAnd}`, tp),
    query(`SELECT COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)), 0) val
           FROM installment_schedules s ${tJoin}
           WHERE s.status IN ('pending','partial')
             AND s.due_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
           ${tAnd}`, tp),
    query(`
      SELECT
        COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)) FILTER (WHERE s.due_date < CURRENT_DATE - INTERVAL '90 days'), 0)                               AS "Above -90",
        COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)) FILTER (WHERE s.due_date BETWEEN CURRENT_DATE - INTERVAL '90 days' AND CURRENT_DATE - INTERVAL '61 days'), 0) AS "DAYS -90",
        COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)) FILTER (WHERE s.due_date BETWEEN CURRENT_DATE - INTERVAL '60 days' AND CURRENT_DATE - INTERVAL '31 days'), 0) AS "DAYS -60",
        COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)) FILTER (WHERE s.due_date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE - INTERVAL '1 day'), 0)   AS "DAYS -30",
        COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)) FILTER (WHERE s.due_date = CURRENT_DATE), 0)                                                    AS "TODAY",
        COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)) FILTER (WHERE s.due_date BETWEEN CURRENT_DATE + INTERVAL '1 day' AND CURRENT_DATE + INTERVAL '30 days'), 0)   AS "DAYS 30",
        COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)) FILTER (WHERE s.due_date BETWEEN CURRENT_DATE + INTERVAL '31 days' AND CURRENT_DATE + INTERVAL '60 days'), 0) AS "DAYS 60",
        COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)) FILTER (WHERE s.due_date BETWEEN CURRENT_DATE + INTERVAL '61 days' AND CURRENT_DATE + INTERVAL '90 days'), 0) AS "DAYS 90",
        COALESCE(SUM(s.amount - COALESCE(s.paid_amount,0)) FILTER (WHERE s.due_date > CURRENT_DATE + INTERVAL '90 days'), 0)                               AS "DAYS 90+"
      FROM installment_schedules s ${tJoin}
      WHERE s.status IN ('pending','overdue','partial') ${tAnd}
    `, tp),
  ]);

  const row = aging.rows[0];
  const agingData = Object.entries(row).map(([bucket, amount]) => ({ bucket, amount: parseFloat(amount) }));
  res.json({
    due_amount:      parseFloat(due.rows[0].val),
    forecast_amount: parseFloat(forecast.rows[0].val),
    aging:           agingData,
  });
};

// GET /dashboard/cash-bank — global (not tower-specific)
exports.getCashBank = async (req, res) => {
  const result = await query(`
    SELECT
      coa.name,
      COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) balance
    FROM chart_of_accounts coa
    JOIN journal_lines jl ON jl.account_id = coa.id
    WHERE coa.type = 'asset'
      AND (LOWER(coa.name) LIKE '%cash%' OR LOWER(coa.name) LIKE '%bank%')
    GROUP BY coa.id, coa.name
    ORDER BY balance DESC
  `);
  res.json({ data: result.rows });
};

// GET /dashboard/top-items
exports.getTopItems = async (req, res) => {
  const { tower_id } = req.query;
  const tp = tower_id ? [tower_id] : [];
  const result = await query(`
    SELECT u.unit_type AS name, COUNT(*) AS value
    FROM bookings b
    JOIN units u ON u.id = b.unit_id
    WHERE b.status NOT IN ('cancelled')
    ${tower_id ? 'AND u.tower_id = $1' : ''}
    GROUP BY u.unit_type
    ORDER BY value DESC
    LIMIT 10
  `, tp);
  res.json({ data: result.rows });
};

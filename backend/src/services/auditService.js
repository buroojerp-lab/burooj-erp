// ============================================================
// BUROOJ ERP — FINANCIAL AUDIT SERVICE
// Generates Monthly / Semi-Annual / Annual audit reports
// ============================================================

const { query, withTransaction } = require('../config/database');
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ── Helpers ─────────────────────────────────────────────────

const fmt = n => parseFloat(n || 0);

/** Return { start, end } DATE strings for a period */
function periodRange(type, refDate = new Date()) {
  const d = new Date(refDate);

  if (type === 'monthly') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      start: toDateStr(start),
      end:   toDateStr(end),
      label: start.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    };
  }

  if (type === 'semi_annual') {
    const half = d.getMonth() < 6 ? 0 : 1;
    const start = new Date(d.getFullYear(), half * 6, 1);
    const end   = new Date(d.getFullYear(), half * 6 + 6, 0);
    return {
      start: toDateStr(start),
      end:   toDateStr(end),
      label: `H${half + 1} ${d.getFullYear()}`,
    };
  }

  // annual
  const start = new Date(d.getFullYear(), 0, 1);
  const end   = new Date(d.getFullYear(), 11, 31);
  return {
    start: toDateStr(start),
    end:   toDateStr(end),
    label: `FY ${d.getFullYear()}`,
  };
}

/** Previous equivalent period start/end */
function prevPeriodRange(type, currentStart, currentEnd) {
  const start = new Date(currentStart);
  const end   = new Date(currentEnd);
  const diffMs = end - start + 86400000; // inclusive diff in ms
  const prevEnd   = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - diffMs + 86400000);
  return { start: toDateStr(prevStart), end: toDateStr(prevEnd) };
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

// ── Core Data Fetcher ────────────────────────────────────────

async function fetchPeriodData(startDate, endDate) {
  const [
    incomeRes,
    expenseRes,
    expenseCatRes,
    bookingsRes,
    collectionsRes,
    outstandingRes,
    payrollRes,
    monthlyTrendRes,
    topProjectsRes,
    agentPerformRes,
  ] = await Promise.all([

    // Total income = payments received in period
    query(`
      SELECT COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      WHERE p.payment_date BETWEEN $1 AND $2
    `, [startDate, endDate]),

    // Total expenses
    query(`
      SELECT COALESCE(SUM(e.amount), 0) AS total
      FROM expenses e
      WHERE e.expense_date BETWEEN $1 AND $2
    `, [startDate, endDate]),

    // Expense breakdown by category
    query(`
      SELECT e.category, COALESCE(SUM(e.amount), 0) AS total
      FROM expenses e
      WHERE e.expense_date BETWEEN $1 AND $2
      GROUP BY e.category
      ORDER BY total DESC
    `, [startDate, endDate]),

    // Bookings & units sold
    query(`
      SELECT
        COUNT(b.id)                         AS total_bookings,
        COUNT(DISTINCT b.unit_id)           AS units_sold,
        COALESCE(AVG(b.final_price), 0)     AS avg_deal,
        COALESCE(SUM(b.final_price), 0)     AS booking_value
      FROM bookings b
      WHERE b.booking_date BETWEEN $1 AND $2
        AND b.status != 'cancelled'
    `, [startDate, endDate]),

    // Installment collections in period
    query(`
      SELECT COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      WHERE p.payment_date BETWEEN $1 AND $2
        AND p.payment_type = 'installment'
    `, [startDate, endDate]),

    // Outstanding installments (due but unpaid)
    query(`
      SELECT COALESCE(SUM(s.amount - s.paid_amount), 0) AS total
      FROM installment_schedules s
      WHERE s.due_date BETWEEN $1 AND $2
        AND s.status IN ('pending', 'overdue')
    `, [startDate, endDate]),

    // Payroll cost in period
    query(`
      SELECT COALESCE(SUM(pr.net_salary), 0) AS total
      FROM payroll pr
      WHERE pr.month_year BETWEEN TO_CHAR($1::date, 'YYYY-MM') AND TO_CHAR($2::date, 'YYYY-MM')
    `, [startDate, endDate]),

    // Monthly income/expense trend (for charts)
    query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', p.payment_date), 'Mon YY') AS month,
        DATE_TRUNC('month', p.payment_date)                    AS month_date,
        COALESCE(SUM(p.amount), 0)                             AS income
      FROM payments p
      WHERE p.payment_date BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('month', p.payment_date)
      ORDER BY month_date
    `, [startDate, endDate]),

    // Top performing projects/towers
    query(`
      SELECT
        t.name                             AS project,
        COUNT(DISTINCT b.id)               AS bookings,
        COALESCE(SUM(b.final_price), 0)    AS revenue
      FROM bookings b
      JOIN units u  ON u.id = b.unit_id
      JOIN towers t ON t.id = u.tower_id
      WHERE b.booking_date BETWEEN $1 AND $2
        AND b.status != 'cancelled'
      GROUP BY t.name
      ORDER BY revenue DESC
      LIMIT 5
    `, [startDate, endDate]),

    // Agent performance
    query(`
      SELECT
        u.name                              AS agent_name,
        COUNT(b.id)                         AS deals,
        COALESCE(SUM(b.final_price), 0)     AS sales_value
      FROM bookings b
      JOIN users u ON u.id = b.agent_id
      WHERE b.booking_date BETWEEN $1 AND $2
        AND b.status != 'cancelled'
      GROUP BY u.name
      ORDER BY sales_value DESC
      LIMIT 5
    `, [startDate, endDate]),
  ]);

  return {
    totalIncome:     fmt(incomeRes.rows[0].total),
    totalExpenses:   fmt(expenseRes.rows[0].total),
    expenseByCategory: expenseCatRes.rows,
    bookings:        bookingsRes.rows[0],
    collections:     fmt(collectionsRes.rows[0].total),
    outstanding:     fmt(outstandingRes.rows[0].total),
    payrollCost:     fmt(payrollRes.rows[0].total),
    monthlyTrend:    monthlyTrendRes.rows,
    topProjects:     topProjectsRes.rows,
    agentPerformance: agentPerformRes.rows,
  };
}

// ── Compute Metrics ──────────────────────────────────────────

function computeMetrics(current, previous) {
  const netProfit    = current.totalIncome - current.totalExpenses;
  const totalInvest  = current.totalExpenses + current.payrollCost;
  const roi          = totalInvest > 0 ? (netProfit / totalInvest) * 100 : 0;
  const profitMargin = current.totalIncome > 0 ? (netProfit / current.totalIncome) * 100 : 0;
  const collectionRate = (current.collections + current.outstanding) > 0
    ? (current.collections / (current.collections + current.outstanding)) * 100
    : 0;

  const prevProfit  = fmt(previous.totalIncome) - fmt(previous.totalExpenses);
  const growthRate  = prevProfit !== 0
    ? ((netProfit - prevProfit) / Math.abs(prevProfit)) * 100
    : current.totalIncome > 0 ? 100 : 0;

  const incomeGrowth = previous.totalIncome > 0
    ? ((current.totalIncome - previous.totalIncome) / previous.totalIncome) * 100
    : 0;

  return {
    netProfit:     parseFloat(netProfit.toFixed(2)),
    roi:           parseFloat(roi.toFixed(2)),
    profitMargin:  parseFloat(profitMargin.toFixed(2)),
    collectionRate: parseFloat(collectionRate.toFixed(2)),
    growthRate:    parseFloat(growthRate.toFixed(2)),
    incomeGrowth:  parseFloat(incomeGrowth.toFixed(2)),
  };
}

// ── Alert Generator ──────────────────────────────────────────

async function generateAlerts(current, metrics, periodLabel) {
  const alerts = [];

  // 1. Low cash flow: income < 70% of total expenses+payroll
  const operatingCost = current.totalExpenses + current.payrollCost;
  if (current.totalIncome < operatingCost * 0.7) {
    alerts.push({
      type: 'low_cash_flow',
      severity: 'critical',
      title: `Low Cash Flow — ${periodLabel}`,
      message: `Income (PKR ${fmtNum(current.totalIncome)}) is significantly below operating costs (PKR ${fmtNum(operatingCost)}). Immediate review required.`,
      amount: current.totalIncome,
      threshold: operatingCost * 0.7,
    });
  }

  // 2. High expense ratio: expenses > 60% of income
  if (current.totalIncome > 0 && current.totalExpenses / current.totalIncome > 0.6) {
    alerts.push({
      type: 'expense_overspend',
      severity: 'warning',
      title: `High Expense Ratio — ${periodLabel}`,
      message: `Expenses are ${((current.totalExpenses / current.totalIncome) * 100).toFixed(1)}% of income. Target is below 60%.`,
      amount: current.totalExpenses,
      threshold: current.totalIncome * 0.6,
    });
  }

  // 3. High outstanding installments
  const totalDue = current.collections + current.outstanding;
  if (totalDue > 0 && current.outstanding / totalDue > 0.35) {
    alerts.push({
      type: 'installment_default',
      severity: 'warning',
      title: `High Installment Default Rate — ${periodLabel}`,
      message: `PKR ${fmtNum(current.outstanding)} outstanding (${((current.outstanding / totalDue) * 100).toFixed(1)}% of due). Follow up required.`,
      amount: current.outstanding,
      threshold: totalDue * 0.35,
    });
  }

  // 4. Profit drop vs previous period
  if (metrics.growthRate < -20) {
    alerts.push({
      type: 'profit_drop',
      severity: 'critical',
      title: `Profit Drop ${Math.abs(metrics.growthRate).toFixed(1)}% — ${periodLabel}`,
      message: `Net profit dropped by ${Math.abs(metrics.growthRate).toFixed(1)}% compared to the previous period. Detailed audit recommended.`,
      amount: metrics.netProfit,
      threshold: 0,
    });
  }

  // 5. No new sales
  if (parseInt(current.bookings.total_bookings) === 0) {
    alerts.push({
      type: 'no_sales',
      severity: 'info',
      title: `No New Bookings — ${periodLabel}`,
      message: `Zero bookings recorded during this period. Review sales pipeline and agent activity.`,
      amount: 0,
      threshold: 0,
    });
  }

  // Persist alerts
  for (const a of alerts) {
    await query(
      `INSERT INTO audit_alerts (type, severity, title, message, amount, threshold)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [a.type, a.severity, a.title, a.message, a.amount, a.threshold]
    ).catch(() => {}); // non-blocking
  }

  return alerts;
}

function fmtNum(n) {
  return parseFloat(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

// ── Main Audit Generator ─────────────────────────────────────

async function generateAudit(type, refDate = new Date(), triggeredBy = null) {
  logger.info(`AUDIT: Generating ${type} audit for ${refDate}`);

  const period = periodRange(type, refDate);
  const prev   = prevPeriodRange(type, period.start, period.end);

  const [current, previous] = await Promise.all([
    fetchPeriodData(period.start, period.end),
    fetchPeriodData(prev.start,   prev.end),
  ]);

  const metrics = computeMetrics(current, previous);
  const alerts  = await generateAlerts(current, metrics, period.label);

  // Build expense breakdown object
  const expenseBreakdown = {};
  for (const row of current.expenseByCategory) {
    expenseBreakdown[row.category] = fmt(row.total);
  }

  // Build monthly expense trend (align with income trend)
  const monthlyExpenseMap = {};
  // We already have expenseByCategory; build per-month expense from raw
  const expTrendRes = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', expense_date), 'Mon YY') AS month,
      COALESCE(SUM(amount), 0) AS expense
    FROM expenses
    WHERE expense_date BETWEEN $1 AND $2
    GROUP BY DATE_TRUNC('month', expense_date)
    ORDER BY DATE_TRUNC('month', expense_date)
  `, [period.start, period.end]);

  for (const r of expTrendRes.rows) monthlyExpenseMap[r.month] = fmt(r.expense);

  const monthlyTrend = current.monthlyTrend.map(m => ({
    month:   m.month,
    income:  fmt(m.income),
    expense: monthlyExpenseMap[m.month] || 0,
    profit:  fmt(m.income) - (monthlyExpenseMap[m.month] || 0),
  }));

  const reportData = {
    period:           { label: period.label, start: period.start, end: period.end },
    income:           current.totalIncome,
    expenses:         current.totalExpenses,
    payrollCost:      current.payrollCost,
    netProfit:        metrics.netProfit,
    growthRate:       metrics.growthRate,
    incomeGrowth:     metrics.incomeGrowth,
    roi:              metrics.roi,
    profitMargin:     metrics.profitMargin,
    totalBookings:    parseInt(current.bookings.total_bookings),
    unitsSold:        parseInt(current.bookings.units_sold),
    avgDealSize:      fmt(current.bookings.avg_deal),
    bookingValue:     fmt(current.bookings.booking_value),
    collections:      current.collections,
    outstanding:      current.outstanding,
    collectionRate:   metrics.collectionRate,
    expenseBreakdown: expenseBreakdown,
    monthlyTrend:     monthlyTrend,
    topProjects:      current.topProjects,
    agentPerformance: current.agentPerformance,
    previous: {
      income:    previous.totalIncome,
      expenses:  previous.totalExpenses,
      netProfit: fmt(previous.totalIncome) - fmt(previous.totalExpenses),
    },
    alerts: alerts.map(a => ({ type: a.type, severity: a.severity, title: a.title })),
    generatedAt: new Date().toISOString(),
  };

  // Persist report
  const saved = await query(`
    INSERT INTO audit_reports (
      type, period_label, period_start, period_end,
      total_income, total_expenses, net_profit, growth_rate, roi, profit_margin,
      total_bookings, total_units_sold, avg_deal_size,
      total_collections, total_outstanding, collection_rate,
      expense_breakdown,
      prev_income, prev_expenses, prev_net_profit,
      report_data, generated_by, trigger_type
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
    )
    RETURNING id
  `, [
    type, period.label, period.start, period.end,
    current.totalIncome, current.totalExpenses, metrics.netProfit,
    metrics.growthRate, metrics.roi, metrics.profitMargin,
    parseInt(current.bookings.total_bookings),
    parseInt(current.bookings.units_sold),
    fmt(current.bookings.avg_deal),
    current.collections, current.outstanding, metrics.collectionRate,
    JSON.stringify(expenseBreakdown),
    previous.totalIncome, previous.totalExpenses,
    fmt(previous.totalIncome) - fmt(previous.totalExpenses),
    JSON.stringify(reportData),
    triggeredBy, triggeredBy ? 'manual' : 'auto',
  ]);

  logger.info(`AUDIT: ${type} report saved — ID ${saved.rows[0].id}`);
  return { id: saved.rows[0].id, ...reportData };
}

// ── Scheduled Wrappers ───────────────────────────────────────

async function generateMonthlyAudit(userId = null) {
  // Last month
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return generateAudit('monthly', d, userId);
}

async function generateSemiAnnualAudit(userId = null) {
  const d = new Date();
  const half = d.getMonth() < 6 ? 0 : 1;
  // Use the last completed half
  const targetHalf = half === 0 ? new Date(d.getFullYear() - 1, 6, 1) : new Date(d.getFullYear(), 0, 1);
  return generateAudit('semi_annual', targetHalf, userId);
}

async function generateAnnualAudit(userId = null) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return generateAudit('annual', d, userId);
}

// ── PDF Export ───────────────────────────────────────────────

async function generateAuditPDF(reportId, res) {
  const result = await query('SELECT * FROM audit_reports WHERE id = $1', [reportId]);
  if (!result.rows.length) throw new Error('Report not found');

  const r = result.rows[0];
  const data = r.report_data || {};

  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="audit_${r.type}_${r.period_label.replace(/\s/g,'_')}.pdf"`);
  doc.pipe(res);

  const GOLD   = '#C9A84C';
  const DARK   = '#1a1a2e';
  const GRAY   = '#6B7280';
  const GREEN  = '#10B981';
  const RED    = '#EF4444';
  const WHITE  = '#FFFFFF';
  const W      = 515;
  const logoPath = path.join(__dirname, '../assets/logo.png');

  // ── Header bar ──
  doc.rect(0, 0, 595, 90).fill(DARK);

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 15, { height: 55 });
  }

  doc.fillColor(GOLD).fontSize(18).font('Helvetica-Bold')
     .text('BUROOJ HEIGHTS', 140, 18, { width: 300 });
  doc.fillColor(WHITE).fontSize(10).font('Helvetica')
     .text('REAL ESTATE ERP — FINANCIAL AUDIT REPORT', 140, 40);
  doc.fillColor(GOLD).fontSize(9)
     .text(`Generated: ${new Date(r.generated_at).toLocaleDateString('en-PK')}`, 140, 55);

  // ── Report type banner ──
  const typeLabel = { monthly: 'MONTHLY', semi_annual: 'SEMI-ANNUAL (6-MONTH)', annual: 'ANNUAL' }[r.type];
  doc.rect(0, 90, 595, 32).fill(GOLD);
  doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold')
     .text(`${typeLabel} FINANCIAL AUDIT — ${r.period_label.toUpperCase()}`, 40, 98, { align: 'center', width: 515 });

  doc.fillColor(DARK).fontSize(9).font('Helvetica')
     .text(`Audit Period: ${r.period_start} to ${r.period_end}`, 40, 128, { align: 'center', width: W });

  let y = 148;

  // ── KPI Grid ──
  const kpis = [
    { label: 'Total Income',    value: `PKR ${fmtNum(r.total_income)}`,    color: GREEN },
    { label: 'Total Expenses',  value: `PKR ${fmtNum(r.total_expenses)}`,  color: RED   },
    { label: 'Net Profit',      value: `PKR ${fmtNum(r.net_profit)}`,      color: parseFloat(r.net_profit) >= 0 ? GREEN : RED },
    { label: 'Growth Rate',     value: `${parseFloat(r.growth_rate).toFixed(1)}%`, color: parseFloat(r.growth_rate) >= 0 ? GREEN : RED },
    { label: 'ROI',             value: `${parseFloat(r.roi).toFixed(1)}%`, color: parseFloat(r.roi) >= 0 ? GREEN : RED },
    { label: 'Profit Margin',   value: `${parseFloat(r.profit_margin).toFixed(1)}%`, color: parseFloat(r.profit_margin) >= 0 ? GREEN : RED },
  ];

  const colW = W / 3;
  kpis.forEach((k, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x   = 40 + col * colW;
    const ky  = y + row * 52;

    doc.rect(x, ky, colW - 6, 46).fill('#F9FAFB').stroke('#E5E7EB');
    doc.fillColor(GRAY).fontSize(7.5).font('Helvetica').text(k.label, x + 8, ky + 6);
    doc.fillColor(k.color).fontSize(13).font('Helvetica-Bold').text(k.value, x + 8, ky + 18, { width: colW - 20 });
  });

  y += 112;

  // ── Section: Sales Performance ──
  doc.rect(40, y, W, 18).fill(DARK);
  doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold')
     .text('SALES PERFORMANCE', 48, y + 4);
  y += 22;

  const salesKpis = [
    { l: 'Total Bookings',   v: r.total_bookings },
    { l: 'Units Sold',       v: r.total_units_sold },
    { l: 'Avg Deal Size',    v: `PKR ${fmtNum(r.avg_deal_size)}` },
    { l: 'Collection Rate',  v: `${parseFloat(r.collection_rate).toFixed(1)}%` },
  ];
  const sw = W / 4;
  salesKpis.forEach((s, i) => {
    const x = 40 + i * sw;
    doc.rect(x, y, sw - 4, 36).fill('#EFF6FF').stroke('#DBEAFE');
    doc.fillColor(GRAY).fontSize(7).font('Helvetica').text(s.l, x + 6, y + 4);
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(String(s.v), x + 6, y + 14);
  });
  y += 44;

  // ── Section: Collections ──
  doc.rect(40, y, W, 18).fill(DARK);
  doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold')
     .text('INSTALLMENT & COLLECTIONS', 48, y + 4);
  y += 22;

  const collKpis = [
    { l: 'Total Collected',     v: `PKR ${fmtNum(r.total_collections)}`, c: GREEN },
    { l: 'Outstanding Balance', v: `PKR ${fmtNum(r.total_outstanding)}`, c: RED },
  ];
  collKpis.forEach((s, i) => {
    const x = 40 + i * (W / 2);
    doc.rect(x, y, W / 2 - 4, 34).fill('#F0FDF4').stroke('#D1FAE5');
    doc.fillColor(GRAY).fontSize(7).font('Helvetica').text(s.l, x + 8, y + 4);
    doc.fillColor(s.c).fontSize(11).font('Helvetica-Bold').text(s.v, x + 8, y + 14);
  });
  y += 42;

  // ── Section: Expense Breakdown ──
  const expBreak = data.expenseBreakdown || {};
  const expKeys  = Object.keys(expBreak);
  if (expKeys.length) {
    doc.rect(40, y, W, 18).fill(DARK);
    doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold').text('EXPENSE BREAKDOWN', 48, y + 4);
    y += 22;

    expKeys.slice(0, 8).forEach((cat, i) => {
      const ey = y + i * 16;
      const pct = parseFloat(r.total_expenses) > 0
        ? ((expBreak[cat] / parseFloat(r.total_expenses)) * 100).toFixed(1)
        : '0.0';
      doc.fillColor(DARK).fontSize(8).font('Helvetica')
         .text(cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 40, ey);
      doc.fillColor(GRAY).fontSize(8)
         .text(`PKR ${fmtNum(expBreak[cat])}  (${pct}%)`, 300, ey);
      doc.moveTo(40, ey + 12).lineTo(555, ey + 12).strokeColor('#F3F4F6').stroke();
    });

    y += expKeys.slice(0, 8).length * 16 + 8;
  }

  // ── Section: Top Projects ──
  const projects = data.topProjects || [];
  if (projects.length) {
    doc.rect(40, y, W, 18).fill(DARK);
    doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold').text('TOP PERFORMING PROJECTS', 48, y + 4);
    y += 22;

    projects.forEach((p, i) => {
      const py = y + i * 16;
      doc.fillColor(DARK).fontSize(8).font('Helvetica').text(`${i + 1}. ${p.project}`, 40, py);
      doc.fillColor(GREEN).fontSize(8).text(`PKR ${fmtNum(p.revenue)}  |  ${p.bookings} bookings`, 280, py);
      doc.moveTo(40, py + 12).lineTo(555, py + 12).strokeColor('#F3F4F6').stroke();
    });

    y += projects.length * 16 + 8;
  }

  // ── Audit Certification Strip ──
  if (y > 720) { doc.addPage(); y = 40; }
  doc.rect(40, y, W, 50).fill('#FFFBEB').stroke(GOLD);
  doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
     .text('AUDIT CERTIFICATION', 50, y + 6);
  doc.fillColor(GRAY).fontSize(7.5).font('Helvetica')
     .text('This financial audit report has been automatically generated by Burooj Heights ERP system based on recorded transactions, payments, and operational data. All figures are in Pakistani Rupees (PKR). This report is system-generated and requires authorized signatory for official use.', 50, y + 18, { width: W - 20 });

  // ── Footer ──
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.rect(0, 810, 595, 32).fill(DARK);
    doc.fillColor(GOLD).fontSize(7).font('Helvetica')
       .text('BUROOJ HEIGHTS ERP  |  CONFIDENTIAL FINANCIAL DOCUMENT', 40, 818, { align: 'center', width: 515 });
  }

  doc.end();
}

// ── CSV Export ───────────────────────────────────────────────

async function generateAuditCSV(reportId, res) {
  const result = await query('SELECT * FROM audit_reports WHERE id = $1', [reportId]);
  if (!result.rows.length) throw new Error('Report not found');

  const r = result.rows[0];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition',
    `attachment; filename="audit_${r.type}_${r.period_label.replace(/\s/g,'_')}.csv"`);

  const lines = [
    ['BUROOJ HEIGHTS ERP — FINANCIAL AUDIT REPORT'],
    [],
    ['Report Type', r.type.toUpperCase().replace('_',' ')],
    ['Period',      r.period_label],
    ['Start Date',  r.period_start],
    ['End Date',    r.period_end],
    ['Generated At', new Date(r.generated_at).toLocaleString('en-PK')],
    [],
    ['FINANCIAL SUMMARY'],
    ['Metric', 'Value'],
    ['Total Income (PKR)',    r.total_income],
    ['Total Expenses (PKR)',  r.total_expenses],
    ['Net Profit (PKR)',      r.net_profit],
    ['Growth Rate (%)',       r.growth_rate],
    ['ROI (%)',               r.roi],
    ['Profit Margin (%)',     r.profit_margin],
    [],
    ['SALES PERFORMANCE'],
    ['Total Bookings',    r.total_bookings],
    ['Units Sold',        r.total_units_sold],
    ['Avg Deal Size (PKR)', r.avg_deal_size],
    ['Total Collections (PKR)', r.total_collections],
    ['Outstanding Balance (PKR)', r.total_outstanding],
    ['Collection Rate (%)', r.collection_rate],
    [],
    ['EXPENSE BREAKDOWN'],
    ['Category', 'Amount (PKR)'],
  ];

  const expBreak = r.expense_breakdown || {};
  for (const [cat, amt] of Object.entries(expBreak)) {
    lines.push([cat.replace(/_/g,' '), amt]);
  }

  const csv = lines.map(row => row.map(cell => `"${cell}"`).join(',')).join('\r\n');
  res.send(csv);
}

module.exports = {
  generateAudit,
  generateMonthlyAudit,
  generateSemiAnnualAudit,
  generateAnnualAudit,
  generateAuditPDF,
  generateAuditCSV,
  periodRange,
};

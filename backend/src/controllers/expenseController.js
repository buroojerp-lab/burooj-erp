// controllers/expenseController.js
const { query, withTransaction } = require('../config/database');
const Tesseract = require('tesseract.js');
const path = require('path');
const logger = require('../config/logger');

// GET /expenses
exports.getExpenses = async (req, res) => {
  const {
    category, status, from_date, to_date,
    search, page = 1, limit = 20,
  } = req.query;

  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params = [];

  if (category) { conditions.push(`e.category = $${params.length + 1}`); params.push(category); }
  if (status)   { conditions.push(`e.status = $${params.length + 1}`); params.push(status); }
  if (from_date){ conditions.push(`e.date >= $${params.length + 1}`); params.push(from_date); }
  if (to_date)  { conditions.push(`e.date <= $${params.length + 1}`); params.push(to_date); }
  if (search)   { conditions.push(`(e.title ILIKE $${params.length + 1} OR e.notes ILIKE $${params.length + 1})`); params.push(`%${search}%`); }

  const where = conditions.join(' AND ');

  const [rows, total, summary] = await Promise.all([
    query(
      `SELECT
        e.id, e.expense_no, e.title, e.category, e.amount,
        e.date, e.payment_method, e.status, e.notes,
        e.ocr_vendor_name, e.ocr_amount, e.ocr_date,
        u.name paid_by_name,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', eb.id,
            'file_url', eb.file_url,
            'file_name', eb.file_name,
            'file_type', eb.file_type,
            'ocr_done', eb.ocr_done
          )
        ) FILTER (WHERE eb.id IS NOT NULL) bills,
        e.created_at
       FROM expenses e
       LEFT JOIN users u ON u.id = e.paid_by
       LEFT JOIN expense_bills eb ON eb.expense_id = e.id
       WHERE ${where}
       GROUP BY e.id, u.name
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) FROM expenses e WHERE ${where}`,
      params
    ),
    query(
      `SELECT
        SUM(amount) total_amount,
        JSON_OBJECT_AGG(category, cat_total) category_breakdown
       FROM (
         SELECT category, SUM(amount) cat_total
         FROM expenses e WHERE ${where}
         GROUP BY category
       ) sub`,
      params
    ),
  ]);

  res.json({
    data: rows.rows,
    summary: summary.rows[0],
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total.rows[0].count),
      pages: Math.ceil(total.rows[0].count / limit),
    },
  });
};

// POST /expenses
exports.createExpense = async (req, res) => {
  const {
    title, category, amount, date,
    payment_method, paid_by, notes,
  } = req.body;

  if (!title || !category || !amount || !date) {
    return res.status(400).json({ error: 'Title, category, amount and date required' });
  }

  // Generate expense number
  const countRes = await query('SELECT COUNT(*) FROM expenses');
  const expNo = `EXP-${String(parseInt(countRes.rows[0].count) + 1).padStart(5, '0')}`;

  const result = await query(
    `INSERT INTO expenses
       (expense_no, title, category, amount, date, payment_method, paid_by, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [expNo, title, category, amount, date, payment_method || 'cash',
     paid_by || req.user.id, notes, req.user.id]
  );

  // Auto journal entry
  await createExpenseJournalEntry(result.rows[0]);

  res.status(201).json({
    message: 'Expense recorded',
    expense: result.rows[0],
  });
};

// PUT /expenses/:id
exports.updateExpense = async (req, res) => {
  const { id } = req.params;
  const { title, category, amount, date, payment_method, paid_by, notes, status } = req.body;

  const result = await query(
    `UPDATE expenses
     SET title = COALESCE($1, title),
         category = COALESCE($2, category),
         amount = COALESCE($3, amount),
         date = COALESCE($4, date),
         payment_method = COALESCE($5, payment_method),
         paid_by = COALESCE($6, paid_by),
         notes = COALESCE($7, notes),
         status = COALESCE($8, status),
         updated_at = NOW()
     WHERE id = $9
     RETURNING *`,
    [title, category, amount, date, payment_method, paid_by, notes, status, id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  res.json({ expense: result.rows[0] });
};

// DELETE /expenses/:id
exports.deleteExpense = async (req, res) => {
  await query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
  res.json({ message: 'Expense deleted' });
};

// POST /expenses/:id/bills — Upload bill
exports.uploadBill = async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = req.file.location || `/uploads/${req.file.filename}`;

  const result = await query(
    `INSERT INTO expense_bills
       (expense_id, file_url, file_name, file_type, file_size)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, fileUrl, req.file.originalname, req.file.mimetype, req.file.size]
  );

  const bill = result.rows[0];

  // Run OCR asynchronously
  if (req.file.mimetype.startsWith('image/')) {
    runOCR(bill.id, req.file.path || fileUrl).catch(console.error);
  }

  res.status(201).json({ bill });
};

// OCR processing
const runOCR = async (billId, filePathOrUrl) => {
  try {
    const { data: { text } } = await Tesseract.recognize(
      filePathOrUrl,
      'eng',
      { logger: m => {} }
    );

    // Extract key info with regex
    const amountMatch  = text.match(/(?:amount|total|rs\.?|pkr\.?)\s*[:\-]?\s*([\d,]+(?:\.\d{2})?)/i);
    const dateMatch    = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
    const vendorMatch  = text.match(/(?:from|vendor|company|store)[:\s]+([A-Za-z\s]+)/i);

    const ocrResult = {
      raw_text: text,
      amount: amountMatch?.[1]?.replace(/,/g, ''),
      date: dateMatch?.[1],
      vendor: vendorMatch?.[1]?.trim(),
    };

    await query(
      `UPDATE expense_bills SET ocr_done = true, ocr_result = $1 WHERE id = $2`,
      [JSON.stringify(ocrResult), billId]
    );

    // Update parent expense with OCR data if available
    if (ocrResult.amount || ocrResult.vendor) {
      await query(
        `UPDATE expenses
         SET ocr_amount = $1, ocr_vendor_name = $2, ocr_raw = $3
         WHERE id = (SELECT expense_id FROM expense_bills WHERE id = $4)`,
        [ocrResult.amount || null, ocrResult.vendor || null, text, billId]
      );
    }

    logger.info(`OCR completed for bill ${billId}`);
  } catch (err) {
    logger.error(`OCR failed for bill ${billId}:`, err.message);
    await query(
      `UPDATE expense_bills SET ocr_done = true, ocr_result = $1 WHERE id = $2`,
      [JSON.stringify({ error: err.message }), billId]
    );
  }
};

// GET /expenses/report
exports.getReport = async (req, res) => {
  const { period = 'monthly', year, month } = req.query;
  const now = new Date();
  const y = year || now.getFullYear();

  let groupBy, dateFilter;

  if (period === 'daily') {
    groupBy = "DATE_TRUNC('day', date)";
    dateFilter = month
      ? `EXTRACT(year FROM date) = ${y} AND EXTRACT(month FROM date) = ${month}`
      : `date >= CURRENT_DATE - INTERVAL '30 days'`;
  } else if (period === 'weekly') {
    groupBy = "DATE_TRUNC('week', date)";
    dateFilter = `EXTRACT(year FROM date) = ${y}`;
  } else if (period === 'yearly') {
    groupBy = "DATE_TRUNC('year', date)";
    dateFilter = '1=1';
  } else {
    groupBy = "DATE_TRUNC('month', date)";
    dateFilter = `EXTRACT(year FROM date) = ${y}`;
  }

  const result = await query(`
    SELECT
      ${groupBy} period,
      SUM(amount) total,
      COUNT(*) count,
      JSON_OBJECT_AGG(category, cat_total) breakdown
    FROM (
      SELECT date, amount, category
      FROM expenses
      WHERE ${dateFilter}
    ) sub
    CROSS JOIN LATERAL (
      SELECT category, SUM(amount) cat_total
      FROM expenses
      WHERE ${dateFilter}
      GROUP BY category
    ) cats
    GROUP BY ${groupBy}
    ORDER BY period
  `);

  res.json({ report: result.rows, period });
};

// Auto journal entry for expense
const createExpenseJournalEntry = async (expense) => {
  try {
    const countRes = await query('SELECT COUNT(*) FROM journal_entries');
    const entryNo = `JV-EXP-${String(parseInt(countRes.rows[0].count) + 1).padStart(5, '0')}`;

    const entryRes = await query(
      `INSERT INTO journal_entries (entry_no, date, description, reference)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [entryNo, expense.date, `Expense: ${expense.title}`, expense.expense_no]
    );

    const entryId = entryRes.rows[0].id;

    // Get account codes
    const catAccountMap = {
      office_rent: '5100', electricity: '5400', internet: '5400',
      salaries: '5200', marketing: '5300', office_supplies: '5500',
      fuel_transport: '5500', maintenance: '5500', miscellaneous: '5500',
    };

    const expAccCode = catAccountMap[expense.category] || '5500';
    const cashAccCode = expense.payment_method === 'bank' ? '1100' : '1100';

    const [expAcc, cashAcc] = await Promise.all([
      query('SELECT id FROM chart_of_accounts WHERE code = $1', [expAccCode]),
      query('SELECT id FROM chart_of_accounts WHERE code = $1', [cashAccCode]),
    ]);

    await Promise.all([
      query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit)
         VALUES ($1, $2, $3)`,
        [entryId, expAcc.rows[0]?.id, expense.amount]
      ),
      query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, credit)
         VALUES ($1, $2, $3)`,
        [entryId, cashAcc.rows[0]?.id, expense.amount]
      ),
    ]);
  } catch (err) {
    logger.error('Journal entry for expense failed:', err.message);
  }
};

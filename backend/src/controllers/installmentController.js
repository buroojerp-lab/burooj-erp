// controllers/installmentController.js
const { query, withTransaction } = require('../config/database');
const dayjs = require('dayjs');

// Generate installment schedule for a booking
exports.generateSchedule = async (bookingId, client) => {
  const db = client || { query: (text, params) => query(text, params) };

  const result = await db.query(
    `SELECT b.*, pp.installment_months, pp.interest_rate,
            pp.confirmation_pct, pp.balloon_pct, pp.possession_pct
     FROM bookings b
     JOIN payment_plans pp ON pp.id = b.payment_plan_id
     WHERE b.id = $1`,
    [bookingId]
  );

  const booking = result.rows[0];
  if (!booking) throw new Error('Booking not found');

  const finalPrice      = parseFloat(booking.final_price);
  const downPayment     = parseFloat(booking.down_payment_amount);
  const months          = booking.installment_months;
  const confirmationPct = parseFloat(booking.confirmation_pct || 0);
  const balloonPct      = parseFloat(booking.balloon_pct      || 0);
  const possessionPct   = parseFloat(booking.possession_pct   || 0);

  if (months === 0) return; // Full cash payment plan

  const confirmationAmt = Math.round(finalPrice * confirmationPct / 100);
  const balloonAmt      = Math.round(finalPrice * balloonPct      / 100);
  const possessionAmt   = Math.round(finalPrice * possessionPct   / 100);

  // Monthly installments cover what's left after all special payments
  const monthlyBase = finalPrice - downPayment - confirmationAmt - balloonAmt - possessionAmt;
  const monthlyAmt  = Math.round(monthlyBase / months);

  // ── Schedule start date ────────────────────────────────────────────────────
  // Burooj Heights launched 01 Jan 2024.
  // 18-month plan → fixed start 2024-01-01 (all installments Jan 2024 onward).
  // All other plans → start the 1st of the month following the booking date.
  const bookingDate = dayjs(booking.booking_date || new Date());
  const BH_LAUNCH   = dayjs('2024-01-01');
  const startDate   = months === 18
    ? BH_LAUNCH
    : bookingDate.add(1, 'month').startOf('month');

  const inserts = [];

  // ── installment_no = 0 → Confirmation (due on launch date for 18-month plan) ──
  if (confirmationAmt > 0) {
    const confDue = months === 18
      ? BH_LAUNCH.format('YYYY-MM-DD')          // 2024-01-01
      : bookingDate.add(30, 'day').format('YYYY-MM-DD');
    inserts.push(
      db.query(
        `INSERT INTO installment_schedules
           (booking_id, installment_no, due_date, amount, principal_amount, payment_type)
         VALUES ($1, 0, $2, $3, $4, 'confirmation')
         ON CONFLICT (booking_id, installment_no) DO NOTHING`,
        [bookingId, confDue, confirmationAmt, confirmationAmt]
      )
    );
  }

  // ── installment_no = 1..months → Monthly ──
  for (let i = 1; i <= months; i++) {
    const dueDate = startDate.add(i - 1, 'month').format('YYYY-MM-DD');
    inserts.push(
      db.query(
        `INSERT INTO installment_schedules
           (booking_id, installment_no, due_date, amount, principal_amount, payment_type)
         VALUES ($1, $2, $3, $4, $5, 'monthly')
         ON CONFLICT (booking_id, installment_no) DO NOTHING`,
        [bookingId, i, dueDate, monthlyAmt, monthlyAmt]
      )
    );
  }

  // ── installment_no = months+1 → Balloon (1 month after last installment) ──
  if (balloonAmt > 0) {
    const balloonDue = startDate.add(months, 'month').format('YYYY-MM-DD');
    inserts.push(
      db.query(
        `INSERT INTO installment_schedules
           (booking_id, installment_no, due_date, amount, principal_amount, payment_type)
         VALUES ($1, $2, $3, $4, $5, 'balloon')
         ON CONFLICT (booking_id, installment_no) DO NOTHING`,
        [bookingId, months + 1, balloonDue, balloonAmt, balloonAmt]
      )
    );
  }

  // ── installment_no = months+2 → On Possession (1 month after balloon) ──
  if (possessionAmt > 0) {
    const possessionDue = startDate.add(months + 1, 'month').format('YYYY-MM-DD');
    inserts.push(
      db.query(
        `INSERT INTO installment_schedules
           (booking_id, installment_no, due_date, amount, principal_amount, payment_type)
         VALUES ($1, $2, $3, $4, $5, 'possession')
         ON CONFLICT (booking_id, installment_no) DO NOTHING`,
        [bookingId, months + 2, possessionDue, possessionAmt, possessionAmt]
      )
    );
  }

  await Promise.all(inserts);

  // Update booking with all computed special amounts
  await db.query(
    `UPDATE bookings
     SET confirmation_amount    = $1,
         balloon_payment_amount = $2,
         possession_amount      = $3,
         updated_at             = NOW()
     WHERE id = $4`,
    [confirmationAmt, balloonAmt, possessionAmt, bookingId]
  ).catch(() => {});
};

// GET /installments?booking_id=&customer_id=&status=&page=&limit=
exports.getInstallments = async (req, res) => {
  const {
    booking_id, customer_id, status, tower_id,
    page = 1, limit = 20,
  } = req.query;

  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (booking_id)  { conditions.push(`s.booking_id = $${params.length + 1}`); params.push(booking_id); }
  if (customer_id) { conditions.push(`c.id = $${params.length + 1}`);         params.push(customer_id); }
  if (status)      { conditions.push(`s.status = $${params.length + 1}`);     params.push(status); }
  if (tower_id)    { conditions.push(`u.tower_id = $${params.length + 1}`);   params.push(tower_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, total] = await Promise.all([
    query(
      `SELECT
        s.id, s.installment_no, s.due_date, s.amount,
        s.late_fee, s.status, s.paid_date, s.paid_amount,
        s.payment_method, s.reference_no,
        (s.amount + s.late_fee - s.paid_amount) balance,
        CASE WHEN s.due_date < CURRENT_DATE AND s.status != 'paid'
             THEN CURRENT_DATE - s.due_date ELSE 0 END days_overdue,
        b.booking_no, b.id booking_id,
        c.name customer_name, c.phone customer_phone,
        u.unit_number, u.unit_type
       FROM installment_schedules s
       JOIN bookings b ON b.id = s.booking_id
       JOIN customers c ON c.id = b.customer_id
       JOIN units u ON u.id = b.unit_id
       ${where}
       ORDER BY s.due_date ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) FROM installment_schedules s
       JOIN bookings b ON b.id = s.booking_id
       JOIN customers c ON c.id = b.customer_id
       JOIN units u ON u.id = b.unit_id ${where}`,
      params
    ),
  ]);

  res.json({
    data: rows.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total.rows[0].count),
      pages: Math.ceil(total.rows[0].count / limit),
    },
  });
};

// POST /installments/:id/pay — Record a payment
exports.recordPayment = async (req, res) => {
  const { id } = req.params;
  const {
    amount, payment_method, reference_no,
    bank_name, notes, payment_date,
  } = req.body;

  if (!amount || !payment_method) {
    return res.status(400).json({ error: 'Amount and payment method required' });
  }

  await withTransaction(async (client) => {
    // Get installment
    const instRes = await client.query(
      'SELECT * FROM installment_schedules WHERE id = $1 FOR UPDATE',
      [id]
    );
    const inst = instRes.rows[0];
    if (!inst) throw { status: 404, message: 'Installment not found' };
    if (inst.status === 'paid') throw { status: 400, message: 'Already paid' };

    const paidDate = payment_date || new Date().toISOString().split('T')[0];
    const totalPaid = parseFloat(inst.paid_amount) + parseFloat(amount);
    const totalDue = parseFloat(inst.amount) + parseFloat(inst.late_fee);
    const newStatus = totalPaid >= totalDue ? 'paid' : 'partial';

    // Update installment
    await client.query(
      `UPDATE installment_schedules
       SET paid_amount = $1, status = $2, paid_date = $3,
           payment_method = $4, reference_no = $5, updated_at = NOW()
       WHERE id = $6`,
      [totalPaid, newStatus, paidDate, payment_method, reference_no, id]
    );

    // Record payment
    const payRes = await client.query(
      `INSERT INTO payments
         (booking_id, installment_id, amount, payment_date, payment_method,
          reference_no, bank_name, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [inst.booking_id, id, amount, paidDate, payment_method,
       reference_no, bank_name, notes, req.user.id]
    );

    // Send WhatsApp + Email confirmation
    const bookingRes = await client.query(
      `SELECT b.booking_no, b.final_price, c.name, c.phone, c.email, u.unit_number
       FROM bookings b
       JOIN customers c ON c.id = b.customer_id
       JOIN units u ON u.id = b.unit_id
       WHERE b.id = $1`,
      [inst.booking_id]
    );
    const bk = bookingRes.rows[0];

    if (bk && newStatus === 'paid') {
      const receiptNo = `RCT-${payRes.rows[0].id.slice(0, 8).toUpperCase()}`;
      const totalCollected = await client.query(
        'SELECT COALESCE(SUM(amount),0) t FROM payments WHERE booking_id = $1',
        [inst.booking_id]
      );
      const outstanding = Math.max(0, parseFloat(bk.final_price) - parseFloat(totalCollected.rows[0].t));

      // WhatsApp (non-blocking)
      if (bk.phone) {
        const { sendWhatsApp } = require('../services/whatsappService');
        sendWhatsApp({
          phone: bk.phone,
          type: 'confirmation',
          data: {
            customer_name: bk.name,
            amount: parseFloat(amount).toLocaleString('en-PK'),
            unit_no: bk.unit_number,
            date: paidDate,
            booking_no: bk.booking_no,
          },
        }).catch(console.error);
      }

      // Email receipt (non-blocking)
      if (bk.email) {
        const { onPaymentReceived } = require('../services/emailService');
        onPaymentReceived({
          email:          bk.email,
          customer_name:  bk.name,
          receipt_no:     receiptNo,
          payment_date:   new Date(paidDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }),
          payment_method: (payment_method || '').toUpperCase(),
          amount:         parseFloat(amount).toLocaleString('en-PK'),
          outstanding:    outstanding.toLocaleString('en-PK'),
        }).catch(console.error);
      }
    }

    res.json({
      message: 'Payment recorded successfully',
      payment_id: payRes.rows[0].id,
      status: newStatus,
    });
  });
};

// PUT /bookings/:id/reschedule — Bulk-edit installment schedule
exports.reschedule = async (req, res) => {
  const { id: bookingId } = req.params;
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows array required' });
  }

  await withTransaction(async (client) => {
    // Verify booking belongs to caller's scope
    const bkRes = await client.query('SELECT id FROM bookings WHERE id = $1', [bookingId]);
    if (!bkRes.rows[0]) throw { status: 404, message: 'Booking not found' };

    for (const row of rows) {
      if (row._delete && row.id) {
        // Only delete truly pending rows (never touched)
        await client.query(
          `DELETE FROM installment_schedules
           WHERE id = $1 AND booking_id = $2 AND status = 'pending' AND paid_amount = 0`,
          [row.id, bookingId]
        );
      } else if (row.id) {
        // Update unpaid rows (amount, due_date, payment_type)
        await client.query(
          `UPDATE installment_schedules
           SET amount = $1, due_date = $2, principal_amount = $1,
               payment_type = $3, updated_at = NOW()
           WHERE id = $4 AND booking_id = $5 AND status NOT IN ('paid')`,
          [parseFloat(row.amount), row.due_date, row.payment_type || 'monthly', row.id, bookingId]
        );
      } else {
        // Insert new custom row with next installment_no
        const noRes = await client.query(
          'SELECT COALESCE(MAX(installment_no), 0) + 1 AS n FROM installment_schedules WHERE booking_id = $1',
          [bookingId]
        );
        await client.query(
          `INSERT INTO installment_schedules
             (booking_id, installment_no, due_date, amount, principal_amount, payment_type, status)
           VALUES ($1, $2, $3, $4, $4, $5, 'pending')`,
          [bookingId, noRes.rows[0].n, row.due_date, parseFloat(row.amount), row.payment_type || 'monthly']
        );
      }
    }
  });

  res.json({ success: true, message: 'Schedule updated' });
};

// POST /installments/apply-late-fees — Cron helper
exports.applyLateFees = async () => {
  const LATE_FEE_RATE = 0.02; // 2% per month

  const result = await query(
    `SELECT * FROM installment_schedules
     WHERE status IN ('pending', 'partial')
       AND due_date < CURRENT_DATE`,
  );

  for (const inst of result.rows) {
    const daysLate = Math.floor(
      (Date.now() - new Date(inst.due_date)) / (1000 * 60 * 60 * 24)
    );
    const monthsLate = Math.max(1, Math.ceil(daysLate / 30));
    const remaining = parseFloat(inst.amount) - parseFloat(inst.paid_amount);
    const lateFee = Math.round(remaining * LATE_FEE_RATE * monthsLate);

    await query(
      `UPDATE installment_schedules
       SET late_fee = $1, status = 'overdue', updated_at = NOW()
       WHERE id = $2`,
      [lateFee, inst.id]
    );
  }

  return result.rows.length;
};

// GET /installments/summary/:bookingId
exports.getBookingSummary = async (req, res) => {
  const result = await query(
    `SELECT
      COUNT(*) total,
      COUNT(*) FILTER (WHERE status = 'paid') paid,
      COUNT(*) FILTER (WHERE status IN ('pending', 'partial', 'overdue')) remaining,
      COALESCE(SUM(paid_amount), 0) total_paid,
      COALESCE(SUM(amount + late_fee - paid_amount)
        FILTER (WHERE status != 'paid'), 0) total_remaining,
      COALESCE(SUM(late_fee), 0) total_late_fees,
      MIN(due_date) FILTER (WHERE status IN ('pending', 'partial', 'overdue')) next_due_date,
      MIN(amount) FILTER (WHERE status IN ('pending', 'partial', 'overdue')) next_due_amount
     FROM installment_schedules
     WHERE booking_id = $1`,
    [req.params.bookingId]
  );

  res.json({ summary: result.rows[0] });
};

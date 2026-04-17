// routes/bookingRoutes.js
const express = require('express');
const PDFDocument = require('pdfkit');
const logger = require('../config/logger');
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const { generateSchedule, reschedule } = require('../controllers/installmentController');
const { sendWhatsApp } = require('../services/whatsappService');
const { onBookingConfirmed } = require('../services/emailService');
const { drawLetterpad, CONTENT, W: LP_W, H: LP_H, TEAL } = require('../utils/letterpad');
const router = express.Router();

router.use(authenticate);

// GET /bookings/payment-plans  ── must be before /:id
router.get('/payment-plans', async (req, res) => {
  const result = await query(
    'SELECT * FROM payment_plans WHERE is_active = true ORDER BY installment_months ASC'
  );
  res.json({ data: result.rows });
});

// GET /bookings
router.get('/', async (req, res) => {
  const { status, customer_id, agent_id, tower_id, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];

  if (status)      { conds.push(`b.status = $${params.length+1}`);      params.push(status); }
  if (customer_id) { conds.push(`b.customer_id = $${params.length+1}`); params.push(customer_id); }
  if (agent_id)    { conds.push(`b.agent_id = $${params.length+1}`);    params.push(agent_id); }
  if (tower_id)    { conds.push(`u.tower_id = $${params.length+1}`);    params.push(tower_id); }

  // Agents can only see their own bookings
  if (req.user.role === 'sales_agent') {
    conds.push(`b.agent_id = $${params.length+1}`); params.push(req.user.id);
  }

  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(
      `SELECT b.*, c.name customer_name, c.phone customer_phone, c.cnic,
              u.unit_number, u.unit_type, u.size_sqft,
              t.name tower_name, f.floor_no,
              a.name agent_name, pp.name plan_name,
              (SELECT COUNT(*) FROM installment_schedules WHERE booking_id = b.id AND status = 'paid') paid_count,
              (SELECT COUNT(*) FROM installment_schedules WHERE booking_id = b.id) total_count
       FROM bookings b
       JOIN customers c ON c.id = b.customer_id
       JOIN units u ON u.id = b.unit_id
       LEFT JOIN towers t ON t.id = u.tower_id
       LEFT JOIN floors f ON f.id = u.floor_id
       LEFT JOIN users a ON a.id = b.agent_id
       LEFT JOIN payment_plans pp ON pp.id = b.payment_plan_id
       WHERE ${where}
       ORDER BY b.booking_date DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM bookings b WHERE ${where}`, params),
  ]);

  res.json({
    data: rows.rows,
    pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count) },
  });
});

// GET /bookings/:id
router.get('/:id', async (req, res) => {
  const result = await query(
    `SELECT b.*,
            c.name customer_name, c.phone customer_phone, c.cnic, c.address,
            u.unit_number, u.unit_type, u.size_sqft, u.total_price unit_total,
            t.name tower_name, f.floor_no,
            a.name agent_name, pp.name plan_name, pp.installment_months
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     JOIN units u ON u.id = b.unit_id
     LEFT JOIN towers t ON t.id = u.tower_id
     LEFT JOIN floors f ON f.id = u.floor_id
     LEFT JOIN users a ON a.id = b.agent_id
     LEFT JOIN payment_plans pp ON pp.id = b.payment_plan_id
     WHERE b.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Booking not found' });

  // Get installment summary
  const summary = await query(
    `SELECT
      COUNT(*) total,
      COALESCE(SUM(paid_amount), 0) total_paid,
      COUNT(*) FILTER (WHERE status='paid') paid_count,
      COALESCE(SUM(amount + COALESCE(late_fee,0) - COALESCE(paid_amount,0))
        FILTER (WHERE status != 'paid'), 0) total_remaining,
      COALESCE(SUM(late_fee), 0) total_late_fees,
      MIN(due_date) FILTER (WHERE status IN ('pending','partial','overdue')) next_due
     FROM installment_schedules WHERE booking_id = $1`,
    [req.params.id]
  );

  res.json({ booking: result.rows[0], installmentSummary: summary.rows[0] });
});

// POST /bookings
router.post('/', async (req, res) => {
  const {
    customer_id, unit_id, payment_plan_id,
    booking_date, discount_amount = 0, notes, application_no, booking_form_url,
  } = req.body;

  if (!customer_id || !unit_id || !payment_plan_id) {
    return res.status(400).json({ error: 'customer_id, unit_id, payment_plan_id required' });
  }

  await withTransaction(async (client) => {
    // Check unit availability
    const unitRes = await client.query(
      "SELECT * FROM units WHERE id = $1 AND status = 'available' FOR UPDATE",
      [unit_id]
    );
    if (!unitRes.rows[0]) {
      throw { status: 400, message: 'Unit is not available' };
    }
    const unit = unitRes.rows[0];

    // Get payment plan
    const planRes = await client.query(
      'SELECT * FROM payment_plans WHERE id = $1 AND is_active = true',
      [payment_plan_id]
    );
    const plan = planRes.rows[0];
    if (!plan) throw { status: 400, message: 'Invalid payment plan' };

    const finalPrice      = unit.total_price - parseFloat(discount_amount);
    const downPayment     = Math.round(finalPrice * plan.down_payment_pct / 100);
    const confirmationAmt = Math.round(finalPrice * (parseFloat(plan.confirmation_pct)  || 0) / 100);
    const balloonAmt      = Math.round(finalPrice * (parseFloat(plan.balloon_pct)       || 0) / 100);
    const possessionAmt   = Math.round(finalPrice * (parseFloat(plan.possession_pct)    || 0) / 100);
    const installmentBase = finalPrice - downPayment - confirmationAmt - balloonAmt - possessionAmt;
    const installmentAmt  = plan.installment_months > 0
      ? Math.round(installmentBase / plan.installment_months)
      : 0;

    // Generate booking number
    const countRes = await client.query('SELECT COUNT(*) FROM bookings');
    const bookingNo = `BRJ-${new Date().getFullYear()}-${String(parseInt(countRes.rows[0].count) + 1).padStart(4, '0')}`;

    // Create booking
    const bookRes = await client.query(
      `INSERT INTO bookings
         (booking_no, customer_id, unit_id, agent_id, payment_plan_id,
          booking_date, total_price, discount_amount, final_price,
          down_payment_amount, monthly_installment,
          confirmation_amount, balloon_payment_amount, possession_amount,
          status, notes, application_no, booking_form_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending',$15,$16,$17)
       RETURNING *`,
      [bookingNo, customer_id, unit_id, req.user.id, payment_plan_id,
       booking_date || new Date().toISOString().split('T')[0],
       unit.total_price, discount_amount, finalPrice,
       downPayment, installmentAmt,
       confirmationAmt, balloonAmt, possessionAmt,
       notes, application_no || null, booking_form_url || null]
    );
    const booking = bookRes.rows[0];

    // Reserve unit
    await client.query(
      "UPDATE units SET status = 'reserved', updated_at = NOW() WHERE id = $1",
      [unit_id]
    );

    // Generate installment schedule
    await generateSchedule(booking.id, client);

    // Get customer for notifications
    const custRes = await client.query(
      'SELECT name, phone, email FROM customers WHERE id = $1',
      [customer_id]
    );
    const cust = custRes.rows[0];

    // Send WhatsApp booking confirmation (non-blocking)
    if (cust?.phone) {
      sendWhatsApp({
        phone: cust.phone,
        type: 'booking',
        data: {
          customer_name: cust.name,
          unit_no: unit.unit_number,
          booking_no: bookingNo,
        },
      }).catch(e => logger.error('WA booking confirm failed:', e.message));
    }

    // Send email confirmation (non-blocking)
    if (cust?.email) {
      onBookingConfirmed({
        email:        cust.email,
        customer_name: cust.name,
        booking_no:   bookingNo,
        unit_number:  unit.unit_number,
        tower_name:   unit.tower_name || 'Burooj Heights',
        floor_no:     unit.floor_no,
        final_price:  parseFloat(finalPrice).toLocaleString('en-PK'),
        plan_name:    booking.payment_plan_id || 'Standard',
      }).catch(e => logger.error('Email booking confirm failed:', e.message));
    }

    res.status(201).json({
      message: 'Booking created successfully',
      booking,
      bookingNo,
    });
  });
});

// PUT /bookings/:id/status
// PUT /bookings/:id/reschedule — Customize installment schedule
router.put('/:id/reschedule', authorize('admin', 'manager'), reschedule);

router.put('/:id/status', authorize('admin', 'manager'), async (req, res) => {
  const { status } = req.body;

  await withTransaction(async (client) => {
    const result = await client.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    const booking = result.rows[0];

    // Update unit status
    const unitStatus = status === 'active' ? 'sold' :
                       status === 'cancelled' ? 'available' : 'reserved';
    await client.query(
      'UPDATE units SET status = $1, updated_at = NOW() WHERE id = $2',
      [unitStatus, booking.unit_id]
    );

    res.json({ booking });
  });
});

// POST /bookings/:id/refund
router.post('/:id/refund', authorize('admin', 'manager'), async (req, res) => {
  const { refund_amount, reason } = req.body;
  if (!refund_amount) return res.status(400).json({ error: 'refund_amount is required' });

  await withTransaction(async (client) => {
    const bookRes = await client.query(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [req.params.id]
    );
    const booking = bookRes.rows[0];
    if (!booking) throw { status: 404, message: 'Booking not found' };
    if (booking.status === 'cancelled') throw { status: 400, message: 'Booking already cancelled' };

    // Update booking: cancel + record refund
    const updated = await client.query(
      `UPDATE bookings SET status = 'cancelled', notes = COALESCE(notes,'') || $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [`\n[REFUND] Amount: PKR ${parseFloat(refund_amount).toLocaleString()} | Reason: ${reason || 'N/A'} | Date: ${new Date().toISOString().split('T')[0]}`, req.params.id]
    );

    // Free the unit
    await client.query(
      "UPDATE units SET status = 'available', updated_at = NOW() WHERE id = $1",
      [booking.unit_id]
    );

    // Cancel pending installments
    await client.query(
      "UPDATE installment_schedules SET status = 'cancelled' WHERE booking_id = $1 AND status IN ('pending','overdue','partial')",
      [req.params.id]
    );

    res.json({
      booking: updated.rows[0],
      message: `Refund of PKR ${parseFloat(refund_amount).toLocaleString()} processed. Booking cancelled.`,
    });
  });
});

// GET /bookings/:id/agreement (PDF)
router.get('/:id/agreement', async (req, res) => {
  const result = await query(
    `SELECT b.*, c.name customer_name, c.phone customer_phone, c.cnic, c.address,
            u.unit_number, u.unit_type, u.size_sqft, t.name tower_name, f.floor_no,
            pp.name plan_name, pp.installment_months
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     JOIN units u ON u.id = b.unit_id
     LEFT JOIN towers t ON t.id = u.tower_id
     LEFT JOIN floors f ON f.id = u.floor_id
     LEFT JOIN payment_plans pp ON pp.id = b.payment_plan_id
     WHERE b.id = $1`,
    [req.params.id]
  );

  if (!result.rows[0]) return res.status(404).json({ error: 'Booking not found' });
  const b = result.rows[0];

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=agreement-${b.booking_no}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('BUROOJ HEIGHTS', { align: 'center' });
  doc.fontSize(14).font('Helvetica').text('SALE AGREEMENT', { align: 'center' });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Booking Info
  doc.fontSize(12).font('Helvetica-Bold').text(`Booking No: ${b.booking_no}`);
  doc.font('Helvetica').text(`Date: ${new Date(b.booking_date).toLocaleDateString('en-PK')}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').text('BUYER INFORMATION');
  doc.font('Helvetica');
  doc.text(`Name: ${b.customer_name}`);
  doc.text(`CNIC: ${b.cnic}`);
  doc.text(`Phone: ${b.customer_phone}`);
  doc.text(`Address: ${b.address || 'N/A'}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').text('PROPERTY DETAILS');
  doc.font('Helvetica');
  doc.text(`Tower: ${b.tower_name}`);
  doc.text(`Floor: ${b.floor_no}`);
  doc.text(`Unit No: ${b.unit_number}`);
  doc.text(`Type: ${b.unit_type?.toUpperCase()}`);
  doc.text(`Size: ${b.size_sqft} sqft`);
  doc.moveDown();

  doc.font('Helvetica-Bold').text('PAYMENT DETAILS');
  doc.font('Helvetica');
  doc.text(`Total Price: PKR ${parseFloat(b.total_price).toLocaleString('en-PK')}`);
  if (b.discount_amount > 0) doc.text(`Discount: PKR ${parseFloat(b.discount_amount).toLocaleString('en-PK')}`);
  doc.text(`Final Price: PKR ${parseFloat(b.final_price).toLocaleString('en-PK')}`);
  doc.text(`Down Payment: PKR ${parseFloat(b.down_payment_amount).toLocaleString('en-PK')}`);
  doc.text(`Payment Plan: ${b.plan_name}`);
  if (b.monthly_installment > 0) {
    doc.text(`Monthly Installment: PKR ${parseFloat(b.monthly_installment).toLocaleString('en-PK')}`);
    doc.text(`Duration: ${b.installment_months} Months`);
  }
  doc.moveDown(2);

  // Signature
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();
  doc.font('Helvetica');
  doc.text('Buyer Signature: ____________________', 50, doc.y);
  doc.text('Seller Signature: ____________________', 350, doc.y - 12);
  doc.moveDown(2);
  doc.fontSize(9).text('This is a system generated agreement. Burooj Heights, Lahore, Pakistan.', { align: 'center' });

  doc.end();
});

// ── GET /bookings/:id/allotment  — Allotment Letter PDF ──
router.get('/:id/allotment', async (req, res) => {
  const result = await query(
    `SELECT b.*,
            c.name customer_name, c.phone customer_phone, c.cnic, c.address, c.nationality,
            u.unit_number, u.unit_type, u.size_sqft, u.bedrooms, u.bathrooms,
            t.name tower_name, f.floor_no,
            pp.name plan_name, pp.installment_months, pp.down_payment_pct
     FROM bookings b
     JOIN customers c    ON c.id = b.customer_id
     JOIN units u        ON u.id = b.unit_id
     LEFT JOIN towers t  ON t.id = u.tower_id
     LEFT JOIN floors f  ON f.id = u.floor_id
     LEFT JOIN payment_plans pp ON pp.id = b.payment_plan_id
     WHERE b.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Booking not found' });
  const b = result.rows[0];

  const fmtDateLong = (d) => new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });
  const fmtAmt      = (n) => `PKR ${parseFloat(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtFloor    = (n) => { const fn = parseInt(n); return fn === -1 ? 'Lower Ground' : fn === 0 ? 'Ground Floor' : `Floor ${fn}`; };
  const todayStr    = fmtDateLong(new Date());
  const CW_A        = CONTENT.right - CONTENT.left;
  const L           = CONTENT.left;
  const isResidential = ['apartment', 'penthouse'].includes(b.unit_type);

  const doc = new PDFDocument({ margin: 0, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=allotment-${b.booking_no}.pdf`);
  doc.pipe(res);

  // ── Official Burooj Letterpad ──
  drawLetterpad(doc, { date: todayStr, ref: b.booking_no });

  // ── Document Title ──
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
     .text('ALLOTMENT LETTER', L, CONTENT.top, { width: CW_A, align: 'center' });
  const ruleY = CONTENT.top + 17;
  doc.rect(L, ruleY, CW_A, 2).fill(TEAL);

  // ── Reference Strip (Booking No + App Form # side by side) ──
  let curY = ruleY + 6;
  const halfW = Math.floor(CW_A / 2) - 3;
  // Left pill
  doc.rect(L, curY, halfW, 19).fill('#f0f9ff').lineWidth(0.5).strokeColor(TEAL).stroke();
  doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
     .text('BOOKING NO', L + 6, curY + 3, { lineBreak: false });
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
     .text(b.booking_no, L + 6, curY + 11, { lineBreak: false });
  // Right pill — Application No (if set) else Booking Date
  const rpX = L + halfW + 6;
  doc.rect(rpX, curY, halfW, 19).fill('#f0f9ff').lineWidth(0.5).strokeColor(TEAL).stroke();
  if (b.application_no) {
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
       .text('APPLICATION FORM #', rpX + 6, curY + 3, { lineBreak: false });
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
       .text(b.application_no, rpX + 6, curY + 11, { lineBreak: false });
  } else {
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
       .text('BOOKING DATE', rpX + 6, curY + 3, { lineBreak: false });
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
       .text(fmtDateLong(b.booking_date), rpX + 6, curY + 11, { lineBreak: false });
  }
  curY += 27;

  // ── Salutation ──
  doc.fontSize(9.5).font('Helvetica').fillColor('#374151')
     .text(`Dear ${b.customer_name},`, L, curY);
  curY += 13;
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
     .text(
       'We are pleased to confirm that the following unit has been allotted to you at Burooj Heights as per ' +
       'the terms and conditions of your signed booking agreement.',
       L, curY, { width: CW_A }
     );
  curY += 24;

  // ── Two-column: ALLOTTEE + PROPERTY ──
  const colW2 = halfW;
  const colRX = L + colW2 + 6;
  const colTopY = curY;

  // ── ALLOTTEE DETAILS (left column) ──
  doc.rect(L, curY, colW2, 14).fill(TEAL);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
     .text('ALLOTTEE DETAILS', L + 6, curY + 3, { lineBreak: false });
  curY += 14;

  const leftRows = [
    ['Full Name',    b.customer_name],
    ['CNIC No.',     b.cnic || '—'],
    ['Phone',        b.customer_phone || '—'],
    ['Address',      b.address || '—'],
    ['Nationality',  b.nationality || 'Pakistani'],
  ];
  if (b.application_no) leftRows.unshift(['App. Form #', b.application_no]);

  leftRows.forEach((r, i) => {
    doc.rect(L, curY, colW2, 15).fill(i % 2 === 0 ? '#f8fafc' : '#ffffff');
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
       .text(r[0], L + 5, curY + 3, { width: 78, lineBreak: false });
    doc.font('Helvetica-Bold').fillColor('#1e293b')
       .text(String(r[1]).substring(0, 32), L + 85, curY + 3, { width: colW2 - 90, lineBreak: false });
    curY += 15;
  });
  const leftBottomY = curY;

  // ── PROPERTY DETAILS (right column) ──
  let rCurY = colTopY;
  doc.rect(colRX, rCurY, colW2, 14).fill(TEAL);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
     .text('PROPERTY DETAILS', colRX + 6, rCurY + 3, { lineBreak: false });
  rCurY += 14;

  const propRows = [
    ['Project',    'Burooj Heights'],
    ['Tower',      b.tower_name || '—'],
    ['Floor',      fmtFloor(b.floor_no)],
    ['Unit No.',   b.unit_number],
    ['Unit Type',  (b.unit_type || '').replace(/_/g, ' ').toUpperCase()],
    ['Super Area', `${b.size_sqft} sqft`],
  ];
  if (isResidential && parseInt(b.bedrooms) > 0) {
    propRows.push(['Layout', `${b.bedrooms} Bed  |  ${b.bathrooms} Bath`]);
  }

  propRows.forEach((r, i) => {
    doc.rect(colRX, rCurY, colW2, 15).fill(i % 2 === 0 ? '#f8fafc' : '#ffffff');
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
       .text(r[0], colRX + 5, rCurY + 3, { width: 65, lineBreak: false });
    doc.font('Helvetica-Bold').fillColor('#1e293b')
       .text(String(r[1]), colRX + 72, rCurY + 3, { width: colW2 - 77, lineBreak: false });
    rCurY += 15;
  });

  // Align curY to whichever column is taller
  curY = Math.max(leftBottomY, rCurY) + 8;

  // ── FINANCIAL SUMMARY (full width) ──
  doc.rect(L, curY, CW_A, 14).fill(TEAL);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
     .text('FINANCIAL SUMMARY', L + 6, curY + 3, { lineBreak: false });
  curY += 14;

  const finRows = [
    ['Total Sale Price',    fmtAmt(b.total_price)],
  ];
  if (parseFloat(b.discount_amount) > 0)
    finRows.push(['Discount Applied', `- ${fmtAmt(b.discount_amount)}`]);
  finRows.push(['Final Sale Price', fmtAmt(b.final_price)]);
  finRows.push([`Down Payment (${b.down_payment_pct || 20}%)`, fmtAmt(b.down_payment_amount)]);
  finRows.push(['Payment Plan', b.plan_name || '—']);
  if (parseFloat(b.monthly_installment) > 0) {
    finRows.push(['Monthly Installment', fmtAmt(b.monthly_installment)]);
    finRows.push(['Duration', `${b.installment_months} Months`]);
  }

  finRows.forEach((r, i) => {
    const isFinal = r[0] === 'Final Sale Price';
    doc.rect(L, curY, CW_A, 15).fill(isFinal ? '#e6f7fa' : (i % 2 === 0 ? '#f8fafc' : '#ffffff'));
    doc.fontSize(8).font('Helvetica').fillColor('#64748b')
       .text(r[0], L + 8, curY + 3, { width: 280, lineBreak: false });
    doc.font(isFinal ? 'Helvetica-Bold' : 'Helvetica-Bold')
       .fillColor(isFinal ? TEAL : '#1e293b')
       .text(String(r[1]), L + 290, curY + 3, { width: CW_A - 298, align: 'right', lineBreak: false });
    curY += 15;
  });
  curY += 8;

  // ── TERMS & CONDITIONS ──
  doc.rect(L, curY, CW_A, 14).fill('#334155');
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
     .text('TERMS & CONDITIONS', L + 6, curY + 3, { lineBreak: false });
  curY += 18;

  const TERMS = [
    '1. This allotment is subject to the terms and conditions as agreed upon at the time of booking.',
    '2. The allottee must make all payments as per the agreed schedule. Failure to pay installments on time may attract late payment charges.',
    '3. Burooj Heights reserves the right to cancel this allotment in case of default, misrepresentation, or breach of agreement.',
  ];
  doc.fontSize(8).font('Helvetica').fillColor('#374151');
  TERMS.forEach(t => {
    doc.text(t, L + 4, curY, { width: CW_A - 8 });
    curY += 15;
  });
  curY += 10;

  // ── Divider ──
  doc.moveTo(L, curY).lineTo(CONTENT.right, curY).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
  curY += 14;

  // ── Signatures ──
  const sig1X = L;
  const sig2X = L + CW_A - 190;

  doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
  doc.text('________________________________', sig1X, curY);
  doc.text('________________________________', sig2X, curY);
  curY += 13;
  doc.font('Helvetica-Bold').fillColor('#1e293b')
     .text(b.customer_name, sig1X, curY);
  doc.font('Helvetica-Bold').fillColor('#1e293b')
     .text('Authorized Signatory', sig2X, curY);
  curY += 11;
  doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
     .text('Allottee — Signature & Date', sig1X, curY);
  doc.text('For Burooj Heights (Pvt.) Ltd.', sig2X, curY);

  doc.end();
});

// ── GET /bookings/:id/booking-form  — Booking Form PDF ──
router.get('/:id/booking-form', async (req, res) => {
  const result = await query(
    `SELECT b.*,
            c.name customer_name, c.phone customer_phone, c.cnic, c.address,
            c.email, c.occupation, c.nationality,
            u.unit_number, u.unit_type, u.size_sqft,
            t.name tower_name, f.floor_no,
            pp.name plan_name, pp.down_payment_pct, pp.installment_months,
            a.name agent_name
     FROM bookings b
     JOIN customers c    ON c.id = b.customer_id
     JOIN units u        ON u.id = b.unit_id
     LEFT JOIN towers t  ON t.id = u.tower_id
     LEFT JOIN floors f  ON f.id = u.floor_id
     LEFT JOIN payment_plans pp ON pp.id = b.payment_plan_id
     LEFT JOIN users a   ON a.id = b.agent_id
     WHERE b.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Booking not found' });
  const b = result.rows[0];

  // Fetch installment schedule (first 6 for preview)
  const instRes = await query(
    `SELECT installment_no, due_date, amount FROM installment_schedules
     WHERE booking_id = $1 ORDER BY installment_no LIMIT 6`,
    [req.params.id]
  );

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=booking-form-${b.booking_no}.pdf`);
  doc.pipe(res);

  // ── Letterhead ──
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e293b').text('BUROOJ HEIGHTS', { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('#64748b')
     .text('Real Estate Development  |  Lahore  |  Tel: 03001234567', { align: 'center' });
  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(2).strokeColor('#f97316').stroke();
  doc.moveDown(0.4);
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text('BOOKING APPLICATION FORM', { align: 'center' });
  doc.moveDown(0.6);

  // ── Booking No & Date ──
  doc.fontSize(10).font('Helvetica').fillColor('#374151');
  const bkMeta = [
    ['Booking No', b.booking_no],
    ['Booking Date', new Date(b.booking_date).toLocaleDateString('en-PK')],
    ['Status', b.status?.toUpperCase()],
    ['Sales Agent', b.agent_name || 'Direct'],
  ];
  bkMeta.forEach(([k, v]) => {
    doc.text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(v).font('Helvetica');
  });
  doc.moveDown(0.6);

  // ── Section helper ──
  const sec = (title) => {
    doc.moveDown(0.3);
    doc.rect(50, doc.y, 495, 16).fill('#1e293b');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff').text(title, 55, doc.y - 12);
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
  };

  // ── Customer ──
  sec('BUYER INFORMATION');
  const grid2 = (rows) => {
    rows.forEach(([k1, v1, k2, v2]) => {
      doc.text(`${k1}: `, { continued: true }).font('Helvetica-Bold').text(v1 || '—', { width: 220, continued: false }).font('Helvetica');
      if (k2) {
        const x = 290;
        doc.text(`${k2}: `, x, doc.y - 13, { continued: true }).font('Helvetica-Bold').text(v2 || '—').font('Helvetica');
      }
    });
  };
  grid2([
    ['Full Name',    b.customer_name,  'CNIC',        b.cnic],
    ['Phone',        b.customer_phone, 'Email',        b.email || '—'],
    ['Occupation',   b.occupation,     'Nationality',  b.nationality || 'Pakistani'],
    ['Address',      b.address,        null,           null],
  ]);

  // ── Property ──
  sec('PROPERTY DETAILS');
  grid2([
    ['Project',   'Burooj Heights',  'Tower',      b.tower_name],
    ['Floor',     (({ fn = parseInt(b.floor_no) }) => fn === -1 ? 'Lower Ground' : fn === 0 ? 'Ground Floor' : `Floor ${fn}`)(), 'Unit No', b.unit_number],
    ['Unit Type', (b.unit_type || '').replace(/_/g,' ').toUpperCase(), 'Area', `${b.size_sqft} sqft`],
  ]);

  // ── Payment ──
  sec('PAYMENT DETAILS');
  grid2([
    ['Total Price',  `PKR ${parseFloat(b.total_price).toLocaleString('en-PK')}`,
     'Discount',     parseFloat(b.discount_amount) > 0 ? `PKR ${parseFloat(b.discount_amount).toLocaleString('en-PK')}` : 'None'],
    ['Final Price',  `PKR ${parseFloat(b.final_price).toLocaleString('en-PK')}`,
     'Down Payment', `PKR ${parseFloat(b.down_payment_amount).toLocaleString('en-PK')}`],
    ['Payment Plan', b.plan_name,
     'Installment',  b.monthly_installment > 0 ? `PKR ${parseFloat(b.monthly_installment).toLocaleString('en-PK')}/month` : 'Full Payment'],
  ]);

  // ── Installment schedule preview ──
  if (instRes.rows.length > 0) {
    sec('INSTALLMENT SCHEDULE (PREVIEW)');
    const tableX = [50, 160, 310, 430];
    const headers = ['#', 'Due Date', 'Amount (PKR)', 'Status'];
    headers.forEach((h, i) => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
      doc.rect(tableX[i], doc.y, i < 3 ? tableX[i + 1] - tableX[i] : 115, 14).fill('#475569');
      doc.text(h, tableX[i] + 3, doc.y - 11);
    });
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica').fillColor('#374151');
    instRes.rows.forEach((inst, idx) => {
      const rowY = doc.y;
      if (idx % 2 === 0) doc.rect(50, rowY, 495, 14).fill('#f8fafc');
      doc.fillColor('#374151');
      doc.text(`${inst.installment_no}`, tableX[0] + 3, rowY + 2);
      doc.text(new Date(inst.due_date).toLocaleDateString('en-PK'), tableX[1] + 3, rowY + 2);
      doc.text(parseFloat(inst.amount).toLocaleString('en-PK'), tableX[2] + 3, rowY + 2);
      doc.text('Pending', tableX[3] + 3, rowY + 2);
      doc.moveDown(0.6);
    });
    if (b.installment_months > 6) {
      doc.fontSize(8).fillColor('#64748b')
         .text(`... and ${b.installment_months - 6} more installments. Full schedule available in the system.`);
    }
  }

  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
  doc.moveDown(0.6);
  doc.fontSize(10).font('Helvetica').fillColor('#374151');
  doc.text('Buyer Signature: ____________________', 50, doc.y);
  doc.text('Authorized By: ____________________',  350, doc.y - 13);
  doc.moveDown(3);
  doc.fontSize(7).fillColor('#94a3b8')
     .text('Computer-generated Booking Form  |  Burooj Heights, Lahore, Pakistan', { align: 'center' });

  doc.end();
});

// ── GET /bookings/:id/statement-data  — Statement JSON for React view ──
router.get('/:id/statement-data', async (req, res) => {
  try {
    const bookingRes = await query(
      `SELECT b.*,
              c.name customer_name, c.phone customer_phone, c.cnic, c.address, c.email, c.nationality,
              u.unit_number, u.unit_type, u.size_sqft, u.bedrooms, u.bathrooms,
              t.name tower_name, f.floor_no,
              pp.name plan_name, pp.installment_months, pp.down_payment_pct,
              a.name agent_name
       FROM bookings b
       JOIN customers c    ON c.id = b.customer_id
       JOIN units u        ON u.id = b.unit_id
       LEFT JOIN towers t  ON t.id = u.tower_id
       LEFT JOIN floors f  ON f.id = u.floor_id
       LEFT JOIN payment_plans pp ON pp.id = b.payment_plan_id
       LEFT JOIN users a   ON a.id = b.agent_id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!bookingRes.rows[0]) return res.status(404).json({ error: 'Booking not found' });
    const b = bookingRes.rows[0];

    // Burooj Heights launched 01 Jan 2024 — statement always opens from this date
    const STMT_FROM = '2024-01-01';

    // Payments received BEFORE the statement period (for opening balance b/f)
    const preRes = await query(
      `SELECT COALESCE(SUM(amount), 0) AS pre_paid
       FROM payments WHERE booking_id = $1 AND payment_date < $2`,
      [req.params.id, STMT_FROM]
    );
    const prePaid = parseFloat(preRes.rows[0].pre_paid || 0);

    // Full total received (all time) — for the summary banner
    const allPaidRes = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE booking_id = $1`,
      [req.params.id]
    );
    const totalReceivedAll = parseFloat(allPaidRes.rows[0].total || 0);

    // Installment schedule from 01 Jan 2024 onwards
    const instRes = await query(
      `SELECT
         s.installment_no, s.due_date, s.amount, s.paid_amount, s.status, s.late_fee,
         (SELECT p.payment_date FROM payments p WHERE p.installment_id = s.id ORDER BY p.created_at DESC LIMIT 1) AS payment_date,
         (SELECT p.payment_method FROM payments p WHERE p.installment_id = s.id ORDER BY p.created_at DESC LIMIT 1) AS payment_mode,
         (SELECT p.reference_no   FROM payments p WHERE p.installment_id = s.id ORDER BY p.created_at DESC LIMIT 1) AS receipt_no
       FROM installment_schedules s
       WHERE s.booking_id = $1 AND s.due_date >= $2
       ORDER BY s.installment_no`,
      [req.params.id, STMT_FROM]
    );

    // Down payment (unlinked payment) — show if paid on/after Jan 2024
    const dpRes = await query(
      `SELECT * FROM payments WHERE booking_id = $1 AND installment_id IS NULL
       AND payment_date >= $2 ORDER BY payment_date LIMIT 1`,
      [req.params.id, STMT_FROM]
    );
    const dp = dpRes.rows[0];

    // Infer payment type from installment_no
    const instMonths = parseInt(b.installment_months || 18);
    const inferType = (no) => {
      if (no === 0)                return 'confirmation';
      if (no > instMonths + 1)     return 'possession';
      if (no > instMonths)         return 'balloon';
      return 'monthly';
    };
    const payHeadLabel = (type) => {
      if (type === 'confirmation') return 'Confirmation Payment';
      if (type === 'balloon')      return 'Balloon Payment';
      if (type === 'possession')   return 'On Possession';
      return 'Monthly Installment';
    };

    // Build statement rows
    const finalPrice     = parseFloat(b.final_price);
    const openingBalance = Math.max(0, finalPrice - prePaid);
    let runBal           = openingBalance;
    const rows           = [];

    // ── Row 0: Balance Brought Forward (if pre-period payments exist) ──
    if (prePaid > 0) {
      rows.push({
        sr:             null,
        pay_head:       'Balance b/f',
        installment_no: null,
        due_date:       STMT_FROM,
        amount:         finalPrice,
        payment_date:   null,
        payment_mode:   null,
        receipt_no:     null,
        received_amount: prePaid,
        outstanding:    openingBalance,
        surcharge:      0,
        status:         'opening',
        payment_type:   'opening',
      });
    }

    // ── Row: Down Payment (if received on/after Jan 2024) ──
    const dpAmt      = parseFloat(b.down_payment_amount || 0);
    const dpReceived = dp ? parseFloat(dp.amount) : 0;
    if (dp) {
      runBal -= dpReceived;
      rows.push({
        sr:             rows.filter(r => r.sr !== null).length + 1,
        pay_head:       'Down Payment',
        installment_no: null,
        due_date:       b.booking_date,
        amount:         dpAmt,
        payment_date:   dp.payment_date,
        payment_mode:   dp.payment_method || null,
        receipt_no:     dp.reference_no   || null,
        received_amount: dpReceived,
        outstanding:    Math.max(0, runBal),
        surcharge:      0,
        status:         dpReceived >= dpAmt ? 'paid' : dpReceived > 0 ? 'partial' : 'pending',
        payment_type:   'down_payment',
      });
    }

    // ── Rows: All installments from Jan 2024 (confirmation, monthly, balloon) ──
    instRes.rows.forEach((s) => {
      const ptype    = inferType(s.installment_no);
      const received = parseFloat(s.paid_amount || 0);
      runBal -= received;
      rows.push({
        sr:             rows.filter(r => r.sr !== null).length + 1,
        pay_head:       payHeadLabel(ptype),
        installment_no: s.installment_no,
        due_date:       s.due_date,
        amount:         parseFloat(s.amount),
        payment_date:   s.payment_date  || null,
        payment_mode:   s.payment_mode  || null,
        receipt_no:     s.receipt_no    || null,
        received_amount: received,
        outstanding:    Math.max(0, runBal),
        surcharge:      parseFloat(s.late_fee || 0),
        status:         s.status,
        payment_type:   ptype,
      });
    });

    const totalSurcharge = rows.filter(r => r.status !== 'opening').reduce((acc, r) => acc + r.surcharge, 0);

    res.json({
      booking: b,
      rows,
      summary: {
        total_receivable:        finalPrice,
        down_payment:            dpAmt,
        confirmation_amount:     parseFloat(b.confirmation_amount     || 0),
        balloon_payment_amount:  parseFloat(b.balloon_payment_amount  || 0),
        possession_amount:       parseFloat(b.possession_amount       || 0),
        monthly_installment:     parseFloat(b.monthly_installment     || 0),
        installment_months:      parseInt(b.installment_months        || 0),
        total_received:          totalReceivedAll,
        total_outstanding:       Math.max(0, finalPrice - totalReceivedAll),
        total_surcharge:         totalSurcharge,
        statement_from:          STMT_FROM,
      },
    });
  } catch (err) {
    logger.error('Statement data error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /bookings/:id/statement  — Account Statement PDF ──
router.get('/:id/statement', async (req, res) => {
  try {
    const bookingResult = await query(
      `SELECT b.*,
              c.name customer_name, c.phone customer_phone, c.cnic, c.address, c.email,
              u.unit_number, u.unit_type, u.size_sqft,
              t.name tower_name, f.floor_no,
              pp.name plan_name, pp.installment_months,
              a.name agent_name
       FROM bookings b
       JOIN customers c    ON c.id = b.customer_id
       JOIN units u        ON u.id = b.unit_id
       LEFT JOIN towers t  ON t.id = u.tower_id
       LEFT JOIN floors f  ON f.id = u.floor_id
       LEFT JOIN payment_plans pp ON pp.id = b.payment_plan_id
       LEFT JOIN users a   ON a.id = b.agent_id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!bookingResult.rows[0]) return res.status(404).json({ error: 'Booking not found' });
    const b = bookingResult.rows[0];

    // Burooj Heights launched 01 Jan 2024 — statement always opens from this date
    const STMT_FROM = '2024-01-01';

    // Payments received BEFORE the statement period
    const preRes = await query(
      `SELECT COALESCE(SUM(amount), 0) AS pre_paid
       FROM payments WHERE booking_id = $1 AND payment_date < $2`,
      [req.params.id, STMT_FROM]
    );
    const prePaid = parseFloat(preRes.rows[0].pre_paid || 0);

    // Full total received (all time) — for the summary banner
    const allPaidRes = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE booking_id = $1`,
      [req.params.id]
    );
    const totalReceivedAll = parseFloat(allPaidRes.rows[0].total || 0);

    // Installment schedule from 01 Jan 2024 onwards
    const instRes = await query(
      `SELECT
         s.installment_no, s.due_date, s.amount, s.paid_amount, s.status, s.late_fee,
         (SELECT p.payment_date  FROM payments p WHERE p.installment_id = s.id ORDER BY p.created_at DESC LIMIT 1) AS payment_date,
         (SELECT p.payment_method FROM payments p WHERE p.installment_id = s.id ORDER BY p.created_at DESC LIMIT 1) AS payment_mode,
         (SELECT p.reference_no  FROM payments p WHERE p.installment_id = s.id ORDER BY p.created_at DESC LIMIT 1) AS receipt_no
       FROM installment_schedules s
       WHERE s.booking_id = $1 AND s.due_date >= $2
       ORDER BY s.installment_no`,
      [req.params.id, STMT_FROM]
    );

    // Down payment — show if received on/after Jan 2024
    const dpRes = await query(
      `SELECT * FROM payments WHERE booking_id = $1 AND installment_id IS NULL
       AND payment_date >= $2 ORDER BY payment_date LIMIT 1`,
      [req.params.id, STMT_FROM]
    );
    const dp = dpRes.rows[0];

    // Infer payment type from installment_no
    const instMonthsPDF = parseInt(b.installment_months || 18);
    const inferTypePDF  = (no) => {
      if (no === 0)                  return 'confirmation';
      if (no > instMonthsPDF + 1)    return 'possession';
      if (no > instMonthsPDF)        return 'balloon';
      return 'monthly';
    };
    const payHeadPDF = (type) => {
      if (type === 'confirmation') return 'Confirmation Payment';
      if (type === 'balloon')      return 'Balloon Payment';
      if (type === 'possession')   return 'On Possession';
      return 'Monthly Installment';
    };

    // Build rows
    const finalPrice     = parseFloat(b.final_price);
    const openingBalance = Math.max(0, finalPrice - prePaid);
    let runBal           = openingBalance;
    const rows           = [];

    // ── Opening balance row ──
    if (prePaid > 0) {
      rows.push({
        sr: null, pay_head: 'Balance b/f', installment_no: null,
        due_date: STMT_FROM, amount: finalPrice,
        payment_date: null, payment_mode: null, receipt_no: null,
        received_amount: prePaid, outstanding: openingBalance,
        surcharge: 0, status: 'opening', payment_type: 'opening',
      });
    }

    // ── Down payment (if on/after Jan 2024) ──
    const dpAmt      = parseFloat(b.down_payment_amount || 0);
    const dpReceived = dp ? parseFloat(dp.amount) : 0;
    if (dp) {
      runBal -= dpReceived;
      rows.push({
        sr: rows.filter(r => r.sr !== null).length + 1,
        pay_head: 'Down Payment', installment_no: null,
        due_date: b.booking_date, amount: dpAmt,
        payment_date: dp.payment_date, payment_mode: dp.payment_method || null,
        receipt_no: dp.reference_no || null,
        received_amount: dpReceived, outstanding: Math.max(0, runBal),
        surcharge: 0,
        status: dpReceived >= dpAmt ? 'paid' : dpReceived > 0 ? 'partial' : 'pending',
        payment_type: 'down_payment',
      });
    }

    // ── All installments from Jan 2024 (confirmation, monthly, balloon) ──
    instRes.rows.forEach((s) => {
      const ptype    = inferTypePDF(s.installment_no);
      const received = parseFloat(s.paid_amount || 0);
      runBal -= received;
      rows.push({
        sr: rows.filter(r => r.sr !== null).length + 1,
        pay_head: payHeadPDF(ptype), installment_no: s.installment_no,
        due_date: s.due_date, amount: parseFloat(s.amount),
        payment_date: s.payment_date || null, payment_mode: s.payment_mode || null,
        receipt_no: s.receipt_no || null,
        received_amount: received, outstanding: Math.max(0, runBal),
        surcharge: parseFloat(s.late_fee || 0), status: s.status,
        payment_type: ptype,
      });
    });

    const totalAmt       = rows.filter(r => r.status !== 'opening').reduce((acc, r) => acc + r.amount, 0);
    const totalSurcharge = rows.filter(r => r.status !== 'opening').reduce((acc, r) => acc + r.surcharge, 0);
    const outstanding    = Math.max(0, finalPrice - totalReceivedAll);

    // ── Helpers ──
    const fmt      = (n) => parseFloat(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
    const fmtD     = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; } };
    const trunc    = (str, len) => str && str.length > len ? str.slice(0, len - 2) + '…' : (str || '—');
    const fmtFloor = (n) => { const fn = parseInt(n); return fn === -1 ? 'Lower Ground' : fn === 0 ? 'Ground Floor' : `Floor ${fn}`; };
    const unitLabel = (t) => (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // ── PDF Document ──
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Statement-${b.booking_no || b.id}.pdf"`);
    doc.pipe(res);

    const W  = LP_W;           // 595
    const H  = LP_H;           // 842
    const M  = CONTENT.left;   // 28
    const R  = CONTENT.right;  // 562
    const CW = R - M;          // 534
    const CT = CONTENT.top;    // 112
    const CB = CONTENT.bottom; // 690

    // ═══════════════════════════════════════════════
    //  HELPER: draw one page of the letterpad
    // ═══════════════════════════════════════════════
    const initPage = () => drawLetterpad(doc, { date: fmtD(new Date()), ref: b.booking_no });

    initPage();

    // ═══════════════════════════════════════════════
    //  TITLE  — clean text on white, no teal bar
    // ═══════════════════════════════════════════════
    let Y = CT;

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b')
       .text('STATEMENT OF ACCOUNT', M, Y, { width: CW, align: 'center', lineBreak: false });
    Y += 17;
    doc.fontSize(7).font('Helvetica').fillColor('#64748b')
       .text(
         `Statement Period:  ${fmtD(new Date(STMT_FROM))}  –  ${fmtD(new Date())}     |     Ref: ${b.booking_no || '—'}`,
         M, Y, { width: CW, align: 'center', lineBreak: false }
       );
    Y += 10;
    // double rule
    doc.rect(M, Y,     CW, 1.5).fill('#1e293b');
    doc.rect(M, Y + 3, CW, 0.5).fill('#1e293b');
    Y += 10;

    // ═══════════════════════════════════════════════
    //  INFO BOXES  — white bg, thin border, navy accent
    // ═══════════════════════════════════════════════
    const BOX_H = 66;
    const halfW = (CW - 6) / 2;

    const drawInfoBox = (bx, by, bw, title, lines) => {
      doc.rect(bx, by, bw, BOX_H).fillAndStroke('#ffffff', '#cbd5e1');
      doc.rect(bx, by, bw, 2).fill('#1e293b');                        // navy top accent
      doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b')
         .text(title, bx + 6, by + 7, { lineBreak: false });
      doc.moveTo(bx, by + 16).lineTo(bx + bw, by + 16)
         .lineWidth(0.4).strokeColor('#e2e8f0').stroke();
      lines.forEach(([label, val], idx) => {
        const ly = by + 19 + idx * 10;
        doc.fontSize(6.5).font('Helvetica').fillColor('#6b7280')
           .text(label, bx + 6, ly, { lineBreak: false });
        doc.font('Helvetica-Bold').fillColor('#1e293b')
           .text(val,   bx + 68, ly, { width: bw - 74, lineBreak: false });
      });
    };

    drawInfoBox(M, Y, halfW, 'CLIENT INFORMATION', [
      ['Customer',  trunc(b.customer_name   || '—', 28)],
      ['CNIC',      b.cnic                  || '—'],
      ['Phone',     b.customer_phone        || '—'],
      ['Address',   trunc(b.address || '—', 30)],
    ]);

    drawInfoBox(M + halfW + 6, Y, halfW, 'PROPERTY & BOOKING DETAILS', [
      ['Project',       `${b.tower_name || 'Burooj Heights'}  —  Unit ${b.unit_number || '—'}`],
      ['Floor / Type',  `${fmtFloor(b.floor_no)}  |  ${unitLabel(b.unit_type)}  |  ${b.size_sqft || '—'} sqft`],
      ['Booking No',    b.booking_no   || '—'],
      ['Plan',          `${b.plan_name || '—'}  (${b.installment_months || 18} months)`],
    ]);
    Y += BOX_H + 8;

    // ═══════════════════════════════════════════════
    //  FINANCIAL SUMMARY  — white boxes, colored accents
    // ═══════════════════════════════════════════════
    const FS_H = 36;
    const q3   = CW / 3;
    const fsSummary = [
      { label: 'TOTAL SALE PRICE',    value: `PKR  ${fmt(b.final_price)}`,    accent: '#2563eb', textColor: '#1e3a5f' },
      { label: 'TOTAL RECEIVED',      value: `PKR  ${fmt(totalReceivedAll)}`,  accent: '#16a34a', textColor: '#14532d' },
      { label: 'OUTSTANDING BALANCE', value: `PKR  ${fmt(outstanding)}`,       accent: outstanding > 0 ? '#dc2626' : '#16a34a', textColor: outstanding > 0 ? '#7f1d1d' : '#14532d' },
    ];
    fsSummary.forEach(({ label, value, accent, textColor }, i) => {
      const bx = M + i * q3;
      doc.rect(bx, Y, q3, FS_H).fillAndStroke('#ffffff', '#e2e8f0');
      doc.rect(bx, Y, q3, 3).fill(accent);                            // colored top strip
      doc.fontSize(6).font('Helvetica').fillColor('#6b7280')
         .text(label, bx + 4, Y + 9, { width: q3 - 8, align: 'center', lineBreak: false });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(textColor)
         .text(value, bx + 4, Y + 20, { width: q3 - 8, align: 'center', lineBreak: false });
    });
    Y += FS_H + 4;

    // ── Payment Breakdown mini-row ────────────────────────────────────────────
    // Shows DP / Confirmation / Monthly × n / Balloon in one compact line
    const confirmationAmtPDF = parseFloat(b.confirmation_amount    || 0);
    const balloonAmtPDF      = parseFloat(b.balloon_payment_amount || 0);
    const possessionAmtPDF   = parseFloat(b.possession_amount      || 0);
    const dpAmtPDF           = parseFloat(b.down_payment_amount    || 0);
    const monthlyAmtPDF      = parseFloat(b.monthly_installment    || 0);
    const instMonths         = parseInt(b.installment_months       || 0);

    const breakdownItems = [
      { label: 'Down Payment',          value: `PKR ${fmt(dpAmtPDF)}`,           color: '#16a34a' },
      ...(confirmationAmtPDF > 0 ? [{ label: 'Confirmation',   value: `PKR ${fmt(confirmationAmtPDF)}`, color: '#7c3aed' }] : []),
      { label: `Monthly × ${instMonths}`, value: `PKR ${fmt(monthlyAmtPDF)} /mo`, color: '#2563eb' },
      ...(balloonAmtPDF   > 0 ? [{ label: 'Balloon Payment',   value: `PKR ${fmt(balloonAmtPDF)}`,      color: '#d97706' }] : []),
      ...(possessionAmtPDF > 0 ? [{ label: 'On Possession',    value: `PKR ${fmt(possessionAmtPDF)}`,   color: '#dc2626' }] : []),
    ];
    const bkW = CW / breakdownItems.length;
    breakdownItems.forEach(({ label, value, color }, i) => {
      const bx = M + i * bkW;
      doc.rect(bx, Y, bkW, 22).fillAndStroke('#fafafa', '#e2e8f0');
      doc.rect(bx, Y, bkW, 2).fill(color);
      doc.fontSize(5.5).font('Helvetica').fillColor('#6b7280')
         .text(label, bx + 3, Y + 6, { width: bkW - 6, align: 'center', lineBreak: false });
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(color)
         .text(value, bx + 3, Y + 13, { width: bkW - 6, align: 'center', lineBreak: false });
    });
    Y += 22 + 8;

    // ═══════════════════════════════════════════════
    //  PAYMENT SCHEDULE TABLE
    //  10 cols, total width = 534pt, ROW_H = 15
    // ═══════════════════════════════════════════════
    // #(18) PayHead(92) DueDate(54) Amount(60) PayDate(54) Mode(44) Receipt(54) Received(62) Outstanding(62) Surcharge(34)
    const cols = [
      { label: '#',               w: 18, align: 'center' },
      { label: 'Payment Head',    w: 92, align: 'left'   },
      { label: 'Due Date',        w: 54, align: 'left'   },
      { label: 'Amount (PKR)',    w: 60, align: 'right'  },
      { label: 'Pay Date',        w: 54, align: 'left'   },
      { label: 'Mode',            w: 44, align: 'left'   },
      { label: 'Receipt #',       w: 54, align: 'left'   },
      { label: 'Received (PKR)',  w: 62, align: 'right'  },
      { label: 'Outstanding',     w: 62, align: 'right'  },
      { label: 'Surcharge',       w: 34, align: 'right'  },
    ]; // 18+92+54+60+54+44+54+62+62+34 = 534

    const colX = [];
    let cx2 = M;
    cols.forEach(c => { colX.push(cx2); cx2 += c.w; });

    const HDR_H  = 12;
    const ROW_H  = 12;
    const SIGN_H = 55;

    // Section heading — plain text + rule (no teal bar)
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b')
       .text(`PAYMENT SCHEDULE  —  Period: ${fmtD(new Date(STMT_FROM))} onwards`, M, Y, { lineBreak: false });
    Y += 12;
    doc.rect(M, Y, CW, 1).fill('#1e293b');
    Y += 3;

    const drawTableHdr = (sy) => {
      doc.rect(M, sy, CW, HDR_H).fill('#1e293b');
      cols.forEach((c, i) => {
        doc.fontSize(6).font('Helvetica-Bold').fillColor('#ffffff')
           .text(c.label, colX[i] + 2, sy + 3, { width: c.w - 4, align: c.align, lineBreak: false });
      });
      return sy + HDR_H;
    };

    Y = drawTableHdr(Y);

    // Row background by payment type / status
    const rowBgColor = (row, idx) => {
      if (row.status === 'opening')        return '#f0f7ff';  // blue tint  — balance b/f
      if (row.payment_type === 'confirmation') return '#f5f3ff';  // violet tint — confirmation
      if (row.payment_type === 'balloon')      return '#fffbeb';  // amber tint  — balloon
      if (row.payment_type === 'down_payment') return '#f0fdf4';  // green tint  — down payment
      return idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    };

    // Left-edge strip color by status
    const stripColor = (status) => {
      if (status === 'opening') return '#2563eb';
      if (status === 'paid')    return '#16a34a';
      if (status === 'overdue') return '#dc2626';
      if (status === 'partial') return '#d97706';
      return '#9ca3af';
    };
    const textColor = (status) => {
      if (status === 'opening') return '#1d4ed8';
      if (status === 'paid')    return '#15803d';
      if (status === 'overdue') return '#be123c';
      if (status === 'partial') return '#92400e';
      return '#374151';
    };

    let rowIdx  = 0;
    let pageNum = 1;

    for (const row of rows) {
      if (Y + ROW_H > CB - SIGN_H) {
        doc.addPage();
        pageNum++;
        initPage();
        Y = CT;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b')
           .text(`PAYMENT SCHEDULE  (continued — page ${pageNum})`, M, Y, { lineBreak: false });
        Y += 12;
        doc.rect(M, Y, CW, 1).fill('#1e293b');
        Y += 3;
        Y = drawTableHdr(Y);
      }

      const isOpening = row.status === 'opening';
      const rowBg     = rowBgColor(row, rowIdx);

      doc.rect(M, Y, CW, ROW_H).fill(rowBg);
      doc.rect(M, Y, CW, ROW_H).lineWidth(0.3).strokeColor('#e2e8f0').stroke();
      doc.rect(M, Y, 3, ROW_H).fill(stripColor(row.status));  // status strip, left edge

      if (isOpening) {
        // Opening balance row — special rendering
        const oc = '#1d4ed8';
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor(oc)
           .text('—',                          colX[0] + 2, Y + 3, { width: cols[0].w - 4, align: 'center', lineBreak: false })
           .text('Balance b/f  (01 Jan 2024)', colX[1] + 2, Y + 3, { width: cols[1].w - 4, lineBreak: false })
           .text('01 Jan 2024',                colX[2] + 2, Y + 3, { width: cols[2].w - 4, lineBreak: false })
           .text(fmt(row.amount),              colX[3] + 2, Y + 3, { width: cols[3].w - 4, align: 'right', lineBreak: false });
        doc.fillColor('#9ca3af')
           .text('—', colX[4] + 2, Y + 3, { width: cols[4].w - 4, lineBreak: false })
           .text('—', colX[5] + 2, Y + 3, { width: cols[5].w - 4, lineBreak: false })
           .text('—', colX[6] + 2, Y + 3, { width: cols[6].w - 4, lineBreak: false });
        doc.fillColor('#15803d').font('Helvetica-Bold')
           .text(fmt(row.received_amount), colX[7] + 2, Y + 3, { width: cols[7].w - 4, align: 'right', lineBreak: false });
        doc.fillColor('#dc2626')
           .text(fmt(row.outstanding),     colX[8] + 2, Y + 3, { width: cols[8].w - 4, align: 'right', lineBreak: false });
        doc.fillColor('#9ca3af')
           .text('—', colX[9] + 2, Y + 3, { width: cols[9].w - 4, align: 'right', lineBreak: false });
      } else {
        const tc = textColor(row.status);
        const dataVals = [
          String(row.sr || ''),
          row.pay_head,
          fmtD(row.due_date),
          fmt(row.amount),
          fmtD(row.payment_date),
          trunc(row.payment_mode || '—', 10),
          trunc(row.receipt_no   || '—', 14),
          fmt(row.received_amount),
          fmt(row.outstanding),
          row.surcharge > 0 ? fmt(row.surcharge) : '—',
        ];
        dataVals.forEach((v, i) => {
          const c = i === 7 && row.received_amount > 0 ? '#15803d'
                  : i === 8 && row.outstanding > 0     ? '#dc2626'
                  : i === 9 && row.surcharge > 0       ? '#d97706'
                  : tc;
          doc.fontSize(6.5)
             .font(i === 0 || i === 3 || i === 7 || i === 8 ? 'Helvetica-Bold' : 'Helvetica')
             .fillColor(c)
             .text(v, colX[i] + (i === 0 ? 8 : 2), Y + 3,
                   { width: cols[i].w - (i === 0 ? 10 : 4), align: cols[i].align, lineBreak: false });
        });
      }

      Y += ROW_H;
      rowIdx++;
    }

    // ── TOTALS ROW ──
    if (Y + 16 > CB - SIGN_H) {
      doc.addPage(); pageNum++;
      initPage();
      Y = CT;
    }
    doc.rect(M, Y, CW, 12).fill('#1e293b');
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#ffffff')
       .text('TOTALS', colX[0] + 2, Y + 3, { width: cols[0].w + cols[1].w + cols[2].w - 4, lineBreak: false })
       .text(fmt(totalAmt),         colX[3] + 2, Y + 3, { width: cols[3].w - 4, align: 'right', lineBreak: false })
       .text(fmt(totalReceivedAll), colX[7] + 2, Y + 3, { width: cols[7].w - 4, align: 'right', lineBreak: false });
    doc.fillColor(outstanding > 0 ? '#fbbf24' : '#4ade80')
       .text(fmt(outstanding), colX[8] + 2, Y + 3, { width: cols[8].w - 4, align: 'right', lineBreak: false });
    if (totalSurcharge > 0) {
      doc.fillColor('#fbbf24')
         .text(fmt(totalSurcharge), colX[9] + 2, Y + 3, { width: cols[9].w - 4, align: 'right', lineBreak: false });
    }
    Y += 12 + 8;

    // ── LEGEND ──
    const legendItems = [
      { color: '#2563eb', label: 'Balance b/f'  },
      { color: '#16a34a', label: 'Paid'          },
      { color: '#dc2626', label: 'Overdue'       },
      { color: '#d97706', label: 'Partial'       },
      { color: '#9ca3af', label: 'Pending'       },
      { color: '#7c3aed', label: 'Confirmation'  },
      { color: '#f59e0b', label: 'Balloon / Possession' },
    ];
    doc.fontSize(6.5).font('Helvetica').fillColor('#6b7280')
       .text('Legend:', M, Y + 2, { lineBreak: false });
    let lx = M + 38;
    legendItems.forEach(({ color, label }) => {
      doc.circle(lx + 4, Y + 5, 3.5).fill(color);
      doc.fontSize(6.5).font('Helvetica').fillColor('#374151')
         .text(label, lx + 11, Y + 2, { lineBreak: false });
      lx += label.length > 10 ? 70 : 46;
    });
    Y += 18;

    // ── SIGNATURES ──
    if (Y + SIGN_H > CB) {
      doc.addPage(); pageNum++;
      initPage();
      Y = CT;
    }
    Y += 8;
    doc.rect(M, Y, CW, 0.6).fill('#cbd5e1');
    Y += 14;
    const sigW = CW / 2;
    const lineW = 110;
    ['Accounts Officer', 'Authorized Signatory\nBurooj Heights'].forEach((label, i) => {
      const sx = M + i * sigW;
      const centerX = sx + sigW / 2;
      doc.rect(centerX - lineW / 2, Y + 20, lineW, 0.8).fill('#374151');
      doc.fontSize(7).font('Helvetica').fillColor('#64748b')
         .text(label, sx, Y + 25, { width: sigW, align: 'center' });
    });
    Y += 42;

    // ── DISCLAIMER ──
    doc.fontSize(6).font('Helvetica').fillColor('#9ca3af')
       .text(
         'This is a system-generated statement and does not require a physical signature. For queries, contact Burooj Heights Accounts Department.',
         M, Y, { width: CW, align: 'center', lineBreak: false }
       );

    // ── WATERMARK — faint diagonal text, clean on white paper ──
    const sX = W / 2, sY = H / 2 + 20;
    doc.save();
    doc.opacity(0.04);
    doc.rotate(-40, { origin: [sX, sY] });
    doc.fontSize(80).font('Helvetica-Bold').fillColor(TEAL)
       .text('BUROOJ', sX - 200, sY - 50, { width: 400, align: 'center', lineBreak: false });
    doc.fontSize(42).fillColor(TEAL)
       .text('HEIGHTS', sX - 200, sY + 40, { width: 400, align: 'center', lineBreak: false });
    doc.restore();

    doc.end();

  } catch (err) {
    logger.error('Statement PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate statement PDF' });
  }
});

// ── POST /bookings/fix-schedule-dates ─────────────────────────────────────────
// One-time admin fix: corrects all 18-month plan installment due_dates to start
// from 2024-01-01 (Burooj Heights launch date). Confirmation also set to 2024-01-01.
// Safe to run multiple times (idempotent).
router.post('/fix-schedule-dates', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Monthly installments: installment_no 1→Jan 2024, 2→Feb 2024 … 18→Jun 2025
    const r1 = await query(`
      UPDATE installment_schedules s
         SET due_date = (DATE '2024-01-01' + ((s.installment_no - 1) * INTERVAL '1 month'))::date
        FROM bookings b
        JOIN payment_plans pp ON pp.id = b.payment_plan_id
       WHERE s.booking_id = b.id
         AND pp.installment_months = 18
         AND s.payment_type = 'monthly'
         AND s.installment_no >= 1
    `);
    // Confirmation: set to 2024-01-01
    const r2 = await query(`
      UPDATE installment_schedules s
         SET due_date = DATE '2024-01-01'
        FROM bookings b
        JOIN payment_plans pp ON pp.id = b.payment_plan_id
       WHERE s.booking_id = b.id
         AND pp.installment_months = 18
         AND s.payment_type = 'confirmation'
    `);
    // Balloon: 2024-01-01 + 18 months = 2025-07-01
    const r3 = await query(`
      UPDATE installment_schedules s
         SET due_date = DATE '2025-07-01'
        FROM bookings b
        JOIN payment_plans pp ON pp.id = b.payment_plan_id
       WHERE s.booking_id = b.id
         AND pp.installment_months = 18
         AND s.payment_type = 'balloon'
    `);
    res.json({
      success:      true,
      monthly_fixed: r1.rowCount,
      confirm_fixed: r2.rowCount,
      balloon_fixed: r3.rowCount,
    });
  } catch (err) {
    logger.error('fix-schedule-dates error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

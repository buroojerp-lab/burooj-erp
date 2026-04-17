// routes/paymentRoutes.js
const express      = require('express');
const PDFDocument  = require('pdfkit');
const router       = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
const { drawLetterpad, CONTENT, W: LP_W, H: LP_H, TEAL } = require('../utils/letterpad');

router.use(authenticate);

// GET /payments
router.get('/', async (req, res) => {
  const { booking_id, customer_id, payment_method, tower_id, page = 1, limit = 25 } = req.query;
  const offset = (page - 1) * limit;
  const conds = ['1=1']; const params = [];

  if (booking_id)     { conds.push(`p.booking_id = $${params.length+1}`);        params.push(booking_id); }
  if (customer_id)    { conds.push(`c.id = $${params.length+1}`);                params.push(customer_id); }
  if (payment_method) { conds.push(`p.payment_method = $${params.length+1}`);    params.push(payment_method); }
  if (tower_id)       { conds.push(`u.tower_id = $${params.length+1}`);          params.push(tower_id); }

  const where = conds.join(' AND ');
  const [rows, total] = await Promise.all([
    query(
      `SELECT p.*, b.booking_no, c.name customer_name, u.unit_number,
              ub.name recorded_by
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN customers c ON c.id = b.customer_id
       JOIN units u ON u.id = b.unit_id
       LEFT JOIN users ub ON ub.id = p.created_by
       WHERE ${where}
       ORDER BY p.payment_date DESC, p.created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN customers c ON c.id = b.customer_id
       JOIN units u ON u.id = b.unit_id
       WHERE ${where}`, params
    ),
  ]);

  res.json({
    data: rows.rows,
    pagination: {
      page: parseInt(page), limit: parseInt(limit),
      total: parseInt(total.rows[0].count),
      pages: Math.ceil(total.rows[0].count / limit),
    },
  });
});

// GET /payments/summary
router.get('/summary', async (req, res) => {
  const result = await query(`
    SELECT
      COALESCE(SUM(amount), 0) total_collected,
      COUNT(*) total_payments,
      COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', NOW())), 0) this_month,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'bank'), 0) via_bank,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'), 0) via_cash,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'online'), 0) via_online
    FROM payments`
  );
  res.json({ summary: result.rows[0] });
});

// GET /payments/:id
router.get('/:id', async (req, res) => {
  const result = await query(
    `SELECT p.*, b.booking_no, c.name customer_name, c.phone customer_phone,
            u.unit_number, ub.name recorded_by
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN customers c ON c.id = b.customer_id
     JOIN units u ON u.id = b.unit_id
     LEFT JOIN users ub ON ub.id = p.created_by
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Payment not found' });
  res.json({ payment: result.rows[0] });
});

// GET /payments/:id/receipt  ── Professional PDF Receipt
router.get('/:id/receipt', async (req, res) => {
  const result = await query(
    `SELECT p.*, b.booking_no, b.final_price booking_total,
            c.name customer_name, c.phone customer_phone, c.cnic, c.address,
            u.unit_number, u.unit_type, u.size_sqft,
            t.name tower_name, f.floor_no,
            ub.name recorded_by_name,
            s.installment_no,
            (SELECT COALESCE(SUM(amount),0) FROM payments WHERE booking_id = b.id) total_paid
     FROM payments p
     JOIN bookings b     ON b.id = p.booking_id
     JOIN customers c    ON c.id = b.customer_id
     JOIN units u        ON u.id = b.unit_id
     LEFT JOIN towers t  ON t.id = u.tower_id
     LEFT JOIN floors f  ON f.id = u.floor_id
     LEFT JOIN users ub  ON ub.id = p.created_by
     LEFT JOIN installment_schedules s ON s.id = p.installment_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Payment not found' });
  const p = result.rows[0];

  const receiptNo  = `RCT-${p.id.slice(0, 8).toUpperCase()}`;
  const fmt        = (n) => parseFloat(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtDate    = (d) => new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });

  const outstanding = Math.max(0, parseFloat(p.booking_total) - parseFloat(p.total_paid));

  const doc = new PDFDocument({ margin: 0, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=receipt-${receiptNo}.pdf`);
  doc.pipe(res);

  const W   = LP_W;
  const H   = LP_H;
  const M   = CONTENT.left;           // 28
  const CW  = CONTENT.right - M;      // 534

  // ── Official Burooj Letterpad ──
  drawLetterpad(doc, { date: fmtDate(p.payment_date), ref: receiptNo });

  // ── Receipt Title ──
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b')
     .text('PAYMENT RECEIPT', M, CONTENT.top + 2);

  // ── Receipt info box (top-right, clear of letterpad Date/Ref) ──
  const rboxX = M + 290, rboxY = CONTENT.top, rboxW = CW - 292, rboxH = 52;
  doc.rect(rboxX, rboxY, rboxW, rboxH).fill('#f8fafc');
  doc.rect(rboxX, rboxY, rboxW, rboxH).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
  doc.rect(rboxX, rboxY, rboxW, 14).fill(TEAL);
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
     .text('RECEIPT DETAILS', rboxX + 8, rboxY + 4, { lineBreak: false });
  doc.fontSize(6.5).font('Helvetica').fillColor('#64748b')
     .text('RECEIPT NO.',  rboxX + 8, rboxY + 18)
     .text('BOOKING NO.',  rboxX + 8, rboxY + 30)
     .text('INSTALLMENT',  rboxX + 8, rboxY + 42);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b')
     .text(receiptNo,      rboxX + 78, rboxY + 18, { width: rboxW - 86 })
     .text(p.booking_no,   rboxX + 78, rboxY + 30, { width: rboxW - 86 })
     .text(p.installment_no ? `#${p.installment_no}` : '—', rboxX + 78, rboxY + 42, { width: rboxW - 86 });

  // ── Teal rule ──
  const ruleY = CONTENT.top + 56;
  doc.rect(M, ruleY, CW, 2).fill(TEAL);

  // ── 3-column info boxes ──
  const infoY  = ruleY + 8;
  const infoH  = 82;
  const colW3  = (CW - 16) / 3;

  const drawInfoBox = (x, y, w, h, title, lines) => {
    doc.rect(x, y, w, h).fill('#f8fafc');
    doc.rect(x, y, w, h).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
    doc.rect(x, y, w, 14).fill(TEAL);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
       .text(title, x + 6, y + 4, { width: w - 12, lineBreak: false });
    let ly = y + 20;
    lines.forEach(([label, val]) => {
      if (!val) return;
      doc.fontSize(6.5).font('Helvetica').fillColor('#64748b')
         .text(label, x + 6, ly, { lineBreak: false });
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b')
         .text(String(val), x + 6, ly + 9, { width: w - 12, lineBreak: false });
      ly += 22;
    });
  };

  drawInfoBox(M,                   infoY, colW3, infoH, 'CLIENT INFORMATION', [
    ['Name',    p.customer_name],
    ['CNIC',    p.cnic],
    ['Phone',   p.customer_phone],
  ]);
  drawInfoBox(M + colW3 + 8,       infoY, colW3, infoH, 'PROPERTY DETAILS', [
    ['Project', p.tower_name || 'Burooj Heights'],
    ['Unit',    `Floor ${p.floor_no} – Unit ${p.unit_number}`],
    ['Type',    `${(p.unit_type || '').toUpperCase()}  |  ${p.size_sqft} sqft`],
  ]);
  drawInfoBox(M + (colW3 + 8) * 2, infoY, colW3, infoH, 'PAYMENT DETAILS', [
    ['Method',  (p.payment_method || '').toUpperCase()],
    ['Bank',    p.bank_name || null],
    ['Ref No.', p.reference_no || null],
  ]);

  // ── Amount Received ── big highlighted box
  const amtY = infoY + infoH + 12;
  doc.rect(M, amtY, CW, 54).fill('#fff7ed');
  doc.rect(M, amtY, CW, 54).lineWidth(1.5).strokeColor('#f97316').stroke();
  doc.rect(M, amtY, CW, 18).fill('#f97316');
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff')
     .text('AMOUNT RECEIVED', M + 16, amtY + 5, { width: CW - 32, align: 'center', lineBreak: false });
  doc.fontSize(24).font('Helvetica-Bold').fillColor('#1e293b')
     .text(`PKR  ${fmt(p.amount)}`, M + 16, amtY + 20, { width: CW - 32, align: 'center', lineBreak: false });

  // ── Payment summary strip ──
  const sumY = amtY + 66;
  doc.rect(M, sumY, CW, 26).fill('#1e293b');
  const q3 = CW / 3;
  [
    ['BOOKING TOTAL',  `PKR ${fmt(p.booking_total)}`],
    ['TOTAL RECEIVED', `PKR ${fmt(p.total_paid)}`],
    ['OUTSTANDING',    `PKR ${fmt(outstanding)}`],
  ].forEach(([label, val], i) => {
    const x = M + i * q3;
    doc.fontSize(6).font('Helvetica').fillColor('#94a3b8')
       .text(label, x + 4, sumY + 4, { width: q3 - 8, align: 'center', lineBreak: false });
    doc.fontSize(8.5).font('Helvetica-Bold')
       .fillColor(i === 2 && outstanding > 0 ? '#fbbf24' : '#ffffff')
       .text(val, x + 4, sumY + 14, { width: q3 - 8, align: 'center', lineBreak: false });
  });

  // ── Notes / Recorded By ──
  let notesY = sumY + 36;
  if (p.notes) {
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
       .text(`Notes: ${p.notes}`, M, notesY, { width: CW });
    notesY += 14;
  }
  if (p.recorded_by_name) {
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
       .text(`Recorded By: ${p.recorded_by_name}`, M, notesY);
    notesY += 14;
  }

  // ── Signature lines ──
  const sigY = Math.max(notesY + 30, sumY + 80);
  doc.moveTo(M, sigY).lineTo(CONTENT.right, sigY).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
  doc.moveTo(M,              sigY + 38).lineTo(M + 160,           sigY + 38).lineWidth(0.5).strokeColor('#94a3b8').stroke();
  doc.moveTo(CONTENT.right - 160, sigY + 38).lineTo(CONTENT.right, sigY + 38).lineWidth(0.5).strokeColor('#94a3b8').stroke();
  doc.fontSize(7.5).font('Helvetica').fillColor('#374151')
     .text("Client's Signature",  M,                  sigY + 42)
     .text("Authorized Signatory", CONTENT.right - 160, sigY + 42);

  // ── Gold Stamp Watermark ──
  const sX = W / 2, sY = H / 2 + 20;
  doc.save();
  doc.opacity(0.08);
  doc.rotate(-45, { origin: [sX, sY] });
  doc.circle(sX, sY, 86).lineWidth(5).strokeColor('#D4AF37').stroke();
  doc.circle(sX, sY, 75).lineWidth(1.5).strokeColor('#D4AF37').stroke();
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#D4AF37')
     .text('BUROOJ', sX - 86, sY - 22, { width: 172, align: 'center', lineBreak: false });
  doc.fontSize(10).fillColor('#D4AF37')
     .text('MARKETING', sX - 86, sY - 1, { width: 172, align: 'center', lineBreak: false });
  doc.fontSize(7.5).fillColor('#D4AF37')
     .text('VERIFIED', sX - 86, sY + 14, { width: 172, align: 'center', lineBreak: false });
  doc.restore();

  doc.end();
});

module.exports = router;

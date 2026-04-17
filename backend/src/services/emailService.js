// ============================================================
// BUROOJ HEIGHTS ERP — EMAIL AUTOMATION SERVICE
// Handles transactional & scheduled emails via SMTP
// ============================================================

const nodemailer = require('nodemailer');
const { query }  = require('../config/database');
const logger     = require('../config/logger');

// ── Transporter ──────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT   === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool:            true,
  maxConnections:  5,
  maxMessages:     100,
});

// ── Base HTML layout ─────────────────────────────────────────
const baseLayout = (content, title = 'Burooj Heights') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0098B4;padding:28px 36px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.8;">We Believe in Building Relations</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">BUROOJ HEIGHTS</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">Real Estate Development · Lahore, Pakistan</p>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:36px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#1e293b;padding:20px 36px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">
              Burooj Height, 5-6 Commercial, Main Boulevard Dream Housing, Raiwind Road, Lahore<br/>
              UAN: 0322-1786111 &nbsp;|&nbsp; www.buroojmarketing.com
            </p>
            <p style="margin:8px 0 0;color:#475569;font-size:10px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Email Templates ───────────────────────────────────────────
const templates = {

  booking_confirmed: (d) => baseLayout(`
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#16a34a;font-size:13px;font-weight:600;">✅ Booking Confirmed</p>
    </div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Dear ${d.customer_name},</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 24px;">
      Congratulations! Your booking at <strong>Burooj Heights</strong> has been confirmed. We are delighted to welcome you to our community.
    </p>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
      <tr style="background:#0098B4;"><td colspan="2" style="color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:6px 6px 0 0;">Booking Details</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;font-size:13px;width:40%;">Booking No</td><td style="color:#1e293b;font-weight:600;font-size:13px;">${d.booking_no}</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;background:#fff;"><td style="color:#64748b;font-size:13px;">Unit</td><td style="color:#1e293b;font-weight:600;font-size:13px;">${d.unit_number} — ${d.tower_name}, Floor ${d.floor_no}</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;font-size:13px;">Total Price</td><td style="color:#1e293b;font-weight:600;font-size:13px;">PKR ${d.final_price}</td></tr>
      <tr style="background:#fff;"><td style="color:#64748b;font-size:13px;">Payment Plan</td><td style="color:#1e293b;font-weight:600;font-size:13px;">${d.plan_name}</td></tr>
    </table>
    <p style="color:#475569;line-height:1.7;margin:0 0 8px;">For any queries please call <strong>UAN: 0322-1786111</strong> or visit our office.</p>
  `, 'Booking Confirmed — Burooj Heights'),

  payment_received: (d) => baseLayout(`
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#2563eb;font-size:13px;font-weight:600;">💳 Payment Received</p>
    </div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Dear ${d.customer_name},</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 24px;">
      We have successfully received your payment. Your receipt details are below.
    </p>
    <div style="background:#f97316;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Amount Received</p>
      <p style="margin:6px 0 0;color:#fff;font-size:32px;font-weight:700;">PKR ${d.amount}</p>
    </div>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
      <tr style="background:#0098B4;"><td colspan="2" style="color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:6px 6px 0 0;">Receipt Details</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;font-size:13px;width:40%;">Receipt No</td><td style="color:#1e293b;font-weight:600;font-size:13px;">${d.receipt_no}</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;background:#fff;"><td style="color:#64748b;font-size:13px;">Date</td><td style="color:#1e293b;font-weight:600;font-size:13px;">${d.payment_date}</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;font-size:13px;">Method</td><td style="color:#1e293b;font-weight:600;font-size:13px;">${d.payment_method}</td></tr>
      <tr style="background:#fff;"><td style="color:#64748b;font-size:13px;">Outstanding Balance</td><td style="color:#dc2626;font-weight:700;font-size:13px;">PKR ${d.outstanding}</td></tr>
    </table>
  `, 'Payment Received — Burooj Heights'),

  installment_reminder: (d) => baseLayout(`
    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#a16207;font-size:13px;font-weight:600;">⏰ Installment Reminder</p>
    </div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Dear ${d.customer_name},</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 24px;">
      This is a friendly reminder that your installment <strong>#${d.inst_no}</strong> is ${d.days_label}.
    </p>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
      <tr style="background:#eab308;"><td colspan="2" style="color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:6px 6px 0 0;">Installment Details</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;font-size:13px;width:40%;">Unit</td><td style="color:#1e293b;font-weight:600;font-size:13px;">${d.unit_number}</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;background:#fff;"><td style="color:#64748b;font-size:13px;">Due Date</td><td style="color:#1e293b;font-weight:600;font-size:13px;">${d.due_date}</td></tr>
      <tr><td style="color:#64748b;font-size:13px;">Amount Due</td><td style="color:#dc2626;font-weight:700;font-size:15px;">PKR ${d.amount}</td></tr>
    </table>
    <p style="color:#475569;line-height:1.7;">Please ensure timely payment to avoid late fees. Contact us at <strong>0322-1786111</strong>.</p>
  `, 'Installment Reminder — Burooj Heights'),

  monthly_statement: (d) => baseLayout(`
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Dear ${d.customer_name},</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 24px;">
      Please find your account statement for <strong>${d.month_year}</strong>.
    </p>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
      <tr style="background:#0098B4;"><td colspan="2" style="color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:6px 6px 0 0;">Account Summary — ${d.month_year}</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;"><td style="color:#64748b;font-size:13px;width:50%;">Total Sale Price</td><td style="color:#1e293b;font-weight:600;font-size:13px;">PKR ${d.total_price}</td></tr>
      <tr style="border-bottom:1px solid #e2e8f0;background:#fff;"><td style="color:#64748b;font-size:13px;">Total Received</td><td style="color:#16a34a;font-weight:700;font-size:13px;">PKR ${d.total_paid}</td></tr>
      <tr><td style="color:#64748b;font-size:13px;">Outstanding Balance</td><td style="color:#dc2626;font-weight:700;font-size:13px;">PKR ${d.outstanding}</td></tr>
    </table>
    <p style="color:#475569;font-size:13px;margin:0;">Your detailed statement PDF is attached. For queries, call <strong>0322-1786111</strong>.</p>
  `, 'Monthly Statement — Burooj Heights'),

  admin_monthly_report: (d) => baseLayout(`
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Monthly Business Report</h2>
    <p style="color:#475569;margin:0 0 24px;">Automated report for <strong>${d.month_year}</strong></p>
    <div style="display:grid;gap:12px;margin-bottom:24px;">
      ${[
        ['Total Bookings', d.total_bookings, '#22c55e'],
        ['Revenue Collected', 'PKR ' + d.revenue, '#3b82f6'],
        ['Outstanding', 'PKR ' + d.outstanding, '#f97316'],
        ['Active Customers', d.customers, '#8b5cf6'],
      ].map(([label, val, color]) => `
        <div style="background:#f8fafc;border-left:4px solid ${color};border-radius:6px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#64748b;font-size:13px;">${label}</span>
          <span style="color:#1e293b;font-weight:700;font-size:15px;">${val}</span>
        </div>`).join('')}
    </div>
    <p style="color:#475569;font-size:13px;">Full audit report PDF is attached.</p>
  `, 'Monthly Report — Burooj Heights'),
};

// ── Core send function ────────────────────────────────────────
const sendEmail = async ({ to, subject, templateName, data, html, attachments = [] }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('Email skipped: SMTP not configured');
    return { skipped: true };
  }

  const resolvedHtml = html || (templateName && templates[templateName]
    ? templates[templateName](data || {})
    : '<p>No content</p>');

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.COMPANY_NAME || 'Burooj Heights'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: resolvedHtml,
      attachments,
    });

    // Log to DB
    await query(
      `INSERT INTO email_logs (to_email, subject, template_name, status, message_id)
       VALUES ($1, $2, $3, 'sent', $4)
       ON CONFLICT DO NOTHING`,
      [to, subject, templateName || 'custom', info.messageId]
    ).catch(() => {}); // Don't fail if table doesn't exist yet

    logger.info(`Email sent → ${to} [${templateName || 'custom'}]`);
    return { success: true, messageId: info.messageId };

  } catch (err) {
    logger.error(`Email failed → ${to}: ${err.message}`);
    await query(
      `INSERT INTO email_logs (to_email, subject, template_name, status, error_message)
       VALUES ($1, $2, $3, 'failed', $4)
       ON CONFLICT DO NOTHING`,
      [to, subject, templateName || 'custom', err.message]
    ).catch(() => {});
    throw err;
  }
};

// ── Event Triggers ────────────────────────────────────────────
const onBookingConfirmed = async (booking) => {
  if (!booking.email) return;
  return sendEmail({
    to:           booking.email,
    subject:      `Booking Confirmed — ${booking.booking_no} | Burooj Heights`,
    templateName: 'booking_confirmed',
    data:         booking,
  });
};

const onPaymentReceived = async (payment) => {
  if (!payment.email) return;
  return sendEmail({
    to:           payment.email,
    subject:      `Payment Receipt — ${payment.receipt_no} | Burooj Heights`,
    templateName: 'payment_received',
    data:         payment,
  });
};

const onInstallmentReminder = async (installment, daysLabel) => {
  if (!installment.email) return;
  return sendEmail({
    to:           installment.email,
    subject:      `Installment Reminder — Due ${installment.due_date} | Burooj Heights`,
    templateName: 'installment_reminder',
    data:         { ...installment, days_label: daysLabel },
  });
};

// ── Bulk installment due-date reminder emails (called by cron) ──
const sendDueDateReminderEmails = async () => {
  const baseQuery = `
    SELECT s.id, s.installment_no, s.due_date, s.amount,
           c.name customer_name, c.email,
           u.unit_number
    FROM installment_schedules s
    JOIN bookings b ON b.id = s.booking_id
    JOIN customers c ON c.id = b.customer_id
    JOIN units u ON u.id = b.unit_id
    WHERE c.email IS NOT NULL AND c.email != ''
      AND s.status IN ('pending', 'partial')
  `;

  const fmt = (n) => parseFloat(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });

  const send = async (inst, daysLabel, flagCol) => {
    try {
      await onInstallmentReminder({
        ...inst,
        amount:   fmt(inst.amount),
        due_date: new Date(inst.due_date).toLocaleDateString('en-PK'),
      }, daysLabel);
      await query(`UPDATE installment_schedules SET ${flagCol} = TRUE WHERE id = $1`, [inst.id]);
    } catch (e) {
      logger.error(`Email reminder (${daysLabel}) failed for ${inst.id}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  };

  const [r5, r0, r3] = await Promise.all([
    query(baseQuery + `AND s.due_date = CURRENT_DATE + INTERVAL '5 days' AND s.email_reminder_sent_5d = FALSE`),
    query(baseQuery + `AND s.due_date = CURRENT_DATE                      AND s.email_reminder_sent_0d = FALSE`),
    query(baseQuery.replace("('pending', 'partial')", "('pending', 'partial', 'overdue')")
      + `AND s.due_date = CURRENT_DATE - INTERVAL '3 days'              AND s.email_reminder_sent_3d = FALSE`),
  ]);

  for (const inst of r5.rows) await send(inst, 'Due in 5 days',  'email_reminder_sent_5d');
  for (const inst of r0.rows) await send(inst, 'Due today',      'email_reminder_sent_0d');
  for (const inst of r3.rows) await send(inst, '3 days overdue', 'email_reminder_sent_3d');

  logger.info(`Email reminders: ${r5.rows.length} (5d) + ${r0.rows.length} (today) + ${r3.rows.length} (3d overdue)`);
};

// ── Bulk monthly statement emails ─────────────────────────────
const sendMonthlyStatements = async () => {
  const monthYear = new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
  const fmt = (n) => parseFloat(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });

  const bookings = await query(`
    SELECT b.id, b.booking_no, b.final_price,
           c.name customer_name, c.email,
           COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = b.id), 0) total_paid
    FROM bookings b
    JOIN customers c ON c.id = b.customer_id
    WHERE b.status NOT IN ('cancelled', 'refunded')
      AND c.email IS NOT NULL AND c.email != ''
  `);

  let sent = 0;
  for (const b of bookings.rows) {
    try {
      const outstanding = Math.max(0, parseFloat(b.final_price) - parseFloat(b.total_paid));
      await sendEmail({
        to:           b.email,
        subject:      `Account Statement — ${monthYear} | Burooj Heights`,
        templateName: 'monthly_statement',
        data: {
          customer_name: b.customer_name,
          month_year:    monthYear,
          total_price:   fmt(b.final_price),
          total_paid:    fmt(b.total_paid),
          outstanding:   fmt(outstanding),
        },
      });
      sent++;
      await new Promise(r => setTimeout(r, 500)); // rate limit
    } catch (e) {
      logger.error(`Monthly statement failed for ${b.email}: ${e.message}`);
    }
  }

  logger.info(`Monthly statements sent: ${sent}/${bookings.rows.length}`);
  return sent;
};

module.exports = {
  sendEmail,
  onBookingConfirmed,
  onPaymentReceived,
  onInstallmentReminder,
  sendDueDateReminderEmails,
  sendMonthlyStatements,
  templates,
};

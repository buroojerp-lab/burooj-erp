// ============================================================
// BUROOJ HEIGHTS ERP — SMS SERVICE (Telenor / Jazz Business API)
// Configure via env: SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID
// ============================================================

const axios  = require('axios');
const { query } = require('../config/database');
const logger    = require('../config/logger');

const isConfigured = () => !!process.env.SMS_API_URL && !!process.env.SMS_API_KEY;

// Format Pakistani number: 03XX... stays as-is, +923XX → 03XX
const formatPakistaniNumber = (phone) => {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('92') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.startsWith('0')  && digits.length === 11)  return digits;
  return digits;
};

// ── Core send function ────────────────────────────────────────
const sendSMS = async ({ phone, message, customerId = null }) => {
  const to = formatPakistaniNumber(phone);

  const logRes = await query(
    `INSERT INTO sms_logs (to_phone, customer_id, message, status)
     VALUES ($1, $2, $3, 'pending') RETURNING id`,
    [to, customerId, message]
  );
  const logId = logRes.rows[0].id;

  if (!isConfigured()) {
    await query(`UPDATE sms_logs SET status = 'skipped', error_message = 'SMS not configured' WHERE id = $1`, [logId]);
    logger.warn(`SMS skipped (not configured) to ${to}`);
    return { success: false, skipped: true };
  }

  try {
    await axios.post(
      process.env.SMS_API_URL,
      {
        api_key:   process.env.SMS_API_KEY,
        sender_id: process.env.SMS_SENDER_ID || 'BuroojERP',
        to,
        message,
      },
      { timeout: 10000 }
    );

    await query(
      `UPDATE sms_logs SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [logId]
    );
    logger.info(`SMS sent to ${to}`);
    return { success: true };

  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    await query(
      `UPDATE sms_logs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [errMsg, logId]
    );
    logger.error(`SMS failed to ${to}: ${errMsg}`);
    throw new Error(errMsg);
  }
};

// ── Bulk installment due-date SMS reminders (called by cron) ──
const sendDueDateReminderSMS = async () => {
  if (!isConfigured()) {
    logger.warn('CRON: SMS reminders skipped — SMS_API_URL / SMS_API_KEY not configured');
    return;
  }

  const baseQuery = `
    SELECT s.id, s.installment_no, s.due_date, s.amount,
           c.name customer_name, c.phone customer_phone, c.id customer_id,
           u.unit_number
    FROM installment_schedules s
    JOIN bookings b ON b.id = s.booking_id
    JOIN customers c ON c.id = b.customer_id
    JOIN units u ON u.id = b.unit_id
    WHERE c.phone IS NOT NULL AND c.phone != ''
      AND s.status IN ('pending', 'partial')
  `;

  const fmt      = (n)   => parseFloat(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  const fmtDate  = (d)   => new Date(d).toLocaleDateString('en-PK');

  const buildMsg = (inst, label) =>
    `Dear ${inst.customer_name}, your installment #${inst.installment_no} of PKR ${fmt(inst.amount)} for Unit ${inst.unit_number} is ${label} (${fmtDate(inst.due_date)}). Please pay on time. Burooj Marketing.`;

  const send = async (inst, label, flagCol) => {
    try {
      await sendSMS({ phone: inst.customer_phone, message: buildMsg(inst, label), customerId: inst.customer_id });
      await query(`UPDATE installment_schedules SET ${flagCol} = TRUE WHERE id = $1`, [inst.id]);
    } catch (e) {
      logger.error(`SMS reminder (${label}) failed for ${inst.id}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  };

  const [r5, r0, r3] = await Promise.all([
    query(baseQuery + `AND s.due_date = CURRENT_DATE + INTERVAL '5 days' AND s.sms_reminder_sent_5d = FALSE`),
    query(baseQuery + `AND s.due_date = CURRENT_DATE                      AND s.sms_reminder_sent_0d = FALSE`),
    query(baseQuery.replace("('pending', 'partial')", "('pending', 'partial', 'overdue')")
      + `AND s.due_date = CURRENT_DATE - INTERVAL '3 days'              AND s.sms_reminder_sent_3d = FALSE`),
  ]);

  for (const inst of r5.rows) await send(inst, 'due in 5 days',  'sms_reminder_sent_5d');
  for (const inst of r0.rows) await send(inst, 'due today',      'sms_reminder_sent_0d');
  for (const inst of r3.rows) await send(inst, '3 days overdue', 'sms_reminder_sent_3d');

  logger.info(`SMS reminders: ${r5.rows.length} (5d) + ${r0.rows.length} (today) + ${r3.rows.length} (3d overdue)`);
};

module.exports = { sendSMS, sendDueDateReminderSMS };

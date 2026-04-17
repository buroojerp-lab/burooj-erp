// services/whatsappService.js
const axios = require('axios');
const { query } = require('../config/database');
const logger = require('../config/logger');

const WA_BASE = `https://graph.facebook.com/${process.env.WA_API_VERSION}`;

// Fetch templates from DB
const getTemplate = async (type) => {
  const res = await query(
    'SELECT template FROM whatsapp_templates WHERE type = $1 AND is_active = true',
    [type]
  );
  return res.rows[0]?.template;
};

// Fill template variables
const fillTemplate = (template, data) => {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || match);
};

// Core send function
const sendWhatsApp = async ({ phone, type, data, customMessage }) => {
  const phoneNum = phone.replace(/[^0-9]/g, '');
  const waPhone = phoneNum.startsWith('0')
    ? '92' + phoneNum.slice(1)
    : phoneNum;

  let message = customMessage;
  if (!message && type) {
    const template = await getTemplate(type);
    if (!template) throw new Error(`Template not found: ${type}`);
    message = fillTemplate(template, data || {});
  }

  // Log attempt
  const logRes = await query(
    `INSERT INTO whatsapp_logs
       (to_phone, customer_id, template_type, message, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [waPhone, data?.customer_id || null, type, message]
  );
  const logId = logRes.rows[0].id;

  try {
    const response = await axios.post(
      `${WA_BASE}/${process.env.WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: waPhone,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const waMessageId = response.data?.messages?.[0]?.id;

    await query(
      `UPDATE whatsapp_logs
       SET status = 'sent', wa_message_id = $1, sent_at = NOW()
       WHERE id = $2`,
      [waMessageId, logId]
    );

    logger.info(`WhatsApp sent to ${waPhone}: ${type}`);
    return { success: true, messageId: waMessageId };

  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;

    await query(
      `UPDATE whatsapp_logs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [errMsg, logId]
    );

    logger.error(`WhatsApp failed to ${waPhone}: ${errMsg}`);
    throw new Error(errMsg);
  }
};

// ── Installment Reminder ──
const sendInstallmentReminder = async (installment, daysFromDue = 0) => {
  const { customer_name, customer_phone, unit_number, due_date, amount, installment_no } = installment;

  let type = 'reminder';
  if (daysFromDue > 0) type = 'overdue_reminder';

  return sendWhatsApp({
    phone: customer_phone,
    type: 'reminder',
    data: {
      customer_name,
      unit_no: unit_number,
      inst_no: installment_no,
      due_date: new Date(due_date).toLocaleDateString('en-PK'),
      amount: parseFloat(amount).toLocaleString('en-PK'),
    },
  });
};

// ── Cancellation Warning ──
const sendCancellationWarning = async ({ customer_name, customer_phone, unit_number, amount }) => {
  return sendWhatsApp({
    phone: customer_phone,
    type: 'cancellation',
    data: { customer_name, unit_no: unit_number, amount },
  });
};

// ── Bulk Reminders (called by cron) ──
const sendDueDateReminders = async () => {
  const today = new Date();

  // 5 days before
  const fiveDaysBefore = await query(
    `SELECT s.id, s.installment_no, s.due_date, s.amount,
            c.name customer_name, c.phone customer_phone,
            u.unit_number
     FROM installment_schedules s
     JOIN bookings b ON b.id = s.booking_id
     JOIN customers c ON c.id = b.customer_id
     JOIN units u ON u.id = b.unit_id
     WHERE s.due_date = CURRENT_DATE + INTERVAL '5 days'
       AND s.status IN ('pending', 'partial')
       AND s.reminder_sent_5d = FALSE`
  );

  for (const inst of fiveDaysBefore.rows) {
    try {
      await sendInstallmentReminder(inst, -5);
      await query(
        'UPDATE installment_schedules SET reminder_sent_5d = TRUE WHERE id = $1',
        [inst.id]
      );
    } catch (e) {
      logger.error(`5-day reminder failed for ${inst.id}:`, e.message);
    }
  }

  // Due today
  const dueToday = await query(
    `SELECT s.id, s.installment_no, s.due_date, s.amount,
            c.name customer_name, c.phone customer_phone,
            u.unit_number
     FROM installment_schedules s
     JOIN bookings b ON b.id = s.booking_id
     JOIN customers c ON c.id = b.customer_id
     JOIN units u ON u.id = b.unit_id
     WHERE s.due_date = CURRENT_DATE
       AND s.status IN ('pending', 'partial')
       AND s.reminder_sent_0d = FALSE`
  );

  for (const inst of dueToday.rows) {
    try {
      await sendInstallmentReminder(inst, 0);
      await query(
        'UPDATE installment_schedules SET reminder_sent_0d = TRUE WHERE id = $1',
        [inst.id]
      );
    } catch (e) {
      logger.error(`Due-day reminder failed for ${inst.id}:`, e.message);
    }
  }

  // 3 days overdue
  const threeDaysOverdue = await query(
    `SELECT s.id, s.installment_no, s.due_date, s.amount,
            c.name customer_name, c.phone customer_phone,
            u.unit_number
     FROM installment_schedules s
     JOIN bookings b ON b.id = s.booking_id
     JOIN customers c ON c.id = b.customer_id
     JOIN units u ON u.id = b.unit_id
     WHERE s.due_date = CURRENT_DATE - INTERVAL '3 days'
       AND s.status IN ('pending', 'partial', 'overdue')
       AND s.reminder_sent_3d = FALSE`
  );

  for (const inst of threeDaysOverdue.rows) {
    try {
      await sendInstallmentReminder(inst, 3);
      await query(
        'UPDATE installment_schedules SET reminder_sent_3d = TRUE WHERE id = $1',
        [inst.id]
      );
    } catch (e) {
      logger.error(`3-day overdue reminder failed for ${inst.id}:`, e.message);
    }
  }

  // 30+ days overdue — cancellation warning
  const thirtyDaysOverdue = await query(
    `SELECT s.id, s.amount,
            c.name customer_name, c.phone customer_phone,
            u.unit_number
     FROM installment_schedules s
     JOIN bookings b ON b.id = s.booking_id
     JOIN customers c ON c.id = b.customer_id
     JOIN units u ON u.id = b.unit_id
     WHERE s.due_date <= CURRENT_DATE - INTERVAL '30 days'
       AND s.status IN ('pending', 'partial', 'overdue')`
  );

  for (const inst of thirtyDaysOverdue.rows) {
    try {
      await sendCancellationWarning(inst);
    } catch (e) {
      logger.error(`Cancellation warning failed for ${inst.id}:`, e.message);
    }
  }

  logger.info(`WA reminders: 5d(${fiveDaysBefore.rows.length}) today(${dueToday.rows.length}) 3d(${threeDaysOverdue.rows.length}) 30d(${thirtyDaysOverdue.rows.length})`);
};

// POST /whatsapp/webhook (for status callbacks)
const handleWebhook = async (body) => {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const statuses = changes?.value?.statuses;

  if (statuses) {
    for (const status of statuses) {
      await query(
        `UPDATE whatsapp_logs
         SET status = $1
         WHERE wa_message_id = $2`,
        [status.status, status.id]
      );
    }
  }
};

module.exports = {
  sendWhatsApp,
  sendInstallmentReminder,
  sendCancellationWarning,
  sendDueDateReminders,
  handleWebhook,
};

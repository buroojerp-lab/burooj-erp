// services/cronService.js
const cron   = require('node-cron');
const path   = require('path');
const fs     = require('fs').promises;
const zlib   = require('zlib');
const { promisify } = require('util');
const gzip   = promisify(zlib.gzip);
const logger = require('../config/logger');
const { sendDueDateReminders } = require('./whatsappService');
const { sendDueDateReminderEmails } = require('./emailService');
const { sendDueDateReminderSMS } = require('./smsService');
const { applyLateFees } = require('../controllers/installmentController');
const { query } = require('../config/database');
const {
  generateMonthlyAudit,
  generateSemiAnnualAudit,
  generateAnnualAudit,
} = require('./auditService');
const { sendMonthlyStatements, sendEmail } = require('./emailService');

const scheduleCronJobs = () => {

  // ── Daily: Check installments at 9 AM ──
  cron.schedule('0 9 * * *', async () => {
    logger.info('CRON: Running daily installment check...');
    try {
      const updated = await applyLateFees();
      logger.info(`CRON: Late fees applied to ${updated} installments`);

      await sendDueDateReminders();
      logger.info('CRON: WhatsApp reminders sent');

      await sendDueDateReminderEmails();
      logger.info('CRON: Email reminders sent');

      await sendDueDateReminderSMS();
      logger.info('CRON: SMS reminders sent');
    } catch (err) {
      logger.error('CRON: Daily check failed:', err.message);
    }
  }, { timezone: 'Asia/Karachi' });

  // ── Daily: Update overdue installment statuses ──
  cron.schedule('0 1 * * *', async () => {
    try {
      const result = await query(
        `UPDATE installment_schedules
         SET status = 'overdue'
         WHERE status = 'pending'
           AND due_date < CURRENT_DATE`
      );
      logger.info(`CRON: Marked ${result.rowCount} installments as overdue`);
    } catch (err) {
      logger.error('CRON: Status update failed:', err.message);
    }
  });

  // ── Weekly: Generate financial summary (Monday 8 AM) ──
  cron.schedule('0 8 * * 1', async () => {
    logger.info('CRON: Generating weekly financial report...');
    try {
      const report = await query(
        `SELECT
          SUM(p.amount) week_revenue,
          COUNT(DISTINCT b.id) new_bookings,
          COUNT(DISTINCT CASE WHEN s.status = 'paid' THEN s.id END) installments_paid
         FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         JOIN installment_schedules s ON s.booking_id = b.id
         WHERE p.payment_date >= CURRENT_DATE - INTERVAL '7 days'`
      );

      // Notify admins
      const admins = await query(
        "SELECT id FROM users WHERE role IN ('admin', 'manager')"
      );

      for (const admin of admins.rows) {
        await query(
          `INSERT INTO notifications (user_id, title, body, type)
           VALUES ($1, $2, $3, 'weekly_report')`,
          [
            admin.id,
            'Weekly Financial Summary',
            `Revenue: PKR ${parseFloat(report.rows[0].week_revenue || 0).toLocaleString()} | Bookings: ${report.rows[0].new_bookings} | Payments: ${report.rows[0].installments_paid}`,
          ]
        );
      }

      logger.info('CRON: Weekly report generated');
    } catch (err) {
      logger.error('CRON: Weekly report failed:', err.message);
    }
  }, { timezone: 'Asia/Karachi' });

  // ── Monthly: Calculate agent commissions (1st of month) ──
  cron.schedule('0 6 1 * *', async () => {
    logger.info('CRON: Calculating monthly agent commissions...');
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const monthYear = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

      const bookings = await query(
        `SELECT b.id, b.agent_id, b.final_price, a.id agent_rec_id, a.commission_rate
         FROM bookings b
         JOIN agents a ON a.user_id = b.agent_id
         WHERE DATE_TRUNC('month', b.booking_date) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')
           AND b.status = 'active'`
      );

      for (const bk of bookings.rows) {
        const commAmt = (bk.final_price * bk.commission_rate) / 100;
        await query(
          `INSERT INTO agent_commissions
             (agent_id, booking_id, booking_amount, commission_pct, commission_amt, month_year)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [bk.agent_rec_id, bk.id, bk.final_price, bk.commission_rate, commAmt, monthYear]
        );
      }

      logger.info(`CRON: Commissions calculated for ${bookings.rows.length} bookings`);
    } catch (err) {
      logger.error('CRON: Commission calc failed:', err.message);
    }
  });

  // ── Monthly: Rental distribution for investors ──
  cron.schedule('0 7 1 * *', async () => {
    logger.info('CRON: Processing investor rental distributions...');
    try {
      const investors = await query(
        'SELECT id, investment_amount, rental_return_pct FROM investors WHERE is_active = true'
      );

      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      for (const inv of investors.rows) {
        const annual = inv.investment_amount * (inv.rental_return_pct / 100);
        const monthly = annual / 12;
        const tax = monthly * 0.1; // 10% withholding tax

        await query(
          `INSERT INTO rental_distributions
             (investor_id, month_year, gross_amount, tax_deducted, net_amount)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [inv.id, monthYear, monthly, tax, monthly - tax]
        );
      }

      logger.info(`CRON: Rental distributions created for ${investors.rows.length} investors`);
    } catch (err) {
      logger.error('CRON: Rental distribution failed:', err.message);
    }
  });

  // ── Daily: Automatic database backup at 2 AM ──
  cron.schedule('0 2 * * *', async () => {
    logger.info('CRON: Running daily database backup...');
    try {
      const { buildBackup, BACKUP_DIR } = require('../routes/backupRoutes');
      await fs.mkdir(BACKUP_DIR, { recursive: true });

      const backup     = await buildBackup('daily');
      const json       = JSON.stringify(backup);
      const compressed = await gzip(Buffer.from(json, 'utf8'));

      const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}_daily.json.gz`;
      await fs.writeFile(path.join(BACKUP_DIR, filename), compressed);
      logger.info(`CRON: Daily backup saved — ${filename} (${(compressed.length / 1024).toFixed(1)} KB)`);

      // Keep only the last 7 daily backups
      const files = (await fs.readdir(BACKUP_DIR))
        .filter(f => f.includes('_daily.json.gz'))
        .sort()
        .reverse();
      for (const old of files.slice(7)) {
        await fs.unlink(path.join(BACKUP_DIR, old)).catch(() => {});
        logger.info(`CRON: Removed old daily backup: ${old}`);
      }
    } catch (err) {
      logger.error('CRON: Daily backup failed:', err.message);
    }
  }, { timezone: 'Asia/Karachi' });

  // ── Weekly: Full backup every Sunday at 3 AM ──
  cron.schedule('0 3 * * 0', async () => {
    logger.info('CRON: Running weekly database backup...');
    try {
      const { buildBackup, BACKUP_DIR } = require('../routes/backupRoutes');
      await fs.mkdir(BACKUP_DIR, { recursive: true });

      const backup     = await buildBackup('weekly');
      const json       = JSON.stringify(backup);
      const compressed = await gzip(Buffer.from(json, 'utf8'));

      const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}_weekly.json.gz`;
      await fs.writeFile(path.join(BACKUP_DIR, filename), compressed);
      logger.info(`CRON: Weekly backup saved — ${filename} (${(compressed.length / 1024).toFixed(1)} KB)`);

      // Keep only the last 4 weekly backups
      const files = (await fs.readdir(BACKUP_DIR))
        .filter(f => f.includes('_weekly.json.gz'))
        .sort()
        .reverse();
      for (const old of files.slice(4)) {
        await fs.unlink(path.join(BACKUP_DIR, old)).catch(() => {});
        logger.info(`CRON: Removed old weekly backup: ${old}`);
      }

      // Notify admins of weekly backup
      const admins = await query("SELECT id FROM users WHERE role IN ('admin', 'manager')");
      for (const admin of admins.rows) {
        await query(
          `INSERT INTO notifications (user_id, title, body, type) VALUES ($1, $2, $3, 'system')`,
          [admin.id, 'Weekly Backup Complete', `Database backup created: ${filename} (${(compressed.length / 1024).toFixed(1)} KB)`]
        );
      }
    } catch (err) {
      logger.error('CRON: Weekly backup failed:', err.message);
    }
  }, { timezone: 'Asia/Karachi' });

  // ── Monthly: Email statements to all customers (1st at 8 AM) ──
  cron.schedule('0 8 1 * *', async () => {
    logger.info('CRON: Sending monthly email statements...');
    try {
      const sent = await sendMonthlyStatements();
      logger.info(`CRON: Monthly email statements sent: ${sent}`);
    } catch (err) {
      logger.error('CRON: Monthly statements failed:', err.message);
    }
  }, { timezone: 'Asia/Karachi' });

  // ── Monthly: Email summary report to admin (1st at 9 AM) ──
  cron.schedule('0 9 1 * *', async () => {
    logger.info('CRON: Sending monthly admin email report...');
    try {
      const monthYear = new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
      const fmt = (n) => parseFloat(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });

      const [stats, admins] = await Promise.all([
        query(`
          SELECT
            (SELECT COUNT(*) FROM bookings WHERE status NOT IN ('cancelled')) total_bookings,
            (SELECT COALESCE(SUM(amount),0) FROM payments WHERE DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')) revenue,
            (SELECT COALESCE(SUM(b.final_price) - COALESCE(SUM(p.amount),0), 0)
               FROM bookings b LEFT JOIN payments p ON p.booking_id = b.id
               WHERE b.status NOT IN ('cancelled')) outstanding,
            (SELECT COUNT(*) FROM customers) customers
        `),
        query(`SELECT email, name FROM users WHERE role IN ('admin', 'manager') AND email IS NOT NULL`),
      ]);

      const s = stats.rows[0];
      for (const admin of admins.rows) {
        await sendEmail({
          to:           admin.email,
          subject:      `Monthly Report — ${monthYear} | Burooj Heights ERP`,
          templateName: 'admin_monthly_report',
          data: {
            month_year:     monthYear,
            total_bookings: s.total_bookings,
            revenue:        fmt(s.revenue),
            outstanding:    fmt(s.outstanding),
            customers:      s.customers,
          },
        }).catch(e => logger.error(`Admin report email failed: ${e.message}`));
      }
      logger.info(`CRON: Admin monthly report emailed to ${admins.rows.length} admins`);
    } catch (err) {
      logger.error('CRON: Admin monthly report failed:', err.message);
    }
  }, { timezone: 'Asia/Karachi' });

  // ── Monthly: Auto Financial Audit (1st of each month at 5 AM) ──
  cron.schedule('0 5 1 * *', async () => {
    logger.info('CRON: Generating monthly financial audit...');
    try {
      const report = await generateMonthlyAudit();
      logger.info(`CRON: Monthly audit complete — ID ${report.id}, profit: PKR ${report.netProfit}`);

      // Notify admin/manager/accountant
      const recipients = await query(
        "SELECT id FROM users WHERE role IN ('admin', 'manager', 'accountant')"
      );
      for (const u of recipients.rows) {
        await query(
          `INSERT INTO notifications (user_id, title, body, type)
           VALUES ($1, $2, $3, 'audit')`,
          [
            u.id,
            `Monthly Audit Ready — ${report.period.label}`,
            `Net Profit: PKR ${parseFloat(report.netProfit).toLocaleString()} | Growth: ${parseFloat(report.growthRate).toFixed(1)}% | Bookings: ${report.totalBookings}`,
          ]
        ).catch(() => {});
      }
    } catch (err) {
      logger.error('CRON: Monthly audit failed:', err.message);
    }
  }, { timezone: 'Asia/Karachi' });

  // ── Semi-Annual: Auto Audit (1st July & 1st January at 4 AM) ──
  cron.schedule('0 4 1 1,7 *', async () => {
    logger.info('CRON: Generating semi-annual financial audit...');
    try {
      const report = await generateSemiAnnualAudit();
      logger.info(`CRON: Semi-annual audit complete — ID ${report.id}`);

      const recipients = await query(
        "SELECT id FROM users WHERE role IN ('admin', 'manager')"
      );
      for (const u of recipients.rows) {
        await query(
          `INSERT INTO notifications (user_id, title, body, type)
           VALUES ($1, $2, $3, 'audit')`,
          [
            u.id,
            `Semi-Annual Audit Ready — ${report.period.label}`,
            `Total Income: PKR ${parseFloat(report.income).toLocaleString()} | Net Profit: PKR ${parseFloat(report.netProfit).toLocaleString()} | ROI: ${parseFloat(report.roi).toFixed(1)}%`,
          ]
        ).catch(() => {});
      }
    } catch (err) {
      logger.error('CRON: Semi-annual audit failed:', err.message);
    }
  }, { timezone: 'Asia/Karachi' });

  // ── Annual: Auto Audit (1st January at 3 AM) ──
  cron.schedule('0 3 1 1 *', async () => {
    logger.info('CRON: Generating annual financial audit...');
    try {
      const report = await generateAnnualAudit();
      logger.info(`CRON: Annual audit complete — ID ${report.id}`);

      const recipients = await query(
        "SELECT id FROM users WHERE role IN ('admin', 'manager')"
      );
      for (const u of recipients.rows) {
        await query(
          `INSERT INTO notifications (user_id, title, body, type)
           VALUES ($1, $2, $3, 'audit')`,
          [
            u.id,
            `Annual Financial Audit Ready — ${report.period.label}`,
            `Full Year Summary | Income: PKR ${parseFloat(report.income).toLocaleString()} | Profit: PKR ${parseFloat(report.netProfit).toLocaleString()} | ROI: ${parseFloat(report.roi).toFixed(1)}%`,
          ]
        ).catch(() => {});
      }
    } catch (err) {
      logger.error('CRON: Annual audit failed:', err.message);
    }
  }, { timezone: 'Asia/Karachi' });

  logger.info('✅ All cron jobs scheduled');
};

module.exports = { scheduleCronJobs };

// ============================================================
// BUROOJ HEIGHTS ERP — DATABASE BACKUP ROUTES
// Endpoints: POST / (create), GET / (list), DELETE /:filename
// ============================================================

const express  = require('express');
const path     = require('path');
const fs       = require('fs').promises;
const zlib     = require('zlib');
const { promisify } = require('util');
const router   = express.Router();

const { authenticate, authorize } = require('../middleware/auth');
const { query }                   = require('../config/database');
const logger                      = require('../config/logger');

const gzip   = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ── Backup directory (next to backend folder) ──
const BACKUP_DIR = path.join(process.cwd(), '..', 'backups');

// Ensure directory exists on module load
fs.mkdir(BACKUP_DIR, { recursive: true }).catch(() => {});

router.use(authenticate);
router.use(authorize('admin', 'manager'));

// ── Ordered list of tables to backup ──
const TABLES = [
  'users', 'user_sessions',
  'towers', 'floors', 'units',
  'customers', 'customer_documents',
  'payment_plans', 'bookings',
  'installment_schedules', 'payments',
  'agents', 'agent_commissions',
  'investors', 'investor_units', 'rental_distributions',
  'departments', 'employees', 'attendance', 'payroll',
  'chart_of_accounts', 'journal_entries', 'journal_lines',
  'expenses', 'expense_bills',
  'vendors', 'purchase_orders', 'po_items',
  'maintenance_tickets',
  'whatsapp_templates', 'whatsapp_logs',
  'notifications', 'audit_logs',
];

// ── Helper: build backup object ──
async function buildBackup(label = 'manual') {
  const backup = {
    meta: {
      app: 'Burooj Heights ERP',
      version: '2.0.0',
      type: label,
      created_at: new Date().toISOString(),
    },
    tables: {},
  };

  for (const table of TABLES) {
    try {
      const res = await query(`SELECT * FROM ${table}`);
      backup.tables[table] = res.rows;
    } catch {
      backup.tables[table] = [];
    }
  }
  return backup;
}

// ── POST /backup  — Create a backup ──
router.post('/', async (req, res) => {
  try {
    const backup     = await buildBackup('manual');
    const json       = JSON.stringify(backup);
    const compressed = await gzip(Buffer.from(json, 'utf8'));

    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}.json.gz`;
    const filepath = path.join(BACKUP_DIR, filename);
    await fs.writeFile(filepath, compressed);

    logger.info(`Backup created: ${filename} (${(compressed.length / 1024).toFixed(1)} KB)`);

    res.json({
      message:     'Backup created successfully',
      filename,
      size_kb:     parseFloat((compressed.length / 1024).toFixed(1)),
      table_count: Object.keys(backup.tables).length,
      row_count:   Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0),
      created_at:  backup.meta.created_at,
    });
  } catch (err) {
    logger.error('Backup failed:', err.message);
    res.status(500).json({ error: 'Backup failed: ' + err.message });
  }
});

// ── GET /backup  — List all backups ──
router.get('/', async (req, res) => {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = await Promise.all(
      files
        .filter(f => f.endsWith('.json.gz'))
        .map(async (filename) => {
          const stat = await fs.stat(path.join(BACKUP_DIR, filename));
          return {
            filename,
            size_kb:    parseFloat((stat.size / 1024).toFixed(1)),
            created_at: stat.mtime,
          };
        })
    );
    backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ backups, backup_dir: BACKUP_DIR });
  } catch {
    res.json({ backups: [], backup_dir: BACKUP_DIR });
  }
});

// ── GET /backup/:filename/stats  — Inspect a backup ──
router.get('/:filename/stats', async (req, res) => {
  const { filename } = req.params;
  if (!/^backup_[\w.-]+\.json\.gz$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filepath = path.join(BACKUP_DIR, filename);
  const compressed = await fs.readFile(filepath);
  const raw        = await gunzip(compressed);
  const backup     = JSON.parse(raw.toString('utf8'));

  res.json({
    meta:       backup.meta,
    tables:     Object.entries(backup.tables).map(([name, rows]) => ({ name, rows: rows.length })),
    total_rows: Object.values(backup.tables).reduce((s, r) => s + r.length, 0),
  });
});

// ── DELETE /backup/:filename  — Delete a backup file ──
router.delete('/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!/^backup_[\w.-]+\.json\.gz$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  await fs.unlink(path.join(BACKUP_DIR, filename));
  logger.info(`Backup deleted: ${filename}`);
  res.json({ message: 'Backup deleted', filename });
});

// ── Export helper for cron jobs ──
module.exports = router;
module.exports.buildBackup = buildBackup;
module.exports.BACKUP_DIR  = BACKUP_DIR;

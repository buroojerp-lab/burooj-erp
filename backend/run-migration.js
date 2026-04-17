// run-migration.js — one-time helper to run a migration file
// Usage: node run-migration.js migrations/003_burooj_heights_plan.sql
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = process.argv[2];
if (!file) { console.error('Usage: node run-migration.js <sql-file>'); process.exit(1); }

const sql = fs.readFileSync(path.resolve(__dirname, file), 'utf8');

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'burooj_erp',
  user:     process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

pool.query(sql)
  .then(() => { console.log('Migration applied successfully.'); pool.end(); })
  .catch(err => { console.error('Migration failed:', err.message); pool.end(); process.exit(1); });

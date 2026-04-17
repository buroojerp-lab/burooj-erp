-- ============================================================
-- BUROOJ ERP — FINANCIAL AUDIT SYSTEM MIGRATION
-- Migration: 003_audit_system.sql
-- ============================================================

-- ── Audit Reports ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_reports (
  id              SERIAL PRIMARY KEY,
  type            VARCHAR(20)    NOT NULL CHECK (type IN ('monthly', 'semi_annual', 'annual')),
  period_label    VARCHAR(100)   NOT NULL,          -- e.g. "March 2025", "H1 2025", "FY 2025"
  period_start    DATE           NOT NULL,
  period_end      DATE           NOT NULL,

  -- Core financials
  total_income        NUMERIC(18,2) DEFAULT 0,
  total_expenses      NUMERIC(18,2) DEFAULT 0,
  net_profit          NUMERIC(18,2) DEFAULT 0,
  growth_rate         NUMERIC(8,2)  DEFAULT 0,      -- % vs previous period
  roi                 NUMERIC(8,2)  DEFAULT 0,       -- %
  profit_margin       NUMERIC(8,2)  DEFAULT 0,       -- %

  -- Sales metrics
  total_bookings      INTEGER       DEFAULT 0,
  total_units_sold    INTEGER       DEFAULT 0,
  avg_deal_size       NUMERIC(18,2) DEFAULT 0,

  -- Collections
  total_collections   NUMERIC(18,2) DEFAULT 0,
  total_outstanding   NUMERIC(18,2) DEFAULT 0,
  collection_rate     NUMERIC(8,2)  DEFAULT 0,       -- %

  -- Expense breakdown (JSON)
  expense_breakdown   JSONB,

  -- Previous period comparison
  prev_income         NUMERIC(18,2) DEFAULT 0,
  prev_expenses       NUMERIC(18,2) DEFAULT 0,
  prev_net_profit     NUMERIC(18,2) DEFAULT 0,

  -- Full report snapshot
  report_data         JSONB,

  -- Metadata
  generated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at        TIMESTAMP    DEFAULT NOW(),
  trigger_type        VARCHAR(20)  DEFAULT 'auto'    -- 'auto' | 'manual'
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_type    ON audit_reports(type);
CREATE INDEX IF NOT EXISTS idx_audit_reports_period  ON audit_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_audit_reports_created ON audit_reports(generated_at DESC);

-- ── Audit Alerts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_alerts (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(60)   NOT NULL,   -- 'low_cash_flow' | 'expense_overspend' | 'installment_default' | 'profit_drop' | 'no_sales'
  severity   VARCHAR(20)   DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title      VARCHAR(255)  NOT NULL,
  message    TEXT,
  amount     NUMERIC(18,2),
  threshold  NUMERIC(18,2),
  meta       JSONB,
  is_read    BOOLEAN       DEFAULT false,
  created_at TIMESTAMP     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_alerts_unread ON audit_alerts(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_type   ON audit_alerts(type);

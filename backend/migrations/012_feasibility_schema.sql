-- ============================================================
-- 012_feasibility_schema.sql
-- AI Financial Feasibility & High-Rise Investment Dashboard
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Feasibility Projects ──────────────────────────────────
CREATE TABLE IF NOT EXISTS feasibility_projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(200)  NOT NULL,
  description     TEXT,
  location        VARCHAR(300),
  project_type    VARCHAR(50)   DEFAULT 'high-rise',
  status          VARCHAR(30)   DEFAULT 'draft',   -- draft | active | completed | archived
  tower_id        UUID REFERENCES towers(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ── Project Inputs (single row per project, upserted) ─────
CREATE TABLE IF NOT EXISTS feasibility_inputs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID UNIQUE REFERENCES feasibility_projects(id) ON DELETE CASCADE,

  -- Land
  land_cost             DECIMAL(18,2) DEFAULT 0,
  land_area_sqft        DECIMAL(14,2) DEFAULT 0,
  location_tier         VARCHAR(20)   DEFAULT 'B',   -- A, B, C

  -- Building
  total_floors          INTEGER       DEFAULT 20,
  basement_levels       INTEGER       DEFAULT 1,
  floor_plate_sqft      DECIMAL(14,2) DEFAULT 10000,
  construction_type     VARCHAR(50)   DEFAULT 'RCC Frame',

  -- Cost
  construction_cost_sqft DECIMAL(10,2) DEFAULT 1200,
  finishing_cost_sqft    DECIMAL(10,2) DEFAULT 400,
  mep_cost_sqft          DECIMAL(10,2) DEFAULT 250,
  contingency_pct        DECIMAL(5,2)  DEFAULT 10,
  consultant_fee_pct     DECIMAL(5,2)  DEFAULT 3,
  marketing_cost_pct     DECIMAL(5,2)  DEFAULT 2,

  -- Sales
  avg_price_sqft         DECIMAL(10,2) DEFAULT 5000,
  booking_pct            DECIMAL(5,2)  DEFAULT 20,
  sales_velocity_units   INTEGER       DEFAULT 5,    -- units/month
  construction_months    INTEGER       DEFAULT 36,

  -- Financing
  equity_pct             DECIMAL(5,2)  DEFAULT 40,
  loan_pct               DECIMAL(5,2)  DEFAULT 60,
  interest_rate_annual   DECIMAL(5,2)  DEFAULT 12,
  loan_term_months       INTEGER       DEFAULT 48,
  investor_share_pct     DECIMAL(5,2)  DEFAULT 30,

  updated_at             TIMESTAMP DEFAULT NOW()
);

-- ── Unit Mix ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feasibility_units (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES feasibility_projects(id) ON DELETE CASCADE,
  unit_type       VARCHAR(50)   NOT NULL,   -- 1BR, 2BR, 3BR, penthouse, shop, office
  count           INTEGER       DEFAULT 0,
  avg_size_sqft   DECIMAL(10,2) DEFAULT 0,
  price_per_sqft  DECIMAL(10,2) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Computed Results (cached) ──────────────────────────────
CREATE TABLE IF NOT EXISTS feasibility_results (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID UNIQUE REFERENCES feasibility_projects(id) ON DELETE CASCADE,
  total_project_cost    DECIMAL(18,2),
  total_revenue         DECIMAL(18,2),
  gross_profit          DECIMAL(18,2),
  net_profit            DECIMAL(18,2),
  roi_pct               DECIMAL(8,2),
  irr_pct               DECIMAL(8,2),
  npv                   DECIMAL(18,2),
  breakeven_month       INTEGER,
  gross_margin_pct      DECIMAL(8,2),
  payback_months        INTEGER,
  risk_score            DECIMAL(5,2),   -- 0-100
  ai_summary            TEXT,
  computed_at           TIMESTAMP DEFAULT NOW()
);

-- ── Monthly Cashflow ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS feasibility_cashflow (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES feasibility_projects(id) ON DELETE CASCADE,
  month_no        INTEGER NOT NULL,
  month_label     VARCHAR(20),
  income          DECIMAL(18,2) DEFAULT 0,
  construction_expense DECIMAL(18,2) DEFAULT 0,
  financing_expense    DECIMAL(18,2) DEFAULT 0,
  other_expense        DECIMAL(18,2) DEFAULT 0,
  net_cashflow    DECIMAL(18,2) DEFAULT 0,
  cumulative_cf   DECIMAL(18,2) DEFAULT 0,
  UNIQUE(project_id, month_no)
);

-- ── Scenarios ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feasibility_scenarios (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID REFERENCES feasibility_projects(id) ON DELETE CASCADE,
  scenario_type         VARCHAR(20) NOT NULL,  -- base | best | worst
  cost_adjustment_pct   DECIMAL(6,2) DEFAULT 0,
  revenue_adjustment_pct DECIMAL(6,2) DEFAULT 0,
  sales_velocity_multiplier DECIMAL(4,2) DEFAULT 1.0,
  total_cost            DECIMAL(18,2),
  total_revenue         DECIMAL(18,2),
  net_profit            DECIMAL(18,2),
  roi_pct               DECIMAL(8,2),
  irr_pct               DECIMAL(8,2),
  breakeven_month       INTEGER,
  computed_at           TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, scenario_type)
);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feas_proj_tower    ON feasibility_projects(tower_id);
CREATE INDEX IF NOT EXISTS idx_feas_proj_status   ON feasibility_projects(status);
CREATE INDEX IF NOT EXISTS idx_feas_units_proj    ON feasibility_units(project_id);
CREATE INDEX IF NOT EXISTS idx_feas_cf_proj       ON feasibility_cashflow(project_id, month_no);
CREATE INDEX IF NOT EXISTS idx_feas_scen_proj     ON feasibility_scenarios(project_id);

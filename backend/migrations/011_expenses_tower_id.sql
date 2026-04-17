-- ============================================================
-- 011_expenses_tower_id.sql
-- Add tower_id to expenses for full project data isolation
-- Safe to run multiple times (idempotent)
-- ============================================================

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS tower_id UUID REFERENCES towers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_tower ON expenses(tower_id);

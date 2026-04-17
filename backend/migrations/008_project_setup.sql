-- ============================================================
-- 008_project_setup.sql
-- Ensure 3 Burooj project towers exist and rename payment plans
-- Safe to run multiple times (idempotent)
-- ============================================================

-- Ensure 3 project towers exist
INSERT INTO towers (name, code, total_floors)
VALUES
  ('Burooj Heights',   'BH1', 20),
  ('Burooj Heights 2', 'BH2', 20),
  ('Burooj Heights 3', 'BH3', 20)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Rename payment plans to include project names
UPDATE payment_plans
   SET name = 'Burooj Heights – 18 Month Plan'
 WHERE installment_months = 18
   AND name NOT LIKE '%Burooj Heights –%';

UPDATE payment_plans
   SET name = 'Burooj Heights 2 – 3 Year Plan'
 WHERE name IN ('3 Year Plan')
   AND installment_months = 36;

UPDATE payment_plans
   SET name = 'Burooj Heights 3 – 30 Month Plan'
 WHERE name IN ('30 Month Plan')
   AND installment_months = 30;

-- ============================================================
-- 005_update_payment_plans.sql
-- Remove 5 Year Plan, add 1.6 Year Plan (20 months)
-- ============================================================

-- Deactivate the 5 Year Plan
UPDATE payment_plans
SET is_active = FALSE
WHERE name = '5 Year Plan';

-- Add 1.6 Year Plan (20 months, 20% down)
INSERT INTO payment_plans (name, description, down_payment_pct, installment_months, interest_rate, is_active)
VALUES (
  '1.6 Year Plan',
  '20% down payment, 20 monthly installments',
  20, 20, 0, TRUE
)
ON CONFLICT DO NOTHING;

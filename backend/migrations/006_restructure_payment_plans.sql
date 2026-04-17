-- ============================================================
-- 006_restructure_payment_plans.sql
-- Final payment plan lineup:
--   REMOVE : 4 Year Plan, 5 Year Plan, 1.6 Year Plan
--   KEEP   : Full Payment, 3 Year Plan, Burooj Heights 18-Month
--   ADD    : 18 Month Plan, 30 Month Plan
-- ============================================================

-- Deactivate removed plans
UPDATE payment_plans SET is_active = FALSE
WHERE name IN ('4 Year Plan', '5 Year Plan', '1.6 Year Plan');

-- Add 18 Month Plan (simple — 20% down, 18 equal monthly installments)
INSERT INTO payment_plans (name, description, down_payment_pct, installment_months, interest_rate, is_active)
VALUES (
  '18 Month Plan',
  '20% down payment, 18 equal monthly installments',
  20, 18, 0, TRUE
)
ON CONFLICT DO NOTHING;

-- Add 30 Month Plan (15% down, 30 equal monthly installments)
INSERT INTO payment_plans (name, description, down_payment_pct, installment_months, interest_rate, is_active)
VALUES (
  '30 Month Plan',
  '15% down payment, 30 equal monthly installments',
  15, 30, 0, TRUE
)
ON CONFLICT DO NOTHING;

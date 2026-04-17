-- ============================================================
-- 003_burooj_heights_plan.sql
-- Adds Burooj Heights 18-Month payment plan with
-- Confirmation Payment and Balloon Payment support
-- ============================================================

-- 1. Add confirmation_pct + balloon_pct to payment_plans
ALTER TABLE payment_plans
  ADD COLUMN IF NOT EXISTS confirmation_pct  DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balloon_pct       DECIMAL(5,2) DEFAULT 0;

-- 2. Add computed amounts to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmation_amount    DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balloon_payment_amount DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balloon_due_date       DATE;

-- 3. Add payment_type to installment_schedules
--    Values: 'monthly' (default), 'confirmation', 'balloon'
ALTER TABLE installment_schedules
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'monthly';

-- 4. Insert the Burooj Heights 18-Month Plan
--    Payment breakdown:
--      25% Down Payment    — due at booking (recorded as payment, not installment)
--       5% Confirmation     — due 30 days after booking
--      60% Monthly × 18    — due on 1st of each month for 18 months
--      10% Balloon/Handover — due 1 month after the last monthly installment
INSERT INTO payment_plans
  (name, description, down_payment_pct, confirmation_pct, installment_months, balloon_pct, interest_rate, is_active)
VALUES (
  'Burooj Heights – 18 Month Plan',
  '25% Down Payment + 5% Confirmation (30 days) + 18 Monthly Installments (60%) + 10% Balloon at Possession',
  25, 5, 18, 10, 0, TRUE
)
ON CONFLICT DO NOTHING;

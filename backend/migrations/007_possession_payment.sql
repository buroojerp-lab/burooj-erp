-- ============================================================
-- 007_possession_payment.sql
-- Adds On Possession as a 5th payment type
-- Updates Burooj Heights 18-Month Plan with correct ratios
-- from actual payment breakdown:
--   30% Down | 10% Confirmation | ~27% Monthly×18 | 11% Balloon | 22% Possession
-- ============================================================

-- 1. Add missing columns to payment_plans
ALTER TABLE payment_plans
  ADD COLUMN IF NOT EXISTS confirmation_pct DECIMAL(5,2) DEFAULT 0;

ALTER TABLE payment_plans
  ADD COLUMN IF NOT EXISTS balloon_pct DECIMAL(5,2) DEFAULT 0;

ALTER TABLE payment_plans
  ADD COLUMN IF NOT EXISTS possession_pct DECIMAL(5,2) DEFAULT 0;

-- 2. Add possession_amount to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS possession_amount DECIMAL(15,2) DEFAULT 0;

-- 3. Update Burooj Heights 18-Month Plan with exact ratios
UPDATE payment_plans
SET
  down_payment_pct  = 30,
  confirmation_pct  = 10,
  balloon_pct       = 11,
  possession_pct    = 22,
  installment_months = 18,
  description = '30% Down + 10% Confirmation + 18 Monthly Installments + 11% Balloon + 22% On Possession'
WHERE name = 'Burooj Heights – 18 Month Plan';

-- 4. Update 18 Month Plan — add confirmation support
UPDATE payment_plans
SET
  confirmation_pct = 10,
  description = '20% Down Payment + 10% Confirmation + 18 Monthly Installments'
WHERE name = '18 Month Plan';

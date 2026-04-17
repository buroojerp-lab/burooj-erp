-- ============================================================
-- BUROOJ ERP — MIGRATION 004
-- Add application_no field to bookings
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS application_no VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_bookings_application_no ON bookings(application_no);

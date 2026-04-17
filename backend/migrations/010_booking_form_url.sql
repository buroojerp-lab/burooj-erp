-- Migration 010: Add booking_form_url to bookings (stores uploaded physical form image)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_form_url TEXT;

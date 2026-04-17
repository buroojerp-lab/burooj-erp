-- Migration 009: Add email & SMS reminder flags to installment_schedules + create sms_logs table

ALTER TABLE installment_schedules
  ADD COLUMN IF NOT EXISTS email_reminder_sent_5d BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_reminder_sent_0d BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_reminder_sent_3d BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_reminder_sent_5d   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_reminder_sent_0d   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_reminder_sent_3d   BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sms_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone      VARCHAR(20) NOT NULL,
  customer_id   UUID        REFERENCES customers(id) ON DELETE SET NULL,
  message       TEXT        NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at       TIMESTAMP,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_customer_id ON sms_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status      ON sms_logs(status);

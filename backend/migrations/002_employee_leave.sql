-- 002_employee_leave.sql
-- Add employee_leave table (referenced in HR routes)

CREATE TABLE IF NOT EXISTS employee_leave (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  leave_type  VARCHAR(50) NOT NULL DEFAULT 'casual',
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  days        INTEGER NOT NULL DEFAULT 1,
  reason      TEXT,
  status      VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_employee ON employee_leave(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status   ON employee_leave(status);

-- Add missing columns to attendance if not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='attendance' AND column_name='overtime_hrs'
  ) THEN
    ALTER TABLE attendance ADD COLUMN overtime_hrs DECIMAL(4,2) DEFAULT 0;
  END IF;
END $$;

-- Add UNIQUE constraint on departments name if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='departments' AND constraint_type='UNIQUE'
  ) THEN
    ALTER TABLE departments ADD CONSTRAINT departments_name_unique UNIQUE (name);
  END IF;
END $$;

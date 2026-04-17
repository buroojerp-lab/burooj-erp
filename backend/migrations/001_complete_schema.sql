-- ============================================================
-- BUROOJ HEIGHTS ERP - COMPLETE DATABASE SCHEMA
-- PostgreSQL
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'admin', 'manager', 'sales_agent', 'accountant', 'investor', 'customer'
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'sales_agent',
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    TIMESTAMP,
  refresh_token TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. PROPERTY / INVENTORY
-- ============================================================

CREATE TYPE unit_type AS ENUM ('apartment', 'shop', 'office', 'penthouse');
CREATE TYPE unit_status AS ENUM ('available', 'reserved', 'sold', 'maintenance');

CREATE TABLE towers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20) UNIQUE NOT NULL,
  total_floors INTEGER NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE floors (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tower_id   UUID REFERENCES towers(id) ON DELETE CASCADE,
  floor_no   INTEGER NOT NULL,
  name       VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tower_id, floor_no)
);

CREATE TABLE units (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_number     VARCHAR(30) NOT NULL,
  tower_id        UUID REFERENCES towers(id),
  floor_id        UUID REFERENCES floors(id),
  unit_type       unit_type NOT NULL DEFAULT 'apartment',
  size_sqft       DECIMAL(10,2) NOT NULL,
  price_per_sqft  DECIMAL(10,2) NOT NULL,
  total_price     DECIMAL(15,2) GENERATED ALWAYS AS (size_sqft * price_per_sqft) STORED,
  bedrooms        INTEGER DEFAULT 0,
  bathrooms       INTEGER DEFAULT 0,
  status          unit_status DEFAULT 'available',
  description     TEXT,
  amenities       JSONB DEFAULT '[]',
  floor_plan_url  TEXT,
  images          JSONB DEFAULT '[]',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(tower_id, unit_number)
);

-- ============================================================
-- 3. CUSTOMERS & CRM
-- ============================================================

CREATE TABLE customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cnic         VARCHAR(20) UNIQUE NOT NULL,
  name         VARCHAR(100) NOT NULL,
  phone        VARCHAR(20) NOT NULL,
  email        VARCHAR(150),
  address      TEXT,
  city         VARCHAR(50),
  nationality  VARCHAR(50) DEFAULT 'Pakistani',
  occupation   VARCHAR(100),
  ntn          VARCHAR(20),
  user_id      UUID REFERENCES users(id),
  agent_id     UUID REFERENCES users(id),
  notes        TEXT,
  lead_source  VARCHAR(50),
  tags         JSONB DEFAULT '[]',
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customer_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID REFERENCES customers(id) ON DELETE CASCADE,
  doc_type      VARCHAR(50) NOT NULL,
  file_url      TEXT NOT NULL,
  file_name     VARCHAR(200),
  uploaded_at   TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 4. SALES & BOOKINGS
-- ============================================================

CREATE TYPE booking_status AS ENUM (
  'pending', 'confirmed', 'active', 'completed', 'cancelled'
);

CREATE TABLE payment_plans (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 VARCHAR(100) NOT NULL,
  description          TEXT,
  down_payment_pct     DECIMAL(5,2) NOT NULL DEFAULT 20,
  installment_months   INTEGER NOT NULL DEFAULT 36,
  interest_rate        DECIMAL(5,2) DEFAULT 0,
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bookings (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_no           VARCHAR(30) UNIQUE NOT NULL,
  customer_id          UUID REFERENCES customers(id),
  unit_id              UUID REFERENCES units(id),
  agent_id             UUID REFERENCES users(id),
  payment_plan_id      UUID REFERENCES payment_plans(id),
  booking_date         DATE NOT NULL,
  total_price          DECIMAL(15,2) NOT NULL,
  discount_amount      DECIMAL(15,2) DEFAULT 0,
  final_price          DECIMAL(15,2) NOT NULL,
  down_payment_amount  DECIMAL(15,2) NOT NULL,
  monthly_installment  DECIMAL(15,2) NOT NULL,
  status               booking_status DEFAULT 'pending',
  agreement_url        TEXT,
  notes                TEXT,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 5. INSTALLMENTS
-- ============================================================

CREATE TYPE installment_status AS ENUM (
  'pending', 'paid', 'partial', 'overdue', 'waived'
);

CREATE TABLE installment_schedules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id        UUID REFERENCES bookings(id) ON DELETE CASCADE,
  installment_no    INTEGER NOT NULL,
  due_date          DATE NOT NULL,
  amount            DECIMAL(15,2) NOT NULL,
  principal_amount  DECIMAL(15,2),
  late_fee          DECIMAL(15,2) DEFAULT 0,
  status            installment_status DEFAULT 'pending',
  paid_date         DATE,
  paid_amount       DECIMAL(15,2) DEFAULT 0,
  payment_method    VARCHAR(50),
  reference_no      VARCHAR(100),
  notes             TEXT,
  reminder_sent_5d  BOOLEAN DEFAULT FALSE,
  reminder_sent_0d  BOOLEAN DEFAULT FALSE,
  reminder_sent_3d  BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(booking_id, installment_no)
);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id      UUID REFERENCES bookings(id),
  installment_id  UUID REFERENCES installment_schedules(id),
  amount          DECIMAL(15,2) NOT NULL,
  payment_date    DATE NOT NULL,
  payment_method  VARCHAR(50) NOT NULL,
  reference_no    VARCHAR(100),
  bank_name       VARCHAR(100),
  slip_url        TEXT,
  verified_by     UUID REFERENCES users(id),
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 6. AGENTS
-- ============================================================

CREATE TABLE agents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) UNIQUE,
  agent_code        VARCHAR(20) UNIQUE NOT NULL,
  commission_rate   DECIMAL(5,2) DEFAULT 2.5,
  joining_date      DATE,
  target_monthly    DECIMAL(15,2) DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE agent_commissions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id       UUID REFERENCES agents(id),
  booking_id     UUID REFERENCES bookings(id),
  booking_amount DECIMAL(15,2) NOT NULL,
  commission_pct DECIMAL(5,2) NOT NULL,
  commission_amt DECIMAL(15,2) NOT NULL,
  status         VARCHAR(20) DEFAULT 'pending',
  paid_date      DATE,
  month_year     VARCHAR(10),
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 7. INVESTORS
-- ============================================================

CREATE TABLE investors (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) UNIQUE,
  investor_code     VARCHAR(20) UNIQUE NOT NULL,
  investment_amount DECIMAL(15,2) NOT NULL,
  investment_date   DATE NOT NULL,
  rental_return_pct DECIMAL(5,2) DEFAULT 12,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE investor_units (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID REFERENCES investors(id),
  unit_id     UUID REFERENCES units(id),
  share_pct   DECIMAL(5,2) DEFAULT 100,
  UNIQUE(investor_id, unit_id)
);

CREATE TABLE rental_distributions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id       UUID REFERENCES investors(id),
  month_year        VARCHAR(10) NOT NULL,
  gross_amount      DECIMAL(15,2) NOT NULL,
  tax_deducted      DECIMAL(15,2) DEFAULT 0,
  net_amount        DECIMAL(15,2) NOT NULL,
  payment_date      DATE,
  payment_method    VARCHAR(50),
  status            VARCHAR(20) DEFAULT 'pending',
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 8. HR & PAYROLL
-- ============================================================

CREATE TABLE departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL,
  head_id    UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) UNIQUE,
  emp_code        VARCHAR(20) UNIQUE NOT NULL,
  department_id   UUID REFERENCES departments(id),
  designation     VARCHAR(100),
  joining_date    DATE NOT NULL,
  basic_salary    DECIMAL(12,2) NOT NULL,
  allowances      JSONB DEFAULT '{}',
  deductions      JSONB DEFAULT '{}',
  bank_name       VARCHAR(100),
  bank_account    VARCHAR(50),
  cnic            VARCHAR(20),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE attendance (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID REFERENCES employees(id),
  date         DATE NOT NULL,
  check_in     TIME,
  check_out    TIME,
  status       VARCHAR(20) DEFAULT 'present',
  overtime_hrs DECIMAL(4,2) DEFAULT 0,
  notes        TEXT,
  UNIQUE(employee_id, date)
);

CREATE TABLE payroll (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID REFERENCES employees(id),
  month_year      VARCHAR(10) NOT NULL,
  working_days    INTEGER,
  present_days    INTEGER,
  basic_salary    DECIMAL(12,2),
  allowances      DECIMAL(12,2) DEFAULT 0,
  overtime_pay    DECIMAL(12,2) DEFAULT 0,
  deductions      DECIMAL(12,2) DEFAULT 0,
  tax             DECIMAL(12,2) DEFAULT 0,
  gross_salary    DECIMAL(12,2),
  net_salary      DECIMAL(12,2),
  status          VARCHAR(20) DEFAULT 'pending',
  paid_date       DATE,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, month_year)
);

-- ============================================================
-- 9. ACCOUNTING & FINANCE
-- ============================================================

CREATE TYPE account_type AS ENUM (
  'asset', 'liability', 'equity', 'income', 'expense'
);

CREATE TABLE chart_of_accounts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         VARCHAR(20) UNIQUE NOT NULL,
  name         VARCHAR(150) NOT NULL,
  type         account_type NOT NULL,
  parent_id    UUID REFERENCES chart_of_accounts(id),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE journal_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_no    VARCHAR(30) UNIQUE NOT NULL,
  date        DATE NOT NULL,
  description TEXT,
  reference   VARCHAR(100),
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE journal_lines (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID REFERENCES chart_of_accounts(id),
  debit            DECIMAL(15,2) DEFAULT 0,
  credit           DECIMAL(15,2) DEFAULT 0,
  description      TEXT
);

-- ============================================================
-- 10. OFFICE EXPENSES
-- ============================================================

CREATE TYPE expense_category AS ENUM (
  'office_rent', 'electricity', 'internet', 'marketing',
  'salaries', 'office_supplies', 'fuel_transport',
  'maintenance', 'miscellaneous'
);

CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'online', 'cheque');

CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_no      VARCHAR(30) UNIQUE NOT NULL,
  title           VARCHAR(200) NOT NULL,
  category        expense_category NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,
  date            DATE NOT NULL,
  payment_method  payment_method NOT NULL DEFAULT 'cash',
  paid_by         UUID REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'pending',
  notes           TEXT,
  -- OCR extracted fields
  ocr_vendor_name VARCHAR(200),
  ocr_amount      DECIMAL(15,2),
  ocr_date        DATE,
  ocr_raw         TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE expense_bills (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id   UUID REFERENCES expenses(id) ON DELETE CASCADE,
  file_url     TEXT NOT NULL,
  file_name    VARCHAR(200),
  file_type    VARCHAR(20),
  file_size    INTEGER,
  ocr_done     BOOLEAN DEFAULT FALSE,
  ocr_result   JSONB,
  uploaded_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 11. PROCUREMENT
-- ============================================================

CREATE TABLE vendors (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(150) NOT NULL,
  contact_name  VARCHAR(100),
  phone         VARCHAR(20),
  email         VARCHAR(150),
  address       TEXT,
  category      VARCHAR(100),
  tax_no        VARCHAR(50),
  bank_details  JSONB,
  rating        INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number    VARCHAR(30) UNIQUE NOT NULL,
  vendor_id    UUID REFERENCES vendors(id),
  order_date   DATE NOT NULL,
  delivery_date DATE,
  status       VARCHAR(20) DEFAULT 'draft',
  subtotal     DECIMAL(15,2) DEFAULT 0,
  tax_amount   DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  notes        TEXT,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE po_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id        UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_name    VARCHAR(200) NOT NULL,
  description  TEXT,
  quantity     DECIMAL(10,2) NOT NULL,
  unit         VARCHAR(30),
  unit_price   DECIMAL(12,2) NOT NULL,
  total_price  DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ============================================================
-- 12. FACILITY MANAGEMENT
-- ============================================================

CREATE TABLE maintenance_tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_no       VARCHAR(30) UNIQUE NOT NULL,
  unit_id         UUID REFERENCES units(id),
  customer_id     UUID REFERENCES customers(id),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(100),
  priority        VARCHAR(20) DEFAULT 'medium',
  status          VARCHAR(20) DEFAULT 'open',
  assigned_to     UUID REFERENCES users(id),
  resolved_at     TIMESTAMP,
  resolution_note TEXT,
  images          JSONB DEFAULT '[]',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 13. WHATSAPP NOTIFICATIONS
-- ============================================================

CREATE TABLE whatsapp_templates (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      VARCHAR(100) NOT NULL,
  type      VARCHAR(50) NOT NULL,
  template  TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE whatsapp_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_phone       VARCHAR(20) NOT NULL,
  customer_id    UUID REFERENCES customers(id),
  template_type  VARCHAR(50),
  message        TEXT NOT NULL,
  status         VARCHAR(20) DEFAULT 'pending',
  wa_message_id  VARCHAR(100),
  error_message  TEXT,
  sent_at        TIMESTAMP,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 14. NOTIFICATIONS & AUDIT
-- ============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id),
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  type        VARCHAR(50),
  reference_id UUID,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  table_name  VARCHAR(100),
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_units_tower ON units(tower_id);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_installments_due_date ON installment_schedules(due_date);
CREATE INDEX idx_installments_status ON installment_schedules(status);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_table ON audit_logs(table_name);
CREATE INDEX idx_wa_logs_customer ON whatsapp_logs(customer_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ============================================================
-- SEED DEFAULT DATA
-- ============================================================

-- Default Admin User (password: Admin@123)
INSERT INTO users (name, email, phone, password_hash, role) VALUES
('System Admin', 'admin@buroojheights.com', '03001234567',
 crypt('Admin@123', gen_salt('bf')), 'admin');

-- Default Payment Plans
INSERT INTO payment_plans (name, description, down_payment_pct, installment_months, interest_rate) VALUES
('3 Year Plan', '20% down, 36 monthly installments', 20, 36, 0),
('4 Year Plan', '15% down, 48 monthly installments', 15, 48, 0),
('5 Year Plan', '10% down, 60 monthly installments', 10, 60, 0),
('Full Payment', '100% upfront with 5% discount', 100, 0, 0);

-- Default Tower
INSERT INTO towers (name, code, total_floors) VALUES ('Tower A', 'TWR-A', 20);

-- WhatsApp Templates
INSERT INTO whatsapp_templates (name, type, template) VALUES
('Installment Reminder', 'reminder',
 'Dear {{customer_name}}, your installment #{{inst_no}} for Unit {{unit_no}} at Burooj Heights is due on {{due_date}}. Amount: PKR {{amount}}. Please pay on time to avoid penalty. Contact: 03001234567'),
('Payment Confirmed', 'confirmation',
 'Dear {{customer_name}}, we have received your payment of PKR {{amount}} for Unit {{unit_no}} on {{date}}. Thank you! Burooj Heights Management.'),
('Cancellation Warning', 'cancellation',
 'URGENT: Dear {{customer_name}}, your installment for Unit {{unit_no}} is 30 days overdue (PKR {{amount}}). Please pay immediately or your booking may be cancelled. Contact us: 03001234567'),
('Booking Confirmation', 'booking',
 'Congratulations {{customer_name}}! Your booking for Unit {{unit_no}} at Burooj Heights is confirmed. Booking No: {{booking_no}}. Thank you for choosing us!');

-- Chart of Accounts
INSERT INTO chart_of_accounts (code, name, type) VALUES
('1000', 'Assets', 'asset'),
('1100', 'Cash & Bank', 'asset'),
('1200', 'Receivables', 'asset'),
('1300', 'Property Inventory', 'asset'),
('2000', 'Liabilities', 'liability'),
('2100', 'Payables', 'liability'),
('3000', 'Equity', 'equity'),
('3100', 'Owner Capital', 'equity'),
('4000', 'Income', 'income'),
('4100', 'Sales Revenue', 'income'),
('4200', 'Rental Income', 'income'),
('5000', 'Expenses', 'expense'),
('5100', 'Office Rent', 'expense'),
('5200', 'Salaries', 'expense'),
('5300', 'Marketing', 'expense'),
('5400', 'Utilities', 'expense'),
('5500', 'Miscellaneous', 'expense');

-- Departments
INSERT INTO departments (name) VALUES
('Sales'), ('Finance'), ('HR'), ('Operations'), ('Management');

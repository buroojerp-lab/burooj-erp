-- ============================================================
-- BUROOJ HEIGHTS ERP — MIGRATION 003
-- Features: Email logs, AI chat logs, Multi-project support
-- ============================================================

-- ── Email Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email      VARCHAR(255) NOT NULL,
  subject       VARCHAR(500),
  template_name VARCHAR(100),
  status        VARCHAR(20) DEFAULT 'pending',
  message_id    VARCHAR(255),
  error_message TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_status  ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);

-- ── AI Chat Logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  message_count INTEGER DEFAULT 1,
  tokens_used   INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON ai_chat_logs(user_id);

-- ── Projects Table (Multi-project scalability) ────────────────
CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(20) UNIQUE NOT NULL,
  description   TEXT,
  location      VARCHAR(500),
  latitude      DECIMAL(10, 7),
  longitude     DECIMAL(10, 7),
  google_maps_url TEXT,
  city          VARCHAR(100) DEFAULT 'Lahore',
  total_floors  INTEGER DEFAULT 0,
  total_units   INTEGER DEFAULT 0,
  status        VARCHAR(30) DEFAULT 'active',  -- active, completed, upcoming
  start_date    DATE,
  completion_date DATE,
  cover_image_url TEXT,
  amenities     JSONB DEFAULT '[]',
  is_default    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Default Burooj Heights project
INSERT INTO projects (name, code, description, location, city, status, is_default)
VALUES (
  'Burooj Heights',
  'BH-01',
  'Premium residential and commercial real estate development',
  'Main Boulevard Dream Housing, Raiwind Road, Lahore',
  'Lahore',
  'active',
  TRUE
) ON CONFLICT (code) DO NOTHING;

-- ── Add project_id to towers (backwards-compatible) ──────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'towers' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE towers ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    -- Assign existing towers to default project
    UPDATE towers SET project_id = (SELECT id FROM projects WHERE is_default = TRUE LIMIT 1)
    WHERE project_id IS NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_towers_project ON towers(project_id);

-- ── System settings table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT,
  description VARCHAR(500),
  updated_at  TIMESTAMP DEFAULT NOW()
);
INSERT INTO system_settings (key, value, description) VALUES
  ('default_language',    'en',              'Default UI language (en/ur)'),
  ('google_maps_api_key', '',                'Google Maps JavaScript API key'),
  ('ai_enabled',          'true',            'Enable AI chatbot'),
  ('email_enabled',       'true',            'Enable email automation'),
  ('voice_enabled',       'true',            'Enable voice commands')
ON CONFLICT (key) DO NOTHING;

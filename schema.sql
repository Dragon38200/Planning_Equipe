-- Plani-Mounier Database Schema for Vercel Postgres
-- Ce script crée toutes les tables nécessaires pour l'application

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  initials VARCHAR(10) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('TECHNICIAN', 'MANAGER', 'ADMIN')),
  password VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des missions
CREATE TABLE IF NOT EXISTS missions (
  id VARCHAR(255) PRIMARY KEY,
  date DATE NOT NULL,
  job_number VARCHAR(255) NOT NULL,
  work_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  travel_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  overtime_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  type VARCHAR(50) NOT NULL CHECK (type IN ('WORK', 'CONGE', 'MALADIE', 'FORMATION')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'SUBMITTED', 'VALIDATED', 'REJECTED')),
  technician_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_initials VARCHAR(10) NOT NULL,
  igd BOOLEAN DEFAULT FALSE,
  description TEXT,
  address TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  rejection_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des templates de formulaires
CREATE TABLE IF NOT EXISTS form_templates (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fields JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des réponses aux formulaires
CREATE TABLE IF NOT EXISTS form_responses (
  id VARCHAR(255) PRIMARY KEY,
  mission_id VARCHAR(255) REFERENCES missions(id) ON DELETE SET NULL,
  template_id VARCHAR(255) NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  technician_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMP NOT NULL,
  data JSONB NOT NULL,
  signature TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des paramètres de l'application
CREATE TABLE IF NOT EXISTS app_settings (
  id VARCHAR(255) PRIMARY KEY DEFAULT 'app_config',
  app_name VARCHAR(255) NOT NULL DEFAULT 'PLANIT-MOUNIER',
  app_logo_url TEXT,
  report_logo_url TEXT,
  custom_logos JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_missions_technician ON missions(technician_id);
CREATE INDEX IF NOT EXISTS idx_missions_date ON missions(date);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_form_responses_technician ON form_responses(technician_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_template ON form_responses(template_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour mettre à jour updated_at automatiquement
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_missions_updated_at ON missions;
CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_form_templates_updated_at ON form_templates;
CREATE TRIGGER update_form_templates_updated_at BEFORE UPDATE ON form_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_form_responses_updated_at ON form_responses;
CREATE TRIGGER update_form_responses_updated_at BEFORE UPDATE ON form_responses
  FOR EACH ROW EXECUTE FUNCTION update_update_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insérer les paramètres par défaut si inexistants
INSERT INTO app_settings (id, app_name, app_logo_url, custom_logos)
VALUES ('app_config', 'PLANIT-MOUNIER', '', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

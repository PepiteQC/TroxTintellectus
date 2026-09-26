-- ═══════════════════════════════════════════════════════════
--  MIGRATION 001 — Table players (joueurs)
--  Pattern Nova-Life : données RP complètes + position 3D
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS players (
  id CHAR(36) PRIMARY KEY,
  steam_id VARCHAR(64) UNIQUE,
  discord_id VARCHAR(64),
  
  -- Identité RP
  first_name VARCHAR(64) NOT NULL,
  last_name VARCHAR(64) NOT NULL,
  full_name VARCHAR(128) GENERATED ALWAYS AS (CONCAT(first_name, ' ', last_name)) STORED,
  gender ENUM('male', 'female', 'nonbinary') NOT NULL DEFAULT 'male',
  nationality VARCHAR(32) DEFAULT 'canadian',
  date_of_birth DATE,
  
  -- Apparence (Character Creator)
  appearance JSON COMMENT 'Données Character Creator complètes',
  
  -- Position 3D monde
  pos_x DOUBLE NOT NULL DEFAULT 0,
  pos_y DOUBLE NOT NULL DEFAULT 5,
  pos_z DOUBLE NOT NULL DEFAULT 0,
  rotation DOUBLE NOT NULL DEFAULT 0,
  
  -- Stats
  health INT NOT NULL DEFAULT 100,
  armor INT NOT NULL DEFAULT 0,
  hunger INT NOT NULL DEFAULT 100,
  thirst INT NOT NULL DEFAULT 100,
  
  -- Économie
  money BIGINT NOT NULL DEFAULT 2500,
  bank BIGINT NOT NULL DEFAULT 0,
  
  -- Métier
  job VARCHAR(64) DEFAULT 'unemployed',
  job_rank VARCHAR(32),
  job_started_at TIMESTAMP NULL,
  total_worked_hours DOUBLE DEFAULT 0,
  
  -- Flags
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason VARCHAR(255),
  criminal_record INT DEFAULT 0,
  
  -- Métadonnées
  role ENUM('user', 'moderator', 'admin', 'owner') DEFAULT 'user',
  last_seen TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_steam (steam_id),
  INDEX idx_discord (discord_id),
  INDEX idx_job (job),
  INDEX idx_role (role),
  INDEX idx_last_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
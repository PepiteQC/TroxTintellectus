-- ═══════════════════════════════════════════════════════════
--  MIGRATION 002 — Immobilier (maisons + appartements)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS houses (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36),
  
  -- Localisation
  address VARCHAR(255) NOT NULL,
  district VARCHAR(64) NOT NULL,
  pos_x DOUBLE NOT NULL,
  pos_y DOUBLE NOT NULL,
  pos_z DOUBLE NOT NULL,
  
  -- Propriétés
  price BIGINT NOT NULL,
  type ENUM('apartment', 'house', 'villa', 'penthouse') DEFAULT 'house',
  size INT DEFAULT 100,
  
  -- État
  locked BOOLEAN DEFAULT TRUE,
  sold_at TIMESTAMP NULL,
  
  -- Contenu (meubles, stockage)
  furniture JSON DEFAULT '[]',
  storage JSON DEFAULT '[]',
  
  -- Accès
  keys JSON DEFAULT '[]' COMMENT 'Liste des player_id avec clé',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (owner_id) REFERENCES players(id) ON DELETE SET NULL,
  INDEX idx_owner (owner_id),
  INDEX idx_district (district),
  INDEX idx_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
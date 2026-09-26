-- Migration 005: AI & TroxT systems
-- Tables: troxt_tasks, troxt_audit, morphs, sessions, game_logs

CREATE TABLE IF NOT EXISTS `troxt_tasks` (
  `id` CHAR(36) PRIMARY KEY,
  `agent_id` VARCHAR(32) NOT NULL,
  `mission` TEXT NOT NULL,
  `status` ENUM('queued','running','succeeded','failed','cancelled') DEFAULT 'queued',
  `priority` ENUM('low','normal','high','critical') DEFAULT 'normal',
  `retry_count` TINYINT UNSIGNED DEFAULT 0,
  `payload` JSON,
  `result` JSON,
  `error` TEXT,
  `started_at` TIMESTAMP NULL,
  `completed_at` TIMESTAMP NULL,
  `duration_ms` INT UNSIGNED,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_agent` (`agent_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `troxt_audit` (
  `id` CHAR(36) PRIMARY KEY,
  `action` VARCHAR(128) NOT NULL,
  `actor_id` CHAR(36),
  `score` TINYINT UNSIGNED NOT NULL,
  `level` ENUM('GREEN','YELLOW','ORANGE','RED') NOT NULL,
  `factors` JSON,
  `hash` CHAR(16) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_level` (`level`),
  INDEX `idx_actor` (`actor_id`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `morphs` (
  `id` CHAR(36) PRIMARY KEY,
  `player_id` CHAR(36) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `data` JSON NOT NULL,
  `is_public` BOOLEAN DEFAULT FALSE,
  `downloads` INT UNSIGNED DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE,
  INDEX `idx_player` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` CHAR(36) PRIMARY KEY,
  `player_id` CHAR(36) NOT NULL,
  `character_id` CHAR(36) NULL,
  `token_hash` CHAR(64) NOT NULL,
  `ip_address` VARCHAR(45),
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE,
  INDEX `idx_player` (`player_id`),
  INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `game_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `level` ENUM('debug','info','warn','error','fatal') DEFAULT 'info',
  `source` VARCHAR(64) NOT NULL,
  `message` TEXT NOT NULL,
  `metadata` JSON,
  `player_id` CHAR(36) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_level` (`level`),
  INDEX `idx_source` (`source`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
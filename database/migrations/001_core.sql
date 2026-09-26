-- Migration 001: Core tables
-- Tables: migrations, server_config

CREATE TABLE IF NOT EXISTS `server_config` (
  `key` VARCHAR(64) PRIMARY KEY,
  `value` JSON NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` VARCHAR(64) DEFAULT 'system'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
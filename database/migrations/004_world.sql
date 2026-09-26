-- Migration 004: World (Houses, Vehicles, Factions)
-- Tables: houses, house_keys, house_furniture, vehicles, factions, faction_members, territories

CREATE TABLE IF NOT EXISTS `houses` (
  `id` CHAR(36) PRIMARY KEY,
  `owner_id` CHAR(36) NULL,
  `address` VARCHAR(255) NOT NULL,
  `district` VARCHAR(64) NOT NULL,
  `type` ENUM('apartment','house','mansion','warehouse','office') DEFAULT 'house',
  `price` DECIMAL(12,2) NOT NULL,
  `position_x` FLOAT NOT NULL,
  `position_y` FLOAT NOT NULL,
  `position_z` FLOAT NOT NULL,
  `locked` BOOLEAN DEFAULT TRUE,
  `is_for_sale` BOOLEAN DEFAULT TRUE,
  `purchased_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`owner_id`) REFERENCES `characters`(`id`) ON DELETE SET NULL,
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_district` (`district`),
  INDEX `idx_sale` (`is_for_sale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `house_keys` (
  `house_id` CHAR(36) NOT NULL,
  `character_id` CHAR(36) NOT NULL,
  `granted_by` CHAR(36) NOT NULL,
  `granted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`house_id`, `character_id`),
  FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `house_furniture` (
  `id` CHAR(36) PRIMARY KEY,
  `house_id` CHAR(36) NOT NULL,
  `owner_id` CHAR(36) NOT NULL,
  `entity_type` ENUM('wall','floor','door','window','furniture','decoration') NOT NULL,
  `model` VARCHAR(128) NOT NULL,
  `position_x` FLOAT NOT NULL,
  `position_y` FLOAT NOT NULL,
  `position_z` FLOAT NOT NULL,
  `rotation_x` FLOAT DEFAULT 0,
  `rotation_y` FLOAT DEFAULT 0,
  `rotation_z` FLOAT DEFAULT 0,
  `placed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`owner_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
  INDEX `idx_house` (`house_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` CHAR(36) PRIMARY KEY,
  `owner_id` CHAR(36) NULL,
  `model` VARCHAR(64) NOT NULL,
  `class` ENUM('economy','sport','super','utility','luxury','motorcycle') NOT NULL,
  `plate` VARCHAR(10) NOT NULL UNIQUE,
  `color_primary` VARCHAR(16) DEFAULT '#1a1a2e',
  `position_x` FLOAT DEFAULT 0,
  `position_y` FLOAT DEFAULT 0,
  `position_z` FLOAT DEFAULT 0,
  `health` INT DEFAULT 1000,
  `fuel` TINYINT UNSIGNED DEFAULT 100,
  `speed_max` SMALLINT UNSIGNED NOT NULL,
  `locked` BOOLEAN DEFAULT TRUE,
  `insured` BOOLEAN DEFAULT FALSE,
  `tuning` JSON DEFAULT ('[]'),
  `purchased_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`owner_id`) REFERENCES `characters`(`id`) ON DELETE SET NULL,
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_plate` (`plate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `factions` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(64) NOT NULL UNIQUE,
  `tag` VARCHAR(8) NOT NULL UNIQUE,
  `type` ENUM('gang','mafia','police','medical','mechanic','business','government') NOT NULL,
  `leader_id` CHAR(36) NOT NULL,
  `balance` DECIMAL(15,2) DEFAULT 0,
  `territory_id` CHAR(36) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`leader_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `faction_members` (
  `faction_id` CHAR(36) NOT NULL,
  `character_id` CHAR(36) NOT NULL,
  `rank` VARCHAR(32) NOT NULL DEFAULT 'recruit',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`faction_id`, `character_id`),
  FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `territories` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(64) NOT NULL,
  `faction_id` CHAR(36) NULL,
  `position_x` FLOAT NOT NULL,
  `position_z` FLOAT NOT NULL,
  `radius` FLOAT NOT NULL DEFAULT 100,
  `income_per_hour` DECIMAL(10,2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`faction_id`) REFERENCES `factions`(`id`) ON DELETE SET NULL,
  INDEX `idx_faction` (`faction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
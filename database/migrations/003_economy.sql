-- Migration 003: Economy & Inventory
-- Tables: item_catalog, inventories, weapons, transactions, businesses

CREATE TABLE IF NOT EXISTS `item_catalog` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(128) NOT NULL,
  `description` TEXT,
  `category` ENUM('weapon','armor','consumable','material','tool','vehicle','misc') NOT NULL,
  `rarity` ENUM('common','uncommon','rare','epic','legendary') DEFAULT 'common',
  `weight` DECIMAL(5,2) DEFAULT 1.00,
  `stackable` BOOLEAN DEFAULT TRUE,
  `max_stack` INT DEFAULT 99,
  `buy_price` DECIMAL(10,2) DEFAULT 0,
  `sell_price` DECIMAL(10,2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inventories` (
  `id` CHAR(36) PRIMARY KEY,
  `character_id` CHAR(36) NOT NULL,
  `item_id` VARCHAR(64) NOT NULL,
  `quantity` INT UNSIGNED DEFAULT 1,
  `metadata` JSON,
  `slot_index` INT UNSIGNED,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `item_catalog`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_char_item_slot` (`character_id`, `item_id`, `slot_index`),
  INDEX `idx_char` (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `weapons` (
  `id` CHAR(36) PRIMARY KEY,
  `character_id` CHAR(36) NOT NULL,
  `weapon_type` ENUM('pistol','rifle','shotgun','smg','sniper','melee','explosive') NOT NULL,
  `model` VARCHAR(64) NOT NULL,
  `damage` SMALLINT UNSIGNED NOT NULL,
  `ammo_current` SMALLINT UNSIGNED DEFAULT 0,
  `ammo_max` SMALLINT UNSIGNED NOT NULL,
  `is_equipped` BOOLEAN DEFAULT FALSE,
  `serial_number` VARCHAR(32) UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
  INDEX `idx_char` (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` CHAR(36) PRIMARY KEY,
  `from_character_id` CHAR(36) NULL,
  `to_character_id` CHAR(36) NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `type` ENUM('salary','purchase','sale','transfer','tax','fine','reward','loot','deposit','withdraw','system') NOT NULL,
  `description` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`from_character_id`) REFERENCES `characters`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`to_character_id`) REFERENCES `characters`(`id`) ON DELETE SET NULL,
  INDEX `idx_from` (`from_character_id`),
  INDEX `idx_to` (`to_character_id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `businesses` (
  `id` CHAR(36) PRIMARY KEY,
  `owner_id` CHAR(36) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `type` ENUM('shop','restaurant','garage','club','bank','dispensary','factory') NOT NULL,
  `balance` DECIMAL(15,2) DEFAULT 0,
  `is_open` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`owner_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
  INDEX `idx_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
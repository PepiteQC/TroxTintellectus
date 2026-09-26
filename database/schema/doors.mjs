/**
 * Drizzle schema — Doors
 * Path: database/drizzle/schema/doors.mjs
 */
import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb, text } from "drizzle-orm/pg-core";

export const doors = pgTable("doors", {
  id:            uuid("id").primaryKey().defaultRandom(),
  uid:           varchar("uid", { length: 128 }).notNull().unique(),   // "commissariat:armurerie"
  buildingId:    uuid("building_id").notNull(),
  doorId:        varchar("door_id", { length: 64 }).notNull(),         // "entree", "armurerie"
  type:          varchar("type", { length: 32 }).notNull(),            // "metal", "vault", ...
  anim:          varchar("anim", { length: 32 }).notNull(),            // "hinged", "sliding", ...
  openMs:        integer("open_ms").default(600),
  lockMode:      varchar("lock_mode", { length: 32 }).notNull(),       // "key", "code", "badge", ...

  // Permissions
  faction:       varchar("faction", { length: 64 }),
  job:           varchar("job", { length: 64 }),
  minRank:       integer("min_rank").default(0),
  minLevel:      integer("min_level").default(0),

  // Flags
  isPublic:      boolean("is_public").default(false),
  isStaff:       boolean("is_staff").default(false),
  isResidents:   boolean("is_residents").default(false),
  alarmEnabled:  boolean("alarm_enabled").default(false),
  alarmLevel:    integer("alarm_level").default(2),
  entryFee:      integer("entry_fee"),
  occupancy:     integer("occupancy"),

  // État dynamique (dénormalisé pour perf)
  isOpen:        boolean("is_open").default(false),
  isLocked:      boolean("is_locked").default(true),
  broken:        boolean("broken").default(false),
  hp:            integer("hp").default(100),
  maxHp:         integer("max_hp").default(100),
  alarmActive:   boolean("alarm_active").default(false),

  // Codes (chiffré côté app)
  codeHash:      varchar("code_hash", { length: 256 }),

  // Meta
  position:      jsonb("position").default({ x:0, y:0, z:0 }),
  meta:          jsonb("meta").default({}),

  createdAt:     timestamp("created_at").defaultNow(),
  updatedAt:     timestamp("updated_at").defaultNow(),
});

export const doorKeys = pgTable("door_keys", {
  id:        uuid("id").primaryKey().defaultRandom(),
  doorUid:   varchar("door_uid", { length: 128 }).notNull(),
  playerId:  uuid("player_id").notNull(),
  grantedAt: timestamp("granted_at").defaultNow(),
  grantedBy: uuid("granted_by"),
  expiresAt: timestamp("expires_at"),
});

export const doorLogs = pgTable("door_logs", {
  id:        uuid("id").primaryKey().defaultRandom(),
  doorUid:   varchar("door_uid", { length: 128 }).notNull(),
  playerId:  uuid("player_id"),
  action:    varchar("action", { length: 32 }).notNull(),   // open | close | lock | pick | breach | knock | buzz
  success:   boolean("success").notNull(),
  reason:    text("reason"),
  meta:      jsonb("meta").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

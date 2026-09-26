/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DATABASE/SCHEMA-EXTENSIONS.JS
 * Extensions : buildings, doors, apartments, keys, logs, staff
 * ═══════════════════════════════════════════════════════════════════
 * À importer depuis schema.js — évite de tout casser.
 *
 * Chemin : database/schema-extensions.js
 */

import {
  pgTable, text, smallint, integer, real, boolean,
  timestamp, jsonb, uuid, varchar, index, primaryKey, unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { players } from "./schema.js";

// ─── BÂTIMENTS ───────────────────────────────────────────────────────────────
export const buildings = pgTable("buildings", {
  id:         uuid("id").primaryKey().defaultRandom(),
  code:       varchar("code", { length: 64 }).notNull().unique(),
  name:       varchar("name", { length: 128 }).notNull(),
  icon:       varchar("icon", { length: 16 }),
  type:       varchar("type", { length: 32 }).notNull(),
  zoneKey:    varchar("zone_key", { length: 64 }),
  ownerId:    text("owner_id").references(() => players.id, { onDelete: "set null" }),
  factionId:  varchar("faction_id", { length: 64 }),
  hoursOpen:  smallint("hours_open").default(0).notNull(),
  hoursClose: smallint("hours_close").default(24).notNull(),
  buyable:    boolean("buyable").default(false).notNull(),
  price:      integer("price").default(0).notNull(),
  robbable:   boolean("robbable").default(false).notNull(),
  meta:       jsonb("meta").default(sql`'{}'::jsonb`).notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  zoneIdx:  index("buildings_zone_idx").on(t.zoneKey),
  typeIdx:  index("buildings_type_idx").on(t.type),
  codeIdx:  index("buildings_code_idx").on(t.code),
}));

export const buildingStaff = pgTable("building_staff", {
  id:         uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id").notNull(),
  playerId:   text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  role:       varchar("role", { length: 32 }).default("employee").notNull(),
  hiredAt:    timestamp("hired_at").defaultNow().notNull(),
  hiredBy:    text("hired_by").references(() => players.id, { onDelete: "set null" }),
}, (t) => ({
  uniqBuildingPlayer: unique("uniq_staff_building_player").on(t.buildingId, t.playerId),
  buildingIdx:        index("staff_building_idx").on(t.buildingId),
}));

// ─── PORTES ──────────────────────────────────────────────────────────────────
export const doors = pgTable("doors", {
  id:            uuid("id").primaryKey().defaultRandom(),
  uid:           varchar("uid", { length: 128 }).notNull().unique(),
  buildingId:    uuid("building_id").notNull(),
  doorId:        varchar("door_id", { length: 64 }).notNull(),
  type:          varchar("type", { length: 32 }).notNull(),
  anim:          varchar("anim", { length: 32 }).notNull(),
  openMs:        integer("open_ms").default(600).notNull(),
  lockMode:      varchar("lock_mode", { length: 32 }).notNull(),

  faction:       varchar("faction", { length: 64 }),
  job:           varchar("job", { length: 64 }),
  minRank:       smallint("min_rank").default(0).notNull(),
  minLevel:      smallint("min_level").default(0).notNull(),

  isPublic:      boolean("is_public").default(false).notNull(),
  isStaff:       boolean("is_staff").default(false).notNull(),
  isResidents:   boolean("is_residents").default(false).notNull(),
  alarmEnabled:  boolean("alarm_enabled").default(false).notNull(),
  alarmLevel:    smallint("alarm_level").default(2).notNull(),
  entryFee:      integer("entry_fee"),
  occupancy:     smallint("occupancy"),

  isOpen:        boolean("is_open").default(false).notNull(),
  isLocked:      boolean("is_locked").default(true).notNull(),
  broken:        boolean("broken").default(false).notNull(),
  hp:            integer("hp").default(100).notNull(),
  maxHp:         integer("max_hp").default(100).notNull(),
  alarmActive:   boolean("alarm_active").default(false).notNull(),

  codeHash:      varchar("code_hash", { length: 256 }),
  position:      jsonb("position").default(sql`'{"x":0,"y":0,"z":0}'::jsonb`).notNull(),
  meta:          jsonb("meta").default(sql`'{}'::jsonb`).notNull(),

  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  buildingIdx: index("doors_building_idx").on(t.buildingId),
  lockIdx:     index("doors_lock_idx").on(t.lockMode),
  uidIdx:      index("doors_uid_idx").on(t.uid),
  alarmIdx:    index("doors_alarm_idx").on(t.alarmActive).where(sql`${t.alarmActive} = true`),
}));

export const doorKeys = pgTable("door_keys", {
  id:        uuid("id").primaryKey().defaultRandom(),
  doorUid:   varchar("door_uid", { length: 128 }).notNull(),
  playerId:  text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  grantedBy: text("granted_by").references(() => players.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at"),
}, (t) => ({
  uniqDoorPlayer: unique("uniq_door_key").on(t.doorUid, t.playerId),
  playerIdx:      index("door_keys_player_idx").on(t.playerId),
}));

export const doorLogs = pgTable("door_logs", {
  id:        uuid("id").primaryKey().defaultRandom(),
  doorUid:   varchar("door_uid", { length: 128 }).notNull(),
  playerId:  text("player_id").references(() => players.id, { onDelete: "set null" }),
  action:    varchar("action", { length: 32 }).notNull(),
  success:   boolean("success").notNull(),
  reason:    text("reason"),
  meta:      jsonb("meta").default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  doorIdx:   index("door_logs_door_idx").on(t.doorUid, t.createdAt.desc()),
  playerIdx: index("door_logs_player_idx").on(t.playerId),
}));

// ─── APPARTEMENTS ────────────────────────────────────────────────────────────
export const apartments = pgTable("apartments", {
  id:         uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id").notNull(),
  aptId:      varchar("apt_id", { length: 32 }).notNull(),
  label:      varchar("label", { length: 128 }).notNull(),
  floor:      smallint("floor").notNull(),
  aptIndex:   smallint("apt_index").notNull(),

  ownerId:    text("owner_id").references(() => players.id, { onDelete: "set null" }),
  tenantId:   text("tenant_id").references(() => players.id, { onDelete: "set null" }),
  rent:       integer("rent").default(0).notNull(),
  deposit:    integer("deposit").default(0).notNull(),
  occupied:   boolean("occupied").default(false).notNull(),
  forRent:    boolean("for_rent").default(true).notNull(),
  forSale:    boolean("for_sale").default(false).notNull(),
  salePrice:  integer("sale_price"),

  condition:  varchar("condition", { length: 32 }).default("bon").notNull(),
  locked:     boolean("locked").default(true).notNull(),
  lightOn:    boolean("light_on").default(false).notNull(),

  furniture:  jsonb("furniture").default(sql`'[]'::jsonb`).notNull(),
  meta:       jsonb("meta").default(sql`'{}'::jsonb`).notNull(),

  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqBuildingApt: unique("uniq_building_apt").on(t.buildingId, t.aptId),
  ownerIdx:        index("apartments_owner_idx").on(t.ownerId).where(sql`${t.ownerId} IS NOT NULL`),
  tenantIdx:       index("apartments_tenant_idx").on(t.tenantId).where(sql`${t.tenantId} IS NOT NULL`),
  forRentIdx:      index("apartments_for_rent_idx").on(t.forRent).where(sql`${t.forRent} = true AND ${t.occupied} = false`),
}));

export const apartmentPayments = pgTable("apartment_payments", {
  id:         uuid("id").primaryKey().defaultRandom(),
  aptId:      uuid("apt_id").notNull(),
  tenantId:   text("tenant_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  amount:     integer("amount").notNull(),
  missed:     smallint("missed").default(0).notNull(),
  paidAt:     timestamp("paid_at").defaultNow().notNull(),
  period:     varchar("period", { length: 16 }).notNull(),
}, (t) => ({
  aptIdx:    index("apt_payments_apt_idx").on(t.aptId),
  tenantIdx: index("apt_payments_tenant_idx").on(t.tenantId, t.period),
}));

// ─── EXPORT GROUPÉ ───────────────────────────────────────────────────────────
export const extensionTables = {
  buildings, buildingStaff,
  doors, doorKeys, doorLogs,
  apartments, apartmentPayments,
};

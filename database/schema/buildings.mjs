/**
 * Drizzle schema — Buildings
 * Path: database/drizzle/schema/buildings.mjs
 */
import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const buildings = pgTable("buildings", {
  id:           uuid("id").primaryKey().defaultRandom(),
  code:         varchar("code", { length: 64 }).notNull().unique(),    // ex: "commissariat", "epicerie_24_7"
  name:         varchar("name", { length: 128 }).notNull(),
  icon:         varchar("icon", { length: 16 }),
  type:         varchar("type", { length: 32 }).notNull(),              // public_service | shop | bank | business | illegal | residential
  zoneId:       varchar("zone_id", { length: 64 }),                     // ex: "centre_ville"
  ownerId:      uuid("owner_id"),                                       // null = pas possédé par un joueur
  factionId:    varchar("faction_id", { length: 64 }),                  // ex: "police", "mafia"
  hoursOpen:    integer("hours_open").default(0),
  hoursClose:   integer("hours_close").default(24),
  buyable:      boolean("buyable").default(false),
  price:        integer("price").default(0),
  robbable:     boolean("robbable").default(false),
  meta:         jsonb("meta").default({}),
  createdAt:    timestamp("created_at").defaultNow(),
  updatedAt:    timestamp("updated_at").defaultNow(),
});

export const buildingStaff = pgTable("building_staff", {
  id:           uuid("id").primaryKey().defaultRandom(),
  buildingId:   uuid("building_id").notNull(),
  playerId:     uuid("player_id").notNull(),
  role:         varchar("role", { length: 32 }).default("employee"),   // employee | manager | owner
  hiredAt:      timestamp("hired_at").defaultNow(),
  hiredBy:      uuid("hired_by"),
});

/**
 * Drizzle schema — Properties (appartements, maisons, entrepôts)
 * Path: database/drizzle/schema/properties.mjs
 */
import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const properties = pgTable("properties", {
  id:         uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id").notNull(),
  aptId:      varchar("apt_id", { length: 32 }).notNull(),    // "3-2" (étage-index)
  label:      varchar("label", { length: 128 }).notNull(),
  floor:      integer("floor").notNull(),
  aptIndex:   integer("apt_index").notNull(),

  ownerId:    uuid("owner_id"),
  tenantId:   uuid("tenant_id"),
  rent:       integer("rent").default(0),
  deposit:    integer("deposit").default(0),
  occupied:   boolean("occupied").default(false),
  forRent:    boolean("for_rent").default(true),
  forSale:    boolean("for_sale").default(false),
  salePrice:  integer("sale_price"),

  condition:  varchar("condition", { length: 32 }).default("bon"),
  locked:     boolean("locked").default(true),
  lightOn:    boolean("light_on").default(false),

  furniture:  jsonb("furniture").default([]),
  meta:       jsonb("meta").default({}),

  createdAt:  timestamp("created_at").defaultNow(),
  updatedAt:  timestamp("updated_at").defaultNow(),
});

export const propertyPayments = pgTable("property_payments", {
  id:         uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull(),
  tenantId:   uuid("tenant_id").notNull(),
  amount:     integer("amount").notNull(),
  missed:     integer("missed").default(0),
  paidAt:     timestamp("paid_at").defaultNow(),
  period:     varchar("period", { length: 16 }).notNull(),   // "2026-09"
});

import {
  pgTable, text, integer, timestamp, boolean, bigint, real,
  uniqueIndex, index, jsonb, varchar, check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// GANGS
// ═══════════════════════════════════════════════════════════════════════════
export const dbGangs = pgTable("gangs", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  tag:         varchar("tag", { length: 8 }).notNull(),
  colorHex:    varchar("color_hex", { length: 7 }).default("#ffffff").notNull(),

  founderId:   text("founder_id").notNull(),
  leaderId:    text("leader_id").notNull(),

  bankBalance: bigint("bank_balance", { mode: "number" }).default(0).notNull(),
  reputation:  integer("reputation").default(100).notNull(),

  status:      varchar("status", { length: 16 }).default("active").notNull(),
  motto:       text("motto"),
  description: text("description"),
  headquarters: jsonb("headquarters"),

  alliedGangIds: jsonb("allied_gang_ids").default([]).notNull(),
  enemyGangIds:  jsonb("enemy_gang_ids").default([]).notNull(),

  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
  disbandedAt: timestamp("disbanded_at"),
}, (t) => ({
  tagUnique:     uniqueIndex("gangs_tag_unique").on(t.tag),
  statusIdx:     index("gangs_status_idx").on(t.status),
  colorHexCheck: check("gangs_color_hex_check",
                  sql`${t.colorHex} ~ '^#[0-9a-fA-F]{6}$'`),
  reputationCheck: check("gangs_reputation_check",
                  sql`${t.reputation} >= 0 AND ${t.reputation} <= 10000`),
  bankCheck:     check("gangs_bank_check", sql`${t.bankBalance} >= 0`),
}));

// ═══════════════════════════════════════════════════════════════════════════
// MEMBERS
// ═══════════════════════════════════════════════════════════════════════════
export const dbGangMembers = pgTable("gang_members", {
  id:                 text("id").primaryKey(),
  gangId:             text("gang_id").notNull()
                        .references(() => dbGangs.id, { onDelete: "cascade" }),
  playerId:           text("player_id").notNull(),
  playerName:         text("player_name").notNull(),

  rank:               varchar("rank", { length: 16 }).default("recruit").notNull(),
  contributedFunds:   bigint("contributed_funds", { mode: "number" }).default(0).notNull(),
  contributionsCount: integer("contributions_count").default(0).notNull(),

  invitedByPlayerId:  text("invited_by_player_id"),
  promotedByPlayerId: text("promoted_by_player_id"),
  joinedAt:           timestamp("joined_at").defaultNow().notNull(),
  lastActiveAt:       timestamp("last_active_at").defaultNow().notNull(),

  leftAt:             timestamp("left_at"),
  leftReason:         varchar("left_reason", { length: 32 }),
  isActive:           boolean("is_active").default(true).notNull(),
}, (t) => ({
  playerActiveUnique: uniqueIndex("gang_members_player_active_unique")
                        .on(t.playerId)
                        .where(sql`${t.isActive} = true`),
  gangPlayerUnique:   uniqueIndex("gang_members_gang_player_unique")
                        .on(t.gangId, t.playerId),
  gangIdx:            index("gang_members_gang_idx").on(t.gangId),
  playerIdx:          index("gang_members_player_idx").on(t.playerId),
  activeIdx:          index("gang_members_active_idx").on(t.isActive),
  rankCheck:          check("gang_members_rank_check",
                        sql`${t.rank} IN ('leader','lieutenant','enforcer','member','recruit')`),
  fundsCheck:         check("gang_members_funds_check", sql`${t.contributedFunds} >= 0`),
}));

// ═══════════════════════════════════════════════════════════════════════════
// TERRITORIES
// ═══════════════════════════════════════════════════════════════════════════
export const dbGangTerritories = pgTable("gang_territories", {
  id:                 text("id").primaryKey(),
  name:               text("name").notNull(),
  district:           varchar("district", { length: 64 }),

  controllingGangId:  text("controlling_gang_id")
                        .references(() => dbGangs.id, { onDelete: "set null" }),
  influencePercent:   integer("influence_percent").default(0).notNull(),

  polygon:            jsonb("polygon"),
  centerPoint:        jsonb("center_point"),

  revenuePerCycle:    integer("revenue_per_cycle").default(100).notNull(),
  resourceType:       varchar("resource_type", { length: 24 }).default("generic").notNull(),
  resourceMultiplier: real("resource_multiplier").default(1.0).notNull(),

  heat:               integer("heat").default(0).notNull(),
  lastRaidAt:         timestamp("last_raid_at"),

  contested:          boolean("contested").default(false).notNull(),
  lastContestedAt:    timestamp("last_contested_at"),
  contestedByGangId:  text("contested_by_gang_id")
                        .references(() => dbGangs.id, { onDelete: "set null" }),

  primaryColor:       varchar("primary_color", { length: 7 }).default("#888888").notNull(),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  controllingIdx:  index("turf_controlling_idx").on(t.controllingGangId),
  districtIdx:     index("turf_district_idx").on(t.district),
  contestedIdx:    index("turf_contested_idx").on(t.contested),
  heatIdx:         index("turf_heat_idx").on(t.heat),
  resourceIdx:     index("turf_resource_idx").on(t.resourceType),
  influenceCheck:  check("turf_influence_check",
                    sql`${t.influencePercent} >= 0 AND ${t.influencePercent} <= 100`),
  heatCheck:       check("turf_heat_check",
                    sql`${t.heat} >= 0 AND ${t.heat} <= 100`),
  revenueCheck:    check("turf_revenue_check", sql`${t.revenuePerCycle} >= 0`),
}));

// ═══════════════════════════════════════════════════════════════════════════
// FUND TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════
export const dbGangFundTransactions = pgTable("gang_fund_transactions", {
  id:           text("id").primaryKey(),
  gangId:       text("gang_id").notNull()
                  .references(() => dbGangs.id, { onDelete: "cascade" }),
  playerId:     text("player_id"),
  amount:       bigint("amount", { mode: "number" }).notNull(),
  reason:       varchar("reason", { length: 64 }).notNull(),
  balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
  metadata:     jsonb("metadata"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  gangIdx:     index("gang_fund_gang_idx").on(t.gangId),
  playerIdx:   index("gang_fund_player_idx").on(t.playerId),
  createdIdx:  index("gang_fund_created_idx").on(t.createdAt),
}));

// ═══════════════════════════════════════════════════════════════════════════
// WARS
// ═══════════════════════════════════════════════════════════════════════════
export const dbGangWars = pgTable("gang_wars", {
  id:              text("id").primaryKey(),
  attackerGangId:  text("attacker_gang_id").notNull()
                     .references(() => dbGangs.id, { onDelete: "cascade" }),
  defenderGangId:  text("defender_gang_id").notNull()
                     .references(() => dbGangs.id, { onDelete: "cascade" }),
  territoryId:     text("territory_id")
                     .references(() => dbGangTerritories.id, { onDelete: "set null" }),

  status:          varchar("status", { length: 16 }).default("active").notNull(),
  attackerKills:   integer("attacker_kills").default(0).notNull(),
  defenderKills:   integer("defender_kills").default(0).notNull(),

  startedAt:       timestamp("started_at").defaultNow().notNull(),
  endedAt:         timestamp("ended_at"),
  winnerGangId:    text("winner_gang_id")
                     .references(() => dbGangs.id, { onDelete: "set null" }),
}, (t) => ({
  attackerIdx:  index("gang_wars_attacker_idx").on(t.attackerGangId),
  defenderIdx:  index("gang_wars_defender_idx").on(t.defenderGangId),
  statusIdx:    index("gang_wars_status_idx").on(t.status),
}));

// ═══════════════════════════════════════════════════════════════════════════
// REVENUE CYCLES
// ═══════════════════════════════════════════════════════════════════════════
export const dbGangRevenueCycles = pgTable("gang_revenue_cycles", {
  id:           text("id").primaryKey(),
  gangId:       text("gang_id").notNull()
                  .references(() => dbGangs.id, { onDelete: "cascade" }),
  cycleNumber:  integer("cycle_number").notNull(),
  grossIncome:  bigint("gross_income", { mode: "number" }).notNull(),
  cutAmount:    bigint("cut_amount",   { mode: "number" }).default(0).notNull(),
  netIncome:    bigint("net_income",   { mode: "number" }).notNull(),
  territoryIds: jsonb("territory_ids").default([]).notNull(),
  appliedAt:    timestamp("applied_at").defaultNow().notNull(),
}, (t) => ({
  gangCycleUnique: uniqueIndex("gang_revenue_gang_cycle_unique").on(t.gangId, t.cycleNumber),
  gangIdx:         index("gang_revenue_gang_idx").on(t.gangId),
}));
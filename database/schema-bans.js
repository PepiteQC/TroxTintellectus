import {
  pgTable, text, timestamp, boolean, integer, jsonb, varchar,
  uniqueIndex, index, check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// BANS
// ═══════════════════════════════════════════════════════════════════════════
export const dbBans = pgTable("bans", {
  id:          text("id").primaryKey(),
  playerId:    text("player_id").notNull(),
  playerName:  text("player_name").notNull(),
  ipAddress:   varchar("ip_address", { length: 45 }),
  hardwareId:  varchar("hardware_id", { length: 128 }),

  reason:      text("reason").notNull(),
  severity:    varchar("severity", { length: 16 }).default("standard").notNull(),
  banType:     varchar("ban_type", { length: 16 }).default("temporary").notNull(),
  bannedBy:    varchar("banned_by", { length: 96 })
                 .default("ThirdEye Anti-Cheat").notNull(),
  isAutomatic: boolean("is_automatic").default(false).notNull(),
  batchId:     text("batch_id"),

  serverScope: varchar("server_scope", { length: 32 }).default("all").notNull(),
  regionScope: varchar("region_scope", { length: 32 }),

  evidence:    jsonb("evidence"),
  notes:       text("notes"),
  publicNote:  text("public_note"),

  active:      boolean("active").default(true).notNull(),
  bannedAt:    timestamp("banned_at").defaultNow().notNull(),
  expiresAt:   timestamp("expires_at"),

  unbannedBy:     varchar("unbanned_by", { length: 96 }),
  unbannedAt:     timestamp("unbanned_at"),
  unbanReason:    text("unban_reason"),
  wasAppealed:    boolean("was_appealed").default(false).notNull(),

  priorBanCount:  integer("prior_ban_count").default(0).notNull(),
  relatedAccountIds: jsonb("related_account_ids").default([]).notNull(),

  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  playerActiveUnique: uniqueIndex("bans_player_active_unique")
                        .on(t.playerId)
                        .where(sql`${t.active} = true`),
  hwidActiveUnique:   uniqueIndex("bans_hwid_active_unique")
                        .on(t.hardwareId)
                        .where(sql`${t.active} = true AND ${t.hardwareId} IS NOT NULL`),
  ipActiveUnique:     uniqueIndex("bans_ip_active_unique")
                        .on(t.ipAddress)
                        .where(sql`${t.active} = true AND ${t.ipAddress} IS NOT NULL`),
  playerIdx:    index("bans_player_idx").on(t.playerId),
  hwidIdx:      index("bans_hwid_idx").on(t.hardwareId),
  ipIdx:        index("bans_ip_idx").on(t.ipAddress),
  activeIdx:    index("bans_active_idx").on(t.active),
  expiresIdx:   index("bans_expires_idx").on(t.expiresAt),
  typeIdx:      index("bans_type_idx").on(t.banType),
  severityIdx:  index("bans_severity_idx").on(t.severity),
  batchIdx:     index("bans_batch_idx").on(t.batchId),
  severityCheck: check("bans_severity_check",
    sql`${t.severity} IN ('soft','standard','hard','nuke')`),
  typeCheck:     check("bans_type_check",
    sql`${t.banType} IN ('temporary','permanent','shadow','hwid')`),
  scopeCheck:    check("bans_scope_check",
    sql`${t.serverScope} IN ('all','rp','doors','creative')`),
  ipFormatCheck: check("bans_ip_format_check",
    sql`${t.ipAddress} IS NULL OR ${t.ipAddress} ~ '^[0-9a-fA-F:.]+$'`),
  expiryCheck:   check("bans_expiry_check",
    sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.bannedAt}`),
}));

// ═══════════════════════════════════════════════════════════════════════════
// BAN HISTORY
// ═══════════════════════════════════════════════════════════════════════════
export const dbBanHistory = pgTable("ban_history", {
  id:        text("id").primaryKey(),
  banId:     text("ban_id").notNull()
               .references(() => dbBans.id, { onDelete: "cascade" }),
  action:    varchar("action", { length: 24 }).notNull(),
  actor:     varchar("actor", { length: 96 }),
  actorType: varchar("actor_type", { length: 16 }).default("admin").notNull(),
  changes:   jsonb("changes"),
  reason:    text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  banIdx:    index("ban_history_ban_idx").on(t.banId),
  actionIdx: index("ban_history_action_idx").on(t.action),
  dateIdx:   index("ban_history_date_idx").on(t.createdAt),
}));

// ═══════════════════════════════════════════════════════════════════════════
// BAN APPEALS
// ═══════════════════════════════════════════════════════════════════════════
export const dbBanAppeals = pgTable("ban_appeals", {
  id:         text("id").primaryKey(),
  banId:      text("ban_id").notNull()
                .references(() => dbBans.id, { onDelete: "cascade" }),
  playerId:   text("player_id").notNull(),
  message:    text("message").notNull(),

  status:     varchar("status", { length: 16 }).default("pending").notNull(),
  reviewedBy: varchar("reviewed_by", { length: 96 }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),

  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  oneAppealPerBan: uniqueIndex("ban_appeals_ban_unique").on(t.banId),
  statusIdx:       index("ban_appeals_status_idx").on(t.status),
  playerIdx:       index("ban_appeals_player_idx").on(t.playerId),
  statusCheck:     check("ban_appeals_status_check",
    sql`${t.status} IN ('pending','under_review','granted','denied')`),
}));

// ═══════════════════════════════════════════════════════════════════════════
// HWID LINKS
// ═══════════════════════════════════════════════════════════════════════════
export const dbHwidLinks = pgTable("hwid_links", {
  id:         text("id").primaryKey(),
  hardwareId: varchar("hardware_id", { length: 128 }).notNull(),
  playerId:   text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  ipAddress:  varchar("ip_address", { length: 45 }),

  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt:  timestamp("last_seen_at").defaultNow().notNull(),
  seenCount:   integer("seen_count").default(1).notNull(),

  isFlagged:   boolean("is_flagged").default(false).notNull(),
  flaggedReason: varchar("flagged_reason", { length: 64 }),
}, (t) => ({
  hwidPlayerUnique: uniqueIndex("hwid_links_hwid_player_unique")
                      .on(t.hardwareId, t.playerId),
  hwidIdx:   index("hwid_links_hwid_idx").on(t.hardwareId),
  playerIdx: index("hwid_links_player_idx").on(t.playerId),
  flagIdx:   index("hwid_links_flag_idx").on(t.isFlagged),
}));

// ═══════════════════════════════════════════════════════════════════════════
// BAN WAVES
// ═══════════════════════════════════════════════════════════════════════════
export const dbBanWaves = pgTable("ban_waves", {
  id:            text("id").primaryKey(),
  label:         varchar("label", { length: 96 }).notNull(),
  source:        varchar("source", { length: 32 }).default("manual").notNull(),
  triggerReason: text("trigger_reason"),
  affectedCount: integer("affected_count").default(0).notNull(),
  detectedAt:    timestamp("detected_at").defaultNow().notNull(),
  appliedAt:     timestamp("applied_at"),
  appliedBy:     varchar("applied_by", { length: 96 }),
}, (t) => ({
  sourceIdx:   index("ban_waves_source_idx").on(t.source),
  appliedIdx:  index("ban_waves_applied_idx").on(t.appliedAt),
}));
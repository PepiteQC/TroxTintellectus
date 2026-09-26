import {
  pgTable, text, integer, boolean, timestamp, varchar, real, jsonb,
  uniqueIndex, index, check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// FACTION OFFICERS
// ═══════════════════════════════════════════════════════════════════════════
export const dbFactionOfficers = pgTable("faction_officers", {
  badgeNumber: varchar("badge_number", { length: 24 }).primaryKey(),
  playerId:    text("player_id").notNull(),
  playerName:  text("player_name").notNull(),

  factionId:   varchar("faction_id", { length: 32 }).notNull(),
  factionType: varchar("faction_type", { length: 16 }).notNull(),

  grade:       integer("grade").default(0).notNull(),
  rankTitle:   varchar("rank_title", { length: 48 }).notNull(),
  department:  varchar("department", { length: 32 }),

  onDuty:      boolean("on_duty").default(false).notNull(),
  active:      boolean("active").default(true).notNull(),
  suspended:   boolean("suspended").default(false).notNull(),
  suspensionReason: text("suspension_reason"),
  suspendedUntil:   timestamp("suspended_until"),

  arrestsCount:              integer("arrests_count").default(0).notNull(),
  citationsCount:            integer("citations_count").default(0).notNull(),
  medicalInterventionsCount: integer("medical_interventions_count").default(0).notNull(),
  fireInterventionsCount:    integer("fire_interventions_count").default(0).notNull(),
  autopsiesCount:            integer("autopsies_count").default(0).notNull(),

  performanceScore: real("performance_score").default(0).notNull(),
  internalNotes:    text("internal_notes"),

  radioCallsign: varchar("radio_callsign", { length: 24 }),
  supervisorId:  varchar("supervisor_id", { length: 24 }),

  metadata:    jsonb("metadata"),
  recruitedAt: timestamp("recruited_at").defaultNow().notNull(),
  promotedAt:  timestamp("promoted_at"),
  leftAt:      timestamp("left_at"),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  playerUnique:       uniqueIndex("faction_officers_player_unique").on(t.playerId),
  factionBadgeUnique: uniqueIndex("faction_officers_faction_badge_unique")
                        .on(t.factionId, t.badgeNumber),
  factionIdx:    index("faction_officers_faction_idx").on(t.factionId),
  typeIdx:       index("faction_officers_type_idx").on(t.factionType),
  onDutyIdx:     index("faction_officers_on_duty_idx").on(t.onDuty),
  activeIdx:     index("faction_officers_active_idx").on(t.active),
  suspendedIdx:  index("faction_officers_suspended_idx").on(t.suspended),
  typeCheck:    check("faction_officers_type_check",
    sql`${t.factionType} IN ('police','ems','fire','coroner')`),
  gradeCheck:   check("faction_officers_grade_check",
    sql`${t.grade} >= 0 AND ${t.grade} <= 10`),
  perfCheck:    check("faction_officers_perf_check",
    sql`${t.performanceScore} >= -10 AND ${t.performanceScore} <= 10`),
  arrestCheck:  check("faction_officers_arrest_check", sql`${t.arrestsCount} >= 0`),
}));

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCH CALLS
// ═══════════════════════════════════════════════════════════════════════════
export const dbDispatchCalls = pgTable("dispatch_calls", {
  id:           text("id").primaryKey(),

  callerName:   text("caller_name").notNull(),
  callerPhone:  varchar("caller_phone", { length: 20 }),
  callerPlayerId: text("caller_player_id"),
  isAnonymous:  boolean("is_anonymous").default(false).notNull(),

  code:         varchar("code", { length: 8 }).notNull(),
  category:     varchar("category", { length: 16 }).notNull(),
  priority:     varchar("priority", { length: 16 }).default("code_2_urgent").notNull(),
  description:  text("description").notNull(),

  posX:         real("pos_x").notNull(),
  posY:         real("pos_y").notNull(),
  posZ:         real("pos_z").notNull(),
  zoneName:     varchar("zone_name", { length: 64 }),
  district:     varchar("district", { length: 64 }),

  status:       varchar("status", { length: 16 }).default("pending").notNull(),
  active:       boolean("active").default(true).notNull(),

  assignedBadges:    jsonb("assigned_badges").default([]).notNull(),
  respondingCount:   integer("responding_count").default(0).notNull(),
  respondingEtaSec:  integer("responding_eta_sec"),
  firstResponderId:  varchar("first_responder_id", { length: 24 }),

  resolutionNotes: text("resolution_notes"),
  resolvedByBadge: varchar("resolved_by_badge", { length: 24 }),
  resolvedAt:      timestamp("resolved_at"),
  durationSec:     integer("duration_sec"),
  wasFalseAlarm:   boolean("was_false_alarm").default(false).notNull(),

  escalationLevel: integer("escalation_level").default(0).notNull(),
  relatedCallIds:  jsonb("related_call_ids").default([]).notNull(),

  evidence:    jsonb("evidence"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  statusIdx:     index("dispatch_calls_status_idx").on(t.status),
  categoryIdx:   index("dispatch_calls_category_idx").on(t.category),
  priorityIdx:   index("dispatch_calls_priority_idx").on(t.priority),
  activeIdx:     index("dispatch_calls_active_idx").on(t.active),
  createdIdx:    index("dispatch_calls_created_idx").on(t.createdAt),
  callerIdx:     index("dispatch_calls_caller_idx").on(t.callerPlayerId),
  phoneIdx:      index("dispatch_calls_phone_idx").on(t.callerPhone),
  resolvedIdx:   index("dispatch_calls_resolved_idx").on(t.resolvedAt),
  categoryCheck: check("dispatch_calls_category_check",
    sql`${t.category} IN ('police','ems','fire','coroner')`),
  priorityCheck: check("dispatch_calls_priority_check",
    sql`${t.priority} IN ('code_1_normal','code_2_urgent','code_3_critique')`),
  statusCheck:   check("dispatch_calls_status_check",
    sql`${t.status} IN ('pending','assigned','responding','on_scene','resolved','cancelled')`),
  etaCheck:      check("dispatch_calls_eta_check",
    sql`${t.respondingEtaSec} IS NULL OR ${t.respondingEtaSec} >= 0`),
  durationCheck: check("dispatch_calls_duration_check",
    sql`${t.durationSec} IS NULL OR ${t.durationSec} >= 0`),
}));

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCH UNITS
// ═══════════════════════════════════════════════════════════════════════════
export const dbDispatchUnits = pgTable("dispatch_units", {
  id:         text("id").primaryKey(),
  callId:     text("call_id").notNull()
                .references(() => dbDispatchCalls.id, { onDelete: "cascade" }),
  badgeNumber: varchar("badge_number", { length: 24 }).notNull(),
  unitName:   varchar("unit_name", { length: 64 }).notNull(),

  status:     varchar("status", { length: 16 }).default("assigned").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  arrivedAt:  timestamp("arrived_at"),
  clearedAt:  timestamp("cleared_at"),
  notes:      text("notes"),
}, (t) => ({
  callBadgeUnique: uniqueIndex("dispatch_units_call_badge_unique")
                     .on(t.callId, t.badgeNumber),
  callIdx:   index("dispatch_units_call_idx").on(t.callId),
  badgeIdx:  index("dispatch_units_badge_idx").on(t.badgeNumber),
  statusIdx: index("dispatch_units_status_idx").on(t.status),
  statusCheck: check("dispatch_units_status_check",
    sql`${t.status} IN ('assigned','en_route','on_scene','cleared')`),
}));
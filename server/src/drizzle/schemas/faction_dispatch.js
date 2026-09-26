/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DRIZZLE/SCHEMAS/FACTION_DISPATCH.JS
 * Schémas Drizzle ORM · Officiers des services publics & Appels 911
 * ═══════════════════════════════════════════════════════════════════
 * Tables :
 *   • faction_officers : Registre de service (SQ, SAMU, Pompiers, Coroner)
 *   • dispatch_calls   : Centrale 911 & Répartition des urgences
 *
 * Signature : TROXT⬡
 * Chemin    : server/src/drizzle/schemas/faction_dispatch.js
 */

import {
  pgTable, text, integer, boolean, timestamp, real,
  index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { players } from './players.js';

const SIG = 'TROXT⬡';

// ─── CONSTANTES & LISTES DE VALIDATION ───────────────────────────────────────
export const FACTION_TYPES = Object.freeze([
  'police',   // Sûreté du Québec (SQ / SPVM)
  'ems',      // SAMU / Ambulanciers
  'fire',     // Pompiers / SOPFEU
  'coroner',  // Bureau du Coroner
  'mffp',     // Protection de la Faune / Gardes-chasse
  'justice',  // Magistrats & Juges
]);

export const DISPATCH_CATEGORIES = Object.freeze([
  'police',
  'ems',
  'fire',
  'mffp',
  'tous',
]);

export const DISPATCH_STATUSES = Object.freeze([
  'pending',     // En attente
  'responding',  // Unités en route
  'on_scene',    // Sur les lieux
  'resolved',    // Clôturé avec succès
  'cancelled',   // Fausse alerte / Annulé
]);

export const DISPATCH_PRIORITIES = Object.freeze([
  'low',
  'medium',
  'high',
  'critical',
]);

// ═══════════════════════════════════════════════════════════════════
// TABLE : OFFICIERS DE FACTION & SERVICES PUBLICS
// ═══════════════════════════════════════════════════════════════════

export const dbFactionOfficers = pgTable('faction_officers', {
  badgeNumber:               text('badge_number').primaryKey(),          // SQ-101, MED-204, POM-012
  playerId:                  text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  playerName:                text('player_name').notNull(),
  factionId:                 text('faction_id').notNull(),               // sq_portneuf, ems_portneuf, fire_portneuf
  factionType:               text('faction_type').notNull(),             // police | ems | fire | coroner | mffp | justice
  grade:                     integer('grade').default(0).notNull(),      // 0 = Cadet, 1 = Patrouilleur, ..., 5 = Chef
  rankTitle:                 text('rank_title').notNull(),               // "Cadet", "Agent Senior", "Lieutenant"
  
  // État de service
  onDuty:                    boolean('on_duty').default(false).notNull(),
  radioChannel:              integer('radio_channel'),                   // Fréquence radio active (ex: 101, 911)
  
  // Statistiques de carrière & Télémétrie RP
  arrestsCount:              integer('arrests_count').default(0).notNull(),
  ticketsIssuedCount:        integer('tickets_issued_count').default(0).notNull(),
  medicalInterventionsCount: integer('medical_interventions_count').default(0).notNull(),
  calloutsRespondedCount:    integer('callouts_responded_count').default(0).notNull(),
  
  recruitedAt:               timestamp('recruited_at', { withTimezone: true }).defaultNow().notNull(),
  lastDutyToggledAt:         timestamp('last_duty_toggled_at', { withTimezone: true }),
  updatedAt:                 timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  playerUniqueIdx: uniqueIndex('officers_player_id_idx').on(t.playerId),
  factionIdx:      index('officers_faction_id_idx').on(t.factionId),
  onDutyIdx:       index('officers_on_duty_idx').on(t.onDuty),
  factionTypeIdx:  index('officers_faction_type_idx').on(t.factionType),

  // Contraintes d'intégrité
  gradeCheck:      check('officers_grade_chk', sql`${t.grade} >= 0 AND ${t.grade} <= 10`),
  arrestsCheck:    check('officers_arrests_chk', sql`${t.arrestsCount} >= 0`),
  medCheck:        check('officers_med_chk', sql`${t.medicalInterventionsCount} >= 0`),
}));

// ═══════════════════════════════════════════════════════════════════
// TABLE : CENTRALE DES APPELS 911 & RÉPARTITION (DISPATCH)
// ═══════════════════════════════════════════════════════════════════

export const dbDispatchCalls = pgTable('dispatch_calls', {
  id:                    text('id').primaryKey(),                        // UUID ou call_123456
  callerId:              text('caller_id').references(() => players.id, { onDelete: 'set null' }),
  callerName:            text('caller_name').notNull(),
  callerPhone:           text('caller_phone'),
  
  // Détails de l'intervention
  code:                  text('code').notNull(),                         // 10-80 (Poursuite), 10-71 (Coups de feu), 10-50 (Accident)
  category:              text('category').notNull().default('police'),   // police | ems | fire | mffp | tous
  priority:              text('priority').notNull().default('medium'),   // low | medium | high | critical
  description:           text('description').notNull(),
  
  // Coordonnées 3D réelles (Point GPS sur la carte)
  posX:                  real('pos_x').notNull().default(0),
  posY:                  real('pos_y').notNull().default(0),
  posZ:                  real('pos_z').notNull().default(0),
  zoneName:              text('zone_name'),                              // "Autoroute 40 Ouest", "Place Centrale"
  
  // Gestion d'intervention
  status:                text('status').default('pending').notNull(),    // pending | responding | on_scene | resolved | cancelled
  assignedOfficerBadge:  text('assigned_officer_badge').references(() => dbFactionOfficers.badgeNumber, { onDelete: 'set null' }),
  notes:                 text('notes'),
  
  createdAt:             timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt:            timestamp('resolved_at', { withTimezone: true }),
}, (t) => ({
  statusIdx:    index('dispatch_status_idx').on(t.status),
  categoryIdx:  index('dispatch_category_idx').on(t.category),
  priorityIdx:  index('dispatch_priority_idx').on(t.priority),
  createdIdx:   index('dispatch_created_at_idx').on(t.createdAt),
  officerIdx:   index('dispatch_assigned_officer_idx').on(t.assignedOfficerBadge),

  // Contraintes de valeurs
  statusCheck:   check('dispatch_status_chk', sql`${t.status} IN ('pending', 'responding', 'on_scene', 'resolved', 'cancelled')`),
  priorityCheck: check('dispatch_priority_chk', sql`${t.priority} IN ('low', 'medium', 'high', 'critical')`),
}));

// ═══════════════════════════════════════════════════════════════════
// RELATIONS DRIZZLE ORM
// ═══════════════════════════════════════════════════════════════════

export const factionOfficersRelations = relations(dbFactionOfficers, ({ one, many }) => ({
  player: one(players, {
    fields:     [dbFactionOfficers.playerId],
    references: [players.id],
  }),
  assignedCalls: many(dbDispatchCalls),
}));

export const dispatchCallsRelations = relations(dbDispatchCalls, ({ one }) => ({
  caller: one(players, {
    fields:     [dbDispatchCalls.callerId],
    references: [players.id],
  }),
  assignedOfficer: one(dbFactionOfficers, {
    fields:     [dbDispatchCalls.assignedOfficerBadge],
    references: [dbFactionOfficers.badgeNumber],
  }),
}));
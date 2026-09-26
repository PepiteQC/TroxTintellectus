/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DRIZZLE/SCHEMAS/GANGS.JS
 * Schémas Drizzle ORM · Crime Organisé, Factions Illégales & Territoires
 * ═══════════════════════════════════════════════════════════════════
 * Tables :
 *   • gangs            : Organisations criminelles (Motards, Mafia, Cartels)
 *   • gang_members      : Membres, hiérarchie et contributions financières
 *   • gang_territories  : Contrôle de zones, revenus passifs et guerres de territoire
 *
 * Signature : TROXT⬡
 * Chemin    : server/src/drizzle/schemas/gangs.js
 */

import {
  pgTable, text, integer, timestamp, real,
  index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { players } from './players.js';

const SIG = 'TROXT⬡';

// ─── CONSTANTES & RANGS HIÉRARCHIQUES ────────────────────────────────────────
export const GANG_RANKS = Object.freeze([
  'recruit',     // Nouvelle recrue / prospect
  'member',      // Soldat / membre initié
  'enforcer',    // Homme de main / gros bras
  'lieutenant',  // Bras droit / gestionnaire
  'leader',      // Chef de gang / Parrain
]);

// ═══════════════════════════════════════════════════════════════════
// TABLE : GANGS & ORGANISATIONS CRIMINELLES
// ═══════════════════════════════════════════════════════════════════

export const dbGangs = pgTable('gangs', {
  id:          text('id').primaryKey(),                         // ex: gang_motards_66, gang_mafia_portneuf
  name:        text('name').notNull(),                          // "Les Motards du Rang", "Syndicat Nord"
  tag:         text('tag').notNull(),                           // "MC-66", "SYN", "MAF"
  colorHex:    text('color_hex').default('#e11d48').notNull(),  // Couleur du gang sur la minicarte (#hex)
  
  // Hiérarchie & Finances
  leaderId:    text('leader_id').notNull().references(() => players.id, { onDelete: 'restrict' }),
  bankBalance: integer('bank_balance').default(0).notNull(),    // Caisse noire / argent sale blanchi
  reputation:  integer('reputation').default(100).notNull(),    // Score d'influence dans le milieu souterrain
  
  // Quartier Général (Point de repère)
  hqLocation:  text('hq_location'),                             // "Entrepôt 7, Port de Portneuf"
  
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  tagUniqueIdx:    uniqueIndex('gangs_tag_idx').on(t.tag),
  leaderIdx:       index('gangs_leader_id_idx').on(t.leaderId),
  
  // Contraintes de sécurité
  balanceCheck:    check('gangs_balance_chk', sql`${t.bankBalance} >= 0`),
  reputationCheck: check('gangs_reputation_chk', sql`${t.reputation} >= 0`),
}));

// ═══════════════════════════════════════════════════════════════════
// TABLE : MEMBRES DU GANG
// ═══════════════════════════════════════════════════════════════════

export const dbGangMembers = pgTable('gang_members', {
  id:               text('id').primaryKey(),                    // UUID unique de membre
  gangId:           text('gang_id').notNull().references(() => dbGangs.id, { onDelete: 'cascade' }),
  playerId:         text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  playerName:       text('player_name').notNull(),
  
  rank:             text('rank').default('recruit').notNull(),  // recruit | member | enforcer | lieutenant | leader
  contributedFunds: integer('contributed_funds').default(0).notNull(), // Total versé à la caisse noire
  
  joinedAt:         timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt:     timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // Un joueur ne peut être que dans un seul gang actif
  playerUniqueIdx:  uniqueIndex('gang_members_player_id_idx').on(t.playerId),
  gangIdx:          index('gang_members_gang_id_idx').on(t.gangId),
  rankIdx:          index('gang_members_rank_idx').on(t.rank),

  // Validation du rang
  rankCheck:        check('gang_members_rank_chk', sql`${t.rank} IN ('recruit', 'member', 'enforcer', 'lieutenant', 'leader')`),
  contribCheck:     check('gang_members_contrib_chk', sql`${t.contributedFunds} >= 0`),
}));

// ═══════════════════════════════════════════════════════════════════
// TABLE : TERRITOIRES DE GANG (TURFS)
// ═══════════════════════════════════════════════════════════════════

export const dbGangTerritories = pgTable('gang_territories', {
  id:                text('id').primaryKey(),                   // ex: turf_donnacona_docks, turf_st_alban_north
  name:              text('name').notNull(),                    // "Quais de Donnacona", "Scierie Désaffectée"
  controllingGangId: text('controlling_gang_id').references(() => dbGangs.id, { onDelete: 'set null' }),
  
  // Position spatiale 3D et rayon de contrôle (Three.js / Minimap)
  posX:              real('pos_x').default(0).notNull(),
  posY:              real('pos_y').default(0).notNull(),
  posZ:              real('pos_z').default(0).notNull(),
  radius:            real('radius').default(45.0).notNull(),    // Rayon de la zone d'influence en mètres
  
  // Économie de zone
  influencePercent:  integer('influence_percent').default(0).notNull(), // 0 à 100% de contrôle
  revenuePerCycle:   integer('revenue_per_cycle').default(100).notNull(), // T$ générés par cycle économique
  
  lastContestedAt:   timestamp('last_contested_at', { withTimezone: true }),
  capturedAt:        timestamp('captured_at', { withTimezone: true }),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  gangIdx:          index('territories_controlling_gang_idx').on(t.controllingGangId),
  
  // Validation des pourcentages et revenus
  influenceCheck:   check('territories_influence_chk', sql`${t.influencePercent} >= 0 AND ${t.influencePercent} <= 100`),
  revenueCheck:     check('territories_revenue_chk', sql`${t.revenuePerCycle} >= 0`),
  radiusCheck:      check('territories_radius_chk', sql`${t.radius} > 0`),
}));

// ═══════════════════════════════════════════════════════════════════
// RELATIONS DRIZZLE ORM
// ═══════════════════════════════════════════════════════════════════

export const gangsRelations = relations(dbGangs, ({ one, many }) => ({
  leader: one(players, {
    fields:     [dbGangs.leaderId],
    references: [players.id],
  }),
  members:     many(dbGangMembers),
  territories: many(dbGangTerritories),
}));

export const gangMembersRelations = relations(dbGangMembers, ({ one }) => ({
  gang: one(dbGangs, {
    fields:     [dbGangMembers.gangId],
    references: [dbGangs.id],
  }),
  player: one(players, {
    fields:     [dbGangMembers.playerId],
    references: [players.id],
  }),
}));

export const gangTerritoriesRelations = relations(dbGangTerritories, ({ one }) => ({
  controllingGang: one(dbGangs, {
    fields:     [dbGangTerritories.controllingGangId],
    references: [dbGangs.id],
  }),
}));
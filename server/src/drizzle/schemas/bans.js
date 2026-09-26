/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DRIZZLE/SCHEMAS/BANS.JS
 * Schéma Drizzle ORM · Bannissements, HWID, IP & Sécurité ThirdEye
 * ═══════════════════════════════════════════════════════════════════
 * Tables :
 *   • bans : Registre des exclusions, blocages IP/HWID et grâces
 *
 * Signature : TROXT⬡ · 🛡️INTELLECTUS⬡ · ThirdEye
 * Chemin    : server/src/drizzle/schemas/bans.js
 */

import {
  pgTable, text, timestamp, boolean, jsonb,
  index, check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { players } from './players.js';

const SIG = 'TROXT⬡';

// ─── TYPES & CATÉGORIES DE BANNISSEMENT ─────────────────────────────────────
export const BAN_TYPES = Object.freeze([
  'permanent',      // Ban définitif
  'temporary',      // Ban temporaire avec date d'expiration
  'hardware_hwid',  // Empreinte matérielle bloquée (anti-double compte)
  'ip_block',       // Blocage par adresse IP / sous-réseau
  'security_auto',  // Ban automatique émis par ThirdEye / Anti-cheat
]);

export const BAN_CATEGORIES = Object.freeze([
  'speed_teleport',   // Speedhack, noclip, téléportation abusive
  'money_injection',  // Duplication ou génération illégale de T$
  'weapon_spawning',  // Spawn d'armes ou objets non autorisés
  'godmode_health',   // Invulnérabilité ou manipulation de santé
  'lua_injection',    // Injection de code ou manipulation mémoire
  'griefing_rp',      // Non-respect grave des règles RP / Mass DM
  'admin_decision',   // Sanction manuelle administrative
]);

// ═══════════════════════════════════════════════════════════════════
// TABLE : BANNISSEMENTS & HISTORIQUE DE SÉCURITÉ
// ═══════════════════════════════════════════════════════════════════

export const dbBans = pgTable('bans', {
  id:              text('id').primaryKey(),                           // ban_123456...
  playerId:        text('player_id').notNull(),                       // ID unique du compte / session
  playerName:      text('player_name').notNull(),                     // Nom du joueur au moment de la sanction
  
  // Identifiants Matériels & Réseau pour l'anti-contournement
  ipAddress:       text('ip_address'),                                // Adresse IP capturée
  hardwareId:      text('hardware_id'),                               // Empreinte HWID / GUID machine
  
  // Motif & Classification
  type:            text('type').default('temporary').notNull(),       // permanent | temporary | hardware_hwid | ip_block | security_auto
  category:        text('category').default('admin_decision').notNull(), // Classification de l'infraction
  reason:          text('reason').notNull(),                          // Motif de la sanction
  evidenceUrl:     text('evidence_url'),                              // Lien vers preuve (vidéo, capture, log ThirdEye)
  metadata:        jsonb('metadata').default({}),                     // Données techniques de télémétrie (positions, deltas)
  
  // Émetteur de la sanction
  bannedBy:        text('banned_by').default('ThirdEye Anti-Cheat').notNull(), // Nom ou ID de l'administrateur / IA
  bannedByRole:    text('banned_by_role').default('admin').notNull(),
  
  // État du bannissement
  active:          boolean('active').default(true).notNull(),         // true = ban en vigueur, false = révoqué / expiré
  appealSubmitted: boolean('appeal_submitted').default(false).notNull(), // Recours en cours d'examen
  
  // Chronologie
  bannedAt:        timestamp('banned_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt:       timestamp('expires_at', { withTimezone: true }),   // null = Permanent
  
  // Traçabilité de la Grâce / Débannissement
  pardonedAt:      timestamp('pardoned_at', { withTimezone: true }),
  pardonedBy:      text('pardoned_by'),                               // ID / Nom du staff ayant levé le ban
  pardonReason:    text('pardon_reason'),                             // Raison de la grâce ou de l'acceptation du recours
}, (t) => ({
  // Index critiques pour la vérification instantanée lors de la connexion
  playerActiveIdx: index('bans_player_active_idx').on(t.playerId, t.active),
  ipActiveIdx:     index('bans_ip_active_idx').on(t.ipAddress, t.active),
  hwidActiveIdx:   index('bans_hwid_active_idx').on(t.hardwareId, t.active),
  expiresIdx:      index('bans_expires_at_idx').on(t.expiresAt),
  categoryIdx:     index('bans_category_idx').on(t.category),

  // Contraintes de validation
  typeCheck:       check('bans_type_chk', sql`${t.type} IN ('permanent', 'temporary', 'hardware_hwid', 'ip_block', 'security_auto')`),
}));

// ═══════════════════════════════════════════════════════════════════
// RELATIONS DRIZZLE ORM
// ═══════════════════════════════════════════════════════════════════

export const bansRelations = relations(dbBans, ({ one }) => ({
  player: one(players, {
    fields:     [dbBans.playerId],
    references: [players.id],
  }),
}));

export default dbBans;
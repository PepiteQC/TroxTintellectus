/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DRIZZLE/DB/SCHEMA.JS
 * Schéma Drizzle ORM complet — SQLite / PostgreSQL
 * Appartements · Joueurs · Baux · Paiements · Meubles · Sessions · RP
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server/src/drizzle/db/schema.js
 *
 * npm install drizzle-orm better-sqlite3
 * npm install -D drizzle-kit
 */

import {
  sqliteTable, text, integer, real,
  index, uniqueIndex, check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const SIG = 'TROXT⬡';

// ─── HELPERS ────────────────────────────────────────────────────────
const now = sql`(datetime('now'))`;

export const PLAYER_ROLES     = Object.freeze(['citoyen', 'proprio', 'admin']);
export const APT_CONDITIONS   = Object.freeze(['bon', 'moyen', 'mauvais']);
export const PAYMENT_STATUSES = Object.freeze(['completed', 'pending', 'failed']);
export const PAYMENT_TYPES    = Object.freeze(['loyer', 'depot', 'vente', 'dommage']);
export const RP_EVENT_TYPES   = Object.freeze([
  'apt_enter', 'apt_leave', 'light_toggle', 'door_knock',
  'door_locked', 'rent_paid', 'lease_signed', 'lease_terminated',
]);

// ─── JOUEURS ────────────────────────────────────────────────────────
export const players = sqliteTable('players', {
  id:            text('id').primaryKey(),
  username:      text('username').notNull().unique(),
  displayName:   text('display_name'),
  avatarColor:   text('avatar_color').notNull().default('#7c3aed'),
  role:          text('role').notNull().default('citoyen'),

  posX:          real('pos_x').notNull().default(0),
  posY:          real('pos_y').notNull().default(2),
  posZ:          real('pos_z').notNull().default(8),
  floor:         integer('floor').notNull().default(0),
  aptId:         text('apt_id'),

  cash:          integer('cash').notNull().default(500),
  bankBalance:   integer('bank_balance').notNull().default(0),

  isOnline:      integer('is_online', { mode: 'boolean' }).notNull().default(false),
  lastSeen:      text('last_seen').notNull().default(now),
  totalPlaytime: integer('total_playtime').notNull().default(0),
  createdAt:     text('created_at').notNull().default(now),
  updatedAt:     text('updated_at').notNull().default(now),
}, (t) => ({
  usernameIdx: uniqueIndex('players_username_idx').on(t.username),
  onlineIdx:   index('players_online_idx').on(t.isOnline),
  aptIdx:      index('players_apt_idx').on(t.aptId),
  roleChk:     check('players_role_chk', sql`${t.role} IN ('citoyen','proprio','admin')`),
  cashChk:     check('players_cash_chk', sql`${t.cash} >= 0 AND ${t.bankBalance} >= 0`),
  floorChk:    check('players_floor_chk', sql`${t.floor} >= 0 AND ${t.floor} < 20`),
}));

// ─── APPARTEMENTS ───────────────────────────────────────────────────
export const apartments = sqliteTable('apartments', {
  id:         text('id').primaryKey(),
  floor:      integer('floor').notNull(),
  aptIndex:   integer('apt_index').notNull(),
  label:      text('label').notNull(),

  ownerId:    text('owner_id').references(() => players.id, { onDelete: 'set null' }),
  tenantId:   text('tenant_id').references(() => players.id, { onDelete: 'set null' }),

  isLocked:   integer('is_locked',   { mode: 'boolean' }).notNull().default(true),
  isOccupied: integer('is_occupied', { mode: 'boolean' }).notNull().default(false),

  rentAmount: integer('rent_amount').notNull().default(850),
  salePrice:  integer('sale_price'),
  isForSale:  integer('is_for_sale', { mode: 'boolean' }).notNull().default(false),
  isForRent:  integer('is_for_rent', { mode: 'boolean' }).notNull().default(false),

  lightOn:    integer('light_on', { mode: 'boolean' }).notNull().default(false),
  condition:  text('condition').notNull().default('bon'),

  createdAt:  text('created_at').notNull().default(now),
  updatedAt:  text('updated_at').notNull().default(now),
}, (t) => ({
  floorAptIdx: uniqueIndex('apt_floor_apt_idx').on(t.floor, t.aptIndex),
  ownerIdx:    index('apt_owner_idx').on(t.ownerId),
  tenantIdx:   index('apt_tenant_idx').on(t.tenantId),
  forRentIdx:  index('apt_for_rent_idx').on(t.isForRent, t.isOccupied),
  aptIndexChk: check('apt_index_chk', sql`${t.aptIndex} >= 0 AND ${t.aptIndex} < 8`),
  rentChk:     check('apt_rent_chk', sql`${t.rentAmount} >= 0`),
  conditionChk:check('apt_condition_chk', sql`${t.condition} IN ('bon','moyen','mauvais')`),
}));

// ─── BAUX ───────────────────────────────────────────────────────────
export const leases = sqliteTable('leases', {
  id:             text('id').primaryKey(),
  aptId:          text('apt_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  tenantId:       text('tenant_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  ownerId:        text('owner_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  rentAmount:     integer('rent_amount').notNull(),
  startDate:      text('start_date').notNull().default(now),
  endDate:        text('end_date'),
  isActive:       integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastPaidAt:     text('last_paid_at'),
  missedPayments: integer('missed_payments').notNull().default(0),
  createdAt:      text('created_at').notNull().default(now),
}, (t) => ({
  tenantActiveIdx: index('leases_tenant_active_idx').on(t.tenantId, t.isActive),
  aptIdx:          index('leases_apt_idx').on(t.aptId),
  ownerIdx:        index('leases_owner_idx').on(t.ownerId),
  rentChk:         check('leases_rent_chk', sql`${t.rentAmount} >= 0`),
  missedChk:       check('leases_missed_chk', sql`${t.missedPayments} >= 0`),
}));

// ─── PAIEMENTS ──────────────────────────────────────────────────────
export const payments = sqliteTable('payments', {
  id:           text('id').primaryKey(),
  leaseId:      text('lease_id').notNull().references(() => leases.id, { onDelete: 'cascade' }),
  fromPlayerId: text('from_player_id').notNull().references(() => players.id, { onDelete: 'restrict' }),
  toPlayerId:   text('to_player_id').notNull().references(() => players.id, { onDelete: 'restrict' }),
  amount:       integer('amount').notNull(),
  type:         text('type').notNull(),
  status:       text('status').notNull().default('completed'),
  note:         text('note'),
  paidAt:       text('paid_at').notNull().default(now),
}, (t) => ({
  fromIdx:   index('payments_from_idx').on(t.fromPlayerId, t.paidAt),
  toIdx:     index('payments_to_idx').on(t.toPlayerId, t.paidAt),
  leaseIdx:  index('payments_lease_idx').on(t.leaseId),
  amountChk: check('payments_amount_chk', sql`${t.amount} > 0`),
  typeChk:   check('payments_type_chk', sql`${t.type} IN ('loyer','depot','vente','dommage')`),
  statusChk: check('payments_status_chk', sql`${t.status} IN ('completed','pending','failed')`),
}));

// ─── MEUBLES ────────────────────────────────────────────────────────
export const furniture = sqliteTable('furniture', {
  id:       text('id').primaryKey(),
  aptId:    text('apt_id').notNull().references(() => apartments.id, { onDelete: 'cascade' }),
  ownerId:  text('owner_id').references(() => players.id, { onDelete: 'set null' }),
  type:     text('type').notNull(),
  name:     text('name').notNull(),
  posX:     real('pos_x').notNull().default(0),
  posY:     real('pos_y').notNull().default(0),
  posZ:     real('pos_z').notNull().default(0),
  rotY:     real('rot_y').notNull().default(0),
  color:    text('color').notNull().default('#1c140e'),
  scaleX:   real('scale_x').notNull().default(1),
  scaleY:   real('scale_y').notNull().default(1),
  scaleZ:   real('scale_z').notNull().default(1),
  metadata: text('metadata', { mode: 'json' }).notNull().default({}),
  placedAt: text('placed_at').notNull().default(now),
}, (t) => ({
  aptIdx:   index('furniture_apt_idx').on(t.aptId),
  ownerIdx: index('furniture_owner_idx').on(t.ownerId),
}));

// ─── SESSIONS ───────────────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id:             text('id').primaryKey(),
  playerId:       text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  wsId:           text('ws_id'),
  ipAddress:      text('ip_address'),
  connectedAt:    text('connected_at').notNull().default(now),
  disconnectedAt: text('disconnected_at'),
  durationSec:    integer('duration_sec'),
  lastPosX:       real('last_pos_x'),
  lastPosY:       real('last_pos_y'),
  lastPosZ:       real('last_pos_z'),
}, (t) => ({
  playerConnectedIdx: index('sessions_player_connected_idx').on(t.playerId, t.connectedAt),
  activeIdx:          index('sessions_active_idx').on(t.playerId).where(sql`${t.disconnectedAt} IS NULL`),
  durationChk:        check('sessions_duration_chk', sql`${t.durationSec} IS NULL OR ${t.durationSec} >= 0`),
}));

// ─── ÉVÉNEMENTS RP ──────────────────────────────────────────────────
export const rpEvents = sqliteTable('rp_events', {
  id:        text('id').primaryKey(),
  type:      text('type').notNull(),
  playerId:  text('player_id').references(() => players.id, { onDelete: 'set null' }),
  aptId:     text('apt_id').references(() => apartments.id, { onDelete: 'set null' }),
  data:      text('data', { mode: 'json' }).notNull().default({}),
  floor:     integer('floor'),
  createdAt: text('created_at').notNull().default(now),
}, (t) => ({
  createdAtIdx: index('rp_events_created_idx').on(t.createdAt),
  aptIdx:       index('rp_events_apt_idx').on(t.aptId, t.createdAt),
  playerIdx:    index('rp_events_player_idx').on(t.playerId, t.createdAt),
  floorChk:     check('rp_events_floor_chk', sql`${t.floor} IS NULL OR (${t.floor} >= 0 AND ${t.floor} < 20)`),
}));
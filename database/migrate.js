/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DATABASE/SCHEMA.JS
 * Schéma Drizzle ORM complet TroxtWorld (PostgreSQL) — TroxtPrism
 * ═══════════════════════════════════════════════════════════════════
 * Miroir JS du schéma SQL + tables géographiques Saint-Alban.
 *
 * Chemin : database/schema.js
 * npm install drizzle-orm
 */

import {
  pgTable, pgEnum, text, smallint, integer, bigint, real, boolean,
  timestamp, jsonb, inet, primaryKey, unique, index, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── ENUMS ───────────────────────────────────────────────────────────────────
export const permissionLevel = pgEnum('permission_level', ['citizen','vip','moderator','admin','superadmin']);
export const playerState     = pgEnum('player_state', ['idle','walking','running','in_vehicle','cuffed','downed','dead','spectating']);
export const transactionType = pgEnum('transaction_type', ['purchase','salary','deposit','withdraw','transfer','fine','reward','admin_grant']);
export const vehicleState    = pgEnum('vehicle_state', ['parked','active','impounded','destroyed']);
export const propertyType    = pgEnum('property_type', ['apartment','house','business','warehouse','garage']);
export const gangType        = pgEnum('gang_type', ['gang','mafia','cartel','crew']);
export const jobCategory     = pgEnum('job_category', ['civilian','emergency','government','illegal','freelance']);
export const logLevel        = pgEnum('log_level', ['DEBUG','INFO','WARN','ERROR','CRITICAL']);
export const logType         = pgEnum('log_type', ['admin','economy','combat','vehicle','property','system','security','chat']);
export const weatherType     = pgEnum('weather_type', ['sunny','cloudy','rainy','stormy','foggy']);
export const accountStatus   = pgEnum('account_status', ['active','frozen','closed']);
export const seasonType      = pgEnum('season_type', ['spring','summer','autumn']);
// Zones Saint-Alban
export const zoneType        = pgEnum('zone_type', ['urban','sacred','industrial','forest','rural','wilderness']);
export const lawStrictness   = pgEnum('law_strictness', ['low','standard','federal']);

// ─── JOUEURS ─────────────────────────────────────────────────────────────────
export const players = pgTable('players', {
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  permission:   permissionLevel('permission').default('citizen').notNull(),
  health:       smallint('health').default(100).notNull(),
  armor:        smallint('armor').default(0).notNull(),
  hunger:       smallint('hunger').default(100).notNull(),
  thirst:       smallint('thirst').default(100).notNull(),
  positionX:    real('position_x').default(0).notNull(),
  positionY:    real('position_y').default(0).notNull(),
  positionZ:    real('position_z').default(0).notNull(),
  heading:      real('heading').default(0).notNull(),
  dimensionId:  text('dimension_id').default('root').notNull(),
  job:          text('job').default('civilian').notNull(),
  jobRank:      smallint('job_rank').default(1).notNull(),
  gangId:       text('gang_id'),
  inventory:    jsonb('inventory').default(sql`'[]'::jsonb`).notNull(),
  metadata:     jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  loadout:      jsonb('loadout').default(sql`'[]'::jsonb`).notNull(),
  state:        playerState('state').default('idle').notNull(),
  isOnline:     boolean('is_online').default(false).notNull(),
  playtimeSec:  bigint('playtime_sec', { mode:'number' }).default(0).notNull(),
  deletedAt:    timestamp('deleted_at'),
  lastSeen:     timestamp('last_seen').defaultNow().notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  jobIdx:    index('players_job_idx').on(t.job),
  gangIdx:   index('players_gang_idx').on(t.gangId),
  onlineIdx: index('players_online_idx').on(t.id).where(sql`${t.isOnline} = true`),
  activeIdx: index('players_active_idx').on(t.id).where(sql`${t.deletedAt} IS NULL`),
  stateIdx:  index('players_state_idx').on(t.state).where(sql`${t.deletedAt} IS NULL`),
  healthChk: check('players_health_chk', sql`${t.health} BETWEEN 0 AND 100`),
  headChk:   check('players_heading_chk', sql`${t.heading} BETWEEN 0 AND 360`),
}));

// ─── COMPTES BANCAIRES ───────────────────────────────────────────────────────
export const bankAccounts = pgTable('bank_accounts', {
  id:           text('id').primaryKey().references(() => players.id, { onDelete:'cascade' }),
  cash:         bigint('cash', { mode:'number' }).default(0).notNull(),
  bank:         bigint('bank', { mode:'number' }).default(0).notNull(),
  debt:         bigint('debt', { mode:'number' }).default(0).notNull(),
  status:       accountStatus('status').default('active').notNull(),
  frozenReason: text('frozen_reason'),
  creditScore:  smallint('credit_score').default(700).notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  cashChk:   check('bank_cash_chk', sql`${t.cash} >= 0`),
  scoreChk:  check('bank_score_chk', sql`${t.creditScore} BETWEEN 300 AND 850`),
}));

// ─── TRANSACTIONS ────────────────────────────────────────────────────────────
export const transactions = pgTable('transactions', {
  id:           text('id').primaryKey(),
  fromId:       text('from_id').notNull().references(() => bankAccounts.id, { onDelete:'restrict' }),
  toId:         text('to_id').references(() => bankAccounts.id, { onDelete:'restrict' }),
  type:         transactionType('type').notNull(),
  amount:       bigint('amount', { mode:'number' }).notNull(),
  balanceAfter: bigint('balance_after', { mode:'number' }).notNull(),
  note:         text('note'),
  metadata:     jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  fromIdx:     index('tx_from_idx').on(t.fromId),
  toIdx:       index('tx_to_idx').on(t.toId),
  typeIdx:     index('tx_type_idx').on(t.type),
  fromDateIdx: index('tx_from_date_idx').on(t.fromId, t.createdAt.desc()),
  amountChk:   check('tx_amount_chk', sql`${t.amount} > 0`),
}));

// ─── VÉHICULES ───────────────────────────────────────────────────────────────
export const vehicles = pgTable('vehicles', {
  id:            text('id').primaryKey(),
  ownerId:       text('owner_id').notNull().references(() => players.id, { onDelete:'restrict' }),
  model:         text('model').notNull(),
  plate:         text('plate').notNull().unique(),
  colorPrimary:  text('color_primary').default('#ffffff').notNull(),
  colorSecondary:text('color_secondary').default('#ffffff').notNull(),
  positionX:     real('position_x').default(0).notNull(),
  positionY:     real('position_y').default(0).notNull(),
  positionZ:     real('position_z').default(0).notNull(),
  heading:       real('heading').default(0).notNull(),
  dimensionId:   text('dimension_id').default('root').notNull(),
  state:         vehicleState('state').default('parked').notNull(),
  fuel:          smallint('fuel').default(100).notNull(),
  engineHealth:  smallint('engine_health').default(1000).notNull(),
  bodyHealth:    smallint('body_health').default(1000).notNull(),
  mileage:       real('mileage').default(0).notNull(),
  locked:        boolean('locked').default(true).notNull(),
  mods:          jsonb('mods').default(sql`'{}'::jsonb`).notNull(),
  extras:        jsonb('extras').default(sql`'{}'::jsonb`).notNull(),
  insured:       boolean('insured').default(false).notNull(),
  insuranceExp:  timestamp('insurance_exp'),
  deletedAt:     timestamp('deleted_at'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  ownerIdx:  index('vehicles_owner_idx').on(t.ownerId).where(sql`${t.deletedAt} IS NULL`),
  activeIdx: index('vehicles_active_idx').on(t.id).where(sql`${t.state} = 'active' AND ${t.deletedAt} IS NULL`),
  plateIdx:  index('vehicles_plate_idx').on(t.plate),
}));

// ─── PROPRIÉTÉS ──────────────────────────────────────────────────────────────
export const properties = pgTable('properties', {
  id:          text('id').primaryKey(),
  ownerId:     text('owner_id').references(() => players.id, { onDelete:'set null' }),
  type:        propertyType('type').notNull(),
  name:        text('name').notNull(),
  price:       bigint('price', { mode:'number' }).default(0).notNull(),
  rentPrice:   bigint('rent_price', { mode:'number' }).default(0).notNull(),
  positionX:   real('position_x').notNull(),
  positionY:   real('position_y').notNull(),
  positionZ:   real('position_z').notNull(),
  heading:     real('heading').default(0).notNull(),
  interiorId:  text('interior_id'),
  locked:      boolean('locked').default(true).notNull(),
  forSale:     boolean('for_sale').default(true).notNull(),
  storage:     jsonb('storage').default(sql`'[]'::jsonb`).notNull(),
  metadata:    jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  deletedAt:   timestamp('deleted_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  ownerIdx:   index('props_owner_idx').on(t.ownerId).where(sql`${t.deletedAt} IS NULL`),
  typeIdx:    index('props_type_idx').on(t.type),
  forSaleIdx: index('props_for_sale_idx').on(t.type, t.price).where(sql`${t.forSale} = true AND ${t.deletedAt} IS NULL`),
}));

// ─── ACCÈS PROPRIÉTÉS ────────────────────────────────────────────────────────
export const propertyAccess = pgTable('property_access', {
  propertyId:  text('property_id').notNull().references(() => properties.id, { onDelete:'cascade' }),
  playerId:    text('player_id').notNull().references(() => players.id, { onDelete:'cascade' }),
  accessLevel: smallint('access_level').default(1).notNull(),
  grantedAt:   timestamp('granted_at').defaultNow().notNull(),
  grantedBy:   text('granted_by').notNull().references(() => players.id, { onDelete:'restrict' }),
}, (t) => ({
  pk: primaryKey({ columns:[t.propertyId, t.playerId] }),
}));

// ─── GANGS ───────────────────────────────────────────────────────────────────
export const gangs = pgTable('gangs', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull().unique(),
  type:        gangType('type').default('gang').notNull(),
  leaderId:    text('leader_id').notNull().references(() => players.id, { onDelete:'restrict' }),
  color:       text('color').default('#ff0000').notNull(),
  territory:   jsonb('territory').default(sql`'[]'::jsonb`).notNull(),
  balance:     bigint('balance', { mode:'number' }).default(0).notNull(),
  reputation:  integer('reputation').default(0).notNull(),
  maxMembers:  smallint('max_members').default(20).notNull(),
  deletedAt:   timestamp('deleted_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─── MEMBRES DE GANG ─────────────────────────────────────────────────────────
export const gangMembers = pgTable('gang_members', {
  playerId:     text('player_id').notNull().references(() => players.id, { onDelete:'cascade' }),
  gangId:       text('gang_id').notNull().references(() => gangs.id, { onDelete:'cascade' }),
  rank:         smallint('rank').default(1).notNull(),
  contribution: bigint('contribution', { mode:'number' }).default(0).notNull(),
  joinedAt:     timestamp('joined_at').defaultNow().notNull(),
}, (t) => ({
  pk:          primaryKey({ columns:[t.playerId, t.gangId] }),
  playerIdx:   index('gm_player_idx').on(t.playerId),
  gangRankIdx: index('gm_gang_rank_idx').on(t.gangId, t.rank.desc()),
}));

// ─── EMPLOIS ─────────────────────────────────────────────────────────────────
export const jobs = pgTable('jobs', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull().unique(),
  category:    jobCategory('category').default('civilian').notNull(),
  color:       text('color').default('#ffffff').notNull(),
  maxPlayers:  smallint('max_players').default(20).notNull(),
  baseSalary:  bigint('base_salary', { mode:'number' }).default(0).notNull(),
  illegal:     boolean('illegal').default(false).notNull(),
  grades:      jsonb('grades').default(sql`'[]'::jsonb`).notNull(),
  permissions: jsonb('permissions').default(sql`'[]'::jsonb`).notNull(),
  metadata:    jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─── LOGS D'AUDIT ────────────────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id:        text('id').primaryKey(),
  type:      logType('type').notNull(),
  level:     logLevel('level').default('INFO').notNull(),
  actorId:   text('actor_id'),
  targetId:  text('target_id'),
  action:    text('action').notNull(),
  reason:    text('reason'),
  data:      jsonb('data').default(sql`'{}'::jsonb`).notNull(),
  ip:        inet('ip'),
  sessionId: text('session_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  actorIdx:     index('logs_actor_idx').on(t.actorId),
  typeLevelIdx: index('logs_type_level_idx').on(t.type, t.level),
  criticalIdx:  index('logs_critical_idx').on(t.createdAt.desc()).where(sql`${t.level} IN ('ERROR','CRITICAL')`),
}));

// ─── OBJETS DU MONDE ─────────────────────────────────────────────────────────
export const worldProps = pgTable('world_props', {
  id:          text('id').primaryKey(),
  type:        text('type').notNull(),
  placedBy:    text('placed_by').references(() => players.id, { onDelete:'set null' }),
  positionX:   real('position_x').notNull(),
  positionY:   real('position_y').notNull(),
  positionZ:   real('position_z').notNull(),
  rotationX:   real('rotation_x').default(0).notNull(),
  rotationY:   real('rotation_y').default(0).notNull(),
  rotationZ:   real('rotation_z').default(0).notNull(),
  scaleX:      real('scale_x').default(1).notNull(),
  scaleY:      real('scale_y').default(1).notNull(),
  scaleZ:      real('scale_z').default(1).notNull(),
  dimensionId: text('dimension_id').default('root').notNull(),
  permanent:   boolean('permanent').default(false).notNull(),
  metadata:    jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  typeDimIdx:    index('world_props_type_dim_idx').on(t.type, t.dimensionId),
  permanentIdx:  index('world_props_permanent_idx').on(t.id).where(sql`${t.permanent} = true`),
}));

// ─── ÉTAT DU MONDE ───────────────────────────────────────────────────────────
export const worldState = pgTable('world_state', {
  id:        text('id').primaryKey().default('singleton'),
  weather:   weatherType('weather').default('sunny').notNull(),
  timeHours: real('time_hours').default(12).notNull(),
  season:    seasonType('season').default('summer').notNull(),
  dayCount:  integer('day_count').default(1).notNull(),
  taxRate:   real('tax_rate').default(0.05).notNull(),
  crimeRate: real('crime_rate').default(0.5).notNull(),
  metadata:  jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── SESSIONS ────────────────────────────────────────────────────────────────
export const playerSessions = pgTable('player_sessions', {
  id:          text('id').primaryKey(),
  playerId:    text('player_id').notNull().references(() => players.id, { onDelete:'cascade' }),
  ip:          inet('ip').notNull(),
  userAgent:   text('user_agent'),
  startedAt:   timestamp('started_at').defaultNow().notNull(),
  endedAt:     timestamp('ended_at'),
}, (t) => ({
  playerIdx: index('sessions_player_idx').on(t.playerId),
  activeIdx: index('sessions_active_idx').on(t.playerId).where(sql`${t.endedAt} IS NULL`),
}));

// ─── ITEMS ───────────────────────────────────────────────────────────────────
export const items = pgTable('items', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull().unique(),
  label:       text('label').notNull(),
  description: text('description'),
  category:    text('category').notNull(),
  weight:      real('weight').default(0).notNull(),
  maxStack:    smallint('max_stack').default(1).notNull(),
  usable:      boolean('usable').default(false).notNull(),
  tradeable:   boolean('tradeable').default(true).notNull(),
  illegal:     boolean('illegal').default(false).notNull(),
  metadata:    jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─── MAGASINS ────────────────────────────────────────────────────────────────
export const shops = pgTable('shops', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  jobRequired: text('job_required'),
  positionX:   real('position_x').notNull(),
  positionY:   real('position_y').notNull(),
  positionZ:   real('position_z').notNull(),
  inventory:   jsonb('inventory').default(sql`'[]'::jsonb`).notNull(),
  open:        boolean('open').default(true).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════
// ZONES GÉOGRAPHIQUES — SAINT-ALBAN (PORTNEUF)
// ═══════════════════════════════════════════════════════════════════

export const zoneConfig = pgTable('zone_config', {
  zoneKey:         text('zone_key').primaryKey(),
  name:            text('name').notNull(),
  type:            zoneType('type').notNull(),
  colorHex:        text('color_hex').default('#ffffff').notNull(),
  speedLimitKmh:   smallint('speed_limit_kmh').default(50).notNull(),
  lawStrictness:   lawStrictness('law_strictness').default('standard').notNull(),
  respawnHospital: text('respawn_hospital'),
  policeStation:   text('police_station'),
  metadata:        jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
});

export const surfacePhysics = pgTable('surface_physics', {
  surfaceType:  text('surface_type').primaryKey(),
  friction:     real('friction').notNull(),
  drag:         real('drag').notNull(),
  maxSpeedMult: real('max_speed_mult').default(1).notNull(),
  dustParticle: text('dust_particle'),
  skidSound:    text('skid_sound'),
  slipAngleDeg: real('slip_angle_deg').default(15).notNull(),
});

export const zoneBounds = pgTable('zone_bounds', {
  zoneKey:       text('zone_key').primaryKey().references(() => zoneConfig.zoneKey, { onDelete:'cascade' }),
  minX:          real('min_x').notNull(),
  minZ:          real('min_z').notNull(),
  maxX:          real('max_x').notNull(),
  maxZ:          real('max_z').notNull(),
  polygonJson:   jsonb('polygon_json').default(sql`'[]'::jsonb`).notNull(),
  elevationBase: real('elevation_base').default(0).notNull(),
});

export const spawnPoints = pgTable('spawn_points', {
  id:         text('id').primaryKey().default(sql`gen_random_uuid()`),
  zoneKey:    text('zone_key').notNull().references(() => zoneConfig.zoneKey, { onDelete:'cascade' }),
  pointType:  text('point_type').notNull(),
  posX:       real('pos_x').notNull(),
  posY:       real('pos_y').notNull(),
  posZ:       real('pos_z').notNull(),
  headingDeg: real('heading_deg').default(0).notNull(),
  isReserved: smallint('is_reserved').default(0).notNull(),
}, (t) => ({
  zoneIdx: index('spawn_zone_idx').on(t.zoneKey),
}));

// ─── EXPORT GROUPÉ ───────────────────────────────────────────────────────────
export const tables = {
  players, bankAccounts, transactions, vehicles, properties, propertyAccess,
  gangs, gangMembers, jobs, auditLogs, worldProps, worldState, playerSessions,
  items, shops, zoneConfig, surfacePhysics, zoneBounds, spawnPoints,
};

export default tables;
/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DATABASE/INDEX.JS
 * Client & pool PostgreSQL Drizzle — Cœur DB de TroxtWorld (TroxtPrism)
 * ═══════════════════════════════════════════════════════════════════
 * Pont : expose db, pool, health, et un bus d'événements DB pour que
 * TROXT⬡ (cerveau) et 🛡️INTELLECTUS⬡ (sécurité) puissent surveiller.
 *
 * Chemin : database/index.js
 * npm install drizzle-orm pg
 */

import { drizzle }      from 'drizzle-orm/node-postgres';
import { sql }          from 'drizzle-orm';
import pg               from 'pg';
import { EventEmitter } from 'node:events';
import * as schema      from './schema.js';

const SIG   = 'TROXT⬡';
const ISIG  = '🛡️INTELLECTUS⬡';
const AGENT = 'TroxtPrism';

// ─── LOGGER ──────────────────────────────────────────────────────────────────
const log = (lvl, msg, data) => {
  const i = { OK:'✓', WARN:'⚠', ERR:'✖', DB:'🗄️', INFO:'ℹ' }[lvl] || '·';
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${i} [${SIG}·${AGENT}] ${msg}`);
  if (data) console.log('   ↳', JSON.stringify(data));
};

// ─── BUS D'ÉVÉNEMENTS DB ─────────────────────────────────────────────────────
// Permet à TROXT⬡ et Intellectus de s'abonner aux événements de la base.
export const dbEvents = new EventEmitter();
dbEvents.setMaxListeners(50);

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/troxtworld';

const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '20', 10);

// ─── POOL ────────────────────────────────────────────────────────────────────
export const pool = new pg.Pool({
  connectionString,
  max:                     POOL_MAX,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,
  application_name:        'troxtworld',
  // Pas de requêtes qui traînent : disjoncteur applicatif
  statement_timeout:       15_000,
  query_timeout:           15_000,
});

// ─── MÉTRIQUES DU POOL (pour l'admin & Intellectus) ──────────────────────────
const metrics = {
  queries_total:   0,
  queries_failed:  0,
  slow_queries:    0,        // > 200ms
  tx_total:        0,
  tx_rollback:     0,
  connect_errors:  0,
  started_at:      Date.now(),
  last_error:      null,
};

pool.on('error', (err) => {
  metrics.connect_errors++;
  metrics.last_error = { message: err.message, at: new Date().toISOString() };
  log('ERR', `Pool error sur client inactif: ${err.message}`);
  dbEvents.emit('db:pool_error', { message: err.message, sig: SIG });
  // Alerte Intellectus — une erreur pool peut signaler une attaque ou une panne
  dbEvents.emit('intellectus:db_alert', {
    type: 'POOL_ERROR', message: err.message, sig: ISIG,
  });
});

pool.on('connect', () => dbEvents.emit('db:connect', { sig: SIG }));

// ─── DRIZZLE ─────────────────────────────────────────────────────────────────
export const db = drizzle(pool, { schema, logger: false });

// ─── WRAPPER DE REQUÊTE INSTRUMENTÉ ──────────────────────────────────────────
// Utilise-le pour toute requête brute que tu veux tracer/sécuriser.
export async function query(text, params = [], opts = {}) {
  const start = performance.now();
  metrics.queries_total++;
  try {
    const res = await pool.query(text, params);
    const ms  = performance.now() - start;
    if (ms > 200) {
      metrics.slow_queries++;
      dbEvents.emit('db:slow_query', { ms: Math.round(ms), text: text.slice(0, 80), sig: SIG });
    }
    return res;
  } catch (err) {
    metrics.queries_failed++;
    metrics.last_error = { message: err.message, code: err.code, at: new Date().toISOString() };
    dbEvents.emit('db:query_error', { message: err.message, code: err.code, sig: SIG });
    // Codes d'erreur PG suspects → alerte sécurité
    if (['42601', '42501', '22P02'].includes(err.code)) {
      dbEvents.emit('intellectus:db_alert', {
        type: 'SUSPECT_QUERY', code: err.code, message: err.message, sig: ISIG,
      });
    }
    throw err;
  }
}

// ─── TRANSACTION HELPER (avec rollback auto + trace) ─────────────────────────
export async function withTransaction(fn) {
  metrics.tx_total++;
  return db.transaction(async (tx) => {
    try {
      return await fn(tx);
    } catch (err) {
      metrics.tx_rollback++;
      dbEvents.emit('db:tx_rollback', { message: err.message, sig: SIG });
      throw err;
    }
  });
}

// ─── SANTÉ (pour /api/admin/metrics & le cerveau TROXT⬡) ─────────────────────
export async function health() {
  const start = performance.now();
  let alive = false, latency = null, dbError = null;
  try {
    await pool.query('SELECT 1');
    alive   = true;
    latency = Math.round(performance.now() - start);
  } catch (err) {
    dbError = err.message;
  }
  return {
    sig:         SIG,
    agent:       AGENT,
    alive,
    latency_ms:  latency,
    error:       dbError,
    pool: {
      total:    pool.totalCount,
      idle:     pool.idleCount,
      waiting:  pool.waitingCount,
      max:      POOL_MAX,
    },
    metrics: {
      ...metrics,
      uptime_sec: Math.floor((Date.now() - metrics.started_at) / 1000),
    },
    checked_at: new Date().toISOString(),
  };
}

export function getMetrics() {
  return { ...metrics, uptime_sec: Math.floor((Date.now() - metrics.started_at) / 1000), sig: SIG };
}

// ─── PONT LUA (TROXT⬡) ───────────────────────────────────────────────────────
// Branche ceci sur ton asset-server /lua/emit pour informer le cerveau Lua.
export function bridgeToLua(emitFn) {
  if (typeof emitFn !== 'function') return;
  dbEvents.on('db:slow_query',  (d) => emitFn('troxtprism:slow_query', d));
  dbEvents.on('db:query_error', (d) => emitFn('troxtprism:error', d));
  dbEvents.on('db:tx_rollback', (d) => emitFn('troxtprism:rollback', d));
  dbEvents.on('db:pool_error',  (d) => emitFn('troxtprism:pool_error', d));
  // Heartbeat régulier pour que TROXT⬡ sache que TroxtPrism est vivant
  setInterval(async () => {
    const h = await health();
    emitFn('troxtprism:heartbeat', {
      alive: h.alive, latency: h.latency_ms, pool: h.pool, sig: SIG,
    });
  }, 5000);
  log('OK', 'Pont Lua actif — TroxtPrism → TROXT⬡ cerveau');
}

// ─── PONT INTELLECTUS (🛡️) ──────────────────────────────────────────────────
export function bridgeToIntellectus(alertFn) {
  if (typeof alertFn !== 'function') return;
  dbEvents.on('intellectus:db_alert', (d) => alertFn(d));
  log('OK', 'Pont sécurité actif — TroxtPrism → 🛡️INTELLECTUS⬡');
}

// ─── FERMETURE PROPRE ────────────────────────────────────────────────────────
export async function shutdown() {
  log('WARN', 'Fermeture du pool PostgreSQL...');
  await pool.end();
  log('OK', 'Pool fermé proprement');
}

process.on('SIGINT',  () => shutdown().then(() => process.exit(0)));
process.on('SIGTERM', () => shutdown().then(() => process.exit(0)));

log('DB', `Pool PostgreSQL initialisé — max ${POOL_MAX} connexions`);
dbEvents.emit('db:ready', { sig: SIG, agent: AGENT });

export { schema, SIG, ISIG };
export default db;
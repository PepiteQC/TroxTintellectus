/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TROXT⬡ — SERVER/DB/CLIENT.JS                                 ║
 * ║  Client de persistence unique (Source de vérité)              ║
 * ║  Bascule automatique transparente : PostgreSQL ⇄ PGlite WASM ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * RÈGLE PROJET (non négociable) :
 *   • AUCUN autre fichier ne doit instancier `new Pool()` ni `drizzle(...)`.
 *   • Toute la persistence passe par `import { db } from './client.js'`.
 *   • Le schéma de référence unique est `schema.js`.
 *
 * Signature : TROXT⬡
 * Chemin    : server/db/client.js
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import * as schema from './schema.js';

const { Pool } = pg;

// Ré-exportation transparente du schéma unifié
export * from './schema.js';

const SIG = 'TROXT⬡';
const DEFAULT_URL = 'postgres://postgres:pepite127@127.0.0.1:5432/troxt_db';

// ─── CONFIGURATION & LOGIQUE DE RÉSOLUTION ──────────────────────────────────

function resolveUrl() {
  return process.env.DATABASE_URL?.trim() || DEFAULT_URL;
}

function safeTarget(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host || 'localhost',
      database: parsed.pathname.replace(/^\//, '') || 'troxt_db',
    };
  } catch {
    return { host: 'inconnu', database: 'inconnue' };
  }
}

const CONNECTION_URL = resolveUrl();
const TARGET = safeTarget(CONNECTION_URL);

/**
 * Vérifie si le mode de repli local (pglite) est autorisé.
 * @returns {boolean}
 */
function fallbackEnabled() {
  return (process.env.DB_FALLBACK ?? 'pglite').toLowerCase() === 'pglite';
}

// ─── ÉTAT TECHNIQUE DU MODULE (SINGLETON) ────────────────────────────────────

/** @type {pg.Pool | null} */
let pool = new Pool({
  connectionString: CONNECTION_URL,
  // 12 connexions suffisent largement pour 128+ joueurs simultanés
  max: Number(process.env.DB_POOL_MAX ?? 12),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 3000),
  allowExitOnIdle: false,
});

/** @type {object} Instance Drizzle active (node-postgres ou pglite) */
let current = drizzle(pool, { schema });

/** @type {object} */
let status = {
  mode: 'postgres',
  connected: false,
  database: TARGET.database,
  host: TARGET.host,
  latencyMs: null,
  checkedAt: 0,
};

// ─── BINDING PUBLIC DYNAMIQUE (PROXY) ────────────────────────────────────────

/**
 * Instance de base de données unifiée.
 * Le proxy délègue de manière dynamique toutes les requêtes (select, insert, etc.)
 * vers le pilote actif sans nécessiter de redémarrer l'application.
 */
export const db = new Proxy({}, {
  get(_target, prop, receiver) {
    const value = Reflect.get(current, prop, receiver);
    // Liaison (binding) des fonctions pour préserver le contexte de l'instance courante
    return typeof value === 'function' ? value.bind(current) : value;
  },
  has(_target, prop) {
    return prop in current;
  },
});

/**
 * Retourne le pool de connexion pg s'il est actif.
 * @returns {pg.Pool|null}
 */
export function getPool() {
  return pool;
}

/**
 * Récupère le statut d'intégrité de la base de données.
 * @returns {object}
 */
export function getDatabaseStatus() {
  return status;
}

/**
 * Retourne le pilote SQL actif ('postgres' ou 'pglite').
 * @returns {'postgres' | 'pglite'}
 */
export function getDatabaseMode() {
  return status.mode;
}

// ─── PROCÉDURE DE TRANSITION VERS L'EMBARQUÉ ─────────────────────────────────

async function probePostgres() {
  if (!pool) return { ok: false, latencyMs: 0, error: 'pool_indisponible' };
  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function switchToPglite() {
  if (!fallbackEnabled()) return false;
  try {
    // Imports dynamiques asynchrones requis pour le mode PGlite
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');

    const dataDir = path.resolve(process.env.PGLITE_DIR?.trim() || './.data/pglite');
    mkdirSync(dataDir, { recursive: true });

    const lite = new PGlite(dataDir);
    await lite.waitReady;

    const pgliteDb = drizzlePglite(lite, { schema });

    // Exécute automatiquement les migrations de structure au démarrage si base vierge
    try {
      const { migrate } = await import('drizzle-orm/pglite/migrator');
      await migrate(pgliteDb, { migrationsFolder: './drizzle/migrations' });
      console.log(`[${SIG}·DB] ✓ Schéma Drizzle appliqué avec succès à la base embarquée.`);
    } catch (migrationError) {
      console.warn(`[${SIG}·DB] ⚠ Impossible d'appliquer les migrations sur PGlite :`, migrationError.message);
    }

    current = pgliteDb;
    pool = null;

    status = {
      mode: 'pglite',
      connected: true,
      database: `pglite:${dataDir}`,
      host: 'embarqué',
      latencyMs: 0,
      checkedAt: Date.now(),
    };

    console.warn(
      `[${SIG}·DB] ⚠ PostgreSQL distant injoignable ➔ Bascule vers PGlite WASM embarqué (${dataDir}).`
    );
    return true;
  } catch (err) {
    console.error(`[${SIG}·DB] ✖ Échec critique d'initialisation de PGlite :`, err);
    return false;
  }
}

// ─── INITIALISATION ET DÉMARRAGE DU SERVICE ──────────────────────────────────

/**
 * Initialise, teste et déploie le pilote de persistance optimal.
 * @returns {Promise<object>}
 */
export async function initDatabase() {
  const probe = await probePostgres();

  if (probe.ok) {
    status = {
      mode: 'postgres',
      connected: true,
      database: TARGET.database,
      host: TARGET.host,
      latencyMs: probe.latencyMs,
      checkedAt: Date.now(),
    };
    console.log(
      `[${SIG}·DB] ✓ PostgreSQL connecté avec succès ➔ ${TARGET.database}@${TARGET.host} (${probe.latencyMs}ms)`
    );
    return status;
  }

  console.warn(`[${SIG}·DB] ⚠ PostgreSQL distant injoignable (${probe.error ?? 'Raison inconnue'})`);

  const switched = await switchToPglite();
  if (!switched) {
    status = {
      mode: 'postgres',
      connected: false,
      database: TARGET.database,
      host: TARGET.host,
      latencyMs: probe.latencyMs,
      checkedAt: Date.now(),
      error: probe.error,
    };
    throw new Error(
      `[${SIG}·DB] Erreur fatale : aucun système de base de données disponible. ` +
      `Vérifiez que PostgreSQL est actif sur ${TARGET.host}:${TARGET.database} ou basculez sur DB_FALLBACK=pglite.`
    );
  }
  return status;
}

/**
 * Récupère l'instance de connexion active après validation de connexion.
 * @returns {Promise<object>}
 */
export async function getDb() {
  if (!status.connected) await initDatabase();
  return current;
}

/**
 * Libère proprement les ressources et ferme le pool avant extinction.
 */
export async function closeDb() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
  status.connected = false;
  console.log(`[${SIG}·DB] Pool de connexions fermé.`);
}
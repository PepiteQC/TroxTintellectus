/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — TROXT-MASTER-SERVER.MJS  v2.0 PLATINUM EDITION
 * Serveur maître unifié de TroxtWorld
 * Chemin : troxt-master-server.mjs
 * Port   : 4100
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🆕 v2.0 :
 *   • Auth JWT + sessions + reconnect tokens + OAuth
 *   • Permissions granulaires (roles hiérarchiques)
 *   • Anti-cheat (speed, teleport, rapid-fire, trust score)
 *   • Rate limiting multi-niveaux + DDoS basic
 *   • Rooms multi-instances + matchmaking
 *   • Social (party, friends, requests)
 *   • Chat channels + commandes slash
 *   • Voice WebRTC signaling
 *   • Metrics Prometheus + SSE dashboard
 *   • Admin étendu (bans persistants, give, tp, hot reload)
 *   • Webhooks Discord/Slack
 *   • Backup auto + hot reload config
 *   • Compression WS + interest management amélioré
 */

import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════════
// SOUS-SYSTÈMES — imports dynamiques avec fallback
// ═══════════════════════════════════════════════════════════════════════════════
let TroxtKernel = null;
let TroxtMechanics = null;
let TroxtPhysics = null;
let installPhysicsBridge = null;
let TroxtLuaRuntime = null;

try { ({ TroxtKernel } = await import('./core/troxt-kernel.mjs')); } catch {}
try { ({ TroxtMechanics } = await import('./core/troxt-mechanics.mjs')); } catch {}
try { ({ TroxtPhysics } = await import('./core/troxt-physics.mjs')); } catch {}
try { ({ installPhysicsBridge } = await import('./core/troxt-physics-bridge.mjs')); } catch {}
try { ({ TroxtLuaRuntime } = await import('./core/troxt-lua-runtime.mjs')); } catch {}

// ═══════════════════════════════════════════════════════════════════════════════
// IDENTITÉ & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const SIG = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';
const VERSION = '2.0.0';

const CFG = {
  port: parseInt(process.env.PORT || '4100', 10),
  tickHz: parseInt(process.env.TICK_HZ || '20', 10),
  maxPlayers: parseInt(process.env.MAX_PLAYERS || '500', 10),
  maxRoomPlayers: 50,
  timeoutSec: 30,
  authTimeoutMs: 5000,
  luaDir: process.env.LUA_DIR || path.join(__dirname, 'lua'),
  enableLua: process.env.ENABLE_LUA !== 'false',
  enablePhysics: process.env.ENABLE_PHYSICS !== 'false',
  enableDb: process.env.ENABLE_DB !== 'false',
  runMigrations: process.env.RUN_MIGRATIONS === 'true',
  saveIntervalSec: 60,
  zoiRadius: 300,
  batchEveryTicks: 3,
  luaBridge: process.env.LUA_BRIDGE_URL || 'http://localhost:4200/lua/emit',

  // 🆕 v2.0
  jwtSecret: process.env.TROXT_JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtExpiry: '24h',
  refreshExpiry: '7d',
  sessionTTLMs: 24 * 60 * 60 * 1000,
  reconnectWindowMs: 5 * 60 * 1000,

  // Rate limiting
  rateLimit: {
    wsMsgPerSec: 60,
    wsMsgBurst: 120,
    httpPerMin: 120,
    loginAttemptsPerMin: 5,
    chatPer10Sec: 5,
    actionsPerSec: 30,
  },

  // Anti-cheat
  anticheat: {
    enabled: true,
    maxSpeedWalk: 4,
    maxSpeedRun: 10,
    maxSpeedSprint: 15,
    maxTeleportM: 100,
    maxFireRateMult: 1.5,
    trustDecayPerMin: 0.5,
    trustMin: 0,
    trustMax: 100,
    minTrustToPlay: 20,
  },

  // Rooms
  defaultRoom: 'world_main',
  rooms: {
    world_main: { maxPlayers: 200, pvp: true, safe: false },
    world_safe: { maxPlayers: 200, pvp: false, safe: true },
    jail:       { maxPlayers: 50, pvp: false, safe: true, restricted: true },
    training:   { maxPlayers: 30, pvp: false, safe: true, dummy: true },
    arena:      { maxPlayers: 50, pvp: true, safe: false, competitive: true },
  },

  // Voice
  voice: {
    enabled: true,
    maxDistance: 50,
    sampleRate: 48000,
  },

  // Backup
  backup: {
    enabled: true,
    intervalSec: 3600,
    dir: process.env.BACKUP_DIR || path.join(__dirname, 'backups'),
    keep: 24,
  },

  // Webhooks
  webhooks: {
    discord: process.env.DISCORD_WEBHOOK || null,
    slack: process.env.SLACK_WEBHOOK || null,
  },

  // Metrics
  metrics: {
    enabled: true,
    path: '/metrics',
    format: 'prometheus',
  },

  // Logs
  logs: {
    json: process.env.LOG_JSON === 'true',
    color: process.env.NO_COLOR !== 'true',
    level: process.env.LOG_LEVEL || 'info', // debug|info|warn|error
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION & UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function validVector3(value) {
  return isObject(value) &&
    ['x', 'y', 'z'].every((key) => Number.isFinite(Number(value[key])));
}

function toVector3(value, fallback = { x: 0, y: 0, z: 0 }) {
  if (!validVector3(value)) return { ...fallback };
  return {
    x: Number(value.x),
    y: Number(value.y),
    z: Number(value.z),
  };
}

function cleanText(value, maxLength = 64) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

// 🆕 Helpers additionnels
const dist2D = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.z || 0) - (b.z || 0));
const dist3D = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER (enrichi : JSON, niveaux, couleurs)
// ═══════════════════════════════════════════════════════════════════════════════
const T0 = Date.now();
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_ALIAS = { INFO: 'info', WARN: 'warn', ERR: 'error', OK: 'info', WS: 'debug', BOOT: 'info', SEC: 'warn', DB: 'info', TICK: 'debug', MET: 'info', AUTH: 'info', CHAT: 'debug', VOICE: 'debug', ROOM: 'info', RATE: 'warn', HOOK: 'info' };

const COLORS = {
  reset: '\x1b[0m', gray: '\x1b[90m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const LEVEL_COLORS = { debug: COLORS.gray, info: COLORS.cyan, warn: COLORS.yellow, error: COLORS.red };

function log(lvl, mod, msg, data) {
  const aliased = LEVEL_ALIAS[lvl] || lvl.toLowerCase();
  const numLevel = LOG_LEVELS[aliased] ?? 1;
  const minLevel = LOG_LEVELS[CFG.logs.level] ?? 1;
  if (numLevel < minLevel) return;

  const icons = {
    INFO: 'ℹ', WARN: '⚠', ERR: '✖', OK: '✓', WS: '⚡',
    BOOT: '🚀', SEC: '🛡️', DB: '🗄️', TICK: '⬡',
    MET: '📊', AUTH: '🔐', CHAT: '💬', VOICE: '🎤',
    ROOM: '🏠', RATE: '🚦', HOOK: '🔔',
  };

  const ts = new Date().toISOString().slice(11, 23);

  // 🆕 JSON mode
  if (CFG.logs.json) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: aliased,
      module: mod,
      msg,
      data: data || undefined,
      sig: SIG,
    }));
    return;
  }

  // Mode console
  const color = CFG.logs.color ? (LEVEL_COLORS[aliased] || '') : '';
  const reset = CFG.logs.color ? COLORS.reset : '';
  console.log(`[${ts}] ${icons[lvl] || '·'} [${SIG}·${mod}] ${color}${msg}${reset}`);

  if (data) {
    try {
      console.log('   ↳', JSON.stringify(data));
    } catch {
      console.log('   ↳ [données non sérialisables]');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES WEBSOCKET (étendus)
// ═══════════════════════════════════════════════════════════════════════════════
const MSG = {
  // Existing
  HELLO: 'HELLO', WORLD_STATE: 'WORLD_STATE',
  PLAYER_JOIN: 'PLAYER_JOIN', PLAYER_LEAVE: 'PLAYER_LEAVE',
  PLAYER_UPDATE: 'PLAYER_UPDATE', PLAYERS_BATCH: 'PLAYERS_BATCH',
  CHAT_MESSAGE: 'CHAT_MESSAGE', RP_EVENT: 'RP_EVENT',
  DOOR_STATE: 'DOOR_STATE', VEHICLE_SYNC: 'VEHICLE_SYNC',
  PING: 'PING', ERROR: 'ERROR', KICK: 'KICK', SECURITY: 'SECURITY',
  AUTH: 'AUTH', MOVE: 'MOVE', CHAT: 'CHAT', RP_ACTION: 'RP_ACTION',
  INTERACT: 'INTERACT', DRIVE: 'DRIVE', ATTACK: 'ATTACK',
  JUMP: 'JUMP', PONG: 'PONG', DOOR: 'DOOR',

  // 🆕 v2.0
  AUTH_OK: 'AUTH_OK',
  AUTH_FAIL: 'AUTH_FAIL',
  AUTH_REFRESH: 'AUTH_REFRESH',
  RECONNECT: 'RECONNECT',

  ROOM_LIST: 'ROOM_LIST',
  ROOM_JOIN: 'ROOM_JOIN',
  ROOM_LEAVE: 'ROOM_LEAVE',
  ROOM_JOINED: 'ROOM_JOINED',
  ROOM_STATE: 'ROOM_STATE',

  PARTY_CREATE: 'PARTY_CREATE',
  PARTY_INVITE: 'PARTY_INVITE',
  PARTY_JOIN: 'PARTY_JOIN',
  PARTY_LEAVE: 'PARTY_LEAVE',
  PARTY_UPDATE: 'PARTY_UPDATE',
  PARTY_CHAT: 'PARTY_CHAT',

  FRIEND_ADD: 'FRIEND_ADD',
  FRIEND_REMOVE: 'FRIEND_REMOVE',
  FRIEND_REQUEST: 'FRIEND_REQUEST',
  FRIEND_ACCEPT: 'FRIEND_ACCEPT',
  FRIEND_LIST: 'FRIEND_LIST',

  VOICE_JOIN: 'VOICE_JOIN',
  VOICE_LEAVE: 'VOICE_LEAVE',
  VOICE_SIGNAL: 'VOICE_SIGNAL',
  VOICE_STATE: 'VOICE_STATE',

  CHAT_COMMAND: 'CHAT_COMMAND',
  CHAT_WHISPER: 'CHAT_WHISPER',
  CHAT_SYSTEM: 'CHAT_SYSTEM',

  INVENTORY_SYNC: 'INVENTORY_SYNC',
  INVENTORY_USE: 'INVENTORY_USE',
  INVENTORY_DROP: 'INVENTORY_DROP',

  QUEST_SYNC: 'QUEST_SYNC',
  QUEST_ACCEPT: 'QUEST_ACCEPT',
  QUEST_COMPLETE: 'QUEST_COMPLETE',

  NOTIFICATION: 'NOTIFICATION',
  METRICS_UPDATE: 'METRICS_UPDATE',
  TRUST_UPDATE: 'TRUST_UPDATE',
  RATE_LIMIT: 'RATE_LIMIT',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSIONS (rôles hiérarchiques)
// ═══════════════════════════════════════════════════════════════════════════════
const ROLE_HIERARCHY = { player: 0, vip: 1, mod: 2, admin: 3, superadmin: 4, owner: 5 };
const PERMISSIONS = {
  player:     ['chat', 'move', 'interact', 'attack', 'vehicle'],
  vip:        ['chat', 'move', 'interact', 'attack', 'vehicle', 'chat_color', 'priority_queue'],
  mod:        ['chat', 'move', 'interact', 'attack', 'vehicle', 'kick', 'mute', 'warn', 'tp_self'],
  admin:      ['*', 'ban', 'give', 'tp_other', 'spawn_vehicle', 'set_weather', 'set_time', 'broadcast'],
  superadmin: ['*'],
  owner:      ['*'],
};

function hasPermission(player, action) {
  if (!player) return false;
  const role = player.role || 'player';
  const perms = PERMISSIONS[role] || [];
  if (perms.includes('*')) return true;
  if (perms.includes(action)) return true;
  return false;
}

function isAtLeast(player, role) {
  const pRank = ROLE_HIERARCHY[player?.role] ?? -1;
  const rRank = ROLE_HIERARCHY[role] ?? 999;
  return pRank >= rRank;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER (multi-niveaux)
// ═══════════════════════════════════════════════════════════════════════════════
class RateLimiter {
  constructor({ perSec, burst }) {
    this.perSec = perSec;
    this.burst = burst;
    this.buckets = new Map();
  }
  check(key) {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) { b = { tokens: this.burst, last: now }; this.buckets.set(key, b); }
    const elapsed = (now - b.last) / 1000;
    b.tokens = Math.min(this.burst, b.tokens + elapsed * this.perSec);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }
  prune(maxAgeMs = 60000) {
    const now = Date.now();
    for (const [k, b] of this.buckets) {
      if (now - b.last > maxAgeMs) this.buckets.delete(k);
    }
  }
  reset(key) { this.buckets.delete(key); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JWT / SESSION
// ═══════════════════════════════════════════════════════════════════════════════
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString();
}
function signJWT(payload, expiresInSec = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac('sha256', CFG.jwtSecret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}
function verifyJWT(token) {
  try {
    const [h, p, s] = String(token).split('.');
    if (!h || !p || !s) return null;
    const expected = b64url(crypto.createHmac('sha256', CFG.jwtSecret).update(`${h}.${p}`).digest());
    if (s !== expected) return null;
    const payload = JSON.parse(b64urlDecode(p));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANTI-CHEAT
// ═══════════════════════════════════════════════════════════════════════════════
class AntiCheat {
  constructor(cfg) {
    this.cfg = cfg;
    this.violations = new Map(); // playerId → count
  }

  record(player, type, details = {}) {
    const pid = player.id;
    const entry = this.violations.get(pid) || { count: 0, history: [] };
    entry.count += 1;
    entry.history.push({ type, ts: Date.now(), ...details });
    if (entry.history.length > 20) entry.history.shift();
    this.violations.set(pid, entry);

    // Décrémente trust
    player.trust = clamp((player.trust ?? 100) - (details.severity ?? 5), 0, 100);
    log('SEC', 'ANTICHEAT', `${type} — ${player.username} (trust ${player.trust})`, details);

    return { violations: entry.count, trust: player.trust, shouldKick: player.trust < this.cfg.minTrustToPlay };
  }

  checkMovement(player, newPos, dtMs) {
    if (!this.cfg.enabled) return null;
    const dist = dist3D(player.pos, newPos);
    const dtSec = Math.max(dtMs / 1000, 0.001);
    const speed = dist / dtSec;
    const maxAllowed = player.inVehicle ? this.cfg.maxSpeedSprint * 3 : this.cfg.maxSpeedSprint;

    // Téléport
    if (dist > this.cfg.maxTeleportM) {
      return { type: 'TELEPORT', severity: 20, dist, speed };
    }
    // Speed hack
    if (speed > maxAllowed * 2) {
      return { type: 'SPEED_HACK', severity: 15, speed, maxAllowed };
    }
    // Petites anomalies : on accumule
    if (speed > maxAllowed) {
      return { type: 'SPEED_WARN', severity: 2, speed, maxAllowed };
    }
    return null;
  }

  checkFireRate(player, weaponRpm) {
    if (!this.cfg.enabled) return null;
    const now = Date.now();
    const minInterval = (60 / weaponRpm) * 1000 / this.cfg.maxFireRateMult;
    const last = player._lastFireAt || 0;
    if (now - last < minInterval) {
      return { type: 'RAPID_FIRE', severity: 10, delta: now - last, min: minInterval };
    }
    player._lastFireAt = now;
    return null;
  }

  checkCash(player, newCash) {
    if (!this.cfg.enabled) return null;
    const delta = newCash - (player.rp.cash || 0);
    // Gain cash > 1M en 1 tick = suspect
    if (delta > 1_000_000) {
      return { type: 'CASH_ANOMALY', severity: 30, delta };
    }
    return null;
  }

  decayTrust(player, dtSec) {
    if (!this.cfg.enabled) return;
    // Régénération lente du trust au repos
    const regen = (dtSec / 60) * this.cfg.trustDecayPerMin * 0.5;
    player.trust = clamp((player.trust ?? 100) + regen, this.cfg.trustMin, this.cfg.trustMax);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVEUR MAÎTRE
// ═══════════════════════════════════════════════════════════════════════════════
class TroxtMasterServer {
  constructor() {
    this.sig = SIG;
    this.version = VERSION;

    this.kernel = null;
    this.mechanics = null;
    this.physics = null;
    this.lua = null;
    this.db = null;
    this.app = null;
    this.server = null;
    this.wss = null;

    this.players = new Map();
    this.sockets = new Map();

    // 🆕 v2.0
    this.sessions = new Map();       // sessionId → { playerId, expiresAt }
    this.reconnectTokens = new Map(); // token → playerId
    this.rooms = new Map();          // roomId → { players: Set, meta }
    this.parties = new Map();        // partyId → { leaderId, members: Set }
    this.friends = new Map();        // playerId → Set(friendId)
    this.friendRequests = new Map(); // playerId → Set(fromId)
    this.bans = new Map();           // playerId → { reason, until }
    this.mutes = new Map();          // playerId → until
    this.whitelist = new Set();      // playerIds autorisés
    this.anticheat = new AntiCheat(CFG.anticheat);
    this.rateLimiters = {
      ws: new RateLimiter({ perSec: CFG.rateLimit.wsMsgPerSec, burst: CFG.rateLimit.wsMsgBurst }),
      http: new RateLimiter({ perSec: CFG.rateLimit.httpPerMin / 60, burst: CFG.rateLimit.httpPerMin }),
      chat: new RateLimiter({ perSec: CFG.rateLimit.chatPer10Sec / 10, burst: CFG.rateLimit.chatPer10Sec }),
      action: new RateLimiter({ perSec: CFG.rateLimit.actionsPerSec, burst: CFG.rateLimit.actionsPerSec * 2 }),
      login: new RateLimiter({ perSec: CFG.rateLimit.loginAttemptsPerMin / 60, burst: CFG.rateLimit.loginAttemptsPerMin }),
    };
    this.metricsSSEClients = new Set();

    this.running = false;
    this.degraded = [];
    this._tickTimer = null;
    this._saveTimer = null;
    this._watchdog = null;
    this._pruneTimer = null;
    this._backupTimer = null;
    this._shuttingDown = false;
    this._currentTickT0 = 0;

    this.metrics = {
      startedAt: Date.now(),
      connects: 0,
      disconnects: 0,
      reconnects: 0,
      messages: 0,
      peakPlayers: 0,
      ticks: 0,
      securityBlocks: 0,
      anticheatViolations: 0,
      rateLimitBlocks: 0,
      dbSaves: 0,
      errors: 0,
      lastTickMs: 0,
      avgTickMs: 0,
      chatsSent: 0,
      commandsUsed: 0,
      voiceSignals: 0,
      partiesCreated: 0,
      roomTransfers: 0,
      bytesSent: 0,
      bytesReceived: 0,
    };
  }

  async boot() {
    this._printBanner();

    // 🆕 Init rooms
    for (const [id, meta] of Object.entries(CFG.rooms)) {
      this.rooms.set(id, { id, players: new Set(), meta });
    }

    await this._bootDatabase();
    this._bootKernel();
    await this._bootLua();
    await this._bootPhysics();
    this._bootMechanics();
    this._bootHttp();
    this._bootWebSocket();
    this._wireEvents();
    this._bootTickLoop();
    this._bootWatchdog();
    this._bootPrune();
    this._bootBackup();
    await this._listen();

    this.running = true;
    this._printReady();

    return this;
  }

  _printBanner() {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log(`  ║   ${SIG}  TROXTWORLD MASTER SERVER  v${VERSION}         ║`);
    console.log(`  ║   ${ISIG}  Sécurité intégrée                    ║`);
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log('');

    log('BOOT', 'MASTER', 'Séquence de démarrage initiée...');
  }

  // ── 1. Base de données ──────────────────────────────────────────────────────
  async _bootDatabase() {
    if (!CFG.enableDb) {
      this.degraded.push('database');
      return;
    }

    log('BOOT', 'DB', 'Étape 1 — Base de données (TroxtPrism)...');

    try {
      const mod = await import('./database/index.js');
      this.db = mod;

      const health = await mod.health();
      if (!health.alive) {
        throw new Error(health.error || 'Base de données inaccessible');
      }

      log('OK', 'DB', `PostgreSQL connecté (${health.latency_ms}ms)`);

      if (CFG.runMigrations) {
        const migration = await import('./database/migrate.js');
        await migration.runMigrations();
        await migration.ensureWorldState();
        log('OK', 'DB', 'Migrations appliquées');
      }

      // 🆕 v2.0 : tables additionnelles (bans, friends, sessions)
      await this._ensureExtendedTables();
    } catch (error) {
      this.db = null;
      this.degraded.push('database');
      log('WARN', 'DB', `Indisponible: ${error.message} — MODE DÉGRADÉ`);
    }
  }

  async _ensureExtendedTables() {
    if (!this.db?.pool) return;
    try {
      await this.db.pool.query(`
        CREATE TABLE IF NOT EXISTS troxt_bans (
          player_id TEXT PRIMARY KEY,
          reason TEXT,
          banned_by TEXT,
          banned_at TIMESTAMPTZ DEFAULT now(),
          expires_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS troxt_friends (
          player_id TEXT,
          friend_id TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (player_id, friend_id)
        );
        CREATE TABLE IF NOT EXISTS troxt_sessions (
          session_id TEXT PRIMARY KEY,
          player_id TEXT,
          token TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          expires_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS troxt_inventory (
          player_id TEXT,
          item_id TEXT,
          qty INT DEFAULT 1,
          metadata JSONB,
          PRIMARY KEY (player_id, item_id)
        );
      `);
      log('OK', 'DB', 'Tables étendues prêtes');
    } catch (error) {
      log('WARN', 'DB', `Migration étendue: ${error.message}`);
    }
  }

  // ── 2. Kernel ───────────────────────────────────────────────────────────────
  _bootKernel() {
    log('BOOT', 'KERNEL', 'Étape 2 — Kernel de coordination...');

    const luaEmit = (event, data) => this._toLuaBridge(event, data);
    const wsBroadcast = (json) => this._broadcastRaw(json);

    if (TroxtKernel) {
      this.kernel = new TroxtKernel({ luaEmit, wsBroadcast });
      log('OK', 'KERNEL', 'Kernel actif');
    } else {
      this.kernel = this._createStubKernel();
      this.degraded.push('kernel');
      log('WARN', 'KERNEL', 'Kernel absent — stub activé');
    }
  }

  // ── 3. Lua ──────────────────────────────────────────────────────────────────
  async _bootLua() {
    if (!CFG.enableLua || !TroxtLuaRuntime) {
      this._registerStubBrainSecurity();
      this.degraded.push('lua');
      log('WARN', 'LUA', TroxtLuaRuntime ? 'Désactivé' : 'Runtime Lua absent — stubs activés');
      return;
    }

    log('BOOT', 'LUA', 'Étape 3 — Cerveau TROXT⬡ + Intellectus (Lua)...');

    try {
      this.lua = new TroxtLuaRuntime(this.kernel);
      await this.lua.init();
      await this.lua.loadAll(CFG.luaDir);
      this.lua.attachToKernel();

      const stats = this.lua.getStats();
      log('OK', 'LUA', `${stats.modules} modules Lua actifs`);
    } catch (error) {
      this.lua = null;
      this._registerStubBrainSecurity();
      this.degraded.push('lua');
      log('WARN', 'LUA', `Échec: ${error.message} — stubs activés`);
    }
  }

  _registerStubBrainSecurity() {
    this.kernel.register('brain', {
      decide: () => ({ via: SIG }),
      tick: () => {},
    });
    this.kernel.register('intellectus', {
      checkAction: () => ({ allowed: true }),
      tick: () => {},
    });
  }

  // ── 4. Physique ─────────────────────────────────────────────────────────────
  async _bootPhysics() {
    if (!CFG.enablePhysics || !TroxtPhysics) {
      this.physics = null;
      this.degraded.push('physics');
      log('WARN', 'PHYSICS', 'Physique désactivée ou module absent');
      return;
    }

    log('BOOT', 'PHYSICS', 'Étape 4 — Rapier WASM...');

    try {
      const mod = await import('@dimforge/rapier3d-compat');
      const RAPIER = mod.default || mod;

      this.physics = new TroxtPhysics(this.kernel);
      await this.physics.init(RAPIER);
      this.physics.addGround(0);

      log('OK', 'PHYSICS', 'Rapier WASM actif');
    } catch (error) {
      this.physics = null;
      this.degraded.push('physics');
      log('WARN', 'PHYSICS', `Indisponible: ${error.message}`);
    }
  }

  // ── 5. Mécaniques ───────────────────────────────────────────────────────────
  _bootMechanics() {
    log('BOOT', 'MECH', 'Étape 5 — Mécaniques RP...');

    if (TroxtMechanics) {
      this.mechanics = new TroxtMechanics(this.kernel);
      this.mechanics.install();
      this.kernel.register('mechanics', this.mechanics);
    } else {
      this.mechanics = this._createStubMechanics();
      this.degraded.push('mechanics');
      log('WARN', 'MECH', 'Mécaniques absentes — stub activé');
    }

    if (this.physics && installPhysicsBridge) {
      installPhysicsBridge({
        kernel: this.kernel,
        physics: this.physics,
        mechanics: this.mechanics,
      });
      log('OK', 'MECH', 'Mécaniques et physique reliées');
    } else {
      log('OK', 'MECH', 'Mécaniques actives sans pont physique');
    }
  }

  // ── 6. HTTP ─────────────────────────────────────────────────────────────────
  _bootHttp() {
    log('BOOT', 'HTTP', 'Étape 6 — API REST...');

    const app = express();

    app.disable('x-powered-by');
    app.use(express.json({ limit: '256kb' }));

    // 🆕 Rate limit HTTP global
    app.use((req, res, next) => {
      const ip = req.socket.remoteAddress || 'unknown';
      if (!this.rateLimiters.http.check(ip)) {
        this.metrics.rateLimitBlocks++;
        return res.status(429).json({ error: 'Trop de requêtes', sig: SIG });
      }
      next();
    });

    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-TROXT-Key, X-TROXT-Token');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('X-TROXT-Signature', 'TROXT-SIG');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });

    app.use((error, _req, res, next) => {
      if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({ error: 'JSON invalide', sig: SIG });
      }
      if (error?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Requête trop volumineuse', sig: SIG });
      }
      next(error);
    });

    this._setupRoutes(app);
    this.app = app;
    this.server = createServer(app);

    log('OK', 'HTTP', 'Routes REST prêtes');
  }

  _setupRoutes(app) {
    // ── Endpoints originaux (conservés) ──
    app.get('/api/status', (_req, res) => {
      res.json({
        sig: SIG,
        version: VERSION,
        status: this.running ? 'online' : 'booting',
        players: this.players.size,
        max_players: CFG.maxPlayers,
        tick_rate: CFG.tickHz,
        uptime_sec: Math.floor((Date.now() - this.metrics.startedAt) / 1000),
        degraded: this.degraded,
        health: this.kernel?.getHealth?.().grade,
      });
    });

    app.get('/api/players', (_req, res) => {
      res.json({
        ok: true,
        count: this.players.size,
        players: [...this.players.values()].map((player) => ({
          id: player.id,
          username: player.username,
          room: player.roomId,
          ping_ms: player.pingMs,
          pos: player.pos,
          wanted: player.rp.wanted,
          job: player.rp.job,
          health: player.rp.needs.health,
        })),
        sig: SIG,
      });
    });

    app.get('/api/admin/metrics', this._adminGuard.bind(this), async (_req, res) => {
      try {
        res.json({
          sig: SIG,
          ...this.metrics,
          players_online: this.players.size,
          uptime_sec: Math.floor((Date.now() - this.metrics.startedAt) / 1000),
          memory_mb: +(process.memoryUsage().heapUsed / 1048576).toFixed(1),
          kernel: this.kernel?.getReport?.(),
          lua: this.lua?.getStats?.(),
          physics: this.physics?.getStats?.(),
          mechanics: this.mechanics?.getStats?.(),
          database: this.db ? await this.db.health() : { alive: false, degraded: true },
          rooms: [...this.rooms.values()].map((r) => ({ id: r.id, players: r.players.size })),
          anticheat: { violations: this.anticheat.violations.size },
        });
      } catch (error) {
        this.metrics.errors++;
        res.status(500).json({ error: 'Impossible de lire les métriques', sig: SIG });
      }
    });

    app.get('/api/health', (_req, res) => {
      const health = this.kernel?.getHealth?.() || { score: 0, grade: 'INCONNU' };
      res.status(health.score >= 50 ? 200 : 503).json({ ...health, degraded: this.degraded, sig: SIG });
    });

    app.post('/api/admin/kick', this._adminGuard.bind(this), (req, res) => {
      const playerId = cleanText(req.body?.player_id, 64);
      const reason = cleanText(req.body?.reason, 128) || 'Expulsion admin';
      const player = this.players.get(playerId);

      if (!player) return res.status(404).json({ error: 'Joueur introuvable', sig: SIG });

      this._send(player.ws, MSG.KICK, { reason });
      setTimeout(() => {
        if (player.ws.readyState === WebSocket.OPEN) player.ws.close(1008, reason);
      }, 500);

      res.json({ ok: true, kicked: playerId, sig: SIG });
    });

    app.post('/api/admin/broadcast', this._adminGuard.bind(this), (req, res) => {
      const message = cleanText(req.body?.message, 512);
      if (!message) return res.status(400).json({ error: 'Message requis', sig: SIG });

      this._broadcast(MSG.CHAT_MESSAGE, {
        from: '[SERVEUR]',
        username: SIG,
        content: message,
        type: 'global',
        server: true,
        ts: Date.now(),
      });

      res.json({ ok: true, sent: this.players.size, sig: SIG });
    });

    app.post('/api/admin/lua', this._adminGuard.bind(this), (req, res) => {
      const moduleName = cleanText(req.body?.module, 64);
      const fn = cleanText(req.body?.fn, 64);
      const args = Array.isArray(req.body?.args) ? req.body.args : [];

      if (!this.lua) return res.status(503).json({ error: 'Lua indisponible', sig: SIG });
      if (!moduleName || !fn || args.length > 32) {
        return res.status(400).json({ error: 'Paramètres invalides', sig: SIG });
      }

      try {
        const result = this.lua.call(moduleName, fn, ...args);
        res.json({ ok: true, result, sig: SIG });
      } catch (error) {
        this.metrics.errors++;
        res.status(500).json({ error: 'Échec de l’appel Lua', sig: SIG });
      }
    });

    // ═══════════════════════════════════════════════════════════════════
    // 🆕 v2.0 — NOUVEAUX ENDPOINTS
    // ═══════════════════════════════════════════════════════════════════

    // Auth
    app.post('/api/auth/login', (req, res) => {
      const ip = req.socket.remoteAddress || 'unknown';
      if (!this.rateLimiters.login.check(ip)) {
        this.metrics.rateLimitBlocks++;
        return res.status(429).json({ error: 'Trop de tentatives', sig: SIG });
      }

      const username = cleanText(req.body?.username, 32);
      const password = String(req.body?.password || '');

      if (!username || password.length < 3) {
        return res.status(400).json({ error: 'Identifiants invalides', sig: SIG });
      }

      // ⚠️ TODO : vérifier hash en DB. Ici génération simple pour démo.
      const playerId = `p_${crypto.createHash('sha256').update(username).digest('hex').slice(0, 16)}`;
      const accessToken = signJWT({ pid: playerId, u: username, role: 'player' }, 86400);
      const refreshToken = signJWT({ pid: playerId, type: 'refresh' }, 7 * 86400);
      const reconnectToken = crypto.randomBytes(16).toString('hex');

      this.reconnectTokens.set(reconnectToken, playerId);

      res.json({
        ok: true,
        player_id: playerId,
        access_token: accessToken,
        refresh_token: refreshToken,
        reconnect_token: reconnectToken,
        expires_in: 86400,
        sig: SIG,
      });
    });

    app.post('/api/auth/refresh', (req, res) => {
      const refresh = String(req.body?.refresh_token || '');
      const payload = verifyJWT(refresh);
      if (!payload || payload.type !== 'refresh') {
        return res.status(401).json({ error: 'Refresh invalide', sig: SIG });
      }
      const accessToken = signJWT({ pid: payload.pid, role: 'player' }, 86400);
      res.json({ ok: true, access_token: accessToken, expires_in: 86400, sig: SIG });
    });

    app.get('/api/auth/verify', (req, res) => {
      const token = req.get('x-troxt-token') || (req.get('authorization') || '').replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return res.status(401).json({ error: 'Token invalide', sig: SIG });
      res.json({ ok: true, payload, sig: SIG });
    });

    // Rooms
    app.get('/api/rooms', (_req, res) => {
      res.json({
        ok: true,
        rooms: [...this.rooms.values()].map((r) => ({
          id: r.id,
          players: r.players.size,
          max: r.meta.maxPlayers,
          pvp: r.meta.pvp,
          safe: r.meta.safe,
        })),
        sig: SIG,
      });
    });

    // Metrics Prometheus
    app.get(CFG.metrics.path, (_req, res) => {
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(this._metricsPrometheus());
    });

    // SSE dashboard
    app.get('/api/admin/stream', this._adminGuard.bind(this), (req, res) => {
      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.flushHeaders?.();
      this.metricsSSEClients.add(res);
      const interval = setInterval(() => {
        try {
          res.write(`data: ${JSON.stringify(this._metricsSnapshot())}\n\n`);
        } catch { clearInterval(interval); this.metricsSSEClients.delete(res); }
      }, 2000);
      req.on('close', () => {
        clearInterval(interval);
        this.metricsSSEClients.delete(res);
      });
    });

    // Bans
    app.post('/api/admin/ban', this._adminGuard.bind(this), async (req, res) => {
      const playerId = cleanText(req.body?.player_id, 64);
      const reason = cleanText(req.body?.reason, 256) || 'Banni par admin';
      const durationMin = parseInt(req.body?.duration_min || '0', 10);
      if (!playerId) return res.status(400).json({ error: 'player_id requis', sig: SIG });

      const until = durationMin > 0 ? Date.now() + durationMin * 60000 : null;
      this.bans.set(playerId, { reason, until, by: 'admin', at: Date.now() });

      const player = this.players.get(playerId);
      if (player) {
        this._send(player.ws, MSG.KICK, { reason: `Banni: ${reason}` });
        player.ws.close(1008, 'Banned');
      }

      if (this.db?.pool) {
        await this.db.pool.query(
          `INSERT INTO troxt_bans (player_id, reason, banned_by, expires_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (player_id) DO UPDATE SET reason=$2, expires_at=$4`,
          [playerId, reason, 'admin', until ? new Date(until) : null],
        ).catch(() => {});
      }

      res.json({ ok: true, banned: playerId, until, sig: SIG });
    });

    app.delete('/api/admin/ban/:playerId', this._adminGuard.bind(this), async (req, res) => {
      const playerId = cleanText(req.params.playerId, 64);
      this.bans.delete(playerId);
      if (this.db?.pool) {
        await this.db.pool.query('DELETE FROM troxt_bans WHERE player_id=$1', [playerId]).catch(() => {});
      }
      res.json({ ok: true, sig: SIG });
    });

    // Give
    app.post('/api/admin/give', this._adminGuard.bind(this), (req, res) => {
      const playerId = cleanText(req.body?.player_id, 64);
      const item = cleanText(req.body?.item, 64);
      const qty = clamp(parseInt(req.body?.qty || '1', 10), 1, 1000);
      const player = this.players.get(playerId);
      if (!player) return res.status(404).json({ error: 'Joueur introuvable', sig: SIG });

      this._send(player.ws, MSG.INVENTORY_SYNC, { action: 'ADD', item, qty });
      res.json({ ok: true, sig: SIG });
    });

    // TP
    app.post('/api/admin/tp', this._adminGuard.bind(this), (req, res) => {
      const playerId = cleanText(req.body?.player_id, 64);
      const pos = toVector3(req.body?.pos);
      const player = this.players.get(playerId);
      if (!player) return res.status(404).json({ error: 'Joueur introuvable', sig: SIG });

      player.pos = pos;
      this._send(player.ws, MSG.RP_EVENT, { type: 'TELEPORT', pos });
      res.json({ ok: true, sig: SIG });
    });

    // Hot reload Lua
    app.post('/api/admin/lua/reload', this._adminGuard.bind(this), async (_req, res) => {
      if (!this.lua) return res.status(503).json({ error: 'Lua indisponible', sig: SIG });
      try {
        await this.lua.loadAll(CFG.luaDir);
        res.json({ ok: true, modules: this.lua.getStats().modules, sig: SIG });
      } catch (error) {
        res.status(500).json({ error: error.message, sig: SIG });
      }
    });
  }

  _adminGuard(req, res, next) {
    const configuredKey = process.env.TROXT_ADMIN_KEY;
    const suppliedKey = req.get('x-troxt-key');

    if (!configuredKey || configuredKey === 'CHANGE_ME_ADMIN') {
      return res.status(503).json({
        error: 'Administration désactivée : configure TROXT_ADMIN_KEY',
        sig: ISIG,
      });
    }

    if (typeof suppliedKey !== 'string' || suppliedKey !== configuredKey) {
      this.metrics.securityBlocks++;
      return res.status(403).json({ error: 'Clé admin invalide', sig: ISIG });
    }
    next();
  }

  // ── 7. WebSocket ────────────────────────────────────────────────────────────
  _bootWebSocket() {
    log('BOOT', 'WS', 'Étape 7 — WebSocket...');

    this.wss = new WebSocketServer({
      server: this.server,
      path: '/ws',
      maxPayload: 256 * 1024,
      perMessageDeflate: { // 🆕 Compression
        zlibDeflateOptions: { level: 6, memLevel: 8 },
        threshold: 1024,
      },
    });

    this.wss.on('connection', (ws, req) => this._onConnection(ws, req));

    log('OK', 'WS', 'WebSocket prêt sur /ws (compression activée)');
  }

  _onConnection(ws, req) {
    const ip = req.socket.remoteAddress || 'unknown';
    this.metrics.connects++;

    const authTimer = setTimeout(() => {
      if (!this.sockets.has(ws)) {
        log('WARN', 'WS', `Auth timeout ${ip}`);
        ws.close(1008, 'Authentication timeout');
      }
    }, CFG.authTimeoutMs);

    ws.on('message', (raw) => {
      this.metrics.messages++;
      this.metrics.bytesReceived += raw.length;

      // 🆕 Rate limiting WS
      const rlKey = `${ip}:${this.sockets.get(ws) || 'unauth'}`;
      if (!this.rateLimiters.ws.check(rlKey)) {
        this.metrics.rateLimitBlocks++;
        this._send(ws, MSG.RATE_LIMIT, { action: 'message', retry_ms: 1000 });
        return;
      }

      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        this._send(ws, MSG.ERROR, { code: 'PARSE_ERROR' });
        return;
      }

      if (!isObject(msg) || typeof msg.type !== 'string') {
        this._send(ws, MSG.ERROR, { code: 'INVALID_MESSAGE' });
        return;
      }

      Promise.resolve(this._handleMessage(ws, msg, ip))
        .then(() => {
          if (msg.type === MSG.AUTH && this.sockets.has(ws)) {
            clearTimeout(authTimer);
          }
        })
        .catch((error) => {
          this.metrics.errors++;
          log('ERR', 'WS', `Traitement message: ${error.message}`);
          this._send(ws, MSG.ERROR, { code: 'INTERNAL_ERROR' });
        });
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      this._removePlayer(ws);
    });

    ws.on('error', () => {
      clearTimeout(authTimer);
      this._removePlayer(ws);
    });
  }

  async _handleMessage(ws, msg, ip) {
    const type = msg.type;
    const data = isObject(msg.data) ? msg.data : {};

    // ── Auth (conservé + étendu) ──
    if (type === MSG.AUTH || type === MSG.RECONNECT) {
      if (this.sockets.has(ws)) {
        this._send(ws, MSG.ERROR, { code: 'ALREADY_AUTHED' });
        return;
      }
      return this._authPlayer(ws, data, ip, type === MSG.RECONNECT);
    }

    const playerId = this.sockets.get(ws);
    if (!playerId) {
      this._send(ws, MSG.ERROR, { code: 'NOT_AUTHED' });
      return;
    }

    const player = this.players.get(playerId);
    if (!player) return;

    player.lastSeen = Date.now();
    const ctx = { playerId, ip };

    // ── Rate limit actions (sauf ping) ──
    if (type !== MSG.PONG && type !== MSG.PING) {
      if (!this.rateLimiters.action.check(playerId)) {
        this.metrics.rateLimitBlocks++;
        this._send(ws, MSG.RATE_LIMIT, { action: type });
        return;
      }
    }

    switch (type) {
      // ── MOVE (conservé + anti-cheat) ──
      case MSG.MOVE: {
        if (!validVector3(data.pos) || (data.rot != null && !validVector3(data.rot))) {
          this.metrics.securityBlocks++;
          this._send(ws, MSG.ERROR, { code: 'INVALID_POSITION', rollback: player.pos });
          break;
        }

        const pos = toVector3(data.pos);
        const rot = data.rot ? toVector3(data.rot, player.rot) : player.rot;
        const vel = validVector3(data.vel) ? toVector3(data.vel) : player.vel;

        // 🆕 Anti-cheat
        const dtMs = Date.now() - (player.lastPosTs || Date.now());
        const violation = this.anticheat.checkMovement(player, pos, dtMs);
        if (violation) {
          this.metrics.anticheatViolations++;
          const rec = this.anticheat.record(player, violation.type, violation);
          this._send(ws, MSG.TRUST_UPDATE, { trust: rec.trust });
          if (rec.shouldKick) {
            this._send(ws, MSG.KICK, { reason: 'Comportement suspect (anti-cheat)' });
            player.ws.close(1008, 'Anticheat');
            return;
          }
          if (violation.type === 'TELEPORT' || violation.type === 'SPEED_HACK') {
            this._send(ws, MSG.ERROR, { code: 'POSITION_CORRECTION', rollback: player.pos });
            return;
          }
        }

        const result = await this.kernel.route('mech:move', {
          player_id: playerId,
          pos,
          rot,
          vel,
          desiredMove: data.desiredMove,
          anim: cleanText(data.anim, 32),
          inVehicle: Boolean(data.inVehicle),
        }, ctx);

        if (result?.blocked) {
          this.metrics.securityBlocks++;
          this._send(ws, MSG.ERROR, {
            code: result.reason || 'MOVE_BLOCKED',
            rollback: result.decision?.rollback || player.pos,
          });
        } else {
          player.pos = pos;
          player.rot = rot;
          player.vel = vel;
          player.anim = cleanText(data.anim, 32);
          player.lastPosTs = Date.now();

          this._broadcastNearby(playerId, MSG.PLAYER_UPDATE, {
            player_id: playerId,
            pos,
            rot,
            vel,
            anim: player.anim,
            ts: Date.now(),
          });
        }
        break;
      }

      case MSG.CHAT:
        this._handleChat(playerId, data);
        break;

      // 🆕 Commandes slash
      case MSG.CHAT_COMMAND:
        this._handleCommand(player, data);
        break;

      case MSG.RP_ACTION:
        await this.kernel.route('mech:rp_action', { player_id: playerId, ...data }, ctx);
        this._broadcastNearby(playerId, MSG.RP_EVENT, { player_id: playerId, ...data }, 200);
        break;

      case MSG.DOOR:
        await this.kernel.route('doors:action', { player_id: playerId, ...data }, ctx);
        break;

      case MSG.DRIVE:
        if (this.physics) {
          await this.kernel.route('mech:vehicle_drive', { player_id: playerId, ...data }, ctx);
        }
        break;

      // 🆕 ATTACK avec anti-cheat rapid-fire
      case MSG.ATTACK: {
        const rpm = data.weapon === 'pistol' ? 300 : data.weapon === 'smg' ? 750 : 600;
        const rfViolation = this.anticheat.checkFireRate(player, rpm);
        if (rfViolation) {
          this.metrics.anticheatViolations++;
          this.anticheat.record(player, rfViolation.type, rfViolation);
        }
        await this.kernel.route('mech:attack', { player_id: playerId, ...data }, ctx);
        break;
      }

      case MSG.JUMP:
        await this.kernel.route('mech:jump', { player_id: playerId }, ctx);
        break;

      case MSG.INTERACT:
        await this.kernel.route('mech:interact', { player_id: playerId, ...data }, ctx);
        break;

      case MSG.PONG:
        if (player.pingSent) {
          player.pingMs = Date.now() - player.pingSent;
          player.pingSent = null;
        }
        break;

      // ═════════════════════════════════════════════════════════════════
      // 🆕 v2.0 — Nouveaux handlers
      // ═════════════════════════════════════════════════════════════════

      case MSG.ROOM_JOIN:
        this._handleRoomJoin(player, cleanText(data.room, 32));
        break;

      case MSG.ROOM_LEAVE:
        this._handleRoomLeave(player);
        break;

      case MSG.ROOM_LIST:
        this._send(ws, MSG.ROOM_LIST, {
          rooms: [...this.rooms.values()].map((r) => ({
            id: r.id, players: r.players.size, max: r.meta.maxPlayers,
          })),
        });
        break;

      case MSG.PARTY_CREATE:
        this._handlePartyCreate(player);
        break;

      case MSG.PARTY_INVITE:
        this._handlePartyInvite(player, cleanText(data.target, 64));
        break;

      case MSG.PARTY_JOIN:
        this._handlePartyJoin(player, cleanText(data.party_id, 64));
        break;

      case MSG.PARTY_LEAVE:
        this._handlePartyLeave(player);
        break;

      case MSG.PARTY_CHAT:
        this._handlePartyChat(player, cleanText(data.content, 256));
        break;

      case MSG.FRIEND_ADD:
        this._handleFriendAdd(player, cleanText(data.target, 64));
        break;

      case MSG.FRIEND_ACCEPT:
        this._handleFriendAccept(player, cleanText(data.target, 64));
        break;

      case MSG.FRIEND_LIST:
        this._send(ws, MSG.FRIEND_LIST, {
          friends: [...(this.friends.get(playerId) || [])],
          requests: [...(this.friendRequests.get(playerId) || [])],
        });
        break;

      case MSG.VOICE_SIGNAL:
        this._handleVoiceSignal(player, data);
        break;

      case MSG.INVENTORY_USE:
        this._send(ws, MSG.RP_EVENT, { type: 'INVENTORY_USE', item: cleanText(data.item, 64) });
        break;

      default:
        this._send(ws, MSG.ERROR, { code: 'UNKNOWN_MESSAGE' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 AUTH ÉTENDU (JWT + reconnect)
  // ═══════════════════════════════════════════════════════════════════════════
  async _authPlayer(ws, data, ip, isReconnect = false) {
    if (this.players.size >= CFG.maxPlayers) {
      this._send(ws, MSG.ERROR, { code: 'SERVER_FULL' });
      ws.close(1008, 'Server full');
      return;
    }

    // 🆕 Vérifie JWT ou reconnect token
    let playerId = null;
    if (data.token) {
      const payload = verifyJWT(data.token);
      if (payload?.pid) playerId = payload.pid;
    } else if (isReconnect && data.reconnect_token) {
      playerId = this.reconnectTokens.get(data.reconnect_token);
      if (playerId) this.metrics.reconnects++;
    }

    // Fallback : nouveau joueur
    if (!playerId) {
      playerId = uuid();
    }

    // 🆕 Bans check
    const ban = this.bans.get(playerId);
    if (ban) {
      if (ban.until && ban.until < Date.now()) {
        this.bans.delete(playerId);
      } else {
        this._send(ws, MSG.ERROR, { code: 'BANNED', reason: ban.reason });
        ws.close(1008, 'Banned');
        return;
      }
    }

    // 🆕 Lua ban check (conservé)
    if (this.lua) {
      const admin = this.lua.getModule('intellectus_admin');
      if (admin?.is_banned?.(playerId)) {
        this._send(ws, MSG.ERROR, { code: 'BANNED' });
        ws.close(1008, 'Banned');
        return;
      }
    }

    let saved = null;
    if (this.db) {
      try {
        const result = await this.db.pool.query(
          'SELECT * FROM players WHERE id=$1 AND deleted_at IS NULL LIMIT 1',
          [playerId],
        );
        if (result.rows.length) saved = result.rows[0];
      } catch (error) {
        log('WARN', 'DB', `Lecture joueur impossible: ${error.message}`);
      }
    }

    const username = cleanText(saved?.name || data.username, 32) || `Player_${playerId.slice(0, 6)}`;

    const pos = saved
      ? { x: Number(saved.position_x) || 0, y: Number(saved.position_y) || 0, z: Number(saved.position_z) || 0 }
      : toVector3(data.pos);

    const rot = saved
      ? { x: 0, y: Number(saved.heading) || 0, z: 0 }
      : toVector3(data.rot);

    const sessionId = uuid();
    const reconnectToken = crypto.randomBytes(16).toString('hex');

    const player = {
      id: playerId,
      session: sessionId,
      reconnectToken,
      ws,
      roomId: CFG.defaultRoom,
      username,
      pos,
      rot,
      vel: { x: 0, y: 0, z: 0 },
      anim: null,
      rp: {
        health: 100,
        cash: 2500,
        job: saved?.job || null,
        faction: saved?.gang_id || null,
        wanted: 0,
        needs: {
          health: saved?.health ?? 100,
          hunger: saved?.hunger ?? 100,
          thirst: saved?.thirst ?? 100,
          energy: 100,
          stress: 0,
        },
      },
      isAdmin: ['admin', 'superadmin'].includes(saved?.permission),
      role: saved?.permission || 'player', // 🆕
      trust: 100, // 🆕
      level: saved?.job_rank || 1,
      factionRank: 0,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      lastPosTs: Date.now(),
      pingMs: 0,
      pingSent: null,
      inVehicle: false, // 🆕
      muted: false, // 🆕
      voiceChannel: null, // 🆕
    };

    this.players.set(playerId, player);
    this.sockets.set(ws, playerId);
    this.reconnectTokens.set(reconnectToken, playerId);
    this.sessions.set(sessionId, { playerId, expiresAt: Date.now() + CFG.sessionTTLMs });
    this.metrics.peakPlayers = Math.max(this.metrics.peakPlayers, this.players.size);

    // 🆕 Room
    const room = this.rooms.get(player.roomId);
    if (room) room.players.add(playerId);

    this.kernel.addPlayer(playerId, { pos: player.pos, username: player.username });
    this.mechanics.initHealth?.(playerId);

    log('OK', 'AUTH', `Connexion: ${player.username} [${playerId.slice(0, 8)}] depuis ${ip}`);

    this._send(ws, MSG.HELLO, {
      player_id: playerId,
      session: sessionId,
      reconnect_token: reconnectToken,
      username: player.username,
      role: player.role,
      trust: player.trust,
      tick_rate: CFG.tickHz,
      room_id: player.roomId,
      pos: player.pos,
      world_players: [...this.players.values()]
        .filter((other) => other.id !== playerId)
        .map((other) => ({
          id: other.id, username: other.username, pos: other.pos, rot: other.rot,
          rp: { health: other.rp.needs.health, job: other.rp.job, wanted: other.rp.wanted },
        })),
      sig: SIG,
    });

    this._broadcast(MSG.PLAYER_JOIN, {
      player_id: playerId, username: player.username, pos: player.pos, rot: player.rot, rp: player.rp,
    }, playerId);

    // 🆕 Persistance
    if (this.db && !saved) {
      this.db.pool.query(
        `INSERT INTO players
          (id, name, position_x, position_y, position_z, heading, is_online)
         VALUES ($1,$2,$3,$4,$5,$6,true)
         ON CONFLICT (id) DO UPDATE SET is_online=true`,
        [playerId, player.username, player.pos.x, player.pos.y, player.pos.z, player.rot.y],
      ).catch((error) => {
        this.metrics.errors++;
        log('ERR', 'DB', `Création joueur impossible: ${error.message}`);
      });
    }

    // 🆕 Webhook
    this._notifyWebhook(`🟢 ${player.username} connecté`, { playerId, ip });
  }

  _handleChat(playerId, data) {
    const player = this.players.get(playerId);
    if (!player) return;

    // 🆕 Mute check
    if (this.mutes.has(playerId) && this.mutes.get(playerId) > Date.now()) return;
    if (this.lua?.getModule('intellectus_admin')?.is_muted?.(playerId)) return;

    // 🆕 Rate limit chat
    if (!this.rateLimiters.chat.check(playerId)) {
      this.metrics.rateLimitBlocks++;
      this._send(player.ws, MSG.RATE_LIMIT, { action: 'chat' });
      return;
    }

    const content = cleanText(data.content, 256);
    if (!content) return;

    const type = data.type === 'global' ? 'global' : 'local';
    const chatMessage = {
      from: playerId,
      username: player.username,
      content,
      type,
      role: player.role,
      ts: Date.now(),
    };

    if (this.lua) {
      this.lua.call('intellectus_admin', 'log_chat', playerId, player.username, content, type);
    }

    this.metrics.chatsSent++;

    if (type === 'global') {
      this._broadcast(MSG.CHAT_MESSAGE, chatMessage);
    } else {
      this._broadcastNearby(playerId, MSG.CHAT_MESSAGE, chatMessage, 100, true);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 COMMANDES SLASH
  // ═══════════════════════════════════════════════════════════════════════════
  _handleCommand(player, data) {
    const raw = cleanText(data.raw, 256);
    if (!raw.startsWith('/')) return;
    const [cmd, ...args] = raw.slice(1).split(/\s+/);
    this.metrics.commandsUsed++;

    const respond = (msg) => this._send(player.ws, MSG.CHAT_SYSTEM, { content: msg });

    switch (cmd) {
      case 'help':
        respond('📖 Commandes: /help /tp /give /kick /ban /spawn /weather /time /heal');
        break;

      case 'tp':
        if (!hasPermission(player, 'tp_self')) return respond('❌ Permission refusée');
        if (args.length === 3) {
          const pos = toVector3({ x: +args[0], y: +args[1], z: +args[2] });
          player.pos = pos;
          this._send(player.ws, MSG.RP_EVENT, { type: 'TELEPORT', pos });
          respond(`✅ TP → (${pos.x}, ${pos.y}, ${pos.z})`);
        } else respond('Usage : /tp x y z');
        break;

      case 'give':
        if (!hasPermission(player, 'give')) return respond('❌ Permission refusée');
        if (args.length >= 2) {
          respond(`✅ Give ${args[1]}x ${args[0]} (simulé)`);
          this._send(player.ws, MSG.INVENTORY_SYNC, { action: 'ADD', item: args[0], qty: +args[1] || 1 });
        }
        break;

      case 'kick':
        if (!hasPermission(player, 'kick')) return respond('❌ Permission refusée');
        this._cmdKick(player, args, respond);
        break;

      case 'ban':
        if (!hasPermission(player, 'ban')) return respond('❌ Permission refusée');
        this._cmdBan(player, args, respond);
        break;

      case 'spawn':
        if (!hasPermission(player, 'spawn_vehicle')) return respond('❌ Permission refusée');
        respond(`🚗 Spawn véhicule: ${args[0] || 'sedan'}`);
        this._broadcastNearby(player.id, MSG.RP_EVENT, { type: 'SPAWN_VEHICLE', model: args[0] || 'sedan' }, 200);
        break;

      case 'weather':
        if (!hasPermission(player, 'set_weather')) return respond('❌ Permission refusée');
        const weather = args[0] || 'sunny';
        this._broadcast(MSG.WORLD_STATE, { weather });
        respond(`🌤️ Météo → ${weather}`);
        break;

      case 'time':
        if (!hasPermission(player, 'set_time')) return respond('❌ Permission refusée');
        const h = parseFloat(args[0]) || 12;
        this._broadcast(MSG.WORLD_STATE, { time: h });
        respond(`⏰ Heure → ${h}h`);
        break;

      case 'heal':
        if (!hasPermission(player, 'admin')) return respond('❌ Permission refusée');
        player.rp.needs.health = 100;
        respond('💚 Santé restaurée');
        break;

      case 'players':
        respond(`👥 ${this.players.size} joueurs connectés`);
        break;

      case 'trust':
        respond(`🛡️ Ton trust : ${Math.round(player.trust)}/100`);
        break;

      case 'party':
        this._handlePartyCreate(player);
        respond('🎉 Party créée');
        break;

      default:
        respond(`❓ Commande inconnue : /${cmd}`);
    }
  }

  _cmdKick(admin, args, respond) {
    const targetName = args[0];
    const reason = args.slice(1).join(' ') || 'Kick admin';
    const target = [...this.players.values()].find((p) => p.username === targetName);
    if (!target) return respond('❌ Joueur introuvable');
    this._send(target.ws, MSG.KICK, { reason });
    target.ws.close(1008, reason);
    respond(`👢 ${targetName} expulsé`);
  }

  async _cmdBan(admin, args, respond) {
    const targetName = args[0];
    const reason = args.slice(1).join(' ') || 'Ban admin';
    const target = [...this.players.values()].find((p) => p.username === targetName);
    if (!target) return respond('❌ Joueur introuvable');
    this.bans.set(target.id, { reason, until: null, by: admin.id, at: Date.now() });
    if (this.db?.pool) {
      await this.db.pool.query(
        `INSERT INTO troxt_bans (player_id, reason, banned_by) VALUES ($1, $2, $3)
         ON CONFLICT (player_id) DO UPDATE SET reason=$2`,
        [target.id, reason, admin.id],
      ).catch(() => {});
    }
    this._send(target.ws, MSG.KICK, { reason: `Banni: ${reason}` });
    target.ws.close(1008, 'Banned');
    respond(`🔨 ${targetName} banni`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 ROOMS
  // ═══════════════════════════════════════════════════════════════════════════
  _handleRoomJoin(player, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return this._send(player.ws, MSG.ERROR, { code: 'ROOM_NOT_FOUND' });
    if (room.players.size >= room.meta.maxPlayers) return this._send(player.ws, MSG.ERROR, { code: 'ROOM_FULL' });

    // Quitte l'ancienne
    const old = this.rooms.get(player.roomId);
    if (old) old.players.delete(player.id);

    room.players.add(player.id);
    player.roomId = roomId;
    this.metrics.roomTransfers++;

    // Notifie
    this._broadcastNearby(player.id, MSG.PLAYER_LEAVE, { player_id: player.id }, CFG.zoiRadius * 2);
    this._send(player.ws, MSG.ROOM_JOINED, { room: roomId, meta: room.meta });

    log('ROOM', 'TRANSFER', `${player.username} → ${roomId}`);
  }

  _handleRoomLeave(player) {
    this._handleRoomJoin(player, CFG.defaultRoom);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 PARTY
  // ═══════════════════════════════════════════════════════════════════════════
  _handlePartyCreate(player) {
    const partyId = `party_${uuid().slice(0, 8)}`;
    this.parties.set(partyId, { leaderId: player.id, members: new Set([player.id]) });
    player.partyId = partyId;
    this.metrics.partiesCreated++;
    this._send(player.ws, MSG.PARTY_UPDATE, { party_id: partyId, leader: player.id, members: [player.id] });
    log('CHAT', 'PARTY', `${player.username} a créé ${partyId}`);
  }

  _handlePartyInvite(player, targetName) {
    const party = this.parties.get(player.partyId);
    if (!party || party.leaderId !== player.id) return;
    const target = [...this.players.values()].find((p) => p.username === targetName);
    if (!target) return;
    this._send(target.ws, MSG.PARTY_INVITE, { from: player.username, party_id: player.partyId });
  }

  _handlePartyJoin(player, partyId) {
    const party = this.parties.get(partyId);
    if (!party) return;
    party.members.add(player.id);
    player.partyId = partyId;
    for (const mid of party.members) {
      const m = this.players.get(mid);
      if (m) this._send(m.ws, MSG.PARTY_UPDATE, {
        party_id: partyId, leader: party.leaderId, members: [...party.members],
      });
    }
  }

  _handlePartyLeave(player) {
    const party = this.parties.get(player.partyId);
    if (!party) return;
    party.members.delete(player.id);
    if (party.leaderId === player.id) {
      // Nouveau leader
      const next = [...party.members][0];
      if (next) party.leaderId = next;
      else this.parties.delete(player.partyId);
    }
    player.partyId = null;
    for (const mid of party.members) {
      const m = this.players.get(mid);
      if (m) this._send(m.ws, MSG.PARTY_UPDATE, {
        party_id: party.id, leader: party.leaderId, members: [...party.members],
      });
    }
  }

  _handlePartyChat(player, content) {
    const party = this.parties.get(player.partyId);
    if (!party) return;
    const msg = { from: player.username, content, ts: Date.now() };
    for (const mid of party.members) {
      const m = this.players.get(mid);
      if (m) this._send(m.ws, MSG.PARTY_CHAT, msg);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 FRIENDS
  // ═══════════════════════════════════════════════════════════════════════════
  _handleFriendAdd(player, targetName) {
    const target = [...this.players.values()].find((p) => p.username === targetName);
    if (!target) return;
    if (!this.friendRequests.has(target.id)) this.friendRequests.set(target.id, new Set());
    this.friendRequests.get(target.id).add(player.id);
    this._send(target.ws, MSG.FRIEND_REQUEST, { from: player.id, username: player.username });
  }

  _handleFriendAccept(player, targetId) {
    const reqs = this.friendRequests.get(player.id);
    if (!reqs?.has(targetId)) return;
    reqs.delete(targetId);
    if (!this.friends.has(player.id)) this.friends.set(player.id, new Set());
    if (!this.friends.has(targetId)) this.friends.set(targetId, new Set());
    this.friends.get(player.id).add(targetId);
    this.friends.get(targetId).add(player.id);
    this._send(player.ws, MSG.FRIEND_LIST, {
      friends: [...this.friends.get(player.id)], requests: [...(this.friendRequests.get(player.id) || [])],
    });
    const other = this.players.get(targetId);
    if (other) this._send(other.ws, MSG.FRIEND_LIST, {
      friends: [...this.friends.get(targetId)], requests: [...(this.friendRequests.get(targetId) || [])],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 VOICE SIGNALING
  // ═══════════════════════════════════════════════════════════════════════════
  _handleVoiceSignal(player, data) {
    this.metrics.voiceSignals++;
    const targetId = cleanText(data.target, 64);
    const target = this.players.get(targetId);
    if (!target) return;
    this._send(target.ws, MSG.VOICE_SIGNAL, {
      from: player.id, type: data.signalType, payload: data.payload,
    });
  }

  // ── 8. Événements ──────────────────────────────────────────────────────────
  _wireEvents() {
    const kernel = this.kernel;

    kernel.on('troxtworld:door_state', (data) => this._broadcast(MSG.DOOR_STATE, data));
    kernel.on('lua:troxtworld:door_state', (data) => this._broadcast(MSG.DOOR_STATE, data));
    kernel.on('physics:vehicle_state', (data) => this._broadcastNearbyPos(data.pos, MSG.VEHICLE_SYNC, data, 400));

    kernel.on('kernel:blocked', (data) => {
      this.metrics.securityBlocks++;
      log('SEC', 'INTELLECTUS', `Action bloquée: ${data.type} (${data.reason})`, {
        player: data.ctx?.playerId,
      });
    });

    kernel.on('lua:intellectus:ip_blocked', (data) => log('SEC', 'INTELLECTUS', `IP bloquée: ${data.ip}`, data));
    kernel.on('lua:troxt:mode_changed', (data) => log('TICK', 'BRAIN', `Mode TROXT⬡: ${data.old} → ${data.new}`));
    kernel.on('mech:damage', (data) => this._broadcast(MSG.RP_EVENT, { type: 'DAMAGE', ...data }));
    kernel.on('mech:player_downed', (data) => this._broadcast(MSG.RP_EVENT, { type: 'DOWNED', ...data }));

    log('OK', 'WIRE', 'Événements croisés câblés');
  }

  // ── 9. Boucle de jeu ────────────────────────────────────────────────────────
  _bootTickLoop() {
    log('BOOT', 'TICK', `Étape 9 — Boucle de jeu @ ${CFG.tickHz}Hz...`);

    this.kernel.startTick(CFG.tickHz);

    const interval = 1000 / CFG.tickHz;
    this._tickTimer = setInterval(() => this._tick(), interval);

    this._saveTimer = setInterval(() => {
      if (!this.db) return;
      for (const player of this.players.values()) {
        this._savePlayer(player);
      }
    }, CFG.saveIntervalSec * 1000);

    log('OK', 'TICK', 'Boucle de jeu démarrée');
  }

  _tick() {
    const t0 = performance.now();
    this._currentTickT0 = t0;
    this.metrics.ticks++;

    const now = Date.now();

    // ── Timeouts ──
    for (const [playerId, player] of this.players) {
      if (now - player.lastSeen > CFG.timeoutSec * 1000) {
        log('WARN', 'WS', `Timeout: ${player.username}`);
        player.ws.close(1001, 'Timeout');
        this._removePlayer(player.ws);
      }
    }

    // 🆕 Trust decay/regen
    const dtSec = 1 / CFG.tickHz;
    for (const player of this.players.values()) {
      this.anticheat.decayTrust(player, dtSec);
    }

    // ── Batch sync ──
    if (this.metrics.ticks % CFG.batchEveryTicks === 0 && this.players.size > 1) {
      const snapshot = [...this.players.values()].map((player) => ({
        id: player.id, pos: player.pos, rot: player.rot, vel: player.vel,
        anim: player.anim, ts: player.lastPosTs, roomId: player.roomId,
      }));

      // 🆕 Batch par room pour réduire la bande passante
      const byRoom = new Map();
      for (const p of snapshot) {
        if (!byRoom.has(p.roomId)) byRoom.set(p.roomId, []);
        byRoom.get(p.roomId).push(p);
      }

      for (const [roomId, players] of byRoom) {
        const msg = this._msg(MSG.PLAYERS_BATCH, { players, tick: this.metrics.ticks, room: roomId });
        const room = this.rooms.get(roomId);
        if (room) {
          for (const pid of room.players) {
            const p = this.players.get(pid);
            if (p?.ws.readyState === WebSocket.OPEN) {
              p.ws.send(msg);
              this.metrics.bytesSent += msg.length;
            }
          }
        }
      }
    }

    // ── Ping ──
    if (this.metrics.ticks % (CFG.tickHz * 5) === 0) {
      for (const player of this.players.values()) {
        if (player.ws.readyState === WebSocket.OPEN) {
          player.pingSent = now;
          this._send(player.ws, MSG.PING, { ts: now });
        }
      }
    }

    // 🆕 Notifie les clients SSE (chaque 5s)
    if (this.metrics.ticks % (CFG.tickHz * 5) === 0 && this.metricsSSEClients.size) {
      const snapshot = this._metricsSnapshot();
      const payload = `data: ${JSON.stringify(snapshot)}\n\n`;
      for (const res of this.metricsSSEClients) {
        try { res.write(payload); } catch { this.metricsSSEClients.delete(res); }
      }
    }

    const duration = performance.now() - t0;
    this.metrics.lastTickMs = +duration.toFixed(2);
    this.metrics.avgTickMs = +(this.metrics.avgTickMs * 0.95 + duration * 0.05).toFixed(2);
  }

  // ── 10. Watchdog ────────────────────────────────────────────────────────────
  _bootWatchdog() {
    this._watchdog = setInterval(async () => {
      if (CFG.enableDb && !this.db) {
        try {
          const mod = await import('./database/index.js');
          const health = await mod.health();
          if (health.alive) {
            this.db = mod;
            this.degraded = this.degraded.filter((item) => item !== 'database');
            log('OK', 'WATCHDOG', 'Base de données reconnectée');
          }
        } catch {}
      }

      if (this.metrics.avgTickMs > (1000 / CFG.tickHz) * 0.8) {
        log('WARN', 'WATCHDOG', `Tick lent: ${this.metrics.avgTickMs}ms (budget ${(1000 / CFG.tickHz).toFixed(1)}ms)`);
      }

      // 🆕 Alerte si trop de violations anticheat
      if (this.anticheat.violations.size > 10) {
        log('WARN', 'WATCHDOG', `⚠️ ${this.anticheat.violations.size} joueurs avec violations anti-cheat`);
      }
    }, 15000);
  }

  // ── 10b. Prune (rate limiters, sessions) ────────────────────────────────────
  _bootPrune() {
    this._pruneTimer = setInterval(() => {
      for (const rl of Object.values(this.rateLimiters)) rl.prune();

      // Sessions expirées
      const now = Date.now();
      for (const [sid, session] of this.sessions) {
        if (session.expiresAt < now) this.sessions.delete(sid);
      }

      // Reconnect tokens orphelins
      for (const [tok, pid] of this.reconnectTokens) {
        if (!this.players.has(pid)) {
          // garde 5 min max
          const session = [...this.sessions.values()].find((s) => s.playerId === pid);
          if (!session) this.reconnectTokens.delete(tok);
        }
      }
    }, 60000);
  }

  // 🆕 10c. Backup automatique
  _bootBackup() {
    if (!CFG.backup.enabled) return;

    this._backupTimer = setInterval(async () => {
      if (!this.db?.pool) return;

      try {
        await fs.mkdir(CFG.backup.dir, { recursive: true });

        const snapshot = {
          ts: Date.now(),
          version: VERSION,
          players: [...this.players.values()].map((p) => ({
            id: p.id, username: p.username, pos: p.pos, rp: p.rp,
          })),
          bans: [...this.bans.entries()],
          friends: [...this.friends.entries()].map(([k, v]) => [k, [...v]]),
        };

        const file = path.join(CFG.backup.dir, `backup_${Date.now()}.json`);
        await fs.writeFile(file, JSON.stringify(snapshot, null, 2));

        // Purge anciens
        const files = (await fs.readdir(CFG.backup.dir)).sort();
        while (files.length > CFG.backup.keep) {
          await fs.unlink(path.join(CFG.backup.dir, files.shift())).catch(() => {});
        }

        log('OK', 'BACKUP', `Sauvegarde écrite: ${path.basename(file)}`);
      } catch (error) {
        log('WARN', 'BACKUP', `Échec: ${error.message}`);
      }
    }, CFG.backup.intervalSec * 1000);
  }

  // ── 11. Écoute réseau ───────────────────────────────────────────────────────
  _listen() {
    return new Promise((resolve, reject) => {
      const onError = (error) => {
        this.server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        this.server.off('error', onError);
        resolve();
      };
      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(CFG.port);
    });
  }

  _printReady() {
    const bootSeconds = ((Date.now() - T0) / 1000).toFixed(2);

    console.log('');
    log('OK', 'MASTER', `TROXTWORLD EN LIGNE (démarré en ${bootSeconds}s)`);
    console.log(`     → HTTP : http://localhost:${CFG.port}/api/status`);
    console.log(`     → WS   : ws://localhost:${CFG.port}/ws`);
    console.log(`     → Tick : ${CFG.tickHz}Hz · Max ${CFG.maxPlayers} joueurs`);
    console.log(`     → Santé: ${this.kernel.getHealth().grade}`);
    console.log(`     → Rooms: ${this.rooms.size} · Anti-cheat: ${CFG.anticheat.enabled ? 'ON' : 'OFF'}`);

    if (this.degraded.length) {
      console.log(`     → ⚠ Dégradé: ${this.degraded.join(', ')}`);
    } else {
      console.log('     → ✓ Tous systèmes nominaux');
    }
    console.log('');

    this._toLuaBridge('troxtworld:master_ready', { port: CFG.port, version: VERSION });
    this._notifyWebhook(`🚀 **TROXT World v${VERSION}** en ligne sur le port ${CFG.port}`, {});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STUBS
  // ═══════════════════════════════════════════════════════════════════════════
  _createStubKernel() {
    const listeners = new Map();
    return {
      register: () => {},
      route: async () => ({ blocked: false, reason: null, decision: null }),
      startTick: () => {},
      on: (event, handler) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(handler);
      },
      emit: (event, ...args) => {
        for (const handler of listeners.get(event) || []) {
          try { handler(...args); } catch (error) { log('ERR', 'KERNEL', error.message); }
        }
      },
      addPlayer: () => {},
      removePlayer: () => {},
      getHealth: () => ({ score: 60, grade: 'DÉGRADÉ' }),
      getReport: () => ({ stub: true }),
      shutdown: () => {},
    };
  }

  _createStubMechanics() {
    return {
      install: () => {},
      initHealth: () => {},
      getStats: () => ({ stub: true }),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS RÉSEAU
  // ═══════════════════════════════════════════════════════════════════════════
  _msg(type, data) {
    return JSON.stringify({ type, data, sig: SIG, ts: Date.now() });
  }

  _send(ws, type, data) {
    if (ws?.readyState === WebSocket.OPEN) {
      const msg = this._msg(type, data);
      ws.send(msg);
      this.metrics.bytesSent += msg.length;
    }
  }

  _broadcastRaw(json) {
    for (const player of this.players.values()) {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(json);
        this.metrics.bytesSent += json.length;
      }
    }
  }

  _broadcast(type, data, exceptId = null) {
    const message = this._msg(type, data);
    for (const player of this.players.values()) {
      if (player.id === exceptId) continue;
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(message);
        this.metrics.bytesSent += message.length;
      }
    }
  }

  _broadcastNearby(playerId, type, data, radius = CFG.zoiRadius, includeSelf = false) {
    const me = this.players.get(playerId);
    if (!me) return;

    const message = this._msg(type, data);
    const radiusSquared = radius * radius;

    for (const player of this.players.values()) {
      if (player.id === playerId && !includeSelf) continue;
      if (player.roomId !== me.roomId) continue; // 🆕 Restriction par room
      const dx = player.pos.x - me.pos.x;
      const dz = player.pos.z - me.pos.z;
      if (dx * dx + dz * dz <= radiusSquared && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(message);
        this.metrics.bytesSent += message.length;
      }
    }
  }

  _broadcastNearbyPos(pos, type, data, radius) {
    if (!validVector3(pos)) return;
    const message = this._msg(type, data);
    const radiusSquared = radius * radius;
    for (const player of this.players.values()) {
      const dx = player.pos.x - pos.x;
      const dz = player.pos.z - pos.z;
      if (dx * dx + dz * dz <= radiusSquared && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(message);
        this.metrics.bytesSent += message.length;
      }
    }
  }

  async _toLuaBridge(event, data) {
    try {
      await fetch(CFG.luaBridge, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data }),
        signal: AbortSignal.timeout(1500),
      });
    } catch {}
  }

  // 🆕 Webhook Discord/Slack
  async _notifyWebhook(message, meta = {}) {
    const body = CFG.webhooks.discord
      ? JSON.stringify({ content: message })
      : CFG.webhooks.slack
      ? JSON.stringify({ text: message })
      : null;
    const url = CFG.webhooks.discord || CFG.webhooks.slack;
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(2000),
      });
    } catch {}
  }

  _savePlayer(player) {
    if (!this.db) return Promise.resolve();
    this.metrics.dbSaves++;
    return this.db.pool.query(
      `UPDATE players SET
        position_x=$2, position_y=$3, position_z=$4,
        heading=$5, health=$6, hunger=$7, thirst=$8,
        last_seen=now(), updated_at=now()
       WHERE id=$1`,
      [
        player.id, player.pos.x, player.pos.y, player.pos.z,
        player.rot.y, Math.round(player.rp.needs.health),
        Math.round(player.rp.needs.hunger), Math.round(player.rp.needs.thirst),
      ],
    ).catch((error) => {
      this.metrics.errors++;
      log('ERR', 'DB', `Échec sauvegarde joueur ${player.id}: ${error.message}`);
      throw error;
    });
  }

  // 🆕 Metrics Prometheus
  _metricsPrometheus() {
    const m = this.metrics;
    const mem = process.memoryUsage();
    const lines = [
      `# HELP troxt_players_online Joueurs connectés`,
      `# TYPE troxt_players_online gauge`,
      `troxt_players_online ${this.players.size}`,
      `# HELP troxt_players_peak Pic de joueurs`,
      `# TYPE troxt_players_peak counter`,
      `troxt_players_peak ${m.peakPlayers}`,
      `# HELP troxt_tick_ms Dernière durée de tick`,
      `# TYPE troxt_tick_ms gauge`,
      `troxt_tick_ms ${m.lastTickMs}`,
      `# HELP troxt_tick_avg_ms Durée moyenne tick`,
      `# TYPE troxt_tick_avg_ms gauge`,
      `troxt_tick_avg_ms ${m.avgTickMs}`,
      `# HELP troxt_messages_total Messages WS traités`,
      `# TYPE troxt_messages_total counter`,
      `troxt_messages_total ${m.messages}`,
      `# HELP troxt_anticheat_violations_total Violations anti-cheat`,
      `# TYPE troxt_anticheat_violations_total counter`,
      `troxt_anticheat_violations_total ${m.anticheatViolations}`,
      `# HELP troxt_rate_limit_blocks_total Blocages rate-limit`,
      `# TYPE troxt_rate_limit_blocks_total counter`,
      `troxt_rate_limit_blocks_total ${m.rateLimitBlocks}`,
      `# HELP troxt_bytes_sent_total Octets envoyés`,
      `# TYPE troxt_bytes_sent_total counter`,
      `troxt_bytes_sent_total ${m.bytesSent}`,
      `# HELP troxt_uptime_seconds Uptime serveur`,
      `# TYPE troxt_uptime_seconds gauge`,
      `troxt_uptime_seconds ${Math.floor((Date.now() - m.startedAt) / 1000)}`,
      `# HELP troxt_memory_bytes Mémoire Node.js`,
      `# TYPE troxt_memory_bytes gauge`,
      `troxt_memory_bytes{type="heapUsed"} ${mem.heapUsed}`,
      `troxt_memory_bytes{type="heapTotal"} ${mem.heapTotal}`,
      `troxt_memory_bytes{type="rss"} ${mem.rss}`,
    ];
    return lines.join('\n') + '\n';
  }

  _metricsSnapshot() {
    return {
      ts: Date.now(),
      players: this.players.size,
      peak: this.metrics.peakPlayers,
      ticks: this.metrics.ticks,
      tick_ms: this.metrics.lastTickMs,
      tick_avg: this.metrics.avgTickMs,
      messages: this.metrics.messages,
      securityBlocks: this.metrics.securityBlocks,
      anticheat: this.metrics.anticheatViolations,
      rateLimit: this.metrics.rateLimitBlocks,
      uptime: Math.floor((Date.now() - this.metrics.startedAt) / 1000),
      memory: Math.round(process.memoryUsage().heapUsed / 1048576),
      rooms: [...this.rooms.values()].map((r) => ({ id: r.id, count: r.players.size })),
      degraded: this.degraded,
    };
  }

  async shutdown(signal) {
    if (this._shuttingDown) return;
    this._shuttingDown = true;

    log('WARN', 'MASTER', `${signal} reçu — arrêt gracieux...`);
    this.running = false;

    clearInterval(this._tickTimer);
    clearInterval(this._saveTimer);
    clearInterval(this._watchdog);
    clearInterval(this._pruneTimer);
    clearInterval(this._backupTimer);

    this.kernel?.shutdown?.();

    if (this.db) {
      log('DB', 'MASTER', `Sauvegarde finale de ${this.players.size} joueurs...`);
      const saves = [...this.players.values()].map((player) => this._savePlayer(player));
      await Promise.allSettled(saves);
    }

    for (const player of this.players.values()) {
      this._send(player.ws, MSG.KICK, { reason: 'Serveur en maintenance' });
      if (player.ws.readyState === WebSocket.OPEN) player.ws.close(1001, 'Server maintenance');
    }

    await new Promise((resolve) => {
      if (!this.wss) return resolve();
      this.wss.close(() => resolve());
    });

    await new Promise((resolve) => {
      if (!this.server?.listening) return resolve();
      this.server.close(() => resolve());
    });

    if (this.db) await this.db.shutdown?.().catch(() => {});
    this.physics?.dispose?.();
    this.lua?.dispose?.();

    log('OK', 'MASTER', 'TroxtWorld hors ligne. À bientôt!');
    process.exit(0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANCEMENT
// ═══════════════════════════════════════════════════════════════════════════════
const master = new TroxtMasterServer();

process.on('SIGINT', () => master.shutdown('SIGINT'));
process.on('SIGTERM', () => master.shutdown('SIGTERM'));

process.on('uncaughtException', (error) => {
  log('ERR', 'MASTER', `Exception: ${error.message}`);
  console.error(error);
});

process.on('unhandledRejection', (error) => {
  log('ERR', 'MASTER', `Rejet: ${error?.message || error}`);
});

master.boot().catch((error) => {
  log('ERR', 'MASTER', `Échec démarrage: ${error.message}`);
  console.error(error);
  process.exit(1);
});

export { TroxtMasterServer, SIG, VERSION, CFG, MSG, ROLE_HIERARCHY, PERMISSIONS };
export default TroxtMasterServer;
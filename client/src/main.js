/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CLIENT/SRC/MAIN.JS
 * Point d'entrée principal & Serveur API/WebSocket de TroxtWorld
 * ═══════════════════════════════════════════════════════════════════
 * Orchestre :
 *   1. Base de données (PostgreSQL Drizzle / PGlite fallback)
 *   2. Serveur RP & Simulation WebSocket 20Hz
 *   3. Système de portes interactif
 *   4. Pont Lua → Cerveau TROXT⬡ + Sécurité 🛡️INTELLECTUS⬡
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/main.js
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// ─── CHARGEMENT UNIFIÉ DES MODULES BASE DE DONNÉES & PORTES ──────────────────
let db = null;
let pool = null;
let dbHealth = async () => ({ alive: false, error: 'Module DB non chargé' });
let bridgeToLua = () => {};
let bridgeToIntellectus = () => {};
let dbShutdown = async () => {};
let runMigrations = async () => {};
let ensureWorldState = async () => {};
let attachDoors = async () => {};

// Résolution intelligente des chemins (que ce soit dans /src ou /client/src)
const possibleDbPaths = ['../../database/index.js', '../database/index.js', './database/index.js'];
for (const p of possibleDbPaths) {
  try {
    const dbModule = await import(p);
    db = dbModule.db;
    pool = dbModule.pool;
    dbHealth = dbModule.health || dbHealth;
    bridgeToLua = dbModule.bridgeToLua || bridgeToLua;
    bridgeToIntellectus = dbModule.bridgeToIntellectus || bridgeToIntellectus;
    dbShutdown = dbModule.shutdown || dbShutdown;
    break;
  } catch {}
}

const possibleMigPaths = ['../../database/migrate.js', '../database/migrate.js', './database/migrate.js'];
for (const p of possibleMigPaths) {
  try {
    const migModule = await import(p);
    runMigrations = migModule.runMigrations || runMigrations;
    ensureWorldState = migModule.ensureWorldState || ensureWorldState;
    break;
  } catch {}
}

const possibleDoorPaths = ['../../server/troxt-doors-server.mjs', '../server/troxt-doors-server.mjs', './server/troxt-doors-server.mjs'];
for (const p of possibleDoorPaths) {
  try {
    const doorModule = await import(p);
    attachDoors = doorModule.attachDoors || attachDoors;
    break;
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const SIG     = 'TROXT⬡';
const ISIG    = '🛡️INTELLECTUS⬡';
const VERSION = '3.0.0';

const PORT           = parseInt(process.env.PORT || '3000', 10);
const TICK_RATE_HZ   = parseInt(process.env.TICK_RATE_HZ || '20', 10);
const TICK_MS        = 1000 / TICK_RATE_HZ;
const MAX_PLAYERS    = parseInt(process.env.MAX_PLAYERS || '500', 10);
const TIMEOUT_SEC    = 30;
const LUA_BRIDGE_URL = process.env.LUA_BRIDGE_URL || 'http://localhost:4200/lua/emit';
const RUN_MIGRATIONS = process.env.RUN_MIGRATIONS !== 'false';
const RUN_SEED       = process.env.RUN_SEED === 'true';

// ═══════════════════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════════════════
const ICONS = {
  INFO: 'ℹ', WARN: '⚠', ERROR: '✖', OK: '✓',
  WS:   '⚡', BOOT: '🚀', DB:   '🗄️',
};

function log(level, msg, data) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${ICONS[level] || '·'} [${SIG}] ${msg}`);
  if (data) console.log('   ↳', JSON.stringify(data));
}

// ═══════════════════════════════════════════════════════════════════
// MESSAGES WEBSOCKET
// ═══════════════════════════════════════════════════════════════════
const MSG = {
  HELLO:         'HELLO',
  PLAYER_JOIN:   'PLAYER_JOIN',
  PLAYER_LEAVE:  'PLAYER_LEAVE',
  PLAYER_UPDATE: 'PLAYER_UPDATE',
  PLAYERS_BATCH: 'PLAYERS_BATCH',
  CHAT_MESSAGE:  'CHAT_MESSAGE',
  RP_EVENT:      'RP_EVENT',
  PING:          'PING',
  ERROR:         'ERROR',
  KICK:          'KICK',
  AUTH:          'AUTH',
  MOVE:          'MOVE',
  CHAT:          'CHAT',
  RP_ACTION:     'RP_ACTION',
  PONG:          'PONG',
  INTERACT:      'INTERACT',
};

// ═══════════════════════════════════════════════════════════════════
// ÉTAT DU SERVEUR
// ═══════════════════════════════════════════════════════════════════
const players = new Map();
const sockets = new Map();

const stats = {
  startedAt:     Date.now(),
  totalConnects: 0,
  totalMessages: 0,
  peakPlayers:   0,
  ticks:         0,
};

// ═══════════════════════════════════════════════════════════════════
// HELPERS WEBSOCKET
// ═══════════════════════════════════════════════════════════════════
const buildMsg = (type, data) =>
  JSON.stringify({ type, data, ts: Date.now(), sig: SIG });

function send(ws, type, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(buildMsg(type, data));
  }
}

function broadcast(json, exceptId = null) {
  for (const p of players.values()) {
    if (p.id === exceptId) continue;
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(json);
  }
}

function broadcastAll(type, data, exceptId = null) {
  broadcast(buildMsg(type, data), exceptId);
}

function nearbyPlayers(playerId, radius = 300) {
  const me = players.get(playerId);
  if (!me) return [];
  const out = [];
  const r2 = radius * radius;
  for (const [pid, p] of players) {
    if (pid === playerId) continue;
    const dx = p.pos.x - me.pos.x;
    const dz = p.pos.z - me.pos.z;
    if (dx * dx + dz * dz <= r2) out.push(pid);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// PONT LUA → CERVEAU TROXT⬡
// ═══════════════════════════════════════════════════════════════════
async function emitToLua(event, data) {
  try {
    await fetch(LUA_BRIDGE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ event, data: { ...data, sig: SIG } }),
      signal:  AbortSignal.timeout(1500),
    });
  } catch {
    // Non bloquant
  }
}

// ═══════════════════════════════════════════════════════════════════
// PERSISTANCE JOUEUR
// ═══════════════════════════════════════════════════════════════════
async function loadPlayerFromDb(playerId) {
  if (!pool) return null;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM players WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [playerId]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      username: r.name,
      level:    r.job_rank ?? 1,
      pos:      { x: r.position_x, y: r.position_y, z: r.position_z },
      rot:      { x: 0, y: r.heading, z: 0 },
      isAdmin:  ['admin', 'superadmin', 'owner'].includes(r.permission),
    };
  } catch (e) {
    log('WARN', `Chargement joueur en DB échoué: ${e.message}`);
    return null;
  }
}

async function savePlayerToDb(p) {
  if (!pool) return;
  try {
    await pool.query(
      `UPDATE players SET
         position_x = $2, position_y = $3, position_z = $4, heading = $5,
         health = $6, hunger = $7, thirst = $8,
         last_seen = now(), updated_at = now()
       WHERE id = $1`,
      [
        p.id, p.pos.x, p.pos.y, p.pos.z, p.rot.y,
        Math.round(p.rp.needs.health),
        Math.round(p.rp.needs.hunger),
        Math.round(p.rp.needs.thirst),
      ]
    );
  } catch {
    // Non bloquant
  }
}

// ═══════════════════════════════════════════════════════════════════
// GESTION DU CYCLE DE VIE DES JOUEURS
// ═══════════════════════════════════════════════════════════════════
async function createPlayer(ws, auth) {
  const playerId = auth.player_id || uuid();
  const dbData   = await loadPlayerFromDb(playerId);

  const player = {
    id:          playerId,
    username:    dbData?.username || auth.username || `Citoyen_${playerId.slice(0, 5)}`,
    session:     uuid(),
    ws,
    roomId:      'world_main',
    pos:         dbData?.pos || auth.pos || { x: 0, y: 1.2, z: 0 },
    rot:         dbData?.rot || auth.rot || { x: 0, y: 0, z: 0 },
    vel:         { x: 0, y: 0, z: 0 },
    anim:        undefined,
    rp: {
      health:  100,
      cash:    2500,
      job:     auth.job || 'civilian',
      faction: auth.faction || null,
      wanted:  0,
      needs:   { health: 100, hunger: 100, thirst: 100, energy: 100, stress: 0 },
    },
    connectedAt: Date.now(),
    lastSeen:    Date.now(),
    lastPosTs:   Date.now(),
    pingMs:      0,
    pingSent:    null,
    isAdmin:     dbData?.isAdmin || auth.isAdmin || false,
    factionRank: 0,
    level:       dbData?.level || 1,
  };

  players.set(playerId, player);
  sockets.set(ws, playerId);
  stats.totalConnects++;
  stats.peakPlayers = Math.max(stats.peakPlayers, players.size);

  return player;
}

function removePlayer(ws) {
  const playerId = sockets.get(ws);
  if (!playerId) return;

  const player = players.get(playerId);
  if (player) {
    void savePlayerToDb(player);
    broadcastAll(
      MSG.PLAYER_LEAVE,
      { player_id: playerId, username: player.username },
      playerId
    );
    void emitToLua('troxtworld:player_left', { player_id: playerId });
    log('WS', `Déconnexion : ${player.username}`);
  }

  players.delete(playerId);
  sockets.delete(ws);
}

// ═══════════════════════════════════════════════════════════════════
// HANDLERS WEBSOCKET
// ═══════════════════════════════════════════════════════════════════
const handlers = {

  async [MSG.AUTH](ws, data) {
    if (players.size >= MAX_PLAYERS) {
      send(ws, MSG.ERROR, { code: 'SERVER_FULL', message: 'Serveur plein' });
      return ws.close();
    }

    const player = await createPlayer(ws, data);
    log('OK', `Connexion : ${player.username} [${player.id.slice(0, 8)}]`);

    const worldPlayers = [...players.values()]
      .filter((p) => p.id !== player.id)
      .map((p) => ({
        id:       p.id,
        username: p.username,
        pos:      p.pos,
        rot:      p.rot,
        rp: {
          health: p.rp.needs.health,
          job:    p.rp.job,
          wanted: p.rp.wanted,
        },
      }));

    send(ws, MSG.HELLO, {
      player_id:     player.id,
      session:       player.session,
      username:      player.username,
      tick_rate:     TICK_RATE_HZ,
      room_id:       player.roomId,
      world_players: worldPlayers,
      sig:           SIG,
    });

    broadcastAll(MSG.PLAYER_JOIN, {
      player_id: player.id,
      username:  player.username,
      pos:       player.pos,
      rot:       player.rot,
      rp:        player.rp,
    }, player.id);

    void emitToLua('troxtworld:player_joined', {
      player_id: player.id,
      username:  player.username,
    });
  },

  [MSG.MOVE](ws, data) {
    const pid = sockets.get(ws); if (!pid) return;
    const p   = players.get(pid); if (!p) return;
    const now = Date.now();

    // Anti-cheat vélocité
    const dt = (now - p.lastPosTs) / 1000;
    if (dt > 0 && dt < 5) {
      const dx   = (data.pos?.x ?? p.pos.x) - p.pos.x;
      const dz   = (data.pos?.z ?? p.pos.z) - p.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist / dt > 35) {
        send(ws, MSG.ERROR, { code: 'SPEED_HACK', pos: p.pos });
        void emitToLua('intellectus:cheat_detected', { player_id: pid, type: 'SPEED_HACK' });
        return;
      }
    }

    p.pos       = data.pos || p.pos;
    p.rot       = data.rot || p.rot;
    p.vel       = data.vel || p.vel;
    p.anim      = data.anim;
    p.lastSeen  = now;
    p.lastPosTs = now;

    const upd = buildMsg(MSG.PLAYER_UPDATE, {
      player_id: pid,
      pos: p.pos, rot: p.rot, vel: p.vel,
      anim: p.anim, ts: now,
    });

    for (const nid of nearbyPlayers(pid, 300)) {
      const np = players.get(nid);
      if (np?.ws.readyState === WebSocket.OPEN) np.ws.send(upd);
    }
  },

  [MSG.CHAT](ws, data) {
    const pid = sockets.get(ws); if (!pid) return;
    const p   = players.get(pid); if (!p) return;

    const content = String(data.content || '').slice(0, 256).trim();
    if (!content) return;

    const chatType = data.type || 'local';
    const msg = {
      from:     pid,
      username: p.username,
      content,
      type:     chatType,
      ts:       Date.now(),
    };

    if (chatType === 'global') {
      broadcastAll(MSG.CHAT_MESSAGE, msg);
    } else {
      for (const nid of [pid, ...nearbyPlayers(pid, 100)]) {
        const np = players.get(nid);
        if (np?.ws.readyState === WebSocket.OPEN) send(np.ws, MSG.CHAT_MESSAGE, msg);
      }
    }

    void emitToLua('troxtworld:chat', {
      player_id: pid, content, type: chatType,
    });
  },

  [MSG.RP_ACTION](ws, data) {
    const pid = sockets.get(ws); if (!pid) return;
    const p   = players.get(pid); if (!p) return;

    void emitToLua('troxtworld:rp_action', {
      player_id: pid,
      action:    data.action,
      payload:   data.payload,
    });

    for (const nid of [pid, ...nearbyPlayers(pid, 200)]) {
      const np = players.get(nid);
      if (np?.ws.readyState === WebSocket.OPEN) {
        send(np.ws, MSG.RP_EVENT, {
          player_id: pid,
          action:    data.action,
          payload:   data.payload,
          ts:        Date.now(),
        });
      }
    }
  },

  [MSG.PONG](ws) {
    const pid = sockets.get(ws); if (!pid) return;
    const p   = players.get(pid);
    if (p?.pingSent) {
      p.pingMs   = Date.now() - p.pingSent;
      p.pingSent = null;
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
// BOUCLE DE TICK (20Hz)
// ═══════════════════════════════════════════════════════════════════
function startTickLoop() {
  return setInterval(() => {
    stats.ticks++;
    const now = Date.now();

    for (const [pid, p] of players) {
      // Timeout
      if (now - p.lastSeen > TIMEOUT_SEC * 1000) {
        log('WARN', `Timeout : ${p.username}`);
        p.ws.close();
        removePlayer(p.ws);
        continue;
      }

      // Besoins vitaux (chaque minute)
      if (stats.ticks % (TICK_RATE_HZ * 60) === 0) {
        p.rp.needs.hunger = Math.max(0, p.rp.needs.hunger - 1);
        p.rp.needs.thirst = Math.max(0, p.rp.needs.thirst - 1.5);
      }
    }

    // Batch positions (tous les 3 ticks)
    if (stats.ticks % 3 === 0 && players.size > 1) {
      const snap = [...players.values()].map((p) => ({
        id: p.id, pos: p.pos, rot: p.rot, vel: p.vel,
        anim: p.anim, ts: p.lastPosTs,
      }));
      broadcast(buildMsg(MSG.PLAYERS_BATCH, { players: snap, tick: stats.ticks }));
    }

    // Ping (toutes les 5s)
    if (stats.ticks % (TICK_RATE_HZ * 5) === 0) {
      for (const p of players.values()) {
        if (p.ws.readyState === WebSocket.OPEN) {
          p.pingSent = now;
          send(p.ws, MSG.PING, { ts: now });
        }
      }
    }

    // Sauvegarde en base de données (toutes les 60s)
    if (stats.ticks % (TICK_RATE_HZ * 60) === 0) {
      for (const p of players.values()) void savePlayerToDb(p);
    }
  }, TICK_MS);
}

// ═══════════════════════════════════════════════════════════════════
// API REST SERVEUR
// ═══════════════════════════════════════════════════════════════════
function setupRoutes(app) {
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      sig: SIG,
      service: 'TroxtWorld Game Server',
      status: 'online',
      timestamp: Date.now()
    });
  });

  app.get('/api/status', (_req, res) => {
    res.json({
      sig:         SIG,
      version:     VERSION,
      status:      'online',
      players:     players.size,
      max_players: MAX_PLAYERS,
      tick_rate:   TICK_RATE_HZ,
      uptime_sec:  Math.floor((Date.now() - stats.startedAt) / 1000),
      stats,
    });
  });

  app.get('/api/players', (_req, res) => {
    res.json({
      ok:      true,
      count:   players.size,
      players: [...players.values()].map((p) => ({
        id:       p.id,
        username: p.username,
        room:     p.roomId,
        ping_ms:  p.pingMs,
        wanted:   p.rp.wanted,
        job:      p.rp.job,
      })),
      sig: SIG,
    });
  });

  app.post('/api/kick', express.json(), (req, res) => {
    const { player_id, reason } = req.body;
    const p = players.get(player_id);
    if (!p) return res.status(404).json({ error: 'Joueur introuvable' });

    send(p.ws, MSG.KICK, { reason: reason || 'Expulsion admin' });
    setTimeout(() => p.ws.close(), 500);
    res.json({ ok: true, kicked: player_id, sig: SIG });
  });

  app.get('/api/db/health', async (_req, res) => {
    res.json(await dbHealth());
  });
}

// ═══════════════════════════════════════════════════════════════════
// DÉMARRAGE ORCHESTRÉ
// ═══════════════════════════════════════════════════════════════════
async function bootstrap() {
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log(`  ║   ${SIG}  TroxtWorld Server v${VERSION}   ║`);
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');

  // 1. Base de données
  log('BOOT', 'Étape 1/4 — Initialisation Base de données...');
  const h = await dbHealth();
  if (h.alive) {
    log('OK', `PostgreSQL connecté (${h.latency_ms}ms)`);
    if (RUN_MIGRATIONS) {
      try {
        await runMigrations();
        await ensureWorldState();
      } catch (e) {
        log('WARN', `Migrations : ${e.message}`);
      }
    }
  } else {
    log('WARN', `PostgreSQL indisponible : ${h.error} — Mode mémoire actif.`);
  }

  // 2. Ponts IA & Sécurité Intellectus
  if (typeof bridgeToLua === 'function') {
    bridgeToLua((event, data) => void emitToLua(event, data));
  }
  if (typeof bridgeToIntellectus === 'function') {
    bridgeToIntellectus((alert) => {
      log('WARN', `[${ISIG}] Alerte DB : ${alert.type}`);
      void emitToLua('intellectus:db_alert', alert);
    });
  }

  // 3. Serveur HTTP + WebSocket
  log('BOOT', 'Étape 2/4 — Serveur HTTP + WebSocket...');
  const app = express();

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-TROXT-Key');
    res.header('X-TROXT-Signature', SIG);
    next();
  });

  setupRoutes(app);

  const server = createServer(app);
  const wss    = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    log('WS', `Connexion depuis ${req.socket.remoteAddress}`);

    ws.on('message', (raw) => {
      stats.totalMessages++;
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, MSG.ERROR, { code: 'PARSE_ERROR' });
      }
      const handler = handlers[msg.type];
      if (handler) {
        try {
          void handler(ws, msg.data || {});
        } catch (e) {
          log('ERROR', `Handler ${msg.type} : ${e.message}`);
        }
      }
    });

    ws.on('close', () => removePlayer(ws));
    ws.on('error', () => removePlayer(ws));

    const authTimeout = setTimeout(() => {
      if (!sockets.has(ws)) ws.close();
    }, 5000);
    ws.once('message', () => clearTimeout(authTimeout));
  });

  log('OK', 'WebSocket prêt sur /ws');

  // 4. Système de portes (plugin)
  log('BOOT', 'Étape 3/4 — Système de portes...');
  try {
    await attachDoors({
      wss,
      app,
      getPlayer: (ws) => {
        const pid = sockets.get(ws);
        const p   = pid ? players.get(pid) : null;
        if (!p) return null;
        return {
          id:           p.id,
          level:        p.level,
          job:          p.rp.job,
          faction:      p.rp.faction,
          faction_rank: p.factionRank,
          cash:         p.rp.cash,
          is_admin:     p.isAdmin,
          rp:           p.rp,
        };
      },
      broadcast: (json) => broadcast(json),
      emit:      (event, data) => void emitToLua(event, data),
    });
    log('OK', 'Système de portes attaché.');
  } catch (e) {
    log('WARN', `Portes non chargées : ${e.message}`);
  }

  // 5. Boucle de tick + écoute
  log('BOOT', 'Étape 4/4 — Boucle de jeu 20Hz...');
  const tickLoop = startTickLoop();

  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    log('OK', `TroxtWorld EN LIGNE`);
    console.log(`     → HTTP : http://localhost:${PORT}/api/status`);
    console.log(`     → WS   : ws://localhost:${PORT}/ws`);
    console.log(`     → Tick : ${TICK_RATE_HZ}Hz · Max ${MAX_PLAYERS} joueurs`);
    console.log('');
    void emitToLua('troxtworld:server_ready', { port: PORT, version: VERSION });
  });

  // Arrêt propre
  const shutdown = async (signal) => {
    log('WARN', `${signal} reçu — Arrêt sécurisé du serveur...`);
    clearInterval(tickLoop);
    for (const p of players.values()) await savePlayerToDb(p);
    wss.close();
    server.close();
    await dbShutdown().catch(() => {});
    log('OK', 'TroxtWorld hors ligne.');
    process.exit(0);
  };
  process.on('SIGINT',  () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// ═══════════════════════════════════════════════════════════════════
// LANCEMENT
// ═══════════════════════════════════════════════════════════════════
bootstrap().catch((err) => {
  log('ERROR', `Échec démarrage : ${err.message}`);
  console.error(err);
  process.exit(1);
});

export { players, broadcast, emitToLua, SIG };
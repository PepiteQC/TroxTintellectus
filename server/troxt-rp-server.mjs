/**
 * TROXT⬡ — TROXT-RP-SERVER.MJS
 * Serveur RP TroxtWorld — HTTP + WebSocket + Rooms + Instances
 * ═══════════════════════════════════════════════════════════════════
 * ⚠️  Serveur RP autonome — ÉCOUTE SUR LE PORT 4100.
 *     Ne pas lancer en même temps que troxt-master-server.mjs
 *     (conflit de port). À utiliser comme fallback léger,
 *     ou à la place du master si tu ne veux pas de kernel/Lua/physique.
 *
 * Signature : TROXT⬡
 * Port      : 4100
 * Chemin    : server/troxt-rp-server.mjs
 */

import express          from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid }   from 'uuid';

const SIG     = 'TROXT⬡';
const VERSION = '1.0.0';
const PORT    = 4100;

// ─── LOGGER ──────────────────────────────────────────────────────────────────
const log = (level, msg, data) => {
  const icons = { INFO:'ℹ', WARN:'⚠', ERROR:'✖', OK:'✓', WS:'⚡', RP:'⬡' };
  const ts    = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${icons[level]||'·'} [${SIG}] ${msg}`);
  if (data) console.log('   ↳', JSON.stringify(data));
};

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const TICK_RATE_HZ      = 20;
const TICK_MS           = 1000 / TICK_RATE_HZ;
const MAX_PLAYERS       = 500;
const MAX_ROOM_PLAYERS  = 50;
const TIMEOUT_SEC       = 30;
const SNAPSHOT_INTERVAL = 60000;
const INTERPOLATION_MS  = 100;
const MAX_ROOM_ID_LEN   = 64;

const MSG = {
  HELLO          : 'HELLO',
  WORLD_STATE    : 'WORLD_STATE',
  PLAYER_JOIN    : 'PLAYER_JOIN',
  PLAYER_LEAVE   : 'PLAYER_LEAVE',
  PLAYER_UPDATE  : 'PLAYER_UPDATE',
  PLAYERS_BATCH  : 'PLAYERS_BATCH',
  CHAT_MESSAGE   : 'CHAT_MESSAGE',
  RP_EVENT       : 'RP_EVENT',
  ROOM_UPDATE    : 'ROOM_UPDATE',
  PING           : 'PING',
  ERROR          : 'ERROR',
  KICK           : 'KICK',
  AUTH           : 'AUTH',
  MOVE           : 'MOVE',
  INTERACT       : 'INTERACT',
  CHAT           : 'CHAT',
  RP_ACTION      : 'RP_ACTION',
  PONG           : 'PONG',
  JOIN_ROOM      : 'JOIN_ROOM',
  LEAVE_ROOM     : 'LEAVE_ROOM',
};

// ─── STORE ───────────────────────────────────────────────────────────────────
const players  = new Map();
const rooms    = new Map();
const sockets  = new Map();
const sessions = new Map();

const stats = {
  started_at     : Date.now(),
  total_connects : 0,
  total_messages : 0,
  peak_players   : 0,
  ticks_processed: 0,
};

// ─── ROOM ─────────────────────────────────────────────────────────────────────
class Room {
  constructor(id, name, type = 'public') {
    this.id         = id;
    this.name       = name;
    this.type       = type;   // public | private | instance
    this.players    = new Set();
    this.created_at = Date.now();
    this.state      = {};
    this.sig        = SIG;
  }

  add(player_id) {
    if (this.players.size >= MAX_ROOM_PLAYERS) return false;
    this.players.add(player_id);
    return true;
  }

  remove(player_id) {
    this.players.delete(player_id);
    if (this.players.size === 0 && this.type !== 'public') {
      rooms.delete(this.id);
    }
  }

  broadcast(type, data, except_id = null) {
    const msg = build_msg(type, data);
    for (const pid of this.players) {
      if (pid === except_id) continue;
      const p = players.get(pid);
      if (p?.ws?.readyState === WebSocket.OPEN) {
        p.ws.send(msg);
      }
    }
  }

  get summary() {
    return {
      id      : this.id,
      name    : this.name,
      type    : this.type,
      players : this.players.size,
      sig     : SIG,
    };
  }
}

const DEFAULT_ROOMS = [
  { id: 'world_main',         name: 'TroxtWorld — Monde Principal' },
  { id: 'centre_ville',       name: 'Centre-Ville'                 },
  { id: 'port_industriel',    name: 'Port Industriel'              },
  { id: 'zone_residentielle', name: 'Zone Résidentielle'           },
];
for (const r of DEFAULT_ROOMS) {
  rooms.set(r.id, new Room(r.id, r.name, 'public'));
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function build_msg(type, data) {
  return JSON.stringify({ type, data, ts: Date.now(), sig: SIG });
}

function send(ws, type, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(build_msg(type, data));
  }
}

function broadcast_all(type, data, except_id = null) {
  const msg = build_msg(type, data);
  for (const [, p] of players) {
    if (p.id === except_id) continue;
    if (p.ws?.readyState === WebSocket.OPEN) p.ws.send(msg);
  }
}

function get_nearby_players(player_id, radius = 200) {
  const me = players.get(player_id);
  if (!me) return [];
  const nearby = [];
  for (const [pid, p] of players) {
    if (pid === player_id) continue;
    const dx = (p.pos?.x || 0) - (me.pos?.x || 0);
    const dz = (p.pos?.z || 0) - (me.pos?.z || 0);
    if (Math.sqrt(dx*dx + dz*dz) <= radius) nearby.push(pid);
  }
  return nearby;
}

// ─── GESTION JOUEURS ─────────────────────────────────────────────────────────
function create_player(ws, auth_data) {
  const player_id = auth_data.player_id || uuid();
  const session   = uuid();

  const player = {
    id          : player_id,
    username    : auth_data.username || `Player_${player_id.slice(0,6)}`,
    session     : session,
    ws,
    room_id     : 'world_main',
    pos         : auth_data.pos || { x: 0, y: 0, z: 0 },
    rot         : auth_data.rot || { x: 0, y: 0, z: 0 },
    vel         : { x: 0, y: 0, z: 0 },
    rp          : {
      health    : 100,
      cash      : 2500,
      job       : null,
      faction   : null,
      wanted    : 0,
      needs     : { health:100, hunger:100, thirst:100, energy:100, stress:0 },
    },
    connected_at: Date.now(),
    last_seen   : Date.now(),
    last_pos_ts : Date.now(),
    ping_ms     : 0,
    _ping_sent  : null,
    sig         : SIG,
  };

  players.set(player_id, player);
  sockets.set(ws, player_id);
  sessions.set(session, player_id);

  const room = rooms.get('world_main');
  if (room) room.add(player_id);

  stats.total_connects++;
  stats.peak_players = Math.max(stats.peak_players, players.size);

  return player;
}

function remove_player(ws) {
  const player_id = sockets.get(ws);
  if (!player_id) return;                    // déjà retiré → guard
  sockets.delete(ws);                        // retirer tout de suite pour éviter double-appel

  const player = players.get(player_id);
  if (player) {
    const room = rooms.get(player.room_id);
    if (room) room.remove(player_id);

    sessions.delete(player.session);

    log('WS', `Déconnexion: ${player.username} [${player_id.slice(0,8)}]`);

    broadcast_all(MSG.PLAYER_LEAVE, {
      player_id,
      username  : player.username,
      room_id   : player.room_id,
    }, player_id);
  }

  players.delete(player_id);
}

// ─── HANDLERS MESSAGES ───────────────────────────────────────────────────────
const handlers = {

  [MSG.AUTH]: (ws, data) => {
    if (players.size >= MAX_PLAYERS) {
      send(ws, MSG.ERROR, { code: 'SERVER_FULL', message: 'Serveur plein — réessaie plus tard' });
      return ws.close();
    }

    const player = create_player(ws, data);
    log('OK', `Connexion: ${player.username} [${player.id.slice(0,8)}]`);

    const world_players = [];
    for (const [pid, p] of players) {
      if (pid === player.id) continue;
      world_players.push(get_player_snapshot(p));
    }

    send(ws, MSG.HELLO, {
      player_id   : player.id,
      session     : player.session,
      username    : player.username,
      tick_rate   : TICK_RATE_HZ,
      interp_ms   : INTERPOLATION_MS,
      room_id     : player.room_id,
      world_players,
      rooms       : [...rooms.values()].map(r => r.summary),
      sig         : SIG,
    });

    broadcast_all(MSG.PLAYER_JOIN, {
      player_id : player.id,
      username  : player.username,
      pos       : player.pos,
      rot       : player.rot,
      room_id   : player.room_id,
      rp        : player.rp,
    }, player.id);
  },

  [MSG.MOVE]: (ws, data) => {
    const player_id = sockets.get(ws);
    const player    = players.get(player_id);
    if (!player) return;

    const now = Date.now();

    const dt   = (now - player.last_pos_ts) / 1000;
    const dx   = (data.pos?.x || 0) - player.pos.x;
    const dz   = (data.pos?.z || 0) - player.pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    const MAX_SPEED_PER_SEC = 30;

    if (dt > 0 && dist / dt > MAX_SPEED_PER_SEC) {
      send(ws, MSG.ERROR, {
        code    : 'SPEED_HACK',
        message : 'Vitesse invalide détectée',
        pos     : player.pos,
      });
      return;
    }

    player.pos         = data.pos  || player.pos;
    player.rot         = data.rot  || player.rot;
    player.vel         = data.vel  || player.vel;
    player.anim        = data.anim;
    player.last_seen   = now;
    player.last_pos_ts = now;

    const nearby = get_nearby_players(player_id, 300);
    const update_msg = build_msg(MSG.PLAYER_UPDATE, {
      player_id,
      pos  : player.pos,
      rot  : player.rot,
      vel  : player.vel,
      anim : player.anim,
      ts   : now,
    });

    for (const pid of nearby) {
      const p = players.get(pid);
      if (p?.ws?.readyState === WebSocket.OPEN) p.ws.send(update_msg);
    }
  },

  [MSG.CHAT]: (ws, data) => {
    const player_id = sockets.get(ws);
    const player    = players.get(player_id);
    if (!player) return;

    const chat_type = data.type || 'local';
    const content   = String(data.content || '').slice(0, 256).trim();
    if (!content) return;

    const msg_data = {
      from      : player_id,
      username  : player.username,
      content,
      type      : chat_type,
      room_id   : player.room_id,
      ts        : Date.now(),
    };

    log('INFO', `Chat [${chat_type}] ${player.username}: ${content.slice(0, 50)}`);

    if (chat_type === 'global') {
      broadcast_all(MSG.CHAT_MESSAGE, msg_data);
    } else if (chat_type === 'local') {
      const nearby = get_nearby_players(player_id, 100);
      for (const pid of [player_id, ...nearby]) {
        const p = players.get(pid);
        if (p?.ws?.readyState === WebSocket.OPEN) {
          send(p.ws, MSG.CHAT_MESSAGE, msg_data);
        }
      }
    } else if (chat_type === 'room') {
      const room = rooms.get(player.room_id);
      room?.broadcast(MSG.CHAT_MESSAGE, msg_data);
    } else if (chat_type === 'whisper' && data.target_id) {
      const target = players.get(data.target_id);
      if (target?.ws?.readyState === WebSocket.OPEN) {
        send(target.ws, MSG.CHAT_MESSAGE, { ...msg_data, whisper: true });
        send(ws, MSG.CHAT_MESSAGE, { ...msg_data, whisper: true, sent: true });
      }
    }
  },

  [MSG.RP_ACTION]: (ws, data) => {
    const player_id = sockets.get(ws);
    const player    = players.get(player_id);
    if (!player) return;

    const action  = data.action;
    const payload = data.payload || {};

    log('RP', `Action RP — ${player.username}: ${action}`);

    const result = rp_action_handler(player, action, payload);

    const nearby = get_nearby_players(player_id, 200);
    const rp_msg = build_msg(MSG.RP_EVENT, {
      player_id,
      username : player.username,
      action,
      payload  : result.public_data || {},
      ts       : Date.now(),
    });

    for (const pid of [player_id, ...nearby]) {
      const p = players.get(pid);
      if (p?.ws?.readyState === WebSocket.OPEN) p.ws.send(rp_msg);
    }

    if (result.private_data) {
      send(ws, MSG.RP_EVENT, {
        action,
        private : true,
        data    : result.private_data,
      });
    }
  },

  [MSG.INTERACT]: (ws, data) => {
    const player_id = sockets.get(ws);
    const player    = players.get(player_id);
    if (!player) return;

    const target_type = data.target_type;
    const target_id   = data.target_id;

    log('INFO', `Interaction — ${player.username} → ${target_type}:${target_id}`);

    if (target_type === 'player') {
      const target = players.get(target_id);
      if (target?.ws?.readyState === WebSocket.OPEN) {
        send(target.ws, MSG.RP_EVENT, {
          type      : 'INTERACT_REQUEST',
          from_id   : player_id,
          from_name : player.username,
          action    : data.action,
          data      : data.extra || {},
        });
      }
    }

    broadcast_all(MSG.RP_EVENT, {
      type      : 'INTERACT',
      player_id,
      target_type,
      target_id,
      action    : data.action,
    }, null);
  },

  [MSG.JOIN_ROOM]: (ws, data) => {
    const player_id = sockets.get(ws);
    const player    = players.get(player_id);
    if (!player || !data.room_id) return;

    // Validation basique du room_id pour éviter les abus
    const raw_id = String(data.room_id);
    if (raw_id.length === 0 || raw_id.length > MAX_ROOM_ID_LEN || !/^[a-zA-Z0-9_\-]+$/.test(raw_id)) {
      return send(ws, MSG.ERROR, { code: 'INVALID_ROOM_ID' });
    }

    const old_room = rooms.get(player.room_id);
    const new_room = rooms.get(raw_id) || (() => {
      const r = new Room(raw_id, data.room_name || raw_id, 'instance');
      rooms.set(raw_id, r);
      return r;
    })();

    if (!new_room.add(player_id)) {
      return send(ws, MSG.ERROR, { code: 'ROOM_FULL', message: 'Room pleine' });
    }

    old_room?.remove(player_id);
    old_room?.broadcast(MSG.PLAYER_LEAVE, { player_id, room_id: player.room_id });

    player.room_id = raw_id;

    send(ws, MSG.ROOM_UPDATE, {
      room_id  : raw_id,
      room_name: new_room.name,
      players  : [...new_room.players],
    });

    new_room.broadcast(MSG.PLAYER_JOIN, {
      player_id,
      username : player.username,
      pos      : player.pos,
    }, player_id);

    log('INFO', `${player.username} → room ${raw_id}`);
  },

  [MSG.LEAVE_ROOM]: (ws, _data) => {
    const player_id = sockets.get(ws);
    const player    = players.get(player_id);
    if (!player) return;

    const old_room = rooms.get(player.room_id);
    old_room?.remove(player_id);
    old_room?.broadcast(MSG.PLAYER_LEAVE, { player_id });

    player.room_id = 'world_main';
    const main = rooms.get('world_main');
    main?.add(player_id);

    send(ws, MSG.ROOM_UPDATE, { room_id: 'world_main' });
  },

  [MSG.PONG]: (ws, _data) => {
    const player_id = sockets.get(ws);
    const player    = players.get(player_id);
    if (!player || !player._ping_sent) return;
    player.ping_ms    = Date.now() - player._ping_sent;
    player._ping_sent = null;
  },
};

// ─── LOGIQUE RP ACTIONS ───────────────────────────────────────────────────────
function rp_action_handler(player, action, payload) {
  const result = { public_data: {}, private_data: null };

  switch (action) {
    case 'EMOTE':
      result.public_data = { emote: payload.emote, player_id: player.id };
      break;

    case 'GIVE_CASH': {
      const target = payload.target_id ? players.get(payload.target_id) : null;
      const amount = Math.min(payload.amount || 0, player.rp.cash);

      // Déduire SEULEMENT si la cible existe ET montant valide
      if (amount > 0 && target) {
        player.rp.cash -= amount;
        target.rp.cash += amount;
        result.public_data  = { action: 'GIVE_CASH', from: player.id, to: payload.target_id, amount };
        result.private_data = { cash: player.rp.cash };
      } else if (!target) {
        result.private_data = { error: 'TARGET_NOT_FOUND', cash: player.rp.cash };
      }
      break;
    }

    case 'USE_ITEM':
      result.public_data = { item: payload.item, player_id: player.id };
      if (payload.item === 'sandwich') {
        player.rp.needs.hunger = Math.min(100, player.rp.needs.hunger + 40);
        result.private_data = { needs: player.rp.needs };
      } else if (payload.item === 'bouteille_eau') {
        player.rp.needs.thirst = Math.min(100, player.rp.needs.thirst + 40);
        result.private_data = { needs: player.rp.needs };
      } else if (payload.item === 'medkit') {
        player.rp.needs.health = Math.min(100, player.rp.needs.health + 50);
        result.private_data = { needs: player.rp.needs };
      }
      break;

    case 'SET_JOB':
      player.rp.job = payload.job || null;
      result.public_data  = { player_id: player.id, job: player.rp.job };
      result.private_data = { rp: player.rp };
      break;

    case 'COMMIT_CRIME':
      player.rp.wanted = Math.min(5, player.rp.wanted + (payload.wanted_gain || 1));
      result.public_data  = { crime: payload.crime, player_id: player.id, wanted: player.rp.wanted };
      result.private_data = { wanted: player.rp.wanted };
      break;

    case 'ARREST':
      if (payload.target_id) {
        const target = players.get(payload.target_id);
        if (target) {
          const fine = target.rp.wanted * 2000;
          target.rp.cash   = Math.max(0, target.rp.cash - fine);
          target.rp.wanted = 0;
          result.public_data = { action:'ARREST', officer:player.id, suspect:payload.target_id, fine };
          if (target.ws?.readyState === WebSocket.OPEN) {
            send(target.ws, MSG.RP_EVENT, { type:'ARRESTED', fine, by: player.id });
          }
        }
      }
      break;

    case 'HEAL':
      if (payload.target_id) {
        const target = players.get(payload.target_id);
        if (target) {
          target.rp.needs.health = Math.min(100, (target.rp.needs.health || 0) + (payload.amount || 30));
          result.public_data = { action:'HEAL', by:player.id, target:payload.target_id };
          if (target.ws?.readyState === WebSocket.OPEN) {
            send(target.ws, MSG.RP_EVENT, { type:'HEALED', health:target.rp.needs.health });
          }
        }
      }
      break;

    default:
      result.public_data = { action, payload, player_id: player.id };
  }

  return result;
}

// ─── SNAPSHOT ─────────────────────────────────────────────────────────────────
function get_player_snapshot(p) {
  return {
    id       : p.id,
    username : p.username,
    pos      : p.pos,
    rot      : p.rot,
    vel      : p.vel,
    anim     : p.anim,
    room_id  : p.room_id,
    rp       : {
      health  : p.rp.needs.health,
      job     : p.rp.job,
      faction : p.rp.faction,
      wanted  : p.rp.wanted,
    },
    ping_ms  : p.ping_ms,
  };
}

// ─── BOUCLE DE TICK ──────────────────────────────────────────────────────────
let tick_count = 0;
const tick_loop = setInterval(() => {
  tick_count++;
  stats.ticks_processed++;
  const now = Date.now();

  for (const [, player] of players) {
    if (now - player.last_seen > TIMEOUT_SEC * 1000) {
      log('WARN', `Timeout: ${player.username}`);
      player.ws?.close();
      remove_player(player.ws);
      continue;
    }

    if (tick_count % (TICK_RATE_HZ * 60) === 0) {
      player.rp.needs.hunger = Math.max(0, player.rp.needs.hunger - 1);
      player.rp.needs.thirst = Math.max(0, player.rp.needs.thirst - 1.5);
      player.rp.needs.energy = Math.max(0, player.rp.needs.energy - 0.5);
      if (player.rp.wanted > 0 && tick_count % (TICK_RATE_HZ * 300) === 0) {
        player.rp.wanted = Math.max(0, player.rp.wanted - 1);
      }
    }
  }

  if (tick_count % 3 === 0 && players.size > 1) {
    const all_snapshots = [];
    for (const [, p] of players) {
      all_snapshots.push({
        id  : p.id,
        pos : p.pos,
        rot : p.rot,
        vel : p.vel,
        anim: p.anim,
        ts  : p.last_pos_ts,
      });
    }
    const batch_msg = build_msg(MSG.PLAYERS_BATCH, { players: all_snapshots, tick: tick_count });
    for (const [, p] of players) {
      if (p.ws?.readyState === WebSocket.OPEN) p.ws.send(batch_msg);
    }
  }

  if (tick_count % (TICK_RATE_HZ * 5) === 0) {
    for (const [, p] of players) {
      if (p.ws?.readyState === WebSocket.OPEN) {
        p._ping_sent = now;
        send(p.ws, MSG.PING, { ts: now });
      }
    }
  }

}, TICK_MS);

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('X-TROXT-Signature', SIG);
  next();
});

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  log('WS', `Nouvelle connexion depuis ${ip}`);

  // Auth timeout — clear UNIQUEMENT quand AUTH est reçu
  const auth_timeout = setTimeout(() => {
    if (!sockets.has(ws)) {
      log('WARN', `Auth timeout — fermeture connexion ${ip}`);
      ws.close();
    }
  }, 5000);

  ws.on('message', (raw) => {
    stats.total_messages++;
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, MSG.ERROR, { code:'PARSE_ERROR', message:'JSON invalide' });
    }

    // Clear le timer seulement sur AUTH
    if (msg.type === MSG.AUTH) clearTimeout(auth_timeout);

    const handler = handlers[msg.type];
    if (handler) {
      try {
        handler(ws, msg.data || {});
      } catch (err) {
        log('ERROR', `Handler ${msg.type}: ${err.message}`);
        send(ws, MSG.ERROR, { code:'HANDLER_ERROR', message: err.message });
      }
    } else {
      send(ws, MSG.ERROR, { code:'UNKNOWN_MSG', type: msg.type });
    }
  });

  ws.on('close', () => remove_player(ws));
  ws.on('error', (err) => {
    log('ERROR', `WS error: ${err.message}`);
    remove_player(ws);
  });
});

// ─── REST API ─────────────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({
    sig          : SIG,
    version      : VERSION,
    status       : 'online',
    players      : players.size,
    max_players  : MAX_PLAYERS,
    rooms        : rooms.size,
    tick_rate    : TICK_RATE_HZ,
    uptime_sec   : Math.floor((Date.now() - stats.started_at) / 1000),
    stats,
  });
});

app.get('/api/players', (_req, res) => {
  const list = [];
  for (const [, p] of players) {
    list.push({
      id       : p.id,
      username : p.username,
      room_id  : p.room_id,
      ping_ms  : p.ping_ms,
      wanted   : p.rp.wanted,
      job      : p.rp.job,
    });
  }
  res.json({ ok: true, count: list.length, players: list, sig: SIG });
});

app.get('/api/rooms', (_req, res) => {
  const list = [...rooms.values()].map(r => r.summary);
  res.json({ ok: true, rooms: list, sig: SIG });
});

app.post('/api/kick', (req, res) => {
  const { player_id, reason } = req.body;
  const p = players.get(player_id);
  if (!p) return res.status(404).json({ error: 'Joueur introuvable' });
  send(p.ws, MSG.KICK, { reason: reason || 'Expulsion admin' });
  setTimeout(() => p.ws?.close(), 500);
  res.json({ ok: true, kicked: player_id, sig: SIG });
});

app.post('/api/broadcast', (req, res) => {
  const { message, type } = req.body;
  if (!message) return res.status(400).json({ error: 'message requis' });
  broadcast_all(MSG.CHAT_MESSAGE, {
    from    : '[SERVEUR]',
    username: 'TROXT⬡',
    content : message,
    type    : type || 'global',
    server  : true,
  });
  res.json({ ok: true, sent_to: players.size, sig: SIG });
});

app.get('/api/admin/metrics', (_req, res) => {
  res.json({
    sig           : SIG,
    players_online: players.size,
    peak_players  : stats.peak_players,
    rooms_active  : rooms.size,
    total_connects: stats.total_connects,
    total_messages: stats.total_messages,
    ticks         : stats.ticks_processed,
    uptime_sec    : Math.floor((Date.now() - stats.started_at) / 1000),
    memory_mb     : (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
  });
});

// ─── DÉMARRAGE ────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log(`  ${SIG} — RP Server v${VERSION}`);
  console.log(`  → HTTP : http://localhost:${PORT}/api/status`);
  console.log(`  → WS   : ws://localhost:${PORT}/ws`);
  console.log(`  → Tick : ${TICK_RATE_HZ}Hz (${TICK_MS}ms)`);
  console.log(`  → Max  : ${MAX_PLAYERS} joueurs / ${MAX_ROOM_PLAYERS} par room`);
  console.log('');
});

process.on('SIGINT',  () => { clearInterval(tick_loop); log('WARN','Arrêt serveur'); process.exit(0); });
process.on('SIGTERM', () => { clearInterval(tick_loop); log('WARN','Arrêt serveur'); process.exit(0); });

export { players, rooms, broadcast_all, build_msg, SIG };
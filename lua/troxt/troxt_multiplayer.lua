--[[
══════════════════════════════════════════════════════════════════════
  TROXT⬡ — TROXT_MULTIPLAYER.LUA
  Logique multijoueur côté TROXT⬡ — Rooms · Zones · Anti-cheat · Sync

  Signature : TROXT⬡
  Chemin    : lua/troxt/troxt_multiplayer.lua
══════════════════════════════════════════════════════════════════════
]]

local MP     = {}
local Events = require("troxt.troxt_events")
local Memory = require("troxt.troxt_memory")

local SIG   = "TROXT⬡"
local ISIG  = "🛡️INTELLECTUS⬡"

local function log(level, msg, data)
  local icons = { INFO="ℹ", WARN="⚠", OK="✓", MP="⚡", CHEAT="🚫", CRITICAL="🔴" }
  print(string.format("[%s] %s [%s] %s",
    os.date("%H:%M:%S"), icons[level] or "·", SIG, msg))
  if data then
    for k, v in pairs(data) do
      print(string.format("   ↳ %s: %s", k, tostring(v)))
    end
  end
end

local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── CONFIG ──────────────────────────────────────────────────────────────────
local CFG = {
  max_players        = 500,
  max_per_room       = 50,
  tick_rate          = 20,
  timeout_sec        = 30,
  max_speed_per_sec  = 30,
  max_pos_jump       = 50,
  max_actions_per_sec= 10,
  zoi_radius         = 300,
  default_room       = "world_main",
  max_chat_len       = 256,
  chat_rate_per_sec  = 2,
  -- Note anti-cheat : os.time() a une précision d'1 seconde. À 20 Hz,
  -- dt vaut presque toujours 0 ou 1. On utilise une fenêtre glissante
  -- plutôt qu'un dt instantané pour détecter les téléports massifs.
  speed_window_sec   = 2,   -- fenêtre de calcul de vitesse (secondes)
}

-- ─── ÉTAT ─────────────────────────────────────────────────────────────────────
local _players       = {}
local _rooms         = {}
local _zones         = {}
local _action_counts = {}
local _cheat_log     = {}

local _stats = {
  total_joins       = 0,
  total_leaves      = 0,
  total_messages    = 0,
  cheats_detected   = 0,
  ticks_processed   = 0,
  peak_players      = 0,
}

-- ─── ROOMS ────────────────────────────────────────────────────────────────────
local function create_default_rooms()
  local defaults = {
    { id="world_main",        name="TroxtWorld — Monde Principal", public=true },
    { id="centre_ville",      name="Centre-Ville",                 public=true },
    { id="port_industriel",   name="Port Industriel",              public=true },
    { id="zone_residentielle",name="Zone Résidentielle",           public=true },
  }
  for _, def in ipairs(defaults) do
    _rooms[def.id] = {
      id       = def.id,
      name     = def.name,
      public   = def.public,
      players  = {},
      state    = {},
      created  = os.time(),
      sig      = SIG,
    }
  end
end

function MP.get_room(room_id)
  if not _rooms[room_id] then
    _rooms[room_id] = {
      id      = room_id,
      name    = room_id,
      public  = false,
      players = {},
      state   = {},
      created = os.time(),
      sig     = SIG,
    }
  end
  return _rooms[room_id]
end

function MP.room_player_count(room_id)
  local room = _rooms[room_id]
  if not room then return 0 end
  return count_keys(room.players)
end

-- ─── JOIN / LEAVE ─────────────────────────────────────────────────────────────
function MP.player_join(player_id, username, auth_data)
  -- Reconnexion : le joueur existe déjà
  if _players[player_id] then
    local p = _players[player_id]
    p.connected = true
    p.last_seen = os.time()
    p.username  = username or p.username
    -- ✅ S'assurer que le joueur est bien dans une room (fix ghost reconnect)
    local room = MP.get_room(p.room_id or CFG.default_room)
    room.players[player_id] = true
    return p, true
  end

  local player = {
    id          = player_id,
    username    = username or ("Player_" .. player_id:sub(1, 6)),
    room_id     = CFG.default_room,
    pos         = auth_data and auth_data.pos or { x=0, y=0, z=0 },
    rot         = auth_data and auth_data.rot or { x=0, y=0, z=0 },
    vel         = { x=0, y=0, z=0 },
    anim        = nil,
    connected   = true,
    connected_at= os.time(),
    last_seen   = os.time(),
    last_pos_ts = os.time(),
    ping_ms     = 0,
    rp = {
      health  = 100,
      cash    = 2500,
      job     = nil,
      faction = nil,
      wanted  = 0,
      needs   = { health=100, hunger=100, thirst=100, energy=100, stress=0 },
    },
    ac = {
      violations = 0,
      last_check = os.time(),
      flagged    = false,
      -- ✅ Pour le calcul de vitesse sur fenêtre glissante
      speed_ref_pos  = nil,
      speed_ref_ts   = nil,
    },
    sig = SIG,
  }

  _players[player_id] = player
  _stats.total_joins  = _stats.total_joins + 1
  local current = count_keys(_players)
  _stats.peak_players = math.max(_stats.peak_players, current)

  local room = MP.get_room(CFG.default_room)
  room.players[player_id] = true

  log("OK", string.format("JOIN — %s [%s]", player.username, player_id:sub(1,8)))

  Events.emit("troxtworld:player_joined_mp", {
    player_id = player_id,
    username  = username,
    room_id   = CFG.default_room,
    sig       = SIG,
  })

  return player, false
end

function MP.player_leave(player_id, reason)
  local player = _players[player_id]
  if not player then return false end   -- ✅ guard double-leave

  -- Quitter la room
  local room = _rooms[player.room_id]
  if room then room.players[player_id] = nil end

  -- ✅ Quitter la zone d'intérêt (fix fuite _zones)
  if player._zone and _zones[player._zone] then
    _zones[player._zone][player_id] = nil
    -- Nettoyer la zone si elle devient vide
    if count_keys(_zones[player._zone]) == 0 then
      _zones[player._zone] = nil
    end
  end

  -- Nettoyer le rate limiter
  _action_counts[player_id] = nil

  _players[player_id] = nil
  _stats.total_leaves = _stats.total_leaves + 1

  log("INFO", string.format("LEAVE — %s (%s)", player.username, reason or "disconnect"))

  Events.emit("troxtworld:player_left_mp", {
    player_id = player_id,
    username  = player.username,
    reason    = reason,
    sig       = SIG,
  })

  return true
end

-- ─── MISE À JOUR POSITION ─────────────────────────────────────────────────────
function MP.update_position(player_id, pos, rot, vel, anim)
  local player = _players[player_id]
  if not player then return false, "Joueur introuvable" end
  if player.ac.flagged then return false, "PLAYER_FLAGGED" end  -- ✅ bloque les flagged

  local now = os.time()

  -- ── Anti-cheat : fenêtre glissante (dt = ~2s, fiable malgré os.time()) ─
  if not player.ac.speed_ref_ts or (now - player.ac.speed_ref_ts) >= CFG.speed_window_sec then
    -- Nouveau point de référence
    if player.ac.speed_ref_pos and player.ac.speed_ref_ts then
      local dt   = now - player.ac.speed_ref_ts
      local ref  = player.ac.speed_ref_pos
      local dx   = pos.x - ref.x
      local dz   = pos.z - ref.z
      local dist = math.sqrt(dx*dx + dz*dz)
      local speed= dist / dt

      if speed > CFG.max_speed_per_sec then
        player.ac.violations = player.ac.violations + 1
        log("CHEAT", string.format("SPEED HACK — %s speed=%.0f/s max=%d/s viol=%d",
          player.username, speed, CFG.max_speed_per_sec, player.ac.violations))

        table.insert(_cheat_log, 1, {
          player_id = player_id,
          username  = player.username,
          type      = "SPEED_HACK",
          speed     = speed,
          at        = now,
          sig       = SIG,
        })
        if #_cheat_log > 500 then table.remove(_cheat_log) end

        _stats.cheats_detected = _stats.cheats_detected + 1

        if player.ac.violations >= 5 then
          player.ac.flagged = true
          Events.emit("intellectus:cheat_detected", {
            player_id  = player_id,
            username   = player.username,
            type       = "SPEED_HACK",
            violations = player.ac.violations,
            sig        = SIG,
          })
        end

        Events.emit("troxtworld:position_rollback", {
          player_id = player_id,
          pos       = player.pos,
          sig       = SIG,
        })
        -- Reset la référence sur la position serveur (rollback)
        player.ac.speed_ref_pos = { x = player.pos.x, y = player.pos.y, z = player.pos.z }
        player.ac.speed_ref_ts  = now
        return false, "SPEED_VIOLATION"
      end
    end
    -- Nouvelle référence pour la prochaine fenêtre
    player.ac.speed_ref_pos = { x = pos.x, y = pos.y, z = pos.z }
    player.ac.speed_ref_ts  = now
  end

  -- ── Anti-cheat : saut de position instantané ────────────────────────────
  local dx_i = pos.x - player.pos.x
  local dz_i = pos.z - player.pos.z
  if math.sqrt(dx_i*dx_i + dz_i*dz_i) > CFG.max_pos_jump then
    player.ac.violations = player.ac.violations + 1
    log("CHEAT", string.format("POSITION JUMP — %s", player.username))
    Events.emit("troxtworld:position_rollback", {
      player_id = player_id,
      pos       = player.pos,
      sig       = SIG,
    })
    return false, "POSITION_JUMP"
  end

  -- Tout OK — mettre à jour
  player.pos         = pos
  player.rot         = rot  or player.rot
  player.vel         = vel  or player.vel
  player.anim        = anim
  player.last_seen   = now
  player.last_pos_ts = now

  MP._update_zone(player_id, pos)
  return true
end

-- ─── ZONES D'INTÉRÊT ─────────────────────────────────────────────────────────
local ZONE_SIZE = 200

local function pos_to_zone(pos)
  local gx = math.floor((pos.x or 0) / ZONE_SIZE)
  local gz = math.floor((pos.z or 0) / ZONE_SIZE)
  return string.format("%d:%d", gx, gz)
end

function MP._update_zone(player_id, pos)
  local new_zone = pos_to_zone(pos)
  local player   = _players[player_id]
  if not player then return end

  local old_zone = player._zone
  if old_zone == new_zone then return end

  -- Quitter l'ancienne zone + nettoyer si vide
  if old_zone and _zones[old_zone] then
    _zones[old_zone][player_id] = nil
    if count_keys(_zones[old_zone]) == 0 then
      _zones[old_zone] = nil
    end
  end

  if not _zones[new_zone] then _zones[new_zone] = {} end
  _zones[new_zone][player_id] = true
  player._zone = new_zone
end

function MP.get_nearby_players(player_id)
  local player = _players[player_id]
  if not player or not player.pos then return {} end

  local nearby    = {}
  local px, pz    = player.pos.x or 0, player.pos.z or 0
  local radius_sq = CFG.zoi_radius * CFG.zoi_radius

  for id, other in pairs(_players) do
    if id ~= player_id and other.connected then
      local dx = (other.pos.x or 0) - px
      local dz = (other.pos.z or 0) - pz
      if dx*dx + dz*dz <= radius_sq then
        table.insert(nearby, id)
      end
    end
  end

  return nearby
end

-- ─── ANTI-CHEAT ACTIONS ──────────────────────────────────────────────────────
function MP.check_action_rate(player_id)
  local now = os.time()
  if not _action_counts[player_id] then
    _action_counts[player_id] = { count=0, window_start=now }
  end
  local ac = _action_counts[player_id]

  if now - ac.window_start >= 1 then
    ac.count        = 0
    ac.window_start = now
  end

  ac.count = ac.count + 1

  if ac.count > CFG.max_actions_per_sec then
    local player = _players[player_id]
    if player then
      player.ac.violations = player.ac.violations + 1
      log("CHEAT", string.format("ACTION FLOOD — %s %d/s (max %d)",
        player.username, ac.count, CFG.max_actions_per_sec))
    end
    return false, "ACTION_RATE_EXCEEDED"
  end

  return true
end

-- ─── TIMEOUT ─────────────────────────────────────────────────────────────────
function MP.check_timeouts()
  local now      = os.time()
  local timedout = {}

  for id, player in pairs(_players) do
    if player.connected and (now - player.last_seen) > CFG.timeout_sec then
      table.insert(timedout, id)
    end
  end

  for _, id in ipairs(timedout) do
    local p = _players[id]
    log("WARN", string.format("Timeout — %s", p and p.username or id))
    MP.player_leave(id, "timeout")
  end

  return timedout
end

-- ─── TICK ────────────────────────────────────────────────────────────────────
function MP.tick()
  _stats.ticks_processed = _stats.ticks_processed + 1

  -- Besoins vitaux toutes les 3 secondes
  if _stats.ticks_processed % (CFG.tick_rate * 3) == 0 then
    for id, player in pairs(_players) do
      if player.connected and player.rp and player.rp.needs then
        local n = player.rp.needs
        n.hunger = math.max(0, n.hunger - 0.05)
        n.thirst = math.max(0, n.thirst - 0.08)
        n.energy = math.max(0, n.energy - 0.03)
        if player.rp.wanted and player.rp.wanted > 0 then
          n.stress = math.min(100, n.stress + 0.1)
        else
          n.stress = math.max(0, n.stress - 0.05)
        end
        if n.hunger < 20 or n.thirst < 20 then
          n.health = math.max(0, n.health - 0.1)
        end
        if n.health <= 0 then
          Events.emit("troxtworld:player_died_mp", {
            player_id = id,
            cause     = "besoins_vitaux",
            sig       = SIG,
          })
        end
      end
    end
  end

  -- Timeout check toutes les 5 secondes
  if _stats.ticks_processed % (CFG.tick_rate * 5) == 0 then
    MP.check_timeouts()
  end

  -- Wanted décroît toutes les 5 minutes
  if _stats.ticks_processed % (CFG.tick_rate * 300) == 0 then
    for _, player in pairs(_players) do
      if player.rp and player.rp.wanted and player.rp.wanted > 0 then
        player.rp.wanted = math.max(0, player.rp.wanted - 1)
        Events.emit("troxtworld:wanted_decay_mp", {
          player_id = player.id,
          wanted    = player.rp.wanted,
          sig       = SIG,
        })
      end
    end
  end

  Events.emit("troxtworld:mp_tick", {
    tick    = _stats.ticks_processed,
    players = count_keys(_players),    -- ✅ valeur réelle, pas un compteur
    sig     = SIG,
  })
end

-- ─── CHAT ────────────────────────────────────────────────────────────────────
function MP.chat_message(player_id, content, chat_type, target_id)
  local player = _players[player_id]
  if not player then return false end

  local rate_ok = MP.check_action_rate(player_id)
  if not rate_ok then return false, "CHAT_RATE_EXCEEDED" end

  -- ✅ Force la string, gère nil/number/table sans crash
  content = tostring(content or ""):sub(1, CFG.max_chat_len)
  if #content == 0 then return false end

  local msg = {
    from      = player_id,
    username  = player.username,
    content   = content,
    type      = chat_type or "local",
    room_id   = player.room_id,
    ts        = os.time(),
    sig       = SIG,
  }

  Events.emit("troxtworld:chat_mp", msg)
  _stats.total_messages = _stats.total_messages + 1
  return true, msg
end

-- ─── SNAPSHOT MONDE ──────────────────────────────────────────────────────────
function MP.get_world_snapshot()
  local snapshot = {
    sig     = SIG,
    ts      = os.time(),
    date    = os.date("%Y-%m-%d %H:%M:%S"),
    players = {},
    rooms   = {},
    stats   = {
      total_joins     = _stats.total_joins,
      total_leaves    = _stats.total_leaves,
      total_messages  = _stats.total_messages,
      cheats_detected = _stats.cheats_detected,
      ticks_processed = _stats.ticks_processed,
      peak_players    = _stats.peak_players,
      players_online  = count_keys(_players),   -- ✅ valeur réelle
    },
  }

  for id, player in pairs(_players) do
    if player.connected then
      table.insert(snapshot.players, {
        id       = id,
        username = player.username,
        pos      = player.pos,
        rot      = player.rot,
        room_id  = player.room_id,
        wanted   = player.rp and player.rp.wanted or 0,
        job      = player.rp and player.rp.job or nil,
        ping_ms  = player.ping_ms,
      })
    end
  end

  for id, room in pairs(_rooms) do
    local count = count_keys(room.players)
    if count > 0 then
      table.insert(snapshot.rooms, {
        id      = id,
        name    = room.name,
        players = count,
        public  = room.public,
      })
    end
  end

  return snapshot
end

-- ─── API PUBLIQUE ─────────────────────────────────────────────────────────────
function MP.get_player(id)    return _players[id] end
function MP.get_players()     return _players end
function MP.get_rooms()       return _rooms end

function MP.get_stats()
  return {
    players_online  = count_keys(_players),   -- ✅ valeur réelle
    peak_players    = _stats.peak_players,
    total_joins     = _stats.total_joins,
    total_leaves    = _stats.total_leaves,
    total_messages  = _stats.total_messages,
    cheats_detected = _stats.cheats_detected,
    ticks_processed = _stats.ticks_processed,
    rooms_total     = count_keys(_rooms),
    zones_total     = count_keys(_zones),
  }
end

function MP.get_cheat_log(n)
  local result = {}
  for i = 1, math.min(n or 50, #_cheat_log) do
    table.insert(result, _cheat_log[i])
  end
  return result
end

function MP.player_count() return count_keys(_players) end

function MP.get_signature() return SIG end

-- ─── INIT ─────────────────────────────────────────────────────────────────────
function MP.init()
  create_default_rooms()
  local rooms_count = count_keys(_rooms)
  log("OK", string.format("[%s] Multijoueur initialisé — %d rooms — max %d joueurs",
    SIG, rooms_count, CFG.max_players))
  Events.emit("troxtworld:mp_ready", { sig=SIG, rooms=rooms_count })  -- ✅ plus 0
end

MP.init()
return MP
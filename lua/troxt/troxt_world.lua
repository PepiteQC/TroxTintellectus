--[[
══════════════════════════════════════════════════════════════════════
  TROXT⬡ — TROXT_WORLD.LUA
  Open World State — Zones · Territoires · Météo · Heure · Événements

  Signature : TROXT⬡
  Chemin    : lua/troxt/troxt_world.lua
══════════════════════════════════════════════════════════════════════
]]

local World  = {}
local Events = require("troxt.troxt_events")
local Memory = require("troxt.troxt_memory")

local SIG = "TROXT⬡"

local function log(level, msg)
  local icons = { INFO="ℹ", WARN="⚠", OK="✓", EVENT="🌍" }
  print(string.format("[%s] %s [%s] %s", os.date("%H:%M:%S"), icons[level] or "·", SIG, msg))
end

-- ─── CONFIGURATION MONDE ─────────────────────────────────────────────────────
local CFG = {
  day_duration_sec  = 3600,
  time_scale        = 24,
  weather_change_min = 600,
  weather_change_max = 1800,
  vehicle_spawn_interval = 300,
  npc_spawn_interval     = 120,
  loot_spawn_interval    = 600,
  loot_despawn_sec       = 900,
  loot_pickup_range      = 3.5,   -- ✅ portée de ramassage (unités)
}

-- ─── ZONES DU MONDE ──────────────────────────────────────────────────────────
local ZONES = {
  centre_ville = {
    id="centre_ville", name="Centre-Ville TroxtWorld", icon="🏙️",
    bounds={ x1=-200, z1=-200, x2=200, z2=200 },
    safe=true, legal=true,
    services={ "banque", "hopital", "concessionnaire", "magasin" },
    spawn_points={ { x=0, y=0, z=0 }, { x=50, y=0, z=50 } },
    ambient_music="city_day",
  },
  port = {
    id="port", name="Port Industriel", icon="⚓",
    bounds={ x1=200, z1=-300, x2=500, z2=0 },
    safe=false, legal=false,
    services={ "entrepôt", "marché_noir" },
    spawn_points={ { x=300, y=0, z=-150 } },
    ambient_music="port_ambient",
    faction_territory=nil,
  },
  banlieue = {
    id="banlieue", name="Quartier Résidentiel", icon="🏘️",
    bounds={ x1=-500, z1=-200, x2=-200, z2=300 },
    safe=true, legal=true,
    services={ "épicerie", "garage", "appartements" },
    spawn_points={ { x=-350, y=0, z=0 } },
    ambient_music="suburb_calm",
  },
  zone_industrielle = {
    id="zone_industrielle", name="Zone Industrielle", icon="🏭",
    bounds={ x1=-200, z1=300, x2=200, z2=600 },
    safe=false, legal=true,
    services={ "usine", "entrepôt", "garage_mecano" },
    spawn_points={ { x=0, y=0, z=450 } },
    ambient_music="industrial",
  },
  foret = {
    id="foret", name="Forêt TroxtWorld", icon="🌲",
    bounds={ x1=200, z1=200, x2=600, z2=600 },
    safe=false, legal=true,
    services={ "chasse", "cueillette" },
    spawn_points={ { x=400, y=0, z=400 } },
    ambient_music="nature_calm",
    loot_rate=1.5,
  },
  ghetto = {
    id="ghetto", name="Quartier Est", icon="🏚️",
    bounds={ x1=200, z1=-600, x2=500, z2=-300 },
    safe=false, legal=false,
    services={ "marché_noir", "safe_house" },
    spawn_points={ { x=350, y=0, z=-450 } },
    ambient_music="street_beats",
    faction_territory="gang_rue",
    crime_rate=2.0,
  },
  aeroport = {
    id="aeroport", name="Aéroport International", icon="✈️",
    bounds={ x1=-600, z1=300, x2=-200, z2=700 },
    safe=true, legal=true,
    services={ "transport", "hangar", "douane" },
    spawn_points={ { x=-400, y=0, z=500 } },
    ambient_music="airport",
  },
}

-- ─── MÉTÉO ────────────────────────────────────────────────────────────────────
local WEATHER_TYPES = {
  clear    = { name="Ensoleillé",   icon="☀️", fog=0.0,  rain=false, wind=0.1, visibility=1.0 },
  cloudy   = { name="Nuageux",      icon="☁️", fog=0.1,  rain=false, wind=0.3, visibility=0.85 },
  rain     = { name="Pluie",        icon="🌧️", fog=0.2,  rain=true,  wind=0.5, visibility=0.6 },
  storm    = { name="Orage",        icon="⛈️", fog=0.3,  rain=true,  wind=0.9, visibility=0.3 },
  fog      = { name="Brouillard",   icon="🌫️", fog=0.8,  rain=false, wind=0.1, visibility=0.2 },
  snow     = { name="Neige",        icon="❄️", fog=0.2,  rain=false, wind=0.4, visibility=0.5 },
  overcast = { name="Couvert",      icon="🌥️", fog=0.05, rain=false, wind=0.2, visibility=0.9 },
}

-- Fallback pour un ID inconnu
local WEATHER_FALLBACK = WEATHER_TYPES.clear

-- ─── ÉTAT MONDE ──────────────────────────────────────────────────────────────
local _state = {
  world_time_sec  = 21600,
  day_count       = 1,
  current_weather = "clear",
  next_weather_at = os.time() + 900,
  zone_players    = {},
  territories     = {},
  active_loot     = {},
  active_events   = {},
  total_players_spawned = 0,
  crimes_today    = 0,
  started_at      = os.time(),
}

-- ✅ Suivi précis du dernier pulse (au lieu du modulo fragile)
local _last_pulse_minute = -1
local _loot_seq          = 0

-- ─── HELPERS ─────────────────────────────────────────────────────────────────
local function weather_of(id)
  return WEATHER_TYPES[id] or WEATHER_FALLBACK
end

-- ─── INIT ─────────────────────────────────────────────────────────────────────
function World.init()
  local saved = Memory.get("world:state")
  if saved then
    _state.world_time_sec  = saved.world_time_sec  or _state.world_time_sec
    _state.day_count       = saved.day_count       or 1
    _state.current_weather = saved.current_weather or "clear"
    _state.territories     = saved.territories     or {}
  end

  for id, _ in pairs(ZONES) do
    _state.zone_players[id] = {}
  end

  local w = weather_of(_state.current_weather)
  log("OK", string.format("[%s] Monde initialisé — Jour %d — %s %s",
    SIG, _state.day_count, w.icon, w.name))

  Events.emit("troxtworld:world_ready", {
    day     = _state.day_count,
    weather = _state.current_weather,
    time    = World.get_time_str(),
    sig     = SIG,
  })
end

-- ─── TICK MONDE ──────────────────────────────────────────────────────────────
function World.tick(dt_sec)
  -- ✅ garde : dt invalide = on considère 0
  if type(dt_sec) ~= "number" or dt_sec <= 0 then dt_sec = 0 end

  local now = os.time()

  _state.world_time_sec = _state.world_time_sec + (dt_sec * CFG.time_scale)

  if _state.world_time_sec >= 86400 then
    _state.world_time_sec = _state.world_time_sec - 86400
    _state.day_count      = _state.day_count + 1
    _state.crimes_today   = 0
    log("EVENT", string.format("Nouveau jour — Jour %d", _state.day_count))
    Events.emit("troxtworld:new_day", { day=_state.day_count, sig=SIG })
  end

  if now >= _state.next_weather_at then
    World.change_weather()
  end

  -- Nettoyer loot expiré
  local to_remove = {}
  for loot_id, loot in pairs(_state.active_loot) do
    if now - loot.spawned_at > CFG.loot_despawn_sec then
      table.insert(to_remove, loot_id)
    end
  end
  for _, id in ipairs(to_remove) do _state.active_loot[id] = nil end

  -- ✅ Nettoyer les événements monde expirés (fix fuite mémoire)
  local expired_events = {}
  for instance_id, ev in pairs(_state.active_events) do
    if now >= ev.ends_at then
      table.insert(expired_events, instance_id)
      Events.emit("troxtworld:event_ended", {
        instance_id = instance_id,
        event_id    = ev.event_id,
        zone_id     = ev.zone_id,
        sig         = SIG,
      })
    end
  end
  for _, id in ipairs(expired_events) do
    _state.active_events[id] = nil
  end

  -- ✅ Pulse monde — une fois par minute RP, indépendant du taux de tick
  local current_minute = math.floor(_state.world_time_sec / 60)
  if current_minute ~= _last_pulse_minute then
    _last_pulse_minute = current_minute
    Events.emit("troxtworld:world_pulse", {
      time    = World.get_time_str(),
      day     = _state.day_count,
      weather = _state.current_weather,
      sig     = SIG,
    })
  end
end

-- ─── TEMPS ────────────────────────────────────────────────────────────────────
function World.get_time_str()
  local h = math.floor(_state.world_time_sec / 3600) % 24
  local m = math.floor((_state.world_time_sec % 3600) / 60)
  return string.format("%02d:%02d", h, m)
end

function World.is_night()
  local h = math.floor(_state.world_time_sec / 3600) % 24
  return h < 6 or h >= 22
end

function World.get_time_period()
  local h = math.floor(_state.world_time_sec / 3600) % 24
  if h >= 5  and h < 9  then return "aube"      end
  if h >= 9  and h < 12 then return "matin"     end
  if h >= 12 and h < 14 then return "midi"      end
  if h >= 14 and h < 18 then return "après-midi" end
  if h >= 18 and h < 21 then return "soirée"    end
  if h >= 21 and h < 24 then return "nuit"      end
  return "nuit_profonde"
end

-- ─── MÉTÉO ────────────────────────────────────────────────────────────────────
function World.change_weather(force_weather)
  local weather_list = { "clear", "clear", "cloudy", "overcast", "rain", "storm", "fog" }
  local new_weather  = force_weather

  -- Validation du forçage
  if new_weather and not WEATHER_TYPES[new_weather] then
    return false, "Météo inconnue: " .. tostring(new_weather)
  end

  if not new_weather then
    new_weather = weather_list[math.random(#weather_list)]
    if World.is_night() and math.random() < 0.15 then
      new_weather = "snow"
    end
  end

  local old = _state.current_weather
  _state.current_weather = new_weather
  _state.next_weather_at = os.time() + math.random(CFG.weather_change_min, CFG.weather_change_max)

  local w = weather_of(new_weather)
  log("EVENT", string.format("Météo: %s → %s %s", old, w.icon, w.name))

  Events.emit("troxtworld:weather_changed", {
    old=old, new=new_weather,
    icon=w.icon, name=w.name,
    fog=w.fog, rain=w.rain, wind=w.wind, visibility=w.visibility,
    sig=SIG,
  })

  return new_weather
end

function World.get_weather()
  local w = weather_of(_state.current_weather)
  return {
    id=_state.current_weather,
    name=w.name, icon=w.icon,
    fog=w.fog, rain=w.rain, wind=w.wind, visibility=w.visibility,
  }
end

-- ─── ZONES ────────────────────────────────────────────────────────────────────
function World.get_zone_at(x, z)
  for _, zone in pairs(ZONES) do
    local b = zone.bounds
    if x >= b.x1 and x <= b.x2 and z >= b.z1 and z <= b.z2 then
      return zone
    end
  end
  return nil
end

function World.player_enter_zone(player_id, zone_id)
  local zone = ZONES[zone_id]
  if not zone then
    return false, "Zone inconnue: " .. tostring(zone_id)   -- ✅ plus de retour nil silencieux
  end

  if not _state.zone_players[zone_id] then _state.zone_players[zone_id] = {} end
  _state.zone_players[zone_id][player_id] = true

  Events.emit("troxtworld:zone_entered", {
    player_id=player_id, zone_id=zone_id,
    zone_name=zone.name, zone_icon=zone.icon,
    safe=zone.safe, services=zone.services,
    sig=SIG,
  })
  return true, zone
end

function World.player_leave_zone(player_id, zone_id)
  local zone = ZONES[zone_id]
  if not zone then return false, "Zone inconnue" end

  if _state.zone_players[zone_id] then
    _state.zone_players[zone_id][player_id] = nil
  end

  Events.emit("troxtworld:zone_left", {
    player_id=player_id, zone_id=zone_id, sig=SIG,
  })
  return true
end

function World.get_players_in_zone(zone_id)
  local result = {}
  for pid, _ in pairs(_state.zone_players[zone_id] or {}) do
    table.insert(result, pid)
  end
  return result
end

-- ─── TERRITOIRES FACTIONS ────────────────────────────────────────────────────
function World.claim_territory(faction_id, zone_id)
  local zone = ZONES[zone_id]
  if not zone then return false, "Zone inexistante" end
  if zone.safe  then return false, "Zone safe — territoire interdit" end
  if zone.legal then return false, "Zone légale — territoire interdit" end

  local old_owner = _state.territories[zone_id]
  _state.territories[zone_id] = faction_id

  log("EVENT", string.format("Territoire: %s revendiqué par %s", zone.name, faction_id))
  Events.emit("troxtworld:territory_claimed", {
    faction_id=faction_id, zone_id=zone_id, zone_name=zone.name,
    old_owner=old_owner, sig=SIG,
  })
  return true
end

function World.get_territory(zone_id)
  return _state.territories[zone_id]
end

-- ─── ÉVÉNEMENTS MONDE ────────────────────────────────────────────────────────
local WORLD_EVENTS = {
  armored_car = {
    id="armored_car", name="Fourgon blindé", icon="🚐",
    duration=600, reward=25000, legal=false,
    zones={ "centre_ville", "zone_industrielle" },
  },
  drug_convoy = {
    id="drug_convoy", name="Convoi de marchandises illicites", icon="📦",
    duration=480, reward=15000, legal=false,
    zones={ "port", "ghetto" },
  },
  car_race = {
    id="car_race", name="Course de rue", icon="🏎️",
    duration=300, reward=5000, legal=false, min_players=2,
    zones={ "zone_industrielle", "port" },
  },
  market_day = {
    id="market_day", name="Journée de marché", icon="🛒",
    duration=3600, reward=0, legal=true,
    bonus={ buy_discount=0.15, sell_bonus=0.10 },
    zones={ "centre_ville", "banlieue" },
  },
  police_raid = {
    id="police_raid", name="Opération policière", icon="🚨",
    duration=900, reward=0, legal=true,
    effect={ wanted_clear=true, zone_lockdown=true },
    zones={ "ghetto", "port" },
  },
}

function World.trigger_event(event_id, zone_id)
  local ev = WORLD_EVENTS[event_id]
  if not ev then return false, "Événement inconnu: " .. tostring(event_id) end

  -- ✅ Refuser si le même événement tourne déjà dans cette zone
  for _, active in pairs(_state.active_events) do
    if active.event_id == event_id and active.zone_id == zone_id then
      return false, "Événement déjà actif dans cette zone"
    end
  end

  local instance_id = string.format("EVT_%s_%d", event_id, os.time())
  _state.active_events[instance_id] = {
    id=instance_id, event_id=event_id, zone_id=zone_id,
    started_at=os.time(),
    ends_at=os.time() + ev.duration,
    active=true,
  }

  log("EVENT", string.format("Événement: %s %s en zone %s", ev.icon, ev.name, zone_id))
  Events.emit("troxtworld:event_triggered", {
    instance_id=instance_id, event_id=event_id,
    name=ev.name, icon=ev.icon, zone_id=zone_id,
    duration=ev.duration, reward=ev.reward, sig=SIG,
  })

  return instance_id
end

-- ─── LOOT ────────────────────────────────────────────────────────────────────
local LOOT_TABLE = {
  cash_small  = { type="cash", amount=50,   weight=50 },
  cash_medium = { type="cash", amount=200,  weight=25 },
  cash_large  = { type="cash", amount=1000, weight=5  },
  ammo        = { type="item", item="munitions",        weight=30 },
  medkit      = { type="item", item="trousse_medicale", weight=20 },
  food        = { type="item", item="sandwich",         weight=40 },
  water       = { type="item", item="bouteille_eau",    weight=40 },
  weapon_part = { type="item", item="pièce_arme",       weight=5  },
  drugs       = { type="item", item="drogue_rue",       weight=8  },
}

function World.spawn_loot(x, y, z, zone_id)
  -- Choisir un loot par poids
  local total_weight = 0
  for _, loot in pairs(LOOT_TABLE) do total_weight = total_weight + loot.weight end
  local roll = math.random() * total_weight
  local chosen = nil
  for id, loot in pairs(LOOT_TABLE) do
    roll = roll - loot.weight
    if roll <= 0 then chosen = id break end
  end
  if not chosen then chosen = "cash_small" end

  -- ✅ ID unique : séquence monotone + timestamp + tirage
  _loot_seq = _loot_seq + 1
  local loot_id = string.format("LOOT_%d_%d_%d", os.time(), _loot_seq, math.random(999))

  _state.active_loot[loot_id] = {
    id=loot_id, loot_type=chosen, data=LOOT_TABLE[chosen],
    pos={ x=x, y=y, z=z }, zone_id=zone_id,
    spawned_at=os.time(), sig=SIG,
  }

  Events.emit("troxtworld:loot_spawned", {
    loot_id=loot_id, loot_type=chosen,
    pos={ x=x, y=y, z=z }, zone_id=zone_id, sig=SIG,
  })

  return loot_id
end

-- ✅ player_pos optionnel pour la vérification de distance
function World.collect_loot(loot_id, player_id, player_pos)
  local loot = _state.active_loot[loot_id]
  if not loot then return false, "Loot introuvable ou déjà ramassé" end

  -- Vérification de distance si la position du joueur est fournie
  if player_pos and loot.pos then
    local dx = (player_pos.x or 0) - (loot.pos.x or 0)
    local dy = (player_pos.y or 0) - (loot.pos.y or 0)
    local dz = (player_pos.z or 0) - (loot.pos.z or 0)
    local dist = math.sqrt(dx*dx + dy*dy + dz*dz)
    if dist > CFG.loot_pickup_range then
      return false, string.format("Trop loin (%.1f unités)", dist)
    end
  end

  _state.active_loot[loot_id] = nil

  Events.emit("troxtworld:loot_collected", {
    loot_id=loot_id, player_id=player_id, data=loot.data, sig=SIG,
  })

  return true, loot.data
end

-- ─── SAUVEGARDE ──────────────────────────────────────────────────────────────
function World.save()
  Memory.set("world:state", {
    world_time_sec  = _state.world_time_sec,
    day_count       = _state.day_count,
    current_weather = _state.current_weather,
    territories     = _state.territories,
  })
end

-- ─── API PUBLIQUE ─────────────────────────────────────────────────────────────
function World.get_state()
  local loot_count = 0
  for _ in pairs(_state.active_loot) do loot_count = loot_count + 1 end
  local events_count = 0
  for _ in pairs(_state.active_events) do events_count = events_count + 1 end

  return {
    time          = World.get_time_str(),
    time_period   = World.get_time_period(),
    is_night      = World.is_night(),
    day           = _state.day_count,
    weather       = World.get_weather(),
    zones         = ZONES,
    territories   = _state.territories,
    active_events = events_count,   -- ✅ compte, pas la table entière
    active_loot   = loot_count,
    sig           = SIG,
  }
end

function World.get_zones()      return ZONES end
function World.get_events()     return WORLD_EVENTS end
function World.get_signature()  return SIG end

return World
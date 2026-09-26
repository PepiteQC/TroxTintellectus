--[[
══════════════════════════════════════════════════════════════════════
  TROXT⬡ — TROXT_DOORS.LUA (v4.0 PLATINUM ULTIMATE)
  Système de portes de tous les bâtiments et entreprises TroxtWorld
  Types · Serrures · Clés · Codes · Badges · Horaires · Effraction
  Alarmes · Auto-fermeture · Raids police · Propriétaires · Employés
  Caméras · Historique · Loyers · Mandats · Panic buttons

  Signature : TROXT⬡
  Chemin    : C:\beni\lua\troxt\troxt_doors.lua
  Version   : 4.0.0 PLATINUM ULTIMATE
══════════════════════════════════════════════════════════════════════
]]

local Doors  = {}
local Events = require("troxt.troxt_events")
local Memory = require("troxt.troxt_memory")

local SIG  = "TROXT⬡"
local ISIG = "🛡️INTELLECTUS⬡"

local function log(level, msg)
  local icons = {
    INFO="ℹ", WARN="⚠", OK="✓", DOOR="🚪", ALARM="🚨",
    LOCK="🔒", CAMERA="🎥", MONEY="💰", PANIC="🆘", WARRANT="📜"
  }
  print(string.format("[%s] %s [%s] %s",
    os.date("%H:%M:%S"), icons[level] or "·", SIG, msg))
end

-- ═══════════════════════════════════════════════════════════════════════════
-- TYPES DE PORTES (enrichis v4.0)
-- ═══════════════════════════════════════════════════════════════════════════
local DOOR_TYPES = {
  wood         = { label="Porte en bois",        anim="hinged",    open_ms=600,  hp=100,  lockpick_diff=1, breach="kick"    },
  metal        = { label="Porte métallique",     anim="hinged",    open_ms=800,  hp=300,  lockpick_diff=3, breach="ram"     },
  reinforced   = { label="Porte blindée",        anim="hinged",    open_ms=1200, hp=800,  lockpick_diff=6, breach="thermite"},
  glass        = { label="Porte vitrée",         anim="hinged",    open_ms=500,  hp=60,   lockpick_diff=2, breach="shatter" },
  double_glass = { label="Double porte vitrée",  anim="double",    open_ms=600,  hp=80,   lockpick_diff=2, breach="shatter" },
  auto_sliding = { label="Porte automatique",    anim="sliding",   open_ms=400,  hp=120,  lockpick_diff=4, breach="hack",   auto_sensor=true },
  garage       = { label="Porte de garage",      anim="garage",    open_ms=3000, hp=400,  lockpick_diff=4, breach="ram"     },
  shutter      = { label="Rideau métallique",    anim="shutter",   open_ms=2500, hp=500,  lockpick_diff=5, breach="torch"   },
  revolving    = { label="Porte tambour",        anim="revolving", open_ms=1000, hp=200,  lockpick_diff=0, breach="none",   never_locks=true },
  gate         = { label="Portail",              anim="gate",      open_ms=2500, hp=350,  lockpick_diff=3, breach="ram"     },
  vault        = { label="Porte de coffre-fort", anim="vault",     open_ms=6000, hp=2000, lockpick_diff=10,breach="thermite" },
  cell         = { label="Porte de cellule",     anim="sliding",   open_ms=900,  hp=800,  lockpick_diff=8, breach="none"    },
  elevator     = { label="Porte d'ascenseur",    anim="sliding",   open_ms=700,  hp=300,  lockpick_diff=0, breach="none",   elevator=true },
  bulletproof  = { label="Porte pare-balles",    anim="hinged",    open_ms=1500, hp=1500, lockpick_diff=8, breach="c4"      },
  emergency    = { label="Sortie de secours",    anim="hinged",    open_ms=600,  hp=200,  lockpick_diff=2, breach="ram",   emergency_only=true },
}

-- ═══════════════════════════════════════════════════════════════════════════
-- MODES DE VERROUILLAGE
-- ═══════════════════════════════════════════════════════════════════════════
local LOCK_MODES = {
  none      = "Aucune serrure",
  key       = "Clé physique",
  code      = "Code numérique",
  badge     = "Badge magnétique",
  biometric = "Biométrique",
  owner     = "Propriétaire uniquement",
  job       = "Employés (emploi)",
  faction   = "Membres de faction",
  hours     = "Heures d'ouverture",
  warrant   = "Mandat requis",             -- ✨ v4.0
  panic     = "Verrouillage panique",      -- ✨ v4.0
}

-- ═══════════════════════════════════════════════════════════════════════════
-- ENTREPRISES & BÂTIMENTS (15+ nouveaux v4.0)
-- ═══════════════════════════════════════════════════════════════════════════
local BUILDINGS = {

  -- ═══════ SERVICES PUBLICS ═══════
  commissariat = {
    name="Commissariat TroxtWorld", icon="👮", zone="centre_ville", type="public_service",
    faction="police", hours={0,24}, has_cameras=true,
    doors = {
      { id="entree",   type="double_glass", lock="hours",   public=true },
      { id="accueil",  type="metal",        lock="faction", faction="police", min_rank=1 },
      { id="armurerie",type="vault",        lock="faction", faction="police", min_rank=3, alarm=true },
      { id="cellule_1",type="cell",         lock="faction", faction="police", min_rank=1 },
      { id="cellule_2",type="cell",         lock="faction", faction="police", min_rank=1 },
      { id="cellule_3",type="cell",         lock="faction", faction="police", min_rank=1 },
      { id="bureau_chef",type="wood",       lock="faction", faction="police", min_rank=5 },
      { id="garage",   type="garage",       lock="faction", faction="police", min_rank=1 },
      { id="salle_interrogatoire", type="metal", lock="faction", faction="police", min_rank=2 },
    },
  },
  hopital = {
    name="Hôpital TroxtWorld", icon="🏥", zone="centre_ville", type="public_service",
    faction="hopital", hours={0,24}, has_cameras=true,
    doors = {
      { id="urgences",    type="auto_sliding", lock="none",    public=true },
      { id="entree",      type="revolving",    lock="none",    public=true },
      { id="bloc_op",     type="auto_sliding", lock="faction", faction="hopital", min_rank=3 },
      { id="pharmacie",   type="metal",        lock="faction", faction="hopital", min_rank=2, alarm=true, silent_alarm=true },
      { id="morgue",      type="metal",        lock="faction", faction="hopital", min_rank=2 },
      { id="ambulances",  type="garage",       lock="faction", faction="hopital", min_rank=1 },
      { id="reserve_sang",type="reinforced",   lock="badge",   alarm=true, alarm_level=3 },
    },
  },
  mairie = {
    name="Mairie de TroxtWorld", icon="🏛️", zone="centre_ville", type="public_service",
    hours={8,18}, has_cameras=true,
    doors = {
      { id="entree",       type="double_glass", lock="hours", public=true },
      { id="bureau_maire", type="wood",         lock="key",   alarm=true },
      { id="archives",     type="metal",        lock="code",  code_len=6 },
      { id="salle_conseil",type="wood",         lock="hours" },
    },
  },
  -- ✨ v4.0 : Nouveaux
  prison_troxt = {
    name="Pénitencier Troxt", icon="⛓️", zone="banlieue", type="public_service",
    faction="police", hours={0,24}, has_cameras=true, secure_level=5,
    doors = {
      { id="entree_principale", type="bulletproof", lock="faction", faction="police", min_rank=3 },
      { id="miradorA", type="metal", lock="faction", faction="police", min_rank=2 },
      { id="miradorB", type="metal", lock="faction", faction="police", min_rank=2 },
      { id="quartier_A", type="cell", lock="faction", faction="police", min_rank=2 },
      { id="quartier_B", type="cell", lock="faction", faction="police", min_rank=2 },
      { id="quartier_isolement", type="cell", lock="faction", faction="police", min_rank=4 },
      { id="salle_visites", type="reinforced", lock="hours" },
      { id="cour", type="gate", lock="faction", faction="police", min_rank=2 },
    },
  },
  caserne_pompiers = {
    name="Caserne des pompiers", icon="🚒", zone="centre_ville", type="public_service",
    faction="pompiers", hours={0,24}, has_cameras=true,
    doors = {
      { id="entree", type="metal", lock="faction", faction="pompiers", min_rank=1 },
      { id="garage_camions", type="garage", lock="faction", faction="pompiers", min_rank=1 },
      { id="dortoir", type="wood", lock="faction", faction="pompiers", min_rank=1 },
      { id="bureau_capitaine", type="wood", lock="faction", faction="pompiers", min_rank=4 },
    },
  },

  -- ═══════ BANQUE ═══════
  banque_centrale = {
    name="Banque Centrale TroxtWorld", icon="🏦", zone="centre_ville", type="bank",
    job="banquier", hours={9,17}, robbable=true, has_cameras=true, has_panic_button=true, secure_level=4,
    doors = {
      { id="entree",    type="double_glass", lock="hours", public=true, alarm=true },
      { id="guichets",  type="bulletproof",  lock="job",   job="banquier" },
      { id="bureau_dir",type="wood",         lock="job",   job="banquier", min_rank=3 },
      { id="salle_forte",type="reinforced",  lock="badge", alarm=true, alarm_level=4 },
      { id="coffre",    type="vault",        lock="code",  code_len=8, alarm=true, alarm_level=5, timelock={9,17} },
      { id="atm_backend",type="metal",       lock="badge", alarm=true, alarm_level=3 },
    },
  },
  banque_epargne = {
    name="Banque d'Épargne Troxt", icon="🏛️", zone="banlieue", type="bank",
    job="banquier", hours={10,16}, robbable=true, has_cameras=true, secure_level=3,
    doors = {
      { id="entree", type="glass", lock="hours", public=true, alarm=true },
      { id="guichets", type="metal", lock="job", job="banquier" },
      { id="coffre", type="vault", lock="code", code_len=6, alarm=true, alarm_level=4 },
    },
  },

  -- ═══════ COMMERCES ═══════
  epicerie_24_7 = {
    name="Épicerie 24/7", icon="🛒", zone="banlieue", type="shop", robbable=true,
    hours={0,24}, owner_buyable=true, price=150000, has_cameras=true, has_panic_button=true,
    doors = {
      { id="entree",   type="glass",  lock="hours", public=true },
      { id="reserve",  type="wood",   lock="owner", staff=true },
      { id="coffre",   type="metal",  lock="code",  code_len=4, alarm=true, alarm_level=3 },
    },
  },
  magasin_vetements = {
    name="Boutique de vêtements", icon="👕", zone="centre_ville", type="shop",
    hours={10,21}, owner_buyable=true, price=280000, has_cameras=true,
    doors = {
      { id="entree",    type="double_glass", lock="hours", public=true },
      { id="cabine_1",  type="wood",         lock="none",  public=true, occupancy=1, inside_lock=true },
      { id="cabine_2",  type="wood",         lock="none",  public=true, occupancy=1, inside_lock=true },
      { id="cabine_3",  type="wood",         lock="none",  public=true, occupancy=1, inside_lock=true },
      { id="reserve",   type="metal",        lock="owner", staff=true },
      { id="rideau",    type="shutter",      lock="owner", staff=true },
    },
  },
  armurerie = {
    name="Armurerie Ammu-Troxt", icon="🔫", zone="zone_industrielle", type="shop",
    hours={9,20}, min_level=10, robbable=true, owner_buyable=true, price=450000,
    has_cameras=true, has_panic_button=true, secure_level=4,
    doors = {
      { id="entree",  type="reinforced", lock="hours", public=true, min_level=10 },
      { id="stand_tir",type="metal",     lock="hours", public=true, min_level=10 },
      { id="reserve", type="vault",      lock="owner", staff=true, alarm=true, alarm_level=4 },
      { id="rideau",  type="shutter",    lock="owner", staff=true },
    },
  },
  concessionnaire = {
    name="Troxt Motors", icon="🚗", zone="centre_ville", type="shop",
    job="dealer_auto", hours={9,19}, has_cameras=true,
    doors = {
      { id="entree",   type="auto_sliding", lock="hours", public=true },
      { id="showroom", type="garage",       lock="job",   job="dealer_auto" },
      { id="bureau",   type="glass",        lock="job",   job="dealer_auto" },
      { id="atelier_livraison", type="garage", lock="job", job="dealer_auto" },
    },
  },
  garage_mecano = {
    name="TroxtGarage", icon="🔧", zone="zone_industrielle", type="business",
    faction="mecano_faction", job="mecano", hours={7,22},
    doors = {
      { id="entree",   type="metal",  lock="hours", public=true },
      { id="atelier_1",type="garage", lock="job",   job="mecano" },
      { id="atelier_2",type="garage", lock="job",   job="mecano" },
      { id="bureau",   type="wood",   lock="faction", faction="mecano_faction", min_rank=3 },
    },
  },
  -- ✨ v4.0 : Nouveaux commerces
  station_service = {
    name="Station-service Ultra Troxt", icon="⛽", zone="autoroute", type="shop",
    hours={0,24}, owner_buyable=true, price=200000, robbable=true, has_cameras=true, has_panic_button=true,
    doors = {
      { id="boutique", type="glass", lock="hours", public=true },
      { id="reserve", type="metal", lock="owner", staff=true },
      { id="coffre", type="metal", lock="code", code_len=4, alarm=true, alarm_level=3 },
      { id="lave_auto", type="garage", lock="hours", public=true },
    },
  },
  pharmacie = {
    name="Pharmacie Troxt", icon="💊", zone="centre_ville", type="shop",
    hours={9,21}, job="pharmacien", robbable=true, has_cameras=true,
    doors = {
      { id="entree", type="glass", lock="hours", public=true },
      { id="comptoir_ordonnances", type="reinforced", lock="job", job="pharmacien", alarm=true },
      { id="stock_narcotiques", type="vault", lock="badge", alarm=true, alarm_level=4 },
    },
  },
  bijouterie = {
    name="Bijouterie Troxt Diamant", icon="💎", zone="centre_ville", type="shop",
    hours={10,19}, owner_buyable=true, price=550000, robbable=true,
    has_cameras=true, has_panic_button=true, secure_level=4,
    doors = {
      { id="entree", type="bulletproof", lock="hours", public=true, alarm=true },
      { id="vitrines", type="reinforced", lock="owner", staff=true, alarm=true, alarm_level=4 },
      { id="coffre", type="vault", lock="code", code_len=6, alarm=true, alarm_level=5, timelock={10,19} },
    },
  },

  -- ═══════ RESTAURATION / LOISIRS ═══════
  restaurant = {
    name="Le Troxt Bistro", icon="🍽️", zone="centre_ville", type="business",
    job="cuisinier", hours={11,23}, owner_buyable=true, price=320000,
    doors = {
      { id="entree",   type="double_glass", lock="hours", public=true },
      { id="cuisine",  type="metal",        lock="job",   job="cuisinier" },
      { id="chambre_froide", type="metal",  lock="job",   job="cuisinier" },
      { id="toilettes",type="wood",         lock="none",  public=true, occupancy=1, inside_lock=true },
    },
  },
  boite_de_nuit = {
    name="Club Hexagone", icon="🪩", zone="port", type="business",
    hours={22,5}, min_level=5, owner_buyable=true, price=600000, has_cameras=true,
    doors = {
      { id="entree",  type="metal", lock="hours", public=true, entry_fee=50 },
      { id="vip",     type="metal", lock="badge", vip=true },
      { id="bureau",  type="wood",  lock="owner", staff=true },
      { id="arriere", type="metal", lock="key" },
    },
  },
  -- ✨ v4.0
  casino_royal = {
    name="Casino Royal Troxt", icon="🎰", zone="centre_ville", type="business",
    hours={0,24}, min_level=15, price=1500000, owner_buyable=true,
    has_cameras=true, has_panic_button=true, secure_level=5,
    doors = {
      { id="entree", type="double_glass", lock="hours", public=true, entry_fee=100 },
      { id="salle_jeux", type="metal", lock="hours", public=true, min_level=15 },
      { id="salle_vip", type="reinforced", lock="badge", vip=true, min_level=25 },
      { id="coffre_casino", type="vault", lock="code", code_len=10, alarm=true, alarm_level=5, timelock={2,6} },
      { id="bureau_gerant", type="wood", lock="owner", staff=true },
      { id="zone_surveillance", type="metal", lock="badge", alarm=true, alarm_level=4 },
    },
  },
  cinema = {
    name="Cinéma Troxt-Plex", icon="🎬", zone="centre_ville", type="business",
    hours={12,0}, owner_buyable=true, price=380000,
    doors = {
      { id="entree", type="double_glass", lock="hours", public=true, entry_fee=15 },
      { id="salle_1", type="wood", lock="hours" },
      { id="salle_2", type="wood", lock="hours" },
      { id="salle_3", type="wood", lock="hours" },
      { id="salle_4", type="wood", lock="hours" },
      { id="projection", type="metal", lock="owner", staff=true },
    },
  },

  -- ═══════ ILLÉGAL ═══════
  entrepot_port = {
    name="Entrepôt 7", icon="📦", zone="port", type="illegal",
    faction="mafia", hours={0,24},
    doors = {
      { id="portail",  type="gate",    lock="faction", faction="mafia", min_rank=1 },
      { id="quai",     type="shutter", lock="faction", faction="mafia", min_rank=1 },
      { id="labo",     type="metal",   lock="code",    code_len=6, faction="mafia", min_rank=3 },
    },
  },
  planque_ghetto = {
    name="Planque Street Troxt", icon="🏴", zone="ghetto", type="illegal",
    faction="gang_rue", hours={0,24},
    doors = {
      { id="entree",  type="metal", lock="faction", faction="gang_rue", min_rank=1 },
      { id="arriere", type="wood",  lock="faction", faction="gang_rue", min_rank=2 },
      { id="stock",   type="metal", lock="code",    code_len=4, faction="gang_rue", min_rank=3 },
    },
  },

  -- ═══════ RÉSIDENTIEL ═══════
  immeuble_appartements = {
    name="Résidence Troxt (6 étages)", icon="🏢", zone="banlieue", type="residential",
    hours={0,24}, has_cameras=true,
    doors = {
      { id="hall",      type="double_glass", lock="badge", residents=true, buzzer=true },
      { id="ascenseur", type="elevator",     lock="none",  public=true },
      { id="garage_sous_sol", type="garage", lock="badge", residents=true },
      { id="toit",      type="metal",        lock="key" },
    },
    generate_apartments = { floors=6, per_floor=4, type="wood", lock="owner", monthly_rent=800 },
  },
  -- ✨ v4.0
  villa_luxe = {
    name="Villa de Luxe Ether Plaza", icon="🏘️", zone="centre_ville", type="residential",
    hours={0,24}, has_cameras=true, owner_buyable=true, price=2500000, secure_level=4,
    doors = {
      { id="portail", type="gate", lock="owner" },
      { id="entree_principale", type="reinforced", lock="owner", alarm=true, alarm_level=3 },
      { id="garage_villa", type="garage", lock="owner" },
      { id="cave_a_vin", type="metal", lock="code", code_len=5 },
      { id="bureau", type="wood", lock="key" },
      { id="chambre_maitre", type="wood", lock="key" },
      { id="piscine", type="glass", lock="owner" },
    },
  },
};

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAT INTERNE (enrichi v4.0)
-- ═══════════════════════════════════════════════════════════════════════════
local _doors      = {}
local _keys       = {}
local _badges     = {}
local _codes      = {}
local _owners     = {}
local _staff      = {}
local _residents  = {}
local _tenants    = {}      -- ✨ v4.0 : Locataires (loyer mensuel)
local _code_fails = {}
local _world_hour = 12
local _raid_zones = {}
local _warrants   = {}      -- ✨ v4.0 : Mandats de perquisition actifs
local _blacklist  = {}      -- ✨ v4.0 : { [building_id] = { [player_id]=true } }
local _access_log = {}      -- ✨ v4.0 : Historique par porte

local _stats = {
  opens=0, denied=0, lockpicks_ok=0, lockpicks_fail=0,
  breaches=0, alarms=0, silent_alarms=0, codes_ok=0, codes_fail=0,
  panic_triggered=0, warrants_used=0, cameras_reviewed=0,
  rent_collected=0, casing_detected=0,
}

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPERS
-- ═══════════════════════════════════════════════════════════════════════════
local function uid(building_id, door_id) return building_id .. ":" .. door_id end

local function gen_code(len)
  len = math.max(4, len or 4)
  local t = {}
  for i = 1, len do t[i] = tostring(math.random(0, 9)) end
  return table.concat(t)
end

local function in_hours(hours, h)
  if not hours then return true end
  local o, c = hours[1], hours[2]
  if o == 0 and c == 24 then return true end
  if o < c then return h >= o and h < c end
  return h >= o or h < c
end

local function record_access(door_uid, player_id, action, reason)
  _access_log[door_uid] = _access_log[door_uid] or {}
  table.insert(_access_log[door_uid], 1, {
    player_id = player_id,
    action    = action,      -- "open" | "close" | "denied" | "breach" | "lockpick"
    reason    = reason,
    hour      = _world_hour,
    ts        = os.time(),
  })
  -- Garde uniquement les 100 derniers accès par porte (anti-fuite mémoire)
  if #_access_log[door_uid] > 100 then
    table.remove(_access_log[door_uid])
  end
end

local function register_door(building_id, b, d)
  local id  = uid(building_id, d.id)
  local def = DOOR_TYPES[d.type] or DOOR_TYPES.wood
  _doors[id] = {
    uid          = id,
    building_id  = building_id,
    door_id      = d.id,
    type         = d.type,
    anim         = def.anim,
    open_ms      = def.open_ms,
    lock         = d.lock or "none",
    faction      = d.faction or b.faction,
    job          = d.job or b.job,
    min_rank     = d.min_rank or 1,
    min_level    = d.min_level or b.min_level or 0,
    public       = d.public or false,
    staff        = d.staff or false,
    residents    = d.residents or false,
    alarm        = d.alarm or false,
    silent_alarm = d.silent_alarm or false,           -- ✨ v4.0
    alarm_level  = d.alarm_level or 2,
    entry_fee    = d.entry_fee,
    occupancy    = d.occupancy,
    occupants    = {},          -- array
    occupants_set= {},          -- ✨ set pour recherche O(1)
    inside_lock  = d.inside_lock or false,
    timelock     = d.timelock,
    hours        = b.hours,
    is_open      = false,
    is_locked    = (d.lock ~= "none") and not def.never_locks,
    hp           = def.hp,
    max_hp       = def.hp,
    broken       = false,
    alarm_active = false,
    opened_by    = nil,
    opened_at    = nil,
    auto_close   = def.auto_sensor and 3 or 8,
    pos          = d.pos,
    vip          = d.vip or false,                    -- ✨ v4.0
    buzzer       = d.buzzer or false,                 -- ✨ v4.0
    emergency_only = def.emergency_only or false,     -- ✨ v4.0
    sig          = SIG,
  }
  if d.lock == "code" then _codes[id] = gen_code(d.code_len or 4) end
  return id
end

-- ═══════════════════════════════════════════════════════════════════════════
-- INIT
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.init()
  local count, b_count = 0, 0
  for bid, b in pairs(BUILDINGS) do
    b_count = b_count + 1
    for _, d in ipairs(b.doors or {}) do
      register_door(bid, b, d); count = count + 1
    end
    local gen = b.generate_apartments
    if gen then
      for f = 1, gen.floors do
        for n = 1, gen.per_floor do
          local d = {
            id = string.format("apt_%d%02d", f, n),
            type = gen.type,
            lock = gen.lock,
          }
          register_door(bid, b, d)
          count = count + 1
        end
      end
    end
    _staff[bid]     = _staff[bid]     or {}
    _residents[bid] = _residents[bid] or {}
    _tenants[bid]   = _tenants[bid]   or {}
    _blacklist[bid] = _blacklist[bid] or {}
  end

  -- Restaurer données persistées
  local saved
  do
    local _ok, _res = pcall(Memory.get, "doors:persist")
    if _ok and type(_res) == "table" then saved = _res end
  end
  if saved then
    _owners = saved.owners or _owners
    for id, c in pairs(saved.codes or {}) do _codes[id] = c end
    _keys   = saved.keys   or _keys
    _badges = saved.badges or _badges

    if saved.staff then
      for bid, list in pairs(saved.staff) do _staff[bid] = list end
    end
    if saved.residents then
      for bid, list in pairs(saved.residents) do _residents[bid] = list end
    end
    if saved.tenants then
      for bid, list in pairs(saved.tenants) do _tenants[bid] = list end
    end
    if saved.blacklist then
      for bid, list in pairs(saved.blacklist) do _blacklist[bid] = list end
    end
    if saved.raid_zones then _raid_zones = saved.raid_zones end
    if saved.warrants then _warrants = saved.warrants end
  end

  log("OK", string.format("Portes initialisées — %d portes · %d bâtiments", count, b_count))
  Events.emit("troxtworld:doors_ready", { doors=count, buildings=b_count, sig=SIG })
end

function Doors.save()
  Memory.set("doors:persist", {
    owners=_owners, codes=_codes, keys=_keys, badges=_badges,
    staff=_staff, residents=_residents, tenants=_tenants,
    blacklist=_blacklist, raid_zones=_raid_zones, warrants=_warrants,
  })
end

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION D'ACCÈS (enrichi v4.0)
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.can_access(door_uid, player, opts)
  opts = opts or {}
  local d = _doors[door_uid]
  if not d then return false, "Porte inconnue" end
  if d.broken then return true, "Porte défoncée" end
  if player.is_admin then return true, "Accès admin" end

  -- ✨ v4.0 : Blacklist du propriétaire
  if _blacklist[d.building_id] and _blacklist[d.building_id][player.id] then
    return false, "Interdit par le propriétaire"
  end

  if not d.is_locked then return true, "Déverrouillée" end

  local b = BUILDINGS[d.building_id]

  -- ✨ v4.0 : Mandat de perquisition (police)
  if player.faction == "police" and _warrants[d.building_id] then
    local w = _warrants[d.building_id]
    if os.time() < w.until_ts then
      _stats.warrants_used = _stats.warrants_used + 1
      return true, "Mandat de perquisition"
    end
  end

  -- Raid police
  if b and _raid_zones[b.zone] and os.time() < _raid_zones[b.zone] and player.faction == "police" then
    return true, "Raid police"
  end

  if d.min_level > 0 and (player.level or 1) < d.min_level then
    return false, string.format("Niveau %d requis", d.min_level)
  end

  if d.timelock and not in_hours(d.timelock, _world_hour) then
    return false, "Verrou temporisé actif"
  end

  local owner = _owners[d.building_id]
  if owner == player.id then return true, "Propriétaire" end
  if (d.staff or d.lock=="owner") and _staff[d.building_id] and _staff[d.building_id][player.id] then
    return true, "Employé"
  end

  local mode = d.lock

  if mode == "none" then return true, "Libre"

  elseif mode == "hours" then
    if in_hours(d.hours, _world_hour) then return true, "Ouvert" end
    return false, string.format("Fermé — ouvre à %02dh", d.hours and d.hours[1] or 0)

  elseif mode == "key" then
    if _keys[player.id] and _keys[player.id][door_uid] then return true, "Clé" end
    return false, "Clé requise"

  elseif mode == "badge" then
    if d.residents and _residents[d.building_id] and _residents[d.building_id][player.id] then
      return true, "Badge résident"
    end
    if _badges[player.id] and _badges[player.id][d.building_id] then return true, "Badge" end
    return false, "Badge requis"

  elseif mode == "code" then
    if opts.code and opts.code == _codes[door_uid] then return true, "Code" end
    if d.faction and player.faction == d.faction and (player.faction_rank or 0) >= (d.min_rank or 1) then
      return true, "Code faction"
    end
    return false, "Code requis"

  elseif mode == "owner" then
    return false, "Propriétaire uniquement"

  elseif mode == "job" then
    if player.job == d.job then return true, "Employé" end
    return false, "Réservé aux employés"

  elseif mode == "faction" then
    if player.faction == d.faction and (player.faction_rank or 0) >= (d.min_rank or 1) then
      return true, "Faction"
    end
    return false, (d.min_rank or 1) > 1 and string.format("Rang %d requis", d.min_rank) or "Membres uniquement"

  elseif mode == "warrant" then
    if player.faction == "police" and _warrants[d.building_id] then return true, "Mandat" end
    return false, "Mandat requis"

  elseif mode == "panic" then
    return false, "Verrouillage panique actif"
  end

  return false, "Accès refusé"
end

-- ═══════════════════════════════════════════════════════════════════════════
-- OUVRIR / FERMER
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.open(door_uid, player, opts)
  opts = opts or {}
  local d = _doors[door_uid]
  if not d then return false, "Porte inconnue" end
  if d.is_open then return true, "Déjà ouverte" end

  -- ✨ v4.0 : Fix occupants (utilise le set)
  if d.occupancy and #d.occupants >= d.occupancy and not d.occupants_set[player.id] then
    return false, "Occupé"
  end

  local fkey = tostring(player.id) .. door_uid
  local f = _code_fails[fkey]
  if f and f.until_ts and os.time() < f.until_ts then
    return false, string.format("Clavier bloqué %ds", f.until_ts - os.time())
  end

  local ok, reason = Doors.can_access(door_uid, player, opts)
  if not ok then
    _stats.denied = _stats.denied + 1
    record_access(door_uid, player.id, "denied", reason)

    if d.lock == "code" and opts.code then
      _stats.codes_fail = _stats.codes_fail + 1
      f = f or { count=0 }
      f.count = f.count + 1
      if f.count >= 3 then
        f.until_ts = os.time() + 60 * f.count
        if d.alarm then Doors.trigger_alarm(door_uid, player.id, "code_bruteforce") end
      end
      _code_fails[fkey] = f
    end
    Events.emit("troxtworld:door_denied", {
      uid=door_uid, player_id=player.id, reason=reason, sig=SIG,
    })
    return false, reason
  end

  if d.lock == "code" and opts.code then
    _stats.codes_ok = _stats.codes_ok + 1
    _code_fails[fkey] = nil
  end

  if d.entry_fee and not (_owners[d.building_id] == player.id) then
    if (player.cash or 0) < d.entry_fee then
      return false, string.format("Entrée: %dT$", d.entry_fee)
    end
    Events.emit("troxtworld:door_entry_fee", {
      uid=door_uid, player_id=player.id, amount=d.entry_fee,
      owner=_owners[d.building_id], sig=SIG,
    })
  end

  d.is_open   = true
  d.opened_by = player.id
  d.opened_at = os.time()
  _stats.opens = _stats.opens + 1

  record_access(door_uid, player.id, "open", reason)

  Events.emit("troxtworld:door_state", {
    uid=door_uid, is_open=true, is_locked=d.is_locked,
    anim=d.anim, open_ms=d.open_ms, by=player.id, sig=SIG,
  })
  return true, reason
end

function Doors.close(door_uid, player_id)
  local d = _doors[door_uid]
  if not d or not d.is_open then return false end
  if d.broken then return false, "Porte défoncée — réparation requise" end
  d.is_open   = false
  d.opened_by = nil

  record_access(door_uid, player_id or "system", "close", "manual")

  Events.emit("troxtworld:door_state", {
    uid=door_uid, is_open=false, is_locked=d.is_locked,
    anim=d.anim, open_ms=d.open_ms, by=player_id, sig=SIG,
  })
  return true
end

function Doors.toggle(door_uid, player, opts)
  local d = _doors[door_uid]
  if not d then return false, "Porte inconnue" end
  if d.is_open then return Doors.close(door_uid, player.id) end
  return Doors.open(door_uid, player, opts)
end

-- ═══════════════════════════════════════════════════════════════════════════
-- VERROUILLER / DÉVERROUILLER
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.set_lock(door_uid, player, locked)
  local d = _doors[door_uid]
  if not d then return false, "Porte inconnue" end
  if DOOR_TYPES[d.type].never_locks then return false, "Cette porte ne se verrouille pas" end
  if d.broken then return false, "Serrure détruite" end

  if d.inside_lock then
    if d.occupants_set[player.id] or player.is_admin then
      d.is_locked = locked
    else
      return false, "Verrou intérieur"
    end
  else
    local ok = player.is_admin
      or _owners[d.building_id] == player.id
      or (_staff[d.building_id] and _staff[d.building_id][player.id])
      or (_keys[player.id] and _keys[player.id][door_uid])
      or (d.lock=="faction" and player.faction==d.faction and (player.faction_rank or 0) >= math.max(d.min_rank or 1, 2))
      or (d.lock=="job" and player.job==d.job)
    if not ok then return false, "Tu n'as pas la clé" end
    d.is_locked = locked
  end

  if locked and d.is_open then Doors.close(door_uid, player.id) end
  Events.emit("troxtworld:door_state", {
    uid=door_uid, is_open=d.is_open, is_locked=d.is_locked, by=player.id, sig=SIG,
  })
  log("LOCK", string.format("%s %s par %s", door_uid, locked and "verrouillée" or "déverrouillée", player.id))
  return true
end

function Doors.lock_building(building_id, player, locked)
  if not (player.is_admin or _owners[building_id] == player.id) then
    return false, "Propriétaire requis"
  end
  local n = 0
  for id, d in pairs(_doors) do
    if d.building_id == building_id and not DOOR_TYPES[d.type].never_locks then
      d.is_locked = locked
      if locked and d.is_open then Doors.close(id, player.id) end
      n = n + 1
    end
  end
  Events.emit("troxtworld:building_locked", {
    building_id=building_id, locked=locked, doors=n, sig=SIG,
  })
  return true, n
end

-- ═══════════════════════════════════════════════════════════════════════════
-- ✨ v4.0 : PANIC BUTTON
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.trigger_panic(building_id, player)
  local b = BUILDINGS[building_id]
  if not b or not b.has_panic_button then return false, "Pas de bouton panique" end

  local is_authorized = player.is_admin
    or _owners[building_id] == player.id
    or (_staff[building_id] and _staff[building_id][player.id])
  if not is_authorized then return false, "Non autorisé" end

  _stats.panic_triggered = _stats.panic_triggered + 1

  -- Verrouille toutes les portes
  local locked_count = 0
  for id, d in pairs(_doors) do
    if d.building_id == building_id and not DOOR_TYPES[d.type].never_locks then
      d.is_locked = true
      d.lock = "panic"
      locked_count = locked_count + 1
    end
  end

  -- Alerte silencieuse à la police
  Events.emit("troxtworld:panic_button", {
    building_id = building_id,
    building_name = b.name,
    zone = b.zone,
    triggered_by = player.id,
    doors_locked = locked_count,
    sig = SIG,
  })
  Events.emit("troxtworld:police_alert", {
    player_id = player.id,
    wanted = 0,
    crime = "PANIC BUTTON — " .. b.name,
    response_in = 20,
    priority = "URGENT",
    sig = SIG,
  })

  log("PANIC", string.format("PANIC BUTTON activé à %s par %s (%d portes verrouillées)",
    b.name, player.id, locked_count))
  return true, locked_count
end

function Doors.reset_panic(building_id, player)
  if not (player.faction == "police" or player.is_admin or _owners[building_id] == player.id) then
    return false, "Non autorisé"
  end

  local n = 0
  for id, d in pairs(_doors) do
    if d.building_id == building_id and d.lock == "panic" then
      -- Restore lock original du template
      for _, orig_door in ipairs(BUILDINGS[building_id].doors or {}) do
        if orig_door.id == d.door_id then
          d.lock = orig_door.lock or "none"
          break
        end
      end
      d.is_locked = d.lock ~= "none"
      n = n + 1
    end
  end
  Events.emit("troxtworld:panic_reset", { building_id=building_id, by=player.id, doors=n, sig=SIG })
  return true, n
end

-- ═══════════════════════════════════════════════════════════════════════════
-- ✨ v4.0 : MANDATS DE PERQUISITION
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.issue_warrant(building_id, judge, duration_min, reason)
  if judge.faction ~= "police" or (judge.faction_rank or 0) < 5 then
    return false, "Rang judiciaire requis (min 5)"
  end
  local duration = (duration_min or 60) * 60
  _warrants[building_id] = {
    until_ts = os.time() + duration,
    issued_by = judge.id,
    reason = reason,
  }
  Doors.save()
  Events.emit("troxtworld:warrant_issued", {
    building_id = building_id,
    building_name = BUILDINGS[building_id] and BUILDINGS[building_id].name,
    judge = judge.id,
    duration_min = duration_min,
    reason = reason,
    sig = SIG,
  })
  log("WARRANT", string.format("Mandat émis pour %s (%d min) — %s",
    building_id, duration_min or 60, reason or "aucune raison"))
  return true
end

function Doors.revoke_warrant(building_id)
  _warrants[building_id] = nil
  Doors.save()
end

-- ═══════════════════════════════════════════════════════════════════════════
-- ✨ v4.0 : CAMÉRAS DE SURVEILLANCE
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.review_camera(building_id, player, limit)
  local b = BUILDINGS[building_id]
  if not b or not b.has_cameras then return nil, "Pas de caméras" end

  local can_view = player.is_admin
    or _owners[building_id] == player.id
    or player.faction == "police"
    or (_staff[building_id] and _staff[building_id][player.id])
  if not can_view then return nil, "Accès refusé" end

  _stats.cameras_reviewed = _stats.cameras_reviewed + 1

  local footage = {}
  limit = limit or 20
  for id, d in pairs(_doors) do
    if d.building_id == building_id and _access_log[id] then
      for i, entry in ipairs(_access_log[id]) do
        if #footage >= limit then break end
        table.insert(footage, {
          door_id = d.door_id,
          player_id = entry.player_id,
          action = entry.action,
          reason = entry.reason,
          hour = entry.hour,
          ts = entry.ts,
        })
      end
    end
  end
  -- Tri chronologique décroissant
  table.sort(footage, function(a, b) return a.ts > b.ts end)
  return footage
end

-- ═══════════════════════════════════════════════════════════════════════════
-- ✨ v4.0 : LOCATION D'APPARTEMENTS
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.rent_apartment(building_id, apt_door_id, tenant, months)
  local b = BUILDINGS[building_id]
  if not b or not b.generate_apartments then return false, "Pas des appartements" end

  local monthly = b.generate_apartments.monthly_rent or 800
  local total = monthly * (months or 1)
  if (tenant.cash or 0) < total then
    return false, string.format("Il faut %dT$ (%d mois × %dT$)", total, months or 1, monthly)
  end

  local door_id = uid(building_id, apt_door_id)
  _tenants[building_id][tenant.id] = {
    apt = apt_door_id,
    until_ts = os.time() + (months or 1) * 30 * 24 * 3600,
    monthly = monthly,
    paid_at = os.time(),
  }
  Doors.add_resident(building_id, tenant.id, apt_door_id)
  _stats.rent_collected = _stats.rent_collected + total

  Events.emit("troxtworld:apartment_rented", {
    building_id = building_id,
    apt = apt_door_id,
    tenant = tenant.id,
    months = months,
    total = total,
    sig = SIG,
  })
  return true, total
end

function Doors.check_rent_expired()
  local now = os.time()
  local expired = 0
  for bid, tenants in pairs(_tenants) do
    for pid, contract in pairs(tenants) do
      if now > contract.until_ts then
        Doors.remove_resident(bid, pid, contract.apt)
        _tenants[bid][pid] = nil
        expired = expired + 1
        Events.emit("troxtworld:rent_expired", {
          building_id=bid, tenant=pid, apt=contract.apt, sig=SIG,
        })
      end
    end
  end
  return expired
end

-- ═══════════════════════════════════════════════════════════════════════════
-- ✨ v4.0 : BLACKLIST PROPRIÉTAIRE
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.blacklist_player(building_id, owner, player_id)
  if not (owner.is_admin or _owners[building_id] == owner.id) then
    return false, "Propriétaire requis"
  end
  _blacklist[building_id] = _blacklist[building_id] or {}
  _blacklist[building_id][player_id] = true
  Doors.save()
  Events.emit("troxtworld:blacklisted", {
    building_id=building_id, player=player_id, by=owner.id, sig=SIG,
  })
  return true
end

function Doors.remove_blacklist(building_id, owner, player_id)
  if not (owner.is_admin or _owners[building_id] == owner.id) then
    return false, "Propriétaire requis"
  end
  if _blacklist[building_id] then _blacklist[building_id][player_id] = nil end
  Doors.save()
  return true
end

-- ═══════════════════════════════════════════════════════════════════════════
-- ✨ v4.0 : DÉTECTION DE CASING (reconnaissance criminelle)
-- ═══════════════════════════════════════════════════════════════════════════
local _casing_tracker = {}   -- { [player_id] = { [building_id] = { count, first_at } } }

function Doors.report_suspicious_behavior(building_id, player_id, action)
  _casing_tracker[player_id] = _casing_tracker[player_id] or {}
  _casing_tracker[player_id][building_id] = _casing_tracker[player_id][building_id] or {
    count = 0, first_at = os.time(), actions = {},
  }
  local t = _casing_tracker[player_id][building_id]
  t.count = t.count + 1
  table.insert(t.actions, action)

  -- Si > 5 comportements suspects en < 10 min → alerte
  if t.count >= 5 and (os.time() - t.first_at) < 600 then
    _stats.casing_detected = _stats.casing_detected + 1
    local b = BUILDINGS[building_id]
    Events.emit("troxtworld:casing_detected", {
      player_id = player_id,
      building_id = building_id,
      building_name = b and b.name,
      actions = t.actions,
      duration = os.time() - t.first_at,
      sig = ISIG,
    })
    _casing_tracker[player_id][building_id] = nil
  end
end

-- ═══════════════════════════════════════════════════════════════════════════
-- EFFRACTION (avec détection casing v4.0)
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.lockpick(door_uid, player, skill, tool)
  local d = _doors[door_uid]
  if not d then return false, "Porte inconnue" end
  if not d.is_locked then return false, "Déjà déverrouillée" end
  local def  = DOOR_TYPES[d.type]
  local diff = def.lockpick_diff
  if d.lock == "biometric" or diff >= 10 then return false, "Impossible à crocheter" end

  Doors.report_suspicious_behavior(d.building_id, player.id, "lockpick_attempt")

  local bonus  = (tool == "advanced_lockpick") and 2 or 0
  local chance = math.max(0.05, math.min(0.95, 0.5 + ((skill or 0) + bonus - diff) * 0.1))
  local roll   = math.random()

  Events.emit("troxtworld:crime_hint", {
    player_id=player.id, crime="vehicle_theft", context="lockpick", sig=SIG,
  })

  if roll <= chance then
    d.is_locked = false
    _stats.lockpicks_ok = _stats.lockpicks_ok + 1
    record_access(door_uid, player.id, "lockpick", "success")
    Events.emit("troxtworld:door_lockpicked", { uid=door_uid, player_id=player.id, sig=SIG })
    if d.alarm and math.random() < 0.35 then
      Doors.trigger_alarm(door_uid, player.id, "lockpick_silent")
    end
    return true, string.format("Crochetée (%.0f%%)", chance * 100)
  end

  _stats.lockpicks_fail = _stats.lockpicks_fail + 1
  record_access(door_uid, player.id, "lockpick_fail", nil)
  local tool_broke = math.random() < 0.4
  if d.alarm then Doors.trigger_alarm(door_uid, player.id, "lockpick_fail") end
  Events.emit("troxtworld:door_lockpick_fail", {
    uid=door_uid, player_id=player.id, tool_broke=tool_broke, sig=SIG,
  })
  return false, tool_broke and "Crochet cassé!" or "Échec — réessaie", tool_broke
end

local BREACH_TOOLS = {
  kick     = { dmg=25,  works={ kick=true, shatter=true } },
  crowbar  = { dmg=45,  works={ kick=true, shatter=true, ram=true } },
  ram      = { dmg=120, works={ kick=true, shatter=true, ram=true } },
  torch    = { dmg=60,  works={ torch=true, ram=true, kick=true } },
  hack     = { dmg=999, works={ hack=true } },
  thermite = { dmg=800, works={ thermite=true, torch=true, ram=true } },
  c4       = { dmg=2000,works={ kick=true, shatter=true, ram=true, torch=true, thermite=true, c4=true } },
}

function Doors.breach(door_uid, player, tool)
  local d = _doors[door_uid]
  if not d then return false, "Porte inconnue" end
  if d.broken then return true, "Déjà défoncée" end
  local def = DOOR_TYPES[d.type]
  local t   = BREACH_TOOLS[tool or "kick"]
  if not t then return false, "Outil inconnu" end
  if def.breach == "none" then return false, "Cette porte ne peut pas être forcée" end
  if not t.works[def.breach] then
    return false, string.format("Inefficace — il faut: %s", def.breach)
  end

  Doors.report_suspicious_behavior(d.building_id, player.id, "breach_attempt")

  d.hp = math.max(0, d.hp - t.dmg)
  _stats.breaches = _stats.breaches + 1
  record_access(door_uid, player.id, "breach", tool)

  if d.alarm then Doors.trigger_alarm(door_uid, player.id, "breach") end

  local legal_raid = player.faction == "police"
    and BUILDINGS[d.building_id] and _raid_zones[BUILDINGS[d.building_id].zone]

  if not legal_raid then
    Events.emit("troxtworld:crime_hint", {
      player_id=player.id, crime="theft", context="breach", sig=SIG,
    })
  end

  if d.hp <= 0 then
    d.broken, d.is_locked, d.is_open = true, false, true
    Events.emit("troxtworld:door_broken", {
      uid=door_uid, player_id=player.id, tool=tool, sig=SIG,
    })
    Events.emit("troxtworld:door_state", {
      uid=door_uid, is_open=true, is_locked=false, broken=true, anim=d.anim, sig=SIG,
    })
    log("DOOR", string.format("PORTE DÉFONCÉE — %s par %s (%s)", door_uid, player.id, tool))
    return true, "Porte défoncée!"
  end

  Events.emit("troxtworld:door_damaged", { uid=door_uid, hp=d.hp, max_hp=d.max_hp, sig=SIG })
  return false, string.format("Porte endommagée (%d/%d)", d.hp, d.max_hp)
end

function Doors.repair(door_uid, player)
  local d = _doors[door_uid]
  if not d then return false, "Porte inconnue" end
  local cost = math.floor((d.max_hp - d.hp) * 5)
  d.hp, d.broken, d.is_open = d.max_hp, false, false
  d.is_locked = d.lock ~= "none"
  Events.emit("troxtworld:door_repaired", { uid=door_uid, player_id=player.id, cost=cost, sig=SIG })
  Events.emit("troxtworld:door_state", { uid=door_uid, is_open=false, is_locked=d.is_locked, sig=SIG })
  return true, cost
end

-- ═══════════════════════════════════════════════════════════════════════════
-- ALARMES (avec silencieuses v4.0)
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.trigger_alarm(door_uid, player_id, cause)
  local d = _doors[door_uid]
  if not d or d.alarm_active then return end
  d.alarm_active = true

  if d.silent_alarm then
    _stats.silent_alarms = _stats.silent_alarms + 1
  else
    _stats.alarms = _stats.alarms + 1
  end

  local b = BUILDINGS[d.building_id] or {}
  log("ALARM", string.format("%s %s — %s (%s)",
    d.silent_alarm and "ALARME SILENCIEUSE" or "ALARME",
    b.name or d.building_id, d.door_id, cause))

  Events.emit("troxtworld:alarm", {
    uid=door_uid, building_id=d.building_id, building=b.name,
    zone=b.zone, level=d.alarm_level, cause=cause,
    silent=d.silent_alarm, suspect=player_id, sig=SIG,
  })

  Events.emit("troxtworld:police_alert", {
    player_id=player_id, wanted=math.min(5, d.alarm_level),
    crime="Effraction — " .. (b.name or d.building_id),
    silent=d.silent_alarm,
    response_in=math.max(10, 60 - d.alarm_level * 10), sig=SIG,
  })

  if d.alarm_level >= 4 then
    Events.emit("intellectus:rp_security_event", {
      type="high_value_breach", uid=door_uid, player_id=player_id,
      level=d.alarm_level, sig=ISIG,
    })
  end
end

function Doors.reset_alarm(door_uid, player)
  local d = _doors[door_uid]
  if not d then return false end
  local b = BUILDINGS[d.building_id]
  local ok = player.is_admin or player.faction == "police"
    or _owners[d.building_id] == player.id
    or (b and b.job and player.job == b.job)
  if not ok then return false, "Accès refusé" end
  d.alarm_active = false
  Events.emit("troxtworld:alarm_reset", { uid=door_uid, by=player.id, sig=SIG })
  return true
end

-- ═══════════════════════════════════════════════════════════════════════════
-- RAID POLICE
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.start_raid(zone, duration_sec, by)
  _raid_zones[zone] = os.time() + (duration_sec or 900)
  Doors.save()
  Events.emit("troxtworld:door_raid", { zone=zone, until_ts=_raid_zones[zone], by=by, sig=SIG })
  log("ALARM", "RAID POLICE — zone " .. zone)
end

Events.on("troxtworld:admin_police_raid", function(d) Doors.start_raid(d.zone_id, 900, d.by) end,
  { name="doors:raid" })

-- ═══════════════════════════════════════════════════════════════════════════
-- CLÉS / BADGES / CODES
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.give_key(player_id, door_uid, key_type)
  _keys[player_id] = _keys[player_id] or {}
  _keys[player_id][door_uid] = key_type or "standard"
  Events.emit("troxtworld:key_given", {
    player_id=player_id, uid=door_uid, type=key_type or "standard", sig=SIG,
  })
end

function Doors.revoke_key(player_id, door_uid)
  if _keys[player_id] then
    _keys[player_id][door_uid] = nil
    -- Nettoyage table vide (anti-fuite mémoire)
    if next(_keys[player_id]) == nil then _keys[player_id] = nil end
  end
  Events.emit("troxtworld:key_revoked", { player_id=player_id, uid=door_uid, sig=SIG })
end

function Doors.copy_key(from_id, to_id, door_uid)
  if not (_keys[from_id] and _keys[from_id][door_uid]) then
    return false, "Pas de clé à copier"
  end
  Doors.give_key(to_id, door_uid, _keys[from_id][door_uid])
  return true
end

function Doors.give_badge(player_id, building_id, level)
  _badges[player_id] = _badges[player_id] or {}
  _badges[player_id][building_id] = level or 1
  Events.emit("troxtworld:badge_given", {
    player_id=player_id, building_id=building_id, level=level or 1, sig=SIG,
  })
end

function Doors.revoke_badge(player_id, building_id)
  if _badges[player_id] then
    _badges[player_id][building_id] = nil
    if next(_badges[player_id]) == nil then _badges[player_id] = nil end
  end
end

function Doors.change_code(door_uid, player, new_code)
  local d = _doors[door_uid]
  if not d or d.lock ~= "code" then return false, "Pas un clavier à code" end
  local ok = player.is_admin or _owners[d.building_id] == player.id
    or (d.faction and player.faction == d.faction and (player.faction_rank or 0) >= 4)
  if not ok then return false, "Accès refusé" end
  if new_code and not new_code:match("^%d+$") then return false, "Chiffres uniquement" end
  local existing_len = _codes[door_uid] and #_codes[door_uid] or 4
  _codes[door_uid] = new_code or gen_code(existing_len)
  Doors.save()
  return true, _codes[door_uid]
end

function Doors.reveal_code(door_uid, player)
  local d = _doors[door_uid]
  if not d then return nil end
  if player.is_admin or _owners[d.building_id] == player.id then return _codes[door_uid] end
  return nil
end

-- ═══════════════════════════════════════════════════════════════════════════
-- PROPRIÉTÉ & PERSONNEL
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.set_owner(building_id, player_id)
  local b = BUILDINGS[building_id]
  if not b then return false, "Bâtiment inconnu" end
  local old = _owners[building_id]
  _owners[building_id] = player_id
  for id, d in pairs(_doors) do
    if d.building_id == building_id and d.lock == "code" then
      local existing_len = _codes[id] and #_codes[id] or 4
      _codes[id] = gen_code(existing_len)
    end
  end
  _staff[building_id] = {}
  Doors.save()
  Events.emit("troxtworld:building_owner_changed", {
    building_id=building_id, old=old, new=player_id, sig=SIG,
  })
  return true
end

function Doors.buy_building(building_id, player, bank_balance)
  local b = BUILDINGS[building_id]
  if not b or not b.owner_buyable then return false, "Non disponible à l'achat" end
  if _owners[building_id] then return false, "Déjà possédé" end
  if (bank_balance or 0) < b.price then return false, string.format("Prix: %dT$", b.price) end
  Doors.set_owner(building_id, player.id)
  Events.emit("troxtworld:building_bought", {
    building_id=building_id, player_id=player.id, price=b.price, sig=SIG,
  })
  return true, b.price
end

function Doors.hire(building_id, owner, employee_id)
  if _owners[building_id] ~= owner.id and not owner.is_admin then
    return false, "Propriétaire requis"
  end
  _staff[building_id] = _staff[building_id] or {}
  _staff[building_id][employee_id] = true
  Doors.save()
  Events.emit("troxtworld:staff_hired", {
    building_id=building_id, player_id=employee_id, sig=SIG,
  })
  return true
end

function Doors.fire(building_id, owner, employee_id)
  if _owners[building_id] ~= owner.id and not owner.is_admin then
    return false, "Propriétaire requis"
  end
  if _staff[building_id] then _staff[building_id][employee_id] = nil end
  Doors.save()
  Events.emit("troxtworld:staff_fired", {
    building_id=building_id, player_id=employee_id, sig=SIG,
  })
  return true
end

function Doors.add_resident(building_id, player_id, apt_door_id)
  _residents[building_id] = _residents[building_id] or {}
  _residents[building_id][player_id] = true
  if apt_door_id then Doors.give_key(player_id, uid(building_id, apt_door_id)) end
  Doors.save()
end

function Doors.remove_resident(building_id, player_id, apt_door_id)
  if _residents[building_id] then _residents[building_id][player_id] = nil end
  if apt_door_id then Doors.revoke_key(player_id, uid(building_id, apt_door_id)) end
  Doors.save()
end

function Doors.buzz(door_uid, visitor_id, apt)
  Events.emit("troxtworld:door_buzz", {
    uid=door_uid, visitor=visitor_id, apt=apt, sig=SIG,
  })
end

function Doors.remote_open(door_uid, resident)
  local d = _doors[door_uid]
  if not d then return false end
  if not (_residents[d.building_id] and _residents[d.building_id][resident.id]) then
    return false, "Résidents uniquement"
  end
  d.is_open, d.opened_by, d.opened_at = true, resident.id, os.time()
  Events.emit("troxtworld:door_state", {
    uid=door_uid, is_open=true, is_locked=d.is_locked,
    anim=d.anim, open_ms=d.open_ms, sig=SIG,
  })
  return true
end

-- ═══════════════════════════════════════════════════════════════════════════
-- OCCUPATION (cabines, toilettes) — Fix v4.0 avec set séparé
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.enter_room(door_uid, player_id)
  local d = _doors[door_uid]
  if not d or not d.occupancy then return false end
  if #d.occupants >= d.occupancy then return false, "Occupé" end
  table.insert(d.occupants, player_id)
  d.occupants_set[player_id] = true
  return true
end

function Doors.leave_room(door_uid, player_id)
  local d = _doors[door_uid]
  if not d or not d.occupancy then return end
  for i, p in ipairs(d.occupants) do
    if p == player_id then table.remove(d.occupants, i) break end
  end
  d.occupants_set[player_id] = nil
  if d.inside_lock then d.is_locked = false end
end

-- ═══════════════════════════════════════════════════════════════════════════
-- TICK
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.set_world_hour(h) _world_hour = h % 24 end

local _tick_counter = 0
function Doors.tick()
  local now = os.time()
  _tick_counter = _tick_counter + 1

  -- Auto-close des portes
  for id, d in pairs(_doors) do
    if d.is_open and not d.broken and d.opened_at and (now - d.opened_at) >= d.auto_close then
      Doors.close(id, "auto")
    end
  end

  -- Expiration raids
  for z, t in pairs(_raid_zones) do if now >= t then _raid_zones[z] = nil end end

  -- Expiration mandats
  for bid, w in pairs(_warrants) do if now >= w.until_ts then _warrants[bid] = nil end end

  -- ✨ v4.0 : Cleanup périodique (toutes les 60 ticks ≈ 1 min à 20Hz)
  if _tick_counter % 1200 == 0 then
    -- Nettoyer _code_fails expirés
    for k, f in pairs(_code_fails) do
      if f.until_ts and now >= f.until_ts + 300 then _code_fails[k] = nil end
    end
    -- Nettoyer _casing_tracker anciens
    for pid, buildings in pairs(_casing_tracker) do
      for bid, t in pairs(buildings) do
        if (now - t.first_at) > 1800 then buildings[bid] = nil end
      end
      if not next(buildings) then _casing_tracker[pid] = nil end
    end
    -- Vérifier loyers expirés
    Doors.check_rent_expired()
  end
end

-- ═══════════════════════════════════════════════════════════════════════════
-- REQUÊTES
-- ═══════════════════════════════════════════════════════════════════════════
function Doors.get_public_state(building_id)
  local out = {}
  for id, d in pairs(_doors) do
    if not building_id or d.building_id == building_id then
      out[id] = {
        uid=id, building_id=d.building_id, door_id=d.door_id,
        type=d.type, anim=d.anim, open_ms=d.open_ms,
        is_open=d.is_open, is_locked=d.is_locked, broken=d.broken,
        hp=d.hp, max_hp=d.max_hp, alarm_active=d.alarm_active,
        lock=d.lock, public=d.public, entry_fee=d.entry_fee,
      }
    end
  end
  return out
end

function Doors.get_buildings()
  local out = {}
  for id, b in pairs(BUILDINGS) do
    out[id] = {
      id=id, name=b.name, icon=b.icon, zone=b.zone, type=b.type,
      hours=b.hours, open_now=in_hours(b.hours, _world_hour),
      owner=_owners[id], buyable=b.owner_buyable and not _owners[id], price=b.price,
      robbable=b.robbable, has_cameras=b.has_cameras,
      has_panic_button=b.has_panic_button, secure_level=b.secure_level,
      has_warrant=_warrants[id] and true or false,
    }
  end
  return out
end

function Doors.get_player_keys(player_id) return _keys[player_id] or {} end
function Doors.get_door(door_uid) return _doors[door_uid] end
function Doors.get_types() return DOOR_TYPES end
function Doors.get_lock_modes() return LOCK_MODES end
function Doors.get_stats() return _stats end
function Doors.get_signature() return SIG end
function Doors.get_access_log(door_uid) return _access_log[door_uid] or {} end
function Doors.get_warrants() return _warrants end
function Doors.get_tenants(building_id) return _tenants[building_id] or {} end

Doors.init()
return Doors
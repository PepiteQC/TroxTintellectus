--[[
══════════════════════════════════════════════════════════════════════
  🛡️INTELLECTUS⬡ — INTELLECTUS_ADMIN.LUA
  Interface d'administration complète TroxtWorld
  Commandes · Permissions · Gestion joueurs · Fun · Sécurité

  Signature : 🛡️INTELLECTUS⬡
  Chemin    : lua/intellectus/intellectus_admin.lua
══════════════════════════════════════════════════════════════════════
]]

local Admin  = {}
local Events = require("troxt.troxt_events")
local Memory = require("troxt.troxt_memory")

local SIG     = "🛡️INTELLECTUS⬡"
local TROXT   = "TROXT⬡"
local VERSION = "2.0.0"

local function log(level, msg, data)
  local icons = { INFO="ℹ", WARN="⚠", ERROR="✖", OK="✓", ADMIN="🔐", CRITICAL="🔴", FUN="🎉" }
  print(string.format("[%s] %s [%s] %s", os.date("%H:%M:%S"), icons[level] or "·", SIG, msg))
  if data then
    for k, v in pairs(data) do print(string.format("   ↳ %s: %s", k, tostring(v))) end
  end
end

local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── NIVEAUX D'ACCÈS ─────────────────────────────────────────────────────────
local ACCESS = {
  viewer = {
    level = 1, label = "Observateur", color = "#64748b",
    can = {
      "read_logs", "read_report", "read_threats", "read_audit",
      "read_players", "read_chat_log", "read_economy",
    },
  },
  moderateur = {
    level = 2, label = "Modérateur", color = "#22c55e",
    can = {
      "read_logs", "read_report", "read_threats", "read_audit",
      "read_players", "read_chat_log", "read_economy",
      "player_kick", "player_mute", "player_unmute",
      "player_warn", "player_tp", "player_heal",
      "player_bring", "player_goto",
      "cmd_slap", "cmd_freeze", "cmd_unfreeze",
      "cmd_announce", "cmd_emote_force",
      "unblock_ip", "run_scan",
    },
  },
  operator = {
    level = 3, label = "Opérateur", color = "#7dd3fc",
    can = {
      "read_logs", "read_report", "read_threats", "read_audit",
      "read_players", "read_chat_log", "read_economy",
      "player_kick", "player_mute", "player_unmute",
      "player_warn", "player_tp", "player_heal",
      "player_bring", "player_goto",
      "player_jail", "player_unjail",
      "player_set_cash", "player_set_job",
      "player_set_wanted", "player_revive",
      "player_clear_crimes", "player_set_faction",
      "cmd_slap", "cmd_freeze", "cmd_unfreeze",
      "cmd_announce", "cmd_emote_force",
      "cmd_weather", "cmd_time", "cmd_event_trigger",
      "cmd_give_item", "cmd_spawn_vehicle",
      "cmd_fireworks", "cmd_earthquake",
      "cmd_wanted_all_clear", "cmd_payday",
      "unblock_ip", "block_ip", "run_scan",
      "manage_tokens", "revoke_token",
    },
  },
  supervisor = {
    level = 4, label = "Superviseur", color = "#a78bfa",
    can = {
      "*_read", "*_player", "*_cmd", "*_fun",
      "player_ban", "player_unban",
      "player_set_level", "player_set_bank",
      "player_god_mode", "player_invisible",
      "player_spectate", "player_reset_stats",
      "whitelist_ip", "change_rate_limit",
      "export_audit", "manage_operators",
      "cmd_nuke_zone", "cmd_police_raid",
      "cmd_economy_reset_player",
      "server_broadcast", "server_message_hud",
      "room_lock", "room_unlock", "room_kick_all",
    },
  },
  root = {
    level = 9, label = "Administrateur", color = "#f87171",
    can = { "*" },
  },
}

-- ─── CATALOGUE DES COMMANDES ──────────────────────────────────────────────────
local COMMANDS = {

  -- ══════════════ INFORMATION ══════════════
  help = {
    permission = "read_report",
    category   = "info",
    usage      = "/help [commande]",
    desc       = "Liste toutes les commandes disponibles ou détaille une commande",
    fun        = false,
  },
  status = {
    permission = "read_report",
    category   = "info",
    usage      = "/status",
    desc       = "État complet du serveur TroxtWorld",
    fun        = false,
  },
  report = {
    permission = "read_report",
    category   = "info",
    usage      = "/report",
    desc       = "Rapport système complet — sécurité, RP, économie",
    fun        = false,
  },
  who = {
    permission = "read_players",
    category   = "info",
    usage      = "/who [filtre]",
    desc       = "Liste les joueurs en ligne avec leurs infos",
    fun        = false,
  },
  find = {
    permission = "read_players",
    category   = "info",
    usage      = "/find <nom>",
    desc       = "Trouve un joueur par nom ou ID partiel",
    fun        = false,
  },
  playerinfo = {
    permission = "read_players",
    category   = "info",
    usage      = "/playerinfo <player_id>",
    desc       = "Fiche complète d'un joueur — RP, crimes, stats, besoins",
    fun        = false,
  },
  economy = {
    permission = "read_economy",
    category   = "info",
    usage      = "/economy",
    desc       = "État de l'économie — marchés, inflation, trésor",
    fun        = false,
  },
  threats = {
    permission = "read_threats",
    category   = "securite",
    usage      = "/threats [niveau_min]",
    desc       = "Liste les menaces actives par niveau",
    fun        = false,
  },
  audit = {
    permission = "read_audit",
    category   = "securite",
    usage      = "/audit [limit] [joueur]",
    desc       = "Journal d'audit immuable",
    fun        = false,
  },
  chatlog = {
    permission = "read_chat_log",
    category   = "info",
    usage      = "/chatlog [limit]",
    desc       = "Historique du chat global",
    fun        = false,
  },

  -- ══════════════ MODÉRATION JOUEURS ══════════════
  kick = {
    permission = "player_kick",
    category   = "moderation",
    usage      = "/kick <player_id> [raison]",
    desc       = "Expulse un joueur du serveur",
    fun        = false,
  },
  ban = {
    permission = "player_ban",
    category   = "moderation",
    usage      = "/ban <player_id> [durée_min] [raison]",
    desc       = "Banni un joueur (défaut: permanent)",
    fun        = false,
  },
  unban = {
    permission = "player_unban",
    category   = "moderation",
    usage      = "/unban <player_id>",
    desc       = "Lève le bannissement d'un joueur",
    fun        = false,
  },
  mute = {
    permission = "player_mute",
    category   = "moderation",
    usage      = "/mute <player_id> [durée_min] [raison]",
    desc       = "Coupe le micro d'un joueur dans le chat",
    fun        = false,
  },
  unmute = {
    permission = "player_unmute",
    category   = "moderation",
    usage      = "/unmute <player_id>",
    desc       = "Rétablit le chat d'un joueur",
    fun        = false,
  },
  warn = {
    permission = "player_warn",
    category   = "moderation",
    usage      = "/warn <player_id> <raison>",
    desc       = "Envoie un avertissement officiel à un joueur",
    fun        = false,
  },
  jail = {
    permission = "player_jail",
    category   = "moderation",
    usage      = "/jail <player_id> [durée_min] [raison]",
    desc       = "Envoie un joueur en prison RP",
    fun        = false,
  },
  unjail = {
    permission = "player_unjail",
    category   = "moderation",
    usage      = "/unjail <player_id>",
    desc       = "Libère un joueur de prison",
    fun        = false,
  },
  spectate = {
    permission = "player_spectate",
    category   = "moderation",
    usage      = "/spectate <player_id>",
    desc       = "Observer un joueur en mode spectateur invisible",
    fun        = false,
  },

  -- ══════════════ TÉLÉPORTATION ══════════════
  tp = {
    permission = "player_tp",
    category   = "teleport",
    usage      = "/tp <player_id> <x> <y> <z>",
    desc       = "Téléporte un joueur aux coordonnées",
    fun        = false,
  },
  tpto = {
    permission = "player_tp",
    category   = "teleport",
    usage      = "/tpto <player_id> <target_id>",
    desc       = "Téléporte un joueur vers un autre joueur",
    fun        = false,
  },
  bring = {
    permission = "player_bring",
    category   = "teleport",
    usage      = "/bring <player_id>",
    desc       = "Téléporte un joueur à toi",
    fun        = false,
  },
  ["goto"] = {
    permission = "player_goto",
    category   = "teleport",
    usage      = "/goto <player_id>",
    desc       = "Te téléporte vers un joueur",
    fun        = false,
  },
  tpzone = {
    permission = "player_tp",
    category   = "teleport",
    usage      = "/tpzone <player_id> <zone_id>",
    desc       = "Téléporte un joueur vers une zone TroxtWorld",
    fun        = false,
  },

  -- ══════════════ GESTION RP ══════════════
  heal = {
    permission = "player_heal",
    category   = "rp",
    usage      = "/heal <player_id> [quantité]",
    desc       = "Soigne un joueur (défaut: 100% santé)",
    fun        = false,
  },
  revive = {
    permission = "player_revive",
    category   = "rp",
    usage      = "/revive <player_id>",
    desc       = "Ressuscite un joueur mort sur place",
    fun        = false,
  },
  setcash = {
    permission = "player_set_cash",
    category   = "rp",
    usage      = "/setcash <player_id> <montant>",
    desc       = "Définit le cash en poche d'un joueur",
    fun        = false,
  },
  setbank = {
    permission = "player_set_bank",
    category   = "rp",
    usage      = "/setbank <player_id> <montant>",
    desc       = "Définit le solde bancaire d'un joueur",
    fun        = false,
  },
  givecash = {
    permission = "player_set_cash",
    category   = "rp",
    usage      = "/givecash <player_id> <montant>",
    desc       = "Donne de l'argent à un joueur",
    fun        = false,
  },
  takecash = {
    permission = "player_set_cash",
    category   = "rp",
    usage      = "/takecash <player_id> <montant>",
    desc       = "Retire de l'argent à un joueur",
    fun        = false,
  },
  setjob = {
    permission = "player_set_job",
    category   = "rp",
    usage      = "/setjob <player_id> <job_id>",
    desc       = "Assigne un emploi à un joueur",
    fun        = false,
  },
  setfaction = {
    permission = "player_set_faction",
    category   = "rp",
    usage      = "/setfaction <player_id> <faction_id> [rang]",
    desc       = "Assigne une faction à un joueur",
    fun        = false,
  },
  setwanted = {
    permission = "player_set_wanted",
    category   = "rp",
    usage      = "/setwanted <player_id> <0-5>",
    desc       = "Définit le niveau de recherche d'un joueur",
    fun        = false,
  },
  clearcrim = {
    permission = "player_clear_crimes",
    category   = "rp",
    usage      = "/clearcrim <player_id>",
    desc       = "Efface le casier judiciaire d'un joueur",
    fun        = false,
  },
  setlevel = {
    permission = "player_set_level",
    category   = "rp",
    usage      = "/setlevel <player_id> <1-100>",
    desc       = "Définit le niveau d'un joueur",
    fun        = false,
  },
  resetstats = {
    permission = "player_reset_stats",
    category   = "rp",
    usage      = "/resetstats <player_id>",
    desc       = "Réinitialise les stats RP d'un joueur",
    fun        = false,
  },
  giveitem = {
    permission = "cmd_give_item",
    category   = "rp",
    usage      = "/giveitem <player_id> <item_id> [quantité]",
    desc       = "Donne un item à un joueur",
    fun        = false,
  },
  spawnvehicle = {
    permission = "cmd_spawn_vehicle",
    category   = "rp",
    usage      = "/spawnvehicle <player_id> <type>",
    desc       = "Fait apparaître un véhicule devant un joueur",
    fun        = false,
  },
  godmode = {
    permission = "player_god_mode",
    category   = "rp",
    usage      = "/godmode <player_id>",
    desc       = "Active/désactive l'invincibilité pour un joueur",
    fun        = false,
  },
  invisible = {
    permission = "player_invisible",
    category   = "rp",
    usage      = "/invisible <player_id>",
    desc       = "Rend un joueur invisible aux autres",
    fun        = false,
  },
  wantedclear = {
    permission = "cmd_wanted_all_clear",
    category   = "rp",
    usage      = "/wantedclear [player_id]",
    desc       = "Remet wanted à 0 pour un joueur ou tous",
    fun        = false,
  },
  payday = {
    permission = "cmd_payday",
    category   = "rp",
    usage      = "/payday [joueurs_actifs_seulement]",
    desc       = "Force une paie immédiate pour tous les joueurs avec un emploi",
    fun        = false,
  },

  -- ══════════════ MONDE ══════════════
  weather = {
    permission = "cmd_weather",
    category   = "monde",
    usage      = "/weather <clear|rain|storm|fog|snow|cloudy>",
    desc       = "Change la météo du monde",
    fun        = false,
  },
  settime = {
    permission = "cmd_time",
    category   = "monde",
    usage      = "/settime <HH:MM>",
    desc       = "Définit l'heure du monde RP",
    fun        = false,
  },
  event = {
    permission = "cmd_event_trigger",
    category   = "monde",
    usage      = "/event <event_id> <zone_id>",
    desc       = "Déclenche un événement monde dans une zone",
    fun        = false,
  },
  lockroom = {
    permission = "room_lock",
    category   = "monde",
    usage      = "/lockroom <room_id>",
    desc       = "Verrouille une room — plus aucun joueur ne peut entrer",
    fun        = false,
  },
  unlockroom = {
    permission = "room_unlock",
    category   = "monde",
    usage      = "/unlockroom <room_id>",
    desc       = "Déverrouille une room",
    fun        = false,
  },
  kickroom = {
    permission = "room_kick_all",
    category   = "monde",
    usage      = "/kickroom <room_id> [raison]",
    desc       = "Expulse tous les joueurs d'une room vers le monde principal",
    fun        = false,
  },

  -- ══════════════ SÉCURITÉ ══════════════
  blockip = {
    permission = "block_ip",
    category   = "securite",
    usage      = "/blockip <ip> [durée_min] [raison]",
    desc       = "Bloque une IP",
    fun        = false,
  },
  unblockip = {
    permission = "unblock_ip",
    category   = "securite",
    usage      = "/unblockip <ip>",
    desc       = "Débloque une IP",
    fun        = false,
  },
  whitelistip = {
    permission = "whitelist_ip",
    category   = "securite",
    usage      = "/whitelistip <ip> [raison]",
    desc       = "Ajoute une IP à la whitelist permanente",
    fun        = false,
  },
  scan = {
    permission = "run_scan",
    category   = "securite",
    usage      = "/scan",
    desc       = "Lance un scan comportemental de toutes les IPs actives",
    fun        = false,
  },
  blockedips = {
    permission = "read_threats",
    category   = "securite",
    usage      = "/blockedips",
    desc       = "Liste toutes les IPs bloquées",
    fun        = false,
  },

  -- ══════════════ FUN ══════════════
  slap = {
    permission = "cmd_slap",
    category   = "fun",
    usage      = "/slap <player_id> [force]",
    desc       = "⚡ Frappe un joueur et le propulse dans les airs",
    fun        = true,
    cool_factor= 9,
  },
  freeze = {
    permission = "cmd_freeze",
    category   = "fun",
    usage      = "/freeze <player_id>",
    desc       = "❄️ Fige un joueur sur place — il peut encore parler",
    fun        = true,
    cool_factor= 7,
  },
  unfreeze = {
    permission = "cmd_unfreeze",
    category   = "fun",
    usage      = "/unfreeze <player_id>",
    desc       = "🔥 Dégèle un joueur",
    fun        = true,
    cool_factor= 5,
  },
  dance = {
    permission = "cmd_emote_force",
    category   = "fun",
    usage      = "/dance <player_id> [style]",
    desc       = "💃 Force un joueur à danser (styles: salsa, robot, shuffle, twerk)",
    fun        = true,
    cool_factor= 10,
  },
  emote = {
    permission = "cmd_emote_force",
    category   = "fun",
    usage      = "/emote <player_id> <emote>",
    desc       = "🎭 Force une animation sur un joueur",
    fun        = true,
    cool_factor= 7,
  },
  announce = {
    permission = "cmd_announce",
    category   = "fun",
    usage      = "/announce <message>",
    desc       = "📢 Envoie une annonce en HUD à tous les joueurs",
    fun        = true,
    cool_factor= 8,
  },
  broadcast = {
    permission = "server_broadcast",
    category   = "fun",
    usage      = "/broadcast <message>",
    desc       = "📻 Message serveur global dans le chat",
    fun        = true,
    cool_factor= 6,
  },
  hud = {
    permission = "server_message_hud",
    category   = "fun",
    usage      = "/hud <player_id|all> <message> [durée_sec]",
    desc       = "📺 Affiche un message HUD ciblé à un ou tous les joueurs",
    fun        = true,
    cool_factor= 8,
  },
  fireworks = {
    permission = "cmd_fireworks",
    category   = "fun",
    usage      = "/fireworks [player_id|all] [durée_sec]",
    desc       = "🎆 Lance des feux d'artifice sur un joueur ou partout",
    fun        = true,
    cool_factor= 10,
  },
  earthquake = {
    permission = "cmd_earthquake",
    category   = "fun",
    usage      = "/earthquake [intensité 1-10] [durée_sec]",
    desc       = "🌋 Déclenche un tremblement de terre dans le monde",
    fun        = true,
    cool_factor= 10,
  },
  flip = {
    permission = "cmd_emote_force",
    category   = "fun",
    usage      = "/flip <player_id>",
    desc       = "🔃 Retourne un joueur à l'envers pendant 5 secondes",
    fun        = true,
    cool_factor= 9,
  },
  supersize = {
    permission = "cmd_emote_force",
    category   = "fun",
    usage      = "/supersize <player_id> [scale]",
    desc       = "🦣 Agrandit un joueur (scale 0.1 à 10)",
    fun        = true,
    cool_factor= 9,
  },
  mini = {
    permission = "cmd_emote_force",
    category   = "fun",
    usage      = "/mini <player_id>",
    desc       = "🐭 Réduit un joueur à 10% de sa taille",
    fun        = true,
    cool_factor= 9,
  },
  drunk = {
    permission = "cmd_emote_force",
    category   = "fun",
    usage      = "/drunk <player_id> [durée_sec]",
    desc       = "🍺 Force un joueur en mode ivre — démarche chancelante",
    fun        = true,
    cool_factor= 10,
  },
  spaghetti = {
    permission = "cmd_emote_force",
    category   = "fun",
    usage      = "/spaghetti <player_id>",
    desc       = "🍝 Donne une démarche de spaghetti mouillé à un joueur",
    fun        = true,
    cool_factor= 10,
  },
  matrix = {
    permission = "cmd_emote_force",
    category   = "fun",
    usage      = "/matrix [durée_sec]",
    desc       = "🕶️ Active l'effet bullet-time pour tout le monde",
    fun        = true,
    cool_factor= 10,
  },
  rain_cash = {
    permission = "cmd_event_trigger",
    category   = "fun",
    usage      = "/raincash [zone_id] [montant_par_joueur]",
    desc       = "💸 Fait pleuvoir de l'argent sur une zone",
    fun        = true,
    cool_factor= 10,
  },
  wanted_hunt = {
    permission = "cmd_event_trigger",
    category   = "fun",
    usage      = "/wantedhunt [prime T$]",
    desc       = "🏴‍☠️ Lance une chasse aux wanted — prime pour qui attrape le plus recherché",
    fun        = true,
    cool_factor= 10,
  },
  nuke_zone = {
    permission = "cmd_nuke_zone",
    category   = "fun",
    usage      = "/nukezone <zone_id>",
    desc       = "☢️ Expulse tous les joueurs d'une zone + effet explosion visuel",
    fun        = true,
    cool_factor= 10,
  },
  police_raid = {
    permission = "cmd_police_raid",
    category   = "fun",
    usage      = "/policeraid <zone_id>",
    desc       = "🚨 Déclenche un raid de police massif dans une zone",
    fun        = true,
    cool_factor= 10,
  },
  chaos = {
    permission = "cmd_nuke_zone",
    category   = "fun",
    usage      = "/chaos [durée_sec]",
    desc       = "😈 Active le mode CHAOS — vitesse ×3, wanted ×2, météo aléatoire",
    fun        = true,
    cool_factor= 10,
  },
  disco = {
    permission = "cmd_event_trigger",
    category   = "fun",
    usage      = "/disco <zone_id> [durée_sec]",
    desc       = "🪩 Mode disco dans une zone — lumières clignotantes + tous dansent",
    fun        = true,
    cool_factor= 10,
  },
  gravity = {
    permission = "cmd_earthquake",
    category   = "fun",
    usage      = "/gravity <0.1-3.0>",
    desc       = "🌌 Modifie la gravité du monde (1.0 = normale)",
    fun        = true,
    cool_factor= 10,
  },
  teleportall = {
    permission = "player_tp",
    category   = "fun",
    usage      = "/teleportall <zone_id>",
    desc       = "🌀 Téléporte TOUS les joueurs vers une zone",
    fun        = true,
    cool_factor= 9,
  },
}

-- ─── ÉTAT ADMIN ──────────────────────────────────────────────────────────────
local _operators   = {}
local _sessions    = {}
local _cmd_history = {}
local _bans        = {}
local _mutes       = {}
local _jails       = {}
local _god_modes   = {}
local _invisibles  = {}
local _frozen      = {}
local _effects     = {}
local _warns       = {}
local _locked_rooms= {}
local _spectating  = {}
local _chat_log    = {}
local _op_cnt      = 0

local _stats = {
  total_logins   = 0,
  total_commands = 0,
  failed_logins  = 0,
  players_kicked = 0,
  players_banned = 0,
  players_muted  = 0,
  players_jailed = 0,
  fun_commands   = 0,
}

-- ─── HELPERS ─────────────────────────────────────────────────────────────────
local function has(op_id, permission)
  local op  = _operators[op_id]
  if not op then return false end
  local lvl = ACCESS[op.role]
  if not lvl then return false end
  for _, p in ipairs(lvl.can) do
    if p == "*" then return true end
    if p == permission then return true end
    local prefix = p:match("^%*_(.+)$")
    if prefix and permission:find(prefix, 1, true) then return true end
  end
  return false
end

local function record(op_id, cmd, args, result, ok)
  _op_cnt = _op_cnt + 1
  local e = {
    seq      = _op_cnt,
    op_id    = op_id,
    op_name  = _operators[op_id] and _operators[op_id].name or "?",
    cmd      = cmd,
    args     = args,
    result   = result,
    ok       = ok,
    ts       = os.time(),
    date     = os.date("%Y-%m-%d %H:%M:%S"),
    sig      = SIG,
  }
  table.insert(_cmd_history, 1, e)
  if #_cmd_history > 1000 then table.remove(_cmd_history) end
  Events.emit("intellectus:admin_cmd", e)
  return e
end

local function require_arg(args, key, err_msg)
  if not args[key] then return false, err_msg or (key .. " requis") end
  return true
end

local function notify_player(player_id, msg_type, data)
  Events.emit("troxtworld:admin_notify_player", {
    player_id = player_id,
    msg_type  = msg_type,
    data      = data,
    sig       = SIG,
  })
end

local function notify_all(msg_type, data)
  Events.emit("troxtworld:admin_notify_all", {
    msg_type = msg_type,
    data     = data,
    sig      = SIG,
  })
end

-- ─── AUTH ADMIN ──────────────────────────────────────────────────────────────
function Admin.create_operator(name, role, created_by)
  if not ACCESS[role] then return nil, "Rôle invalide: " .. tostring(role) end
  local op_id = string.format("OP-%06d", os.time() % 1000000)
  local now   = os.time()
  local tmp   = string.format("ITMP_%d_%d", math.random(10000,99999), now % 10000)
  local hash  = string.format("%08x", (tmp:len() * 7919 + now) % 4294967296)

  _operators[op_id] = {
    id=op_id, name=name, role=role,
    role_label=ACCESS[role].label,
    pass_hash=hash, created_by=created_by or SIG,
    created_at=now, last_login=nil,
    login_count=0, active=true,
    ip_whitelist={}, sig=SIG,
  }
  Memory.set("intellectus:operator:" .. op_id, _operators[op_id], { ttl=86400*365 })
  log("ADMIN", string.format("Opérateur créé: %s [%s]", name, ACCESS[role].label))
  Events.emit("intellectus:operator_created", { op_id=op_id, name=name, role=role, sig=SIG })
  return op_id, tmp
end

function Admin.login(op_id, password, ip)
  -- ✅ Guard : password peut être nil, number, etc.
  if type(password) ~= "string" or #password == 0 then
    _stats.failed_logins = _stats.failed_logins + 1
    Events.emit("intellectus:admin_login_failed", { op_id=op_id, ip=ip, sig=SIG })
    return nil, "Mot de passe manquant"
  end

  local op = _operators[op_id]
  if not op or not op.active then
    _stats.failed_logins = _stats.failed_logins + 1
    Events.emit("intellectus:admin_login_failed", { op_id=op_id, ip=ip, sig=SIG })
    return nil, "Identifiants invalides ou compte désactivé"
  end
  local hash = string.format("%08x", (#password * 7919 + op.created_at) % 4294967296)
  if hash ~= op.pass_hash then
    _stats.failed_logins = _stats.failed_logins + 1
    return nil, "Mot de passe incorrect"
  end
  local sess_id = string.format("ADMSESS_%d_%d", os.time(), math.random(100000,999999))
  local now     = os.time()
  _sessions[sess_id] = {
    id=sess_id, op_id=op_id, op_name=op.name,
    role=op.role, ip=ip,
    opened_at=now, last_active=now,
    expires_at=now+7200, active=true, commands=0, sig=SIG,
  }
  op.last_login  = now
  op.login_count = op.login_count + 1
  _stats.total_logins = _stats.total_logins + 1
  log("OK", string.format("Login: %s [%s] depuis %s", op.name, ACCESS[op.role].label, ip or "?"))
  Events.emit("intellectus:admin_login", { op_id=op_id, name=op.name, role=op.role, ip=ip, sig=SIG })
  return sess_id
end

function Admin.validate_session(sess_id)
  local s = _sessions[sess_id]
  if not s or not s.active then return nil, "Session invalide" end
  if os.time() > s.expires_at then
    s.active = false
    return nil, "Session expirée"
  end
  s.last_active = os.time()
  s.expires_at  = os.time() + 7200
  return s
end

function Admin.logout(sess_id)
  local s = _sessions[sess_id]
  if not s then return false end
  s.active    = false
  s.closed_at = os.time()
  Memory.delete("intellectus:session:" .. sess_id)
  log("INFO", string.format("Logout: %s", s.op_name))
  Events.emit("intellectus:admin_logout", { op_id=s.op_id, name=s.op_name, sig=SIG })
  return true
end

-- ─── DISPATCH PRINCIPAL ──────────────────────────────────────────────────────
function Admin.run(sess_id, cmd, args)
  local sess, err = Admin.validate_session(sess_id)
  if not sess then return false, err end

  args = args or {}
  _stats.total_commands = _stats.total_commands + 1
  sess.commands = sess.commands + 1

  local def = COMMANDS[cmd]
  if not def then
    record(sess.op_id, cmd, args, "UNKNOWN_COMMAND", false)
    return false, "Commande inconnue: " .. tostring(cmd) .. " — tape /help"
  end

  if not has(sess.op_id, def.permission) then
    record(sess.op_id, cmd, args, "PERMISSION_DENIED", false)
    log("WARN", string.format("Permission refusée: %s essaie /%s", sess.op_name, cmd))
    return false, string.format("Permission refusée — requis: %s [niveau %s]",
      def.permission, ACCESS[sess.role] and ACCESS[sess.role].label or "?")
  end

  if def.fun then _stats.fun_commands = _stats.fun_commands + 1 end

  log("ADMIN", string.format("[%s] /%s %s",
    sess.op_name, cmd,
    next(args) and table.concat((function()
      local t={} for k,v in pairs(args) do t[#t+1]=k.."="..tostring(v) end return t
    end)(), " ") or ""))

  local ok, result, cmd_err = Admin._dispatch(sess, cmd, args, def)

  record(sess.op_id, cmd, args, cmd_err or (ok and "ok") or "error", ok and not cmd_err)

  if cmd_err then
    log("WARN", string.format("/%s échouée: %s", cmd, cmd_err))
    return false, cmd_err
  end

  Events.emit("intellectus:admin_cmd_ok", {
    op_id=sess.op_id, op_name=sess.op_name, cmd=cmd, sig=SIG
  })

  return true, result
end

-- ─── DISPATCH PAR CATÉGORIE ───────────────────────────────────────────────────
function Admin._dispatch(sess, cmd, args, def)

  -- ── INFORMATION ──────────────────────────────────────────────────────────
  if cmd == "help" then
    local target_cmd = args.cmd or args.commande
    if target_cmd then
      local c = COMMANDS[target_cmd]
      if not c then
        return false, nil, "Commande inconnue: " .. tostring(target_cmd)
      end
      return true, { cmd=target_cmd, usage=c.usage, desc=c.desc, perm=c.permission, fun=c.fun }
    end
    local accessible = {}
    for id, c in pairs(COMMANDS) do
      if has(sess.op_id, c.permission) then
        table.insert(accessible, {
          cmd=id, usage=c.usage, desc=c.desc,
          category=c.category, fun=c.fun or false,
        })
      end
    end
    table.sort(accessible, function(a,b) return a.cmd < b.cmd end)
    return true, { total=#accessible, commands=accessible }

  elseif cmd == "report" then
    return true, Admin.generate_report()

  elseif cmd == "economy" then
    local Economy = package.loaded["troxt.troxt_economy"]
    if not Economy then return false, nil, "Module économie non chargé" end
    return true, Economy.get_report()

  elseif cmd == "status" then
    local MP = package.loaded["troxt.troxt_multiplayer"]
    return true, {
      sig        = SIG,
      troxt      = TROXT,
      players    = MP and MP.get_stats() or {},
      bans       = count_keys(_bans),
      mutes      = count_keys(_mutes),
      jails      = count_keys(_jails),
      god_modes  = count_keys(_god_modes),
      admin_stats= _stats,
    }

  elseif cmd == "who" then
    local MP   = package.loaded["troxt.troxt_multiplayer"]
    local list = {}
    if MP then
      for id, p in pairs(MP.get_players()) do
        table.insert(list, {
          id      = id,
          username= p.username,
          room    = p.room_id,
          job     = p.rp and p.rp.job,
          faction = p.rp and p.rp.faction,
          wanted  = p.rp and p.rp.wanted or 0,
          health  = p.rp and p.rp.needs and p.rp.needs.health or 100,
          flags   = {
            banned     = _bans[id]   ~= nil,
            muted      = _mutes[id]  ~= nil,
            jailed     = _jails[id]  ~= nil,
            god        = _god_modes[id] == true,
            invisible  = _invisibles[id] == true,
            frozen     = _frozen[id] == true,
            warns      = _warns[id] and #_warns[id] or 0,
          },
        })
      end
    end
    table.sort(list, function(a,b) return a.username < b.username end)
    return true, { count=#list, players=list }

  elseif cmd == "find" then
    local ok2, err2 = require_arg(args, "name", "Nom ou ID requis")
    if not ok2 then return false, nil, err2 end
    local MP   = package.loaded["troxt.troxt_multiplayer"]
    local found = {}
    if MP then
      local q = args.name:lower()
      for id, p in pairs(MP.get_players()) do
        if id:lower():find(q, 1, true) or p.username:lower():find(q, 1, true) then
          table.insert(found, { id=id, username=p.username, room=p.room_id })
        end
      end
    end
    return true, { found=#found, results=found }

  elseif cmd == "playerinfo" then
    local ok2, err2 = require_arg(args, "player_id")
    if not ok2 then return false, nil, err2 end
    local MP = package.loaded["troxt.troxt_multiplayer"]
    local p  = MP and MP.get_player(args.player_id)
    if not p then return false, nil, "Joueur introuvable" end
    return true, {
      id         = args.player_id,
      username   = p.username,
      room       = p.room_id,
      pos        = p.pos,
      rp         = p.rp,
      ping_ms    = p.ping_ms,
      connected_since = os.date("%H:%M:%S", p.connected_at),
      warns      = _warns[args.player_id] or {},
      is_banned  = _bans[args.player_id] ~= nil,
      is_muted   = _mutes[args.player_id] ~= nil,
      is_jailed  = _jails[args.player_id] ~= nil,
      god_mode   = _god_modes[args.player_id] == true,
      invisible  = _invisibles[args.player_id] == true,
      frozen     = _frozen[args.player_id] == true,
      active_effects = _effects[args.player_id],
    }

  elseif cmd == "chatlog" then
    local limit = math.min(args.limit or 50, 500)
    return true, { log=_chat_log, count=#_chat_log, showing=math.min(limit, #_chat_log) }

  -- ── MODÉRATION ────────────────────────────────────────────────────────────
  elseif cmd == "kick" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local reason = args.reason or "Expulsion par admin"
    _stats.players_kicked = _stats.players_kicked + 1
    notify_player(args.player_id, "KICK", { reason=reason, by=sess.op_name })
    Events.emit("troxtworld:player_kicked", { player_id=args.player_id, reason=reason, by=sess.op_id, sig=SIG })
    return true, { kicked=args.player_id, reason=reason }

  elseif cmd == "ban" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local dur = args.duree_min and (args.duree_min * 60) or nil
    _bans[args.player_id] = {
      player_id=args.player_id, reason=args.reason or "Ban admin",
      by=sess.op_id, by_name=sess.op_name,
      at=os.time(), expires_at=dur and (os.time()+dur) or nil,
      permanent=dur==nil,
    }
    _stats.players_banned = _stats.players_banned + 1
    Memory.set("admin:ban:" .. args.player_id, _bans[args.player_id])
    notify_player(args.player_id, "BAN", { reason=args.reason, duration=dur, by=sess.op_name })
    Events.emit("troxtworld:player_banned", { player_id=args.player_id, by=sess.op_id, sig=SIG })
    log("WARN", string.format("BAN — %s par %s [%s]", args.player_id, sess.op_name,
      dur and (math.floor(dur/60).."min") or "PERMANENT"))
    return true, { banned=args.player_id, permanent=dur==nil, duration_min=args.duree_min }

  elseif cmd == "unban" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    if not _bans[args.player_id] then return false, nil, "Joueur non banni" end
    _bans[args.player_id] = nil
    Memory.delete("admin:ban:" .. args.player_id)
    return true, { unbanned=args.player_id }

  elseif cmd == "mute" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local dur = args.duree_min and (args.duree_min * 60) or 3600
    _mutes[args.player_id] = {
      player_id=args.player_id, by=sess.op_name,
      at=os.time(), expires_at=os.time()+dur,
      reason=args.reason or "Mute admin",
    }
    _stats.players_muted = _stats.players_muted + 1
    notify_player(args.player_id, "MUTED", { reason=args.reason, duration=dur, by=sess.op_name })
    return true, { muted=args.player_id, duration_sec=dur }

  elseif cmd == "unmute" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    _mutes[args.player_id] = nil
    notify_player(args.player_id, "UNMUTED", { by=sess.op_name })
    return true, { unmuted=args.player_id }

  elseif cmd == "warn" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "raison") if not ok3 then return false, nil, err3 end
    if not _warns[args.player_id] then _warns[args.player_id] = {} end
    local w = { raison=args.raison, by=sess.op_name, at=os.date("%H:%M:%S"), sig=SIG }
    table.insert(_warns[args.player_id], w)
    notify_player(args.player_id, "WARN", { raison=args.raison, by=sess.op_name, total=#_warns[args.player_id] })
    return true, { warned=args.player_id, total_warns=#_warns[args.player_id] }

  elseif cmd == "jail" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local dur = (args.duree_min or 10) * 60
    _jails[args.player_id] = { player_id=args.player_id, by=sess.op_name, at=os.time(), expires_at=os.time()+dur }
    _stats.players_jailed = _stats.players_jailed + 1
    notify_player(args.player_id, "JAILED", {
      reason=args.reason or "Prison RP", duration=dur, by=sess.op_name
    })
    Events.emit("troxtworld:player_jailed", { player_id=args.player_id, duration=dur, sig=SIG })
    return true, { jailed=args.player_id, duration_min=args.duree_min or 10 }

  elseif cmd == "unjail" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    _jails[args.player_id] = nil
    notify_player(args.player_id, "UNJAILED", { by=sess.op_name })
    return true, { unjailed=args.player_id }

  -- ── TÉLÉPORTATION ─────────────────────────────────────────────────────────
  elseif cmd == "tp" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local pos = { x=args.x or 0, y=args.y or 0, z=args.z or 0 }
    notify_player(args.player_id, "TELEPORT", { pos=pos, by=sess.op_name })
    Events.emit("troxtworld:admin_tp", { player_id=args.player_id, pos=pos, sig=SIG })
    return true, { teleported=args.player_id, pos=pos }

  elseif cmd == "tpto" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "target_id") if not ok3 then return false, nil, err3 end
    notify_player(args.player_id, "TELEPORT_TO_PLAYER", { target_id=args.target_id, by=sess.op_name })
    return true, { teleported=args.player_id, to=args.target_id }

  elseif cmd == "bring" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    notify_player(args.player_id, "TELEPORT_TO_ADMIN", { admin_id=sess.op_id, by=sess.op_name })
    return true, { brought=args.player_id }

  elseif cmd == "goto" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    Events.emit("troxtworld:admin_goto", { admin_id=sess.op_id, target=args.player_id, sig=SIG })
    return true, { goto_target=args.player_id }

  elseif cmd == "tpzone" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "zone_id") if not ok3 then return false, nil, err3 end
    notify_player(args.player_id, "TELEPORT_ZONE", { zone_id=args.zone_id, by=sess.op_name })
    Events.emit("troxtworld:admin_tp_zone", { player_id=args.player_id, zone_id=args.zone_id, sig=SIG })
    return true, { teleported=args.player_id, zone=args.zone_id }

  -- ── GESTION RP ────────────────────────────────────────────────────────────
  elseif cmd == "heal" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local amount = args.quantite or 100
    notify_player(args.player_id, "HEALED", { amount=amount, by=sess.op_name })
    Events.emit("troxtworld:admin_heal", { player_id=args.player_id, amount=amount, sig=SIG })
    return true, { healed=args.player_id, amount=amount }

  elseif cmd == "revive" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    notify_player(args.player_id, "REVIVED", { by=sess.op_name })
    Events.emit("troxtworld:admin_revive", { player_id=args.player_id, sig=SIG })
    return true, { revived=args.player_id }

  elseif cmd == "setcash" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "montant") if not ok3 then return false, nil, err3 end
    notify_player(args.player_id, "CASH_SET", { amount=args.montant, by=sess.op_name })
    Events.emit("troxtworld:admin_set_cash", { player_id=args.player_id, amount=args.montant, sig=SIG })
    return true, { player=args.player_id, cash=args.montant }

  elseif cmd == "givecash" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "montant") if not ok3 then return false, nil, err3 end
    notify_player(args.player_id, "CASH_GIVEN", { amount=args.montant, by=sess.op_name })
    Events.emit("troxtworld:admin_give_cash", { player_id=args.player_id, amount=args.montant, sig=SIG })
    return true, { given_to=args.player_id, amount=args.montant }

  elseif cmd == "takecash" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "montant") if not ok3 then return false, nil, err3 end
    notify_player(args.player_id, "CASH_TAKEN", { amount=args.montant, by=sess.op_name })
    Events.emit("troxtworld:admin_take_cash", { player_id=args.player_id, amount=args.montant, sig=SIG })
    return true, { taken_from=args.player_id, amount=args.montant }

  elseif cmd == "setbank" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "montant") if not ok3 then return false, nil, err3 end
    Events.emit("troxtworld:admin_set_bank", { player_id=args.player_id, amount=args.montant, sig=SIG })
    return true, { player=args.player_id, bank=args.montant }

  elseif cmd == "setjob" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "job_id") if not ok3 then return false, nil, err3 end
    notify_player(args.player_id, "JOB_SET", { job=args.job_id, by=sess.op_name })
    Events.emit("troxtworld:admin_set_job", { player_id=args.player_id, job=args.job_id, sig=SIG })
    return true, { player=args.player_id, job=args.job_id }

  elseif cmd == "setfaction" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "faction_id") if not ok3 then return false, nil, err3 end
    notify_player(args.player_id, "FACTION_SET", { faction=args.faction_id, rang=args.rang, by=sess.op_name })
    Events.emit("troxtworld:admin_set_faction", {
      player_id=args.player_id, faction=args.faction_id, rang=args.rang, sig=SIG
    })
    return true, { player=args.player_id, faction=args.faction_id }

  elseif cmd == "setwanted" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local raw   = tonumber(args.level or args.value or args["0-5"])
    local level = math.max(0, math.min(5, raw or 0))
    notify_player(args.player_id, "WANTED_SET", { level=level, by=sess.op_name })
    Events.emit("troxtworld:admin_set_wanted", { player_id=args.player_id, wanted=level, sig=SIG })
    return true, { player=args.player_id, wanted=level }

  elseif cmd == "clearcrim" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    _warns[args.player_id] = {}
    notify_player(args.player_id, "CRIMES_CLEARED", { by=sess.op_name })
    Events.emit("troxtworld:admin_clear_crimes", { player_id=args.player_id, sig=SIG })
    return true, { cleared=args.player_id }

  elseif cmd == "setlevel" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local raw = tonumber(args.level or args.value)
    if not raw then return false, nil, "Niveau requis (1 à 100)" end
    local lvl = math.max(1, math.min(100, raw))
    Events.emit("troxtworld:admin_set_level", { player_id=args.player_id, level=lvl, sig=SIG })
    return true, { player=args.player_id, level=lvl }

  elseif cmd == "godmode" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local was = _god_modes[args.player_id]
    _god_modes[args.player_id] = not was or nil
    local active = not was
    notify_player(args.player_id, "GOD_MODE", { active=active, by=sess.op_name })
    Events.emit("troxtworld:admin_god_mode", { player_id=args.player_id, active=active, sig=SIG })
    return true, { player=args.player_id, god_mode=active }

  elseif cmd == "invisible" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local was = _invisibles[args.player_id]
    _invisibles[args.player_id] = not was or nil
    local active = not was
    notify_player(args.player_id, "INVISIBLE", { active=active, by=sess.op_name })
    Events.emit("troxtworld:admin_invisible", { player_id=args.player_id, active=active, sig=SIG })
    return true, { player=args.player_id, invisible=active }

  elseif cmd == "wantedclear" then
    if args.player_id then
      Events.emit("troxtworld:admin_wanted_clear", { player_id=args.player_id, sig=SIG })
      return true, { cleared=args.player_id }
    else
      Events.emit("troxtworld:admin_wanted_clear_all", { by=sess.op_id, sig=SIG })
      return true, { cleared="all" }
    end

  elseif cmd == "payday" then
    Events.emit("troxtworld:admin_payday", { by=sess.op_id, sig=SIG })
    return true, { payday_triggered=true }

  elseif cmd == "giveitem" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "item_id") if not ok3 then return false, nil, err3 end
    local qty = args.quantite or 1
    notify_player(args.player_id, "ITEM_GIVEN", { item=args.item_id, qty=qty, by=sess.op_name })
    Events.emit("troxtworld:admin_give_item", {
      player_id=args.player_id, item=args.item_id, qty=qty, sig=SIG
    })
    return true, { given_to=args.player_id, item=args.item_id, qty=qty }

  elseif cmd == "spawnvehicle" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "type") if not ok3 then return false, nil, err3 end
    Events.emit("troxtworld:admin_spawn_vehicle", {
      player_id=args.player_id, vehicle_type=args.type, sig=SIG
    })
    return true, { spawned_for=args.player_id, type=args.type }

  elseif cmd == "spectate" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    _spectating[sess.op_id] = args.player_id
    Events.emit("troxtworld:admin_spectate", { admin_id=sess.op_id, target=args.player_id, sig=SIG })
    return true, { spectating=args.player_id }

  elseif cmd == "resetstats" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    _warns[args.player_id]   = {}
    _effects[args.player_id] = nil
    Events.emit("troxtworld:admin_reset_stats", { player_id=args.player_id, sig=SIG })
    return true, { reset=args.player_id }

  -- ── MONDE ─────────────────────────────────────────────────────────────────
  elseif cmd == "weather" then
    local w = args.weather or args.type or args.value
    local valid = { clear=true, cloudy=true, rain=true, storm=true, fog=true, snowy=true }
    if not w or not valid[w] then
      return false, nil, "Type météo invalide — clear|cloudy|rain|storm|fog|snowy"
    end
    Events.emit("troxtworld:admin_weather", { weather=w, by=sess.op_id, sig=SIG })
    notify_all("WEATHER_CHANGE", { weather=w, by=sess.op_name })
    return true, { weather=w }

  elseif cmd == "settime" then
    local t = args.time or args.value
    if not t or not tostring(t):match("^%d%d?:%d%d$") then
      return false, nil, "Format HH:MM requis (ex: /settime 14:30)"
    end
    Events.emit("troxtworld:admin_set_time", { time=t, by=sess.op_id, sig=SIG })
    return true, { time=t }

  elseif cmd == "event" then
    local ok2, err2 = require_arg(args, "event_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "zone_id") if not ok3 then return false, nil, err3 end
    Events.emit("troxtworld:admin_trigger_event", {
      event_id=args.event_id, zone_id=args.zone_id, by=sess.op_id, sig=SIG
    })
    return true, { event=args.event_id, zone=args.zone_id }

  elseif cmd == "lockroom" then
    local ok2, err2 = require_arg(args, "room_id") if not ok2 then return false, nil, err2 end
    _locked_rooms[args.room_id] = true
    Events.emit("troxtworld:room_locked", { room_id=args.room_id, by=sess.op_id, sig=SIG })
    return true, { locked=args.room_id }

  elseif cmd == "unlockroom" then
    local ok2, err2 = require_arg(args, "room_id") if not ok2 then return false, nil, err2 end
    _locked_rooms[args.room_id] = nil
    Events.emit("troxtworld:room_unlocked", { room_id=args.room_id, by=sess.op_id, sig=SIG })
    return true, { unlocked=args.room_id }

  elseif cmd == "kickroom" then
    local ok2, err2 = require_arg(args, "room_id") if not ok2 then return false, nil, err2 end
    Events.emit("troxtworld:admin_kick_room", {
      room_id=args.room_id, reason=args.reason, by=sess.op_id, sig=SIG
    })
    return true, { kicked_from=args.room_id }

  -- ── SÉCURITÉ ─────────────────────────────────────────────────────────────
  elseif cmd == "blockip" then
    local ok2, err2 = require_arg(args, "ip") if not ok2 then return false, nil, err2 end
    local dur = args.duree_min and (args.duree_min * 60) or 3600
    local Core = package.loaded["intellectus.intellectus_core"]
    if Core then Core.block_ip(args.ip, "Admin " .. sess.op_name, dur) end
    return true, { blocked_ip=args.ip, duration_sec=dur }

  elseif cmd == "unblockip" then
    local ok2, err2 = require_arg(args, "ip") if not ok2 then return false, nil, err2 end
    local Core = package.loaded["intellectus.intellectus_core"]
    if Core then Core.unblock_ip(args.ip, "Admin " .. sess.op_name) end
    return true, { unblocked_ip=args.ip }

  elseif cmd == "whitelistip" then
    local ok2, err2 = require_arg(args, "ip") if not ok2 then return false, nil, err2 end
    local FW = package.loaded["intellectus.intellectus_firewall"]
    if FW then FW.whitelist_ip(args.ip, "Admin " .. sess.op_name) end
    return true, { whitelisted_ip=args.ip }

  elseif cmd == "scan" then
    local SC = package.loaded["intellectus.intellectus_scanner"]
    local result = SC and SC.analyze_all() or {}
    return true, { scan_complete=true, results=#result }

  elseif cmd == "blockedips" then
    local Core = package.loaded["intellectus.intellectus_core"]
    return true, Core and Core.get_blocked_ips() or {}

  elseif cmd == "threats" then
    local Core = package.loaded["intellectus.intellectus_core"]
    return true, Core and Core.get_threats(args.niveau_min or 1) or {}

  elseif cmd == "audit" then
    local Audit = package.loaded["intellectus.intellectus_audit"]
    return true, Audit and Audit.get(args.limit or 100, {
      player_id=args.joueur, critical_only=args.critical
    }) or {}

  -- ── FUN ───────────────────────────────────────────────────────────────────
  elseif cmd == "slap" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local force = math.min(args.force or 5, 20)
    notify_player(args.player_id, "FX_SLAP", { force=force, by=sess.op_name })
    notify_all("CHAT_SERVER", { msg=string.format("⚡ %s a mis une claque à %s (force %d/20)!",
      sess.op_name, args.player_id:sub(1,8), force) })
    Events.emit("troxtworld:fx_slap", { player_id=args.player_id, force=force, sig=SIG })
    return true, { slapped=args.player_id, force=force }

  elseif cmd == "freeze" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    _frozen[args.player_id] = true
    notify_player(args.player_id, "FX_FREEZE", { by=sess.op_name })
    notify_all("CHAT_SERVER", { msg=string.format("❄️ %s est maintenant gelé!", args.player_id:sub(1,8)) })
    Events.emit("troxtworld:fx_freeze", { player_id=args.player_id, sig=SIG })
    return true, { frozen=args.player_id }

  elseif cmd == "unfreeze" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    _frozen[args.player_id] = nil
    notify_player(args.player_id, "FX_UNFREEZE", { by=sess.op_name })
    return true, { unfrozen=args.player_id }

  elseif cmd == "dance" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local style = args.style or "shuffle"
    local valid = { salsa=true, robot=true, shuffle=true, twerk=true }
    if not valid[style] then return false, nil, "Style invalide — salsa|robot|shuffle|twerk" end
    notify_player(args.player_id, "FX_DANCE", { style=style, by=sess.op_name })
    notify_all("CHAT_SERVER", { msg=string.format("💃 %s danse le %s!", args.player_id:sub(1,8), style) })
    Events.emit("troxtworld:fx_dance", { player_id=args.player_id, style=style, sig=SIG })
    return true, { dancing=args.player_id, style=style }

  elseif cmd == "emote" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "emote") if not ok3 then return false, nil, err3 end
    notify_player(args.player_id, "FX_EMOTE", { emote=args.emote, by=sess.op_name })
    Events.emit("troxtworld:fx_emote", { player_id=args.player_id, emote=args.emote, sig=SIG })
    return true, { emoted=args.player_id, emote=args.emote }

  elseif cmd == "announce" then
    local ok2, err2 = require_arg(args, "message") if not ok2 then return false, nil, err2 end
    notify_all("HUD_ANNOUNCE", { msg=args.message, by=sess.op_name, duration=args.duree or 8 })
    Events.emit("troxtworld:admin_announce", { message=args.message, by=sess.op_id, sig=SIG })
    return true, { announced=true, message=args.message }

  elseif cmd == "broadcast" then
    local ok2, err2 = require_arg(args, "message") if not ok2 then return false, nil, err2 end
    notify_all("CHAT_SERVER", { msg="📻 [" .. sess.op_name .. "]: " .. args.message })
    Events.emit("troxtworld:admin_broadcast", { message=args.message, by=sess.op_id, sig=SIG })
    return true, { broadcast=true }

  elseif cmd == "hud" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local ok3, err3 = require_arg(args, "message") if not ok3 then return false, nil, err3 end
    local dur = args.duree_sec or 5
    if args.player_id == "all" then
      notify_all("HUD_MESSAGE", { msg=args.message, duration=dur, by=sess.op_name })
    else
      notify_player(args.player_id, "HUD_MESSAGE", { msg=args.message, duration=dur, by=sess.op_name })
    end
    return true, { hud_sent=true, target=args.player_id, message=args.message }

  elseif cmd == "fireworks" then
    local target = args.player_id or "all"
    local dur    = args.duree_sec or 10
    if target == "all" then
      notify_all("FX_FIREWORKS", { duration=dur, by=sess.op_name })
    else
      notify_player(target, "FX_FIREWORKS", { duration=dur, by=sess.op_name })
    end
    Events.emit("troxtworld:fx_fireworks", { target=target, duration=dur, sig=SIG })
    return true, { fireworks=true, target=target, duration=dur }

  elseif cmd == "earthquake" then
    local intensity = math.min(args.intensite or 5, 10)
    local dur       = args.duree_sec or 8
    notify_all("FX_EARTHQUAKE", { intensity=intensity, duration=dur, by=sess.op_name })
    Events.emit("troxtworld:fx_earthquake", { intensity=intensity, duration=dur, sig=SIG })
    return true, { earthquake=true, intensity=intensity, duration=dur }

  elseif cmd == "flip" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    notify_player(args.player_id, "FX_FLIP", { duration=5, by=sess.op_name })
    notify_all("CHAT_SERVER", { msg=string.format("🔃 %s est retourné à l'envers!", args.player_id:sub(1,8)) })
    Events.emit("troxtworld:fx_flip", { player_id=args.player_id, sig=SIG })
    return true, { flipped=args.player_id }

  elseif cmd == "supersize" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local scale = math.max(0.1, math.min(args.scale or 3.0, 10.0))
    notify_player(args.player_id, "FX_SCALE", { scale=scale, by=sess.op_name })
    notify_all("CHAT_SERVER", { msg=string.format("🦣 %s est maintenant %.1f× sa taille!",
      args.player_id:sub(1,8), scale) })
    Events.emit("troxtworld:fx_scale", { player_id=args.player_id, scale=scale, sig=SIG })
    return true, { resized=args.player_id, scale=scale }

  elseif cmd == "mini" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    notify_player(args.player_id, "FX_SCALE", { scale=0.1, by=sess.op_name })
    notify_all("CHAT_SERVER", { msg=string.format("🐭 %s est devenu microscopique!", args.player_id:sub(1,8)) })
    Events.emit("troxtworld:fx_scale", { player_id=args.player_id, scale=0.1, sig=SIG })
    return true, { minified=args.player_id }

  elseif cmd == "drunk" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    local dur = args.duree_sec or 60
    _effects[args.player_id] = { type="drunk", expires_at=os.time()+dur }
    notify_player(args.player_id, "FX_DRUNK", { duration=dur, by=sess.op_name })
    notify_all("CHAT_SERVER", { msg=string.format("🍺 %s a l'air de trop avoir bu!", args.player_id:sub(1,8)) })
    Events.emit("troxtworld:fx_drunk", { player_id=args.player_id, duration=dur, sig=SIG })
    return true, { drunk=args.player_id, duration=dur }

  elseif cmd == "spaghetti" then
    local ok2, err2 = require_arg(args, "player_id") if not ok2 then return false, nil, err2 end
    _effects[args.player_id] = { type="spaghetti", expires_at=os.time()+30 }
    notify_player(args.player_id, "FX_SPAGHETTI", { by=sess.op_name })
    notify_all("CHAT_SERVER", { msg=string.format("🍝 %s marche comme un spaghetti mouillé!",
      args.player_id:sub(1,8)) })
    Events.emit("troxtworld:fx_spaghetti", { player_id=args.player_id, sig=SIG })
    return true, { spaghetti=args.player_id }

  elseif cmd == "matrix" then
    local dur = args.duree_sec or 15
    notify_all("FX_MATRIX", { duration=dur, by=sess.op_name })
    Events.emit("troxtworld:fx_matrix", { duration=dur, sig=SIG })
    return true, { matrix=true, duration=dur }

  elseif cmd == "rain_cash" then
    local zone   = args.zone_id or "centre_ville"
    local amount = args.montant_par_joueur or 500
    Events.emit("troxtworld:admin_rain_cash", { zone_id=zone, amount=amount, by=sess.op_id, sig=SIG })
    notify_all("FX_RAIN_CASH", { zone=zone, amount=amount })
    notify_all("CHAT_SERVER", { msg=string.format("💸 Il pleut %dT$ dans %s! Courez vite!", amount, zone) })
    return true, { rain_cash=true, zone=zone, amount=amount }

  elseif cmd == "wanted_hunt" then
    local prime = args.prime or 10000
    Events.emit("troxtworld:admin_wanted_hunt", { prime=prime, by=sess.op_id, sig=SIG })
    notify_all("HUD_ANNOUNCE", {
      msg=string.format("🏴‍☠️ CHASSE AUX WANTED! Prime: %dT$ pour le plus recherché!", prime),
      duration=10,
    })
    return true, { hunt_started=true, prime=prime }

  elseif cmd == "nuke_zone" then
    local ok2, err2 = require_arg(args, "zone_id") if not ok2 then return false, nil, err2 end
    notify_all("FX_EXPLOSION", { zone=args.zone_id })
    Events.emit("troxtworld:admin_kick_room", { room_id=args.zone_id, reason="Zone nuke", sig=SIG })
    notify_all("CHAT_SERVER", { msg=string.format("☢️ La zone %s vient d'être nuquée!", args.zone_id) })
    return true, { nuked=args.zone_id }

  elseif cmd == "police_raid" then
    local ok2, err2 = require_arg(args, "zone_id") if not ok2 then return false, nil, err2 end
    Events.emit("troxtworld:admin_police_raid", { zone_id=args.zone_id, by=sess.op_id, sig=SIG })
    notify_all("HUD_ANNOUNCE", {
      msg="🚨 RAID DE POLICE en cours dans " .. args.zone_id .. "! Tout le monde à terre!",
      duration=8,
    })
    return true, { raid=args.zone_id }

  elseif cmd == "chaos" then
    local dur = args.duree_sec or 120
    Events.emit("troxtworld:admin_chaos", { duration=dur, by=sess.op_id, sig=SIG })
    notify_all("HUD_ANNOUNCE", { msg="😈 MODE CHAOS ACTIVÉ! " .. dur .. " secondes de folie!", duration=10 })
    notify_all("FX_CHAOS", { duration=dur })
    return true, { chaos=true, duration=dur }

  elseif cmd == "disco" then
    local ok2, err2 = require_arg(args, "zone_id") if not ok2 then return false, nil, err2 end
    local dur = args.duree_sec or 60
    Events.emit("troxtworld:admin_disco", { zone_id=args.zone_id, duration=dur, sig=SIG })
    notify_all("FX_DISCO", { zone=args.zone_id, duration=dur })
    notify_all("CHAT_SERVER", { msg=string.format("🪩 DISCO TIME dans %s! %ds de groove!", args.zone_id, dur) })
    return true, { disco=args.zone_id, duration=dur }

  elseif cmd == "gravity" then
    local raw = tonumber(args.gravity or args.value)
    if not raw then return false, nil, "Valeur de gravité requise (0.1 à 3.0)" end
    local g = math.max(0.1, math.min(raw, 3.0))
    Events.emit("troxtworld:admin_gravity", { gravity=g, by=sess.op_id, sig=SIG })
    notify_all("WORLD_GRAVITY", { gravity=g })
    notify_all("CHAT_SERVER", {
      msg=string.format("🌌 Gravité changée à %.1f× (%s)",
        g, g < 1 and "mode lune 🌙" or g > 1.5 and "mode planète lourde 🪐" or "normale")
    })
    return true, { gravity=g }

  elseif cmd == "teleportall" then
    local ok2, err2 = require_arg(args, "zone_id") if not ok2 then return false, nil, err2 end
    Events.emit("troxtworld:admin_tp_all", { zone_id=args.zone_id, by=sess.op_id, sig=SIG })
    notify_all("TELEPORT_ZONE", { zone_id=args.zone_id, by=sess.op_name })
    notify_all("CHAT_SERVER", { msg=string.format("🌀 Tout le monde est téléporté vers %s!", args.zone_id) })
    return true, { teleported_all_to=args.zone_id }

  else
    return false, nil, "Commande non implémentée: " .. cmd
  end
end

-- ─── CHECKS ACTIFS ───────────────────────────────────────────────────────────
function Admin.is_banned(player_id)
  local ban = _bans[player_id]
  if not ban then return false end
  if not ban.permanent and ban.expires_at and os.time() > ban.expires_at then
    _bans[player_id] = nil
    return false
  end
  return true, ban
end

function Admin.is_muted(player_id)
  local mute = _mutes[player_id]
  if not mute then return false end
  if os.time() > mute.expires_at then _mutes[player_id] = nil return false end
  return true, mute
end

function Admin.is_jailed(player_id)
  local jail = _jails[player_id]
  if not jail then return false end
  if os.time() > jail.expires_at then _jails[player_id] = nil return false end
  return true, jail
end

function Admin.is_frozen(player_id)    return _frozen[player_id] == true end
function Admin.has_god(player_id)      return _god_modes[player_id] == true end
function Admin.is_invisible(player_id) return _invisibles[player_id] == true end

function Admin.get_effect(player_id)
  local e = _effects[player_id]
  if not e then return nil end
  if os.time() > e.expires_at then _effects[player_id] = nil return nil end
  return e
end

-- Enregistrer un message chat pour le chatlog
function Admin.log_chat(player_id, username, content, chat_type)
  table.insert(_chat_log, 1, {
    player_id=player_id, username=username,
    content=content, type=chat_type,
    ts=os.time(), date=os.date("%H:%M:%S"),
  })
  if #_chat_log > 500 then table.remove(_chat_log) end
end

-- ─── RAPPORT ─────────────────────────────────────────────────────────────────
function Admin.generate_report()
  local Core    = package.loaded["intellectus.intellectus_core"]
  local Auth    = package.loaded["intellectus.intellectus_auth"]
  local FW      = package.loaded["intellectus.intellectus_firewall"]
  local Scanner = package.loaded["intellectus.intellectus_scanner"]
  local Audit   = package.loaded["intellectus.intellectus_audit"]

  return {
    sig=SIG, troxt=TROXT, version=VERSION,
    generated_at=os.date("%Y-%m-%d %H:%M:%S"),
    admin = {
      operators  = count_keys(_operators),
      sessions   = (function()
        local n=0
        for _, s in pairs(_sessions) do if s.active then n=n+1 end end
        return n
      end)(),
      stats      = _stats,
      active_bans    = count_keys(_bans),
      active_mutes   = count_keys(_mutes),
      active_jails   = count_keys(_jails),
      god_modes      = count_keys(_god_modes),
      frozen         = count_keys(_frozen),
      commands_total = count_keys(COMMANDS),
    },
    security = Core    and Core.get_report()   or {},
    auth     = Auth    and Auth.get_stats()    or {},
    firewall = FW      and FW.get_stats()      or {},
    scanner  = Scanner and Scanner.get_stats() or {},
    audit    = Audit   and Audit.get_stats()   or {},
  }
end

-- ─── STATS ───────────────────────────────────────────────────────────────────
function Admin.get_stats() return _stats end

function Admin.get_cmd_history(n)
  local r = {}
  for i=1, math.min(n or 50, #_cmd_history) do r[#r+1] = _cmd_history[i] end
  return r
end

function Admin.get_active_sessions()
  local r={}
  local now=os.time()
  for id, s in pairs(_sessions) do
    if s.active and now < s.expires_at then
      r[#r+1] = {
        id=id, op_name=s.op_name, role=s.role, ip=s.ip,
        opened_at=os.date("%H:%M:%S", s.opened_at),
        commands=s.commands, expires_in=s.expires_at-now,
      }
    end
  end
  return r
end

function Admin.get_bans()           return _bans end
function Admin.get_mutes()          return _mutes end
function Admin.get_jails()          return _jails end
function Admin.get_commands()       return COMMANDS end
function Admin.get_access_levels()  return ACCESS end
function Admin.get_signature()      return SIG end

-- ─── INIT ─────────────────────────────────────────────────────────────────────
function Admin.init()
  -- Charger opérateurs et bans persistants
  local saved = Memory.list("intellectus")
  local has_op = false
  for _, e in ipairs(saved) do
    if e.key:match("^intellectus:operator:") then
      has_op = true
      local op = Memory.get(e.key)
      if op then _operators[op.id or e.key:match("OP%-%d+")] = op end
    end
  end

  local bans = Memory.list("admin")
  for _, e in ipairs(bans) do
    if e.key:match("^admin:ban:") then
      local pid = e.key:match("^admin:ban:(.+)$")
      local ban = Memory.get(e.key)
      if ban and (ban.permanent or (ban.expires_at and os.time() < ban.expires_at)) then
        _bans[pid] = ban
      end
    end
  end

  if not has_op then
    local id, tmp = Admin.create_operator("TroxtAdmin", "root", SIG)
    log("WARN", "Opérateur ROOT créé — changez le mot de passe!", { op_id=id, temp=tmp })
  end

  log("OK", string.format("[%s] Admin v%s — %d opérateurs — %d commandes — %d bans actifs",
    SIG, VERSION, count_keys(_operators), count_keys(COMMANDS), count_keys(_bans)))

  Events.emit("intellectus:admin_ready", {
    version=VERSION, commands=count_keys(COMMANDS), sig=SIG,
  })
end

Admin.init()
return Admin

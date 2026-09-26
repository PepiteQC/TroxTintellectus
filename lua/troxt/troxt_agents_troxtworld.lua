--[[
══════════════════════════════════════════════════════════════════════
  TROXT_AGENTS_TROXTWORLD.LUA — Registre officiel des agents TroxtWorld
  Registre officiel des agents TroxtWorld — remplace tout ancien registre.

  Modules TroxtWorld :
    → TroxtForge     — Atelier 3D, construction, export assets
    → TroxtPrism     — Base de données RP, joueurs, économie
    → TroxtWeave     — Générateur de textures procédurales
    → TroxtLens      — Analyse visuelle, OCR, rapports
    → TroxtEngine    — Serveur de jeu, monde 3D, WebSocket
    → Intellectus    — Sécurité, protection, surveillance

  Chemin : lua/troxt/troxt_agents_troxtworld.lua
══════════════════════════════════════════════════════════════════════
]]

local Agents = {}
local Events = require("troxt.troxt_events")

-- ─── REGISTRE TROXTWORLD ──────────────────────────────────────────────────────
local REGISTRY = {

  troxtforge = {
    id            = "troxtforge",
    name          = "TroxtForge",
    icon          = "⚒️",
    color         = "#c9a84c",
    role          = "Atelier 3D de TroxtWorld — Construction, sculpture et export d'assets 3D. Contrôlé par TROXT.",
    tier          = "CORE",
    is_critical   = true,
    api_base      = "http://localhost:4100",
    health_path   = "/api/platforms",
    ping_interval = 5,
    tasks = {
      "Maintenir la cohérence de la scène 3D TroxtWorld — zéro platform orpheline autorisée",
      "Valider chaque export GLTF/GLB avec checksum SHA-256 avant livraison",
      "Synchroniser les platforms avec le world_state en moins de 200ms",
      "Garantir l'unicité des IDs de platforms (UUID v4 vérifié côté serveur)",
      "Exécuter l'auto-save du world_state toutes les 60 secondes sans exception",
      "Appliquer le LOD automatique sur les géométries haute-poly avant export",
      "Notifier TROXT de chaque ajout, modification ou suppression de platform en temps réel",
      "Maintenir le matériau PBR par défaut pour chaque nouvel asset créé",
    },
    critical_fields = { "platforms", "world_state", "snapshots", "assets", "materials" },
    thresholds = {
      max_platforms      = 50000,
      max_offline_sec    = 30,
      auto_save_interval = 60,
      max_asset_mb       = 50,
    },
    status      = "unknown",
    last_seen   = nil,
    error_count = 0,
    task_queue  = {},
    metrics     = { pings=0, failures=0, avg_response_ms=0, platforms_count=0 },
  },

  troxtprism = {
    id            = "troxtprism",
    name          = "TroxtPrism",
    icon          = "🗄️",
    color         = "#7dd3fc",
    role          = "Gestionnaire de base de données RP — Joueurs, véhicules, maisons, emplois, factions, inventaire, banque.",
    tier          = "CORE",
    is_critical   = true,
    api_base      = "http://localhost:4100/api/prism",
    health_path   = "/tables",
    ping_interval = 5,
    tasks = {
      "Maintenir l'intégrité référentielle de toutes les tables RP TroxtWorld",
      "Exécuter toutes les opérations CRUD en moins de 50ms par requête",
      "Valider les relations entre entités : joueurs ↔ véhicules ↔ propriétés ↔ factions",
      "Prévenir toute corruption de données avant qu'elle se produise (contraintes DB strictes)",
      "Synchroniser les soldes bancaires en temps réel avec latence < 100ms",
      "Logger chaque transaction financière avec signature TROXT et timestamp immuable",
      "Archiver les snapshots de l'état RP toutes les 300 secondes",
      "Alerter TROXT immédiatement si une table dépasse 80% de sa capacité prévue",
    },
    critical_fields = { "players", "bank_accounts", "inventory", "vehicles", "factions", "properties" },
    thresholds = {
      max_query_ms    = 50,
      max_error_rate  = 2,
      max_offline_sec = 30,
      snapshot_interval = 300,
    },
    status      = "unknown",
    last_seen   = nil,
    error_count = 0,
    task_queue  = {},
    metrics     = { pings=0, failures=0, avg_response_ms=0, total_players=0 },
  },

  troxtweave = {
    id            = "troxtweave",
    name          = "TroxtWeave",
    icon          = "🧵",
    color         = "#a78bfa",
    role          = "Générateur de textures procédurales — Bruit, Voronoi, tiling seamless, export PNG/WebP.",
    tier          = "SUPPORT",
    is_critical   = false,
    api_base      = nil,
    health_path   = nil,
    ping_interval = 60,
    tasks = {
      "Générer des textures seamless sans artéfact visible aux 4 bords (test de continuité obligatoire)",
      "Valider tous les paramètres Voronoi : seed entier valide, fréquence 0.01–100.0, amplitude 0.0–1.0",
      "Compresser les exports PNG/WebP sous 500KB par défaut, avertir TROXT si dépassement",
      "Maintenir le système de layers sans fuite mémoire — maximum 32 layers actifs simultanément",
      "Inclure les métadonnées JSON (seed, params, preview base64) dans chaque export texture",
      "Supporter les formats de sortie : PNG, WebP, EXR (HDR), KTX2 (GPU-ready)",
      "Notifier TROXT si une texture dépasse 2MB après compression",
    },
    critical_fields = { "layers", "noise_params", "export_queue", "preview_cache" },
    thresholds = {
      max_texture_kb  = 500,
      max_layers      = 32,
      max_offline_sec = 300,
      max_texture_mb_warn = 2,
    },
    status      = "standby",
    last_seen   = nil,
    error_count = 0,
    task_queue  = {},
    metrics     = { pings=0, failures=0, textures_generated=0 },
  },

  troxtlens = {
    id            = "troxtlens",
    name          = "TroxtLens",
    icon          = "🔬",
    color         = "#34d399",
    role          = "Œil analytique de TROXT — Détection d'objets, OCR, mesures précises, rapports PDF/JSON.",
    tier          = "SUPPORT",
    is_critical   = false,
    api_base      = nil,
    health_path   = nil,
    ping_interval = 60,
    tasks = {
      "Scanner les scènes 3D TroxtWorld pour détecter les anomalies visuelles (objets hors limites, overlaps)",
      "Exécuter l'OCR sur les assets texte importés avec précision minimale de 95%",
      "Mesurer les dimensions précises de chaque objet 3D : bounding box, volume, surface",
      "Générer des rapports PDF/JSON complets après chaque analyse en moins de 5 secondes",
      "Alerter TROXT si une cible visuelle dévie du référentiel de plus de 5%",
      "Archiver tous les scans dans la mémoire TROXT avec timestamp et hash de scène",
      "Supporter l'analyse en temps réel des streams vidéo TroxtWorld (30fps minimum)",
    },
    critical_fields = { "scan_queue", "detection_results", "report_cache", "stream_buffer" },
    thresholds = {
      min_ocr_accuracy = 0.95,
      max_report_sec   = 5,
      max_offline_sec  = 300,
      min_fps_stream   = 30,
    },
    status      = "standby",
    last_seen   = nil,
    error_count = 0,
    task_queue  = {},
    metrics     = { pings=0, failures=0, scans_done=0, reports_generated=0 },
  },

  troxtengine = {
    id            = "troxtengine",
    name          = "TroxtEngine",
    icon          = "🎮",
    color         = "#f97316",
    role          = "Serveur de jeu TroxtWorld — Joueurs en ligne, monde 3D, WebSocket multiplayer, génération de monde.",
    tier          = "CORE",
    is_critical   = true,
    api_base      = "http://localhost:4100",
    health_path   = "/api/admin/metrics",
    ping_interval = 5,
    tasks = {
      "Maintenir les connexions WebSocket stables pour tous les joueurs TroxtWorld (latence < 50ms)",
      "Synchroniser les positions et états des joueurs 20 fois par seconde",
      "Valider chaque platform avant insertion dans le monde (UUID + bounds check + permission owner)",
      "Exécuter l'auto-save du world state toutes les 60 secondes",
      "Détecter et déconnecter proprement les joueurs inactifs depuis plus de 30 secondes",
      "Limiter le nombre de platforms par joueur : 500 par session, 5000 au total",
      "Logger toutes les actions admin avec signature TROXT et IP source",
      "Générer les chunks du monde de façon procédurale sans collision de seed",
      "Notifier TROXT de chaque connexion et déconnexion de joueur en temps réel",
    },
    critical_fields = { "players", "platforms", "ws_connections", "world_state", "chunks" },
    thresholds = {
      max_latency_ms   = 50,
      max_offline_sec  = 15,
      sync_rate_hz     = 20,
      max_players      = 500,
      max_platforms    = 5000,
    },
    status      = "unknown",
    last_seen   = nil,
    error_count = 0,
    task_queue  = {},
    metrics     = {
      pings=0, failures=0, avg_response_ms=0,
      players_online=0, platforms_count=0, ws_connections=0,
    },
  },

  intellectus = {
    id            = "intellectus",
    name          = "Intellectus",
    icon          = "🛡️",
    color         = "#f87171",
    role          = "Couche de sécurité TroxtWorld — Détection d'intrusion, rate limiting, contrôle d'accès, analyse de menaces.",
    tier          = "CORE",
    is_critical   = true,
    api_base      = "http://localhost:4300",
    health_path   = "/intellectus/status",
    ping_interval = 3,
    tasks = {
      "Surveiller 100% des requêtes entrantes sur TroxtWorld (rate limit: 100 req/min par IP par défaut)",
      "Détecter et bloquer automatiquement les IPs suspectes en moins de 1 seconde",
      "Valider tous les tokens JWT : signature, expiration, correspondance IP",
      "Analyser les patterns d'accès anormaux : bots, brute force, DDoS, scan de ports",
      "Alerter TROXT immédiatement de toute menace de niveau 2 ou supérieur",
      "Maintenir la liste noire d'IPs synchronisée avec TROXT toutes les 30 secondes",
      "Auditer tous les accès aux endpoints admin et les logger avec signature TROXT",
      "Protéger les endpoints critiques de TroxtWorld contre les accès non autorisés",
      "Scanner les payloads entrants pour injection SQL, XSS, path traversal, RCE",
      "Générer un rapport de sécurité toutes les heures pour TROXT",
    },
    critical_fields = { "blocked_ips", "auth_tokens", "threat_log", "rate_limits", "audit_log" },
    thresholds = {
      max_req_per_min     = 100,
      threat_level_alert  = 2,
      max_offline_sec     = 10,
      token_expiry_sec    = 86400,
      max_auth_failures   = 5,
    },
    status      = "unknown",
    last_seen   = nil,
    error_count = 0,
    task_queue  = {},
    metrics     = {
      pings=0, failures=0, avg_response_ms=0,
      threats_blocked=0, ips_blocked=0, tokens_active=0,
    },
  },
}

-- ─── ÉTAT INTERNE ────────────────────────────────────────────────────────────
local _agents         = {}
local _task_id_cnt    = 0
local _status_history = {}   -- [agentId] → { {ts, from, to, data}, ... }

-- ─── HELPERS ─────────────────────────────────────────────────────────────────
-- Compte les clés d'une table associative (au lieu de `#t` qui ne marche que sur les arrays)
local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- Tronque proprement une chaîne sans casser un caractère UTF-8
local function truncate_utf8(s, max_bytes)
  s = tostring(s or "")
  if #s <= max_bytes then return s end
  local cut = max_bytes
  while cut > 0 do
    local b = s:byte(cut + 1)
    if b and b < 0x80 then break end            -- ASCII
    if b and b >= 0xC0 then break end           -- début de séquence multi-octets
    cut = cut - 1                                -- octet de continuation (0x80-0xBF)
  end
  return s:sub(1, cut) .. "…"
end

-- Priorités de tâches (0 = plus urgent)
local PMAP = { critical=0, high=1, normal=2, low=3 }

-- ─── INIT ────────────────────────────────────────────────────────────────────
function Agents.init()
  _task_id_cnt = 0

  for id, def in pairs(REGISTRY) do
    local copy = {}
    for k, v in pairs(def) do copy[k] = v end
    copy.task_queue     = {}
    copy._last_ping_at  = nil
    _agents[id]         = copy
    _status_history[id] = {}
  end

  print(string.format("[TROXTWORLD] %d agents initialisés :", Agents.count()))
  for _, a in pairs(_agents) do
    print(string.format("  %s %s [%s] — %s", a.icon, a.name, a.tier, a.status))
  end
end

-- ─── GETTERS ─────────────────────────────────────────────────────────────────
function Agents.get(id)         return _agents[id] end
function Agents.get_all()       return _agents end
function Agents.get_registry()  return REGISTRY end

function Agents.count()         return count_keys(_agents) end

function Agents.count_by_status(status)
  local n = 0
  for _, a in pairs(_agents) do
    if a.status == status then n = n + 1 end
  end
  return n
end

function Agents.get_by_tier(tier)
  local result = {}
  for _, a in pairs(_agents) do
    if a.tier == tier then table.insert(result, a) end
  end
  return result
end

function Agents.get_active_ids()
  local ids = {}
  for id, a in pairs(_agents) do
    if a.status == "online" then table.insert(ids, id) end
  end
  return ids
end

function Agents.get_critical()
  local result = {}
  for _, a in pairs(_agents) do
    if a.is_critical then table.insert(result, a) end
  end
  return result
end

function Agents.get_summary()
  local summary = {}
  for id, a in pairs(_agents) do
    local silence = a.last_seen and (os.time() - a.last_seen) or nil
    summary[id] = {
      name          = a.name,
      icon          = a.icon,
      color         = a.color,
      tier          = a.tier,
      status        = a.status,
      is_critical   = a.is_critical,
      last_seen     = a.last_seen and os.date("%H:%M:%S", a.last_seen) or "jamais",
      silence_sec   = silence,
      error_count   = a.error_count,
      tasks_pending = #a.task_queue,
      metrics       = a.metrics,
    }
  end
  return summary
end

-- ─── STATUT ──────────────────────────────────────────────────────────────────
function Agents.set_status(id, status, data)
  local agent = _agents[id]
  if not agent then return end

  local old = agent.status
  agent.status = status

  -- Historique (garantir que la table existe avant d'insérer)
  _status_history[id] = _status_history[id] or {}
  table.insert(_status_history[id], 1, {
    ts   = os.time(),
    from = old,
    to   = status,
    data = data,
  })
  if #_status_history[id] > 50 then
    table.remove(_status_history[id])
  end

  if status == "online" then
    agent.last_seen   = os.time()
    agent.error_count = math.max(0, agent.error_count - 1)
    if old ~= "online" then
      Events.emit("troxtworld:agent_online", {
        id=id, name=agent.name, icon=agent.icon, color=agent.color,
      })
    end

  elseif status == "error" or status == "offline" then
    agent.error_count = agent.error_count + 1
    if agent.is_critical then
      Events.emit("troxtworld:agent_critical", {
        id=id, name=agent.name, icon=agent.icon, status=status,
        error_count=agent.error_count, data=data,
      })
    end

  elseif status == "RECOVERY" then
    Events.emit("troxtworld:agent_recovery", { id=id, name=agent.name })

  elseif status == "standby" then
    -- En développement — pas d'alerte
  end

  if old ~= status then
    Events.emit("troxtworld:agent_status", {
      id=id, name=agent.name, icon=agent.icon,
      old=old, new=status, data=data,
    })
  end
end

function Agents.report_seen(id, response_ms)
  local agent = _agents[id]
  if not agent then return end
  agent.last_seen = os.time()
  agent.metrics.pings = (agent.metrics.pings or 0) + 1
  if response_ms then
    local n   = agent.metrics.pings
    local avg = agent.metrics.avg_response_ms or 0
    agent.metrics.avg_response_ms = (avg * (n - 1) + response_ms) / n
  end
  Agents.set_status(id, "online")
end

function Agents.report_failure(id, reason)
  local agent = _agents[id]
  if not agent then return end
  agent.metrics.failures = (agent.metrics.failures or 0) + 1
  Agents.set_status(id, "error", { reason = reason })
  Events.emit("troxtworld:agent_ping_failed", {
    id=id, name=agent.name, icon=agent.icon, reason=reason,
  })
end

-- ─── TÂCHES ──────────────────────────────────────────────────────────────────
function Agents.assign_task(agent_id, description, priority, meta)
  local agent = _agents[agent_id]
  if not agent then
    return nil, "Agent TroxtWorld introuvable: " .. tostring(agent_id)
  end
  if type(description) ~= "string" or #description == 0 then
    return nil, "Description de tâche requise"
  end

  _task_id_cnt = _task_id_cnt + 1
  local task = {
    id          = string.format("TW-%06d", _task_id_cnt),
    agent_id    = agent_id,
    description = description,
    priority    = priority or "normal",
    status      = "pending",
    meta        = meta or {},
    created_at  = os.time(),
    started_at  = nil,
    done_at     = nil,
    retries     = 0,
  }

  table.insert(agent.task_queue, task)

  table.sort(agent.task_queue, function(a, b)
    return (PMAP[a.priority] or 2) < (PMAP[b.priority] or 2)
  end)

  Events.emit("troxtworld:task_assigned", {
    task_id     = task.id,
    agent_id    = agent_id,
    agent_name  = agent.name,
    agent_icon  = agent.icon,
    description = description,
    priority    = priority,
  })

  print(string.format("[%s] %s → Tâche %s [%s]: %s",
    agent.icon, agent.name, task.id, priority or "normal",
    truncate_utf8(description, 60)))

  return task
end

function Agents.complete_task(task_id)
  for id, agent in pairs(_agents) do
    for i, task in ipairs(agent.task_queue) do
      if task.id == task_id then
        task.status  = "completed"
        task.done_at = os.time()
        table.remove(agent.task_queue, i)
        Events.emit("troxtworld:task_done", {
          task_id    = task_id,
          agent_id   = id,
          agent_name = agent.name,
          duration   = task.done_at - (task.created_at or task.done_at),
        })
        return task
      end
    end
  end
  return nil
end

function Agents.fail_task(task_id, reason, retry)
  for id, agent in pairs(_agents) do
    for i, task in ipairs(agent.task_queue) do
      if task.id == task_id then
        if retry and task.retries < 3 then
          task.status     = "retry"
          task.retries    = task.retries + 1
          task.started_at = nil
          Events.emit("troxtworld:task_retry", {
            task_id=task_id, retry=task.retries, reason=reason,
          })
        else
          task.status      = "failed"
          task.done_at     = os.time()
          task.fail_reason = reason
          table.remove(agent.task_queue, i)
          Events.emit("troxtworld:task_failed", {
            task_id=task_id, agent_id=id, reason=reason,
          })
        end
        return task
      end
    end
  end
  return nil
end

function Agents.get_agent_tasks(agent_id)
  local agent = _agents[agent_id]
  if not agent then return {} end
  return agent.task_queue
end

-- ─── PING SCHEDULE ───────────────────────────────────────────────────────────
function Agents.get_due_pings()
  local due = {}
  local now = os.time()
  for _, agent in pairs(_agents) do
    if agent.api_base and agent.health_path then
      local last = agent._last_ping_at or 0
      if now - last >= agent.ping_interval then
        agent._last_ping_at = now
        table.insert(due, agent)
      end
    end
  end
  return due
end

-- ─── RAPPORT ─────────────────────────────────────────────────────────────────
function Agents.get_full_report()
  local report = {
    generated_at  = os.date("%Y-%m-%d %H:%M:%S"),
    total         = Agents.count(),
    online        = Agents.count_by_status("online"),
    offline       = Agents.count_by_status("error"),
    standby       = Agents.count_by_status("standby"),
    unknown       = Agents.count_by_status("unknown"),
    agents        = {},
  }

  for id, agent in pairs(_agents) do
    local silence = agent.last_seen and (os.time() - agent.last_seen) or nil
    report.agents[id] = {
      name          = agent.name,
      icon          = agent.icon,
      color         = agent.color,
      tier          = agent.tier,
      status        = agent.status,
      is_critical   = agent.is_critical,
      silence_sec   = silence,
      error_count   = agent.error_count,
      tasks_total   = #agent.tasks,
      tasks_pending = #agent.task_queue,
      metrics       = agent.metrics,
      health        = Agents.agent_health(id),
    }
  end

  return report
end

function Agents.agent_health(id)
  local agent = _agents[id]
  if not agent then return "UNKNOWN" end
  if agent.status == "standby" then return "STANDBY" end
  if agent.status ~= "online"  then return "DOWN" end
  if agent.error_count >= 10   then return "DEGRADED" end
  if agent.error_count >= 3    then return "WARNING" end
  local avg = agent.metrics and agent.metrics.avg_response_ms or 0
  if agent.thresholds and avg > (agent.thresholds.max_latency_ms or 100) * 2 then
    return "SLOW"
  end
  return "OK"
end

function Agents.get_status_history(id, limit)
  limit = limit or 10
  local hist = _status_history[id] or {}
  local result = {}
  for i = 1, math.min(limit, #hist) do
    table.insert(result, hist[i])
  end
  return result
end

function Agents.get_signature() return "TROXT⬡" end

return Agents
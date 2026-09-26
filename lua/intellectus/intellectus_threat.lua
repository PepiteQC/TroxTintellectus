--[[
══════════════════════════════════════════════════════════════════════
  🛡️INTELLECTUS⬡ — INTELLECTUS_THREAT.LUA
  Moteur d'analyse et classification des menaces TroxtWorld
  Détection · Scoring · Escalade · Réponse automatique · Intel

  Chemin : lua/intellectus/intellectus_threat.lua
══════════════════════════════════════════════════════════════════════
]]

local Threat = {}
local Events = require("troxt.troxt_events")
local Memory = require("troxt.troxt_memory")

local SIG   = "🛡️INTELLECTUS⬡"
local TROXT = "TROXT⬡"

local function log(level, msg, data)
  local icons = { INFO="ℹ", WARN="⚠", ERROR="✖", OK="✓", THREAT="⚔", CRITICAL="🔴" }
  print(string.format("[%s] %s [%s] %s",
    os.date("%H:%M:%S"), icons[level] or "·", SIG, msg))
  if data then
    for k, v in pairs(data) do print(string.format("   ↳ %s: %s", k, tostring(v))) end
  end
end

local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── TAXONOMIE ───────────────────────────────────────────────────────────────
local THREAT_TAXONOMY = {
  rate_limit_soft     = { level=1, label="Rate limit dépassé",       auto_block=false, notify_troxt=false, ttl=300   },
  ua_suspicious       = { level=1, label="User-agent suspect",        auto_block=false, notify_troxt=false, ttl=600   },
  param_probe         = { level=1, label="Sondage de paramètres",     auto_block=false, notify_troxt=false, ttl=600   },
  repeated_404        = { level=1, label="Erreurs 404 répétées",      auto_block=false, notify_troxt=false, ttl=300   },
  auth_failure        = { level=2, label="Échec d'authentification",  auto_block=false, notify_troxt=true,  ttl=900   },
  rate_limit_hard     = { level=2, label="Rate limit sévère",         auto_block=true,  notify_troxt=true,  ttl=1800, block_dur=1800  },
  repeated_403        = { level=2, label="Accès refusés répétés",     auto_block=false, notify_troxt=true,  ttl=600   },
  header_anomaly      = { level=2, label="Anomalie d'en-têtes HTTP",  auto_block=false, notify_troxt=true,  ttl=900   },
  token_invalid       = { level=2, label="Token invalide",            auto_block=false, notify_troxt=true,  ttl=600   },
  mass_scan           = { level=3, label="Scan massif d'endpoints",   auto_block=true,  notify_troxt=true,  ttl=3600, block_dur=3600  },
  ua_rotation         = { level=3, label="Rotation de user-agents",   auto_block=true,  notify_troxt=true,  ttl=1800, block_dur=3600  },
  xss_attempt         = { level=3, label="Tentative XSS",             auto_block=true,  notify_troxt=true,  ttl=86400, block_dur=7200  },
  path_traversal      = { level=3, label="Path traversal",            auto_block=true,  notify_troxt=true,  ttl=86400, block_dur=7200  },
  credential_stuffing = { level=3, label="Credential stuffing",       auto_block=true,  notify_troxt=true,  ttl=7200, block_dur=7200  },
  high_error_rate     = { level=3, label="Taux d'erreur anormal",     auto_block=false, notify_troxt=true,  ttl=1800  },
  sql_injection       = { level=4, label="Injection SQL",             auto_block=true,  notify_troxt=true,  ttl=604800, block_dur=86400 },
  rce_attempt         = { level=4, label="Tentative RCE",             auto_block=true,  notify_troxt=true,  ttl=604800, block_dur=86400 },
  admin_brute_force   = { level=4, label="Brute force admin",         auto_block=true,  notify_troxt=true,  ttl=604800, block_dur=86400 },
  token_forge         = { level=4, label="Falsification de token",    auto_block=true,  notify_troxt=true,  ttl=604800, block_dur=86400 },
  data_exfil          = { level=4, label="Tentative d'exfiltration",  auto_block=true,  notify_troxt=true,  ttl=604800, block_dur=86400 },
  ddos                = { level=5, label="Attaque DDoS",              auto_block=true,  notify_troxt=true,  ttl=nil,   block_dur=604800 },
  coordinated_attack  = { level=5, label="Attaque coordonnée",        auto_block=true,  notify_troxt=true,  ttl=nil,   block_dur=604800 },
  infrastructure_attack = { level=5, label="Attaque infrastructure",  auto_block=true,  notify_troxt=true,  ttl=nil,   block_dur=nil      },
}

local AUTO_RESPONSES = {
  [1] = { name="SURVEILLANCE", actions={"log", "increment_score"} },
  [2] = { name="ALERTE",       actions={"log", "increment_score", "notify_troxt", "increase_monitoring"} },
  [3] = { name="RESTRICTION",  actions={"log", "increment_score", "notify_troxt", "block_auto", "rate_throttle"} },
  [4] = { name="ISOLATION",    actions={"log", "increment_score", "notify_troxt", "block_permanent_candidate", "audit_entry", "alert_admin"} },
  [5] = { name="CONFINEMENT",  actions={"log", "increment_score", "notify_troxt", "block_permanent", "audit_entry", "alert_admin", "emergency_mode", "escalate_cascade"} },
}

-- ─── ÉTAT ────────────────────────────────────────────────────────────────────
local _threats       = {}
local _intel         = {}
local _active_alerts = {}
local _blocked       = {}
local _threat_log    = {}
local _global_threat_level = 0

local _stats = {
  total_threats_detected = 0,
  by_level               = { [1]=0, [2]=0, [3]=0, [4]=0, [5]=0 },
  auto_blocks            = 0,
  escalations_to_troxt   = 0,
  false_positives        = 0,
  ips_under_watch        = 0,
}

local LEVEL_SCORE = { [1]=5, [2]=15, [3]=35, [4]=80, [5]=200 }

local function get_or_create_profile(ip)
  if not _threats[ip] then
    _threats[ip] = {
      ip=ip, first_seen=os.time(), last_seen=os.time(),
      score=0, max_level=0, threat_types={},
      blocked=false, block_count=0, notes={}, sig=SIG,
    }
    _stats.ips_under_watch = _stats.ips_under_watch + 1
  end
  return _threats[ip]
end

-- ─── DÉTECTER ────────────────────────────────────────────────────────────────
function Threat.detect(ip, threat_type, context)
  if type(ip) ~= "string" or #ip == 0 then return nil end

  local def = THREAT_TAXONOMY[threat_type]
  if not def then
    log("WARN", "Type de menace inconnu: " .. tostring(threat_type))
    return nil
  end

  local profile = get_or_create_profile(ip)
  local now     = os.time()
  local level   = def.level

  profile.last_seen = now
  profile.score     = math.min(1000, profile.score + (LEVEL_SCORE[level] or 5))
  profile.max_level = math.max(profile.max_level, level)
  profile.threat_types[threat_type] = (profile.threat_types[threat_type] or 0) + 1

  local entry = {
    ip=ip, type=threat_type, label=def.label, level=level,
    score=profile.score, context=context or {},
    ts=now, date=os.date("%H:%M:%S"), sig=SIG,
  }
  table.insert(_threat_log, 1, entry)
  if #_threat_log > 2000 then table.remove(_threat_log) end

  _stats.total_threats_detected = _stats.total_threats_detected + 1
  _stats.by_level[level] = (_stats.by_level[level] or 0) + 1

  log(level >= 4 and "CRITICAL" or level >= 3 and "WARN" or "INFO",
    string.format("MENACE niv.%d — %s | %s | Score: %d",
      level, def.label, ip, profile.score), context)

  local response = AUTO_RESPONSES[level]
  if response then
    Threat._execute_response(ip, profile, def, response, entry)
  end

  Events.emit("intellectus:threat_detected", {
    ip=ip, type=threat_type, label=def.label, level=level,
    score=profile.score, context=context, sig=SIG, troxt=TROXT,
  })

  return entry
end

function Threat._execute_response(ip, profile, def, response, entry)
  for _, action in ipairs(response.actions) do
    if action == "notify_troxt" and def.notify_troxt then
      _stats.escalations_to_troxt = _stats.escalations_to_troxt + 1
      Events.emit("troxt:security_alert", {
        source=SIG, ip=ip, threat=entry.type, label=def.label,
        level=def.level, score=profile.score, action=response.name,
        sig=SIG, troxt=TROXT,
      })

    elseif action == "block_auto" and def.auto_block and not profile.blocked then
      Threat.block(ip, def.label .. " (auto)", def.block_dur or 3600, def.level)

    elseif action == "block_permanent" and def.auto_block then
      Threat.block(ip, def.label .. " (permanent)", nil, def.level)

    elseif action == "block_permanent_candidate" then
      table.insert(profile.notes, {
        note="Candidat blocage permanent", at=os.time(), type=entry.type,
      })

    elseif action == "alert_admin" then
      table.insert(_active_alerts, 1, {
        ip=ip, type=entry.type, label=def.label,
        level=def.level, score=profile.score, at=os.time(), sig=SIG,
      })
      if #_active_alerts > 100 then table.remove(_active_alerts) end
      Events.emit("intellectus:admin_alert", {
        ip=ip, type=entry.type, level=def.level, sig=SIG,
      })

    elseif action == "emergency_mode" then
      _global_threat_level = math.max(_global_threat_level, def.level)
      Events.emit("intellectus:emergency_mode", {
        level=def.level, ip=ip, sig=SIG, troxt=TROXT,
      })
      log("CRITICAL", "MODE URGENCE — Niveau " .. def.level .. " — " .. ip)

    elseif action == "escalate_cascade" then
      Events.emit("troxt:cascade_alert", {
        source=SIG, ip=ip, level=def.level, sig=SIG, troxt=TROXT,
      })
    end
  end
end

-- ─── BLOQUER ─────────────────────────────────────────────────────────────────
function Threat.block(ip, reason, duration_sec, level)
  if type(ip) ~= "string" or #ip == 0 then return false, "IP invalide" end

  local profile = get_or_create_profile(ip)
  profile.blocked     = true
  profile.block_count = profile.block_count + 1

  _blocked[ip] = {
    ip=ip, reason=reason, level=level or profile.max_level,
    blocked_at=os.time(),
    expires_at=duration_sec and (os.time() + duration_sec) or nil,
    permanent=duration_sec == nil,
    count=profile.block_count, sig=SIG,
  }

  _stats.auto_blocks = _stats.auto_blocks + 1

  local opts = duration_sec and { ttl = duration_sec + 60 } or {}
  Memory.set("threat:blocked:" .. ip, _blocked[ip], opts)

  log("CRITICAL",
    string.format("IP BLOQUÉE — %s | %s | %s",
      ip, reason,
      duration_sec and (math.floor(duration_sec/60) .. "min") or "PERMANENT"))

  Events.emit("intellectus:ip_blocked", {
    ip=ip, reason=reason, level=level,
    duration=duration_sec, sig=SIG, troxt=TROXT,
  })
  return true
end

function Threat.unblock(ip, reason)
  if not _blocked[ip] then return false, "IP non bloquée" end
  local profile = _threats[ip]
  if profile then profile.blocked = false end
  _blocked[ip] = nil
  Memory.delete("threat:blocked:" .. ip)
  Events.emit("intellectus:ip_unblocked", { ip=ip, reason=reason, sig=SIG })
  log("OK", string.format("IP débloquée — %s (%s)", ip, reason or "manuel"))
  return true
end

function Threat.is_blocked(ip)
  local block = _blocked[ip]
  if not block then return false end
  if not block.permanent and block.expires_at and os.time() > block.expires_at then
    Threat.unblock(ip, "expiration automatique")
    return false
  end
  return true, block
end

-- ─── INTELLIGENCE ────────────────────────────────────────────────────────────
function Threat.add_intel(ip, key, value)
  if type(ip) ~= "string" then return end
  if not _intel[ip] then _intel[ip] = { ip=ip, created_at=os.time() } end
  _intel[ip][key]       = value
  _intel[ip].updated_at = os.time()
end

function Threat.get_intel(ip)
  local profile = _threats[ip]
  local intel   = _intel[ip]
  if not profile and not intel then return nil end
  return {
    ip=ip,
    score=profile and profile.score or 0,
    max_level=profile and profile.max_level or 0,
    blocked=Threat.is_blocked(ip),
    block_count=profile and profile.block_count or 0,
    threat_types=profile and profile.threat_types or {},
    first_seen=profile and os.date("%Y-%m-%d %H:%M:%S", profile.first_seen) or nil,
    last_seen=profile and os.date("%Y-%m-%d %H:%M:%S", profile.last_seen) or nil,
    intel=intel or {},
    notes=profile and profile.notes or {},
    sig=SIG,
  }
end

function Threat.correlate(threat_type, min_count)
  min_count = min_count or 2
  local matches = {}
  for ip, profile in pairs(_threats) do
    local cnt = profile.threat_types[threat_type] or 0
    if cnt >= min_count then
      table.insert(matches, { ip=ip, count=cnt, score=profile.score, level=profile.max_level })
    end
  end
  table.sort(matches, function(a, b) return a.score > b.score end)
  return matches
end

function Threat.detect_campaign(threshold_ips, threat_type)
  threshold_ips = threshold_ips or 5
  local corr = Threat.correlate(threat_type, 1)
  if #corr >= threshold_ips then
    local total_score = 0
    for _, m in ipairs(corr) do total_score = total_score + m.score end

    log("CRITICAL", string.format(
      "CAMPAGNE DÉTECTÉE — %s | %d IPs | Score total: %d",
      threat_type, #corr, total_score))

    Events.emit("intellectus:campaign_detected", {
      type=threat_type, ip_count=#corr, total_score=total_score,
      ips=corr, sig=SIG, troxt=TROXT,
    })
    return true, corr
  end
  return false
end

-- ─── TICK ────────────────────────────────────────────────────────────────────
function Threat.tick()
  local now, decayed = os.time(), 0

  for ip, profile in pairs(_threats) do
    local age = now - profile.last_seen
    if age > 60 then
      local decay = math.floor(age / 60)
      profile.score = math.max(0, profile.score - decay)
      decayed = decayed + 1
    end
    if age > 86400 and profile.score == 0 and not profile.blocked then
      _threats[ip] = nil
      _intel[ip]   = nil
      _stats.ips_under_watch = math.max(0, _stats.ips_under_watch - 1)
    end
  end

  local max_active = 0
  for _, block in pairs(_blocked) do
    if block.level > max_active then max_active = block.level end
  end
  if max_active < _global_threat_level then
    _global_threat_level = math.max(0, _global_threat_level - 1)
  end
end

-- ─── RAPPORT ─────────────────────────────────────────────────────────────────
function Threat.get_report()
  local blocked_count, permanent_count = 0, 0
  for _, b in pairs(_blocked) do
    blocked_count = blocked_count + 1
    if b.permanent then permanent_count = permanent_count + 1 end
  end

  local level_labels = { [0]="CALME",[1]="VIGILANCE",[2]="MODÉRÉ",[3]="ÉLEVÉ",[4]="CRITIQUE",[5]="URGENCE" }

  return {
    sig=SIG, troxt=TROXT,
    generated_at=os.date("%Y-%m-%d %H:%M:%S"),
    global_threat_level=_global_threat_level,
    global_threat_label=level_labels[_global_threat_level] or "?",
    ips_monitored=_stats.ips_under_watch,
    ips_blocked=blocked_count,
    ips_permanent=permanent_count,
    active_alerts=#_active_alerts,
    stats=_stats,
    top_threats=Threat.get_top_threats(10),
    recent_log=Threat.get_log(20),
  }
end

function Threat.get_top_threats(limit)
  limit = limit or 10
  local list = {}
  for ip, profile in pairs(_threats) do
    local types = {}
    for k, v in pairs(profile.threat_types) do
      table.insert(types, k .. "×" .. v)
    end
    table.insert(list, {
      ip=ip, score=profile.score, level=profile.max_level,
      blocked=profile.blocked, types=types,
    })
  end
  table.sort(list, function(a, b) return a.score > b.score end)
  local result = {}
  for i = 1, math.min(limit, #list) do table.insert(result, list[i]) end
  return result
end

function Threat.get_log(limit, min_level)
  limit, min_level = limit or 50, min_level or 1
  local result = {}
  for _, entry in ipairs(_threat_log) do
    if entry.level >= min_level then
      table.insert(result, entry)
      if #result >= limit then break end
    end
  end
  return result
end

function Threat.get_blocked_ips()
  local result, now = {}, os.time()
  for ip, block in pairs(_blocked) do
    table.insert(result, {
      ip=ip, reason=block.reason, level=block.level, permanent=block.permanent,
      blocked_at=os.date("%H:%M:%S", block.blocked_at),
      remaining=block.expires_at and math.max(0, block.expires_at - now) or nil,
      sig=SIG,
    })
  end
  table.sort(result, function(a, b) return (b.level or 0) > (a.level or 0) end)
  return result
end

function Threat.get_active_alerts() return _active_alerts end
function Threat.get_global_level()  return _global_threat_level end
function Threat.get_taxonomy()      return THREAT_TAXONOMY end
function Threat.get_stats()         return _stats end
function Threat.get_signature()     return SIG end

-- ─── FAUX POSITIF ────────────────────────────────────────────────────────────
function Threat.mark_false_positive(ip, threat_type, by)
  _stats.false_positives = _stats.false_positives + 1
  local profile = _threats[ip]
  if profile then
    local def = THREAT_TAXONOMY[threat_type]
    local lvl = def and def.level or 1
    profile.score = math.max(0, profile.score - (LEVEL_SCORE[lvl] or 5) * 2)
    table.insert(profile.notes, {
      note="Faux positif: " .. threat_type, by=by or SIG, at=os.time(),
    })
  end
  Events.emit("intellectus:false_positive", { ip=ip, type=threat_type, by=by, sig=SIG })
  log("OK", string.format("Faux positif enregistré — %s / %s par %s", ip, threat_type, by or SIG))
end

-- ─── INIT ────────────────────────────────────────────────────────────────────
function Threat.init()
  -- ✅ FIX : `blocked_count` était un GLOBAL (variable non déclarée localement).
  --    Maintenant un simple compteur local.
  local blocked_count = 0
  local saved = Memory.list("threat")
  for _, entry in ipairs(saved) do
    if entry.key:match("^threat:blocked:") then
      local ip   = entry.key:match("^threat:blocked:(.+)$")
      local data = Memory.get(entry.key)
      if data and (data.permanent or (data.expires_at and os.time() < data.expires_at)) then
        _blocked[ip] = data
        blocked_count = blocked_count + 1
      end
    end
  end

  log("OK", string.format("[%s] Threat Engine initialisé — %d IPs bloquées chargées",
    SIG, blocked_count))

  Events.emit("intellectus:threat_ready", { sig=SIG, troxt=TROXT })
end

Threat.init()
return Threat
--[[
══════════════════════════════════════════════════════════════════════
  INTELLECTUS_AUDIT.LUA — Journal d'audit immuable TroxtWorld
  Toutes les actions sensibles signées TROXT · Tamper-proof · Export

  Chemin : lua/intellectus/intellectus_audit.lua
══════════════════════════════════════════════════════════════════════
]]

local Audit  = {}
local Events = require("troxt.troxt_events")
local Memory = require("troxt.troxt_memory")

-- ─── CONFIGURATION ───────────────────────────────────────────────────────────
local CFG = {
  max_entries      = 10000,
  retention_days   = 90,
  critical_actions = {
    "AUTH_LOGIN", "AUTH_LOGOUT", "AUTH_FAILED",
    "TOKEN_ISSUED", "TOKEN_REVOKED", "API_KEY_ISSUED",
    "ADMIN_ACCESS", "ADMIN_ACTION", "CONFIG_CHANGED",
    "IP_BLOCKED", "IP_UNBLOCKED", "THREAT_DETECTED",
    "FIREWALL_BLOCK", "RATE_LIMIT_EXCEEDED",
    "PLAYER_BANNED", "PLAYER_KICKED", "PLAYER_WARNED",
    "FACTION_CREATED", "FACTION_DISSOLVED",
    "BANK_TRANSFER_LARGE", "PROPERTY_SOLD",
    "TROXT_MODE_CHANGED", "AGENT_DOWN", "CASCADE_DETECTED",
    "WORLD_SNAPSHOT", "DB_BACKUP",
  },
  export_formats = { "json", "csv", "txt" },
  signature      = "⬡TROXT/🛡️INTELLECTUS",
}

-- ─── ÉTAT ────────────────────────────────────────────────────────────────────
local _log        = {}
local _sequence   = 0
local _hash_chain = "INIT"

local _stats = {
  total_entries    = 0,
  critical_entries = 0,
  by_level         = { INFO=0, WARN=0, ERROR=0, CRITICAL=0, SUCCESS=0 },
  by_action        = {},
}

-- ─── HELPERS ─────────────────────────────────────────────────────────────────
local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ✅ FIX : l'ancien code appelait os.time() DANS le calcul du hash, donc deux
--    appels avec les mêmes données produisaient des hashes différents →
--    impossible de vérifier l'intégrité plus tard. On retire os.time() ;
--    le timestamp est déjà dans `data` (via entry_str).
local function simple_hash(data, prev_hash)
  local str  = tostring(data) .. tostring(prev_hash)
  local hash = 0
  for i = 1, #str do
    hash = (hash * 31 + str:byte(i)) % 4294967296
  end
  return string.format("%08x%08x", hash, #str * 7919)
end

local function is_critical(action)
  for _, ca in ipairs(CFG.critical_actions) do
    if ca == action then return true end
  end
  return false
end

-- Top N actions triées par fréquence
local function top_actions(n)
  local sorted = {}
  for action, count in pairs(_stats.by_action) do
    table.insert(sorted, { action=action, count=count })
  end
  table.sort(sorted, function(a, b) return a.count > b.count end)
  local top = {}
  for i = 1, math.min(n or 10, #sorted) do
    table.insert(top, sorted[i])
  end
  return top
end

-- ─── ENTRÉE PRINCIPALE ───────────────────────────────────────────────────────
function Audit.log(action, opts)
  opts = opts or {}

  _sequence = _sequence + 1
  local now      = os.time()
  local level    = opts.level or "INFO"
  local critical = is_critical(action) or (level == "CRITICAL")

  -- Hash chaîné — `now` est déjà dans entry_str, pas besoin de le rajouter
  local entry_str = string.format("%d|%s|%s|%d",
    _sequence, action, opts.player_id or "", now)
  local new_hash  = simple_hash(entry_str, _hash_chain)
  _hash_chain     = new_hash

  local entry = {
    seq       = _sequence,
    ts        = now,
    date      = os.date("%Y-%m-%d %H:%M:%S"),
    action    = action,
    level     = level,
    critical  = critical,
    player_id = opts.player_id,
    ip        = opts.ip,
    endpoint  = opts.endpoint,
    data      = opts.data or {},
    reason    = opts.reason,
    result    = opts.result or "logged",
    hash      = new_hash,
    signed_by = CFG.signature,
  }

  table.insert(_log, 1, entry)
  if #_log > CFG.max_entries then table.remove(_log) end

  _stats.total_entries = _stats.total_entries + 1
  _stats.by_level[level] = (_stats.by_level[level] or 0) + 1
  _stats.by_action[action] = (_stats.by_action[action] or 0) + 1
  if critical then _stats.critical_entries = _stats.critical_entries + 1 end

  if critical then
    Memory.push("audit:critical", {
      seq    = entry.seq,
      date   = entry.date,
      action = action,
      ip     = opts.ip,
      player = opts.player_id,
      hash   = new_hash,
    }, 200)
  end

  if critical or level == "WARN" or level == "ERROR" then
    Events.emit("intellectus:audit_entry", {
      seq      = entry.seq,
      action   = action,
      level    = level,
      player   = opts.player_id,
      ip       = opts.ip,
      critical = critical,
    })
  end

  if critical or level == "CRITICAL" then
    local icons = { INFO="ℹ", WARN="⚠", ERROR="✖", CRITICAL="🔴", SUCCESS="✓" }
    print(string.format("[AUDIT #%d] %s %s — %s%s",
      _sequence,
      icons[level] or "·",
      action,
      opts.player_id and ("Player:" .. opts.player_id .. " ") or "",
      opts.ip        and ("IP:" .. opts.ip) or ""))
  end

  return entry.seq, new_hash
end

-- ─── RACCOURCIS ──────────────────────────────────────────────────────────────
-- Note : `error_` avec underscore pour éviter le shadowing de `_G.error`
local function shortcut(level)
  return function(action, opts)
    opts = opts or {}
    opts.level = level
    return Audit.log(action, opts)
  end
end

Audit.info     = shortcut("INFO")
Audit.warn     = shortcut("WARN")
Audit.error_   = shortcut("ERROR")
Audit.critical = shortcut("CRITICAL")
Audit.success  = shortcut("SUCCESS")

-- ─── RÉCITS D'ÉVÉNEMENTS SPÉCIFIQUES ─────────────────────────────────────────
function Audit.player_login(player_id, ip, success)
  return Audit.log(success and "AUTH_LOGIN" or "AUTH_FAILED", {
    level     = success and "SUCCESS" or "WARN",
    player_id = player_id,
    ip        = ip,
    result    = success and "ok" or "failed",
  })
end

function Audit.admin_action(player_id, ip, action_detail, data)
  return Audit.log("ADMIN_ACTION", {
    level     = "WARN",
    player_id = player_id,
    ip        = ip,
    reason    = action_detail,
    data      = data or {},
  })
end

function Audit.ip_blocked(ip, reason, level_num)
  return Audit.log("IP_BLOCKED", {
    level  = level_num and level_num >= 4 and "CRITICAL" or "WARN",
    ip     = ip,
    reason = reason,
    data   = { threat_level = level_num },
  })
end

function Audit.threat(ip, threat_type, threat_level, data)
  return Audit.log("THREAT_DETECTED", {
    level  = threat_level >= 4 and "CRITICAL" or "WARN",
    ip     = ip,
    reason = threat_type,
    data   = data or {},
  })
end

function Audit.bank_transfer(from_id, to_id, amount, ip)
  local is_large = amount >= 10000
  return Audit.log(is_large and "BANK_TRANSFER_LARGE" or "BANK_TRANSFER", {
    level     = is_large and "WARN" or "INFO",
    player_id = from_id,
    ip        = ip,
    data      = { from=from_id, to=to_id, amount=amount },
  })
end

function Audit.troxt_mode_change(old_mode, new_mode)
  return Audit.log("TROXT_MODE_CHANGED", {
    level  = new_mode == "LOCKDOWN" and "CRITICAL" or "WARN",
    reason = old_mode .. " → " .. new_mode,
    data   = { old=old_mode, new=new_mode },
  })
end

function Audit.agent_down(agent_id, agent_name, silence_sec)
  return Audit.log("AGENT_DOWN", {
    level  = "CRITICAL",
    reason = agent_name .. " hors ligne depuis " .. silence_sec .. "s",
    data   = { agent_id=agent_id, silence_sec=silence_sec },
  })
end

-- ─── LECTURE ─────────────────────────────────────────────────────────────────
function Audit.get(limit, opts)
  limit = limit or 50
  opts  = opts or {}

  local result = {}
  for _, entry in ipairs(_log) do
    local keep = true
    if opts.level         and entry.level     ~= opts.level     then keep = false end
    if opts.action        and entry.action    ~= opts.action    then keep = false end
    if opts.player_id     and entry.player_id ~= opts.player_id then keep = false end
    if opts.ip            and entry.ip        ~= opts.ip        then keep = false end
    if opts.critical_only and not entry.critical                then keep = false end
    if opts.since         and entry.ts < opts.since             then keep = false end

    if keep then
      table.insert(result, entry)
      if #result >= limit then break end
    end
  end

  return result
end

function Audit.get_by_player(player_id, limit)
  return Audit.get(limit or 30, { player_id=player_id })
end

function Audit.get_by_ip(ip, limit)
  return Audit.get(limit or 30, { ip=ip })
end

function Audit.get_critical(limit)
  return Audit.get(limit or 30, { critical_only=true })
end

function Audit.get_entry(seq)
  for _, entry in ipairs(_log) do
    if entry.seq == seq then return entry end
  end
  return nil
end

-- ─── VÉRIFICATION D'INTÉGRITÉ ────────────────────────────────────────────────
function Audit.verify_integrity()
  local issues = {}
  local prev_seq = _sequence + 1

  for i, entry in ipairs(_log) do
    if entry.seq ~= (prev_seq - 1) then
      table.insert(issues, string.format(
        "Séquence cassée à index %d (attendu %d, reçu %d)",
        i, prev_seq - 1, entry.seq))
    end
    prev_seq = entry.seq
  end

  return {
    ok          = #issues == 0,
    total       = #_log,
    issues      = issues,
    chain_tail  = _hash_chain:sub(1, 16) .. "...",
    verified_at = os.date("%Y-%m-%d %H:%M:%S"),
  }
end

-- ─── EXPORT ──────────────────────────────────────────────────────────────────
function Audit.export(format, opts)
  format = format or "json"
  local entries = Audit.get(opts and opts.limit or 1000, opts)

  if format == "json" then
    return {
      format      = "json",
      exported_at = os.date("%Y-%m-%d %H:%M:%S"),
      signature   = CFG.signature,
      total       = #entries,
      entries     = entries,
    }

  elseif format == "csv" then
    local lines = { "seq,date,level,action,player_id,ip,result,hash" }
    for _, e in ipairs(entries) do
      local hash_prefix = (e.hash or "????????"):sub(1, 8)
      table.insert(lines, string.format(
        '%d,"%s","%s","%s","%s","%s","%s","%s"',
        e.seq, e.date, e.level, e.action,
        e.player_id or "", e.ip or "", e.result or "", hash_prefix))
    end
    return table.concat(lines, "\n")

  elseif format == "txt" then
    local lines = {
      "═══════════════════════════════════════════════════",
      "  AUDIT LOG — TroxtWorld / Intellectus",
      "  Exporté: " .. os.date("%Y-%m-%d %H:%M:%S"),
      "  Signature: " .. CFG.signature,
      "═══════════════════════════════════════════════════",
    }
    for _, e in ipairs(entries) do
      table.insert(lines, string.format("[#%04d %s] %-10s %-30s %s%s",
        e.seq, e.date, e.level, e.action,
        e.player_id and ("P:" .. e.player_id .. " ") or "",
        e.ip and ("IP:" .. e.ip) or ""))
    end
    return table.concat(lines, "\n")
  end

  return nil, "Format inconnu: " .. tostring(format)
end

-- ─── STATS ───────────────────────────────────────────────────────────────────
function Audit.get_stats()
  return {
    total_entries    = _stats.total_entries,
    critical_entries = _stats.critical_entries,
    in_memory        = #_log,
    sequence         = _sequence,
    by_level         = _stats.by_level,
    top_actions      = top_actions(10),
    chain_intact     = Audit.verify_integrity().ok,
  }
end

function Audit.get_signature() return CFG.signature end

-- ─── ÉCOUTER LES ÉVÉNEMENTS INTELLECTUS POUR AUTO-AUDIT ──────────────────────
local function setup_auto_audit()
  Events.on("intellectus:ip_blocked", function(d)
    Audit.ip_blocked(d.ip, d.reason, d.level)
  end, { tag="audit_auto" })

  Events.on("intellectus:auth_failed", function(d)
    Audit.warn("AUTH_FAILED", { ip=d.ip, endpoint=d.endpoint, reason=d.reason })
  end, { tag="audit_auto" })

  Events.on("intellectus:token_revoked", function(d)
    Audit.warn("TOKEN_REVOKED", { player_id=d.player_id, reason=d.reason })
  end, { tag="audit_auto" })

  Events.on("intellectus:firewall_block", function(d)
    Audit.warn("FIREWALL_BLOCK",
      { ip=d.ip, endpoint=d.endpoint, reason=d.rule, data=d })
  end, { tag="audit_auto" })

  Events.on("intellectus:behavior_alert", function(d)
    Audit.threat(d.ip, d.type, d.level or 1, { detail=d.detail })
  end, { tag="audit_auto" })

  Events.on("troxtworld:agent_critical", function(d)
    Audit.critical("AGENT_DOWN",
      { reason=d.name .. " — " .. (d.status or "?"), data=d })
  end, { tag="audit_auto" })

  Events.on("troxt:mode_changed", function(d)
    Audit.troxt_mode_change(d.old, d.new)
  end, { tag="audit_auto" })
end

setup_auto_audit()

print("[🛡️ AUDIT] Intellectus Audit initialisé — Chaîne de hachage active")
return Audit
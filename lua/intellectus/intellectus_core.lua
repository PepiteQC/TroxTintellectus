--[[
══════════════════════════════════════════════════════════════════════
  INTELLECTUS_CORE.LUA — Serveur de Sécurité TroxtWorld
  Détection d'intrusion · Rate limiting · Auth · Threats · Audit

  INTELLECTUS ne fait pas confiance — il vérifie.
  INTELLECTUS ne punit pas — il protège.
  Chaque décision laisse une trace immuable.

  Chemin : lua/intellectus/intellectus_core.lua
══════════════════════════════════════════════════════════════════════
]]

local Intellectus = {}

-- ─── DÉPENDANCES ─────────────────────────────────────────────────────────────
local Events  = require("troxt.troxt_events")
local Memory  = require("troxt.troxt_memory")

-- ─── IDENTITÉ ─────────────────────────────────────────────────────────────────
local ID = {
  version   = "1.0.0",
  signature = "🛡️ INTELLECTUS",
  started_at= os.time(),
  state     = "ACTIVE",
}

-- ─── CONFIGURATION SÉCURITÉ ──────────────────────────────────────────────────
local CONFIG = {
  -- Rate limiting (clés alignées avec rate_key des endpoints)
  rate_limit = {
    default     = 100,
    admin       = 30,
    ws          = 500,
    auth        = 10,
    api_prism   = 200,
  },

  -- Blocage automatique
  auto_block = {
    enabled           = true,
    rate_violations   = 3,
    auth_failures     = 5,
    block_duration    = 3600,
    escalate_to_troxt_level = 4,   -- ✅ niveau auquel on escalade vers TROXT
  },

  -- Niveaux de menace (1=faible, 5=critique)
  threat_levels = {
    rate_limit_exceeded   = 1,
    auth_failure          = 2,
    sql_injection_attempt = 4,
    xss_injection_attempt = 3,     -- ✅ aligné avec le nom généré
    path_injection_attempt= 4,     -- ✅ aligné
    rce_injection_attempt = 5,     -- ✅ aligné
    xss_attempt           = 3,     -- conservé pour compat
    path_traversal        = 4,
    repeated_403          = 2,
    mass_scan             = 3,
    ddos_pattern          = 5,
    invalid_jwt           = 2,
    admin_brute_force     = 5,
  },

  -- Endpoints protégés
  protected_endpoints = {
    ["/api/admin"]         = { require_auth=true,  role="admin", rate_key="admin" },
    ["/api/admin/metrics"] = { require_auth=true,  role="admin", rate_key="admin" },
    ["/api/prism"]         = { require_auth=true,  role="admin", rate_key="api_prism" },
    ["/api/prism/tables"]  = { require_auth=true,  role="admin", rate_key="api_prism" },
    ["/api/platforms"]     = { require_auth=false, role=nil,     rate_key="default" },
    ["/troxt/report"]      = { require_auth=true,  role="admin", rate_key="admin" },
    ["/intellectus"]       = { require_auth=true,  role="admin", rate_key="admin" },
  },

  -- Patterns d'injection connus
  injection_patterns = {
    sql  = { "';", "DROP TABLE", "' OR '1'='1", "UNION SELECT", "--", "xp_cmdshell", "exec(" },
    xss  = { "<script>", "javascript:", "onerror=", "onload=", "alert(", "document.cookie" },
    path = { "../", "..\\", "/etc/passwd", "/etc/shadow", "C:\\Windows", "cmd.exe" },
    rce  = { "|", "`", "$(", "${", ";rm ", "; cat ", "wget http", "curl http" },
  },

  -- Whitelist IPs (jamais bloquées)
  whitelist_ips = {
    "127.0.0.1",
    "::1",
    "localhost",
  },

  jwt_secret = "ETHER_JWT_SECRET_CHANGE_IN_PROD",
  jwt_expiry  = 86400,
}

-- ─── ÉTAT INTERNE ────────────────────────────────────────────────────────────
local state = {
  rate_buckets   = {},
  blocked_ips    = {},
  auth_counters  = {},
  valid_tokens   = {},
  threats        = {},
  audit_log      = {},
  stats = {
    total_requests   = 0,
    blocked_requests = 0,
    auth_successes   = 0,
    auth_failures    = 0,
    threats_detected = 0,
    ips_blocked      = 0,
    tokens_issued    = 0,
    tokens_revoked   = 0,
  },
}

-- ─── HELPERS ─────────────────────────────────────────────────────────────────
local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

local function is_whitelisted(ip)
  if type(ip) ~= "string" then return false end
  for _, wip in ipairs(CONFIG.whitelist_ips) do
    if ip == wip then return true end
  end
  return false
end

local function audit(action, ip, data, level)
  level = level or "INFO"
  local entry = {
    ts     = os.time(),
    date   = os.date("%Y-%m-%d %H:%M:%S"),
    action = action,
    ip     = ip or "unknown",
    level  = level,
    data   = data or {},
  }
  table.insert(state.audit_log, 1, entry)
  if #state.audit_log > 2000 then table.remove(state.audit_log) end
  Events.emit("intellectus:audit", entry)
  return entry
end

local function log(level, msg, data)
  local icons = { INFO="ℹ", WARN="⚠", ERROR="✖", CRITICAL="🔴", SUCCESS="✓", BLOCK="🚫" }
  print(string.format("[%s] %s %s — %s", os.date("%H:%M:%S"), icons[level] or "·", ID.signature, msg))
  if data then
    for k, v in pairs(data) do print("   ↳ " .. k .. ": " .. tostring(v)) end
  end
end

-- ─── DÉTECTION D'INJECTION ───────────────────────────────────────────────────
local function scan_for_injection(input)
  if type(input) ~= "string" then return nil end
  local lower = input:lower()

  for category, patterns in pairs(CONFIG.injection_patterns) do
    for _, pattern in ipairs(patterns) do
      if lower:find(pattern:lower(), 1, true) then
        return category, pattern
      end
    end
  end
  return nil
end

local function deep_scan(data, depth)
  depth = depth or 0
  if depth > 5 then return nil end
  if type(data) == "string" then
    return scan_for_injection(data)
  elseif type(data) == "table" then
    for k, v in pairs(data) do
      local cat, pattern = scan_for_injection(tostring(k))
      if cat then return cat, pattern end
      cat, pattern = deep_scan(v, depth + 1)
      if cat then return cat, pattern end
    end
  end
  return nil
end

-- ─── GESTION MENACES ─────────────────────────────────────────────────────────
local function record_threat(ip, threat_type, extra_data)
  if is_whitelisted(ip) then return end
  if type(ip) ~= "string" then return end

  local level    = CONFIG.threat_levels[threat_type] or 1
  local existing = state.threats[ip]

  if not existing then
    state.threats[ip] = {
      ip         = ip,
      level      = level,
      types      = { threat_type },
      first_seen = os.time(),
      last_seen  = os.time(),
      count      = 1,
    }
  else
    existing.level     = math.max(existing.level, level)
    existing.last_seen = os.time()
    existing.count     = existing.count + 1
    local found = false
    for _, t in ipairs(existing.types) do
      if t == threat_type then found = true break end
    end
    if not found then table.insert(existing.types, threat_type) end
  end

  state.stats.threats_detected = state.stats.threats_detected + 1

  local threat = state.threats[ip]
  Events.emit("intellectus:threat_detected", {
    ip         = ip,
    type       = threat_type,
    level      = level,
    count      = threat.count,
    all_types  = threat.types,
    data       = extra_data,
  })

  audit("THREAT_DETECTED", ip, { type=threat_type, level=level }, "WARN")

  -- Bloquer automatiquement si niveau élevé
  if CONFIG.auto_block.enabled and level >= 4 then
    Intellectus.block_ip(ip, "Auto-blocage: " .. threat_type, level * 1800)
  elseif CONFIG.auto_block.enabled and threat.count >= 10 then
    Intellectus.block_ip(ip, "Activité répétée suspecte", CONFIG.auto_block.block_duration)
  end

  -- ✅ Escalader vers TROXT si niveau critique (comparaison numérique, pas booléenne)
  if level >= CONFIG.auto_block.escalate_to_troxt_level then
    Events.emit("troxt:security_alert", {
      source = "intellectus",
      ip     = ip,
      threat = threat_type,
      level  = level,
      action = "BLOCK_AUTO",
    })
  end

  return threat
end

-- ─── RATE LIMITING ───────────────────────────────────────────────────────────
function Intellectus.check_rate_limit(ip, endpoint_key)
  if is_whitelisted(ip) then return true, nil end
  if type(ip) ~= "string" then return true, nil end

  local limit = CONFIG.rate_limit[endpoint_key] or CONFIG.rate_limit.default
  local now   = os.time()

  if not state.rate_buckets[ip] then state.rate_buckets[ip] = {} end
  local bucket = state.rate_buckets[ip]

  if not bucket[endpoint_key] then
    bucket[endpoint_key] = { count = 0, window_start = now }
  end

  local b = bucket[endpoint_key]

  if now - b.window_start >= 60 then
    b.count        = 0
    b.window_start = now
  end

  b.count = b.count + 1

  if b.count > limit then
    local violations = (Memory.get("security:violations:" .. ip) or 0) + 1
    Memory.set("security:violations:" .. ip, violations, { ttl = 3600 })

    record_threat(ip, "rate_limit_exceeded", {
      endpoint   = endpoint_key,
      count      = b.count,
      limit      = limit,
      violations = violations,
    })

    if violations >= CONFIG.auto_block.rate_violations then
      Intellectus.block_ip(ip, "Rate limit répété (" .. violations .. "x)", CONFIG.auto_block.block_duration)
    end

    return false, string.format("Rate limit dépassé: %d/%d req/min", b.count, limit)
  end

  return true, nil
end

-- ─── BLOCAGE IP ──────────────────────────────────────────────────────────────
function Intellectus.block_ip(ip, reason, duration_sec)
  if type(ip) ~= "string" or #ip == 0 then
    return false, "IP invalide"
  end
  if is_whitelisted(ip) then return false, "IP whitelistée — blocage refusé" end

  duration_sec = duration_sec or CONFIG.auto_block.block_duration

  state.blocked_ips[ip] = {
    ip         = ip,
    reason     = reason,
    blocked_at = os.time(),
    expires_at = os.time() + duration_sec,
    duration   = duration_sec,
    level      = state.threats[ip] and state.threats[ip].level or 1,
  }

  state.stats.ips_blocked = state.stats.ips_blocked + 1
  Memory.set("security:blocked:" .. ip, state.blocked_ips[ip], { ttl = duration_sec + 60 })

  log("BLOCK", string.format("IP bloquée: %s — %s (%dmin)", ip, reason, math.floor(duration_sec/60)))
  Events.emit("intellectus:ip_blocked", { ip=ip, reason=reason, duration=duration_sec })
  audit("IP_BLOCKED", ip, { reason=reason, duration=duration_sec }, "CRITICAL")

  return true
end

function Intellectus.unblock_ip(ip, reason)
  if not state.blocked_ips[ip] then return false, "IP non bloquée" end
  state.blocked_ips[ip] = nil
  Memory.delete("security:blocked:" .. ip)
  log("SUCCESS", "IP débloquée: " .. ip .. " — " .. (reason or "manuel"))
  Events.emit("intellectus:ip_unblocked", { ip=ip, reason=reason })
  audit("IP_UNBLOCKED", ip, { reason=reason }, "INFO")
  return true
end

function Intellectus.is_blocked(ip)
  if is_whitelisted(ip) then return false end
  if type(ip) ~= "string" then return false end
  local block = state.blocked_ips[ip]
  if not block then return false end
  if os.time() > block.expires_at then
    state.blocked_ips[ip] = nil
    return false
  end
  return true, block
end

-- ─── VÉRIFICATION D'ACCÈS PRINCIPALE ─────────────────────────────────────────
function Intellectus.check_request(request)
  state.stats.total_requests = state.stats.total_requests + 1

  local ip       = request.ip or "unknown"
  local endpoint = request.endpoint or "/"
  local method   = request.method or "GET"

  local result = {
    allowed  = false,
    ip       = ip,
    endpoint = endpoint,
    reason   = nil,
    auth     = nil,
    level    = 0,
  }

  -- 1. IP bloquée ?
  local blocked, block_info = Intellectus.is_blocked(ip)
  if blocked then
    state.stats.blocked_requests = state.stats.blocked_requests + 1
    result.reason = "IP bloquée: " .. (block_info.reason or "raison inconnue")
    result.level  = 3
    audit("REQUEST_BLOCKED", ip, { endpoint=endpoint, reason=result.reason }, "WARN")
    return result
  end

  -- 2. Scan injection sur body
  if request.body then
    local cat, pattern = deep_scan(request.body)
    if cat then
      local threat_type = cat .. "_injection_attempt"
      record_threat(ip, threat_type, { pattern=pattern, endpoint=endpoint })
      state.stats.blocked_requests = state.stats.blocked_requests + 1
      result.reason = "Injection " .. cat .. " détectée"
      result.level  = CONFIG.threat_levels[threat_type] or 3
      return result
    end
  end

  -- Scan injection sur params
  if request.params then
    local cat, pattern = deep_scan(request.params)
    if cat then
      record_threat(ip, cat .. "_injection_attempt", { pattern=pattern, endpoint=endpoint })
      state.stats.blocked_requests = state.stats.blocked_requests + 1
      result.reason = "Injection " .. cat .. " dans les paramètres"
      return result
    end
  end

  -- 3. Path traversal
  if endpoint:find("%.%./") or endpoint:find("%.%.\\") then
    record_threat(ip, "path_traversal", { endpoint=endpoint })
    result.reason = "Path traversal détecté"
    return result
  end

  -- 4. Rate limiting
  local ep_config = Intellectus.get_endpoint_config(endpoint)
  local rate_key  = ep_config and ep_config.rate_key or "default"
  local rate_ok, rate_err = Intellectus.check_rate_limit(ip, rate_key)
  if not rate_ok then
    state.stats.blocked_requests = state.stats.blocked_requests + 1
    result.reason = rate_err
    return result
  end

  -- 5. Auth si requis
  if ep_config and ep_config.require_auth then
    local auth_header = request.headers and request.headers.authorization
    if not auth_header then
      state.stats.auth_failures = state.stats.auth_failures + 1
      record_threat(ip, "repeated_403", { endpoint=endpoint })
      result.reason = "Authentification requise"
      return result
    end

    local token = auth_header:match("^Bearer (.+)$")
    if not token then
      result.reason = "Format token invalide"
      return result
    end

    local auth_result, auth_err = Intellectus.validate_token(token, ip)
    if not auth_result then
      Intellectus.record_auth_failure(ip, endpoint)
      result.reason = auth_err or "Token invalide"
      return result
    end

    if ep_config.role and auth_result.role ~= ep_config.role then
      result.reason = "Rôle insuffisant (requis: " .. ep_config.role ..
        ", reçu: " .. (auth_result.role or "?") .. ")"
      record_threat(ip, "repeated_403", { endpoint=endpoint, role=auth_result.role })
      return result
    end

    result.auth = auth_result
    state.stats.auth_successes = state.stats.auth_successes + 1
  end

  result.allowed = true
  audit("REQUEST_OK", ip, { endpoint=endpoint, method=method }, "INFO")
  return result
end

-- ─── ENDPOINT CONFIG ─────────────────────────────────────────────────────────
function Intellectus.get_endpoint_config(endpoint)
  if CONFIG.protected_endpoints[endpoint] then
    return CONFIG.protected_endpoints[endpoint]
  end
  -- Prefix match : on prend le plus long préfixe qui matche (plus spécifique)
  local best_prefix, best_cfg = nil, nil
  for prefix, cfg in pairs(CONFIG.protected_endpoints) do
    if endpoint:sub(1, #prefix) == prefix then
      if not best_prefix or #prefix > #best_prefix then
        best_prefix, best_cfg = prefix, cfg
      end
    end
  end
  return best_cfg
end

-- ─── AUTHENTIFICATION JWT SIMPLIFIÉ ──────────────────────────────────────────
function Intellectus.issue_token(player_id, role, ip)
  if type(player_id) ~= "string" or #player_id == 0 then
    return nil, "player_id invalide"
  end
  if type(role) ~= "string" or #role == 0 then
    role = "player"
  end

  local now   = os.time()
  local token = string.format("ETH_%s_%s_%d_%s",
    player_id:sub(1, 8), role, now,
    tostring(math.random(100000, 999999)))

  state.valid_tokens[token] = {
    player_id  = player_id,
    role       = role,
    issued_at  = now,
    expires_at = now + CONFIG.jwt_expiry,
    ip         = ip,
    last_used  = now,
    use_count  = 0,
  }

  state.stats.tokens_issued = state.stats.tokens_issued + 1
  Memory.set("security:token:" .. player_id, token, { ttl = CONFIG.jwt_expiry + 60 })
  audit("TOKEN_ISSUED", ip, { player_id=player_id, role=role }, "SUCCESS")

  log("SUCCESS", string.format("Token émis — Joueur: %s, Rôle: %s", player_id, role))
  return token
end

function Intellectus.validate_token(token, ip)
  if type(token) ~= "string" or #token == 0 then
    return nil, "Token manquant ou invalide"
  end

  local info = state.valid_tokens[token]
  if not info then
    Events.emit("intellectus:auth_failed", { ip=ip, reason="token_unknown", endpoint="token_check" })
    return nil, "Token inconnu"
  end

  if os.time() > info.expires_at then
    state.valid_tokens[token] = nil
    Events.emit("intellectus:auth_failed", { ip=ip, reason="token_expired" })
    return nil, "Token expiré"
  end

  info.last_used = os.time()
  info.use_count = info.use_count + 1

  return { player_id=info.player_id, role=info.role, use_count=info.use_count }
end

function Intellectus.revoke_token(token, reason)
  if state.valid_tokens[token] then
    local info = state.valid_tokens[token]
    state.valid_tokens[token] = nil
    state.stats.tokens_revoked = state.stats.tokens_revoked + 1
    audit("TOKEN_REVOKED", info.ip, { player_id=info.player_id, reason=reason }, "WARN")
    return true
  end
  return false
end

function Intellectus.revoke_player_tokens(player_id)
  local revoked = 0
  for token, info in pairs(state.valid_tokens) do
    if info.player_id == player_id then
      state.valid_tokens[token] = nil
      revoked = revoked + 1
    end
  end
  state.stats.tokens_revoked = state.stats.tokens_revoked + revoked
  return revoked
end

-- ─── ÉCHECS AUTH ─────────────────────────────────────────────────────────────
function Intellectus.record_auth_failure(ip, endpoint)
  state.stats.auth_failures = state.stats.auth_failures + 1
  Events.emit("intellectus:auth_failed", { ip=ip, endpoint=endpoint })

  if not state.auth_counters[ip] then
    state.auth_counters[ip] = { failures = 0, first_failure = os.time() }
  end
  local counter = state.auth_counters[ip]
  counter.failures     = counter.failures + 1
  counter.last_failure = os.time()

  record_threat(ip, "auth_failure", { endpoint=endpoint, total=counter.failures })

  if counter.failures >= CONFIG.auto_block.auth_failures then
    local is_admin = endpoint and endpoint:find("/admin", 1, true) ~= nil
    local duration = is_admin and 86400 or CONFIG.auto_block.block_duration
    Intellectus.block_ip(ip, "Trop d'échecs auth (" .. counter.failures .. "x)", duration)
    if is_admin then
      record_threat(ip, "admin_brute_force", { endpoint=endpoint })
    end
  end
end

-- ─── NETTOYAGE PÉRIODIQUE ────────────────────────────────────────────────────
function Intellectus.cleanup()
  local now = os.time()
  local cleaned = 0

  for ip, block in pairs(state.blocked_ips) do
    if now > block.expires_at then
      state.blocked_ips[ip] = nil
      cleaned = cleaned + 1
    end
  end

  for token, info in pairs(state.valid_tokens) do
    if now > info.expires_at then
      state.valid_tokens[token] = nil
      cleaned = cleaned + 1
    end
  end

  for ip, buckets in pairs(state.rate_buckets) do
    local all_old = true
    for _, b in pairs(buckets) do
      if now - b.window_start < 120 then all_old = false break end
    end
    if all_old then state.rate_buckets[ip] = nil end
  end

  -- Purge aussi les threats expirées (aucune activité > 1h)
  for ip, threat in pairs(state.threats) do
    if now - threat.last_seen > 3600 then
      state.threats[ip] = nil
      cleaned = cleaned + 1
    end
  end

  if cleaned > 0 then
    log("INFO", "Nettoyage: " .. cleaned .. " entrées expirées")
  end
  return cleaned
end

-- ─── RAPPORT ─────────────────────────────────────────────────────────────────
function Intellectus.get_report()
  return {
    signature      = ID.signature,
    version        = ID.version,
    state          = ID.state,
    uptime_sec     = os.time() - ID.started_at,
    stats          = state.stats,
    blocked_ips    = count_keys(state.blocked_ips),
    active_threats = count_keys(state.threats),
    active_tokens  = count_keys(state.valid_tokens),
    audit_size     = #state.audit_log,
    generated_at   = os.date("%Y-%m-%d %H:%M:%S"),
  }
end

function Intellectus.get_threats(min_level)
  min_level = min_level or 1
  local result = {}
  for _, threat in pairs(state.threats) do
    if threat.level >= min_level then
      table.insert(result, threat)
    end
  end
  table.sort(result, function(a, b) return a.level > b.level end)
  return result
end

function Intellectus.get_blocked_ips()
  local result = {}
  for ip, block in pairs(state.blocked_ips) do
    table.insert(result, {
      ip         = ip,
      reason     = block.reason,
      blocked_at = os.date("%H:%M:%S", block.blocked_at),
      expires_at = os.date("%H:%M:%S", block.expires_at),
      remaining  = math.max(0, block.expires_at - os.time()),
    })
  end
  return result
end

function Intellectus.get_audit_log(limit, level_filter)
  limit = limit or 100
  local result = {}
  for _, entry in ipairs(state.audit_log) do
    if not level_filter or entry.level == level_filter then
      table.insert(result, entry)
      if #result >= limit then break end
    end
  end
  return result
end

function Intellectus.get_stats() return state.stats end
function Intellectus.get_signature() return ID.signature end

-- ─── BOOT ────────────────────────────────────────────────────────────────────
function Intellectus.boot()
  local saved_blocks = Memory.list("security")
  for _, entry in ipairs(saved_blocks) do
    if entry.key:match("^security:blocked:") then
      local ip    = entry.key:match("^security:blocked:(.+)$")
      local block = Memory.get(entry.key)
      if block and os.time() < block.expires_at then
        state.blocked_ips[ip] = block
      end
    end
  end

  log("SUCCESS", string.format("INTELLECTUS v%s actif — %d IPs bloquées chargées",
    ID.version, count_keys(state.blocked_ips)))

  Events.emit("intellectus:booted", {
    version    = ID.version,
    started_at = ID.started_at,
  })

  return Intellectus
end

Intellectus.boot()

return Intellectus
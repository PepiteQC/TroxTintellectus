--[[
══════════════════════════════════════════════════════════════════════
  INTELLECTUS_FIREWALL.LUA — Pare-feu applicatif TroxtWorld
  Règles · Whitelist · Blacklist · Géo · Payload · Headers

  Chemin : lua/intellectus/intellectus_firewall.lua
══════════════════════════════════════════════════════════════════════
]]

local Firewall = {}
local Events   = require("troxt.troxt_events")
local Memory   = require("troxt.troxt_memory")

-- ─── RÈGLES PARE-FEU ─────────────────────────────────────────────────────────
local RULES = {
  allowed_methods = {
    ["/api/platforms"]     = { "GET", "POST", "PUT", "DELETE" },
    ["/api/prism"]         = { "GET", "POST", "PUT", "DELETE", "PATCH" },
    ["/api/admin"]         = { "GET", "POST" },
    ["/api/admin/metrics"] = { "GET" },
    ["/troxt"]             = { "GET", "POST" },
    ["/intellectus"]       = { "GET" },
    ["DEFAULT"]            = { "GET", "POST" },
  },

  allowed_content_types = {
    "application/json",
    "application/x-www-form-urlencoded",
    "multipart/form-data",
    "text/plain",
  },

  max_body_size = {
    ["/api/platforms"] = 524288,
    ["/api/prism"]     = 131072,
    ["DEFAULT"]        = 65536,
  },

  required_headers = {
    ["/api/admin"]   = { "x-troxt-key" },
    ["/api/prism"]   = { "authorization" },
    ["/troxt"]       = { "authorization" },
    ["/intellectus"] = { "authorization", "x-troxt-key" },
  },

  forbidden_headers = {
    "x-forwarded-host",
    "x-original-url",
    "x-rewrite-url",
    "x-http-method-override",
  },

  whitelist = {
    "127.0.0.1",
    "::1",
    "localhost",
    "10.0.0.1",
  },

  blacklist = {
    -- Peuplé dynamiquement via Memory
  },

  forbidden_params = {
    "debug", "trace", "test", "phpinfo",
    "_wpnonce", "wp-admin",
    "XDEBUG_SESSION",
  },
}

-- ─── ÉTAT ────────────────────────────────────────────────────────────────────
local _dynamic_blacklist = {}
local _dynamic_whitelist = {}
local _rule_hits         = {}
local _blocked_requests  = {}

local _stats = {
  total_checked  = 0,
  total_blocked  = 0,
  total_allowed  = 0,
  method_blocked = 0,
  size_blocked   = 0,
  header_blocked = 0,
  ip_blocked     = 0,
  param_blocked  = 0,
}

-- ─── HELPERS ─────────────────────────────────────────────────────────────────
local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ✅ Normalise les clés d'un tableau de headers en lowercase.
--    HTTP est case-insensitive ; sans ça, `X-Troxt-Key` ne matche pas `x-troxt-key`.
local function normalize_headers(headers)
  local normalized = {}
  if type(headers) ~= "table" then return normalized end
  for k, v in pairs(headers) do
    if type(k) == "string" then
      normalized[k:lower()] = v
    end
  end
  return normalized
end

local function hit_rule(rule_name)
  _rule_hits[rule_name] = (_rule_hits[rule_name] or 0) + 1
end

local function log_block(ip, rule, endpoint, detail)
  table.insert(_blocked_requests, 1, {
    ts       = os.time(),
    date     = os.date("%H:%M:%S"),
    ip       = ip,
    rule     = rule,
    endpoint = endpoint,
    detail   = detail,
  })
  if #_blocked_requests > 500 then table.remove(_blocked_requests) end
  hit_rule(rule)
  Events.emit("intellectus:firewall_block", {
    ip=ip, rule=rule, endpoint=endpoint, detail=detail,
  })
end

local function is_whitelisted(ip)
  if type(ip) ~= "string" then return false end
  for _, wip in ipairs(RULES.whitelist) do
    if ip == wip then return true end
  end
  if _dynamic_whitelist[ip] then return true end
  return false
end

local function is_blacklisted(ip)
  if type(ip) ~= "string" then return false end
  for _, bip in ipairs(RULES.blacklist) do
    if ip == bip then return true, "blacklist_statique" end
  end
  if _dynamic_blacklist[ip] then
    return true, _dynamic_blacklist[ip].reason
  end
  return false
end

-- ✅ Match par préfixe le plus long (déterministe, plus spécifique gagne)
local function find_prefix_match(tbl, endpoint, exclude_key)
  local best_key, best_val = nil, nil
  for key, val in pairs(tbl) do
    if key ~= exclude_key and type(key) == "string"
       and endpoint:sub(1, #key) == key then
      if not best_key or #key > #best_key then
        best_key, best_val = key, val
      end
    end
  end
  return best_val
end

local function get_allowed_methods(endpoint)
  return RULES.allowed_methods[endpoint]
      or find_prefix_match(RULES.allowed_methods, endpoint, "DEFAULT")
      or RULES.allowed_methods["DEFAULT"]
end

local function get_max_body(endpoint)
  return RULES.max_body_size[endpoint]
      or find_prefix_match(RULES.max_body_size, endpoint, "DEFAULT")
      or RULES.max_body_size["DEFAULT"]
end

local function get_required_headers(endpoint)
  return RULES.required_headers[endpoint]
      or find_prefix_match(RULES.required_headers, endpoint)
      or {}
end

-- ─── VÉRIFICATION PRINCIPALE ─────────────────────────────────────────────────
function Firewall.check(request)
  _stats.total_checked = _stats.total_checked + 1

  local ip       = request.ip       or "unknown"
  local method   = request.method   or "GET"
  local endpoint = request.endpoint or "/"
  local headers  = normalize_headers(request.headers)

  -- 1. Whitelist — passage immédiat
  if is_whitelisted(ip) then
    _stats.total_allowed = _stats.total_allowed + 1
    return { allowed=true, reason="WHITELISTED" }
  end

  -- 2. Blacklist
  local blk, blk_reason = is_blacklisted(ip)
  if blk then
    _stats.total_blocked = _stats.total_blocked + 1
    _stats.ip_blocked    = _stats.ip_blocked + 1
    log_block(ip, "BLACKLIST", endpoint, blk_reason)
    return { allowed=false, reason="BLACKLISTED", detail=blk_reason }
  end

  -- 3. Méthode HTTP
  local allowed_methods = get_allowed_methods(endpoint)
  local method_ok = false
  for _, m in ipairs(allowed_methods) do
    if m == method then method_ok = true break end
  end
  if not method_ok then
    _stats.total_blocked  = _stats.total_blocked + 1
    _stats.method_blocked = _stats.method_blocked + 1
    log_block(ip, "METHOD_NOT_ALLOWED", endpoint, method)
    return {
      allowed = false,
      reason  = "METHOD_NOT_ALLOWED",
      detail  = string.format("Méthode %s non autorisée sur %s", method, endpoint),
    }
  end

  -- 4. Taille du body
  if request.body_size then
    local max = get_max_body(endpoint)
    if request.body_size > max then
      _stats.total_blocked = _stats.total_blocked + 1
      _stats.size_blocked  = _stats.size_blocked + 1
      log_block(ip, "BODY_TOO_LARGE", endpoint,
        string.format("%d bytes (max: %d)", request.body_size, max))
      return {
        allowed = false,
        reason  = "BODY_TOO_LARGE",
        detail  = string.format("Body %d bytes — max autorisé: %d bytes",
          request.body_size, max),
      }
    end
  end

  -- 5. Content-Type (uniquement pour méthodes non-GET)
  if request.content_type and method ~= "GET" then
    local ct = request.content_type:lower():match("^([^;]+)")
    if not ct then
      -- Content-Type malformé → bloqué
      _stats.total_blocked  = _stats.total_blocked + 1
      _stats.header_blocked = _stats.header_blocked + 1
      log_block(ip, "INVALID_CONTENT_TYPE", endpoint,
        tostring(request.content_type))
      return { allowed=false, reason="INVALID_CONTENT_TYPE",
               detail="Content-Type malformé" }
    end
    local ct_ok = false
    for _, allowed_ct in ipairs(RULES.allowed_content_types) do
      if ct == allowed_ct then ct_ok = true break end
    end
    if not ct_ok then
      _stats.total_blocked  = _stats.total_blocked + 1
      _stats.header_blocked = _stats.header_blocked + 1
      log_block(ip, "INVALID_CONTENT_TYPE", endpoint, ct)
      return { allowed=false, reason="INVALID_CONTENT_TYPE", detail=ct }
    end
  end

  -- 6. Headers obligatoires (avec headers normalisés en lowercase)
  local req_headers = get_required_headers(endpoint)
  for _, h in ipairs(req_headers) do
    if not headers[h:lower()] then
      _stats.total_blocked  = _stats.total_blocked + 1
      _stats.header_blocked = _stats.header_blocked + 1
      log_block(ip, "MISSING_HEADER", endpoint, "Header manquant: " .. h)
      return { allowed=false, reason="MISSING_HEADER",
               detail="Header requis: " .. h }
    end
  end

  -- 7. Headers interdits
  for _, fh in ipairs(RULES.forbidden_headers) do
    if headers[fh] then
      _stats.total_blocked  = _stats.total_blocked + 1
      _stats.header_blocked = _stats.header_blocked + 1
      log_block(ip, "FORBIDDEN_HEADER", endpoint, fh)
      Events.emit("intellectus:suspicious_header",
        { ip=ip, header=fh, endpoint=endpoint })
      return { allowed=false, reason="FORBIDDEN_HEADER",
               detail="Header interdit détecté: " .. fh }
    end
  end

  -- 8. Paramètres GET interdits
  if request.params then
    for _, fp in ipairs(RULES.forbidden_params) do
      if request.params[fp] ~= nil then
        _stats.total_blocked = _stats.total_blocked + 1
        _stats.param_blocked = _stats.param_blocked + 1
        log_block(ip, "FORBIDDEN_PARAM", endpoint, "Param: " .. fp)
        Events.emit("intellectus:forbidden_param",
          { ip=ip, param=fp, endpoint=endpoint })
        return { allowed=false, reason="FORBIDDEN_PARAM",
                 detail="Paramètre interdit: " .. fp }
      end
    end
  end

  _stats.total_allowed = _stats.total_allowed + 1
  return { allowed=true, reason="OK" }
end

-- ─── GESTION BLACKLIST DYNAMIQUE ─────────────────────────────────────────────
function Firewall.blacklist_ip(ip, reason, permanent)
  if type(ip) ~= "string" or #ip == 0 then
    return false, "IP invalide"
  end
  if is_whitelisted(ip) then
    print("[FIREWALL] Refus blacklist — IP whitelistée: " .. ip)
    return false, "IP whitelistée"
  end

  _dynamic_blacklist[ip] = {
    reason    = reason or "règle dynamique",
    added_at  = os.time(),
    permanent = permanent or false,
  }

  -- ✅ FIX : `permanent and nil or 86400` renvoyait TOUJOURS 86400 (logique Lua
  --    cassée : `true and nil` = nil, puis `nil or 86400` = 86400).
  local ttl
  if permanent then ttl = nil else ttl = 86400 end
  Memory.set("firewall:blacklist:" .. ip, _dynamic_blacklist[ip],
    ttl and { ttl = ttl } or {})

  Events.emit("intellectus:ip_blacklisted",
    { ip=ip, reason=reason, permanent=permanent })
  print(string.format("[FIREWALL] 🚫 IP blacklistée: %s — %s",
    ip, reason or ""))
  return true
end

function Firewall.whitelist_ip(ip, reason)
  if type(ip) ~= "string" or #ip == 0 then
    return false, "IP invalide"
  end
  _dynamic_whitelist[ip] = {
    reason   = reason or "whitelist manuel",
    added_at = os.time(),
  }
  _dynamic_blacklist[ip] = nil
  Memory.delete("firewall:blacklist:" .. ip)
  Events.emit("intellectus:ip_whitelisted", { ip=ip, reason=reason })
  print(string.format("[FIREWALL] ✓ IP whitelistée: %s — %s",
    ip, reason or ""))
  return true
end

function Firewall.remove_blacklist(ip)
  if type(ip) ~= "string" then return false end
  _dynamic_blacklist[ip] = nil
  Memory.delete("firewall:blacklist:" .. ip)
  Events.emit("intellectus:ip_unblacklisted", { ip=ip })
  return true
end

-- ─── RÈGLES DYNAMIQUES ───────────────────────────────────────────────────────
function Firewall.add_method_rule(endpoint, methods)
  if type(endpoint) ~= "string" or type(methods) ~= "table" then
    return false, "Arguments invalides"
  end
  RULES.allowed_methods[endpoint] = methods
  Events.emit("intellectus:firewall_rule_added",
    { type="method", endpoint=endpoint, methods=methods })
  return true
end

function Firewall.set_max_body(endpoint, bytes)
  if type(endpoint) ~= "string" or type(bytes) ~= "number" then
    return false, "Arguments invalides"
  end
  RULES.max_body_size[endpoint] = bytes
  return true
end

-- ─── NETTOYAGE ───────────────────────────────────────────────────────────────
function Firewall.cleanup()
  local cleaned = 0
  local bl_keys = Memory.list("firewall")
  for _, entry in ipairs(bl_keys) do
    if entry.key:match("^firewall:blacklist:") then
      local ip   = entry.key:match("^firewall:blacklist:(.+)$")
      local data = Memory.get(entry.key)
      if data and not _dynamic_blacklist[ip] then
        _dynamic_blacklist[ip] = data
      elseif not data then
        _dynamic_blacklist[ip] = nil
        cleaned = cleaned + 1
      end
    end
  end
  return cleaned
end

-- ─── STATS ───────────────────────────────────────────────────────────────────
function Firewall.get_stats()
  local rate = "0%"
  if _stats.total_checked > 0 then
    rate = string.format("%.1f%%",
      _stats.total_blocked / _stats.total_checked * 100)
  end

  return {
    total_checked   = _stats.total_checked,
    total_blocked   = _stats.total_blocked,
    total_allowed   = _stats.total_allowed,
    block_rate      = rate,
    method_blocked  = _stats.method_blocked,
    size_blocked    = _stats.size_blocked,
    header_blocked  = _stats.header_blocked,
    ip_blocked      = _stats.ip_blocked,
    param_blocked   = _stats.param_blocked,
    blacklisted_ips = count_keys(_dynamic_blacklist),
    whitelisted_ips = count_keys(_dynamic_whitelist),
    rule_hits       = _rule_hits,
  }
end

function Firewall.get_blocked_log(limit)
  limit = limit or 50
  local result = {}
  for i = 1, math.min(limit, #_blocked_requests) do
    table.insert(result, _blocked_requests[i])
  end
  return result
end

function Firewall.get_blacklist()
  local result = {}
  for ip, data in pairs(_dynamic_blacklist) do
    table.insert(result, {
      ip        = ip,
      reason    = data.reason,
      added_at  = os.date("%H:%M:%S", data.added_at),
      permanent = data.permanent,
    })
  end
  return result
end

function Firewall.get_signature() return "🛡️ FIREWALL" end

-- ─── BOOT : charger la blacklist persistante ─────────────────────────────────
do
  local saved = Memory.list("firewall")
  for _, entry in ipairs(saved) do
    if entry.key:match("^firewall:blacklist:") then
      local ip   = entry.key:match("^firewall:blacklist:(.+)$")
      local data = Memory.get(entry.key)
      if data then _dynamic_blacklist[ip] = data end
    end
  end
  print(string.format("[🛡️ FIREWALL] Initialisé — %d IPs blacklistées",
    count_keys(_dynamic_blacklist)))
end

return Firewall
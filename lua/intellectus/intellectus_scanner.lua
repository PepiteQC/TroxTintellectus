--[[
══════════════════════════════════════════════════════════════════════
  INTELLECTUS_SCANNER.LUA — Analyse comportementale et détection avancée
  Fingerprinting · Anomalie · DDoS · Bot detection · Pattern analysis
  Chemin : lua/intellectus/intellectus_scanner.lua
══════════════════════════════════════════════════════════════════════
]]

local Scanner = {}
local Events  = require("troxt.troxt_events")
local Memory  = require("troxt.troxt_memory")

local CFG = {
  window_short  = 60,
  window_medium = 300,
  window_long   = 3600,

  thresholds = {
    ddos_req_per_sec    = 50,
    scan_endpoints      = 20,
    error_rate_pct      = 60,
    ua_rotations        = 10,
    payload_size_kb     = 512,
    rapid_auth_attempts = 10,
    endpoint_entropy    = 15,
    geo_jump_km         = 5000,
  },

  bad_ua_patterns = {
    "sqlmap", "nikto", "nmap", "masscan", "zgrab",
    "python-requests", "go-http-client", "curl/", "wget/",
    "dirbuster", "gobuster", "wfuzz", "hydra", "metasploit",
    "burpsuite", "owasp", "nessus", "openvas",
  },

  suspicious_headers = {
    "x-forwarded-for", "x-originating-ip", "x-remote-ip",
    "x-cluster-client-ip", "forwarded",
  },

  max_behavior_entries = 100,
  analysis_interval    = 30,
}

local _behaviors     = {}
local _alerts        = {}
local _last_analysis = 0
local _stats = {
  analyzed = 0, alerts = 0,
  ddos_det = 0, bot_det = 0, scan_det = 0,
}

local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── ENREGISTRER UNE REQUÊTE ─────────────────────────────────────────────────
function Scanner.record_request(ip, request)
  if type(ip) ~= "string" or #ip == 0 then return end
  request = request or {}

  if not _behaviors[ip] then
    _behaviors[ip] = {
      ip               = ip,
      first_seen       = os.time(),
      last_seen        = os.time(),
      requests         = {},
      endpoints        = {},
      user_agents      = {},
      status_codes     = {},
      total_req        = 0,
      error_req        = 0,
      payload_total_kb = 0,
    }
  end

  local b   = _behaviors[ip]
  local now = os.time()
  b.last_seen = now
  b.total_req = b.total_req + 1

  table.insert(b.requests, 1, {
    ts           = now,
    endpoint     = request.endpoint or "/",
    method       = request.method or "GET",
    status       = request.status or 0,
    ua           = request.ua or "unknown",
    payload_size = request.payload_size or 0,
  })
  while #b.requests > CFG.max_behavior_entries do table.remove(b.requests) end

  local ep = request.endpoint or "/"
  b.endpoints[ep] = (b.endpoints[ep] or 0) + 1

  local ua = request.ua or "unknown"
  b.user_agents[ua] = (b.user_agents[ua] or 0) + 1

  local status = tostring(request.status or 0)
  b.status_codes[status] = (b.status_codes[status] or 0) + 1
  if request.status and request.status >= 400 then
    b.error_req = b.error_req + 1
  end

  if request.payload_size then
    b.payload_total_kb = b.payload_total_kb + (request.payload_size / 1024)
  end
end

-- ─── ANALYSE D'UNE IP ────────────────────────────────────────────────────────
function Scanner.analyze_ip(ip)
  local b = _behaviors[ip]
  if not b then return nil end

  _stats.analyzed = _stats.analyzed + 1
  local now    = os.time()
  local alerts = {}

  local req_last_min       = 0
  local endpoints_last_min = {}
  local ua_last_min        = {}

  for _, req in ipairs(b.requests) do
    if now - req.ts <= CFG.window_short then
      req_last_min = req_last_min + 1
      endpoints_last_min[req.endpoint] = true
      ua_last_min[req.ua] = true
    end
  end

  local endpoint_count_min = count_keys(endpoints_last_min)
  local ua_count_min       = count_keys(ua_last_min)

  -- DDoS
  local req_per_sec = req_last_min / 60.0
  if req_per_sec >= CFG.thresholds.ddos_req_per_sec then
    table.insert(alerts, {
      type="ddos_pattern", level=5,
      detail=string.format("%.0f req/sec (seuil: %d)",
        req_per_sec, CFG.thresholds.ddos_req_per_sec),
    })
    _stats.ddos_det = _stats.ddos_det + 1
  end

  -- Scan d'endpoints
  if endpoint_count_min >= CFG.thresholds.scan_endpoints then
    table.insert(alerts, {
      type="mass_scan", level=3,
      detail=string.format("%d endpoints uniques en 1min", endpoint_count_min),
    })
    _stats.scan_det = _stats.scan_det + 1
  end

  -- Rotation UA
  if ua_count_min >= CFG.thresholds.ua_rotations then
    table.insert(alerts, {
      type="ua_rotation", level=3,
      detail=string.format("%d user-agents différents en 1min", ua_count_min),
    })
    _stats.bot_det = _stats.bot_det + 1
  end

  -- Taux d'erreur
  if b.total_req > 10 then
    local error_pct = (b.error_req / b.total_req) * 100
    if error_pct >= CFG.thresholds.error_rate_pct then
      table.insert(alerts, {
        type="high_error_rate", level=2,
        detail=string.format("%.0f%% d'erreurs (seuil: %d%%)",
          error_pct, CFG.thresholds.error_rate_pct),
      })
    end
  end

  -- Payload excessif
  if b.payload_total_kb > CFG.thresholds.payload_size_kb * 10 then
    table.insert(alerts, {
      type="excessive_payload", level=2,
      detail=string.format("%.0fKB total envoyé", b.payload_total_kb),
    })
  end

  -- Bad user-agent
  for ua in pairs(b.user_agents) do
    local ua_lower = ua:lower()
    for _, bad in ipairs(CFG.bad_ua_patterns) do
      if ua_lower:find(bad, 1, true) then
        table.insert(alerts, {
          type="malicious_ua", level=3,
          detail="User-agent suspect: " .. ua:sub(1, 50),
        })
        break
      end
    end
  end

  -- Émettre
  for _, alert in ipairs(alerts) do
    _stats.alerts = _stats.alerts + 1
    table.insert(_alerts, 1, {
      ip=ip, type=alert.type, level=alert.level, detail=alert.detail,
      ts=now, date=os.date("%H:%M:%S"),
    })
    Events.emit("intellectus:behavior_alert", {
      ip=ip, type=alert.type, level=alert.level, detail=alert.detail,
    })
  end
  while #_alerts > 500 do table.remove(_alerts) end

  return {
    ip=ip, total_req=b.total_req, req_per_min=req_last_min, req_per_sec=req_per_sec,
    endpoints=endpoint_count_min, ua_count=ua_count_min,
    error_pct=b.total_req > 0 and (b.error_req / b.total_req * 100) or 0,
    alerts=alerts, risk_score=Scanner.calc_risk_score(ip, alerts),
  }
end

-- ─── SCORE DE RISQUE ─────────────────────────────────────────────────────────
function Scanner.calc_risk_score(ip, alerts)
  local score = 0
  alerts = alerts or {}
  local level_points = { [1]=5, [2]=15, [3]=25, [4]=40, [5]=60 }
  for _, alert in ipairs(alerts) do
    score = score + (level_points[alert.level] or 5)
  end
  local b = _behaviors[ip]
  if b then
    local past_alerts = 0
    for _, a in ipairs(_alerts) do
      if a.ip == ip then past_alerts = past_alerts + 1 end
    end
    score = score + past_alerts * 2
  end
  return math.min(100, score)
end

-- ─── ANALYSE DE MASSE ────────────────────────────────────────────────────────
function Scanner.analyze_all()
  local now = os.time()
  if now - _last_analysis < CFG.analysis_interval then return {} end
  _last_analysis = now

  local results  = {}
  local to_clean = {}

  -- ✅ FIX : on itère une COPIE des clés — modifier _behaviors pendant le
  --    pairs() est un comportement indéfini en Lua (bug réel : la boucle
  --    pouvait sauter des IPs ou crasher aléatoirement).
  local keys = {}
  for ip in pairs(_behaviors) do table.insert(keys, ip) end

  for _, ip in ipairs(keys) do
    local b = _behaviors[ip]
    if not b then goto continue end
    if (now - b.last_seen) <= 600 then
      local result = Scanner.analyze_ip(ip)
      if result and #result.alerts > 0 then
        table.insert(results, result)
      end
    else
      table.insert(to_clean, ip)
    end
    ::continue::
  end

  for _, ip in ipairs(to_clean) do _behaviors[ip] = nil end

  if #results > 0 then
    Events.emit("intellectus:scan_complete", {
      analyzed    = count_keys(_behaviors),
      with_alerts = #results,
      top_risk    = results[1] and results[1].ip or nil,
    })
  end

  return results
end

-- ─── FINGERPRINT ─────────────────────────────────────────────────────────────
function Scanner.fingerprint_ip(ip)
  local b = _behaviors[ip]
  if not b then return nil end

  local now     = os.time()
  local age_sec = now - b.first_seen
  local top_ep, max_ep = nil, 0

  for ep, cnt in pairs(b.endpoints) do
    if cnt > max_ep then max_ep = cnt; top_ep = ep end
  end

  local ua_list = {}
  for ua, cnt in pairs(b.user_agents) do
    table.insert(ua_list, { ua=ua, count=cnt })
  end
  table.sort(ua_list, function(x, y) return x.count > y.count end)

  return {
    ip               = ip,
    first_seen       = os.date("%H:%M:%S", b.first_seen),
    last_seen        = os.date("%H:%M:%S", b.last_seen),
    age_sec          = age_sec,
    total_requests   = b.total_req,
    error_requests   = b.error_req,
    unique_endpoints = count_keys(b.endpoints),
    top_endpoint     = top_ep,
    primary_ua       = ua_list[1] and ua_list[1].ua or "unknown",
    ua_count         = #ua_list,
    payload_kb       = b.payload_total_kb,
    risk_score       = Scanner.calc_risk_score(ip, {}),
  }
end

-- ─── API ─────────────────────────────────────────────────────────────────────
function Scanner.get_alerts(limit, min_level)
  limit     = limit or 50
  min_level = min_level or 1
  local result = {}
  for _, a in ipairs(_alerts) do
    if a.level >= min_level then
      table.insert(result, a)
      if #result >= limit then break end
    end
  end
  return result
end

function Scanner.get_active_ips()
  local result, now = {}, os.time()
  for ip, b in pairs(_behaviors) do
    if now - b.last_seen <= 300 then
      table.insert(result, {
        ip=ip, req=b.total_req, last_sec=now - b.last_seen,
        risk=Scanner.calc_risk_score(ip, {}),
      })
    end
  end
  table.sort(result, function(a, b) return a.risk > b.risk end)
  return result
end

function Scanner.get_stats()
  return {
    tracked_ips  = count_keys(_behaviors),
    total_alerts = #_alerts,
    analyzed     = _stats.analyzed,
    ddos_det     = _stats.ddos_det,
    bot_det      = _stats.bot_det,
    scan_det     = _stats.scan_det,
  }
end

function Scanner.get_signature() return "🛡️ SCANNER" end

print("[SCANNER] Intellectus Scanner actif")
return Scanner
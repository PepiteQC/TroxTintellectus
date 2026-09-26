--[[
══════════════════════════════════════════════════════════════════════
  🛡️INTELLECTUS⬡ — INTELLECTUS_RATELIMIT.LUA
  Système de rate limiting avancé TroxtWorld
  Fenêtres glissantes · Quotas · Throttling · Burst · Par joueur

  Chemin : lua/intellectus/intellectus_ratelimit.lua
══════════════════════════════════════════════════════════════════════
]]

local RateLimit = {}
local Events    = require("troxt.troxt_events")
local Memory    = require("troxt.troxt_memory")

local SIG   = "🛡️INTELLECTUS⬡"
local TROXT = "TROXT⬡"

local function log(level, msg)
  local icons = { INFO="ℹ", WARN="⚠", ERROR="✖", OK="✓" }
  print(string.format("[%s] %s [%s] %s", os.date("%H:%M:%S"), icons[level] or "·", SIG, msg))
end

local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── PROFILS DE LIMITE ────────────────────────────────────────────────────────
local PROFILES = {
  ip_default   = { label="IP par défaut",       window_sec=60,   max_requests=100,  burst_limit=20,  burst_window=5,  penalty_sec=60,   hard_block_at=5  },
  ip_strict    = { label="IP stricte (admin)",  window_sec=60,   max_requests=20,   burst_limit=5,   burst_window=5,  penalty_sec=300,  hard_block_at=3  },
  ip_api       = { label="IP API standard",     window_sec=60,   max_requests=200,  burst_limit=40,  burst_window=5,  penalty_sec=30,   hard_block_at=10 },
  ip_websocket = { label="IP WebSocket",        window_sec=60,   max_requests=500,  burst_limit=100, burst_window=5,  penalty_sec=10,   hard_block_at=20 },
  player_default = { label="Joueur standard",   window_sec=60,   max_requests=300,  burst_limit=50,  burst_window=5,  penalty_sec=30,   hard_block_at=10 },
  player_vip     = { label="Joueur VIP",        window_sec=60,   max_requests=600,  burst_limit=100, burst_window=5,  penalty_sec=15,   hard_block_at=20 },
  player_admin   = { label="Admin joueur",      window_sec=60,   max_requests=1000, burst_limit=200, burst_window=5,  penalty_sec=0,    hard_block_at=100 },
  endpoint_auth  = { label="Endpoint auth",     window_sec=300,  max_requests=10,   burst_limit=3,   burst_window=10, penalty_sec=900,  hard_block_at=2  },
  endpoint_prism = { label="TroxtPrism",        window_sec=60,   max_requests=200,  burst_limit=30,  burst_window=5,  penalty_sec=60,   hard_block_at=5  },
  endpoint_assets= { label="Assets upload",     window_sec=3600, max_requests=50,   burst_limit=5,   burst_window=30, penalty_sec=300,  hard_block_at=3  },
}

local ENDPOINT_PROFILES = {
  ["/api/auth"]      = "endpoint_auth",
  ["/api/admin"]     = "ip_strict",
  ["/api/prism"]     = "endpoint_prism",
  ["/api/platforms"] = "ip_api",
  ["/assets/upload"] = "endpoint_assets",
  ["/troxt"]         = "ip_strict",
  ["/intellectus"]   = "ip_strict",
  ["ws://"]          = "ip_websocket",
  ["DEFAULT"]        = "ip_default",
}

-- ─── ÉTAT ─────────────────────────────────────────────────────────────────────
local _buckets   = {}
local _penalties = {}
local _quotas    = {}

local _stats = {
  total_checked   = 0,
  total_allowed   = 0,
  total_limited   = 0,
  total_penalized = 0,
  violations      = 0,
  hard_blocks     = 0,
}

-- ─── UTILITAIRES ─────────────────────────────────────────────────────────────
local function get_profile(profile_name)
  return PROFILES[profile_name] or PROFILES.ip_default
end

local function get_endpoint_profile(endpoint)
  if type(endpoint) ~= "string" then return "ip_default" end
  if ENDPOINT_PROFILES[endpoint] then return ENDPOINT_PROFILES[endpoint] end
  -- ✅ Préfixe le plus long (déterministe)
  local best_key, best_val = nil, nil
  for prefix, pname in pairs(ENDPOINT_PROFILES) do
    if prefix ~= "DEFAULT" and endpoint:sub(1, #prefix) == prefix then
      if not best_key or #prefix > #best_key then
        best_key, best_val = prefix, pname
      end
    end
  end
  return best_val or "ip_default"
end

local function get_or_create_bucket(key)
  if not _buckets[key] then
    _buckets[key] = {
      timestamps       = {},
      burst_timestamps = {},
      violations       = 0,
      created_at       = os.time(),
      last_request     = os.time(),
    }
  end
  return _buckets[key]
end

local function prune_timestamps(ts_list, window_sec)
  local cutoff = os.time() - window_sec
  local pruned = {}
  for _, ts in ipairs(ts_list) do
    if ts > cutoff then table.insert(pruned, ts) end
  end
  return pruned
end

-- ─── VÉRIFICATION PRINCIPALE ─────────────────────────────────────────────────
function RateLimit.check(key, endpoint, opts)
  opts = opts or {}
  if type(key) ~= "string" or #key == 0 then
    return { allowed = false, reason = "INVALID_KEY", sig = SIG }
  end

  _stats.total_checked = _stats.total_checked + 1

  local profile_name = opts.profile or get_endpoint_profile(endpoint or "DEFAULT")
  local profile      = get_profile(profile_name)
  local now          = os.time()

  -- Pénalité active ?
  local penalty = _penalties[key]
  if penalty and now < penalty.until_ts then
    _stats.total_penalized = _stats.total_penalized + 1
    return {
      allowed     = false,
      reason      = "RATE_PENALIZED",
      retry_after = penalty.until_ts - now,
      violations  = penalty.count,
      profile     = profile_name,
      sig         = SIG,
    }
  elseif penalty and now >= penalty.until_ts then
    _penalties[key] = nil
  end

  local bucket = get_or_create_bucket(key)
  bucket.last_request = now

  -- Fenêtre glissante
  bucket.timestamps = prune_timestamps(bucket.timestamps, profile.window_sec)
  local count       = #bucket.timestamps

  if count >= profile.max_requests then
    bucket.violations    = bucket.violations + 1
    _stats.total_limited = _stats.total_limited + 1
    _stats.violations    = _stats.violations + 1

    local oldest = bucket.timestamps[1] or now
    local retry  = oldest + profile.window_sec - now

    if bucket.violations >= profile.hard_block_at and profile.penalty_sec > 0 then
      _stats.hard_blocks = _stats.hard_blocks + 1
      _penalties[key] = {
        until_ts = now + profile.penalty_sec,
        count    = bucket.violations,
        profile  = profile_name,
        started  = now,
      }
      log("WARN", string.format("PÉNALITÉ DURE — %s [%s] %dv/%d dur:%ds",
        key, profile.label, bucket.violations, profile.hard_block_at, profile.penalty_sec))
      Events.emit("intellectus:rate_penalty", {
        key=key, profile=profile_name,
        violations=bucket.violations, duration=profile.penalty_sec, sig=SIG,
      })
    end

    Events.emit("intellectus:rate_limited", {
      key=key, profile=profile_name, count=count, max=profile.max_requests,
      violations=bucket.violations, sig=SIG,
    })

    return {
      allowed     = false,
      reason      = "RATE_EXCEEDED",
      count       = count,
      max         = profile.max_requests,
      retry_after = math.max(0, retry),
      violations  = bucket.violations,
      profile     = profile_name,
      sig         = SIG,
    }
  end

  -- Burst
  bucket.burst_timestamps = prune_timestamps(bucket.burst_timestamps, profile.burst_window)
  local burst_count       = #bucket.burst_timestamps

  if burst_count >= profile.burst_limit then
    _stats.total_limited = _stats.total_limited + 1
    Events.emit("intellectus:burst_detected", {
      key=key, burst_count=burst_count, limit=profile.burst_limit, sig=SIG,
    })
    return {
      allowed     = false,
      reason      = "BURST_EXCEEDED",
      burst_count = burst_count,
      burst_max   = profile.burst_limit,
      retry_after = profile.burst_window,
      profile     = profile_name,
      sig         = SIG,
    }
  end

  -- Tout passe
  table.insert(bucket.timestamps, now)
  table.insert(bucket.burst_timestamps, now)
  _stats.total_allowed = _stats.total_allowed + 1

  -- Atténuation des violations avec le temps
  if bucket.violations > 0 then
    local prev_ts = bucket.timestamps[#bucket.timestamps - 1]
    if prev_ts and (now - prev_ts) > profile.window_sec * 2 then
      bucket.violations = math.max(0, bucket.violations - 1)
    end
  end

  return {
    allowed    = true,
    count      = count + 1,
    remaining  = profile.max_requests - count - 1,
    reset_in   = profile.window_sec,
    burst_left = profile.burst_limit - burst_count - 1,
    profile    = profile_name,
    sig        = SIG,
  }
end

-- ─── QUOTA JOURNALIER ────────────────────────────────────────────────────────
function RateLimit.check_quota(player_id, action, quota_config)
  if type(player_id) ~= "string" or #player_id == 0 then
    return false, "INVALID_PLAYER_ID", nil
  end
  quota_config = quota_config or { daily=10000, hourly=1000 }
  local now    = os.time()

  if not _quotas[player_id] then
    _quotas[player_id] = {
      daily = 0, hourly = 0,
      daily_reset = now + 86400, hourly_reset = now + 3600,
    }
  end
  local q = _quotas[player_id]

  if now > q.daily_reset  then q.daily  = 0; q.daily_reset  = now + 86400 end
  if now > q.hourly_reset then q.hourly = 0; q.hourly_reset = now + 3600  end

  if q.daily >= quota_config.daily then
    return false, "QUOTA_DAILY_EXCEEDED", q.daily_reset - now
  end
  if q.hourly >= quota_config.hourly then
    return false, "QUOTA_HOURLY_EXCEEDED", q.hourly_reset - now
  end

  q.daily  = q.daily  + 1
  q.hourly = q.hourly + 1

  return true, nil, nil, {
    daily_used  = q.daily,  daily_left  = quota_config.daily  - q.daily,
    hourly_used = q.hourly, hourly_left = quota_config.hourly - q.hourly,
  }
end

-- ─── RESET ───────────────────────────────────────────────────────────────────
function RateLimit.reset(key)
  if type(key) ~= "string" then return false end
  _buckets[key]   = nil
  _penalties[key] = nil
  log("OK", "Bucket réinitialisé: " .. key)
  return true
end

function RateLimit.reset_player(player_id)
  if type(player_id) ~= "string" then return 0 end
  local count = 0
  for key, _ in pairs(_buckets) do
    if key:find(player_id, 1, true) then
      _buckets[key]   = nil
      _penalties[key] = nil
      count = count + 1
    end
  end
  _quotas[player_id] = nil
  log("OK", string.format("Buckets joueur réinitialisés: %s (%d)", player_id, count))
  return count
end

-- ─── NETTOYAGE ───────────────────────────────────────────────────────────────
function RateLimit.cleanup()
  local now, cleaned = os.time(), 0
  for key, bucket in pairs(_buckets) do
    if now - bucket.last_request > 600 then
      _buckets[key] = nil
      cleaned = cleaned + 1
    end
  end
  for key, pen in pairs(_penalties) do
    if now >= pen.until_ts then
      _penalties[key] = nil
      cleaned = cleaned + 1
    end
  end
  return cleaned
end

-- ─── STATS ───────────────────────────────────────────────────────────────────
function RateLimit.get_stats()
  local rate = "100%"
  if _stats.total_checked > 0 then
    rate = string.format("%.1f%%", _stats.total_allowed / _stats.total_checked * 100)
  end
  local profiles_list = {}
  for k in pairs(PROFILES) do table.insert(profiles_list, k) end

  return {
    sig             = SIG,
    total_checked   = _stats.total_checked,
    total_allowed   = _stats.total_allowed,
    total_limited   = _stats.total_limited,
    total_penalized = _stats.total_penalized,
    violations      = _stats.violations,
    hard_blocks     = _stats.hard_blocks,
    allow_rate      = rate,
    active_buckets  = count_keys(_buckets),
    penalized_keys  = count_keys(_penalties),
    profiles        = profiles_list,
  }
end

function RateLimit.get_penalized()
  local now, result = os.time(), {}
  for key, pen in pairs(_penalties) do
    if now < pen.until_ts then
      table.insert(result, {
        key=key, profile=pen.profile, violations=pen.count,
        remaining=pen.until_ts - now,
        until_str=os.date("%H:%M:%S", pen.until_ts),
      })
    end
  end
  return result
end

function RateLimit.get_profiles()         return PROFILES end
function RateLimit.get_mapping()          return ENDPOINT_PROFILES end
function RateLimit.get_signature()        return SIG end

function RateLimit.set_endpoint_profile(endpoint, profile_name)
  if type(endpoint) ~= "string" or not PROFILES[profile_name] then
    return false, "Profil ou endpoint invalide"
  end
  ENDPOINT_PROFILES[endpoint] = profile_name
  Events.emit("intellectus:ratelimit_config_changed", {
    endpoint=endpoint, profile=profile_name, sig=SIG,
  })
  log("OK", string.format("Profil endpoint mis à jour: %s → %s", endpoint, profile_name))
  return true
end

function RateLimit.create_profile(name, config)
  if type(name) ~= "string" or PROFILES[name] then
    return false, "Profil existant ou nom invalide"
  end
  config = config or {}
  PROFILES[name] = {
    label         = config.label or name,
    window_sec    = config.window_sec    or 60,
    max_requests  = config.max_requests  or 100,
    burst_limit   = config.burst_limit   or 20,
    burst_window  = config.burst_window  or 5,
    penalty_sec   = config.penalty_sec   or 60,
    hard_block_at = config.hard_block_at or 5,
  }
  log("OK", "Nouveau profil créé: " .. name)
  return true
end

log("OK", "[" .. SIG .. "] Rate Limit initialisé — " .. count_keys(PROFILES) .. " profils actifs")

return RateLimit
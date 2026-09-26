--[[
══════════════════════════════════════════════════════════════════════
  INTELLECTUS_AUTH.LUA — Système d'authentification TroxtWorld
  JWT · Sessions · Rôles · Permissions · 2FA · Tokens API

  Chemin : lua/intellectus/intellectus_auth.lua
══════════════════════════════════════════════════════════════════════
]]

local Auth   = {}
local Events = require("troxt.troxt_events")
local Memory = require("troxt.troxt_memory")

local CFG = {
  jwt_secret       = (os.getenv and os.getenv("TROXT_JWT_SECRET"))
                     or "TROXTWORLD_SECRET_CHANGE_IN_PROD_2024",
  api_key_prefix   = "TWK_",
  token_ttl_sec    = 86400,
  admin_token_ttl  = 3600,
  api_key_ttl      = 2592000,
  session_ttl_sec  = 7200,
  max_sessions_per_player = 3,
  max_api_keys_per_player = 5,
  max_tokens_total        = 10000,
  twofa_enabled    = false,
  twofa_code_len   = 6,
  twofa_expiry_sec = 300,

  roles = {
    guest = { level=0, permissions={ "world:view", "chat:read" } },
    player = { level=1, permissions={
      "world:view", "world:build", "world:interact",
      "chat:read", "chat:write",
      "inventory:read", "inventory:use",
      "bank:read", "bank:transfer",
      "apartment:enter", "apartment:rent",
    } },
    vip = { level=2, permissions={
      "world:view", "world:build", "world:interact", "world:build_advanced",
      "chat:read", "chat:write", "chat:format",
      "inventory:read", "inventory:use", "inventory:trade",
      "bank:read", "bank:transfer", "bank:loan",
      "apartment:enter", "apartment:rent", "apartment:own",
      "vehicle:drive", "vehicle:own",
    } },
    moderateur = { level=5, permissions={
      "world:*", "chat:*",
      "inventory:*", "bank:read",
      "player:kick", "player:mute", "player:warn",
      "apartment:*", "vehicle:*",
    } },
    admin = { level=9, permissions={
      "world:*", "chat:*", "inventory:*", "bank:*",
      "player:*", "apartment:*", "vehicle:*",
      "admin:read", "admin:write", "admin:metrics",
      "troxt:read", "intellectus:read",
      "prism:read", "prism:write",
    } },
    troxt_system = { level=10, permissions={ "*" } },
  },
}

local _tokens   = {}
local _sessions = {}
local _api_keys = {}
local _twofa    = {}
local _revoked  = {}

local _stats = {
  tokens_issued=0, tokens_validated=0, tokens_expired=0, tokens_revoked=0,
  auth_ok=0, auth_fail=0,
  sessions_opened=0, sessions_closed=0, api_keys_issued=0,
}

local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── UTILITAIRES ─────────────────────────────────────────────────────────────
local function gen_token(prefix, player_id, role)
  local now  = os.time()
  local rand = math.random(1000000000, 9999999999)
  local pid  = (player_id or "sys"):gsub("[^%w]", ""):sub(1, 8)
  return string.format("%s%s_%s_%d_%d", prefix or "TW_", pid, role or "p", now, rand)
end

local function gen_session_id()
  return string.format("SES_%d_%d", os.time(), math.random(100000, 999999))
end

local function has_permission(role_name, permission)
  local role = CFG.roles[role_name]
  if not role then return false end
  for _, perm in ipairs(role.permissions) do
    if perm == "*" then return true end
    if perm == permission then return true end
    local ns = perm:match("^([^:]+):%*$")
    if ns and permission:sub(1, #ns + 1) == ns .. ":" then return true end
  end
  return false
end

local function role_level(role_name)
  return (CFG.roles[role_name] and CFG.roles[role_name].level) or 0
end

-- ─── ÉMETTRE UN TOKEN ────────────────────────────────────────────────────────
function Auth.issue_token(player_id, role, opts)
  opts = opts or {}
  if type(player_id) ~= "string" or #player_id == 0 then
    return nil, "player_id requis"
  end
  role = role or "player"
  if not CFG.roles[role] then return nil, "Rôle invalide: " .. role end

  local is_admin = role_level(role) >= 9
  local ttl      = is_admin and CFG.admin_token_ttl or (opts.ttl or CFG.token_ttl_sec)
  local now      = os.time()
  local token    = gen_token("TW_", player_id, role)

  _tokens[token] = {
    token=token, player_id=player_id, role=role,
    issued_at=now, expires_at=now + ttl,
    ip=opts.ip, device=opts.device,
    last_used=now, use_count=0,
    scopes=opts.scopes or CFG.roles[role].permissions,
  }

  _stats.tokens_issued = _stats.tokens_issued + 1

  local player_tokens = Memory.get("auth:tokens:" .. player_id) or {}
  table.insert(player_tokens, 1, { token=token, issued_at=now, role=role })
  if #player_tokens > CFG.max_sessions_per_player then table.remove(player_tokens) end
  Memory.set("auth:tokens:" .. player_id, player_tokens, { ttl = ttl + 120 })

  Events.emit("intellectus:token_issued", {
    player_id=player_id, role=role, ttl=ttl, ip=opts.ip,
  })
  print(string.format("[🛡️ AUTH] Token émis — %s [%s] TTL:%ds", player_id, role, ttl))
  return token, nil
end

-- ─── VALIDER UN TOKEN ────────────────────────────────────────────────────────
function Auth.validate(token, opts)
  opts = opts or {}
  if type(token) ~= "string" or #token == 0 then
    return nil, "TOKEN_EMPTY"
  end
  _stats.tokens_validated = _stats.tokens_validated + 1

  if _revoked[token] then
    _stats.auth_fail = _stats.auth_fail + 1
    return nil, "TOKEN_REVOKED"
  end

  local info = _tokens[token]
  if not info then
    _stats.auth_fail = _stats.auth_fail + 1
    Events.emit("intellectus:auth_failed", {
      reason="TOKEN_UNKNOWN", ip=opts.ip, token=token:sub(1, 16) .. "...",
    })
    return nil, "TOKEN_UNKNOWN"
  end

  if os.time() > info.expires_at then
    _tokens[token]  = nil
    _revoked[token] = true
    _stats.tokens_expired = _stats.tokens_expired + 1
    _stats.auth_fail = _stats.auth_fail + 1
    Events.emit("intellectus:auth_failed", { reason="TOKEN_EXPIRED", ip=opts.ip })
    return nil, "TOKEN_EXPIRED"
  end

  if opts.require_permission then
    if not has_permission(info.role, opts.require_permission) then
      _stats.auth_fail = _stats.auth_fail + 1
      Events.emit("intellectus:auth_failed", {
        reason="INSUFFICIENT_PERMISSION",
        required=opts.require_permission, role=info.role,
        player_id=info.player_id, ip=opts.ip,
      })
      return nil, "INSUFFICIENT_PERMISSION"
    end
  end

  if opts.require_role then
    if role_level(info.role) < role_level(opts.require_role) then
      _stats.auth_fail = _stats.auth_fail + 1
      return nil, "ROLE_TOO_LOW"
    end
  end

  info.last_used = os.time()
  info.use_count = info.use_count + 1
  _stats.auth_ok = _stats.auth_ok + 1

  return {
    player_id=info.player_id, role=info.role, role_level=role_level(info.role),
    scopes=info.scopes, issued_at=info.issued_at, expires_at=info.expires_at,
    use_count=info.use_count, ttl_remaining=info.expires_at - os.time(),
  }, nil
end

-- ─── RÉVOQUER ────────────────────────────────────────────────────────────────
function Auth.revoke(token, reason)
  local info = _tokens[token]
  if not info then return false, "Token introuvable" end

  _revoked[token] = true
  _tokens[token]  = nil
  _stats.tokens_revoked = _stats.tokens_revoked + 1

  Events.emit("intellectus:token_revoked", {
    player_id=info.player_id, role=info.role, reason=reason or "manuel",
  })
  print(string.format("[🛡️ AUTH] Token révoqué — %s (%s)", info.player_id, reason or "manuel"))
  return true
end

function Auth.revoke_all_player(player_id, reason)
  local revoked = 0
  for token, info in pairs(_tokens) do
    if info.player_id == player_id then
      _revoked[token] = true
      _tokens[token]  = nil
      revoked = revoked + 1
    end
  end
  _stats.tokens_revoked = _stats.tokens_revoked + revoked
  if revoked > 0 then
    Events.emit("intellectus:player_tokens_revoked", {
      player_id=player_id, count=revoked, reason=reason,
    })
    print(string.format("[🛡️ AUTH] %d token(s) révoqué(s) — %s (%s)",
      revoked, player_id, reason or ""))
  end
  return revoked
end

-- ─── SESSIONS ────────────────────────────────────────────────────────────────
function Auth.open_session(player_id, token_info, ip, device)
  if type(player_id) ~= "string" then return nil, "player_id requis" end

  local player_sessions = {}
  for sid, sess in pairs(_sessions) do
    if sess.player_id == player_id and sess.active then
      table.insert(player_sessions, { sid=sid, sess=sess })
    end
  end

  if #player_sessions >= CFG.max_sessions_per_player then
    local oldest = player_sessions[#player_sessions]
    Auth.close_session(oldest.sid, "replaced_by_new")
  end

  local session_id = gen_session_id()
  local now        = os.time()

  _sessions[session_id] = {
    id=session_id, player_id=player_id,
    token=token_info and token_info.token or nil,
    role=token_info and token_info.role or "player",
    ip=ip, device=device,
    opened_at=now, last_active=now,
    expires_at=now + CFG.session_ttl_sec,
    active=true, actions=0,
  }

  _stats.sessions_opened = _stats.sessions_opened + 1
  Memory.set("auth:session:" .. session_id, _sessions[session_id],
    { ttl = CFG.session_ttl_sec + 60 })
  Events.emit("intellectus:session_opened", {
    session_id=session_id, player_id=player_id, ip=ip,
  })
  return session_id
end

function Auth.refresh_session(session_id)
  local sess = _sessions[session_id]
  if not sess or not sess.active then return false end
  if os.time() > sess.expires_at then
    Auth.close_session(session_id, "expired")
    return false
  end
  sess.last_active = os.time()
  sess.expires_at  = os.time() + CFG.session_ttl_sec
  sess.actions     = sess.actions + 1
  return true
end

function Auth.close_session(session_id, reason)
  local sess = _sessions[session_id]
  if not sess then return false end
  sess.active       = false
  sess.closed_at    = os.time()
  sess.close_reason = reason
  _stats.sessions_closed = _stats.sessions_closed + 1
  Memory.delete("auth:session:" .. session_id)
  Events.emit("intellectus:session_closed", {
    session_id=session_id, player_id=sess.player_id,
    reason=reason, duration=os.time() - sess.opened_at,
  })
  return true
end

function Auth.cleanup_sessions()
  local now, cleaned = os.time(), 0
  for id, sess in pairs(_sessions) do
    if sess.active and now > sess.expires_at then
      Auth.close_session(id, "expired")
      cleaned = cleaned + 1
    elseif not sess.active and (now - (sess.closed_at or now)) > 3600 then
      _sessions[id] = nil
    end
  end
  return cleaned
end

-- ─── CLÉS API ────────────────────────────────────────────────────────────────
function Auth.issue_api_key(player_id, role, description)
  if type(player_id) ~= "string" then return nil, "player_id requis" end

  local key = CFG.api_key_prefix .. gen_token("", player_id, "api")
  local now = os.time()

  _api_keys[key] = {
    key=key, player_id=player_id, role=role or "player",
    description=description or "Clé API TroxtWorld",
    issued_at=now, expires_at=now + CFG.api_key_ttl,
    last_used=nil, use_count=0, active=true,
  }

  _stats.api_keys_issued = _stats.api_keys_issued + 1
  Events.emit("intellectus:api_key_issued", { player_id=player_id, role=role })
  print(string.format("[🛡️ AUTH] Clé API émise — %s [%s]", player_id, role or "player"))
  return key
end

function Auth.validate_api_key(key, require_permission)
  local info = _api_keys[key]
  if not info or not info.active then return nil, "CLÉ_INVALIDE" end
  if os.time() > info.expires_at then
    info.active = false
    return nil, "CLÉ_EXPIRÉE"
  end
  if require_permission and not has_permission(info.role, require_permission) then
    return nil, "PERMISSION_INSUFFISANTE"
  end
  info.last_used = os.time()
  info.use_count = info.use_count + 1
  return { player_id=info.player_id, role=info.role, use_count=info.use_count }
end

function Auth.revoke_api_key(key)
  local info = _api_keys[key]
  if not info then return false end
  info.active = false
  return true
end

-- ─── 2FA ─────────────────────────────────────────────────────────────────────
function Auth.generate_2fa(player_id)
  if not CFG.twofa_enabled then return nil, "2FA_DISABLED" end
  local code = string.format("%0" .. CFG.twofa_code_len .. "d", math.random(0, 999999))
  _twofa[player_id] = { code=code, expires_at=os.time() + CFG.twofa_expiry_sec }
  Events.emit("intellectus:2fa_generated", { player_id=player_id })
  return code
end

function Auth.verify_2fa(player_id, code)
  if not CFG.twofa_enabled then return true end
  local entry = _twofa[player_id]
  if not entry then return false, "CODE_INEXISTANT" end
  if os.time() > entry.expires_at then
    _twofa[player_id] = nil
    return false, "CODE_EXPIRÉ"
  end
  if entry.code ~= code then return false, "CODE_INCORRECT" end
  _twofa[player_id] = nil
  return true
end

-- ─── API PUBLIQUE ────────────────────────────────────────────────────────────
function Auth.can(role, permission) return has_permission(role, permission) end

function Auth.get_role_info(role_name)
  local role = CFG.roles[role_name]
  if not role then return nil end
  return { name=role_name, level=role.level, permissions=role.permissions }
end

function Auth.list_roles()
  local roles = {}
  for name, role in pairs(CFG.roles) do
    table.insert(roles, { name=name, level=role.level, perm_count=#role.permissions })
  end
  table.sort(roles, function(a, b) return a.level < b.level end)
  return roles
end

-- ─── NETTOYAGE ───────────────────────────────────────────────────────────────
function Auth.cleanup()
  local now, cleaned = os.time(), 0

  for token, info in pairs(_tokens) do
    if now > info.expires_at then
      _revoked[token] = true
      _tokens[token]  = nil
      cleaned = cleaned + 1
      _stats.tokens_expired = _stats.tokens_expired + 1
    end
  end

  if count_keys(_revoked) > 10000 then _revoked = {} end

  for pid, entry in pairs(_twofa) do
    if now > entry.expires_at then _twofa[pid] = nil end
  end

  cleaned = cleaned + Auth.cleanup_sessions()
  return cleaned
end

-- ─── STATS ───────────────────────────────────────────────────────────────────
function Auth.get_stats()
  local active_sessions, active_keys = 0, 0
  for _, s in pairs(_sessions) do if s.active then active_sessions = active_sessions + 1 end end
  for _, k in pairs(_api_keys) do if k.active then active_keys = active_keys + 1 end end

  local total = _stats.auth_ok + _stats.auth_fail
  local success_rate = total > 0 and (_stats.auth_ok / total * 100) or 100

  return {
    active_tokens    = count_keys(_tokens),
    active_sessions  = active_sessions,
    active_api_keys  = active_keys,
    success_rate     = string.format("%.1f%%", success_rate),
    tokens_issued    = _stats.tokens_issued,
    tokens_revoked   = _stats.tokens_revoked,
    tokens_expired   = _stats.tokens_expired,
    auth_ok          = _stats.auth_ok,
    auth_fail        = _stats.auth_fail,
    sessions_opened  = _stats.sessions_opened,
    sessions_closed  = _stats.sessions_closed,
  }
end

function Auth.get_signature() return "🛡️ INTELLECTUS·AUTH" end

print("[🛡️ INTELLECTUS] Auth initialisé — " .. #Auth.list_roles() .. " rôles TroxtWorld")
return Auth
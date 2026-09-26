--[[
══════════════════════════════════════════════════════════════════════
  🛡️INTELLECTUS⬡ — INTELLECTUS_SIGNATURE.LUA
  Système de signature cryptographique d'Intellectus
  Signe · Vérifie · Scelle · Certifie chaque action sécurité

  Chemin : lua/intellectus/intellectus_signature.lua
══════════════════════════════════════════════════════════════════════
]]

local Signature = {}
local Events    = require("troxt.troxt_events")
local Memory    = require("troxt.troxt_memory")

local ID = {
  sig     = "🛡️INTELLECTUS⬡",
  troxt   = "TROXT⬡",
  version = "1.0.0",
  issuer  = "TroxtWorld Security Authority",
  started = os.time(),
}

local CFG = {
  master_key      = os.getenv and os.getenv("INTELLECTUS_MASTER_KEY")
                    or "INTELLECTUS_MASTER_2024_CHANGE_ME",
  cert_ttl_sec    = 86400,
  admin_cert_ttl  = 3600,
  system_cert_ttl = 86400 * 30,
  algo            = "HMAC-SHA256-SIM",
  max_signed      = 100000,
}

local _registry = {}
local _revoked  = {}
local _chain    = "INTELLECTUS_GENESIS"
local _seq      = 0
local _stats = {
  total_signed   = 0,
  total_verified = 0,
  total_revoked  = 0,
  verify_ok      = 0,
  verify_fail    = 0,
  certs_issued   = 0,
}

local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── HMAC SIMULÉ ─────────────────────────────────────────────────────────────
-- ⚠️  En production, remplacer par HMAC-SHA256 réel via binding C (OpenSSL/libsodium).
local function hmac_sim(data, key)
  local combined = tostring(data) .. tostring(key) .. tostring(#data)
  local h = 0x811c9dc5
  for i = 1, #combined do
    h = ((h ~ combined:byte(i)) * 0x01000193) % 0x100000000
  end
  local combined2 = string.format("%08x", h) .. key:sub(1, 8)
  local h2 = 0x811c9dc5
  for i = 1, #combined2 do
    h2 = ((h2 ~ combined2:byte(i)) * 0x01000193) % 0x100000000
  end
  return string.format("%08x%08x%08x%08x", h, h2, (h ~ h2), (h + h2) % 0x100000000)
end

local function generate_sig_id()
  _seq = _seq + 1
  return string.format("ISIG-%08d-%04x", _seq, math.random(0, 65535))
end

-- ✅ FIX CRITIQUE : `build_payload` incluait `os.time()`.
--    Résultat : signer à T puis vérifier à T+1s donnait un payload différent
--    → HMAC différent → vérification TOUJOURS fausse.
--    Maintenant le payload est 100% déterministe à partir des données.
local function build_payload(data, context)
  local parts = {
    "INTELLECTUS",
    tostring(context or "generic"),
    tostring(_seq),
  }
  if type(data) == "table" then
    for k, v in pairs(data) do
      table.insert(parts, tostring(k) .. "=" .. tostring(v))
    end
  else
    table.insert(parts, tostring(data))
  end
  table.sort(parts)
  return table.concat(parts, "|")
end

-- ─── SIGNER ──────────────────────────────────────────────────────────────────
function Signature.sign(data, context, opts)
  opts    = opts or {}
  context = context or "generic"

  local now     = os.time()
  local sig_id  = generate_sig_id()
  local payload = build_payload(data, context)
  local hmac    = hmac_sim(payload, CFG.master_key)
  local ttl     = opts.ttl or CFG.cert_ttl_sec

  _chain = hmac_sim(hmac .. _chain, CFG.master_key):sub(1, 16)

  local record = {
    id           = sig_id,
    sig          = ID.sig,
    troxt_sig    = ID.troxt,
    context      = context,
    issuer       = ID.issuer,
    version      = ID.version,
    algo         = CFG.algo,
    payload_hash = hmac_sim(payload, "PAYLOAD_HASH"),
    hmac         = hmac,
    chain_ref    = _chain,
    seq          = _seq,
    issued_at    = now,
    expires_at   = ttl and (now + ttl) or nil,
    issued_for   = opts.issued_for or "system",
    metadata     = opts.metadata or {},
    revoked      = false,
    verified_count = 0,
  }

  _registry[sig_id] = record
  _stats.total_signed = _stats.total_signed + 1

  if _stats.total_signed % 1000 == 0 then
    Signature.cleanup()
  end

  if opts.persist then
    Memory.set("intellectus:sig:" .. sig_id, {
      id=sig_id, context=context, hmac=hmac:sub(1,16).."...",
      issued_at=now, expires_at=record.expires_at, issued_for=record.issued_for,
    }, ttl and { ttl = ttl + 3600 } or {})
  end

  return {
    sig_id     = sig_id,
    signature  = ID.sig,
    hmac       = hmac,
    issued_at  = os.date("%Y-%m-%d %H:%M:%S", now),
    expires_at = record.expires_at and os.date("%Y-%m-%d %H:%M:%S", record.expires_at) or "permanent",
    context    = context,
    chain      = _chain:sub(1, 8) .. "...",
    algo       = CFG.algo,
    [ID.sig]   = true,
  }
end

-- ─── VÉRIFIER ────────────────────────────────────────────────────────────────
function Signature.verify(sig_id, data, context)
  _stats.total_verified = _stats.total_verified + 1

  local record = _registry[sig_id]
  if not record then
    _stats.verify_fail = _stats.verify_fail + 1
    Events.emit("intellectus:sig_verify_failed", {
      sig_id=sig_id, reason="NOT_FOUND", sig=ID.sig,
    })
    return false, "Signature introuvable: " .. tostring(sig_id)
  end

  if record.revoked or _revoked[sig_id] then
    _stats.verify_fail = _stats.verify_fail + 1
    return false, "Signature révoquée"
  end

  if record.expires_at and os.time() > record.expires_at then
    _stats.verify_fail = _stats.verify_fail + 1
    return false, "Signature expirée"
  end

  -- ⚠️ Reconstruire le payload à l'identique : _seq sera différent !
  --    On force _seq = record.seq pour la reconstruction.
  local saved_seq = _seq
  _seq = record.seq
  local payload = build_payload(data, context or record.context)
  _seq = saved_seq

  local expected = hmac_sim(payload, CFG.master_key)

  if expected ~= record.hmac then
    _stats.verify_fail = _stats.verify_fail + 1
    Events.emit("intellectus:sig_tamper_detected", {
      sig_id=sig_id, context=context, sig=ID.sig,
    })
    return false, "SIGNATURE_INVALIDE — Données potentiellement altérées"
  end

  record.verified_count = record.verified_count + 1
  _stats.verify_ok = _stats.verify_ok + 1

  return true, {
    sig_id=sig_id, context=record.context,
    issued_at=os.date("%Y-%m-%d %H:%M:%S", record.issued_at),
    issued_for=record.issued_for, verified=record.verified_count,
    chain=record.chain_ref:sub(1, 8) .. "...", sig=ID.sig,
  }
end

-- ─── RÉVOQUER ────────────────────────────────────────────────────────────────
function Signature.revoke(sig_id, reason, revoked_by)
  local record = _registry[sig_id]
  if not record then return false, "Signature introuvable" end

  record.revoked   = true
  _revoked[sig_id] = {
    reason=reason or "révocation manuelle",
    revoked_by=revoked_by or ID.sig,
    revoked_at=os.time(),
  }

  _stats.total_revoked = _stats.total_revoked + 1
  Memory.delete("intellectus:sig:" .. sig_id)
  Events.emit("intellectus:sig_revoked", {
    sig_id=sig_id, reason=reason, revoked_by=revoked_by, sig=ID.sig,
  })
  return true
end

function Signature.revoke_by_context(context, reason)
  local revoked = 0
  for id, rec in pairs(_registry) do
    if rec.context == context and not rec.revoked then
      Signature.revoke(id, reason)
      revoked = revoked + 1
    end
  end
  return revoked
end

-- ─── CERTIFICATS ─────────────────────────────────────────────────────────────
function Signature.issue_cert(entity_id, entity_type, role, opts)
  opts = opts or {}
  local ttl_map = {
    player  = CFG.cert_ttl_sec,
    admin   = CFG.admin_cert_ttl,
    system  = CFG.system_cert_ttl,
    service = CFG.system_cert_ttl,
  }
  local ttl = opts.ttl or ttl_map[entity_type] or CFG.cert_ttl_sec
  local now = os.time()

  local cert_data = {
    entity_id   = entity_id,
    entity_type = entity_type,
    role        = role,
    issued_at   = now,
    expires_at  = now + ttl,
    issuer      = ID.issuer,
    permissions = opts.permissions or {},
    ip          = opts.ip,
    device      = opts.device,
  }

  local sig_result = Signature.sign(cert_data, "certificate:" .. tostring(entity_type), {
    issued_for = entity_id,
    ttl        = ttl,
    persist    = true,
    metadata   = { role=role, entity_type=entity_type },
  })

  local cert = {
    cert_id     = sig_result.sig_id,
    entity_id   = entity_id,
    entity_type = entity_type,
    role        = role,
    issuer      = ID.issuer,
    issued_at   = now,
    expires_at  = now + ttl,
    ttl_sec     = ttl,
    permissions = opts.permissions or {},
    signature   = sig_result,
    [ID.sig]    = true,
    [ID.troxt]  = true,
  }

  _stats.certs_issued = _stats.certs_issued + 1
  Events.emit("intellectus:cert_issued", {
    cert_id=cert.cert_id, entity_id=entity_id,
    entity_type=entity_type, role=role, sig=ID.sig,
  })
  return cert
end

function Signature.verify_cert(cert)
  if not cert or not cert.cert_id then return false, "Certificat invalide" end
  if os.time() > cert.expires_at then return false, "Certificat expiré" end
  if _revoked[cert.cert_id] then return false, "Certificat révoqué" end

  local cert_data = {
    entity_id   = cert.entity_id,
    entity_type = cert.entity_type,
    role        = cert.role,
    issued_at   = cert.issued_at,
    expires_at  = cert.expires_at,
    issuer      = cert.issuer,
  }

  local ok, info = Signature.verify(cert.cert_id, cert_data, "certificate:" .. tostring(cert.entity_type))
  if not ok then return false, info end

  return true, {
    entity_id=cert.entity_id, role=cert.role,
    ttl_remaining=cert.expires_at - os.time(),
    permissions=cert.permissions, sig=ID.sig,
  }
end

-- ─── SCELLER UN CONTENU ──────────────────────────────────────────────────────
function Signature.seal(content, label, opts)
  opts = opts or {}
  local now    = os.time()
  local result = Signature.sign(content, "seal:" .. (label or "document"), {
    persist    = opts.persist,
    issued_for = opts.issued_for or "TroxtWorld",
    metadata   = { label=label, content_type=opts.content_type or "generic" },
    ttl        = opts.ttl,
  })

  local seal = {
    seal_id     = result.sig_id,
    label       = label or "Document TroxtWorld",
    sealed_at   = os.date("%Y-%m-%d %H:%M:%S", now),
    sealed_by   = ID.sig,
    troxt_sig   = ID.troxt,
    issuer      = ID.issuer,
    hmac        = result.hmac:sub(1, 16) .. "...",
    algo        = CFG.algo,
    chain       = result.chain,
    valid_until = result.expires_at,
    block = string.format(
      "\n══════════════════════════════════════\n" ..
      "  %s\n  %s\n  Document : %s\n  Scellé   : %s\n" ..
      "  HMAC     : %s\n  ID       : %s\n" ..
      "══════════════════════════════════════\n",
      ID.sig, ID.troxt, label or "N/A",
      os.date("%Y-%m-%d %H:%M:%S", now),
      result.hmac:sub(1, 16) .. "...", result.sig_id),
  }

  Events.emit("intellectus:content_sealed", {
    seal_id=seal.seal_id, label=label, sig=ID.sig,
  })
  return seal
end

function Signature.verify_seal(seal_id, content, label)
  return Signature.verify(seal_id, content, "seal:" .. (label or "document"))
end

-- ─── RAPPORT D'INTÉGRITÉ ─────────────────────────────────────────────────────
function Signature.integrity_report()
  local now = os.time()
  local valid, expired, revoked_ct = 0, 0, 0

  for id, rec in pairs(_registry) do
    if _revoked[id] or rec.revoked then
      revoked_ct = revoked_ct + 1
    elseif rec.expires_at and now > rec.expires_at then
      expired = expired + 1
    else
      valid = valid + 1
    end
  end

  return {
    sig=ID.sig, troxt=ID.troxt, issuer=ID.issuer, version=ID.version,
    algo=CFG.algo, generated_at=os.date("%Y-%m-%d %H:%M:%S"),
    uptime_sec=now - ID.started,
    chain_tip=_chain:sub(1, 8) .. "...",
    registry = { total=valid + expired + revoked_ct, valid=valid, expired=expired, revoked=revoked_ct },
    stats = _stats,
    health = valid > 0 and "OK" or "DÉGRADÉ",
  }
end

-- ─── NETTOYAGE ───────────────────────────────────────────────────────────────
function Signature.cleanup()
  local now, cleaned = os.time(), 0
  for id, rec in pairs(_registry) do
    local old_revoked = _revoked[id] and (now - _revoked[id].revoked_at > 86400)
    local is_expired  = rec.expires_at and now > rec.expires_at + 3600
    if old_revoked or is_expired then
      _registry[id] = nil
      cleaned = cleaned + 1
    end
  end
  for id, rev in pairs(_revoked) do
    if now - rev.revoked_at > 86400 * 7 then _revoked[id] = nil end
  end
  return cleaned
end

-- ─── HELPERS ─────────────────────────────────────────────────────────────────
function Signature.get_sig()    return ID.sig end
function Signature.get_troxt()  return ID.troxt end
function Signature.get_issuer() return ID.issuer end
function Signature.get_stats()  return _stats end
function Signature.get_chain()  return _chain:sub(1, 8) .. "..." end

function Signature.print_identity()
  print("")
  print("  " .. ID.sig)
  print("  " .. ID.troxt)
  print("  " .. ID.issuer)
  print("  Version : " .. ID.version)
  print("  Algo    : " .. CFG.algo)
  print("  Chain   : " .. _chain:sub(1, 8) .. "...")
  print("")
end

-- ─── INIT ────────────────────────────────────────────────────────────────────
Signature.print_identity()

Events.on("intellectus:sig_tamper_detected", function(d)
  print(string.format("[%s] 🔴 ALTÉRATION DÉTECTÉE — sig_id: %s context: %s",
    ID.sig, d.sig_id or "?", d.context or "?"))
end, { name="sig_tamper_handler", priority=0 })

return Signature
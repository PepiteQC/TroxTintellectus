--[[
══════════════════════════════════════════════════════════════════════
  TROXT_MEMORY.LUA — Mémoire persistante long-terme de TROXT
  Stockage clé-valeur avec TTL, versioning, namespaces et snapshots.
  Chemin : lua/troxt/troxt_memory.lua
══════════════════════════════════════════════════════════════════════
]]

local Memory = {}

-- ─── CONFIGURATION ───────────────────────────────────────────────────────────
local CONFIG = {
  max_entries       = 5000,
  max_key_len       = 128,
  max_value_size    = 65536,
  default_ttl_sec   = nil,
  snapshot_interval = 300,
  max_snapshots     = 10,
  persistence_file  = "troxt_memory.json",
  namespaces = {
    "troxt", "agent", "world", "player", "security", "schedule", "cache", "analytics",
  },
}

-- ─── STORE INTERNE ───────────────────────────────────────────────────────────
local _store      = {}
local _index      = {}
local _snapshots  = {}
local _stats = {
  reads=0, writes=0, deletes=0, hits=0, misses=0, evictions=0,
}
local _dirty         = false
local _last_snapshot = os.time()
local _version       = 0

-- ─── UTILITAIRES ─────────────────────────────────────────────────────────────
local function validate_key(key)
  if type(key) ~= "string" or #key == 0 then return false, "Clé invalide" end
  if #key > CONFIG.max_key_len then return false, "Clé trop longue" end
  if key:match("[^%w:._%-]") then return false, "Caractères invalides dans la clé" end
  return true
end

local function get_namespace(key)
  return key:match("^([^:]+):") or "default"
end

local function is_expired(entry)
  if not entry.ttl then return false end
  return os.time() > (entry.created_at + entry.ttl)
end

-- ✅ Supprime une clé du store ET de l'index namespace
local function unindex(key)
  local ns = get_namespace(key)
  if _index[ns] then _index[ns][key] = nil end
  _store[key] = nil
end

local function evict_expired()
  local evicted = 0
  for key, entry in pairs(_store) do
    if is_expired(entry) then
      unindex(key)
      evicted = evicted + 1
      _stats.evictions = _stats.evictions + 1
    end
  end
  return evicted
end

local function count_store()
  local n = 0
  for _ in pairs(_store) do n = n + 1 end
  return n
end

-- ─── ÉCRITURE ────────────────────────────────────────────────────────────────
function Memory.set(key, value, opts)
  opts = opts or {}
  local ok, err = validate_key(key)
  if not ok then
    print("[MEMORY] ERREUR set — " .. err .. " : " .. tostring(key))
    return false
  end

  -- Capacité
  if count_store() >= CONFIG.max_entries and not _store[key] then
    evict_expired()
    if count_store() >= CONFIG.max_entries then
      local oldest_key, oldest_time = nil, math.huge
      for k, e in pairs(_store) do
        if not k:match("^troxt:") and e.created_at < oldest_time then
          oldest_key  = k
          oldest_time = e.created_at
        end
      end
      if oldest_key then
        unindex(oldest_key)
        _stats.evictions = _stats.evictions + 1
      end
    end
  end

  local now      = os.time()
  local existing = _store[key]
  local version  = existing and (existing.version + 1) or 1

  _store[key] = {
    value      = value,
    created_at = existing and existing.created_at or now,
    updated_at = now,
    ttl        = opts.ttl or CONFIG.default_ttl_sec,
    version    = version,
    tags       = opts.tags or {},
    namespace  = get_namespace(key),
  }

  local ns = get_namespace(key)
  if not _index[ns] then _index[ns] = {} end
  _index[ns][key] = true

  _stats.writes = _stats.writes + 1
  _version      = _version + 1
  _dirty        = true

  return true, version
end

-- ─── LECTURE ─────────────────────────────────────────────────────────────────
function Memory.get(key, default)
  _stats.reads = _stats.reads + 1
  local ok = validate_key(key)
  if not ok then return default end

  local entry = _store[key]
  if not entry then
    _stats.misses = _stats.misses + 1
    return default
  end

  if is_expired(entry) then
    unindex(key)                              -- ✅ nettoie aussi _index
    _stats.misses    = _stats.misses + 1
    _stats.evictions = _stats.evictions + 1
    return default
  end

  _stats.hits = _stats.hits + 1
  return entry.value
end

-- ─── LECTURE AVEC MÉTADONNÉES ────────────────────────────────────────────────
function Memory.get_meta(key)
  local entry = _store[key]
  if not entry then return nil end
  if is_expired(entry) then unindex(key) return nil end
  return {
    value     = entry.value,
    version   = entry.version,
    created   = os.date("%H:%M:%S", entry.created_at),
    updated   = os.date("%H:%M:%S", entry.updated_at),
    ttl       = entry.ttl,
    namespace = entry.namespace,
    tags      = entry.tags,
    age_sec   = os.time() - entry.updated_at,
  }
end

-- ─── SUPPRESSION ─────────────────────────────────────────────────────────────
function Memory.delete(key)
  if not _store[key] then return false end
  unindex(key)
  _stats.deletes = _stats.deletes + 1
  _dirty   = true
  _version = _version + 1
  return true
end

-- ─── EXISTS ──────────────────────────────────────────────────────────────────
function Memory.exists(key)
  local entry = _store[key]
  if not entry then return false end
  if is_expired(entry) then
    unindex(key)                              -- ✅ nettoie aussi _index
    return false
  end
  return true
end

-- ─── INCRÉMENT ───────────────────────────────────────────────────────────────
function Memory.increment(key, delta)
  delta = delta or 1
  local current = Memory.get(key)
  -- ✅ Distingue "absent" (nil) de "faux" (false)
  if current == nil then current = 0 end
  if type(current) ~= "number" then return nil, "Valeur non numérique" end
  local new_val = current + delta
  Memory.set(key, new_val)
  return new_val
end

-- ─── LISTER PAR NAMESPACE ────────────────────────────────────────────────────
function Memory.list(namespace, pattern)
  local results = {}
  local ns_index = _index[namespace]
  if not ns_index then return results end

  for key, _ in pairs(ns_index) do
    local match = true
    if pattern then
      -- ✅ pcall : un pattern Lua malformé ne crash plus
      local ok, m = pcall(string.match, key, pattern)
      if ok then match = m ~= nil else match = false end
    end
    if match then
      local entry = _store[key]
      if entry and not is_expired(entry) then
        table.insert(results, {
          key     = key,
          version = entry.version,
          updated = entry.updated_at,
        })
      end
    end
  end

  table.sort(results, function(a, b) return a.updated > b.updated end)
  return results
end

-- ─── PUSH/POP ────────────────────────────────────────────────────────────────
function Memory.push(key, item, max_len)
  local list = Memory.get(key) or {}
  if type(list) ~= "table" then return false end
  table.insert(list, 1, item)
  if max_len and #list > max_len then
    while #list > max_len do table.remove(list) end
  end
  Memory.set(key, list)
  return #list
end

function Memory.pop(key)
  local list = Memory.get(key)
  if not list or type(list) ~= "table" or #list == 0 then return nil end
  local item = table.remove(list, 1)
  Memory.set(key, list)
  return item
end

-- ─── SNAPSHOTS ───────────────────────────────────────────────────────────────
-- Un snapshot capture uniquement les clés critiques (liste ci-dessous),
-- pas tout le store. `restore_snapshot()` ne restaurera donc que celles-ci.
function Memory.snapshot(label)
  local snap = {
    label      = label or ("snap_" .. os.time()),
    timestamp  = os.time(),
    date       = os.date("%Y-%m-%d %H:%M:%S"),
    store_size = count_store(),
    version    = _version,
    stats      = { reads = _stats.reads, writes = _stats.writes },
    critical   = {},
  }

  local critical_keys = {
    "troxt:state", "troxt:mode", "troxt:cycle_count",
    "troxt:last_decision", "troxt:metrics", "troxt:pending_decisions",
    "agent:troxtforge:status",  "agent:troxtprism:status",
    "agent:troxtweave:status",  "agent:troxtlens:status",
    "agent:troxtengine:status", "agent:intellectus:status",
  }
  for _, key in ipairs(critical_keys) do
    local val = Memory.get(key)
    if val ~= nil then snap.critical[key] = val end
  end

  table.insert(_snapshots, 1, snap)
  if #_snapshots > CONFIG.max_snapshots then table.remove(_snapshots) end

  _last_snapshot = os.time()
  print(string.format("[MEMORY] Snapshot '%s' — %d entrées", snap.label, snap.store_size))
  return snap
end

function Memory.get_snapshots() return _snapshots end

function Memory.restore_snapshot(label)
  for _, snap in ipairs(_snapshots) do
    if snap.label == label then
      for key, val in pairs(snap.critical) do
        Memory.set(key, val)
      end
      print("[MEMORY] Snapshot restauré: " .. label)
      return true
    end
  end
  return false, "Snapshot introuvable: " .. tostring(label)
end

-- ─── CHARGEMENT DEPUIS JS ────────────────────────────────────────────────────
-- `serialized` : table optionnelle fournie par le pont Node (Memory.get_*)
--                si présente, ses paires clé/valeur écrasent le store.
function Memory.load(serialized)
  if type(serialized) == "table" then
    for k, v in pairs(serialized) do
      if type(k) == "string" then
        -- Remet la valeur brute, sans passer par set() pour éviter
        -- d'incrémenter inutilement les stats au boot.
        _store[k] = {
          value      = v,
          created_at = os.time(),
          updated_at = os.time(),
          ttl        = nil,
          version    = 1,
          tags       = { "restored" },
          namespace  = get_namespace(k),
        }
        local ns = get_namespace(k)
        if not _index[ns] then _index[ns] = {} end
        _index[ns][k] = true
      end
    end
    print(string.format("[MEMORY] %d entrées restaurées depuis le pont JS", count_store()))
  end

  if not Memory.exists("troxt:boot_count") then
    Memory.set("troxt:boot_count", 0)
  end
  Memory.increment("troxt:boot_count")
  Memory.set("troxt:last_boot", os.date("%Y-%m-%d %H:%M:%S"))
  Memory.set("troxt:state", "BOOTING")

  print("[MEMORY] Chargée — " .. Memory.count() ..
    " entrées, boot #" .. (Memory.get("troxt:boot_count") or 1))
end

-- ─── FLUSH VERS JS ───────────────────────────────────────────────────────────
function Memory.flush()
  if not _dirty then return end

  local evicted = evict_expired()

  if os.time() - _last_snapshot >= CONFIG.snapshot_interval then
    Memory.snapshot("auto_" .. os.time())
  end

  if js and js.emit then
    js.emit("memory:flush", {
      store_size = count_store(),
      version    = _version,
      evicted    = evicted,
    })
  end

  _dirty = false
  print(string.format("[MEMORY] Flush — %d entrées, version %d, %d expirations",
    count_store(), _version, evicted))
end

-- ─── STATS ───────────────────────────────────────────────────────────────────
function Memory.count()   return count_store() end
function Memory.version() return _version end

function Memory.get_namespace_stats()
  local ns_stats = {}
  for ns, keys in pairs(_index) do
    local count = 0
    for _ in pairs(keys) do count = count + 1 end
    ns_stats[ns] = count
  end
  return ns_stats
end

function Memory.get_stats()
  local hit_rate = (_stats.reads > 0) and (_stats.hits / _stats.reads * 100) or 0
  return {
    entries    = count_store(),
    version    = _version,
    reads      = _stats.reads,
    writes     = _stats.writes,
    deletes    = _stats.deletes,
    hits       = _stats.hits,
    misses     = _stats.misses,
    evictions  = _stats.evictions,
    hit_rate   = string.format("%.1f%%", hit_rate),
    dirty      = _dirty,
    snapshots  = #_snapshots,
    namespaces = Memory.get_namespace_stats(),   -- ✅ réel, plus vide
  }
end

-- ─── PURGE ───────────────────────────────────────────────────────────────────
function Memory.purge_namespace(namespace)
  local count = 0
  if _index[namespace] then
    for key, _ in pairs(_index[namespace]) do
      _store[key] = nil
      count = count + 1
    end
    _index[namespace] = {}
  end
  _dirty = true
  print("[MEMORY] Namespace '" .. namespace .. "' purgé — " .. count .. " entrées supprimées")
  return count
end

function Memory.clear_all()
  _store   = {}
  _index   = {}
  _dirty   = true
  _version = _version + 1
  print("[MEMORY] Store vidé")
end

return Memory
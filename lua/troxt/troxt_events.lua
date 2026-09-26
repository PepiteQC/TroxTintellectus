--[[
══════════════════════════════════════════════════════════════════════
  TROXT_EVENTS.LUA — Bus d'événements central TROXT (Version Enrichie)
  Pont entre tous les modules Lua et le runtime JavaScript.
  Chemin : lua/troxt/troxt_events.lua
══════════════════════════════════════════════════════════════════════
]]

local Events = {}

-- ─── STORE ET CONFIGURATION ──────────────────────────────────────────────────
local _listeners     = {}    -- [event] → { {fn, id, once, priority, name, tag}, ... }
local _history       = {}    -- Historique circulaire des 1000 derniers événements
local _stats         = { emits = 0, handled = 0, errors = 0, dropped = 0 }
local _listener_id   = 0
local _paused_events = {}    -- Table des événements temporairement suspendus
local MAX_HISTORY    = 1000
local MAX_LISTENERS_PER_EVENT = 75

-- ─── ABONNEMENT ──────────────────────────────────────────────────────────────
function Events.on(event, fn, opts)
  if type(fn) ~= "function" then
    print("[EVENTS] WARN: listener non-fonction ignoré pour '" .. tostring(event) .. "'")
    return nil
  end

  opts = opts or {}
  if not _listeners[event] then _listeners[event] = {} end

  if #_listeners[event] >= MAX_LISTENERS_PER_EVENT then
    print("[EVENTS] ERROR: Capacité maximale de listeners atteinte pour '" .. tostring(event) .. "'")
    return nil
  end

  _listener_id = _listener_id + 1
  local id = _listener_id

  table.insert(_listeners[event], {
    fn       = fn,
    id       = id,
    once     = opts.once or false,
    priority = opts.priority or 5,   -- 0 = plus haute priorité, 10 = basse priorité
    name     = opts.name or ("listener_" .. id),
    tag      = opts.tag,
  })

  -- Tri par priorité (ordre croissant : 0 s'exécute en premier)
  table.sort(_listeners[event], function(a, b) return a.priority < b.priority end)

  return id
end

-- Raccourci pour un abonnement unique
function Events.once(event, fn, opts)
  opts = opts or {}
  opts.once = true
  return Events.on(event, fn, opts)
end

-- ─── DÉSABONNEMENT ───────────────────────────────────────────────────────────
function Events.off(event, listener_id)
  if not _listeners[event] then return false end
  for i, l in ipairs(_listeners[event]) do
    if l.id == listener_id then
      table.remove(_listeners[event], i)
      return true
    end
  end
  return false
end

function Events.off_all(event)
  if event then
    _listeners[event] = nil
  else
    _listeners = {}
  end
end

function Events.off_tag(tag)
  local removed = 0
  for _, listeners in pairs(_listeners) do
    for i = #listeners, 1, -1 do
      if listeners[i].tag == tag then
        table.remove(listeners, i)
        removed = removed + 1
      end
    end
  end
  return removed
end

-- ─── ÉMISSION ────────────────────────────────────────────────────────────────
function Events.emit(event, data)
  _stats.emits = _stats.emits + 1
  data = data or {}

  -- Vérification si l'événement est suspendu
  if _paused_events[event] then
    _stats.dropped = _stats.dropped + 1
    return 0
  end

  -- Enregistrement dans l'historique circulaire
  table.insert(_history, 1, {
    event     = event,
    data      = data,
    timestamp = os.time(),
    date      = os.date("%H:%M:%S"),
  })
  if #_history > MAX_HISTORY then 
    table.remove(_history) 
  end

  local handled = 0
  local to_remove = {}

  -- 1. Notification des listeners spécifiques à l'événement
  if _listeners[event] then
    for i, listener in ipairs(_listeners[event]) do
      local ok, err = pcall(listener.fn, data)
      if ok then
        handled = handled + 1
        _stats.handled = _stats.handled + 1
      else
        _stats.errors = _stats.errors + 1
        print(string.format("[EVENTS] ERREUR handler '%s' [ID: %d] pour '%s': %s",
          listener.name, listener.id, event, tostring(err)))
      end
      if listener.once then 
        table.insert(to_remove, i) 
      end
    end

    -- Suppression des écouteurs "once" (en partant de la fin pour préserver les indices)
    for i = #to_remove, 1, -1 do
      table.remove(_listeners[event], to_remove[i])
    end
  end

  -- 2. Gestion des Wildcards ("*")
  if _listeners["*"] then
    local wc_remove = {}
    for i, listener in ipairs(_listeners["*"]) do
      local ok, err = pcall(listener.fn, event, data)
      if ok then
        handled = handled + 1
        _stats.handled = _stats.handled + 1
      else
        _stats.errors = _stats.errors + 1
        print(string.format("[EVENTS] ERREUR wildcard '%s' pour '%s': %s",
          listener.name, event, tostring(err)))
      end
      if listener.once then 
        table.insert(wc_remove, i) 
      end
    end
    for i = #wc_remove, 1, -1 do
      table.remove(_listeners["*"], wc_remove[i])
    end
  end

  -- 3. Pont de communication vers JavaScript (wasmoon `js.emit`)
  if js and type(js.emit) == "function" then
    local ok, err = pcall(js.emit, event, data)
    if not ok then
      print("[EVENTS] Erreur critique du pont JS: " .. tostring(err))
    end
  end

  return handled
end

-- ─── CONTRÔLE D'ÉTAT (SUSPENDRE / REPRENDRE) ─────────────────────────────────
function Events.pause(event)
  _paused_events[event] = true
  print("[EVENTS] ⏸️ Event suspendu: " .. tostring(event))
end

function Events.resume(event)
  _paused_events[event] = nil
  print("[EVENTS] ▶️ Event repris: " .. tostring(event))
end

function Events.is_paused(event)
  return _paused_events[event] == true
end

-- ─── HISTORIQUE ET DIAGNOSTIQUE ──────────────────────────────────────────────
function Events.get_history(limit, filter_event)
  limit = limit or 50
  local result = {}
  for _, entry in ipairs(_history) do
    if not filter_event or entry.event == filter_event then
      table.insert(result, entry)
      if #result >= limit then break end
    end
  end
  return result
end

function Events.get_last(event)
  for _, entry in ipairs(_history) do
    if entry.event == event then return entry end
  end
  return nil
end

function Events.clear_history()
  _history = {}
  return true
end

-- ─── STATISTIQUES GLOBALES ───────────────────────────────────────────────────
function Events.get_stats()
  local listener_count = 0
  local event_count    = 0
  for _, listeners in pairs(_listeners) do
    if #listeners > 0 then
      event_count    = event_count + 1
      listener_count = listener_count + #listeners
    end
  end
  return {
    emits          = _stats.emits,
    handled        = _stats.handled,
    errors         = _stats.errors,
    dropped        = _stats.dropped,
    listener_count = listener_count,
    event_types    = event_count,
    history_size   = #_history,
  }
end

-- ─── HANDLERS SYSTÈME PAR DÉFAUT ─────────────────────────────────────────────
Events.on("troxt:booted", function(data)
  print(string.format("[⬡ TROXT] Système démarré v%s — Mode: %s",
    data.version or "1.0.0", data.mode or "standard"))
end, { name = "default:booted", priority = 0, tag = "system" })

Events.on("troxt:shutdown", function(data)
  print(string.format("[⬡ TROXT] Arrêt propre — Cycle: %d", data.cycle or 0))
end, { name = "default:shutdown", priority = 0, tag = "system" })

Events.on("troxt:mode_changed", function(data)
  print(string.format("[⬡ TROXT] Mode basculé: %s → %s", data.old or "?", data.new or "?"))
end, { name = "default:mode", priority = 0, tag = "system" })

Events.on("agent:critical_error", function(data)
  print(string.format("[⬡ TROXT] 🔴 CRITIQUE — %s %s a échoué",
    data.icon or "⬡", data.name or "Inconnu"))
end, { name = "default:agent_critical", priority = 0, tag = "alerts" })

Events.on("agent:came_online", function(data)
  print(string.format("[⬡ TROXT] ✓ %s %s est en ligne",
    data.icon or "⬡", data.name or "Agent"))
end, { name = "default:agent_online", priority = 0, tag = "agents" })

Events.on("scheduler:job_error", function(data)
  print(string.format("[SCHEDULER] ✖ Job '%s' échoué: %s",
    data.name or "?", data.error or "Erreur inconnue"))
end, { name = "default:job_error", priority = 0, tag = "scheduler" })

Events.on("intellectus:threat_detected", function(data)
  print(string.format("[🛡️ INTELLECTUS] MENACE niveau %d — Type: %s — IP: %s",
    data.level or 0, data.type or "Inconnue", data.ip or "0.0.0.0"))
end, { name = "default:threat", priority = 0, tag = "security" })

Events.on("intellectus:ip_blocked", function(data)
  print(string.format("[🛡️ INTELLECTUS] IP bloquée: %s (Raison: %s)",
    data.ip or "?", data.reason or "Non spécifiée"))
end, { name = "default:ip_blocked", priority = 0, tag = "security" })

Events.on("intellectus:auth_failed", function(data)
  print(string.format("[🛡️ INTELLECTUS] Authentification échouée — IP: %s, Endpoint: %s",
    data.ip or "?", data.endpoint or "/"))
end, { name = "default:auth_failed", priority = 0, tag = "security" })

return Events
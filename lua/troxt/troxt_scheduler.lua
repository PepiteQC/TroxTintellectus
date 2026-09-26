--[[
══════════════════════════════════════════════════════════════════════
  TROXT_SCHEDULER.LUA — Planificateur de tâches temps réel
  Cron-like pour TROXT : intervals, one-shots, crons, priorités.
  Chemin : lua/troxt/troxt_scheduler.lua
══════════════════════════════════════════════════════════════════════
]]

local Scheduler = {}
local Events    = require("troxt.troxt_events")

-- ─── CONFIGURATION ───────────────────────────────────────────────────────────
local CONFIG = {
  max_jobs         = 200,
  max_history      = 500,
  tick_interval    = 1,
  max_overdue_sec  = 60,
  max_execution_ms = 1000,     -- seuil warning (ancien "5000" jamais utilisé)
}

-- ─── ÉTAT ────────────────────────────────────────────────────────────────────
local _jobs     = {}
local _history  = {}
local _paused   = false
local _job_id_counter = 0
local _stats = {
  total_fired    = 0,
  total_skipped  = 0,
  total_errors   = 0,
  overdue_count  = 0,
}

-- ✅ Helper : compte les clés d'une table associative (remplace `#_jobs`)
local function count_jobs()
  local n = 0
  for _ in pairs(_jobs) do n = n + 1 end
  return n
end

-- Priorités : 0 = plus urgent
local PMAP = { critical=0, high=1, normal=2, low=3 }

-- ─── UTILITAIRES ─────────────────────────────────────────────────────────────
local function new_job_id()
  _job_id_counter = _job_id_counter + 1
  return string.format("JOB-%06d", _job_id_counter)
end

local function log_history(job, success, duration_ms, error_msg)
  table.insert(_history, 1, {
    job_id      = job.id,
    name        = job.name,
    fired_at    = os.time(),
    success     = success,
    duration_ms = duration_ms,
    error       = error_msg,
  })
  if #_history > CONFIG.max_history then table.remove(_history) end
end

-- Calcule le prochain `next_fire` pour un job cron (approx. à la minute)
local function compute_cron_next_fire(job, now)
  -- On cherche la prochaine minute où (hour, min) matchent
  local probe = now + 60 - (now % 60)  -- début de la minute suivante
  for _ = 1, 60 * 24 do  -- parcourt jusqu'à 24h
    local d = os.date("*t", probe)
    local h_ok = (job.cron_hour == nil or job.cron_hour == d.hour)
    local m_ok = (job.cron_min  == nil or job.cron_min  == d.min)
    if h_ok and m_ok then return probe end
    probe = probe + 60
  end
  return now + 3600  -- fallback : dans 1h
end

-- ─── CRÉER UN JOB ────────────────────────────────────────────────────────────
local function create_job(name, fn, job_type, opts)
  if count_jobs() >= CONFIG.max_jobs then
    print("[SCHEDULER] WARN: max jobs atteint — impossible d'ajouter " .. name)
    return nil
  end

  local id  = new_job_id()
  local now = os.time()

  local job = {
    id         = id,
    name       = name,
    fn         = fn,
    type       = job_type,
    priority   = opts.priority or "normal",
    enabled    = true,
    created_at = now,
    last_fired = nil,
    next_fire  = now + (opts.delay or 0),
    fire_count = 0,
    error_count= 0,
    tags       = opts.tags or {},
    interval   = opts.interval,
    max_fires  = opts.max_fires,
    timeout_sec= opts.timeout_sec,
    cron_sec   = opts.cron_sec,
    cron_min   = opts.cron_min,
    cron_hour  = opts.cron_hour,
  }

  _jobs[id] = job
  Events.emit("scheduler:job_created", { id=id, name=name, type=job_type })
  return id
end

-- ─── API PUBLIQUE ─────────────────────────────────────────────────────────────

-- Toutes les N secondes (N doit être > 0)
function Scheduler.every(seconds, name, fn, opts)
  if type(seconds) ~= "number" or seconds <= 0 then
    print("[SCHEDULER] ERREUR: interval invalide pour " .. tostring(name))
    return nil
  end
  opts = opts or {}
  opts.interval = seconds
  opts.delay    = opts.delay or seconds
  return create_job(name, fn, "interval", opts)
end

-- Une seule fois dans N secondes
function Scheduler.after(seconds, name, fn, opts)
  opts = opts or {}
  opts.delay     = math.max(0, seconds or 0)
  opts.max_fires = 1
  return create_job(name, fn, "once", opts)
end

-- Immédiatement au prochain tick
function Scheduler.immediate(name, fn, opts)
  opts = opts or {}
  opts.delay     = 0
  opts.max_fires = 1
  return create_job(name, fn, "immediate", opts)
end

-- Pattern cron simplifié — hour/minute/second optionnels (nil = wildcard)
function Scheduler.cron(hour, minute, name, fn, opts, second)
  opts = opts or {}
  opts.cron_hour = hour
  opts.cron_min  = minute
  opts.cron_sec  = second     -- ✅ exposé pour permettre une planif à la seconde près
  return create_job(name, fn, "cron", opts)
end

-- ─── ANNULER ─────────────────────────────────────────────────────────────────
function Scheduler.cancel(job_id)
  if _jobs[job_id] then
    _jobs[job_id] = nil
    Events.emit("scheduler:job_cancelled", { id = job_id })
    return true
  end
  return false
end

function Scheduler.cancel_by_name(name)
  local cancelled = 0
  for id, job in pairs(_jobs) do
    if job.name == name then
      _jobs[id] = nil
      cancelled = cancelled + 1
    end
  end
  return cancelled
end

-- ─── PAUSE / RESUME ──────────────────────────────────────────────────────────
function Scheduler.pause()
  _paused = true
  print("[SCHEDULER] En pause")
end
function Scheduler.resume()
  _paused = false
  print("[SCHEDULER] Reprise")
end

function Scheduler.pause_job(id)
  if _jobs[id] then _jobs[id].enabled = false return true end
  return false
end
function Scheduler.resume_job(id)
  if _jobs[id] then _jobs[id].enabled = true return true end
  return false
end

-- ─── TICK PRINCIPAL ──────────────────────────────────────────────────────────
function Scheduler.tick()
  if _paused then
    _stats.total_skipped = _stats.total_skipped + 1
    return
  end

  local now       = os.time()
  local to_remove = {}

  -- Trier par priorité (PMAP est partagé, plus d'allocation par comparaison)
  local sorted = {}
  for _, job in pairs(_jobs) do
    if job.enabled then table.insert(sorted, job) end
  end
  table.sort(sorted, function(a, b)
    return (PMAP[a.priority] or 2) < (PMAP[b.priority] or 2)
  end)

  for _, job in ipairs(sorted) do
    if not job.enabled then
      _stats.total_skipped = _stats.total_skipped + 1
      goto skip
    end

    local should_fire = false

    if job.type == "interval" or job.type == "once" or job.type == "immediate" then
      should_fire = now >= job.next_fire

    elseif job.type == "cron" then
      local date = os.date("*t", now)
      local h_match = (job.cron_hour == nil or job.cron_hour == date.hour)
      local m_match = (job.cron_min  == nil or job.cron_min  == date.min)
      local s_match = (job.cron_sec  == nil or job.cron_sec  == date.sec)
      local already_fired_this_min = job.last_fired and (now - job.last_fired) < 60
      should_fire = h_match and m_match and s_match and not already_fired_this_min
    end

    if not should_fire then goto skip end

    -- Vérif en retard (uniquement pour interval/once/immediate — cron recalcule)
    if job.type ~= "cron" and now - job.next_fire > CONFIG.max_overdue_sec then
      _stats.overdue_count = _stats.overdue_count + 1
      Events.emit("scheduler:job_overdue", {
        id      = job.id,
        name    = job.name,
        overdue = now - job.next_fire,
      })
    end

    -- Exécution
    local t_start    = os.clock()
    local ok, result = pcall(job.fn)
    local duration   = math.floor((os.clock() - t_start) * 1000)

    job.fire_count = job.fire_count + 1
    job.last_fired = now
    _stats.total_fired = _stats.total_fired + 1

    if not ok then
      job.error_count = job.error_count + 1
      _stats.total_errors = _stats.total_errors + 1
      print(string.format("[SCHEDULER] ERREUR job '%s': %s", job.name, tostring(result)))
      Events.emit("scheduler:job_error", {
        id    = job.id,
        name  = job.name,
        error = tostring(result),
      })
      log_history(job, false, duration, tostring(result))
    else
      log_history(job, true, duration, nil)
      -- ✅ Utilise CONFIG.max_execution_ms (avant : seuil hardcodé 1000)
      if duration > CONFIG.max_execution_ms then
        print(string.format("[SCHEDULER] WARN job '%s' lent: %dms (max %d)",
          job.name, duration, CONFIG.max_execution_ms))
      end
    end

    -- Prochaine exécution
    if job.type == "interval" then
      job.next_fire = now + job.interval

    elseif job.type == "once" or job.type == "immediate" then
      table.insert(to_remove, job.id)

    elseif job.type == "cron" then
      -- ✅ Calcule le prochain fire réel pour ne plus spammer "overdue"
      job.next_fire = compute_cron_next_fire(job, now)
    end

    if job.max_fires and job.fire_count >= job.max_fires then
      table.insert(to_remove, job.id)
    end

    ::skip::
  end

  -- Supprimer les jobs terminés
  for _, id in ipairs(to_remove) do
    local name = _jobs[id] and _jobs[id].name or id
    _jobs[id] = nil
    Events.emit("scheduler:job_completed", { id=id, name=name })
  end
end

-- ─── JOBS PRÉINSTALLÉS TROXT ─────────────────────────────────────────────────
function Scheduler.install_troxt_defaults()
  Scheduler.every(5, "troxt:ping_core_agents", function()
    Events.emit("scheduler:trigger", { task = "ping_agents", tier = "CORE" })
  end, { priority = "high" })

  Scheduler.every(60, "troxt:ping_dev_agents", function()
    Events.emit("scheduler:trigger", { task = "ping_agents", tier = "DEVELOPMENT" })
  end, { priority = "low" })

  Scheduler.every(300, "troxt:report", function()
    Events.emit("scheduler:trigger", { task = "generate_report" })
  end, { priority = "normal" })

  Scheduler.every(30, "troxt:task_remind", function()
    Events.emit("scheduler:trigger", { task = "remind_tasks" })
  end, { priority = "normal" })

  Scheduler.every(10, "troxt:health", function()
    Events.emit("scheduler:trigger", { task = "health_check" })
  end, { priority = "high" })

  Scheduler.every(300, "troxt:memory_save", function()
    Events.emit("scheduler:trigger", { task = "memory_flush" })
  end, { priority = "low" })

  Scheduler.cron(nil, 0, "troxt:hourly_cleanup", function()
    Events.emit("scheduler:trigger", { task = "hourly_cleanup" })
  end, { priority = "low" })

  Scheduler.cron(0, 0, "troxt:daily_snapshot", function()
    Events.emit("scheduler:trigger", { task = "daily_snapshot" })
  end, { priority = "normal" })

  print("[SCHEDULER] Jobs TROXT par défaut installés — " .. count_jobs() .. " jobs actifs")
end

-- ─── STATS / DEBUG ───────────────────────────────────────────────────────────
function Scheduler.count() return count_jobs() end

function Scheduler.list()
  local list = {}
  for id, job in pairs(_jobs) do
    table.insert(list, {
      id          = id,
      name        = job.name,
      type        = job.type,
      priority    = job.priority,
      enabled     = job.enabled,
      fire_count  = job.fire_count,
      error_count = job.error_count,
      last_fired  = job.last_fired and os.date("%H:%M:%S", job.last_fired) or "jamais",
      next_fire   = job.next_fire  and os.date("%H:%M:%S", job.next_fire)  or "N/A",
      interval    = job.interval,
    })
  end
  table.sort(list, function(a, b) return a.name < b.name end)
  return list
end

function Scheduler.get_stats()
  return {
    total_jobs    = count_jobs(),
    paused        = _paused,
    total_fired   = _stats.total_fired,
    total_errors  = _stats.total_errors,
    total_skipped = _stats.total_skipped,
    overdue_count = _stats.overdue_count,
    history_size  = #_history,
  }
end

function Scheduler.get_history(limit)
  limit = limit or 50
  local result = {}
  for i = 1, math.min(limit, #_history) do
    table.insert(result, _history[i])
  end
  return result
end

return Scheduler
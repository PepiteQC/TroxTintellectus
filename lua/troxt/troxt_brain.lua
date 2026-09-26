--[[
══════════════════════════════════════════════════════════════════════
  TROXT_BRAIN.LUA — Cerveau Central TroxtWorld (v3.0 PLATINUM)
  Le noyau de raisonnement de TROXT.

  TROXT ne réagit pas — il anticipe.
  TROXT ne corrige pas — il prévient.
  TROXT ne surveille pas — il comprend.
  TROXT ne subit pas — il apprend.
  Chaque décision est signée, tracée, irrévocable.

  Chemin : C:\beni\lua\troxt\troxt_brain.lua
  Version : 3.0.0 PLATINUM
══════════════════════════════════════════════════════════════════════
]]

local Brain = {}

-- ─── DÉPENDANCES ─────────────────────────────────────────────────────────────
local Agents    = require("troxt.troxt_agents_troxtworld")
local Memory    = require("troxt.troxt_memory")
local Scheduler = require("troxt.troxt_scheduler")
local Events    = require("troxt.troxt_events")

-- ─── IDENTITÉ TROXT ──────────────────────────────────────────────────────────
local TROXT = {
  version     = "3.0.0",
  signature   = "⬡ TROXT",
  codename    = "CERVEAU",
  edition     = "PLATINUM",
  started_at  = os.time(),
  cycle_count = 0,
  state       = "BOOTING",  -- BOOTING | ACTIVE | DEGRADED | CRITICAL | SHUTDOWN
  mode        = "NORMAL",   -- NORMAL | VIGILANCE | LOCKDOWN | RECOVERY | PROPHET
  booted      = false,
}

-- ─── CONSTANTES DE RAISONNEMENT (v3.0 avec auto-apprentissage) ───────────────
local REASON = {
  CERTAINTY_HIGH   = 0.92,
  CERTAINTY_MEDIUM = 0.70,
  CERTAINTY_LOW    = 0.45,
  CERTAINTY_GUESS  = 0.20,

  ANOMALY_THRESHOLD        = 3,
  CASCADE_THRESHOLD        = 2,
  RECOVERY_WAIT_SEC        = 120,
  DECISION_COOLDOWN_SEC    = 10,
  MODE_CHANGE_COOLDOWN_SEC = 5,
  MAX_DECISIONS_PER_MIN    = 30,
  MEMORY_FLUSH_INTERVAL    = 300,

  AUTO_VIGILANCE_ERRORS = 5,
  AUTO_LOCKDOWN_ERRORS  = 15,

  -- ✨ v3.0 : Nouveautés Platinum
  PREDICTION_WINDOW_SEC     = 60,      -- fenêtre d'analyse pour prédictions
  TREND_HISTORY_SIZE        = 60,      -- 60 ticks d'historique
  COGNITIVE_LOAD_MAX        = 100,     -- surcharge max
  CIRCUIT_BREAKER_ERRORS    = 20,      -- seuil isolation agent
  CIRCUIT_BREAKER_WINDOW    = 60,      -- fenêtre en secondes
  SNAPSHOT_INTERVAL_SEC     = 900,     -- snapshot toutes les 15 min
  FOCUS_ATTENTION_MS        = 30,      -- durée focus (secondes)

  -- Auto-apprentissage
  FP_RATE_HIGH              = 0.35,    -- taux FP qui déclenche ajustement
  FP_RATE_LOW               = 0.05,    -- taux FP idéal
  LEARNING_RATE             = 0.05,    -- vitesse d'ajustement
}

-- ─── ÉTAT INTERNE DU CERVEAU (v3.0) ──────────────────────────────────────────
local brain_state = {
  current_focus       = nil,           -- ✨ agent sur lequel TROXT se concentre
  focus_started_at    = 0,
  pending_decisions   = {},
  decision_history    = {},
  anomaly_counts      = {},
  error_counts        = {},
  last_decision_at    = {},
  last_mode_change_at = 0,
  decisions_this_min  = 0,
  decisions_min_reset = os.time(),

  -- ✨ v3.0 : Historique circulaire pour prédictions
  tick_history = {},                   -- buffer circulaire des N derniers ticks
  tick_history_index = 1,

  -- ✨ v3.0 : Circuit Breakers par agent
  circuit_breakers = {},               -- { [agent_id] = { open_until, error_count } }

  -- ✨ v3.0 : Charge cognitive (0-100)
  cognitive_load = 0,

  -- ✨ v3.0 : Prédictions actives
  predictions = {},                    -- { { agent_id, likely_failure_at, confidence } }

  world_context = {
    players_online  = 0,
    active_apts     = 0,
    elevator_busy   = false,
    last_world_sync = nil,
  },

  metrics = {
    total_decisions     = 0,
    correct_decisions   = 0,
    false_positives     = 0,
    agent_recoveries    = 0,
    cascade_prevented   = 0,
    predictions_made    = 0,
    predictions_correct = 0,      -- ✨ v3.0
    circuit_breakers_triggered = 0, -- ✨ v3.0
    snapshots_saved     = 0,      -- ✨ v3.0
  },

  -- ✨ v3.0 : Registre des jobs Scheduler pour shutdown propre
  scheduler_jobs = {},
}

-- ─── LOG INTERNE (enrichi v3.0) ──────────────────────────────────────────────
local function log(level, source, msg, data)
  local ts    = os.date("%H:%M:%S")
  local icons = {
    INFO       = "ℹ", WARN       = "⚠", ERROR      = "✖",
    CRITICAL   = "🔴", SUCCESS    = "✓", DECISION   = "⬡",
    THINK      = "🧠", PROPHET    = "🔮", CIRCUIT    = "⚡",
    LEARN      = "🧬", FOCUS      = "🎯", SNAPSHOT   = "💾",
  }
  local icon  = icons[level] or "·"
  local src   = source and (" › " .. source) or ""
  print(string.format("[%s] %s %s%s — %s", ts, icon, TROXT.signature, src, msg))
  if data then
    for k, v in pairs(data) do
      print(string.format("   ↳ %s: %s", k, tostring(v)))
    end
  end
  Events.emit("troxt:log", { level = level, source = source, message = msg, data = data, ts = ts })
end

-- ─── SIGNATURE CRYPTOGRAPHIQUE DES DÉCISIONS (v3.0) ──────────────────────────
local function decision_signature(decision)
  local str = string.format("%s|%s|%d|%.2f",
    decision.id or "?",
    decision.type or "?",
    decision.created_at or 0,
    decision.certainty or 0)
  -- Simple hash déterministe (remplacer par vrai MD5 si disponible)
  local hash = 0
  for i = 1, #str do
    hash = (hash * 31 + str:byte(i)) % 2147483647
  end
  return string.format("SIG-%08X", hash)
end

-- ─── HELPERS TEMPS ───────────────────────────────────────────────────────────
local function now_sec() return os.time() end
local function now_ms()  return os.time() * 1000 end

-- ─── INITIALISATION ──────────────────────────────────────────────────────────
function Brain.boot()
  if TROXT.booted then
    log("WARN", nil, "Tentative de boot alors que TROXT est déjà actif — Ignorée.")
    return Brain
  end

  print("")
  print("  ████████╗██████╗  ██████╗ ██╗  ██╗████████╗")
  print("     ██╔══╝██╔══██╗██╔═══██╗╚██╗██╔╝    ██╔══╝")
  print("     ██║   ██████╔╝██║   ██║ ╚███╔╝     ██║   ")
  print("     ██║   ██╔══██╗██║   ██║ ██╔██╗     ██║   ")
  print("     ██║   ██║  ██║╚██████╔╝██╔╝ ██╗    ██║   ")
  print("     ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ")
  print("")
  print("  Cerveau Central TroxtWorld · v" .. TROXT.version .. " " .. TROXT.edition)
  print("  Mode: " .. TROXT.mode .. " · " .. os.date("%Y-%m-%d %H:%M:%S"))
  print("")

  Memory.load()
  log("INFO", nil, "Mémoire chargée — " .. Memory.count() .. " entrées")

  Agents.init()
  log("INFO", nil, "Agents initialisés — " .. Agents.count() .. " agents enregistrés")

  -- Restauration des décisions en attente
  local pending = Memory.get("troxt:pending_decisions") or {}
  if #pending > 0 then
    log("WARN", nil, #pending .. " décision(s) en attente récupérée(s) du crash précédent")
    brain_state.pending_decisions = pending
  end

  -- ✨ v3.0 : Restauration snapshot si disponible
  local snapshot = Memory.get("troxt:snapshot")
  if snapshot then
    log("INFO", nil, "Snapshot récupéré du " .. (snapshot.saved_at or "?"))
    if snapshot.metrics then
      for k, v in pairs(snapshot.metrics) do
        brain_state.metrics[k] = v
      end
    end
  end

  -- Initialisation du buffer circulaire d'historique
  for i = 1, REASON.TREND_HISTORY_SIZE do
    brain_state.tick_history[i] = { errors = 0, anomalies = 0, ts = 0 }
  end

  Brain._schedule_recurring_tasks()

  TROXT.state       = "ACTIVE"
  TROXT.booted      = true
  TROXT.cycle_count = Memory.get("troxt:cycle_count") or 0

  log("SUCCESS", nil, "TROXT ACTIF", {
    version = TROXT.version,
    edition = TROXT.edition,
    agents  = Agents.count(),
    memory  = Memory.count(),
    mode    = TROXT.mode,
  })

  Events.emit("troxt:booted", {
    version    = TROXT.version,
    edition    = TROXT.edition,
    started_at = TROXT.started_at,
    mode       = TROXT.mode,
  })

  return Brain
end

-- ─── BOUCLE PRINCIPALE (enrichie v3.0) ───────────────────────────────────────
function Brain.tick(_dt)
  if not TROXT.booted then return end
  TROXT.cycle_count = TROXT.cycle_count + 1

  -- Reset compteur décisions/min
  if now_sec() - brain_state.decisions_min_reset >= 60 then
    brain_state.decisions_this_min  = 0
    brain_state.decisions_min_reset = now_sec()
    brain_state.error_counts        = {}
    -- ✨ v3.0 : Auto-apprentissage à chaque minute
    Brain._auto_learn()
  end

  if brain_state.decisions_this_min >= REASON.MAX_DECISIONS_PER_MIN then
    log("WARN", nil, "Limite décisions/min atteinte — pause raisonnement")
    return
  end

  -- Phases cognitives
  local observations = Brain._observe()
  local analysis     = Brain._analyze(observations)

  -- ✨ v3.0 : Enregistrement historique circulaire
  Brain._record_history(observations, analysis)

  -- ✨ v3.0 : Prédictions basées sur les tendances
  if TROXT.cycle_count % 30 == 0 then
    Brain._predict()
  end

  -- ✨ v3.0 : Ajustement charge cognitive
  Brain._update_cognitive_load(analysis)

  -- ✨ v3.0 : Vérification des Circuit Breakers
  Brain._check_circuit_breakers()

  Brain._decide(analysis)
  Brain._execute_pending()
  Brain._learn(observations)

  -- Persistance périodique
  if TROXT.cycle_count % 60 == 0 then
    Memory.set("troxt:cycle_count", TROXT.cycle_count)
    Memory.flush()
  end

  -- Pulse de télémétrie
  if TROXT.cycle_count % 20 == 0 then
    Events.emit("troxt:pulse", {
      cycle          = TROXT.cycle_count,
      state          = TROXT.state,
      mode           = TROXT.mode,
      agents         = Agents.get_summary(),
      cognitive_load = brain_state.cognitive_load,
      predictions    = #brain_state.predictions,
    })
  end
end

-- ─── ✨ v3.0 : ENREGISTREMENT HISTORIQUE CIRCULAIRE ──────────────────────────
function Brain._record_history(obs, analysis)
  local slot = brain_state.tick_history_index
  brain_state.tick_history[slot] = {
    ts        = now_sec(),
    errors    = analysis.total_errors,
    anomalies = #analysis.anomalies,
    healthy   = #analysis.healthy_agents,
    dead      = #analysis.dead_agents,
  }
  brain_state.tick_history_index = (slot % REASON.TREND_HISTORY_SIZE) + 1
end

-- ─── ✨ v3.0 : PRÉDICTIONS (Mode Prophète) ───────────────────────────────────
function Brain._predict()
  brain_state.predictions = {}

  -- Calcule la tendance des erreurs
  local total_errors, sample_count = 0, 0
  for _, entry in ipairs(brain_state.tick_history) do
    if entry.ts > 0 then
      total_errors = total_errors + entry.errors
      sample_count = sample_count + 1
    end
  end
  if sample_count == 0 then return end

  local avg_errors = total_errors / sample_count

  -- Prédiction : si tendance croissante et > seuil, anticiper VIGILANCE
  if avg_errors >= REASON.AUTO_VIGILANCE_ERRORS * 0.6 and TROXT.mode == "NORMAL" then
    local pred = {
      type       = "MODE_UPGRADE",
      predicted  = "VIGILANCE",
      likely_at  = now_sec() + 30,
      confidence = math.min(0.95, 0.5 + avg_errors / 20),
      reason     = string.format("Tendance %.1f err/tick — Vigilance imminente", avg_errors),
    }
    table.insert(brain_state.predictions, pred)
    brain_state.metrics.predictions_made = brain_state.metrics.predictions_made + 1

    log("PROPHET", nil,
      string.format("Prédiction : %s dans ~30s (%.0f%% confiance)",
        pred.predicted, pred.confidence * 100),
      { reason = pred.reason })

    Events.emit("troxt:prediction", pred)
  end

  -- Prédiction de mort d'agent : si silence croissant
  for agent_id, count in pairs(brain_state.anomaly_counts) do
    if count >= 2 and count < 3 then
      local pred = {
        type       = "AGENT_FAILURE",
        agent_id   = agent_id,
        likely_at  = now_sec() + 45,
        confidence = 0.7,
        reason     = string.format("Agent %s montre des signes précurseurs (score %d)", agent_id, count),
      }
      table.insert(brain_state.predictions, pred)
      brain_state.metrics.predictions_made = brain_state.metrics.predictions_made + 1
      log("PROPHET", agent_id, "Défaillance prédite dans ~45s")
    end
  end
end

-- ─── ✨ v3.0 : CHARGE COGNITIVE ──────────────────────────────────────────────
function Brain._update_cognitive_load(analysis)
  local load = 0
  load = load + #brain_state.pending_decisions * 3
  load = load + analysis.total_errors * 2
  load = load + #brain_state.predictions * 1
  load = load + (brain_state.decisions_this_min * 2)
  brain_state.cognitive_load = math.min(REASON.COGNITIVE_LOAD_MAX, load)

  if brain_state.cognitive_load >= 90 and TROXT.cycle_count % 40 == 0 then
    log("WARN", nil, string.format("Charge cognitive critique: %d/100 — Ralentissement raisonnement",
      brain_state.cognitive_load))
  end
end

-- ─── ✨ v3.0 : CIRCUIT BREAKERS ──────────────────────────────────────────────
function Brain._check_circuit_breakers()
  for agent_id, breaker in pairs(brain_state.circuit_breakers) do
    if breaker.open_until and now_sec() >= breaker.open_until then
      brain_state.circuit_breakers[agent_id] = nil
      log("CIRCUIT", agent_id, "Circuit breaker fermé — Agent réintégré")
      Events.emit("troxt:circuit_closed", { agent_id = agent_id })
    end
  end
end

function Brain._trigger_circuit_breaker(agent_id, reason)
  brain_state.circuit_breakers[agent_id] = {
    open_until = now_sec() + REASON.CIRCUIT_BREAKER_WINDOW,
    error_count = 0,
    reason = reason,
  }
  brain_state.metrics.circuit_breakers_triggered = brain_state.metrics.circuit_breakers_triggered + 1
  log("CIRCUIT", agent_id, string.format("Circuit breaker OUVERT (%s) — Isolation %ds",
    reason, REASON.CIRCUIT_BREAKER_WINDOW))
  Events.emit("troxt:circuit_opened", {
    agent_id = agent_id,
    reason = reason,
    duration = REASON.CIRCUIT_BREAKER_WINDOW,
  })
end

-- ─── ✨ v3.0 : AUTO-APPRENTISSAGE ────────────────────────────────────────────
function Brain._auto_learn()
  local total = math.max(1, brain_state.metrics.total_decisions)
  local fp_rate = brain_state.metrics.false_positives / total

  if fp_rate > REASON.FP_RATE_HIGH then
    -- Trop de faux positifs → augmenter le seuil d'anomalie
    REASON.ANOMALY_THRESHOLD = REASON.ANOMALY_THRESHOLD + REASON.LEARNING_RATE
    log("LEARN", nil,
      string.format("Taux FP %.1f%% — Élevage seuil anomalie à %.2f",
        fp_rate * 100, REASON.ANOMALY_THRESHOLD))
  elseif fp_rate < REASON.FP_RATE_LOW and REASON.ANOMALY_THRESHOLD > 2 then
    -- Très peu de faux positifs → baisser le seuil pour plus de sensibilité
    REASON.ANOMALY_THRESHOLD = math.max(2, REASON.ANOMALY_THRESHOLD - REASON.LEARNING_RATE)
    log("LEARN", nil,
      string.format("Taux FP %.1f%% — Baisse seuil anomalie à %.2f",
        fp_rate * 100, REASON.ANOMALY_THRESHOLD))
  end
end

-- ─── PHASE 1 : OBSERVER ──────────────────────────────────────────────────────
function Brain._observe()
  local obs = { timestamp = now_sec(), agents = {}, system = {}, world = {} }

  for id, agent in pairs(Agents.get_all()) do
    -- Skip agents isolés par circuit breaker
    if brain_state.circuit_breakers[id] then goto continue_obs end

    obs.agents[id] = {
      id          = id,
      name        = agent.name,
      status      = agent.status,
      last_seen   = agent.last_seen,
      silence_sec = agent.last_seen and (now_sec() - agent.last_seen) or nil,
      error_count = agent.error_count,
      task_count  = #(agent.task_queue or {}),
      is_critical = agent.is_critical,
    }
    ::continue_obs::
  end

  obs.world  = brain_state.world_context
  obs.system = {
    uptime_sec   = now_sec() - TROXT.started_at,
    cycle_count  = TROXT.cycle_count,
    memory_keys  = Memory.count(),
    pending_dec  = #brain_state.pending_decisions,
    mode         = TROXT.mode,
    cognitive_load = brain_state.cognitive_load,
  }

  return obs
end

-- ─── PHASE 2 : ANALYSER ──────────────────────────────────────────────────────
function Brain._analyze(obs)
  local analysis = {
    anomalies       = {},
    healthy_agents  = {},
    degraded_agents = {},
    dead_agents     = {},
    cascade_risk    = false,
    mode_change     = nil,
    total_errors    = 0,
  }

  for id, agent_obs in pairs(obs.agents) do
    local silence = agent_obs.silence_sec

    if agent_obs.status == "standby" then
      table.insert(analysis.healthy_agents, id)
    elseif agent_obs.status == "online" and (silence == nil or silence < 15) then
      table.insert(analysis.healthy_agents, id)
      brain_state.anomaly_counts[id] = 0
    elseif silence and silence >= 60 then
      table.insert(analysis.dead_agents, id)
      brain_state.anomaly_counts[id] = (brain_state.anomaly_counts[id] or 0) + 3
      analysis.total_errors = analysis.total_errors + 3
      table.insert(analysis.anomalies, {
        type = "AGENT_DEAD", agent_id = id, severity = "CRITICAL",
        silence = silence, data = agent_obs,
      })
    elseif silence and silence >= 15 then
      table.insert(analysis.degraded_agents, id)
      brain_state.anomaly_counts[id] = (brain_state.anomaly_counts[id] or 0) + 1
      analysis.total_errors = analysis.total_errors + 1
      table.insert(analysis.anomalies, {
        type = "AGENT_SILENT", agent_id = id, severity = "WARN",
        silence = silence, data = agent_obs,
      })
    end

    -- ✨ v3.0 : Détection de burst d'erreurs → Circuit Breaker
    if agent_obs.error_count and agent_obs.error_count >= REASON.CIRCUIT_BREAKER_ERRORS then
      Brain._trigger_circuit_breaker(id, "Burst d'erreurs")
    elseif agent_obs.error_count and agent_obs.error_count >= 5 then
      brain_state.error_counts[id] = (brain_state.error_counts[id] or 0) + agent_obs.error_count
      analysis.total_errors = analysis.total_errors + 1
      table.insert(analysis.anomalies, {
        type = "ERROR_SPIKE", agent_id = id, severity = "ERROR",
        count = agent_obs.error_count,
      })
    end
  end

  if #analysis.dead_agents >= REASON.CASCADE_THRESHOLD then
    analysis.cascade_risk = true
    table.insert(analysis.anomalies, {
      type = "CASCADE_RISK", agent_id = "SYSTEM", severity = "CRITICAL",
      dead = #analysis.dead_agents,
    })
  end

  if analysis.total_errors >= REASON.AUTO_LOCKDOWN_ERRORS then
    analysis.mode_change = "LOCKDOWN"
  elseif analysis.total_errors >= REASON.AUTO_VIGILANCE_ERRORS then
    analysis.mode_change = "VIGILANCE"
  elseif analysis.total_errors == 0 and TROXT.mode ~= "NORMAL" then
    analysis.mode_change = "NORMAL"
  end

  return analysis
end

-- ─── PHASE 3 : DÉCIDER ───────────────────────────────────────────────────────
function Brain._decide(analysis)
  -- Changement de mode avec cooldown
  if analysis.mode_change and analysis.mode_change ~= TROXT.mode then
    local since_change = now_sec() - (brain_state.last_mode_change_at or 0)
    if since_change >= REASON.MODE_CHANGE_COOLDOWN_SEC then
      Brain._enqueue_decision({
        id         = "MODE_CHANGE_" .. analysis.mode_change,
        type       = "MODE_CHANGE",
        priority   = 1,
        certainty  = REASON.CERTAINTY_HIGH,
        data       = { new_mode = analysis.mode_change, old_mode = TROXT.mode },
        created_at = now_sec(),
      })
    end
  end

  -- Cascade risk — priorité absolue
  if analysis.cascade_risk then
    Brain._enqueue_decision({
      id         = "CASCADE_PREVENTION",
      type       = "CASCADE_PREVENTION",
      priority   = 0,
      certainty  = REASON.CERTAINTY_HIGH,
      data       = { dead_agents = analysis.dead_agents },
      created_at = now_sec(),
    })
  end

  -- Traitement des anomalies individuelles
  for _, anomaly in ipairs(analysis.anomalies) do
    Brain._process_anomaly(anomaly)
  end

  -- Rappel de routine
  if TROXT.cycle_count % 300 == 0 then
    Brain._enqueue_decision({
      id         = "ROUTINE_REMIND_" .. now_sec(),
      type       = "ROUTINE_REMIND",
      priority   = 5,
      certainty  = REASON.CERTAINTY_HIGH,
      data       = { agents = Agents.get_active_ids() },
      created_at = now_sec(),
    })
  end
end

-- ✨ v3.0 : Extrait en fonction pour éviter le goto continue
function Brain._process_anomaly(anomaly)
  local rule_id = anomaly.type .. ":" .. anomaly.agent_id
  local last    = brain_state.last_decision_at[rule_id] or 0
  local elapsed = now_sec() - last

  if elapsed < REASON.DECISION_COOLDOWN_SEC then return end
  brain_state.last_decision_at[rule_id] = now_sec()

  if anomaly.type == "AGENT_DEAD" then
    Brain._enqueue_decision({
      id         = "ESCALATE_" .. anomaly.agent_id,
      type       = "ESCALATE",
      priority   = 1,
      certainty  = REASON.CERTAINTY_HIGH,
      data       = anomaly,
      created_at = now_sec(),
    })
  elseif anomaly.type == "AGENT_SILENT" then
    if (brain_state.anomaly_counts[anomaly.agent_id] or 0) >= REASON.ANOMALY_THRESHOLD then
      Brain._enqueue_decision({
        id         = "REMIND_" .. anomaly.agent_id,
        type       = "REMIND_TASKS",
        priority   = 2,
        certainty  = REASON.CERTAINTY_MEDIUM,
        data       = anomaly,
        created_at = now_sec(),
      })
    end
  elseif anomaly.type == "ERROR_SPIKE" then
    Brain._enqueue_decision({
      id         = "INVESTIGATE_" .. anomaly.agent_id,
      type       = "INVESTIGATE",
      priority   = 2,
      certainty  = REASON.CERTAINTY_MEDIUM,
      data       = anomaly,
      created_at = now_sec(),
    })
  end
end

-- ─── ENQUEUE (avec signature v3.0) ───────────────────────────────────────────
function Brain._enqueue_decision(decision)
  -- Anti-doublon
  for _, d in ipairs(brain_state.pending_decisions) do
    if d.id == decision.id then return end
  end

  -- ✨ v3.0 : Signature cryptographique
  decision.signature = decision_signature(decision)

  table.insert(brain_state.pending_decisions, decision)
  brain_state.decisions_this_min = brain_state.decisions_this_min + 1

  table.sort(brain_state.pending_decisions, function(a, b)
    return a.priority < b.priority
  end)

  log("DECISION", nil,
    string.format("Décision en file: %s [P%d, %.0f%% certitude] %s",
      decision.type, decision.priority, decision.certainty * 100, decision.signature))
end

-- ─── PHASE 4 : EXÉCUTER ──────────────────────────────────────────────────────
function Brain._execute_pending()
  local executed = 0
  -- ✨ v3.0 : Réduit le nombre max si charge cognitive élevée
  local max_per_tick = brain_state.cognitive_load >= 80 and 2 or 5

  while #brain_state.pending_decisions > 0 and executed < max_per_tick do
    local decision = table.remove(brain_state.pending_decisions, 1)
    Brain._apply_decision(decision)
    executed = executed + 1
  end
end

function Brain._apply_decision(decision)
  brain_state.metrics.total_decisions = brain_state.metrics.total_decisions + 1

  table.insert(brain_state.decision_history, 1, {
    id         = decision.id,
    type       = decision.type,
    certainty  = decision.certainty,
    signature  = decision.signature,       -- ✨ v3.0
    applied_at = now_sec(),
    data       = decision.data,
  })
  if #brain_state.decision_history > 500 then
    table.remove(brain_state.decision_history)
  end

  -- Dispatch
  local dispatch = {
    MODE_CHANGE         = Brain._do_mode_change,
    CASCADE_PREVENTION  = Brain._do_cascade_prevention,
    ESCALATE            = Brain._do_escalate,
    REMIND_TASKS        = function(d) Brain._do_remind_tasks(d.data.agent_id) end,
    INVESTIGATE         = Brain._do_investigate,
    ROUTINE_REMIND      = function(d) Brain._do_routine_remind(d.data.agents) end,
  }

  local handler = dispatch[decision.type]
  if handler then
    if decision.type == "MODE_CHANGE" then
      handler(decision.data.new_mode)
    else
      handler(decision.data or decision)
    end
  end

  Events.emit("troxt:decision_applied", {
    id        = decision.id,
    type      = decision.type,
    signature = decision.signature,
    data      = decision.data,
  })

  Memory.set("troxt:last_decision", {
    id        = decision.id,
    type      = decision.type,
    signature = decision.signature,
    at        = os.date("%Y-%m-%d %H:%M:%S"),
  })
end

-- ─── ACTIONS ─────────────────────────────────────────────────────────────────
function Brain._do_mode_change(new_mode)
  local old = TROXT.mode
  TROXT.mode = new_mode
  brain_state.last_mode_change_at = now_sec()
  log("WARN", nil, string.format("Mode changé: %s → %s", old, new_mode))
  Memory.set("troxt:mode", new_mode)
  Events.emit("troxt:mode_changed", { old = old, new = new_mode })
end

function Brain._do_cascade_prevention(data)
  log("CRITICAL", nil, "PRÉVENTION CASCADE — " .. #data.dead_agents .. " agent(s) mort(s)", data)
  brain_state.metrics.cascade_prevented = brain_state.metrics.cascade_prevented + 1

  for _, agent_id in ipairs(data.dead_agents) do
    Agents.set_status(agent_id, "RECOVERY")
    log("WARN", agent_id, "Marqué RECOVERY — tentative de rétablissement")
    Events.emit("troxt:agent_recovery_started", { agent_id = agent_id })
  end

  if TROXT.mode == "NORMAL" then
    Brain._do_mode_change("VIGILANCE")
  end
end

function Brain._do_escalate(data)
  local agent = Agents.get(data.agent_id)
  local name  = agent and agent.name or data.agent_id
  log("CRITICAL", name,
    string.format("ESCALADE — agent mort depuis %ds", data.silence or 0), data)
  Events.emit("troxt:agent_escalated", {
    agent_id = data.agent_id,
    silence  = data.silence,
    name     = name,
  })
end

function Brain._do_remind_tasks(agent_id)
  local agent = Agents.get(agent_id)
  if not agent then return end
  local tasks = agent.tasks or {}

  -- ✨ v3.0 : Focus contextuel
  brain_state.current_focus = agent_id
  brain_state.focus_started_at = now_sec()

  log("FOCUS", agent.name, "Focus contextuel — " .. #tasks .. " tâche(s)")
  for i, task in ipairs(tasks) do
    log("INFO", agent.name, string.format("  [%d] %s", i, tostring(task)))
  end
  Events.emit("troxt:task_reminder", {
    agent_id = agent_id,
    name     = agent.name,
    tasks    = tasks,
  })
end

function Brain._do_investigate(data)
  local agent = Agents.get(data.agent_id)
  local name  = agent and agent.name or data.agent_id
  log("ERROR", name,
    string.format("INVESTIGATION — %d erreur(s) détectée(s)", data.count or 0))
  brain_state.error_counts[data.agent_id] = (brain_state.error_counts[data.agent_id] or 0) + 1
  Events.emit("troxt:investigation", { agent_id = data.agent_id, name = name, data = data })
end

function Brain._do_routine_remind(agent_ids)
  log("THINK", nil, "Rappel de routine — " .. #agent_ids .. " agent(s) actif(s)")
  for _, id in ipairs(agent_ids) do
    Brain._do_remind_tasks(id)
  end
end

-- ─── ✨ v3.0 : SNAPSHOT AUTOMATIQUE ──────────────────────────────────────────
function Brain._snapshot()
  local snapshot = {
    saved_at    = os.date("%Y-%m-%d %H:%M:%S"),
    cycle_count = TROXT.cycle_count,
    mode        = TROXT.mode,
    state       = TROXT.state,
    metrics     = brain_state.metrics,
    predictions = brain_state.predictions,
  }
  Memory.set("troxt:snapshot", snapshot, { ttl = 7 * 24 * 3600 })
  brain_state.metrics.snapshots_saved = brain_state.metrics.snapshots_saved + 1
  log("SNAPSHOT", nil, "Snapshot sauvegardé", { cycle = TROXT.cycle_count })
end

-- ─── PHASE 5 : APPRENDRE ─────────────────────────────────────────────────────
function Brain._learn(obs)
  if obs.world then
    brain_state.world_context = obs.world
    brain_state.world_context.last_update = now_sec()
  end

  -- ✨ v3.0 : Reset focus après expiration
  if brain_state.current_focus and
     (now_sec() - brain_state.focus_started_at) > REASON.FOCUS_ATTENTION_MS then
    brain_state.current_focus = nil
  end
end

-- ─── TÂCHES RÉCURRENTES (v3.0 avec IDs traçables) ────────────────────────────
function Brain._schedule_recurring_tasks()
  local jobs = {}

  jobs.rapport = Scheduler.every(300, "troxt:rapport", function()
    local report = Brain.get_report()
    Events.emit("troxt:report", report)
    Memory.set("troxt:last_report", report)
    log("INFO", nil, "Rapport système généré", {
      agents_online = report.agents_online,
      decisions     = report.metrics.total_decisions,
      mode          = TROXT.mode,
    })
  end)

  jobs.routine = Scheduler.every(30, "troxt:routine_remind", function()
    if TROXT.state == "ACTIVE" then
      local active = Agents.get_active_ids()
      for _, id in ipairs(active) do
        Brain._do_remind_tasks(id)
      end
    end
  end)

  jobs.memory_flush = Scheduler.every(REASON.MEMORY_FLUSH_INTERVAL, "troxt:memory_flush", function()
    Memory.flush()
    log("INFO", nil, "Mémoire flushée")
  end)

  jobs.health_check = Scheduler.every(10, "troxt:health_check", function()
    local health = Brain.get_health()
    if health.score < 50 then
      log("WARN", nil, "Santé système dégradée: " .. health.score .. "/100")
    end
    Events.emit("troxt:health", health)
  end)

  -- ✨ v3.0 : Snapshot automatique
  jobs.snapshot = Scheduler.every(REASON.SNAPSHOT_INTERVAL_SEC, "troxt:snapshot", function()
    Brain._snapshot()
  end)

  brain_state.scheduler_jobs = jobs
  log("INFO", nil, "Tâches récurrentes planifiées — " .. Brain._table_count(jobs) .. " jobs")
end

function Brain._table_count(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── API PUBLIQUE ────────────────────────────────────────────────────────────
function Brain.update_world_context(data)
  for k, v in pairs(data) do
    brain_state.world_context[k] = v
  end
end

function Brain.force_decision(type, data, priority)
  Brain._enqueue_decision({
    id         = "MANUAL_" .. type .. "_" .. now_sec(),
    type       = type,
    priority   = priority or 1,
    certainty  = REASON.CERTAINTY_HIGH,
    data       = data or {},
    created_at = now_sec(),
  })
  log("DECISION", nil, "Décision manuelle: " .. type)
end

function Brain.feedback(decision_id, was_correct)
  if was_correct then
    brain_state.metrics.correct_decisions = brain_state.metrics.correct_decisions + 1
  else
    brain_state.metrics.false_positives = brain_state.metrics.false_positives + 1
  end
  Memory.set("troxt:feedback:" .. decision_id, {
    correct = was_correct,
    at      = now_sec(),
  }, { ttl = 30 * 24 * 3600 })
end

-- ✨ v3.0 : Feedback prédiction
function Brain.prediction_feedback(prediction_type, was_accurate)
  if was_accurate then
    brain_state.metrics.predictions_correct = brain_state.metrics.predictions_correct + 1
  end
end

function Brain.get_report()
  local agents_online = 0
  for _, a in pairs(Agents.get_all()) do
    if a.status == "online" then agents_online = agents_online + 1 end
  end

  return {
    signature       = TROXT.signature,
    version         = TROXT.version,
    edition         = TROXT.edition,
    state           = TROXT.state,
    mode            = TROXT.mode,
    cycle_count     = TROXT.cycle_count,
    uptime_sec      = now_sec() - TROXT.started_at,
    agents_total    = Agents.count(),
    agents_online   = agents_online,
    pending_dec     = #brain_state.pending_decisions,
    anomalies       = brain_state.anomaly_counts,
    world           = brain_state.world_context,
    metrics         = brain_state.metrics,
    memory_keys     = Memory.count(),
    -- ✨ v3.0 : Nouveaux champs
    cognitive_load  = brain_state.cognitive_load,
    predictions     = brain_state.predictions,
    circuit_breakers = brain_state.circuit_breakers,
    current_focus   = brain_state.current_focus,
    learned_threshold = REASON.ANOMALY_THRESHOLD,
    generated_at    = os.date("%Y-%m-%d %H:%M:%S"),
  }
end

function Brain.get_health()
  local score  = 100
  local issues = {}

  for id, count in pairs(brain_state.anomaly_counts) do
    if count >= 5 then
      score = score - 20
      table.insert(issues, id .. " mort")
    end
  end

  if TROXT.mode == "VIGILANCE" then score = score - 10 end
  if TROXT.mode == "LOCKDOWN"  then score = score - 30 end
  if TROXT.mode == "RECOVERY"  then score = score - 15 end

  if #brain_state.pending_decisions > 20 then
    score = score - 10
    table.insert(issues, "file décisions saturée")
  end

  local fp = brain_state.metrics.false_positives
  local td = math.max(1, brain_state.metrics.total_decisions)
  if fp / td > 0.3 then
    score = score - 10
    table.insert(issues, "taux FP élevé")
  end

  -- ✨ v3.0 : Charge cognitive
  if brain_state.cognitive_load >= 80 then
    score = score - 10
    table.insert(issues, "charge cognitive haute")
  end

  -- ✨ v3.0 : Circuit breakers actifs
  local cb_count = Brain._table_count(brain_state.circuit_breakers)
  if cb_count > 0 then
    score = score - (cb_count * 5)
    table.insert(issues, cb_count .. " circuit(s) breaker(s) actif(s)")
  end

  score = math.max(0, math.min(100, score))
  return {
    score          = score,
    grade          = score >= 90 and "EXCELLENT"
                  or score >= 70 and "BON"
                  or score >= 50 and "DÉGRADÉ" or "CRITIQUE",
    issues         = issues,
    mode           = TROXT.mode,
    cognitive_load = brain_state.cognitive_load,
  }
end

function Brain.get_decisions(limit)
  limit = limit or 20
  local result = {}
  for i = 1, math.min(limit, #brain_state.decision_history) do
    table.insert(result, brain_state.decision_history[i])
  end
  return result
end

-- ✨ v3.0 : Getters d'introspection
function Brain.get_predictions() return brain_state.predictions end
function Brain.get_circuit_breakers() return brain_state.circuit_breakers end
function Brain.get_cognitive_load() return brain_state.cognitive_load end
function Brain.get_focus() return brain_state.current_focus end
function Brain.get_tick_history() return brain_state.tick_history end

-- ─── SHUTDOWN PROPRE (v3.0) ──────────────────────────────────────────────────
function Brain.shutdown()
  log("WARN", nil, "Arrêt TROXT en cours...")
  TROXT.state = "SHUTDOWN"

  -- ✨ v3.0 : Annulation des jobs Scheduler
  if brain_state.scheduler_jobs then
    for name, job_id in pairs(brain_state.scheduler_jobs) do
      if Scheduler.cancel then
        Scheduler.cancel(job_id)
        log("INFO", nil, "Job annulé : " .. name)
      end
    end
  end

  -- Snapshot final
  Brain._snapshot()

  Memory.set("troxt:cycle_count",       TROXT.cycle_count)
  Memory.set("troxt:pending_decisions", brain_state.pending_decisions)
  Memory.set("troxt:last_shutdown",     os.date("%Y-%m-%d %H:%M:%S"))
  Memory.set("troxt:metrics",           brain_state.metrics)
  Memory.flush()

  log("SUCCESS", nil, "Mémoire sauvegardée. TROXT hors ligne.", {
    cycles      = TROXT.cycle_count,
    decisions   = brain_state.metrics.total_decisions,
    predictions = brain_state.metrics.predictions_made,
    snapshots   = brain_state.metrics.snapshots_saved,
  })
  Events.emit("troxt:shutdown", { cycle = TROXT.cycle_count })

  TROXT.booted = false
end

return Brain
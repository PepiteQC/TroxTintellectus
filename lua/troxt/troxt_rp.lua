--[[
══════════════════════════════════════════════════════════════════════
  TROXT⬡ — TROXT_RP.LUA
  Mécaniques RP Open World complètes — style GTA/FiveM pour TroxtWorld
  Jobs · Crimes · Économie · Factions · Véhicules · Vie sociale · Statuts

  Signature : TROXT⬡
  Chemin    : lua/troxt/troxt_rp.lua
══════════════════════════════════════════════════════════════════════
]]

local RP     = {}
local Events = require("troxt.troxt_events")
local Memory = require("troxt.troxt_memory")

local SIG = "TROXT⬡"

local function log(level, msg, data)
  local icons = { INFO="ℹ", WARN="⚠", ERROR="✖", OK="✓", RP="⬡" }
  print(string.format("[%s] %s %s — %s", os.date("%H:%M:%S"), icons[level] or "·", SIG, msg))
  if data then
    for k, v in pairs(data) do
      print(string.format("   ↳ %s: %s", k, tostring(v)))
    end
  end
end

local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── CONSTANTES RP ────────────────────────────────────────────────────────────
local CFG = {
  starting_cash      = 2500,
  starting_bank      = 0,
  paycheck_interval  = 1800,
  tax_rate           = 0.12,
  max_cash_on_hand   = 50000,
  max_bank_balance   = 999999,

  max_level          = 100,
  xp_per_level       = 1000,

  need_decay_rate    = 1,
  need_crit_threshold = 20,
  needs_emit_interval = 1,      -- ✅ secondes min entre deux events needs_updated

  wanted_decay_sec   = 300,
  max_wanted         = 5,
  cop_response_sec   = 30,

  max_vehicles_owned = 10,
  max_speed_kmh      = 280,

  max_faction_members = 50,
  faction_tax_rate    = 0.05,

  max_properties_owned = 5,
}

-- ─── JOBS DISPONIBLES ────────────────────────────────────────────────────────
local JOBS = {
  livreur = {
    id="livreur", name="Livreur", icon="📦", legal=true,
    pay_per_task=120, xp_per_task=15, required_level=0,
    required_items={}, vehicle_required=true, uniform="livreur_outfit",
    tasks={ "Récupérer le colis au dépôt", "Livrer au point de destination", "Confirmer la livraison" },
  },
  mecano = {
    id="mecano", name="Mécanicien", icon="🔧", legal=true,
    pay_per_task=280, xp_per_task=30, required_level=5,
    required_items={ "clé_à_molette", "trousse_outils" }, vehicle_required=false,
    uniform="mecano_outfit",
    tasks={ "Diagnostiquer le véhicule", "Commander les pièces requises", "Effectuer la réparation", "Test de route" },
  },
  policier = {
    id="policier", name="Agent de police", icon="👮", legal=true,
    pay_per_task=350, xp_per_task=40, required_level=10,
    required_items={}, faction_required="police", vehicle_required=true,
    uniform="police_outfit", weapons_allowed={ "pistolet_service", "matraque", "menottes" },
    tasks={ "Patrouille de secteur", "Répondre aux appels d'urgence", "Arrêter les suspects recherchés", "Rédiger les rapports d'incident" },
  },
  medecin = {
    id="medecin", name="Médecin urgentiste", icon="🏥", legal=true,
    pay_per_task=420, xp_per_task=50, required_level=15,
    required_items={ "trousse_medicale" }, faction_required="hopital",
    vehicle_required=true, uniform="medecin_outfit",
    tasks={ "Répondre aux urgences", "Soigner les joueurs blessés", "Transporter au centre médical", "Rédiger le rapport médical" },
  },
  dealer_auto = {
    id="dealer_auto", name="Concessionnaire automobile", icon="🚗", legal=true,
    pay_per_task=500, xp_per_task=35, required_level=8,
    required_items={}, vehicle_required=false, commission_pct=0.08,
    tasks={ "Accueillir le client", "Présenter les véhicules disponibles", "Finaliser la vente", "Enregistrer le transfert de propriété" },
  },
  cuisinier = {
    id="cuisinier", name="Chef cuisinier", icon="👨‍🍳", legal=true,
    pay_per_task=200, xp_per_task=20, required_level=0,
    required_items={ "tablier" }, vehicle_required=false,
    uniform="chef_outfit", restores_need={ hunger=40 },
    tasks={ "Préparer les ingrédients", "Cuisiner le plat commandé", "Servir et encaisser" },
  },
  voleur = {
    id="voleur", name="Voleur", icon="🦹", legal=false,
    pay_per_task=800, xp_per_task=60, wanted_gain=1, required_level=0,
    risk="HIGH", fail_consequence="arrestation",
    tasks={ "Repérer la cible", "Attendre le bon moment", "Exécuter le vol", "Disparaître avant l'arrivée de la police" },
  },
  braqueur = {
    id="braqueur", name="Braqueur", icon="🔫", legal=false,
    pay_per_task=5000, xp_per_task=200, wanted_gain=3, required_level=20,
    min_players=2, risk="EXTREME", fail_consequence="arrestation + confiscation",
    tasks={ "Planifier le braquage (30 min)", "Sécuriser le périmètre", "Neutraliser les systèmes d'alarme", "Vider le coffre", "Prendre la fuite" },
  },
}

-- ─── CRIMES ──────────────────────────────────────────────────────────────────
local CRIMES = {
  speeding        = { name="Excès de vitesse",    wanted=0, fine=500,   xp=-5 },
  theft           = { name="Vol simple",           wanted=1, fine=2000,  xp=-20 },
  assault         = { name="Agression",            wanted=1, fine=3000,  xp=-30 },
  vehicle_theft   = { name="Vol de véhicule",      wanted=2, fine=5000,  xp=-40 },
  drug_possession = { name="Possession de drogue", wanted=2, fine=4000,  xp=-35 },
  robbery         = { name="Braquage",             wanted=3, fine=15000, xp=-100 },
  murder          = { name="Meurtre",              wanted=5, fine=50000, xp=-500 },
  cop_killing     = { name="Meurtre d'un agent",   wanted=5, fine=75000, xp=-1000 },
}

-- ─── FACTIONS ────────────────────────────────────────────────────────────────
local DEFAULT_FACTIONS = {
  police = {
    id="police", name="Police de TroxtWorld", icon="👮", color="#1a3a6b", legal=true,
    max_members=50, ranks={ "Recrue","Agent","Sergent","Lieutenant","Capitaine","Chef" },
    perks={ "armes_service","véhicules_police","accès_commissariat","arrestation" }, salary=350,
  },
  hopital = {
    id="hopital", name="Hôpital TroxtWorld", icon="🏥", color="#ffffff", legal=true,
    max_members=30, ranks={ "Stagiaire","Infirmier","Médecin","Chirurgien","Directeur" },
    perks={ "soins_gratuits","véhicules_ambulance","accès_hôpital","spawn_hôpital" }, salary=420,
  },
  mafia = {
    id="mafia", name="La Famiglia", icon="🤵", color="#1a0a0a", legal=false,
    max_members=25, ranks={ "Associé","Soldato","Caporegime","Underboss","Boss" },
    perks={ "armes_illégales","safe_house","blanchiment_argent","territoire" }, salary=0, territory={},
  },
  gang_rue = {
    id="gang_rue", name="Street Troxt", icon="🏴", color="#7c3aed", legal=false,
    max_members=40, ranks={ "Prospect","Membre","OG","Shotcaller","Boss" },
    perks={ "territoire","deal_drogues","vol_véhicules","armes_rue" }, salary=0, territory={},
  },
  mecano_faction = {
    id="mecano_faction", name="TroxtGarage", icon="🔧", color="#c9a84c", legal=true,
    max_members=20, ranks={ "Apprenti","Mécanicien","Chef Mécanicien","Propriétaire" },
    perks={ "réparations_gratuites","accès_garage","véhicules_service","tuning" }, salary=280,
  },
}

-- ─── ÉTAT RP ─────────────────────────────────────────────────────────────────
local _players       = {}
local _vehicles      = {}
local _factions      = {}
local _properties    = {}
local _jobs_active   = {}
local _crimes_log    = {}
local _last_needs_emit = {}   -- ✅ [player_id] → timestamp dernier emit
local _economy = {
  total_money_in_world = 0,
  transactions_today   = 0,
  taxes_collected      = 0,
}

-- Vérifie que le joueur possède tous les items requis
local function has_required_items(p, items)
  if not items or #items == 0 then return true end
  -- p.inventory peut être une liste de chaînes OU de { item, qty } — on gère les deux
  local owned = {}
  for _, it in ipairs(p.inventory or {}) do
    if type(it) == "string" then owned[it] = true
    elseif type(it) == "table" and it.item then owned[it.item] = true end
  end
  for _, req in ipairs(items) do
    if not owned[req] then return false, req end
  end
  return true
end

-- ─── INIT ─────────────────────────────────────────────────────────────────────
function RP.init()
  for id, def in pairs(DEFAULT_FACTIONS) do
    _factions[id] = {
      id=def.id, name=def.name, icon=def.icon, color=def.color, legal=def.legal,
      members={}, ranks=def.ranks, perks=def.perks, salary=def.salary,
      treasury=0, territory=def.territory or {}, founded_at=os.time(),
    }
  end

  local saved_economy = Memory.get("rp:economy")
  if saved_economy then _economy = saved_economy end

  log("OK", "Système RP initialisé", {
    jobs     = count_keys(JOBS),
    factions = count_keys(_factions),
    crimes   = count_keys(CRIMES),
  })

  Events.emit("troxtworld:rp_ready", { signature = SIG })
end

-- ─── JOUEUR RP ───────────────────────────────────────────────────────────────
function RP.create_player(player_id, username)
  if _players[player_id] then return _players[player_id] end

  _players[player_id] = {
    id          = player_id,
    username    = username,
    level       = 1,
    xp          = 0,
    cash        = CFG.starting_cash,
    bank        = CFG.starting_bank,
    needs = {
      health=100, hunger=100, thirst=100, energy=100, stress=0,
    },
    wanted      = 0,
    crimes      = {},
    arrests     = 0,
    job         = nil,
    faction     = nil,
    faction_rank= 0,
    vehicles    = {},
    properties  = {},
    inventory   = {},
    play_time   = 0,
    kills       = 0,
    deaths      = 0,
    jobs_done   = 0,
    money_earned= 0,
    created_at  = os.time(),
    last_seen   = os.time(),
    signature   = SIG,
  }

  _economy.total_money_in_world = _economy.total_money_in_world + CFG.starting_cash

  log("OK", string.format("Joueur créé: %s (%s)", username or "?", player_id))
  Events.emit("troxtworld:player_created", {
    id=player_id, username=username, cash=CFG.starting_cash, sig=SIG,
  })

  return _players[player_id]
end

function RP.get_player(id) return _players[id] end

-- ─── BESOINS VITAUX ──────────────────────────────────────────────────────────
function RP.tick_needs(player_id, dt_sec)
  local p = _players[player_id]
  if not p then return end

  local decay = CFG.need_decay_rate * (dt_sec / 60)

  p.needs.hunger = math.max(0, p.needs.hunger - decay * 0.8)
  p.needs.thirst = math.max(0, p.needs.thirst - decay * 1.2)
  p.needs.energy = math.max(0, p.needs.energy - decay * 0.5)

  if p.wanted > 0 then
    p.needs.stress = math.min(100, p.needs.stress + decay * p.wanted * 2)
  else
    p.needs.stress = math.max(0, p.needs.stress - decay * 0.5)
  end

  if p.needs.hunger < CFG.need_crit_threshold then
    p.needs.health = math.max(0, p.needs.health - decay * 2)
  end
  if p.needs.thirst < CFG.need_crit_threshold then
    p.needs.health = math.max(0, p.needs.health - decay * 3)
  end

  if p.needs.health <= 0 then
    RP.kill_player(player_id, "besoins_vitaux")
    return
  end

  -- ✅ Throttle : n'émet l'event qu'une fois par intervalle
  local now = os.time()
  if not _last_needs_emit[player_id] or (now - _last_needs_emit[player_id]) >= CFG.needs_emit_interval then
    _last_needs_emit[player_id] = now
    Events.emit("troxtworld:needs_updated", {
      id=player_id, needs=p.needs, sig=SIG,
    })
  end
end

-- ─── ÉCONOMIE ────────────────────────────────────────────────────────────────
function RP.add_cash(player_id, amount, reason)
  local p = _players[player_id]
  if not p then return false, "Joueur introuvable" end
  if amount < 0 and p.cash < math.abs(amount) then
    return false, "Fonds insuffisants"
  end

  local tax = 0
  if amount > 0 and reason and reason:find("job", 1, true) then
    tax    = math.floor(amount * CFG.tax_rate)
    amount = amount - tax
    _economy.taxes_collected = _economy.taxes_collected + tax
  end

  p.cash = math.min(CFG.max_cash_on_hand, math.max(0, p.cash + amount))
  if amount > 0 then p.money_earned = p.money_earned + amount end

  _economy.total_money_in_world = _economy.total_money_in_world + amount
  _economy.transactions_today   = _economy.transactions_today + 1

  Events.emit("troxtworld:cash_updated", {
    id=player_id, cash=p.cash, delta=amount, tax=tax, reason=reason, sig=SIG,
  })

  return true, p.cash
end

function RP.transfer_cash(from_id, to_id, amount)
  local from = _players[from_id]
  local to   = _players[to_id]
  if not from or not to then return false, "Joueur introuvable" end
  if from.cash < amount then return false, "Fonds insuffisants" end

  from.cash = from.cash - amount
  to.cash   = math.min(CFG.max_cash_on_hand, to.cash + amount)

  log("OK", string.format("Transfert %d$ : %s → %s", amount, from_id, to_id))
  Events.emit("troxtworld:transfer", { from=from_id, to=to_id, amount=amount, sig=SIG })
  return true
end

function RP.bank_deposit(player_id, amount)
  local p = _players[player_id]
  if not p or p.cash < amount then return false, "Fonds insuffisants" end
  p.cash = p.cash - amount
  p.bank = math.min(CFG.max_bank_balance, p.bank + amount)
  Events.emit("troxtworld:bank_deposit", { id=player_id, amount=amount, bank=p.bank, sig=SIG })
  return true, p.bank
end

function RP.bank_withdraw(player_id, amount)
  local p = _players[player_id]
  if not p or p.bank < amount then return false, "Solde insuffisant" end
  p.bank = p.bank - amount
  p.cash = math.min(CFG.max_cash_on_hand, p.cash + amount)
  Events.emit("troxtworld:bank_withdraw", { id=player_id, amount=amount, cash=p.cash, sig=SIG })
  return true, p.cash
end

-- ─── EMPLOIS ─────────────────────────────────────────────────────────────────
function RP.set_job(player_id, job_id)
  local p   = _players[player_id]
  local job = JOBS[job_id]
  if not p   then return false, "Joueur introuvable" end
  if not job then return false, "Emploi inexistant: " .. tostring(job_id) end
  if p.level < (job.required_level or 0) then
    return false, string.format("Niveau insuffisant (requis: %d, actuel: %d)",
      job.required_level, p.level)
  end
  -- ✅ Vérif faction requise
  if job.faction_required and p.faction ~= job.faction_required then
    return false, string.format("Faction requise: %s", job.faction_required)
  end
  -- ✅ Vérif items requis
  local ok_items, missing = has_required_items(p, job.required_items)
  if not ok_items then
    return false, string.format("Item requis manquant: %s", missing)
  end

  p.job = job_id
  log("OK", string.format("%s → Emploi: %s %s", p.username, job.icon, job.name))
  Events.emit("troxtworld:job_set", {
    player_id=player_id, job_id=job_id, job_name=job.name, sig=SIG,
  })
  return true
end

function RP.start_task(player_id)
  local p = _players[player_id]
  if not p or not p.job then return false, "Aucun emploi" end
  local job = JOBS[p.job]
  if not job then return false, "Emploi introuvable" end

  -- ✅ Re-vérif items (au cas où ils auraient été perdus depuis set_job)
  local ok_items, missing = has_required_items(p, job.required_items)
  if not ok_items then
    return false, string.format("Item requis manquant: %s", missing)
  end

  if _jobs_active[player_id] then return false, "Tâche déjà en cours" end

  _jobs_active[player_id] = {
    job=p.job, task_index=1, started_at=os.time(), tasks=job.tasks,
  }

  local first_task = job.tasks[1]
  log("OK", string.format("%s — Tâche démarrée: %s", job.icon, first_task))
  Events.emit("troxtworld:task_started", {
    player_id=player_id, job_id=p.job, task=first_task,
    task_index=1, total=#job.tasks, sig=SIG,
  })
  return true, first_task
end

function RP.advance_task(player_id)
  local active = _jobs_active[player_id]
  if not active then return false, "Aucune tâche active" end

  local job = JOBS[active.job]
  if not job then return false, "Emploi introuvable" end

  active.task_index = active.task_index + 1

  if active.task_index > #active.tasks then
    _jobs_active[player_id] = nil
    local pay = job.pay_per_task
    local xp  = job.xp_per_task
    RP.add_cash(player_id, pay, "job_" .. active.job)
    RP.add_xp(player_id, xp)

    local p = _players[player_id]
    if p then p.jobs_done = p.jobs_done + 1 end

    log("OK", string.format("Tâche terminée: %s — Paie: %d$ XP: +%d", job.name, pay, xp))
    Events.emit("troxtworld:task_completed", {
      player_id=player_id, job_id=active.job, pay=pay, xp=xp, sig=SIG,
    })
    return true, nil, pay
  end

  local next_task = active.tasks[active.task_index]
  Events.emit("troxtworld:task_advanced", {
    player_id=player_id, task=next_task,
    task_index=active.task_index, total=#active.tasks, sig=SIG,
  })
  return true, next_task
end

-- ─── XP & NIVEAUX ────────────────────────────────────────────────────────────
function RP.add_xp(player_id, amount)
  local p = _players[player_id]
  if not p then return end

  -- ✅ Clamp : XP total reste dans [0, +inf) ; pas de niveau négatif
  p.xp = math.max(0, p.xp + amount)

  local leveled = false
  while p.xp >= CFG.xp_per_level and p.level < CFG.max_level do
    p.xp    = p.xp - CFG.xp_per_level
    p.level = p.level + 1
    leveled = true
    Events.emit("troxtworld:level_up", { player_id=player_id, level=p.level, sig=SIG })
    log("OK", string.format("LEVEL UP — %s → Niveau %d 🎉", p.username, p.level))
  end

  return leveled
end

-- ─── CRIMINALITÉ ─────────────────────────────────────────────────────────────
function RP.commit_crime(player_id, crime_id)
  local p     = _players[player_id]
  local crime = CRIMES[crime_id]
  if not p     then return false, "Joueur introuvable" end
  if not crime then return false, "Crime inexistant" end

  p.wanted = math.min(CFG.max_wanted, p.wanted + crime.wanted)
  if crime.xp < 0 then RP.add_xp(player_id, crime.xp) end

  table.insert(p.crimes, {
    crime=crime_id, name=crime.name, at=os.time(), wanted=crime.wanted,
  })

  table.insert(_crimes_log, 1, {
    player_id=player_id, crime=crime_id, name=crime.name, at=os.time(), wanted=p.wanted,
  })
  if #_crimes_log > 500 then table.remove(_crimes_log) end

  log("WARN", string.format("CRIME — %s: %s (wanted: %d étoiles)",
    p.username, crime.name, p.wanted))
  Events.emit("troxtworld:crime_committed", {
    player_id=player_id, crime=crime_id, name=crime.name, wanted=p.wanted, sig=SIG,
  })

  if p.wanted >= 2 then
    Events.emit("troxtworld:police_alert", {
      player_id=player_id, wanted=p.wanted, crime=crime.name,
      response_in=CFG.cop_response_sec, sig=SIG,
    })
  end

  return true, p.wanted
end

function RP.decay_wanted(player_id)
  local p = _players[player_id]
  if not p or p.wanted <= 0 then return end
  p.wanted = math.max(0, p.wanted - 1)
  Events.emit("troxtworld:wanted_decay", { player_id=player_id, wanted=p.wanted, sig=SIG })
end

function RP.arrest_player(player_id, officer_id)
  local p = _players[player_id]
  if not p then return false end

  -- Somme des amendes de tous les crimes non purgés
  -- Note : p.crimes accumule tant que le joueur n'est pas arrêté — c'est
  -- volontaire (un multirécidiviste paie l'addition complète).
  local fine = 0
  for _, crime in ipairs(p.crimes) do
    local c = CRIMES[crime.crime]
    if c then fine = fine + c.fine end
  end

  p.arrests = p.arrests + 1
  p.wanted  = 0
  p.crimes  = {}
  p.needs.stress = 0

  if fine > 0 then
    local actual_fine = math.min(fine, p.cash + p.bank)
    if p.cash >= actual_fine then
      p.cash = p.cash - actual_fine
    else
      local from_cash = p.cash
      p.cash = 0
      p.bank = math.max(0, p.bank - (actual_fine - from_cash))
    end
    _economy.taxes_collected = _economy.taxes_collected + actual_fine
  end

  log("WARN", string.format("ARRESTATION — %s — Amende: %d$", p.username, fine))
  Events.emit("troxtworld:arrested", {
    player_id=player_id, officer=officer_id, fine=fine, arrests=p.arrests, sig=SIG,
  })

  return true, fine
end

-- ─── FACTIONS ────────────────────────────────────────────────────────────────
function RP.join_faction(player_id, faction_id)
  local p = _players[player_id]
  local f = _factions[faction_id]
  if not p then return false, "Joueur introuvable" end
  if not f then return false, "Faction inexistante" end
  if p.faction then return false, "Déjà dans une faction — quitter d'abord" end
  if count_keys(f.members) >= CFG.max_faction_members then return false, "Faction au complet" end

  p.faction      = faction_id
  p.faction_rank = 1
  table.insert(f.members, player_id)

  log("OK", string.format("%s rejoint %s %s", p.username, f.icon, f.name))
  Events.emit("troxtworld:faction_joined", {
    player_id=player_id, faction_id=faction_id, name=f.name, sig=SIG,
  })
  return true
end

function RP.leave_faction(player_id)
  local p = _players[player_id]
  if not p or not p.faction then return false, "Pas dans une faction" end

  local f = _factions[p.faction]
  if f then
    for i, mid in ipairs(f.members) do
      if mid == player_id then
        table.remove(f.members, i)
        break
      end
    end
  end

  local old = p.faction
  p.faction      = nil
  p.faction_rank = 0

  Events.emit("troxtworld:faction_left", { player_id=player_id, faction_id=old, sig=SIG })
  return true
end

function RP.promote_faction(player_id, by_player_id)
  local p = _players[player_id]
  if not p or not p.faction then return false end
  local f = _factions[p.faction]
  if not f then return false end
  if p.faction_rank >= #f.ranks then return false, "Rang maximum atteint" end

  p.faction_rank = p.faction_rank + 1
  local rank_name = f.ranks[p.faction_rank]

  log("OK", string.format("Promotion — %s → %s [%s]", p.username, rank_name, f.name))
  Events.emit("troxtworld:faction_promoted", {
    player_id=player_id, rank=rank_name, faction=f.name, sig=SIG,
  })
  return true, rank_name
end

-- ─── VÉHICULES ───────────────────────────────────────────────────────────────
function RP.buy_vehicle(player_id, vehicle_type, price)
  local p = _players[player_id]
  if not p then return false, "Joueur introuvable" end
  if #p.vehicles >= CFG.max_vehicles_owned then return false, "Limite de véhicules atteinte" end
  if p.bank < price then return false, "Fonds bancaires insuffisants" end

  p.bank = p.bank - price
  local vehicle_id = string.format("VEH_%s_%d", player_id:sub(1,6), os.time())

  _vehicles[vehicle_id] = {
    id=vehicle_id, owner=player_id, type=vehicle_type, price=price,
    plate=string.format("TROXT-%04d", math.random(1000, 9999)),
    condition=100, mods={}, bought_at=os.time(), sig=SIG,
  }

  table.insert(p.vehicles, vehicle_id)

  log("OK", string.format("Véhicule acheté — %s → %s (%d$)", p.username, vehicle_type, price))
  Events.emit("troxtworld:vehicle_bought", {
    player_id=player_id, vehicle_id=vehicle_id, type=vehicle_type, price=price, sig=SIG,
  })
  return true, vehicle_id
end

function RP.damage_vehicle(vehicle_id, damage_pct)
  local v = _vehicles[vehicle_id]
  if not v then return end
  v.condition = math.max(0, v.condition - damage_pct)
  if v.condition <= 0 then
    Events.emit("troxtworld:vehicle_destroyed", {
      vehicle_id=vehicle_id, owner=v.owner, sig=SIG,
    })
  end
  return v.condition
end

function RP.repair_vehicle(vehicle_id, player_id)
  local v = _vehicles[vehicle_id]
  if not v then return false, "Véhicule introuvable" end
  -- ✅ Vérif propriétaire
  if v.owner ~= player_id then return false, "Tu n'es pas le propriétaire" end

  local p = _players[player_id]
  if not p then return false, "Joueur introuvable" end

  local cost = math.floor((100 - v.condition) * 12)
  if p.cash < cost then
    return false, string.format("Coût réparation: %d$ (disponible: %d$)", cost, p.cash)
  end

  p.cash      = p.cash - cost
  v.condition = 100
  Events.emit("troxtworld:vehicle_repaired", {
    vehicle_id=vehicle_id, cost=cost, sig=SIG,
  })
  return true, cost
end

-- ─── MORT ────────────────────────────────────────────────────────────────────
function RP.kill_player(player_id, cause)
  local p = _players[player_id]
  if not p then return end

  p.deaths       = p.deaths + 1
  p.needs.health = 100
  p.needs.hunger = 50
  p.needs.thirst = 50
  p.needs.energy = 50
  p.needs.stress = 0
  p.wanted       = math.max(0, p.wanted - 1)

  local lost = math.floor(p.cash * 0.30)
  p.cash = p.cash - lost
  _economy.total_money_in_world = _economy.total_money_in_world - lost

  log("WARN", string.format("MORT — %s (cause: %s) — Perdu: %d$", p.username, cause, lost))
  Events.emit("troxtworld:player_died", {
    player_id=player_id, cause=cause, lost_cash=lost,
    deaths=p.deaths, sig=SIG,
  })
end

-- ─── SAUVEGARDE ──────────────────────────────────────────────────────────────
function RP.save_player(player_id)
  local p = _players[player_id]
  if not p then return false end
  Memory.set("rp:player:" .. player_id, p, { ttl = 86400 * 7 })
  return true
end

function RP.load_player(player_id, username)
  local saved = Memory.get("rp:player:" .. player_id)
  if saved then
    _players[player_id] = saved
    log("OK", string.format("Joueur chargé: %s", username or player_id))
    return _players[player_id]
  end
  return RP.create_player(player_id, username)
end

function RP.save_economy()
  Memory.set("rp:economy", _economy)
end

-- ─── API PUBLIQUE ─────────────────────────────────────────────────────────────
function RP.get_jobs()     return JOBS end
function RP.get_crimes()   return CRIMES end
function RP.get_factions() return _factions end
function RP.get_vehicles() return _vehicles end
function RP.get_economy()  return _economy end

function RP.get_crimes_log(limit)
  local result = {}
  for i = 1, math.min(limit or 50, #_crimes_log) do
    table.insert(result, _crimes_log[i])
  end
  return result
end

function RP.get_leaderboard(stat, limit)
  stat  = stat or "money_earned"
  limit = limit or 10
  local list = {}
  for id, p in pairs(_players) do
    table.insert(list, { id=id, username=p.username, value=p[stat] or 0 })
  end
  table.sort(list, function(a, b) return a.value > b.value end)
  local result = {}
  for i = 1, math.min(limit, #list) do table.insert(result, list[i]) end
  return result
end

function RP.get_signature() return SIG end

return RP
-- ═══════════════════════════════════════════════════════════
--  FARMING.LUA — Module client-side pour fermes & élevage
--  TroxT EtherWorld v5 · Portneuf RP
-- ═══════════════════════════════════════════════════════════

local farming = {}

-- ── Configuration ───────────────────────────────────────────
farming.CONFIG = {
  tickInterval = 1000,          -- ms entre les ticks client
  interactRadius = 4.0,         -- mètres max pour interagir
  promptDistance = 3.5,         -- mètres pour afficher le prompt
  cropColors = {                -- Couleurs visuelles par culture
    mais = 0xc8a840,
    ble = 0xd4b850,
    foin = 0x5a8a40,
    patate = 0x6a8a48,
    cannabis = 0x2a6a32,
  },
  animalIcons = {               -- Icônes UI par type d'animal
    vache = "🐄", poulailler = "🐔", mouton = "🐑",
    cochon = "🐖", chevre = "🐐", cheval = "🐴",
    abeille = "🐝", canard = "🦆",
  },
}

-- ── État local (cache) ──────────────────────────────────────
local _plots = {}           -- { [plotId] = plotData }
local _herd = {}            -- { [animalId] = animalData }
local _herdStats = {}       -- stats agrégées
local _callbacks = {}       -- { eventName = { cb1, cb2, ... } }
local _lastTick = 0
local _playerInventory = {} -- cache local inventaire (optionnel)

-- ── Helpers internes ────────────────────────────────────────
local function _log(level, msg, ...)
  if TroxtLua and TroxtLua.log then
    TroxtLua.log(level, "[Farming] " .. msg, ...)
  else
    print(string.format("[Farming:%s] %s", level, msg))
  end
end

local function _emit(event, payload)
  if _callbacks[event] then
    for _, cb in ipairs(_callbacks[event]) do
      local ok, err = pcall(cb, payload)
      if not ok then _log("error", "Callback error: " .. tostring(err)) end
    end
  end
  -- Forward vers EventBus si disponible
  if eventBus and eventBus.emit then
    eventBus.emit("farming:" .. event, payload)
  end
end

local function _distance(x1, z1, x2, z2)
  return math.sqrt((x2 - x1)^2 + (z2 - z1)^2)
end

local function _findNearestPlot(px, pz, maxDist)
  local best, bestD = nil, maxDist or farming.CONFIG.interactRadius
  for _, plot in pairs(_plots) do
    local d = _distance(px, pz, plot.x, plot.z)
    if d < bestD then best, bestD = plot, d end
  end
  return best, bestD
end

local function _findNearestAnimal(px, pz, maxDist)
  local best, bestD = nil, maxDist or farming.CONFIG.interactRadius
  for _, animal in pairs(_herd) do
    local reach = (animal.kind == "poulailler") and 3.8 or 3.0
    local d = _distance(px, pz, animal.x, animal.z)
    if d < math.min(bestD, reach) then best, bestD = animal, d end
  end
  return best, bestD
end

-- ── API Publique : GETTERS ──────────────────────────────────

--- Retourne toutes les parcelles connues
function farming.getPlots()
  local result = {}
  for id, plot in pairs(_plots) do result[#result + 1] = plot end
  return result
end

--- Retourne une parcelle par ID
function farming.getPlot(plotId)
  return _plots[plotId]
end

--- Retourne tous les animaux du troupeau
function farming.getHerd()
  local result = {}
  for id, animal in pairs(_herd) do result[#result + 1] = animal end
  return result
end

--- Retourne un animal par ID
function farming.getAnimal(animalId)
  return _herd[animalId]
end

--- Retourne les stats agrégées du troupeau
function farming.getHerdStats()
  return _herdStats
end

--- Retourne la parcelle la plus proche du joueur
function farming.nearestPlot(px, pz, maxDist)
  return _findNearestPlot(px, pz, maxDist)
end

--- Retourne l'animal le plus proche du joueur
function farming.nearestAnimal(px, pz, maxDist)
  return _findNearestAnimal(px, pz, maxDist)
end

-- ── API Publique : ACTIONS ──────────────────────────────────

--- Travaille une parcelle (labour, semis, récolte)
-- @param plotId string ID de la parcelle
-- @param tool string Outil utilisé: "pelle", "tracteur", "faux", "rateau"
-- @param seed string? ID de semence (seulement pour semis)
-- @param callback function? Callback(result) appelé à la réponse
function farming.workPlot(plotId, tool, seed, callback)
  if not plotId or not tool then
    _log("warn", "workPlot: plotId et tool requis")
    if callback then callback({ ok = false, notice = "Paramètres manquants" }) end
    return
  end
  
  local payload = {
    type = "farming:work_plot",
    plotId = plotId,
    tool = tool,
    seed = seed,
    playerId = TroxtLua and TroxtLua.playerId or "Joueur1",
  }
  
  if LuaBridge and LuaBridge.rpc then
    LuaBridge.rpc("farming.workPlot", payload, function(result)
      _log("debug", "workPlot result: " .. tostring(result.ok))
      if result.ok and result.loot then
        _emit("harvest", { plotId = plotId, loot = result.loot })
      end
      if callback then callback(result) end
    end)
  else
    _log("warn", "LuaBridge non disponible — action ignorée")
    if callback then callback({ ok = false, notice = "Bridge indisponible" }) end
  end
end

--- Interagit avec un animal (traire, ramasser œufs, tondre, récolter miel)
-- @param animalId string ID de l'animal
-- @param hasFeed boolean? Le joueur a-t-il du foin/grain ?
-- @param callback function? Callback(result) appelé à la réponse
function farming.workAnimal(animalId, hasFeed, callback)
  if not animalId then
    _log("warn", "workAnimal: animalId requis")
    if callback then callback({ ok = false, notice = "Animal ID manquant" }) end
    return
  end
  
  local animal = _herd[animalId]
  if not animal then
    _log("warn", "workAnimal: animal inconnu " .. tostring(animalId))
    if callback then callback({ ok = false, notice = "Animal inconnu" }) end
    return
  end
  
  local payload = {
    type = "farming:work_stock",
    animalId = animalId,
    hasHay = hasFeed or false,
    hasWheat = hasFeed or false, -- simplifié
    playerId = TroxtLua and TroxtLua.playerId or "Joueur1",
  }
  
  if LuaBridge and LuaBridge.rpc then
    LuaBridge.rpc("farming.workStock", payload, function(result)
      _log("debug", "workAnimal result: " .. tostring(result.ok))
      if result.ok and result.loot then
        _emit("animal_production", { animalId = animalId, loot = result.loot })
      end
      if callback then callback(result) end
    end)
  else
    _log("warn", "LuaBridge non disponible — action ignorée")
    if callback then callback({ ok = false, notice = "Bridge indisponible" }) end
  end
end

--- Soigne un animal malade
function farming.treatAnimal(animalId, medicine, callback)
  local payload = {
    type = "farming:treat_animal",
    animalId = animalId,
    medicine = medicine or "medicaments",
    playerId = TroxtLua and TroxtLua.playerId or "Joueur1",
  }
  
  if LuaBridge and LuaBridge.rpc then
    LuaBridge.rpc("farming.treatAnimal", payload, callback)
  else
    if callback then callback({ ok = false, notice = "Bridge indisponible" }) end
  end
end

--- Insémine une femelle pour reproduction
function farming.inseminate(animalId, callback)
  local payload = {
    type = "farming:inseminate",
    animalId = animalId,
    playerId = TroxtLua and TroxtLua.playerId or "Joueur1",
  }
  
  if LuaBridge and LuaBridge.rpc then
    LuaBridge.rpc("farming.inseminateAnimal", payload, callback)
  else
    if callback then callback({ ok = false, notice = "Bridge indisponible" }) end
  end
end

--- Achète des semences ou du foin
function farming.buySupplies(shopId, itemType, qty, callback)
  local payload = {
    type = "farming:buy_supplies",
    shopId = shopId,
    itemType = itemType,  -- "graines_mais", "foin", "ble", "medicaments"
    qty = qty or 1,
    playerId = TroxtLua and TroxtLua.playerId or "Joueur1",
  }
  
  if LuaBridge and LuaBridge.rpc then
    LuaBridge.rpc("farming.buySupplies", payload, callback)
  else
    if callback then callback({ ok = false, notice = "Bridge indisponible" }) end
  end
end

-- ── API Publique : EVENTS & CALLBACKS ───────────────────────

--- Abonne un callback à un événement farming
-- Événements disponibles:
--   "plot_updated"  : { plotId, stage, crop, illegal }
--   "harvest"       : { plotId, loot: { id, n } }
--   "raid"          : { plotId, reason }
--   "animal_action" : { animalId, kind, action, loot? }
--   "animal_sick"   : { animalId, disease, healthPoints }
--   "animal_born"   : { animalId, kind, genetics }
--   "herd_stats"    : { totalAnimals, healthyCount, totalMilkProduction, ... }
function farming.on(event, callback)
  if not _callbacks[event] then _callbacks[event] = {} end
  table.insert(_callbacks[event], callback)
  _log("debug", "Subscribed to event: " .. event)
  return function()
    -- Unsubscribe: retire le callback
    for i, cb in ipairs(_callbacks[event]) do
      if cb == callback then table.remove(_callbacks[event], i); break end
    end
  end
end

--- Force une mise à jour des données depuis le serveur
function farming.refresh(callback)
  if LuaBridge and LuaBridge.rpc then
    LuaBridge.rpc("farming.refresh", {}, function(data)
      if data.plots then
        for _, p in ipairs(data.plots) do _plots[p.id] = p end
      end
      if data.herd then
        for _, a in ipairs(data.herd) do _herd[a.id] = a end
      end
      if data.herdStats then _herdStats = data.herdStats end
      _emit("refreshed", data)
      if callback then callback(data) end
    end)
  end
end

-- ── API Publique : UI HELPERS ───────────────────────────────

--- Génère un prompt contextuel pour une parcelle
function farming.getPlotPrompt(plot, tool)
  if not plot then return "Aucune parcelle à portée" end
  
  local stageLabels = {
    friche = "Terre en friche",
    laboure = "Terrain labouré ✓",
    seme = "Semis en cours 🌱",
    pousse = "Culture en croissance 🌿",
    mur = "PRÊT À RÉCOLTER ! 🌾",
  }
  
  local prompt = stageLabels[plot.stage] or plot.stage
  if plot.crop then
    prompt = prompt .. " · " .. (plot.crop:upper())
  end
  if plot.illegal then
    prompt = prompt .. " ⚠️ CLANDESTIN"
  end
  if plot.stage == "mur" then
    if tool == "faux" or tool == "tracteur" then
      prompt = prompt .. " → [E] Récolter"
    else
      prompt = prompt .. " (nécessite faux/tracteur)"
    end
  elseif plot.stage == "laboure" then
    prompt = prompt .. " → [E] Semer"
  elseif plot.stage == "friche" then
    prompt = prompt .. " → [E] Labourer"
  end
  return prompt
end

--- Génère un prompt contextuel pour un animal
function farming.getAnimalPrompt(animal, elapsed, hasFeed)
  if not animal then return "Aucun animal à portée" end
  
  local icon = farming.CONFIG.animalIcons[animal.kind] or "🐾"
  local status = ""
  
  if animal.health == "sick" then
    status = string.format("⚠️ %s est malade (%s)", animal.name, animal.disease or "?")
  elseif animal.health == "dead" then
    status = "💀 Décédé"
  else
    local ready = elapsed >= (animal.readyAt or 0)
    
    if animal.kind == "vache" then
      if ready then
        status = string.format("%s Traire · %.1fL/j", icon, animal.milkProduction or 0)
      elseif (animal.hunger or 1) < 0.4 then
        status = hasFeed and (icon .. " Nourrir · foin") or (icon .. " Affamée · besoin de foin")
      else
        status = string.format("%s Holstein · %ds", icon, math.max(1, math.ceil((animal.readyAt or 0) - elapsed)))
      end
      
    elseif animal.kind == "poulailler" then
      if ready then
        status = icon .. " Ramasser œufs"
      elseif (animal.hunger or 1) < 0.4 then
        status = hasFeed and (icon .. " Nourrir · grain") or (icon .. " Affamé")
      else
        status = string.format("%s Ponte · %ds", icon, math.max(1, math.ceil((animal.readyAt or 0) - elapsed)))
      end
      
    elseif animal.kind == "mouton" then
      if ready then
        status = icon .. " Tondre"
      elseif (animal.hunger or 1) < 0.4 then
        status = hasFeed and (icon .. " Nourrir · foin") or (icon .. " Affamé")
      else
        status = string.format("%s Laine · %ds", icon, math.max(1, math.ceil((animal.readyAt or 0) - elapsed)))
      end
      
    elseif animal.kind == "abeille" then
      if ready then
        status = icon .. " Récolter miel"
      else
        status = string.format("%s Miel · %ds", icon, math.max(1, math.ceil((animal.readyAt or 0) - elapsed)))
      end
    else
      status = icon .. " " .. (animal.name or animal.kind)
    end
  end
  
  return status
end

--- Retourne la couleur hex pour une culture (pour rendu 3D)
function farming.getCropColor(cropId, stage)
  if stage == "seme" then return 0x3a5a28 end
  if stage == "mur" and cropId == "ble" then return 0xe4d480 end
  if stage == "mur" and cropId == "mais" then return 0xd4b850 end
  return farming.CONFIG.cropColors[cropId] or 0xffffff
end

-- ── Tick système (appelé par la boucle principale) ──────────
function farming.tick(dt, elapsed, playerX, playerZ)
  _lastTick = _lastTick + dt
  
  -- Auto-refresh périodique des données (toutes les 30s)
  if _lastTick >= 30000 and LuaBridge and LuaBridge.rpc then
    farming.refresh()
    _lastTick = 0
  end
  
  -- Mise à jour locale des animaux (animations simples)
  for _, animal in pairs(_herd) do
    if animal.health == "healthy" and not animal.isPregnant then
      animal.hunger = math.max(0, (animal.hunger or 1) - dt * 0.0006)
      animal.thirst = math.max(0, (animal.thirst or 1) - dt * 0.0008)
    end
  end
  
  _emit("tick", { dt = dt, elapsed = elapsed, playerX = playerX, playerZ = playerZ })
end

-- ── Initialisation / Shutdown ───────────────────────────────

function farming.init(config)
  _log("info", "Initialisation du module farming...")
  if config then
    for k, v in pairs(config) do farming.CONFIG[k] = v end
  end
  farming.refresh()
  _log("info", "Farming prêt · " .. #_plots .. " parcelles, " .. #_herd .. " animaux")
end

function farming.shutdown()
  _log("info", "Shutdown farming...")
  _callbacks = {}
  _plots = {}
  _herd = {}
  _herdStats = {}
end

-- ── Exposition vers LuaBridge ───────────────────────────────
if LuaBridge and LuaBridge.expose then
  LuaBridge.expose("farming", {
    -- Getters
    getPlots = farming.getPlots,
    getPlot = farming.getPlot,
    getHerd = farming.getHerd,
    getAnimal = farming.getAnimal,
    getHerdStats = farming.getHerdStats,
    nearestPlot = farming.nearestPlot,
    nearestAnimal = farming.nearestAnimal,
    
    -- Actions
    workPlot = farming.workPlot,
    workAnimal = farming.workAnimal,
    treatAnimal = farming.treatAnimal,
    inseminate = farming.inseminate,
    buySupplies = farming.buySupplies,
    
    -- Events
    on = farming.on,
    refresh = farming.refresh,
    
    -- UI Helpers
    getPlotPrompt = farming.getPlotPrompt,
    getAnimalPrompt = farming.getAnimalPrompt,
    getCropColor = farming.getCropColor,
    
    -- System
    tick = farming.tick,
    init = farming.init,
    shutdown = farming.shutdown,
    
    -- Config
    CONFIG = farming.CONFIG,
  })
  _log("info", "API farming exposée à LuaBridge")
end

-- Auto-init si TroxtLua est disponible
if TroxtLua and TroxtLua.onReady then
  TroxtLua.onReady(function()
    farming.init()
  end)
end

return farming
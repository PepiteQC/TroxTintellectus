-- ═════════════════════════════════════════════════════════════
--  campfire.lua — Feux de camp (state machine + tick + économie)
-- ═════════════════════════════════════════════════════════════

Fires      = {}
NextFireId = 1

-- Config
local BRANCH_COST       = 5      -- $ par bûche (doit matcher Economy.Prices.branch)
local MAX_DISTANCE      = 4.0    -- distance max joueur <-> feu pour interagir
local EMBERS_LIFETIME   = 30     -- secondes avant suppression d'un feu en BRAISES

local STATE_ORDER = { PETIT = 1, MOYEN = 2, GRAND = 3, BRAISES = 4 }

-- Transitions : { depuis = { seuil_age, vers } }
local TRANSITIONS = {
  GRAND = { 60,  "MOYEN"   },
  MOYEN = { 90,  "PETIT"   },
  PETIT = { 120, "BRAISES" },
}

-- ═════════════════════════════════════════════════════════════
--  Helpers
-- ═════════════════════════════════════════════════════════════

local function dist2(ax, az, bx, bz)
  local dx, dz = ax - bx, az - bz
  return dx * dx + dz * dz
end

local function firePayload(f)
  return {
    type     = "fire-update",
    id       = f.id,
    x        = f.x,
    z        = f.z,
    state    = f.state,
    branches = f.branches,
  }
end

local function broadcastFire(f)
  Server.broadcast(firePayload(f))
end

local function removeFire(id)
  if not Fires[id] then return end
  Fires[id] = nil
  Server.broadcast({ type = "fire-remove", id = id })
end

local function newFire(x, z)
  local f = {
    id       = NextFireId,
    x        = x,
    z        = z,
    state    = "PETIT",
    branches = 0,
    age      = 0,
    embers   = 0,   -- temps passé en BRAISES
  }
  NextFireId = NextFireId + 1
  return f
end

-- Vérifie qu'un joueur est bien près du feu
local function playerNear(player, fire)
  if not player or not player.x or not player.z then return true end -- fallback si pas de position
  local d = dist2(player.x, player.z, fire.x, fire.z)
  return d <= MAX_DISTANCE * MAX_DISTANCE
end

-- ═════════════════════════════════════════════════════════════
--  Actions métier
-- ═════════════════════════════════════════════════════════════

local function placeFire(player, msg)
  -- Anti-spam : un joueur = un feu max (à adapter selon ton design)
  for _, f in pairs(Fires) do
    if f.owner == player.id then
      Server.sendTo(player.id, { type = "notify", text = "Tu as déjà un feu actif." })
      return
    end
  end

  local f = newFire(msg.x, msg.z)
  f.owner = player.id
  Fires[f.id] = f
  Server.log("Feu #" .. f.id .. " créé par " .. player.id:sub(1, 8)
             .. " à (" .. f.x .. ", " .. f.z .. ")")
  broadcastFire(f)
end

local function addBranch(player, msg)
  local f = Fires[msg.id]
  if not f then return end

  if f.state == "BRAISES" then
    Server.sendTo(player.id, { type = "notify", text = "Le feu est éteint." })
    return
  end

  if not playerNear(player, f) then
    Server.sendTo(player.id, { type = "notify", text = "Trop loin du feu." })
    return
  end

  -- 💰 Facturation via economy.lua (si disponible)
  if TrySpend and not TrySpend(player.id, BRANCH_COST, "branche") then
    return -- fonds insuffisants, TrySpend a déjà notifié
  end

  f.branches = f.branches + 1
  if     f.branches >= 6 then f.state = "GRAND"
  elseif f.branches >= 3 then f.state = "MOYEN" end

  broadcastFire(f)
end

local function extinguish(player, msg)
  local f = Fires[msg.id]
  if not f then return end
  if not playerNear(player, f) then return end
  f.state  = "BRAISES"
  f.embers = 0
  broadcastFire(f)
end

-- ═════════════════════════════════════════════════════════════
--  Réception des messages
-- ═════════════════════════════════════════════════════════════

on("clientMessage", function(msg, player)
  if not msg or not msg.type then return end

  -- Note : selon ton moteur, `player` peut être passé en 2e argument
  -- ou récupéré via Players[msg._clientId]. Adapte ici :
  player = player or (Players and Players[msg._clientId])
  if not player then return end

  if     msg.type == "place-fire" then placeFire(player, msg)
  elseif msg.type == "add-branch" then addBranch(player, msg)
  elseif msg.type == "extinguish" then extinguish(player, msg)
  elseif msg.type == "poke"       then
    Server.sendTo(player.id, { type = "pong", t = Server.now() })
  end
end)

-- ═════════════════════════════════════════════════════════════
--  Sync au join
-- ═════════════════════════════════════════════════════════════

on("clientJoined", function(player)
  for _, f in pairs(Fires) do
    Server.sendTo(player.id, firePayload(f))
  end
end)

on("clientLeft", function(player)
  -- Optionnel : éteindre les feux du joueur qui part
  for id, f in pairs(Fires) do
    if f.owner == player.id then
      f.state = "BRAISES"
      f.embers = 0
      broadcastFire(f)
    end
  end
end)

-- ═════════════════════════════════════════════════════════════
--  Tick : vieillissement + suppression des braises
-- ═════════════════════════════════════════════════════════════

onTick(function(dt)
  local toRemove = nil

  for id, f in pairs(Fires) do
    f.age = f.age + dt

    if f.state == "BRAISES" then
      f.embers = f.embers + dt
      if f.embers >= EMBERS_LIFETIME then
        toRemove = toRemove or {}
        toRemove[#toRemove + 1] = id
      end
    else
      local tr = TRANSITIONS[f.state]
      if tr and f.age > tr[1] then
        f.state = tr[2]
        f.age   = 0
        if f.state == "BRAISES" then f.embers = 0 end
        broadcastFire(f)
      end
    end
  end

  if toRemove then
    for _, id in ipairs(toRemove) do removeFire(id) end
  end
end)

Server.log("[Lua] campfire.lua chargé")
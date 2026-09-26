-- ═════════════════════════════════════════════════════════════
--  player.lua — Cycle de vie & données des joueurs (RP)
-- ═════════════════════════════════════════════════════════════

Players = {}

-- Configuration
local START_MONEY   = 250
local START_HUNGER  = 100
local START_THIRST  = 100
local HUNGER_TICK   = 5      -- secondes entre chaque tick
local HUNGER_RATE   = 1      -- points perdus par tick

-- ═════════════════════════════════════════════════════════════
--  Fonctions utilitaires
-- ═════════════════════════════════════════════════════════════

local function shortId(id)
  return id and id:sub(1, 8) or "????"
end

function GetPlayer(id)
  return Players[id]
end

function GiveMoney(id, amount)
  local ply = Players[id]
  if not ply then return false end
  ply.money = ply.money + amount
  if ply.money < 0 then ply.money = 0 end
  Server.log(shortId(id) .. " argent -> " .. ply.money .. " $")
  return true
end

function TakeMoney(id, amount)
  return GiveMoney(id, -amount)
end

function SetJob(id, job)
  local ply = Players[id]
  if not ply then return false end
  ply.job = job
  Server.log(shortId(id) .. " métier -> " .. tostring(job))
  return true
end

function FeedPlayer(id, food, water)
  local ply = Players[id]
  if not ply then return false end
  ply.hunger = math.min(100, ply.hunger + (food  or 0))
  ply.thirst = math.min(100, ply.thirst + (water or 0))
  return true
end

-- ═════════════════════════════════════════════════════════════
--  Cycle de vie
-- ═════════════════════════════════════════════════════════════

on("clientJoined", function(p)
  Players[p.id] = {
    id       = p.id,
    name     = p.name or ("Joueur_" .. shortId(p.id)),
    money    = START_MONEY,
    hunger   = START_HUNGER,
    thirst   = START_THIRST,
    job      = nil,
    joinedAt = os.time(),
  }
  Server.log("Joueur " .. shortId(p.id) .. " rejoint (" .. START_MONEY .. " $)")
end)

on("clientLeft", function(p)
  local ply = Players[p.id]
  if ply then
    Server.log("Joueur " .. shortId(p.id) .. " parti (solde : " .. ply.money .. " $)")
  end
  Players[p.id] = nil
end)

-- ═════════════════════════════════════════════════════════════
--  Boucle de faim / soif
-- ═════════════════════════════════════════════════════════════

if Timer then
  Timer.every(HUNGER_TICK, function()
    for id, ply in pairs(Players) do
      ply.hunger = math.max(0, ply.hunger - HUNGER_RATE)
      ply.thirst = math.max(0, ply.thirst - HUNGER_RATE)

      if ply.hunger == 0 or ply.thirst == 0 then
        -- Pénalité : perte d'argent quand affamé/déshydraté
        if ply.money > 0 then
          ply.money = ply.money - 1
        end
      end
    end
  end)
end

Server.log("[Lua] player.lua chargé")
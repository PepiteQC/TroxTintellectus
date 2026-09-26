-- ═════════════════════════════════════════════════════════════
--  init.lua — Point d'entrée du gameplay RP
-- ═════════════════════════════════════════════════════════════

-- Modules à charger (dans l'ordre d'importance)
local MODULES = {
  "player",   -- données joueurs (doit être chargé en premier)
  -- "jobs",   -- ajoute tes autres modules ici
  -- "economy",
  -- "commands",
}

local loaded = {}

local function loadModule(name)
  local path = name .. ".lua"
  local ok, err = pcall(require, name)
  if not ok then
    Server.log("[Lua] ERREUR chargement " .. path .. " : " .. tostring(err))
    return false
  end
  loaded[name] = true
  return true
end

-- ═════════════════════════════════════════════════════════════
--  Initialisation
-- ═════════════════════════════════════════════════════════════

function Init()
  Server.log("[Lua] === Démarrage du gameplay RP ===")

  local total, ok = 0, 0
  for _, name in ipairs(MODULES) do
    total = total + 1
    if loadModule(name) then
      ok = ok + 1
    end
  end

  Server.log(string.format("[Lua] %d/%d modules chargés", ok, total))
  Server.log("[Lua] Gameplay initialisé")
end

-- ═════════════════════════════════════════════════════════════
--  Hooks globaux (optionnels)
-- ═════════════════════════════════════════════════════════════

on("serverStarted", function()
  Init()
end)

on("serverStopped", function()
  Server.log("[Lua] Arrêt du serveur — sauvegarde des joueurs...")
  -- Ici tu pourras sauvegarder Players en DB/JSON
  if Players then
    for id, ply in pairs(Players) do
      Server.log("  → " .. id:sub(1, 8) .. " : " .. ply.money .. " $")
    end
  end
end)

Server.log("[Lua] init.lua chargé")
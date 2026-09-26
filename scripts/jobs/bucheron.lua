-- ═════════════════════════════════════════════════════════════
--  bucheron.lua — Job : couper du bois, vendre
-- ═════════════════════════════════════════════════════════════
local WOOD_PRICE = 15

local inventory = {}   -- clientId -> wood count

on("clientMessage", function(msg)
  if msg.type == "job:take" and msg.job == "bucheron" then
    if Players[msg._clientId] then
      Players[msg._clientId].job = "bucheron"
      inventory[msg._clientId] = inventory[msg._clientId] or 0
      Server.sendTo(msg._clientId, {
        type = "job:set", job = "bucheron",
        wood = inventory[msg._clientId],
      })
    end

  elseif msg.type == "job:chop" then
    local id = msg._clientId
    if Players[id] and Players[id].job == "bucheron" then
      inventory[id] = (inventory[id] or 0) + 1
      Server.sendTo(id, { type = "job:wood", wood = inventory[id] })
    end

  elseif msg.type == "job:sell" then
    local id = msg._clientId
    local wood = inventory[id] or 0
    if wood > 0 then
      inventory[id] = 0
      AddMoney(id, wood * WOOD_PRICE)
      Server.sendTo(id, { type = "job:wood", wood = 0, sold = wood })
    end
  end
end)

Server.log("[Lua] bucheron.lua chargé")
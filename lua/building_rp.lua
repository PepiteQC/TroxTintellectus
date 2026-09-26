--[[
  BUILDING_RP.LUA — Logique RP du bâtiment
  Chemin: lua/building_rp.lua

  Pont JS ↔ Lua :
    JS appelle  → lua_call("building_rp", "onPlayerEnterApt", {playerId, aptId, floor})
    Lua appelle → js.emit("apt:event", {type, data})
]]

local BuildingRP = {}

-- ─── CONSTANTES ──────────────────────────────────────────────────────────────
local FLOORS               = 6
local APTS_PER_FLOOR       = 4
local BASE_RENT            = 850
local RENT_PER_FLOOR       = 80
local RENT_PER_APT         = 25
local MAX_MISSED_PAYMENTS  = 3
local LOYER_DUE_DAY        = 1
local DOOR_KNOCK_COOLDOWN  = 30
local ELEVATOR_TIMEOUT_SEC = 30
local KNOCK_CLEANUP_SEC    = 300

-- ─── ÉTAT INTERNE ────────────────────────────────────────────────────────────
local state = {
  apts           = {},
  playersInApt   = {},
  knockCooldowns = {},
  elevatorFloor  = 0,
  elevatorMoving = false,
  elevatorSince  = nil,
}

-- ─── HELPERS ─────────────────────────────────────────────────────────────────
local function countKeys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

local function getApt(aptId)
  return state.apts[aptId]
end

local function canEnter(playerId, aptId)
  local apt = getApt(aptId)
  if not apt then return false, "Appartement introuvable" end
  if not apt.locked then return true, "ok" end
  if apt.owner  == playerId then return true, "ok" end
  if apt.tenant == playerId then return true, "ok" end
  return false, "Porte verrouillée"
end

local function emit(event, data)
  if js and js.emit then
    js.emit(event, data)
  else
    print("[LUA EMIT] " .. event .. " → " .. tostring(data and data.aptId or ""))
  end
end

-- ✅ Purge les cooldowns expirés (évite la fuite mémoire sur longues sessions)
local function purgeKnockCooldowns()
  local now = os.time()
  for pid, ts in pairs(state.knockCooldowns) do
    if now - ts > KNOCK_CLEANUP_SEC then
      state.knockCooldowns[pid] = nil
    end
  end
end

-- ✅ Débloque l'ascenseur s'il est coincé depuis trop longtemps
local function checkElevatorTimeout()
  if state.elevatorMoving and state.elevatorSince then
    if os.time() - state.elevatorSince > ELEVATOR_TIMEOUT_SEC then
      state.elevatorMoving = false
      state.elevatorSince  = nil
      emit("elevator:timeout", { lastFloor = state.elevatorFloor })
      print("[LUA] Ascenseur débloqué après timeout")
    end
  end
end

-- ─── INIT ─────────────────────────────────────────────────────────────────────
function BuildingRP.init()
  for f = 0, FLOORS - 1 do
    for a = 0, APTS_PER_FLOOR - 1 do
      local aptId = f .. "-" .. a
      local label = "Étage " .. f .. " — Apt " .. string.char(65 + a)
      state.apts[aptId] = {
        id        = aptId,
        label     = label,
        floor     = f,
        aptIndex  = a,
        owner     = nil,
        tenant    = nil,
        locked    = true,
        lightOn   = false,
        rent      = BASE_RENT + f * RENT_PER_FLOOR + a * RENT_PER_APT,
        occupied  = false,
        forRent   = true,
        forSale   = false,
        salePrice = nil,
        condition = "bon",
        furniture = {},
        createdAt = os.time(),
      }
    end
  end
  print("[LUA] BuildingRP initialisé — " .. (FLOORS * APTS_PER_FLOOR) .. " appartements")
end

-- ─── ENTRÉE DANS UN APPARTEMENT ──────────────────────────────────────────────
function BuildingRP.onPlayerEnterApt(playerId, aptId, floor)
  local ok, reason = canEnter(playerId, aptId)
  if not ok then
    emit("apt:access_denied", { playerId = playerId, aptId = aptId, reason = reason })
    print("[LUA] Accès refusé — " .. tostring(playerId) .. " → " .. tostring(aptId) .. " : " .. reason)
    return false
  end

  state.playersInApt[playerId] = aptId
  emit("apt:player_entered", { playerId = playerId, aptId = aptId, floor = floor })
  print("[LUA] " .. tostring(playerId) .. " entre dans " .. tostring(aptId))

  -- Lumière auto pour le locataire/propriétaire
  local apt = getApt(aptId)
  if apt and (apt.owner == playerId or apt.tenant == playerId) then
    if not apt.lightOn then
      BuildingRP.toggleLight(aptId, playerId)
    end
  end

  return true
end

-- ─── SORTIE D'UN APPARTEMENT ─────────────────────────────────────────────────
function BuildingRP.onPlayerLeaveApt(playerId)
  local aptId = state.playersInApt[playerId]
  if not aptId then return end

  state.playersInApt[playerId] = nil
  emit("apt:player_left", { playerId = playerId, aptId = aptId })
  print("[LUA] " .. tostring(playerId) .. " quitte " .. tostring(aptId))

  local apt = getApt(aptId)
  if not apt then return end

  local stillInside = false
  for _, aid in pairs(state.playersInApt) do
    if aid == aptId then stillInside = true break end
  end

  if not stillInside and apt.lightOn and apt.owner ~= playerId then
    BuildingRP.toggleLight(aptId, playerId)
  end
end

-- ─── TOGGLE LUMIÈRE ───────────────────────────────────────────────────────────
function BuildingRP.toggleLight(aptId, requesterId)
  local apt = getApt(aptId)
  if not apt then return false, "Appartement introuvable" end

  if requesterId and apt.owner ~= requesterId and apt.tenant ~= requesterId then
    return false, "Permission refusée"
  end

  apt.lightOn = not apt.lightOn
  emit("apt:light_toggled", { aptId = aptId, lightOn = apt.lightOn, byPlayer = requesterId })
  print("[LUA] Lumière " .. tostring(aptId) .. " → " .. (apt.lightOn and "ON" or "OFF"))
  return true, apt.lightOn
end

-- ─── LOUER UN APPARTEMENT ─────────────────────────────────────────────────────
function BuildingRP.rentApartment(aptId, tenantId, ownerId)
  local apt = getApt(aptId)
  if not apt then return false, "Appartement introuvable" end
  if apt.occupied then return false, "Appartement déjà occupé" end
  if not apt.forRent then return false, "Pas à louer" end

  apt.tenant   = tenantId
  apt.occupied = true
  apt.locked   = true
  apt.forRent  = false

  emit("apt:rented", {
    aptId    = aptId,
    tenantId = tenantId,
    ownerId  = ownerId,
    rent     = apt.rent,
    label    = apt.label,
  })
  print("[LUA] " .. apt.label .. " loué à " .. tostring(tenantId))
  return true, { aptId = aptId, rent = apt.rent }
end

-- ─── RÉSILIER UN BAIL ────────────────────────────────────────────────────────
function BuildingRP.terminateLease(aptId, requesterId)
  local apt = getApt(aptId)
  if not apt then return false, "Appartement introuvable" end
  if apt.owner ~= requesterId then return false, "Seul le propriétaire peut résilier" end

  local oldTenant = apt.tenant
  apt.tenant   = nil
  apt.occupied = false
  apt.forRent  = true

  emit("apt:lease_terminated", { aptId = aptId, oldTenant = oldTenant, ownerId = requesterId })
  print("[LUA] Bail résilié — " .. apt.label)
  return true
end

-- ─── FRAPPER À LA PORTE ──────────────────────────────────────────────────────
function BuildingRP.knockOnDoor(aptId, knockerId)
  local apt = getApt(aptId)
  if not apt then return false, "Appartement introuvable" end

  -- ✅ Purge opportuniste (les cooldowns d'il y a > 5min sont inutiles)
  purgeKnockCooldowns()

  local now       = os.time()
  local lastKnock = state.knockCooldowns[knockerId]
  if lastKnock and (now - lastKnock) < DOOR_KNOCK_COOLDOWN then
    local remaining = DOOR_KNOCK_COOLDOWN - (now - lastKnock)
    return false, "Attends " .. remaining .. "s avant de refrapper"
  end
  state.knockCooldowns[knockerId] = now

  for playerId, pid_apt in pairs(state.playersInApt) do
    if pid_apt == aptId then
      emit("apt:door_knock", { aptId = aptId, knockerId = knockerId, targetPlayerId = playerId })
    end
  end

  if apt.tenant then
    emit("apt:door_knock_notification", {
      aptId     = aptId,
      knockerId = knockerId,
      notifyId  = apt.tenant,
    })
  end

  print("[LUA] " .. tostring(knockerId) .. " frappe à la porte de " .. apt.label)
  return true
end

-- ─── DÉVERROUILLER ───────────────────────────────────────────────────────────
function BuildingRP.unlockDoor(aptId, playerId)
  local apt = getApt(aptId)
  if not apt then return false end
  if apt.owner ~= playerId and apt.tenant ~= playerId then
    return false, "Permission refusée"
  end
  apt.locked = not apt.locked
  emit("apt:door_locked", { aptId = aptId, locked = apt.locked, byPlayer = playerId })
  return true, apt.locked
end

-- ─── PAIEMENT LOYER ──────────────────────────────────────────────────────────
function BuildingRP.processRentPayment(aptId, tenantId, amount)
  local apt = getApt(aptId)
  if not apt then return false, "Appartement introuvable" end
  if apt.tenant ~= tenantId then return false, "Tu n'es pas locataire ici" end
  if amount < apt.rent then
    return false, "Montant insuffisant (" .. apt.rent .. "$ requis)"
  end

  emit("apt:rent_paid", {
    aptId    = aptId,
    tenantId = tenantId,
    ownerId  = apt.owner,
    amount   = amount,
    label    = apt.label,
  })
  print("[LUA] Loyer payé — " .. apt.label .. " — " .. amount .. "$")
  return true, { paid = amount, apt = aptId }
end

-- ─── ASCENSEUR ────────────────────────────────────────────────────────────────
function BuildingRP.callElevator(targetFloor, requesterId)
  if targetFloor < 0 or targetFloor >= FLOORS then
    return false, "Étage invalide"
  end

  -- ✅ Vérifie le timeout avant de refuser
  checkElevatorTimeout()

  if state.elevatorMoving then
    return false, "Ascenseur en mouvement"
  end

  state.elevatorMoving = true
  state.elevatorSince  = os.time()
  emit("elevator:called", { targetFloor = targetFloor, requesterId = requesterId })
  print("[LUA] Ascenseur appelé — Étage " .. targetFloor .. " par " .. tostring(requesterId))
  return true
end

function BuildingRP.onElevatorArrived(floor)
  state.elevatorFloor  = floor
  state.elevatorMoving = false
  state.elevatorSince  = nil
  emit("elevator:arrived", { floor = floor })
  print("[LUA] Ascenseur arrivé — Étage " .. floor)
end

-- ─── RAPPORT ÉTAT ─────────────────────────────────────────────────────────────
function BuildingRP.getReport()
  -- ✅ Purge aussi à chaque rapport (appelé périodiquement)
  checkElevatorTimeout()

  local totalApts    = 0
  local occupied     = 0
  local forRent      = 0
  local lightsOn     = 0
  local totalRevenue = 0

  for _, apt in pairs(state.apts) do
    totalApts = totalApts + 1
    if apt.occupied then
      occupied     = occupied + 1
      totalRevenue = totalRevenue + apt.rent
    end
    if apt.forRent and not apt.occupied then forRent = forRent + 1 end
    if apt.lightOn then lightsOn = lightsOn + 1 end
  end

  return {
    totalApts     = totalApts,
    occupied      = occupied,
    available     = forRent,
    lightsOn      = lightsOn,
    totalRevenue  = totalRevenue,
    elevator      = { floor = state.elevatorFloor, moving = state.elevatorMoving },
    -- ✅ FIX : `#` sur table associative retournait une valeur indéfinie
    playersInside = countKeys(state.playersInApt),
  }
end

-- ─── API PUBLIQUE SUPPLÉMENTAIRE ─────────────────────────────────────────────
function BuildingRP.getApt(aptId)               return state.apts[aptId] end
function BuildingRP.getPlayerApt(playerId)      return state.playersInApt[playerId] end
function BuildingRP.getElevatorFloor()          return state.elevatorFloor end
function BuildingRP.isElevatorMoving()          return state.elevatorMoving end

-- ─── INIT AUTO ────────────────────────────────────────────────────────────────
BuildingRP.init()

return BuildingRP
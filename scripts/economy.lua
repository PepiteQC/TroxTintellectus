-- ═════════════════════════════════════════════════════════════
--  economy.lua — Argent, prix, transactions
-- ═════════════════════════════════════════════════════════════

Economy = {}

-- ═════════════════════════════════════════════════════════════
--  Table des prix (modifiable facilement)
-- ═════════════════════════════════════════════════════════════

Economy.Prices = {
  ["branch"]      = 5,      -- bûche
  ["stone"]       = 3,
  ["bread"]       = 10,
  ["water"]       = 5,
  ["bandage"]     = 25,
  ["phone"]       = 200,
  ["car"]         = 5000,
}

-- ═════════════════════════════════════════════════════════════
--  Utilitaires
-- ═════════════════════════════════════════════════════════════

local function notify(clientId, money)
  if Server.sendTo then
    Server.sendTo(clientId, { type = "balance", money = money })
  end
end

local function log(from, to, amount, reason)
  Server.log(string.format(
    "[Economy] %s -> %s : %d $ (%s)",
    from and from:sub(1, 8) or "SYSTEM",
    to   and to:sub(1, 8)   or "?",
    amount,
    reason or "n/a"
  ))
end

-- ═════════════════════════════════════════════════════════════
--  API publique
-- ═════════════════════════════════════════════════════════════

function GetBalance(clientId)
  local p = Players[clientId]
  return p and p.money or 0
end

function AddMoney(clientId, amount, reason)
  local p = Players[clientId]
  if not p or amount <= 0 then return false end
  p.money = p.money + amount
  notify(clientId, p.money)
  log(nil, clientId, amount, reason or "gain")
  return true
end

function RemoveMoney(clientId, amount, reason)
  local p = Players[clientId]
  if not p or amount <= 0 then return false end
  p.money = math.max(0, p.money - amount)
  notify(clientId, p.money)
  log(clientId, nil, amount, reason or "perte")
  return true
end

-- Tente de retirer `amount`. Retourne false si fonds insuffisants.
function TrySpend(clientId, amount, reason)
  local p = Players[clientId]
  if not p then return false end
  if p.money < amount then
    if Server.sendTo then
      Server.sendTo(clientId, { type = "notify", text = "Fonds insuffisants." })
    end
    return false
  end
  p.money = p.money - amount
  notify(clientId, p.money)
  log(clientId, nil, amount, reason or "achat")
  return true
end

-- Virement entre deux joueurs
function Transfer(fromId, toId, amount)
  if amount <= 0 then return false end
  local from, to = Players[fromId], Players[toId]
  if not from or not to then return false end
  if from.money < amount then return false end

  from.money = from.money - amount
  to.money   = to.money   + amount

  notify(fromId, from.money)
  notify(toId,   to.money)
  log(fromId, toId, amount, "virement")
  return true
end

-- Achat générique basé sur la table des prix
function Buy(clientId, item)
  local price = Economy.Prices[item]
  if not price then
    Server.log("[Economy] Item inconnu : " .. tostring(item))
    return false
  end
  if not TrySpend(clientId, price, "achat " .. item) then
    return false
  end
  -- Notifie le client qu'il a reçu l'objet
  if Server.sendTo then
    Server.sendTo(clientId, { type = "item-acquired", item = item })
  end
  return true
end

-- ═════════════════════════════════════════════════════════════
--  Exemple : achat d'une bûche (via message client)
-- ═════════════════════════════════════════════════════════════

on("clientMessage", function(msg)
  if msg.type == "add-branch" then
    -- Gratuit pour l'instant → remplace par Buy(msg.id, "branch") quand tu veux facturer
    -- Buy(msg.id, "branch")
  elseif msg.type == "buy" and msg.item then
    Buy(msg.id, msg.item)
  end
end)

Server.log("[Lua] economy.lua chargé")
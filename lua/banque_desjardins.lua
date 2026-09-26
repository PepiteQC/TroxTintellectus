-- ═══════════════════════════════════════════════════════════════
--  CAISSE POPULAIRE DESJARDINS — ATM SÉCURISÉ
--  Bridge Lua ↔ BankingSystem.js — TroxT v4.1.0
-- ═══════════════════════════════════════════════════════════════
local ComptesMembres = {}
local Tentatives = {}
local MAX_TENTATIVES = 3
local BLOCAGE_MS = 5 * 60 * 1000

local function getPlayerKey(src)
    return GetPlayerIdentifier(src, 0) or ("src_" .. tostring(src))
end

local function estBloque(playerKey)
    local t = Tentatives[playerKey]
    if not t then return false, 0 end
    if t.blockedUntil and GetGameTimer() < t.blockedUntil then
        local restant = math.ceil((t.blockedUntil - GetGameTimer()) / 1000)
        return true, restant
    end
    return false, 0
end

-- ─── Ouverture de compte ──────────────────────────────────────
RegisterNetEvent("desjardins:ouvrirCompte")
AddEventHandler("desjardins:ouvrirCompte", function(typeCompte, nip)
    local src = source
    local key = getPlayerKey(src)

    if not typeCompte or not nip or #tostring(nip) < 4 then
        TriggerClientEvent("desjardins:notif", src, "❌ Paramètres invalides (NIP min 4 chiffres)")
        return
    end

    TriggerEvent("BANK_JS:OPEN_ACCOUNT", {
        playerId    = key,
        accountType = typeCompte,
        nip         = tostring(nip),
        timestamp   = os.time(),
    })

    TriggerClientEvent("desjardins:notif", src,
        "✅ Ouverture de compte " .. typeCompte .. " en cours...")
end)

-- ─── Dépôt ────────────────────────────────────────────────────
RegisterNetEvent("desjardins:depot")
AddEventHandler("desjardins:depot", function(montant, nip, typeCompte)
    local src = source
    local key = getPlayerKey(src)

    if not montant or montant <= 0 then
        TriggerClientEvent("desjardins:notif", src, "❌ Montant invalide")
        return
    end

    local bloque, restant = estBloque(key)
    if bloque then
        TriggerClientEvent("desjardins:notif", src,
            "🔒 Compte bloqué. Réessayez dans " .. restant .. "s")
        return
    end

    -- Vérifie le NIP via BankingSystem.js
    TriggerEvent("BANK_JS:VERIFY_NIP", {
        playerId    = key,
        accountType = typeCompte or "cheques",
        nip         = tostring(nip),
        callback    = "desjardins:depotResult",
        payload     = { src = src, montant = montant, typeCompte = typeCompte or "cheques" },
    })
end)

RegisterNetEvent("desjardins:depotResult")
AddEventHandler("desjardins:depotResult", function(payload, ok, error)
    local src = payload.src
    if not ok then
        TriggerClientEvent("desjardins:notif", src, "❌ " .. tostring(error or "NIP invalide"))
        return
    end

    TriggerEvent("BANK_JS:DEPOSIT", {
        playerId    = getPlayerKey(src),
        accountType = payload.typeCompte,
        amount      = payload.montant,
        source      = "atm",
    })

    TriggerClientEvent("desjardins:notif", src,
        "💰 Dépôt de " .. payload.montant .. "$ accepté.")
end)

-- ─── Retrait ──────────────────────────────────────────────────
RegisterNetEvent("desjardins:retrait")
AddEventHandler("desjardins:retrait", function(montant, nip, typeCompte)
    local src = source
    local key = getPlayerKey(src)

    if not montant or montant <= 0 then
        TriggerClientEvent("desjardins:notif", src, "❌ Montant invalide")
        return
    end
    if montant > 1000 then
        TriggerClientEvent("desjardins:notif", src, "❌ Maximum 1000$ par retrait")
        return
    end

    local bloque, restant = estBloque(key)
    if bloque then
        TriggerClientEvent("desjardins:notif", src,
            "🔒 Compte bloqué. Réessayez dans " .. restant .. "s")
        return
    end

    TriggerEvent("BANK_JS:VERIFY_NIP", {
        playerId    = key,
        accountType = typeCompte or "cheques",
        nip         = tostring(nip),
        callback    = "desjardins:retraitResult",
        payload     = { src = src, montant = montant, typeCompte = typeCompte or "cheques" },
    })
end)

RegisterNetEvent("desjardins:retraitResult")
AddEventHandler("desjardins:retraitResult", function(payload, ok, error)
    local src = payload.src
    if not ok then
        TriggerClientEvent("desjardins:notif", src, "❌ " .. tostring(error or "NIP invalide"))
        return
    end

    TriggerEvent("BANK_JS:WITHDRAW", {
        playerId    = getPlayerKey(src),
        accountType = payload.typeCompte,
        amount      = payload.montant,
        source      = "atm",
    })

    TriggerClientEvent("desjardins:notif", src,
        "💵 Retrait de " .. payload.montant .. "$ effectué.")
end)

-- ─── Virement Interac ─────────────────────────────────────────
RegisterNetEvent("desjardins:virement")
AddEventHandler("desjardins:virement", function(numeroDest, montant, description)
    local src = source
    local key = getPlayerKey(src)

    if not numeroDest or not montant or montant <= 0 then
        TriggerClientEvent("desjardins:notif", src, "❌ Paramètres invalides")
        return
    end
    if montant > 10000 then
        TriggerClientEvent("desjardins:notif", src, "❌ Maximum 10000$ par virement")
        return
    end

    TriggerEvent("BANK_JS:TRANSFER", {
        fromPlayerId    = key,
        toAccountNumber = numeroDest,
        amount          = montant,
        description     = description or "Virement Interac",
    })

    TriggerClientEvent("desjardins:notif", src,
        "📤 Virement de " .. montant .. "$ envoyé (frais 1.50$).")
end)

-- ─── Consultation solde ───────────────────────────────────────
RegisterNetEvent("desjardins:solde")
AddEventHandler("desjardins:solde", function(typeCompte)
    local src = source
    local key = getPlayerKey(src)

    TriggerEvent("BANK_JS:GET_BALANCE", {
        playerId    = key,
        accountType = typeCompte or "cheques",
        callback    = "desjardins:soldeResult",
        payload     = { src = src },
    })
end)

RegisterNetEvent("desjardins:soldeResult")
AddEventHandler("desjardins:soldeResult", function(payload, balance)
    TriggerClientEvent("desjardins:notif", payload.src,
        "💼 Solde : " .. string.format("%.2f", balance or 0) .. " CAD$")
end)

-- ─── Historique ───────────────────────────────────────────────
RegisterNetEvent("desjardins:historique")
AddEventHandler("desjardins:historique", function(typeCompte)
    local src = source
    local key = getPlayerKey(src)

    TriggerEvent("BANK_JS:GET_HISTORY", {
        playerId    = key,
        accountType = typeCompte or "cheques",
        callback    = "desjardins:historiqueResult",
        payload     = { src = src },
    })
end)

RegisterNetEvent("desjardins:historiqueResult")
AddEventHandler("desjardins:historiqueResult", function(payload, history)
    TriggerClientEvent("desjardins:historiqueData", payload.src, history or {})
end)

print("[DESJARDINS] ✅ Module chargé — TroxT v4.1")
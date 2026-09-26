-- ═══════════════════════════════════════════════════════════════
--  SYSTÈME MÉDICAL RP — Bridge Lua ↔ MedicalSystem.js
--  TroxT EtherWorld v4.1.0 — Canada East
-- ═══════════════════════════════════════════════════════════════
local Patients = {}
local MEDICAL_COOLDOWN = {}
local COOLDOWN_MS = 1500

local function isOnCooldown(playerId, action)
    local key = tostring(playerId) .. ":" .. action
    local now = GetGameTimer()
    if MEDICAL_COOLDOWN[key] and (now - MEDICAL_COOLDOWN[key]) < COOLDOWN_MS then
        return true
    end
    MEDICAL_COOLDOWN[key] = now
    return false
end

local function validateSoin(soin)
    local VALID = {
        bandage        = true,
        attelle        = true,
        rcr            = true,
        defibrillateur = true,
        chirurgie      = true,
        antidote       = true,
    }
    return VALID[soin] == true
end

-- ─── Application d'une blessure ────────────────────────────────
RegisterNetEvent("medical:blessure")
AddEventHandler("medical:blessure", function(patientId, partie, typeBlessure, cause)
    if not patientId or not partie or not typeBlessure then
        print("[MÉDICAL] Paramètres invalides pour medical:blessure")
        return
    end
    if isOnCooldown(patientId, "blessure") then
        return
    end

    -- Push vers MedicalSystem.js via EventBus
    TriggerEvent("MEDICAL_JS:INJURY", {
        playerId   = patientId,
        bodyPart   = partie,
        injuryId   = typeBlessure,
        cause      = cause or "inconnu",
        timestamp  = os.time(),
    })

    print(("[MÉDICAL] Blessure appliquée → %s / %s (%s)"):format(
        patientId, partie, typeBlessure))
end)

-- ─── Traitement d'un patient ───────────────────────────────────
RegisterNetEvent("medical:traiter")
AddEventHandler("medical:traiter", function(patientId, soin, soignantId)
    if not patientId or not soin then
        print("[MÉDICAL] Paramètres invalides pour medical:traiter")
        return
    end
    if not validateSoin(soin) then
        print("[MÉDICAL] Soin invalide : " .. tostring(soin))
        TriggerClientEvent("medical:erreur", patientId, "Soin invalide.")
        return
    end
    if isOnCooldown(patientId, "traiter") then
        return
    end

    -- Calcul HP local (fallback si JS indisponible)
    if not Patients[patientId] then
        Patients[patientId] = { hp = 50, blood = 100, pain = 0, injuries = {} }
    end

    local HEAL = {
        bandage        = { hp = 15, blood = 20, pain = -10 },
        attelle        = { hp = 10, blood = 0,  pain = -20 },
        rcr            = { hp = 25, blood = 0,  pain = -5  },
        defibrillateur = { hp = 50, blood = 0,  pain = -10 },
        chirurgie      = { hp = 80, blood = 60, pain = -40 },
        antidote       = { hp = 20, blood = 10, pain = -15 },
    }

    local effect = HEAL[soin] or { hp = 10, blood = 0, pain = 0 }
    local p = Patients[patientId]
    p.hp    = math.min(100, p.hp + effect.hp)
    p.blood = math.min(100, p.blood + effect.blood)
    p.pain  = math.max(0, p.pain + effect.pain)

    -- Push vers JS pour persistance DB + events
    TriggerEvent("MEDICAL_JS:TREATMENT", {
        patientId  = patientId,
        treatment  = soin,
        performedBy= soignantId or "inconnu",
        hp         = p.hp,
        blood      = p.blood,
        pain       = p.pain,
        timestamp  = os.time(),
    })

    TriggerClientEvent("medical:soinEffectue", patientId, soin, p.hp, p.blood, p.pain)
    print(("[MÉDICAL] %s soigné (%s) → HP: %d | Sang: %d | Douleur: %d"):format(
        patientId, soin, p.hp, p.blood, p.pain))
end)

-- ─── Admission à l'hôpital ─────────────────────────────────────
RegisterNetEvent("medical:hopital")
AddEventHandler("medical:hopital", function(patientId, hopitalId, parQui)
    if not patientId or not hopitalId then return end

    if Patients[patientId] then
        Patients[patientId].hp = 100
        Patients[patientId].blood = 100
        Patients[patientId].pain = 0
        Patients[patientId].injuries = {}
    end

    TriggerEvent("MEDICAL_JS:ADMIT", {
        patientId = patientId,
        hospitalId = hopitalId,
        performedBy = parQui,
        timestamp = os.time(),
    })

    TriggerClientEvent("medical:notif", patientId, "Vous êtes admis au " .. hopitalId)
    print(("[MÉDICAL] %s admis à %s par %s"):format(patientId, hopitalId, parQui or "?"))
end)

-- ─── Retour de l'état d'un patient ────────────────────────────
RegisterNetEvent("medical:getStatus")
AddEventHandler("medical:getStatus", function(patientId, requesterId)
    local p = Patients[patientId] or { hp = 100, blood = 100, pain = 0 }
    TriggerClientEvent("medical:statusRetour", requesterId, patientId, p.hp, p.blood, p.pain)
end)

-- ─── Dégâts périodiques (hémorragie, poison) ──────────────────
CreateThread(function()
    while true do
        Wait(5000)
        for id, p in pairs(Patients) do
            -- Saignement
            local bleedingTotal = 0
            for _, inj in ipairs(p.injuries or {}) do
                if inj.type == "laceration" or inj.type == "balle" then
                    bleedingTotal = bleedingTotal + 0.5
                end
            end
            if bleedingTotal > 0 then
                p.blood = math.max(0, p.blood - bleedingTotal)
                p.hp    = math.max(0, p.hp - bleedingTotal * 0.3)
            end

            -- Inconscience
            if p.hp <= 0 and not p.unconscious then
                p.unconscious = true
                TriggerClientEvent("medical:inconscient", id)
            end
        end
    end
end)

print("[MÉDICAL] ✅ Module chargé — TroxT v4.1")
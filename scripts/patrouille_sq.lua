-- ═══════════════════════════════════════════════════════════════
--  SÛRETÉ DU QUÉBEC — PATROUILLE ACTIVE
--  Bridge Lua ↔ PoliceSystem.js — TroxT v4.1.0
-- ═══════════════════════════════════════════════════════════════
local SQ_Agents = {}
local SQ_Appels = {}

local SECTEURS_VALIDES = {
    a20       = "Autoroute 20",
    a40       = "Autoroute 40",
    r138      = "Route 138 Portneuf",
    tr_centre = "Trois-Rivières Centre",
    st_ray    = "St-Raymond",
}

local CODES_INFRACTION = {
    vitesse        = { label = "Excès de vitesse",              fine = 250 },
    alcool         = { label = "Facultés affaiblies",          fine = 800 },
    vol            = { label = "Vol qualifié",                 fine = 500 },
    voie_de_fait   = { label = "Voie de fait",                 fine = 350 },
    reckless       = { label = "Conduite dangereuse",          fine = 600 },
    delit_fuite    = { label = "Délit de fuite",               fine = 900 },
    suspension     = { label = "Conduite suspendue",           fine = 400 },
}

-- ─── Début de service ─────────────────────────────────────────
RegisterNetEvent("sq:creerPatrouille")
AddEventHandler("sq:creerPatrouille", function(matricule, secteur)
    local src = source

    if not matricule or matricule == "" then
        TriggerClientEvent("sq:notif", src, "❌ Matricule requis")
        return
    end

    if SQ_Agents[matricule] then
        TriggerClientEvent("sq:notif", src, "❌ Matricule déjà en service")
        return
    end

    if secteur and not SECTEURS_VALIDES[secteur] then
        TriggerClientEvent("sq:notif", src, "❌ Secteur inconnu : " .. secteur)
        return
    end

    SQ_Agents[matricule] = {
        id         = src,
        statut     = "En patrouille active",
        secteur    = secteur or "a20",
        vehicule   = nil,
        debutService = os.time(),
    }

    TriggerEvent("POLICE_JS:ON_DUTY", {
        matricule = matricule,
        sector    = secteur or "a20",
        playerId  = GetPlayerIdentifier(src, 0),
    })

    TriggerClientEvent("sq:notif", src,
        "🚔 Service débuté — Matricule : " .. matricule ..
        " | Secteur : " .. (SECTEURS_VALIDES[secteur] or "A-20"))
    print(("[SQ] Service débuté : %s (secteur: %s)"):format(matricule, secteur or "a20"))
end)

-- ─── Fin de service ───────────────────────────────────────────
RegisterNetEvent("sq:finService")
AddEventHandler("sq:finService", function(matricule)
    local src = source
    if not SQ_Agents[matricule] then return end

    local duree = os.time() - SQ_Agents[matricule].debutService
    SQ_Agents[matricule] = nil

    TriggerEvent("POLICE_JS:OFF_DUTY", { matricule = matricule })
    TriggerClientEvent("sq:notif", src,
        "🚔 Service terminé — Durée : " .. math.floor(duree / 60) .. " min")
end)

-- ─── Assignation d'un véhicule ────────────────────────────────
RegisterNetEvent("sq:vehicule")
AddEventHandler("sq:vehicule", function(matricule, vehiculeId)
    local src = source
    local agent = SQ_Agents[matricule]
    if not agent then
        TriggerClientEvent("sq:notif", src, "❌ Hors service")
        return
    end

    local plaque = "SQ-" .. math.random(1000, 9999)
    agent.vehicule = { id = vehiculeId, plaque = plaque }

    TriggerEvent("POLICE_JS:ASSIGN_VEHICLE", {
        matricule = matricule,
        vehicleId = vehiculeId,
    })

    TriggerClientEvent("sq:notif", src,
        "🚓 Véhicule assigné : " .. vehiculeId .. " | Plaque : " .. plaque)
end)

-- ─── Émission d'un constat ────────────────────────────────────
RegisterNetEvent("sq:infraction")
AddEventHandler("sq:infraction", function(matricule, citoyenId, codeInfraction, description)
    local src = source
    local agent = SQ_Agents[matricule]
    if not agent then
        TriggerClientEvent("sq:notif", src, "❌ Hors service")
        return
    end

    local inf = CODES_INFRACTION[codeInfraction]
    if not inf then
        TriggerClientEvent("sq:notif", src, "❌ Code d'infraction inconnu : " .. tostring(codeInfraction))
        return
    end

    TriggerEvent("POLICE_JS:OFFENSE", {
        matricule   = matricule,
        citizenId   = citoyenId,
        offenseId   = codeInfraction,
        description = description,
    })

    TriggerClientEvent("sq:notif", src,
        "📝 Constat émis : " .. inf.label .. " | Amende : " .. inf.fine .. "$")
    print(("[SQ - CENTRALE] %s → %s : %s (%d$)"):format(
        matricule, citoyenId, inf.label, inf.fine))
end)

-- ─── Création d'un appel de service ───────────────────────────
RegisterNetEvent("sq:appel")
AddEventHandler("sq:appel", function(code, lieu, description)
    local src = source
    local appelId = math.random(10000, 99999)

    SQ_Appels[appelId] = {
        id          = appelId,
        code        = code,
        lieu        = lieu,
        description = description,
        statut      = "en_attente",
        emisPar     = src,
        timestamp   = os.time(),
    }

    TriggerEvent("POLICE_JS:DISPATCH_CALL", {
        code        = code,
        location    = lieu,
        description = description,
    })

    -- Broadcast à tous les agents
    for matricule, agent in pairs(SQ_Agents) do
        TriggerClientEvent("sq:nouvelAppel", agent.id, {
            id          = appelId,
            code        = code,
            lieu        = lieu,
            description = description,
        })
    end

    print(("[SQ - DISPATCH] Appel %d : %s @ %s"):format(appelId, code, lieu))
end)

-- ─── Assignation d'un appel ───────────────────────────────────
RegisterNetEvent("sq:prendreAppel")
AddEventHandler("sq:prendreAppel", function(matricule, appelId)
    local src = source
    local agent = SQ_Agents[matricule]
    local appel = SQ_Appels[appelId]

    if not agent or not appel then
        TriggerClientEvent("sq:notif", src, "❌ Appel ou matricule invalide")
        return
    end
    if appel.statut ~= "en_attente" then
        TriggerClientEvent("sq:notif", src, "❌ Appel déjà pris")
        return
    end

    appel.statut     = "assigne"
    appel.assigneA   = matricule

    TriggerEvent("POLICE_JS:ACCEPT_CALL", {
        matricule = matricule,
        callId    = appelId,
    })

    TriggerClientEvent("sq:notif", src, "🎯 Appel " .. appelId .. " assigné")
end)

-- ─── Résolution d'un appel ────────────────────────────────────
RegisterNetEvent("sq:resoudreAppel")
AddEventHandler("sq:resoudreAppel", function(appelId, resolution)
    if not SQ_Appels[appelId] then return end
    SQ_Appels[appelId].statut = "resolu"

    TriggerEvent("POLICE_JS:RESOLVE_CALL", {
        callId     = appelId,
        resolution = resolution,
    })

    SQ_Appels[appelId] = nil
end)

-- ─── Rapport d'incident ───────────────────────────────────────
RegisterNetEvent("sq:rapport")
AddEventHandler("sq:rapport", function(matricule, typeRapport, contenu)
    local src = source
    if not SQ_Agents[matricule] then
        TriggerClientEvent("sq:notif", src, "❌ Hors service")
        return
    end

    TriggerEvent("POLICE_JS:REPORT", {
        matricule = matricule,
        type      = typeRapport,
        content   = contenu,
    })

    TriggerClientEvent("sq:notif", src, "📄 Rapport soumis")
end)

-- ─── API publique ─────────────────────────────────────────────
function SignalerInfraction(matricule, description)
    if SQ_Agents[matricule] then
        print("[SQ - CENTRALE] " .. matricule .. " : " .. description)
        return true
    end
    return false
end

function CompterAgentsActifs()
    local count = 0
    for _ in pairs(SQ_Agents) do count = count + 1 end
    return count
end

print("[SQ] ✅ Module chargé — TroxT v4.1")
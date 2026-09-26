local PRIORITY_MAP = {
  pompiers_desincarceration = "code_3_critique",
  ambulance_paramedic       = "code_3_critique",
  pompiers_incendie         = "code_2_urgent",
  police_sq                 = "code_2_urgent",
  hydro_quebec_panne        = "code_1_normal",
}
local UNIT_MAP = {
  police_sq                 = { "Patrouille SQ #1", "Patrouille SQ #2" },
  pompiers_incendie         = { "Camion Pompe 101" },
  pompiers_desincarceration = { "Camion Pompe 101", "Unité Désincarcération 205" },
  ambulance_paramedic       = { "Ambulance 712", "Ambulance 714" },
  hydro_quebec_panne        = { "Équipe Réseau Hydro #12" },
}
function recommend_priority(call)
  local base = PRIORITY_MAP[call.type] or "code_1_normal"
  local d = string.lower(call.details or "")
  if string.find(d, "arme") or string.find(d, "coincé") or string.find(d, "hémorragie") then
    return "code_3_critique"
  end
  if string.find(d, "feu") or string.find(d, "incendie") then return "code_2_urgent" end
  return base
end
function recommend_units(type, priority)
  local units = UNIT_MAP[type] or {}
  if priority == "code_3_critique" then
    local copy = {}
    for _, u in ipairs(units) do table.insert(copy, u) end
    for _, u in ipairs(units) do table.insert(copy, u .. " (renfort)") end
    return copy
  end
  return units
end

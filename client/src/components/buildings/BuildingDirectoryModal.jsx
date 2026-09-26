// client/src/components/buildings/BuildingDirectoryModal.jsx
import React, { useState } from "react";
import {
  Building,
  Lock,
  Unlock,
  MapPin,
  Zap,
  Thermometer,
  X,
  Search,
} from "lucide-react";
import { BuildingRegistry } from "../../buildings/BuildingRegistry"; // Assure-toi que l'extension .js/.mjs est gérée par ton bundler (Vite/Webpack)

export const BuildingDirectoryModal = ({ onClose, onSelectBuilding }) => {
  const registry = BuildingRegistry.getInstance();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");

  const allBuildings = registry.getAll();

  const filtered = allBuildings.filter((b) => {
    const matchCategory = selectedCategory === "all" || b.category === selectedCategory;
    const matchSearch =
      search === "" ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.villageName.toLowerCase().includes(search.toLowerCase()) ||
      b.address.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const categoryLabels = {
    all: "Tous les bâtiments",
    hotel: "Hôtels & Auberges",
    depanneur: "Dépanneurs",
    residential: "Résidentiel",
    police_station: "Sûreté du Québec",
    church: "Patrimoine & Églises",
  };

  const categoriesList = ["all", "hotel", "depanneur", "residential", "police_station", "church"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[88vh] text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-300">Cadastre & Bâtiments de Portneuf</h3>
              <p className="text-xs text-slate-400">
                Répertoire des infrastructures municipales, commerces et résidences
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2.5 py-3 border-b border-slate-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, village ou adresse..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {categoriesList.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {categoryLabels[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Buildings Grid */}
        <div className="flex-1 overflow-y-auto py-3 grid grid-cols-1 md:grid-cols-2 gap-3 pr-1">
          {filtered.length > 0 ? (
            filtered.map((bld) => (
              <div
                key={bld.id}
                onClick={() => onSelectBuilding && onSelectBuilding(bld)}
                className={`p-4 rounded-xl border border-slate-800 bg-slate-950/50 flex flex-col justify-between gap-3 transition-all duration-200 ${
                  onSelectBuilding 
                    ? "cursor-pointer hover:border-amber-500/60 hover:bg-slate-900" 
                    : "hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-slate-100">{bld.name}</h4>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700 shrink-0">
                      {categoryLabels[bld.category] || bld.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">{bld.address}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                    {bld.description}
                  </p>
                </div>

                {/* Status footer */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Zap className="w-3 h-3" />
                      Hydro 120V
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Thermometer className="w-3 h-3" />
                      {bld.heatingThermostatC}°C
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {bld.doors?.some((d) => d.isLocked) ? (
                      <span className="flex items-center gap-1 text-rose-400 text-[11px]">
                        <Lock className="w-3 h-3" />
                        Verrouillé
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                        <Unlock className="w-3 h-3" />
                        Ouvert
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-12 text-slate-500">
              <Building className="w-12 h-12 mb-3 opacity-20" />
              <p>Aucun bâtiment trouvé pour cette recherche.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
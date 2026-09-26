/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/FARMS.JS  (v3.1 ultra-optimized)
 * Agriculture : parcelles, stades, récolte, grow-ops clandestines
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/src/world/Farms.js
 */

import * as THREE from 'three';
import { matLib, makeRng } from './quebec-compat.js';
import { getTerrainHeight } from './WorldData.js';
import { addWantedPoints } from './PoliceHelpers.js';

const SIG = 'TROXT⬡';

// ─── CONFIG CROPS (frozen) ───────────────────────────────────────────────────
export const CROPS = Object.freeze({
  mais: Object.freeze({
    id: 'mais', label: 'Maïs', seedId: 'graines_mais', yieldId: 'mais',
    yieldN: 4, growTimeMs: 44 * 3600 * 1000, illegal: false,
    color: 0xc8a840, height: 1.65, basePrice: 8,
    waterUsage: 0.80, fertilityCost: 0.15, perennial: false,
    seasons: ['spring', 'summer'], rotationSensitive: true, qualityBias: 1.0,
  }),
  ble: Object.freeze({
    id: 'ble', label: 'Blé', seedId: 'graines_ble', yieldId: 'ble',
    yieldN: 3, growTimeMs: 36 * 3600 * 1000, illegal: false,
    color: 0xd4b850, height: 0.82, basePrice: 11,
    waterUsage: 0.60, fertilityCost: 0.12, perennial: false,
    seasons: ['spring', 'summer', 'fall'], rotationSensitive: true, qualityBias: 1.0,
  }),
  foin: Object.freeze({
    id: 'foin', label: 'Foin', seedId: 'graines_foin', yieldId: 'foin',
    yieldN: 4, growTimeMs: 28 * 3600 * 1000, illegal: false,
    color: 0x5a8a40, height: 0.4, basePrice: 6,
    waterUsage: 0.40, fertilityCost: 0.08, perennial: true,
    seasons: ['spring', 'summer', 'fall'], rotationSensitive: false, qualityBias: 0.9,
  }),
  patate: Object.freeze({
    id: 'patate', label: 'Patates', seedId: 'graines_patate', yieldId: 'patate',
    yieldN: 5, growTimeMs: 40 * 3600 * 1000, illegal: false,
    color: 0x6a8a48, height: 0.46, basePrice: 5,
    waterUsage: 0.70, fertilityCost: 0.18, perennial: false,
    seasons: ['spring', 'summer', 'fall'], rotationSensitive: true, qualityBias: 1.0,
  }),
  cannabis: Object.freeze({
    id: 'cannabis', label: 'Cannabis', seedId: 'graines_cannabis', yieldId: 'weed',
    yieldN: 5, growTimeMs: 42 * 3600 * 1000, illegal: true,
    color: 0x2a6a32, height: 1.2, basePrice: 32,
    waterUsage: 0.90, fertilityCost: 0.20, perennial: true,
    seasons: ['spring', 'summer', 'fall'], rotationSensitive: false, qualityBias: 1.4,
  }),
});

const CROP_BY_SEED = Object.freeze(
  Object.values(CROPS).reduce((acc, c) => {
    acc[c.seedId] = c;
    return acc;
  }, {})
);

export const STAGES = Object.freeze({
  FRICHE:  'friche',
  LABOURE: 'laboure',
  SEME:    'seme',
  POUSSE:  'pousse',
  MUR:     'mur',
  MORT:    'mort',
});

export const QUALITY = Object.freeze({
  BRONZE: 'bronze', SILVER: 'silver', GOLD: 'gold',
});

const QUALITY_MULT = Object.freeze({ bronze: 0.8, silver: 1.0, gold: 1.4 });

// ─── CONSTANTES DE SIMULATION ────────────────────────────────────────────────
const GROW_PROGRESS_THRESHOLD      = 0.3;
const HEAT_RAID_THRESHOLD          = 1.0;
const HEAT_RESET_AFTER_RAID        = 0.5;
const NEARBY_WITNESS_RADIUS        = 35;
const ILLEGAL_HARVEST_POINTS       = 20;
const FERTILITY_DECAY_ON_HARVEST   = 0.20;
const FERTILITY_REGEN_PER_SEC      = 1 / (30 * 60);
const WATER_REGEN_PER_SEC_CLEAR    = 1 / (10 * 60);
const WATER_REGEN_PER_SEC_RAIN     = 1 / 60;
const WATER_DRAIN_MUL              = 0.00002;
const QUALITY_GOLD_THRESHOLD       = 0.85;
const QUALITY_SILVER_THRESHOLD     = 0.55;
const HISTORY_MAX                  = 10;
const GRID_CELL_SIZE               = 32;

// ─── HELPERS INTERNES ET NETTOYAGE VRAM ──────────────────────────────────────
function hasOwn(obj, k) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, k);
}

function safeCrop(id) {
  if (typeof id !== 'string' || !id) return null;
  return hasOwn(CROPS, id) ? CROPS[id] : null;
}

function safeCropFromSeed(seedId) {
  if (typeof seedId !== 'string' || !seedId) return null;
  return hasOwn(CROP_BY_SEED, seedId) ? CROP_BY_SEED[seedId] : null;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function _witnessCount(plot, playerX, playerZ, radius = NEARBY_WITNESS_RADIUS) {
  if (!Number.isFinite(playerX) || !Number.isFinite(playerZ)) return 0;
  const d = Math.hypot(playerX - plot.x, playerZ - plot.z);
  return d <= radius ? 1 : 0;
}

function classifyQuality(score) {
  if (score >= QUALITY_GOLD_THRESHOLD)   return QUALITY.GOLD;
  if (score >= QUALITY_SILVER_THRESHOLD) return QUALITY.SILVER;
  return QUALITY.BRONZE;
}

/**
 * Nettoie récursivement un groupe Three.js et libère les géométries associées du GPU
 */
function clearGroupAndDispose(group) {
  const geometriesToDispose = new Set();
  
  group.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) {
        geometriesToDispose.add(child.geometry);
      }
    }
  });

  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
  }

  geometriesToDispose.forEach((geom) => {
    try { geom.dispose(); } catch (e) { /* ignore */ }
  });
}

// ─── EMITTER CLASSE ──────────────────────────────────────────────────────────
class TinyEmitter {
  constructor() {
    this._map = new Map();
  }
  
  on(event, fn) {
    if (typeof fn !== 'function') return () => {};
    let set = this._map.get(event);
    if (!set) {
      set = new Set();
      this._map.set(event, set);
    }
    set.add(fn);
    return () => this.off(event, fn);
  }
  
  once(event, fn) {
    const off = this.on(event, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }
  
  off(event, fn) {
    const set = this._map.get(event);
    if (set) set.delete(fn);
  }
  
  emit(event, payload) {
    const set = this._map.get(event);
    if (!set || set.size === 0) return 0;
    let n = 0;
    for (const fn of set) {
      try {
        fn(payload);
        n++;
      } catch (e) {
        if (typeof console !== 'undefined') {
          console.warn(`[${SIG}·Farms] Erreur d'écouteur sur ${event}:`, e?.message);
        }
      }
    }
    return n;
  }
  
  clear() {
    this._map.clear();
  }
}

// ─── FARM MANAGER ────────────────────────────────────────────────────────────
export class FarmManager {
  constructor() {
    this.plots = new Map();
    this._lastRenderStage = new WeakMap();
    this._events = new TinyEmitter();
    this._lastTickAt = Date.now();

    this._season      = 'summer';
    this._weather     = 'sunny';
    this._globalSpeed = 1.0;

    // Index spatial par grille
    this._grid = new Map();

    // Cache local des géométries de plantes pour éviter de réallouer à chaque tick
    this._coneGeometryCache = new Map();

    // Métriques & statistiques
    this._stats = {
      created: 0, plowed: 0, sown: 0, tended: 0, harvested: 0,
      raidTriggered: 0, seasonKills: 0, seized: 0,
      watered: 0, fertilized: 0, ticks: 0, secondsTotal: 0,
      renderComputes: 0, renderSkips: 0,
    };

    this._init();
  }

  on(event, fn)   { return this._events.on(event, fn); }
  once(event, fn) { return this._events.once(event, fn); }
  off(event, fn)  { this._events.off(event, fn); return this; }
  _emit(event, p) { return this._events.emit(event, p); }

  // ─── ÉTAT GLOBAL ───────────────────────────────────────────────────────────
  setSeason(season) {
    if (this._season === season) return this;
    this._season = season;
    for (const plot of this.plots.values()) {
      this._checkSeasonKill(plot);
    }
    this._emit('farms:season', { season });
    return this;
  }

  setWeather(weather) {
    if (this._weather === weather) return this;
    this._weather = weather;
    this._emit('farms:weather', { weather });
    return this;
  }

  setGlobalSpeed(mul) {
    const n = Number(mul);
    if (!Number.isFinite(n) || n <= 0) return this;
    this._globalSpeed = clamp(n, 0.1, 20);
    return this;
  }

  getSeason()  { return this._season; }
  getWeather() { return this._weather; }

  // ─── INITIALISATION ────────────────────────────────────────────────────────
  _init() {
    const layout = countyFarmLayout();
    for (const farm of layout) {
      for (const p of farm.plots) {
        this.createPlot(
          `${farm.id}_${p.ox}_${p.oz}`,
          farm.x + p.ox, farm.z + p.oz, farm.yaw, p.w, p.d,
          farm.hidden === true
        );
      }
    }
  }

  createPlot(id, x, z, yaw, w, d, concealed = false) {
    const plot = {
      id,
      name:            concealed ? 'Parcelle Clandestine' : `Champ ${id}`,
      x, z, yaw, w, d,
      stage:           STAGES.FRICHE,
      crop:            null,
      plantedAt:       0,
      growth:          0,
      heat:            0,
      concealed:       !!concealed,
      illegal:         false,
      greenhouse:      false,
      fertility:       1.0,
      water:           1.0,
      quality:         0,
      speedMul:        1.0,
      harvestCount:    0,
      rotationHistory: [],
      history:         [],
      group:           new THREE.Group(),
      _rngSeed:        id,
    };
    
    plot.group.position.set(x, getTerrainHeight(x, z), z);
    plot.group.rotation.y = yaw;
    this.plots.set(id, plot);
    
    this._gridInsert(plot);
    this.renderPlot(plot);
    this._stats.created++;
    this._emit('farms:plot_created', { plotId: id });
    return plot;
  }

  // ─── INDEX SPATIAL GRILLE ──────────────────────────────────────────────────
  _cellKey(x, z) {
    return `${Math.floor(x / GRID_CELL_SIZE)},${Math.floor(z / GRID_CELL_SIZE)}`;
  }
  
  _gridInsert(plot) {
    const k = this._cellKey(plot.x, plot.z);
    let set = this._grid.get(k);
    if (!set) {
      set = new Set();
      this._grid.set(k, set);
    }
    set.add(plot.id);
  }
  
  _gridRemove(plot) {
    const k = this._cellKey(plot.x, plot.z);
    const set = this._grid.get(k);
    if (set) {
      set.delete(plot.id);
      if (set.size === 0) this._grid.delete(k);
    }
  }

  getPlot(id)    { return this.plots.get(id); }
  getAllPlots()  { return [...this.plots.values()]; }
  getPlotCount() { return this.plots.size; }

  // ─── INTERACTIONS CHANTIER / OUTILS ────────────────────────────────────────
  workPlot(plotId, tool, seed, playerId, ctx = {}) {
    const plot = this.getPlot(plotId);
    if (!plot) return { ok: false, notice: 'Parcelle introuvable.' };

    switch (plot.stage) {
      case STAGES.FRICHE:  return this._plow(plot, tool);
      case STAGES.LABOURE: return this._sow(plot, tool, seed);
      case STAGES.SEME:
      case STAGES.POUSSE:  return this._tend(plot, tool);
      case STAGES.MUR:     return this._harvest(plot, tool, playerId, ctx);
      case STAGES.MORT:    return this._clearDead(plot, tool);
      default:             return { ok: false, notice: 'Stade inconnu.' };
    }
  }

  workPlotBatch(actions = [], playerId = null, ctx = {}) {
    if (!Array.isArray(actions)) return [];
    const results = [];
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      if (!a || typeof a !== 'object') continue;
      results.push({
        plotId: a.plotId,
        result: this.workPlot(a.plotId, a.tool, a.seed, playerId, ctx),
      });
    }
    return results;
  }

  // ─── ÉTAPES DE CULTURE ─────────────────────────────────────────────────────
  _plow(plot, tool) {
    if (tool !== 'pelle' && tool !== 'tracteur') {
      return { ok: false, notice: 'Il faut une pelle ou un tracteur.' };
    }
    plot.stage = STAGES.LABOURE;
    this._historyPush(plot, 'plow', { tool });
    this.renderPlot(plot);
    this._stats.plowed++;
    this._emit('farms:plowed', { plotId: plot.id, tool });
    return { ok: true, notice: 'Terrain labouré.' };
  }

  _sow(plot, tool, seed) {
    if (!seed) return { ok: false, notice: 'Pas de semences.' };
    if (tool !== 'pelle' && tool !== 'tracteur') {
      return { ok: false, notice: 'Outil inadéquat.' };
    }

    const crop = safeCrop(seed);
    if (!crop) return { ok: false, notice: 'Semence inconnue.' };

    if (!plot.greenhouse && Array.isArray(crop.seasons) && !crop.seasons.includes(this._season)) {
      return { ok: false, notice: `Hors saison pour ${crop.label} (besoin d'une serre).` };
    }

    const rot = plot.rotationHistory;
    const lastCrop = rot[0];
    const rotationPenalty = (crop.rotationSensitive && lastCrop === seed) ? 0.25 : 0;

    plot.crop         = seed;
    plot.stage        = STAGES.SEME;
    plot.plantedAt    = Date.now();
    plot.growth       = 0;
    plot.illegal      = !!crop.illegal;
    plot.heat         = crop.illegal ? 0.1 : 0;
    plot.harvestCount = 0;
    plot.quality      = 0;
    
    plot.rotationHistory.unshift(seed);
    if (plot.rotationHistory.length > 5) plot.rotationHistory.pop();

    this._historyPush(plot, 'sow', { seed, rotationPenalty });
    this.renderPlot(plot);
    this._stats.sown++;

    this._emit('farms:sown', {
      plotId: plot.id, seed, illegal: crop.illegal, rotationPenalty,
    });

    return {
      ok: true,
      notice:          crop.illegal ? 'Semis clandestin.' : `Semis de ${crop.label}.`,
      consumeSeed:     crop.seedId,
      illegalSow:      crop.illegal,
      rotationPenalty,
    };
  }

  _tend(plot, tool) {
    if (tool !== 'rateau' && tool !== 'herser') {
      return { ok: false, notice: 'La culture est en cours de croissance.' };
    }
    const cropSpec = safeCrop(plot.crop);
    const growSec = cropSpec ? cropSpec.growTimeMs : 1;
    plot.growth = Math.min(0.999, plot.growth + (2 * 3600 * 1000) / growSec);
    plot.fertility = clamp(plot.fertility + 0.05, 0, 1);
    
    this._historyPush(plot, 'tend', { tool });
    this._stats.tended++;
    this._emit('farms:tended', { plotId: plot.id, tool });
    return { ok: true, notice: 'Binage effectué.' };
  }

  _clearDead(plot, tool) {
    if (tool !== 'pelle' && tool !== 'tracteur') {
      return { ok: false, notice: 'Il faut une pelle pour nettoyer.' };
    }
    plot.stage        = STAGES.FRICHE;
    plot.crop         = null;
    plot.growth       = 0;
    plot.illegal      = false;
    plot.heat         = 0;
    plot.harvestCount = 0;
    
    this._historyPush(plot, 'clear_dead', { tool });
    this.renderPlot(plot);
    return { ok: true, notice: 'Parcelle nettoyée.' };
  }

  _harvest(plot, tool, playerId, ctx) {
    if (tool !== 'faux' && tool !== 'tracteur') {
      return { ok: false, notice: 'Il faut une faux ou un tracteur.' };
    }
    if (!plot.crop) return { ok: false, notice: 'Rien à récolter.' };

    const c = safeCrop(plot.crop);
    if (!c) return { ok: false, notice: 'Culture corrompue.' };

    if (plot.growth < 1) {
      const elapsed = Date.now() - plot.plantedAt;
      if (elapsed < c.growTimeMs) {
        return { ok: false, notice: "La culture n'est pas encore mûre." };
      }
    }

    const careScore = clamp((plot.fertility + plot.water) / 2, 0, 1);
    const quality   = classifyQuality(careScore * c.qualityBias);
    const qMul      = QUALITY_MULT[quality];
    const toolBonus = tool === 'tracteur' ? 2 : 0;
    const rawYield  = c.yieldN + toolBonus;
    const lootN     = Math.max(1, Math.round(rawYield * qMul));

    plot.fertility = clamp(plot.fertility - c.fertilityCost * FERTILITY_DECAY_ON_HARVEST, 0, 1);
    plot.water     = clamp(plot.water - 0.05, 0, 1);
    plot.harvestCount++;

    const regrow = c.perennial && !ctx.destroyRoots;

    if (regrow) {
      plot.growth    = 0;
      plot.plantedAt = Date.now();
      plot.stage     = STAGES.POUSSE;
      this.renderPlot(plot, true);
    } else {
      plot.stage        = STAGES.FRICHE;
      plot.crop         = null;
      plot.growth       = 0;
      plot.illegal      = false;
      plot.heat         = 0;
      plot.harvestCount = 0;
      this.renderPlot(plot, true);
    }

    this._stats.harvested++;
    this._historyPush(plot, 'harvest', { tool, quality, lootN, regrow });

    let wantedPoints = 0;
    let silent = false;

    if (c.illegal && playerId) {
      const witnesses = _witnessCount(plot, ctx.playerX, ctx.playerZ);
      const forced    = ctx.forceWanted === true;
      if (witnesses > 0 || forced) {
        addWantedPoints(playerId, ILLEGAL_HARVEST_POINTS, 'Récolte illégale', {
          source: 'farms', silent: false,
        });
        wantedPoints = ILLEGAL_HARVEST_POINTS;
      } else {
        silent = true;
      }
    }

    this._emit('farms:harvested', {
      plotId: plot.id, crop: c.id, tool, quality, lootN,
      wantedPoints, silent, regrow,
    });

    return {
      ok:     true,
      notice: (c.illegal && wantedPoints > 0
                ? `Récolte saisie ! (+${wantedPoints} points)`
                : `Récolte ${lootN}x ${c.label}${quality !== 'silver' ? ` [${quality}]` : ''}`),
      loot:   { id: c.yieldId, n: lootN, quality },
      quality,
      wantedPoints,
      silent,
      regrow,
    };
  }

  // ─── AMÉLIORATIONS & ENTRETIEN (FUMURE/EAU) ───────────────────────────────
  waterPlot(plotId, amount = 0.4) {
    const plot = this.getPlot(plotId);
    if (!plot) return { ok: false, notice: 'Parcelle introuvable.' };
    plot.water = clamp(plot.water + amount, 0, 1);
    this._historyPush(plot, 'water', { amount });
    this._stats.watered++;
    this._emit('farms:watered', { plotId, water: plot.water });
    return { ok: true, water: plot.water };
  }

  fertilizePlot(plotId, amount = 0.3) {
    const plot = this.getPlot(plotId);
    if (!plot) return { ok: false, notice: 'Parcelle introuvable.' };
    plot.fertility = clamp(plot.fertility + amount, 0, 1);
    this._historyPush(plot, 'fertilize', { amount });
    this._stats.fertilized++;
    this._emit('farms:fertilized', { plotId, fertility: plot.fertility });
    return { ok: true, fertility: plot.fertility };
  }

  toggleGreenhouse(plotId) {
    const plot = this.getPlot(plotId);
    if (!plot) return { ok: false };
    plot.greenhouse = !plot.greenhouse;
    this._emit('farms:greenhouse', { plotId, greenhouse: plot.greenhouse });
    return { ok: true, greenhouse: plot.greenhouse };
  }

  // ─── POLICE / SAISIES SQ ───────────────────────────────────────────────────
  seizePlot(plotId, officerId) {
    const plot = this.getPlot(plotId);
    if (!plot) return { ok: false, notice: 'Parcelle introuvable.' };
    const wasIllegal = plot.illegal;
    
    plot.stage        = STAGES.FRICHE;
    plot.crop         = null;
    plot.growth       = 0;
    plot.illegal      = false;
    plot.heat         = 0;
    plot.harvestCount = 0;
    
    this._historyPush(plot, 'seize', { officerId });
    this.renderPlot(plot, true);
    this._stats.seized++;
    this._emit('farms:seized', { plotId, officerId, wasIllegal });
    return { ok: true, notice: 'Champ saisi.', wasIllegal, officer: officerId || null };
  }

  // ─── SIMULATION TICK DE CROISSANCE ─────────────────────────────────────────
  tick(dt, playerX, playerZ) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    this._stats.ticks++;
    this._stats.secondsTotal += dt;

    const rainy = this._weather === 'rainy' || this._weather === 'stormy' || this._weather === 'snowy';

    for (const plot of this.plots.values()) {
      // Croissance active
      if (plot.crop && (plot.stage === STAGES.SEME || plot.stage === STAGES.POUSSE)) {
        const crop = safeCrop(plot.crop);
        if (crop) {
          const waterFactor     = 0.4 + plot.water * 0.6;
          const fertilityFactor = 0.5 + plot.fertility * 0.5;
          const rate            = this._globalSpeed * plot.speedMul * waterFactor * fertilityFactor;

          const growSec = crop.growTimeMs / 1000;
          plot.growth = Math.min(1, plot.growth + (dt * rate) / growSec);

          plot.water = clamp(plot.water - dt * WATER_DRAIN_MUL * crop.waterUsage, 0, 1);

          if (plot.growth >= 1) {
            plot.stage = STAGES.MUR;
            this.renderPlot(plot);
          } else if (plot.growth > GROW_PROGRESS_THRESHOLD && plot.stage === STAGES.SEME) {
            plot.stage = STAGES.POUSSE;
            this.renderPlot(plot);
          }
        }
      }

      // Régénération en jachère / repos
      if (plot.stage === STAGES.FRICHE || plot.stage === STAGES.MORT) {
        plot.fertility = clamp(plot.fertility + dt * FERTILITY_REGEN_PER_SEC, 0, 1);
        const rate = rainy ? WATER_REGEN_PER_SEC_RAIN : WATER_REGEN_PER_SEC_CLEAR;
        plot.water     = clamp(plot.water + dt * rate, 0, 1);
      } else if (rainy) {
        plot.water = clamp(plot.water + dt * WATER_REGEN_PER_SEC_RAIN * 0.5, 0, 1);
      }

      // Détection Grow-Ops et raids de police
      if (plot.illegal && plot.crop === 'cannabis' && plot.stage !== STAGES.FRICHE) {
        const dist = Math.hypot(playerX - plot.x, playerZ - plot.z);
        const rate = plot.concealed ? 0.005 : 0.02;
        if (dist < 60) plot.heat += dt * rate;

        if (plot.heat > HEAT_RAID_THRESHOLD) {
          plot.heat = HEAT_RESET_AFTER_RAID;
          this._stats.raidTriggered++;
          this._emit('farms:raid', { plotId: plot.id, heat: plot.heat });
        }
      }
    }
  }

  // ─── FLÉTRISSEMENT SAISONNIER ──────────────────────────────────────────────
  _checkSeasonKill(plot) {
    if (!plot.crop || plot.greenhouse) return;
    const crop = safeCrop(plot.crop);
    if (!crop || !Array.isArray(crop.seasons)) return;
    if (crop.seasons.includes(this._season)) return;
    
    plot.stage  = STAGES.MORT;
    plot.growth = 0;
    this._stats.seasonKills++;
    this.renderPlot(plot, true);
    this._historyPush(plot, 'season_kill', { season: this._season });
    this._emit('farms:season_kill', { plotId: plot.id, season: this._season });
  }

  _historyPush(plot, action, data) {
    plot.history.unshift({ action, at: Date.now(), ...data });
    if (plot.history.length > HISTORY_MAX) plot.history.pop();
  }

  // ─── RENDU TROIS DIMENSIONS ET RECYCLAGE DES GÉOMÉTRIES ─────────────────────
  _getOrCreateConeGeometry(height) {
    let geo = this._coneGeometryCache.get(height);
    if (!geo) {
      geo = new THREE.ConeGeometry(0.15, height, 5);
      this._coneGeometryCache.set(height, geo);
    }
    return geo;
  }

  renderPlot(plot, force = false) {
    if (!force && this._lastRenderStage.get(plot) === plot.stage) {
      this._stats.renderSkips++;
      return;
    }
    this._lastRenderStage.set(plot, plot.stage);
    this._stats.renderComputes++;

    // Nettoyage de la mémoire GPU avant reconstruction du visuel
    clearGroupAndDispose(plot.group);

    const soilColor = this.getSoilColor(plot.stage, plot.illegal);
    
    // Sol de la parcelle
    const groundGeom = new THREE.PlaneGeometry(plot.w, plot.d);
    const ground = new THREE.Mesh(groundGeom, matLib.get(soilColor, 0.9, 0.1));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    plot.group.add(ground);

    // Rendu des plants en croissance ou mûrs
    if (plot.crop && plot.stage !== STAGES.FRICHE && plot.stage !== STAGES.LABOURE && plot.stage !== STAGES.MORT) {
      const spec = safeCrop(plot.crop);
      if (spec) {
        const rng   = makeRng ? makeRng(plot._rngSeed) : Math.random;
        const geo   = this._getOrCreateConeGeometry(spec.height);
        const mat   = matLib.get(this.getCropColor(spec, plot.stage), 0.9, 0);
        const cols  = Math.max(2, Math.floor(plot.w / 0.8));
        const rows  = Math.max(2, Math.floor(plot.d / 0.8));
        const count = Math.min(24, cols * rows);

        for (let i = 0; i < count; i++) {
          const plant = new THREE.Mesh(geo, mat);
          plant.position.set(
            (rng() - 0.5) * plot.w,
            spec.height / 2,
            (rng() - 0.5) * plot.d
          );
          plant.castShadow = true;
          plot.group.add(plant);
        }
      }
    }

    // Effet visuel de flétrissement
    if (plot.stage === STAGES.MORT) {
      const deadGeom = new THREE.PlaneGeometry(plot.w * 0.98, plot.d * 0.98);
      const dead = new THREE.Mesh(deadGeom, matLib.get(0x2a1a10, 0.95, 0));
      dead.rotation.x = -Math.PI / 2;
      dead.position.y = 0.02;
      plot.group.add(dead);
    }

    // Structure de serre en verre pour les grow-ops dissimulées
    if (plot.concealed) {
      const ghGeom = new THREE.BoxGeometry(plot.w + 1, 2.5, plot.d + 1);
      const gh = new THREE.Mesh(ghGeom, matLib.physicalGlass(0xaaddff, 0.1, 0.1));
      gh.position.y = 1.25;
      plot.group.add(gh);
    }
  }

  getSoilColor(stage, illegal) {
    if (stage === STAGES.LABOURE) return 0x4a3525;
    if (stage === STAGES.MORT)    return 0x2a1a10;
    if (illegal)                  return 0x2a3a20;
    if (stage === STAGES.MUR)     return 0x4a4a30;
    return 0x5a7a40;
  }

  getCropColor(spec, stage) {
    if (stage === STAGES.SEME)   return 0x3a5a28;
    if (stage === STAGES.POUSSE) return spec.color;
    if (stage === STAGES.MUR) {
      if (spec.id === 'ble')  return 0xe4d480;
      if (spec.id === 'mais') return 0xd4b850;
      return spec.color;
    }
    return 0xffffff;
  }

  // ─── SÉRIALISATION / PERSISTANCE ───────────────────────────────────────────
  serialize() {
    return this.getAllPlots().map((p) => ({
      id:              p.id,
      stage:           p.stage,
      crop:            p.crop,
      plantedAt:       p.plantedAt,
      growth:          +p.growth.toFixed(4),
      heat:            p.heat,
      illegal:         p.illegal,
      concealed:       p.concealed,
      greenhouse:      p.greenhouse,
      fertility:       +p.fertility.toFixed(3),
      water:           +p.water.toFixed(3),
      quality:         +p.quality.toFixed(3),
      speedMul:        p.speedMul,
      harvestCount:    p.harvestCount,
      rotationHistory: p.rotationHistory.slice(0, 5),
    }));
  }

  hydrate(rows) {
    if (!Array.isArray(rows)) return 0;
    let restored = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const plot = this.plots.get(r.id);
      if (!plot) continue;
      
      plot.stage        = r.stage || STAGES.FRICHE;
      plot.crop         = r.crop || null;
      plot.plantedAt    = Number(r.plantedAt) || 0;
      plot.growth       = Number(r.growth) || 0;
      plot.heat         = Number(r.heat) || 0;
      plot.illegal      = !!r.illegal;
      plot.concealed    = !!r.concealed;
      plot.greenhouse   = !!r.greenhouse;
      plot.fertility    = Number.isFinite(r.fertility) ? r.fertility : 1.0;
      plot.water        = Number.isFinite(r.water)     ? r.water     : 1.0;
      plot.quality      = Number.isFinite(r.quality)   ? r.quality   : 0;
      plot.speedMul     = Number.isFinite(r.speedMul)  ? r.speedMul  : 1.0;
      plot.harvestCount = Number(r.harvestCount) || 0;
      
      if (Array.isArray(r.rotationHistory)) {
        plot.rotationHistory = r.rotationHistory.slice(0, 5);
      }
      this._lastRenderStage.delete(plot);
      this.renderPlot(plot, true);
      restored++;
    }
    return restored;
  }

  // ─── STATISTIQUES ET CYCLE DE VIE (DISPOSE) ────────────────────────────────
  getStats() {
    const total = this._stats.renderComputes + this._stats.renderSkips;
    const skipRate = total > 0 ? (this._stats.renderSkips / total) : 0;
    return {
      ...this._stats,
      plots:       this.plots.size,
      skipRate:    +skipRate.toFixed(3),
      season:      this._season,
      weather:     this._weather,
      globalSpeed: this._globalSpeed,
      sig:         SIG,
    };
  }

  resetStats() {
    const keys = Object.keys(this._stats);
    for (let i = 0; i < keys.length; i++) {
      this._stats[keys[i]] = 0;
    }
    return this;
  }

  invalidate() {
    this._lastRenderStage = new WeakMap();
    for (const plot of this.plots.values()) {
      this.renderPlot(plot, true);
    }
    return this;
  }

  dispose() {
    this._events.clear();
    this._lastRenderStage = new WeakMap();
    this._grid.clear();
    
    for (const plot of this.plots.values()) {
      clearGroupAndDispose(plot.group);
    }
    this.plots.clear();

    // Libération des géométries de plantes mises en cache
    this._coneGeometryCache.forEach((geo) => {
      try { geo.dispose(); } catch (e) { /* ignore */ }
    });
    this._coneGeometryCache.clear();
    
    console.log(`[${SIG}·Farms] FarmManager déchargé (Géométries purgées)`);
  }
}

export const farmManager = new FarmManager();

// ─── CARTOGRAPHIE / CONFIGURATION LAYOUTS ────────────────────────────────────
export function countyFarmLayout() {
  return [
    { id: 'ferme_alban', village: 'Saint-Alban', x: -40, z: 45, yaw: 0, crop: 'ble', plots: [{ ox: 0, oz: 0, w: 10, d: 10 }] },
    { id: 'grow_op_bois', village: 'Forêt', x: -55, z: 50, yaw: 0.5, crop: 'cannabis', hidden: true, plots: [{ ox: 0, oz: 0, w: 6, d: 6 }] },
  ];
}

export function legalFarmsteads() {
  return countyFarmLayout().filter((f) => !f.hidden);
}

export function farmClearings() {
  return countyFarmLayout().flatMap((f) =>
    f.plots.map((p) => ({ x: f.x + p.ox, z: f.z + p.oz, w: p.w, d: p.d, hidden: !!f.hidden }))
  );
}

export function farmMapMarks() {
  return countyFarmLayout().map((f) => ({ id: f.id, x: f.x, z: f.z, name: f.village, hidden: !!f.hidden }));
}

// ─── API STATIQUES COMPATIBLES / FAÇADES ─────────────────────────────────────
export function fieldPrompt(plotId, tool) {
  const plot = farmManager.getPlot(plotId);
  if (!plot) return 'Parcelle inconnue';
  const extra = plot.stage === STAGES.MORT ? ' (MORTE)' : '';
  return `Champ: ${plot.stage}${extra} | Outil: ${tool || 'Aucun'} | Eau: ${Math.round(plot.water * 100)}% | Fert: ${Math.round(plot.fertility * 100)}%`;
}

export function workField(plotId, tool, seed, playerId, ctx) {
  return farmManager.workPlot(plotId, tool, seed, playerId, ctx);
}

export function workFieldBatch(actions, playerId, ctx) {
  return farmManager.workPlotBatch(actions, playerId, ctx);
}

export function tickFields(dt, px, pz) {
  farmManager.tick(dt, px, pz);
}

export function seizeField(plotId, officerId) {
  return farmManager.seizePlot(plotId, officerId);
}

export function waterField(plotId, amount) {
  return farmManager.waterPlot(plotId, amount);
}

export function fertilizeField(plotId, amount) {
  return farmManager.fertilizePlot(plotId, amount);
}

export function toggleGreenhouse(plotId) {
  return farmManager.toggleGreenhouse(plotId);
}

export function cropFromSeed(seedId) {
  const c = safeCropFromSeed(seedId);
  return c ? c.id : null;
}

/**
 * nearestField : Recherche de proximité ultra rapide par index de grille spatiale
 */
export function nearestField(x, z, radius = 20) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  let nearest = null;
  let minDist = Infinity;

  const cx = Math.floor(x / GRID_CELL_SIZE);
  const cz = Math.floor(z / GRID_CELL_SIZE);
  const cells = [];
  
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      cells.push(`${cx + dx},${cz + dz}`);
    }
  }

  const candidates = new Set();
  for (let i = 0; i < cells.length; i++) {
    const set = farmManager._grid.get(cells[i]);
    if (set) {
      set.forEach((id) => candidates.add(id));
    }
  }

  if (candidates.size === 0) {
    const all = farmManager.getAllPlots();
    for (let i = 0; i < all.length; i++) {
      candidates.add(all[i].id);
    }
  }

  candidates.forEach((id) => {
    const plot = farmManager.getPlot(id);
    if (!plot) return;
    const ddx = Math.abs(x - plot.x) - plot.w / 2;
    const ddz = Math.abs(z - plot.z) - plot.d / 2;
    const outsideDist = Math.hypot(Math.max(0, ddx), Math.max(0, ddz));
    if (outsideDist <= radius && outsideDist < minDist) {
      minDist = outsideDist;
      nearest = plot;
    }
  });

  return nearest;
}

export function mountFarms(parent) {
  if (!parent) return;
  const plots = farmManager.getAllPlots();
  for (let i = 0; i < plots.length; i++) {
    parent.add(plots[i].group);
  }
}

export function buildTracteur() {
  const g = new THREE.Group();
  const geom = new THREE.BoxGeometry(2, 1.5, 3);
  const mesh = new THREE.Mesh(geom, matLib.get(0xcc2200, 0.5, 0.2));
  g.add(mesh);
  return g;
}

export function soilColor(stage, illegal) {
  return farmManager.getSoilColor(stage, illegal);
}

export function cropTint(spec, stage) {
  return farmManager.getCropColor(spec, stage);
}

export function localOffset(plot, x, z) {
  if (!plot) return { lx: 0, lz: 0 };
  const dx = x - plot.x, dz = z - plot.z;
  const c = Math.cos(-plot.yaw);
  const s = Math.sin(-plot.yaw);
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}

// ─── DEFAULTS EXPORTS ────────────────────────────────────────────────────────
export default {
  CROPS,
  STAGES,
  QUALITY,
  FarmManager,
  farmManager,
  workField,
  workFieldBatch,
  tickFields,
  seizeField,
  waterField,
  fertilizeField,
  toggleGreenhouse,
  nearestField,
  mountFarms,
  countyFarmLayout,
  legalFarmsteads,
  farmClearings,
  farmMapMarks,
  fieldPrompt,
  cropFromSeed,
  buildTracteur,
  soilColor,
  cropTint,
  localOffset,
};
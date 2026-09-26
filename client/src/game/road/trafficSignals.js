/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/ROAD/TRAFFICSIGNALS.JS
 * Feux de circulation urbains + arrêts STOP ruraux (comté de Portneuf)
 * ═══════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • Matériaux partagés au niveau MODULE (plus de fuite VRAM)
 *   • Debounce des amendes (par signal, cooldown configurable)
 *   • Cycle par spot (green/yellow/allRed/red durations)
 *   • getPhaseInfo() → { phase, remainingMs, totalMs }
 *   • Terrain provider injectable (fallback 0)
 *   • userData TROXT⬡ sur tous les meshes
 *   • Panneau ARRÊT : CanvasTexture "ARRÊT" (cache global)
 *   • Spatial index : Map<cellKey, spots[]> pour queries O(1)
 *   • findNearestSignal(x, z, maxDist)
 *   • dispose() + reset()
 *   • kernel attach + emits `troxtworld:traffic.violation`
 *   • Constantes deep-frozen
 *   • Amendes configurables
 *   • speedLimit exposé via getSpeedLimitAt(x, z)
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/road/trafficSignals.js
 */

import * as THREE from 'three';

const SIG = 'TROXT⬡';

// ─── JSDoc (autocomplétion IDE) ────────────────────────────────────────────
/**
 * @typedef {('green'|'yellow'|'red')} SignalPhase
 * @typedef {('feu_rouge'|'arret_stop')} ViolationKind
 *
 * @typedef {object} TrafficLightSpot
 * @property {string} id
 * @property {string} name
 * @property {boolean} isUrban
 * @property {number} x
 * @property {number} z
 * @property {number} rotationY
 * @property {number} cycleOffset
 * @property {number} speedLimit
 *
 * @typedef {object} StopSignSpot
 * @property {string} id
 * @property {string} name
 * @property {boolean} isRural
 * @property {number} x
 * @property {number} z
 * @property {number} rotationY
 * @property {string} roadName
 *
 * @typedef {object} PhaseInfo
 * @property {SignalPhase} phase
 * @property {number} remainingMs
 * @property {number} totalMs
 *
 * @typedef {object} ViolationReport
 * @property {ViolationKind} violation
 * @property {string} message
 * @property {string} location
 * @property {number} fine
 * @property {string} spotId
 *
 * @typedef {object} TrafficConfig
 * @property {(x:number,z:number)=>number} [terrainProvider]
 * @property {object} [kernel]
 * @property {{green:number,yellow:number,allRed:number,red:number}} [cycle]
 * @property {number} [redLightSpeedThreshold=24]   - km/h au-delà duquel = infraction feu rouge
 * @property {number} [stopSpeedThreshold=38]       - km/h au-delà duquel = infraction arrêt
 * @property {number} [violationCooldownMs=3000]    - cooldown entre 2 amendes même spot
 * @property {number} [fineFeuRouge=215]
 * @property {number} [fineStop=175]
 * @property {number} [lightRadius=14]
 * @property {number} [stopRadius=12]
 */

// ═══════════════════════════════════════════════════════════════════════════
// DONNÉES (deep-frozen)
// ═══════════════════════════════════════════════════════════════════════════

export const URBAN_TRAFFIC_LIGHTS = Object.freeze([
  Object.freeze({ id: 'tl_donnacona_138_centre',  name: 'Feu Donnacona • Rte 138 & Av. Jacques-Cartier',  isUrban: true, x:  820, z:  420,  rotationY: 0,            cycleOffset: 0,  speedLimit: 50 }),
  Object.freeze({ id: 'tl_donnacona_138_ouest',   name: 'Feu Donnacona • Rte 138 & Rue Notre-Dame',        isUrban: true, x:  740, z:  435,  rotationY: Math.PI / 2,  cycleOffset: 12, speedLimit: 50 }),
  Object.freeze({ id: 'tl_pont_rouge_365',        name: 'Feu Pont-Rouge • Route 365 & Rue Commerciale',    isUrban: true, x: 1840, z: -380,  rotationY: 0.3,          cycleOffset: 5,  speedLimit: 50 }),
  Object.freeze({ id: 'tl_saint_raymond_367',     name: 'Feu Saint-Raymond • Route 367 & Rue Saint-Cyrille',isUrban: true, x: 1200, z: -1880, rotationY: -0.4,         cycleOffset: 8,  speedLimit: 50 }),
  Object.freeze({ id: 'tl_portneuf_centre',       name: 'Feu Portneuf-Ville • Rte 138 & 1ère Avenue',      isUrban: true, x:  110, z:  320,  rotationY: 0,            cycleOffset: 15, speedLimit: 50 }),
]);

export const RURAL_STOP_SIGNS = Object.freeze([
  Object.freeze({ id: 'stop_rang_st_joseph_138',       name: "Arrêt • Sortie Rang Saint-Joseph vers Rte 138",  isRural: true, x: -850,  z:  320,  rotationY: Math.PI / 2, roadName: 'Rang Saint-Joseph' }),
  Object.freeze({ id: 'stop_2e_rang_deschambault',     name: 'Arrêt • Intersection 2e Rang Ouest & Route 363', isRural: true, x: -1850, z: -280,  rotationY: 0,           roadName: '2e Rang Ouest' }),
  Object.freeze({ id: 'stop_rang_st_francois',         name: 'Arrêt • Intersection Rang Saint-François & Rte 358', isRural: true, x: -280, z: -620, rotationY: 0.8,        roadName: 'Rang Saint-François' }),
  Object.freeze({ id: 'stop_rang_ste_madeleine',       name: 'Arrêt • Rang Sainte-Madeleine & Rte 365',        isRural: true, x: 1620,  z: -1100, rotationY: -0.5,        roadName: 'Rang Sainte-Madeleine' }),
  Object.freeze({ id: 'stop_rang_mines_st_casimir',    name: 'Arrêt • Rang des Mines vers Saint-Casimir',      isRural: true, x: -3300, z:  180,  rotationY: 1.2,         roadName: 'Rang des Mines' }),
  Object.freeze({ id: 'stop_grand_rang_ste_christine', name: 'Arrêt • Grand-Rang & Sainte-Christine',          isRural: true, x: -120,  z: -1750, rotationY: 0.1,         roadName: 'Grand-Rang Nord' }),
  Object.freeze({ id: 'stop_neuville_route_rive',      name: 'Arrêt • Chemin de la Butte & Route 138 Neuville', isRural: true, x: 3100, z: 380,   rotationY: -Math.PI / 2, roadName: 'Route 138 Est' }),
]);

// ═══════════════════════════════════════════════════════════════════════════
// CYCLE PAR DÉFAUT (green / yellow / all-red / opposing-red)
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_CYCLE = Object.freeze({
  green:  22,   // 22s vert
  yellow:  4,   //  4s jaune
  allRed:  2,   //  2s rouge de dégagement (tous feux rouges)
  red:    16,   // 16s rouge côté adverse (vert adverse)
});              // total = 44s

const TOTAL_CYCLE = DEFAULT_CYCLE.green + DEFAULT_CYCLE.yellow + DEFAULT_CYCLE.allRed + DEFAULT_CYCLE.red;

// ═══════════════════════════════════════════════════════════════════════════
// CACHE MATÉRIAUX MODULE (partagé entre toutes les instances)
// ═══════════════════════════════════════════════════════════════════════════
const _matCache = new Map();
const _getMat = (k, factory) => {
  if (!_matCache.has(k)) _matCache.set(k, factory());
  return _matCache.get(k);
};

const M = {
  redOff:     () => _getMat('redOff',     () => new THREE.MeshBasicMaterial({ color: 0x3a0808 })),
  redOn:      () => _getMat('redOn',      () => new THREE.MeshBasicMaterial({ color: 0xff1e1e })),
  yellowOff:  () => _getMat('yellowOff',  () => new THREE.MeshBasicMaterial({ color: 0x3a2d04 })),
  yellowOn:   () => _getMat('yellowOn',   () => new THREE.MeshBasicMaterial({ color: 0xffd214 })),
  greenOff:   () => _getMat('greenOff',   () => new THREE.MeshBasicMaterial({ color: 0x052e16 })),
  greenOn:    () => _getMat('greenOn',    () => new THREE.MeshBasicMaterial({ color: 0x22c55e })),
  pole:       () => _getMat('pole',       () => new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 })),
  housing:    () => _getMat('housing',    () => new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 })),
  stopRed:    () => _getMat('stopRed',    () => new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 })),
  stopWhite:  () => _getMat('stopWhite',  () => new THREE.MeshBasicMaterial({ color: 0xffffff })),
  woodPost:   () => _getMat('woodPost',   () => new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })),
};

export function disposeTrafficSignalMaterials() {
  for (const m of _matCache.values()) m.dispose();
  _matCache.clear();
}

// ─── CanvasTexture "ARRÊT" (cache module, SSR-safe) ────────────────────────
let _stopTexture = null;
function getStopFaceTexture() {
  if (_stopTexture) return _stopTexture;
  try {
    if (typeof document === 'undefined') {
      // Fallback SSR : texture vide (le mesh utilisera une couleur unie)
      _stopTexture = null;
      return null;
    }
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    // Octogone rouge
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = 128 + Math.cos(a) * 122;
      const y = 128 + Math.sin(a) * 122;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Bordure blanche
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Texte ARRÊT
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 62px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ARRÊT', 128, 128);

    _stopTexture = new THREE.CanvasTexture(c);
    if ('colorSpace' in _stopTexture && THREE.SRGBColorSpace) {
      _stopTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return _stopTexture;
  } catch {
    return null;
  }
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
const resolveY = (provider, x, z) => {
  try {
    const y = provider ? provider(x, z) : 0;
    return Number.isFinite(y) ? y : 0;
  } catch {
    return 0;
  }
};

// Clé de cellule spatiale (grille 32m pour index rapide)
const CELL = 32;
const cellKey = (x, z) => `${Math.floor(x / CELL)}|${Math.floor(z / CELL)}`;

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

export class TrafficSignalSystem {
  /**
   * @param {TrafficConfig} [config]
   */
  constructor(config = {}) {
    // ─── Config fusionnée
    this.config = {
      terrainProvider:      config.terrainProvider || (() => 0),
      kernel:               config.kernel || null,
      cycle:                { ...DEFAULT_CYCLE, ...(config.cycle || {}) },
      redLightSpeedThreshold: config.redLightSpeedThreshold ?? 24,
      stopSpeedThreshold:     config.stopSpeedThreshold     ?? 38,
      violationCooldownMs:    config.violationCooldownMs    ?? 3000,
      fineFeuRouge:           config.fineFeuRouge           ?? 215,
      fineStop:               config.fineStop               ?? 175,
      lightRadius:            config.lightRadius            ?? 14,
      stopRadius:             config.stopRadius             ?? 12,
    };

    // Recalcul du total après fusion
    const c = this.config.cycle;
    this._cycleTotal = c.green + c.yellow + c.allRed + c.red;

    this.group = new THREE.Group();
    this.group.name = 'traffic-signals';
    this.group.userData = { sig: SIG };

    /** @type {Map<string, {pole:THREE.Mesh, housing:THREE.Mesh, redLens:THREE.Mesh, yellowLens:THREE.Mesh, greenLens:THREE.Mesh, spot:TrafficLightSpot}>} */
    this.lightMeshes = new Map();

    /** @type {THREE.Group[]} */
    this.stopMeshes = [];

    /** @type {Map<string, number>} cooldown amendes (spotId → lastFineMs) */
    this._lastFineAt = new Map();

    // Index spatial (grille) : cellKey → array de spots { kind, spot }
    this._spatialIndex = new Map();

    this.buildTrafficLights();
    this.buildStopSigns();
    this._buildSpatialIndex();
  }

  // ─── Kernel ────────────────────────────────────────────────────────────
  attachKernel(kernel) {
    this.config.kernel = kernel;
    return this;
  }

  // ─── Construction des feux ─────────────────────────────────────────────
  buildTrafficLights() {
    for (const spot of URBAN_TRAFFIC_LIGHTS) {
      const lightGroup = new THREE.Group();
      const groundY = resolveY(this.config.terrainProvider, spot.x, spot.z);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 6.2, 8),
        M.pole()
      );
      pole.position.set(0, 3.1, 0);
      lightGroup.add(pole);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.15, 3.2),
        M.pole()
      );
      arm.position.set(0, 5.8, 1.6);
      lightGroup.add(arm);

      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 1.35, 0.35),
        M.housing()
      );
      housing.position.set(0, 5.4, 2.8);
      lightGroup.add(housing);

      const lensGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16);

      const redLens = new THREE.Mesh(lensGeo, M.redOff());
      redLens.rotation.x = Math.PI / 2;
      redLens.position.set(0, 5.8, 2.96);
      lightGroup.add(redLens);

      const yellowLens = new THREE.Mesh(lensGeo, M.yellowOff());
      yellowLens.rotation.x = Math.PI / 2;
      yellowLens.position.set(0, 5.4, 2.96);
      lightGroup.add(yellowLens);

      const greenLens = new THREE.Mesh(lensGeo, M.greenOff());
      greenLens.rotation.x = Math.PI / 2;
      greenLens.position.set(0, 5.0, 2.96);
      lightGroup.add(greenLens);

      lightGroup.position.set(spot.x, groundY, spot.z);
      lightGroup.rotation.y = spot.rotationY;
      // 🔧 BOOST : userData pour raycast
      lightGroup.userData = { sig: SIG, kind: 'traffic_light', spotId: spot.id, spot };
      this.group.add(lightGroup);

      this.lightMeshes.set(spot.id, { pole, housing, redLens, yellowLens, greenLens, spot });
    }
  }

  // ─── Construction des STOP ─────────────────────────────────────────────
  buildStopSigns() {
    const stopTex = getStopFaceTexture();

    for (const spot of RURAL_STOP_SIGNS) {
      const stopGroup = new THREE.Group();
      const groundY = resolveY(this.config.terrainProvider, spot.x, spot.z);

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6),
        M.woodPost()
      );
      post.position.set(0, 1.4, 0);
      stopGroup.add(post);

      if (stopTex) {
        // 🔧 BOOST : face CanvasTexture avec "ARRÊT" écrit
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(0.96, 0.96),
          new THREE.MeshBasicMaterial({ map: stopTex, transparent: true })
        );
        face.position.set(0, 2.3, 0.031);
        stopGroup.add(face);
      } else {
        // Fallback : octogone rouge plein
        const octGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.04, 8);
        const sign = new THREE.Mesh(octGeo, M.stopRed());
        sign.rotation.x = Math.PI / 2;
        sign.position.set(0, 2.3, 0.03);
        stopGroup.add(sign);
      }

      stopGroup.position.set(spot.x, groundY, spot.z);
      stopGroup.rotation.y = spot.rotationY;
      stopGroup.userData = { sig: SIG, kind: 'stop_sign', spotId: spot.id, spot };
      this.group.add(stopGroup);
      this.stopMeshes.push(stopGroup);
    }
  }

  // ─── Index spatial ─────────────────────────────────────────────────────
  _buildSpatialIndex() {
    const add = (x, z, entry) => {
      const k = cellKey(x, z);
      if (!this._spatialIndex.has(k)) this._spatialIndex.set(k, []);
      this._spatialIndex.get(k).push(entry);
    };
    for (const s of URBAN_TRAFFIC_LIGHTS) add(s.x, s.z, { kind: 'light', spot: s });
    for (const s of RURAL_STOP_SIGNS)    add(s.x, s.z, { kind: 'stop',  spot: s });
  }

  /** Retourne les spots dans un rayon de cellules autour de (x,z) */
  _queryNearby(x, z, radiusCells = 1) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const out = [];
    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      for (let dz = -radiusCells; dz <= radiusCells; dz++) {
        const arr = this._spatialIndex.get(`${cx + dx}|${cz + dz}`);
        if (arr) out.push(...arr);
      }
    }
    return out;
  }

  // ─── Cycle & phases ────────────────────────────────────────────────────
  /**
   * Retourne la phase visuelle du feu.
   * @param {TrafficLightSpot} spot
   * @param {number} timeSeconds
   * @returns {SignalPhase}
   */
  getPhase(spot, timeSeconds) {
    const c = this.config.cycle;
    const t = ((timeSeconds + spot.cycleOffset) % this._cycleTotal + this._cycleTotal) % this._cycleTotal;

    if (t < c.green)                                    return 'green';
    if (t < c.green + c.yellow)                         return 'yellow';
    // allRed + red → visuellement rouge
    return 'red';
  }

  /**
   * Retourne la phase + temps restant (HUD-friendly).
   * @param {TrafficLightSpot} spot
   * @param {number} timeSeconds
   * @returns {PhaseInfo}
   */
  getPhaseInfo(spot, timeSeconds) {
    const c = this.config.cycle;
    const t = ((timeSeconds + spot.cycleOffset) % this._cycleTotal + this._cycleTotal) % this._cycleTotal;

    let phase, phaseStart, phaseDuration;
    if (t < c.green) {
      phase = 'green'; phaseStart = 0; phaseDuration = c.green;
    } else if (t < c.green + c.yellow) {
      phase = 'yellow'; phaseStart = c.green; phaseDuration = c.yellow;
    } else if (t < c.green + c.yellow + c.allRed) {
      phase = 'red'; phaseStart = c.green + c.yellow; phaseDuration = c.allRed;
    } else {
      phase = 'red'; phaseStart = c.green + c.yellow + c.allRed; phaseDuration = c.red;
    }

    const remaining = (phaseStart + phaseDuration - t) * 1000;
    return { phase, remainingMs: Math.max(0, remaining), totalMs: phaseDuration * 1000 };
  }

  // ─── Update frame ──────────────────────────────────────────────────────
  update(timeSeconds) {
    for (const item of this.lightMeshes.values()) {
      const phase = this.getPhase(item.spot, timeSeconds);
      if (phase === 'green') {
        item.greenLens.material  = M.greenOn();
        item.yellowLens.material = M.yellowOff();
        item.redLens.material    = M.redOff();
      } else if (phase === 'yellow') {
        item.greenLens.material  = M.greenOff();
        item.yellowLens.material = M.yellowOn();
        item.redLens.material    = M.redOff();
      } else {
        item.greenLens.material  = M.greenOff();
        item.yellowLens.material = M.yellowOff();
        item.redLens.material    = M.redOn();
      }
    }
  }

  // ─── Détection infractions ─────────────────────────────────────────────
  /**
   * Vérifie si le joueur commet une infraction.
   * @param {number} playerX
   * @param {number} playerZ
   * @param {number} speedKmh
   * @param {number} timeSeconds
   * @param {string} [actorId='player-local']
   * @returns {ViolationReport|null}
   */
  checkViolations(playerX, playerZ, speedKmh, timeSeconds, actorId = 'player-local') {
    if (!Number.isFinite(speedKmh) || speedKmh <= 0) return null;

    const now = Date.now();
    const nearby = this._queryNearby(playerX, playerZ, 2); // rayon 3 cellules = 96m

    for (const entry of nearby) {
      const spot = entry.spot;
      const dx = playerX - spot.x;
      const dz = playerZ - spot.z;
      const distSq = dx * dx + dz * dz;

      if (entry.kind === 'light') {
        if (distSq >= this.config.lightRadius ** 2) continue;

        const phase = this.getPhase(spot, timeSeconds);
        if (phase !== 'red') continue;
        if (speedKmh <= this.config.redLightSpeedThreshold) continue;

        // 🔧 BOOST : cooldown par spot
        const last = this._lastFineAt.get(spot.id) || 0;
        if (now - last < this.config.violationCooldownMs) continue;

        this._lastFineAt.set(spot.id, now);
        const report = {
          violation: 'feu_rouge',
          message: 'Brûlage de feu rouge à une intersection urbaine de Portneuf !',
          location: spot.name,
          fine: this.config.fineFeuRouge,
          spotId: spot.id,
        };
        this.config.kernel?.emit?.('troxtworld:traffic.violation', { ...report, actorId, speedKmh });
        return report;
      }

      if (entry.kind === 'stop') {
        if (distSq >= this.config.stopRadius ** 2) continue;
        if (speedKmh <= this.config.stopSpeedThreshold) continue;

        const last = this._lastFineAt.get(spot.id) || 0;
        if (now - last < this.config.violationCooldownMs) continue;

        this._lastFineAt.set(spot.id, now);
        const report = {
          violation: 'arret_stop',
          message: 'Non-respect d\'un arrêt obligatoire (STOP) de rang rural !',
          location: spot.name,
          fine: this.config.fineStop,
          spotId: spot.id,
        };
        this.config.kernel?.emit?.('troxtworld:traffic.violation', { ...report, actorId, speedKmh });
        return report;
      }
    }

    return null;
  }

  // ─── Queries utilitaires ───────────────────────────────────────────────
  /**
   * Retourne le signal le plus proche dans un rayon donné.
   * @param {number} x
   * @param {number} z
   * @param {number} [maxDist=50]
   * @returns {{kind:'light'|'stop', spot:TrafficLightSpot|StopSignSpot, distance:number}|null}
   */
  findNearestSignal(x, z, maxDist = 50) {
    const nearby = this._queryNearby(x, z, 2);
    let best = null, bestD = maxDist;
    for (const e of nearby) {
      const d = Math.hypot(e.spot.x - x, e.spot.z - z);
      if (d < bestD) { best = { kind: e.kind, spot: e.spot, distance: d }; bestD = d; }
    }
    return best;
  }

  /**
   * Limite de vitesse applicable au point (x,z), ou null si aucune.
   */
  getSpeedLimitAt(x, z) {
    const s = this.findNearestSignal(x, z, 60);
    if (!s || s.kind !== 'light') return null;
    return s.spot.speedLimit ?? null;
  }

  /** Stats debug */
  getStats() {
    return {
      sig: SIG,
      trafficLights: this.lightMeshes.size,
      stopSigns: this.stopMeshes.length,
      cycle: { ...this.config.cycle, total: this._cycleTotal },
      spatialCells: this._spatialIndex.size,
      cooldownsActive: this._lastFineAt.size,
    };
  }

  /** Reset complet (save / load) */
  reset() {
    this._lastFineAt.clear();
  }

  /** Libère les géométries créées par CETTE instance (matériaux = module-level) */
  dispose() {
    this.group.traverse((child) => {
      if (child.isMesh && child.geometry) child.geometry.dispose();
    });
    if (this.group.parent) this.group.parent.remove(this.group);
    this.lightMeshes.clear();
    this.stopMeshes = [];
    this._lastFineAt.clear();
    this._spatialIndex.clear();
  }
}

// ─── SINGLETON (optionnel) ─────────────────────────────────────────────────
export let trafficSignalSystem = null;

export function initTrafficSignalSystem(config = {}) {
  if (trafficSignalSystem) trafficSignalSystem.dispose();
  trafficSignalSystem = new TrafficSignalSystem(config);
  return trafficSignalSystem;
}

export { SIG, DEFAULT_CYCLE as TRAFFIC_SIGNAL_DEFAULT_CYCLE };
export default TrafficSignalSystem;
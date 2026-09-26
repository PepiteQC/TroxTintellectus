/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/ROAD/ROADINCIDENTS.JS
 * Système d'incidents routiers : chantiers MTQ, fête foraine, nids-de-poule
 * ═══════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • PRNG déterministe (mulberry32) → positions reproductibles
 *   • Matériaux partagés au niveau MODULE (cache global)
 *   • Guard getTerrainHeight : fallback 0 si absent / NaN
 *   • userData TROXT⬡ sur tous les meshes (raycast-friendly)
 *   • tentColors : fallback cyclique si matIdx hors borne
 *   • Voitures bouchon alignées sur un seul sens
 *   • dispose() propre
 *   • getObstaclesByType() + getStats()
 *   • kernel optionnel : emit('troxtworld:incident')
 *   • INCIDENT_ZONES deep-frozen
 *   • terrainProvider injectable
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/road/roadIncidents.js
 */

import * as THREE from 'three';

const SIG = 'TROXT⬡';

// ─── JSDoc (autocomplétion IDE) ────────────────────────────────────────────
/**
 * @typedef {('barrel_orange'|'cone_mtq'|'barrier_detour'|'pothole'|'festive_tent'|'festival_queue_car')} IncidentType
 * @typedef {('chantier_mtq'|'fete_foraine'|'nid_de_poule')} IncidentCategory
 *
 * @typedef {object} RoadIncidentObstacle
 * @property {string} id
 * @property {IncidentType} type
 * @property {number} x
 * @property {number} z
 * @property {number} radius
 * @property {number} height
 * @property {string} name
 * @property {number} damagePoints
 * @property {THREE.Object3D} mesh
 *
 * @typedef {object} RoadIncidentZone
 * @property {string} id
 * @property {string} title
 * @property {IncidentCategory} category
 * @property {string} locationName
 * @property {[number, number]} center
 * @property {number} radius
 * @property {boolean} isRoadBlocked
 * @property {string} detourAdvice
 * @property {string} trafficJamDescription
 */

// ─── PRNG déterministe (mulberry32) ────────────────────────────────────────
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ─── ZONES D'INCIDENT (deep-frozen) ────────────────────────────────────────
export const INCIDENT_ZONES = Object.freeze([
  Object.freeze({
    id: "fete_foraine_deschambault",
    title: "Fête Foraine & Grande Braderie Estivale de Deschambault",
    category: "fete_foraine",
    locationName: "Route 138 (Chemin du Roy) • Cœur patrimonial de Deschambault",
    center: Object.freeze([-1980, 220]),
    radius: 95,
    isRoadBlocked: true,
    detourAdvice: "Chemin barré aux voitures ! Emprunter la déviation par le 2e Rang Ouest.",
    trafficJamDescription:
      "Bouchon de circulation dense causé par les festivaliers, calèches, camions de barbe à papa et kiosques de fête foraine occupant la chaussée.",
  }),
  Object.freeze({
    id: "chantier_refection_pont_rouge",
    title: "Chantier MTQ — Réfection d'asphalte & Réparation de Pont",
    category: "chantier_mtq",
    locationName: "Route 365 vers Pont-Rouge",
    center: Object.freeze([1720, -180]),
    radius: 65,
    isRoadBlocked: false,
    detourAdvice: "Circulation en alternance sur une seule voie. Vitesse réduite à 30 km/h.",
    trafficJamDescription:
      "Ralentissement majeur causé par les pelles mécaniques, camions de bitume chaud et barils oranges MTQ.",
  }),
  Object.freeze({
    id: "nid_de_poule_rang_st_francois",
    title: "Section Dégradée — Nids-de-poule printaniers profonds",
    category: "nid_de_poule",
    locationName: "Rang Saint-François vers Saint-Basile",
    center: Object.freeze([-310, -560]),
    radius: 45,
    isRoadBlocked: false,
    detourAdvice: "Risque de crevaison et bris de suspension. Ralentir à 20 km/h.",
    trafficJamDescription: "Voitures roulant au ralenti pour esquiver les cratères dans la chaussée.",
  }),
]);

// ═══════════════════════════════════════════════════════════════════════════
// CACHE MATÉRIAUX GLOBAL (survit à toutes les instances)
// ═══════════════════════════════════════════════════════════════════════════
const _matCache = new Map();
const _getMat = (key, factory) => {
  if (!_matCache.has(key)) _matCache.set(key, factory());
  return _matCache.get(key);
};

const M = {
  mtqOrange:     () => _getMat('mtqOrange',     () => new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 })),
  mtqWhite:      () => _getMat('mtqWhite',      () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })),
  barrierWood:   () => _getMat('barrierWood',   () => new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.6 })),
  carJam:        () => _getMat('carJam',        () => new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3 })),
  pothole:       () => _getMat('pothole',       () => new THREE.MeshBasicMaterial({ color: 0x111827 })),
  tentRed:       () => _getMat('tentRed',       () => new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })),
  tentBlue:      () => _getMat('tentBlue',      () => new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5 })),
  tentYellow:    () => _getMat('tentYellow',    () => new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 })),
};

const TENT_MATS = [M.tentRed, M.tentBlue, M.tentYellow];

/** Libère tous les matériaux partagés (hot-reload safe). */
export function disposeRoadIncidentMaterials() {
  for (const m of _matCache.values()) m.dispose();
  _matCache.clear();
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
const SAFE_TERRAIN = (x, z) => 0;

/** Résout y via le provider injecté + guard NaN */
const resolveY = (terrainProvider, x, z) => {
  try {
    const y = terrainProvider ? terrainProvider(x, z) : 0;
    return Number.isFinite(y) ? y : 0;
  } catch {
    return 0;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

export class RoadIncidentSystem {
  /**
   * @param {object} [options]
   * @param {(x:number,z:number)=>number} [options.terrainProvider] - getTerrainHeight (défaut: 0)
   * @param {number}  [options.seed=1337]                          - PRNG seed
   * @param {object}  [options.kernel=null]                        - kernel TROXT⬡
   */
  constructor({ terrainProvider = SAFE_TERRAIN, seed = 1337, kernel = null } = {}) {
    this._terrain = terrainProvider;
    this._rng = mulberry32(seed);
    this._kernel = kernel;

    this.group = new THREE.Group();
    this.group.name = 'road-incidents';
    this.group.userData = { sig: SIG, category: 'incidents' };

    /** @type {RoadIncidentObstacle[]} */
    this.obstacles = [];

    this.buildFeteForaine();
    this.buildChantierReparations();
    this.buildPotholes();
  }

  // ─── FÊTE FORAINE ──────────────────────────────────────────────────────
  buildFeteForaine() {
    const zone = INCIDENT_ZONES[0];
    const [cx, cz] = zone.center;

    // 1. Barrières "CHEMIN BARRÉ"
    const barrierOffsets = [
      { dx: -70, dz: 0,  rot: 0.1 },
      { dx:  70, dz: 0,  rot: -0.1 },
      { dx:   0, dz: -25, rot: Math.PI / 2 },
    ];

    barrierOffsets.forEach((b, i) => {
      const bx = cx + b.dx;
      const bz = cz + b.dz;
      const by = resolveY(this._terrain, bx, bz);

      const barrierGroup = new THREE.Group();

      const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 6), M.mtqOrange());
      post1.position.set(-1.4, 0.65, 0);
      const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 6), M.mtqOrange());
      post2.position.set(1.4, 0.65, 0);
      barrierGroup.add(post1, post2);

      const rail1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.08), M.barrierWood());
      rail1.position.set(0, 0.9, 0);
      const rail2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.08), M.mtqOrange());
      rail2.position.set(0, 0.5, 0);
      barrierGroup.add(rail1, rail2);

      const signMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.06), M.mtqOrange());
      signMesh.position.set(0, 1.25, 0.04);
      barrierGroup.add(signMesh);

      barrierGroup.position.set(bx, by, bz);
      barrierGroup.rotation.y = b.rot;
      barrierGroup.userData = { sig: SIG, obstacleId: `barrier_${i}`, type: 'barrier_detour' };
      this.group.add(barrierGroup);

      this.obstacles.push({
        id: `barrier_${i}`,
        type: 'barrier_detour',
        x: bx, z: bz,
        radius: 1.8,
        height: 1.5,
        name: 'Barrière MTQ — Chemin Barré / Fête Foraine',
        damagePoints: 12,
        mesh: barrierGroup,
      });
    });

    // 2. Kiosques / Chapiteaux
    const tentPositions = [
      { dx: -25, dz:  6, matIdx: 0, name: 'Kiosque Barbe à Papa & Popcorn' },
      { dx:   0, dz: -8, matIdx: 1, name: 'Chapiteau Jeux Forains & Tir au Poignet' },
      { dx:  28, dz:  5, matIdx: 2, name: 'Kiosque Artisans du Terroir & Sirop' },
      { dx: -45, dz: -6, matIdx: 1, name: 'Manège Enfantin des Petits Rangs' },
    ];

    tentPositions.forEach((t, i) => {
      const tx = cx + t.dx;
      const tz = cz + t.dz;
      const ty = resolveY(this._terrain, tx, tz);

      const tentGroup = new THREE.Group();

      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.4, 8), TENT_MATS[t.matIdx % TENT_MATS.length]());
      roofMesh.position.set(0, 2.6, 0);
      tentGroup.add(roofMesh);

      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6), M.mtqWhite());
      p1.position.set(-1.8, 1.0, -1.8);
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6), M.mtqWhite());
      p2.position.set(1.8, 1.0, -1.8);
      const p3 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6), M.mtqWhite());
      p3.position.set(0, 1.0, 1.8);
      tentGroup.add(p1, p2, p3);

      tentGroup.position.set(tx, ty, tz);
      tentGroup.userData = { sig: SIG, obstacleId: `tent_${i}`, type: 'festive_tent' };
      this.group.add(tentGroup);

      this.obstacles.push({
        id: `tent_${i}`,
        type: 'festive_tent',
        x: tx, z: tz,
        radius: 3.2,
        height: 3.5,
        name: t.name,
        damagePoints: 30,
        mesh: tentGroup,
      });
    });

    // 3. Bouchon de voitures — 🔧 BOOST : toutes orientées dans le même sens
    const JAM_ANGLE = 0.08; // sens de circulation unique
    const jammedCars = [
      { dx: -85, dz:  2 },
      { dx: -98, dz: -1 },
      { dx:  82, dz:  1 },
      { dx:  95, dz:  3 },
    ];

    jammedCars.forEach((c, i) => {
      const jx = cx + c.dx;
      const jz = cz + c.dz;
      const jy = resolveY(this._terrain, jx, jz);

      const carGroup = new THREE.Group();

      const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 4.4), M.carJam());
      body.position.set(0, 0.75, 0);
      carGroup.add(body);

      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 2.4), M.mtqWhite());
      cab.position.set(0, 1.55, -0.2);
      carGroup.add(cab);

      carGroup.position.set(jx, jy, jz);
      // 🔧 BOOST : même angle pour tous (file indienne réaliste)
      carGroup.rotation.y = (c.dx < 0 ? 0 : Math.PI) + JAM_ANGLE;
      carGroup.userData = { sig: SIG, obstacleId: `jam_car_${i}`, type: 'festival_queue_car' };
      this.group.add(carGroup);

      this.obstacles.push({
        id: `jam_car_${i}`,
        type: 'festival_queue_car',
        x: jx, z: jz,
        radius: 2.4,
        height: 1.8,
        name: 'Véhicule bloqué dans le bouchon de la fête foraine',
        damagePoints: 25,
        mesh: carGroup,
      });
    });
  }

  // ─── CHANTIER MTQ ──────────────────────────────────────────────────────
  buildChantierReparations() {
    const zone = INCIDENT_ZONES[1];
    const [cx, cz] = zone.center;

    for (let i = 0; i < 8; i++) {
      const bx = cx + (i - 4) * 6;
      const bz = cz + (i % 2 === 0 ? 2 : -2);
      const by = resolveY(this._terrain, bx, bz);

      const barrelGroup = new THREE.Group();

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.0, 12), M.mtqOrange());
      barrel.position.set(0, 0.5, 0);
      barrelGroup.add(barrel);

      const stripe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.15, 12), M.mtqWhite());
      stripe1.position.set(0, 0.7, 0);
      const stripe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.15, 12), M.mtqWhite());
      stripe2.position.set(0, 0.35, 0);
      barrelGroup.add(stripe1, stripe2);

      barrelGroup.position.set(bx, by, bz);
      barrelGroup.userData = { sig: SIG, obstacleId: `barrel_${i}`, type: 'barrel_orange' };
      this.group.add(barrelGroup);

      this.obstacles.push({
        id: `barrel_${i}`,
        type: 'barrel_orange',
        x: bx, z: bz,
        radius: 0.6,
        height: 1.1,
        name: 'Baril de chantier MTQ orange',
        damagePoints: 8,
        mesh: barrelGroup,
      });
    }
  }

  // ─── NIDS-DE-POULE ─────────────────────────────────────────────────────
  buildPotholes() {
    const zone = INCIDENT_ZONES[2];
    const [cx, cz] = zone.center;

    for (let i = 0; i < 4; i++) {
      // 🔧 BOOST : PRNG déterministe au lieu de Math.random()
      const hx = cx + (i - 2) * 8 + (this._rng() - 0.5) * 4;
      const hz = cz + (this._rng() - 0.5) * 6;
      const hy = resolveY(this._terrain, hx, hz) + 0.02;

      const r = 0.85 + this._rng() * 0.4;
      const holeMesh = new THREE.Mesh(new THREE.CircleGeometry(r, 8), M.pothole());
      holeMesh.rotateX(-Math.PI / 2);
      holeMesh.position.set(hx, hy, hz);
      holeMesh.userData = { sig: SIG, obstacleId: `pothole_${i}`, type: 'pothole' };
      this.group.add(holeMesh);

      this.obstacles.push({
        id: `pothole_${i}`,
        type: 'pothole',
        x: hx, z: hz,
        radius: 0.9,
        height: 0.2,
        name: 'Nid-de-poule québécois profond',
        damagePoints: 15,
        mesh: holeMesh,
      });
    }
  }

  // ─── API PUBLIQUE ──────────────────────────────────────────────────────

  /** Branche un kernel TROXT⬡ après construction */
  attachKernel(kernel) {
    this._kernel = kernel;
    return this;
  }

  /** Obstacles filtrés par type (ex: 'pothole') */
  getObstaclesByType(type) {
    return this.obstacles.filter((o) => o.type === type);
  }

  /** Obstacles dans une zone circulaire (pour UI minimap) */
  getObstaclesInRadius(x, z, radius) {
    const r2 = radius * radius;
    return this.obstacles.filter((o) => {
      const dx = o.x - x, dz = o.z - z;
      return dx * dx + dz * dz <= r2;
    });
  }

  /** Détecte quel obstacle le joueur vient de heurter (raycast logique) */
  findCollision(x, z, extraRadius = 1.4) {
    for (const o of this.obstacles) {
      const dx = x - o.x, dz = z - o.z;
      if (Math.hypot(dx, dz) < extraRadius + o.radius) return o;
    }
    return null;
  }

  /** Stats pour debug / HUD */
  getStats() {
    const byType = {};
    for (const o of this.obstacles) byType[o.type] = (byType[o.type] || 0) + 1;
    return {
      sig: SIG,
      total: this.obstacles.length,
      byType,
      zones: INCIDENT_ZONES.length,
    };
  }

  /** Émet un event quand un obstacle est heurté */
  reportCollision(obstacleId, payload = {}) {
    this._kernel?.emit?.('troxtworld:incident', {
      obstacleId,
      ...payload,
    });
  }

  /** Libère les géométries créées par CETTE instance (matériaux = module-level) */
  dispose() {
    this.group.traverse((child) => {
      if (child.isMesh && child.geometry) child.geometry.dispose();
    });
    if (this.group.parent) this.group.parent.remove(this.group);
    this.obstacles = [];
  }
}

// ─── SINGLETON (optionnel) ─────────────────────────────────────────────────
export let roadIncidentSystem = null;

/**
 * Crée (ou remplace) le singleton global avec le terrain provider de ton choix.
 * @param {object} [options]
 */
export function initRoadIncidentSystem(options = {}) {
  if (roadIncidentSystem) roadIncidentSystem.dispose();
  roadIncidentSystem = new RoadIncidentSystem(options);
  return roadIncidentSystem;
}

export { SIG };
export default RoadIncidentSystem;
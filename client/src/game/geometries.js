/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/GEOMETRIES.JS (v3.1 Platinum Edition · boosted)
 * Usine de Géométries Procédurales & Pool d'Instanciation Virtuel
 * ═══════════════════════════════════════════════════════════════════
 * Boost v3.1 — correctifs :
 *   • instanceColor initialisé à blanc (1,1,1) au lieu de noir
 *   • capsule : hauteur de pivot = h + 2r (au lieu de h)
 *   • randomPositions / randomColor : rng injectable (défaut Math.random)
 *   • InstanceAnimator : zéro allocation par frame (quaternion temporaire)
 *   • set() : couleur effacée si absente (via _clearColor)
 *   • disposeGeos() : reset hits/misses documenté
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/geometries.js
 */

import * as THREE from "three";

const SIG = 'TROXT⬡';

// ─── JSDOC DOCUMENTATION DES TYPES (Autocomplétion) ─────────────────────────

/**
 * @typedef {('box'|'sphere'|'hemisphere'|'cylinder'|'plane'|'torus'|'ring'|'cone'|'capsule'|'wedge'|'pyramid'|'tetra'|'octa'|'dodeca'|'icosa'|'arch')} GeoKind
 * @typedef {('center'|'bottom'|'top')} PivotAlignment
 *
 * @typedef {object} GeoParams
 * @property {number} [w] - Largeur (width)
 * @property {number} [h] - Hauteur (height)
 * @property {number} [d] - Profondeur (depth)
 * @property {number} [r] - Rayon primaire (radius)
 * @property {number} [r2] - Rayon secondaire (radius2)
 * @property {number} [tube] - Diamètre du tube (Torus/Arch)
 * @property {number} [seg] - Segments horizontaux
 * @property {number} [segH] - Segments verticaux
 * @property {boolean} [open] - Extrémités ouvertes (Cylinder)
 * @property {PivotAlignment} [pivot='center'] - Alignement du pivot
 *
 * @typedef {object} TransformData
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {THREE.Euler|THREE.Quaternion|number} [rot] - Rotation (Euler, Quaternion ou lacet en radians)
 * @property {number} [sx=1] - Échelle X
 * @property {number} [sy=1] - Échelle Y
 * @property {number} [sz=1] - Échelle Z
 * @property {THREE.ColorRepresentation} [color] - Couleur de l'instance
 */

// ═══════════════════════════════════════════════════════════════════════════
// CACHE DE GÉOMÉTRIES (LRU EVICTION)
// ═══════════════════════════════════════════════════════════════════════════

const MAX_CACHE_SIZE = 512;
const cache = new Map();
const accessOrder = [];
let hits = 0;
let misses = 0;

function normalizeParams(kind, p) {
  const w = Math.round((p.w ?? 1) * 1000) / 1000;
  const h = Math.round((p.h ?? 1) * 1000) / 1000;
  const d = Math.round((p.d ?? 1) * 1000) / 1000;
  const seg = p.seg ?? (kind === "box" || kind === "plane" || kind === "wedge" ? 1 : 12);
  const segH = p.segH ?? Math.max(6, Math.floor(seg / 2));
  const open = !!p.open;
  const pivot = p.pivot ?? "center";

  let r = p.r ?? 1;
  let r2 = p.r2 ?? r;
  const tube = p.tube ?? 0.22;

  if (kind === "cylinder") {
    r = p.r ?? 0.5;
    r2 = p.r2 ?? r;
  } else if (kind === "ring") {
    r = p.r ?? 1;
    r2 = p.r2 ?? r * 0.4;
  }

  return { w, h, d, r, r2, tube, seg, segH, open, pivot };
}

function generateKey(kind, n) {
  return `${kind}|${n.w}|${n.h}|${n.d}|${n.r}|${n.r2}|${n.tube}|${n.seg}|${n.segH}|${n.open ? 1 : 0}|${n.pivot}`;
}

function touchCache(key) {
  const idx = accessOrder.indexOf(key);
  if (idx !== -1) accessOrder.splice(idx, 1);
  accessOrder.push(key);
}

function evictIfNeeded() {
  while (cache.size > MAX_CACHE_SIZE && accessOrder.length > 0) {
    const oldest = accessOrder.shift();
    const geo = cache.get(oldest);
    if (geo) {
      geo.dispose();
      cache.delete(oldest);
    }
  }
}

// ─── GÉOMÉTRIES EXTENDUES PROCÉDURALES ───────────────────────────────────────

function createWedgeGeometry(w, h, d) {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;

  const vertices = new Float32Array([
    -hw, -hh,  hd,   hw, -hh,  hd,  -hw,  hh,  hd,
     hw, -hh, -hd,  -hw, -hh, -hd,  -hw,  hh, -hd,
    -hw, -hh, -hd,   hw, -hh, -hd,   hw, -hh,  hd,
    -hw, -hh, -hd,   hw, -hh,  hd,  -hw, -hh,  hd,
    -hw,  hh, -hd,  -hw,  hh,  hd,   hw, -hh,  hd,
    -hw,  hh, -hd,   hw, -hh,  hd,   hw, -hh, -hd,
    -hw, -hh, -hd,  -hw, -hh,  hd,  -hw,  hh,  hd,
    -hw, -hh, -hd,  -hw,  hh,  hd,  -hw,  hh, -hd,
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

function createArchGeometry(r, tube, h, seg) {
  const geo = new THREE.TorusGeometry(r, tube, 8, seg, Math.PI);
  geo.rotateZ(Math.PI);
  geo.rotateY(Math.PI / 2);
  geo.scale(1, h / (r * 2), 1);
  return geo;
}

function buildGeometry(kind, n) {
  let geo;

  switch (kind) {
    case "box":        geo = new THREE.BoxGeometry(n.w, n.h, n.d); break;
    case "sphere":     geo = new THREE.SphereGeometry(n.r, n.seg, n.segH); break;
    case "hemisphere": geo = new THREE.SphereGeometry(n.r, n.seg, n.segH, 0, Math.PI * 2, 0, Math.PI / 2); break;
    case "cylinder":   geo = new THREE.CylinderGeometry(n.r, n.r2, n.h, n.seg, 1, n.open); break;
    case "plane":      geo = new THREE.PlaneGeometry(n.w, n.h); break;
    case "torus":      geo = new THREE.TorusGeometry(n.r, n.tube, 8, n.seg); break;
    case "ring":       geo = new THREE.RingGeometry(n.r2, n.r, n.seg); break;
    case "cone":       geo = new THREE.ConeGeometry(n.r, n.h, n.seg); break;
    case "capsule":    geo = new THREE.CapsuleGeometry(n.r, n.h, 4, n.seg); break;
    case "wedge":      geo = createWedgeGeometry(n.w, n.h, n.d); break;
    case "pyramid":    geo = new THREE.ConeGeometry(n.r, n.h, 4); break;
    case "arch":       geo = createArchGeometry(n.r, n.tube, n.h, n.seg); break;
    case "tetra":      geo = new THREE.TetrahedronGeometry(n.r, 0); break;
    case "octa":       geo = new THREE.OctahedronGeometry(n.r, 0); break;
    case "dodeca":     geo = new THREE.DodecahedronGeometry(n.r, 0); break;
    case "icosa":      geo = new THREE.IcosahedronGeometry(n.r, 0); break;
    default:           geo = new THREE.BoxGeometry(1, 1, 1);
  }

  // 🔧 BOOST : capsule ajoutée (hauteur totale = h + 2r)
  const height =
    kind === "sphere" || kind === "hemisphere" || kind === "tetra" || kind === "octa" ||
    kind === "dodeca" || kind === "icosa"
      ? n.r * 2
      : kind === "capsule"
      ? n.h + n.r * 2
      : kind === "torus" || kind === "ring" || kind === "arch"
      ? n.r * 2
      : n.h;

  if (n.pivot === "bottom")      geo.translate(0,  height / 2, 0);
  else if (n.pivot === "top")    geo.translate(0, -height / 2, 0);

  return geo;
}

/**
 * Récupère une géométrie mise en cache (LRU eviction).
 * ⚠️ La géométrie retournée est PARTAGÉE : ne la mute jamais (translate, rotate, scale).
 * @param {GeoKind} kind
 * @param {GeoParams} [p={}]
 * @returns {THREE.BufferGeometry}
 */
export function getGeo(kind, p = {}) {
  const norm = normalizeParams(kind, p);
  const k = generateKey(kind, norm);

  const existing = cache.get(k);
  if (existing) { hits++; touchCache(k); return existing; }

  misses++;
  const geo = buildGeometry(kind, norm);
  cache.set(k, geo);
  touchCache(k);
  evictIfNeeded();
  return geo;
}

export function geoStats() {
  const total = hits + misses;
  return {
    cachedGeometries: cache.size,
    maxCached: MAX_CACHE_SIZE,
    hits,
    misses,
    hitRate: total ? `${((hits / total) * 100).toFixed(1)}%` : "0%",
  };
}

export function disposeGeos() {
  cache.forEach((g) => g.dispose());
  cache.clear();
  accessOrder.length = 0;
  hits = 0;
  misses = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS DE POSITIONNEMENT GÉOMÉTRIQUE SPATIAL
// ═══════════════════════════════════════════════════════════════════════════

export function gridPositions(countX, countZ, spacingX, spacingZ, center = new THREE.Vector3()) {
  const positions = [];
  const offsetX = (countX - 1) * spacingX * 0.5;
  const offsetZ = (countZ - 1) * spacingZ * 0.5;

  for (let ix = 0; ix < countX; ix++) {
    for (let iz = 0; iz < countZ; iz++) {
      positions.push({
        x: center.x + ix * spacingX - offsetX,
        y: center.y,
        z: center.z + iz * spacingZ - offsetZ,
      });
    }
  }
  return positions;
}

export function circlePositions(count, radius, center = new THREE.Vector3(), startAngle = 0) {
  const positions = [];
  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = startAngle + i * angleStep;
    positions.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y,
      z: center.z + Math.sin(angle) * radius,
    });
  }
  return positions;
}

export function spiralPositions(count, startRadius, growth, center = new THREE.Vector3(), anglePerStep = Math.PI / 6) {
  const positions = [];

  for (let i = 0; i < count; i++) {
    const r = startRadius + i * growth;
    const angle = i * anglePerStep;
    positions.push({
      x: center.x + Math.cos(angle) * r,
      y: center.y,
      z: center.z + Math.sin(angle) * r,
    });
  }
  return positions;
}

// 🔧 BOOST : rng injectable pour déterministe (replay/save/load)
export function randomPositions(count, minX, maxX, minZ, maxZ, y = 0, rng = Math.random) {
  const positions = [];
  const dx = maxX - minX;
  const dz = maxZ - minZ;

  for (let i = 0; i < count; i++) {
    positions.push({
      x: minX + rng() * dx,
      y,
      z: minZ + rng() * dz,
    });
  }
  return positions;
}

export function linePositions(count, spacing, start = new THREE.Vector3(), direction = "x") {
  const positions = [];

  for (let i = 0; i < count; i++) {
    const offset = i * spacing;
    positions.push({
      x: start.x + (direction === "x" ? offset : 0),
      y: start.y + (direction === "y" ? offset : 0),
      z: start.z + (direction === "z" ? offset : 0),
    });
  }
  return positions;
}

// ─── PALETTES DE COULEURS PRÉDÉFINIES ────────────────────────────────────────

export const COLOR_PALETTES = Object.freeze({
  urban:      Object.freeze([0x2d3748, 0x4a5568, 0x718096, 0xa0aec0, 0xe2e8f0]),
  concrete:   Object.freeze([0x808080, 0x9a9a9a, 0xb3b3b3, 0xcfcfcf, 0xe8e8e8]),
  nature:     Object.freeze([0x2d5016, 0x4a7c2c, 0x7ba447, 0xa8d67a, 0xd4edbc]),
  forest:     Object.freeze([0x1a2e0a, 0x2d5016, 0x3d6b1f, 0x4a7c2c, 0x5a8c3c]),
  industrial: Object.freeze([0x1a202c, 0x2d3748, 0x4a5568, 0x718096, 0xa0aec0]),
  warm:       Object.freeze([0xc53030, 0xdd6b20, 0xecc94b, 0x48bb78, 0x4299e1]),
  cool:       Object.freeze([0x2b6cb0, 0x3182ce, 0x4299e1, 0x63b3ed, 0x90cdf4]),
  neon:       Object.freeze([0xff006e, 0xfb5607, 0xffbe0b, 0x8338ec, 0x3a86ff]),
  gta:        Object.freeze([0xff5e3a, 0x00a8e8, 0xf9d423, 0x00d9a3, 0xff006e]),
  monochrome: Object.freeze([0x1a202c, 0x2d3748, 0x4a5568, 0x718096, 0xa0aec0, 0xe2e8f0]),
  qc_autumn:  Object.freeze([0x8b2500, 0xc44536, 0xe88f2a, 0xf7b267, 0xf2d0a9]),
  qc_winter:  Object.freeze([0xd1e8ff, 0xa5c4e0, 0x7a9ec0, 0x4d7899, 0x2a5373]),
});

// 🔧 BOOST : rng injectable
export function randomColor(palette, rng = Math.random) {
  const colors = COLOR_PALETTES[palette];
  if (!colors) return 0xffffff;
  return colors[Math.floor(rng() * colors.length)];
}

export function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

// ─── COULEURS DE RAMPES ET TRANSITIONS (EASING) ─────────────────────────────

export const Easing = Object.freeze({
  linear:        (t) => t,
  easeInQuad:    (t) => t * t,
  easeOutQuad:   (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic:   (t) => t * t * t,
  easeOutCubic:  (t) => --t * t * t + 1,
  easeInOutCubic:(t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInExpo:    (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo:   (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutBounce: (t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
//  SÉCURITÉ D'INSTANCIATION MASSIF : InstancePool (Zero-Allocation)
// ═══════════════════════════════════════════════════════════════════════════

const _dummyObj   = new THREE.Object3D();
const _colorObj   = new THREE.Color();
const _matrixObj  = new THREE.Matrix4();
const _vector3Obj = new THREE.Vector3();
const _quatObj    = new THREE.Quaternion();
const _scaleObj   = new THREE.Vector3();
// 🔧 BOOST : quaternion temporaire pour InstanceAnimator (zéro alloc/frame)
const _animQuat   = new THREE.Quaternion();

export class InstancePool {
  /**
   * @param {THREE.BufferGeometry} geo
   * @param {THREE.Material | THREE.Material[]} mat
   * @param {number} [max=256]
   * @param {boolean} [frustumCulled=false]
   */
  constructor(geo, mat, max = 256, frustumCulled = false) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    this.mesh.frustumCulled = frustumCulled;

    this._count = 0;
    this.ids = new Map();
    this.indexToId = new Array(max);
    this.metadata = new Map();

    this.minDirty = Infinity;
    this.maxDirty = -1;
    this.minColorDirty = Infinity;
    this.maxColorDirty = -1;
  }

  get count() { return this._count; }

  get stats() {
    return {
      instances: this._count,
      capacity:  this.max,
      usage:     `${((this._count / this.max) * 100).toFixed(1)}%`,
      colors:    !!this.mesh.instanceColor,
    };
  }

  has(id) { return this.ids.has(id); }
  getId(index) { return this.indexToId[index]; }

  resolveIntersection(hit) {
    if (hit.object !== this.mesh || hit.instanceId === undefined) return null;
    return this.getId(hit.instanceId) || null;
  }

  getMetadata(id) { return this.metadata.get(id); }

  // 🔧 BOOST : buffer couleur initialisé à BLANC (1,1,1) au lieu de 0 (noir)
  _ensureColorBuffer() {
    if (!this.mesh.instanceColor) {
      const arr = new Float32Array(this.max * 3);
      arr.fill(1); // white — sinon instances sans couleur rendent en noir
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(arr, 3);
    }
    return this.mesh.instanceColor;
  }

  set(id, transform, metadata = null, autoFlush = true) {
    let idx = this.ids.get(id);

    if (idx === undefined) {
      if (this._count >= this.max) {
        console.warn(`[${SIG}·Pool] Capacité maximale atteinte (${this.max}) : suppression refusée pour ${id}`);
        return -1;
      }
      idx = this._count;
      this.ids.set(id, idx);
      this.indexToId[idx] = id;
      this._count++;
      this.mesh.count = this._count;
    }

    this._applyTransform(idx, transform);
    this._markMatrixDirty(idx);

    if (metadata) this.metadata.set(id, metadata);

    if (autoFlush) this.flush();
    return idx;
  }

  setBatch(entries) {
    let added = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const idx = this.set(entry.id, entry.transform, entry.metadata, false);
      if (idx >= 0) added++;
    }
    this.flush();
    return added;
  }

  remove(id, autoFlush = true) {
    const idx = this.ids.get(id);
    if (idx === undefined) return false;

    const lastIdx = this._count - 1;

    if (idx !== lastIdx) {
      const lastId = this.indexToId[lastIdx];

      this.mesh.getMatrixAt(lastIdx, _matrixObj);
      this.mesh.setMatrixAt(idx, _matrixObj);
      this._markMatrixDirty(idx);

      if (this.mesh.instanceColor) {
        this.mesh.getColorAt(lastIdx, _colorObj);
        this.mesh.setColorAt(idx, _colorObj);
        this._markColorDirty(idx);
      }

      this.ids.set(lastId, idx);
      this.indexToId[idx] = lastId;

      const lastMeta = this.metadata.get(lastId);
      if (lastMeta) {
        this.metadata.set(id, lastMeta);
        this.metadata.delete(lastId);
      }
    }

    this.ids.delete(id);
    this.metadata.delete(id);
    this._count--;
    this.mesh.count = this._count;

    if (autoFlush) this.flush();
    return true;
  }

  setColor(id, color, autoFlush = true) {
    const idx = this.ids.get(id);
    if (idx === undefined) return false;

    this._ensureColorBuffer(); // 🔧 BOOST
    _colorObj.set(color);
    this.mesh.setColorAt(idx, _colorObj);
    this._markColorDirty(idx);

    if (autoFlush) this.flush();
    return true;
  }

  setColors(colorsMap) {
    if (colorsMap.size === 0) return;

    this._ensureColorBuffer(); // 🔧 BOOST

    for (const [id, color] of colorsMap) {
      const idx = this.ids.get(id);
      if (idx !== undefined) {
        _colorObj.set(color);
        this.mesh.setColorAt(idx, _colorObj);
        this._markColorDirty(idx);
      }
    }

    this.flush();
  }

  // 🔧 BOOST : permet de revenir au blanc (retirer une couleur)
  clearColor(id, autoFlush = true) {
    const idx = this.ids.get(id);
    if (idx === undefined) return false;
    this._ensureColorBuffer();
    this.mesh.setColorAt(idx, new THREE.Color(1, 1, 1));
    this._markColorDirty(idx);
    if (autoFlush) this.flush();
    return true;
  }

  getPosition(id, out = new THREE.Vector3()) {
    const idx = this.ids.get(id);
    if (idx === undefined) return null;

    this.mesh.getMatrixAt(idx, _matrixObj);
    _matrixObj.decompose(out, _quatObj, _scaleObj);
    return out;
  }

  _markMatrixDirty(idx) {
    this.minDirty = Math.min(this.minDirty, idx);
    this.maxDirty = Math.max(this.maxDirty, idx);
  }

  _markColorDirty(idx) {
    this.minColorDirty = Math.min(this.minColorDirty, idx);
    this.maxColorDirty = Math.max(this.maxColorDirty, idx);
  }

  _applyTransform(idx, t) {
    _dummyObj.position.set(t.x, t.y, t.z);

    if (t.rot instanceof THREE.Quaternion) {
      _dummyObj.quaternion.copy(t.rot);
    } else if (t.rot instanceof THREE.Euler) {
      _dummyObj.rotation.copy(t.rot);
    } else if (typeof t.rot === "number") {
      _dummyObj.rotation.set(0, t.rot, 0);
    } else {
      _dummyObj.rotation.set(0, 0, 0);
    }

    _dummyObj.scale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
    _dummyObj.updateMatrix();

    this.mesh.setMatrixAt(idx, _dummyObj.matrix);

    if (t.color !== undefined) {
      this.setColor(this.indexToId[idx], t.color, false);
    }
  }

  flush() {
    if (this.maxDirty >= 0) {
      const offset = this.minDirty * 16;
      const count  = (this.maxDirty - this.minDirty + 1) * 16;

      const matrixAttr = this.mesh.instanceMatrix;
      if (matrixAttr.updateRanges !== undefined) {
        matrixAttr.updateRanges = [{ start: offset, count }];
      } else if (matrixAttr.updateRange !== undefined) {
        matrixAttr.updateRange = { offset, count };
      }

      this.mesh.instanceMatrix.needsUpdate = true;
      this.minDirty = Infinity;
      this.maxDirty = -1;
    }

    if (this.mesh.instanceColor && this.maxColorDirty >= 0) {
      const offset = this.minColorDirty * 3;
      const count  = (this.maxColorDirty - this.minColorDirty + 1) * 3;

      const colorAttr = this.mesh.instanceColor;
      if (colorAttr.updateRanges !== undefined) {
        colorAttr.updateRanges = [{ start: offset, count }];
      } else if (colorAttr.updateRange !== undefined) {
        colorAttr.updateRange = { offset, count };
      }

      this.mesh.instanceColor.needsUpdate = true;
      this.minColorDirty = Infinity;
      this.maxColorDirty = -1;
    }
  }

  updateBoundingVolumes() {
    this.mesh.computeBoundingBox();
    this.mesh.computeBoundingSphere();
    this.mesh.frustumCulled = true;
  }

  clear() {
    this._count = 0;
    this.mesh.count = 0;
    this.ids.clear();
    this.metadata.clear();
    this.minDirty = Infinity;
    this.maxDirty = -1;
    this.flush();
  }

  dispose() {
    this.clear();
    this.mesh.dispose();
  }

  exportState() {
    const instances = [];

    for (let i = 0; i < this._count; i++) {
      const id = this.indexToId[i];
      if (!id) continue;

      this.mesh.getMatrixAt(i, _matrixObj);
      const matrix = Array.from(_matrixObj.elements);

      let color;
      if (this.mesh.instanceColor) {
        this.mesh.getColorAt(i, _colorObj);
        color = [_colorObj.r, _colorObj.g, _colorObj.b];
      }

      const meta = this.metadata.get(id);
      instances.push({ id, matrix, color, metadata: meta });
    }

    return { instances };
  }

  importState(state) {
    this.clear();
    const list = state?.instances || [];

    for (let i = 0; i < list.length; i++) {
      if (this._count >= this.max) break;

      const inst = list[i];
      const idx = this._count;
      this.ids.set(inst.id, idx);
      this.indexToId[idx] = inst.id;

      _matrixObj.fromArray(inst.matrix);
      this.mesh.setMatrixAt(idx, _matrixObj);

      if (inst.color) {
        this._ensureColorBuffer(); // 🔧 BOOST
        _colorObj.setRGB(inst.color[0], inst.color[1], inst.color[2]);
        this.mesh.setColorAt(idx, _colorObj);
      }

      if (inst.metadata) this.metadata.set(inst.id, inst.metadata);

      this._count++;
    }

    this.mesh.count = this._count;
    this.flush();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ANIMATEUR D'INSTANCES (Slerp Interpolations)
// ═══════════════════════════════════════════════════════════════════════════

export class InstanceAnimator {
  constructor(pool) {
    this.pool = pool;
    this.animations = new Map();
  }

  animate(id, endTransform, duration, easing = Easing.easeInOutCubic, onComplete = undefined) {
    const idx = this.pool.ids.get(id);
    if (idx === undefined) return false;

    this.pool.mesh.getMatrixAt(idx, _matrixObj);
    _matrixObj.decompose(_vector3Obj, _quatObj, _scaleObj);

    const endPos   = new THREE.Vector3(endTransform.x, endTransform.y, endTransform.z);
    const endScale = new THREE.Vector3(endTransform.sx ?? 1, endTransform.sy ?? 1, endTransform.sz ?? 1);
    const endRot   = new THREE.Quaternion();

    if (endTransform.rot instanceof THREE.Quaternion) {
      endRot.copy(endTransform.rot);
    } else if (endTransform.rot instanceof THREE.Euler) {
      endRot.setFromEuler(endTransform.rot);
    } else if (typeof endTransform.rot === "number") {
      endRot.setFromEuler(new THREE.Euler(0, endTransform.rot, 0));
    }

    this.animations.set(id, {
      startTime:  performance.now(),
      duration,
      startPos:   _vector3Obj.clone(),
      endPos,
      startRot:   _quatObj.clone(),
      endRot,
      startScale: _scaleObj.clone(),
      endScale,
      easing,
      onComplete,
    });

    return true;
  }

  // 🔧 BOOST : zéro allocation par frame (quaternion temporaire partagé)
  update() {
    if (this.animations.size === 0) return false;

    const now = performance.now();
    const toRemove = [];
    let dirty = false;

    for (const [id, anim] of this.animations) {
      const elapsed = now - anim.startTime;
      const t = Math.min(elapsed / anim.duration, 1);
      const e = anim.easing(t);

      const x = anim.startPos.x + (anim.endPos.x - anim.startPos.x) * e;
      const y = anim.startPos.y + (anim.endPos.y - anim.startPos.y) * e;
      const z = anim.startPos.z + (anim.endPos.z - anim.startPos.z) * e;

      // 🔧 BOOST : _animQuat partagé au lieu de new THREE.Quaternion() par frame
      _animQuat.slerpQuaternions(anim.startRot, anim.endRot, e);

      const sx = anim.startScale.x + (anim.endScale.x - anim.startScale.x) * e;
      const sy = anim.startScale.y + (anim.endScale.y - anim.startScale.y) * e;
      const sz = anim.startScale.z + (anim.endScale.z - anim.startScale.z) * e;

      this.pool.set(id, { x, y, z, rot: _animQuat, sx, sy, sz }, null, false);
      dirty = true;

      if (t >= 1) {
        toRemove.push(id);
        if (anim.onComplete) { try { anim.onComplete(); } catch (_) { /* ignore */ } }
      }
    }

    for (let i = 0; i < toRemove.length; i++) this.animations.delete(toRemove[i]);

    if (dirty) this.pool.flush();
    return dirty;
  }

  get isActive() { return this.animations.size > 0; }
  get activeCount() { return this.animations.size; }
  stop(id) { return this.animations.delete(id); }
  clear() { this.animations.clear(); }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES & LISTE DES PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

export const GEO_KINDS = Object.freeze([
  "box", "sphere", "hemisphere", "cylinder", "plane", "torus", "ring",
  "cone", "capsule", "wedge", "pyramid", "arch", "tetra", "octa", "dodeca", "icosa",
]);

export default getGeo;
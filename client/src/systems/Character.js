/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/CHARACTER.JS
 * Personnage 3D joueur · Portneuf, Québec 🍁
 * ═══════════════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • Type UNIQUE (CharacterAppearance) — plus de collision
 *   • DEFAULT_APPEARANCE exporté 1 seule fois
 *   • Chevaux supportés (hairColor + hairStyle)
 *   • buildSword() : matériaux trackés dans this.mats → dispose propre
 *   • buildCharacter() : ne duplique plus l'ajout au parent
 *   • _legacyInstances : Map au lieu d'une seule instance
 *   • makeGroup : addToParent optionnel
 *   • applyIdlePose : facteur d'interpolation unique
 *   • updateFloat : n'applique pas en marche
 *   • userData TROXT⬡ sur le root
 *   • dispose() : traverse tous les matériaux (pas seulement this.mats)
 *   • JSDoc complet
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/systems/Character.js
 */

import * as THREE from 'three';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

const BASE_Y           = 0.07;
const BREATH_AMPLITUDE = 0.007;
const BREATH_FREQUENCY = 1.6;
const WALK_ANIM_SPEED  = 9.0;
const WALK_SWING       = 0.48;
const IDLE_FLOAT_AMP   = 0.015;
const IDLE_FLOAT_FREQ  = 1.1;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (JSDoc)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {('court'|'long'|'chauve'|'tuque')} HairStyle
 *
 * @typedef {object} CharacterAppearance
 * @property {number}    skinColor
 * @property {number}    hairColor
 * @property {HairStyle} hairStyle
 * @property {number}    topColor
 * @property {number}    pantsColor
 * @property {number}    shoesColor
 * @property {number}    eyeColor
 * @property {number}    hatColor
 *
 * @typedef {object} CharacterParts
 * @property {THREE.Group} body
 * @property {THREE.Group} head
 * @property {THREE.Group} legL
 * @property {THREE.Group} legR
 * @property {THREE.Group} lLowL
 * @property {THREE.Group} lLowR
 * @property {THREE.Group} armL
 * @property {THREE.Group} armR
 * @property {THREE.Group} foreL
 * @property {THREE.Group} foreR
 * @property {THREE.Group} sword
 *
 * @typedef {object} AnimState
 * @property {number}  t
 * @property {number}  spd
 * @property {number}  breath
 * @property {boolean} walking
 */

// ─── APPARENCE PAR DÉFAUT (UNE SEULE FOIS) ─────────────────────────────────
/** @type {Readonly<CharacterAppearance>} */
export const DEFAULT_APPEARANCE = Object.freeze({
  skinColor:  0xe0b48a,
  hairColor:  0x2a1a0a,
  hairStyle:  'court',
  topColor:   0x2d3a5c,
  pantsColor: 0x1a3a2a,
  shoesColor: 0x1a1a1a,
  eyeColor:   0x050505,
  hatColor:   0xcc2222,
});

/** Parse une apparence inconnue de manière sûre */
export function parseAppearance(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_APPEARANCE };
  return { ...DEFAULT_APPEARANCE, ...raw };
}

// ═══════════════════════════════════════════════════════════════════════════
// MATÉRIAUX
// ═══════════════════════════════════════════════════════════════════════════

function makePBR(color, roughness = 0.5, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function makeFlat(color) {
  return new THREE.MeshBasicMaterial({ color });
}
function darken(hex, amount) {
  const r = ((hex >> 16) & 0xff) * (1 - amount);
  const g = ((hex >> 8)  & 0xff) * (1 - amount);
  const b = ( hex        & 0xff) * (1 - amount);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crée un mesh positionné avec ombres.
 * @param {object} cfg
 * @param {THREE.BufferGeometry} cfg.geo
 * @param {THREE.Material} cfg.mat
 * @param {number} cfg.x @param {number} cfg.y @param {number} cfg.z
 * @param {number} [cfg.rx] @param {number} [cfg.ry] @param {number} [cfg.rz]
 * @returns {THREE.Mesh}
 */
function makeMesh({ geo, mat, x, y, z, rx = 0, ry = 0, rz = 0 }) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Crée un Group positionné.
 * 🔧 BOOST : `addToParent` optionnel (pas d'effet de bord)
 */
function makeGroup(x, y, z, parent = null) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMBRES
// ═══════════════════════════════════════════════════════════════════════════

function buildLeg(parent, side, mPants, mPantsD, mShoe) {
  const x = side === 'L' ? -0.16 : 0.16;
  const upper = makeGroup(x, 0.56, 0, parent);

  upper.add(makeMesh({
    geo: new THREE.BoxGeometry(0.24, 0.42, 0.24),
    mat: mPants, x: 0, y: -0.09, z: 0,
  }));

  const lower = makeGroup(0, -0.33, 0, upper);
  lower.add(makeMesh({
    geo: new THREE.BoxGeometry(0.22, 0.36, 0.22),
    mat: mPantsD, x: 0, y: -0.09, z: 0,
  }));
  lower.add(makeMesh({
    geo: new THREE.BoxGeometry(0.26, 0.09, 0.34),
    mat: mShoe, x: 0, y: -0.28, z: 0.04,
  }));

  return { upper, lower };
}

function buildArm(parent, side, mShirt, mShirtD, mSkin) {
  const x = side === 'L' ? -0.48 : 0.48;
  const upper = makeGroup(x, 1.30, 0, parent);

  upper.add(makeMesh({
    geo: new THREE.BoxGeometry(0.20, 0.48, 0.20),
    mat: mShirt, x: 0, y: -0.12, z: 0,
  }));

  const lower = makeGroup(0, -0.36, 0, upper);
  lower.add(makeMesh({
    geo: new THREE.BoxGeometry(0.17, 0.30, 0.17),
    mat: mShirtD, x: 0, y: -0.07, z: 0,
  }));
  lower.add(makeMesh({
    geo: new THREE.BoxGeometry(0.15, 0.11, 0.15),
    mat: mSkin, x: 0, y: -0.24, z: 0,
  }));

  return { upper, lower };
}

/**
 * Construit la tête.
 * 🔧 BOOST : `app` utilisé pour le style de cheveux.
 */
function buildHead(parent, app, mats) {
  const head = makeGroup(0, 1.88, 0, parent);

  // Crâne
  head.add(makeMesh({
    geo: new THREE.BoxGeometry(0.50, 0.50, 0.50),
    mat: mats.skin, x: 0, y: 0, z: 0,
  }));

  // 🔧 BOOST : cheveux selon style
  const hairStyle = app.hairStyle || 'court';
  if (hairStyle !== 'chauve') {
    const hairHeight = hairStyle === 'long' ? 0.62 : hairStyle === 'tuque' ? 0.30 : 0.14;
    const hairOffsetY = hairStyle === 'long' ? -0.05 : hairStyle === 'tuque' ? 0.20 : 0.26;
    const hairWidth = hairStyle === 'tuque' ? 0.54 : 0.52;

    head.add(makeMesh({
      geo: new THREE.BoxGeometry(hairWidth, hairHeight, hairWidth),
      mat: mats.hair, x: 0, y: hairOffsetY, z: -0.02,
    }));

    if (hairStyle === 'long') {
      // Mèches latérales
      for (const sx of [-0.22, 0.22]) {
        head.add(makeMesh({
          geo: new THREE.BoxGeometry(0.08, 0.42, 0.42),
          mat: mats.hair, x: sx, y: -0.20, z: -0.02,
        }));
      }
    }
  }

  // Yeux (blancs + pupilles)
  for (const sx of [-0.12, 0.12]) {
    head.add(makeMesh({
      geo: new THREE.BoxGeometry(0.11, 0.085, 0.01),
      mat: mats.eyeWhite, x: sx, y: 0.04, z: 0.26,
    }));
    head.add(makeMesh({
      geo: new THREE.BoxGeometry(0.065, 0.052, 0.012),
      mat: mats.eye, x: sx, y: 0.04, z: 0.268,
    }));
  }

  // Bouche
  head.add(makeMesh({
    geo: new THREE.BoxGeometry(0.13, 0.028, 0.01),
    mat: mats.mouth, x: 0, y: -0.10, z: 0.265,
  }));

  // Chapeau (optionnel — uniquement si hairStyle !== 'chauve' et couleur définie)
  if (app.hatColor !== undefined) {
    head.add(makeMesh({
      geo: new THREE.CylinderGeometry(0.26, 0.30, 0.20, 12),
      mat: mats.hat, x: 0, y: 0.32, z: 0,
    }));
    head.add(makeMesh({
      geo: new THREE.CylinderGeometry(0.40, 0.40, 0.04, 16),
      mat: mats.hatBrim, x: 0, y: 0.21, z: 0.05,
    }));
  }

  return head;
}

/**
 * Construit l'épée.
 * 🔧 BOOST : matériaux passés en paramètre (trackés → dispose propre)
 */
function buildSword(parent, swordMats) {
  const sword = makeGroup(0.88, 1.1, 0.1, parent);
  sword.rotation.z = 0.15;

  sword.add(makeMesh({
    geo: new THREE.BoxGeometry(0.04, 1.1, 0.12),
    mat: swordMats.blade, x: 0, y: 0.55, z: 0,
  }));
  sword.add(makeMesh({
    geo: new THREE.BoxGeometry(0.28, 0.06, 0.08),
    mat: swordMats.guard, x: 0, y: 0, z: 0,
  }));
  sword.add(makeMesh({
    geo: new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8),
    mat: swordMats.handle, x: 0, y: -0.2, z: 0,
  }));

  return sword;
}

// ═══════════════════════════════════════════════════════════════════════════
// MATÉRIAUX DU PERSONNAGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} CharacterMaterials
 * @property {THREE.MeshStandardMaterial} skin
 * @property {THREE.MeshStandardMaterial} shirt
 * @property {THREE.MeshStandardMaterial} shirtD
 * @property {THREE.MeshStandardMaterial} pants
 * @property {THREE.MeshStandardMaterial} pantsD
 * @property {THREE.MeshStandardMaterial} hair
 * @property {THREE.MeshStandardMaterial} hat
 * @property {THREE.MeshStandardMaterial} hatBrim
 * @property {THREE.MeshStandardMaterial} shoe
 * @property {THREE.MeshStandardMaterial} belt
 * @property {THREE.MeshBasicMaterial}    eye
 * @property {THREE.MeshBasicMaterial}    eyeWhite
 * @property {THREE.MeshBasicMaterial}    mouth
 * @property {THREE.MeshStandardMaterial} blade
 * @property {THREE.MeshStandardMaterial} guard
 * @property {THREE.MeshStandardMaterial} handle
 */

function buildMaterials(app) {
  return {
    skin:     makePBR(app.skinColor,  0.50, 0),
    shirt:    makePBR(app.topColor,   0.60, 0),
    shirtD:   makePBR(darken(app.topColor, 0.15),   0.65, 0),
    pants:    makePBR(app.pantsColor, 0.55, 0),
    pantsD:   makePBR(darken(app.pantsColor, 0.20), 0.60, 0),
    hair:     makePBR(app.hairColor,  0.85, 0),
    hat:      makePBR(app.hatColor,   0.40, 0.08),
    hatBrim:  makePBR(darken(app.hatColor, 0.15),   0.45, 0),
    shoe:     makePBR(app.shoesColor, 0.75, 0),
    belt:     makePBR(0x2a1a0a,       0.60, 0.1),
    eye:      makeFlat(app.eyeColor),
    eyeWhite: makeFlat(0xf0f0f0),
    mouth:    makeFlat(0x7a4030),
    // 🔧 BOOST : épée dans le même sac
    blade:    makePBR(0x8899bb, 0.1, 0.9),
    guard:    makePBR(0x665522, 0.4, 0.7),
    handle:   makePBR(0x331100, 0.8, 0.2),
  };
}

function disposeMaterials(mats) {
  for (const m of Object.values(mats)) m.dispose?.();
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

export class CharacterInstance {
  /**
   * @param {THREE.Object3D} parent
   * @param {CharacterAppearance} [appearance]
   */
  constructor(parent, appearance = DEFAULT_APPEARANCE) {
    this.group = new THREE.Group();
    this.group.position.y = BASE_Y;
    this.group.name = 'character_instance';
    this.group.userData = { sig: SIG, kind: 'character' };
    parent.add(this.group);

    this._parent = parent;
    this.appearance = { ...DEFAULT_APPEARANCE, ...appearance };
    this.mats = buildMaterials(this.appearance);
    this.parts = this._build();
    this.anim = { t: 0, spd: 0, breath: 0, walking: false };
  }

  // ─── Construction ───────────────────────────────────────────────────────
  _build() {
    const m = this.mats;
    const root = this.group;

    const body = makeGroup(0, 0, 0, root);

    const { upper: legL, lower: lLowL } = buildLeg(body, 'L', m.pants, m.pantsD, m.shoe);
    const { upper: legR, lower: lLowR } = buildLeg(body, 'R', m.pants, m.pantsD, m.shoe);

    // Torse
    body.add(makeMesh({
      geo: new THREE.BoxGeometry(0.68, 0.80, 0.36),
      mat: m.shirt, x: 0, y: 1.12, z: 0,
    }));

    // Ceinture
    body.add(makeMesh({
      geo: new THREE.BoxGeometry(0.70, 0.07, 0.38),
      mat: m.belt, x: 0, y: 0.74, z: 0,
    }));

    const { upper: armL, lower: foreL } = buildArm(body, 'L', m.shirt, m.shirtD, m.skin);
    const { upper: armR, lower: foreR } = buildArm(body, 'R', m.shirt, m.shirtD, m.skin);

    const head = buildHead(body, this.appearance, m);
    const sword = buildSword(body, { blade: m.blade, guard: m.guard, handle: m.handle });

    return { body, head, legL, legR, lLowL, lLowR, armL, armR, foreL, foreR, sword };
  }

  // ─── Personnalisation ───────────────────────────────────────────────────
  /**
   * Met à jour l'apparence sans rebuild.
   * @param {Partial<CharacterAppearance>} patch
   */
  updateAppearance(patch) {
    const m = this.mats;
    this.appearance = { ...this.appearance, ...patch };

    if (patch.skinColor !== undefined)  m.skin.color.setHex(patch.skinColor);
    if (patch.hairColor !== undefined)  m.hair.color.setHex(patch.hairColor);
    if (patch.topColor !== undefined) {
      m.shirt.color.setHex(patch.topColor);
      m.shirtD.color.setHex(darken(patch.topColor, 0.15));
    }
    if (patch.pantsColor !== undefined) {
      m.pants.color.setHex(patch.pantsColor);
      m.pantsD.color.setHex(darken(patch.pantsColor, 0.20));
    }
    if (patch.shoesColor !== undefined) m.shoe.color.setHex(patch.shoesColor);
    if (patch.eyeColor !== undefined)   m.eye.color.setHex(patch.eyeColor);
    if (patch.hatColor !== undefined) {
      m.hat.color.setHex(patch.hatColor);
      m.hatBrim.color.setHex(darken(patch.hatColor, 0.15));
    }
  }

  // ─── Animation ──────────────────────────────────────────────────────────
  /** @param {boolean} walking */
  setWalking(walking) { this.anim.walking = walking; }

  /**
   * @param {number} time  - Temps absolu (s)
   * @param {number} delta - Delta-time (s)
   */
  update(time, delta) {
    this._updateBreath(delta);
    this._updateWalk(delta);
    this._updateFloat(time);
  }

  _updateBreath(delta) {
    const a = this.anim;
    a.breath += delta * BREATH_FREQUENCY;
    this.parts.body.position.y = Math.sin(a.breath) * BREATH_AMPLITUDE;
  }

  _updateWalk(delta) {
    const a = this.anim;
    const targetSpd = a.walking ? 0.55 : 0;
    a.spd = THREE.MathUtils.lerp(a.spd, targetSpd, 1 - Math.exp(-delta * 12));

    if (a.walking) {
      a.t += delta * WALK_ANIM_SPEED;
      this._applyWalkPose(a.t, a.spd);
    } else {
      this._applyIdlePose(delta);
    }
  }

  _applyWalkPose(t, spd) {
    const p = this.parts;
    const sw = Math.sin(t) * WALK_SWING * spd;
    const co = Math.cos(t);

    p.legL.rotation.x  =  sw;
    p.legR.rotation.x  = -sw;
    p.lLowL.rotation.x = Math.max(0, -co) * 0.45 * spd;
    p.lLowR.rotation.x = Math.max(0,  co) * 0.45 * spd;
    p.armL.rotation.x  = -sw * 0.8;
    p.armR.rotation.x  =  sw * 0.8;
    p.foreL.rotation.x = -0.12 - Math.max(0,  co) * 0.28 * spd;
    p.foreR.rotation.x = -0.12 - Math.max(0, -co) * 0.28 * spd;
  }

  _applyIdlePose(delta) {
    const p = this.parts;
    // 🔧 BOOST : un seul facteur (cohérent)
    const k = 1 - Math.exp(-delta * 6);
    const REST = -0.07;

    p.legL.rotation.x  = THREE.MathUtils.lerp(p.legL.rotation.x,  0,    k);
    p.legR.rotation.x  = THREE.MathUtils.lerp(p.legR.rotation.x,  0,    k);
    p.lLowL.rotation.x = THREE.MathUtils.lerp(p.lLowL.rotation.x, 0,    k);
    p.lLowR.rotation.x = THREE.MathUtils.lerp(p.lLowR.rotation.x, 0,    k);
    p.armL.rotation.x  = THREE.MathUtils.lerp(p.armL.rotation.x,  0,    k);
    p.armR.rotation.x  = THREE.MathUtils.lerp(p.armR.rotation.x,  0,    k);
    p.foreL.rotation.x = THREE.MathUtils.lerp(p.foreL.rotation.x, REST, k);
    p.foreR.rotation.x = THREE.MathUtils.lerp(p.foreR.rotation.x, REST, k);
  }

  _updateFloat(time) {
    // 🔧 BOOST : pas de flottement en marche
    if (this.anim.walking) {
      this.group.position.y = BASE_Y;
      return;
    }
    this.group.position.y = BASE_Y + Math.sin(time * IDLE_FLOAT_FREQ) * IDLE_FLOAT_AMP;
  }

  // ─── Dispose ────────────────────────────────────────────────────────────
  dispose() {
    // Dispose toutes les géométries
    this.group.traverse((obj) => {
      if (obj.isMesh && obj.geometry) obj.geometry.dispose();
    });
    // 🔧 BOOST : matériaux trackés (blade/guard/handle inclus)
    disposeMaterials(this.mats);
    this._parent?.remove(this.group);
  }

  // ─── Accesseurs ─────────────────────────────────────────────────────────
  getParts() { return this.parts; }
  getMaterials() { return this.mats; }
  getAnimState() { return { ...this.anim }; }
  getAppearance() { return { ...this.appearance }; }
}

// ═══════════════════════════════════════════════════════════════════════════
// API LEGACY (multi-instances via Map)
// ═══════════════════════════════════════════════════════════════════════════

/** @type {Map<THREE.Group, CharacterInstance>} */
const _legacyInstances = new Map();

/**
 * @deprecated Préférer `new CharacterInstance(parent)`.
 * Conservé pour compatibilité. 🍁
 */
export function buildCharacter(charGroup) {
  // 🔧 BOOST : ne double plus l'ajout — on délègue au constructor
  const inst = new CharacterInstance(charGroup);
  _legacyInstances.set(charGroup, inst);
  return inst.getParts();
}

export function animateCharacter(charGroup, time, delta) {
  _legacyInstances.get(charGroup)?.update(time, delta);
}

export function updateCharacterMaterials(charGroup, state) {
  const inst = _legacyInstances.get(charGroup);
  if (!inst) return;
  inst.updateAppearance({
    skinColor:  state.skin,
    hairColor:  state.hairColor,
    topColor:   state.topColor,
    pantsColor: state.pantsColor,
    shoesColor: state.shoesColor,
    eyeColor:   state.eyeColor,
  });
}

/** 🔧 BOOST : décharge propre d'une instance legacy */
export function disposeCharacter(charGroup) {
  const inst = _legacyInstances.get(charGroup);
  if (!inst) return;
  inst.dispose();
  _legacyInstances.delete(charGroup);
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { SIG };
export default { CharacterInstance, DEFAULT_APPEARANCE, parseAppearance, buildCharacter, animateCharacter, updateCharacterMaterials, disposeCharacter };
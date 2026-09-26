/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/GESTURES.JS (v3.0 Platinum Edition)
 * Système de Gestes RP, Blending d'Animations & Props Associés
 * ═══════════════════════════════════════════════════════════════════
 * Gère les postures, émotions et interactions corporelles des personnages :
 *  • 35+ gestes RP indexés et classés (social, combat, émotion, utilitaire)
 *  • Blending d'animation à interpolation douce pour des transitions fluides.
 *  • Inverse Kinematics (IK) O(1) sans allocation de mémoire pour cibler du regard/doigt.
 *  • Attachement et instanciation de props de scène (téléphone, cigarettes, verres).
 *  • Animations procédurales (respiration, balancement) sans dérive squelettique.
 *
 * Signature : TROXT⬡ · 🏃GestureMatrix
 * Chemin    : client/src/game/gestures.js
 */

import * as THREE from "three";
import { matLib } from "./materials.js";
import { getGeo } from "./geometries.js";

const SIG = 'TROXT⬡';

// ─── CONFIGURATION DU REGISTRE DES GESTES (GELÉ SÉCURISÉ) ────────────────────

/**
 * @typedef {('social'|'combat'|'emotion'|'utility'|'dance'|'vehicle'|'seated')} GestureCategory
 * @typedef {('phone'|'cigarette'|'bottle'|'cup'|'pistol'|'rifle'|'knife')} PropType
 * @typedef {('neutral'|'smile'|'frown'|'wink'|'surprise'|'angry')} FacialExpression
 *
 * @typedef {object} GestureDef
 * @property {string} id
 * @property {string} label
 * @property {string} hint
 * @property {GestureCategory} category
 * @property {string} [key]
 * @property {boolean} hold
 * @property {number} duration
 * @property {PropType} [prop]
 * @property {boolean} locksMovement
 * @property {boolean} interruptible
 * @property {number} priority
 * @property {FacialExpression} [facial]
 */

export const RP_GESTURES = Object.freeze([
  // ── Social ──
  { id: "wave", label: "Saluer", hint: "Signe de la main", category: "social", hold: false, duration: 2.6, locksMovement: false, interruptible: true, priority: 3 },
  { id: "salute", label: "Salut militaire", hint: "Respect / SQ", category: "social", hold: false, duration: 2.2, locksMovement: false, interruptible: true, priority: 3 },
  { id: "handshake", label: "Poignée de main", hint: "Accord commercial", category: "social", hold: true, duration: 0, locksMovement: true, interruptible: false, priority: 8 },
  { id: "high_five", label: "Tape dans la main", hint: "Célébration", category: "social", hold: false, duration: 1.8, locksMovement: false, interruptible: true, priority: 4 },
  { id: "fist_bump", label: "Check du poing", hint: "Salut fraternel", category: "social", hold: false, duration: 1.5, locksMovement: false, interruptible: true, priority: 4 },
  { id: "bow", label: "S'incliner", hint: "Respect formel", category: "social", hold: false, duration: 2.8, locksMovement: false, interruptible: true, priority: 5 },
  { id: "curtsy", label: "Révérence", hint: "Salut élégant", category: "social", hold: false, duration: 3.0, locksMovement: false, interruptible: true, priority: 5 },
  
  // ── Émotion ──
  { id: "laugh", label: "Rire", hint: "Joie intense", category: "emotion", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 2, facial: "smile" },
  { id: "cry", label: "Pleurer", hint: "Tristesse", category: "emotion", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 2, facial: "frown" },
  { id: "angry", label: "Colère", hint: "Frustration", category: "emotion", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 2, facial: "angry" },
  { id: "shrug", label: "Hausser épaules", hint: "Je ne sais pas", category: "emotion", hold: false, duration: 1.8, locksMovement: false, interruptible: true, priority: 2 },
  { id: "facepalm", label: "Main au front", hint: "Exaspération", category: "emotion", hold: false, duration: 2.0, locksMovement: false, interruptible: true, priority: 3, facial: "frown" },
  { id: "thumbs_up", label: "Pouce en l'air", hint: "Approbation", category: "emotion", hold: false, duration: 2.0, locksMovement: false, interruptible: true, priority: 2, facial: "smile" },
  { id: "thumbs_down", label: "Pouce en bas", hint: "Désapprobation", category: "emotion", hold: false, duration: 2.0, locksMovement: false, interruptible: true, priority: 2, facial: "frown" },
  { id: "clap", label: "Applaudir", hint: "Bravo !", category: "emotion", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 3, facial: "smile" },
  
  // ── Combat ──
  { id: "surrender", label: "Se rendre", hint: "Mains en l'air", category: "combat", key: "X", hold: true, duration: 0, locksMovement: true, interruptible: false, priority: 10 },
  { id: "point", label: "Pointer", hint: "Désigner un lieu", category: "combat", hold: false, duration: 2.4, locksMovement: false, interruptible: true, priority: 4 },
  { id: "threaten", label: "Menacer", hint: "Poing levé", category: "combat", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 5, facial: "angry" },
  { id: "gang_sign", label: "Signe de gang", hint: "Affiliation", category: "combat", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 4 },
  { id: "box_stance", label: "Position de combat", hint: "Prêt à frapper", category: "combat", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 6, facial: "angry" },
  
  // ── Utilitaire ──
  { id: "phone", label: "Téléphoner", hint: "Main à l'oreille", category: "utility", hold: true, duration: 0, prop: "phone", locksMovement: false, interruptible: true, priority: 5 },
  { id: "smoke", label: "Fumer", hint: "Cigarette", category: "utility", hold: true, duration: 0, prop: "cigarette", locksMovement: false, interruptible: true, priority: 3 },
  { id: "drink", label: "Boire", hint: "Bouteille/verre", category: "utility", hold: true, duration: 0, prop: "bottle", locksMovement: false, interruptible: true, priority: 3 },
  { id: "eat", label: "Manger", hint: "Sandwich/burger", category: "utility", hold: true, duration: 0, prop: "cup", locksMovement: false, interruptible: true, priority: 3 },
  { id: "check_watch", label: "Regarder l'heure", hint: "Impatient", category: "utility", hold: false, duration: 2.5, locksMovement: false, interruptible: true, priority: 2 },
  { id: "cross_arms", label: "Bras croisés", hint: "Attente, fermé", category: "utility", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 2 },
  { id: "hands_on_hips", label: "Mains sur hanches", hint: "Autorité", category: "utility", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 2 },
  
  // ── Danse ──
  { id: "dance", label: "Danse RP", hint: "Danse libre", category: "dance", hold: true, duration: 0, locksMovement: true, interruptible: true, priority: 7, facial: "smile" },
  { id: "dance_hip_hop", label: "Hip-hop", hint: "Style urbain", category: "dance", hold: true, duration: 0, locksMovement: true, interruptible: true, priority: 7, facial: "smile" },
  { id: "dance_salsa", label: "Salsa", hint: "Danse latine", category: "dance", hold: true, duration: 0, locksMovement: true, interruptible: true, priority: 7, facial: "smile" },
  
  // ── Posture ──
  { id: "sit", label: "S'asseoir", hint: "Par terre", category: "seated", hold: true, duration: 0, locksMovement: true, interruptible: true, priority: 6 },
  { id: "sit_cross_legged", label: "Assis en tailleur", hint: "Méditation", category: "seated", hold: true, duration: 0, locksMovement: true, interruptible: true, priority: 6 },
  { id: "kneel", label: "S'agenouiller", hint: "Soumission/prière", category: "seated", hold: true, duration: 0, locksMovement: true, interruptible: true, priority: 6 },
  { id: "lean", label: "S'appuyer", hint: "Contre un mur", category: "seated", hold: true, duration: 0, locksMovement: false, interruptible: true, priority: 3 },
  
  // ── Véhicule ──
  { id: "drive", label: "Conduire", hint: "Deux mains", category: "vehicle", hold: true, duration: 0, locksMovement: true, interruptible: false, priority: 9 },
  { id: "drive_one_hand", label: "Conduire cool", hint: "Une main", category: "vehicle", hold: true, duration: 0, locksMovement: true, interruptible: true, priority: 8 },
  { id: "passenger_relax", label: "Passager détendu", hint: "Bras sur portière", category: "vehicle", hold: true, duration: 0, locksMovement: true, interruptible: true, priority: 5 },
].map(Object.freeze));

export const GESTURE_IDS = Object.freeze(RP_GESTURES.map((g) => g.id));
export const GESTURE_MAP = new Map(RP_GESTURES.map((g) => [g.id, g]));

export function isGesture(id) {
  return id === "none" || GESTURE_MAP.has(id);
}

export function gestureDef(id) {
  return GESTURE_MAP.get(id);
}

export function locksMovement(id) {
  const def = GESTURE_MAP.get(id);
  return def ? def.locksMovement : false;
}

export function gesturesByCategory(category) {
  return RP_GESTURES.filter((g) => g.category === category);
}

// ═══════════════════════════════════════════════════════════════════════════
// GESTION ET RETRAIT DES MEMBRES DU SQUELETTE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère ou met en cache les membres articulés du personnage.
 * @param {THREE.Group} group 
 * @returns {object} CharacterLimbs
 */
export function getOrCacheLimbs(group) {
  if (group.userData._cachedLimbs) {
    return group.userData._cachedLimbs;
  }

  const limbs = {};

  group.traverse((obj) => {
    const arm = obj.userData.arm;
    const leg = obj.userData.leg;
    const name = obj.name.toLowerCase();

    // Articulations des bras
    if (arm === 1)       limbs.armR = obj;
    else if (arm === -1) limbs.armL = obj;

    if (name.includes("forearm")) {
      if (name.includes("r"))      limbs.forearmR = obj;
      else if (name.includes("l")) limbs.forearmL = obj;
    }

    // Articulations des jambes
    if (leg === 1)       limbs.legR = obj;
    else if (leg === -1) limbs.legL = obj;

    if (name.includes("shin")) {
      if (name.includes("r"))      limbs.shinR = obj;
      else if (name.includes("l")) limbs.shinL = obj;
    }

    // Extrémités
    if (name.includes("hand")) {
      if (name.includes("r"))      limbs.handR = obj;
      else if (name.includes("l")) limbs.handL = obj;
    }
    if (name.includes("foot")) {
      if (name.includes("r"))      limbs.footR = obj;
      else if (name.includes("l")) limbs.footL = obj;
    }

    if (name.includes("head")) limbs.head = obj;
    if (name.includes("neck")) limbs.neck = obj;
    if (name.includes("spine") || name.includes("chest")) limbs.spine = obj;
  });

  limbs.bodyRoot = group.getObjectByName("bodyRoot") ?? group.getObjectByName("hips") ?? group;
  group.userData._cachedLimbs = limbs;
  return limbs;
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN DE GENERATION ET POOL DES ACCESSOIRES (PROPS)
// ═══════════════════════════════════════════════════════════════════════════

const _propTemplates = new Map();

function buildPhoneProp() {
  const phone = new THREE.Group();
  phone.name = "rp-prop-phone";
  phone.userData.propType = "phone";

  const body = new THREE.Mesh(getGeo("box", { w: 0.07, h: 0.14, d: 0.012 }), matLib.get(0x1a1e24, 0.35, 0.2));
  const screen = new THREE.Mesh(getGeo("box", { w: 0.058, h: 0.118, d: 0.004 }), matLib.getEmissive(0x3a6a88, 0x4a9eff, 0.8));
  screen.position.z = 0.008;

  phone.add(body, screen);
  return phone;
}

function buildCigaretteProp() {
  const cig = new THREE.Group();
  cig.name = "rp-prop-cigarette";
  cig.userData.propType = "cigarette";

  const stick = new THREE.Mesh(getGeo("cylinder", { r: 0.008, h: 0.08, seg: 8 }), matLib.get(0xf5f5dc, 0.9, 0.0));
  stick.rotation.z = Math.PI / 2;

  const filter = new THREE.Mesh(getGeo("cylinder", { r: 0.009, h: 0.025, seg: 8 }), matLib.get(0xd2691e, 0.7, 0.1));
  filter.rotation.z = Math.PI / 2;
  filter.position.x = -0.05;

  const ember = new THREE.Mesh(getGeo("sphere", { r: 0.01, seg: 6 }), matLib.getEmissive(0xff4500, 0xff6347, 1.2));
  ember.position.x = 0.045;

  cig.add(stick, filter, ember);
  return cig;
}

function buildBottleProp() {
  const bottle = new THREE.Group();
  bottle.name = "rp-prop-bottle";
  bottle.userData.propType = "bottle";

  const body = new THREE.Mesh(getGeo("cylinder", { r: 0.035, h: 0.18, seg: 12 }), matLib.get(0x2f4f4f, 0.3, 0.6));
  const neck = new THREE.Mesh(getGeo("cylinder", { r: 0.015, h: 0.05, seg: 10 }), matLib.get(0x2f4f4f, 0.3, 0.6));
  neck.position.y = 0.115;

  const cap = new THREE.Mesh(getGeo("cylinder", { r: 0.018, h: 0.012, seg: 10 }), matLib.get(0xffd700, 0.2, 0.8));
  cap.position.y = 0.145;

  bottle.add(body, neck, cap);
  return bottle;
}

function buildCupProp() {
  const cup = new THREE.Group();
  cup.name = "rp-prop-cup";
  cup.userData.propType = "cup";

  const cupMesh = new THREE.Mesh(getGeo("cylinder", { r: 0.04, h: 0.12, seg: 12 }), matLib.get(0xffffff, 0.6, 0.1));
  const lid = new THREE.Mesh(getGeo("cylinder", { r: 0.042, h: 0.01, seg: 12 }), matLib.get(0x8b4513, 0.5, 0.2));
  lid.position.y = 0.065;

  cup.add(cupMesh, lid);
  return cup;
}

const PROP_BUILDERS = {
  phone:     buildPhoneProp,
  cigarette: buildCigaretteProp,
  bottle:    buildBottleProp,
  cup:       buildCupProp,
  pistol:    () => new THREE.Group(),
  rifle:     () => new THREE.Group(),
  knife:     () => new THREE.Group(),
};

function getPropTemplate(propType) {
  if (_propTemplates.has(propType)) {
    return _propTemplates.get(propType).clone();
  }
  const builder = PROP_BUILDERS[propType];
  if (!builder) return null;
  const template = builder();
  _propTemplates.set(propType, template);
  return template.clone();
}

export function attachProp(group, propType, attachTo = "handR") {
  detachProp(group);
  const limbs = getOrCacheLimbs(group);

  const propObj = getPropTemplate(propType);
  if (!propObj) return;

  let target = null;
  if (attachTo === "handR")       target = limbs.handR ?? null;
  else if (attachTo === "handL")  target = limbs.handL ?? null;
  else if (attachTo === "mouth")  target = limbs.head ?? null;

  if (!target) {
    target = group;
    propObj.position.set(0.32, 1.42, 0.12);
  }

  switch (propType) {
    case "phone":
      propObj.position.set(0, -0.58, 0.04);
      propObj.rotation.set(-0.4, 0.2, 0.15);
      break;
    case "cigarette":
      propObj.position.set(0.02, 0, 0.08);
      propObj.rotation.set(0, 0, 0);
      break;
    case "bottle":
      propObj.position.set(0, -0.1, 0);
      propObj.rotation.set(0, 0, 0);
      break;
    case "cup":
      propObj.position.set(0, -0.08, 0);
      propObj.rotation.set(0, 0, 0);
      break;
  }

  target.add(propObj);
}

export function detachProp(group, propType = undefined) {
  const limbs = getOrCacheLimbs(group);
  
  const targets = [];
  if (limbs.handR) targets.push(limbs.handR);
  if (limbs.handL) targets.push(limbs.handL);
  if (limbs.head)  targets.push(limbs.head);
  targets.push(group);

  for (let t = 0; t < targets.length; t++) {
    const target = targets[t];
    for (let i = target.children.length - 1; i >= 0; i--) {
      const child = target.children[i];
      if (child.name.startsWith("rp-prop-")) {
        if (!propType || child.userData.propType === propType) {
          target.remove(child);
        }
      }
    }
  }
}

export function hasProp(group, propType) {
  const limbs = getOrCacheLimbs(group);
  
  const targets = [];
  if (limbs.handR) targets.push(limbs.handR);
  if (limbs.handL) targets.push(limbs.handL);
  if (limbs.head)  targets.push(limbs.head);
  targets.push(group);

  for (let t = 0; t < targets.length; t++) {
    const target = targets[t];
    for (let i = 0; i < target.children.length; i++) {
      if (target.children[i].userData.propType === propType) return true;
    }
  }
  return false;
}

export function attachPhoneProp(group) {
  attachProp(group, "phone");
}

export function detachPhoneProp(group) {
  detachProp(group, "phone");
}

// ─── GESTURE BLENDING (WeakMap évite les fuites de mémoire) ────────────────

const gestureStates = new WeakMap();

export function getGestureState(group) {
  let state = gestureStates.get(group);
  if (!state) {
    state = {
      current: "none",
      previous: "none",
      blendFactor: 1,
      blendSpeed: 0.15,
      startTime: 0,
      elapsed: 0,
      active: false,
    };
    gestureStates.set(group, state);
  }
  return state;
}

export function setGesture(group, id, blendSpeed = 0.15) {
  const state = getGestureState(group);
  const def = GESTURE_MAP.get(id);

  if (!def && id !== "none") {
    console.warn(`[Gestures] Geste inconnu: ${id}`);
    return;
  }

  // Contrôle de priorité d'interruption
  if (state.current !== "none") {
    const currentDef = GESTURE_MAP.get(state.current);
    if (currentDef && !currentDef.interruptible && (def?.priority || 0) <= currentDef.priority) {
      return;
    }
  }

  state.previous = state.current;
  state.current = id;
  state.blendFactor = 0;
  state.blendSpeed = blendSpeed;
  state.startTime = performance.now();
  state.elapsed = 0;
  state.active = id !== "none";

  if (def?.prop) {
    attachProp(group, def.prop);
  } else {
    detachProp(group);
  }
}

// ─── INVERSE KINEMATICS (ZERO-ALLOCATION DANS LES BOUCLES) ──────────────────

const _localTarget = new THREE.Vector3();
const _direction   = new THREE.Vector3();

export function pointAtTarget(group, target, limb = "armR", blendSpeed = 0.15) {
  const limbs = getOrCacheLimbs(group);
  const arm = limb === "armR" ? limbs.armR : limbs.armL;
  if (!arm || !limbs.bodyRoot) return;

  _localTarget.copy(target);
  limbs.bodyRoot.worldToLocal(_localTarget);

  _direction.copy(_localTarget).normalize();

  const angleY = Math.atan2(_direction.x, _direction.z);
  const angleX = Math.atan2(_direction.y, Math.sqrt(_direction.x * _direction.x + _direction.z * _direction.z));

  arm.rotation.y = lerp(arm.rotation.y, angleY, blendSpeed);
  arm.rotation.x = lerp(arm.rotation.x, -angleX - Math.PI / 2, blendSpeed);
}

// ─── UTILS INTERNES D'INTERPOLATION ──────────────────────────────────────────

function lerp(current, target, speed) {
  return current + (target - current) * speed;
}

// ─── ANIMATION ET COMPORTEMENTS SQUELETTIQUES ────────────────────────────────

export function applyGesture(group, id, t, blendSpeed = 0.15) {
  const limbs = getOrCacheLimbs(group);
  const state = getGestureState(group);

  if (state.blendFactor < 1) {
    state.blendFactor = Math.min(1, state.blendFactor + blendSpeed);
  }

  const def = GESTURE_MAP.get(id);
  if (!def && id !== "none") return;

  state.elapsed = t - (state.startTime / 1000);

  const { armR, armL, legR, legL, spine, head } = limbs;

  if (id === "none") {
    if (armR) {
      armR.rotation.x = lerp(armR.rotation.x, 0, blendSpeed);
      armR.rotation.y = lerp(armR.rotation.y, 0, blendSpeed);
      armR.rotation.z = lerp(armR.rotation.z, 0, blendSpeed);
    }
    if (armL) {
      armL.rotation.x = lerp(armL.rotation.x, 0, blendSpeed);
      armL.rotation.y = lerp(armL.rotation.y, 0, blendSpeed);
      armL.rotation.z = lerp(armL.rotation.z, 0, blendSpeed);
    }
    if (legR) {
      legR.rotation.x = lerp(legR.rotation.x, 0, blendSpeed);
      legR.rotation.z = lerp(legR.rotation.z, 0, blendSpeed);
    }
    if (legL) {
      legL.rotation.x = lerp(legL.rotation.x, 0, blendSpeed);
      legL.rotation.z = lerp(legL.rotation.z, 0, blendSpeed);
    }
    if (spine) {
      spine.rotation.x = lerp(spine.rotation.x, 0, blendSpeed);
      spine.rotation.z = lerp(spine.rotation.z, 0, blendSpeed);
    }
    if (head) {
      head.rotation.x = lerp(head.rotation.x, 0, blendSpeed);
      head.rotation.z = lerp(head.rotation.z, 0, blendSpeed);
    }
    return;
  }

  switch (id) {
    case "surrender":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -2.55, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, 0.18, blendSpeed);
      }
      if (armL) {
        armL.rotation.x = lerp(armL.rotation.x, -2.55, blendSpeed);
        armL.rotation.z = lerp(armL.rotation.z, -0.18, blendSpeed);
      }
      break;

    case "wave":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -2.15, blendSpeed);
        armR.rotation.z = 0.35 + Math.sin(t * 9) * 0.55;
      }
      break;

    case "salute":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -2.35, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, -0.35, blendSpeed);
      }
      break;

    case "point":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -1.45, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, 0.05, blendSpeed);
      }
      break;

    case "cross_arms":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -1.15, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, -0.72, blendSpeed);
      }
      if (armL) {
        armL.rotation.x = lerp(armL.rotation.x, -1.15, blendSpeed);
        armL.rotation.z = lerp(armL.rotation.z, 0.72, blendSpeed);
      }
      break;

    case "hands_on_hips":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -0.4, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, -0.8, blendSpeed);
      }
      if (armL) {
        armL.rotation.x = lerp(armL.rotation.x, -0.4, blendSpeed);
        armL.rotation.z = lerp(armL.rotation.z, 0.8, blendSpeed);
      }
      break;

    case "phone":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -2.05, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, -0.55, blendSpeed);
      }
      if (head) {
        head.rotation.z = lerp(head.rotation.z, 0.15, blendSpeed);
      }
      break;

    case "smoke":
      if (armR) {
        const smokeCycle = Math.sin(t * 0.8) * 0.5 + 0.5;
        armR.rotation.x = lerp(armR.rotation.x, -1.8 + smokeCycle * 0.4, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, -0.6, blendSpeed);
      }
      break;

    case "drink":
      if (armR) {
        const drinkCycle = Math.sin(t * 1.2) * 0.5 + 0.5;
        armR.rotation.x = lerp(armR.rotation.x, -2.2 + drinkCycle * 0.3, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, -0.4, blendSpeed);
      }
      break;

    case "gang_sign":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -1.55, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, 0.45, blendSpeed);
      }
      if (armL) {
        armL.rotation.x = lerp(armL.rotation.x, -1.55, blendSpeed);
        armL.rotation.z = lerp(armL.rotation.z, -0.45, blendSpeed);
      }
      break;

    case "dance": {
      const swing = Math.sin(t * 6.2);
      const bounce = Math.abs(Math.sin(t * 6.2)) * 0.1;
      if (armR) {
        armR.rotation.x = -1.1 + swing * 0.85;
        armR.rotation.z = 0.4;
      }
      if (armL) {
        armL.rotation.x = -1.1 - swing * 0.85;
        armL.rotation.z = -0.4;
      }
      if (legR) legR.rotation.x = swing * 0.45;
      if (legL) legL.rotation.x = -swing * 0.45;
      if (spine) spine.position.y = bounce;
      break;
    }

    case "dance_hip_hop": {
      const beat = t * 4;
      const bounce = Math.abs(Math.sin(beat)) * 0.15;
      const sway = Math.sin(beat * 0.5) * 0.2;
      if (armR) {
        armR.rotation.x = -0.8 + Math.sin(beat) * 0.6;
        armR.rotation.z = 0.3 + sway;
      }
      if (armL) {
        armL.rotation.x = -0.8 + Math.sin(beat + Math.PI) * 0.6;
        armL.rotation.z = -0.3 - sway;
      }
      if (spine) {
        spine.rotation.z = sway * 0.5;
        spine.position.y = bounce;
      }
      break;
    }

    case "sit":
      if (legR) legR.rotation.x = lerp(legR.rotation.x, -1.35, blendSpeed);
      if (legL) legL.rotation.x = lerp(legL.rotation.x, -1.35, blendSpeed);
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -0.55, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, 0.12, blendSpeed);
      }
      if (armL) {
        armL.rotation.x = lerp(armL.rotation.x, -0.55, blendSpeed);
        armL.rotation.z = lerp(armL.rotation.z, -0.12, blendSpeed);
      }
      if (spine) spine.rotation.x = lerp(spine.rotation.x, -0.3, blendSpeed);
      break;

    case "sit_cross_legged":
      if (legR) {
        legR.rotation.x = lerp(legR.rotation.x, -1.6, blendSpeed);
        legR.rotation.z = lerp(legR.rotation.z, 0.4, blendSpeed);
      }
      if (legL) {
        legL.rotation.x = lerp(legL.rotation.x, -1.6, blendSpeed);
        legL.rotation.z = lerp(legL.rotation.z, -0.4, blendSpeed);
      }
      if (spine) spine.rotation.x = lerp(spine.rotation.x, -0.4, blendSpeed);
      break;

    case "kneel":
      if (legR) legR.rotation.x = lerp(legR.rotation.x, -Math.PI / 2, blendSpeed);
      if (legL) legL.rotation.x = lerp(legL.rotation.x, -Math.PI / 2, blendSpeed);
      if (spine) spine.rotation.x = lerp(spine.rotation.x, -0.2, blendSpeed);
      break;

    case "laugh":
      if (spine) {
        const laughShake = Math.sin(t * 12) * 0.08;
        spine.rotation.x = -0.3 + laughShake;
      }
      if (armR) armR.rotation.z = lerp(armR.rotation.z, 0.3, blendSpeed);
      if (armL) armL.rotation.z = lerp(armL.rotation.z, -0.3, blendSpeed);
      break;

    case "clap":
      if (armR && armL) {
        const clapCycle = Math.abs(Math.sin(t * 8));
        armR.rotation.z = lerp(armR.rotation.z, 0.2 + clapCycle * 0.3, blendSpeed);
        armL.rotation.z = lerp(armL.rotation.z, -0.2 - clapCycle * 0.3, blendSpeed);
      }
      break;

    case "shrug":
      if (armR) {
        armR.rotation.z = lerp(armR.rotation.z, -0.8, blendSpeed);
        armR.rotation.x = lerp(armR.rotation.x, -0.3, blendSpeed);
      }
      if (armL) {
        armL.rotation.z = lerp(armL.rotation.z, 0.8, blendSpeed);
        armL.rotation.x = lerp(armL.rotation.x, -0.3, blendSpeed);
      }
      break;

    case "facepalm":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -2.4, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, -0.3, blendSpeed);
      }
      if (head) head.rotation.x = lerp(head.rotation.x, -0.2, blendSpeed);
      break;

    case "thumbs_up":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -1.2, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, 0.3, blendSpeed);
      }
      break;

    case "bow":
      if (spine) spine.rotation.x = lerp(spine.rotation.x, -0.8, blendSpeed);
      if (head) head.rotation.x = lerp(head.rotation.x, -0.3, blendSpeed);
      break;

    case "threaten":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -1.8, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, 0.5, blendSpeed);
      }
      if (spine) spine.rotation.x = lerp(spine.rotation.x, -0.15, blendSpeed);
      break;

    case "box_stance":
      if (armR) {
        armR.rotation.x = lerp(armR.rotation.x, -1.5, blendSpeed);
        armR.rotation.z = lerp(armR.rotation.z, 0.4, blendSpeed);
      }
      if (armL) {
        armL.rotation.x = lerp(armL.rotation.x, -1.5, blendSpeed);
        armL.rotation.z = lerp(armL.rotation.z, -0.4, blendSpeed);
      }
      if (legR) legR.rotation.z = lerp(legR.rotation.z, 0.2, blendSpeed);
      if (legL) legL.rotation.z = lerp(legL.rotation.z, -0.2, blendSpeed);
      break;
  }
}

// ─── ANIMATIONS PROCÉDURALES (IDLES ÉVITANT LA DÉRIVE) ───────────────────────

export function applyIdleBreathing(group, t) {
  const limbs = getOrCacheLimbs(group);
  if (!limbs.spine) return;

  if (limbs.spine.userData.restY === undefined) {
    limbs.spine.userData.restY = limbs.spine.position.y;
  }

  const breath = Math.sin(t * 2) * 0.025;
  limbs.spine.position.y = limbs.spine.userData.restY + breath;
}

export function applyIdleSway(group, t, intensity = 0.05) {
  const limbs = getOrCacheLimbs(group);
  if (!limbs.bodyRoot) return;

  if (limbs.bodyRoot.userData.restZ === undefined) {
    limbs.bodyRoot.userData.restZ = limbs.bodyRoot.rotation.z;
  }

  const sway = Math.sin(t * 1.5) * intensity;
  limbs.bodyRoot.rotation.z = limbs.bodyRoot.userData.restZ + sway;
}

// ─── ÉCOUTEURS D'ÉVÉNEMENTS (EVENT SYSTEM) ───────────────────────────────────

const eventHandlers = [];

export function onGestureEvent(handler) {
  if (typeof handler !== "function") return () => {};
  eventHandlers.push(handler);
  return () => {
    const idx = eventHandlers.indexOf(handler);
    if (idx >= 0) eventHandlers.splice(idx, 1);
  };
}

export function emitGestureEvent(event) {
  const payload = { ...event, timestamp: Date.now(), sig: SIG };
  for (let i = 0; i < eventHandlers.length; i++) {
    try {
      eventHandlers[i](payload);
    } catch (err) {
      console.error(`[${SIG}·Gestures] Erreur handler d'événement:`, err);
    }
  }
}

// ─── ACCESSEURS PUBLICS ──────────────────────────────────────────────────────

export function getActiveGesture(group) {
  return getGestureState(group).current;
}

export function isGestureActive(group) {
  return getGestureState(group).active;
}

export function clearGesture(group) {
  setGesture(group, "none");
}

export function getGestureProgress(group) {
  const state = getGestureState(group);
  const def = GESTURE_MAP.get(state.current);
  if (!def || def.duration === 0) return 1;
  return Math.min(1, state.elapsed / def.duration);
}

/**
 * Prépare et désinstalle toutes les animations et accessoires d'un personnage.
 * @param {THREE.Group} group 
 */
export function disposeGestures(group) {
  detachProp(group);
  gestureStates.delete(group);
}

export const GESTURE_CATEGORIES = Object.freeze([
  "social", "combat", "emotion", "utility", "dance", "vehicle", "seated",
]);

export default {
  RP_GESTURES,
  GESTURE_IDS,
  GESTURE_MAP,
  GESTURE_CATEGORIES,
  isGesture,
  gestureDef,
  locksMovement,
  gesturesByCategory,
  getOrCacheLimbs,
  attachProp,
  detachProp,
  hasProp,
  attachPhoneProp,
  detachPhoneProp,
  getGestureState,
  setGesture,
  pointAtTarget,
  applyGesture,
  applyIdleBreathing,
  applyIdleSway,
  onGestureEvent,
  emitGestureEvent,
  getActiveGesture,
  isGestureActive,
  clearGesture,
  getGestureProgress,
  disposeGestures,
  SIG,
};
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/CHARACTERANIMATIONSYSTEM.JS
 * Système d'animation procédural pour personnages simples (sans joints)
 * ═══════════════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • ⚠️ CRITIQUE : plus d'anim sur ".position" du root
 *     → utilisation d'un nœud PIVOT enfant ("anim-root") pour le bobbing
 *   • Crossfade réel au lieu de stopAllAction (fini les pops)
 *   • activeClip / activeAction cohérents après lock/unlock
 *   • clip.loop n'existe pas → constante LOOP_MAP correcte
 *   • lockByGesture(false) → reset time + play
 *   • dispose() : mixer.uncacheRoot + tracks release
 *   • userData TROXT⬡
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/systems/CharacterAnimationSystem.js
 */

import * as THREE from 'three';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG / TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** @typedef {('idle'|'walk'|'run'|'jump'|'dance')} BasicAnimationType */

/**
 * @typedef {object} AnimationConfig
 * @property {BasicAnimationType} name
 * @property {number} duration
 * @property {boolean} loop
 * @property {number} priority
 */

const LOOP_MAP = Object.freeze({
  idle:  THREE.LoopRepeat,
  walk:  THREE.LoopRepeat,
  run:   THREE.LoopRepeat,
  jump:  THREE.LoopOnce,
  dance: THREE.LoopRepeat,
});

const CLAMP_WHEN_FINISHED = Object.freeze({
  jump: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

export class CharacterAnimationSystem {
  /**
   * @param {THREE.Group} characterGroup
   */
  constructor(characterGroup) {
    this.characterGroup = characterGroup;
    this.mixer = new THREE.AnimationMixer(characterGroup);

    /** @type {Map<BasicAnimationType, THREE.AnimationClip>} */
    this.clips = new Map();
    /** @type {Map<BasicAnimationType, THREE.AnimationAction>} */
    this.actions = new Map();

    /** @type {BasicAnimationType|null} */
    this.activeClip = null;
    /** @type {THREE.AnimationAction|null} */
    this.activeAction = null;
    this.isLockedByGesture = false;

    /**
     * 🔧 BOOST CRITIQUE : nœud pivot dédié pour les animations de bobbing.
     * Le personnage est enveloppé dans ce pivot qui peut bouger en Y/Z
     * sans affecter la position MONDE du characterGroup.
     */
    this.animRoot = new THREE.Group();
    this.animRoot.name = 'character_anim_root';
    this.animRoot.userData = { sig: SIG, kind: 'anim_root' };

    // Reparent tous les enfants existants sous animRoot
    while (characterGroup.children.length > 0) {
      this.animRoot.add(characterGroup.children[0]);
    }
    characterGroup.add(this.animRoot);

    characterGroup.userData = { ...characterGroup.userData, sig: SIG, kind: 'animated_character' };
  }

  // ─── INIT ───────────────────────────────────────────────────────────────
  initialize() {
    this.clips.set('idle',  this._createIdleClip());
    this.clips.set('walk',  this._createWalkClip());
    this.clips.set('run',   this._createRunClip());
    this.clips.set('jump',  this._createJumpClip());
    this.clips.set('dance', this._createDanceClip());

    // Pré-crée les actions (une fois)
    for (const [name, clip] of this.clips) {
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setLoop(LOOP_MAP[name], Infinity);
      if (CLAMP_WHEN_FINISHED[name]) action.clampWhenFinished = true;
      action.setEffectiveWeight(0);
      this.actions.set(name, action);
    }
  }

  // ─── CLIPS PROCÉDURAUX (animés sur le PIVOT "character_anim_root") ──────
  _createIdleClip() {
    // Respiration : bobbing Y sur le PIVOT (pas le group root)
    const times = [0, 1, 2, 3];
    const values = [];
    for (const t of times) {
      values.push(0, Math.sin(t * 2) * 0.02, 0);
    }
    return new THREE.AnimationClip('idle', 3, [
      new THREE.NumberKeyframeTrack('character_anim_root.position', times, values),
    ]);
  }

  _createWalkClip() {
    const times = Array.from({ length: 30 }, (_, i) => i * 0.1);
    const values = [];
    for (const t of times) {
      values.push(
        0,
        Math.sin(t * 10) * 0.05,          // bobbing Y
        0                                  // 🔧 BOOST : Z=0 (le contrôleur gère le déplacement)
      );
    }
    return new THREE.AnimationClip('walk', 3, [
      new THREE.NumberKeyframeTrack('character_anim_root.position', times, values),
    ]);
  }

  _createRunClip() {
    const times = Array.from({ length: 30 }, (_, i) => i * 0.08);
    const values = [];
    for (const t of times) {
      values.push(
        0,
        Math.sin(t * 15) * 0.10,           // bobbing plus prononcé
        0
      );
    }
    return new THREE.AnimationClip('run', 2.4, [
      new THREE.NumberKeyframeTrack('character_anim_root.position', times, values),
    ]);
  }

  _createJumpClip() {
    const times = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const values = [];
    for (const t of times) {
      const h = Math.sin(t * Math.PI) * 0.5;
      values.push(0, h, 0);
    }
    return new THREE.AnimationClip('jump', 1.0, [
      new THREE.NumberKeyframeTrack('character_anim_root.position', times, values),
    ]);
  }

  _createDanceClip() {
    const times = Array.from({ length: 60 }, (_, i) => i * 0.1);
    const values = [];
    for (const t of times) {
      values.push(
        Math.sin(t * 3) * 0.10,            // sway X
        Math.sin(t * 4) * 0.05,            // bob Y
        0
      );
    }
    return new THREE.AnimationClip('dance', 4, [
      new THREE.NumberKeyframeTrack('character_anim_root.position', times, values),
    ]);
  }

  // ─── PLAY (avec crossfade) ──────────────────────────────────────────────
  /**
   * @param {BasicAnimationType} type
   * @param {number} [fadeDuration=0.2]
   */
  play(type, fadeDuration = 0.2) {
    if (this.isLockedByGesture) return;
    if (this.activeClip === type) return;

    const nextAction = this.actions.get(type);
    if (!nextAction) {
      console.warn(`[${SIG}·AnimSystem] Clip "${type}" introuvable.`);
      return;
    }

    const fade = THREE.MathUtils.clamp(fadeDuration, 0, 1);
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);

    if (this.activeAction && fade > 0) {
      // 🔧 BOOST : crossfade au lieu de stopAllAction (fini les pops)
      this.activeAction.crossFadeTo(nextAction, fade, true);
      nextAction.play();
    } else {
      if (this.activeAction) this.activeAction.stop();
      nextAction.play();
    }

    this.activeClip = type;
    this.activeAction = nextAction;
  }

  // ─── LOCK GESTURE (priorité RP) ─────────────────────────────────────────
  lockByGesture(locked) {
    this.isLockedByGesture = !!locked;
    if (!locked && this.activeAction) {
      // 🔧 BOOST : reset time + reprendre proprement
      this.activeAction.reset();
      this.activeAction.setEffectiveWeight(1);
      this.activeAction.play();
    }
  }

  // ─── UPDATE ─────────────────────────────────────────────────────────────
  update(deltaTime) {
    this.mixer.update(deltaTime);
  }

  // ─── DISPOSE ────────────────────────────────────────────────────────────
  dispose() {
    if (this.mixer) {
      for (const action of this.actions.values()) action.stop();
      this.mixer.uncacheRoot(this.characterGroup);
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.actions.clear();
    this.clips.clear();
    this.activeClip = null;
    this.activeAction = null;
  }

  // ─── GETTERS ────────────────────────────────────────────────────────────
  getActive() { return this.activeClip; }
  isLocked() { return this.isLockedByGesture; }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {THREE.Group} group
 * @returns {CharacterAnimationSystem}
 */
export function setupCharacterAnimations(group) {
  const system = new CharacterAnimationSystem(group);
  system.initialize();
  return system;
}

export { SIG };
export default { CharacterAnimationSystem, setupCharacterAnimations };
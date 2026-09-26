/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/CHARACTERANIMATION.JS (v1 · unifié)
 * Système d'animation de personnage — mode auto-détecté
 * ═══════════════════════════════════════════════════════════════════════════
 * Fusionne :
 *   • CharacterAnimationManager  → mode JOINTS  (bones nommés)
 *   • CharacterAnimationSystem   → mode PROCÉDURAL (pivot animRoot)
 *
 * Détection automatique :
 *   • Si le groupe a des `userData.arm` / `userData.leg` → JOINTS
 *   • Sinon → PROCÉDURAL (pivot enfant auto-injecté)
 *
 * API unique pour les deux modes :
 *   • play(name, fadeDuration)
 *   • playAction(name, fadeDuration)  (alias legacy)
 *   • update(dt, speed, grounded)
 *   • setEnabled(bool)
 *   • lockByGesture(bool)
 *   • dispose()
 *   • getStats()  → { mode, clip, clips, enabled, locked, bound }
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/systems/CharacterAnimation.js
 */

import * as THREE from 'three';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

/** @typedef {('idle'|'walk'|'run'|'jump'|'dance')} AnimClipName */

const CLIP_NAMES = Object.freeze(['idle', 'walk', 'run', 'jump', 'dance']);

const LOOP_MAP = Object.freeze({
  idle:  THREE.LoopRepeat,
  walk:  THREE.LoopRepeat,
  run:   THREE.LoopRepeat,
  jump:  THREE.LoopOnce,
  dance: THREE.LoopRepeat,
});

const CLAMP_WHEN_FINISHED = Object.freeze({ jump: true });

const SPEED_THRESHOLDS = Object.freeze({
  walk: 0.3,
  run:  4.5,
});

// Nom du pivot interne (mode procédural)
const ANIM_ROOT_NAME = 'character_anim_root';

// ═══════════════════════════════════════════════════════════════════════════
// DÉTECTION DES JOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Renomme les joints selon les conventions TROXT et retourne un mapping.
 * @param {THREE.Object3D} root
 * @returns {{ armL:boolean, armR:boolean, legL:boolean, legR:boolean, torso:boolean, head:boolean }}
 */
function tagJoints(root) {
  const found = { armL: false, armR: false, legL: false, legR: false, torso: false, head: false };

  root.traverse((obj) => {
    if (obj.userData.leg === -1)      { obj.name = 'LegLJoint'; found.legL = true; }
    else if (obj.userData.leg === 1)  { obj.name = 'LegRJoint'; found.legR = true; }
    else if (obj.userData.arm === -1) { obj.name = 'ArmLJoint'; found.armL = true; }
    else if (obj.userData.arm === 1)  { obj.name = 'ArmRJoint'; found.armR = true; }
  });

  const torso = root.getObjectByName('ether-body') ?? root.getObjectByName('TorsoJoint');
  if (torso) { torso.name = 'TorsoJoint'; found.torso = true; }

  const head = root.getObjectByName('HeadJoint')
    ?? root.getObjectByName('hero-face')?.parent
    ?? null;
  if (head) { head.name = 'HeadJoint'; found.head = true; }

  return found;
}

/**
 * Détecte si le groupe possède des articulations identifiables.
 * @param {THREE.Object3D} group
 * @returns {boolean}
 */
function hasJoints(group) {
  let found = false;
  group.traverse((obj) => {
    if (obj.userData.arm || obj.userData.leg) found = true;
  });
  return found;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

export class CharacterAnimation {
  /**
   * @param {THREE.Group} group
   * @param {object} [opts]
   * @param {'auto'|'joints'|'procedural'} [opts.mode='auto']
   */
  constructor(group, { mode = 'auto' } = {}) {
    if (!group) throw new Error(`[${SIG}·Anim] group requis`);

    this.root = group;
    /** @type {'joints'|'procedural'} */
    this.mode = 'procedural';
    /** @type {THREE.AnimationMixer|null} */
    this.mixer = null;
    /** @type {Map<AnimClipName, THREE.AnimationClip>} */
    this.clips = new Map();
    /** @type {Map<AnimClipName, THREE.AnimationAction>} */
    this.actions = new Map();

    /** @type {AnimClipName|null} */
    this.currentClip = null;
    /** @type {THREE.AnimationAction|null} */
    this.currentAction = null;

    this.enabled = true;
    this.bound = false;
    this.locked = false;

    // Pivot procédural (créé seulement en mode procédural)
    /** @type {THREE.Group|null} */
    this.animRoot = null;

    // ─── Détection de mode ────────────────────────────────────────────────
    this._resolveMode(mode);

    // ─── Setup ────────────────────────────────────────────────────────────
    if (this.mode === 'joints') this._setupJoints();
    else this._setupProcedural();

    // ─── Marquage TROXT⬡ ──────────────────────────────────────────────────
    this.root.userData = { ...this.root.userData, sig: SIG, kind: 'animated_character' };
  }

  // ─── API STATIQUE (compat attach) ─────────────────────────────────────────
  /**
   * Attache un système si possible. Retourne null si le groupe est déjà géré
   * ou si un mixeur externe existe.
   * @param {THREE.Group} group
   * @returns {CharacterAnimation|null}
   */
  static attach(group) {
    if (!group) return null;
    if (group.getObjectByName('fbx-stub')) return null;
    if (group.getObjectByName('fbx:casual') || group.name.startsWith('fbx:')) return null;
    if (group.userData.mixer) return null;
    return new CharacterAnimation(group);
  }

  // ─── DÉTECTION ──────────────────────────────────────────────────────────
  _resolveMode(forced) {
    if (forced === 'joints')      { this.mode = 'joints'; return; }
    if (forced === 'procedural')  { this.mode = 'procedural'; return; }

    // mode 'auto'
    if (hasJoints(this.root)) {
      this.mode = 'joints';
      console.info(`[${SIG}·Anim] mode JOINTS détecté sur "${this.root.name || 'unnamed'}"`);
    } else {
      this.mode = 'procedural';
      console.info(`[${SIG}·Anim] mode PROCÉDURAL pour "${this.root.name || 'unnamed'}"`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MODE JOINTS
  // ═════════════════════════════════════════════════════════════════════════
  _setupJoints() {
    const joints = tagJoints(this.root);

    if (!joints.armL && !joints.legL) {
      // Fallback procédural si trop peu de joints
      console.warn(`[${SIG}·Anim] joints insuffisants → bascule procédural`);
      this.mode = 'procedural';
      this._setupProcedural();
      return;
    }

    this.mixer = new THREE.AnimationMixer(this.root);
    this.root.userData.mixer = this.mixer;

    // ─── IDLE ────────────────────────────────────────────────────────────
    const idleT = [0, 1, 2];
    const idleTracks = [];
    if (joints.head)  idleTracks.push(new THREE.NumberKeyframeTrack('HeadJoint.rotation[y]',  idleT, [0, 0.08, 0]));
    if (joints.torso) idleTracks.push(new THREE.NumberKeyframeTrack('TorsoJoint.rotation[x]', idleT, [0, 0.03, 0]));
    if (idleTracks.length === 0) idleTracks.push(new THREE.NumberKeyframeTrack('.rotation[y]', idleT, [0, 0.02, 0]));

    // ─── WALK ────────────────────────────────────────────────────────────
    const wT = [0, 0.25, 0.5, 0.75, 1.0];
    const walkTracks = [];
    if (joints.legL) walkTracks.push(new THREE.NumberKeyframeTrack('LegLJoint.rotation[x]', wT, [0,  0.45, 0, -0.45, 0]));
    if (joints.legR) walkTracks.push(new THREE.NumberKeyframeTrack('LegRJoint.rotation[x]', wT, [0, -0.45, 0,  0.45, 0]));
    if (joints.armL) walkTracks.push(new THREE.NumberKeyframeTrack('ArmLJoint.rotation[x]', wT, [0, -0.38, 0,  0.38, 0]));
    if (joints.armR) walkTracks.push(new THREE.NumberKeyframeTrack('ArmRJoint.rotation[x]', wT, [0,  0.38, 0, -0.38, 0]));

    // ─── RUN ─────────────────────────────────────────────────────────────
    const rT = [0, 0.15, 0.3, 0.45, 0.6];
    const runTracks = [];
    if (joints.legL) runTracks.push(new THREE.NumberKeyframeTrack('LegLJoint.rotation[x]', rT, [0,  0.75, 0, -0.75, 0]));
    if (joints.legR) runTracks.push(new THREE.NumberKeyframeTrack('LegRJoint.rotation[x]', rT, [0, -0.75, 0,  0.75, 0]));
    if (joints.armL) runTracks.push(new THREE.NumberKeyframeTrack('ArmLJoint.rotation[x]', rT, [0, -0.65, 0,  0.65, 0]));
    if (joints.armR) runTracks.push(new THREE.NumberKeyframeTrack('ArmRJoint.rotation[x]', rT, [0,  0.65, 0, -0.65, 0]));

    // ─── JUMP ────────────────────────────────────────────────────────────
    const jT = [0, 0.15, 0.35, 0.55, 0.8];
    const jumpTracks = [];
    if (joints.legL) jumpTracks.push(new THREE.NumberKeyframeTrack('LegLJoint.rotation[x]', jT, [0, -0.5, -0.3, 0.3, 0]));
    if (joints.legR) jumpTracks.push(new THREE.NumberKeyframeTrack('LegRJoint.rotation[x]', jT, [0, -0.5, -0.3, 0.3, 0]));
    if (joints.armL) jumpTracks.push(new THREE.NumberKeyframeTrack('ArmLJoint.rotation[x]', jT, [0, -1.2, -0.8, 0.4, 0]));
    if (joints.armR) jumpTracks.push(new THREE.NumberKeyframeTrack('ArmRJoint.rotation[x]', jT, [0, -1.2, -0.8, 0.4, 0]));

    // ─── DANCE (bonus) ───────────────────────────────────────────────────
    const dT = [0, 0.4, 0.8, 1.2, 1.6];
    const danceTracks = [];
    if (joints.armL) danceTracks.push(new THREE.NumberKeyframeTrack('ArmLJoint.rotation[z]', dT, [0,  0.4, 0, -0.4, 0]));
    if (joints.armR) danceTracks.push(new THREE.NumberKeyframeTrack('ArmRJoint.rotation[z]', dT, [0, -0.4, 0,  0.4, 0]));
    if (joints.torso) danceTracks.push(new THREE.NumberKeyframeTrack('TorsoJoint.rotation[y]', dT, [0, 0.15, 0, -0.15, 0]));

    this._registerClips({
      idle:  new THREE.AnimationClip('idle',  2.0, idleTracks),
      walk:  new THREE.AnimationClip('walk',  1.0, walkTracks),
      run:   new THREE.AnimationClip('run',   0.6, runTracks),
      jump:  new THREE.AnimationClip('jump',  0.8, jumpTracks),
      dance: new THREE.AnimationClip('dance', 1.6, danceTracks),
    });

    this.bound = true;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MODE PROCÉDURAL
  // ═════════════════════════════════════════════════════════════════════════
  _setupProcedural() {
    // 🔧 CRITIQUE : créer un pivot dédié pour ne pas écraser la position monde
    this.animRoot = this.root.getObjectByName(ANIM_ROOT_NAME);
    if (!this.animRoot) {
      this.animRoot = new THREE.Group();
      this.animRoot.name = ANIM_ROOT_NAME;
      this.animRoot.userData = { sig: SIG, kind: 'anim_root' };

      // Reparent tous les enfants existants
      while (this.root.children.length > 0) {
        this.animRoot.add(this.root.children[0]);
      }
      this.root.add(this.animRoot);
    }

    this.mixer = new THREE.AnimationMixer(this.root);
    this.root.userData.mixer = this.mixer;

    const clips = {
      idle:  this._procIdle(),
      walk:  this._procWalk(),
      run:   this._procRun(),
      jump:  this._procJump(),
      dance: this._procDance(),
    };
    this._registerClips(clips);

    this.bound = true;
  }

  _procIdle() {
    const t = [0, 1, 2, 3];
    const v = [];
    for (const s of t) v.push(0, Math.sin(s * 2) * 0.02, 0);
    return new THREE.AnimationClip('idle', 3, [
      new THREE.NumberKeyframeTrack(`${ANIM_ROOT_NAME}.position`, t, v),
    ]);
  }

  _procWalk() {
    const t = Array.from({ length: 30 }, (_, i) => i * 0.1);
    const v = [];
    for (const s of t) v.push(0, Math.sin(s * 10) * 0.05, 0);
    return new THREE.AnimationClip('walk', 3, [
      new THREE.NumberKeyframeTrack(`${ANIM_ROOT_NAME}.position`, t, v),
    ]);
  }

  _procRun() {
    const t = Array.from({ length: 30 }, (_, i) => i * 0.08);
    const v = [];
    for (const s of t) v.push(0, Math.sin(s * 15) * 0.10, 0);
    return new THREE.AnimationClip('run', 2.4, [
      new THREE.NumberKeyframeTrack(`${ANIM_ROOT_NAME}.position`, t, v),
    ]);
  }

  _procJump() {
    const t = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const v = [];
    for (const s of t) v.push(0, Math.sin(s * Math.PI) * 0.5, 0);
    return new THREE.AnimationClip('jump', 1.0, [
      new THREE.NumberKeyframeTrack(`${ANIM_ROOT_NAME}.position`, t, v),
    ]);
  }

  _procDance() {
    const t = Array.from({ length: 60 }, (_, i) => i * 0.1);
    const v = [];
    for (const s of t) v.push(Math.sin(s * 3) * 0.1, Math.sin(s * 4) * 0.05, 0);
    return new THREE.AnimationClip('dance', 4, [
      new THREE.NumberKeyframeTrack(`${ANIM_ROOT_NAME}.position`, t, v),
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ENREGISTREMENT DES CLIPS (commun aux 2 modes)
  // ═════════════════════════════════════════════════════════════════════════
  _registerClips(clipsMap) {
    for (const name of CLIP_NAMES) {
      const clip = clipsMap[name];
      if (!clip || clip.tracks.length === 0) continue;

      this.clips.set(name, clip);
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setLoop(LOOP_MAP[name], Infinity);
      if (CLAMP_WHEN_FINISHED[name]) action.clampWhenFinished = true;
      action.setEffectiveWeight(0);
      this.actions.set(name, action);
    }

    // Play idle par défaut
    const idle = this.actions.get('idle');
    if (idle) {
      idle.setEffectiveWeight(1);
      idle.play();
      this.currentClip = 'idle';
      this.currentAction = idle;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // API PUBLIQUE UNIFIÉE
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Joue un clip avec crossfade.
   * @param {AnimClipName} name
   * @param {number} [fadeDuration=0.2]
   */
  play(name, fadeDuration = 0.2) {
    if (!this.bound || !this.mixer) return;
    if (!this.enabled) return;
    if (this.locked) return;
    if (this.currentClip === name) return;

    const next = this.actions.get(name);
    if (!next) return;

    const fade = THREE.MathUtils.clamp(fadeDuration, 0, 1);

    // Reset avant crossfade (pour jump notamment)
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);

    if (this.currentAction && fade > 0) {
      this.currentAction.crossFadeTo(next, fade, true);
      next.play();
    } else {
      this.currentAction?.stop();
      next.play();
    }

    this.currentClip = name;
    this.currentAction = next;
  }

  /** Alias legacy */
  playAction(name, fadeDuration) {
    this.play(name, fadeDuration);
  }

  /**
   * Boucle d'update.
   * @param {number} dt
   * @param {number} [speedKmh=0]
   * @param {boolean} [grounded=true]
   */
  update(dt, speedKmh = 0, grounded = true) {
    if (!this.mixer || !this.bound) return;

    if (this.enabled && !this.locked) {
      if (!grounded) {
        this.play('jump', 0.1);
      } else if (speedKmh > SPEED_THRESHOLDS.run) {
        this.play('run', 0.2);
      } else if (speedKmh > SPEED_THRESHOLDS.walk) {
        this.play('walk', 0.2);
      } else {
        this.play('idle', 0.25);
      }
    }

    this.mixer.update(dt);
  }

  /**
   * Active/désactive tout le système.
   * @param {boolean} on
   */
  setEnabled(on) {
    this.enabled = !!on;
    if (!this.mixer) return;

    if (!on) {
      for (const a of this.actions.values()) {
        a.setEffectiveWeight(0);
        a.paused = true;
      }
    } else {
      for (const a of this.actions.values()) a.paused = false;
      if (this.currentAction) this.currentAction.setEffectiveWeight(1);
    }
  }

  /**
   * Bloque/débloque le système pour laisser passer un geste RP.
   * @param {boolean} locked
   */
  lockByGesture(locked) {
    this.locked = !!locked;

    if (!this.mixer) return;

    if (locked) {
      for (const a of this.actions.values()) {
        a.setEffectiveWeight(0);
        a.paused = true;
      }
    } else if (this.currentAction) {
      this.currentAction.reset();
      this.currentAction.paused = false;
      this.currentAction.setEffectiveWeight(1);
      this.currentAction.play();
    }
  }

  /** Nettoyage */
  dispose() {
    if (this.mixer) {
      for (const a of this.actions.values()) a.stop();
      this.mixer.uncacheRoot(this.root);
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    delete this.root.userData.mixer;
    this.actions.clear();
    this.clips.clear();
    this.currentClip = null;
    this.currentAction = null;
    this.bound = false;
  }

  /** Stats pour debug HUD */
  getStats() {
    return {
      sig: SIG,
      mode: this.mode,
      bound: this.bound,
      enabled: this.enabled,
      locked: this.locked,
      clip: this.currentClip,
      clips: [...this.clips.keys()],
    };
  }

  // ─── Accès bas niveau ───────────────────────────────────────────────────
  getMixer() { return this.mixer; }
  getAction(name) { return this.actions.get(name); }
  getActiveClip() { return this.currentClip; }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crée et retourne un système d'animation prêt à l'emploi.
 * @param {THREE.Group} group
 * @param {object} [opts]
 * @returns {CharacterAnimation}
 */
export function setupCharacterAnimations(group, opts) {
  return new CharacterAnimation(group, opts);
}

/**
 * Attache un système si possible (retourne null sinon).
 * @param {THREE.Group} group
 * @returns {CharacterAnimation|null}
 */
export function attachCharacterAnimation(group) {
  return CharacterAnimation.attach(group);
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { SIG, CLIP_NAMES };
export default {
  CharacterAnimation,
  setupCharacterAnimations,
  attachCharacterAnimation,
};
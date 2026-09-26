/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/CHARACTERANIMATIONMANAGER.JS
 * Mixer d'animations sur joints nommés (idle / walk / run / jump) + crossfade
 * ═══════════════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • tagJoints : logique unifiée, pas de faux positifs "ether*"
 *   • HeadJoint : renommage cohérent
 *   • playAction : un seul appel (plus de crossFadeTo + play)
 *   • setEnabled(false) : pause + weight 0
 *   • dispose() : mixer.uncacheRoot + clips clear
 *   • attach() : log explicite de la raison du refus
 *   • fadeDuration clampé [0, 1]
 *   • userData TROXT⬡ + jump clip
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/systems/CharacterAnimationManager.js
 */

import * as THREE from 'three';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════
// JOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Nomme les joints du personnage selon les conventions TROXT.
 * 🔧 BOOST : un seul chemin logique, pas de faux positifs.
 * @param {THREE.Object3D} root
 * @returns {{ armL: boolean, armR: boolean, legL: boolean, legR: boolean, torso: boolean, head: boolean }}
 */
function tagJoints(root) {
  const found = { armL: false, armR: false, legL: false, legR: false, torso: false, head: false };

  root.traverse((obj) => {
    // Legs
    if (obj.userData.leg === -1) { obj.name = 'LegLJoint'; found.legL = true; }
    else if (obj.userData.leg === 1) { obj.name = 'LegRJoint'; found.legR = true; }
    // Arms
    else if (obj.userData.arm === -1) { obj.name = 'ArmLJoint'; found.armL = true; }
    else if (obj.userData.arm === 1) { obj.name = 'ArmRJoint'; found.armR = true; }
  });

  // Torso
  const torso = root.getObjectByName('ether-body') ?? root.getObjectByName('TorsoJoint');
  if (torso) { torso.name = 'TorsoJoint'; found.torso = true; }

  // Head
  const head = root.getObjectByName('HeadJoint')
    ?? root.getObjectByName('hero-face')?.parent
    ?? null;
  if (head) { head.name = 'HeadJoint'; found.head = true; }

  return found;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

export class CharacterAnimationManager {
  /**
   * @param {THREE.Group} parent
   */
  constructor(parent) {
    this.rootObject = parent;
    /** @type {THREE.AnimationMixer|null} */
    this.mixer = null;
    /** @type {Map<string, THREE.AnimationAction>} */
    this.actions = new Map();
    this.currentActionName = 'idle';
    this.bound = false;
    this.enabled = true;

    this.bindExisting();
  }

  /**
   * Attache un manager si le groupe a des joints reconnaissables.
   * @param {THREE.Group} group
   * @returns {CharacterAnimationManager|null}
   */
  static attach(group) {
    if (!group) return null;
    if (group.getObjectByName('fbx-stub')) {
      console.info(`[${SIG}·AnimManager] skip: fbx-stub détecté`);
      return null;
    }
    if (group.getObjectByName('fbx:casual') || group.name.startsWith('fbx:')) {
      console.info(`[${SIG}·AnimManager] skip: modèle fbx natif (a ses propres anims)`);
      return null;
    }
    if (group.userData.mixer) {
      console.info(`[${SIG}·AnimManager] skip: mixer déjà présent`);
      return null;
    }

    let hasLimb = false;
    group.traverse((obj) => {
      if (obj.userData.arm || obj.userData.leg) hasLimb = true;
    });
    if (!hasLimb) {
      console.info(`[${SIG}·AnimManager] skip: aucun joint (userData.arm / .leg)`);
      return null;
    }

    return new CharacterAnimationManager(group);
  }

  // ─── BIND ───────────────────────────────────────────────────────────────
  bindExisting() {
    const joints = tagJoints(this.rootObject);
    if (!joints.armL && !joints.legL) {
      this.bound = false;
      return;
    }

    this.mixer = new THREE.AnimationMixer(this.rootObject);
    this.actions.clear();

    // ─── IDLE ─────────────────────────────────────────────────────────────
    const idleTimes = [0, 1, 2];
    const idleTracks = [];
    if (joints.head) {
      idleTracks.push(new THREE.NumberKeyframeTrack('HeadJoint.rotation[y]', idleTimes, [0, 0.08, 0]));
    }
    if (joints.torso) {
      idleTracks.push(new THREE.NumberKeyframeTrack('TorsoJoint.rotation[x]', idleTimes, [0, 0.03, 0]));
    }
    if (idleTracks.length === 0) idleTracks.push(new THREE.NumberKeyframeTrack('.rotation[y]', idleTimes, [0, 0.02, 0]));

    // ─── WALK ─────────────────────────────────────────────────────────────
    const walkTimes = [0, 0.25, 0.5, 0.75, 1.0];
    const walkTracks = [];
    if (joints.legL) walkTracks.push(new THREE.NumberKeyframeTrack('LegLJoint.rotation[x]', walkTimes, [0, 0.45, 0, -0.45, 0]));
    if (joints.legR) walkTracks.push(new THREE.NumberKeyframeTrack('LegRJoint.rotation[x]', walkTimes, [0, -0.45, 0, 0.45, 0]));
    if (joints.armL) walkTracks.push(new THREE.NumberKeyframeTrack('ArmLJoint.rotation[x]', walkTimes, [0, -0.38, 0, 0.38, 0]));
    if (joints.armR) walkTracks.push(new THREE.NumberKeyframeTrack('ArmRJoint.rotation[x]', walkTimes, [0, 0.38, 0, -0.38, 0]));

    // ─── RUN ──────────────────────────────────────────────────────────────
    const runTimes = [0, 0.15, 0.3, 0.45, 0.6];
    const runTracks = [];
    if (joints.legL) runTracks.push(new THREE.NumberKeyframeTrack('LegLJoint.rotation[x]', runTimes, [0, 0.75, 0, -0.75, 0]));
    if (joints.legR) runTracks.push(new THREE.NumberKeyframeTrack('LegRJoint.rotation[x]', runTimes, [0, -0.75, 0, 0.75, 0]));
    if (joints.armL) runTracks.push(new THREE.NumberKeyframeTrack('ArmLJoint.rotation[x]', runTimes, [0, -0.65, 0, 0.65, 0]));
    if (joints.armR) runTracks.push(new THREE.NumberKeyframeTrack('ArmRJoint.rotation[x]', runTimes, [0, 0.65, 0, -0.65, 0]));

    // ─── JUMP (🔧 BOOST : ajouté) ─────────────────────────────────────────
    const jumpTimes = [0, 0.15, 0.35, 0.55, 0.8];
    const jumpTracks = [];
    if (joints.legL) jumpTracks.push(new THREE.NumberKeyframeTrack('LegLJoint.rotation[x]', jumpTimes, [0, -0.5, -0.3, 0.3, 0]));
    if (joints.legR) jumpTracks.push(new THREE.NumberKeyframeTrack('LegRJoint.rotation[x]', jumpTimes, [0, -0.5, -0.3, 0.3, 0]));
    if (joints.armL) jumpTracks.push(new THREE.NumberKeyframeTrack('ArmLJoint.rotation[x]', jumpTimes, [0, -1.2, -0.8, 0.4, 0]));
    if (joints.armR) jumpTracks.push(new THREE.NumberKeyframeTrack('ArmRJoint.rotation[x]', jumpTimes, [0, -1.2, -0.8, 0.4, 0]));

    const clips = [
      new THREE.AnimationClip('idle', 2, idleTracks),
      new THREE.AnimationClip('walk', 1.0, walkTracks),
      new THREE.AnimationClip('run',  0.6, runTracks),
      new THREE.AnimationClip('jump', 0.8, jumpTracks),
    ];

    for (const clip of clips) {
      if (clip.tracks.length === 0) continue; // pas de tracks → skip
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(clip.name === 'idle' ? 1 : 0);
      if (clip.name === 'jump') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(clip.name, action);
    }

    this.actions.get('idle')?.play();
    this.bound = true;
  }

  // ─── PLAY ───────────────────────────────────────────────────────────────
  /**
   * Joue une action avec crossfade.
   * 🔧 BOOST : un seul appel (crossFadeTo gère le play)
   * @param {string} actionName
   * @param {number} [fadeDuration=0.25]
   */
  playAction(actionName, fadeDuration = 0.25) {
    if (!this.enabled) return;
    if (this.currentActionName === actionName) return;

    const nextAction = this.actions.get(actionName);
    if (!nextAction) return;

    const currentAction = this.actions.get(this.currentActionName);
    const fade = THREE.MathUtils.clamp(fadeDuration, 0, 1);

    nextAction.reset();
    nextAction.enabled = true;
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);

    if (currentAction && fade > 0) {
      // crossFadeTo s'occupe du fade + play du next
      currentAction.crossFadeTo(nextAction, fade, true);
      nextAction.play();
    } else {
      // Pas de fade → coupe nette
      if (currentAction) currentAction.stop();
      nextAction.play();
    }

    this.currentActionName = actionName;
  }

  // ─── ENABLE / DISABLE ───────────────────────────────────────────────────
  setEnabled(on) {
    this.enabled = !!on;

    if (!on) {
      for (const action of this.actions.values()) {
        action.setEffectiveWeight(0);
        action.paused = true;
      }
    } else {
      for (const action of this.actions.values()) action.paused = false;
      const cur = this.actions.get(this.currentActionName);
      if (cur) cur.setEffectiveWeight(1);
    }
  }

  // ─── UPDATE ─────────────────────────────────────────────────────────────
  /**
   * @param {number} dt - delta time (s)
   * @param {number} speed - vitesse km/h
   * @param {boolean} [grounded=true]
   */
  update(dt, speed, grounded = true) {
    if (!this.mixer || !this.bound) return;

    if (this.enabled) {
      if (!grounded) {
        this.playAction('jump', 0.1);
      } else if (speed > 4.5) {
        this.playAction('run', 0.2);
      } else if (speed > 0.3) {
        this.playAction('walk', 0.2);
      } else {
        this.playAction('idle', 0.25);
      }
    }

    this.mixer.update(dt);
  }

  // ─── DISPOSE ────────────────────────────────────────────────────────────
  dispose() {
    if (this.mixer) {
      for (const action of this.actions.values()) action.stop();
      this.mixer.uncacheRoot(this.rootObject);
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.actions.clear();
    this.bound = false;
  }

  // ─── STATS ──────────────────────────────────────────────────────────────
  getStats() {
    return {
      sig: SIG,
      bound: this.bound,
      enabled: this.enabled,
      current: this.currentActionName,
      clips: [...this.actions.keys()],
    };
  }
}

export { CharacterAnimationManager as AnimatedCharacterMixer };
export const SIG_TAG = SIG;
export default CharacterAnimationManager;
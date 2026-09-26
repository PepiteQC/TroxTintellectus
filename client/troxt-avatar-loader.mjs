/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CLIENT/TROXT-AVATAR-LOADER.MJS
 * Loader d'avatar universel — Mixamo, Ready Player Me, GLB/FBX custom
 * ═══════════════════════════════════════════════════════════════════
 * Charge un personnage riggé + ses animations et les mappe automatiquement
 * vers les états TROXT (idle, walk, run, jump, aim, fire, car_enter...).
 *
 * Signature : TROXT⬡
 * Chemin    : client/troxt-avatar-loader.mjs
 *
 * Utilise optionnellement un AvatarCache (IndexedDB) pour éviter
 * de re-télécharger les GLB/FBX à chaque connexion.
 */

import { AvatarCache } from './troxt-avatar-cache.mjs';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════
// TABLE DE MAPPING MIXAMO → ÉTATS TROXT
// ═══════════════════════════════════════════════════════════════════
export const MIXAMO_MAP = {
  // Locomotion
  'idle':                 'idle',
  'breathing idle':       'idle',
  'idle look around':     'idle_look',
  'walking':              'walk',
  'walk':                 'walk',
  'running':              'run',
  'run':                  'run',
  'fast run':             'sprint',
  'sprint':               'sprint',
  'walking backwards':    'walk_back',
  'left strafe walk':     'strafe_left',
  'right strafe walk':    'strafe_right',
  'left strafe':          'strafe_left',
  'right strafe':         'strafe_right',
  'crouch idle':          'crouch_idle',
  'crouched walking':     'crouch_walk',
  // Air
  'jump':                 'jump_start',
  'jumping up':           'jump_start',
  'falling idle':         'jump_air',
  'falling':              'fall',
  'jump land':            'jump_land',
  'hard landing':         'jump_land_roll',
  'landing':              'jump_land',
  // Combat / visée
  'rifle aiming idle':    'aim_idle',
  'aiming':               'aim_idle',
  'pistol idle':          'aim_idle',
  'rifle walk':           'aim_walk',
  'firing rifle':         'fire',
  'firing':               'fire',
  'reload':               'reload',
  'reloading':            'reload',
  'punching':             'melee_punch',
  'punch':                'melee_punch',
  'hit reaction':         'hit_react',
  'standing react':       'hit_react',
  'death':                'death',
  'dying':                'death',
  'falling back death':   'death',
  // Véhicule
  'sitting':              'vehicle_sit',
  'car enter':            'vehicle_enter',
  'sit':                  'vehicle_sit',
  'driving':              'vehicle_drive',
  'car exit':             'vehicle_exit',
  'stand up':             'vehicle_exit',
  // Travail
  'digging':              'work_dig',
  'dig':                  'work_dig',
  'hammering':            'work_hammer',
  'using tool':           'work_hammer',
  'lifting':              'work_lift',
  'picking up box':       'work_lift',
  'carrying':             'carry_idle',
  'walk carry':           'carry_walk',
  'typing':               'work_type',
  'cooking':              'work_cook',
  'kneeling':             'work_medic',
  'arrest':               'work_arrest',
  // Interactions
  'interact':             'interact',
  'opening door':         'open_door',
  'picking up':           'pickup',
  'sitting down':         'sit',
  'sit idle':             'sit_idle',
  'waving':               'wave',
  'wave':                 'wave',
  'pointing':             'point',
  'point':                'point',
  'dancing':              'dance',
  'dance':                'dance',
  'hip hop dancing':      'dance',
};

// ═══════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════
function normalizeName(name) {
  return String(name)
    .replace(/\.(fbx|glb|gltf)$/i, '')
    .replace(/mixamo\.com/gi, '')
    .replace(/[_|-]/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function resolveAnimState(name) {
  const norm = normalizeName(name);
  if (MIXAMO_MAP[norm]) return MIXAMO_MAP[norm];
  for (const [key, state] of Object.entries(MIXAMO_MAP)) {
    if (norm.includes(key) || key.includes(norm)) return state;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// AVATAR LOADER
// ═══════════════════════════════════════════════════════════════════
export class AvatarLoader {
  constructor({ THREE, GLTFLoader, FBXLoader, DRACOLoader, cache = null } = {}) {
    if (!THREE) throw new Error('THREE requis');
    this.THREE = THREE;
    this.sig = SIG;
    this._gltf = GLTFLoader ? new GLTFLoader() : null;
    this._fbx  = FBXLoader ? new FBXLoader() : null;
    this.cache = cache || new AvatarCache();

    if (DRACOLoader && this._gltf) {
      const d = new DRACOLoader();
      d.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      this._gltf.setDRACOLoader(d);
    }
  }

  /**
   * Charge un fichier via URL.
   * 1. Check cache IndexedDB → si hit : parse(buffer)
   * 2. Sinon : fetch + parse + store dans cache
   */
  async _loadFile(url, { onProgress } = {}) {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    const loader = (ext === 'fbx') ? this._fbx : this._gltf;
    if (!loader) throw new Error(`Loader manquant pour .${ext}`);

    // 1. Cache hit → parse directement depuis buffer
    const cachedBuffer = await this.cache.get(url);
    if (cachedBuffer) {
      return this._parseBuffer(loader, cachedBuffer, ext, url);
    }

    // 2. Fetch avec progress
    const buffer = await this._fetchBuffer(url, onProgress);

    // 3. Store en cache (en arrière-plan, non-bloquant)
    this.cache.set(url, buffer).catch(() => {});

    // 4. Parse
    return this._parseBuffer(loader, buffer, ext, url);
  }

  /** Fetch un ArrayBuffer avec callback de progression. */
  _fetchBuffer(url, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';

      if (onProgress) {
        xhr.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress({ loaded: e.loaded, total: e.total, pct: e.loaded / e.total });
          } else {
            onProgress({ loaded: e.loaded, total: 0, pct: 0 });
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response);
        } else {
          reject(new Error(`${url}: HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error(`${url}: network error`));
      xhr.send();
    });
  }

  /** Parse un ArrayBuffer en Object3D (avec animations). */
  _parseBuffer(loader, buffer, ext, url) {
    return new Promise((resolve, reject) => {
      try {
        loader.parse(
          buffer,
          '',
          (result) => {
            const scene = result.scene || result;
            const animations = result.animations || scene.animations || [];
            resolve({ scene, animations });
          },
          (err) => reject(new Error(`${url}: ${err?.message || err}`))
        );
      } catch (err) {
        reject(new Error(`${url}: ${err?.message || err}`));
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHARGEMENT AVATAR MIXAMO (corps + anims séparées)
  // ═══════════════════════════════════════════════════════════════════
  async loadMixamo({ body, animations = {}, scale = 1, onProgress }) {
    const { THREE } = this;

    // 1. Corps
    const { scene: root } = await this._loadFile(body, { onProgress });
    root.scale.setScalar(scale);
    root.traverse((c) => {
      if (c.isMesh || c.isSkinnedMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        c.frustumCulled = false;
      }
    });

    // 2. Mixer + clips
    const mixer = new THREE.AnimationMixer(root);
    const clips = {};
    const actions = {};

    // Cas A : le body contient déjà des clips
    const bodyResult = await this._loadFile(body, {}); // hit le cache
    if (bodyResult.animations?.length) {
      for (const clip of bodyResult.animations) {
        const state = resolveAnimState(clip.name);
        if (state) clips[state] = clip;
      }
    }

    // Cas B : anims séparées
    for (const [key, url] of Object.entries(animations)) {
      try {
        const { animations: clipList } = await this._loadFile(url, { onProgress });
        if (!clipList.length) continue;
        const clip = clipList[0];
        const state = MIXAMO_MAP[key] || resolveAnimState(key) || resolveAnimState(clip.name) || key;
        clip.name = state;
        clips[state] = clip;
      } catch (e) {
        console.warn(`[${SIG}·Avatar] Anim "${key}" ignorée: ${e.message}`);
      }
    }

    // 3. Crée les actions
    for (const [state, clip] of Object.entries(clips)) {
      actions[state] = mixer.clipAction(clip);
    }

    console.log(`[${SIG}·Avatar] Chargé: ${Object.keys(clips).length} animations mappées`);

    return this._makeAvatar(root, mixer, clips, actions);
  }

  // ═══════════════════════════════════════════════════════════════════
  // AVATAR SIMPLE (tout-en-un GLB)
  // ═══════════════════════════════════════════════════════════════════
  async loadGLB({ url, scale = 1, onProgress }) {
    const { THREE } = this;
    const { scene: root, animations } = await this._loadFile(url, { onProgress });

    root.scale.setScalar(scale);
    root.traverse((c) => {
      if (c.isMesh || c.isSkinnedMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    const mixer = new THREE.AnimationMixer(root);
    const clips = {};
    const actions = {};

    for (const clip of (animations || [])) {
      const state = resolveAnimState(clip.name) || clip.name;
      clips[state] = clip;
      actions[state] = mixer.clipAction(clip);
    }

    console.log(`[${SIG}·Avatar] GLB chargé: ${Object.keys(clips).length} clips`);

    return this._makeAvatar(root, mixer, clips, actions);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONSTRUCTION DE L'AVATAR (FIX : closure, pas de `this._current` cassé)
  // ═══════════════════════════════════════════════════════════════════
  _makeAvatar(root, mixer, clips, actions) {
    // État interne à CET avatar (pas au loader)
    const state = { current: null, currentName: null };

    const avatar = {
      root,
      mixer,
      clips,
      actions,
      states: Object.keys(clips),

      /** Joue un état avec crossfade. */
      playState(name, fade = 0.2) {
        const next = actions[name];
        if (!next) return false;

        if (state.current && state.current !== next) {
          next.reset().play();
          state.current.crossFadeTo(next, fade, false);
        } else {
          next.reset().play();
        }
        state.current = next;
        state.currentName = name;
        return true;
      },

      /** Arrête un état avec fade-out. */
      stopState(name, fade = 0.2) {
        const a = actions[name];
        if (a) a.fadeOut(fade);
      },

      /** Vitesse d'un état. */
      setStateSpeed(name, timeScale) {
        const a = actions[name];
        if (a) a.setEffectiveTimeScale(timeScale);
      },

      /** État courant. */
      getCurrentState() {
        return state.currentName;
      },

      /** Libère la mémoire. */
      dispose() {
        mixer.stopAllAction();
        root.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => {
              Object.values(m).forEach((v) => { if (v?.isTexture) v.dispose(); });
              m.dispose();
            });
          }
        });
      },
    };

    return avatar;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ADAPTATEUR POUR CharacterAnimator
  // ═══════════════════════════════════════════════════════════════════
  static makeAnimatorAdapter(avatar) {
    return {
      playAnimation: (_id, state) => avatar.playState(state, 0.2),
      setAnimationSpeed: (_id, ts) => {
        const cur = avatar.getCurrentState();
        if (cur) avatar.setStateSpeed(cur, ts);
      },
      solveIK: () => {},
      move: () => {},
      getState: () => avatar.getCurrentState(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // UTILITAIRES CACHE
  // ═══════════════════════════════════════════════════════════════════
  async cacheStats() { return this.cache.stats(); }
  async clearCache() { return this.cache.clear(); }
  async pruneCache() { return this.cache.prune(); }
}

export { SIG };
export default AvatarLoader;
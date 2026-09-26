// src/troxtmod3d/AvatarLoader.mjs
// ETHERWORLD RP — AvatarLoader v2 (Mixamo + GLB + retargeting)

export const SIG = 'TROXT⬡';

export const MIXAMO_MAP = {
  'idle':'idle', 'breathing idle':'idle', 'walking':'walk', 'walk':'walk',
  'running':'run', 'run':'run', 'sprint':'sprint', 'fast run':'sprint',
  'walking backwards':'walk_back', 'left strafe walk':'strafe_left', 'right strafe walk':'strafe_right',
  'jump':'jump_start', 'jumping up':'jump_start', 'falling idle':'jump_air',
  'jump land':'jump_land', 'hard landing':'jump_land_roll',
  'rifle aiming idle':'aim_idle', 'firing rifle':'fire', 'reload':'reload',
  'punching':'melee_punch', 'hit reaction':'hit_react', 'death':'death', 'dying':'death',
  'sitting':'vehicle_sit', 'car enter':'vehicle_enter', 'driving':'vehicle_drive',
  'digging':'work_dig', 'hammering':'work_hammer', 'lifting':'work_lift',
  'interact':'interact', 'opening door':'open_door', 'waving':'wave', 'dancing':'dance',
};

const normalizeName = (name) =>
  String(name).replace(/\.(fbx|glb|gltf)$/i, '').replace(/mixamo\.com/gi, '')
    .replace(/[_|-]/g, ' ').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

export function resolveAnimState(name) {
  const norm = normalizeName(name);
  if (MIXAMO_MAP[norm]) return MIXAMO_MAP[norm];
  for (const [key, state] of Object.entries(MIXAMO_MAP)) {
    if (norm.includes(key) || key.includes(norm)) return state;
  }
  return null;
}

export class AvatarLoader {
  constructor({ THREE, GLTFLoader, FBXLoader, DRACOLoader } = {}) {
    if (!THREE) throw new Error('THREE requis');
    this.THREE = THREE;
    this.sig = SIG;
    this._gltf = GLTFLoader ? new GLTFLoader() : null;
    this._fbx = FBXLoader ? new FBXLoader() : null;
    if (DRACOLoader && this._gltf) {
      const d = new DRACOLoader();
      d.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      this._gltf.setDRACOLoader(d);
    }
  }

  _loadFile(url) {
    const ext = url.split('.').pop().toLowerCase();
    return new Promise((resolve, reject) => {
      const loader = ext === 'fbx' ? this._fbx : this._gltf;
      if (!loader) return reject(new Error(`Loader manquant pour .${ext}`));
      loader.load(url, (res) => resolve(res.scene || res), undefined, (e) => reject(new Error(`${url}: ${e.message || e}`)));
    });
  }

  async loadMixamo({ body, animations = {}, scale = 1 }) {
    const { THREE } = this;
    const root = await this._loadFile(body);
    root.scale.setScalar(scale);
    root.traverse((c) => { if (c.isMesh || c.isSkinnedMesh) { c.castShadow = true; c.receiveShadow = true; c.frustumCulled = false; } });

    const mixer = new THREE.AnimationMixer(root);
    const clips = {}, actions = {};

    if (root.animations?.length) {
      for (const clip of root.animations) {
        const state = resolveAnimState(clip.name);
        if (state) clips[state] = clip;
      }
    }

    for (const [key, url] of Object.entries(animations)) {
      try {
        const animRoot = await this._loadFile(url);
        const list = animRoot.animations || [];
        if (!list.length) continue;
        const clip = list[0];
        const state = MIXAMO_MAP[key] || resolveAnimState(key) || resolveAnimState(clip.name) || key;
        clip.name = state;
        clips[state] = clip;
      } catch (e) {
        console.warn(`[${SIG}·Avatar] Anim "${key}" ignorée: ${e.message}`);
      }
    }

    for (const [state, clip] of Object.entries(clips)) actions[state] = mixer.clipAction(clip);

    const avatar = { root, mixer, clips, actions, states: Object.keys(clips), _current: null };
    avatar.playState = (state, fade = 0.2) => {
      const next = actions[state];
      if (!next) return false;
      if (avatar._current && avatar._current !== next) {
        next.reset().play();
        avatar._current.crossFadeTo(next, fade, false);
      } else {
        next.reset().play();
      }
      avatar._current = next;
      return true;
    };
    return avatar;
  }

  async loadGLB({ url, scale = 1 }) {
    const { THREE } = this;
    const root = await this._loadFile(url);
    root.scale.setScalar(scale);
    root.traverse((c) => { if (c.isMesh || c.isSkinnedMesh) { c.castShadow = true; c.receiveShadow = true; } });
    const mixer = new THREE.AnimationMixer(root);
    const clips = {}, actions = {};
    for (const clip of (root.animations || [])) {
      const state = resolveAnimState(clip.name) || clip.name;
      clips[state] = clip;
      actions[state] = mixer.clipAction(clip);
    }
    const avatar = { root, mixer, clips, actions, states: Object.keys(clips), _current: null };
    avatar.playState = (state, fade = 0.2) => {
      const next = actions[state];
      if (!next) return false;
      if (avatar._current && avatar._current !== next) {
        next.reset().play();
        avatar._current.crossFadeTo(next, fade, false);
      } else {
        next.reset().play();
      }
      avatar._current = next;
      return true;
    };
    return avatar;
  }

  static makeAnimatorAdapter(avatar) {
    return {
      playAnimation: (_id, state) => avatar.playState(state, 0.2),
      setAnimationSpeed: (_id, ts) => { if (avatar._current) avatar._current.timeScale = ts; },
      solveIK: () => {},
      move: () => {},
    };
  }
}

export default AvatarLoader;
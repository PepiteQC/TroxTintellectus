/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CORE/TROXT-ENGINE-ADAPTER.MJS
 * Adaptateur moteur 3D agnostique — Three.js OU Babylon.js
 * ═══════════════════════════════════════════════════════════════════
 * Une seule API pour charger GLB/FBX, spawner joueurs/véhicules,
 * peu importe le moteur. Le reste du code parle au kernel, jamais
 * directement au moteur → tu peux switcher Three ↔ Babylon sans
 * toucher la logique RP.
 *
 * Signature : TROXT⬡
 * Chemin    : core/troxt-engine-adapter.mjs
 *
 * // Three.js
 * import { ThreeAdapter } from './core/troxt-engine-adapter.mjs';
 * const engine = new ThreeAdapter({ THREE, scene, GLTFLoader, FBXLoader });
 *
 * // Babylon.js
 * import { BabylonAdapter } from './core/troxt-engine-adapter.mjs';
 * const engine = new BabylonAdapter({ BABYLON, scene });
 *
 * kernel.register('engine', engine);
 */

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════
// INTERFACE COMMUNE (contrat)
// ═══════════════════════════════════════════════════════════════════
// Tout adaptateur expose :
//   loadModel(url, opts) → Promise<handle>
//   spawn(handle, pos, rot) → id
//   move(id, pos, rot)
//   remove(id)
//   setVisible(id, bool)
//   tick(dt)
//   dispose()

// ═══════════════════════════════════════════════════════════════════
// THREE.JS ADAPTER
// ═══════════════════════════════════════════════════════════════════
export class ThreeAdapter {
  constructor({ THREE, scene, GLTFLoader, FBXLoader, DRACOLoader } = {}) {
    if (!THREE || !scene) throw new Error('THREE + scene requis');
    this.THREE   = THREE;
    this.scene   = scene;
    this.sig     = SIG;
    this.engine  = 'three';

    this._gltfLoader = GLTFLoader ? new GLTFLoader() : null;
    this._fbxLoader  = FBXLoader ? new FBXLoader() : null;
    if (DRACOLoader && this._gltfLoader) {
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      this._gltfLoader.setDRACOLoader(draco);
    }

    this._cache   = new Map();   // url → modèle template
    this._objects = new Map();   // id → { obj, mixer }
    this._idCounter = 0;
    this._mixers  = [];
  }

  // ─── CHARGEMENT GLB/GLTF/FBX ───────────────────────────────────────────────
  async loadModel(url, opts = {}) {
    if (this._cache.has(url)) return { url, cached: true };
    const ext = url.split('.').pop().toLowerCase();

    return new Promise((resolve, reject) => {
      const onLoad = (result) => {
        // GLTF renvoie { scene, animations }, FBX renvoie un Group direct
        const root = result.scene || result;
        const animations = result.animations || root.animations || [];
        root.traverse?.((c) => {
          if (c.isMesh) { c.castShadow = opts.castShadow ?? true; c.receiveShadow = opts.receiveShadow ?? true; }
        });
        this._cache.set(url, { root, animations });
        console.log(`[${SIG}·Three] Modèle chargé: ${url} (${animations.length} anims)`);
        resolve({ url, animations: animations.map(a => a.name) });
      };
      const onErr = (e) => reject(new Error(`Échec chargement ${url}: ${e.message || e}`));

      if (ext === 'glb' || ext === 'gltf') {
        if (!this._gltfLoader) return reject(new Error('GLTFLoader non fourni'));
        this._gltfLoader.load(url, onLoad, undefined, onErr);
      } else if (ext === 'fbx') {
        if (!this._fbxLoader) return reject(new Error('FBXLoader non fourni'));
        this._fbxLoader.load(url, onLoad, undefined, onErr);
      } else {
        reject(new Error(`Format non supporté: ${ext}`));
      }
    });
  }

  // ─── SPAWN ─────────────────────────────────────────────────────────────────
  spawn(url, pos = { x:0,y:0,z:0 }, rot = { x:0,y:0,z:0 }, opts = {}) {
    const tpl = this._cache.get(url);
    if (!tpl) { console.warn(`[${SIG}·Three] Modèle non chargé: ${url}`); return null; }

    const obj = tpl.root.clone(true);
    obj.position.set(pos.x, pos.y, pos.z);
    obj.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
    if (opts.scale) obj.scale.setScalar(opts.scale);

    // Animations
    let mixer = null;
    if (tpl.animations.length && opts.animate !== false) {
      mixer = new this.THREE.AnimationMixer(obj);
      if (opts.clip) {
        const clip = tpl.animations.find(a => a.name === opts.clip) || tpl.animations[0];
        mixer.clipAction(clip).play();
      }
      this._mixers.push(mixer);
    }

    const id = opts.id || `obj_${++this._idCounter}`;
    this._objects.set(id, { obj, mixer, url });
    this.scene.add(obj);
    return id;
  }

  move(id, pos, rot) {
    const e = this._objects.get(id);
    if (!e) return;
    if (pos) e.obj.position.set(pos.x, pos.y, pos.z);
    if (rot) e.obj.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
  }

  remove(id) {
    const e = this._objects.get(id);
    if (!e) return;
    this.scene.remove(e.obj);
    if (e.mixer) {
      const i = this._mixers.indexOf(e.mixer);
      if (i >= 0) this._mixers.splice(i, 1);
    }
    this._objects.delete(id);
  }

  setVisible(id, v) { const e = this._objects.get(id); if (e) e.obj.visible = v; }

  playAnimation(id, clipName) {
    const e = this._objects.get(id);
    if (!e || !e.mixer) return;
    const tpl = this._cache.get(e.url);
    const clip = tpl?.animations.find(a => a.name === clipName);
    if (!clip) return;
    const next = e.mixer.clipAction(clip);
    // Crossfade fluide depuis l'action courante
    if (e._current && e._current !== next) {
      next.reset().play();
      e._current.crossFadeTo(next, 0.2, false);
    } else {
      next.reset().play();
    }
    e._current = next;
  }

  // Contrôle la vitesse de lecture (sync anim ↔ vitesse réelle = pas de glissement)
  setAnimationSpeed(id, timeScale) {
    const e = this._objects.get(id);
    if (e?._current) e._current.timeScale = timeScale;
  }

  // Solveur IK — foot placement, aim, hands (nécessite un rig avec os nommés)
  solveIK(id, req) {
    const e = this._objects.get(id);
    if (!e || !e.obj) return;
    // Hook : brancher three-ik ou FullBodyIK ici. Structure prête :
    //   req.foot = { left: Vec3, right: Vec3 }
    //   req.aim  = { target: Vec3, weight: 0..1 }
    //   req.hands= { left: Vec3, right: Vec3 }
    // Aim simple : oriente la tête/torse vers la cible (sans lib externe)
    if (req.aim?.target && e._bones?.head) {
      e._bones.head.lookAt(req.aim.target.x, req.aim.target.y, req.aim.target.z);
    }
    e._ikRequest = req;   // le solveur détaillé peut lire ceci par frame
  }

  // Indexe les os utiles pour l'IK (à appeler après spawn)
  indexBones(id) {
    const e = this._objects.get(id);
    if (!e) return;
    e._bones = {};
    const names = { head:/head/i, spine:/spine|chest/i, footL:/foot.*l|l.*foot/i, footR:/foot.*r|r.*foot/i,
                    handL:/hand.*l|l.*hand/i, handR:/hand.*r|r.*hand/i };
    e.obj.traverse((c) => {
      if (!c.isBone) return;
      for (const [key, rx] of Object.entries(names)) if (rx.test(c.name) && !e._bones[key]) e._bones[key] = c;
    });
  }

  tick(dt) { for (const m of this._mixers) m.update(dt); }

  dispose() {
    for (const id of [...this._objects.keys()]) this.remove(id);
    this._cache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════
// BABYLON.JS ADAPTER
// ═══════════════════════════════════════════════════════════════════
export class BabylonAdapter {
  constructor({ BABYLON, scene } = {}) {
    if (!BABYLON || !scene) throw new Error('BABYLON + scene requis');
    this.BABYLON = BABYLON;
    this.scene   = scene;
    this.sig     = SIG;
    this.engine  = 'babylon';

    this._cache   = new Map();
    this._objects = new Map();
    this._idCounter = 0;
  }

  // Babylon charge GLB/GLTF/FBX via SceneLoader (FBX nécessite le plugin)
  async loadModel(url, opts = {}) {
    if (this._cache.has(url)) return { url, cached: true };
    const { BABYLON } = this;
    const lastSlash = url.lastIndexOf('/') + 1;
    const rootUrl = url.slice(0, lastSlash);
    const fileName = url.slice(lastSlash);

    const result = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, this.scene);
    // Cache le mesh racine désactivé (template)
    result.meshes.forEach(m => { m.setEnabled(false); m.receiveShadows = opts.receiveShadow ?? true; });
    this._cache.set(url, result);
    console.log(`[${SIG}·Babylon] Modèle chargé: ${url} (${result.animationGroups.length} anims)`);
    return { url, animations: result.animationGroups.map(a => a.name) };
  }

  spawn(url, pos = { x:0,y:0,z:0 }, rot = { x:0,y:0,z:0 }, opts = {}) {
    const tpl = this._cache.get(url);
    if (!tpl) { console.warn(`[${SIG}·Babylon] Modèle non chargé: ${url}`); return null; }
    const { BABYLON } = this;

    // Clone le mesh racine
    const src = tpl.meshes[0];
    const clone = src.clone(`clone_${++this._idCounter}`);
    clone.setEnabled(true);
    clone.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    clone.rotation = new BABYLON.Vector3(rot.x || 0, rot.y || 0, rot.z || 0);
    if (opts.scale) clone.scaling = new BABYLON.Vector3(opts.scale, opts.scale, opts.scale);

    const id = opts.id || `obj_${this._idCounter}`;
    this._objects.set(id, { obj: clone, url, animGroups: tpl.animationGroups });

    if (tpl.animationGroups.length && opts.animate !== false) {
      const grp = opts.clip
        ? tpl.animationGroups.find(a => a.name === opts.clip)
        : tpl.animationGroups[0];
      grp?.start(true);
    }
    return id;
  }

  move(id, pos, rot) {
    const e = this._objects.get(id);
    if (!e) return;
    const { BABYLON } = this;
    if (pos) e.obj.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    if (rot) e.obj.rotation = new BABYLON.Vector3(rot.x || 0, rot.y || 0, rot.z || 0);
  }

  remove(id) {
    const e = this._objects.get(id);
    if (!e) return;
    e.obj.dispose();
    this._objects.delete(id);
  }

  setVisible(id, v) { const e = this._objects.get(id); if (e) e.obj.setEnabled(v); }

  playAnimation(id, clipName) {
    const e = this._objects.get(id);
    if (!e) return;
    e.animGroups?.forEach(g => g.stop());
    e.animGroups?.find(g => g.name === clipName)?.start(true);
  }

  tick() { /* Babylon gère ses anims via son propre render loop */ }

  dispose() {
    for (const id of [...this._objects.keys()]) this.remove(id);
    this._cache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════
// FABRIQUE — détecte le moteur
// ═══════════════════════════════════════════════════════════════════
export function createEngineAdapter(config) {
  if (config.BABYLON) return new BabylonAdapter(config);
  if (config.THREE)   return new ThreeAdapter(config);
  throw new Error('Fournis THREE ou BABYLON dans la config');
}

export { SIG };
export default createEngineAdapter;

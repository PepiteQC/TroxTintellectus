/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CLIENT/TROXT-AVATAR-MANAGER.MJS
 * Gestionnaire multi-avatars — joueur local + PNJ + autres joueurs
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/troxt-avatar-manager.mjs
 *
 * Utilise AvatarLoader (qui utilise AvatarCache en interne) pour
 * gérer plusieurs avatars simultanément avec un seul mixer central.
 */

import { AvatarLoader } from './troxt-avatar-loader.mjs';
import { AvatarCache } from './troxt-avatar-cache.mjs';

const SIG = 'TROXT⬡';

export class AvatarManager {
  constructor({ THREE, GLTFLoader, FBXLoader, DRACOLoader, cache = null } = {}) {
    if (!THREE) throw new Error('THREE requis');
    this.sig = SIG;
    this.THREE = THREE;

    this.cache = cache || new AvatarCache();
    this.loader = new AvatarLoader({
      THREE,
      GLTFLoader,
      FBXLoader,
      DRACOLoader,
      cache: this.cache,
    });

    /** @type {Map<string, object>} id → avatar */
    this.avatars = new Map();
  }

  /**
   * Spawn un avatar.
   * @param {string} id              identifiant unique (player_id, npc_id...)
   * @param {object} config          { body, animations, scale } OU { url, scale }
   * @param {THREE.Scene} [parent]   scène à laquelle attacher le mesh
   * @returns {Promise<object>} avatar
   */
  async spawn(id, config, parent = null) {
    if (this.avatars.has(id)) {
      console.warn(`[${SIG}·Manager] Avatar "${id}" existe déjà`);
      return this.avatars.get(id);
    }

    const avatar = config.body
      ? await this.loader.loadMixamo(config)
      : await this.loader.loadGLB(config);

    avatar.id = id;

    if (parent) parent.add(avatar.root);

    this.avatars.set(id, avatar);
    console.log(`[${SIG}·Manager] Spawn "${id}" (${avatar.states.length} états)`);
    return avatar;
  }

  /** Récupère un avatar. */
  get(id) {
    return this.avatars.get(id) || null;
  }

  /** Vérifie si un avatar existe. */
  has(id) {
    return this.avatars.has(id);
  }

  /** Supprime un avatar (retire de la scène + dispose). */
  remove(id) {
    const avatar = this.avatars.get(id);
    if (!avatar) return false;

    avatar.root.parent?.remove(avatar.root);
    avatar.dispose?.();
    this.avatars.delete(id);
    console.log(`[${SIG}·Manager] Remove "${id}"`);
    return true;
  }

  /** Joue un état sur un avatar spécifique. */
  playState(id, stateName, fade = 0.2) {
    const avatar = this.avatars.get(id);
    if (!avatar) return false;
    return avatar.playState(stateName, fade);
  }

  /**
   * Update global : tick tous les mixers.
   * À appeler dans ta boucle de jeu.
   */
  update(delta) {
    for (const avatar of this.avatars.values()) {
      avatar.mixer.update(delta);
    }
  }

  /** Nombre d'avatars actifs. */
  get size() {
    return this.avatars.size;
  }

  /** Liste les IDs. */
  list() {
    return Array.from(this.avatars.keys());
  }

  /**
   * Précharge plusieurs avatars en parallèle (utile au démarrage).
   * @param {Array<{id, config, parent}>} items
   */
  async preload(items) {
    const results = await Promise.allSettled(
      items.map(({ id, config, parent }) => this.spawn(id, config, parent))
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`[${SIG}·Manager] Preload: ${ok}/${items.length} avatars prêts`);
    return results;
  }

  /** Supprime tous les avatars. */
  clear() {
    for (const id of this.list()) this.remove(id);
  }

  /** Cache */
  async cacheStats() { return this.cache.stats(); }
  async clearCache() { await this.cache.clear(); }
  async pruneCache() { return this.cache.prune(); }

  /** Dispose tout (avatars + cache). */
  dispose() {
    this.clear();
  }
}

export { SIG };
export default AvatarManager;
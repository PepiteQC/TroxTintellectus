/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/REGIONSYSTEM.JS
 * Système de régions protégées (style WorldGuard ultra-léger)
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server\intellectus\admin\systems/RegionSystem.js
 */

const SIG = 'TROXT⬡';

/**
 * @typedef {object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 *
 * @typedef {'build' | 'pvp' | 'enter' | 'mob_spawn' | 'fire_spread' | 'explosions'} RegionFlag
 *
 * @typedef {object} Region
 * @property {string} id
 * @property {string} name
 * @property {Vec3} min
 * @property {Vec3} max
 * @property {number} priority
 * @property {string[]} owners
 * @property {string[]} members
 * @property {Partial<Record<RegionFlag, boolean>>} flags
 * @property {number} createdAt
 */

const DEFAULT_FLAGS = Object.freeze({
  build:       false, // Bloqué par défaut dans une zone de protection
  pvp:         true,
  enter:       true,
  mob_spawn:   true,
  fire_spread: true,
  explosions:  false,
});

/**
 * Calcule l'AABB (Axis-Aligned Bounding Box) normalisé de deux coordonnées 3D.
 * @param {Vec3} a 
 * @param {Vec3} b 
 * @returns {{ min: Vec3, max: Vec3 }}
 */
function normalize(a, b) {
  return {
    min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) },
    max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) },
  };
}

export class RegionSystem {
  constructor() {
    /** @type {Map<string, Region>} */
    this.regions = new Map();
    this.sig = SIG;
  }

  /**
   * Crée ou écrase une région de protection tridimensionnelle.
   * @param {string} id 
   * @param {string} name 
   * @param {Vec3} a 
   * @param {Vec3} b 
   * @param {object} [options] 
   * @param {number} [options.priority=0] 
   * @param {string} [options.owner] 
   * @returns {Region}
   */
  define(id, name, a, b, options = {}) {
    const { min, max } = normalize(a, b);
    const region = {
      id,
      name,
      min,
      max,
      priority: options.priority ?? 0,
      owners: options.owner ? [options.owner] : [],
      members: [],
      flags: {},
      createdAt: Date.now(),
    };
    this.regions.set(id, region);
    return region;
  }

  /**
   * Redéfinit les limites physiques de la région sans briser ses membres/règles.
   * @param {string} id 
   * @param {Vec3} a 
   * @param {Vec3} b 
   * @returns {boolean}
   */
  redefineBoundaries(id, a, b) {
    const r = this.regions.get(id);
    if (!r) return false;
    const { min, max } = normalize(a, b);
    r.min = min;
    r.max = max;
    return true;
  }

  remove(id) {
    return this.regions.delete(id);
  }

  get(id) {
    return this.regions.get(id);
  }

  list() {
    return Array.from(this.regions.values());
  }

  setFlag(id, flag, value) {
    const r = this.regions.get(id);
    if (!r) return false;
    r.flags[flag] = !!value;
    return true;
  }

  addMember(id, userId) {
    const r = this.regions.get(id);
    if (!r) return false;
    if (!r.members.includes(userId)) r.members.push(userId);
    return true;
  }

  removeMember(id, userId) {
    const r = this.regions.get(id);
    if (!r) return false;
    r.members = r.members.filter((m) => m !== userId);
    return true;
  }

  setOwner(id, ownerId) {
    const r = this.regions.get(id);
    if (!r) return false;
    r.owners = [ownerId];
    return true;
  }

  /**
   * Détecte si un point 3D est contenu dans le cuboïde d'une région.
   * @param {Region} region 
   * @param {Vec3} p 
   * @returns {boolean}
   */
  contains(region, p) {
    return (
      p.x >= region.min.x && p.x <= region.max.x &&
      p.y >= region.min.y && p.y <= region.max.y &&
      p.z >= region.min.z && p.z <= region.max.z
    );
  }

  /**
   * Retourne l'ensemble des régions enveloppant la coordonnée, triées par priorité décroissante.
   * @param {Vec3} p 
   * @returns {Region[]}
   */
  regionsAt(p) {
    return this.list()
      .filter((r) => this.contains(r, p))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Analyse et résout la valeur d'une règle (flag) d'un lieu pour un citoyen.
   * @param {Vec3} p 
   * @param {RegionFlag} flag 
   * @param {string} [userId] 
   * @returns {boolean}
   */
  resolveFlag(p, flag, userId = undefined) {
    const here = this.regionsAt(p);
    if (here.length === 0) return DEFAULT_FLAGS[flag];

    const top = here[0];
    
    // Outrepassement du build si membre ou propriétaire
    if (flag === "build" && userId) {
      if (top.owners.includes(userId) || top.members.includes(userId)) {
        return true;
      }
    }

    if (top.flags[flag] !== undefined) {
      return top.flags[flag];
    }
    return DEFAULT_FLAGS[flag];
  }

  canBuild(p, userId) {
    return this.resolveFlag(p, "build", userId);
  }

  // ─── PERSISTANCE D'ÉTAT ─────────────────────────────────────────────────────

  toState() {
    return { regions: this.list().map((r) => ({ ...r, flags: { ...r.flags } })) };
  }

  loadState(state) {
    this.regions.clear();
    const list = state?.regions ?? [];
    for (let i = 0; i < list.length; i++) {
      this.regions.set(list[i].id, list[i]);
    }
  }
}

export default RegionSystem;
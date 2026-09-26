/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/WORLDEDITSYSTEM.JS
 * Moteur WorldEdit d'édition tridimensionnelle à la volée
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server\intellectus\admin\systems/WorldEditSystem.js
 */

const SIG = 'TROXT⬡';

/**
 * @typedef {object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 *
 * @typedef {object} WorldAdapter
 * @property {function(Vec3, string): void} setBlock
 * @property {function(Vec3): string} getBlock
 *
 * @typedef {object} BlockChange
 * @property {Vec3} pos
 * @property {string} previous
 * @property {string} next
 *
 * @typedef {object} Clipboard
 * @property {Vec3} origin
 * @property {array<{ offset: Vec3, blockId: string }>} blocks
 */

const MAX_BLOCKS = 100000; // Limite de sécurité de volume par opération (anti-freeze)
const UNDO_STACK_LIMIT = 15; // Limite de pile d'annulation pour prévenir les fuites de RAM

export class WorldEditSession {
  /**
   * @param {WorldAdapter} world 
   * @param {number} [maxBlocks=MAX_BLOCKS] 
   */
  constructor(world, maxBlocks = MAX_BLOCKS) {
    this.world = world;
    this.maxBlocks = maxBlocks;
    this.pos1 = undefined;
    this.pos2 = undefined;
    this.clipboard = undefined;
    
    /** @type {BlockChange[][]} */
    this.undoStack = [];
    this.sig = SIG;
  }

  setPos1(p) {
    this.pos1 = { ...p };
  }

  setPos2(p) {
    this.pos2 = { ...p };
  }

  /**
   * Calcule le volume, la boîte enveloppante et le centre de la sélection courante.
   */
  getSelection() {
    if (!this.pos1 || !this.pos2) return undefined;
    const min = {
      x: Math.min(this.pos1.x, this.pos2.x),
      y: Math.min(this.pos1.y, this.pos2.y),
      z: Math.min(this.pos1.z, this.pos2.z),
    };
    const max = {
      x: Math.max(this.pos1.x, this.pos2.x),
      y: Math.max(this.pos1.y, this.pos2.y),
      z: Math.max(this.pos1.z, this.pos2.z),
    };
    const volume = (max.x - min.x + 1) * (max.y - min.y + 1) * (max.z - min.z + 1);
    return { min, max, volume };
  }

  /**
   * Générateur tridimensionnel itératif (coordonnées par coordonnées).
   * @private
   */
  *_iterate(min, max) {
    for (let x = min.x; x <= max.x; x++) {
      for (let y = min.y; y <= max.y; y++) {
        for (let z = min.z; z <= max.z; z++) {
          yield { x, y, z };
        }
      }
    }
  }

  /**
   * Ajoute des modifications de blocs à la pile d'annulation (glissante).
   * @private
   */
  _pushUndo(changes) {
    if (!changes || changes.length === 0) return;
    this.undoStack.push(changes);
    if (this.undoStack.length > UNDO_STACK_LIMIT) {
      this.undoStack.shift(); // Élimination du plus ancien pour protéger la RAM
    }
  }

  /**
   * Rplit toute la sélection avec un matériau.
   * @param {string} blockId 
   * @returns {number} Nombre de blocs affectés
   */
  set(blockId) {
    const sel = this._requireSelection();
    if (sel.volume > this.maxBlocks) {
      throw new Error(`Le volume de sélection dépasse la limite de sécurité (${sel.volume} > ${this.maxBlocks}).`);
    }

    const changes = [];
    for (const pos of this._iterate(sel.min, sel.max)) {
      const previous = this.world.getBlock(pos);
      if (previous === blockId) continue;
      this.world.setBlock(pos, blockId);
      changes.push({ pos, previous, next: blockId });
    }
    
    this._pushUndo(changes);
    return changes.length;
  }

  /**
   * Remplace sélectivement les blocs d'un type par un autre dans le volume.
   * @param {string} fromBlock 
   * @param {string} toBlock 
   * @returns {number} Nombre de modifications
   */
  fill(fromBlock, toBlock) {
    const sel = this._requireSelection();
    if (sel.volume > this.maxBlocks) {
      throw new Error(`Le volume de sélection dépasse la limite de sécurité (${sel.volume} > ${this.maxBlocks}).`);
    }

    const changes = [];
    for (const pos of this._iterate(sel.min, sel.max)) {
      const previous = this.world.getBlock(pos);
      if (previous !== fromBlock) continue;
      this.world.setBlock(pos, toBlock);
      changes.push({ pos, previous, next: toBlock });
    }

    this._pushUndo(changes);
    return changes.length;
  }

  /**
   * Copie l'agencement et l'état des blocs du volume de sélection dans le presse-papier.
   * @returns {number} Nombre de blocs chargés
   */
  copy() {
    const sel = this._requireSelection();
    if (sel.volume > this.maxBlocks) {
      throw new Error(`Volume de copie trop important (${sel.volume} > ${this.maxBlocks}).`);
    }

    const origin = this.pos1;
    const blocks = [];
    for (const pos of this._iterate(sel.min, sel.max)) {
      blocks.push({
        offset: { x: pos.x - origin.x, y: pos.y - origin.y, z: pos.z - origin.z },
        blockId: this.world.getBlock(pos),
      });
    }
    this.clipboard = { origin, blocks };
    return blocks.length;
  }

  /**
   * Colle les blocs en mémoire par rapport à une coordonnée d'ancrage.
   * @param {Vec3} at 
   * @returns {number} Nombre de blocs appliqués
   */
  paste(at) {
    if (!this.clipboard) {
      throw new Error("Le presse-papier est vide. Vous devez d'abord copier une sélection (/copy).");
    }

    const changes = [];
    const list = this.clipboard.blocks;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const pos = {
        x: at.x + b.offset.x,
        y: at.y + b.offset.y,
        z: at.z + b.offset.z,
      };
      const previous = this.world.getBlock(pos);
      if (previous === b.blockId) continue;
      this.world.setBlock(pos, b.blockId);
      changes.push({ pos, previous, next: b.blockId });
    }

    this._pushUndo(changes);
    return changes.length;
  }

  /**
   * Annule la dernière opération et restaure l'ancien état.
   * @returns {number} Nombre de blocs restaurés
   */
  undo() {
    const last = this.undoStack.pop();
    if (!last) return 0;
    for (let i = 0; i < last.length; i++) {
      const c = last[i];
      this.world.setBlock(c.pos, c.previous);
    }
    return last.length;
  }

  _requireSelection() {
    const sel = this.getSelection();
    if (!sel) throw new Error("Sélection 3D incomplète. Définissez d'abord vos points (/pos1 et /pos2).");
    return sel;
  }
}

export class WorldEditManager {
  /**
   * @param {WorldAdapter} world 
   * @param {number} [maxBlocks=MAX_BLOCKS] 
   */
  constructor(world, maxBlocks = MAX_BLOCKS) {
    this.world = world;
    this.maxBlocks = maxBlocks;
    this.sessions = new Map();
  }

  /**
   * Récupère ou instancie la session WorldEdit d'un constructeur.
   * @param {string} userId 
   * @returns {WorldEditSession}
   */
  session(userId) {
    let s = this.sessions.get(userId);
    if (!s) {
      s = new WorldEditSession(this.world, this.maxBlocks);
      this.sessions.set(userId, s);
    }
    return s;
  }

  setWorld(world) {
    this.world = world;
    this.sessions.forEach((s) => {
      s.world = world;
    });
  }
}

export default WorldEditManager;
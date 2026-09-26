/**
 * ═══════════════════════════════════════════════════════════════════
 * 🏡 TROXTWORLD / ETHERWORLD — SYSTÈME IMMOBILIER (REAL ESTATE)
 * ═══════════════════════════════════════════════════════════════════
 *
 * @typedef {object} Property
 * @property {string} id
 * @property {string} name
 * @property {string} address
 * @property {number} price
 * @property {string|null} ownerId
 * @property {boolean} isLocked
 * @property {"apartment"|"house"|"loft"|"garage"|"industrial"} type
 * @property {number} createdAt
 *
 * @typedef {(event: Record<string, unknown>) => void} RealEstateUpdateListener
 */

export class RealEstateManager {
  constructor() {
    /** @type {Map<string, Property>} */
    this.properties = new Map();

    /** @type {Set<RealEstateUpdateListener>} */
    this.updateListeners = new Set();

    this.seedDefaultProperties();
    console.log(`🏡 [RealEstateSystem] Initialisé : ${this.properties.size} propriétés disponibles.`);
  }

  seedDefaultProperties() {
    /** @type {Property[]} */
    const defaults = [
      { id: "prop_loft_pontrouge", name: "Loft de la Jacques-Cartier", address: "142 Rue du Collège, Pont-Rouge", price: 180000, ownerId: null, isLocked: true, type: "loft", createdAt: Date.now() },
      { id: "prop_house_straymond", name: "Chalet de la Vallée", address: "845 Rang de la Grande-Ligne, Saint-Raymond", price: 245000, ownerId: null, isLocked: true, type: "house", createdAt: Date.now() },
      { id: "prop_apt_donnacona", name: "Appartement du Fleuve", address: "320 Rue Notre-Dame, Donnacona", price: 95000, ownerId: null, isLocked: true, type: "apartment", createdAt: Date.now() },
      { id: "prop_garage_portneuf", name: "Grand Hangar Industriel", address: "12 Route de l'Aéroport, Neuville", price: 350000, ownerId: null, isLocked: true, type: "industrial", createdAt: Date.now() },
    ];

    for (const p of defaults) {
      this.properties.set(p.id, p);
    }
  }

  buyProperty(playerId, propertyId, price) {
    const prop = this.properties.get(propertyId);
    if (!prop || prop.ownerId !== null || prop.price !== price) {
      return false;
    }

    prop.ownerId = playerId;
    prop.isLocked = false; // Se déverrouille à l'achat

    this.notifyUpdate("property_purchased", {
      propertyId,
      playerId,
      price,
      name: prop.name,
    });

    return true;
  }

  toggleLock(propertyId, playerId) {
    const prop = this.properties.get(propertyId);
    if (!prop || prop.ownerId !== playerId) {
      return false;
    }

    prop.isLocked = !prop.isLocked;
    this.notifyUpdate("property_lock_toggled", {
      propertyId,
      playerId,
      isLocked: prop.isLocked,
    });

    return true;
  }

  getProperty(propertyId) {
    return this.properties.get(propertyId);
  }

  getPlayerProperties(playerId) {
    return Array.from(this.properties.values()).filter((p) => p.ownerId === playerId);
  }

  getAllProperties() {
    return Array.from(this.properties.values());
  }

  onUpdate(callback) {
    this.updateListeners.add(callback);
    return () => this.updateListeners.delete(callback);
  }

  notifyUpdate(type, data) {
    const payload = { type, timestamp: Date.now(), ...data };
    for (const listener of this.updateListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error("[RealEstateSystem] Erreur listener :", err);
      }
    }
  }

  dispose() {
    this.updateListeners.clear();
    this.properties.clear();
    console.log("🛑 [RealEstateSystem] Système immobilier libéré.");
  }
}

export const realEstateManager = new RealEstateManager();
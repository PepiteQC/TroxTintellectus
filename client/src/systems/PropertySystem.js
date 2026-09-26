import { v4 as uuid } from 'uuid';
import { EtherPrismDB } from '../core/EtherPrismDB';
import { Intellectus } from '../core/Intellectus';

const SEED = [
  { name: 'Maison Québec #1', type: 'house', ownerId: null, price: 15000, position: [-30, 0, -20], size: [8, 6, 10], color: '#8B4513', description: 'Belle maison en bois.', forSale: true },
  { name: 'Appart Centre-Ville', type: 'apartment', ownerId: null, price: 8000, position: [25, 0, -15], size: [6, 8, 6], color: '#696969', description: 'Moderne au centre.', forSale: true },
  { name: 'Garage Mécanique', type: 'garage', ownerId: null, price: 20000, position: [40, 0, 10], size: [12, 5, 8], color: '#A9A9A9', description: 'Garage spacieux.', forSale: true },
  { name: 'Dépanneur Chez Ti-Guy', type: 'business', ownerId: null, price: 25000, position: [-15, 0, 20], size: [8, 5, 8], color: '#CD5C5C', description: 'Le dépanneur populaire.', forSale: true },
  { name: 'Entrepôt Nord', type: 'warehouse', ownerId: null, price: 30000, position: [-50, 0, 30], size: [15, 7, 12], color: '#708090', description: 'Grand entrepôt.', forSale: true },
  { name: 'Maison Québec #2', type: 'house', ownerId: null, price: 18000, position: [15, 0, -35], size: [9, 7, 11], color: '#DEB887', description: 'Maison victorienne.', forSale: true },
];

export class PropertySystem {
  constructor(db, intellectus) {
    this.db = db;
    this.intellectus = intellectus;
  }

  async initialize() {
    const existing = await this.db.list('properties');
    if (existing.length === 0) {
      for (const p of SEED) await this.db.set('properties', uuid(), p);
    }
    this.intellectus.arcadius.emit('system:property:ready', {}, 'PropertySystem');
  }

  async list() { return this.db.list('properties'); }
  async get(id) { return this.db.get('properties', id); }

  async purchase(propertyId, playerId) {
    const p = await this.db.get('properties', propertyId);
    if (!p) return { ok: false, error: 'Propriété introuvable.' };
    if (!p.forSale) return { ok: false, error: 'Non disponible.' };
    if (p.ownerId) return { ok: false, error: 'Déjà achetée.' };
    p.ownerId = playerId; p.forSale = false;
    await this.db.set('properties', propertyId, p);
    this.intellectus.arcadius.emit('property:purchased', { propertyId, playerId }, 'PropertySystem');
    return { ok: true };
  }

  async sell(propertyId, playerId) {
    const p = await this.db.get('properties', propertyId);
    if (!p) return { ok: false, error: 'Introuvable.' };
    if (p.ownerId !== playerId) return { ok: false, error: 'Pas propriétaire.' };
    p.ownerId = null; p.forSale = true;
    await this.db.set('properties', propertyId, p);
    return { ok: true };
  }
}
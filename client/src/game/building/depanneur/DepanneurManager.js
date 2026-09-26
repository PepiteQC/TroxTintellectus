// src/game/building/depanneur/DepanneurManager.js

export class DepanneurManager {
  /** @type {DepanneurManager|null} */
  static #instance = null;

  /** @type {import('./core/DepanneurTypes.js').DepanneurRegistryShape} */
  #registry;

  #cashRegisterBalance = 450.0;
  #isAlarmArmed = true;

  /** @private */
  constructor() {
    this.#registry = this.#createDefaultRegistry();
  }

  static getInstance() {
    if (!DepanneurManager.#instance) {
      DepanneurManager.#instance = new DepanneurManager();
    }
    return DepanneurManager.#instance;
  }

  #createDefaultRegistry() {
    const zones = [
      {
        id: 'zone_sales_floor',
        buildingId: 'depanneur_couche_tard',
        type: 'customer',
        label: 'Plancher des ventes',
        position: [0, 0, 0],
        size: [12, 3.5, 10],
        access: 'public',
        firebaseCollection: 'depanneur_zones',
      },
      {
        id: 'zone_counter',
        buildingId: 'depanneur_couche_tard',
        type: 'cash',
        label: 'Comptoir caisse & loterie',
        position: [-3, 0, 2],
        size: [4, 1.1, 2],
        access: 'staff',
        firebaseCollection: 'depanneur_zones',
      },
      {
        id: 'zone_backstore',
        buildingId: 'depanneur_couche_tard',
        type: 'inventory',
        label: 'Arrière-boutique & chambre froide',
        position: [0, 0, -6],
        size: [10, 3.5, 4],
        access: 'staff',
        firebaseCollection: 'depanneur_zones',
      },
    ];

    const fixtures = [
      { id: 'fix_register_1',         buildingId: 'depanneur_couche_tard', type: 'cash_register', label: 'Caisse NCR Posiflex #1',            position: [-3.2, 0.9, 2.2], zoneId: 'zone_counter',     interactive: true },
      { id: 'fix_slush_machine',      buildingId: 'depanneur_couche_tard', type: 'slush',         label: 'Machine Sloche 3 saveurs',          position: [ 4.5, 0.9, 1.5], zoneId: 'zone_sales_floor', interactive: true },
      { id: 'fix_coffee_van_houtte',  buildingId: 'depanneur_couche_tard', type: 'coffee',        label: 'Cafetière Van Houtte filtre',       position: [ 4.5, 0.9, 3.2], zoneId: 'zone_sales_floor', interactive: true },
      { id: 'fix_fridge_dairy',       buildingId: 'depanneur_couche_tard', type: 'fridge',        label: 'Frigo Laiterie de Portneuf & Bières', position: [-5, 0, -2],     zoneId: 'zone_sales_floor', interactive: true },
    ];

    const inventory = [
      { id: 'inv_sloche',           sku: 'DEP-SLOCH-01', label: 'Sloche Bleue Format Géant',       category: 'drink',  price: 3.25, stock: 45,  zoneId: 'zone_sales_floor', fixtureId: 'fix_slush_machine',      firebaseCollection: 'depanneur_inventory' },
      { id: 'inv_fromage_squick',   sku: 'DEP-FRM-02',   label: 'Fromage en crotte frais du jour', category: 'snack',  price: 6.99, stock: 30,  zoneId: 'zone_sales_floor', fixtureId: 'fix_fridge_dairy',       firebaseCollection: 'depanneur_inventory' },
      { id: 'inv_cafe_vh',          sku: 'DEP-COF-03',   label: 'Café filtre Van Houtte grand',    category: 'coffee', price: 2.45, stock: 120, zoneId: 'zone_sales_floor', fixtureId: 'fix_coffee_van_houtte',  firebaseCollection: 'depanneur_inventory' },
      { id: 'inv_chips_bbq',        sku: 'DEP-CHP-04',   label: 'Croustilles Yum Yum BBQ',         category: 'snack',  price: 2.15, stock: 60,  zoneId: 'zone_sales_floor', fixtureId: 'zone_sales_floor',       firebaseCollection: 'depanneur_inventory' },
    ];

    const cameras = [
      {
        id: 'cam_entrance',
        buildingId: 'depanneur_couche_tard',
        label: 'Caméra Dôme Entrée principale',
        position: [0, 3.2, 4.5],
        rotation: [-0.4, 0, 0],
        coverageZoneIds: ['zone_sales_floor', 'zone_counter'],
        eventCollection: 'depanneur_cctv',
      },
    ];

    return {
      buildingId: 'depanneur_couche_tard',
      version: '2.1.0',
      zones,
      fixtures,
      inventory,
      cameras,
    };
  }

  getRegistry() { return this.#registry; }
  getInventory() { return this.#registry.inventory; }

  purchaseItem(itemId) {
    const item = this.#registry.inventory.find((i) => i.id === itemId);
    if (!item) return { success: false, message: 'Article introuvable en rayon' };
    if (item.stock <= 0) return { success: false, message: 'Rupture de stock pour cet article' };

    item.stock -= 1;
    this.#cashRegisterBalance += item.price;
    return {
      success: true,
      item,
      message: `Achat confirmé: ${item.label} (${item.price.toFixed(2)} $)`,
    };
  }

  getCashRegisterBalance() { return this.#cashRegisterBalance; }
  setAlarmArmed(armed) { this.#isAlarmArmed = armed; }
  isAlarmActive() { return this.#isAlarmArmed; }
}

export const depanneurManager = DepanneurManager.getInstance();
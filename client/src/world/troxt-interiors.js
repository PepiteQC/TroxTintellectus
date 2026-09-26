/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/TROXT-INTERIORS.JS
 * Système d'entreprises avec intérieurs complets — Three.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/src/world/troxt-interiors.js
 */

import * as THREE from 'three';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════════
// PALETTE & MATÉRIAUX PARTAGÉS AVEC NETTOYAGE
// ═══════════════════════════════════════════════════════════════════════════════
const _matCache = new Map();

function mat(color, rough = 0.8, metal = 0.0, opts = {}) {
  const k = `${color}_${rough}_${metal}_${opts.emissive || ''}_${opts.transparent || ''}_${opts.opacity ?? 1}`;
  if (!_matCache.has(k)) {
    _matCache.set(k, new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 0,
      transparent: opts.transparent || false,
      opacity: opts.opacity ?? 1,
    }));
  }
  return _matCache.get(k);
}

// Purge totale des matériaux du cache (à appeler au shutdown global si besoin)
export function clearMaterialCache() {
  _matCache.forEach(m => m.dispose());
  _matCache.clear();
}

const COLORS = {
  floor:        0x8a8a90, 
  floorWood:    0x9a7a52, 
  floorTile:    0xd8d8d0,
  wall:         0xe8e4dc, 
  wallDark:     0x3a4048, 
  ceiling:      0xf0f0f0,
  metal:        0x8a8a92, 
  wood:         0x8a6a48, 
  glass:        0x88bbcc,
  counter:      0x5a4a3a, 
  shelf:        0xc0a878, 
  red:          0xdc2626,
  green:        0x22a852, 
  blue:         0x2860c0, 
  gold:         0xc9a84c,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DÉFINITIONS DES ENTREPRISES
// ═══════════════════════════════════════════════════════════════════════════════
export const BUSINESS_TYPES = {
  depanneur: {
    name: 'Dépanneur', icon: '🏪', size: { w: 13, d: 10, h: 4 },
    floor: COLORS.floorTile, robbable: true,
    zones: [
      { id: 'vente', name: 'Espace de vente', public: true },
      { id: 'reserve', name: 'Réserve', staff: true },
    ],
    stations: [
      { id: 'caisse', type: 'cash_register', job: 'caissier', pos: { x: -4, z: 3 }, label: 'Caisse' },
      { id: 'coffre', type: 'safe', staff: true, pos: { x: 5, z: -4 }, label: 'Coffre' },
    ],
    furniture: 'shop',
  },
  banque: {
    name: 'Banque Centrale', icon: '🏦', size: { w: 20, d: 16, h: 6 },
    floor: COLORS.floorTile, robbable: true, secure: true,
    zones: [
      { id: 'hall', name: 'Hall', public: true },
      { id: 'guichets', name: 'Guichets', job: 'banquier' },
      { id: 'coffre', name: 'Salle des coffres', secure: true, alarm: true },
    ],
    stations: [
      { id: 'guichet_1', type: 'bank_teller', job: 'banquier', pos: { x: -6, z: 2 }, label: 'Guichet 1' },
      { id: 'guichet_2', type: 'bank_teller', job: 'banquier', pos: { x: -2, z: 2 }, label: 'Guichet 2' },
      { id: 'atm', type: 'atm', public: true, pos: { x: 8, z: 6 }, label: 'Guichet automatique' },
      { id: 'vault', type: 'vault_door', secure: true, pos: { x: 0, z: -6 }, label: 'Coffre-fort', alarm: true },
    ],
    furniture: 'bank',
  },
  garage: {
    name: 'TroxtGarage', icon: '🔧', size: { w: 18, d: 14, h: 6 },
    floor: COLORS.floor, job: 'mecano',
    zones: [
      { id: 'atelier', name: 'Atelier', job: 'mecano' },
      { id: 'bureau', name: 'Bureau', staff: true },
    ],
    stations: [
      { id: 'lift_1', type: 'car_lift', job: 'mecano', pos: { x: -4, z: 0 }, label: 'Pont élévateur 1' },
      { id: 'lift_2', type: 'car_lift', job: 'mecano', pos: { x: 4, z: 0 }, label: 'Pont élévateur 2' },
      { id: 'workbench', type: 'workbench', job: 'mecano', pos: { x: -7, z: -5 }, label: 'Établi' },
      { id: 'parts', type: 'parts_shelf', staff: true, pos: { x: 7, z: -5 }, label: 'Pièces détachées' },
    ],
    furniture: 'garage',
  },
  restaurant: {
    name: 'Le Troxt Bistro', icon: '🍽️', size: { w: 16, d: 14, h: 4.5 },
    floor: COLORS.floorWood, job: 'cuisinier',
    zones: [
      { id: 'salle', name: 'Salle à manger', public: true },
      { id: 'cuisine', name: 'Cuisine', job: 'cuisinier' },
    ],
    stations: [
      { id: 'stove', type: 'stove', job: 'cuisinier', pos: { x: -5, z: -4 }, label: 'Cuisinière' },
      { id: 'prep', type: 'prep_table', job: 'cuisinier', pos: { x: -1, z: -4 }, label: 'Préparation' },
      { id: 'register', type: 'cash_register', job: 'cuisinier', pos: { x: 5, z: 3 }, label: 'Caisse' },
    ],
    furniture: 'restaurant',
  },
  boutique: {
    name: 'Boutique', icon: '👕', size: { w: 14, d: 12, h: 4 },
    floor: COLORS.floorWood,
    zones: [
      { id: 'vente', name: 'Magasin', public: true },
      { id: 'cabines', name: 'Cabines d\'essayage', public: true },
      { id: 'reserve', name: 'Réserve', staff: true },
    ],
    stations: [
      { id: 'register', type: 'cash_register', job: 'vendeur', pos: { x: 5, z: 3 }, label: 'Caisse' },
      { id: 'fitting_1', type: 'fitting_room', public: true, pos: { x: -5, z: -4 }, label: 'Cabine 1' },
    ],
    furniture: 'boutique',
  },
  armurerie: {
    name: 'Ammu-Troxt', icon: '🔫', size: { w: 14, d: 12, h: 4.5 },
    floor: COLORS.floor, minLevel: 10, robbable: true,
    zones: [
      { id: 'vente', name: 'Magasin', public: public },
      { id: 'stand', name: 'Stand de tir', public: true },
      { id: 'reserve', name: 'Réserve sécurisée', secure: true, alarm: true },
    ],
    stations: [
      { id: 'counter', type: 'gun_counter', job: 'armurier', pos: { x: 0, z: 3 }, label: 'Comptoir' },
      { id: 'range', type: 'shooting_range', public: true, pos: { x: -4, z: -4 }, label: 'Stand de tir' },
    ],
    furniture: 'armurerie',
  },
  concessionnaire: {
    name: 'Troxt Motors', icon: '🚗', size: { w: 22, d: 18, h: 7 },
    floor: COLORS.floorTile, job: 'dealer_auto',
    zones: [
      { id: 'showroom', name: 'Salle d\'exposition', public: true },
      { id: 'bureau', name: 'Bureau des ventes', job: 'dealer_auto' },
    ],
    stations: [
      { id: 'desk', type: 'sales_desk', job: 'dealer_auto', pos: { x: 7, z: 5 }, label: 'Bureau vendeur' },
      { id: 'display_1', type: 'car_display', public: true, pos: { x: -5, z: 0 }, label: 'Véhicule expo' },
    ],
    furniture: 'concessionnaire',
  },
  hopital: {
    name: 'Hôpital', icon: '🏥', size: { w: 20, d: 18, h: 5 },
    floor: COLORS.floorTile, job: 'medecin',
    zones: [
      { id: 'accueil', name: 'Accueil', public: true },
      { id: 'urgences', name: 'Urgences', job: 'medecin' },
      { id: 'pharmacie', name: 'Pharmacie', secure: true },
    ],
    stations: [
      { id: 'reception', type: 'reception_desk', public: true, pos: { x: 0, z: 6 }, label: 'Réception' },
      { id: 'bed_1', type: 'hospital_bed', job: 'medecin', pos: { x: -5, z: -3 }, label: 'Lit 1' },
      { id: 'pharma', type: 'pharmacy', secure: true, pos: { x: 6, z: -5 }, label: 'Pharmacie' },
    ],
    furniture: 'hopital',
  },
  police: {
    name: 'Commissariat', icon: '👮', size: { w: 20, d: 18, h: 5 },
    floor: COLORS.floorTile, faction: 'police', secure: true,
    zones: [
      { id: 'accueil', name: 'Accueil', public: true },
      { id: 'bureau', name: 'Bureaux', faction: 'police' },
      { id: 'cellules', name: 'Cellules', faction: 'police' },
      { id: 'armurerie', name: 'Armurerie', faction: 'police', secure: true, alarm: true },
    ],
    stations: [
      { id: 'desk', type: 'police_desk', faction: 'police', pos: { x: 0, z: 6 }, label: 'Accueil' },
      { id: 'cell_1', type: 'jail_cell', faction: 'police', pos: { x: -6, z: -5 }, label: 'Cellule 1' },
      { id: 'armory', type: 'weapon_locker', faction: 'police', pos: { x: 6, z: -5 }, label: 'Armurerie', alarm: true },
    ],
    furniture: 'police',
  },
  boite_nuit: {
    name: 'Club Hexagone', icon: '🪩', size: { w: 18, d: 16, h: 6 },
    floor: 0x1a1a20, nightonly: true,
    zones: [
      { id: 'piste', name: 'Piste de danse', public: true },
      { id: 'bar', name: 'Bar', public: true },
      { id: 'vip', name: 'Carré VIP', vip: true },
    ],
    stations: [
      { id: 'bar_station', type: 'bar', job: 'barman', pos: { x: -6, z: 4 }, label: 'Bar' },
      { id: 'dj', type: 'dj_booth', staff: true, pos: { x: 0, z: -6 }, label: 'Cabine DJ' },
    ],
    furniture: 'club',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSE INTERIOR MANAGER
// ═══════════════════════════════════════════════════════════════════════════
export class InteriorManager {
  constructor({ THREE: T = THREE, scene, kernel = null, physics = null } = {}) {
    if (!scene) throw new Error('[TROXT·Interiors] Scène Three.js requise');
    this.THREE = T;
    this.scene = scene;
    this.kernel = kernel;
    this.physics = physics;
    this.sig = SIG;

    this._interiors = new Map();
    this._stations = new Map();
    this._allocatedGeometries = new Set();
    this.stats = { built: 0, stations: 0 };
  }

  _createGeometry(geom) {
    this._allocatedGeometries.add(geom);
    return geom;
  }

  build(id, type, worldPos = { x: 0, z: 0 }, opts = {}) {
    const def = BUSINESS_TYPES[type];
    if (!def) {
      console.warn(`[${SIG}·Interiors] Type d'entreprise inconnu: ${type}`);
      return null;
    }

    const group = new THREE.Group();
    group.name = `interior_${id}`;
    group.position.set(worldPos.x, opts.y || 0, worldPos.z);
    if (opts.rotation) group.rotation.y = opts.rotation;

    const rec = { id, type, def, group, stations: [], colliders: [], lights: [], worldPos, meshes: [] };

    this._buildStructure(group, def, rec);
    this._buildFurniture(group, def, rec);
    this._buildStations(group, def, rec, worldPos, opts.rotation || 0);
    this._buildLighting(group, def, rec);

    this.scene.add(group);
    this._interiors.set(id, rec);
    this.stats.built++;

    if (this.physics) this._registerColliders(id, rec);

    this.kernel?.emit('interior:built', {
      id, type, name: def.name, stations: rec.stations.length, sig: SIG,
    });

    return rec;
  }

  _buildStructure(group, def, rec) {
    const { w, d, h } = def.size;
    const hw = w / 2, hd = d / 2;

    // Sol
    const floorGeo = this._createGeometry(new THREE.BoxGeometry(w, 0.2, d));
    const floor = new THREE.Mesh(floorGeo, mat(def.floor || COLORS.floor, 0.9));
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    group.add(floor);
    rec.meshes.push(floor);
    rec.colliders.push({ type: 'box', pos: { x: 0, y: -0.1, z: 0 }, size: { x: hw, y: 0.1, z: hd } });

    // Plafond
    const ceilGeo = this._createGeometry(new THREE.BoxGeometry(w, 0.2, d));
    const ceil = new THREE.Mesh(ceilGeo, mat(COLORS.ceiling, 0.95));
    ceil.position.y = h;
    group.add(ceil);
    rec.meshes.push(ceil);

    const wallMat = mat(COLORS.wall, 0.85);
    const wallT = 0.2;

    // Murs d'enceinte
    this._wall(group, rec, 0, h / 2, -hd, w, h, wallT, wallMat);
    this._wall(group, rec, -hw, h / 2, 0, wallT, h, d, wallMat);
    this._wall(group, rec, hw, h / 2, 0, wallT, h, d, wallMat);

    // Devanture
    const doorW = 2.5;
    const sideW = (w - doorW) / 2;
    this._wall(group, rec, -(doorW / 2 + sideW / 2), h / 2, hd, sideW, h, wallT, wallMat);
    this._wall(group, rec, (doorW / 2 + sideW / 2), h / 2, hd, sideW, h, wallT, wallMat);

    // Linteau de porte
    const lintelGeo = this._createGeometry(new THREE.BoxGeometry(doorW, h - 2.4, wallT));
    const lintel = new THREE.Mesh(lintelGeo, wallMat);
    lintel.position.set(0, 2.4 + (h - 2.4) / 2, hd);
    group.add(lintel);
    rec.meshes.push(lintel);

    // Enseigne lumineuse
    const signGeo = this._createGeometry(new THREE.BoxGeometry(w * 0.6, 0.8, 0.15));
    const sign = new THREE.Mesh(signGeo, mat(COLORS.gold, 0.4, 0.2, { emissive: COLORS.gold, emissiveIntensity: 0.6 }));
    sign.position.set(0, h + 0.6, hd + 0.1);
    group.add(sign);
    rec.meshes.push(sign);

    // Vitrines latérales
    const glassMat = mat(COLORS.glass, 0.1, 0.3, { transparent: true, opacity: 0.35 });
    const winGeo = this._createGeometry(new THREE.BoxGeometry(sideW * 0.7, 1.6, 0.08));
    for (const sx of [-hw * 0.6, hw * 0.6]) {
      const win = new THREE.Mesh(winGeo, glassMat);
      win.position.set(sx, 1.6, hd);
      group.add(win);
      rec.meshes.push(win);
    }
  }

  _wall(group, rec, x, y, z, w, h, d, material) {
    const wallGeo = this._createGeometry(new THREE.BoxGeometry(w, h, d));
    const wall = new THREE.Mesh(wallGeo, material);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    rec.meshes.push(wall);
    rec.colliders.push({ type: 'box', pos: { x, y, z }, size: { x: w / 2, y: h / 2, z: d / 2 } });
  }

  // ── MOBILIER PROCÉDURAL COMPLET ──
  _buildFurniture(group, def, rec) {
    const M = rec.meshes;
    const addMesh = (mesh) => {
      group.add(mesh);
      M.push(mesh);
    };

    const buildGeo = (geom, matObj, x, y, z) => {
      const mesh = new THREE.Mesh(this._createGeometry(geom), matObj);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      addMesh(mesh);
    };

    const type = def.furniture;

    if (type === 'shop') {
      const { w } = def.size;
      for (let row = 0; row < 3; row++) {
        const shelfX = -w / 2 + 3 + row * 3;
        for (let lvl = 0; level < 3; lvl++) {
          buildGeo(new THREE.BoxGeometry(4, 0.1, 0.8), mat(COLORS.shelf, 0.8), shelfX, 0.6 + lvl * 0.7, -1);
          // Remplissage d'articles de rayons
          for (let i = 0; i < 6; i++) {
            const prodColor = [0xe04040, 0x40a0e0, 0x40c060, 0xe0c040][i % 4];
            buildGeo(new THREE.BoxGeometry(0.35, 0.45, 0.35), mat(prodColor, 0.7), shelfX - 1.5 + i * 0.6, 0.6 + lvl * 0.7 + 0.25, -1);
          }
        }
      }
    } else if (type === 'bank') {
      buildGeo(new THREE.BoxGeometry(10, 1.1, 1), mat(COLORS.counter, 0.6), -4, 0.55, 2);
      buildGeo(new THREE.BoxGeometry(10, 1.2, 0.05), mat(COLORS.glass, 0.1, 0.3, { transparent: true, opacity: 0.3 }), -4, 1.7, 2);
      // Porte ronde de coffre-fort
      const vaultGeo = this._createGeometry(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 24));
      const vaultMesh = new THREE.Mesh(vaultGeo, mat(COLORS.metal, 0.3, 0.9));
      vaultMesh.rotation.x = Math.PI / 2;
      vaultMesh.position.set(0, 1.6, -def.size.d / 2 + 0.4);
      addMesh(vaultMesh);
    } else if (type === 'garage') {
      for (const x of [-4, 4]) {
        buildGeo(new THREE.BoxGeometry(3, 0.25, 5), mat(0x222225, 0.6, 0.5), x, 0.125, 0);
        for (const zx of [-1, 1]) {
          buildGeo(new THREE.CylinderGeometry(0.12, 0.12, 3, 12), mat(0xe5a823, 0.5, 0.4), x + zx * 1.3, 1.5, 0);
        }
      }
      buildGeo(new THREE.BoxGeometry(3, 1, 0.8), mat(COLORS.metal, 0.5, 0.5), -def.size.w / 2 + 2, 0.5, -def.size.d / 2 + 1.5);
    } else if (type === 'restaurant') {
      for (const [tx, tz] of [[-3, 2], [3, 2], [-3, 5], [3, 5]]) {
        buildGeo(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16), mat(COLORS.wood, 0.7), tx, 0.75, tz);
        buildGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.75, 8), mat(0x313131, 0.5), tx, 0.375, tz);
        for (let a = 0; a < 4; a++) {
          const ang = (a / 4) * Math.PI * 2;
          buildGeo(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat(COLORS.wood, 0.8), tx + Math.cos(ang) * 1.2, 0.45 / 2, tz + Math.sin(ang) * 1.2);
        }
      }
    } else if (type === 'boutique') {
      for (const x of [-4, 0, 4]) {
        const barGeo = this._createGeometry(new THREE.CylinderGeometry(0.03, 0.03, 3, 8));
        const barMesh = new THREE.Mesh(barGeo, mat(COLORS.metal, 0.4, 0.7));
        barMesh.rotation.z = Math.PI / 2;
        barMesh.position.set(x, 1.6, -1);
        addMesh(barMesh);
        for (let i = 0; i < 5; i++) {
          const clothColor = [0x2f5fc0, 0xc02f5f, 0x2fc05f, 0xc09c2f, 0x803fc0][i];
          buildGeo(new THREE.BoxGeometry(0.4, 1.1, 0.15), mat(clothColor, 0.9), x - 1.2 + i * 0.6, 1.0, -1);
        }
      }
    } else if (type === 'hopital') {
      for (const [bx, bz] of [[-5, -2], [-5, 1], [-5, 4]]) {
        buildGeo(new THREE.BoxGeometry(1.1, 0.6, 2.1), mat(0xf3f6f9, 0.6), bx, 0.3, bz);
      }
    } else if (type === 'police') {
      for (const cx of [-6, -3]) {
        for (let i = 0; i < 5; i++) {
          buildGeo(new THREE.CylinderGeometry(0.035, 0.035, 3, 8), mat(0x41454c, 0.4, 0.7), cx - 1 + i * 0.5, 1.5, -3);
        }
      }
    } else if (type === 'club') {
      for (let x = -4; x <= 4; x += 2) {
        for (let z = -4; z <= 4; z += 2) {
          const neonColor = [0xff007f, 0x00ffff, 0xffff00, 0x7f00ff][Math.abs(x + z) % 4];
          buildGeo(new THREE.BoxGeometry(1.8, 0.06, 1.8), mat(neonColor, 0.3, 0.1, { emissive: neonColor, emissiveIntensity: 0.8 }), x, 0.03, z);
        }
      }
    } else if (type === 'armurerie') {
      buildGeo(new THREE.BoxGeometry(8, 1.1, 1), mat(COLORS.metal, 0.5, 0.4), 0, 0.55, 2);
    } else if (type === 'concessionnaire') {
      for (const [px, pz] of [[-5, 0], [5, 0]]) {
        buildGeo(new THREE.CylinderGeometry(3, 3.1, 0.25, 24), mat(0x28282e, 0.3, 0.4), px, 0.125, pz);
      }
    }
  }

  _buildStations(group, def, rec, worldPos, rotation) {
    const M = rec.meshes;
    for (const st of def.stations || []) {
      const mesh = this._buildStationMesh(st);
      mesh.position.set(st.pos.x, 0, st.pos.z);
      group.add(mesh);
      M.push(mesh);

      const cos = Math.cos(rotation), sin = Math.sin(rotation);
      const worldStationPos = {
        x: worldPos.x + (st.pos.x * cos - st.pos.z * sin),
        z: worldPos.z + (st.pos.x * sin + st.pos.z * cos),
      };

      const stationRec = {
        id: st.id,
        interiorId: rec.id,
        type: st.type,
        job: st.job,
        faction: st.faction,
        staff: st.staff,
        secure: st.secure,
        public: st.public,
        alarm: st.alarm,
        label: st.label,
        pos: worldStationPos,
        mesh,
      };

      rec.stations.push(stationRec);
      this._stations.set(`${rec.id}:${st.id}`, stationRec);
      this.stats.stations++;
    }
  }

  _buildStationMesh(st) {
    const g = new THREE.Group();
    g.name = `station_${st.id}`;

    const addMesh = (mesh) => {
      g.add(mesh);
    };

    const buildGeo = (geom, matObj, x, y, z) => {
      const mesh = new THREE.Mesh(this._createGeometry(geom), matObj);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      addMesh(mesh);
    };

    switch (st.type) {
      case 'cash_register': {
        buildGeo(new THREE.BoxGeometry(1.2, 1, 0.8), mat(COLORS.counter, 0.6), 0, 0.5, 0);
        buildGeo(new THREE.BoxGeometry(0.5, 0.3, 0.4), mat(0x222222, 0.5, 0.3), 0, 1.15, 0);
        break;
      }
      case 'bank_teller':
      case 'sales_desk':
      case 'police_desk':
      case 'reception_desk': {
        buildGeo(new THREE.BoxGeometry(2, 1.1, 1), mat(COLORS.counter, 0.6), 0, 0.55, 0);
        break;
      }
      case 'atm': {
        buildGeo(new THREE.BoxGeometry(0.8, 1.8, 0.5), mat(0x214161, 0.4, 0.5, { emissive: 0x113151, emissiveIntensity: 0.3 }), 0, 0.9, 0);
        break;
      }
      case 'vault_door':
      case 'vault': {
        const vaultGeo = this._createGeometry(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 24));
        const vaultMesh = new THREE.Mesh(vaultGeo, mat(COLORS.metal, 0.3, 0.9));
        vaultMesh.rotation.x = Math.PI / 2;
        vaultMesh.position.y = 1.4;
        addMesh(vaultMesh);
        break;
      }
      case 'stove':
      case 'prep_table': {
        buildGeo(new THREE.BoxGeometry(2, 1, 0.9), mat(COLORS.metal, 0.4, 0.6), 0, 0.5, 0);
        break;
      }
      case 'car_lift': {
        buildGeo(new THREE.BoxGeometry(2.5, 0.2, 4), mat(0x313135, 0.5, 0.5), 0, 0.1, 0);
        break;
      }
      case 'workbench':
      case 'gun_counter': {
        buildGeo(new THREE.BoxGeometry(2.5, 1, 0.8), mat(COLORS.metal, 0.5, 0.4), 0, 0.5, 0);
        break;
      }
      case 'hospital_bed': {
        buildGeo(new THREE.BoxGeometry(1, 0.6, 2.2), mat(0xf3f6f9, 0.6), 0, 0.3, 0);
        break;
      }
      case 'bar':
      case 'dj_booth': {
        buildGeo(new THREE.BoxGeometry(3, 1.1, 1), mat(0x212125, 0.5, 0.3, { emissive: 0x3a1a91, emissiveIntensity: 0.4 }), 0, 0.55, 0);
        break;
      }
      default: {
        buildGeo(new THREE.BoxGeometry(1, 1, 1), mat(COLORS.metal, 0.6), 0, 0.5, 0);
      }
    }

    const ringGeo = this._createGeometry(new THREE.RingGeometry(0.6, 0.8, 24));
    const marker = new THREE.Mesh(
      ringGeo,
      mat(COLORS.gold, 0.4, 0, { emissive: COLORS.gold, emissiveIntensity: 0.5, transparent: true, opacity: 0.6 })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.05;
    marker.userData.isStationMarker = true;
    g.add(marker);

    return g;
  }

  _buildLighting(group, def, rec) {
    const { w, d, h } = def.size;
    const cols = Math.max(1, Math.floor(w / 6));
    const rows = Math.max(1, Math.floor(d / 6));
    
    const fixtureGeo = this._createGeometry(new THREE.BoxGeometry(1.2, 0.1, 1.2));
    const fixtureMat = mat(0xffffff, 0.3, 0, { emissive: 0xffffee, emissiveIntensity: 0.8 });

    for (let cx = 0; cx < cols; cx++) {
      for (let cz = 0; cz < rows; cz++) {
        const x = -w / 2 + (w / (cols + 1)) * (cx + 1);
        const z = -d / 2 + (d / (rows + 1)) * (cz + 1);
        
        const light = new THREE.PointLight(def.nightonly ? 0x8040ff : 0xfff4e0, def.nightonly ? 0.8 : 0.6, 14, 2);
        light.position.set(x, h - 0.5, z);
        group.add(light);
        rec.lights.push(light);

        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.position.set(x, h - 0.15, z);
        group.add(fixture);
        rec.meshes.push(fixture);
      }
    }
  }

  _registerColliders(id, rec) {
    let i = 0;
    for (const col of rec.colliders) {
      const wx = rec.worldPos.x + col.pos.x;
      const wz = rec.worldPos.z + col.pos.z;
      this.physics.addBox?.(`${id}_col_${i++}`, { x: wx, y: col.pos.y, z: wz }, col.size, 0);
    }
  }

  getStationsNear(pos, radius = 3) {
    const near = [];
    for (const st of this._stations.values()) {
      const d = Math.hypot(st.pos.x - pos.x, st.pos.z - pos.z);
      if (d <= radius) near.push({ ...st, distance: d, key: 'G' });
    }
    return near.sort((a, b) => a.distance - b.distance);
  }

  getInteractables() {
    const list = [];
    for (const st of this._stations.values()) {
      list.push({
        id: `${st.interiorId}:${st.id}`,
        type: 'business',
        pos: st.pos,
        label: st.label,
        job: st.job,
        station_type: st.type,
      });
    }
    return list;
  }

  usStation(stationKey, player) {
    const st = this._stations.get(stationKey);
    if (!st) return { ok: false, reason: 'Poste introuvable' };

    if (st.faction && player.faction !== st.faction) {
      return { ok: false, reason: `Réservé à la faction ${st.faction}` };
    }
    if (st.job && player.job !== st.job && !player.isAdmin) {
      return { ok: false, reason: `Emploi requis: ${st.job}` };
    }
    if (st.secure && !player.isAdmin && player.faction !== 'police') {
      return { ok: false, reason: 'Zone hautement sécurisée' };
    }

    const action = this._stationAction(st, player);
    this.kernel?.route?.('interior:station_used', {
      station: stationKey, type: st.type, player_id: player.id, action,
    }, { playerId: player.id });

    return { ok: true, action, station: st.label };
  }

  _stationAction(st, player) {
    const map = {
      cash_register: 'sell',        atm: 'bank_access',
      bank_teller: 'bank_service',  vault_door: 'rob_vault',
      stove: 'cook',                prep_table: 'prepare',
      car_lift: 'repair',           workbench: 'craft',
      hospital_bed: 'heal',         pharmacy: 'get_meds',
      police_desk: 'police_work',   jail_cell: 'jail',
      weapon_locker: 'get_weapon',  gun_counter: 'buy_weapon',
      bar: 'serve_drink',           dj_booth: 'play_music',
      sales_desk: 'sell_vehicle',   reception_desk: 'reception',
    };
    return map[st.type] || 'work';
  }

  get(id) { return this._interiors.get(id); }
  getTypes() { return Object.keys(BUSINESS_TYPES); }
  getBusinessDef(type) { return BUSINESS_TYPES[type]; }

  setInteriorLights(id, on) {
    const rec = this._interiors.get(id);
    if (!rec) return;
    for (const l of rec.lights) {
      l.intensity = on ? (rec.def.nightonly ? 0.8 : 0.6) : 0.05;
    }
  }

  remove(id) {
    const rec = this._interiors.get(id);
    if (!rec) return;

    if (this.physics) {
      let i = 0;
      for (const col of rec.colliders) {
        try { this.physics.removeBody?.(`${id}_col_${i++}`); } catch (e) { /* ignore */ }
      }
    }

    this.scene.remove(rec.group);

    // Retrait des écouteurs de postes
    for (const st of rec.stations) {
      this._stations.delete(`${id}:${st.id}`);
    }

    this._interiors.delete(id);
  }

  // Destruction totale et purge GPU (anti-fuite)
  dispose() {
    const keys = [...this._interiors.keys()];
    for (const key of keys) {
      this.remove(key);
    }
    
    this._allocatedGeometries.forEach((geom) => {
      try { geom.dispose(); } catch (e) { /* ignore */ }
    });
    this._allocatedGeometries.clear();
    
    console.log(`[${SIG}·Interiors] Système purgé (VRAM libérée)`);
  }

  getStats() { return { ...this.stats, interiors: this._interiors.size, sig: SIG }; }
}

export { SIG };
export default InteriorManager;
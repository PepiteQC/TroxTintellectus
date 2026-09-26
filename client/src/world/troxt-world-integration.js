/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/TROXT-WORLD-INTEGRATION.JS
 * Intégrateur du monde Québec (Portneuf) dans l'écosystème TroxtWorld
 * ═══════════════════════════════════════════════════════════════════
 * Monte le monde 3D (fermes, bétail, bâtiments, terrain) et le connecte
 * au cerveau TROXT⬡ + sécurité 🛡️INTELLECTUS⬡ + serveur RP multijoueur.
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/world/troxt-world-integration.js
 */

import * as THREE from 'three';

// ─── Modules monde québécois (import ESM) ────────────────────────────────────
import {
  matLib, geoLib,
  buildBuilding, setBuildingLights,
  buildMaisonCanadienne, buildEglise, buildDepanneur,
  buildGrange, buildCabaneASucre, buildCaisseDesjardins,
} from './quebec-compat.js';
import { getTerrainHeight, getTerrainType, getNearestVillage } from './WorldData.js';
import {
  farmManager, mountFarms, tickFields, workField, nearestField,
  legalFarmsteads, farmMapMarks, seizeField,
} from './Farms.js';
import {
  mountHerd, tickHerd, nearestStock, workStock, stockPrompt,
  getHerdStats, checkBirth,
} from './Livestock.js';
import {
  tickWanted, connectPolice, getWanted,
} from './PoliceHelpers.js';

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

const log = (lvl, msg) => {
  const icons = { OK: '✓', WARN: '⚠', WORLD: '🌍', INFO: 'ℹ' };
  const icon = icons[lvl] || '·';
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${icon} [${SIG}·Québec] ${msg}`);
};

// Validation stricte de type Object3D
function isObject3D(v) {
  return !!(v && typeof v === 'object' && v.isObject3D);
}

// ═══════════════════════════════════════════════════════════════════
// INTEG-MONDE CLASS
// ═══════════════════════════════════════════════════════════════════
export class TroxtWorldQuebec {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {object} [o.client]     TroxtClient (WebSocket) — optionnel
   * @param {Function} [o.emit]     Pont direct vers Lua/serveur — optionnel
   */
  constructor({ scene, client = null, emit = null } = {}) {
    if (!scene) throw new Error('[TROXT·Integration] Instance de scene THREE requise');
    this.scene   = scene;
    this.client  = client;
    this.sig     = SIG;

    // Groupe racine global du complexe Québec
    this.root = new THREE.Group();
    this.root.name = 'troxt-quebec-world';
    this.scene.add(this.root);

    // Détermination dynamique du pont réseau d'événements
    if (typeof emit === 'function') {
      this._emit = emit;
    } else if (client && typeof client.rp_action === 'function') {
      this._emit = (e, d) => client.rp_action(e, d);
    } else {
      this._emit = (e, d) => this._emitToBridge(e, d);
    }

    this._playerPos = { x: 0, z: 0 };
    this._mounted   = false;
    this._buildings = null;
    this._stats     = { farms: 0, animals: 0, buildings: 0 };
    
    // Tracking des contrôleurs d'abandon HTTP pour éviter les requêtes fantômes
    this._abortControllers = new Set();
  }

  // Pont réseau éphémère vers l'asset-server si standalone
  async _emitToBridge(event, data) {
    const controller = new AbortController();
    this._abortControllers.add(controller);
    
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    try {
      await fetch('http://localhost:4200/lua/emit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ event, data: { ...data, sig: SIG } }),
        signal:  controller.signal,
      });
    } catch (e) {
      // Échec silencieux du bridge hors-ligne
    } finally {
      clearTimeout(timeoutId);
      this._abortControllers.delete(controller);
    }
  }

  // ─── INITIALISATION ET MONTAGE DES ELEMENTS ────────────────────────────────
  async mount() {
    if (this._mounted) return this;
    log('WORLD', 'Montage du monde Québec (Portneuf)...');

    // 1. Branchement du réseau d'alerte sécurité police (SQ)
    connectPolice({
      emit: (e, d) => this._emit(e, d),
      onChange: (playerId, state) => {
        if (!this.client?.dispatchEvent) return;
        this.client.dispatchEvent(
          new CustomEvent('wanted_change', {
            detail: { playerId, ...state },
          })
        );
      },
    });

    // 2. Montage des fermes & champs
    mountFarms(this.root);
    this._stats.farms = farmManager.getAllPlots().length;
    log('OK', `${this._stats.farms} parcelles agricoles montées`);

    // 3. Montage du cheptel (Bétail / Animaux)
    try {
      mountHerd(this.root);
      const herd = getHerdStats?.() || {};
      this._stats.animals = herd.total ?? herd.count ?? 0;
      log('OK', `Bétail monté — ${this._stats.animals} animaux`);
    } catch (e) {
      log('WARN', `Bétail non monté: ${e.message}`);
    }

    // 4. Montage architectural du village
    try {
      this._mountVillage();
      log('OK', `${this._stats.buildings} bâtiments québécois montés`);
    } catch (e) {
      log('WARN', `Bâtiments non montés: ${e.message}`);
    }

    // 5. Signaler au serveur / Lua l'état de complétion de l'environnement
    this._emit('troxtworld:quebec_ready', {
      farms:     this._stats.farms,
      animals:   this._stats.animals,
      buildings: this._stats.buildings,
      villages:  farmMapMarks().length,
      sig:       SIG,
    });

    this._mounted = true;
    log('WORLD', 'Monde Québec EN LIGNE');
    return this;
  }

  // ─── BOUCLE TECHNIQUE DE SIMULATION (20Hz/60Hz) ────────────────────────────
  tick(dt) {
    if (!this._mounted) return;
    const { x, z } = this._playerPos;
    
    // Ticks physiques et logs de simulation
    tickFields(dt, x, z);
    if (typeof tickHerd === 'function') tickHerd(dt);
    tickWanted(dt);
    if (typeof checkBirth === 'function') checkBirth();
  }

  setPlayerPos(x, z) {
    this._playerPos.x = x;
    this._playerPos.z = z;
  }

  // ─── CONSTRUCTION DU VILLAGE DE PORTNEUF ──────────────────────────────────
  _mountVillage() {
    this._buildings = new THREE.Group();
    this._buildings.name = 'quebec-village';

    const layout = [
      { fn: buildEglise,           x: 0,   z: 0,  yaw: 0,    seed: 1831, name: 'Église Saint-Alban' },
      { fn: buildCaisseDesjardins, x: 25,  z: 5,  yaw: -0.2, seed: 42,   name: 'Caisse Desjardins' },
      { fn: buildDepanneur,        x: -22, z: 8,  yaw: 0.15, seed: 7,    name: 'Dépanneur du Rang' },
      { fn: buildMaisonCanadienne, x: -35, z: 30, yaw: 0.4,  seed: 101,  name: 'Maison canadienne A' },
      { fn: buildMaisonCanadienne, x: 30,  z: 35, yaw: -0.3, seed: 102,  name: 'Maison canadienne B' },
      { fn: buildCabaneASucre,     x: -60, z: 60, yaw: 0.6,  seed: 21,   name: 'Cabane à sucre' },
      { fn: buildGrange,           x: -45, z: 48, yaw: 0.1,  seed: 13,   name: 'Grange' },
    ];

    for (let i = 0; i < layout.length; i++) {
      const b = layout[i];
      if (typeof b.fn !== 'function') continue;
      
      try {
        const mesh = b.fn({ seed: b.seed });
        if (!isObject3D(mesh)) {
          log('WARN', `${b.name}: mesh généré invalide (non hérité de THREE.Object3D)`);
          continue;
        }

        const rawY = getTerrainHeight(b.x, b.z);
        const y    = Number.isFinite(rawY) ? rawY : 0;

        mesh.position.set(b.x, y, b.z);
        mesh.rotation.y = b.yaw;
        mesh.userData.buildingName = b.name;
        
        this._buildings.add(mesh);
        this._stats.buildings++;
      } catch (e) {
        log('WARN', `${b.name} : ${e.message}`);
      }
    }

    this.root.add(this._buildings);
  }

  // Éclairage global dynamique (Jour / Nuit)
  setNight(isNight) {
    if (typeof setBuildingLights !== 'function' || !this._buildings) return;
    const children = this._buildings.children;
    for (let i = 0; i < children.length; i++) {
      try { setBuildingLights(children[i], isNight); } catch { /* ignore */ }
    }
  }

  // ─── INTERACTION & ÉCONOMIE JOUEURS ────────────────────────────────────────
  workNearestField(tool, seed, playerId) {
    if (typeof nearestField !== 'function') {
      return { ok: false, notice: 'Système agricole non initialisé.' };
    }
    const plot = nearestField(this._playerPos.x, this._playerPos.z, 20);
    if (!plot) return { ok: false, notice: 'Aucun champ cultivable dans les environs.' };

    const res = workField(plot.id, tool, seed, playerId);
    if (res?.loot) {
      this._emit('troxtworld:harvest', {
        player_id: playerId, plot: plot.id, loot: res.loot,
        illegal:   !!res.wantedPoints, sig: SIG,
      });
    }
    return res;
  }

  workNearestStock(action, playerId) {
    if (typeof nearestStock !== 'function') {
      return { ok: false, notice: 'Système d\'élevage bétail non initialisé.' };
    }
    const animal = nearestStock(this._playerPos.x, this._playerPos.z, 15);
    if (!animal) return { ok: false, notice: 'Aucun bétail à proximité.' };

    const res = typeof workStock === 'function' ? workStock(animal.id, action, playerId) : { ok: false };
    if (res.loot) {
      this._emit('troxtworld:animal_product', {
        player_id: playerId, animal: animal.id, loot: res.loot, sig: SIG,
      });
    }
    return res;
  }

  getPrompt(tool) {
    if (typeof nearestField === 'function') {
      const field = nearestField(this._playerPos.x, this._playerPos.z, 20);
      if (field) {
        return { kind: 'field', id: field.id, text: `Champ (${field.stage})`, tool };
      }
    }
    if (typeof nearestStock === 'function') {
      const stock = nearestStock(this._playerPos.x, this._playerPos.z, 15);
      if (stock) {
        return { kind: 'stock', id: stock.id, text: stockPrompt?.(stock.id) || 'Animal', tool };
      }
    }
    return null;
  }

  terrainHeightAt(x, z) { return getTerrainHeight(x, z); }
  terrainTypeAt(x, z)   { return getTerrainType(x, z); }
  nearestVillage(x, z)  { return getNearestVillage(x, z); }
  mapMarks()            { return farmMapMarks(); }
  wantedOf(playerId)    { return getWanted(playerId); }

  getStats() {
    return {
      ...this._stats,
      mounted: this._mounted,
      herd:    getHerdStats?.() || {},
      sig:     SIG,
    };
  }

  // ─── LIBÉRATION DES RESSOURCES (DISPOSE STRICT) ────────────────────────────
  dispose() {
    // 1. Annulation des requêtes HTTP réseau en cours
    this._abortControllers.forEach(controller => controller.abort());
    this._abortControllers.clear();

    // 2. Destruction des composants de simulation
    if (typeof farmManager?.dispose === 'function') {
      try { farmManager.dispose(); } catch (e) { /* ignore */ }
    }

    // 3. Libération de la mémoire GPU (VRAM)
    this.root.traverse((obj) => {
      if (obj.isMesh) {
        if (obj.geometry) {
          try { obj.geometry.dispose(); } catch (e) { /* ignore */ }
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => {
              try { m.dispose(); } catch (e) { /* ignore */ }
            });
          } else {
            try { obj.material.dispose(); } catch (e) { /* ignore */ }
          }
        }
      }
    });

    this.scene.remove(this.root);
    
    // Purge de l'usine à textures / géométries locales
    try { matLib?.dispose?.(); } catch (e) { /* ignore */ }
    try { geoLib?.dispose?.(); } catch (e) { /* ignore */ }

    this._mounted = false;
    log('INFO', 'Monde Québec démonté et mémoire VRAM purgée');
  }
}

export { SIG };
export default TroxtWorldQuebec;
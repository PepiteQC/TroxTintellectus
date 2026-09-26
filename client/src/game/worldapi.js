/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/WORLDAPI.JS (v3.1 · boosted)
 * API monde centralisée — point d'entrée unique pour TroxTWorld
 * ═══════════════════════════════════════════════════════════════════════════
 * Boost v3.1 — correctifs :
 *   • updateTimer + saveTimer initialisés
 *   • Guards runtime à la place des `worldState!`
 *   • economySystem + justiceSystem instanciés
 *   • Level-up money correct (delta réel)
 *   • getPlayer() : init lazy + persistance
 *   • advanceTime() : update sans téléport
 *   • interactWithNPC : player concept unifié
 *   • checkWorldAPICompatibility : guard NaN
 *   • Double singleton unifié
 *   • repairBuilding : mapping correct
 *   • loadWorldState : clamp + validation
 *   • setTime wrapper → setNight du world
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/worldapi.js
 */

import * as THREE from 'three';
import { getGeo, geoStats, InstancePool } from './geometries.js';
import PortneufWorld from './portneuf/world.js';
import { getTerrainHeight } from './portneuf/worlddata.js';
import { setCurrentDay, setCurrentSeason, setCurrentTime } from './city.js';

const SIG = 'TROXT⬡';

export const WORLD_ENGINE_VERSION = '3.0.0';
export const WORLD_API_VERSION = '3.0.0';

// ─── Re-exports bruts (à conserver pour la compat ascendante) ─────────────
export { getGeo, geoStats, InstancePool };

// ─── Helper version ────────────────────────────────────────────────────────
/**
 * @param {string} required
 * @returns {boolean}
 */
export function checkWorldAPICompatibility(required) {
  if (typeof required !== 'string') return false;
  const r = required.split('.').map(Number);
  const c = WORLD_API_VERSION.split('.').map(Number);
  if (r.some(Number.isNaN) || c.some(Number.isNaN)) return false;
  return c[0] === r[0] && c[1] >= r[1];
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY D'ÉTAT PAR DÉFAUT (évite mutations sur fallback)
// ═══════════════════════════════════════════════════════════════════════════

function makeDefaultPlayer() {
  return {
    money: 0, experience: 0, level: 1,
    reputation: {}, skills: {}, inventory: {}, equipped: {},
    ownedBuildings: [], ownedVehicles: [],
    activeQuests: [], completedQuests: [], discoveredAreas: {},
    playTime: 0, lastSave: Date.now(),
    currentVehicle: undefined,
  };
}

function makeDefaultWorldState() {
  return {
    currentDay: 0, currentTime: 12, dayPhase: 'midi',
    season: 'ete', weather: 'clear',
    temperature: 22, windSpeed: 10, windDirection: 180,
    globalReputation: 70, globalSatisfaction: 75,
    crimeRate: 10, pollution: 20, wealth: 5_000_000,
    population: 0, taxRate: 0.15,
    player: makeDefaultPlayer(),
    factions: {}, events: [], quests: [],
    economySystem: makeDefaultEconomy(),
    justiceSystem: makeDefaultJustice(),
  };
}

function makeDefaultEconomy() {
  return {
    resources: {
      bois: { price: 5 }, essence: { price: 2 }, ble: { price: 8 },
      sirop_erable: { price: 25 }, poisson: { price: 12 },
    },
    taxes: { incomeTax: 0.15, salesTax: 0.09975, propertyTax: 0.008, businessTax: 0.05 },
  };
}

function makeDefaultJustice() {
  return { crimes: [], wantedList: [] };
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLDAPI — POINT D'ENTRÉE UNIQUE
// ═══════════════════════════════════════════════════════════════════════════

export class WorldAPI {
  /** @type {WorldAPI|null} */
  static instance = null;

  /**
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   */
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    /** @type {PortneufWorld|null} */
    this.world = null;
    /** @type {object} */
    this.worldState = makeDefaultWorldState();

    // 🔧 BOOST : timers initialisés (bug #1 & #2)
    this.updateTimer = 0;
    this.saveTimer = 0;

    this.initializeWorld();
  }

  static getInstance(scene, camera) {
    if (!WorldAPI.instance) WorldAPI.instance = new WorldAPI(scene, camera);
    return WorldAPI.instance;
  }

  initializeWorld() {
    this.world = new PortneufWorld({ terrainProvider: getTerrainHeight });
    // 🔧 BOOST : sync — certains modules de city.js ont un état de temps global
    try {
      setCurrentDay(this.worldState.currentDay);
      setCurrentSeason(this.worldState.season);
      setCurrentTime(this.worldState.currentTime);
    } catch { /* city.js peut ne pas être chargé */ }
  }

  buildWorld() { this.world?.build(); }

  // ─── ACCESSEURS ─────────────────────────────────────────────────────────
  getWorld() { return this.world; }
  getWorldState() { return this.worldState; }
  getScene() { return this.scene; }
  getCamera() { return this.camera; }

  // ═════════════════════════════════════════════════════════════════════════
  // MÉTÉO / SAISONS / TEMPS
  // ═════════════════════════════════════════════════════════════════════════
  setWeather(w) { this.world?.setWeather?.(w); this.worldState.weather = w; }
  getWeather() { return this.worldState.weather || 'clear'; }

  setSeason(s) {
    try { setCurrentSeason(s); } catch {}
    this.worldState.season = s;
  }
  getSeason() { return this.worldState.season || 'ete'; }

  setTime(hours) {
    const h = Math.max(0, Math.min(23.99, Number(hours) || 0));
    // 🔧 BOOST : setTime n'existe pas dans le world allégé → on wrap setNight
    if (typeof this.world?.setTime === 'function') this.world.setTime(h);
    else if (typeof this.world?.setNight === 'function') this.world.setNight(h < 6 || h > 20);
    this.worldState.currentTime = h;
    this.worldState.dayPhase = this.getDayPhase(h);
    try { setCurrentTime(h); } catch {}
  }
  getTime() { return this.worldState.currentTime ?? 12; }
  getDayPhase() { return this.worldState.dayPhase || 'midi'; }

  getDayPhase(hours) {
    // 🔧 BOOST : méthode manquante dans l'original
    if (hours < 5) return 'nuit';
    if (hours < 8) return 'aube';
    if (hours < 12) return 'matin';
    if (hours < 14) return 'midi';
    if (hours < 18) return 'apres_midi';
    if (hours < 21) return 'soir';
    return 'nuit';
  }

  setDay(day) {
    try { setCurrentDay(day); } catch {}
    this.worldState.currentDay = Math.max(0, Math.floor(day));
  }
  getDay() { return this.worldState.currentDay || 0; }

  advanceTime(hours) {
    if (!Number.isFinite(hours)) return;
    const total = this.worldState.currentTime + hours;
    const daysPassed = Math.floor(total / 24);
    const newHour = ((total % 24) + 24) % 24;
    this.setTime(newHour);
    this.setDay(this.worldState.currentDay + daysPassed);
    // 🔧 BOOST : ne pas téléporter — update avec dt=0
    this.world?.update?.(0, newHour * 3600, this.getPlayerPositionSafe(), 0, 0);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VILLES / BÂTIMENTS
  // ═════════════════════════════════════════════════════════════════════════
  getCities() {
    // 🔧 BOOST : le world allégé n'a pas `cityBuildings` → fallback []
    return this.world?.cityBuildings || [];
  }
  getCityById(cityId) { return this.getCities().find((c) => c.group?.name === cityId); }

  getAllBuildings() {
    const out = [];
    for (const city of this.getCities()) out.push(...(city.buildings || []));
    return out;
  }
  getBuildingById(id) { return this.getAllBuildings().find((b) => b.id === id); }
  getBuildingsByType(type) { return this.getAllBuildings().filter((b) => b.type === type); }
  getBuildingsByCategory(cat) { return this.getAllBuildings().filter((b) => b.category === cat); }
  getBuildingsByCondition(c) { return this.getAllBuildings().filter((b) => b.condition === c); }
  getBuildingsByQuality(min = 1, max = 5) {
    return this.getAllBuildings().filter((b) => b.quality >= min && b.quality <= max);
  }

  buyBuilding(buildingId, buyerId) {
    const b = this.getBuildingById(buildingId);
    if (!b || b.owner) return false;
    const buyer = this.getNPCById(buyerId) || this.getPlayer();
    if (!buyer || buyer.wealth < b.buyCost) return false;
    buyer.wealth -= b.buyCost;
    b.owner = buyerId;
    if (buyerId === 'player') {
      this.worldState.player.ownedBuildings.push(buildingId);
      // statistics.moneySpent : à ajouter dans worldState
      this.worldState.moneySpent = (this.worldState.moneySpent || 0) + b.buyCost;
    }
    return true;
  }

  sellBuilding(buildingId, sellerId) {
    const b = this.getBuildingById(buildingId);
    if (!b || b.owner !== sellerId) return false;
    const seller = this.getNPCById(sellerId) || this.getPlayer();
    const price = Math.floor(b.value * 0.9);
    if (seller) seller.wealth += price;
    b.owner = null;                            // 🔧 BOOST : null cohérent
    if (sellerId === 'player') {
      this.worldState.player.ownedBuildings = this.worldState.player.ownedBuildings.filter((id) => id !== buildingId);
      this.worldState.moneyEarned = (this.worldState.moneyEarned || 0) + price;
    }
    return true;
  }

  repairBuilding(buildingId) {
    const b = this.getBuildingById(buildingId);
    if (!b) return false;
    if (b.durability >= 80) return false;      // 🔧 BOOST : check unique
    const cost = Math.floor(b.value * 0.1 * (1 - b.durability / 100));
    const p = this.getPlayer();
    if (p.wealth < cost) return false;
    p.wealth -= cost;
    b.durability = Math.min(100, b.durability + 30);
    // 🔧 BOOST : mapping condition correct (bon_etat atteignable)
    b.condition = b.durability >= 90 ? 'neuf'
                : b.durability >= 70 ? 'bon_etat'
                : b.durability >= 50 ? 'use'
                : 'abandonne';
    return true;
  }

  upgradeBuilding(buildingId) {
    const b = this.getBuildingById(buildingId);
    if (!b || b.quality >= 5) return false;
    const cost = Math.floor(b.value * 0.3);
    const p = this.getPlayer();
    if (p.wealth < cost) return false;
    p.wealth -= cost;
    b.quality = Math.min(5, b.quality + 1);
    b.value = Math.floor(b.value * 1.2);
    b.buyCost = Math.floor(b.buyCost * 1.2);
    b.rentCost = Math.floor(b.rentCost * 1.2);
    b.reputationImpact = Math.floor((b.reputationImpact || 0) * 1.1);
    return true;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // NPCs / CITOYENS
  // ═════════════════════════════════════════════════════════════════════════
  getAllNPCs() { return this.world?.npcs || []; }
  getNPCById(id) { return this.getAllNPCs().find((n) => n.id === id); }
  getNPCsByType(t) { return this.getAllNPCs().filter((n) => n.type === t); }
  getNPCsByFaction(f) { return this.getAllNPCs().filter((n) => n.faction === f); }
  getNPCsByMood(m) { return this.getAllNPCs().filter((n) => n.mood === m); }

  getCitizensByCity(cityId) {
    const city = this.getCityById(cityId);
    return city?.citizens || [];
  }
  getCitizenById(id) {
    for (const c of this.getCities()) {
      const cit = (c.citizens || []).find((x) => x.id === id);
      if (cit) return cit;
    }
    return undefined;
  }

  interactWithNPC(npcId, action, params) {
    const npc = this.getNPCById(npcId);
    if (!npc) return { success: false, message: 'PNJ introuvable.' };
    const player = this.getPlayer();
    switch (action) {
      case 'talk':   return this._talkToNPC(npc, player);
      case 'trade':  return this._tradeWithNPC(npc, player, params?.items);
      case 'give':   return this._giveToNPC(npc, player, params?.itemId, params?.quantity);
      case 'take':   return this._takeFromNPC(npc, player, params?.itemId, params?.quantity);
      case 'follow': return this._setNPCFollow(npc, player, params?.follow);
      case 'arrest': return this._arrestNPC(npc, player);
      default:       return { success: false, message: 'Action invalide.' };
    }
  }

  _talkToNPC(npc, player) {
    const greetings = npc.dialogue?.greetings;
    const greeting = greetings?.length
      ? greetings[Math.floor(Math.random() * greetings.length)]
      : 'Bonjour ! Comment puis-je vous aider ?';
    return {
      success: true,
      message: `${npc.name}: ${greeting}`,
      data: { npcId: npc.id, npcName: npc.name, npcMood: npc.mood, dialogueOptions: this._getDialogueOptions(npc, player) },
    };
  }

  _getDialogueOptions(npc, player) {
    const opts = [{ text: "Avez-vous besoin d'aide ?", action: 'talk', params: { topic: 'help' } }];
    if (npc.type === 'commercant' || npc.profession?.includes('marchand'))
      opts.push({ text: 'Je voudrais échanger.', action: 'trade' });
    if (Object.keys(player.inventory).length > 0)
      opts.push({ text: 'Je voudrais vous donner quelque chose.', action: 'give' });
    if (npc.quests?.length)
      opts.push({ text: 'Avez-vous des quêtes pour moi ?', action: 'quests' });
    return opts;
  }

  _tradeWithNPC(npc, player, items) {
    if (npc.type !== 'commercant' && !npc.profession?.includes('marchand'))
      return { success: false, message: `${npc.name}: Je ne suis pas commerçant, désolé.` };
    const market = this.getNearestMarket(npc.position?.x ?? 0, npc.position?.z ?? 0);
    if (!market) return { success: false, message: `${npc.name}: Je n'ai rien à vendre.` };
    const vendor = market.vendors.find((v) => v.id === npc.id);
    if (!vendor) return { success: false, message: `${npc.name}: Pas de stock.` };

    if (items?.length) {
      const results = [];
      let totalCost = 0;
      for (const itemId of items) {
        const item = vendor.items.find((i) => i.id === itemId);
        if (!item) { results.push({ itemId, success: false, message: 'Introuvable.' }); continue; }
        if (item.quantity <= 0) { results.push({ itemId, success: false, message: 'Rupture.' }); continue; }
        if (player.money < item.price) { results.push({ itemId, success: false, message: 'Fonds insuffisants.' }); continue; }
        totalCost += item.price;
        item.quantity--;
        player.money -= item.price;
        player.inventory[itemId] = (player.inventory[itemId] || 0) + 1;
        results.push({ itemId, success: true, message: `Achat de ${item.name} pour ${item.price} $.` });
      }
      return { success: true, message: `Échange terminé. Total: ${totalCost} $.`, data: { results, remainingMoney: player.money } };
    }
    return {
      success: true,
      message: `${npc.name}: Voici ce que j'ai à vendre :`,
      data: { vendorId: vendor.id, vendorName: vendor.name, items: vendor.items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })) },
    };
  }

  _giveToNPC(npc, player, itemId, quantity = 1) {
    if (!itemId) {
      return { success: false, message: 'Quel objet souhaitez-vous donner ?',
        data: { inventory: Object.entries(player.inventory).map(([id, q]) => ({ id, quantity: q })) } };
    }
    if (!player.inventory[itemId] || player.inventory[itemId] < quantity)
      return { success: false, message: 'Vous ne possédez pas cet objet.' };
    player.inventory[itemId] -= quantity;
    if (player.inventory[itemId] <= 0) delete player.inventory[itemId];
    npc.inventory = npc.inventory || {};
    npc.inventory[itemId] = (npc.inventory[itemId] || 0) + quantity;
    const reactions = [`${npc.name}: Merci beaucoup !`, `${npc.name}: C'est très généreux.`, `${npc.name}: Oh, merci !`];
    npc.relationships = npc.relationships || {};
    npc.relationships.player = Math.min(100, (npc.relationships.player || 0) + 5);
    return { success: true, message: reactions[Math.floor(Math.random() * reactions.length)], data: { newInventory: player.inventory } };
  }

  _takeFromNPC(npc, player, itemId, quantity = 1) {
    if (!itemId) {
      return { success: false, message: 'Quel objet ?',
        data: { inventory: Object.entries(npc.inventory || {}).map(([id, q]) => ({ id, quantity: q })) } };
    }
    if (!npc.inventory?.[itemId] || npc.inventory[itemId] < quantity)
      return { success: false, message: `${npc.name}: Je n'ai pas cet objet.` };
    if ((npc.relationships?.player ?? 0) < 30)
      return { success: false, message: `${npc.name}: Je ne vous connais pas assez.` };
    npc.inventory[itemId] -= quantity;
    if (npc.inventory[itemId] <= 0) delete npc.inventory[itemId];
    player.inventory[itemId] = (player.inventory[itemId] || 0) + quantity;
    const reactions = [`${npc.name}: Voici, prenez-en soin.`, `${npc.name}: J'espère que ça vous sera utile.`];
    return { success: true, message: reactions[Math.floor(Math.random() * reactions.length)], data: { newInventory: player.inventory } };
  }

  _setNPCFollow(npc, player, follow) {
    if (follow) {
      if ((npc.relationships?.player ?? 0) < 20)
        return { success: false, message: `${npc.name}: Je ne vous fais pas assez confiance.` };
      if (npc.currentActivity === 'work' || npc.currentActivity === 'sleep')
        return { success: false, message: `${npc.name}: Je suis occupé.` };
      npc.currentActivity = 'follow';
      npc.targetPosition = { x: player.position?.x || 0, z: player.position?.z || 0 };
      return { success: true, message: `${npc.name}: Je vous suis !` };
    }
    npc.currentActivity = undefined;
    npc.targetPosition = undefined;
    return { success: true, message: `${npc.name}: Je reste ici.` };
  }

  _arrestNPC(npc, player) {
    // 🔧 BOOST : le player a un flag faction séparé (pas dans NPCs)
    const isPolice = player.faction === 'police' || this.worldState.player.faction === 'police';
    if (!isPolice) return { success: false, message: "Vous n'êtes pas policier." };
    if (!npc.isWanted) return { success: false, message: `${npc.name}: Ce citoyen n'est pas recherché.` };

    npc.isArrested = true;
    npc.arrestReason = 'Arrêté par le joueur';
    npc.arrestDuration = 24;
    npc.currentActivity = 'sleep';

    this.worldState.justiceSystem.crimes.push({
      id: `crime_${Date.now()}`,
      type: 'arrestation',
      severity: 'modere',
      location: { x: npc.position.x, z: npc.position.z },
      time: this.worldState.currentDay * 24 + this.worldState.currentTime,
      perpetrator: npc.id,
      victim: undefined,
      witnesses: ['player'],
      reported: true, investigated: true, solved: true,
      punishment: '24 heures de prison', fine: 100, jailTime: 24, reward: 50,
    });

    player.money += 50;
    player.reputation.police = Math.min(100, (player.reputation.police || 0) + 5);
    return { success: true, message: `${npc.name}: Vous êtes en état d'arrestation !` };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // JOUEUR
  // ═════════════════════════════════════════════════════════════════════════
  getPlayer() {
    // 🔧 BOOST : init lazy du player (bug #6)
    if (!this.worldState.player) this.worldState.player = makeDefaultPlayer();
    return this.worldState.player;
  }

  updatePlayerMoney(amount) {
    const p = this.getPlayer();
    p.money = Math.max(0, p.money + amount);
    return p.money;
  }

  updatePlayerExperience(amount) {
    const p = this.getPlayer();
    const oldLevel = p.level;
    p.experience += amount;

    const thresholds = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];
    let newLevel = 1;
    for (let i = 0; i < thresholds.length; i++) {
      if (p.experience >= thresholds[i]) newLevel = i + 1;
    }

    if (newLevel > oldLevel) {
      // 🔧 BOOST : delta correct (bug #5)
      const levelsGained = newLevel - oldLevel;
      p.level = newLevel;
      p.money += 100 * levelsGained * ((oldLevel + newLevel) / 2); // bonus progressif
    }
    return { level: p.level, experience: p.experience };
  }

  addToPlayerInventory(itemId, quantity = 1) {
    const p = this.getPlayer();
    p.inventory[itemId] = (p.inventory[itemId] || 0) + quantity;
    return p.inventory[itemId];
  }

  removeFromPlayerInventory(itemId, quantity = 1) {
    const p = this.getPlayer();
    if (!p.inventory[itemId] || p.inventory[itemId] < quantity) return null;
    p.inventory[itemId] -= quantity;
    if (p.inventory[itemId] <= 0) delete p.inventory[itemId];
    return p.inventory[itemId] || 0;
  }

  equipItem(slot, itemId) {
    const p = this.getPlayer();
    if (!p.inventory[itemId] || p.inventory[itemId] <= 0) return false;
    p.equipped[slot] = itemId;
    return true;
  }
  unequipItem(slot) { this.getPlayer().equipped[slot] = undefined; return true; }
  improvePlayerSkill(skill, amount = 1) {
    const p = this.getPlayer();
    p.skills[skill] = Math.min(100, (p.skills[skill] || 0) + amount);
    return p.skills[skill];
  }

  // ═════════════════════════════════════════════════════════════════════════
  // QUÊTES
  // ═════════════════════════════════════════════════════════════════════════
  getAllQuests() { return this.worldState.quests || []; }
  getQuestById(id) { return this.getAllQuests().find((q) => q.id === id); }
  getPlayerActiveQuests() {
    const p = this.getPlayer();
    return this.getAllQuests().filter((q) => p.activeQuests.includes(q.id) && !q.isCompleted && !q.isFailed);
  }
  getPlayerCompletedQuests() {
    const p = this.getPlayer();
    return this.getAllQuests().filter((q) => p.completedQuests.includes(q.id) || q.isCompleted);
  }

  activateQuest(questId) {
    const q = this.getQuestById(questId);
    if (!q) return false;
    const p = this.getPlayer();
    const pre = q.prerequisites;
    if (pre) {
      if (pre.quests && !pre.quests.every((id) => p.completedQuests.includes(id))) return false;
      if (pre.reputation) {
        for (const [f, lvl] of Object.entries(pre.reputation)) if ((p.reputation[f] || 0) < lvl) return false;
      }
      if (pre.items && !pre.items.every((id) => p.inventory[id] > 0)) return false;
      if (pre.level && p.level < pre.level) return false;
    }
    if (!p.activeQuests.includes(questId)) p.activeQuests.push(questId);
    q.isActive = true;
    return true;
  }

  updateQuestProgress(questId, objectiveIndex, progress = 1) {
    const q = this.getQuestById(questId);
    if (!q?.isActive) return false;
    const obj = q.objectives[objectiveIndex];
    if (!obj) return false;
    obj.current = (obj.current || 0) + progress;
    if (q.objectives.every((o) => o.current >= (o.count || 1))) {
      q.isCompleted = true;
      this._applyQuestRewards(q);
    }
    return true;
  }

  _applyQuestRewards(q) {
    const p = this.getPlayer();
    if (q.rewards.money) p.money += q.rewards.money;
    if (q.rewards.experience) this.updatePlayerExperience(q.rewards.experience);
    if (q.rewards.reputation) {
      for (const [f, delta] of Object.entries(q.rewards.reputation)) {
        p.reputation[f] = Math.min(100, Math.max(-100, (p.reputation[f] || 0) + delta));
      }
    }
    if (q.rewards.items) q.rewards.items.forEach((id) => this.addToPlayerInventory(id));
    if (!p.completedQuests.includes(q.id)) p.completedQuests.push(q.id);
    p.activeQuests = p.activeQuests.filter((id) => id !== q.id);
  }

  abandonQuest(questId) {
    const q = this.getQuestById(questId);
    if (!q?.isActive) return false;
    q.isFailed = true;
    q.isActive = false;
    this.getPlayer().activeQuests = this.getPlayer().activeQuests.filter((id) => id !== questId);
    return true;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RESSOURCES
  // ═════════════════════════════════════════════════════════════════════════
  getAllNaturalResources() { return this.world?.naturalResources || []; }
  getNaturalResourceById(id) { return this.getAllNaturalResources().find((r) => r.id === id); }
  getNaturalResourcesByType(t) { return this.getAllNaturalResources().filter((r) => r.type === t); }

  harvestResource(resourceId, quantity = 1) {
    const r = this.getNaturalResourceById(resourceId);
    if (!r) return { success: false, message: 'Ressource introuvable.' };
    if (r.isExhausted) return { success: false, message: 'Ressource épuisée.' };
    const p = this.getPlayer();
    if (r.requiredTool && p.equipped.tool !== r.requiredTool)
      return { success: false, message: `Vous avez besoin d'un ${r.requiredTool}.` };
    if (r.requiredSkill && (p.skills[r.requiredSkill] || 0) < (r.minSkillLevel || 0))
      return { success: false, message: `Niveau ${r.minSkillLevel} en ${r.requiredSkill} requis.` };

    const skill = r.requiredSkill ? p.skills[r.requiredSkill] || 0 : 50;
    const efficiency = 0.5 + (skill / 100) * 0.5;
    const harvested = Math.min(quantity, r.quantity, Math.floor(quantity * efficiency));

    r.quantity -= harvested;
    r.lastHarvested = this.worldState.currentDay;
    if (r.quantity <= 0) r.isExhausted = true;
    this.addToPlayerInventory(resourceId, harvested);
    if (r.requiredSkill) this.improvePlayerSkill(r.requiredSkill, 0.5);

    return { success: true, message: `Vous avez récolté ${harvested} ${r.name}.`, harvested };
  }

  getAllHarvestZones() { return this.world?.harvestZones || []; }
  getHarvestZoneById(id) { return this.getAllHarvestZones().find((z) => z.id === id); }
  getResourcesInHarvestZone(zoneId) {
    const z = this.getHarvestZoneById(zoneId);
    if (!z) return [];
    return this.getAllNaturalResources().filter((r) => Math.hypot(r.x - z.x, r.z - z.z) <= z.radius);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MARCHÉS
  // ═════════════════════════════════════════════════════════════════════════
  getAllMarkets() { return this.world?.markets || []; }
  getMarketById(id) { return this.getAllMarkets().find((m) => m.id === id); }
  getNearestMarket(x, z, maxDistance = 100) {
    let best = null, bestD = maxDistance;
    for (const m of this.getAllMarkets()) {
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < bestD) { best = m; bestD = d; }
    }
    return best;
  }
  getMarketVendors(id) { return this.getMarketById(id)?.vendors || []; }
  getVendorById(id) {
    for (const m of this.getAllMarkets()) {
      const v = m.vendors.find((x) => x.id === id);
      if (v) return v;
    }
    return undefined;
  }

  buyFromVendor(vendorId, itemId, quantity = 1) {
    const v = this.getVendorById(vendorId);
    if (!v) return { success: false, message: 'Vendeur introuvable.' };
    const item = v.items.find((i) => i.id === itemId);
    if (!item) return { success: false, message: 'Item introuvable.' };
    if (item.quantity < quantity) return { success: false, message: `Seulement ${item.quantity} disponible(s).` };
    const p = this.getPlayer();
    const total = item.price * quantity;
    if (p.money < total) return { success: false, message: `Fonds insuffisants. Coût: ${total} $.` };
    p.money -= total;
    item.quantity -= quantity;
    this.addToPlayerInventory(itemId, quantity);
    return { success: true, message: `Achat de ${quantity} ${item.name} pour ${total} $.`, totalCost: total };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FESTIVALS
  // ═════════════════════════════════════════════════════════════════════════
  getAllFestivals() { return this.world?.festivals || []; }
  getFestivalById(id) { return this.getAllFestivals().find((f) => f.id === id); }
  getActiveFestivals() { return this.getAllFestivals().filter((f) => f.isActive); }

  participateInFestivalActivity(festivalId, activityIndex) {
    const f = this.getFestivalById(festivalId);
    if (!f?.isActive) return { success: false, message: 'Festival introuvable ou inactif.' };
    const a = f.activities[activityIndex];
    if (!a) return { success: false, message: 'Activité introuvable.' };
    const h = this.worldState.currentTime;
    if (h < a.startHour || h >= a.endHour)
      return { success: false, message: `Disponible ${a.startHour}h-${a.endHour}h.` };

    f.attendance = Math.min(f.maxAttendance, f.attendance + 1);
    const p = this.getPlayer();
    if (a.rewards) {
      for (const r of a.rewards) {
        if (r.type === 'money') p.money += r.value;
        else if (r.type === 'reputation') {
          for (const [fac, d] of Object.entries(r.value)) {
            p.reputation[fac] = Math.min(100, Math.max(-100, (p.reputation[fac] || 0) + d));
          }
        } else if (r.type === 'item') this.addToPlayerInventory(r.value);
      }
    }
    return { success: true, message: `Vous participez à "${a.name}".`, rewards: a.rewards };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PÊCHE / CHASSE
  // ═════════════════════════════════════════════════════════════════════════
  getAllFishingSpots() { return this.world?.fishingSpots || []; }
  getFishingSpotById(id) { return this.getAllFishingSpots().find((s) => s.id === id); }
  getNearestFishingSpot(x, z, maxD = 50) {
    let best = null, bestD = maxD;
    for (const s of this.getAllFishingSpots()) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) { best = s; bestD = d; }
    }
    return best;
  }

  fishAtSpot(spotId) {
    const s = this.getFishingSpotById(spotId);
    if (!s) return { success: false, message: 'Zone introuvable.' };
    const p = this.getPlayer();
    if (s.requiredTool && p.equipped.tool !== s.requiredTool)
      return { success: false, message: `Vous avez besoin d'une ${s.requiredTool}.` };
    if (s.requiredLicense && !p.inventory.permis_peche)
      return { success: false, message: 'Permis de pêche requis.' };
    if (!s.isActive) return { success: false, message: 'Zone fermée.' };

    const skill = p.skills.peche || 0;
    if (Math.random() > s.fishProbability * (0.5 + skill / 100))
      return { success: false, message: "Rien n'a mordu cette fois." };

    const type = s.fishTypes[Math.floor(Math.random() * s.fishTypes.length)];
    const size = s.minFishSize + Math.random() * (s.maxFishSize - s.minFishSize);
    const value = Math.floor(size * 10);
    this.addToPlayerInventory(type, 1);
    this.improvePlayerSkill('peche', 0.3);
    s.lastFished = this.worldState.currentDay;
    s.fishStock = Math.max(0, s.fishStock - 5);
    return { success: true, message: `Vous avez pêché un ${type} de ${size.toFixed(1)} kg !`, caught: { type, size, value } };
  }

  getAllHuntingZones() { return this.world?.huntingZones || []; }
  getHuntingZoneById(id) { return this.getAllHuntingZones().find((z) => z.id === id); }
  getNearestHuntingZone(x, z, maxD = 100) {
    let best = null, bestD = maxD;
    for (const z of this.getAllHuntingZones()) {
      const d = Math.hypot(z.x - x, z.z - z);
      if (d < bestD) { best = z; bestD = d; }
    }
    return best;
  }

  huntInZone(zoneId) {
    const z = this.getHuntingZoneById(zoneId);
    if (!z) return { success: false, message: 'Zone introuvable.' };
    const p = this.getPlayer();
    if (z.requiredTool && p.equipped.weapon !== z.requiredTool)
      return { success: false, message: `Vous avez besoin d'un ${z.requiredTool}.` };
    if (z.requiredLicense && !p.inventory.permis_chasse)
      return { success: false, message: 'Permis de chasse requis.' };
    if (!z.isActive) return { success: false, message: 'Zone fermée.' };
    if (z.season && !z.season.includes(this.worldState.season))
      return { success: false, message: `Chasse non autorisée en ${this.worldState.season}.` };

    const skill = p.skills.chasse || 0;
    if (Math.random() > z.huntProbability * (0.5 + skill / 100))
      return { success: false, message: 'La chasse n\'a rien donné.' };

    const animal = z.animalTypes[Math.floor(Math.random() * z.animalTypes.length)];
    const value = Math.floor(Math.random() * 50) + 20;
    this.addToPlayerInventory(animal, 1);
    this.improvePlayerSkill('chasse', 0.4);
    z.lastHunted = this.worldState.currentDay;
    z.animalStock = Math.max(0, z.animalStock - 10);
    return { success: true, message: `Vous avez chassé un ${animal} !`, caught: { type: animal, value } };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FEUX DE CAMP
  // ═════════════════════════════════════════════════════════════════════════
  getAllCampfires() { return this.world?.campfires || []; }
  getCampfireById(id) { return this.getAllCampfires().find((c) => c.id === id); }
  getNearestCampfire(x, z, maxD = 30) {
    let best = null, bestD = maxD;
    for (const c of this.getAllCampfires()) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  toggleCampfire(id, lit) {
    const c = this.getCampfireById(id);
    if (!c) return { success: false, message: 'Feu introuvable.' };
    const p = this.getPlayer();
    if (lit) {
      if (c.isLit) return { success: false, message: 'Déjà allumé.' };
      if (!p.inventory.bois || p.inventory.bois < 1)
        return { success: false, message: 'Vous avez besoin de bois.' };
      c.isLit = true;
      c.fuel = c.maxFuel;
      this.removeFromPlayerInventory('bois', 1);
      return { success: true, message: 'Feu allumé.' };
    }
    c.isLit = false;
    return { success: true, message: 'Feu éteint.' };
  }

  addFuelToCampfire(id, quantity = 1) {
    const c = this.getCampfireById(id);
    if (!c) return { success: false, message: 'Feu introuvable.', newFuel: 0 };
    const p = this.getPlayer();
    if (!p.inventory.bois || p.inventory.bois < quantity)
      return { success: false, message: 'Pas assez de bois.', newFuel: c.fuel };
    c.fuel = Math.min(c.maxFuel, c.fuel + quantity * 10);
    this.removeFromPlayerInventory('bois', quantity);
    return { success: true, message: `+${quantity} bois.`, newFuel: c.fuel };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VÉHICULES
  // ═════════════════════════════════════════════════════════════════════════
  getAllTraffic() { return this.world?.traffic || []; }
  getVehicleById(id) { return this.getAllTraffic().find((v) => v.id === id); }
  getVehiclesByType(t) { return this.getAllTraffic().filter((v) => v.type === t); }
  getPlayerVehicles() {
    const p = this.getPlayer();
    return this.getAllTraffic().filter((v) => p.ownedVehicles.includes(v.id) || v.owner === 'player');
  }

  buyVehicle(vehicleType, model = 'standard', color = 0xc0c0c0) {
    const PRICES = { voiture: 5000, camion: 8000, pickup: 6000, tracteur: 4000, police: 10000, pompier: 12000, ambulance: 11000, depanneuse: 9000 };
    const price = PRICES[vehicleType];
    if (!price) return { success: false, message: 'Type de véhicule invalide.' };
    const p = this.getPlayer();
    if (p.money < price) return { success: false, message: `Fonds insuffisants (prix: ${price} $).` };

    const id = `vehicle_${vehicleType}_${Date.now()}`;
    const v = {
      id, type: vehicleType, mesh: new THREE.Group(),
      roadId: null, roadLen: 100, t: 0, dir: 1, speed: 0, targetSpeed: 20,
      offset: 0, length: vehicleType === 'camion' ? 8.4 : vehicleType === 'tracteur' ? 4.8 : 4.4,
      isPolice: vehicleType === 'police', chasing: false, bars: [], lightbar: null,
      condition: 'neuf', owner: 'player', driver: 'player',
      fuel: 100, maxFuel: 100,
      fuelConsumption: vehicleType === 'camion' ? 0.2 : vehicleType === 'tracteur' ? 0.15 : 0.1,
      durability: 100, maxDurability: 100, value: price,
      isStolen: false, isLocked: false,
      hasSiren: ['police', 'pompier', 'ambulance'].includes(vehicleType),
      sirenActive: false,
      hasLights: ['police', 'pompier', 'ambulance'].includes(vehicleType),
      lightsActive: false,
      cargo: {}, maxCargo: vehicleType === 'camion' ? 1000 : vehicleType === 'pickup' ? 500 : 200,
      passengers: [], maxPassengers: vehicleType === 'camion' ? 3 : vehicleType === 'pickup' ? 4 : 2,
      lastMaintenance: 0,
      maintenanceCost: vehicleType === 'camion' ? 10 : vehicleType === 'tracteur' ? 5 : 8,
      insuranceCost: vehicleType === 'camion' ? 50 : vehicleType === 'tracteur' ? 30 : 40,
      licensePlate: `QC ${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
      color, year: 2020, model,
      isEmergency: ['police', 'pompier', 'ambulance'].includes(vehicleType),
      emergencyPriority: vehicleType === 'police' ? 10 : vehicleType === 'pompier' ? 8 : vehicleType === 'ambulance' ? 9 : 0,
    };

    p.money -= price;
    p.ownedVehicles.push(id);
    if (this.world?.traffic) this.world.traffic.push(v);
    return { success: true, message: `Vous avez acheté un ${vehicleType} ${model} pour ${price} $.`, vehicle: v };
  }

  sellVehicle(vehicleId) {
    const v = this.getVehicleById(vehicleId);
    if (!v) return { success: false, message: 'Véhicule introuvable.', salePrice: 0 };
    const p = this.getPlayer();
    if (v.owner !== 'player' && !p.ownedVehicles.includes(vehicleId))
      return { success: false, message: 'Ce véhicule ne vous appartient pas.', salePrice: 0 };
    const price = Math.floor(v.value * 0.5);
    p.money += price;
    p.ownedVehicles = p.ownedVehicles.filter((id) => id !== vehicleId);
    if (this.world?.traffic) this.world.traffic = this.world.traffic.filter((x) => x.id !== vehicleId);
    return { success: true, message: `Vendu pour ${price} $.`, salePrice: price };
  }

  repairVehicle(vehicleId) {
    const v = this.getVehicleById(vehicleId);
    if (!v) return { success: false, message: 'Introuvable.', repairCost: 0 };
    const p = this.getPlayer();
    if (v.owner !== 'player' && !p.ownedVehicles.includes(vehicleId))
      return { success: false, message: 'Pas à vous.', repairCost: 0 };
    const cost = Math.floor(v.value * 0.1 * (1 - v.durability / v.maxDurability));
    if (p.money < cost) return { success: false, message: `Coût: ${cost} $.`, repairCost: cost };
    p.money -= cost;
    v.durability = v.maxDurability;
    v.condition = 'neuf';
    return { success: true, message: `Réparé pour ${cost} $.`, repairCost: cost };
  }

  refuelVehicle(vehicleId, quantity = 10) {
    const v = this.getVehicleById(vehicleId);
    if (!v) return { success: false, message: 'Introuvable.', newFuel: 0 };
    const p = this.getPlayer();
    if (v.owner !== 'player' && !p.ownedVehicles.includes(vehicleId))
      return { success: false, message: 'Pas à vous.', newFuel: v.fuel };
    if (!p.inventory.essence || p.inventory.essence < quantity)
      return { success: false, message: 'Pas assez d\'essence.', newFuel: v.fuel };
    const added = Math.min(v.maxFuel - v.fuel, quantity);
    v.fuel += added;
    // 🔧 BOOST : ne retire que ce qui a été ajouté (bug #17)
    this.removeFromPlayerInventory('essence', added);
    return { success: true, message: `+${added} L d'essence.`, newFuel: v.fuel };
  }

  useVehicle(vehicleId) {
    const v = this.getVehicleById(vehicleId);
    if (!v) return false;
    const p = this.getPlayer();
    if (v.owner !== 'player' && !p.ownedVehicles.includes(vehicleId) && !v.isStolen) return false;
    if (v.fuel <= 0) return false;
    p.currentVehicle = vehicleId;
    v.driver = 'player';
    return true;
  }

  exitVehicle() {
    const p = this.getPlayer();
    if (!p.currentVehicle) return false;
    const v = this.getVehicleById(p.currentVehicle);
    if (!v) return false;
    p.currentVehicle = undefined;
    v.driver = undefined;
    return true;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MAISONS
  // ═════════════════════════════════════════════════════════════════════════
  getAllHouses() { return this.world?.houses || []; }
  getHouseByDeedId(deedId) { return this.getAllHouses().find((h) => h.deedId === deedId); }
  getNearestHouse(x, z, maxD = 50) {
    let best = null, bestD = maxD;
    for (const h of this.getAllHouses()) {
      const d = Math.hypot(h.x - x, h.z - z);
      if (d < bestD) { best = h; bestD = d; }
    }
    return best;
  }

  buyHouse(deedId) {
    const h = this.getHouseByDeedId(deedId);
    if (!h) return false;
    const deed = this.world?.deeds?.find((d) => d.id === deedId);
    if (!deed) return false;
    const p = this.getPlayer();
    if (p.money < deed.price) return false;
    p.money -= deed.price;
    p.ownedBuildings.push(deedId);
    h.state = 'owned';
    return true;
  }

  sellHouse(deedId) {
    const h = this.getHouseByDeedId(deedId);
    if (!h) return false;
    const deed = this.world?.deeds?.find((d) => d.id === deedId);
    if (!deed) return false;
    const p = this.getPlayer();
    if (!p.ownedBuildings.includes(deedId)) return false;
    const price = Math.floor(deed.price * 0.8);
    p.money += price;
    p.ownedBuildings = p.ownedBuildings.filter((id) => id !== deedId);
    h.state = 'for_sale';
    return true;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ÉCONOMIE / JUSTICE
  // ═════════════════════════════════════════════════════════════════════════
  getEconomySystem() { return this.worldState.economySystem; }
  getResourcePrice(id) { return this.getEconomySystem().resources[id]?.price; }
  updateResourcePrice(id, price) {
    if (!this.getEconomySystem().resources[id]) return false;
    this.getEconomySystem().resources[id].price = price;
    return true;
  }
  getTaxes() { return this.getEconomySystem().taxes; }
  updateTaxRate(type, rate) {
    if (rate < 0 || rate > 1) return false;
    this.getEconomySystem().taxes[type] = rate;
    return true;
  }

  getJusticeSystem() { return this.worldState.justiceSystem; }
  getAllCrimes() { return this.getJusticeSystem().crimes; }
  getCrimeById(id) { return this.getJusticeSystem().crimes.find((c) => c.id === id); }

  reportCrime(crime) {
    const id = `crime_${Date.now()}`;
    this.getJusticeSystem().crimes.push({ id, reported: true, investigated: false, solved: false, ...crime });
    return true;
  }

  getWantedList() { return this.getJusticeSystem().wantedList; }

  addToWantedList(criminalId, crimeId, severity, reward) {
    const criminal = this.getNPCById(criminalId);
    const crime = this.getCrimeById(crimeId);
    if (!criminal || !crime) return false;
    this.getJusticeSystem().wantedList.push({
      id: criminalId, name: criminal.name, crimeId, severity, reward,
      lastSeen: { x: criminal.position.x, z: criminal.position.z,
        time: this.worldState.currentDay * 24 + this.worldState.currentTime },
    });
    criminal.isWanted = true;
    criminal.wantedLevel = severity === 'mineur' ? 1 : severity === 'modere' ? 2 : severity === 'majeur' ? 3 : severity === 'catastrophique' ? 5 : 4;
    return true;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UTILITAIRES (nearest X)
  // ═════════════════════════════════════════════════════════════════════════
  getNearestDoor(x, z, maxD = 4.5) { return this.world?.nearestDoor?.(x, z, maxD) || null; }
  getNearestShop(x, z, maxD = 8) { return this.world?.nearestShop?.(x, z, maxD) || null; }
  getNearestGarage(x, z, maxD = 8) { return this.world?.nearestGarage?.(x, z, maxD) || null; }
  getNearestLeaf(x, z, maxD = 2.2) { return this.world?.nearestLeaf?.(x, z, maxD) || null; }

  getNearestHouseForSale(x, z, maxD = 16) {
    let best = null, bestD = maxD;
    for (const h of this.getAllHouses()) {
      if (h.state !== 'for_sale') continue;
      const d = Math.hypot(h.x - x, h.z - z);
      if (d < bestD) { best = h; bestD = d; }
    }
    return best;
  }

  collectLeaf(leafId) { return this.world?.collectLeaf?.(leafId) || false; }
  markLeavesCollected(ids) { this.world?.markLeavesCollected?.(ids); }

  // ═════════════════════════════════════════════════════════════════════════
  // BOUCLE DE JEU
  // ═════════════════════════════════════════════════════════════════════════
  update(dt, elapsed, playerPosition, playerSpeed = 0, wantedStars = 0) {
    if (!this.world) return;
    this.world.update?.(dt, elapsed, playerPosition, playerSpeed, wantedStars);
    this._updateRPSystems(dt, elapsed, playerPosition, wantedStars);
  }

  _updateRPSystems(dt, elapsed, pos, wantedStars) {
    // NPCs (toutes les 10 s)
    this.updateTimer += dt;
    if (this.updateTimer >= 10) {
      this.updateTimer = 0;
      this._updateNPCs(dt / 3600);
    }
    // Suivi
    for (const npc of this.getAllNPCs()) {
      if (npc.currentActivity === 'follow' && npc.targetPosition) {
        const dx = pos.x - npc.position.x;
        const dz = pos.z - npc.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 1) {
          const sp = (npc.speed || 1) * dt * 0.001;
          npc.position.x += (dx / d) * sp;
          npc.position.z += (dz / d) * sp;
          npc.position.y = getTerrainHeight(npc.position.x, npc.position.z);
        }
      }
    }
    // Feux de camp
    for (const c of this.getAllCampfires()) {
      if (!c.isLit) continue;
      c.fuel -= dt * 0.01;
      if (c.fuel <= 0) { c.isLit = false; c.fuel = 0; }
    }
    // Autosave toutes les 5 min
    this.saveTimer += dt;
    if (this.saveTimer >= 300) { this.saveTimer = 0; this.saveWorldState(); }
  }

  _updateNPCs(_hoursPassed) {
    // Hook pour évolution PNJ (à brancher si `world.npcs` existe)
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SAVE / LOAD
  // ═════════════════════════════════════════════════════════════════════════
  saveWorldState() {
    const s = this.worldState;
    return {
      version: WORLD_API_VERSION,
      timestamp: Date.now(),
      data: {
        player: { ...s.player },
        world: {
          currentDay: s.currentDay, currentTime: s.currentTime,
          season: s.season, weather: s.weather,
          temperature: s.temperature, windSpeed: s.windSpeed, windDirection: s.windDirection,
          globalReputation: s.globalReputation, globalSatisfaction: s.globalSatisfaction,
          crimeRate: s.crimeRate, pollution: s.pollution,
          wealth: s.wealth, population: s.population, taxRate: s.taxRate,
        },
        factions: s.factions,
        events: s.events,
        quests: s.quests,
        npcs: this.getAllNPCs().map((n) => ({ ...n })),
        buildings: this.getAllBuildings().map((b) => ({ ...b })),
        resources: this.getAllNaturalResources().map((r) => ({ ...r })),
        campfires: this.getAllCampfires().map((c) => ({ ...c })),
      },
    };
  }

  loadWorldState(save) {
    if (!save || save.version !== WORLD_API_VERSION) {
      console.warn(`[${SIG}·WorldAPI] Version incompatible.`);
      return false;
    }
    const d = save.data || {};
    if (d.player) {
      this.worldState.player = {
        ...makeDefaultPlayer(),
        ...d.player,
        level: Math.max(1, Math.min(100, d.player.level || 1)),
        money: Math.max(0, d.player.money || 0),
      };
    }
    if (d.world) Object.assign(this.worldState, d.world);
    if (d.factions) Object.assign(this.worldState.factions, d.factions);
    if (d.events) this.worldState.events = d.events;
    if (d.quests) this.worldState.quests = d.quests;
    if (d.npcs && this.world) this.world.npcs = d.npcs;
    if (d.resources && this.world) this.world.naturalResources = d.resources;
    if (d.campfires && this.world) {
      this.world.campfires = d.campfires.map((c) => ({ ...c, mesh: new THREE.Group() }));
    }
    // Bâtiments : merge par id
    if (d.buildings && this.world) {
      const map = new Map(d.buildings.map((b) => [b.id, b]));
      for (const b of this.getAllBuildings()) Object.assign(b, map.get(b.id) || {});
    }
    try {
      setCurrentDay(this.worldState.currentDay);
      setCurrentSeason(this.worldState.season);
      setCurrentTime(this.worldState.currentTime);
    } catch {}
    return true;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // DEBUG + NETTOYAGE
  // ═════════════════════════════════════════════════════════════════════════
  getStats() {
    return {
      sig: SIG,
      version: WORLD_API_VERSION,
      hasWorld: !!this.world,
      player: { level: this.worldState.player?.level, money: this.worldState.player?.money },
      counts: {
        cities: this.getCities().length,
        buildings: this.getAllBuildings().length,
        npcs: this.getAllNPCs().length,
        quests: this.getAllQuests().length,
        resources: this.getAllNaturalResources().length,
        markets: this.getAllMarkets().length,
        festivals: this.getAllFestivals().length,
        campfires: this.getAllCampfires().length,
        vehicles: this.getAllTraffic().length,
        houses: this.getAllHouses().length,
      },
    };
  }

  dispose() {
    this.world?.dispose?.();
    this.world = null;
    this.worldState = null;
    this.scene = null;
    this.camera = null;
    WorldAPI.instance = null;
    worldAPI = null;
  }

  _getPlayerPositionSafe() {
    const p = this.worldState?.player;
    return new THREE.Vector3(p?.position?.x ?? 0, 0, p?.position?.z ?? 0);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORTÉ (unifié avec WorldAPI.instance)
// ═══════════════════════════════════════════════════════════════════════════

export let worldAPI = null;

export function initializeWorldAPI(scene, camera) {
  worldAPI = WorldAPI.getInstance(scene, camera);
  return worldAPI;
}

export function getWorldAPI() { return worldAPI; }

export default { WorldAPI, initializeWorldAPI, getWorldAPI, checkWorldAPICompatibility, WORLD_API_VERSION };
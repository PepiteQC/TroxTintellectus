/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CORE/TROXT-MECHANICS.MJS
 * Mécaniques RP essentielles — coordonnées via le kernel
 * ═══════════════════════════════════════════════════════════════════
 * Mouvement · Interactions · Véhicules · Combat · Inventaire · Ancrages.
 * Chaque action passe par kernel.route() → Intellectus valide → TROXT⬡
 * décide → le monde applique → les clients 3D reçoivent.
 *
 * Signature : TROXT⬡
 * Chemin    : core/troxt-mechanics.mjs
 */

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

// ─── CONSTANTES DE JEU ───────────────────────────────────────────────────────
const CFG = {
  // Mouvement / anti-cheat
  maxSpeedMps:       12,      // vitesse joueur max (m/s) à pied
  maxVehicleMps:     78,      // ~280 km/h
  maxPosJump:        50,      // saut de position max entre 2 updates
  interactRange:     3.5,     // portée d'interaction (m)

  // Combat
  meleeRange:        2.2,
  meleeDamage:       15,
  maxHealth:         100,
  respawnDelaySec:   8,

  // Véhicules
  fuelDrainPerKm:    0.8,
  damageOnCrash:     25,

  // Inventaire
  maxSlots:          40,
  maxWeight:         50,      // kg
};

export class TroxtMechanics {
  constructor(kernel) {
    if (!kernel) throw new Error('kernel requis');
    this.k   = kernel;
    this.sig = SIG;

    // États par joueur
    this._movement = new Map();  // id → { pos, rot, vel, lastTs, speed, anim }
    this._combat   = new Map();  // id → { health, lastHit, downed }
    this._vehicles = new Map();  // vid → { owner, driver, pos, fuel, health, locked }
    this._inventory= new Map();  // id → [{ item, qty, weight }]
    this._anchors  = new Map();  // id → objet d'interaction courant (porte, PNJ...)

    this.stats = { moves: 0, interacts: 0, hits: 0, vehicleEnters: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════
  // INSTALLATION — branche les hooks de sécurité + les handlers
  // ═══════════════════════════════════════════════════════════════════
  install() {
    // Hook anti-cheat mouvement (Intellectus, priorité sécurité)
    this.k.addSecurityHook((type, data, ctx) => this._antiCheat(type, data, ctx));

    // Handlers d'événements RP
    this.k.on('mech:move',          (d) => this._onMove(d));
    this.k.on('mech:interact',      (d) => this._onInteract(d));
    this.k.on('mech:attack',        (d) => this._onAttack(d));
    this.k.on('mech:vehicle_enter', (d) => this._onVehicleEnter(d));
    this.k.on('mech:vehicle_exit',  (d) => this._onVehicleExit(d));
    this.k.on('mech:item_use',      (d) => this._onItemUse(d));

    // Nettoyage à la déconnexion
    this.k.on('kernel:player_leave', (d) => this._cleanup(d.player_id));

    console.log(`[${SIG}·Mechanics] Mécaniques installées`);
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ANTI-CHEAT (hook Intellectus)
  // ═══════════════════════════════════════════════════════════════════
  _antiCheat(type, data, ctx) {
    if (type !== 'mech:move' || !ctx.playerId) return { allowed: true };

    const prev = this._movement.get(ctx.playerId);
    const now  = Date.now();
    if (!prev) return { allowed: true };

    const dt = Math.max(0.001, (now - prev.lastTs) / 1000);
    const dx = (data.pos?.x ?? prev.pos.x) - prev.pos.x;
    const dz = (data.pos?.z ?? prev.pos.z) - prev.pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    // Saut de position impossible
    if (dist > CFG.maxPosJump) {
      return { allowed: false, reason: 'POSITION_JUMP', rollback: prev.pos };
    }

    // Vitesse impossible (selon à pied ou véhicule)
    const inVehicle = data.inVehicle;
    const maxSpeed  = inVehicle ? CFG.maxVehicleMps : CFG.maxSpeedMps;
    const speed     = dist / dt;
    if (speed > maxSpeed * 1.4) {   // 40% de tolérance réseau
      return { allowed: false, reason: 'SPEED_HACK', speed: Math.round(speed), rollback: prev.pos };
    }

    return { allowed: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  // MOUVEMENT
  // ═══════════════════════════════════════════════════════════════════
  async requestMove(playerId, pos, rot, vel, opts = {}) {
    return this.k.route('mech:move', {
      player_id: playerId, pos, rot, vel, inVehicle: opts.inVehicle, anim: opts.anim,
    }, { playerId });
  }

  _onMove(d) {
    if (!d.pos || !d.rot) return;   // message mal formé → on ignore
    const id = d.player_id;
    this._movement.set(id, {
      pos: d.pos, rot: d.rot, vel: d.vel || { x:0,y:0,z:0 },
      lastTs: Date.now(), speed: 0, anim: d.anim,
    });
    this.stats.moves++;
    // La position du kernel suit
    const p = this.k.getPlayer(id);
    if (p) p.pos = d.pos;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERACTIONS (portes, PNJ, objets, ancrages)
  // ═══════════════════════════════════════════════════════════════════
  async requestInteract(playerId, targetType, targetId, action, extra = {}) {
    return this.k.route('mech:interact', {
      player_id: playerId, target_type: targetType, target_id: targetId, action, extra,
    }, { playerId });
  }

  _onInteract(d) {
    this.stats.interacts++;
    const mov = this._movement.get(d.player_id);

    // Vérif de portée (si pos fournie et valide)
    if (mov && d.extra?.pos
        && typeof d.extra.pos.x === 'number'
        && typeof d.extra.pos.z === 'number') {
      const dx = d.extra.pos.x - mov.pos.x;
      const dz = d.extra.pos.z - mov.pos.z;
      if (Math.sqrt(dx*dx + dz*dz) > CFG.interactRange) return;
    }

    // Route vers le bon système (portes, villages, etc.) via le kernel
    if (d.target_type === 'door') {
      this.k.emit('doors:action', {
        uid: d.target_id, player_id: d.player_id, action: d.action, extra: d.extra,
      });
    } else if (d.target_type === 'vehicle') {
      if (d.action === 'enter') this.requestVehicleEnter(d.player_id, d.target_id);
    }
    this._anchors.set(d.player_id, { type: d.target_type, id: d.target_id });
  }

  // ═══════════════════════════════════════════════════════════════════
  // COMBAT
  // ═══════════════════════════════════════════════════════════════════
  initHealth(playerId) {
    this._combat.set(playerId, { health: CFG.maxHealth, lastHit: 0, downed: false });
  }

  async requestAttack(playerId, targetId, weapon = 'melee') {
    return this.k.route('mech:attack', {
      player_id: playerId, target_id: targetId, weapon,
    }, { playerId });
  }

  _onAttack(d) {
    this.stats.hits++;
    const attacker = this._movement.get(d.player_id);
    const target   = this._movement.get(d.target_id);
    if (!attacker || !target) return;

    // Portée mêlée
    const dx   = target.pos.x - attacker.pos.x;
    const dz   = target.pos.z - attacker.pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (d.weapon === 'melee' && dist > CFG.meleeRange) return;

    const tc  = this._combat.get(d.target_id) || { health: CFG.maxHealth, lastHit: 0, downed: false };
    const dmg = d.weapon === 'melee' ? CFG.meleeDamage : (d.damage || 25);
    tc.health  = Math.max(0, tc.health - dmg);
    tc.lastHit = Date.now();
    this._combat.set(d.target_id, tc);

    // Crime → alerte Intellectus + wanted via TROXT⬡
    this.k.route('troxtworld:crime_hint', {
      player_id: d.player_id, crime: 'assault', victim: d.target_id,
    }, { trusted: true });

    if (tc.health <= 0 && !tc.downed) {
      tc.downed = true;
      this.k.route('mech:player_downed', {
        player_id: d.target_id, by: d.player_id,
      }, { trusted: true });
      setTimeout(() => this._respawn(d.target_id), CFG.respawnDelaySec * 1000);
    }

    this.k.emit('mech:damage', { target: d.target_id, health: tc.health, by: d.player_id });
  }

  _respawn(playerId) {
    this._combat.set(playerId, { health: CFG.maxHealth, lastHit: 0, downed: false });
    this.k.route('mech:player_respawn', { player_id: playerId }, { trusted: true });
  }

  // ═══════════════════════════════════════════════════════════════════
  // VÉHICULES
  // ═══════════════════════════════════════════════════════════════════
  registerVehicle(vid, info = {}) {
    this._vehicles.set(vid, {
      owner: info.owner || null, driver: null,
      pos: info.pos || { x:0,y:0,z:0 },
      fuel: info.fuel ?? 100, health: info.health ?? 100,
      locked: info.locked ?? true, model: info.model,
    });
  }

  async requestVehicleEnter(playerId, vid) {
    return this.k.route('mech:vehicle_enter', { player_id: playerId, vehicle_id: vid }, { playerId });
  }

  _onVehicleEnter(d) {
    const v = this._vehicles.get(d.vehicle_id);
    if (!v) return;
    // Verrou : seul le proprio ou véhicule déverrouillé
    if (v.locked && v.owner && v.owner !== d.player_id) {
      this.k.emit('mech:vehicle_locked', { vehicle_id: d.vehicle_id, player_id: d.player_id });
      return;
    }
    v.driver = d.player_id;
    this.stats.vehicleEnters++;
    this.k.emit('mech:vehicle_entered', { vehicle_id: d.vehicle_id, driver: d.player_id });
  }

  _onVehicleExit(d) {
    const v = this._vehicles.get(d.vehicle_id);
    if (v && v.driver === d.player_id) v.driver = null;
    this.k.emit('mech:vehicle_exited', { vehicle_id: d.vehicle_id, player_id: d.player_id });
  }

  damageVehicle(vid, amount) {
    const v = this._vehicles.get(vid);
    if (!v) return;
    v.health = Math.max(0, v.health - amount);
    if (v.health <= 0) this.k.emit('mech:vehicle_destroyed', { vehicle_id: vid });
  }

  // ═══════════════════════════════════════════════════════════════════
  // INVENTAIRE
  // ═══════════════════════════════════════════════════════════════════
  giveItem(playerId, item, qty = 1, weight = 0.1) {
    let inv = this._inventory.get(playerId);
    if (!inv) { inv = []; this._inventory.set(playerId, inv); }
    if (inv.length >= CFG.maxSlots) return { ok: false, reason: 'INVENTORY_FULL' };
    const totalW = inv.reduce((s, i) => s + i.weight * i.qty, 0) + weight * qty;
    if (totalW > CFG.maxWeight) return { ok: false, reason: 'OVERWEIGHT' };

    const existing = inv.find(i => i.item === item);
    if (existing) existing.qty += qty;
    else inv.push({ item, qty, weight });

    this.k.emit('mech:inventory_changed', { player_id: playerId, item, qty });
    return { ok: true };
  }

  _onItemUse(d) {
    const inv = this._inventory.get(d.player_id);
    if (!inv) return;
    const slot = inv.find(i => i.item === d.item);
    if (!slot || slot.qty <= 0) return;
    slot.qty--;
    if (slot.qty <= 0) inv.splice(inv.indexOf(slot), 1);

    // Effets d'items (soins, nourriture) via le monde/économie
    this.k.route('troxtworld:item_effect', {
      player_id: d.player_id, item: d.item,
    }, { trusted: true });
  }

  async requestItemUse(playerId, item) {
    return this.k.route('mech:item_use', { player_id: playerId, item }, { playerId });
  }

  getInventory(playerId) { return this._inventory.get(playerId) || []; }
  getHealth(playerId)    { return this._combat.get(playerId)?.health ?? CFG.maxHealth; }

  // ─── NETTOYAGE ─────────────────────────────────────────────────────────────
  _cleanup(playerId) {
    this._movement.delete(playerId);
    this._combat.delete(playerId);
    this._inventory.delete(playerId);
    this._anchors.delete(playerId);
    for (const [, v] of this._vehicles) if (v.driver === playerId) v.driver = null;
  }

  getStats() { return { ...this.stats, sig: SIG }; }
}

export { SIG, CFG };
export default TroxtMechanics;
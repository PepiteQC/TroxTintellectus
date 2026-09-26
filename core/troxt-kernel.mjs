/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CORE/TROXT-KERNEL.MJS
 * Noyau central de TroxtWorld — coordonne TOUT
 * ═══════════════════════════════════════════════════════════════════
 * Le kernel est le chef d'orchestre. Il relie :
 *   • Le cerveau TROXT⬡ (décisions, mémoire, agents)
 *   • La sécurité 🛡️INTELLECTUS⬡ (auth, anti-cheat, menaces)
 *   • Le moteur 3D (Three.js OU Babylon.js — agnostique)
 *   • Le backend Node (serveur RP, DB, WebSocket)
 *   • Les systèmes RP (économie, crimes, véhicules, portes, monde)
 *
 * Tout événement passe par le bus du kernel. Rien n'est couplé en dur :
 * un système émet, le kernel route vers TROXT⬡ et Intellectus, qui
 * décident et répondent. C'est la colonne vertébrale coordonnée.
 *
 * Signature : TROXT⬡
 * Chemin    : core/troxt-kernel.mjs
 */

import { EventEmitter } from 'node:events';

const SIG   = 'TROXT⬡';
const ISIG  = '🛡️INTELLECTUS⬡';
const VERSION = '1.0.0';

// ─── LOGGER ──────────────────────────────────────────────────────────────────
const log = (lvl, mod, msg, data) => {
  const icons = { INFO:'ℹ', WARN:'⚠', ERR:'✖', OK:'✓', KERNEL:'⬡', SEC:'🛡️', BOOT:'🚀' };
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${icons[lvl]||'·'} [${SIG}·${mod}] ${msg}`);
  if (data) console.log('   ↳', JSON.stringify(data));
};

// ═══════════════════════════════════════════════════════════════════
// PRIORITÉS D'ÉVÉNEMENTS — l'ordre de routage
// ═══════════════════════════════════════════════════════════════════
const PRIORITY = {
  SECURITY: 0,   // Intellectus voit tout en premier (peut bloquer)
  BRAIN:    1,   // TROXT⬡ décide ensuite
  SYSTEM:   2,   // Les systèmes RP réagissent
  RENDER:   3,   // Le moteur 3D applique en dernier
};

// ═══════════════════════════════════════════════════════════════════
// LE KERNEL
// ═══════════════════════════════════════════════════════════════════
export class TroxtKernel extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.setMaxListeners(200);
    this.sig     = SIG;
    this.version = VERSION;
    this.startedAt = Date.now();

    // Modules branchés (injectés via .register)
    this.modules = {
      brain:       null,   // cerveau TROXT⬡
      intellectus: null,   // sécurité
      engine:      null,   // moteur 3D (three | babylon)
      server:      null,   // backend Node
      mechanics:   null,   // mécaniques RP
      physics:     null,   // Rapier WASM
      economy:     null,
      world:       null,
      doors:       null,
      villages:    null,
      zones:       null,
    };

    // Registre des joueurs actifs (vue kernel — légère)
    this.players = new Map();

    // File d'événements avec priorité
    this._queue = [];
    this._processing = false;

    // Ponts sortants
    this._luaEmit = opts.luaEmit || null;      // vers Lua (HTTP ou fengari)
    this._wsBroadcast = opts.wsBroadcast || null; // vers clients 3D

    // Stats
    this.stats = {
      events_routed: 0,
      security_blocks: 0,
      brain_decisions: 0,
      players_peak: 0,
      ticks: 0,
    };

    // Sécurité : hooks de validation (Intellectus)
    this._securityHooks = [];

    log('KERNEL', 'CORE', `Kernel v${VERSION} initialisé`);
  }

  // ─── ENREGISTREMENT DES MODULES ────────────────────────────────────────────
  register(name, mod) {
    if (!(name in this.modules)) {
      log('WARN', 'CORE', `Module inconnu: ${name}`);
    }
    this.modules[name] = mod;
    log('OK', 'CORE', `Module branché: ${name}`);
    this.emit('kernel:module_registered', { name });
    return this;
  }

  // Enregistre un hook de sécurité (appelé avant toute action sensible)
  addSecurityHook(fn) {
    this._securityHooks.push(fn);
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUS D'ÉVÉNEMENTS COORDONNÉ — le cœur
  // ═══════════════════════════════════════════════════════════════════
  /**
   * Route un événement à travers la chaîne :
   *   1. INTELLECTUS valide (peut bloquer)
   *   2. TROXT⬡ décide
   *   3. Les systèmes réagissent
   *   4. Le moteur 3D applique
   * @param {string} type
   * @param {object} data
   * @param {object} [ctx]  { playerId, ip, trusted }
   */
  async route(type, data = {}, ctx = {}) {
    this.stats.events_routed++;

    // ── 1. SÉCURITÉ (Intellectus) ──
    if (!ctx.trusted) {
      const verdict = await this._securityCheck(type, data, ctx);
      if (!verdict.allowed) {
        this.stats.security_blocks++;
        log('SEC', 'INTELLECTUS', `Bloqué: ${type} — ${verdict.reason}`, { player: ctx.playerId });
        this.emit('kernel:blocked', { type, reason: verdict.reason, ctx });
        this._toLua('intellectus:kernel_block', { type, reason: verdict.reason, ...ctx });
        return { ok: false, blocked: true, reason: verdict.reason };
      }
    }

    // ── 2. CERVEAU (TROXT⬡) ──
    const decision = await this._brainDecide(type, data, ctx);

    // ── 3. SYSTÈMES RP ──
    this.emit(type, { ...data, _ctx: ctx, _decision: decision });
    this._toLua(type, { ...data, player_id: ctx.playerId });

    // ── 4. RENDU 3D (broadcast aux clients) ──
    if (decision.broadcast !== false) {
      this._toClients(type, { ...data, ...decision.patch });
    }

    return { ok: true, decision };
  }

  // ── Vérification sécurité via Intellectus + hooks ──
  async _securityCheck(type, data, ctx) {
    // Hooks custom
    for (const hook of this._securityHooks) {
      try {
        const r = await hook(type, data, ctx);
        if (r && r.allowed === false) return r;
      } catch (e) {
        log('ERR', 'INTELLECTUS', `Hook error: ${e.message}`);
      }
    }

    // Module Intellectus si branché
    const intel = this.modules.intellectus;
    if (intel && typeof intel.checkAction === 'function') {
      try {
        return await intel.checkAction(type, data, ctx);
      } catch (e) {
        log('ERR', 'INTELLECTUS', `checkAction: ${e.message}`);
      }
    }

    return { allowed: true };
  }

  // ── Décision via le cerveau TROXT⬡ ──
  async _brainDecide(type, data, ctx) {
    const brain = this.modules.brain;
    if (brain && typeof brain.decide === 'function') {
      try {
        this.stats.brain_decisions++;
        return await brain.decide(type, data, ctx) || {};
      } catch (e) {
        log('ERR', 'BRAIN', `decide: ${e.message}`);
      }
    }
    return {};   // pas de cerveau branché → passe tel quel
  }

  // ── Ponts sortants ──
  _toLua(event, data) {
    if (this._luaEmit) {
      try { this._luaEmit(event, data); } catch { /* non bloquant */ }
    }
  }
  _toClients(type, data) {
    if (this._wsBroadcast) {
      try { this._wsBroadcast(JSON.stringify({ type, data, sig: SIG, ts: Date.now() })); }
      catch { /* non bloquant */ }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GESTION DES JOUEURS (vue kernel)
  // ═══════════════════════════════════════════════════════════════════
  addPlayer(playerId, info = {}) {
    this.players.set(playerId, {
      id: playerId,
      ...info,
      joinedAt: Date.now(),
      pos: info.pos || { x: 0, y: 0, z: 0 },
    });
    this.stats.players_peak = Math.max(this.stats.players_peak, this.players.size);
    this.route('kernel:player_join', { player_id: playerId, ...info }, { trusted: true });
    return this.players.get(playerId);
  }

  removePlayer(playerId) {
    const p = this.players.get(playerId);
    this.players.delete(playerId);
    this.route('kernel:player_leave', { player_id: playerId }, { trusted: true });
    return p;
  }

  getPlayer(playerId) { return this.players.get(playerId); }
  get playerCount()   { return this.players.size; }

  // ═══════════════════════════════════════════════════════════════════
  // BOUCLE DE TICK COORDONNÉE
  // ═══════════════════════════════════════════════════════════════════
  startTick(hz = 20) {
    const interval = 1000 / hz;
    this._tickTimer = setInterval(() => {
      this.stats.ticks++;
      const now = Date.now();

      // Chaque module qui a un tick() est appelé dans l'ordre de priorité
      const order = ['intellectus', 'brain', 'economy', 'world', 'doors', 'zones'];
      for (const name of order) {
        const mod = this.modules[name];
        if (mod && typeof mod.tick === 'function') {
          try { mod.tick(interval / 1000, now); }
          catch (e) { log('ERR', name, `tick: ${e.message}`); }
        }
      }

      this.emit('kernel:tick', { tick: this.stats.ticks, now });
    }, interval);
    log('OK', 'CORE', `Boucle de tick démarrée @ ${hz}Hz`);
    return this;
  }

  stopTick() {
    if (this._tickTimer) clearInterval(this._tickTimer);
    log('WARN', 'CORE', 'Boucle de tick arrêtée');
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAPPORT & SANTÉ
  // ═══════════════════════════════════════════════════════════════════
  getReport() {
    const modules = {};
    for (const [name, mod] of Object.entries(this.modules)) {
      modules[name] = mod ? 'branché' : 'absent';
    }
    return {
      sig: SIG, version: VERSION,
      uptime_sec: Math.floor((Date.now() - this.startedAt) / 1000),
      players: this.players.size,
      modules,
      stats: this.stats,
      generated_at: new Date().toISOString(),
    };
  }

  getHealth() {
    const critical = ['brain', 'intellectus'];
    const missing = critical.filter(m => !this.modules[m]);
    let score = 100;
    score -= missing.length * 30;
    if (this.stats.security_blocks > this.stats.events_routed * 0.5) score -= 20;
    return {
      score: Math.max(0, score),
      grade: score >= 90 ? 'EXCELLENT' : score >= 70 ? 'BON' : score >= 50 ? 'DÉGRADÉ' : 'CRITIQUE',
      missing_critical: missing,
      sig: SIG,
    };
  }

  shutdown() {
    this.stopTick();
    log('WARN', 'CORE', 'Kernel arrêté');
    this.emit('kernel:shutdown', {});
  }
}

export { SIG, ISIG, PRIORITY };
export default TroxtKernel;
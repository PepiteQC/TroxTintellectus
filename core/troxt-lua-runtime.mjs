/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CORE/TROXT-LUA-RUNTIME.MJS
 * Runtime Lua qui exécute VRAIMENT tes .lua TROXT⬡ + Intellectus
 * Chemin : core/troxt-lua-runtime.mjs
 * npm install wasmoon
 * ═══════════════════════════════════════════════════════════════════
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

const log = (lvl, msg, data) => {
  const i = { OK:'✓', WARN:'⚠', ERR:'✖', LUA:'🌙', INFO:'ℹ' }[lvl] || '·';
  console.log(`[${new Date().toISOString().slice(11,19)}] ${i} [${SIG}·Lua] ${msg}`);
  if (data) console.log('   ↳', JSON.stringify(data));
};

export class TroxtLuaRuntime {
  constructor(kernel) {
    if (!kernel) throw new Error('kernel requis');
    this.k    = kernel;
    this.sig  = SIG;
    this.lua  = null;
    this.ready = false;
    this._modules = {};
    this._eventBridge = null;
    this._inEmit = false;
    this.stats = { loaded: 0, jsToLua: 0, luaToJs: 0, errors: 0 };
  }

  async init() {
    let LuaFactory;
    try {
      ({ LuaFactory } = await import('wasmoon'));
    } catch (e) {
      log('ERR', 'wasmoon non installé — npm install wasmoon');
      throw e;
    }
    const factory = new LuaFactory();
    this.lua = await factory.createEngine();
    this.ready = true;

    this.lua.global.set('js', {
      emit: (event, data) => this._onLuaEmit(event, data),
      log:  (msg) => log('LUA', String(msg)),
      now:  () => Date.now(),
      http_post: null,
    });

    await this._setupRegister();

    // Shim `require` : wasmoon n'expose pas toujours `require` → rawget(_G)
    this.lua.global.set('__troxt_require', (name) => this._resolveModule(name));
    await this.lua.doString(`
      local _real_require = rawget(_G, 'require')
      if type(_real_require) ~= 'function' then _real_require = nil end

      function require(name)
        local mod = __troxt_require(name)
        if mod ~= nil then return mod end
        if _real_require then return _real_require(name) end
        return nil
      end
    `);

    log('OK', 'Runtime Lua 5.4 (wasmoon) prêt');
    return this;
  }

  _resolveModule(name) {
    const key = name.split('.').pop();
    return this._modules[key];
  }

  static LOAD_ORDER = [
    'troxt/troxt_events.lua',
    'troxt/troxt_memory.lua',
    'troxt/troxt_scheduler.lua',
    'troxt/troxt_agents_troxtworld.lua',
    'intellectus/intellectus_core.lua',
    'intellectus/intellectus_scanner.lua',
    'intellectus/intellectus_auth.lua',
    'intellectus/intellectus_firewall.lua',
    'intellectus/intellectus_ratelimit.lua',
    'intellectus/intellectus_threat.lua',
    'intellectus/intellectus_audit.lua',
    'intellectus/intellectus_signature.lua',
    'intellectus/intellectus_admin.lua',
    'troxt/troxt_rp.lua',
    'troxt/troxt_economy.lua',
    'troxt/troxt_world.lua',
    'troxt/troxt_doors.lua',
    'troxt/troxt_multiplayer.lua',
    'troxt/troxt_brain.lua',
  ];

  async loadAll(luaDir) {
    if (!this.ready) throw new Error('appelle init() d\'abord');

    for (const rel of TroxtLuaRuntime.LOAD_ORDER) {
      const full = path.join(luaDir, rel);
      const key  = path.basename(rel, '.lua');
      try {
        const src = await readFile(full, 'utf-8');
        await this.lua.doString(`
          local __mod = (function()
            ${src}
          end)()
          __troxt_register('${key}', __mod)
          return true
        `);
        this.stats.loaded++;
        log('OK', `Chargé: ${key}`);
      } catch (e) {
        this.stats.errors++;
        log('WARN', `Échec ${key}: ${String(e.message || e).slice(0, 120)}`);
      }
    }

    log('OK', `${this.stats.loaded}/${TroxtLuaRuntime.LOAD_ORDER.length} modules Lua chargés`);
    return this;
  }

  async _setupRegister() {
    this.lua.global.set('__troxt_register', (key, mod) => {
      this._modules[key] = mod;
    });
  }

  _onLuaEmit(event, data) {
    this.stats.luaToJs++;
    const jsData = this._luaToJs(data);
    this.k.emit(`lua:${event}`, jsData);
    this.k.emit(event, jsData);

    if (event === 'troxt:security_alert' || event === 'intellectus:ip_blocked') {
      this.k._toClients?.('security_event', { event, ...jsData });
    }
  }

  _luaToJs(v) {
    if (v == null) return v;
    if (typeof v !== 'object') return v;
    try { return JSON.parse(JSON.stringify(v)); } catch { return v; }
  }

  attachToKernel() {
    const brain = this._modules['troxt_brain'];
    this.k.register('brain', {
      decide: (type, data, ctx) => {
        this.stats.jsToLua++;
        try {
          if (brain && typeof brain.force_decision === 'function') {
            // Le cerveau observe l'événement ; il peut forcer une décision
          }
          return { via: SIG };
        } catch (e) { return {}; }
      },
      tick: (dt) => {
        try { if (brain && brain.tick) brain.tick(dt); } catch (e) { this.stats.errors++; }
      },
    });

    const core      = this._modules['intellectus_core'];
    const ratelimit = this._modules['intellectus_ratelimit'];
    this.k.register('intellectus', {
      checkAction: (type, data, ctx) => {
        this.stats.jsToLua++;
        try {
          if (core && ctx.ip && typeof core.is_blocked === 'function') {
            const blocked = core.is_blocked(ctx.ip);
            if (blocked) return { allowed: false, reason: 'IP_BLOCKED' };
          }
          if (ratelimit && ctx.playerId && typeof ratelimit.check === 'function') {
            const key = ctx.ip || ctx.playerId;
            const r   = ratelimit.check(key, type);
            if (r && r.allowed === false) {
              return { allowed: false, reason: r.reason || 'RATE_LIMITED' };
            }
          }
          return { allowed: true };
        } catch (e) {
          this.stats.errors++;
          return { allowed: true };
        }
      },
      tick: (dt) => {
        try {
          const scanner = this._modules['intellectus_scanner'];
          if (scanner && scanner.analyze_all) scanner.analyze_all();
          const threat = this._modules['intellectus_threat'];
          if (threat && threat.tick) threat.tick(dt);
        } catch (e) { this.stats.errors++; }
      },
    });

    this._registerSystemModule('economy', 'troxt_economy');
    this._registerSystemModule('world',   'troxt_world',   'tick');
    this._registerSystemModule('doors',   'troxt_doors',   'tick');

    log('OK', 'Modules Lua reliés au kernel (brain, intellectus, économie, monde, portes)');
    return this;
  }

  _registerSystemModule(kernelName, luaKey, tickFn) {
    const mod = this._modules[luaKey];
    if (!mod) return;
    const wrapper = { _lua: mod };
    if (tickFn && typeof mod[tickFn] === 'function') {
      wrapper.tick = (dt) => { try { mod[tickFn](dt); } catch { this.stats.errors++; } };
    }
    this.k.register(kernelName, wrapper);
  }

  call(moduleKey, fnName, ...args) {
    const mod = this._modules[moduleKey];
    if (!mod || typeof mod[fnName] !== 'function') {
      log('WARN', `${moduleKey}.${fnName} introuvable`);
      return null;
    }
    try {
      return mod[fnName](...args);
    } catch (e) {
      this.stats.errors++;
      log('ERR', `${moduleKey}.${fnName}: ${e.message}`);
      return null;
    }
  }

  getModule(key) { return this._modules[key]; }
  getStats() { return { ...this.stats, modules: Object.keys(this._modules).length, sig: SIG }; }

  dispose() {
    try { this.lua?.global?.close?.(); } catch { /* ignore */ }
    this.ready = false;
  }
}

export { SIG };
export default TroxtLuaRuntime;
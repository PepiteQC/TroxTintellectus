/**
 * ⬡ TROXT — INTELLECTUS-BRIDGE.MJS
 * Pont Node.js entre le serveur HTTP/WS TroxtWorld (4100/4200) et la stack
 * de sécurité Intellectus (Lua). Middleware universel.
 *
 * Signature : 🛡️INTELLECTUS⬡
 * Chemin    : server/intellectus-bridge.mjs
 * Usage     :
 *   import { IntellectusBridge } from './intellectus-bridge.mjs';
 *   const bridge = new IntellectusBridge({ luaRuntime });
 *   app.use(bridge.expressMiddleware());
 *   wss.on('connection', bridge.websocketHandler);
 */

import crypto from 'crypto';

const SIG   = '🛡️INTELLECTUS⬡';
const TROXT = 'TROXT⬡';
const VERSION = '1.0.0';

// ─── LOGGER ──────────────────────────────────────────────────────────────────
const log = (level, msg, data) => {
  const icons = { INFO:'ℹ', WARN:'⚠', ERROR:'✖', OK:'✓', BLOCK:'🚫', BRIDGE:'🌉' };
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${icons[level]||'·'} [${SIG}] ${msg}`);
  if (data) console.log('   ↳', JSON.stringify(data));
};

// ─── CLASSE PONT ─────────────────────────────────────────────────────────────
export class IntellectusBridge {
  /**
   * @param {object} opts
   * @param {object} opts.luaRuntime  Instance Lua (fengari, lua-in-js, était) avec .call(fn, ...args)
   * @param {boolean} opts.enabled    Activer/désactiver la sécurité (debug)
   * @param {boolean} opts.failOpen   Si Lua crash → true = laisse passer, false = refuse
   */
  constructor(opts = {}) {
    this.lua       = opts.luaRuntime || null;
    this.enabled   = opts.enabled !== false;
    this.failOpen  = opts.failOpen === true;
    this.loaded    = false;
    this.modules   = {};

    this.stats = {
      requests_checked: 0,
      requests_allowed: 0,
      requests_blocked: 0,
      errors:           0,
      ws_checked:       0,
      ws_blocked:       0,
    };
  }

  // ─── INITIALISATION ──────────────────────────────────────────────────────
  async init() {
    if (!this.lua) {
      log('WARN', 'Pas de runtime Lua — bridge en mode "passthrough"');
      this.loaded = false;
      return this;
    }

    try {
      // Charger le master orchestrator qui boot tous les modules
      await this.lua.call('require', 'intellectus.intellectus_master');
      this.modules.master = await this.lua.call('require', 'intellectus.intellectus_master');
      this.modules.core   = await this.lua.call('require', 'intellectus.intellectus_core');
      this.modules.fw     = await this.lua.call('require', 'intellectus.intellectus_firewall');
      this.modules.rl     = await this.lua.call('require', 'intellectus.intellectus_ratelimit');
      this.modules.threat = await this.lua.call('require', 'intellectus.intellectus_threat');
      this.modules.audit  = await this.lua.call('require', 'intellectus.intellectus_audit');
      this.modules.ws     = await this.lua.call('require', 'intellectus.intellectus_websocket');
      this.modules.scanner= await this.lua.call('require', 'intellectus.intellectus_scanner');

      this.loaded = true;
      log('OK', `Bridge initialisé — ${Object.keys(this.modules).length} modules Lua chargés`);
    } catch (err) {
      log('ERROR', `Init échouée: ${err.message}`);
      this.loaded = false;
    }
    return this;
  }

  // ─── CALL LUA HELPER ─────────────────────────────────────────────────────
  async _lua(module, method, ...args) {
    if (!this.loaded || !this.modules[module]) return null;
    try {
      const fn = this.modules[module][method];
      if (typeof fn !== 'function') return null;
      return await fn(...args);
    } catch (err) {
      this.stats.errors++;
      log('ERROR', `Lua ${module}.${method} — ${err.message}`);
      return null;
    }
  }

  // ─── MIDDLEWARE EXPRESS ──────────────────────────────────────────────────
  expressMiddleware() {
    return async (req, res, next) => {
      if (!this.enabled) return next();

      this.stats.requests_checked++;

      const ip = this._extractIp(req);
      const request = {
        ip,
        method:       req.method,
        endpoint:     req.path,
        headers:      req.headers,
        params:       { ...req.query, ...req.params },
        body:         req.body,
        body_size:    parseInt(req.headers['content-length'] || '0', 10),
        content_type: req.headers['content-type'],
      };

      try {
        // 1. Firewall
        const fwResult = await this._lua('fw', 'check', request);
        if (fwResult && fwResult.allowed === false) {
          return this._block(res, 403, 'FIREWALL', fwResult.reason, ip);
        }

        // 2. Rate limit
        const rlResult = await this._lua('rl', 'check', ip, req.path, {});
        if (rlResult && rlResult.allowed === false) {
          res.setHeader('Retry-After', rlResult.retry_after || 60);
          return this._block(res, 429, 'RATE_LIMIT', rlResult.reason, ip, rlResult);
        }

        // 3. Threat check (est-ce que l'IP est déjà bloquée ?)
        const threatBlock = await this._lua('threat', 'is_blocked', ip);
        if (threatBlock === true) {
          return this._block(res, 403, 'THREAT_BLOCKED', 'IP sous surveillance', ip);
        }

        // 4. Scanner check (payload)
        if (req.body) {
          const scResult = await this._lua('scanner', 'check_payload', req.body, ip);
          if (scResult && scResult.allowed === false) {
            return this._block(res, 400, 'MALICIOUS_PAYLOAD',
              scResult.reason || 'Payload suspect', ip, scResult);
          }
        }

        // 5. Audit — enregistrer
        await this._lua('audit', 'log', 'http_request', {
          method: req.method, path: req.path, user_agent: req.headers['user-agent'],
        }, { level: 'INFO', actor: 'http', ip });

        this.stats.requests_allowed++;
        res.setHeader('X-Intellectus', SIG);
        next();

      } catch (err) {
        this.stats.errors++;
        log('ERROR', `Middleware crash: ${err.message}`);
        if (this.failOpen) return next();
        return res.status(500).json({ error: 'Security layer error', sig: SIG });
      }
    };
  }

  // ─── HANDLER WEBSOCKET ───────────────────────────────────────────────────
  websocketHandler(ws, req) {
    if (!this.enabled) return true;

    const ip = this._extractIp(req);

    // Hook au Lua
    if (this.loaded) {
      this._lua('ws', 'on_connect', ip, req.headers).then((result) => {
        if (!result || result.allowed === false) {
          try { ws.close(1008, 'Blocked by Intellectus'); } catch (e) {}
          log('BLOCK', `WS refusé — ${ip} (${result?.reason || 'unknown'})`);
        }
      });
    }

    // Rate limit WS
    this._lua('rl', 'check', ip, 'ws://', { profile: 'ip_websocket' }).then((result) => {
      if (result && result.allowed === false) {
        try { ws.close(1013, 'Rate limited'); } catch (e) {}
      }
    });

    // Intercept messages
    ws.on('message', (raw) => {
      const size = raw.length;
      let data = null;
      try { data = JSON.parse(raw.toString()); } catch (e) {}

      if (this.loaded) {
        this._lua('ws', 'check_message', ws._troxtId || 'unknown', size, data).then((result) => {
          if (result && result.allowed === false) {
            log('WARN', `WS message bloqué — ${ip} (${result.reason})`);
            try { ws.close(1008, result.reason); } catch (e) {}
          }
        });
      }
    });

    ws.on('close', () => {
      if (this.loaded) {
        this._lua('ws', 'on_disconnect', ws._troxtId || 'unknown', 'client_close');
      }
    });

    return true;
  }

  // ─── UTILITAIRES ─────────────────────────────────────────────────────────
  _extractIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.socket?.remoteAddress
        || req.connection?.remoteAddress
        || 'unknown';
  }

  _block(res, status, code, reason, ip, extra = {}) {
    this.stats.requests_blocked++;
    log('BLOCK', `HTTP ${status} — ${ip} — ${code}: ${reason}`);

    // Notifier le threat engine
    if (this.loaded) {
      this._lua('threat', 'detect', ip, code.toLowerCase(), { reason, ...extra });
    }

    res.setHeader('X-Intellectus', SIG);
    res.setHeader('X-Block-Reason', code);
    return res.status(status).json({
      error:  reason,
      code,
      sig:    SIG,
      troxt:  TROXT,
    });
  }

  // ─── API ─────────────────────────────────────────────────────────────────
  async getReport() {
    return this._lua('master', 'get_report');
  }

  async getHealth() {
    return this._lua('master', 'get_health');
  }

  async blockIp(ip, reason, durationSec) {
    return this._lua('fw', 'blacklist_ip', ip, reason, !durationSec);
  }

  async unblockIp(ip) {
    return this._lua('fw', 'remove_blacklist', ip);
  }

  getStats() {
    return {
      sig:    SIG,
      troxt:  TROXT,
      version:VERSION,
      loaded: this.loaded,
      enabled:this.enabled,
      fail_open: this.failOpen,
      modules: Object.keys(this.modules),
      ...this.stats,
    };
  }
}

export default IntellectusBridge;

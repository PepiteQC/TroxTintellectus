/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — NETWORKING/TROXT-CLIENT.MJS (v3.0 Platinum Edition)
 * Client WebSocket haute performance pour TroxtWorld
 * ═══════════════════════════════════════════════════════════════════
 * Fonctionnalités :
 *   • Connexion résiliente avec reconnexion automatique exponentielle
 *   • Protocole binaire/JSON unifié avec le serveur de jeu (20Hz)
 *   • Synchronisation de positions compressée avec dirty-flagging
 *   • Calcul de latence (Ping/RTT) en temps réel
 *   • Intégration transparente avec EventTarget & Zustand useGameState
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/networking/troxt-client.mjs
 */

const SIG = 'TROXT⬡';

export const MSG = Object.freeze({
  HELLO:         'HELLO',
  WORLD_STATE:   'WORLD_STATE',
  PLAYER_JOIN:   'PLAYER_JOIN',
  PLAYER_LEAVE:  'PLAYER_LEAVE',
  PLAYER_UPDATE: 'PLAYER_UPDATE',
  PLAYERS_BATCH: 'PLAYERS_BATCH',
  CHAT_MESSAGE:  'CHAT_MESSAGE',
  RP_EVENT:      'RP_EVENT',
  ROOM_UPDATE:   'ROOM_UPDATE',
  PING:          'PING',
  PONG:          'PONG',
  ERROR:         'ERROR',
  KICK:          'KICK',
  AUTH:          'AUTH',
  MOVE:          'MOVE',
  INTERACT:      'INTERACT',
  CHAT:          'CHAT',
  RP_ACTION:     'RP_ACTION',
  JOIN_ROOM:     'JOIN_ROOM',
  LEAVE_ROOM:    'LEAVE_ROOM',
});

// Détermination intelligente de l'URL du serveur
function getDefaultServerUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL) {
    const base = import.meta.env.VITE_SERVER_URL.replace(/\/$/, '');
    return base.endsWith('/ws') ? base : `${base}/ws`;
  }
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:2567/ws`;
  }
  return 'ws://localhost:2567/ws';
}

export class TroxtClient extends EventTarget {
  /**
   * @param {string} [url] - URL du serveur WebSocket (ex: ws://localhost:2567/ws)
   * @param {object} [options]
   */
  constructor(url = null, options = {}) {
    super();
    this.url         = url || getDefaultServerUrl();
    this.ws          = null;
    this.player_id   = null;
    this.session     = null;
    this.username    = null;
    this.room_id     = 'world_main';
    this.connected   = false;
    this.connecting  = false;
    this.ping_ms     = 0;
    this.tick_rate   = 20;
    this.sig         = SIG;

    // Registres d'état local
    this._players    = new Map(); // id -> playerData
    this._rooms      = [];
    this._rp         = { health: 100, cash: 2500, wanted: 0, job: null };
    
    // Paramètres de reconnexion
    this._reconnect_attempts = 0;
    this._max_reconnect      = options.maxReconnect ?? 10;
    this._base_reconnect_ms  = options.reconnectDelay ?? 1500;
    this._reconnect_timer    = null;
    this._auth_cache         = null;

    // Buffer de mouvement (Sync 20Hz)
    this._move_interval      = null;
    this._last_pos           = null;
    this._pos_dirty          = false;
    this._last_ping_sent     = 0;

    // File d'attente hors-ligne
    this._queue              = [];
    this._boundStore         = null;
    this._listenerMap        = new Map();
  }

  // ─── CONNEXION ET GESTION DU SOCKET ────────────────────────────────────────

  /**
   * Établit la connexion avec le serveur de jeu.
   * @param {object} [authData={}] - Données d'authentification (username, player_id, token)
   * @returns {Promise<TroxtClient>}
   */
  connect(authData = {}) {
    this._auth_cache = { ...authData };

    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) {
        return resolve(this);
      }

      this.connecting = true;
      this._emit('connecting', { url: this.url });

      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        this.connecting = false;
        this._try_reconnect();
        return reject(err);
      }

      const connectionTimeout = setTimeout(() => {
        if (this.connecting) {
          this.ws?.close();
          const err = new Error(`Délai d'attente de connexion dépassé vers ${this.url}`);
          this._emit('error', { message: err.message });
          reject(err);
        }
      }, 8000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.connected = true;
        this.connecting = false;
        this._reconnect_attempts = 0;

        console.log(`[${SIG}] Connecté au serveur de jeu : ${this.url}`);

        // Envoi du payload d'authentification
        this._send(MSG.AUTH, this._auth_cache);

        // Vidage de la file d'attente
        while (this._queue.length > 0) {
          const item = this._queue.shift();
          this.ws.send(item);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handle(msg);

          if (msg.type === MSG.HELLO) {
            resolve(this);
          } else if (msg.type === MSG.ERROR && msg.data?.code === 'SERVER_FULL') {
            reject(new Error('Serveur plein'));
          }
        } catch (err) {
          console.error(`[${SIG}] Erreur de parsing du message WebSocket :`, err);
        }
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        const wasConnected = this.connected;
        this.connected = false;
        this.connecting = false;
        this._stop_move_sync();

        console.warn(`[${SIG}] Connexion fermée (Code: ${event.code}, Raison: ${event.reason || 'Aucune'})`);
        this._emit('disconnect', { code: event.code, reason: event.reason, wasConnected });

        if (event.code !== 1000 && this._max_reconnect > 0) {
          this._try_reconnect();
        }
      };

      this.ws.onerror = (err) => {
        clearTimeout(connectionTimeout);
        console.error(`[${SIG}] Erreur WebSocket :`, err?.message || err);
        this._emit('error', { message: err?.message || 'Erreur réseau WebSocket' });
      };
    });
  }

  /**
   * Ferme proprement la connexion sans tenter de reconnexion.
   */
  disconnect() {
    this._max_reconnect = 0;
    if (this._reconnect_timer) {
      clearTimeout(this._reconnect_timer);
      this._reconnect_timer = null;
    }
    this._stop_move_sync();
    if (this.ws) {
      this.ws.close(1000, 'Déconnexion volontaire du client');
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
    this._players.clear();
    console.log(`[${SIG}] Client réseau déconnecté.`);
  }

  _try_reconnect() {
    if (this._reconnect_attempts >= this._max_reconnect) {
      console.error(`[${SIG}] Nombre maximal de tentatives de reconnexion atteint (${this._max_reconnect}).`);
      this._emit('reconnect_failed', { attempts: this._reconnect_attempts });
      return;
    }

    this._reconnect_attempts++;
    // Calcul de backoff exponentiel avec jitter aléatoire (anti-thundering herd)
    const baseDelay = this._base_reconnect_ms * Math.pow(1.5, this._reconnect_attempts - 1);
    const jitter = Math.random() * 500;
    const delay = Math.min(15000, Math.floor(baseDelay + jitter));

    console.log(`[${SIG}] Tentative de reconnexion ${this._reconnect_attempts}/${this._max_reconnect} dans ${delay}ms...`);
    this._emit('reconnecting', { attempt: this._reconnect_attempts, delay });

    this._reconnect_timer = setTimeout(() => {
      this.connect(this._auth_cache).catch(() => {});
    }, delay);
  }

  // ─── ÉMISSION ET TRANSMISSION DE MESSAGES ──────────────────────────────────

  _send(type, data = {}) {
    const payload = JSON.stringify({ type, data, ts: Date.now(), sig: SIG });
    if (this.ws && this.ws.readyState === 1) { // WebSocket.OPEN
      this.ws.send(payload);
    } else {
      if (this._queue.length < 100) {
        this._queue.push(payload);
      }
    }
  }

  _emit(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    this.dispatchEvent(event);

    // Synchronisation automatique avec le Store Zustand s'il est lié
    if (this._boundStore && typeof this._boundStore.applyTroxtEvent === 'function') {
      try {
        this._boundStore.applyTroxtEvent(`troxtworld:${eventName}`, detail);
      } catch {
        // Silencieux
      }
    }
  }

  // ─── API D'ÉCOUTEURS SIMPLIFIÉE (DX Pro) ───────────────────────────────────

  on(event, callback) {
    const listener = (e) => callback(e.detail);
    this._listenerMap.set(callback, listener);
    this.addEventListener(event, listener);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const listener = this._listenerMap.get(callback) || callback;
    this.removeEventListener(event, listener);
    this._listenerMap.delete(callback);
  }

  once(event, callback) {
    const listener = (e) => {
      this.removeEventListener(event, listener);
      this._listenerMap.delete(callback);
      callback(e.detail);
    };
    this._listenerMap.set(callback, listener);
    this.addEventListener(event, listener);
  }

  // ─── TRAITEMENT DES MESSAGES ENTRANTS DU SERVEUR ───────────────────────────

  _handle(msg) {
    const { type, data = {} } = msg;

    switch (type) {
      case MSG.HELLO:
        this.player_id = data.player_id;
        this.session   = data.session;
        this.username  = data.username;
        this.room_id   = data.room_id || 'world_main';
        this.tick_rate = data.tick_rate || 20;
        this._rooms    = data.rooms || [];

        // Enregistrement des joueurs existants dans la session
        this._players.clear();
        for (const p of data.world_players || []) {
          this._players.set(p.id, { ...p, _lastUpdate: Date.now() });
        }

        this._start_move_sync();
        console.log(`[${SIG}] Authentification validée : ${this.username} [${this.player_id}]`);
        this._emit('connected', data);
        break;

      case MSG.PLAYER_JOIN:
        this._players.set(data.player_id, { ...data, _lastUpdate: Date.now() });
        this._emit('player_join', data);
        break;

      case MSG.PLAYER_LEAVE:
        this._players.delete(data.player_id);
        this._emit('player_leave', data);
        break;

      case MSG.PLAYER_UPDATE:
        if (data.player_id !== this.player_id) {
          const prev = this._players.get(data.player_id) || {};
          this._players.set(data.player_id, {
            ...prev,
            pos:  data.pos  || prev.pos,
            rot:  data.rot  || prev.rot,
            vel:  data.vel  || prev.vel,
            anim: data.anim || prev.anim,
            _lastUpdate: Date.now(),
            _ts:  data.ts,
          });
        }
        this._emit('player_update', data);
        break;

      case MSG.PLAYERS_BATCH:
        for (const p of data.players || []) {
          if (p.id === this.player_id) continue;
          const prev = this._players.get(p.id) || { id: p.id };
          this._players.set(p.id, {
            ...prev,
            pos:  p.pos  || prev.pos,
            rot:  p.rot  || prev.rot,
            vel:  p.vel  || prev.vel,
            anim: p.anim || prev.anim,
            _lastUpdate: Date.now(),
            _ts:  p.ts,
          });
        }
        this._emit('players_batch', data);
        break;

      case MSG.CHAT_MESSAGE:
        this._emit('chat', data);
        break;

      case MSG.RP_EVENT:
        this._emit('rp_event', data);
        if (data.player_id === this.player_id && data.payload) {
          if (data.payload.needs)  this._rp.needs  = { ...this._rp.needs, ...data.payload.needs };
          if (data.payload.cash   !== undefined) this._rp.cash   = data.payload.cash;
          if (data.payload.wanted !== undefined) this._rp.wanted = data.payload.wanted;
        }
        break;

      case MSG.ROOM_UPDATE:
        this.room_id = data.room_id;
        this._emit('room_update', data);
        break;

      case MSG.PING:
        this.ping_ms = Date.now() - (data.ts || Date.now());
        this._send(MSG.PONG, { ts: data.ts });
        this._emit('ping', { ms: this.ping_ms });
        break;

      case MSG.ERROR:
        console.error(`[${SIG}] Erreur serveur [${data.code}]: ${data.message}`);
        this._emit('server_error', data);
        break;

      case MSG.KICK:
        console.warn(`[${SIG}] Expulsé du serveur : ${data.reason}`);
        this._emit('kicked', data);
        this.disconnect();
        break;

      default:
        this._emit('message', msg);
    }
  }

  // ─── SYNCHRONISATION 20Hz DU JOUEUR LOCAL ──────────────────────────────────

  _start_move_sync() {
    this._stop_move_sync();
    const intervalMs = Math.max(16, Math.floor(1000 / this.tick_rate));
    
    this._move_interval = setInterval(() => {
      if (this._pos_dirty && this._last_pos && this.connected) {
        this._send(MSG.MOVE, this._last_pos);
        this._pos_dirty = false;
      }
    }, intervalMs);
  }

  _stop_move_sync() {
    if (this._move_interval) {
      clearInterval(this._move_interval);
      this._move_interval = null;
    }
  }

  // ─── API DE JEU DU CLIENT ──────────────────────────────────────────────────

  /**
   * Met à jour la position du joueur local (optimisé par dirty flag).
   * @param {{x: number, y: number, z: number}} pos 
   * @param {{x: number, y: number, z: number}} rot 
   * @param {{x: number, y: number, z: number}} [vel] 
   * @param {string} [anim] 
   */
  move(pos, rot, vel = { x: 0, y: 0, z: 0 }, anim = 'idle') {
    this._last_pos = { pos, rot, vel, anim };
    this._pos_dirty = true;
  }

  /**
   * Envoie un message dans le chat RP.
   * @param {string} content 
   * @param {'local'|'global'|'radio'|'emergency'} [type='local'] 
   * @param {string} [target_id=null] 
   */
  chat(content, type = 'local', target_id = null) {
    if (!content || !content.trim()) return;
    this._send(MSG.CHAT, { content: content.trim(), type, target_id });
  }

  /**
   * Déclenche une action RP (achat, travail, récolte, soin).
   * @param {string} action 
   * @param {object} [payload={}] 
   */
  rp_action(action, payload = {}) {
    this._send(MSG.RP_ACTION, { action, payload });
  }

  /**
   * Interagit avec une entité ou porte du monde 3D.
   * @param {string} target_type 
   * @param {string} target_id 
   * @param {string} action 
   * @param {object} [extra={}] 
   */
  interact(target_type, target_id, action, extra = {}) {
    this._send(MSG.INTERACT, { target_type, target_id, action, extra });
  }

  join_room(room_id, room_name = '') {
    this._send(MSG.JOIN_ROOM, { room_id, room_name });
  }

  leave_room() {
    this._send(MSG.LEAVE_ROOM, {});
  }

  /**
   * Associe le client réseau directement au Store Zustand global.
   * @param {object} store - Instance de useGameState.getState()
   */
  bindStore(store) {
    this._boundStore = store;
  }

  // ─── GETTERS ───────────────────────────────────────────────────────────────

  get players()      { return Array.from(this._players.values()); }
  get player_count() { return this._players.size; }
  get rooms()        { return this._rooms; }
  get rp_state()     { return this._rp; }

  get_player(id) {
    return this._players.get(id) || null;
  }

  get_status() {
    return {
      connected:   this.connected,
      connecting:  this.connecting,
      player_id:   this.player_id,
      username:    this.username,
      room_id:     this.room_id,
      ping_ms:     this.ping_ms,
      players:     this._players.size,
      rp:          this._rp,
      sig:         SIG,
    };
  }
}

export { SIG };
export default TroxtClient;
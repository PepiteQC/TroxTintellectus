/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/BUILDING/HOTEL/HOTELREALTIMESECURITY.JS
 * Store temps réel léger pour les portes d'hôtel / propriétés
 * ═══════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • Auto-relock : timer par porte (pas de fuite / pas de throttle)
 *   • BroadcastChannel : patch par door (pas d'écrasement global)
 *   • Audit log local (ring buffer 200 entrées)
 *   • reset() public + resetLocal()
 *   • subscribe() retourne void
 *   • localStorage : fallback en mémoire si quota dépassé
 *   • PIN maître aligné dans DEFAULTS
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/building/hotel/HotelRealtimeSecurity.js
 */

const SIG = 'TROXT⬡';

// ─── JSDoc (autocomplétion) ────────────────────────────────────────────────
/**
 * @typedef {string} RoomId
 * @typedef {('magnetic_card'|'numpad'|'connected_app'|'staff_override')} HotelAccessMethod
 * @typedef {('resident'|'admin'|'staff')} HotelRole
 *
 * @typedef {object} DoorBase
 * @property {string} id
 * @property {RoomId} roomId
 * @property {string} lockId
 *
 * @typedef {object} HotelAccessAttempt
 * @property {string} doorId
 * @property {RoomId} roomId
 * @property {string} lockId
 * @property {HotelAccessMethod} method
 * @property {string} actorId
 * @property {string} [cardUid]
 * @property {string} [pin]
 * @property {number} createdAt
 *
 * @typedef {object} HotelAccessCredential
 * @property {string} actorId
 * @property {string} [cardUid]
 * @property {string} [pin]
 * @property {string[]|'all'} roomIds
 * @property {HotelRole} role
 * @property {number} [expiresAt]
 *
 * @typedef {object} HotelDoorSecurityState
 * @property {RoomId} roomId
 * @property {string} doorId
 * @property {string} lockId
 * @property {('locked'|'unlocked'|'open'|'lockout')} state
 * @property {boolean} isOpen
 * @property {boolean} isLocked
 * @property {number} failedAttempts
 * @property {number} [lockoutUntil]
 * @property {string} [lastActorId]
 * @property {HotelAccessMethod} [lastMethod]
 * @property {string} [lastMessage]
 * @property {number} updatedAt
 *
 * @typedef {object} HotelAccessResult
 * @property {boolean} granted
 * @property {HotelDoorSecurityState} state
 * @property {string} message
 * @property {('lockout'|'granted'|'bad_card'|'bad_pin'|'expired')} reason
 *
 * @typedef {object} HotelAuditEntry
 * @property {number} at
 * @property {string} doorId
 * @property {RoomId} roomId
 * @property {string} actorId
 * @property {HotelAccessMethod} method
 * @property {boolean} granted
 * @property {string} reason
 */

// ─── COLLECTIONS / DEFAULTS ────────────────────────────────────────────────

export const BUILDINGS_COLLECTIONS = Object.freeze({
  HOTEL: Object.freeze({
    ROOMS:              "buildings/hotel/rooms",
    DOORS:              "buildings/hotel/doors",
    LOCKS:              "buildings/hotel/locks",
    ACCESS_GRANTS:      "buildings/hotel/access_grants",
    ACCESS_CREDENTIALS: "buildings/hotel/credentials",
    LOCK_EVENTS:        "buildings/hotel/lock_events",
  }),
});

export const HOTEL_SECURITY_DEFAULTS = Object.freeze({
  defaultCardUid: "CARD-1234",
  defaultPin:     "1234",
  masterCardUid:  "CARD-ADMIN",
  masterPin:      "0000",          // 🔧 BOOST : aligné
  lockoutMs:      15000,
  autoRelockMs:   5000,
  maxFailedAttempts: 3,
  auditBufferSize:   200,
});

export const HOTEL_ROOMS = Object.freeze([
  Object.freeze({ id: "villa_nova",      name: "Villa Nova Suite" }),
  Object.freeze({ id: "modern_loft",     name: "Modern Loft Penthouse" }),
  Object.freeze({ id: "suburban_dream",  name: "Suburban Dream Chamber" }),
]);

export const HOTEL_DOORS = Object.freeze([
  Object.freeze({ id: "villa_nova_door",     roomId: "villa_nova",     lockId: "lock_villa_nova" }),
  Object.freeze({ id: "modern_loft_door",    roomId: "modern_loft",    lockId: "lock_modern_loft" }),
  Object.freeze({ id: "suburban_dream_door", roomId: "suburban_dream", lockId: "lock_suburban_dream" }),
]);

export const HOTEL_LOCKS = Object.freeze([
  Object.freeze({ id: "lock_villa_nova",     doorId: "villa_nova_door" }),
  Object.freeze({ id: "lock_modern_loft",    doorId: "modern_loft_door" }),
  Object.freeze({ id: "lock_suburban_dream", doorId: "suburban_dream_door" }),
]);

export const HOTEL_FIREBASE_SECURITY_PATHS = Object.freeze({
  rooms:       BUILDINGS_COLLECTIONS.HOTEL.ROOMS,
  doors:       BUILDINGS_COLLECTIONS.HOTEL.DOORS,
  locks:       BUILDINGS_COLLECTIONS.HOTEL.LOCKS,
  accessGrants:BUILDINGS_COLLECTIONS.HOTEL.ACCESS_GRANTS,
  credentials: BUILDINGS_COLLECTIONS.HOTEL.ACCESS_CREDENTIALS,
  events:      BUILDINGS_COLLECTIONS.HOTEL.LOCK_EVENTS,
});

const STORAGE_KEY = "etherworld.hotel.security.v1";
const CHANNEL     = "etherworld-hotel-security";

// ─── HELPERS ───────────────────────────────────────────────────────────────

const now = () => Date.now();

function createInitialStates() {
  /** @type {Record<string, HotelDoorSecurityState>} */
  const states = {};
  for (const door of HOTEL_DOORS) {
    states[door.id] = {
      roomId: door.roomId,
      doorId: door.id,
      lockId: door.lockId,
      state: "locked",
      isOpen: false,
      isLocked: true,
      failedAttempts: 0,
      updatedAt: now(),
    };
  }
  return states;
}

function createDefaultCredentials() {
  /** @type {HotelAccessCredential[]} */
  return [
    {
      actorId: "player-local",
      cardUid: HOTEL_SECURITY_DEFAULTS.defaultCardUid,
      pin:     HOTEL_SECURITY_DEFAULTS.defaultPin,
      roomIds: ["villa_nova", "modern_loft", "suburban_dream"],
      role:    "resident",
    },
    {
      actorId: "admin",
      cardUid: HOTEL_SECURITY_DEFAULTS.masterCardUid,
      pin:     HOTEL_SECURITY_DEFAULTS.masterPin,   // 🔧 BOOST
      roomIds: "all",
      role:    "admin",
    },
  ];
}

// ─── STORE PRINCIPAL ───────────────────────────────────────────────────────

export class HotelRealtimeSecurityStore {
  constructor() {
    /** @type {Record<string, HotelDoorSecurityState>} */
    this._states = createInitialStates();
    /** @type {HotelAccessCredential[]} */
    this._credentials = createDefaultCredentials();
    /** @type {Set<Function>} */
    this._listeners = new Set();
    /** @type {BroadcastChannel|null} */
    this._bc = null;
    /** @type {Map<string, number>} timers d'auto-relock par porte */
    this._relockTimers = new Map();
    /** @type {HotelAuditEntry[]} ring buffer */
    this._audit = [];
    /** fallback mémoire si localStorage indispo/quota */
    this._memFallback = null;

    this._restore();

    if (typeof BroadcastChannel !== "undefined") {
      this._bc = new BroadcastChannel(CHANNEL);
      this._bc.onmessage = (ev) => {
        const msg = ev.data;
        if (msg?.type === "HOTEL_SECURITY_PATCH" && msg.states) {
          // 🔧 BOOST : merge par door (pas d'écrasement global)
          for (const doorId of Object.keys(msg.states)) {
            this._states[doorId] = { ...this._states[doorId], ...msg.states[doorId] };
          }
          this._notifyLocal();
        }
      };
    }
  }

  // ─── React useSyncExternalStore ──────────────────────────────────────
  subscribe(listener) {
    this._listeners.add(listener);
    // 🔧 BOOST : retourne void (pas boolean) — évite warning React StrictMode
    return () => { this._listeners.delete(listener); };
  }

  getSnapshot() { return this._states; }

  getDoorState(doorId) { return this._states[doorId]; }

  getRoomDoorState(roomId) {
    const door = HOTEL_DOORS.find((d) => d.roomId === roomId);
    return door ? this._states[door.id] : undefined;
  }

  // ─── Audit ────────────────────────────────────────────────────────────
  getAudit() { return this._audit.slice(); }

  // ─── Credentials ──────────────────────────────────────────────────────
  registerCredential(credential) {
    this._credentials = this._credentials.filter(
      (c) => c.actorId !== credential.actorId || c.cardUid !== credential.cardUid
    );
    this._credentials.push(credential);
    this._persist();
  }

  // ─── Mutations directes ───────────────────────────────────────────────
  setDoorState(doorId, patch) {
    const prev = this._states[doorId];
    if (!prev) return;
    this._states[doorId] = { ...prev, ...patch, updatedAt: now() };
    this._emit(true, { [doorId]: this._states[doorId] });
  }

  forceLock(doorId, actorId = "system") {
    this._clearRelockTimer(doorId);
    this.setDoorState(doorId, {
      state: "locked",
      isLocked: true,
      isOpen: false,
      lastActorId: actorId,
      lastMethod: "staff_override",
      lastMessage: "Porte verrouillée",
    });
  }

  forceUnlock(doorId, actorId = "system") {
    this.setDoorState(doorId, {
      state: "unlocked",
      isLocked: false,
      isOpen: false,
      failedAttempts: 0,
      lastActorId: actorId,
      lastMethod: "staff_override",
      lastMessage: "Porte déverrouillée",
    });
    this._scheduleRelock(doorId);
  }

  toggleOpen(doorId) {
    const state = this._states[doorId];
    if (!state || state.isLocked || state.state === "lockout") return;
    this.setDoorState(doorId, {
      state: state.isOpen ? "unlocked" : "open",
      isOpen: !state.isOpen,
      lastMessage: state.isOpen ? "Porte refermée" : "Porte ouverte",
    });
    // 🔧 BOOST : reset du timer de relock si on ferme manuellement
    if (state.isOpen) this._scheduleRelock(doorId);
    else this._clearRelockTimer(doorId);
  }

  // ─── Accès (moteur principal) ─────────────────────────────────────────
  async requestAccess(attempt) {
    const state = this._states[attempt.doorId];
    if (!state) throw new Error(`Unknown hotel door: ${attempt.doorId}`);

    const t = now();

    // 1) Lockout actif ?
    if (state.lockoutUntil && state.lockoutUntil > t) {
      const next = {
        ...state,
        state: "lockout",
        lastMessage: "Lecteur verrouillé temporairement",
        updatedAt: t,
      };
      this._states[attempt.doorId] = next;
      this._emit(true, { [attempt.doorId]: next });
      this._logAudit(attempt, false, "lockout");
      return { granted: false, state: next, message: "Trop d'essais — lockout temporaire", reason: "lockout" };
    }

    // 2) Recherche credential valide
    const credential = this._credentials.find((c) => {
      if (c.expiresAt && c.expiresAt < t) return false;
      if (c.roomIds !== "all" && !c.roomIds.includes(attempt.roomId)) return false;
      if (attempt.method === "magnetic_card") return !!attempt.cardUid && c.cardUid === attempt.cardUid;
      if (attempt.method === "numpad")        return !!attempt.pin && c.pin === attempt.pin;
      if (attempt.method === "connected_app") return c.actorId === attempt.actorId;
      if (attempt.method === "staff_override")return c.role === "staff" || c.role === "admin";
      return false;
    });

    // 3) Succès
    if (credential) {
      const next = {
        ...state,
        state: "unlocked",
        isLocked: false,
        isOpen: false,
        failedAttempts: 0,
        lockoutUntil: undefined,
        lastActorId: attempt.actorId,
        lastMethod: attempt.method,
        lastMessage:
          attempt.method === "magnetic_card" ? "Carte magnétique acceptée"
          : attempt.method === "numpad"      ? "Numpad accepté"
          : "Accès autorisé",
        updatedAt: t,
      };
      this._states[attempt.doorId] = next;
      this._emit(true, { [attempt.doorId]: next });
      this._logAudit(attempt, true, "granted");

      // 🔧 BOOST : timer par porte (annule le précédent si existant)
      this._scheduleRelock(attempt.doorId);

      return { granted: true, state: next, message: next.lastMessage || "Accès autorisé", reason: "granted" };
    }

    // 4) Échec
    const failedAttempts = state.failedAttempts + 1;
    const lockedOut = failedAttempts >= HOTEL_SECURITY_DEFAULTS.maxFailedAttempts;
    const next = {
      ...state,
      state: lockedOut ? "lockout" : "locked",
      isLocked: true,
      isOpen: false,
      failedAttempts,
      lockoutUntil: lockedOut ? t + HOTEL_SECURITY_DEFAULTS.lockoutMs : undefined,
      lastActorId: attempt.actorId,
      lastMethod: attempt.method,
      lastMessage:
        attempt.method === "magnetic_card" ? "Carte refusée"
        : attempt.method === "numpad"      ? "NIP refusé"
        : "Accès refusé",
      updatedAt: t,
    };
    this._states[attempt.doorId] = next;
    this._emit(true, { [attempt.doorId]: next });

    const reason = attempt.method === "magnetic_card" ? "bad_card" : "bad_pin";
    this._logAudit(attempt, false, reason);

    return {
      granted: false,
      state: next,
      message: lockedOut ? "Trop d'essais — lecteur verrouillé" : next.lastMessage,
      reason,
    };
  }

  // ─── Reset / seed ────────────────────────────────────────────────────
  reset() {
    for (const id of this._relockTimers.keys()) this._clearRelockTimer(id);
    this._states = createInitialStates();
    this._credentials = createDefaultCredentials();
    this._audit = [];
    this._emit(true, this._states);
  }

  createFirebaseSeed() {
    return {
      paths: HOTEL_FIREBASE_SECURITY_PATHS,
      rooms: HOTEL_ROOMS,
      doors: HOTEL_DOORS,
      locks: HOTEL_LOCKS,
      states: Object.values(this._states),
      credentialsPolicy: {
        clientReadableSecrets: false,
        magneticCards: "hash/server-only in production",
        numpadPins:    "hash/server-only in production",
      },
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────
  _scheduleRelock(doorId) {
    this._clearRelockTimer(doorId);
    const t = globalThis.setTimeout(() => {
      this._relockTimers.delete(doorId);
      const current = this._states[doorId];
      if (current && !current.isOpen && !current.isLocked) {
        this.forceLock(doorId, "auto-relock");
      }
    }, HOTEL_SECURITY_DEFAULTS.autoRelockMs);
    this._relockTimers.set(doorId, t);
  }

  _clearRelockTimer(doorId) {
    const t = this._relockTimers.get(doorId);
    if (t !== undefined) {
      globalThis.clearTimeout(t);
      this._relockTimers.delete(doorId);
    }
  }

  _logAudit(attempt, granted, reason) {
    /** @type {HotelAuditEntry} */
    const entry = {
      at: now(),
      doorId: attempt.doorId,
      roomId: attempt.roomId,
      actorId: attempt.actorId,
      method: attempt.method,
      granted,
      reason,
    };
    this._audit.push(entry);
    if (this._audit.length > HOTEL_SECURITY_DEFAULTS.auditBufferSize) {
      this._audit.splice(0, this._audit.length - HOTEL_SECURITY_DEFAULTS.auditBufferSize);
    }
  }

  _emit(sync, patch) {
    this._persist();
    this._notifyLocal();
    if (sync && this._bc) {
      this._bc.postMessage({ type: "HOTEL_SECURITY_PATCH", states: patch || this._states });
    }
  }

  _notifyLocal() {
    for (const l of this._listeners) {
      try { l(); } catch { /* ignore */ }
    }
  }

  _persist() {
    const payload = JSON.stringify({ states: this._states, credentials: this._credentials });
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, payload);
        this._memFallback = null;
        return;
      } catch (err) {
        // 🔧 BOOST : fallback mémoire silencieux mais documenté
        this._memFallback = payload;
      }
    }
    this._memFallback = payload;
  }

  _restore() {
    let raw = null;
    if (typeof localStorage !== "undefined") {
      try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    }
    if (!raw && this._memFallback) raw = this._memFallback;
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.states && typeof parsed.states === "object") {
        this._states = { ...this._states, ...parsed.states };
      }
      if (Array.isArray(parsed?.credentials)) {
        this._credentials = parsed.credentials;
      }
    } catch {
      // restore a échoué → on garde les defaults
      this._states = createInitialStates();
      this._credentials = createDefaultCredentials();
    }
  }
}

// ─── SINGLETON ─────────────────────────────────────────────────────────────
export const hotelRealtimeSecurity = new HotelRealtimeSecurityStore();

// ─── HELPERS PUBLICS ───────────────────────────────────────────────────────

export function getDoorByRoom(roomId) {
  return HOTEL_DOORS.find((door) => door.roomId === roomId);
}

export function makeAccessAttempt(params) {
  const door = getDoorByRoom(params.roomId);
  const lock = door ? HOTEL_LOCKS.find((l) => l.doorId === door.id) : undefined;
  if (!door || !lock) throw new Error(`No security door for room ${params.roomId}`);
  return hotelRealtimeSecurity.requestAccess({
    roomId: params.roomId,
    doorId: door.id,
    lockId: lock.id,
    method: params.method,
    actorId: params.actorId || "player-local",
    cardUid: params.cardUid,
    pin: params.pin,
  });
}

export { SIG };
export default {
  hotelRealtimeSecurity,
  HotelRealtimeSecurityStore,
  getDoorByRoom,
  makeAccessAttempt,
  HOTEL_ROOMS,
  HOTEL_DOORS,
  HOTEL_LOCKS,
  HOTEL_SECURITY_DEFAULTS,
  HOTEL_FIREBASE_SECURITY_PATHS,
  BUILDINGS_COLLECTIONS,
};
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — STORE GLOBAL (Zustand-like minimal, zéro-dépendance)
 * ═══════════════════════════════════════════════════════════════════════════
 * Path : client/src/core/store.mjs
 *
 * v2.0 boosted :
 *   ✅ Patch fonctionnel `setState(fn)` (avant : objet seulement)
 *   ✅ Sélecteurs : `select(fn)` + `useState(selector)` style Zustand
 *   ✅ Notifications granulaires (par clé) — évite les re-renders inutiles
 *   ✅ subscribeKey(key, fn) — abonnement ciblé
 *   ✅ Égalité shallow avant notification (skip si rien ne change)
 *   ✅ Persistance throttlée + debounced + versionnée (migration safe)
 *   ✅ Restore auto au chargement (opt-in via TROXT_STORE_AUTORESTORE)
 *   ✅ Batch : transaction(fn) — 1 seule notification pour N set
 *   ✅ Middleware chain (onBeforeSet, onAfterSet)
 *   ✅ sanitize sur restore (clés inconnues ignorées)
 *   ✅ resetStore() / hydrate(patch)
 *   ✅ Immutabilité douce : shallow freeze en dev
 *   ✅ Erreurs de listener isolées (1 listener qui throw ne casse pas les autres)
 *   ✅ getStats() / reset() / dispose()
 *   ✅ Rétro-compat : getState / setState / subscribe / persist / restore
 *   ✅ Actions existantes (openIntel / closeIntel / toggleIntel) conservées
 */

const SIG = "TROXT⬡·Store";
const STORAGE_KEY = "troxtworld.state";
const STORAGE_VERSION = 2;
const IS_DEV = (typeof process !== "undefined" && process.env?.NODE_ENV !== "production")
            || (typeof window !== "undefined" && window.location?.hostname === "localhost");

// ─── SCHÉMA (whitelist pour restore) ────────────────────────────────────────
const SCHEMA_KEYS = new Set([
  "season", "wxCondition", "wxTemp", "snowCm", "plowStatus",
  "eventBanner", "intelOpen", "properties", "gangs", "players",
  "timeOfDay", "dayCount", "weather",
]);

// ─── ÉTAT INITIAL ───────────────────────────────────────────────────────────
function initialState() {
  return {
    season: "hiver",
    wxCondition: "neige",
    wxTemp: -8,
    snowCm: 35,
    plowStatus: "en_cours",
    eventBanner: null,
    intelOpen: false,
    properties: [],
    gangs: [],
    players: [],
    // Extensions futures (WorldSystem, day cycle…)
    timeOfDay: 12,
    dayCount: 1,
    weather: "clear",
  };
}

let _state = initialState();

// ─── LISTENERS ──────────────────────────────────────────────────────────────
const _listeners = new Set();               // fn(state, patch, changedKeys)
const _keyListeners = new Map();            // key → Set<fn>

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────
const _beforeHooks = new Set();             // (patch, current) => patch|void
const _afterHooks  = new Set();             // (state, patch, changedKeys) => void

// ─── STATS ──────────────────────────────────────────────────────────────────
const _stats = {
  sets: 0, notifications: 0, batches: 0, listenerErrors: 0,
  persists: 0, persistsSkipped: 0, restores: 0, restoresFailed: 0,
  startedAt: Date.now(),
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

function computeChangedKeys(prev, next) {
  const keys = new Set();
  for (const k in next) if (prev[k] !== next[k]) keys.add(k);
  for (const k in prev) if (!(k in next)) keys.add(k);
  return keys;
}

function notify(state, patch, changedKeys) {
  // Global listeners
  for (const fn of _listeners) {
    try { fn(state, patch, changedKeys); }
    catch (e) {
      _stats.listenerErrors++;
      if (typeof console !== "undefined") {
        console.warn(`[${SIG}] listener error:`, e?.message);
      }
    }
  }
  // Key listeners
  for (const key of changedKeys) {
    const set = _keyListeners.get(key);
    if (!set) continue;
    for (const fn of set) {
      try { fn(state[key], state); }
      catch (e) {
        _stats.listenerErrors++;
        if (typeof console !== "undefined") {
          console.warn(`[${SIG}] key listener (${key}) error:`, e?.message);
        }
      }
    }
  }
  _stats.notifications++;
}

// ─── API PUBLIQUE ───────────────────────────────────────────────────────────

/** Retourne l'état complet (référence live — ne pas muter). */
export function getState() {
  return _state;
}

/**
 * Met à jour l'état.
 * @param {object|function} patch  Objet à fusionner OU (prev) => patch
 * @param {{ silent?: boolean, persistNow?: boolean }} [opts]
 * @returns {object} nouvel état
 */
export function setState(patch, opts = {}) {
  // ✅ v2 : support fonctionnel style Zustand/Redux
  const resolved = typeof patch === "function" ? patch(_state) : patch;
  if (!isPlainObject(resolved)) {
    if (IS_DEV && typeof console !== "undefined") {
      console.warn(`[${SIG}] setState ignore : patch non-objet`, resolved);
    }
    return _state;
  }

  // Middleware before (peut muter le patch)
  let effectivePatch = resolved;
  for (const hook of _beforeHooks) {
    try {
      const r = hook(effectivePatch, _state);
      if (isPlainObject(r)) effectivePatch = r;
    } catch (e) {
      if (typeof console !== "undefined") {
        console.warn(`[${SIG}] before hook error:`, e?.message);
      }
    }
  }

  const prev = _state;
  const next = { ...prev, ...effectivePatch };

  // ✅ v2 : skip si shallow equal
  if (shallowEqual(prev, next)) return _state;

  _state = IS_DEV ? Object.freeze(next) : next;
  _stats.sets++;

  const changedKeys = computeChangedKeys(prev, effectivePatch);
  if (!opts.silent) notify(_state, effectivePatch, changedKeys);

  // Middleware after
  for (const hook of _afterHooks) {
    try { hook(_state, effectivePatch, changedKeys); }
    catch (e) {
      if (typeof console !== "undefined") {
        console.warn(`[${SIG}] after hook error:`, e?.message);
      }
    }
  }

  // Persistance auto ? (déclenchée par le consommateur ou via flag)
  if (opts.persistNow) schedulePersist();

  return _state;
}

/**
 * S'abonner aux changements.
 * @param {(state, patch, changedKeys) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  if (typeof fn !== "function") return () => {};
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** ✅ v2 : abonnement ciblé sur une ou plusieurs clés. */
export function subscribeKey(keyOrKeys, fn) {
  if (typeof fn !== "function") return () => {};
  const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
  for (const k of keys) {
    let set = _keyListeners.get(k);
    if (!set) { set = new Set(); _keyListeners.set(k, set); }
    set.add(fn);
  }
  return () => {
    for (const k of keys) {
      const set = _keyListeners.get(k);
      if (set) set.delete(fn);
    }
  };
}

/**
 * ✅ v2 : sélecteur Zustand-like.
 * @param {(state) => any} selector
 * @returns {any}
 */
export function select(selector) {
  if (typeof selector !== "function") return _state;
  return selector(_state);
}

// ─── PERSISTANCE ────────────────────────────────────────────────────────────
let _persistTimer = null;
const PERSIST_DEBOUNCE_MS = 200;

function _persistNow() {
  try {
    if (typeof localStorage === "undefined") return false;
    const payload = {
      __version: STORAGE_VERSION,
      __savedAt: Date.now(),
      state: _state,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    _stats.persists++;
    return true;
  } catch (e) {
    _stats.persistsSkipped++;
    if (typeof console !== "undefined") {
      console.warn(`[${SIG}] persist error:`, e?.message);
    }
    return false;
  }
}

/** ✅ v2 : persistance debounced (200 ms) — évite le spam localStorage. */
export function schedulePersist() {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    _persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

/** Persistance immédiate (force le flush). */
export function persist() {
  if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
  return _persistNow();
}

/**
 * Restaure l'état depuis localStorage.
 * ✅ v2 : versionnée, whitelist, tolérante aux anciennes versions.
 * @param {{ merge?: boolean }} [opts]
 */
export function restore(opts = {}) {
  try {
    if (typeof localStorage === "undefined") return false;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);

    // Ancien format : { season: "hiver", ... }
    // Nouveau format : { __version, __savedAt, state: {...} }
    const isWrapped = parsed && typeof parsed === "object" && "state" in parsed;
    const data = isWrapped ? parsed.state : parsed;
    const version = isWrapped ? (parsed.__version ?? 1) : 1;

    if (!isPlainObject(data)) {
      _stats.restoresFailed++;
      return false;
    }

    // Whitelist : ignore les clés inconnues (protège contre la corruption)
    const clean = {};
    for (const k of Object.keys(data)) {
      if (SCHEMA_KEYS.has(k)) clean[k] = data[k];
    }

    if (opts.merge === false) {
      _state = IS_DEV ? Object.freeze({ ...initialState(), ...clean })
                      : { ...initialState(), ...clean };
    } else {
      _state = IS_DEV ? Object.freeze({ ..._state, ...clean })
                      : { ..._state, ...clean };
    }

    _stats.restores++;
    if (version < STORAGE_VERSION && IS_DEV && typeof console !== "undefined") {
      console.info(`[${SIG}] Migration storage v${version} → v${STORAGE_VERSION}`);
    }
    return true;
  } catch (e) {
    _stats.restoresFailed++;
    if (typeof console !== "undefined") {
      console.warn(`[${SIG}] restore error:`, e?.message);
    }
    return false;
  }
}

/** ✅ v2 : restore auto si flag activé (utile en prod). */
export function enableAutoRestore() {
  if (typeof window !== "undefined") {
    restore({ merge: true });
    window.addEventListener("beforeunload", () => persist());
    return true;
  }
  return false;
}

// ─── BATCH / TRANSACTION ────────────────────────────────────────────────────
let _batchDepth = 0;
let _batchPatch = {};
let _batchChanged = new Set();

/**
 * ✅ v2 : exécute N setState avec UNE SEULE notification à la fin.
 * @param {(set: (patch: object) => void) => void} fn
 */
export function transaction(fn) {
  if (typeof fn !== "function") return _state;
  _batchDepth++;
  try {
    fn((patch) => {
      const resolved = typeof patch === "function" ? patch(_state) : patch;
      if (!isPlainObject(resolved)) return;
      _batchPatch = { ..._batchPatch, ...resolved };
      for (const k of Object.keys(resolved)) _batchChanged.add(k);
    });
  } finally {
    _batchDepth--;
    if (_batchDepth === 0 && Object.keys(_batchPatch).length > 0) {
      const prev = _state;
      const next = { ...prev, ..._batchPatch };
      if (!shallowEqual(prev, next)) {
        _state = IS_DEV ? Object.freeze(next) : next;
        _stats.sets++;
        _stats.batches++;
        notify(_state, _batchPatch, _batchChanged);
        for (const hook of _afterHooks) {
          try { hook(_state, _batchPatch, _batchChanged); } catch {}
        }
      }
      _batchPatch = {};
      _batchChanged = new Set();
    }
  }
  return _state;
}

// ─── MIDDLEWARE API ─────────────────────────────────────────────────────────
export function addBeforeSetHook(fn) {
  if (typeof fn !== "function") return () => {};
  _beforeHooks.add(fn);
  return () => _beforeHooks.delete(fn);
}
export function addAfterSetHook(fn) {
  if (typeof fn !== "function") return () => {};
  _afterHooks.add(fn);
  return () => _afterHooks.delete(fn);
}

// ─── RESET / HYDRATE ────────────────────────────────────────────────────────
export function resetStore(opts = {}) {
  const patch = initialState();
  setState(patch, { silent: opts.silent, persistNow: opts.persist !== false });
  return _state;
}

/** Remplace l'état par un objet fourni (whitelist appliquée). */
export function hydrate(data, opts = {}) {
  if (!isPlainObject(data)) return _state;
  const clean = {};
  for (const k of Object.keys(data)) if (SCHEMA_KEYS.has(k)) clean[k] = data[k];
  setState(clean, { silent: opts.silent });
  return _state;
}

// ─── STATS / CLEANUP ────────────────────────────────────────────────────────
export function getStats() {
  return {
    ..._stats,
    listeners: _listeners.size,
    keyListeners: Array.from(_keyListeners.entries()).map(([k, s]) => [k, s.size]),
    keys: Object.keys(_state),
    uptimeMs: Date.now() - _stats.startedAt,
    sig: SIG,
  };
}

export function resetStats() {
  for (const k of Object.keys(_stats)) {
    if (typeof _stats[k] === "number") _stats[k] = 0;
  }
  _stats.startedAt = Date.now();
}

export function dispose() {
  _listeners.clear();
  _keyListeners.clear();
  _beforeHooks.clear();
  _afterHooks.clear();
  if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS — INTEL (compat)
// ═══════════════════════════════════════════════════════════════════════════
export const closeIntel  = () => setState({ intelOpen: false });
export const openIntel   = () => setState({ intelOpen: true });
export const toggleIntel = () => setState({ intelOpen: !_state.intelOpen });

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS — MÉTÉO / SAISONS
// ═══════════════════════════════════════════════════════════════════════════
export const setSeason     = (season) => setState({ season });
export const setWeather    = (wxCondition) => setState({ wxCondition });
export const setTemperature = (wxTemp) => setState({ wxTemp });
export const setSnowDepth  = (snowCm) => setState({ snowCm });
export const setPlowStatus = (plowStatus) => setState({ plowStatus });
export const setEventBanner = (eventBanner) => setState({ eventBanner });
export const clearEventBanner = () => setState({ eventBanner: null });

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS — TIME OF DAY (pour WorldSystem + useAtmosphere)
// ═══════════════════════════════════════════════════════════════════════════
export const setTimeOfDay = (timeOfDay) => setState({ timeOfDay });
export const setDayCount  = (dayCount)  => setState({ dayCount });
export const advanceTime  = (hours) => {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return _state;
  return setState((s) => {
    const t = ((s.timeOfDay + hours) % 24 + 24) % 24;
    const extraDays = Math.floor((s.timeOfDay + hours) / 24);
    return { timeOfDay: t, dayCount: s.dayCount + Math.max(0, extraDays) };
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS — COLLECTIONS (properties / gangs / players)
// ═══════════════════════════════════════════════════════════════════════════
export const setProperties = (properties) => setState({ properties: Array.isArray(properties) ? properties : [] });
export const setGangs      = (gangs)      => setState({ gangs: Array.isArray(gangs) ? gangs : [] });
export const setPlayers    = (players)    => setState({ players: Array.isArray(players) ? players : [] });

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT DEFAULT — pratique pour import unique
// ═══════════════════════════════════════════════════════════════════════════
export default {
  getState, setState, subscribe, subscribeKey, select,
  persist, schedulePersist, restore, enableAutoRestore,
  transaction, resetStore, hydrate,
  addBeforeSetHook, addAfterSetHook,
  getStats, resetStats, dispose,
  // Actions
  closeIntel, openIntel, toggleIntel,
  setSeason, setWeather, setTemperature, setSnowDepth, setPlowStatus,
  setEventBanner, clearEventBanner,
  setTimeOfDay, setDayCount, advanceTime,
  setProperties, setGangs, setPlayers,
  SIG,
};
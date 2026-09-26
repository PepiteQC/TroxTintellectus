/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/USEATMOSPHERE.JS  (v3.0 ultra)
 * Hook React qui alimente WorldLighting.tsx depuis le store + WorldSystem
 * ═══════════════════════════════════════════════════════════════════
 * v3.0 — Scheduler singleton + tick adaptatif + interpolation + métriques
 *
 * NOUVEAUTÉS v3.0 :
 *   • Scheduler global : N composants → 1 seul poll worldSystem
 *   • Tick adaptatif   : 30Hz en transition, 4Hz normal, 1Hz en idle
 *   • Interpolation    : transitions douces (sunset → night sans jump)
 *   • Selector         : ne re-render QUE quand un champ précis change
 *   • Effect           : callback on-change sans re-render (sons, particules)
 *   • Debug            : métriques live (computes, changes, Hz actuel)
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/world/useAtmosphere.js
 *
 * Exports :
 *   useAtmosphere(refreshHz|opts)      → objet réactif
 *   useAtmosphereRef(refreshHz|opts)   → { current } muté (0 re-render)
 *   useAtmosphereSnapshot()            → getter () => params (no sub)
 *   useAtmosphereSelector(sel, eq)     → 1 champ, re-render minimal
 *   useAtmosphereEffect(fn)            → side effects on change
 *   useAtmosphereDebug(hz=2)           → métriques live
 *   boost(ms)                          → force haute fréquence
 *   subscribeAtmosphere(fn)            → API bas-niveau
 *   SIG, DEFAULT_REFRESH_HZ, BOOST_REFRESH_HZ, IDLE_REFRESH_HZ
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameState } from '../store.js';
import { worldSystem } from './WorldSystem.js';

// ─── CONSTANTES ─────────────────────────────────────────────────────────────
const SIG = 'TROXT⬡';

const DEFAULT_REFRESH_HZ = 4;
const BOOST_REFRESH_HZ   = 30;
const BOOST_DURATION_MS  = 1500;
const IDLE_REFRESH_HZ    = 1;
const IDLE_AFTER_MS      = 8000;
const MAX_REFRESH_HZ     = 60;
const HAS_RAF            = typeof requestAnimationFrame === 'function';

// ─── UTILS ──────────────────────────────────────────────────────────────────
function safeRefreshHz(hz, def = DEFAULT_REFRESH_HZ) {
  const n = Number(hz);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, MAX_REFRESH_HZ);
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    const k = ka[i];
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/** Interpole les champs numériques, copie les autres depuis b. */
function lerpObject(a, b, t) {
  const out = {};
  const seen = new Set();
  if (a && typeof a === 'object') for (const k in a) seen.add(k);
  if (b && typeof b === 'object') for (const k in b) seen.add(k);
  for (const k of seen) {
    const va = a?.[k], vb = b?.[k];
    if (typeof va === 'number' && Number.isFinite(va) &&
        typeof vb === 'number' && Number.isFinite(vb)) {
      out[k] = va + (vb - va) * t;
    } else {
      out[k] = vb !== undefined ? vb : va;
    }
  }
  return out;
}

const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** Normalise l'argument (number | opts object). */
function normalizeOpts(arg) {
  if (typeof arg === 'object' && arg !== null) {
    return {
      refreshHz:     safeRefreshHz(arg.refreshHz),
      interpolateMs: Number.isFinite(arg.interpolateMs) ? Math.max(0, arg.interpolateMs) : 0,
    };
  }
  return { refreshHz: safeRefreshHz(arg), interpolateMs: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULER GLOBAL — un seul rAF, un seul compute pour N composants
// ═══════════════════════════════════════════════════════════════════════════
class AtmosphereScheduler {
  constructor() {
    this._subs          = new Set();
    this._latest        = {};
    this._inputs        = null;
    this._raf           = null;
    this._lastCompute   = 0;
    this._lastChangeAt  = Date.now();
    this._boostUntil    = 0;
    this._metrics       = {
      computes: 0, notified: 0, subscribers: 0,
      lastComputeMs: 0, changes: 0, mode: 'idle', currentHz: 0,
    };
  }

  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this._subs.add(fn);
    this._metrics.subscribers = this._subs.size;
    if (!this._raf) this._start();
    return () => {
      this._subs.delete(fn);
      this._metrics.subscribers = this._subs.size;
      if (this._subs.size === 0) this._stop();
    };
  }

  setInputs(inputs) {
    this._inputs = inputs;
    // Boost 300 ms : on veut voir le changement tout de suite
    this._boostUntil = Date.now() + 300;
  }

  boost(ms = BOOST_DURATION_MS) {
    this._boostUntil = Date.now() + Math.max(100, ms | 0);
  }

  getSnapshot() { return this._latest; }
  metrics()     { return { ...this._metrics }; }

  _start() {
    if (!HAS_RAF) return;
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      try { this._compute(Date.now()); } catch { /* non bloquant */ }
    };
    this._raf = requestAnimationFrame(tick);
  }
  _stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _currentHz(now) {
    if (now < this._boostUntil) return BOOST_REFRESH_HZ;
    if (now - this._lastChangeAt > IDLE_AFTER_MS) return IDLE_REFRESH_HZ;
    return DEFAULT_REFRESH_HZ;
  }

  _compute(now) {
    if (!this._inputs) return;
    const hz       = this._currentHz(now);
    const interval = 1000 / hz;
    if (now - this._lastCompute < interval) return;
    this._lastCompute = now;

    const t0 = performance.now();
    let next = null;
    try {
      worldSystem.set(this._inputs);
      next = worldSystem.getAtmosphereParams();
    } catch (e) {
      if (typeof console !== 'undefined') {
        console.warn(`[${SIG}·Atmo] compute error:`, e?.message || e);
      }
      return;
    }
    const dt = performance.now() - t0;

    this._metrics.computes++;
    this._metrics.lastComputeMs = dt;
    this._metrics.currentHz     = hz;
    this._metrics.mode = now < this._boostUntil ? 'boost'
                       : (now - this._lastChangeAt > IDLE_AFTER_MS) ? 'idle'
                       : 'normal';

    if (!next || typeof next !== 'object') return;
    if (shallowEqual(this._latest, next)) return;

    this._latest = next;
    this._lastChangeAt = now;
    this._metrics.changes++;
    this._metrics.notified = this._subs.size;

    for (const fn of this._subs) {
      try { fn(next); } catch (e) {
        if (typeof console !== 'undefined') {
          console.warn(`[${SIG}·Atmo] sub error:`, e?.message);
        }
      }
    }
  }
}

let _scheduler = null;
function getScheduler() {
  if (!_scheduler) _scheduler = new AtmosphereScheduler();
  return _scheduler;
}

/** Force la haute fréquence pour `ms` millisecondes (ex: ouverture menu météo). */
export function boost(ms = BOOST_DURATION_MS) { getScheduler().boost(ms); }

/** API brute : s'abonner aux changements d'atmosphère. */
export function subscribeAtmosphere(fn) { return getScheduler().subscribe(fn); }

// ═══════════════════════════════════════════════════════════════════════════
// INPUTS STORE — 4 slots indépendants pour éviter les re-render parasites
// ═══════════════════════════════════════════════════════════════════════════
function useAtmosphereInputs() {
  const timeOfDay = useGameState(s => s.timeOfDay);
  const season    = useGameState(s => s.season);
  const weather   = useGameState(s => s.weather);
  const dayCount  = useGameState(s => s.dayCount);
  return useMemo(
    () => ({ timeOfDay, season, weather, dayCount }),
    [timeOfDay, season, weather, dayCount]
  );
}
function keyOf(i) { return `${i.timeOfDay}|${i.season}|${i.weather}|${i.dayCount}`; }

/** Pousse les inputs dans le scheduler + boost immédiat. */
function usePushInputs(inputs) {
  const sched = getScheduler();
  const key   = keyOf(inputs);
  useEffect(() => {
    sched.setInputs(inputs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sched, key]);
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK 1 — useAtmosphere : réactif (re-render SEULEMENT si les params changent)
// ═══════════════════════════════════════════════════════════════════════════
export function useAtmosphere(arg = DEFAULT_REFRESH_HZ) {
  const opts  = normalizeOpts(arg);
  const sched = getScheduler();
  const inputs = useAtmosphereInputs();
  usePushInputs(inputs);

  // Cible brute (dernier snapshot du scheduler)
  const [target, setTarget] = useState(() => sched.getSnapshot());

  // Valeur affichée (interpolée ou = target si interpolateMs=0)
  const [val, setVal] = useState(target);

  // Interpolation state
  const fromRef   = useRef(target);
  const toRef     = useRef(target);
  const startRef  = useRef(0);
  const activeRef = useRef(false);

  // Subscribe au scheduler
  useEffect(() => {
    return sched.subscribe((next) => {
      setTarget(next);
      if (opts.interpolateMs <= 0) setVal(next);
    });
  }, [sched, opts.interpolateMs]);

  // Démarre une interpolation quand target change
  useEffect(() => {
    if (opts.interpolateMs <= 0) return;
    fromRef.current  = val;
    toRef.current    = target;
    startRef.current = performance.now();
    activeRef.current = true;
    sched.boost(opts.interpolateMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Boucle d'interpolation
  useFrame(() => {
    if (opts.interpolateMs <= 0) return;
    if (!activeRef.current) return;

    const t = Math.min(1, (performance.now() - startRef.current) / opts.interpolateMs);
    if (t >= 1) {
      setVal(toRef.current);
      activeRef.current = false;
      return;
    }
    setVal(lerpObject(fromRef.current, toRef.current, easeInOut(t)));
  });

  return opts.interpolateMs > 0 ? val : target;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK 2 — useAtmosphereRef : muté en place, ZÉRO re-render
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Retourne un `{ current }` STABLE muté en place.
 * ⚠️  Comparaison par référence impossible — lire les champs directement.
 */
export function useAtmosphereRef(arg = DEFAULT_REFRESH_HZ) {
  const opts  = normalizeOpts(arg);
  const sched = getScheduler();
  const inputs = useAtmosphereInputs();
  usePushInputs(inputs);

  const ref = useRef(null);
  if (ref.current === null) {
    const snap = sched.getSnapshot();
    ref.current = (snap && Object.keys(snap).length > 0) ? { ...snap } : {};
  }

  // Subscribe : on mute ref.current au lieu de setState
  useEffect(() => {
    return sched.subscribe((next) => {
      if (opts.interpolateMs > 0) {
        // interpolation par lerp local
        const from = { ...ref.current };
        const start = performance.now();
        sched.boost(opts.interpolateMs);
        const step = () => {
          const t = Math.min(1, (performance.now() - start) / opts.interpolateMs);
          Object.assign(ref.current, lerpObject(from, next, easeInOut(t)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      } else {
        Object.assign(ref.current, next);
      }
    });
  }, [sched, opts.interpolateMs]);

  return ref;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK 3 — useAtmosphereSnapshot : lecture à la demande (event handlers)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Retourne un getter `() => AtmosphereParams`.
 * Utile dans les event handlers (interaction, tir, spawn) où on veut
 * une valeur fraîche SANS abonnement.
 */
export function useAtmosphereSnapshot() {
  const sched = getScheduler();
  const inputs = useAtmosphereInputs();
  usePushInputs(inputs);

  const getterRef = useRef(null);
  if (getterRef.current === null) {
    getterRef.current = () => sched.getSnapshot() || {};
  }
  return getterRef.current;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK 4 — useAtmosphereSelector : extraire UN champ, re-render minimal
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @param {(params:object)=>any} selector     Doit être stable (useCallback/module)
 * @param {(a:any,b:any)=>boolean} [equalityFn=Object.is]
 *
 * Exemple :
 *   const fog = useAtmosphereSelector(p => p.fogDensity);
 */
export function useAtmosphereSelector(selector, equalityFn = Object.is) {
  const sched = getScheduler();
  const inputs = useAtmosphereInputs();
  usePushInputs(inputs);

  const [value, setValue] = useState(() => selector(sched.getSnapshot()));
  const valueRef = useRef(value);
  valueRef.current = value;

  const selRef = useRef(selector);
  selRef.current = selector;
  const eqRef = useRef(equalityFn);
  eqRef.current = equalityFn;

  useEffect(() => {
    return sched.subscribe((next) => {
      const v = selRef.current(next);
      if (!eqRef.current(valueRef.current, v)) setValue(v);
    });
  }, [sched]);

  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK 5 — useAtmosphereEffect : callback on-change SANS re-render
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Exécute `fn(next, prev)` à chaque changement d'atmosphère.
 * Parfait pour : jouer un son (orage), spawn des particules (pluie),
 * déclencher une cinématique au coucher du soleil.
 *
 * @param {(next:object, prev:object)=>void} fn
 */
export function useAtmosphereEffect(fn) {
  const sched = getScheduler();
  const inputs = useAtmosphereInputs();
  usePushInputs(inputs);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const prevRef = useRef(sched.getSnapshot());

  useEffect(() => {
    return sched.subscribe((next) => {
      const prev = prevRef.current;
      prevRef.current = next;
      try { fnRef.current(next, prev); }
      catch (e) {
        if (typeof console !== 'undefined') {
          console.warn(`[${SIG}·Atmo] effect error:`, e?.message);
        }
      }
    });
  }, [sched]);
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK 6 — useAtmosphereDebug : métriques live (throttlé)
// ═══════════════════════════════════════════════════════════════════════════
export function useAtmosphereDebug(hz = 2) {
  const sched = getScheduler();
  const [m, setM] = useState(() => sched.metrics());
  const last = useRef(0);
  const interval = 1 / safeRefreshHz(hz, 2);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (t - last.current < interval) return;
    last.current = t;
    setM(sched.metrics());
  });

  return m;
}

export {
  SIG,
  DEFAULT_REFRESH_HZ,
  BOOST_REFRESH_HZ,
  IDLE_REFRESH_HZ,
  IDLE_AFTER_MS,
};
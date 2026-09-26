/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/WORLDSYSTEM.JS  (v3.0 ultra)
 * Système atmosphérique de TroxtWorld (Portneuf)
 * ═══════════════════════════════════════════════════════════════════
 * v3.0 — Cache memoized, tick temps, lune, subscribe local, save/load
 *
 * NOUVEAUTÉS v3.0 :
 *   • Cache      : getAtmosphereParams() memoizé (compute seulement si input change)
 *   • Tick temps : tick(dt) avance l'heure, addHours(), setTime()
 *   • Lune       : getMoonPhase() (0..1) + moonElevation pour Phase RP
 *   • Subscribe  : worldSystem.subscribe(fn) local (indépendant du store)
 *   • Save/Load  : toJSON() / fromJSON() / fromSnapshot()
 *   • Fix        : bindStore filtre (n'écoute QUE timeOfDay/season/weather/dayCount)
 *   • Sécurité   : hasOwnProperty sur WEATHER_MODS/SEASON_MODS
 *   • Discontinuité azimuth à minuit supprimée
 *   • PHASES/MODS/SEASON_MODS frozen
 *   • getStats() pour debug
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/world/WorldSystem.js
 */

const SIG = 'TROXT⬡';

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────
const lerp   = (a, b, t) => a + (b - a) * t;
const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (t) => t * t * (3 - 2 * t);

function lerpColor(c1, c2, t) {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r  = Math.round(lerp(r1, r2, t));
  const g  = Math.round(lerp(g1, g2, t));
  const b  = Math.round(lerp(b1, b2, t));
  return (r << 16) | (g << 8) | b;
}

function hasOwn(obj, k) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, k);
}

// ─── PALETTES PAR PHASE DU JOUR ──────────────────────────────────────────────
const PHASES = Object.freeze([
  Object.freeze({ h:0,    name:'nuit',       fogColor:0x0a0e1a, sunColor:0x2a3a6a, sunI:0.05, ambColor:0x1a2540, ambI:0.30, skyTop:0x05080f, skyBot:0x10182a }),
  Object.freeze({ h:5.5,  name:'aube',       fogColor:0x4a3a4a, sunColor:0xff8a5a, sunI:0.35, ambColor:0x6a5a7a, ambI:0.55, skyTop:0x2a3560, skyBot:0xd88a6a }),
  Object.freeze({ h:7,    name:'lever',      fogColor:0xd0a080, sunColor:0xffb070, sunI:0.85, ambColor:0xc0a890, ambI:0.80, skyTop:0x6a90d0, skyBot:0xf0b080 }),
  Object.freeze({ h:10,   name:'matin',      fogColor:0xaac0d0, sunColor:0xfff4e0, sunI:1.35, ambColor:0xd8e4f0, ambI:1.00, skyTop:0x5a88d8, skyBot:0xc8dcf0 }),
  Object.freeze({ h:13,   name:'midi',       fogColor:0xc0d4e0, sunColor:0xfffdf5, sunI:1.60, ambColor:0xe8f0ff, ambI:1.10, skyTop:0x4a80e0, skyBot:0xd0e4f8 }),
  Object.freeze({ h:17,   name:'apresmidi',  fogColor:0xb8c4c8, sunColor:0xfff0d8, sunI:1.30, ambColor:0xdce4ec, ambI:0.95, skyTop:0x5a86d0, skyBot:0xd8dcdc }),
  Object.freeze({ h:19.5, name:'crepuscule', fogColor:0xc07850, sunColor:0xff7040, sunI:0.55, ambColor:0x9a7a70, ambI:0.65, skyTop:0x3a4a80, skyBot:0xe08850 }),
  Object.freeze({ h:21,   name:'soir',       fogColor:0x3a3a5a, sunColor:0x6a5a9a, sunI:0.20, ambColor:0x40486a, ambI:0.45, skyTop:0x152040, skyBot:0x40365a }),
  Object.freeze({ h:24,   name:'nuit',       fogColor:0x0a0e1a, sunColor:0x2a3a6a, sunI:0.05, ambColor:0x1a2540, ambI:0.30, skyTop:0x05080f, skyBot:0x10182a }),
]);

// ─── MODIFICATEURS MÉTÉO ─────────────────────────────────────────────────────
const WEATHER_MODS = Object.freeze({
  sunny:   Object.freeze({ fogFar:1.00, sunMul:1.00, ambMul:1.00, fogTint:0xffffff, tintAmt:0.00 }),
  cloudy:  Object.freeze({ fogFar:0.75, sunMul:0.70, ambMul:0.90, fogTint:0x9aa4b0, tintAmt:0.30 }),
  rainy:   Object.freeze({ fogFar:0.50, sunMul:0.45, ambMul:0.75, fogTint:0x6a7480, tintAmt:0.50 }),
  stormy:  Object.freeze({ fogFar:0.35, sunMul:0.30, ambMul:0.60, fogTint:0x4a5058, tintAmt:0.65 }),
  foggy:   Object.freeze({ fogFar:0.25, sunMul:0.55, ambMul:0.85, fogTint:0xc0c8d0, tintAmt:0.60 }),
  snowy:   Object.freeze({ fogFar:0.45, sunMul:0.65, ambMul:1.05, fogTint:0xd8e0e8, tintAmt:0.50 }),
});

// ─── MODIFICATEURS SAISON ────────────────────────────────────────────────────
const SEASON_MODS = Object.freeze({
  spring: Object.freeze({ sunTint:0xf0fff0, tintAmt:0.08, dayStart:5.5, dayEnd:20.0 }),
  summer: Object.freeze({ sunTint:0xfffdf0, tintAmt:0.05, dayStart:4.5, dayEnd:21.0 }),
  fall:   Object.freeze({ sunTint:0xffe8c0, tintAmt:0.15, dayStart:6.5, dayEnd:19.0 }),
  winter: Object.freeze({ sunTint:0xe0ecff, tintAmt:0.18, dayStart:7.5, dayEnd:16.5 }),
});

const FOG_BASE_FAR   = 600;
const SUN_MAX_ELEV   = Object.freeze({ winter: 30, fall: 45, spring: 55, summer: 60 });
const MOON_PHASE_DAYS = 29.53;   // cycle lunaire réel

// ─── SYSTÈME ─────────────────────────────────────────────────────────────────
export class WorldSystem {
  constructor(opts = {}) {
    this.sig      = SIG;
    this.time     = this._normTime(opts.timeOfDay ?? 12);
    this.season   = hasOwn(SEASON_MODS,  opts.season)  ? opts.season  : 'summer';
    this.weather  = hasOwn(WEATHER_MODS, opts.weather) ? opts.weather : 'sunny';
    this.dayCount = Number.isFinite(opts.dayCount) ? opts.dayCount : 1;

    // ─── Cache ─────────────────────────────────────────────────────────
    this._cacheKey    = null;
    this._cacheParams = null;
    this._cacheSun    = null;

    // ─── Abonnés locaux ────────────────────────────────────────────────
    this._listeners   = new Set();

    // ─── Compteurs ─────────────────────────────────────────────────────
    this._stats = {
      updates: 0, computes: 0, cacheHits: 0, ticks: 0,
      subscribed: 0, secondsTotal: 0,
    };
  }

  // ─── UTILS INTERNES ────────────────────────────────────────────────────────
  _normTime(v) {
    const t = Number(v);
    if (!Number.isFinite(t)) return 12;
    return ((t % 24) + 24) % 24;
  }

  _invalidate() {
    this._cacheKey    = null;
    this._cacheParams = null;
    this._cacheSun    = null;
  }

  _key() {
    return `${this.time}|${this.season}|${this.weather}|${this.dayCount}`;
  }

  _emit() {
    if (this._listeners.size === 0) return;
    const payload = this.getAtmosphereParams();
    for (const fn of this._listeners) {
      try { fn(payload, this); }
      catch (e) {
        if (typeof console !== 'undefined') {
          console.warn(`[${SIG}] listener error:`, e?.message);
        }
      }
    }
  }

  // ─── MUTATIONS ─────────────────────────────────────────────────────────────
  /**
   * Mise à jour (silencieuse par défaut — pas d'emit à chaque appel).
   * @param {{timeOfDay?:number, season?:string, weather?:string, dayCount?:number, emit?:boolean}} params
   */
  set(params = {}) {
    let changed = false;

    if (params.timeOfDay !== undefined) {
      const t = this._normTime(params.timeOfDay);
      if (t !== this.time) { this.time = t; changed = true; }
    }
    if (params.season !== undefined && hasOwn(SEASON_MODS, params.season) && params.season !== this.season) {
      this.season = params.season; changed = true;
    }
    if (params.weather !== undefined && hasOwn(WEATHER_MODS, params.weather) && params.weather !== this.weather) {
      this.weather = params.weather; changed = true;
    }
    if (params.dayCount !== undefined && Number.isFinite(params.dayCount) && params.dayCount !== this.dayCount) {
      this.dayCount = params.dayCount; changed = true;
    }

    if (changed) {
      this._invalidate();
      this._stats.updates++;
      if (params.emit !== false) this._emit();
    }
    return this;
  }

  /** Avance le temps en heures. */
  addHours(h = 0) {
    if (!Number.isFinite(h) || h === 0) return this;
    const before = this.time;
    const next   = this.time + h;
    this.time    = this._normTime(next);
    // Détecte le passage de minuit → +1 jour
    if (next >= 24) this.dayCount += Math.floor(next / 24);
    else if (next < 0) this.dayCount += Math.ceil(next / 24) - 1;
    if (this.time !== before || h !== 0) { this._invalidate(); this._stats.updates++; this._emit(); }
    return this;
  }

  /** Fixe l'heure absolue. */
  setTime(h) {
    const t = this._normTime(h);
    if (t === this.time) return this;
    this.time = t;
    this._invalidate();
    this._stats.updates++;
    this._emit();
    return this;
  }

  setSeason(season)   { return this.set({ season }); }
  setWeather(weather) { return this.set({ weather }); }
  setDay(n)           { return this.set({ dayCount: n }); }

  /**
   * Avance le temps selon dt (secondes réelles) et un ratio temps-jeu.
   * @param {number} dtSec      delta réel
   * @param {number} [hoursPerRealSec=1/60]   1h de jeu par minute réelle
   */
  tick(dtSec, hoursPerRealSec = 1 / 60) {
    if (!Number.isFinite(dtSec) || dtSec <= 0) return this;
    this._stats.ticks++;
    this._stats.secondsTotal += dtSec;

    const h = dtSec * hoursPerRealSec;
    const before = this.time;

    const next = this.time + h;
    this.time = this._normTime(next);

    if (next >= 24) {
      const days = Math.floor(next / 24);
      this.dayCount += days;
    }

    if (this.time !== before) {
      this._invalidate();
      if (this._listeners.size > 0) this._emit();
    }
    return this;
  }

  // ─── STORE BINDING ─────────────────────────────────────────────────────────
  /**
   * Se lier au store Zustand. Filtre pour ne recalculer QUE si
   * timeOfDay/season/weather/dayCount changent (pas à chaque update de position).
   * @param {object} useGameState  store Zustand brut (create(...))
   * @returns {() => void} unsubscribe
   */
  bindStore(useGameState) {
    if (!useGameState || typeof useGameState.subscribe !== 'function'
        || typeof useGameState.getState !== 'function') {
      console.warn(`[${SIG}] bindStore: useGameState invalide (attendu: store Zustand)`);
      return () => {};
    }

    const apply = (s = {}, prev = {}) => {
      // Filtre — skip si rien de pertinent n'a changé
      if (s.timeOfDay === prev.timeOfDay &&
          s.season    === prev.season    &&
          s.weather   === prev.weather   &&
          s.dayCount  === prev.dayCount) return;

      this.set({
        timeOfDay: s.timeOfDay,
        season:    s.season,
        weather:   s.weather,
        dayCount:  s.dayCount,
      });
    };

    apply(useGameState.getState(), {});
    const unsub = useGameState.subscribe(apply);
    this._stats.subscribed++;
    return unsub;
  }

  // ─── ABONNEMENT LOCAL ──────────────────────────────────────────────────────
  /**
   * S'abonner aux changements d'atmosphère (indépendant du store).
   * @param {(params:object, system:WorldSystem)=>void} fn
   * @returns {() => void} unsubscribe
   */
  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  // ─── LECTURES ──────────────────────────────────────────────────────────────
  isDay() {
    const s = SEASON_MODS[this.season] || SEASON_MODS.summer;
    return this.time >= s.dayStart && this.time <= s.dayEnd;
  }
  isNight() { return !this.isDay(); }

  _phaseBlend() {
    const t = this.time;
    for (let i = 0; i < PHASES.length - 1; i++) {
      if (t >= PHASES[i].h && t < PHASES[i + 1].h) {
        const span = PHASES[i + 1].h - PHASES[i].h;
        const f    = span > 0 ? smooth((t - PHASES[i].h) / span) : 0;
        return { a: PHASES[i], b: PHASES[i + 1], f };
      }
    }
    return { a: PHASES[0], b: PHASES[0], f: 0 };
  }

  /**
   * Position du soleil (azimuth/elevation en degrés).
   * Continuité garantie à minuit (pas de jump 80→280).
   */
  getSunPosition() {
    const key = this._key();
    if (this._cacheSun && this._cacheKey === key) return this._cacheSun;

    const s       = SEASON_MODS[this.season] || SEASON_MODS.summer;
    const dayLen  = s.dayEnd - s.dayStart;
    const maxElev = SUN_MAX_ELEV[this.season] ?? SUN_MAX_ELEV.summer;

    let result;
    if (this.time >= s.dayStart && this.time <= s.dayEnd) {
      const dayProg = (this.time - s.dayStart) / dayLen;
      result = {
        elevation: Math.sin(dayProg * Math.PI) * maxElev,
        azimuth:   lerp(90, 270, dayProg),
      };
    } else {
      // Nuit — interpolation continue de l'azimuth
      const isAfterDusk = this.time > s.dayEnd;
      const nightLen    = isAfterDusk ? (24 - s.dayEnd + s.dayStart) : (s.dayStart - s.dayEnd + 24);
      const nightProg   = isAfterDusk
        ? (this.time - s.dayEnd) / nightLen
        : (this.time + 24 - s.dayEnd) / nightLen;

      // Traverse la nuit : 270 → 360(=0) → 90, donc 270→450
      const azimuth   = lerp(270, 450, nightProg) % 360;
      const nearEdge  = Math.min(nightProg, 1 - nightProg);   // 0 = bord, 0.5 = milieu
      const elevation = lerp(0, -20, smooth(nearEdge * 2));

      result = { elevation, azimuth };
    }

    this._cacheSun = result;
    return result;
  }

  /**
   * Phase lunaire 0..1 (0 = nouvelle lune, 0.5 = pleine lune).
   * Basée sur dayCount — cycle réaliste de 29.53 jours.
   */
  getMoonPhase() {
    const d = this.dayCount % MOON_PHASE_DAYS;
    return d / MOON_PHASE_DAYS;
  }

  /** Élévation lunaire (calquée sur le soleil, inversée). */
  getMoonElevation() {
    const { elevation } = this.getSunPosition();
    return -elevation;
  }

  /**
   * Paramètres atmosphériques consommés par `<WorldLighting />`.
   * MEMOIZÉ — recompute uniquement si (time|season|weather|dayCount) change.
   */
  getAtmosphereParams() {
    const key = this._key();
    if (this._cacheParams && this._cacheKey === key) {
      this._stats.cacheHits++;
      return this._cacheParams;
    }

    this._stats.computes++;

    const { a, b, f } = this._phaseBlend();
    const wm = WEATHER_MODS[this.weather] || WEATHER_MODS.sunny;
    const sm = SEASON_MODS[this.season]   || SEASON_MODS.summer;
    const { azimuth, elevation } = this.getSunPosition();

    let fogColor = lerpColor(a.fogColor, b.fogColor, f);
    let sunColor = lerpColor(a.sunColor, b.sunColor, f);
    let ambColor = lerpColor(a.ambColor, b.ambColor, f);
    const skyTop = lerpColor(a.skyTop, b.skyTop, f);
    const skyBot = lerpColor(a.skyBot, b.skyBot, f);

    if (wm.tintAmt > 0) fogColor = lerpColor(fogColor, wm.fogTint, wm.tintAmt);
    if (sm.tintAmt > 0) sunColor = lerpColor(sunColor, sm.sunTint, sm.tintAmt);

    const sunI = lerp(a.sunI, b.sunI, f) * wm.sunMul;
    const ambI = lerp(a.ambI, b.ambI, f) * wm.ambMul;

    const fogFar  = FOG_BASE_FAR * wm.fogFar;
    const fogNear = fogFar * 0.05;

    const night = this.isNight();
    const weatherAllowsStars = this.weather !== 'stormy'
                            && this.weather !== 'foggy'
                            && this.weather !== 'rainy';

    const params = {
      fogColor,
      fogNear,
      fogFar,
      sunIntensity:     clamp(sunI, 0, 2),
      sunColor,
      ambientIntensity: clamp(ambI, 0.15, 1.3),
      ambientColor:     ambColor,
      skyTintTop:       skyTop,
      skyTintBottom:    skyBot,
      starsVisible:     night && weatherAllowsStars,
      moonVisible:      night,
      sunAzimuth:       azimuth,
      sunElevation:     elevation,
      moonElevation:    -elevation,
      moonPhase:        this.getMoonPhase(),
      phaseName:        a.name,
      isDay:            !night,
      dayProgress:      this.time / 24,
    };

    this._cacheKey    = key;
    this._cacheParams = params;
    return params;
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────
  getWeatherParticleType() {
    if (this.weather === 'rainy')  return 'rain';
    if (this.weather === 'stormy') return 'storm';
    if (this.weather === 'snowy')  return 'snow';
    return 'none';
  }

  isLightningActive() { return this.weather === 'stormy'; }

  getTimeLabel() {
    const h = Math.floor(this.time);
    const m = Math.floor((this.time - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Nom de la phase dominante (celle avec f < 0.5 sinon l'autre). */
  getPhaseName() {
    const { a, b, f } = this._phaseBlend();
    return f < 0.5 ? a.name : b.name;
  }

  /** Snapshot complet pour UI / save. */
  getState() {
    return {
      time:        this.getTimeLabel(),
      timeDecimal: +this.time.toFixed(4),
      phase:       this.getPhaseName(),
      season:      this.season,
      weather:     this.weather,
      day:         this.dayCount,
      isDay:       this.isDay(),
      moonPhase:   +this.getMoonPhase().toFixed(3),
      sig:         SIG,
    };
  }

  // ─── SÉRIALISATION ─────────────────────────────────────────────────────────
  toJSON() {
    return {
      time:     this.time,
      season:   this.season,
      weather:  this.weather,
      dayCount: this.dayCount,
      sig:      SIG,
    };
  }

  fromJSON(data) {
    if (!data || typeof data !== 'object') return this;
    this.set({
      timeOfDay: data.time,
      season:    data.season,
      weather:   data.weather,
      dayCount:  data.dayCount,
    });
    return this;
  }

  // ─── DEBUG / MÉTRIQUES ─────────────────────────────────────────────────────
  getStats() {
    const total = this._stats.computes + this._stats.cacheHits;
    const hitRate = total > 0 ? (this._stats.cacheHits / total) : 0;
    return {
      ...this._stats,
      cacheHitRate: +hitRate.toFixed(3),
      listeners:    this._listeners.size,
      sig:          SIG,
    };
  }

  resetStats() {
    this._stats = { updates: 0, computes: 0, cacheHits: 0, ticks: 0,
                    subscribed: 0, secondsTotal: 0 };
    return this;
  }

  /** Vide le cache (utile si WorldLighting manipule PHASES directement — rare). */
  invalidate() { this._invalidate(); return this; }

  dispose() {
    this._listeners.clear();
    this._invalidate();
  }
}

// Singleton pratique
export const worldSystem = new WorldSystem();

export {
  SIG,
  PHASES,
  WEATHER_MODS,
  SEASON_MODS,
  FOG_BASE_FAR,
};
export default WorldSystem;
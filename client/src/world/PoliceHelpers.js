/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/POLICEHELPERS.JS  (v2.0 boosted)
 * Système de recherche (wanted) & police — pont vers TROXT⬡ + Intellectus
 * ═══════════════════════════════════════════════════════════════════
 * Fournit ce que Farms.js importe : addWantedPoints(playerId, points, reason)
 * Connecté au serveur RP : émet les alertes police et synchronise le wanted.
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/world/PoliceHelpers.js
 *
 * API publique :
 *   addWantedPoints(pid, pts, reason, opts)   ← inchangé (compat Farms.js)
 *   adjustWanted(pid, delta, reason, opts)    ← ajout/réduction relative
 *   setWanted(pid, points, reason)            ← set admin absolu
 *   clearWanted(pid, reason)                  ← nettoyage complet (history inclus)
 *   getWanted(pid)                            ← { stars, points, lastCrime }
 *   getHistory(pid, limit)                    ← journal RP
 *   isWanted(pid, minStars)                   ← test rapide
 *   arrestPlayer(pid, officer, opts)          ← incarcération (bail, silent)
 *   tickWanted(dtSec)                         ← décroissance par tick
 *   getAllWanted()                            ← liste (HUD/diag)
 *   resetAll({ silent, reason })              ← reset global tracé
 *   connectPolice({ emit, onChange, onArrest, storage })
 *   getStats()                                ← compteurs runtime
 *   CFG (frozen)                              ← config immuable
 * ═══════════════════════════════════════════════════════════════════
 */

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

// ─── CONFIG (immuable) ───────────────────────────────────────────────────────
const CFG = Object.freeze({
  maxWanted:        5,
  pointsPerStar:    20,        // 20 points = 1 étoile
  decayPerMin:      4,         // points perdus par minute sans crime
  copResponseSec:   30,
  jailBaseSec:      60,        // prison de base par étoile
  jailPerResidual:  15,        // + prison pour chaque point résiduel
  decayGraceMs:     60_000,    // délai avant décroissance
  minPoints:        0.05,      // seuil de suppression
  maxPointsPerCall: 60,        // anti « god crime » (3⭐ max par appel)
  alertCooldownMs:  15_000,    // anti-spam alerte police par palier
  bailCostPerStar:  250,       // $ par étoile pour libération
});

// ─── ÉTAT ────────────────────────────────────────────────────────────────────
const _wanted = new Map();   // pid → { points, stars, lastCrime, silent, history, lastAlertAt }

let _emit      = null;       // (event, data) → serveur/Lua
let _onChange  = null;       // (pid, { stars, points, delta }) → HUD
let _onArrest  = null;       // (pid, { officer, jailSec, stars, bail }) → HUD/cinéma
let _storage   = null;       // { load(): Map|null, save(map): void } — optionnel

// Stats runtime (diag admin)
const _stats = {
  totalAdded: 0, totalCleared: 0, totalArrests: 0,
  totalDecayed: 0, alertsSent: 0, peakConcurrent: 0,
};

// ─── PONT ────────────────────────────────────────────────────────────────────
/**
 * Branche le système sur ton serveur RP / bridge Lua.
 * @param {Object} opts
 * @param {(event:string, data:object)=>void} [opts.emit]
 * @param {(pid:string, state:object)=>void} [opts.onChange]
 * @param {(pid:string, info:object)=>void}  [opts.onArrest]
 * @param {{load:Function, save:Function}}   [opts.storage] persistance optionnelle
 */
export function connectPolice({ emit, onChange, onArrest, storage } = {}) {
  _emit     = typeof emit     === 'function' ? emit     : null;
  _onChange = typeof onChange === 'function' ? onChange : null;
  _onArrest = typeof onArrest === 'function' ? onArrest : null;
  _storage  = storage && typeof storage.load === 'function' &&
                        typeof storage.save === 'function' ? storage : null;

  // Restaure l'état persisté s'il existe
  if (_storage) {
    try {
      const saved = _storage.load();
      if (saved instanceof Map) {
        for (const [pid, w] of saved) _wanted.set(pid, _sanitizeEntry(w));
        _stats.peakConcurrent = _wanted.size;
      }
    } catch (e) {
      console.warn(`[${SIG}·Police] Storage load failed:`, e?.message);
    }
  }

  console.log(`[${SIG}·Police] Système connecté · ${_wanted.size} entrées restaurées`);
}

// ─── INTERNES ────────────────────────────────────────────────────────────────
function _newEntry() {
  return { points: 0, stars: 0, lastCrime: 0, silent: false,
           history: [], lastAlertAt: 0 };
}

function _sanitizeEntry(w) {
  const e = _newEntry();
  if (!w || typeof w !== 'object') return e;
  e.points      = Number.isFinite(w.points)  ? Math.max(0, w.points) : 0;
  e.stars       = Number.isFinite(w.stars)   ? Math.max(0, Math.min(CFG.maxWanted, w.stars)) : 0;
  e.lastCrime   = Number.isFinite(w.lastCrime) ? w.lastCrime : 0;
  e.silent      = !!w.silent;
  e.history     = Array.isArray(w.history) ? w.history.slice(0, 20) : [];
  e.lastAlertAt = Number.isFinite(w.lastAlertAt) ? w.lastAlertAt : 0;
  return e;
}

function _persist() {
  if (!_storage) return;
  try { _storage.save(_wanted); }
  catch (e) { console.warn(`[${SIG}·Police] Storage save failed:`, e?.message); }
}

function _recomputeStars(w) {
  const old = w.stars;
  w.stars = Math.min(CFG.maxWanted, Math.floor(w.points / CFG.pointsPerStar));
  return old;
}

// ─── AJOUT DE POINTS DE RECHERCHE ────────────────────────────────────────────
/**
 * Ajoute des points de recherche. Compat Farms.js : (pid, points, reason).
 * @param {string} playerId
 * @param {number} points         Valeur positive (clampée à maxPointsPerCall). Négative = réduction.
 * @param {string} [reason]
 * @param {{silent?:boolean, source?:string}} [opts]
 * @returns {object|null} état wanted mis à jour
 */
export function addWantedPoints(playerId, points, reason = 'Crime', opts = {}) {
  if (!playerId) return null;
  if (typeof points !== 'number' || !Number.isFinite(points)) return null;

  // Anti « god crime » : bornes dures
  const clamped = Math.max(-CFG.maxPointsPerCall, Math.min(CFG.maxPointsPerCall, points));
  if (clamped === 0) return _wanted.get(playerId) || null;

  let w = _wanted.get(playerId);
  if (!w) { w = _newEntry(); _wanted.set(playerId, w); }

  const before = w.points;
  // ✅ FIX #1 : clamp bas à 0
  w.points = Math.max(0, Math.min(CFG.maxWanted * CFG.pointsPerStar, before + clamped));
  w.lastCrime = Date.now();
  if (opts.silent) w.silent = true;

  const oldStars = _recomputeStars(w);
  const delta    = w.points - before;

  // Journal RP (max 20 entrées)
  w.history.unshift({
    points: clamped, reason, at: Date.now(), stars: w.stars,
    delta, source: opts.source || 'runtime',
  });
  if (w.history.length > 20) w.history.pop();

  _stats.totalAdded += Math.max(0, clamped);
  if (_wanted.size > _stats.peakConcurrent) _stats.peakConcurrent = _wanted.size;

  console.log(`[${SIG}·Police] ${playerId} ${clamped >= 0 ? '+' : ''}${clamped}pts ` +
              `(${reason}) → ${w.stars}⭐ [${w.points.toFixed(1)}]`);

  // Émission principale
  _emit?.('troxtworld:wanted_add', {
    player_id: playerId, points: clamped, reason,
    stars: w.stars, old_stars: oldStars, total: w.points,
    silent: w.silent, sig: SIG,
  });

  // ✅ FIX #3 : alerte police avec cooldown par palier
  const now = Date.now();
  const canAlert = w.stars > oldStars
                && w.stars >= 2
                && !w.silent
                && (now - w.lastAlertAt) >= CFG.alertCooldownMs;
  if (canAlert) {
    w.lastAlertAt = now;
    _stats.alertsSent++;
    _emit?.('troxtworld:police_alert', {
      player_id: playerId, wanted: w.stars, old_wanted: oldStars,
      crime: reason,
      response_in: Math.max(10, CFG.copResponseSec - w.stars * 4),
      priority: w.stars >= 4 ? 'code_3_critique'
              : w.stars >= 3 ? 'code_2_urgent'
              :                'code_1_normal',
      sig: SIG,
    });
  }

  // Escalade Intellectus au niveau max
  if (w.stars >= CFG.maxWanted && oldStars < CFG.maxWanted) {
    _emit?.('intellectus:rp_security_event', {
      type: 'max_wanted', player_id: playerId, reason,
      total: w.points, sig: ISIG,
    });
  }

  _onChange?.(playerId, { stars: w.stars, points: w.points, delta, silent: w.silent });
  _persist();
  return w;
}

/** Réduction relative — ex: récompense, amende purgée, collaboration. */
export function adjustWanted(playerId, delta, reason = 'adjust', opts = {}) {
  if (!Number.isFinite(delta)) return null;
  return addWantedPoints(playerId, -Math.abs(delta), reason, opts);
}

/** Set absolu (admin / event scripté). */
export function setWanted(playerId, points, reason = 'admin_set') {
  if (!playerId || !Number.isFinite(points)) return null;
  let w = _wanted.get(playerId);
  if (!w) { w = _newEntry(); _wanted.set(playerId, w); }
  const target = Math.max(0, Math.min(CFG.maxWanted * CFG.pointsPerStar, points));
  const diff   = target - w.points;
  return addWantedPoints(playerId, diff, reason, { source: 'admin' });
}

// ─── RETRAIT / RESET ─────────────────────────────────────────────────────────
/**
 * Nettoyage complet d'un joueur.
 * ✅ FIX #2 : history + lastCrime + silent remis à zéro.
 */
export function clearWanted(playerId, reason = 'clear') {
  const w = _wanted.get(playerId);
  if (!w) return false;

  const oldStars = w.stars;
  w.points = 0; w.stars = 0; w.lastCrime = 0; w.silent = false;
  w.history.length = 0; w.lastAlertAt = 0;
  _wanted.delete(playerId);

  _stats.totalCleared++;
  _emit?.('troxtworld:wanted_clear', {
    player_id: playerId, reason, old_stars: oldStars, sig: SIG,
  });
  _onChange?.(playerId, { stars: 0, points: 0, delta: -oldStars * CFG.pointsPerStar });
  _persist();
  return true;
}

export function getWanted(playerId) {
  const w = _wanted.get(playerId);
  return w
    ? { stars: w.stars, points: w.points, lastCrime: w.lastCrime,
        silent: w.silent, entries: w.history.length }
    : { stars: 0, points: 0, lastCrime: 0, silent: false, entries: 0 };
}

export function getHistory(playerId, limit = 10) {
  const w = _wanted.get(playerId);
  if (!w) return [];
  return w.history.slice(0, Math.max(0, limit));
}

export function isWanted(playerId, minStars = 1) {
  const w = _wanted.get(playerId);
  return !!w && w.stars >= minStars;
}

// ─── ARRESTATION ─────────────────────────────────────────────────────────────
/**
 * Incarcère un joueur.
 * ✅ FIX #6 : la prison inclut les points résiduels.
 * @param {string} playerId
 * @param {string} officerId
 * @param {{sentenceMult?:number, bail?:boolean, silent?:boolean}} [opts]
 */
export function arrestPlayer(playerId, officerId, opts = {}) {
  const w        = _wanted.get(playerId);
  const stars    = w?.stars || 0;
  const residual = w?.points ? (w.points % CFG.pointsPerStar) : 0;
  const mult     = Number.isFinite(opts.sentenceMult) ? Math.max(0.1, opts.sentenceMult) : 1;

  const jailSec = Math.round(
    (CFG.jailBaseSec * Math.max(1, stars) + CFG.jailPerResidual * residual) * mult
  );
  const bail = opts.bail !== false ? stars * CFG.bailCostPerStar : 0;

  clearWanted(playerId, 'arrested');
  _stats.totalArrests++;

  const info = { player_id: playerId, officer: officerId,
                 jail_sec: jailSec, stars, residual: +residual.toFixed(2),
                 bail, silent: !!opts.silent, sig: SIG };

  _emit?.('troxtworld:player_arrested', info);
  _onArrest?.(playerId, info);
  console.log(`[${SIG}·Police] ${playerId} arrêté par ${officerId} — ` +
              `${jailSec}s (${stars}⭐ + ${residual.toFixed(1)}pts)`);
  return { jailSec, stars, bail, residual };
}

// ─── DÉCROISSANCE ────────────────────────────────────────────────────────────
/** À appeler dans la boucle de jeu — retourne le nombre de criminels décroissants. */
export function tickWanted(dtSec) {
  if (typeof dtSec !== 'number' || !Number.isFinite(dtSec) || dtSec <= 0) return 0;

  const now = Date.now();
  let decayed = 0;

  for (const [pid, w] of [..._wanted]) {
    if (w.points <= 0) { _wanted.delete(pid); continue; }
    if (now - w.lastCrime < CFG.decayGraceMs) continue;

    const dec = CFG.decayPerMin * (dtSec / 60);
    w.points = Math.max(0, w.points - dec);
    decayed++;
    _stats.totalDecayed += dec;

    const oldStars = w.stars;
    _recomputeStars(w);
    if (w.stars !== oldStars) {
      _onChange?.(pid, { stars: w.stars, points: w.points,
                         delta: -(oldStars - w.stars) * CFG.pointsPerStar });
      _emit?.('troxtworld:wanted_decay', {
        player_id: pid, stars: w.stars, old_stars: oldStars,
        points: w.points, sig: SIG,
      });
    }

    // ✅ FIX (ton commentaire) : seuil strict < minPoints
    if (w.points < CFG.minPoints) {
      _wanted.delete(pid);
      _emit?.('troxtworld:wanted_expired', { player_id: pid, sig: SIG });
    }
  }

  if (decayed) _persist();
  return decayed;
}

// ─── API PUBLIQUE ────────────────────────────────────────────────────────────
export function getAllWanted() {
  return [..._wanted.entries()].map(([id, w]) => ({
    id, stars: w.stars, points: w.points,
    silent: w.silent, entries: w.history.length,
  }));
}

/**
 * Reset global.
 * ✅ FIX #5 : émet un event tracé + notifie le HUD.
 */
export function resetAll({ silent = false, reason = 'reset_all' } = {}) {
  const count = _wanted.size;
  _wanted.clear();
  if (!silent) {
    _emit?.('troxtworld:wanted_reset_all', { count, reason, sig: SIG });
  }
  _persist();
  return count;
}

export function getStats() {
  return { ..._stats, active: _wanted.size, config: CFG };
}

export { SIG, ISIG, CFG };
export default {
  addWantedPoints,
  adjustWanted,
  setWanted,
  clearWanted,
  getWanted,
  getHistory,
  isWanted,
  arrestPlayer,
  tickWanted,
  connectPolice,
  getAllWanted,
  resetAll,
  getStats,
};

/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/TROXT-VILLAGES-CONNECTOR.JS  (v2.0 boosted)
 * Monte les 18 villages de Portneuf + monuments et les connecte à TROXT⬡
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/src/world/troxt-villages-connector.js
 *
 * import { TroxtVillages } from './troxt-villages-connector.js';
 * const villages = new TroxtVillages({ scene, client });
 * villages.mountAll();
 * villages.tick(elapsed, delta);                       // boucle
 * villages.updatePlayer(playerId, x, z);               // par joueur
 */

import * as THREE from 'three';

import {
  VILLAGE_PROFILES,
  getProfile,
  buildLandmark,
  animateLandmarks,
} from './VillageProfiles.js';

import { getTerrainHeight } from './WorldData.js';

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

const LOG_ICONS = { OK:'✓', WARN:'⚠', ERROR:'✖', VILLAGE:'🏘️', INFO:'ℹ' };
const log = (lvl, msg) => {
  const i = LOG_ICONS[lvl] || '·';
  console.log(`[${new Date().toISOString().slice(11,19)}] ${i} [${SIG}·Villages] ${msg}`);
};

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CFG = Object.freeze({
  minRadius:         50,
  maxRadius:         220,
  radiusBase:        60,
  radiusPerDensity:  120,
  enterCooldownMs:   1500,    // anti-spam à la frontière
  bridgeTimeoutMs:   1500,
  bridgeMaxRetries:  3,
  bridgeBackoffMs:   500,
  bridgeQueueMax:    64,
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function isObject3D(v) {
  return v && typeof v === 'object' && Array.isArray(v.children);
}
function asArray(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') return Object.values(x);
  return [];
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function centerOf(profile) {
  if (!profile) return { x: 0, z: 0 };
  const c = profile.center;
  if (Array.isArray(c)) return { x: c[0] ?? 0, z: c[1] ?? 0 };
  return { x: c?.x ?? 0, z: c?.z ?? 0 };
}

/** Direction cardinale (approximative) vers un point. */
function cardinalTo(dx, dz) {
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return 'I';
  const angle = Math.atan2(dz, dx) * 180 / Math.PI;   // -180..180
  if (angle >= -45 && angle < 45)   return 'E';
  if (angle >= 45  && angle < 135)  return 'S';
  if (angle >= -135 && angle < -45) return 'N';
  return 'O';
}

/** Dispose récursif propre (geometry + material + children). */
function disposeObject3D(root) {
  root.traverse((obj) => {
    if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        // dispose textures attachées
        for (const k of Object.keys(m)) {
          const tex = m[k];
          if (tex && tex.isTexture && typeof tex.dispose === 'function') tex.dispose();
        }
        if (typeof m.dispose === 'function') m.dispose();
      }
    }
  });
}

// ─── CLASSE PRINCIPALE ───────────────────────────────────────────────────────
export class TroxtVillages {
  constructor({ scene, client = null, emit = null, heightAt = null } = {}) {
    if (!scene) throw new Error('scene requise');

    this.scene  = scene;
    this.client = client;
    this.sig    = SIG;

    this.heightAt = (typeof heightAt === 'function') ? heightAt : getTerrainHeight;

    this.root = new THREE.Group();
    this.root.name = 'troxt-villages';
    this.scene.add(this.root);

    this._landmarkRoot = new THREE.Group();
    this._landmarkRoot.name = 'landmarks';
    this.root.add(this._landmarkRoot);

    // ✅ fix #1 : per-player tracking
    this._playerState = new Map();   // pid → { village, lastEnterAt, enteredAt }

    // ✅ fix #5 : garder trace des landmarks montés
    this._mountedLandmarks = [];

    // ✅ fix #7 : cache mapMarks
    this._mapMarksCache = null;

    // ✅ fix #6 : saison courante pour skip si inchangée
    this._currentSeason = null;

    this._mounted = false;
    this._stats = {
      villages: 0, landmarks: 0,
      enters: 0, leaves: 0, transitions: 0,
      bridgeSent: 0, bridgeFailed: 0, bridgeQueued: 0,
    };

    // Bridge setup
    this._queue = [];
    this._flushTimer = null;
    this._bridgeOnline = true;

    if (typeof emit === 'function') {
      this._emit = emit;
    } else if (client && typeof client.rp_action === 'function') {
      this._emit = (e, d) => client.rp_action(e, d);
    } else {
      this._emit = (e, d) => this._enqueue(e, d);
    }
  }

  // ─── BRIDGE (queue + retry + backoff) ─────────────────────────────────────
  _enqueue(event, data) {
    if (this._queue.length >= CFG.bridgeQueueMax) {
      this._queue.shift();
      this._stats.bridgeFailed++;
    }
    this._queue.push({ event, data, attempts: 0, ts: Date.now() });
    this._stats.bridgeQueued = this._queue.length;
    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._flush();
    }, 100);
  }

  async _flush() {
    if (!this._bridgeOnline || this._queue.length === 0) return;

    while (this._queue.length > 0) {
      const item = this._queue[0];
      const ok = await this._send(item);
      if (ok) {
        this._queue.shift();
        this._stats.bridgeSent++;
      } else {
        item.attempts++;
        if (item.attempts >= CFG.bridgeMaxRetries) {
          this._queue.shift();
          this._stats.bridgeFailed++;
          log('WARN', `bridge drop après ${item.attempts} essais: ${item.event}`);
        } else {
          this._bridgeOnline = false;
          setTimeout(() => { this._bridgeOnline = true; this._scheduleFlush(); },
                     CFG.bridgeBackoffMs * item.attempts);
          return;
        }
      }
    }
    this._stats.bridgeQueued = 0;
  }

  async _send(item) {
    try {
      await fetch('http://localhost:4200/lua/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: item.event, data: { ...item.data, sig: SIG } }),
        signal: AbortSignal.timeout(CFG.bridgeTimeoutMs),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── MONTAGE ──────────────────────────────────────────────────────────────
  mountAll(opts = {}) {
    if (this._mounted) return this;

    const season   = opts.season || 'summer';
    const profiles = asArray(VILLAGE_PROFILES);

    if (profiles.length === 0) {
      log('WARN', 'VILLAGE_PROFILES vide ou invalide — rien à monter');
      return this;
    }

    this._currentSeason = season;
    log('VILLAGE', `Montage des ${profiles.length} villages de Portneuf...`);

    for (const v of profiles) {
      try {
        this._mountVillageLandmarks(v, season);
        this._stats.villages++;
      } catch (e) {
        log('WARN', `Village "${v?.name || '?'}" non monté: ${e.message}`);
      }
    }

    this._mounted = true;
    log('OK', `${this._stats.villages} villages · ${this._stats.landmarks} monuments montés`);

    this._emit('troxtworld:villages_ready', {
      villages:  this._stats.villages,
      landmarks: this._stats.landmarks,
      names:     profiles.map(v => v.name).filter(Boolean),
      season,
      sig:       SIG,
    });
    return this;
  }

  _mountVillageLandmarks(profile, season) {
    if (!profile) return;

    const { x: cx, z: cz } = centerOf(profile);
    const landmarks = asArray(profile.landmarks);
    if (landmarks.length === 0) return;

    for (let i = 0; i < landmarks.length; i++) {
      const type = landmarks[i];
      let mesh;
      try { mesh = buildLandmark(type); }
      catch (e) { log('WARN', `${profile.name}/${type}: ${e.message}`); continue; }

      if (!isObject3D(mesh)) { log('WARN', `${profile.name}/${type}: mesh invalide`); continue; }

      if (mesh.userData?.seasonal === 'hiver' && season !== 'winter') mesh.visible = false;

      const angle  = (i / landmarks.length) * Math.PI * 2;
      const radius = 40 + i * 15;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;

      const rawY = this.heightAt(x, z);
      const y    = Number.isFinite(rawY) ? rawY : 0;

      mesh.position.set(x, y, z);
      mesh.userData.village = profile.name;
      mesh.userData.type    = type;
      this._landmarkRoot.add(mesh);
      this._mountedLandmarks.push(mesh);
      this._stats.landmarks++;
    }
  }

  // ─── ANIMATION ────────────────────────────────────────────────────────────
  tick(elapsed, delta) {
    if (!this._mounted) return;
    if (typeof animateLandmarks !== 'function') return;
    try { animateLandmarks(this._landmarkRoot, elapsed, delta); }
    catch { /* non bloquant */ }
  }

  // ─── SAISON ───────────────────────────────────────────────────────────────
  setSeason(season) {
    // ✅ fix #6 : skip si même saison
    if (this._currentSeason === season) return this;
    this._currentSeason = season;

    this._landmarkRoot.traverse((obj) => {
      if (obj.userData?.seasonal === 'hiver') {
        obj.visible = season === 'winter';
      }
    });
    this._emit('troxtworld:villages_season', { season, sig: SIG });
    return this;
  }

  // ─── REQUÊTES ─────────────────────────────────────────────────────────────
  getProfile(name)  { return typeof getProfile === 'function' ? getProfile(name) : null; }
  getAllProfiles()   { return asArray(VILLAGE_PROFILES); }

  nearestVillage(x, z, maxDist = Infinity) {
    let best = null, bestD = Infinity;
    for (const v of asArray(VILLAGE_PROFILES)) {
      const { x: vx, z: vz } = centerOf(v);
      const d = Math.hypot(vx - x, vz - z);
      if (d < bestD && d <= maxDist) { bestD = d; best = v; }
    }
    return best ? { ...best, distance: bestD } : null;
  }

  /** Rayon d'influence clampé. */
  _radiusOf(village) {
    const r = CFG.radiusBase + (village.density ?? 0) * CFG.radiusPerDensity;
    return clamp(r, CFG.minRadius, CFG.maxRadius);
  }

  /**
   * ✅ fix #1 : tracking per-player, cooldown anti-spam, direction cardinale.
   * @returns {object|null} village le plus proche
   */
  updatePlayer(playerId, x, z) {
    if (!playerId || !Number.isFinite(x) || !Number.isFinite(z)) return null;

    const near = this.nearestVillage(x, z);
    let state = this._playerState.get(playerId);
    if (!state) {
      state = { village: null, lastEnterAt: 0, enteredAt: 0 };
      this._playerState.set(playerId, state);
    }

    if (!near) {
      if (state.village) {
        this._emit('troxtworld:village_left', {
          player_id: playerId, village: state.village,
          durationMs: Date.now() - state.enteredAt, sig: SIG,
        });
        state.village = null;
        this._stats.leaves++;
      }
      return null;
    }

    const radius = this._radiusOf(near);
    const inside = near.distance <= radius;
    const now    = Date.now();

    if (inside && state.village !== near.name) {
      // ✅ cooldown anti-spam
      if (now - state.lastEnterAt < CFG.enterCooldownMs) return near;

      const { x: nx, z: nz } = centerOf(near);
      const dir = cardinalTo(x - nx, z - nz);

      // Si on quitte un autre village → emit leave d'abord
      if (state.village) {
        this._emit('troxtworld:village_left', {
          player_id: playerId, village: state.village,
          durationMs: now - state.enteredAt, sig: SIG,
          transition: true,
        });
        this._stats.transitions++;
      }

      state.village    = near.name;
      state.lastEnterAt = now;
      state.enteredAt  = now;
      this._stats.enters++;

      this._emit('troxtworld:village_entered', {
        player_id:  playerId,
        village:    near.name,
        population: near.population,
        industry:   near.industry,
        motto:      near.motto,
        landmarks:  near.landmarks,
        distance:   +near.distance.toFixed(1),
        radius:     +radius.toFixed(0),
        direction:  dir,       // N/S/E/O/I
        sig:        SIG,
      });
    } else if (!inside && state.village === near.name) {
      this._emit('troxtworld:village_left', {
        player_id: playerId, village: state.village,
        durationMs: now - state.enteredAt, sig: SIG,
      });
      state.village = null;
      this._stats.leaves++;
    }

    return near;
  }

  /** Déconnecte un joueur (cleanup propre). */
  removePlayer(playerId) {
    const st = this._playerState.get(playerId);
    if (!st) return;
    if (st.village) {
      this._emit('troxtworld:village_left', {
        player_id: playerId, village: st.village,
        durationMs: Date.now() - st.enteredAt, sig: SIG, reason: 'disconnect',
      });
    }
    this._playerState.delete(playerId);
  }

  /** ✅ fix #7 : cache des marques de map. */
  mapMarks() {
    if (this._mapMarksCache) return this._mapMarksCache;
    this._mapMarksCache = asArray(VILLAGE_PROFILES).map(v => {
      const { x, z } = centerOf(v);
      return {
        name: v.name, x, z,
        pop: v.population, type: v.type, industry: v.industry,
        radius: this._radiusOf(v),
      };
    });
    return this._mapMarksCache;
  }

  /** Où est le joueur ? (utile pour UI / jobs / events). */
  playerVillage(playerId) {
    const st = this._playerState.get(playerId);
    if (!st || !st.village) return null;
    const v = this.nearestVillage(...[0,0].map(() => 0));  // placeholder non utilisé
    const prof = this.getAllProfiles().find(p => p.name === st.village);
    return prof ? {
      name: prof.name, population: prof.population,
      industry: prof.industry, enteredAt: st.enteredAt,
      elapsedMs: Date.now() - st.enteredAt,
    } : null;
  }

  // ─── STATS / DISPOSE ──────────────────────────────────────────────────────
  getStats() {
    return {
      ...this._stats,
      mounted: this._mounted,
      activePlayers: this._playerState.size,
      bridgeQueue: this._queue.length,
      sig: SIG,
    };
  }

  dispose() {
    // ✅ fix #5 : dispose récursif des geometries + materials + textures
    for (const lm of this._mountedLandmarks) disposeObject3D(lm);
    this._mountedLandmarks.length = 0;
    this._landmarkRoot.clear();
    this._landmarkRoot.children.length = 0;

    this.scene.remove(this.root);
    this._mounted        = false;
    this._currentSeason  = null;
    this._mapMarksCache  = null;
    this._playerState.clear();
    this._queue.length   = 0;
    if (this._flushTimer) { clearTimeout(this._flushTimer); this._flushTimer = null; }
    this._stats = { villages: 0, landmarks: 0, enters: 0, leaves: 0,
                    transitions: 0, bridgeSent: 0, bridgeFailed: 0, bridgeQueued: 0 };
  }
}

export { SIG, CFG };
export default TroxtVillages;

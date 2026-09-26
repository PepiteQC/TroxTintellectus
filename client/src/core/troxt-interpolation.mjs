/**
 * TROXT⬡ — TROXT-INTERPOLATION.MJS
 * Interpolation de mouvement fluide — élimine les saccades réseau
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/core/troxt-interpolation.mjs
 * Usage     : import { InterpolationEngine } from './core/troxt-interpolation.mjs'
 */

const SIG = 'TROXT⬡';

/**
 * InterpolationEngine
 * Garde un buffer de snapshots par joueur et retourne
 * la position interpolée à un instant T (T = now - BUFFER_MS)
 */
export class InterpolationEngine {
  constructor(opts = {}) {
    this.buffer_ms    = opts.buffer_ms    || 100;  // délai de buffer (ms)
    this.max_snapshots= opts.max_snapshots || 30;  // snaps gardés par joueur
    this.max_dist_tp  = opts.max_dist_tp  || 50;   // distance max avant téléportation
    this._buffers     = new Map();  // player_id → Snapshot[]
    this.sig          = SIG;
  }

  // Ajouter un snapshot reçu du serveur
  push(player_id, snapshot) {
    if (!this._buffers.has(player_id)) {
      this._buffers.set(player_id, []);
    }
    const buf = this._buffers.get(player_id);

    // Insérer en ordre croissant de timestamp
    snapshot._ts = snapshot._ts || snapshot.ts || Date.now();
    buf.push(snapshot);
    buf.sort((a, b) => a._ts - b._ts);

    // Limiter la taille du buffer
    while (buf.length > this.max_snapshots) buf.shift();
  }

  // Obtenir la position interpolée pour un joueur à t = now - buffer_ms
  get(player_id) {
    const buf = this._buffers.get(player_id);
    if (!buf || buf.length === 0) return null;

    const render_time = Date.now() - this.buffer_ms;

    // Cas: snapshot trop ancien — téléportation
    if (render_time > (buf[buf.length - 1]._ts + 500)) {
      return buf[buf.length - 1];
    }

    // Trouver les deux snapshots encadrant render_time
    let s1 = null, s2 = null;
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i]._ts <= render_time && buf[i + 1]._ts >= render_time) {
        s1 = buf[i];
        s2 = buf[i + 1];
        break;
      }
    }

    // Extrapoler si render_time est au-delà du dernier snapshot
    if (!s1 || !s2) {
      const last = buf[buf.length - 1];
      if (last.vel && render_time > last._ts) {
        const dt = (render_time - last._ts) / 1000;
        return {
          ...last,
          pos: {
            x: last.pos.x + (last.vel.x || 0) * dt,
            y: last.pos.y + (last.vel.y || 0) * dt,
            z: last.pos.z + (last.vel.z || 0) * dt,
          },
          _interpolated: true,
          _extrapolated: true,
        };
      }
      return last;
    }

    // Facteur d'interpolation linéaire
    const dt    = s2._ts - s1._ts;
    const t     = dt > 0 ? (render_time - s1._ts) / dt : 0;
    const alpha = Math.max(0, Math.min(1, t));

    const lerp = (a, b) => a + (b - a) * alpha;

    // Vérifier si téléportation nécessaire
    const dx   = s2.pos.x - s1.pos.x;
    const dz   = s2.pos.z - s1.pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > this.max_dist_tp) {
      return { ...s2, _teleported: true };
    }

    // Interpolation position
    const interp_pos = {
      x: lerp(s1.pos.x, s2.pos.x),
      y: lerp(s1.pos.y, s2.pos.y),
      z: lerp(s1.pos.z, s2.pos.z),
    };

    // Interpolation rotation (slerp simplifié — linéaire pour les euler angles)
    const interp_rot = s1.rot && s2.rot ? {
      x: lerp(s1.rot.x, s2.rot.x),
      y: this._lerp_angle(s1.rot.y, s2.rot.y, alpha),
      z: lerp(s1.rot.z, s2.rot.z),
    } : (s2.rot || s1.rot);

    return {
      ...s2,
      pos          : interp_pos,
      rot          : interp_rot,
      _alpha       : alpha,
      _interpolated: true,
      _render_time : render_time,
    };
  }

  // Angle lerp (gère le wrap-around 0/2π)
  _lerp_angle(a, b, t) {
    const TWO_PI = Math.PI * 2;
    let diff = b - a;
    if (diff > Math.PI)  diff -= TWO_PI;
    if (diff < -Math.PI) diff += TWO_PI;
    return a + diff * t;
  }

  // Obtenir toutes les positions interpolées d'un coup
  get_all() {
    const result = {};
    for (const [player_id] of this._buffers) {
      const state = this.get(player_id);
      if (state) result[player_id] = state;
    }
    return result;
  }

  // Supprimer un joueur
  remove(player_id) {
    this._buffers.delete(player_id);
  }

  // Nettoyer les buffers vides ou inactifs
  cleanup(max_age_ms = 5000) {
    const now     = Date.now();
    let   cleaned = 0;
    for (const [id, buf] of this._buffers) {
      if (!buf.length) { this._buffers.delete(id); cleaned++; continue; }
      const last = buf[buf.length - 1];
      if (now - last._ts > max_age_ms) { this._buffers.delete(id); cleaned++; }
    }
    return cleaned;
  }

  get player_count() { return this._buffers.size; }
}

/**
 * PredictiveEngine
 * Prédiction de position locale (client-side prediction)
 * Le joueur local voit sa position mise à jour immédiatement
 * sans attendre la confirmation du serveur
 */
export class PredictiveEngine {
  constructor() {
    this._pending  = [];   // moves envoyés mais non confirmés
    this._pos      = { x:0, y:0, z:0 };
    this._rot      = { x:0, y:0, z:0 };
    this._seq      = 0;
    this.sig       = SIG;
  }

  // Appliquer un mouvement localement et le mettre en attente
  apply_local(pos, rot, vel, input) {
    this._seq++;
    this._pos = { ...pos };
    this._rot = { ...rot };

    this._pending.push({
      seq   : this._seq,
      pos   : { ...pos },
      rot   : { ...rot },
      vel   : vel ? { ...vel } : null,
      input,
      ts    : Date.now(),
    });

    // Garder max 60 moves en attente
    if (this._pending.length > 60) this._pending.shift();

    return { seq: this._seq, pos, rot };
  }

  // Réconciliation avec la position serveur confirmée
  reconcile(server_pos, server_rot, confirmed_seq) {
    // Supprimer tous les moves confirmés
    this._pending = this._pending.filter(m => m.seq > confirmed_seq);

    // Réappliquer les moves non-confirmés depuis la position serveur
    let pos = { ...server_pos };
    let rot = { ...server_rot };

    for (const move of this._pending) {
      if (move.vel) {
        const dt = 1 / 20; // 20Hz
        pos.x += move.vel.x * dt;
        pos.y += move.vel.y * dt;
        pos.z += move.vel.z * dt;
      }
    }

    // Si l'erreur de prédiction est petite — lisser
    const err_x = pos.x - this._pos.x;
    const err_z = pos.z - this._pos.z;
    const err   = Math.sqrt(err_x*err_x + err_z*err_z);

    if (err < 0.5) {
      // Erreur négligeable — garder la position prédite
    } else if (err < 5) {
      // Erreur modérée — snap progressif (10% vers serveur)
      this._pos.x += err_x * 0.1;
      this._pos.z += err_z * 0.1;
    } else {
      // Grande erreur — snap direct
      this._pos = pos;
      this._rot = rot;
    }

    return { pos: this._pos, rot: this._rot, error: err };
  }

  get pos() { return { ...this._pos }; }
  get rot() { return { ...this._rot }; }
  get seq() { return this._seq; }
}

/**
 * SmoothCamera
 * Caméra fluide avec lag et amortissement
 */
export class SmoothCamera {
  constructor(opts = {}) {
    this.lag_factor    = opts.lag_factor    || 0.1;   // 0 = instantané, 1 = jamais
    this.rotation_lag  = opts.rotation_lag  || 0.12;
    this.height_lag    = opts.height_lag    || 0.08;
    this.pos           = { x:0, y:5, z:10 };
    this.target        = { x:0, y:0, z:0  };
    this.sig           = SIG;
  }

  update(target_pos, target_rot, dt = 0.016) {
    const t_pos = {
      x: target_pos.x,
      y: target_pos.y + 5,
      z: target_pos.z + 10,
    };

    const alpha = 1 - Math.pow(this.lag_factor, dt * 60);

    this.pos.x += (t_pos.x - this.pos.x) * alpha;
    this.pos.y += (t_pos.y - this.pos.y) * (this.height_lag * dt * 60);
    this.pos.z += (t_pos.z - this.pos.z) * alpha;

    this.target.x += (target_pos.x - this.target.x) * alpha;
    this.target.y += (target_pos.y - this.target.y) * alpha;
    this.target.z += (target_pos.z - this.target.z) * alpha;

    return { pos: { ...this.pos }, target: { ...this.target } };
  }
}

export { SIG };
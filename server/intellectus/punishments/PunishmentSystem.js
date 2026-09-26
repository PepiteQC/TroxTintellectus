/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — PUNISHMENTS/PUNISHMENTSYSTEM.JS
 * Gestionnaire centralisé des sanctions administratives
 * ═══════════════════════════════════════════════════════════════════
 * Fonctionnalités :
 *   • Durées temporisées + expiration automatique (isBanned / isMuted)
 *   • Casier judiciaire par joueur (historique d'audit)
 *   • Annulation (pardon / unban / unmute) avec trace d'administration
 *   • Comptage des avertissements + escalade automatique configurable
 *   • Sérialisation complète pour sauvegarde DB / backups
 *
 * Signature : TROXT⬡
 * Chemin    : server/intellectus/punishments/PunishmentSystem.js
 */

const SIG = 'TROXT⬡';

export class PunishmentSystem {
  /**
   * @param {object} [options]
   * @param {number} [options.limit=50000]           - Limite max de l'historique en mémoire
   * @param {Array<object>} [options.escalation=[]]   - Règles d'escalade automatique
   * @param {Function} [options.now=Date.now]        - Injecteur temporel (pour tests/mock)
   */
  constructor(options = {}) {
    this.list = [];
    this.seq = 0;
    this.limit = options.limit ?? 50000;
    this.escalation = [...(options.escalation ?? [])].sort(
      (a, b) => a.warnCount - b.warnCount
    );
    this.now = options.now ?? (() => Date.now());
    this.sig = SIG;
  }

  // ─────────────────────────────────────────────────────────────────
  //  APPLICATION DES SANCTIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Enregistre une sanction dans le registre.
   * @private
   */
  _add(p) {
    const full = {
      ...p,
      id: `pun_${this.now()}_${this.seq++}`,
      createdAt: this.now(),
      pardoned: false,
      pardonedBy: null,
      pardonedAt: null,
    };

    this.list.push(full);

    // Maintien sous la limite configurée
    if (this.list.length > this.limit) {
      this.list.splice(0, this.list.length - this.limit);
    }

    return full;
  }

  /**
   * Bannit un joueur.
   * @param {{ id: string, name: string }} target
   * @param {{ id: string, name: string }} by
   * @param {string} reason
   * @param {number|null} [durationMs=null] - null = permanent
   */
  ban(target, by, reason, durationMs = null) {
    return this._add({
      type: 'ban',
      targetId: target.id,
      targetName: target.name,
      byId: by.id,
      byName: by.name,
      reason,
      expiresAt: durationMs ? this.now() + durationMs : null,
    });
  }

  /**
   * Rend un joueur muet.
   * @param {{ id: string, name: string }} target
   * @param {{ id: string, name: string }} by
   * @param {string} reason
   * @param {number|null} [durationMs=null] - null = permanent
   */
  mute(target, by, reason, durationMs = null) {
    return this._add({
      type: 'mute',
      targetId: target.id,
      targetName: target.name,
      byId: by.id,
      byName: by.name,
      reason,
      expiresAt: durationMs ? this.now() + durationMs : null,
    });
  }

  /**
   * Expulse un joueur immédiatement (sanction instantanée).
   * @param {{ id: string, name: string }} target
   * @param {{ id: string, name: string }} by
   * @param {string} reason
   */
  kick(target, by, reason) {
    return this._add({
      type: 'kick',
      targetId: target.id,
      targetName: target.name,
      byId: by.id,
      byName: by.name,
      reason,
      expiresAt: this.now(),
    });
  }

  /**
   * Avertit un joueur et applique une éventuelle escalade automatique.
   * @param {{ id: string, name: string }} target
   * @param {{ id: string, name: string }} by
   * @param {string} reason
   * @returns {{ warning: object, escalation?: object }}
   */
  warn(target, by, reason) {
    const warning = this._add({
      type: 'warn',
      targetId: target.id,
      targetName: target.name,
      byId: by.id,
      byName: by.name,
      reason,
      expiresAt: null,
    });

    const count = this.getWarnCount(target.id);
    const rule = this.escalation.find((r) => r.warnCount === count);

    if (rule) {
      const system = { id: 'SYSTEM', name: 'Escalade Automatique' };
      let escalation;

      if (rule.apply === 'ban') {
        escalation = this.ban(target, system, rule.reason, rule.durationMs);
      } else if (rule.apply === 'mute') {
        escalation = this.mute(target, system, rule.reason, rule.durationMs);
      } else if (rule.apply === 'kick') {
        escalation = this.kick(target, system, rule.reason);
      }

      return { warning, escalation };
    }

    return { warning };
  }

  // ─────────────────────────────────────────────────────────────────
  //  ÉTAT ACTIF & EXPIRATION AUTOMATIQUE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Vérifie si une sanction est active à l'instant T.
   * @private
   */
  _isActive(p) {
    if (p.pardoned) return false;
    if (p.expiresAt === null) return true; // permanent
    return p.expiresAt > this.now();
  }

  /**
   * Récupère la sanction active la plus récente d'un type donné pour un joueur.
   * @private
   */
  _activeOf(targetId, type) {
    return this.list
      .filter((p) => p.targetId === targetId && p.type === type && this._isActive(p))
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  isBanned(targetId) {
    return !!this._activeOf(targetId, 'ban');
  }

  isMuted(targetId) {
    return !!this._activeOf(targetId, 'mute');
  }

  getActiveBan(targetId) {
    return this._activeOf(targetId, 'ban');
  }

  getActiveMute(targetId) {
    return this._activeOf(targetId, 'mute');
  }

  /**
   * Calcule le temps restant en millisecondes.
   * @returns {number} Infinity si permanent, 0 si inactif ou expiré
   */
  remainingMs(p) {
    if (!p || !this._isActive(p)) return 0;
    if (p.expiresAt === null) return Infinity;
    return Math.max(0, p.expiresAt - this.now());
  }

  // ─────────────────────────────────────────────────────────────────
  //  ANNULATION & PARDONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Lève toutes les sanctions actives d'un type pour un joueur.
   * @param {string} targetId
   * @param {'ban'|'mute'|'warn'|'kick'} type
   * @param {{ id: string, name: string }} by
   * @returns {number} Nombre de sanctions levées
   */
  pardon(targetId, type, by) {
    let count = 0;
    for (const p of this.list) {
      if (p.targetId === targetId && p.type === type && this._isActive(p)) {
        p.pardoned = true;
        p.pardonedBy = by.id;
        p.pardonedAt = this.now();
        count++;
      }
    }
    return count;
  }

  unban(targetId, by) {
    return this.pardon(targetId, 'ban', by);
  }

  unmute(targetId, by) {
    return this.pardon(targetId, 'mute', by);
  }

  // ─────────────────────────────────────────────────────────────────
  //  CONSULTATION DU CASIER JUDICIAIRE
  // ─────────────────────────────────────────────────────────────────

  getWarnCount(targetId) {
    return this.list.filter(
      (p) => p.type === 'warn' && p.targetId === targetId && !p.pardoned
    ).length;
  }

  /**
   * Retourne l'historique complet d'un joueur (du plus récent au plus ancien).
   * @param {string} targetId
   */
  getHistory(targetId) {
    return this.list
      .filter((p) => p.targetId === targetId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Retourne toutes les sanctions actuellement actives sur le serveur.
   */
  getActivePunishments() {
    return this.list.filter((p) => this._isActive(p));
  }

  getAll() {
    return [...this.list];
  }

  // ─────────────────────────────────────────────────────────────────
  //  SÉRIALISATION
  // ─────────────────────────────────────────────────────────────────

  toState() {
    return {
      punishments: this.list.map((p) => ({ ...p })),
    };
  }

  loadState(state) {
    if (Array.isArray(state?.punishments)) {
      this.list = state.punishments.map((p) => ({ ...p }));
    }
  }
}

export default PunishmentSystem;
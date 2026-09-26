/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SERVER/SRC/SERVICES/BAN-SERVICE.JS
 * Service de gestion des sanctions, vérification HWID/IP & ThirdEye
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡ · 🛡️INTELLECTUS⬡ · ThirdEye
 */

import { eq, and, or, desc, gte, isNull } from 'drizzle-orm';
import { dbBans, BAN_TYPES, BAN_CATEGORIES } from '../drizzle/schemas/bans.js';

const SIG = 'TROXT⬡';

const log = (lvl, msg) => {
  const icons = { OK: '✓', WARN: '⚠', BAN: '🛡️', ERR: '✖' };
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${icons[lvl] || '·'} [${SIG}:BanService] ${msg}`);
};

export class BanService {
  /**
   * @param {import('drizzle-orm/node-postgres').NodePgDatabase} dbInstance - Instance Drizzle ORM connectée
   */
  constructor(dbInstance) {
    if (!dbInstance) throw new Error('BanService requiert une instance Drizzle ORM valide.');
    this.db = dbInstance;
  }

  /**
   * Vérifie si un joueur est autorisé à se connecter en inspectant son ID, IP et HWID.
   * Nettoie ou ignore automatiquement les bans temporaires arrivés à expiration.
   * 
   * @param {Object} credentials
   * @param {string} credentials.playerId - ID unique du compte
   * @param {string} credentials.ipAddress - Adresse IP de la requête
   * @param {string} credentials.hardwareId - Empreinte matérielle (HWID)
   * @returns {Promise<{banned: boolean, banDetails?: Object, message?: string}>}
   */
  async verifyConnection({ playerId, ipAddress, hardwareId }) {
    try {
      const now = new Date();

      // Construction des critères de recherche pour les bans actifs
      const conditions = [eq(dbBans.active, true)];
      const matchCriteria = [eq(dbBans.playerId, playerId)];

      if (ipAddress) matchCriteria.push(eq(dbBans.ipAddress, ipAddress));
      if (hardwareId) matchCriteria.push(eq(dbBans.hardwareId, hardwareId));

      conditions.push(or(...matchCriteria));

      // Recherche des sanctions potentielles
      const activeBans = await this.db
        .select()
        .from(dbBans)
        .where(and(...conditions));

      if (!activeBans || activeBans.length === 0) {
        return { banned: false };
      }

      for (const ban of activeBans) {
        // Vérification de l'expiration pour les bans temporaires
        if (ban.expiresAt && new Date(ban.expiresAt) <= now) {
          // Expiration automatique du ban obsolète
          await this.pardonBan(ban.id, 'ThirdEye System', 'Expiration automatique de la sanction temporaire');
          log('OK', `Sanction ${ban.id} levée automatiquement (expirée).`);
          continue;
        }

        // Un ban actif est formellement détecté
        log('BAN', `Connexion bloquée pour ${playerId} — Motif: ${ban.reason} [Type: ${ban.type}]`);
        return {
          banned: true,
          banDetails: {
            id: ban.id,
            type: ban.type,
            category: ban.category,
            reason: ban.reason,
            bannedBy: ban.bannedBy,
            bannedAt: ban.bannedAt,
            expiresAt: ban.expiresAt,
          },
          message: ban.expiresAt 
            ? `Accès refusé. Banni temporairement jusqu'au ${new Date(ban.expiresAt).toLocaleString()}. Motif : ${ban.reason}`
            : `Accès refusé. Bannissement permanent de TroxtWorld. Motif : ${ban.reason}`,
        };
      }

      return { banned: false };
    } catch (error) {
      log('ERR', `Erreur lors de la vérification de ban pour ${playerId}: ${error.message}`);
      // Par sécurité, en cas de panne de la DB, on laisse passer ou on bloque selon la politique (ici on laisse passer pour éviter le DoS, mais log l'erreur)
      return { banned: false };
    }
  }

  /**
   * Émet une nouvelle sanction (bannissement) contre un joueur.
   * 
   * @param {Object} params
   * @returns {Promise<Object>} Enregistrement du ban créé
   */
  async issueBan({
    playerId,
    playerName,
    ipAddress = null,
    hardwareId = null,
    type = 'temporary',
    category = 'admin_decision',
    reason,
    evidenceUrl = null,
    metadata = {},
    bannedBy = 'ThirdEye Anti-Cheat',
    bannedByRole = 'system',
    durationHours = null, // null pour permanent
  }) {
    if (!playerId || !reason) {
      throw new Error('Paramètres insuffisants pour émettre un bannissement.');
    }

    if (!BAN_TYPES.includes(type)) {
      throw new Error(`Type de bannissement invalide : ${type}`);
    }

    if (!BAN_CATEGORIES.includes(category)) {
      throw new Error(`Catégorie d'infraction invalide : ${category}`);
    }

    const banId = `ban_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    
    let expiresAt = null;
    if (type === 'temporary' && durationHours) {
      expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000);
    } else if (type === 'permanent' || type === 'hardware_hwid' || type === 'ip_block') {
      expiresAt = null; // Permanent par défaut pour ces catégories lourdes
    }

    const [newBan] = await this.db
      .insert(dbBans)
      .values({
        id: banId,
        playerId,
        playerName: playerName || 'Inconnu',
        ipAddress,
        hardwareId,
        type,
        category,
        reason,
        evidenceUrl,
        metadata,
        bannedBy,
        bannedByRole,
        active: true,
        bannedAt: now,
        expiresAt,
      })
      .returning();

    log('BAN', `Nouvelle sanction [${banId}] émise contre ${playerName} (${playerId}) — Type: ${type} — Raison: ${reason}`);
    return newBan;
  }

  /**
   * Révoque un bannissement (Grâce / Débannissement / Recours accepté).
   * 
   * @param {string} banId - ID du ban
   * @param {string} pardonedBy - Nom ou ID du staff / système effectuant la grâce
   * @param {string} pardonReason - Justification de la levée
   * @returns {Promise<boolean>}
   */
  async pardonBan(banId, pardonedBy, pardonReason) {
    const now = new Date();
    const result = await this.db
      .update(dbBans)
      .set({
        active: false,
        pardonedAt: now,
        pardonedBy,
        pardonReason,
      })
      .where(eq(dbBans.id, banId))
      .returning({ id: dbBans.id });

    if (result && result.length > 0) {
      log('OK', `Sanction ${banId} levée avec succès par ${pardonedBy}.`);
      return true;
    }
    return false;
  }

  /**
   * Récupère l'historique complet des sanctions d'un joueur.
   * 
   * @param {string} playerId 
   * @returns {Promise<Array>}
   */
  async getPlayerBanHistory(playerId) {
    return await this.db
      .select()
      .from(dbBans)
      .where(eq(dbBans.playerId, playerId))
      .orderBy(desc(dbBans.bannedAt));
  }
}

export default BanService;
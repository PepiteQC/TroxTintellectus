/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SERVER/SRC/SERVICES/THIRDEYE-TELEMETRY.JS
 * Moteur d'analyse comportementale et d'auto-sanction ThirdEye
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡ · 🛡️INTELLECTUS⬡ · ThirdEye
 */

import BanService from './ban-service.js';

const SIG = 'TROXT⬡';

const log = (lvl, msg) => {
  const icons = { OK: '✓', WARN: '⚠', THREAT: '🚨', ERR: '✖' };
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${icons[lvl] || '·'} [${SIG}:ThirdEyeTelemetry] ${msg}`);
};

export class ThirdEyeTelemetry {
  /**
   * @param {import('drizzle-orm/node-postgres').NodePgDatabase} dbInstance
   */
  constructor(dbInstance) {
    if (!dbInstance) throw new Error("ThirdEyeTelemetry requiert une instance Drizzle ORM.");
    this.banService = new BanService(dbInstance);
    
    // Suivi en mémoire des positions et timestamps pour le calcul des vecteurs de vitesse
    this.playerTrackers = new Map(); // playerId -> { x, y, z, timestamp, warningsCount }
  }

  /**
   * Analyse un paquet de télémétrie ou d'action envoyé par un client en jeu.
   * 
   * @param {Object} player - Objet représentant le joueur connecté ({ id, name, ipAddress, hardwareId, is_admin })
   * @param {Object} telemetryData - Données reçues ({ x, y, z, action, speed, clientTimestamp })
   * @returns {Promise<boolean>} true si le paquet est sain, false si une infraction critique a bloqué le joueur
   */
  async analyzePlayerFrame(player, telemetryData) {
    if (!player || player.is_admin) return true; // Les administrateurs contournent l'analyse heuristique

    const { id: playerId, name: playerName, ipAddress, hardwareId } = player;
    const { x, y, z, speed = 0, action } = telemetryData || {};
    const now = Date.now();

    let tracker = this.playerTrackers.get(playerId);

    if (!tracker) {
      this.playerTrackers.set(playerId, { x, y, z, timestamp: now, warningsCount: 0 });
      return true;
    }

    // 1. Détection de Speedhack / Téléportation (Noclip / Teleport abuse)
    const timeDelta = (now - tracker.timestamp) / 1000; // en secondes
    if (timeDelta > 0.1 && x !== undefined && y !== undefined) {
      const distance = Math.sqrt((x - tracker.x) ** 2 + (y - tracker.y) ** 2);
      const calculatedSpeed = distance / timeDelta; // unités par seconde

      // Seuil maximal autorisé en jeu (ex: véhicule rapide ou sprint max = 35 m/s)
      const MAX_ALLOWED_SPEED = 45.0; 

      if (calculatedSpeed > MAX_ALLOWED_SPEED) {
        tracker.warningsCount += 1;
        log('THREAT', `Anomalie de mouvement détectée sur ${playerName} (${playerId}) — Vitesse calculée: ${calculatedSpeed.toFixed(2)} m/s (Seuil: ${MAX_ALLOWED_SPEED})`);

        // Si le joueur cumule trop d'alertes, déclenchement d'un ban automatique Security Auto
        if (tracker.warningsCount >= 5) {
          await this.banService.issueBan({
            playerId,
            playerName,
            ipAddress,
            hardwareId,
            type: 'security_auto',
            category: 'speed_teleport',
            reason: `ThirdEye Auto-Ban : Mouvement impossible détecté (Speedhack / Téléportation - ${calculatedSpeed.toFixed(0)}m/s)`,
            bannedBy: 'ThirdEye Heuristic Engine',
            bannedByRole: 'system',
            metadata: { calculatedSpeed, threshold: MAX_ALLOWED_SPEED, lastCoordinates: { x, y, z } },
          });

          this.playerTrackers.delete(playerId);
          return false; // Bloqué / Infraction majeure
        }
      }
    }

    // Mise à jour du traceur pour la frame suivante
    tracker.x = x ?? tracker.x;
    tracker.y = y ?? tracker.y;
    tracker.z = z ?? tracker.z;
    tracker.timestamp = now;

    return true;
  }

  /**
   * Déclenche une sanction immédiate suite à une infraction flagrante interceptée par le serveur 
   * (ex: injection Lua, génération anormale d'argent T$, Godmode).
   * 
   * @param {Object} player 
   * @param {string} category - Catégorie issue de BAN_CATEGORIES (ex: 'money_injection', 'lua_injection')
   * @param {string} reason 
   */
  async triggerInstantSanction(player, category, reason) {
    const { id: playerId, name: playerName, ipAddress, hardwareId } = player;

    log('THREAT', `Infraction critique immédiate par ${playerName} (${playerId}) [Catégorie: ${category}] : ${reason}`);

    await this.banService.issueBan({
      playerId,
      playerName,
      ipAddress,
      hardwareId,
      type: 'hardware_hwid', // Sanction lourde liant le compte et le matériel
      category,
      reason: `ThirdEye Anti-Cheat (Violation critique) : ${reason}`,
      bannedBy: 'ThirdEye Core Security',
      bannedByRole: 'system',
    });

    this.playerTrackers.delete(playerId);
  }

  /**
   * Nettoyage périodique des traceurs déconnectés
   */
  cleanupTracker(playerId) {
    this.playerTrackers.delete(playerId);
  }
}

export default ThirdEyeTelemetry;
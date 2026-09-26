/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SERVER/SRC/MIDDLEWARE/THIRDEYE-SECURITY.JS
 * Passerelle d'interception et de contrôle d'accès ThirdEye Anti-Cheat
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡ · 🛡️INTELLECTUS⬡ · ThirdEye
 */

import BanService from '../services/ban-service.js';

const SIG = 'TROXT⬡';

const log = (lvl, msg) => {
  const icons = { OK: '✓', WARN: '⚠', SEC: '🛡️', ERR: '✖' };
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${icons[lvl] || '·'} [${SIG}:ThirdEye] ${msg}`);
};

export class ThirdEyeSecurity {
  /**
   * @param {import('drizzle-orm/node-postgres').NodePgDatabase} dbInstance
   */
  constructor(dbInstance) {
    if (!dbInstance) throw new Error('ThirdEyeSecurity requiert une instance Drizzle ORM.');
    this.banService = new BanService(dbInstance);
  }

  /**
   * Middleware Express pour filtrer les requêtes HTTP entrantes (API, connexions web, etc.)
   */
  expressGuard() {
    return async (req, res, next) => {
      try {
        // Extraction des identifiants clients (en-têtes ou corps de requête)
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const playerId = req.headers['x-troxt-player-id'] || req.body?.playerId;
        const hardwareId = req.headers['x-troxt-hwid'] || req.body?.hardwareId;

        if (!playerId && !ipAddress && !hardwareId) {
          return next(); // Pas assez d'éléments pour un contrôle global, laisse passer aux routes d'authentification
        }

        const check = await this.banService.verifyConnection({
          playerId: playerId || 'anonymous',
          ipAddress,
          hardwareId,
        });

        if (check.banned) {
          log('SEC', `Requête HTTP bloquée pour ${playerId || ipAddress} — Motif: ${check.banDetails.reason}`);
          return res.status(403).json({
            ok: false,
            error: 'ACCESS_DENIED',
            sig: SIG,
            ...check,
          });
        }

        next();
      } catch (error) {
        log('ERR', `Erreur dans le middleware de sécurité Express: ${error.message}`);
        next(); // En cas de pépin technique, on évite de bloquer tout le trafic web
      }
    };
  }

  /**
   * Gestionnaire de handshake WebSocket (pour WebSocket natif ou Colyseus)
   * À appeler dès qu'un client établit une connexion socket brute ou s'authentifie.
   * 
   * @param {Object} socket - Instance du WebSocket client
   * @param {Object} handshakeData - Données transmises à la connexion ({ playerId, hardwareId, ipAddress })
   * @returns {Promise<boolean>} true si autorisé, false si bloqué et déconnecté
   */
  async handleSocketHandshake(socket, handshakeData) {
    try {
      const { playerId, hardwareId, ipAddress } = handshakeData || {};

      // Récupération sécurisée de l'IP depuis la socket si non fournie
      const clientIp = ipAddress || socket.remoteAddress || socket._socket?.remoteAddress;

      const check = await this.banService.verifyConnection({
        playerId: playerId || 'unknown_player',
        ipAddress: clientIp,
        hardwareId: hardwareId || 'unknown_hwid',
      });

      if (check.banned) {
        log('SEC', `Connexion WebSocket refusée pour ${playerId} (HWID: ${hardwareId})`);
        
        // Envoi du message de refus normalisé avant fermeture de la socket
        if (typeof socket.send === 'function') {
          socket.send(JSON.stringify({
            type: 'THIRDEYE_ACCESS_DENIED',
            data: check,
            sig: SIG,
            ts: Date.now(),
          }));
        }

        // Fermeture propre de la socket
        if (typeof socket.close === 'function') {
          socket.close(4003, 'Banned by ThirdEye Anti-Cheat');
        } else if (typeof socket.terminate === 'function') {
          socket.terminate();
        }

        return false;
      }

      log('OK', `Connexion WebSocket autorisée pour le joueur ${playerId}`);
      return true;
    } catch (error) {
      log('ERR', `Erreur critique lors du handshake WebSocket ThirdEye: ${error.message}`);
      return true; // Par défaut tolérant en cas d'erreur interne non critique
    }
  }
}

export default ThirdEyeSecurity;
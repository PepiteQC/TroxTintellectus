/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SERVER/SRC/CORE/EVENT-BUS.JS
 * Pont d'événements central et découplé pour l'écosystème TroxtWorld
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡ · 🌐INTELLECTUS⬡ · EventBridge
 */

import { EventEmitter } from 'events';

const SIG = 'TROXT⬡';

const log = (lvl, msg) => {
  const icons = { OK: '✓', WARN: '⚠', BUS: '🌐', ERR: '✖' };
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${icons[lvl] || '·'} [${SIG}:EventBus] ${msg}`);
};

class TroxtEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Évite les avertissements de fuite de mémoire avec de multiples modules
    this.eventHistory = [];    // Historique léger des derniers événements (pour le debug/télémétrie)
    this.maxHistorySize = 50;
  }

  /**
   * Émet un événement standardisé à travers tout le serveur.
   * 
   * @param {string} eventName - Nom de l'événement (ex: 'troxtworld:alarm', 'economy:transfer')
   * @param {Object} payload - Données transmises (doit inclure ou recevra la signature)
   */
  publish(eventName, payload = {}) {
    const enrichedPayload = {
      ...payload,
      sig: SIG,
      timestamp: Date.now(),
    };

    // Stockage dans l'historique récent
    this.eventHistory.unshift({ eventName, payload: enrichedPayload });
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }

    // Émission native Node.js
    super.emit(eventName, enrichedPayload);
    super.emit('*', { eventName, payload: enrichedPayload }); // Canal universel de supervision
  }

  /**
   * S'abonne à un événement spécifique.
   * 
   * @param {string} eventName 
   * @param {Function} listener 
   */
  subscribe(eventName, listener) {
    super.on(eventName, listener);
    return () => this.unsubscribe(eventName, listener); // Retourne une fonction de désabonnement propre
  }

  /**
   * Se désabonne d'un événement.
   * 
   * @param {string} eventName 
   * @param {Function} listener 
   */
  unsubscribe(eventName, listener) {
    super.off(eventName, listener);
  }

  /**
   * Récupère l'historique récent des événements du bus (très utile pour l'administration/debug).
   */
  getHistory() {
    return this.eventHistory;
  }
}

// Instance unique globale (Singleton) pour tout le serveur TroxtWorld
export const eventBus = new TroxtEventBus();
export default eventBus;
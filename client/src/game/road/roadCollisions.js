/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/ROAD/ROADCOLLISIONS.JS
 * Détection collisions véhicule ↔ obstacles routiers (incidents MTQ,
 * fête foraine, nids-de-poule…)
 * ═══════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • Debounce PAR OBSTACLE (Map) → plus d'avalage
 *   • activeJams alimenté automatiquement (types "jam")
 *   • Décroissance passive du damage (dirt-time + threshold)
 *   • Plafond de dégâts par impact (configurable)
 *   • Rayon véhicule + vitesse de référence configurables
 *   • Guard vitesse négative / NaN
 *   • Messages délégués à un template (i18n-ready)
 *   • Severity tiers : minor | moderate | severe | critical
 *   • Hook kernel TROXT⬡ : emit('troxtworld:collision', …)
 *   • reset() propre pour save/load
 *   • API : getSeverity, isTotaled, getJamCount
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/road/roadCollisions.js
 */

const SIG = 'TROXT⬡';

// ─── JSDoc (autocomplétion IDE) ────────────────────────────────────────────
/**
 * @typedef {('minor'|'moderate'|'severe'|'critical')} CollisionSeverity
 *
 * @typedef {object} CollisionEvent
 * @property {object} obstacle          - L'obstacle heurté (RoadIncidentObstacle)
 * @property {number} damage            - % de dégâts appliqués (1-100)
 * @property {number} speedImpact       - Vitesse à retirer au joueur (km/h)
 * @property {string} message           - Message localisé
 * @property {CollisionSeverity} severity
 * @property {number} totalDamage       - Total cumulé après impact
 * @property {boolean} totaled          - Véhicule hors-service ?
 *
 * @typedef {object} RoadCollisionConfig
 * @property {number} [vehicleRadius=1.4]        - Rayon hitbox véhicule (m)
 * @property {number} [referenceSpeed=45]        - Vitesse de référence (km/h)
 * @property {number} [debounceMs=800]           - Fenêtre anti-spam par obstacle
 * @property {number} [maxDamagePerHit=35]       - Plafond par impact (%)
 * @property {number} [totaledThreshold=100]     - Seuil "hors-service"
 * @property {number} [decayPerSecond=0.5]       - Régénération passive (%/s)
 * @property {number} [speedImpactRatio=0.4]     - Fraction de vitesse perdue
 */

const DEFAULT_CONFIG = Object.freeze({
  vehicleRadius:     1.4,
  referenceSpeed:    45,
  debounceMs:        800,
  maxDamagePerHit:   35,
  totaledThreshold:  100,
  decayPerSecond:    0.5,
  speedImpactRatio:  0.4,
});

// ─── MESSAGES (i18n-ready, surchargeables) ────────────────────────────────
const MESSAGE_TEMPLATES = Object.freeze({
  barrel_orange:      (obs, dmg) => `Collision avec un baril de chantier MTQ ! Suspension secouée (-${dmg}%).`,
  cone_mtq:           (obs, dmg) => `Collision avec un cône MTQ ! (-${dmg}%).`,
  barrier_detour:     (obs, dmg) => `Fracas contre la barrière de détour de la fête foraine ! Dégâts de carrosserie (-${dmg}%).`,
  pothole:            (obs, dmg) => `Nid-de-poule violent encaissé ! Géométrie de suspension déréglée (-${dmg}%).`,
  festival_queue_car: (obs, dmg) => `Accrochage dans le bouchon de la fête foraine ! Pare-chocs enfoncé (-${dmg}%).`,
  default:            (obs, dmg) => `Impact avec : ${obs.name} ! (-${dmg}%).`,
});

// Types considérés comme bouchons (activent activeJams)
const JAM_TYPES = new Set(['festival_queue_car', 'traffic_jam', 'barrier_detour']);

// ─── HELPERS ───────────────────────────────────────────────────────────────
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const severityFor = (damage) => {
  if (damage >= 25) return 'critical';
  if (damage >= 15) return 'severe';
  if (damage >= 8)  return 'moderate';
  return 'minor';
};

const buildMessage = (obs, damage) => {
  const tpl = MESSAGE_TEMPLATES[obs.type] || MESSAGE_TEMPLATES.default;
  return tpl(obs, damage);
};

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

export class RoadCollisionManager {
  /**
   * @param {RoadCollisionConfig} [config]
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {number} 0..100 */
    this.totalDamage = 0;

    /** @type {string[]} ids d'obstacles formant un bouchon actif */
    this.activeJams = [];

    /** @type {Map<string, number>} debounce par obstacle (id → last ts) */
    this._lastHitByObstacle = new Map();

    /** @type {number} */
    this._lastDecayAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    /** @type {object|null} kernel TROXT⬡ (optionnel) */
    this._kernel = null;
  }

  /** Branche un kernel TROXT⬡ pour émettre les events */
  attachKernel(kernel) {
    this._kernel = kernel;
    return this;
  }

  // ─── Tick passif : régénération progressive ─────────────────────────────
  /**
   * Appeler une fois par frame (ou par seconde).
   * @param {number} [dtMs] - delta time en ms (défaut : calculé automatiquement)
   */
  update(dtMs) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = (dtMs ?? (now - this._lastDecayAt)) / 1000;
    this._lastDecayAt = now;

    if (dt <= 0) return;

    if (this.totalDamage > 0) {
      // Régénération uniquement quand le véhicule n'est pas en mouvement
      // (le manager ne connaît pas la vitesse → c'est au caller d'appeler
      //  update() uniquement à l'arrêt, ou de passer un flag)
      this.totalDamage = Math.max(0, this.totalDamage - this.config.decayPerSecond * dt);
    }
  }

  // ─── Détection principale ───────────────────────────────────────────────
  /**
   * Vérifie la collision véhicule ↔ obstacles.
   * @param {number} playerX
   * @param {number} playerZ
   * @param {number} playerSpeedKmh
   * @param {Array<object>} obstacles - Liste de RoadIncidentObstacle
   * @returns {CollisionEvent|null}
   */
  checkCollisions(playerX, playerZ, playerSpeedKmh, obstacles) {
    if (!Array.isArray(obstacles) || obstacles.length === 0) return null;

    // 🔧 BOOST : guard vitesse
    const speed = Number.isFinite(playerSpeedKmh) ? Math.max(0, playerSpeedKmh) : 0;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const hitRadiusBase = this.config.vehicleRadius;

    // Rafraîchit la liste des bouchons actifs
    const jams = new Set();

    for (const obs of obstacles) {
      // Track les bouchons (même non heurtés)
      if (JAM_TYPES.has(obs.type)) jams.add(obs.id);

      // 🔧 BOOST : debounce PAR obstacle
      const lastHit = this._lastHitByObstacle.get(obs.id) || 0;
      if (now - lastHit < this.config.debounceMs) continue;

      const dx = playerX - obs.x;
      const dz = playerZ - obs.z;
      const dist = Math.hypot(dx, dz);
      const hitRadius = hitRadiusBase + (obs.radius || 0);

      if (dist < hitRadius) {
        this._lastHitByObstacle.set(obs.id, now);

        // 🔧 BOOST : formule bornée
        const speedFactor = Math.max(15, speed) / this.config.referenceSpeed;
        const rawDamage = (obs.damagePoints || 5) * speedFactor;
        const damage = Math.round(clamp(rawDamage, 1, this.config.maxDamagePerHit));

        this.totalDamage = Math.min(this.config.totaledThreshold, this.totalDamage + damage);

        const severity = severityFor(damage);
        const message = buildMessage(obs, damage);
        const speedImpact = speed * this.config.speedImpactRatio;
        const totaled = this.totalDamage >= this.config.totaledThreshold;

        // 🔧 BOOST : kernel emit TROXT⬡
        this._kernel?.emit?.('troxtworld:collision', {
          obstacleId: obs.id,
          obstacleType: obs.type,
          obstacleName: obs.name,
          damage,
          severity,
          totalDamage: this.totalDamage,
          totaled,
          speedImpact,
        });

        // 🔧 BOOST : activeJams mis à jour
        this.activeJams = Array.from(jams);

        return {
          obstacle: obs,
          damage,
          speedImpact,
          message,
          severity,
          totalDamage: this.totalDamage,
          totaled,
        };
      }
    }

    // 🔧 BOOST : activeJams mis à jour même sans collision
    this.activeJams = Array.from(jams);
    return null;
  }

  // ─── Réparation ─────────────────────────────────────────────────────────
  /**
   * Réparation au bord de la route ou dépannage CAA.
   * @param {number} [amount=100]
   * @returns {{repaired:number, remainingDamage:number}}
   */
  repairVehicle(amount = 100) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { repaired: 0, remainingDamage: this.totalDamage };
    }
    const prev = this.totalDamage;
    this.totalDamage = Math.max(0, this.totalDamage - amount);
    const repaired = prev - this.totalDamage;

    this._kernel?.emit?.('troxtworld:repair', {
      repaired,
      remainingDamage: this.totalDamage,
    });

    return { repaired, remainingDamage: this.totalDamage };
  }

  // ─── Reset (save / load) ────────────────────────────────────────────────
  reset() {
    this.totalDamage = 0;
    this.activeJams = [];
    this._lastHitByObstacle.clear();
    this._lastDecayAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._kernel?.emit?.('troxtworld:vehicle.reset', {});
  }

  // ─── Queries ────────────────────────────────────────────────────────────
  /** Véhicule hors-service ? */
  isTotaled() {
    return this.totalDamage >= this.config.totaledThreshold;
  }

  /** Nombre de bouchons actuellement dans le rayon */
  getJamCount() {
    return this.activeJams.length;
  }

  /** Severity d'un impact donné (utilitaire UI) */
  getSeverityFor(damage) {
    return severityFor(damage);
  }

  /** État exportable (save) */
  exportState() {
    return {
      totalDamage: this.totalDamage,
      activeJams: [...this.activeJams],
      lastHits: Array.from(this._lastHitByObstacle.entries()),
    };
  }

  /** Restauration d'état (load) */
  importState(state) {
    if (!state) return;
    this.totalDamage = clamp(state.totalDamage ?? 0, 0, this.config.totaledThreshold);
    this.activeJams = Array.isArray(state.activeJams) ? [...state.activeJams] : [];
    this._lastHitByObstacle = new Map(state.lastHits || []);
    this._lastDecayAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}

// ─── SINGLETON (optionnel, usage global) ──────────────────────────────────
export const roadCollisionManager = new RoadCollisionManager();

// ─── HELPERS PUBLICS ──────────────────────────────────────────────────────
export { DEFAULT_CONFIG as ROAD_COLLISION_DEFAULTS, severityFor };
export { SIG };
export default RoadCollisionManager;
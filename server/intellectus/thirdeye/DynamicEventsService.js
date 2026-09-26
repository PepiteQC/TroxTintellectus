/**
 * ═══════════════════════════════════════════════════════════════════
 * 👁️ THIRDEYE — DIRECTEUR D'ÉVÉNEMENTS DYNAMIQUES DU COMTÉ DE PORTNEUF (v3.0)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Capacités :
 *  - Génération d'événements procéduraux et contextuels (SQ, Hydro-Québec, MTQ, SOPFEU)
 *  - Application de modificateurs globaux agrégés sur l'économie, le trafic et la météo
 *  - Traçabilité et historique persistant (survit aux hot-reloads Vite)
 *  - Déclenchement automatique d'urgences pour dynamiser le roleplay
 *  - Système de diffusion vers HUD, radios et bus Intellectus
 *  - 8 templates réalistes du Québec rural
 *
 * Signature : TROXT⬡ · 👁️ThirdEye
 * Chemin    : server\intellectus\admin\thirdeye/DynamicEventsService.js
 */

const SIG = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES & ENUMS
// ═══════════════════════════════════════════════════════════════════

export const EventCategory = Object.freeze({
  METEO: 'meteo',
  INFRASTRUCTURES: 'infrastructures',
  URGENCE: 'urgence',
  ECONOMIE: 'economie',
  SOCIAL: 'social',
  ENVIRONNEMENT: 'environnement',
});

export const EventSeverity = Object.freeze({
  MINEUR: 'mineur',
  MAJEUR: 'majeur',
  CATASTROPHE: 'catastrophe',
});

const SEVERITY_RANK = Object.freeze({
  mineur: 1,
  majeur: 2,
  catastrophe: 3,
});

const VALID_CATEGORIES = new Set(Object.values(EventCategory));
const VALID_SEVERITIES = new Set(Object.values(EventSeverity));

// Coordonnées de référence du comté de Portneuf (A-40 / R-138)
const LANDMARKS = Object.freeze({
  A40_DONNACONA:    { x: -800, y: 2, z: 100 },
  A40_ST_MARC:      { x: -600, y: 2, z: 80 },
  A40_NEUVILLE:     { x: -400, y: 2, z: 60 },
  A40_PONT_ROUGE:   { x: -200, y: 2, z: 40 },
  R138_ST_ALBAN:    { x: -450, y: 2, z: -150 },
  R138_DESCHAMBAULT:{ x: -700, y: 2, z: -200 },
  PORTNEUF_CENTRE:  { x: 120, y: 2, z: 400 },
  ST_CASIMIR:       { x: -900, y: 2, z: -280 },
  ST_RAYMOND:       { x: -350, y: 2, z: -350 },
  CAP_SANTE:        { x: -500, y: 2, z: 50 },
  FORET_NORD:       { x: -1000, y: 15, z: -600 },
  RIVIERE_PORTNEUF: { x: -300, y: 0, z: -100 },
});

// ═══════════════════════════════════════════════════════════════════
// TEMPLATES D'ÉVÉNEMENTS RÉALISTES (QUÉBEC / PORTNEUF)
// ═══════════════════════════════════════════════════════════════════

const EVENT_TEMPLATES = Object.freeze({
  blizzard: () => ({
    title: 'Tempête de poudrerie majeure sur l\'Autoroute 40',
    category: EventCategory.METEO,
    severity: EventSeverity.MAJEUR,
    locationName: 'A-40 entre Donnacona et Saint-Marc-des-Carrières',
    coordinates: [LANDMARKS.A40_DONNACONA.x, 2, LANDMARKS.A40_DONNACONA.z],
    description: 'Vents violents du nord-est à 80 km/h, visibilité nulle par intermittence. Sorties de route signalées par la SQ.',
    durationMinutes: 90,
    impacts: [
      'Vitesse maximale conseillée : 50 km/h',
      'Intervention prioritaire des chasse-neige du MTQ',
      'Risque accru de patinage sur ponts et viaducs',
    ],
    globalModifiers: { speedLimitMultiplier: 0.6, policeAggressiveness: 0.8 },
  }),

  outage: () => ({
    title: 'Panne générale Hydro-Québec — Ligne 25 kV',
    category: EventCategory.INFRASTRUCTURES,
    severity: EventSeverity.MAJEUR,
    locationName: 'Bourg patrimonial de Saint-Casimir',
    coordinates: [LANDMARKS.ST_CASIMIR.x, 2, LANDMARKS.ST_CASIMIR.z],
    description: 'Bris de matériel sur le réseau de distribution principal suite à des accumulations de verglas.',
    durationMinutes: 60,
    impacts: [
      'Coupure totale de l\'éclairage public et des feux de circulation',
      'Activation des génératrices de secours institutionnelles',
      'Intervention des monteurs de lignes d\'Hydro-Québec requise',
    ],
    globalModifiers: { powerOutage: true, commerceMultiplier: 0.7 },
  }),

  policeCheckpoint: () => ({
    title: 'Opération Marteau — Barrage routier Sûreté du Québec',
    category: EventCategory.URGENCE,
    severity: EventSeverity.MINEUR,
    locationName: 'Route 138, Entrée est de Saint-Alban',
    coordinates: [LANDMARKS.R138_ST_ALBAN.x, 2, LANDMARKS.R138_ST_ALBAN.z],
    description: 'Contrôle routier intensif de la SQ ciblant les capacités affaiblies et la vérification des immatriculations.',
    durationMinutes: 45,
    impacts: [
      'Ralentissements majeurs sur la route 138',
      'Fouilles aléatoires des coffres de véhicules',
      'Tolérance zéro pour les infractions au Code de la sécurité routière',
    ],
    globalModifiers: { policeAggressiveness: 1.5, speedLimitMultiplier: 0.8 },
  }),

  festival: () => ({
    title: 'Festival de la patate et foire agricole de Portneuf',
    category: EventCategory.SOCIAL,
    severity: EventSeverity.MINEUR,
    locationName: 'Parc municipal de Portneuf',
    coordinates: [LANDMARKS.PORTNEUF_CENTRE.x, 2, LANDMARKS.PORTNEUF_CENTRE.z],
    description: 'Rassemblement populaire, kiosques de producteurs locaux et afflux touristique important.',
    durationMinutes: 120,
    impacts: [
      'Stationnement interdit sur le pourtour du parc',
      'Présence accrue de patrouilleurs à pied',
      'Hausse de l\'activité commerciale locale (+30%)',
    ],
    globalModifiers: { commerceMultiplier: 1.3, trafficDensity: 1.4 },
  }),

  forestFire: () => ({
    title: 'Feu de forêt hors contrôle — Secteur nord de Portneuf',
    category: EventCategory.ENVIRONNEMENT,
    severity: EventSeverity.CATASTROPHE,
    locationName: 'Forêt boréale au nord de Saint-Raymond',
    coordinates: [LANDMARKS.FORET_NORD.x, 15, LANDMARKS.FORET_NORD.z],
    description: 'Incendie de forêt de 200 hectares alimenté par des vents secs du sud-ouest. Évacuations en cours.',
    durationMinutes: 180,
    impacts: [
      'Évacuation obligatoire des résidences dans un rayon de 5 km',
      'Fermeture de la route 365 par la SQ',
      'Déploiement des pompiers volontaires et de la SOPFEU',
      'Qualité de l\'air dangereuse — masque recommandé',
    ],
    globalModifiers: { speedLimitMultiplier: 0.5, policeAggressiveness: 1.2, powerOutage: true },
  }),

  flood: () => ({
    title: 'Crue printanière de la rivière Portneuf',
    category: EventCategory.ENVIRONNEMENT,
    severity: EventSeverity.MAJEUR,
    locationName: 'Pont de la rivière Portneuf, secteur Cap-Santé',
    coordinates: [LANDMARKS.RIVIERE_PORTNEUF.x, 0, LANDMARKS.RIVIERE_PORTNEUF.z],
    description: 'Montée rapide des eaux suite à la fonte des neiges. Le pont principal est submergé.',
    durationMinutes: 150,
    impacts: [
      'Pont de la R-138 fermé à la circulation',
      'Détour obligatoire via Saint-Raymond (ajout de 25 min)',
      'Inondation des sous-sols dans le secteur bas de Cap-Santé',
    ],
    globalModifiers: { speedLimitMultiplier: 0.7, trafficDensity: 1.6 },
  }),

  highwayAccident: () => ({
    title: 'Collision multiple sur l\'A-40 — 5 véhicules impliqués',
    category: EventCategory.URGENCE,
    severity: EventSeverity.MAJEUR,
    locationName: 'A-40 ouest, km 261, sortie Neuville',
    coordinates: [LANDMARKS.A40_NEUVILLE.x, 2, LANDMARKS.A40_NEUVILLE.z],
    description: 'Accident en chaîne impliquant un camion-citerne et 4 automobiles. Possibles matières dangereuses.',
    durationMinutes: 75,
    impacts: [
      'Fermeture complète de l\'A-40 ouest entre Donnacona et Neuville',
      'Déviation par la route 138 — embouteillages majeurs',
      'Intervention HAZMAT et ambulances en cours',
    ],
    globalModifiers: { speedLimitMultiplier: 0.4, trafficDensity: 2.0, policeAggressiveness: 1.3 },
  }),

  epidemic: () => ({
    title: 'Épidémie de gastroentérite — École primaire de Deschambault',
    category: EventCategory.SOCIAL,
    severity: EventSeverity.MINEUR,
    locationName: 'École primaire de Deschambault-Grondines',
    coordinates: [LANDMARKS.R138_DESCHAMBAULT.x, 2, LANDMARKS.R138_DESCHAMBAULT.z],
    description: 'Foyer d\'infection confirmé par la Santé publique. 40 élèves et 6 membres du personnel touchés.',
    durationMinutes: 240,
    impacts: [
      'Fermeture temporaire de l\'école pour désinfection',
      'Avis de la Direction de la santé publique de Portneuf',
      'Affluence accrue à l\'urgence de l\'hôpital de Portneuf',
    ],
    globalModifiers: { commerceMultiplier: 0.9 },
  }),
});

// ═══════════════════════════════════════════════════════════════════
// REGISTRE PERSISTANT (SURVIT AUX HOT-RELOADS VITE)
// ═══════════════════════════════════════════════════════════════════

const STORE_KEY = Symbol.for('troxt.thirdeye.events-store.v3');

function createEventStore() {
  return {
    activeEvents: [],
    history: [],
    listeners: new Set(),
    tickCount: 0,
    initialized: false,
  };
}

const store = globalThis[STORE_KEY] ?? createEventStore();
globalThis[STORE_KEY] = store;

// ═══════════════════════════════════════════════════════════════════
// SERVICE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export class DynamicEventsService {
  constructor() {
    this.sig = SIG;
  }

  /**
   * Retourne l'instance singleton globale.
   * @returns {DynamicEventsService}
   */
  static getInstance() {
    if (!globalThis.__TROXT_DYNAMIC_EVENTS_INSTANCE__) {
      globalThis.__TROXT_DYNAMIC_EVENTS_INSTANCE__ = new DynamicEventsService();
    }
    return globalThis.__TROXT_DYNAMIC_EVENTS_INSTANCE__;
  }

  // ─── LECTURE ──────────────────────────────────────────────────────

  /**
   * Retourne uniquement les événements actuellement actifs (non expirés).
   * @returns {object[]}
   */
  getActiveEvents() {
    this._expireOld();
    return store.activeEvents.filter((e) => e.active);
  }

  /**
   * Retourne tous les événements (actifs + résolus en mémoire).
   * @returns {object[]}
   */
  getAll() {
    return [...store.activeEvents];
  }

  /**
   * Retourne l'historique complet des événements résolus/expirés.
   * @param {number} [limit=50]
   * @returns {object[]}
   */
  getHistory(limit = 50) {
    return store.history.slice(0, limit);
  }

  /**
   * Retourne l'alerte prioritaire pour affichage HUD / radio.
   * @returns {{ title: string, severity: string, locationName: string } | null}
   */
  banner() {
    const live = this.getActiveEvents();
    if (live.length === 0) return null;

    live.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));
    const top = live[0];

    return {
      title: top.title,
      severity: top.severity,
      locationName: top.locationName,
    };
  }

  /**
   * Vérifie si un modificateur global spécifique est actif.
   * @param {string} modifierKey - Ex: 'powerOutage', 'speedLimitMultiplier'
   * @returns {boolean}
   */
  hasGlobalModifier(modifierKey) {
    return this.getActiveEvents().some(
      (e) => e.globalModifiers && e.globalModifiers[modifierKey] !== undefined && e.globalModifiers[modifierKey] !== false
    );
  }

  /**
   * Calcule les modificateurs globaux agrégés de tous les événements actifs.
   * Les multiplicateurs sont combinés (produit), les booléens sont en OU logique.
   * @returns {object}
   */
  getAggregatedModifiers() {
    const active = this.getActiveEvents();
    const result = {
      speedLimitMultiplier: 1.0,
      policeAggressiveness: 1.0,
      commerceMultiplier: 1.0,
      trafficDensity: 1.0,
      powerOutage: false,
    };

    for (const event of active) {
      const mods = event.globalModifiers;
      if (!mods) continue;

      if (typeof mods.speedLimitMultiplier === 'number') {
        result.speedLimitMultiplier *= mods.speedLimitMultiplier;
      }
      if (typeof mods.policeAggressiveness === 'number') {
        result.policeAggressiveness *= mods.policeAggressiveness;
      }
      if (typeof mods.commerceMultiplier === 'number') {
        result.commerceMultiplier *= mods.commerceMultiplier;
      }
      if (typeof mods.trafficDensity === 'number') {
        result.trafficDensity *= mods.trafficDensity;
      }
      if (mods.powerOutage === true) {
        result.powerOutage = true;
      }
    }

    // Arrondir pour éviter les floats aberrants
    result.speedLimitMultiplier = parseFloat(result.speedLimitMultiplier.toFixed(2));
    result.policeAggressiveness = parseFloat(result.policeAggressiveness.toFixed(2));
    result.commerceMultiplier = parseFloat(result.commerceMultiplier.toFixed(2));
    result.trafficDensity = parseFloat(result.trafficDensity.toFixed(2));

    return result;
  }

  // ─── ÉCRITURE ─────────────────────────────────────────────────────

  /**
   * Déclenche un événement personnalisé dans le comté.
   * @param {object} eventData - Données de l'événement (sans id, startedAt, active)
   * @returns {object} L'événement créé
   */
  triggerEvent(eventData) {
    if (!eventData || typeof eventData !== 'object') {
      throw new Error('[ThirdEye·Events] Données d\'événement invalides.');
    }

    const category = VALID_CATEGORIES.has(eventData.category)
      ? eventData.category
      : EventCategory.URGENCE;

    const severity = VALID_SEVERITIES.has(eventData.severity)
      ? eventData.severity
      : EventSeverity.MINEUR;

    const newEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: String(eventData.title || 'Événement inconnu').slice(0, 120),
      category,
      severity,
      locationName: String(eventData.locationName || 'Portneuf').slice(0, 80),
      coordinates: Array.isArray(eventData.coordinates) ? eventData.coordinates : [0, 2, 0],
      description: String(eventData.description || '').slice(0, 500),
      active: true,
      startedAt: Date.now(),
      durationMinutes: Math.max(5, parseInt(eventData.durationMinutes, 10) || 60),
      impacts: Array.isArray(eventData.impacts) ? eventData.impacts : [],
      globalModifiers: eventData.globalModifiers || {},
    };

    store.activeEvents.unshift(newEvent);

    // Limite de sécurité mémoire
    if (store.activeEvents.length > 50) {
      const removed = store.activeEvents.pop();
      if (removed.active) {
        removed.active = false;
        this._archiveEvent(removed, 'EVICTED');
      }
    }

    this._notify('event:triggered', newEvent);
    this._persistLog(newEvent, 'TRIGGERED');

    return newEvent;
  }

  // ─── DÉCLENCHEURS RAPIDES (TEMPLATES) ─────────────────────────────

  triggerBlizzard() {
    const existing = store.activeEvents.find(
      (e) => e.category === EventCategory.METEO && e.active
    );
    if (existing) {
      existing.startedAt = Date.now();
      existing.durationMinutes = 90;
      this._notify('event:extended', existing);
      return existing;
    }
    return this.triggerEvent(EVENT_TEMPLATES.blizzard());
  }

  triggerOutage() {
    const existing = store.activeEvents.find(
      (e) => e.category === EventCategory.INFRASTRUCTURES && e.active
    );
    if (existing) {
      existing.startedAt = Date.now();
      this._notify('event:extended', existing);
      return existing;
    }
    return this.triggerEvent(EVENT_TEMPLATES.outage());
  }

  triggerPoliceCheckpoint() {
    return this.triggerEvent(EVENT_TEMPLATES.policeCheckpoint());
  }

  triggerFestival() {
    return this.triggerEvent(EVENT_TEMPLATES.festival());
  }

  triggerForestFire() {
    return this.triggerEvent(EVENT_TEMPLATES.forestFire());
  }

  triggerFlood() {
    return this.triggerEvent(EVENT_TEMPLATES.flood());
  }

  triggerHighwayAccident() {
    return this.triggerEvent(EVENT_TEMPLATES.highwayAccident());
  }

  triggerEpidemic() {
    return this.triggerEvent(EVENT_TEMPLATES.epidemic());
  }

  /**
   * Génère un événement aléatoire procédural pour dynamiser le RP.
   * @returns {object}
   */
  triggerRandomEvent() {
    const generators = Object.values(EVENT_TEMPLATES);
    const idx = Math.floor(Math.random() * generators.length);
    return this.triggerEvent(generators[idx]());
  }

  /**
   * Génère un événement contextuel basé sur l'heure et la saison.
   * @param {object} [context]
   * @param {number} [context.hour] - Heure du jour (0-23)
   * @param {string} [context.season] - Saison (spring, summer, fall, winter)
   * @returns {object}
   */
  triggerContextualEvent(context = {}) {
    const hour = context.hour ?? new Date().getHours();
    const season = context.season ?? 'summer';

    // Nuit → accidents et crimes
    if (hour >= 22 || hour <= 5) {
      if (Math.random() > 0.5) return this.triggerHighwayAccident();
      return this.triggerPoliceCheckpoint();
    }

    // Hiver → blizzards et pannes
    if (season === 'winter') {
      if (Math.random() > 0.4) return this.triggerBlizzard();
      return this.triggerOutage();
    }

    // Printemps → inondations
    if (season === 'spring' && Math.random() > 0.6) {
      return this.triggerFlood();
    }

    // Été → festivals et feux de forêt
    if (season === 'summer') {
      if (Math.random() > 0.5) return this.triggerFestival();
      return this.triggerForestFire();
    }

    // Automne → épidémies et accidents
    if (Math.random() > 0.5) return this.triggerEpidemic();
    return this.triggerHighwayAccident();
  }

  // ─── RÉSOLUTION ───────────────────────────────────────────────────

  /**
   * Résout un événement spécifique par son ID.
   * @param {string} eventId
   * @returns {boolean}
   */
  resolveEvent(eventId) {
    const event = store.activeEvents.find((e) => e.id === eventId);
    if (!event || !event.active) return false;

    event.active = false;
    this._archiveEvent(event, 'RESOLVED');
    this._notify('event:resolved', event);
    return true;
  }

  /**
   * Résout tous les événements d'une catégorie donnée.
   * @param {string} category
   * @returns {number} Nombre d'événements résolus
   */
  resolveCategory(category) {
    let count = 0;
    for (const event of store.activeEvents) {
      if (event.category === category && event.active) {
        event.active = false;
        count++;
        this._archiveEvent(event, 'RESOLVED_CATEGORY');
      }
    }
    if (count > 0) {
      this._notify('category:resolved', { category, count });
    }
    return count;
  }

  /**
   * Désactive tous les événements actifs.
   */
  clearAll() {
    let count = 0;
    for (const event of store.activeEvents) {
      if (event.active) {
        event.active = false;
        count++;
        this._archiveEvent(event, 'CLEARED');
      }
    }
    if (count > 0) {
      this._notify('all:cleared', { count });
    }
  }

  // ─── BOUCLE DE TICK ───────────────────────────────────────────────

  /**
   * Boucle de rafraîchissement appelée par le tick principal du serveur.
   * Expire les événements dont la durée est écoulée.
   * @returns {object[]} Événements encore actifs
   */
  tick() {
    store.tickCount++;
    this._expireOld();
    return this.getActiveEvents();
  }

  // ─── SYSTÈME DE DIFFUSION ─────────────────────────────────────────

  /**
   * Abonne un callback aux événements du directeur.
   * @param {function} listener - Reçoit (eventName, payload)
   * @returns {function} Unsubscribe
   */
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  }

  // ─── HELPERS PRIVÉS ───────────────────────────────────────────────

  _expireOld() {
    const now = Date.now();
    for (const event of store.activeEvents) {
      if (!event.active) continue;
      const elapsed = now - event.startedAt;
      if (elapsed > event.durationMinutes * 60000) {
        event.active = false;
        this._archiveEvent(event, 'EXPIRED');
        this._notify('event:expired', event);
      }
    }
  }

  _archiveEvent(event, reason) {
    store.history.unshift({
      ...event,
      resolvedAt: Date.now(),
      resolutionReason: reason,
    });
    if (store.history.length > 200) {
      store.history.length = 200;
    }
    this._persistLog(event, reason);
  }

  _notify(eventName, payload) {
    for (const listener of store.listeners) {
      try {
        listener(eventName, payload);
      } catch (err) {
        console.error(`[${SIG}·Events] Erreur dans un listener:`, err?.message || err);
      }
    }

    // Relais vers Intellectus si disponible
    const intellectus = globalThis.__TROXT_INTELLECTUS__;
    if (typeof intellectus?.emit === 'function') {
      try {
        intellectus.emit(`thirdeye:${eventName}`, {
          ...payload,
          sig: SIG,
          isig: ISIG,
        });
      } catch {
        // Silencieux
      }
    }
  }

  async _persistLog(event, action) {
    try {
      // Intégration Drizzle ORM (optionnelle)
      const dbModule = globalThis.__TROXT_DB__;
      if (dbModule && typeof dbModule.insert === 'function') {
        await dbModule.insert('game_logs', {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          event: `THIRD_EYE_${action}`,
          details: `${event.title} [${event.severity}] à ${event.locationName}`,
          metadata: JSON.stringify({ eventId: event.id, category: event.category }),
          timestamp: Date.now(),
        });
      }
    } catch {
      // Silencieux si DB non connectée
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// INSTANCE GLOBALE
// ═══════════════════════════════════════════════════════════════════

export const dynamicEventsService = DynamicEventsService.getInstance();

export default DynamicEventsService;
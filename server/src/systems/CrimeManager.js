/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/CRIMEMANAGER.JS (v3.0 Platinum Edition)
 * Système Judiciaire, Avis de Recherche & Criminalité (SQ / SPVM)
 * ═══════════════════════════════════════════════════════════════════
 * Gère le casier et les poursuites en temps réel :
 *   • Catalogue d'infractions réalistes (Code de la Sécurité Routière & Code Criminel)
 *   • Attribution et cumul dynamique d'étoiles (1 à 5 étoiles)
 *   • Calcul des amendes cumulées et temps de détention suggéré
 *   • Décroissance passive des étoiles de recherche (Cooldown d'évasion)
 *   • Intégration d'événements réactifs (WebSockets, alertes Dispatch 911)
 *
 * Signature : TROXT⬡ · ⚖️JusticeQuébec
 * Chemin    : server/systems/CrimeManager.js
 */

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

// ═══════════════════════════════════════════════════════════════════
// CATALOGUE DES CRIMES ET INFRACTIONS (QUÉBEC)
// ═══════════════════════════════════════════════════════════════════

export const CRIMES_CATALOG = Object.freeze({
  // ── Code de la Sécurité Routière (1 Étoile) ──
  speeding_minor: {
    id:                     "speeding_minor",
    label:                  "Excès de vitesse modéré (15-30 km/h)",
    starsAdded:             1,
    fineAmount:             175,
    suggestedPrisonMinutes: 0,
    category:               "traffic",
  },
  speeding_major: {
    id:                     "speeding_major",
    label:                  "Grand excès de vitesse (> 45 km/h)",
    starsAdded:             1,
    fineAmount:             350,
    suggestedPrisonMinutes: 5,
    category:               "traffic",
  },
  reckless_driving: {
    id:                     "reckless_driving",
    label:                  "Conduite dangereuse / Téméraire",
    starsAdded:             1,
    fineAmount:             500,
    suggestedPrisonMinutes: 10,
    category:               "traffic",
  },
  trespassing: {
    id:                     "trespassing",
    label:                  "Violation de propriété privée / Intrusion",
    starsAdded:             1,
    fineAmount:             250,
    suggestedPrisonMinutes: 5,
    category:               "property",
  },

  // ── Infractions Graves (2 Étoiles) ──
  unlawful_carrying: {
    id:                     "unlawful_carrying",
    label:                  "Port d'arme prohibée / Sans permis",
    starsAdded:             2,
    fineAmount:             1000,
    suggestedPrisonMinutes: 15,
    category:               "weapons",
  },
  refusal_to_comply: {
    id:                     "refusal_to_comply",
    label:                  "Refus d'obtempérer / Fuite à pied",
    starsAdded:             2,
    fineAmount:             750,
    suggestedPrisonMinutes: 10,
    category:               "police",
  },
  drug_possession: {
    id:                     "drug_possession",
    label:                  "Possession de stupéfiants avec intention de trafic",
    starsAdded:             2,
    fineAmount:             1200,
    suggestedPrisonMinutes: 20,
    category:               "drugs",
  },

  // ── Crimes Majeurs (3 Étoiles) ──
  grand_theft: {
    id:                     "grand_theft",
    label:                  "Vol qualifié de véhicule automobile (GTA)",
    starsAdded:             3,
    fineAmount:             2500,
    suggestedPrisonMinutes: 25,
    category:               "theft",
  },
  atm_robbery: {
    id:                     "atm_robbery",
    label:                  "Effraction de guichet automatique (GAB Desjardins)",
    starsAdded:             3,
    fineAmount:             3500,
    suggestedPrisonMinutes: 30,
    category:               "robbery",
  },
  police_chase: {
    id:                     "police_chase",
    label:                  "Fuite en véhicule à haute vitesse (10-80)",
    starsAdded:             3,
    fineAmount:             2000,
    suggestedPrisonMinutes: 25,
    category:               "police",
  },

  // ── Crimes Fédéraux & Violences Armées (4-5 Étoiles) ──
  armed_robbery: {
    id:                     "armed_robbery",
    label:                  "Braquage à main armée de commerce / Banque",
    starsAdded:             4,
    fineAmount:             6000,
    suggestedPrisonMinutes: 45,
    category:               "robbery",
  },
  officer_assault: {
    id:                     "officer_assault",
    label:                  "Agression armée sur agent de la paix (SQ/SPVM)",
    starsAdded:             5,
    fineAmount:             10000,
    suggestedPrisonMinutes: 60,
    category:               "violence",
  },
  heist_garda: {
    id:                     "heist_garda",
    label:                  "Attaque à l'explosif sur fourgon blindé Garda",
    starsAdded:             5,
    fineAmount:             15000,
    suggestedPrisonMinutes: 90,
    category:               "heist",
  },
  prison_escape: {
    id:                     "prison_escape",
    label:                  "Évasion du pénitencier de Donnacona (10-99)",
    starsAdded:             5,
    fineAmount:             20000,
    suggestedPrisonMinutes: 120,
    category:               "escape",
  },
});

// ═══════════════════════════════════════════════════════════════════
// REGISTRE EN MÉMOIRE PERSISTANT AUX HOT-RELOADS
// ═══════════════════════════════════════════════════════════════════

const CRIME_STORE_KEY = Symbol.for("troxt.crime.store.v3");

function createCrimeStore() {
  return {
    wantedPlayers:        new Map(), // playerId -> WantedStatus
    updateListeners:      new Set(), // Callbacks
    totalCrimesRecorded:  0,
    totalArrestsMade:     0,
    totalFinesIssued:     0,
  };
}

const store = globalThis[CRIME_STORE_KEY] ?? createCrimeStore();
globalThis[CRIME_STORE_KEY] = store;

// ═══════════════════════════════════════════════════════════════════
// GESTIONNAIRE JUDICIAIRE CENTRAL : CrimeManager
// ═══════════════════════════════════════════════════════════════════

export class CrimeManager {
  constructor() {
    this.sig = SIG;
  }

  // ─── COMMISSION DE CRIMES & ACCUSATIONS ───────────────────────────

  /**
   * Enregistre un crime commis par un joueur.
   * @param {string} playerId 
   * @param {string} playerName 
   * @param {string} crimeId - Clé dans CRIMES_CATALOG
   * @param {object} [extraDetails={}] 
   * @returns {boolean}
   */
  commitCrime(playerId, playerName, crimeId, extraDetails = {}) {
    const crime = CRIMES_CATALOG[crimeId];
    if (!crime || !playerId) return false;

    let status = store.wantedPlayers.get(playerId);
    if (!status) {
      status = {
        playerId,
        playerName:             playerName || `Suspect_${playerId.slice(0, 5)}`,
        stars:                  0,
        totalFines:             0,
        suggestedPrisonMinutes: 0,
        activeCrimes:           [],
        history:                [],
        lastCrimeAt:            Date.now(),
        lastDecayAt:            Date.now(),
        isUnderActivePursuit:   false,
      };
      store.wantedPlayers.set(playerId, status);
    }

    // Mise à jour de l'état de recherche
    status.stars = Math.min(5, status.stars + crime.starsAdded);
    status.totalFines += crime.fineAmount;
    status.suggestedPrisonMinutes += crime.suggestedPrisonMinutes;
    status.lastCrimeAt = Date.now();
    status.lastDecayAt = Date.now();
    status.isUnderActivePursuit = true;

    if (!status.activeCrimes.includes(crimeId)) {
      status.activeCrimes.push(crimeId);
    }

    status.history.unshift({
      crimeId,
      label:     crime.label,
      fine:      crime.fineAmount,
      timestamp: Date.now(),
      ...extraDetails,
    });
    if (status.history.length > 20) status.history.pop();

    store.totalCrimesRecorded++;
    store.totalFinesIssued += crime.fineAmount;

    this.notifyUpdate("crime_committed", {
      playerId,
      playerName:             status.playerName,
      crimeId,
      crimeLabel:             crime.label,
      stars:                  status.stars,
      fine:                   crime.fineAmount,
      totalFines:             status.totalFines,
      suggestedPrisonMinutes: status.suggestedPrisonMinutes,
    });

    return true;
  }

  /**
   * Ajoute manuellement des étoiles de recherche (ex: tir sur patrouille).
   * @param {string} playerId 
   * @param {string} playerName 
   * @param {number} stars 
   * @param {string} [reason="Infraction au code de loi"] 
   * @param {number} [fine=0] 
   */
  addStars(playerId, playerName, stars, reason = "Infraction générale", fine = 0) {
    if (!playerId) return false;

    let status = store.wantedPlayers.get(playerId);
    if (!status) {
      status = {
        playerId,
        playerName:             playerName || `Suspect_${playerId.slice(0, 5)}`,
        stars:                  0,
        totalFines:             0,
        suggestedPrisonMinutes: 0,
        activeCrimes:           [],
        history:                [],
        lastCrimeAt:            Date.now(),
        lastDecayAt:            Date.now(),
        isUnderActivePursuit:   true,
      };
      store.wantedPlayers.set(playerId, status);
    }

    status.stars = Math.min(5, status.stars + (parseInt(stars, 10) || 1));
    status.totalFines += Math.max(0, fine);
    status.lastCrimeAt = Date.now();
    status.lastDecayAt = Date.now();

    this.notifyUpdate("stars_added", {
      playerId,
      playerName: status.playerName,
      stars:      status.stars,
      reason,
      fine,
    });

    return true;
  }

  // ─── DÉCROISSANCE TEMPORELLE DES ÉTOILES (DECAY TICK) ─────────────

  /**
   * Boucle de décroissance passive appelée périodiquement (ex: toutes les minutes).
   * Les étoiles baissent si le joueur n'a pas commis de crime récent et n'est pas en vue directe.
   * @param {number} [decayIntervalMinutes=3] 
   */
  decayTick(decayIntervalMinutes = 3) {
    const now = Date.now();
    const decayMs = decayIntervalMinutes * 60 * 1000;

    for (const [playerId, status] of store.wantedPlayers.entries()) {
      if (status.stars <= 0) continue;

      // Décroissance possible si aucun crime récent
      if (now - status.lastCrimeAt >= decayMs && now - status.lastDecayAt >= decayMs) {
        status.stars = Math.max(0, status.stars - 1);
        status.lastDecayAt = now;

        this.notifyUpdate("stars_decayed", {
          playerId,
          playerName:     status.playerName,
          remainingStars: status.stars,
        });

        // Si 0 étoile et aucune amende bloquante restante -> purge de l'avis de recherche actif
        if (status.stars === 0) {
          status.isUnderActivePursuit = false;
        }
      }
    }
  }

  // ─── ARRESTATION & PURGE DE RECHERCHE ─────────────────────────────

  /**
   * Enregistre l'arrestation formelle d'un suspect par un officier.
   * @param {string} playerId 
   * @param {number} [prisonMinutes] 
   * @param {string} [officerName="Agent SQ"] 
   */
  arrestPlayer(playerId, prisonMinutes = null, officerName = "Agent SQ") {
    const status = store.wantedPlayers.get(playerId);
    if (!status) return false;

    const actualPrisonTime = prisonMinutes ?? Math.max(5, status.suggestedPrisonMinutes);
    const finesToPay = status.totalFines;

    store.wantedPlayers.delete(playerId);
    store.totalArrestsMade++;

    this.notifyUpdate("player_arrested", {
      playerId,
      playerName:    status.playerName,
      prisonMinutes: actualPrisonTime,
      finesPaid:     finesToPay,
      officerName,
    });

    return true;
  }

  /**
   * Purge manuellement le statut recherché (ex: relaxe, fin de peine).
   * @param {string} playerId 
   * @param {string} [reason="Purge administrative"] 
   */
  clearWanted(playerId, reason = "Avis révoqué") {
    const existed = store.wantedPlayers.delete(playerId);
    if (existed) {
      this.notifyUpdate("wanted_cleared", { playerId, reason });
    }
    return existed;
  }

  /**
   * Permet à un citoyen de régler ses amendes accumulées.
   * @param {string} playerId 
   * @param {number} amount 
   */
  payFines(playerId, amount) {
    const status = store.wantedPlayers.get(playerId);
    if (!status || status.totalFines <= 0) return { ok: false, message: "Aucune amende impayée." };

    const paid = Math.min(status.totalFines, Math.max(1, parseInt(amount, 10) || 0));
    status.totalFines -= paid;

    if (status.totalFines === 0 && status.stars <= 1) {
      this.clearWanted(playerId, "Amendes réglées intégralement");
    }

    this.notifyUpdate("fines_paid", { playerId, amountPaid: paid, remainingFines: status.totalFines });
    return { ok: true, amountPaid: paid, remainingFines: status.totalFines };
  }

  // ─── ACCESSEURS & CONSULTATION ────────────────────────────────────

  getWantedStatus(playerId) {
    return store.wantedPlayers.get(playerId) || null;
  }

  isWanted(playerId) {
    const s = store.wantedPlayers.get(playerId);
    return !!(s && s.stars > 0);
  }

  getWantedStars(playerId) {
    return store.wantedPlayers.get(playerId)?.stars || 0;
  }

  getAllWanted() {
    return Array.from(store.wantedPlayers.values()).sort((a, b) => b.stars - a.stars);
  }

  getStats() {
    const all = this.getAllWanted();
    return {
      activeWantedCount:   all.length,
      highPriorityCount:   all.filter((p) => p.stars >= 4).length,
      totalCrimesRecorded: store.totalCrimesRecorded,
      totalArrestsMade:    store.totalArrestsMade,
      totalFinesIssued:    store.totalFinesIssued,
      sig:                 SIG,
    };
  }

  // ─── ÉCOUTEURS D'ÉVÉNEMENTS (Event Listeners) ──────────────────────

  /**
   * S'abonne aux événements de criminalité et d'avis de recherche.
   * @param {function(object): void} callback 
   * @returns {function(): void} Fonction de désabonnement
   */
  onUpdate(callback) {
    if (typeof callback !== 'function') return () => {};
    store.updateListeners.add(callback);
    return () => store.updateListeners.delete(callback);
  }

  notifyUpdate(type, data = {}) {
    const payload = { type, timestamp: Date.now(), sig: SIG, isig: ISIG, ...data };
    for (const listener of store.updateListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[${SIG}·Crime] Erreur dans un écouteur:`, err?.message || err);
      }
    }
  }

  dispose() {
    store.updateListeners.clear();
    store.wantedPlayers.clear();
    console.log(`[${SIG}·Crime] Registre judiciaire libéré.`);
  }
}

export const crimeManager = new CrimeManager();
export default crimeManager;
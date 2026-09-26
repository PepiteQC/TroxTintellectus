/**
 * ═════════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/MONEYLAUNDERINGSYSTEM.JS (v3.0 Platinum Edition)
 * Système de Blanchiment d'Argent, Commerces Écrans & Fraude Fiscale RP
 * ═════════════════════════════════════════════════════════════════════════════
 * 
 * Modèle économique :
 *  • Dépôt d'argent sale (braquages, stupéfiants, contrebande) dans les commerces.
 *  • Conversion progressive (tick 60s) en argent propre crédité au compte bancaire.
 *  • Risque d'enquête fiscale (Revenu Québec / SQ) et saisie en cas d'abus.
 *  • Améliorations de gestion (Comptable corrompu, fausses factures, coquilles offshore).
 *
 * Signature : TROXT⬡ · 💼Laundromat
 * Chemin    : server/systems/MoneyLaunderingSystem.js
 */

import { db } from '../db/client.js';
import { characters, transactions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { triggerNotification } from './phone.js';
import { dispatchPolice, addWantedPoints } from './police.js';

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

// ═══════════════════════════════════════════════════════════════════
// CATALOGUE DES COMMERCES ÉCRANS DU QUÉBEC
// ═══════════════════════════════════════════════════════════════════

export const FRONT_BUSINESS_TYPES = Object.freeze({
  lave_auto: {
    type:               'lave_auto',
    label:              'Lave-Auto Express',
    icon:               '🚗',
    defaultRate:        0.80,  // 20% de commission/perte
    baseCapacityHourly: 8000,
    suspicionFactor:    0.04,
  },
  bar_danseuses: {
    type:               'bar_danseuses',
    label:              'Club Éther Strip / Bar lounge',
    icon:               '🍸',
    defaultRate:        0.85,  // 15% de commission (très efficace pour le liquide)
    baseCapacityHourly: 15000,
    suspicionFactor:    0.025,
  },
  excavation: {
    type:               'excavation',
    label:              'Excavation & Génie Civil Portneuf',
    icon:               '🏗️',
    defaultRate:        0.90,  // 10% de commission (grosses factures de chantiers)
    baseCapacityHourly: 30000,
    suspicionFactor:    0.02,
  },
  pizzeria: {
    type:               'pizzeria',
    label:              'Pizzeria & Trattoria Italienne',
    icon:               '🍕',
    defaultRate:        0.75,  // 25% de commission
    baseCapacityHourly: 6000,
    suspicionFactor:    0.05,
  },
  pourvoirie: {
    type:               'pourvoirie',
    label:              'Pourvoirie & Chalets de Chasse',
    icon:               '🌲',
    defaultRate:        0.80,  // 20% de commission
    baseCapacityHourly: 10000,
    suspicionFactor:    0.035,
  },
  depanneur: {
    type:               'depanneur',
    label:              'Dépanneur du Rang',
    icon:               '🏪',
    defaultRate:        0.70,  // 30% de commission (faible volume de sécurité)
    baseCapacityHourly: 5000,
    suspicionFactor:    0.06,
  },
});

export const BUSINESS_UPGRADES = Object.freeze({
  fake_invoices: {
    id:          'fake_invoices',
    label:       'Système de double facturation',
    description: 'Augmente la capacité maximale de traitement horaire de +50%.',
    cost:        25000,
    capacityMul: 1.5,
    rateBonus:   0,
    suspicionMul:1.1,
  },
  crooked_accountant: {
    id:          'crooked_accountant',
    label:       'Comptable agréé véreux',
    description: 'Réduit l\'accumulation de soupçons fiscaux de 40%.',
    cost:        45000,
    capacityMul: 1.0,
    rateBonus:   0.02,
    suspicionMul:0.6,
  },
  offshore_shell: {
    id:          'offshore_shell',
    label:       'Filiale écran aux Bahamas',
    description: 'Améliore le taux de retour net en argent propre de +5%.',
    cost:        75000,
    capacityMul: 1.2,
    rateBonus:   0.05,
    suspicionMul:0.8,
  },
});

// ═══════════════════════════════════════════════════════════════════
// REGISTRE EN MÉMOIRE PERSISTANT AUX RECHARGEMENTS VITE
// ═══════════════════════════════════════════════════════════════════

const STORE_KEY = Symbol.for('troxt.laundering.state.v3');

function createLaunderingStore() {
  return {
    frontBusinesses:     new Map(),
    totalCleanLaundered: 0,
    totalDirtyInjected:  0,
    totalAuditsFaced:    0,
  };
}

const store = globalThis[STORE_KEY] ?? createLaunderingStore();
globalThis[STORE_KEY] = store;

// ═══════════════════════════════════════════════════════════════════
// CLASSE DU SYSTÈME DE BLANCHIMENT
// ═══════════════════════════════════════════════════════════════════

export class MoneyLaunderingSystem {
  constructor() {
    this.sig = SIG;
  }

  // ─── ENREGISTREMENT & GESTION DU COMMERCE ─────────────────────────

  /**
   * Enregistre ou initialise un commerce de façade pour un joueur.
   * @param {string} id 
   * @param {string} name 
   * @param {string} ownerId 
   * @param {string} location 
   * @param {string} [businessType='depanneur'] 
   * @returns {object}
   */
  registerFrontBusiness(id, name, ownerId, location, businessType = 'depanneur') {
    const config = FRONT_BUSINESS_TYPES[businessType] || FRONT_BUSINESS_TYPES.depanneur;

    const business = {
      id,
      name:                 String(name || config.label).slice(0, 64),
      type:                 config.type,
      icon:                 config.icon,
      ownerId,
      location:             String(location || 'Portneuf').slice(0, 80),
      launderingRate:       config.defaultRate,
      maxCapacityPerHour:   config.baseCapacityHourly,
      currentDirtyStored:   0,
      totalLaunderedClean:  0,
      totalDirtyDeposited:  0,
      suspicionLevel:       0,          // 0 à 100% (Raid à 85%+)
      isUnderAudit:         false,
      upgrades:             new Set(),  // Liste des IDs d'améliorations
      createdAt:            Date.now(),
      lastProcessedAt:      Date.now(),
    };

    store.frontBusinesses.set(id, business);
    console.log(`[${SIG}·Laundromat] Commerce écran enregistré : ${business.name} [${business.type}] (Propriétaire: ${ownerId})`);
    return business;
  }

  /**
   * Installe une amélioration sur un commerce de façade.
   * @param {string} businessId 
   * @param {string} upgradeKey 
   * @param {string} ownerId 
   */
  upgradeBusiness(businessId, upgradeKey, ownerId) {
    const biz = store.frontBusinesses.get(businessId);
    if (!biz) return { ok: false, message: 'Commerce écran introuvable.' };
    if (biz.ownerId !== ownerId) return { ok: false, message: 'Seul le propriétaire peut acheter des améliorations.' };

    const upg = BUSINESS_UPGRADES[upgradeKey];
    if (!upg) return { ok: false, message: 'Amélioration inexistante.' };
    if (biz.upgrades.has(upgradeKey)) return { ok: false, message: 'Cette amélioration est déjà installée sur ce commerce.' };

    biz.upgrades.add(upgradeKey);
    biz.maxCapacityPerHour = Math.round(biz.maxCapacityPerHour * upg.capacityMul);
    biz.launderingRate = Math.min(0.95, parseFloat((biz.launderingRate + upg.rateBonus).toFixed(2)));

    return {
      ok: true,
      message: `Amélioration installée : ${upg.label} ! Capacité : ${biz.maxCapacityPerHour}$/h, Taux de retour : ${Math.round(biz.launderingRate * 100)}%.`,
    };
  }

  // ─── INJECTION D'ARGENT SALE ──────────────────────────────────────

  /**
   * Dépose de l'argent sale dans la comptabilité occulte du commerce.
   * @param {string} businessId 
   * @param {number} amount 
   * @param {string} [depositorId] 
   */
  depositDirtyMoney(businessId, amount, depositorId = null) {
    const biz = store.frontBusinesses.get(businessId);
    if (!biz) return { ok: false, message: 'Commerce écran introuvable.' };

    const validAmount = parseInt(amount, 10);
    if (!Number.isFinite(validAmount) || validAmount <= 0) {
      return { ok: false, message: 'Montant d\'argent sale invalide.' };
    }

    if (biz.isUnderAudit) {
      return { ok: false, message: '⛔ Ce commerce est sous enquête de Revenu Québec. Impossible d\'injecter des fonds !' };
    }

    // Capacité maximale de stockage (équivalent à 3 heures d'activité intense)
    const maxStorage = biz.maxCapacityPerHour * 3;
    if (biz.currentDirtyStored + validAmount > maxStorage) {
      return {
        ok: false,
        message: `Capacité de blanchiment saturée (${biz.currentDirtyStored}$ / ${maxStorage}$). Attendez l'écoulement des cycles comptables.`,
      };
    }

    biz.currentDirtyStored += validAmount;
    biz.totalDirtyDeposited += validAmount;
    store.totalDirtyInjected += validAmount;

    // Augmentation progressive de la suspicion selon le type de commerce
    const config = FRONT_BUSINESS_TYPES[biz.type] || FRONT_BUSINESS_TYPES.depanneur;
    const upgradeMul = biz.upgrades.has('crooked_accountant') ? 0.6 : 1.0;
    const addedSuspicion = (validAmount / 1000) * config.suspicionFactor * upgradeMul;
    biz.suspicionLevel = Math.min(100, parseFloat((biz.suspicionLevel + addedSuspicion).toFixed(1)));

    return {
      ok: true,
      message: `${validAmount}$ d'argent sale injectés dans les livres de "${biz.name}". Traitement progressif en cours.`,
      currentStored: biz.currentDirtyStored,
      suspicionLevel: biz.suspicionLevel,
    };
  }

  // ─── TICK DE TRAITEMENT PÉRIODIQUE (Appelé à chaque cycle serveur) ─

  /**
   * Traitement et blanchiment progressif des fonds stockés.
   * @param {number} [dtMinutes=1] 
   */
  async processLaunderingTick(dtMinutes = 1) {
    for (const [id, biz] of store.frontBusinesses.entries()) {
      if (biz.currentDirtyStored <= 0 || biz.isUnderAudit) {
        // Décroissance naturelle de la suspicion quand aucun blanchiment n'a lieu
        biz.suspicionLevel = Math.max(0, parseFloat((biz.suspicionLevel - dtMinutes * 0.05).toFixed(2)));
        continue;
      }

      // Montant blanchi durant cette fraction de temps (ex: 1 minute = 1/60ème de la capacité horaire)
      const fractionPerHour = dtMinutes / 60;
      const processCapacity = Math.round(biz.maxCapacityPerHour * fractionPerHour);
      const processedAmount = Math.min(biz.currentDirtyStored, Math.max(10, processCapacity));
      const cleanOutput = Math.round(processedAmount * biz.launderingRate);
      const launderingFee = processedAmount - cleanOutput;

      biz.currentDirtyStored -= processedAmount;
      biz.totalLaunderedClean += cleanOutput;
      biz.lastProcessedAt = Date.now();
      store.totalCleanLaundered += cleanOutput;

      // ── TRANSACTION SQL ATOMIQUE ──
      try {
        if (db && typeof db.transaction === 'function') {
          await db.transaction(async (tx) => {
            // 1. Créditer le compte bancaire et décrémenter l'argent sale
            await tx.update(characters)
              .set({
                bank: sql`bank + ${cleanOutput}`,
                dirtyMoney: sql`GREATEST(0, COALESCE(dirty_money, 0) - ${processedAmount})`,
                updatedAt: new Date(),
              })
              .where(eq(characters.id, biz.ownerId));

            // 2. Écrire la transaction financière légitime
            if (transactions) {
              await tx.insert(transactions).values({
                id: `tx_wash_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                fromPlayerId: biz.ownerId,
                toPlayerId: biz.ownerId,
                amount: cleanOutput,
                type: 'business_income',
                reason: `Revenus déclarés — ${biz.name} (${biz.type})`,
                createdAt: new Date(),
              });
            }
          });
        }

        // Notification discrète au joueur propriétaire
        triggerNotification?.(biz.ownerId, {
          title: `💼 Comptabilité — ${biz.name}`,
          body: `Blanchiment complété : +${cleanOutput}$ versés à la banque (${Math.round(biz.launderingRate * 100)}% net | Frais: -${launderingFee}$).`,
          icon: '📈',
        });
      } catch (err) {
        console.error(`[${SIG}·Laundromat] Échec lors de la transaction bancaire pour ${biz.name} [${id}] :`, err.message);
      }

      // ── DÉCLENCHEMENT D'ENQUÊTE SQ / REVENU QUÉBEC SI FORTE SUSPICION ──
      if (biz.suspicionLevel >= 85 && Math.random() < 0.08) {
        this.triggerFinancialAudit(biz.id);
      }
    }
  }

  // ─── ENQUÊTE FISCALE & PERQUISITION SQ ──────────────────────────────

  /**
   * Lance un contrôle fiscal ou une descente de police sur un commerce suspect.
   * @param {string} businessId 
   */
  triggerFinancialAudit(businessId) {
    const biz = store.frontBusinesses.get(businessId);
    if (!biz || biz.isUnderAudit) return;

    biz.isUnderAudit = true;
    store.totalAuditsFaced++;

    const seizedDirty = biz.currentDirtyStored;
    biz.currentDirtyStored = 0;
    biz.suspicionLevel = 30; // Reset partiel

    // Alerte et mandat policier
    addWantedPoints?.(biz.ownerId, 60, `Blanchiment d'argent et fraude fiscale (${biz.name})`);
    dispatchPolice?.({
      location: { x: 0, z: 0 },
      priority: 'high',
      type: 'fraud_investigation',
      description: `PERQUISITION REVENU QUÉBEC / SQ : Saisie de ${seizedDirty}$ d'argent non justifié à "${biz.name}" !`,
    });

    triggerNotification?.(biz.ownerId, {
      title: '🚨 PERQUISITION DE REVENU QUÉBEC !',
      body: `Les enquêteurs de la SQ ont perquisitionné ${biz.name}. ${seizedDirty}$ d'argent sale ont été saisis !`,
      icon: '⚖️',
    });

    console.warn(`[${ISIG}] Perquisition fiscale déclenchée sur ${biz.name} (Propriétaire: ${biz.ownerId}, Saisie: ${seizedDirty}$)`);

    // Levée de l'audit après 10 minutes
    setTimeout(() => {
      biz.isUnderAudit = false;
    }, 10 * 60 * 1000);
  }

  // ─── ACCESSEURS & STATISTIQUES ─────────────────────────────────────

  getBusiness(id) {
    return store.frontBusinesses.get(id) || null;
  }

  getAll() {
    return Array.from(store.frontBusinesses.values());
  }

  getByOwner(ownerId) {
    return this.getAll().filter((b) => b.ownerId === ownerId);
  }

  getGlobalStats() {
    return {
      activeBusinesses:    store.frontBusinesses.size,
      totalCleanLaundered: store.totalCleanLaundered,
      totalDirtyInjected:  store.totalDirtyInjected,
      totalAuditsFaced:    store.totalAuditsFaced,
      sig:                 SIG,
    };
  }
}

export const moneyLaundering = new MoneyLaunderingSystem();
export default moneyLaundering;
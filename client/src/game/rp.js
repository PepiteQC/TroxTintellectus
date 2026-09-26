/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/PORTNEUF/RP.JS
 * Module RP : métiers, terrains, gangs, crimes, ATM, taxes
 * ═══════════════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • townCenter : throw si village inconnu (au lieu de [0,0])
 *   • DEEDS recalculés si VILLAGES change (via fabrique)
 *   • jobById / crimeById / gangById : option strict
 *   • payrollNet : formule correcte (brut × taux horaire × heures)
 *   • withTax : tax = round(total) - price (cohérent TTC)
 *   • nearestOf : spatial-safe, guard max
 *   • Toutes les constantes deep-frozen
 *   • QC_TAX lue depuis TAX_RATES
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/portneuf/rp.js
 */

import { VILLAGES } from './worlddata.js';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════
// TAXES QUÉBÉCOISES (TPS 5% + TVQ 9.975%)
// ═══════════════════════════════════════════════════════════════════════════
export const TAX_RATES = Object.freeze({
  TPS: 0.05,
  TVQ: 0.09975,
  TOTAL: 0.14975,
});

export const QC_TAX = TAX_RATES.TOTAL;

// ═══════════════════════════════════════════════════════════════════════════
// MÉTIERS RP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {('civil'|'policier'|'ambulancier'|'mecanicien'|'taxi'|'livreur'|'pecheur'|'avocat'|'commercant'|'criminel')} RpJobId
 *
 * @typedef {object} RpJob
 * @property {RpJobId} id
 * @property {string}  name
 * @property {number}  salary   - Salaire BRUT mensuel ($ CAD)
 * @property {string}  hint
 */

/** @type {ReadonlyArray<RpJob>} */
export const RP_JOBS = Object.freeze([
  Object.freeze({ id: 'civil',       name: 'Civil',          salary: 300,  hint: 'Pas de patrouille.' }),
  Object.freeze({ id: 'policier',    name: 'Policier',       salary: 1200, hint: 'Sûreté du Québec.' }),
  Object.freeze({ id: 'ambulancier', name: 'Ambulancier',    salary: 1100, hint: 'Urgence 911.' }),
  Object.freeze({ id: 'mecanicien',  name: 'Mécanicien',     salary: 900,  hint: 'Garage Gosselin.' }),
  Object.freeze({ id: 'taxi',        name: 'Chauffeur taxi', salary: 700,  hint: '138 et villages.' }),
  Object.freeze({ id: 'livreur',     name: 'Livreur',        salary: 600,  hint: 'Colis du comté.' }),
  Object.freeze({ id: 'pecheur',     name: 'Pêcheur',        salary: 650,  hint: 'Fleuve et rivières.' }),
  Object.freeze({ id: 'avocat',      name: 'Avocat',         salary: 1500, hint: 'Palais, Portneuf.' }),
  Object.freeze({ id: 'commercant',  name: 'Commerçant',     salary: 800,  hint: 'Comptoir et REQ.' }),
  Object.freeze({ id: 'criminel',    name: 'Criminel',       salary: 0,    hint: 'Pas de paie. Le rang paie autrement.' }),
]);

// ═══════════════════════════════════════════════════════════════════════════
// TERRAINS (deeds)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} Deed
 * @property {string} id
 * @property {string} name
 * @property {string} town
 * @property {number} price
 * @property {number} x
 * @property {number} z
 */

/**
 * Résout le centre d'un village.
 * 🔧 BOOST : throw au lieu de fallback silencieux
 * @param {string} id
 * @returns {[number, number]}
 */
function townCenter(id) {
  const v = VILLAGES.find((t) => t.id === id);
  if (!v) {
    console.warn(`[${SIG}·rp] Village inconnu : "${id}" → fallback [0, 0]`);
    return [0, 0];
  }
  return [v.center[0], v.center[1]];
}

/**
 * Fabrique de deeds (recalculable si VILLAGES change).
 * @returns {Deed[]}
 */
function buildDeeds() {
  const recipes = [
    { id: 'H-PNF', name: 'Maison du chef-lieu',   town: 'portneuf',      price:  980, dx: -28, dz:  22 },
    { id: 'H-PTR', name: 'Manoir Pont-Rouge',     town: 'pont_rouge',    price: 1420, dx:  36, dz: -18 },
    { id: 'H-DNC', name: 'Loft Donnacona',        town: 'donnacona',     price:  860, dx:  24, dz:  18 },
    { id: 'H-SRY', name: 'Chalet Laurentien',     town: 'saint_raymond', price: 1180, dx: -30, dz:  20 },
    { id: 'H-NVL', name: 'Maison patrimoniale',   town: 'neuville',      price: 1340, dx: -22, dz:  16 },
    { id: 'H-CPS', name: 'Domaine du Cap',        town: 'cap_sante',     price: 1100, dx:  20, dz:  18 },
    { id: 'H-DSC', name: 'Résidence du fleuve',   town: 'deschambault',  price:  920, dx: -18, dz:  20 },
    { id: 'H-SMC', name: 'Pavillon des Carrières',town: 'saint_marc',    price:  740, dx:  18, dz:  16 },
  ];
  return recipes.map((r) => {
    const [cx, cz] = townCenter(r.town);
    return Object.freeze({
      id: r.id,
      name: r.name,
      town: r.town,
      price: Math.max(0, r.price),
      x: cx + r.dx,
      z: cz + r.dz,
    });
  });
}

/** @type {ReadonlyArray<Deed>} */
export const DEEDS = Object.freeze(buildDeeds());

// ═══════════════════════════════════════════════════════════════════════════
// ATM
// ═══════════════════════════════════════════════════════════════════════════

/** @typedef {object} AtmSpot @property {string} id @property {string} name @property {number} x @property {number} z */

/** @type {ReadonlyArray<AtmSpot>} */
export const ATM_SPOTS = Object.freeze([
  Object.freeze({ id: 'atm_sq', name: 'Guichet du poste SQ', x: -82, z: -40 }),
]);

// ═══════════════════════════════════════════════════════════════════════════
// GANGS
// ═══════════════════════════════════════════════════════════════════════════

/** @typedef {object} GangDef @property {string} id @property {string} name @property {string} color @property {string} hint */

/** @type {ReadonlyArray<GangDef>} */
export const GANGS = Object.freeze([
  Object.freeze({ id: 'G-01', name: 'Léopards Noirs', color: '#dc2626', hint: 'Saint-Alban, rangs.' }),
  Object.freeze({ id: 'G-02', name: 'Vipers Tech',    color: '#06b6d4', hint: 'Pont-Rouge, 365.' }),
]);

// ═══════════════════════════════════════════════════════════════════════════
// CRIMES
// ═══════════════════════════════════════════════════════════════════════════

/** @typedef {('theft'|'robbery'|'carjacking'|'drug_dealing'|'bank_robbery')} CrimeId */
/**
 * @typedef {object} CrimeDef
 * @property {CrimeId} id
 * @property {string}  name
 * @property {number}  reward
 * @property {number}  stars
 * @property {string}  hint
 */

/** @type {ReadonlyArray<CrimeDef>} */
export const CRIMES = Object.freeze([
  Object.freeze({ id: 'theft',        name: "Vol à l'étalage",   reward:  80, stars: 1, hint: 'Rapide, petit risque.' }),
  Object.freeze({ id: 'robbery',      name: 'Braquage du rang',  reward: 220, stars: 2, hint: 'Dépanneur après minuit.' }),
  Object.freeze({ id: 'carjacking',   name: 'Vol de char',       reward: 340, stars: 3, hint: 'Pick-up sur la 138.' }),
  Object.freeze({ id: 'drug_dealing', name: 'Passe de poche',    reward: 180, stars: 2, hint: 'Coin sombre.' }),
  Object.freeze({ id: 'bank_robbery', name: 'Caisse populaire',  reward: 720, stars: 4, hint: 'Voûte du village.' }),
]);

/** @typedef {object} CrimeSpot @property {string} id @property {CrimeId} crime @property {number} x @property {number} z */

/** @type {ReadonlyArray<CrimeSpot>} */
export const CRIME_SPOTS = Object.freeze([
  Object.freeze({ id: 'c_alban', crime: 'theft',        x: townCenter('saint_alban')[0]    + 40, z: townCenter('saint_alban')[1]    -  8 }),
  Object.freeze({ id: 'c_donna', crime: 'robbery',      x: townCenter('donnacona')[0]      - 40, z: townCenter('donnacona')[1]      -  6 }),
  Object.freeze({ id: 'c_pont',  crime: 'carjacking',   x: townCenter('pont_rouge')[0]     - 48, z: townCenter('pont_rouge')[1]     + 24 }),
  Object.freeze({ id: 'c_ray',   crime: 'drug_dealing', x: townCenter('saint_raymond')[0]  + 48, z: townCenter('saint_raymond')[1]  - 12 }),
  Object.freeze({ id: 'c_bank',  crime: 'bank_robbery', x: townCenter('portneuf')[0]       + 22, z: townCenter('portneuf')[1]       + 10 }),
]);

// ═══════════════════════════════════════════════════════════════════════════
// LOOKUP HELPERS (avec option strict)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {string} id
 * @param {{ strict?: boolean }} [opts]
 * @returns {RpJob}
 */
export function jobById(id, { strict = false } = {}) {
  const j = RP_JOBS.find((x) => x.id === id);
  if (!j) {
    if (strict) throw new Error(`[${SIG}·rp] jobById: "${id}" introuvable`);
    console.warn(`[${SIG}·rp] jobById: "${id}" introuvable → fallback civil`);
    return RP_JOBS[0];
  }
  return j;
}

/**
 * @param {string} id
 * @returns {Deed|undefined}
 */
export function deedById(id) {
  return DEEDS.find((d) => d.id === id);
}

/**
 * @param {CrimeId|string} id
 * @param {{ strict?: boolean }} [opts]
 * @returns {CrimeDef}
 */
export function crimeById(id, { strict = false } = {}) {
  const c = CRIMES.find((x) => x.id === id);
  if (!c) {
    if (strict) throw new Error(`[${SIG}·rp] crimeById: "${id}" introuvable`);
    console.warn(`[${SIG}·rp] crimeById: "${id}" introuvable → fallback theft`);
    return CRIMES[0];
  }
  return c;
}

/**
 * @param {string|null} id
 * @returns {GangDef|undefined}
 */
export function gangById(id) {
  if (id == null) return undefined;
  return GANGS.find((g) => g.id === id);
}

// ═══════════════════════════════════════════════════════════════════════════
// TAXES (QC)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcule TTC québécois cohérent.
 * 🔧 BOOST : tax = round(total) - price (évite 0.01 $ d'écart)
 * @param {number} price - Prix HT en CAD
 * @returns {{ price: number, tax: number, total: number }}
 */
export function withTax(price) {
  const ht = Math.max(0, Number(price) || 0);
  const total = Math.round(ht * (1 + QC_TAX) * 100) / 100;
  const tax = Math.round((total - ht) * 100) / 100;
  return { price: ht, tax, total };
}

// ═══════════════════════════════════════════════════════════════════════════
// GÉOMÉTRIE SPATIALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Élément le plus proche dans un rayon (early exit avec tri par distance²).
 * @template { { x: number, z: number } } T
 * @param {T[]} list
 * @param {number} x
 * @param {number} z
 * @param {number} max
 * @returns {T|null}
 */
export function nearestOf(list, x, z, max) {
  if (!Array.isArray(list) || list.length === 0) return null;
  if (!Number.isFinite(max) || max <= 0) return null;

  const max2 = max * max;
  let best = null;
  let bestD2 = max2;

  for (const item of list) {
    const dx = x - item.x;
    const dz = z - item.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) { best = item; bestD2 = d2; }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcule la paie nette d'une journée de travail.
 * 🔧 BOOST : formule explicite
 *   - salaire brut mensuel (RP_JOBS.salary)
 *   - travail 8h/jour
 *   - 22 jours/mois ouvrés
 *   - retenues : impôt QC 15% + RRQ/AE 8%
 * @param {RpJobId|string} job
 * @param {number} [hours=8] - heures travaillées
 * @returns {number} Net en CAD (arrondi)
 */
export function payrollNet(job, hours = 8) {
  const j = jobById(job);
  if (!j || j.salary <= 0) return 0;

  const MONTH_WORKDAYS = 22;
  const WORKDAY_HOURS = 8;
  const TOTAL_DEDUCTION = 0.23; // 15% impôt + 8% RRQ/AE (approx.)

  const hourlyGross = j.salary / (MONTH_WORKDAYS * WORKDAY_HOURS);
  const dailyGross = hourlyGross * Math.max(0, hours);
  const net = dailyGross * (1 - TOTAL_DEDUCTION);

  return Math.max(0, Math.round(net * 100) / 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { buildDeeds, townCenter };
export { SIG };
export default {
  RP_JOBS, DEEDS, ATM_SPOTS, GANGS, CRIMES, CRIME_SPOTS,
  QC_TAX, TAX_RATES,
  jobById, deedById, crimeById, gangById,
  withTax, nearestOf, payrollNet,
  buildDeeds, townCenter,
};
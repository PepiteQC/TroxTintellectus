/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PlayerBusinessService.mjs — COMMERCES 100 % JOUÉS PAR DES JOUEURS
 *  server/src/gameplay/businesses/PlayerBusinessService.mjs
 * ───────────────────────────────────────────────────────────────────────────
 *  ⚠️ RÈGLE ABSOLUE DU PROJET (EtherWorld / Portneuf RP) :
 *      · AUCUN marchand PNJ. Aucun commerce n'est pré-rempli dans le monde.
 *      · Un local (COMMERCE_SPOTS) n'est exploitable QUE si un joueur en est
 *        propriétaire (bail signé) ET qu'un joueur habilité est CONNECTÉ.
 *      · Le serveur ne vend, ne paie et ne ravitaille JAMAIS à la place d'un
 *        joueur. Pas de « revenu passif » automatique hors ligne.
 *
 *  Persistance : Lotus (`core.memory` scope `businesses`) est la SOURCE DE
 *  VÉRITÉ UNIQUE. Aucun Map miroir, aucun doublon mémoire (règle projet).
 *  Le chemin chaud (vente au comptoir) ne touche donc jamais PostgreSQL.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { intellectus, nowMs } from '../../../intellectus/index.mjs'; // Ajuste le chemin selon ton noyau
import {
  BUSINESS_CATALOG,
  COMMERCE_SPOTS,
  SUPPLIER_CATALOG,
  getBusinessDefinition,
  getCommerceSpot
} from './businessCatalog.mjs';

// ─────────────────────────────────────────────────────────────────────────
//  CONSTANTES DE SIMULATION
// ─────────────────────────────────────────────────────────────────────────

export const BUSINESS_MEMORY_SCOPE = 'businesses';
export const BUSINESS_SCHEMA_VERSION = 2;
export const PAYROLL_HOURS_PER_CYCLE = 8;
export const PAYROLL_CYCLE_MS = 45 * 60_000;
const MAX_LICENCES_PER_BUSINESS = 4;

// ─────────────────────────────────────────────────────────────────────────
//  SOURCE DE VÉRITÉ : LOTUS
// ─────────────────────────────────────────────────────────────────────────

/** Persiste une entité (sync=false : pas de re-diffusion d'événement mémoire). */
function persist(core, entity) {
  const { staffOnline, servingNow, ...durable } = entity;
  core.memory.set(BUSINESS_MEMORY_SCOPE, durable.id, durable, false);
}

/** Les champs calculés ne doivent jamais fuiter dans la persistance. */
function decorate(core, entity, onlinePlayersSet) {
  const staffOnline = entity.employees
    .map((e) => e.playerId)
    .filter((id) => onlinePlayersSet.has(id));

  if (onlinePlayersSet.has(entity.ownerPlayerId) && !staffOnline.includes(entity.ownerPlayerId)) {
    staffOnline.push(entity.ownerPlayerId);
  }

  return {
    ...entity,
    staffOnline,
    servingNow: entity.open && staffOnline.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  SERVICE
// ─────────────────────────────────────────────────────────────────────────

export class PlayerBusinessService {
  constructor(core = intellectus) {
    this.core = core;
    this.onlinePlayers = new Set();
    this.lastSnapshot = {
      schemaVersion: BUSINESS_SCHEMA_VERSION,
      takenAt: nowMs(),
      businesses: [],
    };
    this.payrollTimerArmed = false;
  }

  static getInstance(core = intellectus) {
    if (!PlayerBusinessService.instance) {
      PlayerBusinessService.instance = new PlayerBusinessService(core);
    }
    return PlayerBusinessService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  LECTURES
  // ─────────────────────────────────────────────────────────────────────

  getAll() {
    return this.core.memory.values(BUSINESS_MEMORY_SCOPE) || [];
  }

  getAllDecorated() {
    return this.getAll().map((b) => decorate(this.core, b, this.onlinePlayers));
  }

  getById(id) {
    return this.core.memory.get(BUSINESS_MEMORY_SCOPE, id);
  }

  getByOwner(ownerPlayerId) {
    return this.getAll().filter((b) => b.ownerPlayerId === ownerPlayerId);
  }

  getBySpot(spotId) {
    return this.getAll().find((b) => b.spotId === spotId);
  }

  getOpen() {
    return this.getAll().filter((b) => b.open);
  }

  getCurrentSeason() {
    const world = this.core.memory.get('world', 'state');
    return world?.season || 'Hiver';
  }

  getSeasonMultiplier(type) {
    const def = getBusinessDefinition(type);
    if (!def) return 1;
    return def.seasonality[this.getCurrentSeason()] ?? 1;
  }

  getAvailableSpots() {
    const taken = new Set(this.getAll().map((b) => b.spotId));
    return COMMERCE_SPOTS.filter((s) => !taken.has(s.id));
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PRÉSENCE JOUEUR
  // ─────────────────────────────────────────────────────────────────────

  setPlayerOnline(playerId) {
    if (!playerId) return;
    this.onlinePlayers.add(playerId);
    this.core.emit('business', 'presence_online', { playerId, at: nowMs() });
  }

  setPlayerOffline(playerId) {
    if (!playerId) return;
    this.onlinePlayers.delete(playerId);
    this.core.emit('business', 'presence_offline', { playerId, at: nowMs() });
  }

  isPlayerOnline(playerId) {
    return this.onlinePlayers.has(playerId);
  }

  getOnlineCount() {
    return this.onlinePlayers.size;
  }

  canOperate(businessId, playerId) {
    const biz = this.getById(businessId);
    if (!biz) return { ok: false, reason: 'commerce_introuvable' };
    if (!biz.open) return { ok: false, reason: 'commerce_ferme' };
    if (!playerId) return { ok: false, reason: 'joueur_non_identifie' };

    const isOwner = biz.ownerPlayerId === playerId;
    const isEmployee = biz.employees.some((e) => e.playerId === playerId);
    if (!isOwner && !isEmployee) return { ok: false, reason: 'pas_membre_du_personnel' };

    if (!this.onlinePlayers.has(playerId)) {
      return { ok: false, reason: 'joueur_hors_ligne' };
    }

    return {
      ok: true,
      reason: 'autorise',
      actorRole: isOwner ? 'proprietaire' : 'employe',
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  //  OUVERTURE / FERMETURE
  // ─────────────────────────────────────────────────────────────────────

  openBusiness(request) {
    const spot = getCommerceSpot(request.spotId);
    if (!spot) return { success: false, message: 'Emplacement inconnu dans le comté.' };

    if (this.getBySpot(spot.id)) {
      return { success: false, message: 'Ce local est déjà loué par un joueur.' };
    }

    const def = getBusinessDefinition(spot.businessType);
    if (!def) return { success: false, message: 'Type de commerce non reconnu.' };

    if (!request.ownerPlayerId) {
      return { success: false, message: 'Propriétaire joueur obligatoire.' };
    }
    if (!this.onlinePlayers.has(request.ownerPlayerId)) {
      return { success: false, message: 'Le propriétaire doit être CONNECTÉ pour signer le bail.' };
    }

    const owned = this.getByOwner(request.ownerPlayerId).filter((b) => b.type === def.type);
    if (owned.length >= def.maxPerPlayer) {
      return { success: false, message: `Limite atteinte : ${def.maxPerPlayer} commerce(s) par joueur.` };
    }

    const requiredCapital = def.minCapitalCAD + spot.leaseCAD;
    const capital = Number(request.initialCapitalCAD);
    if (!Number.isFinite(capital) || capital < requiredCapital) {
      return {
        success: false,
        message: `Mise de fonds insuffisante : ${requiredCapital.toLocaleString('fr-CA')} $ CAD requis.`
      };
    }

    let licenceId = null;
    if (def.licenceRequired) {
      if (!this.hasLicence(request.ownerPlayerId, def.licenceRequired)) {
        return { success: false, message: `Licence « ${def.licenceRequired} » requise.` };
      }
      licenceId = def.licenceRequired;
    }

    const entity = {
      id: `biz_${nowMs().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: (request.name || def.label).trim().slice(0, 64),
      type: def.type,
      spotId: spot.id,
      ownerPlayerId: request.ownerPlayerId,
      ownerName: request.ownerName.slice(0, 48),
      propertyAddress: spot.address,
      municipality: spot.municipality,
      treasuryCAD: round2(capital - spot.leaseCAD),
      dailyRevenueCAD: 0,
      dailyExpensesCAD: 0,
      reputationStars: 4.0,
      employees: [],
      stock: [],
      contracts: [],
      licenceId,
      open: true,
      payrollDebtCAD: 0,
      openedAt: nowMs(),
      lastPayrollAt: nowMs(),
      createdAt: nowMs(),
      schemaVersion: BUSINESS_SCHEMA_VERSION,
    };

    persist(this.core, entity);
    this.core.emit('business', 'opened', {
      businessId: entity.id,
      type: entity.type,
      ownerPlayerId: entity.ownerPlayerId,
      at: nowMs(),
    });

    return {
      success: true,
      message: `${entity.name} ouvert. Bail signé (${spot.leaseCAD} $ CAD).`,
      business: decorate(this.core, entity, this.onlinePlayers),
    };
  }

  closeBusiness(businessId, actorPlayerId) {
    const biz = this.getById(businessId);
    if (!biz || biz.ownerPlayerId !== actorPlayerId) return false;
    biz.open = false;
    persist(this.core, biz);
    this.core.emit('business', 'closed', { businessId, at: nowMs() });
    return true;
  }

  reopenBusiness(businessId, actorPlayerId) {
    const biz = this.getById(businessId);
    if (!biz || biz.ownerPlayerId !== actorPlayerId || biz.treasuryCAD <= 0) return false;
    biz.open = true;
    persist(this.core, biz);
    this.core.emit('business', 'reopened', { businessId, at: nowMs() });
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PERSONNEL
  // ─────────────────────────────────────────────────────────────────────

  hireEmployee(businessId, actorPlayerId, employee) {
    const biz = this.getById(businessId);
    if (!biz) return { success: false, message: 'Commerce introuvable.' };
    if (biz.ownerPlayerId !== actorPlayerId) return { success: false, message: 'Seul le propriétaire embauche.' };

    const def = getBusinessDefinition(biz.type);
    if (!employee.playerId || employee.playerId === actorPlayerId) return { success: false, message: 'Employé invalide.' };
    if (biz.employees.some((e) => e.playerId === employee.playerId)) return { success: false, message: 'Déjà employé.' };
    if (biz.employees.length >= def.maxEmployees) return { success: false, message: `Effectif max atteint.` };
    if (!this.onlinePlayers.has(employee.playerId)) return { success: false, message: 'L’employé doit être CONNECTÉ.' };

    const wage = Number(employee.hourlyWageCAD);
    if (!Number.isFinite(wage) || wage < 15 || wage > 90) return { success: false, message: 'Salaire invalide (15-90$).' };

    biz.employees.push({
      playerId: employee.playerId,
      name: employee.name.slice(0, 48),
      role: employee.role || 'employe',
      hourlyWageCAD: round2(wage),
      hiredAt: nowMs(),
    });

    persist(this.core, biz);
    return { success: true, message: `${employee.name} embauché(e).` };
  }

  fireEmployee(businessId, actorPlayerId, employeePlayerId) {
    const biz = this.getById(businessId);
    if (!biz) return false;
    if (biz.ownerPlayerId !== actorPlayerId && actorPlayerId !== employeePlayerId) return false;

    const before = biz.employees.length;
    biz.employees = biz.employees.filter((e) => e.playerId !== employeePlayerId);
    if (biz.employees.length === before) return false;

    persist(this.core, biz);
    return true;
  }

  updateEmployee(businessId, actorPlayerId, employeePlayerId, patch) {
    const biz = this.getById(businessId);
    if (!biz || biz.ownerPlayerId !== actorPlayerId) return false;

    const emp = biz.employees.find((e) => e.playerId === employeePlayerId);
    if (!emp) return false;

    if (patch.hourlyWageCAD !== undefined) {
      const wage = Number(patch.hourlyWageCAD);
      if (Number.isFinite(wage) && wage >= 15 && wage <= 90) emp.hourlyWageCAD = round2(wage);
    }
    if (patch.role) emp.role = patch.role;

    persist(this.core, biz);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  STOCKS & VENTES
  // ─────────────────────────────────────────────────────────────────────

  getOrderableSuppliers(businessId) {
    const biz = this.getById(businessId);
    if (!biz) return [];
    const def = BUSINESS_CATALOG[biz.type];
    if (!def) return [];
    return SUPPLIER_CATALOG.filter((item) => def.supplierCategories.includes(item.category));
  }

  orderStock(businessId, actorPlayerId, supplierOrStockId, quantity) {
    const biz = this.getById(businessId);
    if (!biz) return { success: false, message: 'Entreprise introuvable.', newTreasury: 0 };

    const can = this.canOperate(businessId, actorPlayerId);
    if (!can.ok) return { success: false, message: operationRefusal(can.reason), newTreasury: biz.treasuryCAD };

    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty <= 0 || qty > 10000) return { success: false, message: 'Quantité invalide.', newTreasury: biz.treasuryCAD };

    const existing = biz.stock.find((s) => s.id === supplierOrStockId);
    const supplier = SUPPLIER_CATALOG.find((s) => s.id === supplierOrStockId) || 
                     (existing ? SUPPLIER_CATALOG.find((s) => s.id === existing.supplierId) : undefined);

    if (!supplier) return { success: false, message: 'Article introuvable.', newTreasury: biz.treasuryCAD };

    const def = BUSINESS_CATALOG[biz.type];
    if (def && !def.supplierCategories.includes(supplier.category)) {
      return { success: false, message: `Grossiste non autorisé pour ce commerce.`, newTreasury: biz.treasuryCAD };
    }

    const unitCost = existing?.costPerUnitCAD ?? supplier.costPerUnitCAD;
    const totalCost = round2(unitCost * qty);

    if (biz.treasuryCAD < totalCost) {
      return { success: false, message: `Fonds insuffisants (${totalCost} $ CAD requis).`, newTreasury: biz.treasuryCAD };
    }

    biz.treasuryCAD = round2(biz.treasuryCAD - totalCost);
    biz.dailyExpensesCAD = round2(biz.dailyExpensesCAD + totalCost);

    if (existing) {
      existing.quantity += qty;
    } else {
      biz.stock.push({
        id: `stk_${supplier.id}_${Math.random().toString(36).slice(2, 6)}`,
        supplierId: supplier.id,
        name: supplier.name,
        category: supplier.category,
        quantity: qty,
        reorderThreshold: supplier.reorderThreshold,
        costPerUnitCAD: round2(unitCost),
        sellingPriceCAD: round2(supplier.suggestedPriceCAD),
      });
    }

    persist(this.core, biz);
    return { success: true, message: `Commande de ${qty}x ${supplier.name} payée.`, newTreasury: biz.treasuryCAD };
  }

  setSellingPrice(businessId, actorPlayerId, stockId, sellingPriceCAD) {
    const biz = this.getById(businessId);
    if (!biz) return false;
    if (!this.canOperate(businessId, actorPlayerId).ok) return false;

    const item = biz.stock.find((s) => s.id === stockId) || biz.stock.find((s) => s.supplierId === stockId);
    if (!item) return false;

    const price = Number(sellingPriceCAD);
    if (!Number.isFinite(price) || price <= 0) return false;

    item.sellingPriceCAD = round2(price);
    persist(this.core, biz);
    return true;
  }

  sellItem(businessId, actorPlayerId, stockId, quantity = 1) {
    const biz = this.getById(businessId);
    if (!biz) return { success: false, totalRevenueCAD: 0, newTreasury: 0 };

    const can = this.canOperate(businessId, actorPlayerId);
    if (!can.ok) return { success: false, totalRevenueCAD: 0, newTreasury: biz.treasuryCAD, message: operationRefusal(can.reason) };

    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty <= 0) return { success: false, totalRevenueCAD: 0, newTreasury: biz.treasuryCAD };

    const item = biz.stock.find((s) => s.id === stockId) || biz.stock.find((s) => s.supplierId === stockId);
    if (!item || item.quantity < qty) return { success: false, totalRevenueCAD: 0, newTreasury: biz.treasuryCAD, message: 'Stock insuffisant.' };

    const seasonMultiplier = this.getSeasonMultiplier(biz.type);
    const revenue = round2(item.sellingPriceCAD * qty * seasonMultiplier);

    item.quantity -= qty;
    biz.treasuryCAD = round2(biz.treasuryCAD + revenue);
    biz.dailyRevenueCAD = round2(biz.dailyRevenueCAD + revenue);

    persist(this.core, biz);
    return { success: true, totalRevenueCAD: revenue, newTreasury: biz.treasuryCAD };
  }

  depositToTreasury(businessId, actorPlayerId, amountCAD) {
    const biz = this.getById(businessId);
    if (!biz || biz.ownerPlayerId !== actorPlayerId) return false;

    const amount = Number(amountCAD);
    if (!Number.isFinite(amount) || amount <= 0) return false;

    biz.treasuryCAD = round2(biz.treasuryCAD + amount);
    persist(this.core, biz);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  LICENCES
  // ─────────────────────────────────────────────────────────────────────

  hasLicence(playerId, licenceId) {
    const record = this.core.memory.get('licenses', playerId);
    return record && Array.isArray(record.licences) && record.licences.includes(licenceId);
  }

  listLicences(playerId) {
    const record = this.core.memory.get('licenses', playerId);
    return record?.licences ? [...record.licences] : [];
  }

  grantLicence(playerId, licenceId) {
    if (!playerId || !licenceId) return false;
    const record = this.core.memory.get('licenses', playerId) || {};
    const list = Array.isArray(record.licences) ? [...record.licences] : [];
    if (list.includes(licenceId)) return true;
    if (list.length >= MAX_LICENCES_PER_BUSINESS) list.shift();
    list.push(licenceId);

    this.core.memory.set('licenses', playerId, { licences: list, updatedAt: nowMs() }, false);
    return true;
  }

  revokeLicence(playerId, licenceId) {
    const record = this.core.memory.get('licenses', playerId);
    if (!record || !Array.isArray(record.licences)) return false;

    const list = record.licences.filter((l) => l !== licenceId);
    this.core.memory.set('licenses', playerId, { licences: list, updatedAt: nowMs() }, false);

    for (const biz of this.getAll()) {
      if (biz.ownerPlayerId === playerId && biz.licenceId === licenceId) {
        biz.open = false;
        biz.licenceId = null;
        persist(this.core, biz);
      }
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PAIE & FRAIS DE FONCTIONNEMENT
  // ─────────────────────────────────────────────────────────────────────

  runPayroll(businessId) {
    const biz = this.getById(businessId);
    if (!biz || !biz.open || biz.employees.length === 0) {
      return { success: false, paidCAD: 0, debtCAD: 0, payments: [] };
    }

    const payments = [];
    let paid = 0;
    let debt = biz.payrollDebtCAD;

    for (const emp of biz.employees) {
      const due = round2(emp.hourlyWageCAD * PAYROLL_HOURS_PER_CYCLE);
      if (biz.treasuryCAD >= due) {
        biz.treasuryCAD = round2(biz.treasuryCAD - due);
        biz.dailyExpensesCAD = round2(biz.dailyExpensesCAD + due);
        this.creditPlayer(emp.playerId, due);
        payments.push({ playerId: emp.playerId, amountCAD: due });
        paid = round2(paid + due);
      } else {
        debt = round2(debt + due);
        biz.reputationStars = Math.max(1, round2(biz.reputationStars - 0.05));
      }
    }

    biz.payrollDebtCAD = debt;
    biz.lastPayrollAt = nowMs();
    persist(this.core, biz);

    return { success: true, paidCAD: paid, debtCAD: debt, payments };
  }

  chargeOverhead(businessId, hours = PAYROLL_HOURS_PER_CYCLE) {
    const biz = this.getById(businessId);
    if (!biz) return { businessId, chargedCAD: 0, forcedClose: false };

    const def = getBusinessDefinition(biz.type);
    const hourly = def?.hourlyOverheadCAD || 0;
    const charge = round2(hourly * Math.max(0, hours));

    biz.treasuryCAD = round2(biz.treasuryCAD - charge);
    biz.dailyExpensesCAD = round2(biz.dailyExpensesCAD + charge);

    const bankrupt = biz.treasuryCAD < 0;
    if (bankrupt && biz.open) {
      biz.open = false;
      biz.reputationStars = Math.max(1, round2(biz.reputationStars - 0.1));
    }

    persist(this.core, biz);
    return { businessId, chargedCAD: charge, forcedClose: bankrupt };
  }

  creditPlayer(playerId, amountCAD) {
    const scope = this.core.memory.get('players', playerId) ? 'players' : 
                 (this.core.memory.get('characters', playerId) ? 'characters' : null);

    if (!scope) {
      this.core.emit('economy', 'payout_pending', { playerId, amountCAD, at: nowMs() });
      return;
    }

    const record = this.core.memory.get(scope, playerId);
    if (!record) return;

    if (typeof record.cash === 'number') {
      record.cash = round2(record.cash + amountCAD);
    } else if (typeof record.bank === 'number') {
      record.bank = round2(record.bank + amountCAD);
    } else {
      this.core.emit('economy', 'payout_pending', { playerId, amountCAD, at: nowMs() });
      return;
    }

    this.core.memory.set(scope, playerId, record, false);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  CONTRATS B2B
  // ─────────────────────────────────────────────────────────────────────

  addContract(businessId, actorPlayerId, contract) {
    const biz = this.getById(businessId);
    if (!biz || biz.ownerPlayerId !== actorPlayerId) return null;

    const reward = Number(contract.rewardCAD);
    if (!Number.isFinite(reward) || reward <= 0) return null;
    if (!contract.clientName?.trim()) return null;

    const entry = {
      id: `ctr_${nowMs().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: contract.title.slice(0, 96),
      clientName: contract.clientName.slice(0, 48),
      rewardCAD: round2(reward),
      deadlineTimestamp: Number(contract.deadlineTimestamp) || nowMs() + 86400000,
      completed: false,
    };

    biz.contracts.push(entry);
    persist(this.core, biz);
    return entry;
  }

  completeContract(businessId, actorPlayerId, contractId) {
    const biz = this.getById(businessId);
    if (!biz) return false;
    if (!this.canOperate(businessId, actorPlayerId).ok) return false;

    const ctr = biz.contracts.find((c) => c.id === contractId);
    if (!ctr || ctr.completed) return false;

    ctr.completed = true;
    biz.treasuryCAD = round2(biz.treasuryCAD + ctr.rewardCAD);
    biz.dailyRevenueCAD = round2(biz.dailyRevenueCAD + ctr.rewardCAD);
    biz.reputationStars = Math.min(5, round2(biz.reputationStars + 0.05));

    persist(this.core, biz);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PERSISTANCE / UTILITAIRES
  // ─────────────────────────────────────────────────────────────────────

  snapshot() {
    this.lastSnapshot = {
      schemaVersion: BUSINESS_SCHEMA_VERSION,
      takenAt: nowMs(),
      businesses: this.getAll(),
    };
    return this.lastSnapshot;
  }

  getLastSnapshot() {
    return this.lastSnapshot;
  }

  hydrate(snapshot) {
    let loaded = 0;
    for (const entity of snapshot.businesses || []) {
      if (!entity?.id) continue;
      const existing = this.getById(entity.id);
      if (existing && (existing.createdAt || 0) > (entity.createdAt || 0)) continue;

      const normalized = {
        ...entity,
        employees: Array.isArray(entity.employees) ? entity.employees : [],
        stock: Array.isArray(entity.stock) ? entity.stock : [],
        contracts: Array.isArray(entity.contracts) ? entity.contracts : [],
        payrollDebtCAD: entity.payrollDebtCAD || 0,
        schemaVersion: BUSINESS_SCHEMA_VERSION,
      };
      persist(this.core, normalized);
      loaded += 1;
    }
    this.onlinePlayers.clear();
    return loaded;
  }

  resetAll() {
    for (const id of this.core.memory.keys(BUSINESS_MEMORY_SCOPE)) {
      this.core.memory.delete(BUSINESS_MEMORY_SCOPE, id);
    }
    this.onlinePlayers.clear();
  }

  economicReport() {
    const all = this.getAll();
    const byType = {};
    let totalTreasury = 0, totalEmployees = 0, totalDebt = 0, open = 0, serving = 0;

    for (const biz of all) {
      byType[biz.type] = (byType[biz.type] || 0) + 1;
      totalTreasury = round2(totalTreasury + biz.treasuryCAD);
      totalEmployees += biz.employees.length;
      totalDebt = round2(totalDebt + biz.payrollDebtCAD);
      if (biz.open) open += 1;
      if (biz.open && biz.employees.some((e) => this.onlinePlayers.has(e.playerId))) serving += 1;
      if (biz.open && this.onlinePlayers.has(biz.ownerPlayerId)) serving += 1;
    }

    return {
      totalBusinesses: all.length, openBusinesses: open, servingNow: serving,
      totalTreasuryCAD: totalTreasury, totalEmployees, totalPayrollDebtCAD: totalDebt,
      availableSpots: this.getAvailableSpots().length, byType,
      season: this.getCurrentSeason(), onlinePlayers: this.onlinePlayers.size,
    };
  }

  armSchedules() {
    if (this.payrollTimerArmed) return;
    this.payrollTimerArmed = true;

    this.core.time.every('business.payroll_cycle', PAYROLL_CYCLE_MS, () => {
      for (const biz of this.getOpen()) {
        const operated = this.onlinePlayers.has(biz.ownerPlayerId) ||
                         biz.employees.some((e) => this.onlinePlayers.has(e.playerId));
        if (!operated) continue;
        this.chargeOverhead(biz.id, PAYROLL_HOURS_PER_CYCLE);
        this.runPayroll(biz.id);
      }
    });
  }
}

PlayerBusinessService.instance = null;

// ─────────────────────────────────────────────────────────────────────────
//  UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function operationRefusal(reason) {
  switch (reason) {
    case 'commerce_introuvable': return 'Commerce introuvable.';
    case 'commerce_ferme': return 'Ce commerce est fermé.';
    case 'joueur_non_identifie': return 'Identification joueur requise.';
    case 'pas_membre_du_personnel': return 'Accès refusé.';
    case 'joueur_hors_ligne': return 'Joueur hors ligne.';
    default: return 'Opération refusée.';
  }
}

export const playerBusinessService = PlayerBusinessService.getInstance();
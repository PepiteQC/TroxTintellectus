/**
 * ═══════════════════════════════════════════════════════════════════
 * CAISSE POPULAIRE DESJARDINS — Système Bancaire Multijoueur
 * ═══════════════════════════════════════════════════════════════════
 *
 * Système bancaire québécois réaliste :
 *  - Comptes multiples (chèque, épargne, REER, CELI, entreprise)
 *  - Cartes de débit AccèsD + cartes de crédit Visa Desjardins
 *  - Virements Interac entre joueurs
 *  - Hypothèques, prêts auto, marges de crédit
 *  - Placements REER/CELI avec fiscalité
 *  - GAB (guichets automatiques) avec cash physique
 *  - Fourgons blindés Garda (braquables)
 *  - Blanchiment d'argent (business front)
 *  - Saisies, faillites, ARC (impôts)
 *  - Employés joueurs (caissier, conseiller, directeur)
 *  - Chèques papier avec signatures
 *  - Historique complet, relevés mensuels
 *
 * Converti TS → JS (ESM) le 2026-09-23
 * Chemin : server/shared/buildings/bank.mjs
 *
 * ⚠️ AJUSTE LES IMPORTS CI-DESSOUS À TA STRUCTURE RÉELLE
 * ═══════════════════════════════════════════════════════════════════
 */

// ── IMPORTS (à ajuster selon ton arbo réelle) ───────────────────────
import { netEmit, netOn }       from "../net.mjs";
import { registerRemote }       from "./remotes.mjs";
import { sendPrivateMessage }   from "../communication/chat.mjs";
import { triggerNotification }  from "./phone.mjs";

// ═══════════════════════════════════════════════════════════
// TYPES (JSDoc pour autocomplétion IDE)
// ═══════════════════════════════════════════════════════════

/**
 * @typedef {(
 *   "deposit" | "withdrawal" | "transfer" | "interac" | "salary" |
 *   "loan" | "loan_payment" | "investment" | "investment_sale" |
 *   "business_income" | "business_expense" | "cheque_deposit" |
 *   "cheque_issued" | "credit_card" | "credit_payment" | "mortgage_payment" |
 *   "tax_payment" | "fee" | "interest" | "atm_fee" | "wire_transfer" |
 *   "laundering" | "seizure" | "refund"
 * )} TransactionType
 */

/**
 * @typedef {(
 *   "cheque" | "epargne" | "reer" | "celi" | "reee" |
 *   "business" | "gang" | "trust" | "joint"
 * )} AccountType
 */

/** @typedef {("active"|"paid_off"|"defaulted"|"restructured")} LoanStatus */
/** @typedef {("personal"|"auto"|"reno"|"mortgage"|"business"|"student"|"payday")} LoanType */
/** @typedef {("stock"|"bond"|"gic"|"mutual_fund"|"etf"|"crypto"|"business"|"property")} InvestmentType */
/** @typedef {("active"|"sold"|"lost"|"matured")} InvestmentStatus */
/** @typedef {("debit"|"credit"|"prepaid"|"business_debit")} CardType */
/** @typedef {("active"|"blocked"|"expired"|"stolen"|"lost")} CardStatus */
/** @typedef {("directeur"|"directeur_adjoint"|"conseiller"|"conseiller_financier"|"caissier"|"agent_securite"|"specialiste_hypotheque"|"conseiller_placement"|"client")} BankRole */

/**
 * @typedef {Object} BankAccount
 * @property {string} accountId
 * @property {string} accountNumber
 * @property {string} transitNumber
 * @property {string} institutionNumber
 * @property {string} playerId
 * @property {string} playerName
 * @property {AccountType} accountType
 * @property {number} balance
 * @property {number} overdraft
 * @property {number} overdraftLimit
 * @property {"CAD"|"USD"} currency
 * @property {number} createdDate
 * @property {string} [pin]
 * @property {boolean} locked
 * @property {boolean} frozen
 * @property {string} [frozenReason]
 * @property {number} interestRate
 * @property {number} monthlyFees
 * @property {string[]} linkedAccounts
 * @property {string[]} jointHolders
 * @property {string[]} authorizedUsers
 * @property {number} taxDeductions
 * @property {number} celiRoom
 * @property {boolean} isDefault
 */

/**
 * @typedef {Object} BankCard
 * @property {string} cardId
 * @property {string} cardNumber
 * @property {CardType} cardType
 * @property {string} linkedAccountId
 * @property {string} playerId
 * @property {string} playerName
 * @property {string} pin
 * @property {string} cvv
 * @property {number} expiryDate
 * @property {CardStatus} status
 * @property {number} [creditLimit]
 * @property {number} [currentBalance]
 * @property {number} [minimumPayment]
 * @property {number} [paymentDueDate]
 * @property {number} interestRate
 * @property {boolean} contactlessEnabled
 * @property {boolean} internationalEnabled
 * @property {boolean} onlinePurchasesEnabled
 * @property {number} dailyLimit
 * @property {number} monthlyLimit
 * @property {number} lastUsed
 */

/**
 * @typedef {Object} Transaction
 * @property {string} transactionId
 * @property {string} accountId
 * @property {string} playerId
 * @property {TransactionType} type
 * @property {number} amount
 * @property {number} timestamp
 * @property {string} description
 * @property {string} [category]
 * @property {string} [merchantName]
 * @property {{x:number,z:number}} [merchantLocation]
 * @property {string} [otherPartyId]
 * @property {string} [otherPartyName]
 * @property {number} balanceAfter
 * @property {string} [cardUsed]
 * @property {string} [chequeNumber]
 * @property {string} [reference]
 * @property {boolean} isPending
 * @property {boolean} isReversed
 * @property {boolean} isSuspicious
 * @property {boolean} taxReceiptRequired
 */

/**
 * @typedef {Object} Loan
 * @property {string} loanId
 * @property {LoanType} loanType
 * @property {string} borrowerId
 * @property {string} borrowerName
 * @property {string} lenderId
 * @property {string} lenderName
 * @property {string} [cosignerId]
 * @property {number} principal
 * @property {number} amountBorrowed
 * @property {number} amountRepaid
 * @property {number} interestRate
 * @property {number} termMonths
 * @property {number} monthlyPayment
 * @property {number} remainingMonths
 * @property {number} missedPayments
 * @property {string} [productId]
 * @property {LoanStatus} status
 * @property {number} startDate
 * @property {number} nextPaymentDue
 * @property {{type:string,itemId:string,estimatedValue:number}} [collateral]
 * @property {number} penaltyRate
 * @property {number} earlyPayoffPenalty
 * @property {boolean} autoDebitEnabled
 * @property {string} debitAccountId
 */

// ═══════════════════════════════════════════════════════════
// PRODUITS DE PRÊT
// ═══════════════════════════════════════════════════════════

/** @type {Array<Object>} */
export const LOAN_PRODUCTS = [
  {
    id: "payday", label: "Prêt sur salaire", loanType: "payday",
    minPrincipal: 100, maxPrincipal: 1500,
    months: 1, minMonths: 1, maxMonths: 2,
    rate: 391, requiresCollateral: false, minCreditScore: 0, minIncome: 500,
    hint: "⚠️ Taux abusif. Dernière option.",
  },
  {
    id: "mini", label: "Prêt express", loanType: "personal",
    minPrincipal: 500, maxPrincipal: 5000,
    months: 6, minMonths: 3, maxMonths: 12,
    rate: 12.99, requiresCollateral: false, minCreditScore: 550, minIncome: 1000,
    hint: "Approbation rapide, 4-12 versements.",
  },
  {
    id: "personnel", label: "Prêt personnel", loanType: "personal",
    minPrincipal: 2000, maxPrincipal: 25000,
    months: 24, minMonths: 12, maxMonths: 60,
    rate: 8.99, requiresCollateral: false, minCreditScore: 650, minIncome: 2000,
    hint: "Projet personnel, consolidation dettes.",
  },
  {
    id: "auto", label: "Prêt auto", loanType: "auto",
    minPrincipal: 5000, maxPrincipal: 80000,
    months: 60, minMonths: 24, maxMonths: 84,
    rate: 6.99, requiresCollateral: true, minCreditScore: 600, minIncome: 1500,
    hint: "Véhicule en garantie.",
  },
  {
    id: "reno", label: "Prêt rénovation", loanType: "reno",
    minPrincipal: 5000, maxPrincipal: 50000,
    months: 60, minMonths: 12, maxMonths: 120,
    rate: 7.49, requiresCollateral: false, minCreditScore: 620, minIncome: 2500,
    hint: "Cuisine, salle de bain, sous-sol.",
  },
  {
    id: "hypotheque", label: "Hypothèque", loanType: "mortgage",
    minPrincipal: 50000, maxPrincipal: 1500000,
    months: 300, minMonths: 60, maxMonths: 360,
    rate: 5.24, requiresCollateral: true, minCreditScore: 680, minIncome: 4000,
    hint: "Achat immobilier, 25 ans typique.",
  },
  {
    id: "entreprise", label: "Prêt entreprise", loanType: "business",
    minPrincipal: 10000, maxPrincipal: 500000,
    months: 120, minMonths: 24, maxMonths: 240,
    rate: 8.49, requiresCollateral: true, minCreditScore: 700, minIncome: 5000,
    hint: "Démarrage ou expansion.",
  },
  {
    id: "etudiant", label: "Prêt étudiant", loanType: "student",
    minPrincipal: 1000, maxPrincipal: 20000,
    months: 120, minMonths: 12, maxMonths: 180,
    rate: 4.5, requiresCollateral: false, minCreditScore: 500, minIncome: 0,
    hint: "Différé pendant les études.",
  },
];

// ═══════════════════════════════════════════════════════════
// LABELS & ACTIONS BOURSIÈRES
// ═══════════════════════════════════════════════════════════

/** @type {Record<InvestmentType, string>} */
export const INVEST_LABEL = {
  stock: "Actions boursières",
  bond: "Obligations",
  gic: "CPG (Certificat de placement garanti)",
  mutual_fund: "Fonds mutuels",
  etf: "FNB (Fonds négocié en bourse)",
  crypto: "Cryptomonnaie",
  business: "Parts d'entreprise",
  property: "Immobilier",
};

/** @type {Array<Object>} */
export const QUEBEC_STOCKS = [
  { symbol: "BBD.B", name: "Bombardier", currentPrice: 82.50, previousClose: 80.20, dayChange: 2.30, dayChangePercent: 2.87, volume: 1200000, marketCap: 8500000000, dividendYield: 0, sector: "Aéronautique", volatility: 0.08 },
  { symbol: "CNQ", name: "Canadian Natural Resources", currentPrice: 95.30, previousClose: 94.10, dayChange: 1.20, dayChangePercent: 1.27, volume: 800000, marketCap: 100000000000, dividendYield: 4.2, sector: "Énergie", volatility: 0.05 },
  { symbol: "CP", name: "Canadien Pacifique", currentPrice: 108.75, previousClose: 107.90, dayChange: 0.85, dayChangePercent: 0.79, volume: 500000, marketCap: 95000000000, dividendYield: 0.8, sector: "Transport", volatility: 0.04 },
  { symbol: "L", name: "Loblaws (Provigo)", currentPrice: 152.00, previousClose: 150.50, dayChange: 1.50, dayChangePercent: 1.00, volume: 300000, marketCap: 48000000000, dividendYield: 1.5, sector: "Alimentation", volatility: 0.03 },
  { symbol: "BCE", name: "Bell Canada", currentPrice: 44.20, previousClose: 44.80, dayChange: -0.60, dayChangePercent: -1.34, volume: 2500000, marketCap: 40000000000, dividendYield: 8.9, sector: "Télécom", volatility: 0.04 },
  { symbol: "RY", name: "Banque Royale", currentPrice: 138.90, previousClose: 137.60, dayChange: 1.30, dayChangePercent: 0.94, volume: 3000000, marketCap: 195000000000, dividendYield: 4.1, sector: "Finance", volatility: 0.03 },
  { symbol: "DOL", name: "Dollarama", currentPrice: 118.40, previousClose: 116.20, dayChange: 2.20, dayChangePercent: 1.89, volume: 400000, marketCap: 34000000000, dividendYield: 0.3, sector: "Détail", volatility: 0.05 },
  { symbol: "ATD", name: "Alimentation Couche-Tard", currentPrice: 78.60, previousClose: 77.90, dayChange: 0.70, dayChangePercent: 0.90, volume: 1500000, marketCap: 75000000000, dividendYield: 0.9, sector: "Détail", volatility: 0.04 },
];

/** @type {Array<Object>} */
export const CRYPTO_ASSETS = [
  { symbol: "BTC",  name: "Bitcoin",  currentPrice: 87500, previousClose: 85200, dayChange: 2300, dayChangePercent: 2.7,   volume: 25000000000, marketCap: 1700000000000, dividendYield: 0, sector: "Crypto", volatility: 0.15 },
  { symbol: "ETH",  name: "Ethereum", currentPrice: 4200,  previousClose: 4150,  dayChange: 50,   dayChangePercent: 1.2,   volume: 15000000000, marketCap: 500000000000,  dividendYield: 0, sector: "Crypto", volatility: 0.18 },
  { symbol: "DOGE", name: "Dogecoin", currentPrice: 0.28,  previousClose: 0.31,  dayChange: -0.03,dayChangePercent: -9.68, volume: 3000000000,  marketCap: 40000000000,   dividendYield: 0, sector: "Crypto", volatility: 0.35 },
];

// ═══════════════════════════════════════════════════════════
// CONSTANTES GAB
// ═══════════════════════════════════════════════════════════

export const ATM_START_CASH    = 25_000;
export const ATM_MAX           = 150_000;
export const ATM_MIN_REORDER   = 5_000;

// ═══════════════════════════════════════════════════════════
// ÉTAT GLOBAL (multijoueur, synchronisé)
// ═══════════════════════════════════════════════════════════

/** @type {Map<string, BankAccount>} */
const ACCOUNTS = new Map();

/** @type {Map<string, BankCard>} */
const CARDS = new Map();

/** @type {Map<string, Transaction[]>} */
const TRANSACTIONS = new Map();

/** @type {Map<string, Loan>} */
const LOANS = new Map();

/** @type {Map<string, any>} */
const INVESTMENTS = new Map();

/** @type {Map<string, any>} */
const ATMS = new Map();

/** @type {Map<string, any>} */
const BRANCHES = new Map();

/** @type {Map<string, any>} */
const CHEQUES = new Map();

/** @type {Map<string, any>} */
const CREDIT_PROFILES = new Map();

/** @type {Map<string, any>} */
const INTERAC_PENDING = new Map();

/** @type {Map<string, any>} */
const LINES_OF_CREDIT = new Map();

/** @type {Map<string, any>} */
const ARMORED_TRUCKS = new Map();

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function generateAccountNumber(branchTransit) {
  const account = Math.floor(Math.random() * 9000000 + 1000000);
  return `815-${branchTransit}-${account}`;
}

function generateCardNumber(type) {
  const prefix = type === "credit" ? "4530" : "4520";
  const parts = [prefix];
  for (let i = 0; i < 3; i++) {
    parts.push(Math.floor(Math.random() * 9000 + 1000).toString());
  }
  return parts.join("-");
}

function generateCVV() {
  return Math.floor(Math.random() * 900 + 100).toString();
}

function generatePIN() {
  return Math.floor(Math.random() * 9000 + 1000).toString();
}

// ═══════════════════════════════════════════════════════════
// OUVERTURE DE COMPTE
// ═══════════════════════════════════════════════════════════

/**
 * @param {string} playerId
 * @param {string} playerName
 * @param {AccountType} accountType
 * @param {string} branchId
 * @param {number} [initialDeposit]
 * @param {string} [openedBy]
 * @returns {{success:boolean, message:string, account:BankAccount|null, card:BankCard|null}}
 */
export function openAccount(playerId, playerName, accountType, branchId, initialDeposit = 0, openedBy) {
  const branch = BRANCHES.get(branchId);
  if (!branch) {
    return { success: false, message: "Succursale introuvable.", account: null, card: null };
  }

  if (accountType === "celi") {
    const existing = getPlayerAccounts(playerId).find(a => a.accountType === "celi");
    if (existing) {
      return { success: false, message: "Vous avez déjà un CELI. Utilisez celui-ci.", account: null, card: null };
    }
  }

  const accountNumber = generateAccountNumber(branch.transitNumber);
  const account = {
    accountId: uid("acc"),
    accountNumber,
    transitNumber: branch.transitNumber,
    institutionNumber: "815",
    playerId,
    playerName,
    accountType,
    balance: initialDeposit,
    overdraft: 0,
    overdraftLimit: accountType === "cheque" ? 500 : 0,
    currency: "CAD",
    createdDate: Date.now(),
    locked: false,
    frozen: false,
    interestRate: getAccountInterestRate(accountType),
    monthlyFees: getAccountFees(accountType),
    linkedAccounts: [],
    jointHolders: [],
    authorizedUsers: [],
    taxDeductions: 0,
    celiRoom: accountType === "celi" ? 7000 : 0,
    isDefault: getPlayerAccounts(playerId).length === 0,
  };

  ACCOUNTS.set(account.accountId, account);
  TRANSACTIONS.set(account.accountId, []);

  if (!CREDIT_PROFILES.has(playerId)) {
    CREDIT_PROFILES.set(playerId, {
      playerId,
      creditScore: 650,
      totalDebt: 0,
      monthlyIncome: 0,
      employmentStatus: "employed",
      employmentDuration: 0,
      latePayments: 0,
      bankruptcies: 0,
      collections: 0,
      activeAccounts: 1,
      creditUtilization: 0,
      oldestAccountAge: 0,
      inquiries: 1,
      lastUpdated: Date.now(),
      history: [{ date: Date.now(), event: "Ouverture premier compte", scoreChange: 0 }],
    });
  }

  let card = null;
  if (accountType === "cheque" || accountType === "epargne" || accountType === "business") {
    card = {
      cardId: uid("card"),
      cardNumber: generateCardNumber("debit"),
      cardType: accountType === "business" ? "business_debit" : "debit",
      linkedAccountId: account.accountId,
      playerId,
      playerName,
      pin: generatePIN(),
      cvv: generateCVV(),
      expiryDate: Date.now() + 4 * 365 * 24 * 3600 * 1000,
      status: "active",
      interestRate: 0,
      contactlessEnabled: true,
      internationalEnabled: false,
      onlinePurchasesEnabled: true,
      dailyLimit: 3000,
      monthlyLimit: 30000,
      lastUsed: 0,
    };
    CARDS.set(card.cardId, card);
  }

  branch.totalDeposits += initialDeposit;
  branch.todayTransactions++;

  if (openedBy) {
    const emp = branch.employees.find(e => e.playerId === openedBy);
    if (emp) {
      emp.accountsOpened++;
      emp.performanceRating = Math.min(100, emp.performanceRating + 1);
    }
  }

  triggerNotification(playerId, {
    title: "🎉 Compte ouvert !",
    body: `Compte ${accountType} #${accountNumber}\nSolde initial: ${initialDeposit}$`,
    icon: "🏦",
  });

  netEmit("bank:account_opened", { account, card });

  return {
    success: true,
    message: `Compte ${accountType} ouvert avec succès. Numéro: ${accountNumber}`,
    account,
    card,
  };
}

function getAccountInterestRate(type) {
  switch (type) {
    case "cheque":   return 0.05;
    case "epargne":  return 2.5;
    case "reer":     return 4.0;
    case "celi":     return 3.5;
    case "reee":     return 4.5;
    case "business": return 1.0;
    default:         return 0;
  }
}

function getAccountFees(type) {
  switch (type) {
    case "cheque":   return 4.95;
    case "business": return 25.00;
    case "epargne":  return 0;
    default:         return 0;
  }
}

// ═══════════════════════════════════════════════════════════
// CONSULTATION DE COMPTE
// ═══════════════════════════════════════════════════════════

export function getPlayerAccounts(playerId) {
  return Array.from(ACCOUNTS.values()).filter(a => a.playerId === playerId);
}

export function getAccount(accountId) {
  return ACCOUNTS.get(accountId) ?? null;
}

export function getDefaultAccount(playerId) {
  return getPlayerAccounts(playerId).find(a => a.isDefault) ?? null;
}

export function getPlayerCards(playerId) {
  return Array.from(CARDS.values()).filter(c => c.playerId === playerId);
}

export function getAccountTransactions(accountId, limit = 50) {
  const txs = TRANSACTIONS.get(accountId) ?? [];
  return txs.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════
// TRANSACTIONS (dépôts / retraits)
// ═══════════════════════════════════════════════════════════

function pushTransaction(account, type, amount, description, extra = {}) {
  const tx = {
    transactionId: uid("tx"),
    accountId: account.accountId,
    playerId: account.playerId,
    type,
    amount,
    timestamp: Date.now(),
    description,
    balanceAfter: account.balance,
    isPending: false,
    isReversed: false,
    isSuspicious: false,
    taxReceiptRequired: type === "loan_payment" || type === "investment" || type === "mortgage_payment",
    ...extra,
  };

  const list = TRANSACTIONS.get(account.accountId) ?? [];
  list.unshift(tx);
  if (list.length > 500) list.pop();
  TRANSACTIONS.set(account.accountId, list);

  if (amount >= 10000 && (type === "deposit" || type === "wire_transfer")) {
    tx.isSuspicious = true;
    netEmit("bank:suspicious_transaction", { tx, account });
  }

  netEmit("bank:transaction", { tx, accountId: account.accountId });
  return tx;
}

export function deposit(accountId, amount, atmId = null, source = "cash") {
  const account = ACCOUNTS.get(accountId);
  if (!account) return { ok: false, message: "Compte introuvable." };
  if (account.locked) return { ok: false, message: "Compte verrouillé." };
  if (account.frozen) return { ok: false, message: `Compte gelé: ${account.frozenReason}` };

  const n = Math.max(1, Math.round(amount * 100) / 100);

  if (atmId) {
    const atm = ATMS.get(atmId);
    if (!atm) return { ok: false, message: "GAB introuvable." };
    if (atm.broken) return { ok: false, message: `GAB hors service (${atm.brokenReason}).` };

    atm.cash = Math.min(atm.cash + n, atm.maxCapacity);
    atm.transactionsCount++;
  }

  account.balance = round2(account.balance + n);

  const txType =
    source === "cheque" ? "cheque_deposit" :
    source === "salary" ? "salary" :
    source === "transfer" ? "transfer" :
    "deposit";

  const tx = pushTransaction(account, txType, n, `Dépôt ${source}`, {
    merchantLocation: atmId ? ATMS.get(atmId)?.location : undefined,
  });

  return {
    ok: true,
    message: `Dépôt de ${n}$ effectué. Solde: ${account.balance}$`,
    balance: account.balance,
    cashChange: -n,
    transaction: tx,
  };
}

export function withdraw(accountId, amount, atmId = null, usingCard = null) {
  const account = ACCOUNTS.get(accountId);
  if (!account) return { ok: false, message: "Compte introuvable." };
  if (account.locked) return { ok: false, message: "Compte verrouillé." };
  if (account.frozen) return { ok: false, message: `Compte gelé: ${account.frozenReason}` };

  const n = Math.max(1, Math.round(amount * 100) / 100);
  const available = account.balance + account.overdraftLimit;

  if (available < n) {
    return { ok: false, message: `Solde insuffisant (disponible: ${available}$)` };
  }

  let interacFee = 0;
  if (atmId) {
    const atm = ATMS.get(atmId);
    if (!atm) return { ok: false, message: "GAB introuvable." };
    if (atm.broken) return { ok: false, message: `GAB hors service.` };
    if (atm.cash < n) return { ok: false, message: "GAB à sec — allez au comptoir." };

    if (atm.ownerBank !== "desjardins") {
      interacFee = atm.interacFee || 2.50;
    }

    atm.cash -= n;
    atm.transactionsCount++;
    atm.totalDispensed += n;
  }

  if (usingCard) {
    const card = CARDS.get(usingCard);
    if (!card || card.status !== "active") {
      return { ok: false, message: "Carte invalide ou bloquée." };
    }
    card.lastUsed = Date.now();
  }

  account.balance = round2(account.balance - n - interacFee);

  const tx = pushTransaction(account, "withdrawal", n, `Retrait GAB`, {
    cardUsed: usingCard ?? undefined,
    merchantLocation: atmId ? ATMS.get(atmId)?.location : undefined,
  });

  if (interacFee > 0) {
    pushTransaction(account, "atm_fee", interacFee, "Frais GAB étranger");
  }

  return {
    ok: true,
    message: `Retrait de ${n}$ effectué${interacFee > 0 ? ` (+${interacFee}$ frais)` : ""}. Solde: ${account.balance}$`,
    balance: account.balance,
    cashChange: n,
    transaction: tx,
  };
}

// ═══════════════════════════════════════════════════════════
// VIREMENTS INTERAC (entre joueurs)
// ═══════════════════════════════════════════════════════════

export function sendInterac(senderAccountId, recipientId, amount, securityQuestion, securityAnswer, memo) {
  const senderAccount = ACCOUNTS.get(senderAccountId);
  if (!senderAccount) return { ok: false, message: "Compte introuvable.", transfer: null };

  const n = Math.max(1, Math.round(amount * 100) / 100);
  const fee = 1.50;

  if (senderAccount.balance < n + fee) {
    return { ok: false, message: `Solde insuffisant (${n + fee}$ requis)`, transfer: null };
  }

  const transfer = {
    transferId: uid("interac"),
    senderId: senderAccount.playerId,
    senderName: senderAccount.playerName,
    senderAccountId,
    recipientPlayerId: recipientId,
    amount: n,
    currency: "CAD",
    securityQuestion,
    securityAnswer: securityAnswer.toLowerCase().trim(),
    memo,
    status: "pending",
    sentDate: Date.now(),
    expiryDate: Date.now() + 30 * 24 * 3600 * 1000,
    autoDepositEnabled: false,
    fee,
  };

  senderAccount.balance = round2(senderAccount.balance - n - fee);
  pushTransaction(senderAccount, "interac", n, `Virement Interac à ${recipientId}`, {
    otherPartyId: recipientId,
    reference: transfer.transferId,
    isPending: true,
  });
  pushTransaction(senderAccount, "fee", fee, "Frais virement Interac");

  INTERAC_PENDING.set(transfer.transferId, transfer);

  triggerNotification(recipientId, {
    title: "💸 Virement Interac reçu",
    body: `${senderAccount.playerName} vous envoie ${n}$\nMémo: ${memo || "(aucun)"}`,
    icon: "💰",
    action: { type: "accept_interac", transferId: transfer.transferId },
  });

  netEmit("bank:interac_sent", { transfer });

  return { ok: true, message: `Virement de ${n}$ envoyé. Question: "${securityQuestion}"`, transfer };
}

export function acceptInterac(transferId, recipientAccountId, answer) {
  const transfer = INTERAC_PENDING.get(transferId);
  if (!transfer) return { ok: false, message: "Virement introuvable." };
  if (transfer.status !== "pending") return { ok: false, message: "Virement déjà traité." };
  if (Date.now() > transfer.expiryDate) {
    transfer.status = "expired";
    return { ok: false, message: "Virement expiré." };
  }

  const recipientAccount = ACCOUNTS.get(recipientAccountId);
  if (!recipientAccount) return { ok: false, message: "Compte introuvable." };
  if (recipientAccount.playerId !== transfer.recipientPlayerId) {
    return { ok: false, message: "Compte incorrect." };
  }

  if (answer.toLowerCase().trim() !== transfer.securityAnswer) {
    return { ok: false, message: "❌ Réponse incorrecte." };
  }

  transfer.status = "accepted";
  transfer.acceptedDate = Date.now();

  recipientAccount.balance = round2(recipientAccount.balance + transfer.amount);
  pushTransaction(recipientAccount, "interac", transfer.amount, `Interac de ${transfer.senderName}`, {
    otherPartyId: transfer.senderId,
    otherPartyName: transfer.senderName,
    reference: transferId,
  });

  triggerNotification(transfer.senderId, {
    title: "✅ Interac accepté",
    body: `${transfer.recipientPlayerId} a accepté ${transfer.amount}$`,
    icon: "✓",
  });

  netEmit("bank:interac_accepted", { transfer });

  return { ok: true, message: `${transfer.amount}$ déposés dans votre compte.`, balance: recipientAccount.balance };
}

export function declineInterac(transferId) {
  const transfer = INTERAC_PENDING.get(transferId);
  if (!transfer) return { ok: false, message: "Virement introuvable." };
  if (transfer.status !== "pending") return { ok: false, message: "Déjà traité." };

  transfer.status = "declined";

  const senderAccount = ACCOUNTS.get(transfer.senderAccountId);
  if (senderAccount) {
    senderAccount.balance = round2(senderAccount.balance + transfer.amount);
    pushTransaction(senderAccount, "refund", transfer.amount, "Interac refusé - remboursement");
  }

  triggerNotification(transfer.senderId, {
    title: "❌ Interac refusé",
    body: `${transfer.recipientPlayerId} a refusé ${transfer.amount}$`,
    icon: "✗",
  });

  return { ok: true, message: "Virement refusé et remboursé." };
}

// ═══════════════════════════════════════════════════════════
// TRANSFERT ENTRE COMPTES
// ═══════════════════════════════════════════════════════════

export function transferBetweenAccounts(fromAccountId, toAccountId, amount) {
  const from = ACCOUNTS.get(fromAccountId);
  const to = ACCOUNTS.get(toAccountId);
  if (!from || !to) return { ok: false, message: "Compte introuvable." };
  if (from.locked || to.locked) return { ok: false, message: "Compte verrouillé." };

  const n = Math.max(1, Math.round(amount * 100) / 100);
  if (from.balance < n) return { ok: false, message: "Solde insuffisant." };

  if (to.accountType === "celi" && to.celiRoom < n) {
    return { ok: false, message: `Dépasse les droits CELI (${to.celiRoom}$ dispo).` };
  }

  from.balance = round2(from.balance - n);
  to.balance = round2(to.balance + n);

  if (to.accountType === "celi") to.celiRoom -= n;
  if (to.accountType === "reer") to.taxDeductions += n;

  pushTransaction(from, "transfer", n, `Virement vers ${to.accountType}`, {
    otherPartyId: to.playerId,
    otherPartyName: to.playerName,
  });
  pushTransaction(to, "transfer", n, `Virement depuis ${from.accountType}`, {
    otherPartyId: from.playerId,
    otherPartyName: from.playerName,
  });

  return { ok: true, message: `${n}$ transférés.`, balance: from.balance };
}

// ═══════════════════════════════════════════════════════════
// PRÊTS & HYPOTHÈQUES
// ═══════════════════════════════════════════════════════════

export function requestLoan(playerId, playerName, productId, requestedAmount, requestedMonths, debitAccountId, collateral) {
  const product = LOAN_PRODUCTS.find(p => p.id === productId);
  if (!product) return { ok: false, message: "Produit introuvable.", loan: null };

  const profile = CREDIT_PROFILES.get(playerId);
  if (!profile) return { ok: false, message: "Profil de crédit introuvable.", loan: null };

  if (profile.creditScore < product.minCreditScore) {
    return { ok: false, message: `❌ Cote de crédit insuffisante (${profile.creditScore} vs ${product.minCreditScore} requis)`, loan: null };
  }

  if (profile.monthlyIncome < product.minIncome) {
    return { ok: false, message: `❌ Revenu insuffisant (${profile.monthlyIncome}$/mois vs ${product.minIncome}$ requis)`, loan: null };
  }

  if (requestedAmount < product.minPrincipal || requestedAmount > product.maxPrincipal) {
    return { ok: false, message: `Montant hors des limites (${product.minPrincipal}$ – ${product.maxPrincipal}$)`, loan: null };
  }

  if (product.requiresCollateral && !collateral) {
    return { ok: false, message: "Garantie requise.", loan: null };
  }

  const monthlyRate = product.rate / 100 / 12;
  const months = requestedMonths;
  const payment = round2((requestedAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months)));

  const totalDebtRatio = (profile.totalDebt + payment) / profile.monthlyIncome;
  if (totalDebtRatio > 0.40) {
    return { ok: false, message: `❌ Ratio d'endettement trop élevé (${(totalDebtRatio * 100).toFixed(1)}% > 40%)`, loan: null };
  }

  const account = ACCOUNTS.get(debitAccountId);
  if (!account) return { ok: false, message: "Compte de débit introuvable.", loan: null };

  const loan = {
    loanId: uid("loan"),
    loanType: product.loanType,
    borrowerId: playerId,
    borrowerName: playerName,
    lenderId: "desjardins",
    lenderName: "Caisse Desjardins",
    principal: requestedAmount,
    amountBorrowed: requestedAmount,
    amountRepaid: 0,
    interestRate: product.rate,
    termMonths: months,
    monthlyPayment: payment,
    remainingMonths: months,
    missedPayments: 0,
    productId: product.id,
    status: "active",
    startDate: Date.now(),
    nextPaymentDue: Date.now() + 30 * 24 * 3600 * 1000,
    collateral,
    penaltyRate: 24.99,
    earlyPayoffPenalty: requestedAmount * 0.03,
    autoDebitEnabled: true,
    debitAccountId,
  };

  LOANS.set(loan.loanId, loan);

  account.balance = round2(account.balance + requestedAmount);
  pushTransaction(account, "loan", requestedAmount, `Prêt ${product.label}`, { reference: loan.loanId });

  profile.totalDebt += requestedAmount;
  profile.activeAccounts++;
  profile.creditScore = Math.max(300, profile.creditScore - 5);
  profile.history.push({ date: Date.now(), event: `Nouveau prêt ${product.label} (${requestedAmount}$)`, scoreChange: -5 });

  triggerNotification(playerId, {
    title: "✅ Prêt approuvé",
    body: `${requestedAmount}$ versés. Paiement mensuel: ${payment}$`,
    icon: "💰",
  });

  netEmit("bank:loan_approved", { loan });

  return { ok: true, message: `Prêt ${product.label} approuvé: ${requestedAmount}$`, loan };
}

export function payLoan(loanId, amount, accountId) {
  const loan = LOANS.get(loanId);
  if (!loan) return { ok: false, message: "Prêt introuvable.", loan: null };
  if (loan.status !== "active") return { ok: false, message: "Prêt non actif.", loan: null };

  const account = ACCOUNTS.get(accountId);
  if (!account) return { ok: false, message: "Compte introuvable.", loan: null };
  if (account.balance < amount) return { ok: false, message: "Solde insuffisant.", loan: null };

  account.balance = round2(account.balance - amount);
  loan.amountRepaid += amount;
  loan.remainingMonths = Math.max(0, loan.remainingMonths - 1);
  loan.nextPaymentDue = Date.now() + 30 * 24 * 3600 * 1000;

  pushTransaction(account, "loan_payment", amount, `Paiement prêt ${loan.productId}`, { reference: loanId });

  const profile = CREDIT_PROFILES.get(loan.borrowerId);
  if (profile) {
    profile.totalDebt = Math.max(0, profile.totalDebt - amount);
    profile.creditScore = Math.min(900, profile.creditScore + 2);
  }

  if (loan.amountRepaid >= loan.amountBorrowed || loan.remainingMonths === 0) {
    loan.status = "paid_off";
    if (profile) {
      profile.creditScore = Math.min(900, profile.creditScore + 15);
      profile.history.push({ date: Date.now(), event: `Prêt ${loan.productId} soldé`, scoreChange: 15 });
    }
    triggerNotification(loan.borrowerId, {
      title: "🎉 Prêt remboursé !",
      body: `Le prêt ${loan.productId} est soldé. Merci!`,
      icon: "✓",
    });
  }

  return {
    ok: true,
    message: loan.status === "paid_off" ? "Prêt soldé!" : `Paiement de ${amount}$ effectué.`,
    loan,
  };
}

// ═══════════════════════════════════════════════════════════
// PLACEMENTS
// ═══════════════════════════════════════════════════════════

export function buyInvestment(playerId, accountId, type, symbol, amount) {
  const account = ACCOUNTS.get(accountId);
  if (!account) return { ok: false, message: "Compte introuvable.", investment: null };
  if (account.balance < amount) return { ok: false, message: "Solde insuffisant.", investment: null };

  const stockList = type === "crypto" ? CRYPTO_ASSETS : QUEBEC_STOCKS;
  const stock = stockList.find(s => s.symbol === symbol);
  if (!stock && (type === "stock" || type === "crypto")) {
    return { ok: false, message: "Titre introuvable.", investment: null };
  }

  const unitPrice = stock?.currentPrice ?? 100;
  const units = amount / unitPrice;

  account.balance = round2(account.balance - amount);

  const inv = {
    investmentId: uid("inv"),
    playerId,
    accountId,
    type,
    name: stock?.name ?? INVEST_LABEL[type],
    symbol: stock?.symbol,
    principal: amount,
    units,
    unitPrice,
    currentValue: amount,
    return: 0,
    dividendYield: stock?.dividendYield,
    startDate: Date.now(),
    status: "active",
    taxSheltered: account.accountType === "reer" || account.accountType === "celi",
    riskLevel: type === "crypto" ? "extreme" : type === "stock" ? "high" : type === "gic" ? "low" : "medium",
    autoReinvest: false,
  };

  if (type === "gic") {
    inv.maturityDate = Date.now() + 5 * 365 * 24 * 3600 * 1000;
  }

  INVESTMENTS.set(inv.investmentId, inv);
  pushTransaction(account, "investment", amount, `Achat ${inv.name}`, { reference: inv.investmentId });

  return { ok: true, message: `${units.toFixed(4)} unités de ${inv.name} achetées.`, investment: inv };
}

export function sellInvestment(investmentId, accountId) {
  const inv = INVESTMENTS.get(investmentId);
  if (!inv) return { ok: false, message: "Placement introuvable.", proceeds: 0 };
  if (inv.status !== "active") return { ok: false, message: "Placement inactif.", proceeds: 0 };

  const account = ACCOUNTS.get(accountId);
  if (!account) return { ok: false, message: "Compte introuvable.", proceeds: 0 };

  const proceeds = inv.currentValue;
  const gain = proceeds - inv.principal;

  let tax = 0;
  if (!inv.taxSheltered && gain > 0) {
    tax = round2(gain * 0.5 * 0.30);
  }

  account.balance = round2(account.balance + proceeds - tax);
  inv.status = "sold";

  pushTransaction(account, "investment_sale", proceeds - tax, `Vente ${inv.name}`, { reference: investmentId });

  if (tax > 0) {
    pushTransaction(account, "tax_payment", tax, "Impôt gain en capital");
  }

  return {
    ok: true,
    message: `${inv.name} vendu pour ${proceeds}$${tax > 0 ? ` (impôt: ${tax}$)` : ""}`,
    proceeds: proceeds - tax,
  };
}

// ═══════════════════════════════════════════════════════════
// CHÈQUES
// ═══════════════════════════════════════════════════════════

export function issueCheque(issuerAccountId, payeeName, amount, memo = "") {
  const account = ACCOUNTS.get(issuerAccountId);
  if (!account) return { ok: false, message: "Compte introuvable.", cheque: null };

  const chequeNumber = `${Date.now().toString().slice(-6)}`;
  const cheque = {
    chequeId: uid("chq"),
    chequeNumber,
    issuerAccountId,
    issuerName: account.playerName,
    payeeName,
    amount: round2(amount),
    memo,
    issueDate: Date.now(),
    status: "issued",
    isSigned: true,
    isCertified: false,
  };

  CHEQUES.set(cheque.chequeId, cheque);
  return { ok: true, message: `Chèque #${chequeNumber} émis.`, cheque };
}

export function cashCheque(chequeId, payeeAccountId) {
  const cheque = CHEQUES.get(chequeId);
  if (!cheque) return { ok: false, message: "Chèque introuvable.", amount: 0 };
  if (cheque.status !== "issued") return { ok: false, message: "Chèque déjà encaissé/annulé.", amount: 0 };

  const issuerAccount = ACCOUNTS.get(cheque.issuerAccountId);
  const payeeAccount = ACCOUNTS.get(payeeAccountId);
  if (!issuerAccount || !payeeAccount) return { ok: false, message: "Compte introuvable.", amount: 0 };

  if (issuerAccount.balance < cheque.amount) {
    cheque.status = "bounced";
    return { ok: false, message: "❌ Chèque sans provision (NSF).", amount: 0 };
  }

  issuerAccount.balance = round2(issuerAccount.balance - cheque.amount);
  payeeAccount.balance = round2(payeeAccount.balance + cheque.amount);
  cheque.status = "cashed";
  cheque.cashDate = Date.now();
  cheque.payeeAccountId = payeeAccountId;

  pushTransaction(issuerAccount, "cheque_issued", cheque.amount, `Chèque #${cheque.chequeNumber} à ${cheque.payeeName}`, { chequeNumber: cheque.chequeNumber });
  pushTransaction(payeeAccount, "cheque_deposit", cheque.amount, `Chèque #${cheque.chequeNumber} de ${cheque.issuerName}`, { chequeNumber: cheque.chequeNumber });

  return { ok: true, message: `Chèque de ${cheque.amount}$ encaissé.`, amount: cheque.amount };
}

// ═══════════════════════════════════════════════════════════
// BLANCHIMENT D'ARGENT
// ═══════════════════════════════════════════════════════════

export function launderMoney(playerId, dirtyAmount, businessAccountId, method) {
  const account = ACCOUNTS.get(businessAccountId);
  if (!account) return { ok: false, message: "Compte introuvable.", cleanAmount: 0, risk: 0 };
  if (account.accountType !== "business" && account.accountType !== "gang") {
    return { ok: false, message: "Requiert un compte entreprise.", cleanAmount: 0, risk: 0 };
  }

  const efficiency = { restaurant: 0.75, car_wash: 0.80, construction: 0.85, crypto: 0.65 }[method];
  const cleanAmount = round2(dirtyAmount * efficiency);
  account.balance = round2(account.balance + cleanAmount);

  const risk = Math.min(100, (dirtyAmount / 5000) * 20);

  pushTransaction(account, "laundering", cleanAmount, `Revenu ${method}`, { isSuspicious: risk > 50 });

  if (dirtyAmount >= 10000) {
    netEmit("bank:canafe_alert", { accountId: businessAccountId, playerId, amount: dirtyAmount, method });
  }

  return { ok: true, message: `${cleanAmount}$ nettoyés (${(efficiency * 100)}% efficience)`, cleanAmount, risk };
}

// ═══════════════════════════════════════════════════════════
// SAISIES
// ═══════════════════════════════════════════════════════════

export function seizeAccount(accountId, reason, authorityId) {
  const account = ACCOUNTS.get(accountId);
  if (!account) return { ok: false, message: "Compte introuvable.", amountSeized: 0 };

  const amount = account.balance;
  account.balance = 0;
  account.frozen = true;
  account.frozenReason = reason;

  pushTransaction(account, "seizure", amount, `Saisie: ${reason}`, { otherPartyId: authorityId });

  triggerNotification(account.playerId, {
    title: "⚠️ Compte saisi",
    body: `${amount}$ saisis par ${authorityId}. Raison: ${reason}`,
    icon: "🚨",
  });

  return { ok: true, message: `${amount}$ saisis.`, amountSeized: amount };
}

// ═══════════════════════════════════════════════════════════
// PAIEMENT SALAIRE
// ═══════════════════════════════════════════════════════════

export function paySalary(employerId, employeeId, grossAmount, description = "Salaire") {
  const employer = ACCOUNTS.get(employerId) || getDefaultAccount(employerId);
  const employee = getDefaultAccount(employeeId);
  if (!employer || !employee) return { ok: false, message: "Compte introuvable.", netAmount: 0 };

  const fedTax = grossAmount * 0.15;
  const qcTax = grossAmount * 0.14;
  const rrq = grossAmount * 0.0640;
  const ae = grossAmount * 0.0163;
  const totalDeductions = round2(fedTax + qcTax + rrq + ae);
  const netAmount = round2(grossAmount - totalDeductions);

  if (employer.balance < grossAmount) return { ok: false, message: "Fonds insuffisants.", netAmount: 0 };

  employer.balance = round2(employer.balance - grossAmount);
  employee.balance = round2(employee.balance + netAmount);

  pushTransaction(employer, "business_expense", grossAmount, `Paie: ${employee.playerName}`, { otherPartyId: employeeId });
  pushTransaction(employee, "salary", netAmount, description, { otherPartyId: employerId, category: "salaire" });

  const profile = CREDIT_PROFILES.get(employeeId);
  if (profile) {
    profile.monthlyIncome = Math.max(profile.monthlyIncome, netAmount * 4.33);
    profile.employmentDuration++;
  }

  return { ok: true, message: `Salaire net: ${netAmount}$`, netAmount };
}

// ═══════════════════════════════════════════════════════════
// INTÉRÊTS QUOTIDIENS
// ═══════════════════════════════════════════════════════════

export function processDailyInterest() {
  for (const account of ACCOUNTS.values()) {
    if (account.balance <= 0 || account.locked || account.frozen) continue;
    const dailyRate = account.interestRate / 365 / 100;
    const interest = round2(account.balance * dailyRate);
    if (interest > 0) {
      account.balance += interest;
      pushTransaction(account, "interest", interest, "Intérêts quotidiens");
    }
  }

  for (const inv of INVESTMENTS.values()) {
    if (inv.status !== "active") continue;
    const stockList = inv.type === "crypto" ? CRYPTO_ASSETS : QUEBEC_STOCKS;
    const stock = stockList.find(s => s.symbol === inv.symbol);
    if (stock) {
      inv.unitPrice = stock.currentPrice;
      inv.currentValue = round2(inv.units * stock.currentPrice);
      inv.return = round2(((inv.currentValue - inv.principal) / inv.principal) * 100);
    }
  }

  netEmit("bank:daily_processed", { timestamp: Date.now() });
}

// ═══════════════════════════════════════════════════════════
// SUCCURSALES (employés joueurs)
// ═══════════════════════════════════════════════════════════

export function createBranch(name, address, position, ownerBank = "desjardins") {
  const transitNumber = String(Math.floor(Math.random() * 89999 + 10000));
  const branch = {
    branchId: uid("branch"),
    name,
    transitNumber,
    address,
    position,
    ownerBank,
    employees: [],
    vaultCash: 500000,
    vaultCapacity: 5000000,
    isOpen: false,
    openHours: { open: 8, close: 20 },
    atms: [],
    totalDeposits: 0,
    totalLoans: 0,
    todayTransactions: 0,
    securityLevel: 70,
    cameras: [],
    alarmSystem: true,
    lastRobbery: null,
    guards: [],
  };
  BRANCHES.set(branch.branchId, branch);
  return branch;
}

export function hireBankEmployee(branchId, hiringPlayerId, targetId, targetName, role, hourlyRate) {
  const branch = BRANCHES.get(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable." };

  const hiring = branch.employees.find(e => e.playerId === hiringPlayerId);
  if (!hiring || (hiring.role !== "directeur" && hiring.role !== "directeur_adjoint")) {
    return { ok: false, message: "Permission refusée." };
  }

  if (hourlyRate < 22) return { ok: false, message: "Min. 22$/h pour la banque." };

  branch.employees.push({
    playerId: targetId,
    playerName: targetName,
    role,
    hourlyRate,
    isClockedIn: false,
    clockInTime: null,
    hoursWorked: 0,
    totalEarned: 0,
    performanceRating: 50,
    loansApproved: 0,
    accountsOpened: 0,
    branchId,
  });

  triggerNotification(targetId, {
    title: "🏦 Embauché à la banque !",
    body: `${branch.name} — ${role} @ ${hourlyRate}$/h`,
    icon: "🎉",
  });

  return { ok: true, message: "Employé embauché." };
}

// ═══════════════════════════════════════════════════════════
// BRAQUAGE
// ═══════════════════════════════════════════════════════════

export function robBank(branchId, robberIds, weaponPower) {
  const branch = BRANCHES.get(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable.", loot: 0, wanted: 0 };
  if (!branch.isOpen) return { ok: false, message: "Banque fermée.", loot: 0, wanted: 0 };

  const now = Date.now();
  if (branch.lastRobbery && now - branch.lastRobbery < 3600000) {
    return { ok: false, message: "Trop tôt depuis le dernier braquage.", loot: 0, wanted: 0 };
  }

  const attack = weaponPower * robberIds.length;
  const defense = branch.securityLevel + (branch.guards.length * 30);
  const success = Math.random() * (attack + defense) < attack;

  branch.lastRobbery = now;
  netEmit("police:911_call", {
    location: branch.position,
    type: "Braquage de banque",
    description: `${robberIds.length} suspects armés à ${branch.name}`,
  });

  if (!success) {
    return { ok: false, message: "❌ Braquage échoué. Police en route.", loot: 0, wanted: 300 };
  }

  const loot = Math.min(branch.vaultCash * 0.3, 250000);
  branch.vaultCash -= loot;
  const perPerson = round2(loot / robberIds.length);

  for (const robberId of robberIds) {
    const account = getDefaultAccount(robberId);
    if (account) {
      triggerNotification(robberId, {
        title: "💰 Braquage réussi",
        body: `${perPerson}$ en cash. FUYEZ MAINTENANT!`,
        icon: "🎭",
      });
    }
  }

  return { ok: true, message: `Braquage réussi: ${loot}$`, loot, wanted: 500 };
}

// ═══════════════════════════════════════════════════════════
// REMOTES (RPC multijoueur)
// ═══════════════════════════════════════════════════════════

registerRemote("bank:open_account", openAccount);
registerRemote("bank:deposit", deposit);
registerRemote("bank:withdraw", withdraw);
registerRemote("bank:send_interac", sendInterac);
registerRemote("bank:accept_interac", acceptInterac);
registerRemote("bank:decline_interac", declineInterac);
registerRemote("bank:transfer", transferBetweenAccounts);
registerRemote("bank:request_loan", requestLoan);
registerRemote("bank:pay_loan", payLoan);
registerRemote("bank:buy_investment", buyInvestment);
registerRemote("bank:sell_investment", sellInvestment);
registerRemote("bank:issue_cheque", issueCheque);
registerRemote("bank:cash_cheque", cashCheque);
registerRemote("bank:launder", launderMoney);
registerRemote("bank:seize", seizeAccount);
registerRemote("bank:pay_salary", paySalary);
registerRemote("bank:hire_employee", hireBankEmployee);
registerRemote("bank:rob", robBank);

// ═══════════════════════════════════════════════════════════
// HELPERS DE COMPATIBILITÉ ANCIEN CODE
// ═══════════════════════════════════════════════════════════

export function getPlayerCash(_playerId) {
  return 0;
}

export function addCash(amount, playerId) {
  netEmit("player:cash_add", { playerId, amount });
}

export function removeCash(amount, playerId) {
  netEmit("player:cash_remove", { playerId, amount });
}

export function transferMoney(fromId, toId, amount) {
  const from = getDefaultAccount(fromId);
  const to = getDefaultAccount(toId);
  if (from && to) transferBetweenAccounts(from.accountId, to.accountId, amount);
}

export const EMPTY_ECONOMY = {
  cash: 0,
  bank: 0,
  debt: 0,
  transactions: [],
};

export function parseEconomy(raw) {
  if (!raw) return EMPTY_ECONOMY;
  return {
    cash: typeof raw.cash === "number" ? raw.cash : 0,
    bank: typeof raw.bank === "number" ? raw.bank : 0,
    debt: typeof raw.debt === "number" ? raw.debt : 0,
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
  };
}

export function pushTx(accountOrTx, type, amount, description, balanceAfter, otherPartyId) {
  if (accountOrTx && typeof type === "string" && typeof amount === "number") {
    const account = accountOrTx;
    if (account && account.accountId) {
      pushTransaction(account, type, amount, description ?? "Opération", {
        otherPartyId: typeof otherPartyId === "string" ? otherPartyId : undefined,
        balanceAfter: typeof balanceAfter === "number" ? balanceAfter : account.balance,
      });
      return;
    }
  }
  if (accountOrTx && typeof accountOrTx === "object" && "amount" in accountOrTx) {
    const tx = accountOrTx;
    console.log(`[Banque] Transaction enregistrée: ${tx.label} — ${tx.amount}$`);
    if (tx.from) {
      const acc = getDefaultAccount(tx.from);
      if (acc) pushTransaction(acc, "transfer", tx.amount, tx.label);
    }
  }
}

export function breakAtm(atmId) {
  const atm = ATMS.get(atmId);
  if (!atm) return { ok: false, cashLooted: 0 };
  atm.broken = true;
  atm.brokenReason = "vandalized";
  const loot = Math.min(atm.cash, 1000 + Math.floor(Math.random() * 3000));
  atm.cash = Math.max(0, atm.cash - loot);
  return { ok: true, cashLooted: loot };
}

export function atmStatus(param1, param2) {
  const atmId = typeof param1 === "string" ? param1 : typeof param2 === "string" ? param2 : null;
  const atm = atmId ? ATMS.get(atmId) : null;
  const isBroken = atm ? atm.broken : false;
  const cash = atm ? atm.cash : 25000;
  return { online: !isBroken, broken: isBroken, cashAvailable: cash, cash };
}

// ═══════════════════════════════════════════════════════════
// EXPORTS ADDITIONNELS
// ═══════════════════════════════════════════════════════════

export { ACCOUNTS, CARDS, LOANS, INVESTMENTS, BRANCHES, ATMS };

export function getBranch(id)         { return BRANCHES.get(id) ?? null; }
export function getAllBranches()      { return Array.from(BRANCHES.values()); }
export function getCreditProfile(pid){ return CREDIT_PROFILES.get(pid) ?? null; }
export function getLoan(loanId)       { return LOANS.get(loanId) ?? null; }
export function getPlayerLoans(pid)   { return Array.from(LOANS.values()).filter(l => l.borrowerId === pid); }
export function getPlayerInvestments(pid) { return Array.from(INVESTMENTS.values()).filter(i => i.playerId === pid); }

// ═══════════════════════════════════════════════════════════
// COMPATIBILITÉ STORE (legacy)
// ═══════════════════════════════════════════════════════════

function legacyEconomySync(economy, cash, bank) {
  return { ...economy, cash: Math.round(cash * 100) / 100, bank: Math.round(bank * 100) / 100 };
}

function legacyEconomyTx(economy, description, amount) {
  const transactions = Array.isArray(economy.transactions) ? [...economy.transactions] : [];
  transactions.push({
    id: `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "legacy",
    amount,
    description,
    timestamp: Date.now(),
  });
  return { ...economy, transactions };
}

export function opDeposit(economy, cash, bank, amount) {
  const n = Math.round(amount * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "Montant invalide." };
  if (cash < n) return { ok: false, reason: "Espèces insuffisantes." };

  const nextCash = Math.round((cash - n) * 100) / 100;
  const nextBank = Math.round((bank + n) * 100) / 100;
  let nextEconomy = legacyEconomySync(economy, nextCash, nextBank);
  nextEconomy = legacyEconomyTx(nextEconomy, "Dépôt GAB", n);

  return { ok: true, cash: nextCash, bank: nextBank, economy: nextEconomy };
}

export function opWithdraw(economy, cash, bank, amount) {
  const n = Math.round(amount * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "Montant invalide." };
  if (bank < n) return { ok: false, reason: "Solde Caisse insuffisant." };

  const nextCash = Math.round((cash + n) * 100) / 100;
  const nextBank = Math.round((bank - n) * 100) / 100;
  let nextEconomy = legacyEconomySync(economy, nextCash, nextBank);
  nextEconomy = legacyEconomyTx(nextEconomy, "Retrait GAB", -n);

  return { ok: true, cash: nextCash, bank: nextBank, economy: nextEconomy };
}

export function opTransferPersonalToFirm(economy, bank, firmBalance, amount) {
  const n = Math.round(amount * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "Montant invalide." };
  if (bank < n) return { ok: false, reason: "Solde personnel insuffisant." };

  const nextBank = Math.round((bank - n) * 100) / 100;
  const nextFirmBalance = Math.round((firmBalance + n) * 100) / 100;
  let nextEconomy = legacyEconomySync(economy, Number(economy.cash ?? 0), nextBank);
  nextEconomy = legacyEconomyTx(nextEconomy, "Virement personnel vers entreprise", -n);

  return { ok: true, bank: nextBank, firmBalance: nextFirmBalance, economy: nextEconomy };
}

export function opTransferFirmToPersonal(economy, bank, firmBalance, amount) {
  const n = Math.round(amount * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "Montant invalide." };
  if (firmBalance < n) return { ok: false, reason: "Solde entreprise insuffisant." };

  const nextBank = Math.round((bank + n) * 100) / 100;
  const nextFirmBalance = Math.round((firmBalance - n) * 100) / 100;
  let nextEconomy = legacyEconomySync(economy, Number(economy.cash ?? 0), nextBank);
  nextEconomy = legacyEconomyTx(nextEconomy, "Virement entreprise vers personnel", n);

  return { ok: true, bank: nextBank, firmBalance: nextFirmBalance, economy: nextEconomy };
}

export function opRequestLoan(economy, bank, _playerId, _playerName, amount) {
  const n = Math.round(amount * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "Montant invalide." };
  if (n > 250000) return { ok: false, reason: "Montant de prêt trop élevé." };

  const nextBank = Math.round((bank + n) * 100) / 100;
  let nextEconomy = legacyEconomySync(economy, Number(economy.cash ?? 0), nextBank);
  nextEconomy = legacyEconomyTx(nextEconomy, "Prêt Caisse populaire", n);
  nextEconomy = { ...nextEconomy, debt: Math.round((Number(nextEconomy.debt ?? 0) + n) * 100) / 100 };

  return { ok: true, bank: nextBank, economy: nextEconomy };
}

export function opInvest(economy, bank, _playerId, type, amount) {
  const n = Math.round(amount * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "Montant invalide." };
  if (bank < n) return { ok: false, reason: "Solde insuffisant." };

  const nextBank = Math.round((bank - n) * 100) / 100;
  let nextEconomy = legacyEconomySync(economy, Number(economy.cash ?? 0), nextBank);
  nextEconomy = legacyEconomyTx(nextEconomy, `Placement ${String(type)}`, -n);

  return { ok: true, bank: nextBank, economy: nextEconomy };
}

export function opSellInvestment(economy, bank, investmentRef) {
  let proceeds = 0;

  if (typeof investmentRef === "number" && Number.isFinite(investmentRef)) {
    proceeds = Math.round(investmentRef * 100) / 100;
  }

  if (proceeds <= 0 && Array.isArray(economy.transactions)) {
    const txs = economy.transactions;
    for (let i = txs.length - 1; i >= 0; i--) {
      const tx = txs[i];
      if (
        tx && typeof tx.amount === "number" && tx.amount < 0 &&
        typeof tx.description === "string" && tx.description.toLowerCase().includes("placement")
      ) {
        proceeds = Math.round(Math.abs(tx.amount) * 100) / 100;
        break;
      }
    }
  }

  if (proceeds <= 0) return { ok: false, reason: "Placement introuvable." };

  const nextBank = Math.round((bank + proceeds) * 100) / 100;
  let nextEconomy = legacyEconomySync(economy, Number(economy.cash ?? 0), nextBank);
  nextEconomy = legacyEconomyTx(nextEconomy, "Rachat placement", proceeds);

  return { ok: true, bank: nextBank, economy: nextEconomy };
}

export function tickEconomy(economy, bank, gameHours) {
  const previousHours = Number(economy.lastHours ?? gameHours);
  const deltaHours = Number.isFinite(gameHours) ? gameHours - previousHours : 0;

  let nextBank = bank;
  let nextEconomy = { ...economy, bank, lastHours: gameHours };

  if (deltaHours >= 24) {
    const days = Math.floor(deltaHours / 24);
    const interest = Math.round(Math.max(0, nextBank) * 0.0001 * days * 100) / 100;

    nextBank = Math.round((nextBank + interest) * 100) / 100;
    nextEconomy = legacyEconomySync(nextEconomy, Number(economy.cash ?? 0), nextBank);

    if (interest > 0) {
      nextEconomy = legacyEconomyTx(nextEconomy, "Intérêts bancaires", interest);
    }

    return { economy: nextEconomy, bank: nextBank, notice: interest > 0 ? `Intérêts +${interest}$` : null };
  }

  return { economy: nextEconomy, bank: nextBank, notice: null };
}
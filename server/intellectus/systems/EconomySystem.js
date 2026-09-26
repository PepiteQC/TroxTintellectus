/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/ECONOMYSYSTEM.JS
 * Économie avancée : portefeuille, banque, virements et intérêts
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server\intellectus\admin\systems/EconomySystem.js
 */

const SIG = 'TROXT⬡';

/**
 * @typedef {object} Account
 * @property {string} id
 * @property {number} cash
 * @property {number} bank
 *
 * @typedef {'give' | 'set' | 'deposit' | 'withdraw' | 'transfer_out' | 'transfer_in' | 'tax' | 'interest' | 'bank_transfer_out' | 'bank_transfer_in'} TxType
 *
 * @typedef {object} Transaction
 * @property {string} id
 * @property {TxType} type
 * @property {string} [from]
 * @property {string} [to]
 * @property {number} amount
 * @property {number} balanceAfter
 * @property {string} [reason]
 * @property {number} timestamp
 */

export class EconomySystem {
  /**
   * @param {object} [options]
   * @param {number} [options.transferTaxRate=0.05]      - Taux de taxe sur les paiements de poche (0.05 = 5%)
   * @param {number} [options.bankTransferTaxRate=0.01]  - Taux de taxe préférentiel sur les virements bancaires (1%)
   * @param {number} [options.interestRate=0.01]         - Taux d'intérêt par cycle d'épargne (1%)
   * @param {number} [options.startingCash=0]            - Solde de départ des nouveaux arrivants
   * @param {number} [options.txLimit=50000]             - Limite de stockage des transactions en RAM (FIFO glissant)
   */
  constructor(options = {}) {
    this.accounts = new Map();
    this.transactions = [];
    this.seq = 0;

    this.taxRate = options.transferTaxRate ?? 0.05;
    this.bankTaxRate = options.bankTransferTaxRate ?? 0.01;
    this.interestRate = options.interestRate ?? 0.01;
    this.startingCash = options.startingCash ?? 0;
    this.txLimit = options.txLimit ?? 50000;
    this.sig = SIG;
  }

  // ─── GESTION DES COMPTES ───────────────────────────────────────────────────

  /**
   * Récupère ou instancie un compte pour un identifiant de joueur.
   * @private
   * @param {string} id 
   * @returns {Account}
   */
  _account(id) {
    let acc = this.accounts.get(id);
    if (!acc) {
      acc = { id, cash: this.startingCash, bank: 0 };
      this.accounts.set(id, acc);
    }
    return acc;
  }

  /**
   * Récupère l'état financier global d'un compte.
   * @param {string} id 
   * @returns {{ cash: number, bank: number, total: number }}
   */
  getBalance(id) {
    const a = this._account(id);
    return { cash: a.cash, bank: a.bank, total: a.cash + a.bank };
  }

  /**
   * Enregistre une transaction dans l'historique glissant (FIFO).
   * @private
   * @param {Omit<Transaction, "id" | "timestamp">} tx 
   * @returns {Transaction}
   */
  _record(tx) {
    const t = {
      ...tx,
      id: `tx_${Date.now()}_${this.seq++}`,
      timestamp: Date.now(),
    };
    this.transactions.push(t);

    // Évite la saturation de la RAM : tronque l'historique le plus ancien
    if (this.transactions.length > this.txLimit) {
      this.transactions.shift();
    }
    return t;
  }

  // ─── OPÉRATIONS ADMINISTRATIVES (CONTRÔLE) ─────────────────────────────────

  /**
   * Crédite de l'argent cash sur le portefeuille d'un joueur.
   * @param {string} id 
   * @param {number} amount 
   * @param {string} [reason="admin"] 
   */
  give(id, amount, reason = "admin") {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Le montant crédité doit être un nombre fini supérieur à zéro.");
    }
    const a = this._account(id);
    a.cash += amount;
    return this._record({ type: "give", to: id, amount, balanceAfter: a.cash, reason });
  }

  /**
   * Force le solde cash d'un portefeuille à une valeur exacte.
   * @param {string} id 
   * @param {number} amount 
   * @param {string} [reason="admin"] 
   */
  set(id, amount, reason = "admin") {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Le montant du portefeuille ne peut pas être négatif ou indéfini.");
    }
    const a = this._account(id);
    a.cash = amount;
    return this._record({ type: "set", to: id, amount, balanceAfter: a.cash, reason });
  }

  // ─── MOUVEMENTS DE TRÉSORERIE INTERNES ─────────────────────────────────────

  /**
   * Dépose du liquide de son portefeuille vers son compte bancaire.
   * @param {string} id 
   * @param {number} amount 
   */
  deposit(id, amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Le montant de dépôt doit être supérieur à zéro.");
    }
    const a = this._account(id);
    if (a.cash < amount) {
      throw new Error("Liquidités insuffisantes pour effectuer ce dépôt.");
    }
    a.cash -= amount;
    a.bank += amount;
    return this._record({ type: "deposit", from: id, amount, balanceAfter: a.bank });
  }

  /**
   * Retire de l'argent de son compte bancaire vers son portefeuille liquide.
   * @param {string} id 
   * @param {number} amount 
   */
  withdraw(id, amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Le montant du retrait doit être supérieur à zéro.");
    }
    const a = this._account(id);
    if (a.bank < amount) {
      throw new Error("Fonds bancaires insuffisants pour effectuer ce retrait.");
    }
    a.bank -= amount;
    a.cash += amount;
    return this._record({ type: "withdraw", to: id, amount, balanceAfter: a.cash });
  }

  // ─── TRANSACTIONS EN CITOYENS (ÉCHANGES & VIREMENTS) ───────────────────────

  /**
   * Transfert physique de liquide (de poche à poche) entre deux joueurs avec taxe.
   * @param {string} from 
   * @param {string} to 
   * @param {number} amount 
   */
  transfer(from, to, amount) {
    if (from === to) throw new Error("Impossible de transférer des fonds à vous-même.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Le montant du virement doit être positif.");

    const src = this._account(from);
    if (src.cash < amount) throw new Error("Vos liquidités de poche sont insuffisantes.");

    const tax = Math.round(amount * this.taxRate);
    const net = amount - tax;
    const dst = this._account(to);

    src.cash -= amount;
    dst.cash += net;

    const outTx = this._record({
      type: "transfer_out",
      from,
      to,
      amount,
      balanceAfter: src.cash,
    });

    if (tax > 0) {
      this._record({ type: "tax", from, amount: tax, balanceAfter: src.cash, reason: "transfer tax" });
    }

    const inTx = this._record({
      type: "transfer_in",
      from,
      to,
      amount: net,
      balanceAfter: dst.cash,
    });

    return { net, tax, outTx, inTx };
  }

  /**
   * Virement bancaire dématérialisé (compte à compte) avec taxe réduite.
   * @param {string} from 
   * @param {string} to 
   * @param {number} amount 
   */
  bankTransfer(from, to, amount) {
    if (from === to) throw new Error("Transaction impossible vers le même compte.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant bancaire invalide.");

    const src = this._account(from);
    if (src.bank < amount) throw new Error("Fonds bancaires de virement insuffisants.");

    const tax = Math.round(amount * this.bankTaxRate);
    const net = amount - tax;
    const dst = this._account(to);

    src.bank -= amount;
    dst.bank += net;

    const outTx = this._record({
      type: "bank_transfer_out",
      from,
      to,
      amount,
      balanceAfter: src.bank,
    });

    if (tax > 0) {
      this._record({ type: "tax", from, amount: tax, balanceAfter: src.bank, reason: "bank transfer tax" });
    }

    const inTx = this._record({
      type: "bank_transfer_in",
      from,
      to,
      amount: net,
      balanceAfter: dst.bank,
    });

    return { net, tax, outTx, inTx };
  }

  /**
   * Distribue les dividendes / intérêts d'épargne sur l'ensemble des comptes créditeurs.
   * @returns {{ totalPaid: number, accounts: number }}
   */
  applyInterest() {
    let totalPaid = 0;
    let count = 0;
    for (const a of this.accounts.values()) {
      if (a.bank <= 0) continue;
      const interest = Math.round(a.bank * this.interestRate);
      if (interest <= 0) continue;
      
      a.bank += interest;
      totalPaid += interest;
      count++;
      
      this._record({ type: "interest", to: a.id, amount: interest, balanceAfter: a.bank });
    }
    return { totalPaid, accounts: count };
  }

  // ─── LEADERBOARD & TRANSACTIONS AUDITS ──────────────────────────────────────

  /**
   * Filtre et retourne les transactions associées à un joueur.
   * @param {string} [id] - Si absent, retourne toutes les transactions de la matrice
   * @param {number} [limit=50] 
   */
  getTransactions(id, limit = 50) {
    const list = id
      ? this.transactions.filter((t) => t.from === id || t.to === id)
      : this.transactions;
    return list.slice(-limit).reverse();
  }

  /**
   * Classement de la fortune totale (Portefeuille + Banque) des citoyens.
   * @param {number} [top=10] 
   */
  leaderboard(top = 10) {
    return Array.from(this.accounts.values())
      .map((a) => ({ id: a.id, total: a.cash + a.bank }))
      .sort((x, y) => y.total - x.total)
      .slice(0, top);
  }

  // ─── PERSISTANCE D'ÉTAT ─────────────────────────────────────────────────────

  toState() {
    return {
      accounts: Array.from(this.accounts.values()).map((a) => ({ ...a })),
      transactions: [...this.transactions],
    };
  }

  loadState(state) {
    this.accounts = new Map((state?.accounts ?? []).map((a) => [a.id, { ...a }]));
    this.transactions = [...(state?.transactions ?? [])];
  }
}

export default EconomySystem;
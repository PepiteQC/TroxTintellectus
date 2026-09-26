/**
 * EtherPrismDB
 * In-memory JSON database avec requêtes avancées, transactions, 
 * relations et persistance localStorage.
 */

export class EtherPrismDB {
  constructor() {
    this.storage = new Map();
    this.listeners = [];
    this.transactionBackup = null;
    this.inTransaction = false;

    this.restoreFromSnapshot();
  }

  getTable(table) {
    if (!this.storage.has(table)) {
      this.storage.set(table, new Map());
    }
    return this.storage.get(table);
  }

  /**
   * S'abonner aux événements de changement de base de données en temps réel
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(table, action, id, data) {
    for (const listener of this.listeners) {
      try {
        listener(table, action, id, data);
      } catch (e) {
        console.error('[EtherPrismDB] Listener error:', e);
      }
    }
  }

  async set(table, id, data) {
    const record = { ...data, id, updatedAt: new Date().toISOString() };
    this.getTable(table).set(id, record);
    this.notify(table, 'SET', id, record);
    
    if (!this.inTransaction) {
      await this.flush();
    }
  }

  async get(table, id) {
    const record = this.getTable(table).get(id);
    return record ? { ...record } : null;
  }

  async del(table, id) {
    this.getTable(table).delete(id);
    this.notify(table, 'DEL', id);
    
    if (!this.inTransaction) {
      await this.flush();
    }
  }

  async list(table) {
    return Array.from(this.getTable(table).values()).map(r => ({ ...r }));
  }

  async query(table, filter = {}, options = {}) {
    let items = await this.list(table);

    // Appliquer les Filtres
    if (Object.keys(filter).length > 0) {
      items = items.filter(item => {
        for (const [key, cond] of Object.entries(filter)) {
          const val = item[key];
          if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
            if ('$gt' in cond && !(Number(val) > Number(cond.$gt))) return false;
            if ('$gte' in cond && !(Number(val) >= Number(cond.$gte))) return false;
            if ('$lt' in cond && !(Number(val) < Number(cond.$lt))) return false;
            if ('$lte' in cond && !(Number(val) <= Number(cond.$lte))) return false;
            if ('$contains' in cond && !String(val ?? '').toLowerCase().includes(String(cond.$contains).toLowerCase())) return false;
            if ('$in' in cond && Array.isArray(cond.$in) && !cond.$in.includes(val)) return false;
            if ('$ne' in cond && val === cond.$ne) return false;
          } else if (val !== cond) {
            return false;
          }
        }
        return true;
      });
    }

    // Appliquer le Tri (Sorting)
    if (options.orderBy) {
      const col = options.orderBy;
      const dir = options.orderDir === 'desc' ? -1 : 1;
      items.sort((a, b) => {
        const av = a[col] ?? '';
        const bv = b[col] ?? '';
        return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
      });
    }

    // Appliquer la Pagination
    if (options.skip) items = items.slice(options.skip);
    if (options.take) items = items.slice(0, options.take);

    return items;
  }

  /**
   * Jointure relationnelle (Foreign key) entre deux tables
   */
  async join(primaryTable, foreignTable, foreignKey, targetKey = 'id') {
    const primaryItems = await this.list(primaryTable);
    const foreignItems = await this.list(foreignTable);
    const foreignMap = new Map(foreignItems.map(f => [String(f[targetKey]), f]));

    return primaryItems.map(p => ({
      ...p,
      [`_${foreignTable}`]: foreignMap.get(String(p[foreignKey])) ?? null
    }));
  }

  /**
   * Grouper les enregistrements par colonne et calculer des agrégations
   */
  async groupBy(table, groupKey, aggregateKey) {
    const items = await this.list(table);
    const groups = new Map();

    for (const item of items) {
      const k = item[groupKey] ?? 'Unspecified';
      const arr = groups.get(k) ?? [];
      arr.push(item);
      groups.set(k, arr);
    }

    return Array.from(groups.entries()).map(([k, arr]) => {
      const res = { key: k, count: arr.length };
      if (aggregateKey) {
        const nums = arr.map(a => Number(a[aggregateKey])).filter(Number.isFinite);
        if (nums.length > 0) {
          const sum = nums.reduce((a, b) => a + b, 0);
          res.sum = sum;
          res.avg = sum / nums.length;
          res.min = Math.min(...nums);
          res.max = Math.max(...nums);
        }
      }
      return res;
    });
  }

  /**
   * Démarrer une transaction atomique
   */
  beginTransaction() {
    if (this.inTransaction) throw new Error('[EtherPrismDB] Transaction is already active');
    
    this.transactionBackup = new Map();
    for (const [table, map] of this.storage.entries()) {
      // Cloner profondément la map courante
      this.transactionBackup.set(table, new Map(Array.from(map.entries()).map(([k, v]) => [k, { ...v }])));
    }
    
    this.inTransaction = true;
  }

  /**
   * Valider (Commit) la transaction atomique
   */
  async commitTransaction() {
    if (!this.inTransaction) throw new Error('[EtherPrismDB] No active transaction to commit');
    
    this.transactionBackup = null;
    this.inTransaction = false;
    await this.flush();
  }

  /**
   * Annuler (Rollback) la transaction atomique
   */
  rollbackTransaction() {
    if (!this.inTransaction || !this.transactionBackup) throw new Error('[EtherPrismDB] No active transaction to rollback');
    
    this.storage = this.transactionBackup;
    this.transactionBackup = null;
    this.inTransaction = false;
    
    this.notify('*', 'FLUSH');
  }

  snapshot() {
    const obj = {};
    for (const [table, map] of this.storage.entries()) {
      obj[table] = Array.from(map.values());
    }
    return JSON.stringify(obj);
  }

  async restoreFromSnapshot(snapshotJson) {
    try {
      const json = snapshotJson || (typeof window !== 'undefined' ? localStorage.getItem('etherprism_db_snapshot') : null);
      if (!json) return false;
      
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || !parsed) return false;

      this.storage.clear();
      for (const [table, rows] of Object.entries(parsed)) {
        if (Array.isArray(rows)) {
          const map = new Map();
          rows.forEach((r) => {
            if (r && r.id !== undefined) map.set(String(r.id), r);
          });
          this.storage.set(table, map);
        }
      }
      
      this.notify('*', 'FLUSH');
      return true;
    } catch (e) {
      console.error('[EtherPrismDB] Failed to restore snapshot:', e);
      return false;
    }
  }

  async flush() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('etherprism_db_snapshot', this.snapshot());
      this.notify('*', 'FLUSH');
    } catch (e) {
      console.error('[EtherPrismDB] Flush error:', e);
    }
  }
}

// Instance globale Singleton
export const globalEtherPrismDB = new EtherPrismDB();
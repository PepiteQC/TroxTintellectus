/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DB/TROXTDATASTORE.JS
 * Store en mémoire Zéro-GC · Audit Log circulaire · API Drizzle-like
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server/src/db/TroxtDataStore.js
 */

import crypto from 'node:crypto';

const SIG = 'TROXT⬡';

// ─── RING BUFFER ZÉRO-GC ────────────────────────────────────────────
class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.index = 0;
    this.isFull = false;
  }

  push(item) {
    this.buffer[this.index] = item;
    this.index++;
    if (this.index >= this.capacity) {
      this.index = 0;
      this.isFull = true;
    }
  }

  toArray() {
    if (!this.isFull) return this.buffer.slice(0, this.index);
    return [...this.buffer.slice(this.index), ...this.buffer.slice(0, this.index)];
  }

  clear() {
    this.index = 0;
    this.isFull = false;
  }
}

// ─── STORE EN MÉMOIRE ───────────────────────────────────────────────
const inMemoryStore = {
  user:         new Map([['u1', { id: 'u1', name: 'TroxTCristal', email: 'cristal@troxt.qc.ca', createdAt: new Date() }]]),
  session:      new Map([['s1', { id: 's1', userId: 'u1', expiresAt: new Date(Date.now() + 86400000) }]]),
  account:      new Map(),
  verification: new Map(),
  project:      new Map([['p1', { id: 'p1', name: 'Domaine Portneuf Villa Céleste', description: 'Architecture 3D TroxT', userId: 'u1' }]]),
  generation:   new Map([['g1', { id: 'g1', projectId: 'p1', prompt: 'Villa Luxe Portneuf 3D', status: 'completed', style: 'modern', source: 'TroxtAI', polyCount: 15400, rating: 5, createdAt: new Date() }]]),
  model3D:      new Map([['m1', { id: 'm1', generationId: 'g1', name: 'Supercar Quebec Red', format: 'glb', polyCount: 22000 }]]),
  asset:        new Map(),
  preference:   new Map([['pref1', { id: 'pref1', key: 'theme', value: 'cyber-portneuf' }]]),
};

// ─── AUDIT LOG ──────────────────────────────────────────────────────
const auditLog = new RingBuffer(10000);

function pushAudit(entry) {
  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    ...entry,
  };
  auditLog.push(record);
  return record;
}

export function getAuditLog(options = {}) {
  let entries = auditLog.toArray();
  if (options.model)  entries = entries.filter((e) => e.model === options.model);
  if (options.action) entries = entries.filter((e) => e.action === options.action);
  if (options.userId) entries = entries.filter((e) => e.userId === options.userId);
  if (options.from)   entries = entries.filter((e) => e.timestamp >= options.from);
  if (options.to)     entries = entries.filter((e) => e.timestamp <= options.to);
  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return options.limit ? entries.slice(0, options.limit) : entries;
}

export function clearAuditLog() {
  auditLog.clear();
}

// ─── MODEL DELEGATE ─────────────────────────────────────────────────
class ModelDelegate {
  constructor(model) {
    this.model = model;
  }

  _getMap() {
    if (!inMemoryStore[this.model]) inMemoryStore[this.model] = new Map();
    return inMemoryStore[this.model];
  }

  _evaluateCondition(rec, cond) {
    if (cond.AND && Array.isArray(cond.AND)) {
      return cond.AND.every((sub) => this._evaluateCondition(rec, sub));
    }
    if (cond.OR && Array.isArray(cond.OR)) {
      return cond.OR.some((sub) => this._evaluateCondition(rec, sub));
    }

    return Object.entries(cond).every(([field, subCond]) => {
      const val = rec[field];
      if (typeof subCond === 'object' && subCond !== null) {
        if ('equals' in subCond)     return val === subCond.equals;
        if ('contains' in subCond)   return typeof val === 'string' && val.toLowerCase().includes(String(subCond.contains).toLowerCase());
        if ('startsWith' in subCond) return typeof val === 'string' && val.toLowerCase().startsWith(String(subCond.startsWith).toLowerCase());
        if ('endsWith' in subCond)   return typeof val === 'string' && val.toLowerCase().endsWith(String(subCond.endsWith).toLowerCase());
        if ('not' in subCond)        return val !== subCond.not;
        if ('gt' in subCond)         return Number(val) > Number(subCond.gt);
        if ('lt' in subCond)         return Number(val) < Number(subCond.lt);
        if ('gte' in subCond)        return Number(val) >= Number(subCond.gte);
        if ('lte' in subCond)        return Number(val) <= Number(subCond.lte);
      }
      return val === subCond;
    });
  }

  async findMany(options = {}) {
    let records = Array.from(this._getMap().values());

    if (options.where && Object.keys(options.where).length > 0) {
      records = records.filter((rec) => this._evaluateCondition(rec, options.where));
    }

    if (options.orderBy) {
      const [sortField, sortOrder] = Object.entries(options.orderBy)[0];
      const dir = sortOrder === 'asc' ? 1 : -1;
      records.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1 * dir;
        if (a[sortField] > b[sortField]) return 1 * dir;
        return 0;
      });
    }

    if (options.skip) records = records.slice(options.skip);
    if (options.take) records = records.slice(0, options.take);

    return records;
  }

  async findUnique(options) {
    return this._getMap().get(options.where.id) || null;
  }

  async create(options) {
    const id = options.data.id || `rec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const record = {
      ...options.data,
      id,
      createdAt: options.data.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this._getMap().set(id, record);
    pushAudit({ action: 'CREATE', model: this.model, recordId: id });
    return record;
  }

  async update(options) {
    const map = this._getMap();
    const existing = map.get(options.where.id);
    if (!existing) throw new Error(`[${SIG}] Introuvable : ${this.model}#${options.where.id}`);

    for (const key in options.data) {
      existing[key] = options.data[key];
    }
    existing.updatedAt = new Date();

    pushAudit({ action: 'UPDATE', model: this.model, recordId: existing.id });
    return existing;
  }

  async delete(options) {
    const map = this._getMap();
    const existing = map.get(options.where.id);
    if (!existing) throw new Error(`[${SIG}] Introuvable : ${this.model}#${options.where.id}`);
    map.delete(options.where.id);
    pushAudit({ action: 'DELETE', model: this.model, recordId: existing.id });
    return existing;
  }

  async deleteMany(options = {}) {
    const map = this._getMap();
    if (!options.where || Object.keys(options.where).length === 0) {
      const count = map.size;
      map.clear();
      return { count };
    }
    const toDelete = await this.findMany({ where: options.where });
    toDelete.forEach((rec) => map.delete(rec.id));
    return { count: toDelete.length };
  }

  async count(options = {}) {
    if (!options.where || Object.keys(options.where).length === 0) return this._getMap().size;
    const records = await this.findMany(options);
    return records.length;
  }
}

// ─── EXPORTS ────────────────────────────────────────────────────────
export function getDelegate(model) {
  return new ModelDelegate(model);
}

export const db = {
  user:         new ModelDelegate('user'),
  session:      new ModelDelegate('session'),
  account:      new ModelDelegate('account'),
  verification: new ModelDelegate('verification'),
  project:      new ModelDelegate('project'),
  generation:   new ModelDelegate('generation'),
  model3D:      new ModelDelegate('model3D'),
  asset:        new ModelDelegate('asset'),
  preference:   new ModelDelegate('preference'),
};

export const troxtDbClient = {
  create:   async (model, data) => getDelegate(model).create({ data }),
  findMany: async (model, options) => {
    const list = await getDelegate(model).findMany(options || {});
    return { data: list, total: list.length, page: 1, pageSize: list.length || 20, pageCount: 1, hasPrev: false, hasNext: false };
  },
  search:   async (model, query, fields) => {
    const list = await getDelegate(model).findMany({});
    const q = query.toLowerCase();
    return list.filter((item) => fields.some((f) => item[f] && String(item[f]).toLowerCase().includes(q)));
  },
  delete:   async (model, id) => getDelegate(model).delete({ where: { id } }),
};
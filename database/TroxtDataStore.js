// ============================================================================
// TroxtDataStore v2.0 — In-Memory Cache & Mock Database (JavaScript)
// Zéro-GC Audit Log · O(1) Lookups · Prisma/Drizzle-like API
// ============================================================================

import crypto from "node:crypto";

const SIG = "TROXT⬡·DataStore";

// ─── RingBuffer Zéro-GC ─────────────────────────────────────────────────────
class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.index = 0;
    this._size = 0;
    this._isFull = false;
  }
  push(item) {
    this.buffer[this.index] = item;
    this.index++;
    this._size = Math.min(this._size + 1, this.capacity);
    if (this.index >= this.capacity) { this.index = 0; this._isFull = true; }
  }
  get size() { return this._size; }
  toArray() {
    if (!this._isFull) return this.buffer.slice(0, this.index);
    return [
      ...this.buffer.slice(this.index),
      ...this.buffer.slice(0, this.index),
    ];
  }
  clear() {
    for (let i = 0; i < this.buffer.length; i++) this.buffer[i] = undefined;
    this.index = 0;
    this._isFull = false;
    this._size = 0;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function deepClone(v) {
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Date) return new Date(v.getTime());
  if (Array.isArray(v)) return v.map(deepClone);
  const out = {};
  for (const k in v) out[k] = deepClone(v[k]);
  return out;
}

function cmpValues(a, b) {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const ta = a instanceof Date ? "date" : typeof a;
  const tb = b instanceof Date ? "date" : typeof b;
  if (ta !== tb) {
    if (ta === "number" && tb === "number") return a - b;
    return String(a).localeCompare(String(b));
  }
  if (ta === "date")   return a.getTime() - b.getTime();
  if (ta === "number") return a - b;
  if (ta === "string") return a.localeCompare(b);
  return 0;
}

function applySelect(rec, select) {
  if (!select) return rec;
  const out = {};
  for (const k in select) if (select[k] && k in rec) out[k] = rec[k];
  if (!("id" in out) && !("id" in select)) out.id = rec.id;
  return out;
}

// ─── Seed ───────────────────────────────────────────────────────────────────
function seedStore() {
  const now = Date.now();
  return {
    user: new Map([
      ["u1", { id: "u1", name: "TroxTCristal", email: "cristal@troxt.qc.ca", createdAt: new Date(now) }],
    ]),
    session: new Map([
      ["s1", { id: "s1", userId: "u1", expiresAt: new Date(now + 86_400_000) }],
    ]),
    account: new Map(),
    verification: new Map(),
    project: new Map([
      ["p1", { id: "p1", name: "Domaine Portneuf Villa Céleste", description: "Architecture 3D TroxT", userId: "u1" }],
    ]),
    generation: new Map([
      ["g1", { id: "g1", projectId: "p1", prompt: "Villa Luxe Portneuf 3D", status: "completed", style: "modern", source: "TroxtAI", polyCount: 15400, rating: 5, createdAt: new Date(now) }],
    ]),
    model3D: new Map([
      ["m1", { id: "m1", generationId: "g1", name: "Supercar Quebec Red", format: "glb", polyCount: 22000 }],
    ]),
    asset: new Map(),
    preference: new Map([
      ["pref1", { id: "pref1", key: "theme", value: "cyber-portneuf" }],
    ]),
  };
}

let inMemoryStore = seedStore();

// ─── Audit Log ──────────────────────────────────────────────────────────────
const AUDIT_CAPACITY = 10_000;
const auditLog = new RingBuffer(AUDIT_CAPACITY);
let auditEnabled = true;

function pushAudit(entry) {
  if (!auditEnabled) return null;
  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    ...entry,
  };
  auditLog.push(record);
  return record;
}

export function setAuditEnabled(on) { auditEnabled = !!on; }
export function isAuditEnabled()     { return auditEnabled; }

export function getAuditLog(options) {
  let entries = auditLog.toArray();
  if (options?.model)  entries = entries.filter(e => e.model === options.model);
  if (options?.action) entries = entries.filter(e => e.action === options.action);
  if (options?.userId) entries = entries.filter(e => e.userId === options.userId);
  if (options?.from)   entries = entries.filter(e => e.timestamp >= options.from);
  if (options?.to)     entries = entries.filter(e => e.timestamp <= options.to);
  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return options?.limit ? entries.slice(0, options.limit) : entries;
}

export function clearAuditLog()    { auditLog.clear(); }
export function getAuditSize()     { return auditLog.size; }
export function getAuditCapacity() { return AUDIT_CAPACITY; }

// ─── Model Delegate ─────────────────────────────────────────────────────────
export class ModelDelegate {
  constructor(model) { this.model = model; }

  _getMap() {
    if (!inMemoryStore[this.model]) inMemoryStore[this.model] = new Map();
    return inMemoryStore[this.model];
  }

  _evaluateCondition(rec, cond) {
    if (cond == null || typeof cond !== "object") return false;
    const c = cond;

    if (Array.isArray(c.AND)) return c.AND.every(s => this._evaluateCondition(rec, s));
    if (Array.isArray(c.OR))  return c.OR.some(s => this._evaluateCondition(rec, s));
    if (c.NOT)                return !this._evaluateCondition(rec, c.NOT);

    return Object.entries(c).every(([field, subCond]) => {
      if (field === "AND" || field === "OR" || field === "NOT") return true;
      const val = rec[field];

      if (subCond !== null && typeof subCond === "object" && !Array.isArray(subCond)) {
        const sc = subCond;
        const insensitive = sc.mode === "insensitive";

        if ("equals" in sc)      return val === sc.equals;
        if ("not" in sc)         return val !== sc.not;
        if ("in" in sc && Array.isArray(sc.in))       return sc.in.includes(val);
        if ("notIn" in sc && Array.isArray(sc.notIn)) return !sc.notIn.includes(val);

        if ("contains" in sc && typeof val === "string") {
          const a = insensitive ? val.toLowerCase() : val;
          const b = insensitive ? String(sc.contains).toLowerCase() : String(sc.contains);
          return a.includes(b);
        }
        if ("startsWith" in sc && typeof val === "string") {
          const a = insensitive ? val.toLowerCase() : val;
          const b = insensitive ? String(sc.startsWith).toLowerCase() : String(sc.startsWith);
          return a.startsWith(b);
        }
        if ("endsWith" in sc && typeof val === "string") {
          const a = insensitive ? val.toLowerCase() : val;
          const b = insensitive ? String(sc.endsWith).toLowerCase() : String(sc.endsWith);
          return a.endsWith(b);
        }

        if ("gt"  in sc) return Number(val) >  Number(sc.gt);
        if ("gte" in sc) return Number(val) >= Number(sc.gte);
        if ("lt"  in sc) return Number(val) <  Number(sc.lt);
        if ("lte" in sc) return Number(val) <= Number(sc.lte);

        return false;
      }

      return val === subCond;
    });
  }

  _sortRecords(records, orderBy) {
    if (!orderBy) return;
    const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
    records.sort((a, b) => {
      for (const spec of specs) {
        const [field, order] = Object.entries(spec)[0];
        const c = cmpValues(a[field], b[field]);
        if (c !== 0) return order === "asc" ? c : -c;
      }
      return 0;
    });
  }

  _applyDistinct(records, distinct) {
    if (!distinct) return records;
    const keys = Array.isArray(distinct) ? distinct : [distinct];
    const seen = new Set();
    const out = [];
    for (const r of records) {
      const sig = keys.map(k => String(r[k])).join("|");
      if (!seen.has(sig)) { seen.add(sig); out.push(r); }
    }
    return out;
  }

  // ─── READ ───────────────────────────────────────────────────────────────
  async findMany(options = {}) {
    let records = Array.from(this._getMap().values());

    if (options.where && Object.keys(options.where).length > 0) {
      records = records.filter(rec => this._evaluateCondition(rec, options.where));
    }

    this._sortRecords(records, options.orderBy);
    records = this._applyDistinct(records, options.distinct);

    if (typeof options.skip === "number" && options.skip > 0) records = records.slice(options.skip);
    if (typeof options.take === "number" && options.take >= 0) records = records.slice(0, options.take);

    const cloned = records.map(r => deepClone(r));
    return options.select ? cloned.map(r => applySelect(r, options.select)) : cloned;
  }

  async findFirst(options = {}) {
    const list = await this.findMany({ ...options, take: 1 });
    return list[0] ?? null;
  }

  async findUnique(options) {
    if (!options?.where?.id) return null;
    const rec = this._getMap().get(options.where.id);
    if (!rec) return null;
    const clone = deepClone(rec);
    return options.select ? applySelect(clone, options.select) : clone;
  }

  async exists(where) {
    return !!where?.id && this._getMap().has(where.id);
  }

  // ─── WRITE ──────────────────────────────────────────────────────────────
  async create(options) {
    const map = this._getMap();
    const id = options.data.id || `rec_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    if (map.has(id)) throw new Error(`[${SIG}] Conflit : ${this.model}#${id} existe déjà`);

    const record = {
      ...options.data,
      id,
      createdAt: options.data.createdAt || new Date(),
      updatedAt: new Date(),
    };
    map.set(id, record);

    pushAudit({
      action: "CREATE", model: this.model, recordId: id,
      userId: options.userId, after: deepClone(record),
    });

    return deepClone(record);
  }

  async upsert(options) {
    const existing = this._getMap().get(options.where.id);
    if (existing) {
      return this.update({
        where: options.where,
        data: options.update,
        userId: options.userId,
      });
    }
    return this.create({
      data: { id: options.where.id, ...options.create },
      userId: options.userId,
    });
  }

  async update(options) {
    const map = this._getMap();
    const existing = map.get(options.where.id);
    if (!existing) throw new Error(`[Manager] Introuvable : ${this.model}#${options.where.id}`);

    const before = deepClone(existing);

    for (const key in options.data) {
      if (key === "id") continue;
      existing[key] = options.data[key];
    }
    existing.updatedAt = new Date();

    pushAudit({
      action: "UPDATE", model: this.model, recordId: options.where.id,
      userId: options.userId, before, after: deepClone(existing),
    });

    return deepClone(existing);
  }

  async updateMany(options) {
    const map = this._getMap();
    const all = Array.from(map.values());
    const matches = options.where
      ? all.filter(r => this._evaluateCondition(r, options.where))
      : all;

    for (const rec of matches) {
      const before = deepClone(rec);
      for (const key in options.data) {
        if (key === "id") continue;
        rec[key] = options.data[key];
      }
      rec.updatedAt = new Date();
      pushAudit({
        action: "UPDATE", model: this.model, recordId: rec.id,
        userId: options.userId, before, after: deepClone(rec),
      });
    }

    return { count: matches.length };
  }

  async delete(options) {
    const map = this._getMap();
    const existing = map.get(options.where.id);
    if (!existing) throw new Error(`[Manager] Introuvable : ${this.model}#${options.where.id}`);

    const snapshot = deepClone(existing);
    map.delete(options.where.id);

    pushAudit({
      action: "DELETE", model: this.model, recordId: options.where.id,
      userId: options.userId, before: snapshot,
    });

    return snapshot;
  }

  async deleteMany(options = {}) {
    const map = this._getMap();

    if (!options.where || Object.keys(options.where).length === 0) {
      const count = map.size;
      for (const [id, rec] of map) {
        pushAudit({
          action: "DELETE", model: this.model, recordId: id,
          userId: options.userId, before: deepClone(rec), meta: { bulk: true },
        });
      }
      map.clear();
      return { count };
    }

    let count = 0;
    for (const [id, rec] of [...map]) {
      if (this._evaluateCondition(rec, options.where)) {
        pushAudit({
          action: "DELETE", model: this.model, recordId: id,
          userId: options.userId, before: deepClone(rec), meta: { bulk: true },
        });
        map.delete(id);
        count++;
      }
    }
    return { count };
  }

  // ─── AGGREGATE ──────────────────────────────────────────────────────────
  async count(options = {}) {
    if (!options.where || Object.keys(options.where).length === 0) return this._getMap().size;
    let n = 0;
    for (const r of this._getMap().values()) if (this._evaluateCondition(r, options.where)) n++;
    return n;
  }

  async aggregate(options) {
    const records = options.where
      ? Array.from(this._getMap().values()).filter(r => this._evaluateCondition(r, options.where))
      : Array.from(this._getMap().values());

    const out = {};
    const doField = (group, fn, name) => {
      if (!group) return;
      for (const f in group) {
        if (!group[f]) continue;
        const vals = records.map(r => Number(r[f])).filter(v => Number.isFinite(v));
        out[name] = out[name] || {};
        out[name][f] = vals.length === 0 ? null : fn(vals);
      }
    };

    doField(options._sum, v => v.reduce((a, b) => a + b, 0), "_sum");
    doField(options._avg, v => v.reduce((a, b) => a + b, 0) / v.length, "_avg");
    doField(options._min, v => Math.min(...v), "_min");
    doField(options._max, v => Math.max(...v), "_max");

    return out;
  }

  async groupBy(options) {
    const records = options.where
      ? Array.from(this._getMap().values()).filter(r => this._evaluateCondition(r, options.where))
      : Array.from(this._getMap().values());

    const groups = new Map();
    for (const r of records) {
      const key = {};
      for (const f of options.by) key[f] = r[f];
      const sig = options.by.map(f => String(r[f])).join("|");
      let g = groups.get(sig);
      if (!g) { g = { key, items: [] }; groups.set(sig, g); }
      g.items.push(r);
    }

    const out = [];
    for (const { key, items } of groups.values()) {
      const row = { ...key };
      if (options._count) {
        if (options._count === true) row._count = items.length;
        else {
          row._count = {};
          for (const f in options._count) if (options._count[f]) row._count[f] = items.length;
        }
      }
      out.push(row);
    }
    return out;
  }

  // ─── UTILS ──────────────────────────────────────────────────────────────
  async distinct(field) {
    const s = new Set();
    for (const r of this._getMap().values()) if (field in r) s.add(r[field]);
    return Array.from(s);
  }

  snapshot() {
    return Array.from(this._getMap().values()).map(r => deepClone(r));
  }

  restore(rows) {
    const map = this._getMap();
    map.clear();
    let n = 0;
    for (const r of rows) {
      if (!r?.id) continue;
      map.set(r.id, deepClone(r));
      n++;
    }
    return n;
  }
}

// ─── Cache des delegates ────────────────────────────────────────────────────
const _delegateCache = new Map();

export function getDelegate(model) {
  let d = _delegateCache.get(model);
  if (!d) { d = new ModelDelegate(model); _delegateCache.set(model, d); }
  return d;
}

export const db = {
  user:         getDelegate("user"),
  session:      getDelegate("session"),
  account:      getDelegate("account"),
  verification: getDelegate("verification"),
  project:      getDelegate("project"),
  generation:   getDelegate("generation"),
  model3D:      getDelegate("model3D"),
  asset:        getDelegate("asset"),
  preference:   getDelegate("preference"),
};

// ─── Transactions ───────────────────────────────────────────────────────────
let _txDepth = 0;
let _txSnapshot = null;

export function beginTransaction() {
  if (_txDepth === 0) {
    _txSnapshot = {};
    for (const m of Object.keys(inMemoryStore)) {
      _txSnapshot[m] = new Map(
        Array.from(inMemoryStore[m].entries()).map(([k, v]) => [k, deepClone(v)]),
      );
    }
  }
  _txDepth++;
}

export function commitTransaction() {
  if (_txDepth === 0) throw new Error(`[${SIG}] commit sans beginTransaction`);
  _txDepth--;
  if (_txDepth === 0) _txSnapshot = null;
}

export function rollbackTransaction() {
  if (_txDepth === 0) throw new Error(`[${SIG}] rollback sans beginTransaction`);
  if (_txSnapshot) inMemoryStore = _txSnapshot;
  _txDepth = 0;
  _txSnapshot = null;
}

export async function transaction(fn) {
  beginTransaction();
  try {
    const result = await fn();
    commitTransaction();
    return result;
  } catch (e) {
    rollbackTransaction();
    throw e;
  }
}

export function inTransaction() { return _txDepth > 0; }

// ─── Health / Snapshot / Reset ──────────────────────────────────────────────
export async function health() {
  const checks = [];
  const t0 = performance.now();

  for (const m of Object.keys(inMemoryStore)) {
    const t = performance.now();
    try {
      const size = inMemoryStore[m].size;
      checks.push({
        name: m, passed: true, detail: `${size} records`,
        durationMs: +(performance.now() - t).toFixed(3),
      });
    } catch (e) {
      checks.push({
        name: m, passed: false, detail: e?.message || String(e),
        durationMs: +(performance.now() - t).toFixed(3),
      });
    }
  }

  const failed = checks.filter(c => !c.passed).length;
  const status = failed === 0 ? "healthy" : failed < checks.length / 2 ? "degraded" : "critical";

  return {
    status,
    timestamp: new Date(),
    checks,
    summary: `${checks.length - failed}/${checks.length} modèles OK en ${(performance.now() - t0).toFixed(2)}ms`,
  };
}

export function snapshotAll() {
  const out = {};
  for (const m of Object.keys(inMemoryStore)) {
    out[m] = Array.from(inMemoryStore[m].values()).map(r => deepClone(r));
  }
  return out;
}

export function restoreAll(data) {
  let total = 0;
  for (const m of Object.keys(inMemoryStore)) {
    if (Array.isArray(data[m])) {
      inMemoryStore[m].clear();
      for (const r of data[m]) {
        if (!r?.id) continue;
        inMemoryStore[m].set(r.id, deepClone(r));
        total++;
      }
    }
  }
  return total;
}

export function resetStore(reseed = true) {
  if (reseed) {
    inMemoryStore = seedStore();
  } else {
    const next = {};
    for (const m of Object.keys(inMemoryStore)) next[m] = new Map();
    inMemoryStore = next;
  }
}

// ─── Export ─────────────────────────────────────────────────────────────────
export function exportData(opts = { format: "json" }) {
  const models = opts.models ?? Object.keys(inMemoryStore);
  const payload = {};
  for (const m of models) {
    payload[m] = Array.from(inMemoryStore[m].values()).map(r => deepClone(r));
  }

  if (opts.format === "json") {
    return opts.pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  }

  const sep = opts.format === "csv" ? "," : "\t";
  const lines = [];
  for (const m of models) {
    const rows = payload[m];
    if (!rows.length) continue;
    const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    lines.push(`# model:${m}`);
    lines.push(keys.join(sep));
    for (const r of rows) {
      lines.push(keys.map(k => {
        const v = r[k];
        if (v == null) return "";
        if (typeof v === "string" && (v.includes(sep) || v.includes('"'))) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return String(v);
      }).join(sep));
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ─── Client helper ──────────────────────────────────────────────────────────
export const troxtDbClient = {
  create: async (model, data) => {
    const delegate = getDelegate(model);
    return delegate.create({ data });
  },
  findMany: async (model, options) => {
    const delegate = getDelegate(model);
    const list = await delegate.findMany(options || {});
    return {
      data: list,
      total: list.length,
      page: 1,
      pageSize: list.length > 0 ? list.length : 20,
      pageCount: 1,
      hasPrev: false,
      hasNext: false,
    };
  },
  search: async (model, query, fields) => {
    const delegate = getDelegate(model);
    const list = await delegate.findMany({});
    const q = query.toLowerCase();
    return list.filter(item =>
      fields.some(f => item[f] && String(item[f]).toLowerCase().includes(q)),
    );
  },
  delete: async (model, id) => {
    const delegate = getDelegate(model);
    return delegate.delete({ where: { id } });
  },
};

export { SIG };
export default db;
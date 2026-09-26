/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DB/TROXTPARAMETER.JS
 * Paramètres SQL sécurisés · Inférence de type · Collection thread-safe
 * Converti depuis C# ADO.NET TroxTParameter v7.1
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server/src/db/TroxTParameter.js
 */

const SIG = 'TROXT⬡';

const PREFIX_CHARS = new Set(['@', ':', '?', '$']);

const DB_TYPE_MAP = Object.freeze({
  string:   'String',
  number:   'Double',
  boolean:  'Boolean',
  bigint:   'Int64',
  object:   'Object',
});

/**
 * Nettoie les préfixes de paramètres SQL (@, @@, :, ?, $).
 * @param {string} name
 * @returns {string}
 */
function cleanParameterName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) return '';
  let s = name.trim();
  let start = 0;
  while (start < s.length && PREFIX_CHARS.has(s[start])) {
    start++;
  }
  return start >= s.length ? '' : s.substring(start);
}

/**
 * Déduit le type SQL à partir de la valeur JavaScript.
 * @param {any} value
 * @returns {string}
 */
function inferDbType(value) {
  if (value === null || value === undefined) return 'Object';
  if (value instanceof Date) return 'DateTime';
  if (value instanceof Buffer || value instanceof Uint8Array) return 'Binary';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'number') return Number.isInteger(value) ? 'Int32' : 'Double';
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'bigint') return 'Int64';
  return 'Object';
}

// ─── TROXT PARAMETER ────────────────────────────────────────────────
export class TroxTParameter {
  /**
   * @param {string} [name='']
   * @param {any} [value=null]
   */
  constructor(name = '', value = null) {
    this._dbType = 'Object';
    this._dbTypeSet = false;
    this._value = null;
    this._parameterName = '';
    this._sourceColumn = '';
    this.direction = 'Input';
    this.isNullable = false;
    this.size = 0;
    this.sourceColumnNullMapping = false;
    this.sourceVersion = 'Current';

    this.parameterName = name;
    this.value = value;
  }

  get dbType() { return this._dbType; }
  set dbType(val) {
    this._dbType = val;
    this._dbTypeSet = true;
  }

  get parameterName() { return this._parameterName; }
  set parameterName(val) { this._parameterName = cleanParameterName(val); }

  get sourceColumn() { return this._sourceColumn; }
  set sourceColumn(val) { this._sourceColumn = val ?? ''; }

  get value() { return this._value; }
  set value(val) {
    this._value = val;
    if (!this._dbTypeSet && val !== null && val !== undefined) {
      this._dbType = inferDbType(val);
    }
  }

  resetDbType() {
    this._dbType = 'Object';
    this._dbTypeSet = false;
  }

  resetValue() {
    this._value = null;
    this._dbType = 'Object';
    this._dbTypeSet = false;
  }

  clone() {
    const p = new TroxTParameter();
    p._dbType = this._dbType;
    p._dbTypeSet = this._dbTypeSet;
    p._value = this._value;
    p._parameterName = this._parameterName;
    p._sourceColumn = this._sourceColumn;
    p.direction = this.direction;
    p.isNullable = this.isNullable;
    p.size = this.size;
    p.sourceColumnNullMapping = this.sourceColumnNullMapping;
    p.sourceVersion = this.sourceVersion;
    return p;
  }

  toString() {
    return `TroxTParameter { Name=${this._parameterName}, DbType=${this._dbType}, Value=${this._value ?? 'null'}, Direction=${this.direction} }`;
  }

  equals(other) {
    return other instanceof TroxTParameter &&
      this._parameterName.toLowerCase() === other._parameterName.toLowerCase();
  }
}

// ─── TROXT PARAMETER COLLECTION ─────────────────────────────────────
export class TroxTParameterCollection {
  constructor() {
    this._parameters = [];
    this._readOnly = false;
  }

  get count() { return this._parameters.length; }
  get isReadOnly() { return this._readOnly; }

  freeze() { this._readOnly = true; }
  unfreeze() { this._readOnly = false; }

  _ensureWritable() {
    if (this._readOnly) throw new Error(`[${SIG}] Collection en lecture seule (freeze).`);
  }

  _castOrThrow(value, caller) {
    if (!(value instanceof TroxTParameter)) {
      throw new TypeError(`[${SIG}.${caller}] Type attendu : TroxTParameter, reçu : ${typeof value}`);
    }
    return value;
  }

  add(parameter) {
    this._ensureWritable();
    this._parameters.push(this._castOrThrow(parameter, 'add'));
    return this;
  }

  addWithValue(name, value) {
    this._ensureWritable();
    const p = new TroxTParameter(name, value);
    this._parameters.push(p);
    return p;
  }

  addRange(...parameters) {
    this._ensureWritable();
    for (const p of parameters) {
      this._parameters.push(this._castOrThrow(p, 'addRange'));
    }
    return this;
  }

  clear() {
    this._ensureWritable();
    this._parameters.length = 0;
  }

  contains(nameOrParam) {
    return this.indexOf(nameOrParam) >= 0;
  }

  indexOf(nameOrParam) {
    if (nameOrParam instanceof TroxTParameter) {
      return this._parameters.indexOf(nameOrParam);
    }
    if (typeof nameOrParam !== 'string' || nameOrParam.trim().length === 0) return -1;
    const target = cleanParameterName(nameOrParam);
    if (target.length === 0) return -1;
    const lower = target.toLowerCase();
    for (let i = 0; i < this._parameters.length; i++) {
      if (this._parameters[i].parameterName.toLowerCase() === lower) return i;
    }
    return -1;
  }

  get(indexOrName) {
    if (typeof indexOrName === 'number') {
      if (indexOrName < 0 || indexOrName >= this._parameters.length) {
        throw new RangeError(`[${SIG}] Index ${indexOrName} hors bornes (Count=${this._parameters.length}).`);
      }
      return this._parameters[indexOrName];
    }
    const idx = this.indexOf(indexOrName);
    if (idx < 0) throw new Error(`[${SIG}] Paramètre '${indexOrName}' introuvable.`);
    return this._parameters[idx];
  }

  tryGet(name) {
    const idx = this.indexOf(name);
    return idx >= 0 ? this._parameters[idx] : null;
  }

  remove(nameOrParam) {
    this._ensureWritable();
    const idx = this.indexOf(nameOrParam);
    if (idx >= 0) this._parameters.splice(idx, 1);
    return idx >= 0;
  }

  removeAt(index) {
    this._ensureWritable();
    if (index < 0 || index >= this._parameters.length) {
      throw new RangeError(`[${SIG}] Index ${index} hors bornes.`);
    }
    this._parameters.splice(index, 1);
  }

  snapshot() {
    return this._parameters.map((p) => p.clone());
  }

  toString() {
    if (this._parameters.length === 0) return 'TroxTParameterCollection { (vide) }';
    return `TroxTParameterCollection [${this._parameters.map((p) => p.parameterName).join(', ')}]`;
  }
}
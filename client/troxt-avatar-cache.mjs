/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CLIENT/TROXT-AVATAR-CACHE.MJS
 * Cache IndexedDB pour modèles 3D (GLB/FBX) — évite les re-téléchargements
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/troxt-avatar-cache.mjs
 *
 * Le AvatarLoader appelle cache.get(url) avant de fetch.
 * Si hit → utilise loader.parse(buffer) au lieu de loader.load(url).
 */

const SIG = 'TROXT⬡';
const DB_NAME = 'troxt_avatar_cache';
const DB_VERSION = 1;
const STORE = 'models';

export class AvatarCache {
  constructor({ dbName = DB_NAME, maxAgeMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
    this.sig = SIG;
    this.dbName = dbName;
    this.maxAgeMs = maxAgeMs;
    this._db = null;
    this.enabled = typeof indexedDB !== 'undefined';
  }

  async _open() {
    if (!this.enabled) return null;
    if (this._db) return this._db;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  }

  /** Récupère un buffer en cache. Retourne null si miss ou expiré. */
  async get(url) {
    if (!this.enabled) return null;
    try {
      const db = await this._open();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(url);
        req.onsuccess = () => {
          const entry = req.result;
          if (!entry) return resolve(null);
          if (Date.now() - entry.timestamp > this.maxAgeMs) {
            // expiré → supprime en arrière-plan
            this.delete(url).catch(() => {});
            return resolve(null);
          }
          resolve(entry.buffer);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /** Stocke un ArrayBuffer en cache. */
  async set(url, buffer) {
    if (!this.enabled || !buffer) return false;
    try {
      const db = await this._open();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({
          url,
          buffer,
          timestamp: Date.now(),
          size: buffer.byteLength,
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  async has(url) {
    const buf = await this.get(url);
    return buf !== null;
  }

  async delete(url) {
    if (!this.enabled) return false;
    const db = await this._open();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(url);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async clear() {
    if (!this.enabled) return false;
    const db = await this._open();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  /** Stats : nombre d'entrées, taille totale. */
  async stats() {
    if (!this.enabled) return { enabled: false };
    const db = await this._open();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const entries = req.result || [];
        const totalSize = entries.reduce((s, e) => s + (e.size || 0), 0);
        resolve({
          enabled: true,
          entries: entries.length,
          sizeBytes: totalSize,
          sizeMB: +(totalSize / 1048576).toFixed(2),
          urls: entries.map((e) => ({ url: e.url, size: e.size, age: Date.now() - e.timestamp })),
        });
      };
      req.onerror = () => resolve({ enabled: true, entries: 0, sizeBytes: 0 });
    });
  }

  /** Supprime les entrées expirées. */
  async prune() {
    if (!this.enabled) return 0;
    const db = await this._open();
    const cutoff = Date.now() - this.maxAgeMs;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const idx = store.index('timestamp');
      const req = idx.openCursor(IDBKeyRange.upperBound(cutoff));
      let removed = 0;
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          removed++;
          cursor.continue();
        } else {
          resolve(removed);
        }
      };
      req.onerror = () => resolve(removed);
    });
  }
}

export { SIG };
export default AvatarCache;
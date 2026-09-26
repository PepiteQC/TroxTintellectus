/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — ADMIN/ADMINLOGGER.JS
 * Service d'audit de sécurité et historique de modération (Staff)
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/src/admin/AdminLogger.js
 */

const SIG = 'TROXT⬡';

/**
 * @typedef {'info' | 'warning' | 'danger' | 'critical'} LogSeverity
 *
 * @typedef {object} AdminLogEntry
 * @property {string} id
 * @property {number} timestamp
 * @property {string} adminId
 * @property {string} adminName
 * @property {string} action
 * @property {LogSeverity} [severity]
 * @property {string} [targetId]
 * @property {string} [targetName]
 * @property {string} [details]
 * @property {Record<string, any>} [metadata]
 */

class AdminLogService {
  constructor() {
    /** @type {AdminLogEntry[]} */
    this.logs = [];
    this.maxLogs = 500;
    this.listeners = new Set();
    this.storageKey = "troxt_admin_logs_v1";
    this.sig = SIG;

    this.loadFromStorage();
  }

  // Vérifie si le code s'exécute côté client (navigateur)
  _isBrowser() {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  loadFromStorage() {
    if (!this._isBrowser()) return;
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch {
      this.logs = [];
    }
  }

  saveToStorage() {
    if (!this._isBrowser()) return;
    try {
      // Sauvegarde uniquement les 200 entrées les plus récentes pour préserver le stockage local
      localStorage.setItem(this.storageKey, JSON.stringify(this.logs.slice(0, 200)));
    } catch {
      // Ignore les erreurs d'écriture quota
    }
  }

  /**
   * Enregistre une nouvelle action d'administration dans le journal d'audit.
   * @param {Omit<AdminLogEntry, "id" | "timestamp">} entry 
   * @returns {AdminLogEntry}
   */
  log(entry) {
    const fullLog = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      severity: entry.severity || "info",
    };

    this.logs.unshift(fullLog);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.saveToStorage();

    console.log(`🛡️ [ADMIN LOG] [${fullLog.adminName}] -> ${fullLog.action} (${fullLog.details || "aucun détail"})`);
    
    // Diffusion réactive aux composants abonnés (Console UI, Debug panels)
    this.listeners.forEach((fn) => {
      try {
        fn(fullLog);
      } catch (err) {
        console.error("Error in admin log listener:", err);
      }
    });

    return fullLog;
  }

  /**
   * Extrait les logs d'audit filtrés.
   * @param {number} [limit=100] 
   * @param {LogSeverity} [severityFilter] 
   * @returns {AdminLogEntry[]}
   */
  getLogs(limit = 100, severityFilter = undefined) {
    if (severityFilter) {
      return this.logs.filter(l => l.severity === severityFilter).slice(0, limit);
    }
    return this.logs.slice(0, limit);
  }

  clearLogs() {
    this.logs = [];
    if (this._isBrowser()) {
      try {
        localStorage.removeItem(this.storageKey);
      } catch {
        // ignore
      }
    }
  }

  exportAsJSON() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Génère l'export CSV sécurisé contre l'injection de formules.
   * @returns {string}
   */
  exportAsCSV() {
    const headers = ["ID", "Timestamp", "AdminName", "Action", "Severity", "TargetName", "Details"];
    
    // Fonction d'échappement et sécurisation des formules Excel (=, +, -, @)
    const sanitize = (val) => {
      if (val === undefined || val === null) return '""';
      let str = String(val).replace(/"/g, '""');
      if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
        str = `'${str}`; // Préfixe d'échappement Excel
      }
      return `"${str}"`;
    };

    const rows = this.logs.map(l => [
      l.id,
      new Date(l.timestamp).toISOString(),
      sanitize(l.adminName),
      sanitize(l.action),
      l.severity || "info",
      sanitize(l.targetName),
      sanitize(l.details),
    ]);

    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  }

  /**
   * Abonnement réactif à l'apparition de nouvelles actions d'administration.
   * @param {function(AdminLogEntry): void} listener 
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const AdminLogger = new AdminLogService();
export default AdminLogger;
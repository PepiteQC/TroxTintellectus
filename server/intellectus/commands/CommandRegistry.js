/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — COMMANDREGISTRY.JS
 * Registre centralisé et exécuteur de commandes d'administration
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server\intellectus\admin
 */

const SIG = 'TROXT⬡';

/**
 * @typedef {object} CommandResult
 * @property {boolean} success
 * @property {string} message
 * @property {'info'|'success'|'warning'|'error'} [type]
 * @property {any} [data]
 *
 * @typedef {object} IAdminCommand
 * @property {string} verb
 * @property {string[]} [aliases]
 * @property {string} description
 * @property {string} usage
 * @property {'mod'|'admin'|'superadmin'|'owner'} minRole
 * @property {string} category
 * @property {number} [cooldown]
 * @property {function(string[], object, object): Promise<CommandResult>} execute
 */

class Registry {
  constructor() {
    /** @type {Map<string, IAdminCommand>} */
    this.commands = new Map();
    /** @type {Map<string, number>} */
    this.cooldowns = new Map(); // key: executorUid:verb -> timestamp
  }

  /**
   * Enregistre une commande dans le système.
   * @param {IAdminCommand} cmd 
   */
  register(cmd) {
    this.commands.set(cmd.verb.toLowerCase(), cmd);
    if (Array.isArray(cmd.aliases)) {
      for (const alias of cmd.aliases) {
        this.commands.set(alias.toLowerCase(), cmd);
      }
    }
  }

  /**
   * Récupère une commande par son nom ou son alias.
   * @param {string} name 
   * @returns {IAdminCommand|undefined}
   */
  get(name) {
    return this.commands.get(name.toLowerCase());
  }

  /**
   * Liste toutes les commandes uniques enregistrées.
   * @returns {IAdminCommand[]}
   */
  getAll() {
    return Array.from(new Set(this.commands.values()));
  }

  /**
   * Vérifie la hiérarchie des rôles.
   * @param {string} userRole 
   * @param {string} requiredRole 
   * @returns {boolean}
   */
  checkPermission(userRole, requiredRole) {
    const roles = { mod: 1, admin: 2, superadmin: 3, owner: 4 };
    const userWeight = roles[userRole?.toLowerCase()] || 0;
    const reqWeight = roles[requiredRole?.toLowerCase()] || 1;
    return userWeight >= reqWeight;
  }

  /**
   * Parse et exécute une commande administrative.
   * @param {string} rawInput 
   * @param {object} executor 
   * @param {object} context 
   * @returns {Promise<CommandResult>}
   */
  async execute(rawInput, executor, context) {
    const trimmed = rawInput.trim();
    if (!trimmed) return { success: false, message: 'La commande est vide.', type: 'error' };

    const parts = trimmed.split(/\s+/);
    let verb = parts[0].toLowerCase();
    if (verb.startsWith('/') || verb.startsWith('!')) {
      verb = verb.substring(1);
    }
    const args = parts.slice(1);

    const cmd = this.get(verb);
    if (!cmd) {
      return { success: false, message: `❌ Commande inconnue: "/${verb}"`, type: 'error' };
    }

    // 1. Vérification des permissions
    if (!this.checkPermission(executor.role, cmd.minRole)) {
      return { 
        success: false, 
        message: `⛔ Sécurité : Rôle requis [${cmd.minRole.toUpperCase()}] insuffisant.`, 
        type: 'error' 
      };
    }

    // 2. Gestion du Cooldown anti-spam
    if (cmd.cooldown) {
      const cooldownKey = `${executor.uid}:${cmd.verb}`;
      const lastCalled = this.cooldowns.get(cooldownKey) || 0;
      const now = Date.now();
      if (now - lastCalled < cmd.cooldown) {
        const remaining = ((cmd.cooldown - (now - lastCalled)) / 1000).toFixed(1);
        return { 
          success: false, 
          message: `⏳ Doucement ! Veuillez patienter ${remaining}s avant d'utiliser /${cmd.verb} à nouveau.`, 
          type: 'error' 
        };
      }
      this.cooldowns.set(cooldownKey, now);
    }

    // 3. Exécution
    try {
      return await cmd.execute(args, executor, context);
    } catch (err) {
      console.error(`[${SIG}·Registry] Erreur critique sur /${cmd.verb}:`, err);
      return { 
        success: false, 
        message: `⚠️ Erreur système critique sur /${cmd.verb}: ${err.message || err}`, 
        type: 'error' 
      };
    }
  }
}

export const CommandRegistry = new Registry();
/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMCOMMANDS.JS
 * Commandes administratives du Kernel
 * ═══════════════════════════════════════════════════════════════════
 * Chaque commande est :
 *   - documentée (description)
 *   - protégée par un niveau de permission (moderator, admin, superadmin)
 *   - auditée via le registre (callCount, lastCalled)
 *
 * Signature : TROXT⬡
 * Chemin    : server/intellectus/commands/SystemCommands.js
 * Version   : 2.0.0
 */

import { getPlayerCount } from '../../middleware/kernel.js';
import { startAutoTasks } from '../tasks/AutoTasks.js';

const SIG = 'TROXT⬡';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  EXPORT PRINCIPAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Enregistre toutes les commandes système dans le registre Kernel.
 * À appeler une seule fois au bootstrap.
 *
 * @param {object} commands - Registre des commandes (CommandRegistry)
 * @param {object} kernel   - Instance centrale du Kernel
 */
export function registerSystemCommands(commands, kernel) {
  _registerSaveWorld(commands, kernel);
  _registerServerStats(commands, kernel);
  _registerClearCache(commands, kernel);
  _registerRestartScheduler(commands, kernel);
  _registerHealthCheck(commands, kernel);
  _registerMemoryReport(commands, kernel);

  console.log(
    `[${SIG}·Commands] ${commands.list().length} commandes système enregistrées`
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  save_world — permission: admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Déclenche une sauvegarde complète de l'état persistant du monde.
 * Utilisé pour les checkpoints manuels ou les arrêts planifiés.
 */
function _registerSaveWorld(commands, kernel) {
  commands.register(
    'save_world',
    async () => {
      if (!kernel.state) {
        throw new Error('[save_world] État du monde non disponible');
      }

      await kernel.state.save();

      return { 
        saved: true, 
        timestamp: Date.now(), 
        sig: SIG 
      };
    },
    {
      permission:  'admin',
      description: "Sauvegarde manuelle de l'état persistant du monde",
      timeout:     30000,
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  server_stats — permission: admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Snapshot complet des métriques serveur en temps réel.
 * Rate-limité à 1 appel / 5 secondes pour éviter les abus.
 */
function _registerServerStats(commands, kernel) {
  commands.register(
    'server_stats',
    async () => {
      const intellectusStatus =
        typeof kernel.intellectus?.getStatus === 'function'
          ? kernel.intellectus.getStatus()
          : 'active';

      return {
        uptime:      process.uptime(),
        memory:      process.memoryUsage(),
        players:     typeof getPlayerCount === 'function' ? getPlayerCount(kernel) : (kernel.players?.size ?? 0),
        intellectus: intellectusStatus,
        tasks:       kernel.scheduler?.getTasks() ?? [],
        commands:    kernel.commands?.list().length ?? 0,
        timestamp:   Date.now(),
        sig:         SIG,
      };
    },
    {
      permission:  'admin',
      description: 'Rapport de monitoring et télémétrie serveur en temps réel',
      rateLimit:   5000,
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  clear_cache — permission: admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Purge les versions de cache mémoire accumulées.
 * Utilise `prune()` natif si disponible, sinon vide le tableau.
 */
function _registerClearCache(commands, kernel) {
  commands.register(
    'clear_cache',
    async () => {
      let prunedEntries = 0;

      if (kernel.memory) {
        if (typeof kernel.memory.prune === 'function') {
          prunedEntries = kernel.memory.prune();
        } else {
          prunedEntries          = kernel.memory.versions?.length ?? 0;
          kernel.memory.versions = [];
        }
      }

      return { 
        cleared: true, 
        prunedEntries, 
        timestamp: Date.now(),
        sig: SIG 
      };
    },
    {
      permission:  'admin',
      description: 'Purge du cache mémoire et des versions obsolètes',
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  restart_scheduler — permission: superadmin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Redémarre à chaud toutes les tâches planifiées.
 * Utile après une mise à jour de config ou une désynchronisation.
 */
function _registerRestartScheduler(commands, kernel) {
  commands.register(
    'restart_scheduler',
    async () => {
      if (!kernel.scheduler) {
        throw new Error('[restart_scheduler] Scheduler non disponible');
      }

      kernel.scheduler.stopAll?.();
      if (typeof startAutoTasks === 'function') {
        startAutoTasks(kernel.scheduler, kernel);
      }

      return {
        restarted: true,
        taskCount: kernel.scheduler.getTasks?.().length ?? 0,
        timestamp: Date.now(),
        sig:       SIG,
      };
    },
    {
      permission:  'superadmin',
      description: 'Redémarrage à chaud du planificateur de tâches',
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  health_check — permission: admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Vérification de santé complète de tous les sous-systèmes Kernel.
 * Retourne un statut par module et une liste de warnings exploitables.
 */
function _registerHealthCheck(commands, kernel) {
  commands.register(
    'health_check',
    async () => {
      const checks = {
        bus:         _moduleCheck('bus',         kernel.bus),
        contracts:   _moduleCheck('contracts',   kernel.contracts),
        memory:      _moduleCheck('memory',      kernel.memory),
        scheduler:   _moduleCheck('scheduler',   kernel.scheduler),
        commands:    _moduleCheck('commands',    kernel.commands),
        state:       _moduleCheck('state',       kernel.state),
        intellectus: _moduleCheck('intellectus', kernel.intellectus),
        thirdEye: {
          available: kernel.thirdEye != null,
          ready:     kernel.thirdEye?.isReady?.() ?? false,
        },
      };

      const healthy  = Object.values(checks).every((c) => c.available);
      const warnings = Object.entries(checks)
        .filter(([, c]) => !c.available)
        .map(([name]) => `${name} indisponible`);

      return { 
        healthy, 
        checks, 
        warnings, 
        timestamp: Date.now(),
        sig: SIG 
      };
    },
    {
      permission:  'admin',
      description: 'Vérification de santé de tous les sous-systèmes Kernel',
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  memory_report — permission: moderator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Rapport détaillé de l'utilisation mémoire Node.js et Kernel.
 * Accessible aux modérateurs pour le monitoring de premier niveau.
 */
function _registerMemoryReport(commands, kernel) {
  commands.register(
    'memory_report',
    async () => {
      const mem = process.memoryUsage();

      return {
        node: {
          heapUsed:    _mb(mem.heapUsed),
          heapTotal:   _mb(mem.heapTotal),
          rss:         _mb(mem.rss),
          external:    _mb(mem.external),
          heapUsedPct: `${((mem.heapUsed / mem.heapTotal) * 100).toFixed(1)}%`,
        },
        kernel: {
          memoryVersions: kernel.memory?.versions?.length    ?? 0,
          busHistory:     kernel.bus?.history?.length         ?? 0,
          registeredCmds: kernel.commands?.list().length      ?? 0,
          scheduledTasks: kernel.scheduler?.getTasks().length ?? 0,
        },
        timestamp: Date.now(),
        sig:       SIG,
      };
    },
    {
      permission:  'moderator',
      description: "Rapport d'utilisation mémoire Node.js et Kernel",
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPERS PRIVÉS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function _moduleCheck(name, module) {
  return { name, available: module != null };
}

function _mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default registerSystemCommands;
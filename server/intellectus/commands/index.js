/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — INTELLECTUS/COMMANDS/INDEX.JS
 * Point d'entrée des registres de commandes Kernel
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡ · 🛡️INTELLECTUS⬡
 * Chemin    : server/intellectus/commands/index.js
 */

import { registerSystemCommands } from './SystemCommands.js';
import { registerIntellectusCommands } from './IntellectusCommands.js';
import { AllCommands } from '../../commands/StandardCommands.js';

const SIG = 'TROXT⬡';

/**
 * Monte l'intégralité des commandes sur le registre du Kernel.
 * @param {object} kernel - Le Kernel central
 */
export function setupAllCommands(kernel) {
  if (!kernel?.commands) {
    console.warn(`[${SIG}] Aucun registre de commandes trouvé sur le Kernel.`);
    return;
  }

  // 1. Commandes standards (kick, ban, tp, heal, money...)
  for (const cmd of AllCommands) {
    kernel.commands.register(cmd.name, cmd.handler, {
      permission:  cmd.level,
      flag:        cmd.flag,
      description: cmd.description,
      category:    cmd.category,
      aliases:     cmd.aliases,
      args:        cmd.args,
    });
  }

  // 2. Commandes Système (stats, cache, health check...)
  registerSystemCommands(kernel.commands, kernel);

  // 3. Commandes de gouvernance 🛡️INTELLECTUS⬡
  registerIntellectusCommands(kernel.commands, kernel);

  console.log(`[${SIG}] Enregistrement terminé : ${kernel.commands.list?.().length || AllCommands.length} commandes actives.`);
}

export default setupAllCommands;
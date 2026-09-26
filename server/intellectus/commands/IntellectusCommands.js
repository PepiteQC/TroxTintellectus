/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — INTELLECTUS/COMMANDS/INTELLECTUSCOMMANDS.JS
 * Commandes de gouvernance, sécurité IA et anti-cheat 🛡️INTELLECTUS⬡
 * ═══════════════════════════════════════════════════════════════════
 * Pilote en direct :
 *   • Le niveau d'alerte et l'état du cerveau INTELLECTUS
 *   • Le confinement d'urgence (Lockdown / Safe-mode)
 *   • L'audit des contrats de sécurité et de la base de données
 *   • L'analyse anti-triche (Speed-hack, noclip, injection de monnaie)
 *   • La gestion du Trust Score (0-100) et des flags de joueurs
 *
 * Signature : 🛡️INTELLECTUS⬡ · TROXT⬡
 * Chemin    : server/intellectus/commands/IntellectusCommands.js
 */

const ISIG = '🛡️INTELLECTUS⬡';
const SIG  = 'TROXT⬡';

const ok = (message, extra = {}) => ({ success: true, message, isig: ISIG, sig: SIG, ...extra });
const fail = (message, extra = {}) => ({ success: false, message, isig: ISIG, sig: SIG, ...extra });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  EXPORT PRINCIPAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Enregistre toutes les commandes de gouvernance Intellectus.
 * @param {object} commands - Registre des commandes Kernel
 * @param {object} kernel   - Instance centrale du Kernel
 */
export function registerIntellectusCommands(commands, kernel) {
  _registerStatus(commands, kernel);
  _registerAudit(commands, kernel);
  _registerLockdown(commands, kernel);
  _registerUnlock(commands, kernel);
  _registerTrust(commands, kernel);
  _registerSetTrust(commands, kernel);
  _registerScan(commands, kernel);
  _registerFlag(commands, kernel);
  _registerClearFlags(commands, kernel);
  _registerReloadRules(commands, kernel);

  console.log(`[${ISIG}] 10 commandes de sécurité & IA enregistrées`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  1. intellectus_status — permission: moderator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerStatus(commands, kernel) {
  commands.register(
    'intellectus_status',
    async () => {
      const intel = kernel.intellectus;
      const status = intel?.getStatus?.() ?? 'active';
      const threatLevel = intel?.getThreatLevel?.() ?? 'LOW';
      const activeAlerts = intel?.getActiveAlerts?.() ?? 0;
      const lockdown = !!intel?.isLockdown?.();

      return ok(`[${ISIG}] Statut: ${status.toUpperCase()} | Menace: ${threatLevel} | Confinement: ${lockdown ? 'ACTIF 🔴' : 'OFF 🟢'} | Alertes: ${activeAlerts}`, {
        data: {
          status,
          threatLevel,
          lockdown,
          activeAlerts,
          timestamp: Date.now(),
        },
      });
    },
    {
      permission:  'moderator',
      description: "Affiche l'état du moteur de gouvernance et du niveau de menace",
      aliases:     ['isig_status', 'ai_status'],
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  2. intellectus_audit — permission: admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerAudit(commands, kernel) {
  commands.register(
    'intellectus_audit',
    async () => {
      const intel = kernel.intellectus;
      let violations = 0;
      let contractsChecked = 0;

      if (intel?.runSecurityAudit) {
        const audit = await intel.runSecurityAudit();
        violations = audit.violations?.length ?? 0;
        contractsChecked = audit.checkedCount ?? 0;
      }

      kernel.bus?.emit?.('intellectus:audit_completed', {
        timestamp: Date.now(),
        violations,
        sig: ISIG,
      });

      return ok(`[${ISIG}] Audit complet terminé — ${contractsChecked} vérifications, ${violations} violation(s) détectée(s).`, {
        data: { contractsChecked, violations, timestamp: Date.now() },
      });
    },
    {
      permission:  'admin',
      description: "Exécute un audit complet d'intégrité de la mémoire et des règles",
      aliases:     ['audit_sec'],
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  3. intellectus_lockdown — permission: superadmin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerLockdown(commands, kernel) {
  commands.register(
    'intellectus_lockdown',
    async (args) => {
      const reason = args?.reason || 'Mesure préventive de sécurité';
      
      if (kernel.intellectus?.setLockdown) {
        kernel.intellectus.setLockdown(true, reason);
      }

      // Diffuse l'alerte à tout l'écosystème
      kernel.bus?.emit?.('intellectus:lockdown_activated', {
        reason,
        triggeredBy: 'SUPERADMIN',
        timestamp: Date.now(),
        sig: ISIG,
      });

      return ok(`🚨 [${ISIG}] CONFINEMENT ACTIVÉ — Mode haute sécurité enclenché. Raison : ${reason}`, {
        data: { lockdown: true, reason },
      });
    },
    {
      permission:  'superadmin',
      description: "Active le confinement d'urgence (bloque les transferts et fige les actions à risque)",
      args: [{ name: 'reason', type: 'string', rest: true, default: 'Confinement d\'urgence' }],
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  4. intellectus_unlock — permission: superadmin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerUnlock(commands, kernel) {
  commands.register(
    'intellectus_unlock',
    async () => {
      if (kernel.intellectus?.setLockdown) {
        kernel.intellectus.setLockdown(false);
      }

      kernel.bus?.emit?.('intellectus:lockdown_lifted', {
        timestamp: Date.now(),
        sig: ISIG,
      });

      return ok(`✅ [${ISIG}] Confinement levé — Le serveur reprend son fonctionnement normal.`);
    },
    {
      permission:  'superadmin',
      description: "Lève le confinement d'urgence du serveur",
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  5. intellectus_trust — permission: moderator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerTrust(commands, kernel) {
  commands.register(
    'intellectus_trust',
    async (args) => {
      const pid = args.player?.id || args.playerId;
      if (!pid) return fail('Joueur requis.');

      const score = kernel.intellectus?.getTrustScore?.(pid) ?? 100;
      const flags = kernel.intellectus?.getPlayerFlags?.(pid) ?? [];

      return ok(`[${ISIG}] Joueur ${args.player?.name || pid} — Trust Score: ${score}/100 | Flags: ${flags.length}`, {
        data: { playerId: pid, score, flags },
      });
    },
    {
      permission:  'moderator',
      description: "Consulte le score de confiance anti-cheat d'un joueur",
      args: [{ name: 'player', type: 'player', required: true }],
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  6. intellectus_settrust — permission: admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerSetTrust(commands, kernel) {
  commands.register(
    'intellectus_settrust',
    async (args) => {
      const pid = args.player?.id || args.playerId;
      const score = Math.max(0, Math.min(100, Number(args.score)));

      kernel.intellectus?.setTrustScore?.(pid, score);

      kernel.bus?.emit?.('intellectus:trust_updated', {
        playerId: pid,
        score,
        sig: ISIG,
      });

      return ok(`[${ISIG}] Trust score de ${args.player?.name || pid} mis à jour à ${score}/100.`);
    },
    {
      permission:  'admin',
      description: "Modifie manuellement le score de confiance d'un joueur (0-100)",
      args: [
        { name: 'player', type: 'player', required: true },
        { name: 'score',  type: 'number', required: true },
      ],
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  7. intellectus_scan — permission: moderator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerScan(commands, kernel) {
  commands.register(
    'intellectus_scan',
    async (args) => {
      const pid = args.player?.id;
      const playerObj = kernel.players?.get?.(pid);

      if (!playerObj) return fail('Joueur non connecté pour un scan temps réel.');

      const pos = playerObj.pos || { x: 0, y: 0, z: 0 };
      const vel = playerObj.vel || { x: 0, y: 0, z: 0 };
      const speed = Math.sqrt((vel.x || 0) ** 2 + (vel.z || 0) ** 2);

      const suspicious = speed > 30;

      return ok(`[${ISIG}] Scan Joueur ${playerObj.username} : Pos(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) | Vélocité: ${speed.toFixed(2)}m/s | Statut: ${suspicious ? '⚠️ ANOMALIE VITESSE' : 'NORMAL ✓'}`, {
        data: { pid, pos, vel, speed, suspicious },
      });
    },
    {
      permission:  'moderator',
      description: "Effectue un scan direct des coordonnées et vélocité d'un joueur",
      args: [{ name: 'player', type: 'player', required: true }],
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  8. intellectus_flag — permission: moderator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerFlag(commands, kernel) {
  commands.register(
    'intellectus_flag',
    async (args) => {
      const pid = args.player?.id;
      const reason = args.reason || 'Comportement suspect';

      kernel.intellectus?.addFlag?.(pid, reason);
      
      // Baisse préventive du trust score
      const current = kernel.intellectus?.getTrustScore?.(pid) ?? 100;
      kernel.intellectus?.setTrustScore?.(pid, Math.max(0, current - 25));

      kernel.bus?.emit?.('intellectus:player_flagged', {
        playerId: pid,
        reason,
        sig: ISIG,
      });

      return ok(`⚠️ [${ISIG}] Joueur ${args.player?.name || pid} signalé avec succès. Raison: ${reason}`);
    },
    {
      permission:  'moderator',
      description: "Assigne un drapeau de surveillance suspecte à un joueur",
      args: [
        { name: 'player', type: 'player', required: true },
        { name: 'reason', type: 'string', rest: true, default: 'Comportement suspect' },
      ],
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  9. intellectus_clearflags — permission: admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerClearFlags(commands, kernel) {
  commands.register(
    'intellectus_clearflags',
    async (args) => {
      const pid = args.player?.id;
      kernel.intellectus?.clearFlags?.(pid);
      kernel.intellectus?.setTrustScore?.(pid, 100);

      return ok(`[${ISIG}] Flags purgés et Trust Score rétabli à 100 pour ${args.player?.name || pid}.`);
    },
    {
      permission:  'admin',
      description: "Efface tous les avertissements et rétablit la confiance d'un joueur",
      args: [{ name: 'player', type: 'player', required: true }],
    }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  10. intellectus_reload — permission: superadmin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _registerReloadRules(commands, kernel) {
  commands.register(
    'intellectus_reload',
    async () => {
      if (kernel.intellectus?.reloadRules) {
        await kernel.intellectus.reloadRules();
      }

      return ok(`[${ISIG}] Règles de sécurité, contrats et modèles IA rechargés avec succès.`);
    },
    {
      permission:  'superadmin',
      description: "Recharge à chaud les règles de sécurité et heuristiques IA",
    }
  );
}

export default registerIntellectusCommands;
/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — COMMANDS/ANTICHEAT.CMD.JS
 * Commande de diagnostic de sécurité et anti-triche
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server\intellectus\admin\commands/anticheat.cmd.js
 */

import { CommandRegistry } from '../CommandRegistry.js';
import { AntiCheatEngine } from '../../security/anticheat/AntiCheatEngine.js';
import { AuditTrail } from '../../../agents/AuditTrail.js';

// Helper de recherche d'un joueur
function findPlayer(nameOrId, players) {
  const query = nameOrId.toLowerCase();
  return players.find(
    p =>
      p.displayName.toLowerCase() === query ||
      p.uid.toLowerCase() === query ||
      p.uid.slice(0, 8).toLowerCase() === query
  ) || null;
}

export const anticheatCommand = {
  verb: "ac",
  aliases: ["anticheat", "security", "protect"],
  description: "Gérer le système anti-cheat et la sécurité",
  usage: `
    /ac status                    ← Vue d'ensemble du système
    /ac suspects                  ← Liste des suspects détectés par l'IA
    /ac profile <joueur>          ← Profil de sécurité complet d'un joueur
    /ac watch <joueur>            ← Mettre un suspect sous surveillance renforcée
    /ac unwatch <joueur>          ← Retirer de la liste de surveillance
    /ac ban <joueur> [raison]     ← Bannir un joueur via signatures matérielles
    /ac unban <joueur_id>         ← Lever un bannissement
    /ac kick <joueur> [raison]    ← Expulser un joueur du réseau de jeu
    /ac reset <joueur>            ← Réinitialiser l'historique et le Trust Score
    /ac history <joueur>          ← Consulter l'historique des violations
    /ac config [clé] [valeur]     ← Configurer les seuils de détection à chaud
    /ac report <joueur> <raison>  ← Soumettre un rapport de signalement manuel
    /ac scan                      ← Déclencher un audit de position sur tous les joueurs
  `,
  minRole: "admin",
  category: "security",
  cooldown: 2000,

  async execute(args, executor, context) {
    const sub = args[0]?.toLowerCase();
    const targetName = args[1];
    const reason = args.slice(2).join(" ") || "Non spécifiée";

    // Trace d'audit automatique
    await AuditTrail.log({
      action: "admin_command",
      subAction: `ac_${sub || 'help'}`,
      executor: executor.uid,
      executorName: executor.displayName,
      target: targetName || "N/A",
      timestamp: Date.now(),
      metadata: { args, sub },
    });

    switch (sub) {
      case "status": {
        const all = AntiCheatEngine.getAllProfiles();
        const suspects = AntiCheatEngine.getSuspects();
        const banned = AntiCheatEngine.getBannedPlayers();
        const watched = AntiCheatEngine.getWatchedPlayers();

        const avgTrust = all.length > 0
          ? (all.reduce((s, p) => s + p.trustScore, 0) / all.length).toFixed(1)
          : "100";

        const threatLevel = suspects.length >= 5 ? "🔴 ÉLEVÉ"
          : suspects.length >= 2 ? "🟠 MOYEN"
            : "🟢 FAIBLE";

        return {
          success: true,
          message: [
            "╔══════════════════════════════════════════╗",
            "║   🛡️ ANTI-CHEAT STATUS                   ║",
            "╠══════════════════════════════════════════╣",
            `║ Joueurs surveillés: ${String(all.length).padEnd(18)} ║`,
            `║ Suspects actifs:    ${String(suspects.length).padEnd(18)} ║`,
            `║ Joueurs bannis:     ${String(banned.length).padEnd(18)} ║`,
            `║ Sous surveillance:  ${String(watched.length).padEnd(18)} ║`,
            `║ Trust moyen:        ${String(avgTrust).padEnd(15)}% ║`,
            `║ Niveau de menace:   ${String(threatLevel).padEnd(18)} ║`,
            "╚══════════════════════════════════════════╝",
          ].join("\n"),
          type: "info",
          data: { all, suspects, banned, watched, avgTrust, threatLevel },
        };
      }

      case "suspects": {
        const suspects = AntiCheatEngine.getSuspects();
        if (suspects.length === 0) {
          return {
            success: true,
            message: "🟢 Aucun suspect détecté — Intégrité du système validée.",
            type: "success",
          };
        }

        const lines = suspects.map((s, i) => {
          const trustColor = s.trustScore >= 80 ? "🟢" : s.trustScore >= 50 ? "🟠" : "🔴";
          return `  ${i + 1}. ${trustColor} ${s.uid.slice(0, 12)} | Trust: ${s.trustScore}% | Violations: ${s.totalViolations} ${s.isWatched ? "👁️ WATCH" : ""}`;
        });

        return {
          success: true,
          message: [`🔍 SUSPECTS DETECTES (${suspects.length}):`, ...lines].join("\n"),
          type: "warning",
          data: { suspects },
        };
      }

      case "profile": {
        if (!targetName) return { success: false, message: "❌ Usage: /ac profile <joueur>", type: "error" };

        const player = findPlayer(targetName, context.players);
        if (!player) return { success: false, message: `❌ Joueur "${targetName}" introuvable`, type: "error" };

        const profile = AntiCheatEngine.getProfile(player.uid);
        if (!profile) {
          return {
            success: true,
            message: `ℹ️ Aucun profil de sécurité actif pour ${player.displayName}`,
            type: "info",
          };
        }

        const trustColor = profile.trustScore >= 80 ? "🟢" : profile.trustScore >= 50 ? "🟠" : "🔴";
        const recentViolations = profile.violations.slice(-5);

        return {
          success: true,
          message: [
            "╔══════════════════════════════════════════╗",
            `║   🛡️ PROFIL: ${player.displayName.padEnd(28)} ║`,
            "╠══════════════════════════════════════════╣",
            `║ UID:        ${player.uid.slice(0, 16).padEnd(26)} ║`,
            `║ ${trustColor} Trust Score: ${String(profile.trustScore).padEnd(22)}% ║`,
            `║ Violations: ${String(profile.totalViolations).padEnd(26)} ║`,
            `║ Banni:      ${String(profile.isBanned ? "OUI ❌" : "NON ✅").padEnd(26)} ║`,
            `║ Surveillé:  ${String(profile.isWatched ? "OUI 👁️" : "NON").padEnd(26)} ║`,
            `║ IP:         ${String(profile.lastKnownIP || "N/A").padEnd(26)} ║`,
            "╠══════════════════════════════════════════╣",
            "║ Dernières violations (5):                ║",
            ...recentViolations.map(v => `║   • ${v.type.padEnd(20)} ${String(v.severity).padEnd(10)} ║`),
            recentViolations.length === 0 ? "║   (Aucune violation enregistrée)         ║" : "",
            "╚══════════════════════════════════════════╝",
          ].join("\n"),
          type: "info",
          data: { profile, player },
        };
      }

      case "watch": {
        const player = findPlayer(targetName, context.players);
        if (!player) return { success: false, message: `❌ Joueur "${targetName}" introuvable`, type: "error" };

        AntiCheatEngine.flagPlayer(player.uid, `Surveillance activée par ${executor.displayName}`);

        await AuditTrail.log({
          action: "player_watched",
          target: player.uid,
          targetName: player.displayName,
          executor: executor.uid,
          reason: "Manual admin command watch",
          timestamp: Date.now(),
        });

        return {
          success: true,
          message: `👁️ ${player.displayName} est désormais placé sous surveillance renforcée.`,
          type: "success",
          data: { playerId: player.uid, watched: true },
        };
      }

      case "unwatch": {
        const player = findPlayer(targetName, context.players);
        if (!player) return { success: false, message: `❌ Joueur "${targetName}" introuvable`, type: "error" };

        AntiCheatEngine.unflagPlayer(player.uid);

        return {
          success: true,
          message: `✅ Surveillance révoquée pour ${player.displayName}.`,
          type: "success",
          data: { playerId: player.uid, watched: false },
        };
      }

      case "ban": {
        const player = findPlayer(targetName, context.players);
        if (!player) return { success: false, message: `❌ Joueur "${targetName}" introuvable`, type: "error" };

        const isPerm = args[2] === "perm";
        const banResult = await AntiCheatEngine.banPlayer({
          playerId: player.uid,
          reason,
          executorId: executor.uid,
          executorName: executor.displayName,
          duration: isPerm ? Infinity : undefined,
        });

        if (!banResult.success) {
          return { success: false, message: `❌ Échec du bannissement: ${banResult.error}`, type: "error" };
        }

        await context.kickPlayer(player.uid, `Banni par l'administration: ${reason}`);

        return {
          success: true,
          message: `❌ ${player.displayName} a été banni pour : ${reason}`,
          type: "warning",
          data: { playerId: player.uid, banned: true, reason },
        };
      }

      case "unban": {
        if (!targetName) return { success: false, message: "❌ Usage: /ac unban <joueur_id>", type: "error" };

        const unbanResult = await AntiCheatEngine.unbanPlayer(targetName, executor.displayName);
        if (!unbanResult.success) {
          return { success: false, message: `❌ Échec du débannissement: ${unbanResult.error}`, type: "error" };
        }

        return {
          success: true,
          message: `✅ Joueur ID "${targetName}" réhabilité sur le réseau de jeu.`,
          type: "success",
          data: { playerId: targetName, banned: false },
        };
      }

      case "kick": {
        const player = findPlayer(targetName, context.players);
        if (!player) return { success: false, message: `❌ Joueur "${targetName}" introuvable`, type: "error" };

        await context.kickPlayer(player.uid, `Expulsé par ${executor.displayName}: ${reason}`);

        return {
          success: true,
          message: `👢 ${player.displayName} a été expulsé. Raison: ${reason}`,
          type: "warning",
          data: { playerId: player.uid, kicked: true },
        };
      }

      case "reset": {
        const player = findPlayer(targetName, context.players);
        if (!player) return { success: false, message: `❌ Joueur "${targetName}" introuvable`, type: "error" };

        AntiCheatEngine.resetProfile(player.uid);

        return {
          success: true,
          message: `🔄 Profil de sécurité de ${player.displayName} réinitialisé à zéro.`,
          type: "success",
          data: { playerId: player.uid, reset: true },
        };
      }

      case "history": {
        const player = findPlayer(targetName, context.players);
        if (!player) return { success: false, message: `❌ Joueur "${targetName}" introuvable`, type: "error" };

        const profile = AntiCheatEngine.getProfile(player.uid);
        if (!profile || profile.violations.length === 0) {
          return {
            success: true,
            message: `ℹ️ Aucun historique de violation détecté pour ${player.displayName}`,
            type: "info",
          };
        }

        const lines = profile.violations.map((v, i) =>
          `  ${i + 1}. [${new Date(v.timestamp).toLocaleString()}] ${v.type} - ${v.description} (${v.severity})`
        );

        return {
          success: true,
          message: [`📜 HISTORIQUE DES SIGNALEMENTS DE ${player.displayName}:`, ...lines].join("\n"),
          type: "info",
          data: { violations: profile.violations },
        };
      }

      case "config": {
        const configKey = args[1];
        const configValue = args[2];

        if (!configKey) {
          const config = AntiCheatEngine.getConfig();
          return {
            success: true,
            message: [
              "⚙️ CONFIGURATION ANTI-CHEAT ACTIVE:",
              ...Object.entries(config).map(([k, v]) => `  ${k}: ${v}`),
            ].join("\n"),
            type: "info",
            data: { config },
          };
        }

        if (configValue) {
          AntiCheatEngine.setConfig(configKey, configValue);
          return {
            success: true,
            message: `✅ Variable de détection mise à jour: ${configKey} = ${configValue}`,
            type: "success",
          };
        }

        const currentValue = AntiCheatEngine.getConfigValue(configKey);
        return {
          success: true,
          message: `⚙️ Valeur courante : ${configKey} = ${currentValue}`,
          type: "info",
        };
      }

      case "report": {
        const player = findPlayer(targetName, context.players);
        if (!player) return { success: false, message: `❌ Joueur "${targetName}" introuvable`, type: "error" };

        await AntiCheatEngine.addReport({
          reporterId: executor.uid,
          reporterName: executor.displayName,
          targetId: player.uid,
          targetName: player.displayName,
          reason,
          timestamp: Date.now(),
        });

        return {
          success: true,
          message: `📋 Signalement enregistré pour ${player.displayName}`,
          type: "success",
          data: { reported: true },
        };
      }

      case "scan": {
        const scanResult = await AntiCheatEngine.fullScan();
        const newSuspects = scanResult.newSuspects;
        const lines = newSuspects.map(s =>
          `  ⚠️ ${s.uid.slice(0, 12)} | Trust: ${s.trustScore}% | Dernière violation: ${s.lastViolation?.type}`
        );

        return {
          success: true,
          message: [
            `🔍 AUDIT DE POSITION COMPLET ACCOMPLI`,
            `Citoyens analysés: ${scanResult.totalPlayers}`,
            `Nouveaux suspects isolés: ${newSuspects.length}`,
            ...(lines.length > 0 ? lines : ["  Aucune anomalie détectée"]),
          ].join("\n"),
          type: newSuspects.length > 0 ? "warning" : "success",
          data: scanResult,
        };
      }

      default:
        return {
          success: false,
          message: [
            "❌ Sous-commandes disponibles pour /ac :",
            "  status, suspects, profile, watch, unwatch",
            "  ban, unban, kick, reset, history",
            "  config, report, scan",
          ].join("\n"),
          type: "error",
        };
    }
  }
};

CommandRegistry.register(anticheatCommand);
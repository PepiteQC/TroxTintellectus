/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — COMMANDS/MODERATION.CMD.JS
 * Commandes de gestion des joueurs, économie, téléportation et métiers
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server\intellectus\admin\commands/moderation.cmd.js
 */

import { CommandRegistry } from '../CommandRegistry.js';
import { db } from '../../firebase/config.js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AdminLogger } from '../../firebase/adminLogger.js';
import { JobManager } from '../../jobs/JobManager.js';
import { PoliceDuty } from '../../jobs/duties/PoliceDuty.js';

// Raccourci recherche de joueur
function find(query, players) {
  const q = query.toLowerCase();
  return players.find(p => p.displayName.toLowerCase() === q || p.uid.toLowerCase() === q) || null;
}

// ─── COMMAND: HELP ──────────────────────────────────────────────────
export const helpCommand = {
  verb: "help",
  aliases: ["h", "?"],
  description: "Afficher la liste des commandes disponibles",
  usage: "/help [commande]",
  minRole: "mod",
  async execute(args) {
    const all = CommandRegistry.getAll();

    if (args.length > 0) {
      const cmd = CommandRegistry.get(args[0]);
      if (!cmd) return { success: false, message: `❌ Commande "${args[0]}" inconnue`, type: "error" };
      return {
        success: true,
        message: [
          `📖 /${cmd.verb.toUpperCase()}`,
          `Description: ${cmd.description}`,
          `Usage: ${cmd.usage}`,
          `Permission requise: ${cmd.minRole.toUpperCase()}`,
          `Alias: ${cmd.aliases?.join(", ") ?? "Aucun"}`,
        ].join("\n"),
        type: "info",
      };
    }

    const lines = [
      "┌──────────────────────────────────────────────┐",
      "│  🎮  ETHERWORLD RP - COMMANDES ADMIN PLATINUM│",
      "├──────────────────────────────────────────────┤",
      ...all.map(c => `│  /${c.verb.padEnd(14)} - ${c.description.substring(0, 24).padEnd(24)} │`),
      "└──────────────────────────────────────────────┘",
      'ℹ️  Tape "/help <commande>" pour plus de détails.',
    ];

    return { success: true, message: lines.join("\n"), type: "info" };
  }
};

// ─── COMMAND: KICK ──────────────────────────────────────────────────
export const kickCommand = {
  verb: "kick",
  aliases: ["k"],
  description: "Expulser un joueur du serveur",
  usage: "/kick <joueur> [raison]",
  minRole: "mod",
  async execute(args, executor, context) {
    if (args.length < 1) return { success: false, message: "❌ Usage: /kick <joueur> [raison]", type: "error" };

    const target = find(args[0], context.players);
    if (!target) return { success: false, message: `❌ Joueur "${args[0]}" introuvable`, type: "error" };

    if (target.role === "owner" || target.role === "admin") {
      return { success: false, message: "❌ Vous ne pouvez pas exclure un membre de rang supérieur ou égal.", type: "error" };
    }

    const reason = args.slice(1).join(" ") || "Expulsé par l'administration";
    context.socket.to(target.uid).emit("admin:kick", { reason, kickedBy: executor.displayName });
    context.broadcast(`Legit kick: 🦵 ${target.displayName} a été expulsé par ${executor.displayName} | Motif: ${reason}`);

    await AdminLogger.log({
      action: "KICK",
      adminUid: executor.uid,
      adminName: executor.displayName,
      targetUid: target.uid,
      targetName: target.displayName,
      reason,
    });

    return { success: true, message: `✅ ${target.displayName} a été expulsé.`, type: "success" };
  }
};

// ─── COMMAND: BAN ───────────────────────────────────────────────────
export const banCommand = {
  verb: "ban",
  aliases: ["b"],
  description: "Bannir un joueur du serveur",
  usage: "/ban <joueur> <minutes|perm> [raison]",
  minRole: "admin",
  async execute(args, executor, context) {
    if (args.length < 2) return { success: false, message: "❌ Usage: /ban <joueur> <minutes|perm> [raison]", type: "error" };

    const target = find(args[0], context.players);
    if (!target) return { success: false, message: `❌ Joueur "${args[0]}" introuvable`, type: "error" };

    const duration = args[1];
    const reason = args.slice(2).join(" ") || "Infraction grave aux règles de la communauté";
    const isPerm = duration === "perm" || duration === "permanent";
    const durationMin = isPerm ? null : parseInt(duration, 10);
    const expiresAt = durationMin ? new Date(Date.now() + durationMin * 60 * 1000) : null;

    // Persistance dans Firestore
    await setDoc(doc(db, "bans", target.uid), {
      uid: target.uid,
      displayName: target.displayName,
      reason,
      bannedBy: executor.uid,
      bannedByName: executor.displayName,
      isPermanent: isPerm,
      expiresAt,
      createdAt: serverTimestamp(),
    });

    context.socket.to(target.uid).emit("admin:ban", {
      reason,
      duration: isPerm ? "Permanent" : `${durationMin} minutes`,
      bannedBy: executor.displayName,
    });

    context.broadcast(`🔨 ${target.displayName} a été banni ${isPerm ? "DÉFINITIVEMENT" : `pour ${durationMin} min`} par ${executor.displayName}. Motif: ${reason}`);

    await AdminLogger.log({
      action: "BAN",
      adminUid: executor.uid,
      adminName: executor.displayName,
      targetUid: target.uid,
      targetName: target.displayName,
      reason,
      extra: { duration: isPerm ? "perm" : durationMin },
    });

    return { success: true, message: `✅ Bannissement appliqué pour ${target.displayName}.`, type: "success" };
  }
};

// ─── COMMAND: GOD ───────────────────────────────────────────────────
export const godCommand = {
  verb: "god",
  aliases: ["godmode"],
  description: "Activer ou désactiver l'invincibilité d'un joueur",
  usage: "/god [joueur]",
  minRole: "admin",
  async execute(args, executor, context) {
    const targetName = args[0] ?? executor.displayName;
    const target = find(targetName, context.players);
    if (!target) return { success: false, message: `❌ Joueur "${targetName}" introuvable`, type: "error" };

    target.isGod = !target.isGod;
    context.socket.to(target.uid).emit("admin:god", { enabled: target.isGod });

    return {
      success: true,
      message: `✅ Mode Divin ${target.isGod ? "ACTIVÉ 🌟" : "DÉSACTIVÉ 💀"} pour ${target.displayName}`,
      type: "success",
    };
  }
};

// ─── COMMAND: TELEPORT ──────────────────────────────────────────────
export const teleportCommand = {
  verb: "tp",
  aliases: ["teleport"],
  description: "Se téléporter ou téléporter des joueurs",
  usage: "/tp <joueur> <x> <y> <z>  OU  /tp <joueur1> <joueur2>",
  minRole: "mod",
  async execute(args, executor, context) {
    if (args.length < 2) return { success: false, message: "❌ Usage incorrect.", type: "error" };

    const target = find(args[0], context.players);
    if (!target) return { success: false, message: `❌ Joueur "${args[0]}" introuvable`, type: "error" };

    let destination;

    if (args.length === 4) {
      destination = { x: parseFloat(args[1]), y: parseFloat(args[2]), z: parseFloat(args[3]) };
      if (isNaN(destination.x) || isNaN(destination.y) || isNaN(destination.z)) {
        return { success: false, message: "❌ Coordonnées numériques invalides.", type: "error" };
      }
    } else {
      const destPlayer = find(args[1], context.players);
      if (!destPlayer) return { success: false, message: `❌ Destination introuvable.`, type: "error" };
      destination = destPlayer.position;
    }

    context.socket.to(target.uid).emit("admin:teleport", { position: destination });
    if (target.rapierBody) {
      target.rapierBody.setTranslation(destination, true);
    }

    return { success: true, message: `✅ ${target.displayName} téléporté aux coordonnées spécifiées.`, type: "success" };
  }
};

// ─── COMMAND: SPAWN (VÉHICULES ET PROPS) ─────────────────────────────
const SPAWN_CATALOG = {
  voiture:   { model: "car_police",   label: "Voiture de Police" },
  moto:      { model: "moto_sport",   label: "Moto Sport"        },
  camion:    { model: "truck_01",     label: "Camion"            },
  helicop:   { model: "heli_01",      label: "Hélicoptère"       },
  coffre:    { model: "prop_coffre",  label: "Coffre au trésor"  },
  arme:      { model: "prop_arme",    label: "Arme"              },
};

export const spawnCommand = {
  verb: "spawn",
  aliases: ["s"],
  description: "Générer un véhicule ou objet à proximité",
  usage: "/spawn <voiture|moto|camion|helicop|coffre>",
  minRole: "admin",
  async execute(args, executor, context) {
    if (args.length < 1) {
      return { success: false, message: `❌ Choix: ${Object.keys(SPAWN_CATALOG).join(", ")}`, type: "error" };
    }

    const entry = SPAWN_CATALOG[args[0].toLowerCase()];
    if (!entry) return { success: false, message: "❌ Modèle inconnu.", type: "error" };

    const target = find(args[1] ?? executor.displayName, context.players) ?? executor;
    const spawnPos = { x: target.position.x + 3, y: target.position.y, z: target.position.z };

    context.socket.emit("world:spawn", {
      model: entry.model,
      position: spawnPos,
      spawnedBy: executor.displayName,
    });

    return { success: true, message: `✅ ${entry.label} généré à proximité de ${target.displayName}.`, type: "success" };
  }
};

// ─── COMMAND: JOBS & SERVICES ───────────────────────────────────────
export const jobCommand = {
  verb: "job",
  aliases: ["j"],
  description: "Modifier le travail, l'affectation et les avis de recherche",
  usage: "/job set <joueur> <jobId> [grade] | /job fire <joueur> | /job list | /job wanted",
  minRole: "admin",
  async execute(args, executor, context) {
    const sub = args[0]?.toLowerCase();

    switch (sub) {
      case "set": {
        const [, target, jobId, rank] = args;
        const player = find(target, context.players);
        if (!player) return { success: false, message: "❌ Joueur introuvable.", type: "error" };

        const result = await JobManager.assignJob(player.uid, jobId, rank ?? "recruit");
        return { ...result, type: result.success ? "success" : "error" };
      }
      case "fire": {
        const player = find(args[1], context.players);
        if (!player) return { success: false, message: "❌ Joueur introuvable.", type: "error" };

        await JobManager.assignJob(player.uid, "unemployed");
        return { success: true, message: `✅ ${player.displayName} a été licencié de son poste.`, type: "success" };
      }
      case "list": {
        const lines = ["📋 ÉTAT DES SERVICES ACTIFS:"];
        for (const p of context.players) {
          const cache = JobManager.getCache(p.uid);
          if (cache && cache.jobId !== "unemployed") {
            lines.push(`  ${cache.isOnDuty ? "🟢 EN SERVICE" : "🔴 ABSENT"} | ${p.displayName} → ${cache.jobId} (${cache.rank})`);
          }
        }
        return { success: true, message: lines.join("\n"), type: "info" };
      }
      case "wanted": {
        const list = PoliceDuty.getAllWanted();
        if (list.length === 0) return { success: true, message: "🟢 Aucun suspect recherché actuellement.", type: "info" };

        const lines = list.map(w => `  ⭐${"⭐".repeat(w.stars)} ${w.displayName} | Total amendes : $${w.totalFines}`);
        return { success: true, message: `🚔 RECHERCHÉS PAR LA SÛRETÉ DU QUÉBEC :\n${lines.join("\n")}`, type: "info" };
      }
      default:
        return { success: false, message: "❌ Sous-commandes d'affectation : set, fire, list, wanted", type: "error" };
    }
  }
};

// Enregistrement global
CommandRegistry.register(helpCommand);
CommandRegistry.register(kickCommand);
CommandRegistry.register(banCommand);
CommandRegistry.register(godCommand);
CommandRegistry.register(teleportCommand);
CommandRegistry.register(spawnCommand);
CommandRegistry.register(jobCommand);
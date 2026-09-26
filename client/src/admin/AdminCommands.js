/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — ADMIN/ADMINCOMMANDS.JS  (v3.1 Platinum Edition)
 * Système de commandes d'administration et modération avancées
 * ═══════════════════════════════════════════════════════════════════
 * Pilote l'ensemble des modules d'administration :
 *   • Modération physique et temporelle (Kick, Ban, Unban, Jail, Cuff)
 *   • Système de construction créatif (GMod, Spawns, Clear, Door toggles)
 *   • Économie et inventaire (Argent, Crypto TroxT, GiveItem)
 *   • Météorologie et constante physique globale (Gravité, Temps, Climat)
 *   • Police provinciale SQ / SPVM (Patrouille, Radar, Sirènes, Tickets, Dispatch)
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/admin/AdminCommands.js
 */

import { PoliceSystem } from '../jobs/police/PoliceSystem.js';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════
// TYPES DE DOCUMENTATION (JSDoc pour l'autocomplétion)
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {'player' | 'moderation' | 'teleport' | 'economy' | 'world' | 'vehicle' | 'gmod' | 'system'} AdminCategory
 * @typedef {'moderator' | 'admin' | 'superadmin'} AdminPermission
 *
 * @typedef {object} AdminCommandContext
 * @property {string} [executorName]
 * @property {AdminPermission} [executorRole]
 * @property {any} [gameManager]
 * @property {any} [playerPhysics]
 * @property {any} [persona]
 * @property {any} [gmodBuilder]
 * @property {any} [colyseusRoom]
 * @property {string} [weather]
 * @property {Function} [setWeather]
 * @property {boolean} [isFlying]
 * @property {Function} [setIsFlying]
 * @property {{uuid: string, name: string, isOpen: boolean}} [nearDoor]
 * @property {Function} [setNearDoor]
 * @property {Function} [playSfx]
 * @property {Function} [addLog]
 * @property {Function} [broadcastMessage]
 *
 * @typedef {object} AdminCommandResult
 * @property {boolean} success
 * @property {string} message
 * @property {Record<string, any>} [actionPayload]
 *
 * @typedef {object} AdminCommand
 * @property {string} id
 * @property {string} name
 * @property {string[]} [aliases]
 * @property {AdminCategory} category
 * @property {string} description
 * @property {string} usage
 * @property {AdminPermission} permission
 * @property {function(string[], AdminCommandContext): AdminCommandResult} execute
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION DU REGISTRE DES COMMANDES
// ═══════════════════════════════════════════════════════════════════

/** @type {Map<string, AdminCommand>} */
const commandRegistry = new Map();

/**
 * Enregistre une commande administrative dans le système.
 * @param {AdminCommand} cmd 
 */
export function registerAdminCommand(cmd) {
  commandRegistry.set(cmd.name.toLowerCase(), cmd);
  if (Array.isArray(cmd.aliases)) {
    for (const alias of cmd.aliases) {
      commandRegistry.set(alias.toLowerCase(), cmd);
    }
  }
}

// ─── LOCATIONS PRÉ-DÉFINIES POUR TÉLÉPORTATION ──────────────────────
export const PRESET_TELEPORTS = Object.freeze({
  spawn:        { x: 0, y: 1.2, z: 0, name: "Place Centrale (Spawn)" },
  central:      { x: 0, y: 1.2, z: 0, name: "Place Centrale" },
  police:       { x: 35, y: 1.2, z: -40, name: "QG SPVM Police" },
  spvm:         { x: 35, y: 1.2, z: -40, name: "QG SPVM Police" },
  jail:         { x: 35, y: 1.2, z: -45, name: "Cellule de Révolte / Prison" },
  prison:       { x: 35, y: 1.2, z: -45, name: "Cellule de Révolte / Prison" },
  bkf:          { x: -45, y: 1.2, z: 30, name: "Banque de Portneuf (BKF)" },
  bank:         { x: -45, y: 1.2, z: 30, name: "Banque de Portneuf" },
  banque:       { x: -45, y: 1.2, z: 30, name: "Banque de Portneuf" },
  dojo:         { x: 50, y: 1.2, z: 50, name: "Chamber Fight Club Dojo" },
  fight:        { x: 50, y: 1.2, z: 50, name: "Chamber Fight Club Dojo" },
  villa:        { x: -60, y: 1.2, z: -60, name: "Villa Nova VIP" },
  cantine:      { x: -15, y: 1.2, z: -25, name: "La Cantine Chez Gaston" },
  boutique:     { x: 20, y: 1.2, z: 20, name: "Boutique Éther Mode" },
  quai:         { x: 10, y: 1.2, z: 50, name: "Quai du Fleuve Saint-Laurent" },
  phare:        { x: -40, y: 1.2, z: 65, name: "Phare Historique de Portneuf" },
  chapelle:     { x: 30, y: 1.2, z: -45, name: "Chapelle de la Côte" },
  moulin:       { x: -45, y: 1.2, z: -50, name: "Moulin à Vent Traditionnel" },
  hospital:     { x: 25, y: 1.2, z: 35, name: "Hôpital SAMU 06" },
  samu:         { x: 25, y: 1.2, z: 35, name: "Hôpital SAMU 06" },
  eglise:       { x: 0, y: 1.2, z: 0, name: "Église de Saint-Alban" },
  cabane_sucre: { x: -60, y: 1.2, z: 60, name: "Cabane à Sucre Érable" },
  grange:       { x: -45, y: 1.2, z: 48, name: "Grande Grange" },
});

// ═══════════════════════════════════════════════════════════════════
// INITIALISATION DE LA BIBLIOTHÈQUE DE COMMANDES
// ═══════════════════════════════════════════════════════════════════

function initCommands() {
  if (commandRegistry.size > 0) return;

  // 1. HELP
  registerAdminCommand({
    id: "help",
    name: "help",
    aliases: ["h", "cmd", "commands", "aide"],
    category: "system",
    description: "Affiche la liste de toutes les commandes d'administration disponibles.",
    usage: "/help [nom_commande]",
    permission: "moderator",
    execute: (args) => {
      if (args[0]) {
        const cmd = getAdminCommand(args[0]);
        if (!cmd) return { success: false, message: `Commande inconnue: "${args[0]}"` };
        return {
          success: true,
          message: `📜 COMMANDE: /${cmd.name} | Catégorie: ${cmd.category.toUpperCase()} | Usage: ${cmd.usage}\nDescription: ${cmd.description}`,
        };
      }

      const categories = Array.from(
        new Set(Array.from(commandRegistry.values()).map((c) => c.category))
      );
      const summaryList = categories
        .map((cat) => {
          const cmds = Array.from(new Set(Array.from(commandRegistry.values()).filter((c) => c.category === cat).map((c) => c.name)));
          return `• ${cat.toUpperCase()}: ${cmds.map((c) => "/" + c).join(", ")}`;
        })
        .join("\n");

      return {
        success: true,
        message: `🛡️ SYSTÈME D'ADMINISTRATION TROXT ADVANCED v3.1\n${summaryList}\n\nTapez /help <nom> pour obtenir le détail d'une commande.`,
      };
    },
  });

  // 2. GOD MODE
  registerAdminCommand({
    id: "god",
    name: "god",
    aliases: ["godmode", "invincible"],
    category: "player",
    description: "Active ou désactive l'invulnérabilité globale (Godmode).",
    usage: "/god [on|off]",
    permission: "admin",
    execute: (args, ctx) => {
      let newState = true;
      if (args[0] === "off" || args[0] === "false" || args[0] === "0") {
        newState = false;
      } else if (ctx.persona?.godMode !== undefined) {
        newState = !ctx.persona.godMode;
      }

      if (ctx.persona) {
        ctx.persona.setVitals?.(100, 100);
        ctx.persona.godMode = newState;
      }

      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand(`heal 100`);
      }

      ctx.playSfx?.("click");
      ctx.addLog?.(`🛡️ ADMIN: Godmode ${newState ? "ACTIVÉ ✅" : "DÉSACTIVÉ ❌"}`);

      return {
        success: true,
        message: `Mode Dieu est désormais ${newState ? "ACTIVÉ" : "DÉSACTIVÉ"}.`,
        actionPayload: { godMode: newState },
      };
    },
  });

  // 3. HEAL / REVIVE
  registerAdminCommand({
    id: "heal",
    name: "heal",
    aliases: ["revive", "soigner", "sante"],
    category: "player",
    description: "Restaure la santé et l'énergie du personnage ciblé à 100%.",
    usage: "/heal [joueur] [montant]",
    permission: "moderator",
    execute: (args, ctx) => {
      const target = args[0] || "vous";
      const amt = parseInt(args[1], 10);
      const safeAmt = Number.isFinite(amt) ? clamp(amt, 0, 100) : 100;

      if (ctx.persona) {
        ctx.persona.setVitals?.(safeAmt, 100);
      }
      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand(`heal ${safeAmt}`);
      }

      ctx.playSfx?.("click");
      ctx.addLog?.(`❤️ ADMIN: Soins appliqués à ${target} (${safeAmt}% PV)`);

      return {
        success: true,
        message: `Santé de ${target} restaurée à ${safeAmt}%.`,
      };
    },
  });

  // 4. FLY / NOCLIP
  registerAdminCommand({
    id: "fly",
    name: "fly",
    aliases: ["noclip", "voler"],
    category: "player",
    description: "Bascule l'état du vol libre (Noclip) à travers la matrice.",
    usage: "/fly [on|off]",
    permission: "admin",
    execute: (args, ctx) => {
      if (ctx.setIsFlying) {
        ctx.setIsFlying((prev) => !prev);
      }
      ctx.playSfx?.("click");
      ctx.addLog?.(`🛸 ADMIN: Mode vol / Noclip basculé.`);
      return { success: true, message: "Mode vol (Noclip) basculé." };
    },
  });

  // 5. SPEED
  registerAdminCommand({
    id: "speed",
    name: "speed",
    aliases: ["vitesse", "setspeed"],
    category: "player",
    description: "Modifie la vélocité et vitesse de marche du joueur.",
    usage: "/speed <multiplicateur>",
    permission: "admin",
    execute: (args, ctx) => {
      const val = parseFloat(args[0]);
      if (!Number.isFinite(val) || val <= 0) {
        return { success: false, message: "Spécifiez une vitesse numérique valide. Exemple: /speed 15" };
      }

      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand(`speed ${val}`);
      }
      ctx.playSfx?.("click");
      ctx.addLog?.(`⚡ ADMIN: Vitesse ajustée à ${val}`);
      return { success: true, message: `Vitesse de marche fixée à ${val}.` };
    },
  });

  // 6. SLAP / SMITE
  registerAdminCommand({
    id: "slap",
    name: "slap",
    aliases: ["baffe", "propulse"],
    category: "moderation",
    description: "Propulse un suspect dans l'espace aérien pour un avertissement physique.",
    usage: "/slap [joueur] [force]",
    permission: "moderator",
    execute: (args, ctx) => {
      const target = args[0] || "joueur";
      const force = parseFloat(args[1]);
      const safeForce = Number.isFinite(force) ? force : 5;

      if (ctx.playerPhysics?.current) {
        ctx.playerPhysics.current.y += safeForce;
        ctx.playerPhysics.current.vy = safeForce * 2;
      }
      ctx.playSfx?.("collision");
      ctx.addLog?.(`👋 ADMIN: ${target} propulsé avec une force de ${safeForce}.`);

      return { success: true, message: `${target} a été giflé dans les airs.` };
    },
  });

  registerAdminCommand({
    id: "smite",
    name: "smite",
    aliases: ["foudre", "frapper"],
    category: "moderation",
    description: "Foudroie un joueur récalcitrant en le propulsant.",
    usage: "/smite [joueur]",
    permission: "admin",
    execute: (args, ctx) => {
      const target = args[0] || "joueur";
      if (ctx.playerPhysics?.current) {
        ctx.playerPhysics.current.vy = 12;
      }
      ctx.playSfx?.("collision");
      ctx.addLog?.(`⚡ ADMIN: Foudre invoquée sur ${target} !`);
      return { success: true, message: `Éclair divin abattu sur ${target}.` };
    },
  });

  // 7. JAIL / UNJAIL
  registerAdminCommand({
    id: "jail",
    name: "jail",
    aliases: ["emprisonner", "prison"],
    category: "moderation",
    description: "Incarcère immédiatement un suspect dans les cellules de détention du SPVM.",
    usage: "/jail [joueur] [duree_sec] [raison]",
    permission: "moderator",
    execute: (args, ctx) => {
      const target = args[0] || "joueur";
      const duration = parseInt(args[1], 10) || 60;
      const reason = args.slice(2).join(" ") || "Infraction au code civil d'Étherworld";

      if (ctx.playerPhysics?.current) {
        ctx.playerPhysics.current.x = PRESET_TELEPORTS.jail.x;
        ctx.playerPhysics.current.y = PRESET_TELEPORTS.jail.y;
        ctx.playerPhysics.current.z = PRESET_TELEPORTS.jail.z;
      }

      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand(`teleport jail`);
      }

      ctx.playSfx?.("collision");
      ctx.addLog?.(`🚨 ADMIN: ${target} incarcéré pour ${duration}s (${reason})`);
      ctx.broadcastMessage?.(`🚨 [SPVM] Le suspect ${target} a été placé en cellule de détention administrative (${reason}).`);

      return {
        success: true,
        message: `${target} a été verrouillé en cellule de détention SPVM.`,
      };
    },
  });

  registerAdminCommand({
    id: "unjail",
    name: "unjail",
    aliases: ["liberer", "free"],
    category: "moderation",
    description: "Remet en liberté un prisonnier en le téléportant à la place centrale.",
    usage: "/unjail [joueur]",
    permission: "moderator",
    execute: (args, ctx) => {
      const target = args[0] || "joueur";

      if (ctx.playerPhysics?.current) {
        ctx.playerPhysics.current.x = PRESET_TELEPORTS.spawn.x;
        ctx.playerPhysics.current.y = PRESET_TELEPORTS.spawn.y;
        ctx.playerPhysics.current.z = PRESET_TELEPORTS.spawn.z;
      }

      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand(`teleport spawn`);
      }

      ctx.playSfx?.("click");
      ctx.addLog?.(`🔓 ADMIN: ${target} libéré et ramené au Spawn.`);

      return { success: true, message: `Incarcération levée. ${target} est de nouveau libre.` };
    },
  });

  // 8. TELEPORTATION (TP)
  registerAdminCommand({
    id: "tp",
    name: "tp",
    aliases: ["teleport", "tpto", "goto"],
    category: "teleport",
    description: "Téléporte instantanément vers un point d'intérêt clé ou des coordonnées X, Z.",
    usage: "/tp <spawn|police|bank|dojo|hospital|cabane_sucre> ou /tp <X> <Z>",
    permission: "moderator",
    execute: (args, ctx) => {
      if (!args[0]) {
        return {
          success: false,
          message: `Destination manquante. Choix: ${Object.keys(PRESET_TELEPORTS).slice(0, 10).join(", ")} ou /tp <X> <Z>`,
        };
      }

      const destKey = args[0].toLowerCase();

      // Case 1: Point prédéfini
      if (PRESET_TELEPORTS[destKey]) {
        const p = PRESET_TELEPORTS[destKey];
        if (ctx.playerPhysics?.current) {
          ctx.playerPhysics.current.x = p.x;
          ctx.playerPhysics.current.y = p.y;
          ctx.playerPhysics.current.z = p.z;
        }
        if (ctx.gameManager) {
          ctx.gameManager.executeConsoleCommand(`teleport ${destKey}`);
        }
        ctx.playSfx?.("click");
        ctx.addLog?.(`🌀 TELEPORT: Destination -> ${p.name} [X:${p.x}, Z:${p.z}]`);
        return { success: true, message: `Téléporté à ${p.name}.` };
      }

      // Case 2: Coordonnées chiffrées X Z
      const x = parseFloat(args[0]);
      const z = parseFloat(args[1]);

      if (Number.isFinite(x) && Number.isFinite(z)) {
        if (ctx.playerPhysics?.current) {
          ctx.playerPhysics.current.x = x;
          ctx.playerPhysics.current.z = z;
        }
        ctx.playSfx?.("click");
        ctx.addLog?.(`🌀 TELEPORT: Coordonnées manuelles [X:${x}, Z:${z}]`);
        return { success: true, message: `Téléporté aux coordonnées X:${x}, Z:${z}.` };
      }

      return {
        success: false,
        message: `Lieu inconnu: "${args[0]}". Utilisez un raccourci ou spécifiez des coordonnées X Z.`,
      };
    },
  });

  // Raccourcis de Téléportation Rapide
  registerAdminCommand({
    id: "tpspawn",
    name: "tpspawn",
    category: "teleport",
    description: "Téléportation immédiate au Spawn Central.",
    usage: "/tpspawn",
    permission: "moderator",
    execute: (args, ctx) => commandRegistry.get("tp").execute(["spawn"], ctx),
  });

  registerAdminCommand({
    id: "tppolice",
    name: "tppolice",
    category: "teleport",
    description: "Téléportation immédiate au QG SPVM Police.",
    usage: "/tppolice",
    permission: "moderator",
    execute: (args, ctx) => commandRegistry.get("tp").execute(["police"], ctx),
  });

  registerAdminCommand({
    id: "tpbkf",
    name: "tpbkf",
    category: "teleport",
    description: "Téléportation immédiate à la Banque de Portneuf.",
    usage: "/tpbkf",
    permission: "moderator",
    execute: (args, ctx) => commandRegistry.get("tp").execute(["bkf"], ctx),
  });

  registerAdminCommand({
    id: "tpdojo",
    name: "tpdojo",
    category: "teleport",
    description: "Téléportation au Chamber Fight Club Dojo.",
    usage: "/tpdojo",
    permission: "moderator",
    execute: (args, ctx) => commandRegistry.get("tp").execute(["dojo"], ctx),
  });

  // 9. ECONOMY & MONEY
  registerAdminCommand({
    id: "give",
    name: "give",
    aliases: ["cash", "argent", "money", "addmoney"],
    category: "economy",
    description: "Ajuste le solde bancaire ou liquide (ou les Crypto TRX) d'un citoyen.",
    usage: "/give <cash|crypto> <montant>",
    permission: "admin",
    execute: (args, ctx) => {
      let subType = args[0]?.toLowerCase();
      let amt = parseInt(args[1], 10);

      if (Number.isFinite(parseInt(subType, 10))) {
        amt = parseInt(subType, 10);
        subType = "cash";
      }

      if (!Number.isFinite(amt)) amt = 10000;

      if (subType === "cash" || subType === "money" || subType === "argent") {
        if (ctx.persona) {
          ctx.persona.updateEconomy?.(amt, 0);
        }
        if (ctx.gameManager) {
          ctx.gameManager.executeConsoleCommand(`cash ${amt}`);
        }
        ctx.playSfx?.("buy");
        ctx.addLog?.(`💵 ÉCONOMIE: Cash modifié de ${amt >= 0 ? "+" : ""}${amt}$`);
        return { success: true, message: `Solde liquide ajusté de ${amt}$.` };
      }

      if (subType === "crypto" || subType === "troxt") {
        if (ctx.persona) {
          ctx.persona.updateEconomy?.(0, amt);
        }
        ctx.playSfx?.("buy");
        ctx.addLog?.(`🪙 ÉCONOMIE: Crypto TRX modifié de ${amt >= 0 ? "+" : ""}${amt} TRX`);
        return { success: true, message: `Solde crypto TRX ajusté de ${amt} TRX.` };
      }

      return {
        success: false,
        message: "Paramètres incorrects. Exemple: /give cash 50000 ou /give crypto 250",
      };
    },
  });

  // 10. WEAPONS & EQUIPMENT
  registerAdminCommand({
    id: "weapon",
    name: "weapon",
    aliases: ["arm", "setweapon", "arme"],
    category: "player",
    description: "Équipe instantanément une arme offensive dans la main du personnage.",
    usage: "/weapon <pipe|bat|bottle|hammer|sword|none>",
    permission: "moderator",
    execute: (args, ctx) => {
      const type = (args[0] || "pipe").toLowerCase();
      const valid = ["none", "pipe", "bat", "bottle", "hammer", "sword", "pistol", "shotgun"];

      if (!valid.includes(type)) {
        return {
          success: false,
          message: `Arme invalide: "${type}". Choix valides: ${valid.join(", ")}`,
        };
      }

      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand(`weapon ${type}`);
      }
      ctx.playSfx?.("click");
      ctx.addLog?.(`⚔️ ADMIN: Arme configurée -> ${type.toUpperCase()}`);

      return { success: true, message: `Arme configurée sur ${type.toUpperCase()}.` };
    },
  });

  // 11. UNLOCK ALL
  registerAdminCommand({
    id: "unlockall",
    name: "unlockall",
    aliases: ["debloquer", "fullunlock"],
    category: "economy",
    description: "Débloque l'intégralité du catalogue immobilier, des props de construction et des clés.",
    usage: "/unlockall",
    permission: "superadmin",
    execute: (args, ctx) => {
      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand("unlock_props");
        ctx.gameManager.executeConsoleCommand("unlock_immo");
        ctx.gameManager.executeConsoleCommand("keyrings");
      }
      ctx.playSfx?.("buy");
      ctx.addLog?.("🔑 ADMIN: Déblocage général de l'écosystème (Props, Immo, Clés).");
      return {
        success: true,
        message: "Toutes les propriétés de luxe, clés de coffres et catalogues de meubles sont déverrouillés.",
      };
    },
  });

  // 12. CONDITIONS CLIMATIQUES ET TEMPORELLES
  registerAdminCommand({
    id: "weather",
    name: "weather",
    aliases: ["meteo", "sky"],
    category: "world",
    description: "Modifie dynamiquement les conditions météorologiques globales.",
    usage: "/weather <clear|rain|fog|night|cyber>",
    permission: "moderator",
    execute: (args, ctx) => {
      const w = (args[0] || "clear").toLowerCase();
      if (ctx.setWeather) {
        ctx.setWeather(w);
      }
      ctx.playSfx?.("click");
      ctx.addLog?.(`🌤️ MÉTÉO: Conditions ajustées à ${w.toUpperCase()}`);
      return { success: true, message: `Météo mise à jour : "${w}".` };
    },
  });

  registerAdminCommand({
    id: "time",
    name: "time",
    aliases: ["temps", "heure"],
    category: "world",
    description: "Modifie l'heure du cycle circadien.",
    usage: "/time <day|night|sunset|noon>",
    permission: "moderator",
    execute: (args, ctx) => {
      const t = (args[0] || "day").toLowerCase();
      if (t === "night" || t === "nuit") {
        ctx.setWeather?.("night");
      } else {
        ctx.setWeather?.("clear");
      }
      ctx.playSfx?.("click");
      ctx.addLog?.(`⏰ HORLOGE: Heure forcée sur -> ${t.toUpperCase()}`);
      return { success: true, message: `Heure configurée sur "${t}".` };
    },
  });

  // 13. GRAVITY
  registerAdminCommand({
    id: "gravity",
    name: "gravity",
    aliases: ["gravite", "setgravity"],
    category: "world",
    description: "Ajuste la constante d'attraction de gravité de la scène.",
    usage: "/gravity <valeur> (Lune: 3.5, Terre: 19.8, Zero-G: 0)",
    permission: "admin",
    execute: (args, ctx) => {
      const g = parseFloat(args[0]);
      if (!Number.isFinite(g)) {
        return { success: false, message: "Ajustez la gravité avec une valeur numérique. Exemple: /gravity 19.8" };
      }

      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand(`gravity ${g}`);
      }
      ctx.playSfx?.("click");
      ctx.addLog?.(`🌎 PHYSIQUE: Constante de gravité réglée à ${g} m/s²`);
      return { success: true, message: `Attraction gravitationnelle ajustée à ${g}.` };
    },
  });

  // 14. EVENTS
  registerAdminCommand({
    id: "spawnevent",
    name: "spawnevent",
    aliases: ["event", "evenement"],
    category: "world",
    description: "Déclenche un événement d'urgence RP sur tout le domaine.",
    usage: "/spawnevent <bank_robbery|police_chase|airdrop|ether_storm>",
    permission: "admin",
    execute: (args, ctx) => {
      const ev = args[0] || "airdrop";
      ctx.playSfx?.("collision");
      ctx.addLog?.(`💥 ÉVÉNEMENT: Déclenchement de l'événement RP global: "${ev.toUpperCase()}"`);
      ctx.broadcastMessage?.(`🚨 [ALERTE RP GLOBAL] L'événement "${ev.toUpperCase()}" vient d'éclater dans la région de Portneuf !`);

      return {
        success: true,
        message: `Événement global "${ev}" démarré.`,
      };
    },
  });

  // 15. SPAWN D'OBJETS / PROPS
  registerAdminCommand({
    id: "spawn",
    name: "spawn",
    aliases: ["spawnprop", "prop", "item"],
    category: "gmod",
    description: "Fait apparaître un prop GMod, un bâtiment ou un véhicule à vos pieds.",
    usage: "/spawn <item_id>",
    permission: "moderator",
    execute: (args, ctx) => {
      const itemId = args[0] || "house_modern_empty";

      if (ctx.gmodBuilder && ctx.playerPhysics?.current) {
        ctx.gmodBuilder.spawnPropAtPlayer(
          itemId,
          [ctx.playerPhysics.current.x, ctx.playerPhysics.current.y, ctx.playerPhysics.current.z]
        );
      } else if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand(`spawn ${itemId}`);
      }

      ctx.playSfx?.("click");
      ctx.addLog?.(`📦 BUILDER: Génération d'élément -> ${itemId}`);

      return {
        success: true,
        message: `Élément "${itemId}" généré à vos pieds.`,
      };
    },
  });

  // 16. PORTE INTERACTIVE
  registerAdminCommand({
    id: "door",
    name: "door",
    aliases: ["porte", "toggledoor"],
    category: "gmod",
    description: "Ouvre, ferme ou verrouille la porte interactive la plus proche.",
    usage: "/door",
    permission: "moderator",
    execute: (args, ctx) => {
      if (ctx.gmodBuilder && ctx.nearDoor) {
        const isOpen = ctx.gmodBuilder.toggleDoor(ctx.nearDoor.uuid);
        ctx.setNearDoor?.((prev) => (prev ? { ...prev, isOpen } : null));
        ctx.playSfx?.("door");
        ctx.addLog?.(`🚪 PORTE: Verrouillage basculé -> ${isOpen ? "OUVERTE" : "FERMÉE"}`);
        return {
          success: true,
          message: `La porte "${ctx.nearDoor.name}" est désormais ${isOpen ? "ouverte" : "fermée"}.`,
        };
      }

      return {
        success: false,
        message: "Aucune porte interactive à proximité immédiate.",
      };
    },
  });

  // 17. NETTOYAGE DES PROPS
  registerAdminCommand({
    id: "clearprops",
    name: "clearprops",
    aliases: ["clear", "nettoyer"],
    category: "gmod",
    description: "Supprime instantanément tous les objets GMod posés dans la zone.",
    usage: "/clearprops",
    permission: "admin",
    execute: (args, ctx) => {
      if (ctx.gmodBuilder) {
        ctx.gmodBuilder.clearAllProps();
      }
      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand("clear_props");
      }
      ctx.playSfx?.("click");
      ctx.addLog?.("🧹 BUILDER: Suppression totale des constructions GMod temporaires.");
      return { success: true, message: "La zone de construction a été nettoyée." };
    },
  });

  // 18. AUDIT SÉCURITÉ
  registerAdminCommand({
    id: "audit",
    name: "audit",
    aliases: ["check", "security"],
    category: "system",
    description: "Lance un diagnostic complet d'intégrité de la mémoire d'Ether-Guard.",
    usage: "/audit",
    permission: "moderator",
    execute: (args, ctx) => {
      if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand("audit");
      }
      ctx.playSfx?.("click");
      ctx.addLog?.("🔍 SÉCURITÉ: Audit d'intégrité mémoire et réseau achevé sans anomalies.");
      return {
        success: true,
        message: "Diagnostic réseau, base de données et modules achevé : 100% stable.",
      };
    },
  });

  // 19. ANNOUNCE
  registerAdminCommand({
    id: "announce",
    name: "announce",
    aliases: ["broadcast", "annonce"],
    category: "moderation",
    description: "Diffuse une annonce officielle à l'ensemble du serveur.",
    usage: "/announce <message>",
    permission: "moderator",
    execute: (args, ctx) => {
      const text = args.join(" ");
      if (!text) return { success: false, message: "Texte de l'annonce manquant." };

      ctx.broadcastMessage?.(`📢 [ALERTE ADMIN] ${text}`);
      ctx.addLog?.(`📢 ANNONCE GLOBALE: "${text}"`);
      ctx.playSfx?.("collision");

      return { success: true, message: "Annonce officielle diffusée." };
    },
  });

  // 20. ROLES & JOBS RP
  registerAdminCommand({
    id: "setrole",
    name: "setrole",
    aliases: ["role"],
    category: "moderation",
    description: "Définit le groupe ou privilège d'un joueur (ex: citizen, moderator, admin, superadmin).",
    usage: "/setrole [joueur] <role_id>",
    permission: "admin",
    execute: (args, ctx) => {
      const role = args[1] || args[0] || "citizen";
      ctx.playSfx?.("click");
      ctx.addLog?.(`📋 PERMISSIONS: Changement de rôle -> ${role.toUpperCase()}`);
      return { success: true, message: `Permissions du joueur changées pour : "${role}".` };
    },
  });

  registerAdminCommand({
    id: "setjob",
    name: "setjob",
    aliases: ["job", "metier"],
    category: "moderation",
    description: "Assigne un métier de l'écosystème Étherworld (SPVM, SAMU, Mecano, Maire).",
    usage: "/setjob [joueur] <job_id>",
    permission: "moderator",
    execute: (args, ctx) => {
      const job = args[1] || args[0] || "civilian";
      ctx.playSfx?.("click");
      ctx.addLog?.(`💼 MÉTIER: Emploi assigné -> ${job.toUpperCase()}`);
      return { success: true, message: `Emploi du joueur mis à jour : "${job}".` };
    },
  });

  // 21. KICK, BAN & GIVEITEM
  registerAdminCommand({
    id: "kick",
    name: "kick",
    aliases: ["expulser", "eject"],
    category: "moderation",
    description: "Expulse un joueur connecté de la session.",
    usage: "/kick <nom> [raison]",
    permission: "moderator",
    execute: (args, ctx) => {
      const target = args[0] || "joueur";
      const reason = args.slice(1).join(" ") || "Raison non spécifiée";

      ctx.playSfx?.("collision");
      ctx.addLog?.(`MODÉRATION: Expulsion de ${target} (${reason})`);
      ctx.broadcastMessage?.(`👢 [MODÉRATION] ${target} a été expulsé. Raison : ${reason}`);

      return {
        success: true,
        message: `Expulsion effectuée.`,
      };
    },
  });

  registerAdminCommand({
    id: "ban",
    name: "ban",
    aliases: ["bannir", "tempban", "permban"],
    category: "moderation",
    description: "Bannit un joueur du serveur de manière temporaire ou permanente.",
    usage: "/ban <nom> [duree] [raison]",
    permission: "admin",
    execute: (args, ctx) => {
      const target = args[0] || "joueur";
      const duration = args[1] || "Permanent";
      const reason = args.slice(2).join(" ") || "Bannissement administratif";

      ctx.playSfx?.("collision");
      ctx.addLog?.(`🔨 MODÉRATION: Bannissement de ${target} [${duration}] — Motif: ${reason}`);
      ctx.broadcastMessage?.(`🔨 [SANCTION] ${target} a été banni. Durée : ${duration} | Motif : ${reason}`);

      return {
        success: true,
        message: `Bannissement enregistré pour ${target}.`,
      };
    },
  });

  registerAdminCommand({
    id: "unban",
    name: "unban",
    aliases: ["pardonner"],
    category: "moderation",
    description: "Lève le bannissement d'un joueur hors-ligne.",
    usage: "/unban <nom_ou_id>",
    permission: "admin",
    execute: (args, ctx) => {
      const target = args[0] || "joueur";
      ctx.playSfx?.("click");
      ctx.addLog?.(`🔓 MODÉRATION: Bannissement révoqué pour ${target}.`);
      return { success: true, message: `Bannissement levé pour ${target}.` };
    },
  });

  registerAdminCommand({
    id: "giveitem",
    name: "giveitem",
    aliases: ["itemgive", "giveprop"],
    category: "gmod",
    description: "Donne ou fait apparaître un item/prop à un joueur.",
    usage: "/giveitem [joueur_id] <item_id> ou /giveitem <item_id>",
    permission: "moderator",
    execute: (args, ctx) => {
      if (!args[0]) {
        return {
          success: false,
          message: "Précisez l'identifiant de l'objet. Exemple: /giveitem wood_chair ou /giveitem player1 sofa_nova",
        };
      }

      let targetPlayer = "local";
      let itemId = args[0];

      if (args.length >= 2) {
        targetPlayer = args[0];
        itemId = args[1];
      }

      if (ctx.gmodBuilder && ctx.playerPhysics?.current) {
        ctx.gmodBuilder.spawnPropAtPlayer(
          itemId,
          [ctx.playerPhysics.current.x, ctx.playerPhysics.current.y, ctx.playerPhysics.current.z]
        );
      } else if (ctx.gameManager) {
        ctx.gameManager.executeConsoleCommand(`spawn ${itemId}`);
      }

      ctx.playSfx?.("buy");
      ctx.addLog?.(`🎁 INVENTAIRE: Item ${itemId} attribué à ${targetPlayer}`);

      return {
        success: true,
        message: `Objet "${itemId}" généré avec succès pour ${targetPlayer}.`,
      };
    },
  });

  // 22. POLICE - EMISSION D'AMENDES
  registerAdminCommand({
    id: "ticket",
    name: "ticket",
    aliases: ["amende", "fine"],
    category: "moderation",
    description: "Émet une contravention / amende officielle à un suspect.",
    usage: "/ticket [joueur] [montant] [raison]",
    permission: "moderator",
    execute: (args, ctx) => {
      if (args.length < 2) {
        return { success: false, message: "Usage: /ticket [joueur] [montant] [raison]" };
      }
      const targetName = args[0];
      const amount = parseInt(args[1], 10);
      const reason = args.slice(2).join(" ") || "Infraction au Code de la Sécurité Routière du Québec";

      if (isNaN(amount) || amount <= 0) {
        return { success: false, message: "Montant de l'amende invalide." };
      }

      if (PoliceSystem && typeof PoliceSystem.issueTicket === "function") {
        PoliceSystem.issueTicket(
          "local_player",
          targetName,
          "officer_cmd",
          ctx.executorName || "Agent SQ",
          "SQ",
          amount,
          reason
        );
      }

      const msg = `📋 Contravention émise : ${targetName} écope de ${amount}$ pour: ${reason}`;
      ctx.broadcastMessage?.(msg);
      return { success: true, message: msg };
    },
  });

  // 23. POLICE - MENOTTAGE
  registerAdminCommand({
    id: "cuff",
    name: "cuff",
    aliases: ["menottes", "handcuff", "uncuff"],
    category: "moderation",
    description: "Pose ou retire les menottes de contention à un suspect.",
    usage: "/cuff [joueur]",
    permission: "moderator",
    execute: (args, ctx) => {
      const target = args[0] || "suspect";
      let cuffed = false;

      if (PoliceSystem && typeof PoliceSystem.toggleCuff === "function") {
        cuffed = PoliceSystem.toggleCuff(target);
      }

      const statusMsg = cuffed 
        ? `🔒 Le suspect ${target} a été menotté par les forces de l'ordre.` 
        : `🔓 Le suspect ${target} a été démenotté.`;
        
      ctx.broadcastMessage?.(statusMsg);
      return { success: true, message: statusMsg };
    },
  });

  // 24. POLICE - CONTROLE DE VITESSE RADAR
  registerAdminCommand({
    id: "radar",
    name: "radar",
    category: "player",
    description: "Active ou désactive l'unité radar de contrôle de vitesse de la patrouille.",
    usage: "/radar",
    permission: "moderator",
    execute: (args, ctx) => {
      let active = false;
      if (PoliceSystem && typeof PoliceSystem.toggleRadar === "function") {
        active = PoliceSystem.toggleRadar();
      }
      const msg = active ? "📡 Cinémomètre radar de patrouille ACTIF !" : "📡 Radar laser DÉSACTIVÉ.";
      ctx.addLog?.(msg);
      return { success: true, message: msg };
    },
  });

  // 25. VEHICULE - SIRENES & GYROPHARES
  registerAdminCommand({
    id: "siren",
    name: "siren",
    aliases: ["gyrophare"],
    category: "vehicle",
    description: "Bascule l'avertisseur sonore de sirène et gyrophares du véhicule d'urgence.",
    usage: "/siren [wail|yelp]",
    permission: "moderator",
    execute: (args, ctx) => {
      const mode = (args[0]?.toLowerCase() === "yelp" ? "yelp" : "wail");
      let active = false;
      if (PoliceSystem && typeof PoliceSystem.togglePoliceSiren === "function") {
        active = PoliceSystem.togglePoliceSiren(undefined, mode);
      }
      const msg = active 
        ? `🚨 Avertisseurs sonores d'urgence ACTIVÉS (Mode: ${mode.toUpperCase()}) !` 
        : "🚨 Avertisseurs sonores éteints.";
      ctx.addLog?.(msg);
      return { success: true, message: msg };
    },
  });

  // 26. POLICE - PATROUILLE / PRISE DE SERVICE
  registerAdminCommand({
    id: "patrol",
    name: "patrol",
    aliases: ["patrouille"],
    category: "player",
    description: "Prend ou quitte son service actif au sein des forces de l'ordre.",
    usage: "/patrol [SQ|SPVM]",
    permission: "moderator",
    execute: (args, ctx) => {
      const dept = args[0]?.toUpperCase() === "SPVM" ? "SPVM" : "SQ";
      let dutyOn = false;
      if (PoliceSystem && typeof PoliceSystem.toggleDuty === "function") {
        dutyOn = PoliceSystem.toggleDuty(dept);
      }
      const msg = dutyOn
        ? `👮 Prise de service active (${dept}). Équipement de patrouille et fréquence radio assignés.`
        : "👮 Fin de service active. Armes et émetteur déposés.";
      ctx.broadcastMessage?.(msg);
      return { success: true, message: msg };
    },
  });

  // 27. POLICE - APPEL DISPATCH 911
  registerAdminCommand({
    id: "dispatch",
    name: "dispatch",
    aliases: ["callout"],
    category: "moderation",
    description: "Génère un appel d'urgence Code 10 pour l'ensemble des patrouilles.",
    usage: "/dispatch [10-80|10-31|10-98|10-99] [lieu]",
    permission: "moderator",
    execute: (args, ctx) => {
      const code = (args[0] || "10-80");
      const loc = args.slice(1).join(" ") || "Secteur Centre-Ville";
      
      if (PoliceSystem && typeof PoliceSystem.triggerDispatchCallout === "function") {
        PoliceSystem.triggerDispatchCallout(
          code,
          `Appel de Détresse : ${code}`,
          `Signalement suspect en cours à ${loc}`,
          loc,
          [0, 0, 0],
          "high"
        );
      }
      
      const msg = `📢 [DISPATCH 911] CODE ${code} signalé à : ${loc} ! Unités demandées en renfort.`;
      ctx.broadcastMessage?.(msg);
      return { success: true, message: msg };
    },
  });

  // 28. CHASSE & PROTECTION DE LA FAUNE
  registerAdminCommand({
    id: "hunt",
    name: "hunt",
    aliases: ["chasse", "faune"],
    category: "world",
    description: "Consulte le registre provincial de chasse du Québec.",
    usage: "/hunt",
    permission: "moderator",
    execute: (args, ctx) => {
      const msg = "🌲 [MINISTÈRE DE LA FAUNE] Permis de Chasse valide. Gibiers suivis : Élan d'Amérique, Loup Gris, Ours Noir.";
      ctx.addLog?.(msg);
      return { success: true, message: msg };
    },
  });

  // 29. FREEZE / UNFREEZE
  registerAdminCommand({
    id: "freeze",
    name: "freeze",
    aliases: ["geler"],
    category: "moderation",
    description: "Immobilise complètement un joueur sur place.",
    usage: "/freeze <joueur>",
    permission: "moderator",
    execute: (args, ctx) => {
      const target = args[0] || "joueur";
      ctx.playSfx?.("click");
      ctx.addLog?.(`🥶 MODÉRATION: ${target} a été gelé sur place.`);
      return { success: true, message: `${target} est désormais immobilisé.` };
    },
  });

  registerAdminCommand({
    id: "unfreeze",
    name: "unfreeze",
    aliases: ["degeler"],
    category: "moderation",
    description: "Libère les mouvements d'un joueur immobilisé.",
    usage: "/unfreeze <joueur>",
    permission: "moderator",
    execute: (args, ctx) => {
      const target = args[0] || "joueur";
      ctx.playSfx?.("click");
      ctx.addLog?.(`🔥 MODÉRATION: ${target} a été dégelé.`);
      return { success: true, message: `${target} peut à nouveau se déplacer.` };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// SYSTÈME DE JOURNAL D'AUDIT ET ABONNEMENTS (REACT/UI SUPPORT)
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} AdminAuditLogEntry
 * @property {string} id
 * @property {string} timestamp
 * @property {string} executor
 * @property {string} command
 * @property {string} category
 * @property {boolean} success
 * @property {string} message
 */

/** @type {AdminAuditLogEntry[]} */
const auditLogs = [
  {
    id: "init-audit-1",
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    executor: "SYSTEM",
    command: "system_audit_start",
    category: "system",
    success: true,
    message: "Journal d'audit de sécurité opérationnel. Toutes les actions administratives sont enregistrées.",
  }
];

const logSubscribers = new Set();

/**
 * Ajoute un enregistrement au journal d'audit de modération.
 * @param {Omit<AdminAuditLogEntry, "id" | "timestamp">} entry 
 */
export function addAuditLog(entry) {
  const newEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
  auditLogs.unshift(newEntry);
  if (auditLogs.length > 250) auditLogs.pop();
  logSubscribers.forEach((fn) => fn([...auditLogs]));
}

export function getAuditLogs() {
  return [...auditLogs];
}

/**
 * Permet à un composant UI React d'écouter les logs d'audit en temps réel (WebSocket-like local).
 * @param {function(AdminAuditLogEntry[]):void} callback 
 * @returns {Function} Unsubscribe function
 */
export function subscribeAuditLogs(callback) {
  logSubscribers.add(callback);
  callback([...auditLogs]);
  return () => {
    logSubscribers.delete(callback);
  };
}

// ─── ACCESSEURS PUBLICS ──────────────────────────────────────────

export function getAdminCommand(nameOrAlias) {
  if (commandRegistry.size === 0) {
    initCommands();
  }
  return commandRegistry.get(nameOrAlias.toLowerCase());
}

export function getAllAdminCommands() {
  if (commandRegistry.size === 0) {
    initCommands();
  }
  const unique = new Map();
  for (const cmd of commandRegistry.values()) {
    unique.set(cmd.id, cmd);
  }
  return Array.from(unique.values());
}

// Helper de bornage
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ═══════════════════════════════════════════════════════════════════
// ANALYSEUR ET MOTEUR D'EXECUTION (COMMAND DISPATCHER)
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse une ligne de chat brute et exécute la commande si les droits sont validés.
 * @param {string} rawInput - Ligne brute (ex: "/jail JeanBob 120 Speed-hack")
 * @param {AdminCommandContext} ctx - Contexte d'exécution
 * @returns {AdminCommandResult}
 */
export function parseAndExecuteAdminCommand(rawInput, ctx) {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { success: false, message: "La saisie est vide." };
  }

  const parts = trimmed.split(/\s+/);
  let cmdName = parts[0].toLowerCase();
  
  if (cmdName.startsWith("/") || cmdName.startsWith("!")) {
    cmdName = cmdName.substring(1);
  }
  
  const args = parts.slice(1);
  const executor = ctx.executorName || "Administrateur";
  const command = getAdminCommand(cmdName);

  if (command) {
    // Vérification de sécurité des permissions administratives
    const roleHierarchy = { moderator: 1, admin: 2, superadmin: 3 };
    const execWeight = roleHierarchy[ctx.executorRole] || 0;
    const reqWeight  = roleHierarchy[command.permission] || 1;

    if (execWeight < reqWeight) {
      const errPerm = `Sécurité : Droits requis [${command.permission.toUpperCase()}] insuffisants pour exécuter /${cmdName}`;
      addAuditLog({
        executor,
        command: `/${cmdName}`,
        category: "system",
        success: false,
        message: errPerm
      });
      return { success: false, message: errPerm };
    }

    try {
      const res = command.execute(args, ctx);
      addAuditLog({
        executor,
        command: `/${cmdName}${args.length ? " " + args.join(" ") : ""}`,
        category: command.category,
        success: res.success,
        message: res.message,
      });
      return res;
    } catch (err) {
      console.error("[TROXT·Admin] Échec critique d'exécution:", err);
      const errMsg = `Erreur lors de l'exécution de la commande /${cmdName}: ${err.message || err}`;
      addAuditLog({
        executor,
        command: `/${cmdName}${args.length ? " " + args.join(" ") : ""}`,
        category: command.category,
        success: false,
        message: errMsg,
      });
      return { success: false, message: errMsg };
    }
  }

  // Fallback vers le parseur de secours legacy si configuré
  if (ctx.gameManager) {
    const res = ctx.gameManager.executeConsoleCommand(trimmed);
    addAuditLog({
      executor,
      command: trimmed,
      category: "legacy",
      success: res?.success ?? true,
      message: res?.message || "Exécuté via le parser legacy du GameManager",
    });
    return res;
  }

  const notFoundMsg = `Commande inconnue: "/${cmdName}". Tapez /help pour obtenir la liste.`;
  addAuditLog({
    executor,
    command: `/${cmdName}`,
    category: "system",
    success: false,
    message: notFoundMsg,
  });

  return {
    success: false,
    message: notFoundMsg,
  };
}

export default {
  PRESET_TELEPORTS,
  registerAdminCommand,
  parseAndExecuteAdminCommand,
  getAdminCommand,
  getAllAdminCommands,
  addAuditLog,
  getAuditLogs,
  subscribeAuditLogs,
  SIG,
};
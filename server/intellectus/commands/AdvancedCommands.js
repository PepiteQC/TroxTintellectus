/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — COMMANDS/ADVANCEDCOMMANDS.JS  (v3.1 Platinum Edition)
 * Commandes avancées : Régions, World-Edit & Économie bancaire
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : server\intellectus\admin\commands/AdvancedCommands.js
 */

const SIG = 'TROXT⬡';

/**
 * @typedef {object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {object} AdvancedSystems
 * @property {object} regions    - Système de gestion de parcelles / zones
 * @property {object} economy    - Système d'économie (banque, taxes, transactions)
 * @property {object} worldEdit  - Gestionnaire de sessions de modification de blocs
 */

// ─── HELPERS DE RENDU DES MESSAGES ───────────────────────────────────────────

function ok(message, extra = {}) {
  return { success: true, message, sig: SIG, ...extra };
}

function fail(message) {
  return { success: false, message, sig: SIG };
}

/**
 * Récupère la position 3D exacte du joueur émetteur via l'adaptateur de jeu.
 * @param {object} ctx - Contexte de commande
 * @returns {Vec3}
 */
function getPlayerPos(ctx) {
  const p = ctx.game?.getPosition?.(ctx.senderId);
  if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.z !== 'number') {
    throw new Error("Impossible d'acquérir la position du joueur (game.getPosition manquant ou hors ligne).");
  }
  return p;
}

/**
 * Valide qu'un joueur possède une sélection WorldEdit valide (pos1 et pos2).
 * @param {object} session - Session WorldEdit active
 */
function _validateSelection(session) {
  if (!session.pos1 || !session.pos2) {
    throw new Error("Sélection incomplète. Veuillez définir vos points de délimitation avec /pos1 et /pos2.");
  }
}

// ═══════════════════════════════════════════════════════════════════
// FABRIQUE DES COMMANDES DU MODULE ADVANCED
// ═══════════════════════════════════════════════════════════════════

/**
 * Fabrique et retourne l'intégralité des commandes de la suite avancée.
 * @param {AdvancedSystems} systems 
 * @returns {object[]} Liste des définitions de commandes prêtes à l'enregistrement
 */
export function createAdvancedCommands(systems) {
  const { regions, economy, worldEdit } = systems;

  // ═════════════════════════════════════════════════════════════════
  //  MOTEUR DE REGIONS (ZONES / PROTECTION)
  // ═════════════════════════════════════════════════════════════════

  const regionCmd = {
    name: "region",
    aliases: ["rg", "zone"],
    description: "Gère les régions et parcelles protégées : create, remove, info, flag, addmember, redefine, list.",
    category: "Régions",
    level: 3, // ADMIN
    flag: "MANAGE_ADMINS",
    usage: "/region <create|remove|info|flag|addmember|redefine|setowner|list> [options...]",
    args: [
      { name: "action", type: "string", required: true },
      { name: "a", type: "string", required: false },
      { name: "b", type: "string", required: false },
      { name: "c", type: "string", required: false },
    ],
    handler: (args, ctx) => {
      const action = String(args.action).toLowerCase();

      switch (action) {
        case "create": {
          if (!args.a) return fail("Usage: /region create <id> [priorité]");
          try {
            const p1 = ctx.game?.getSelectionPos1?.(ctx.senderId) ?? getPlayerPos(ctx);
            const p2 = ctx.game?.getSelectionPos2?.(ctx.senderId) ?? getPlayerPos(ctx);
            
            const r = regions.define(args.a, args.a, p1, p2, {
              priority: parseInt(args.b, 10) || 0,
              owner: ctx.senderId,
            });

            return ok(`🗺️ Région "${r.id}" créée (${r.min.x},${r.min.y},${r.min.z} ➔ ${r.max.x},${r.max.y},${r.max.z}).`, {
              target: r.id,
              data: { regionId: r.id },
            });
          } catch (e) {
            return fail(e.message);
          }
        }

        case "redefine": {
          if (!args.a) return fail("Usage: /region redefine <id>");
          try {
            const r = regions.get(args.a);
            if (!r) return fail(`Région "${args.a}" introuvable.`);

            const p1 = ctx.game?.getSelectionPos1?.(ctx.senderId) ?? getPlayerPos(ctx);
            const p2 = ctx.game?.getSelectionPos2?.(ctx.senderId) ?? getPlayerPos(ctx);

            regions.redefineBoundaries?.(r.id, p1, p2);
            return ok(`🗺️ Région "${r.id}" redéfinie aux nouvelles coordonnées.`);
          } catch (e) {
            return fail(e.message);
          }
        }

        case "remove": {
          if (!args.a) return fail("Usage: /region remove <id>");
          return regions.remove(args.a)
            ? ok(`🗑️ Région "${args.a}" supprimée de la base de données.`, { target: args.a })
            : fail(`Région "${args.a}" introuvable.`);
        }

        case "info": {
          if (!args.a) return fail("Usage: /region info <id>");
          const r = regions.get(args.a);
          if (!r) return fail(`Région "${args.a}" introuvable.`);
          
          const flagsStr = Object.entries(r.flags)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ") || "(aucun flag configuré)";
            
          return ok(
            `🗺️ Région: ${r.name} [Priorité: ${r.priority}]\n  • Propriétaires: ${r.owners?.join(", ") || "Aucun"}\n  • Membres: ${r.members?.join(", ") || "Aucun"}\n  • Règles: ${flagsStr}`
          );
        }

        case "flag": {
          if (!args.a || !args.b || args.c === undefined) {
            return fail("Usage: /region flag <id> <flag_name> <true|false>");
          }
          const valStr = String(args.c).toLowerCase();
          const value = ["true", "1", "on", "oui"].includes(valStr);
          
          return regions.setFlag(args.a, args.b, value)
            ? ok(`🚩 Règle "${args.b}" mise à jour à [${value}] sur la région "${args.a}".`, { target: args.a })
            : fail(`Région "${args.a}" introuvable.`);
        }

        case "addmember": {
          if (!args.a || !args.b) return fail("Usage: /region addmember <id> <player_id>");
          return regions.addMember(args.a, args.b)
            ? ok(`👥 Citoyen "${args.b}" ajouté comme membre de la région "${args.a}".`, { target: args.a })
            : fail(`Région "${args.a}" introuvable.`);
        }

        case "setowner": {
          if (!args.a || !args.b) return fail("Usage: /region setowner <id> <owner_id>");
          if (typeof regions.setOwner === "function") {
            regions.setOwner(args.a, args.b);
            return ok(`👑 Propriétaire de "${args.a}" transféré à "${args.b}".`);
          }
          return fail("Fonctionnalité setowner indisponible sur ce module.");
        }

        case "list": {
          const list = regions.list();
          if (list.length === 0) return ok("Aucune parcelle ou région enregistrée.");
          return ok(`🗺️ ${list.length} région(s) active(s) : ${list.map((r) => r.id).join(", ")}`);
        }

        default:
          return fail(`Action inconnue: "${action}". Choix: create, remove, info, flag, addmember, redefine, setowner, list.`);
      }
    },
  };

  // ═════════════════════════════════════════════════════════════════
  //  OUTILS D'ÉDITION MONDE (WORLD-EDIT)
  // ═════════════════════════════════════════════════════════════════

  const pos1 = {
    name: "pos1",
    description: "Fixe la position primaire (Point A) de la sélection 3D à vos pieds.",
    category: "WorldEdit",
    level: 3, // ADMIN
    flag: "SET_TIME",
    handler: (_a, ctx) => {
      try {
        const p = getPlayerPos(ctx);
        worldEdit.session(ctx.senderId).setPos1(p);
        return ok(`📐 Point A configuré en (${p.x}, ${p.y}, ${p.z}).`);
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const pos2 = {
    name: "pos2",
    description: "Fixe la position secondaire (Point B) de la sélection 3D à vos pieds.",
    category: "WorldEdit",
    level: 3, // ADMIN
    flag: "SET_TIME",
    handler: (_a, ctx) => {
      try {
        const p = getPlayerPos(ctx);
        worldEdit.session(ctx.senderId).setPos2(p);
        return ok(`📐 Point B configuré en (${p.x}, ${p.y}, ${p.z}).`);
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const setCmd = {
    name: "set",
    description: "Remplit l'intégralité du volume de sélection 3D avec le bloc spécifié.",
    category: "WorldEdit",
    level: 3,
    flag: "SET_TIME",
    usage: "/set <block_id>",
    args: [{ name: "block", type: "string", required: true }],
    handler: (a, ctx) => {
      try {
        const sess = worldEdit.session(ctx.senderId);
        _validateSelection(sess);
        const count = sess.set(a.block);
        return ok(`🧱 Remplissage achevé : ${count} bloc(s) remplacé(s) par [${a.block}].`, { data: { count } });
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const fillCmd = {
    name: "fill",
    description: "Remplace sélectivement un matériau par un autre dans le volume.",
    category: "WorldEdit",
    level: 3,
    flag: "SET_TIME",
    usage: "/fill <block_origine> <block_destination>",
    args: [
      { name: "from", type: "string", required: true },
      { name: "to", type: "string", required: true },
    ],
    handler: (a, ctx) => {
      try {
        const sess = worldEdit.session(ctx.senderId);
        _validateSelection(sess);
        const count = sess.fill(a.from, a.to);
        return ok(`🧱 Remplacement sélectif achevé : ${count} bloc(s) [${a.from}] ➔ [${a.to}].`, { data: { count } });
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const copyCmd = {
    name: "copy",
    description: "Copie le volume tridimensionnel sélectionné dans votre presse-papier local.",
    category: "WorldEdit",
    level: 3,
    flag: "SET_TIME",
    handler: (_a, ctx) => {
      try {
        const sess = worldEdit.session(ctx.senderId);
        _validateSelection(sess);
        const count = sess.copy();
        return ok(`📋 Copie réussie : ${count} bloc(s) chargés en mémoire.`, { data: { count } });
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const pasteCmd = {
    name: "paste",
    description: "Colle les blocs en mémoire à partir de votre position de joueur.",
    category: "WorldEdit",
    level: 3,
    flag: "SET_TIME",
    handler: (_a, ctx) => {
      try {
        const sess = worldEdit.session(ctx.senderId);
        const count = sess.paste(getPlayerPos(ctx));
        return ok(`📋 Reconstruction achevée : ${count} bloc(s) écrits sur la carte.`, { data: { count } });
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const undoCmd = {
    name: "undo",
    description: "Annule instantanément votre dernière modification de blocs.",
    category: "WorldEdit",
    level: 3,
    flag: "SET_TIME",
    handler: (_a, ctx) => {
      try {
        const count = worldEdit.session(ctx.senderId).undo();
        return count > 0 
          ? ok(`↩️ Restauration réussie : ${count} modification(s) de blocs annulée(s).`) 
          : fail("Aucune opération dans la pile d'historique à annuler.");
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  // ═════════════════════════════════════════════════════════════════
  //  SYSTÈME D'ÉCONOMIE AVANCÉE (BANQUE & TAXES)
  // ═════════════════════════════════════════════════════════════════

  const bank = {
    name: "bank",
    description: "Permet de gérer son compte bancaire : balance, deposit, withdraw, transfer.",
    category: "Économie+",
    level: 1, // USER
    aliases: ["b"],
    usage: "/bank <balance|deposit|withdraw|transfer> [montant] [joueur_id]",
    args: [
      { name: "action", type: "string", required: true },
      { name: "amount", type: "number", required: false },
      { name: "target", type: "string", required: false },
    ],
    handler: (a, ctx) => {
      const action = String(a.action).toLowerCase();
      try {
        if (action === "balance" || action === "solde") {
          const b = economy.getBalance(ctx.senderId);
          return ok(`🏦 ${ctx.senderName} — Liquide: ${b.cash}$ | Compte Bancaire: ${b.bank}$ | Total: ${b.total}$`);
        }

        const amt = Number(a.amount);
        if (!Number.isFinite(amt) || amt <= 0) {
          return fail("Montant bancaire spécifié invalide ou négatif.");
        }

        if (action === "deposit") {
          const tx = economy.deposit(ctx.senderId, amt);
          return ok(`🏦 Dépôt effectué : +${tx.amount}$. Solde compte : ${tx.balanceAfter}$.`);
        }

        if (action === "withdraw") {
          const tx = economy.withdraw(ctx.senderId, amt);
          return ok(`🏦 Retrait effectué : ${tx.amount}$. Portefeuille liquide : ${tx.balanceAfter}$.`);
        }

        if (action === "transfer") {
          if (!a.target) return fail("Veuillez désigner le destinataire du virement bancaire.");
          if (ctx.senderId === a.target) return fail("Vous ne pouvez pas effectuer un virement à vous-même.");
          
          if (typeof economy.bankTransfer === "function") {
            const tx = economy.bankTransfer(ctx.senderId, a.target, amt);
            return ok(`🏦 Virement bancaire de ${amt}$ envoyé avec succès à ${a.target}.`);
          }
          return fail("Virement bancaire interne indisponible.");
        }

        return fail("Sous-commande inconnue. Choix: balance, deposit, withdraw, transfer.");
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const pay = {
    name: "pay",
    description: "Transfère du liquide de poche à un citoyen à proximité (taxe applicable).",
    category: "Économie+",
    level: 1, // USER
    usage: "/pay <joueur> <montant>",
    args: [
      { name: "player", type: "player", required: true },
      { name: "amount", type: "number", required: true },
    ],
    handler: (a, ctx) => {
      const amt = Number(a.amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return fail("Le montant à transférer doit être un nombre positif.");
      }
      if (ctx.senderId === a.player.id) {
        return fail("Opération refusée : Vous ne pouvez pas vous payer vous-même.");
      }

      try {
        const { net, tax } = economy.transfer(ctx.senderId, a.player.id, amt);
        return ok(
          `💸 Transfert liquide validé : ${a.player.name} a reçu ${net}$ (Taxe d'échange : ${tax}$).`,
          { target: a.player.name, data: { net, tax } }
        );
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const interest = {
    name: "interest",
    description: "Applique manuellement les intérêts bancaires à tous les comptes actifs.",
    category: "Économie+",
    level: 3, // ADMIN
    flag: "SET_MONEY",
    handler: () => {
      try {
        const r = economy.applyInterest();
        return ok(`📈 Cycle d'intérêts versé : +${r.totalPaid}$ d'intérêts sur ${r.accounts} compte(s) actif(s).`, {
          data: r,
        });
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const baltop = {
    name: "baltop",
    description: "Affiche le classement (Leaderboard) de la fortune globale de Portneuf.",
    category: "Économie+",
    level: 2, // MOD
    flag: "VIEW_MONEY",
    args: [{ name: "n", type: "number", default: 10 }],
    handler: (a) => {
      try {
        const limit = Number(a.n) || 10;
        const top = economy.leaderboard(limit);
        if (top.length === 0) return ok("Aucun compte actif enregistré.");
        
        const lines = top.map((t, i) => `  ${i + 1}. ${t.displayName || t.id} ➔ ${t.total}$`);
        return ok(`🏆 CLASSEMENT FORTUNE (Top ${limit}) :\n${lines.join("\n")}`);
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  const txlog = {
    name: "txlog",
    description: "Consulte l'historique complet des dernières transactions bancaires.",
    category: "Économie+",
    level: 2, // MOD
    flag: "VIEW_MONEY",
    usage: "/txlog [joueur]",
    args: [{ name: "player", type: "player", required: false }],
    handler: (a, ctx) => {
      try {
        const id = a.player ? a.player.id : ctx.senderId;
        const txs = economy.getTransactions(id, 10);
        if (txs.length === 0) return ok("Aucune transaction enregistrée.");
        
        const lines = txs.map(
          (t) => `  [${t.type.toUpperCase()}] ${t.amount >= 0 ? "+" : ""}${t.amount}$ ➔ Nouveau solde : ${t.balanceAfter}$`
        );
        return ok(`🧾 10 dernières transactions de ${id} :\n${lines.join("\n")}`);
      } catch (e) {
        return fail(e.message);
      }
    },
  };

  return [
    // Régions
    regionCmd,
    // WorldEdit
    pos1,
    pos2,
    setCmd,
    fillCmd,
    copyCmd,
    pasteCmd,
    undoCmd,
    // Économie
    bank,
    pay,
    interest,
    baltop,
    txlog,
  ];
}

export default createAdvancedCommands;
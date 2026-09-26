/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/CAREER.JS (v3.0 Platinum Edition)
 * Système de Carrière, Quarts de Travail (Gigs) & Compétences RP
 * ═══════════════════════════════════════════════════════════════════
 * Pilote le cycle de progression professionnelle :
 *  • 21+ quarts de travail répartis en 9 catégories (transport, sécurité, illégal, etc.).
 *  • Simulation dynamique d'avancement des tâches et tests de compétences à chaque tick.
 *  • Gestion de l'arbre d'expérience (XP), niveaux de carrière et réputation de faction.
 *  • Intégration d'équipements requis et outillages pour les métiers de chantier.
 *
 * Signature : TROXT⬡ · 💼CareerMatrix
 * Chemin    : client/src/game/career.js
 */

import { A40_EXITS, A40_Z, PAPETERIE, SQ_JAIL, VILLAGES } from "./worlddata-patch.js";
import { playerHasTool } from "./tools.js";
import { useGameStore } from "./store.js";

const SIG = 'TROXT⬡';

// ─── HELPER : GEL PROFOND DES STRUCTURES (ANTI-DEOPTIMIZATION V8) ────────────
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (Object.prototype.hasOwnProperty.call(obj, prop) &&
        obj[prop] !== null &&
        (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
        !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}

// ─── JSDOC TYPINGS (Autocomplétion et documentation de structure) ────────────

/**
 * @typedef {('transport' | 'commerce' | 'securite' | 'sante' | 'construction' | 'restauration' | 'illegal' | 'gouvernement' | 'media')} JobCategory
 * @typedef {(1 | 2 | 3 | 4 | 5)} JobLevel
 * @typedef {('conduite' | 'force' | 'endurance' | 'charisme' | 'technique' | 'discretion' | 'medecine' | 'cuisine')} SkillType
 * @typedef {('permis_c' | 'diplome_sante' | 'badge_police')} GigLicenseId
 *
 * @typedef {object} JobStep
 * @property {string} id
 * @property {string} description
 * @property {number} duration - Durée de l'étape en millisecondes
 * @property {{ skill: SkillType, difficulty: number }} [skillCheck]
 * @property {boolean} [canFail]
 * @property {number} [failPenalty]
 *
 * @typedef {object} JobDef
 * @property {string} id
 * @property {string} title
 * @property {JobCategory} category
 * @property {string} description
 * @property {number} reward - Paye de base (T$)
 * @property {number} bonusPerLevel
 * @property {number} xpReward
 * @property {number} durationMs
 * @property {number} cooldownMs
 * @property {JobLevel} levelRequired
 * @property {{ skill: SkillType, level: number }} [skillRequired]
 * @property {GigLicenseId} [licenseRequired]
 * @property {string[]} [toolRequired]
 * @property {JobStep[]} steps
 * @property {string} location
 * @property {[number, number, number]} locationCoords
 * @property {boolean} isIllegal
 * @property {number} [wantedOnCatch]
 * @property {string} [factionId]
 * @property {number} [factionBonus]
 *
 * @typedef {object} ActiveGig
 * @property {string} id
 * @property {string} title
 * @property {JobCategory} category
 * @property {number} reward
 * @property {number} progress - Progression globale (0..1)
 * @property {number} stepProgress - Progression de l'étape courante (0..1)
 * @property {number} currentStep - Index de l'étape courante
 * @property {JobStep[]} steps
 * @property {number} startedAt
 * @property {number} durationMs
 * @property {string} location
 * @property {boolean} isIllegal
 * @property {number} bonusMultiplier
 * @property {boolean} failed
 * @property {number} stepElapsed
 *
 * @typedef {object} PlayerSkills
 * @property {number} conduite
 * @property {number} force
 * @property {number} endurance
 * @property {number} charisme
 * @property {number} technique
 * @property {number} discretion
 * @property {number} medecine
 * @property {number} cuisine
 *
 * @typedef {object} CareerState
 * @property {number} level
 * @property {number} xp
 * @property {number} xpToNextLevel
 * @property {PlayerSkills} skills
 * @property {GigLicenseId[]} licenses
 * @property {object|null} faction
 * @property {number} jobsCompleted
 * @property {number} jobsFailed
 * @property {Record<string, number>} gigCooldowns
 * @property {object[]} jobHistory
 */

// ─── DICTIONNAIRES ET LABELS (FROZEN) ────────────────────────────────────────

export const SKILL_LABEL = Object.freeze({
  conduite: "Conduite",
  force: "Force",
  endurance: "Endurance",
  charisme: "Charisme",
  technique: "Technique",
  discretion: "Discrétion",
  medecine: "Médecine",
  cuisine: "Cuisine",
});

export const CATEGORY_LABEL = Object.freeze({
  transport: "Transport",
  commerce: "Commerce",
  securite: "Sécurité",
  sante: "Santé",
  construction: "Construction",
  restauration: "Restauration",
  illegal: "Illégal",
  gouvernement: "Gouvernement",
  media: "Média",
});

export const GIG_LICENSE_LABEL = Object.freeze({
  permis_c: "Permis classe C",
  diplome_sante: "Diplôme d'études en santé",
  badge_police: "Insigne de la Sûreté du Québec",
});

const GIG_LICENSE_IDS = Object.freeze(["permis_c", "diplome_sante", "badge_police"]);

// ─── COORDONNÉES DES EMPLACEMENTS DES QUARTS (LOC) ───────────────────────────

function getVillageCoords(id) {
  const v = VILLAGES.find((t) => t.id === id);
  return v ? [v.center[0], 0, v.center[1]] : [0, 0, 0];
}

const LOC = deepFreeze({
  portneuf:  getVillageCoords("portneuf"),
  donnacona: getVillageCoords("donnacona"),
  pont:      getVillageCoords("pont_rouge"),
  raymond:   getVillageCoords("saint_raymond"),
  alban:     getVillageCoords("saint_alban"),
  casimir:   getVillageCoords("saint_casimir"),
  cap:       getVillageCoords("cap_sante"),
  desch:     getVillageCoords("deschambault"),
  marc:      getVillageCoords("saint_marc"),
  mill:      [PAPETERIE.x, 0, PAPETERIE.z],
  sq:        [SQ_JAIL.x, 0, SQ_JAIL.z],
  a40:       [A40_EXITS[3].x, 0, A40_Z],
  quai:      [A40_EXITS[3].x, 0, 74],
});

// ─── CATALOGUE OFFICIEL DES QUARTS (DEEP FROZEN) ─────────────────────────────

export const JOB_CATALOG = deepFreeze({
  taxi: {
    id: "taxi", title: "Chauffeur de taxi", category: "transport",
    description: "Courses urbaines et rurales à travers le comté.",
    reward: 180, bonusPerLevel: 30, xpReward: 15,
    durationMs: 12000, cooldownMs: 20000, levelRequired: 1,
    location: "Portneuf Centre", locationCoords: LOC.portneuf, isIllegal: false,
    steps: [
      { id: "pickup", description: "Récupérer le client", duration: 3000 },
      { id: "drive", description: "Conduire à destination", duration: 6000, skillCheck: { skill: "conduite", difficulty: 20 } },
      { id: "payment", description: "Encaisser la course", duration: 3000 },
    ],
  },
  livreur: {
    id: "livreur", title: "Livreur express", category: "transport",
    description: "Distribution de colis prioritaires SAAQ / particuliers.",
    reward: 220, bonusPerLevel: 35, xpReward: 20,
    durationMs: 15000, cooldownMs: 25000, levelRequired: 1,
    location: "Papeterie de Donnacona", locationCoords: LOC.mill, isIllegal: false,
    steps: [
      { id: "collect", description: "Récupérer les plis et colis", duration: 2000 },
      { id: "route1", description: "Livraison secteur Nord", duration: 5000, skillCheck: { skill: "conduite", difficulty: 15 } },
      { id: "route2", description: "Livraison secteur Sud", duration: 5000 },
      { id: "confirm", description: "Signature du bon de livraison", duration: 3000 },
    ],
  },
  camionneur: {
    id: "camionneur", title: "Routier (Classe 1)", category: "transport",
    description: "Fret de bois ou matières industrielles lourdes.",
    reward: 450, bonusPerLevel: 60, xpReward: 40,
    durationMs: 30000, cooldownMs: 60000, levelRequired: 2,
    skillRequired: { skill: "conduite", level: 25 },
    licenseRequired: "permis_c",
    location: "Autoroute 40, Sortie 261", locationCoords: LOC.a40, isIllegal: false,
    steps: [
      { id: "chargement", description: "Atteler la remorque flatbed", duration: 5000 },
      { id: "route", description: "Conduire sur l'A-40 Félix-Leclerc", duration: 18000, skillCheck: { skill: "conduite", difficulty: 35 } },
      { id: "livraison", description: "Livrer et décharger la cargaison", duration: 5000 },
      { id: "rapport", description: "Rapport de pesée routière", duration: 2000 },
    ],
  },
  ambulancier: {
    id: "ambulancier", title: "Ambulancier SAMU", category: "sante",
    description: "Urgences préhospitalières du comté.",
    reward: 520, bonusPerLevel: 80, xpReward: 55,
    durationMs: 20000, cooldownMs: 30000, levelRequired: 2,
    skillRequired: { skill: "medecine", level: 30 },
    licenseRequired: "diplome_sante",
    location: "Portneuf Hôpital", locationCoords: LOC.portneuf, isIllegal: false,
    factionId: "sante_publique", factionBonus: 20,
    steps: [
      { id: "alerte", description: "Répondre à l'appel 911", duration: 2000 },
      { id: "transport", description: "Se rendre sur zone (Sirènes active)", duration: 5000, skillCheck: { skill: "conduite", difficulty: 40 } },
      { id: "soin", description: "Stabilisation & défibrillateur", duration: 8000, skillCheck: { skill: "medecine", difficulty: 45 } },
      { id: "hopital", description: "Admission aux urgences", duration: 5000 },
    ],
  },
  caissier_dep: {
    id: "caissier_dep", title: "Caissier dépanneur", category: "commerce",
    description: "Tenue du comptoir de nuit, alimentation, loto.",
    reward: 120, bonusPerLevel: 15, xpReward: 10,
    durationMs: 8000, cooldownMs: 15000, levelRequired: 1,
    location: "Dépanneur Saint-Alban", locationCoords: LOC.alban, isIllegal: false,
    steps: [
      { id: "ouverture", description: "Ouvrir la caisse", duration: 1000 },
      { id: "service", description: "Servir les clients de passage", duration: 5000, skillCheck: { skill: "charisme", difficulty: 10 } },
      { id: "fermeture", description: "Faire le dépôt de coffre", duration: 2000 },
    ],
  },
  cuisinier: {
    id: "cuisinier", title: "Cuisinier de frites", category: "restauration",
    description: "Préparation des poutines au casse-croûte Chez Gaston.",
    reward: 280, bonusPerLevel: 40, xpReward: 25,
    durationMs: 14000, cooldownMs: 20000, levelRequired: 1,
    skillRequired: { skill: "cuisine", level: 10 },
    location: "Cantine Cap-Santé", locationCoords: LOC.cap, isIllegal: false,
    steps: [
      { id: "prep", description: "Couper les patates de Portneuf", duration: 3000 },
      { id: "cuisson", description: "Cuisson de la sauce et friture", duration: 6000, skillCheck: { skill: "cuisine", difficulty: 30 } },
      { id: "dressage", description: "Assembler fromage en grain & frites", duration: 3000, skillCheck: { skill: "cuisine", difficulty: 20 } },
      { id: "service", description: "Envoyer au guichet", duration: 2000 },
    ],
  },
  hotelier: {
    id: "hotelier", title: "Réceptionniste d'hôtel", category: "commerce",
    description: "Enregistrement des voyageurs à l'Hôtel Ether Plaza.",
    reward: 200, bonusPerLevel: 25, xpReward: 18,
    durationMs: 10000, cooldownMs: 18000, levelRequired: 1,
    skillRequired: { skill: "charisme", level: 15 },
    location: "Hôtel Plaza Pont-Rouge", locationCoords: LOC.pont, isIllegal: false,
    steps: [
      { id: "accueil", description: "Accueillir le client", duration: 2000, skillCheck: { skill: "charisme", difficulty: 15 } },
      { id: "checkin", description: "Procéder à l'enregistrement", duration: 4000 },
      { id: "cle", description: "Coder la carte magnétique", duration: 2000 },
      { id: "info", description: "Indiquer l'ascenseur et le déjeuner", duration: 2000 },
    ],
  },
  femme_chambre: {
    id: "femme_chambre", title: "Préposé aux chambres", category: "commerce",
    description: "Ménage des suites et des appartements.",
    reward: 160, bonusPerLevel: 20, xpReward: 12,
    durationMs: 12000, cooldownMs: 20000, levelRequired: 1,
    location: "Hôtel Plaza Pont-Rouge", locationCoords: LOC.pont, isIllegal: false,
    steps: [
      { id: "chariot", description: "Charger les draps et savons", duration: 2000 },
      { id: "nettoyage", description: "Faire les lits et nettoyer", duration: 6000 },
      { id: "linge", description: "Remplacer les serviettes", duration: 3000 },
      { id: "rapport", description: "Vérifier le minibar", duration: 1000 },
    ],
  },
  agent_securite: {
    id: "agent_securite", title: "Garde de sécurité", category: "securite",
    description: "Rondes préventives de nuit dans le parc industriel.",
    reward: 310, bonusPerLevel: 45, xpReward: 28,
    durationMs: 16000, cooldownMs: 30000, levelRequired: 2,
    skillRequired: { skill: "force", level: 20 },
    location: "Parc Industriel Donnacona", locationCoords: LOC.donnacona, isIllegal: false,
    steps: [
      { id: "briefing", description: "Prendre les clés et la radio", duration: 2000 },
      { id: "ronde_1", description: "Ronde d'inspection extérieure", duration: 5000 },
      { id: "incident", description: "Sécuriser un cadenas brisé", duration: 5000, skillCheck: { skill: "force", difficulty: 30 }, canFail: true, failPenalty: 50 },
      { id: "rapport", description: "Fermeture des journaux de ronde", duration: 4000 },
    ],
  },
  policier: {
    id: "policier", title: "Patrouilleur de la SQ", category: "securite",
    description: "Patrouille provinciale et maintien de la paix.",
    reward: 480, bonusPerLevel: 70, xpReward: 50,
    durationMs: 25000, cooldownMs: 45000, levelRequired: 3,
    skillRequired: { skill: "force", level: 40 },
    licenseRequired: "badge_police",
    location: "Poste SQ Portneuf", locationCoords: LOC.sq, isIllegal: false,
    factionId: "spvq", factionBonus: 25,
    steps: [
      { id: "briefing", description: "Rassemblement au poste", duration: 3000 },
      { id: "patrouille", description: "Patrouille radar sur l'A-40", duration: 10000, skillCheck: { skill: "conduite", difficulty: 25 } },
      { id: "arrestation", description: "Arrêter un contrevenant", duration: 7000, skillCheck: { skill: "force", difficulty: 45 }, canFail: true },
      { id: "rapport", description: "Rédaction des rapports de saisie", duration: 5000, skillCheck: { skill: "technique", difficulty: 20 } },
    ],
  },
  ouvrier: {
    id: "ouvrier", title: "Ouvrier d'excavation", category: "construction",
    description: "Travaux d'égout et raccordements routiers.",
    reward: 260, bonusPerLevel: 35, xpReward: 22,
    durationMs: 18000, cooldownMs: 35000, levelRequired: 1,
    skillRequired: { skill: "force", level: 15 },
    toolRequired: ["marteau", "perceuse", "casque"],
    location: "Chantier Deschambault", locationCoords: LOC.desch, isIllegal: false,
    steps: [
      { id: "equip", description: "Enfiler les bottes à cap d'acier", duration: 2000 },
      { id: "material", description: "Placer la signalisation orange", duration: 5000, skillCheck: { skill: "force", difficulty: 25 } },
      { id: "travail", description: "Opérer le marteau-piqueur", duration: 8000, skillCheck: { skill: "endurance", difficulty: 30 } },
      { id: "nettoyage", description: "Ranger le chantier", duration: 3000 },
    ],
  },
  electricien: {
    id: "electricien", title: "Monteur de lignes Hydro", category: "construction",
    description: "Raccordement réseau et intervention après-verglas.",
    reward: 380, bonusPerLevel: 55, xpReward: 35,
    durationMs: 20000, cooldownMs: 40000, levelRequired: 2,
    skillRequired: { skill: "technique", level: 35 },
    toolRequired: ["tournevis", "multimetre", "pince-amperemetrique"],
    location: "Lignes Saint-Marc", locationCoords: LOC.marc, isIllegal: false,
    steps: [
      { id: "diagnostic", description: "Vérifier la tension au poteau", duration: 4000, skillCheck: { skill: "technique", difficulty: 30 } },
      { id: "materiel", description: "Prendre les fusibles 25 kV", duration: 3000 },
      { id: "reparation", description: "Raccorder le transformateur", duration: 10000, skillCheck: { skill: "technique", difficulty: 45 }, canFail: true, failPenalty: 100 },
      { id: "test", description: "Rétablir le courant", duration: 3000 },
    ],
  },
  fonctionnaire: {
    id: "fonctionnaire", title: "Fonctionnaire municipal", category: "gouvernement",
    description: "Gestion des permis et cadastre immobilier.",
    reward: 290, bonusPerLevel: 40, xpReward: 24,
    durationMs: 12000, cooldownMs: 25000, levelRequired: 2,
    skillRequired: { skill: "technique", level: 20 },
    location: "Bureau de Portneuf", locationCoords: LOC.portneuf, isIllegal: false,
    factionId: "municipalite", factionBonus: 15,
    steps: [
      { id: "tri", description: "Enregistrer les taxes scolaires", duration: 3000 },
      { id: "traitement", description: "Valider un permis de construire", duration: 6000, skillCheck: { skill: "technique", difficulty: 25 } },
      { id: "signature", description: "Sceau officiel et classement", duration: 3000 },
    ],
  },
  journaliste: {
    id: "journaliste", title: "Correspondant local", category: "media",
    description: "Faits divers et météo pour les hebdos régionaux.",
    reward: 340, bonusPerLevel: 50, xpReward: 30,
    durationMs: 18000, cooldownMs: 35000, levelRequired: 2,
    skillRequired: { skill: "charisme", level: 30 },
    location: "Pont-Rouge Hebdo", locationCoords: LOC.pont, isIllegal: false,
    steps: [
      { id: "sujet", description: "Entrevue avec un résident", duration: 3000, skillCheck: { skill: "charisme", difficulty: 20 } },
      { id: "terrain", description: "Prendre des photos du barrage", duration: 8000, skillCheck: { skill: "discretion", difficulty: 25 } },
      { id: "redaction", description: "Rédiger l'éditorial", duration: 5000, skillCheck: { skill: "technique", difficulty: 30 } },
      { id: "publication", description: "Envoyer à l'imprimerie", duration: 2000 },
    ],
  },
  mecanicien: {
    id: "mecanicien", title: "Mécanicien de rang", category: "construction",
    description: "Moteurs de pick-up, freins et carrosserie.",
    reward: 340, bonusPerLevel: 50, xpReward: 32,
    durationMs: 18000, cooldownMs: 35000, levelRequired: 1,
    skillRequired: { skill: "technique", level: 20 },
    toolRequired: ["cle", "pince", "cle-a-cliquet", "chalumeau"],
    location: "Atelier Portneuf", locationCoords: LOC.portneuf, isIllegal: false,
    steps: [
      { id: "diag", description: "Passer le scanner OBD", duration: 4000, skillCheck: { skill: "technique", difficulty: 25 } },
      { id: "piece", description: "Installer la voiture sur le pont", duration: 3000 },
      { id: "reparation", description: "Remplacer l'alternateur", duration: 8000, skillCheck: { skill: "technique", difficulty: 40 }, canFail: true, failPenalty: 80 },
      { id: "essai", description: "Essai routier sur la 138", duration: 3000, skillCheck: { skill: "conduite", difficulty: 20 } },
    ],
  },
  plombier: {
    id: "plombier", title: "Plombier", category: "construction",
    description: "Interventions d'urgence, tuyaux gelés.",
    reward: 310, bonusPerLevel: 45, xpReward: 28,
    durationMs: 16000, cooldownMs: 32000, levelRequired: 1,
    skillRequired: { skill: "technique", level: 18 },
    toolRequired: ["cle-a-tuyau", "debouchoir"],
    location: "Secteur Cap-Santé", locationCoords: LOC.cap, isIllegal: false,
    steps: [
      { id: "appel", description: "Prendre la feuille d'appel", duration: 2000 },
      { id: "fuite", description: "Souder les raccords de cuivre", duration: 4000, skillCheck: { skill: "technique", difficulty: 25 } },
      { id: "reparation", description: "Dégeler la ligne d'alimentation", duration: 7000, skillCheck: { skill: "technique", difficulty: 35 } },
      { id: "facture", description: "Encaisser le chèque", duration: 3000 },
    ],
  },
  paysagiste: {
    id: "paysagiste", title: "Paysagiste municipal", category: "construction",
    description: "Tonte et déblayage des parvis de la MRC.",
    reward: 240, bonusPerLevel: 32, xpReward: 20,
    durationMs: 15000, cooldownMs: 28000, levelRequired: 1,
    skillRequired: { skill: "endurance", level: 12 },
    toolRequired: ["pelle", "rateau", "tondeuse"],
    location: "Secteur Pont-Rouge", locationCoords: LOC.pont, isIllegal: false,
    steps: [
      { id: "chargement", description: "Charger la remorque du tracteur", duration: 3000, skillCheck: { skill: "force", difficulty: 15 } },
      { id: "tonte", description: "Tondre autour du monument", duration: 7000, skillCheck: { skill: "endurance", difficulty: 25 } },
      { id: "ratissage", description: "Déblayer le gazon coupé", duration: 3000 },
      { id: "rapport", description: "Rapport de fin de mandat", duration: 2000 },
    ],
  },

  // ─── QUARTS CLANDESTINS / ILLÉGAUX ───
  contrebandier: {
    id: "contrebandier", title: "Contrebandier", category: "illegal",
    description: "Importation clandestine au quai.",
    reward: 800, bonusPerLevel: 120, xpReward: 60,
    durationMs: 25000, cooldownMs: 90000, levelRequired: 3,
    skillRequired: { skill: "discretion", level: 40 },
    location: "Marina de Portneuf", locationCoords: LOC.quai, isIllegal: true, wantedOnCatch: 3,
    steps: [
      { id: "contact", description: "Contacter le docker corrompu", duration: 3000, skillCheck: { skill: "charisme", difficulty: 35 } },
      { id: "chargement", description: "Charger les caisses de tabac", duration: 5000, skillCheck: { skill: "discretion", difficulty: 40 } },
      { id: "transport", description: "Transporter via la gravelle", duration: 12000, skillCheck: { skill: "conduite", difficulty: 50 }, canFail: true, failPenalty: 300 },
      { id: "livraison", description: "Décharger à la grange", duration: 5000, skillCheck: { skill: "discretion", difficulty: 45 } },
    ],
  },
  pickpocket: {
    id: "pickpocket", title: "Voleur à la tire", category: "illegal",
    description: "Vol de portefeuilles au marché fermier.",
    reward: 150, bonusPerLevel: 30, xpReward: 20,
    durationMs: 8000, cooldownMs: 30000, levelRequired: 2,
    skillRequired: { skill: "discretion", level: 25 },
    location: "Marché Saint-Raymond", locationCoords: LOC.raymond, isIllegal: true, wantedOnCatch: 1,
    steps: [
      { id: "cible", description: "Repérer un touriste", duration: 2000, skillCheck: { skill: "discretion", difficulty: 30 } },
      { id: "approche", description: "Se glisser dans la foule", duration: 3000, skillCheck: { skill: "charisme", difficulty: 25 } },
      { id: "vol", description: "Soutirer le cash", duration: 3000, skillCheck: { skill: "discretion", difficulty: 50 }, canFail: true, failPenalty: 200 },
    ],
  },
  hacker: {
    id: "hacker", title: "Cyber-fraudeur", category: "illegal",
    description: "Intrusion dans les serveurs de la MRC.",
    reward: 1200, bonusPerLevel: 180, xpReward: 80,
    durationMs: 35000, cooldownMs: 120000, levelRequired: 4,
    skillRequired: { skill: "technique", level: 60 },
    location: "Maison Saint-Casimir", locationCoords: LOC.casimir, isIllegal: true, wantedOnCatch: 4,
    steps: [
      { id: "setup", description: "Lancer le scanner IP", duration: 5000, skillCheck: { skill: "technique", difficulty: 40 } },
      { id: "intrusion", description: "By-passer le pare-feu", duration: 10000, skillCheck: { skill: "technique", difficulty: 65 }, canFail: true },
      { id: "extraction", description: "Voler le registre foncier", duration: 12000, skillCheck: { skill: "technique", difficulty: 70 }, canFail: true },
      { id: "effacement", description: "Purger les logs système", duration: 8000, skillCheck: { skill: "discretion", difficulty: 55 } },
    ],
  },
  braqueur: {
    id: "braqueur", title: "Braqueur de dépanneur", category: "illegal",
    description: "Caisse du rang, après minuit.",
    reward: 600, bonusPerLevel: 100, xpReward: 50,
    durationMs: 20000, cooldownMs: 180000, levelRequired: 3,
    skillRequired: { skill: "force", level: 45 },
    location: "Dépanneur Saint-Alban", locationCoords: LOC.alban, isIllegal: true, wantedOnCatch: 5,
    steps: [
      { id: "reconnaissance", description: "Vérifier la position des caméras", duration: 4000, skillCheck: { skill: "discretion", difficulty: 35 } },
      { id: "entree", description: "Casser la vitre", duration: 3000, skillCheck: { skill: "force", difficulty: 40 } },
      { id: "caisse", description: "Forcer la caisse", duration: 8000, skillCheck: { skill: "force", difficulty: 30 } },
      { id: "fuite", description: "Fuir par la route forestière", duration: 5000, skillCheck: { skill: "conduite", difficulty: 55 }, canFail: true },
    ],
  },
  dealer: {
    id: "dealer", title: "Revendeur", category: "illegal",
    description: "Deal de rue rapide au village.",
    reward: 400, bonusPerLevel: 70, xpReward: 35,
    durationMs: 15000, cooldownMs: 60000, levelRequired: 2,
    skillRequired: { skill: "charisme", level: 30 },
    location: "Paroisse Saint-Alban", locationCoords: LOC.alban, isIllegal: true, wantedOnCatch: 3,
    steps: [
      { id: "stock", description: "Conditionner les sachets", duration: 2000 },
      { id: "client", description: "Négocier avec l'acheteur", duration: 5000, skillCheck: { skill: "charisme", difficulty: 40 } },
      { id: "transaction", description: "Échange main à main", duration: 5000, skillCheck: { skill: "discretion", difficulty: 45 }, canFail: true, failPenalty: 150 },
      { id: "disparaitre", description: "Se volatiliser dans la ruelle", duration: 3000, skillCheck: { skill: "discretion", difficulty: 30 } },
    ],
  },
});

export const DEFAULT_SKILLS = Object.freeze({
  conduite: 10, force: 10, endurance: 10, charisme: 10,
  technique: 10, discretion: 10, medecine: 10, cuisine: 10,
});

export function calcXpToNextLevel(level) {
  return Math.floor(100 * Math.pow(1.5, Math.max(1, level) - 1));
}

export function emptyCareer() {
  return {
    level: 1,
    xp: 0,
    xpToNextLevel: calcXpToNextLevel(1),
    skills: { ...DEFAULT_SKILLS },
    licenses: [],
    faction: null,
    jobsCompleted: 0,
    jobsFailed: 0,
    gigCooldowns: {},
    jobHistory: [],
  };
}

export function parseCareer(raw) {
  const base = emptyCareer();
  if (!raw || typeof raw !== "object") return base;
  const d = raw;
  const skills = { ...DEFAULT_SKILLS };
  if (d.skills && typeof d.skills === "object") {
    const keys = Object.keys(DEFAULT_SKILLS);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const n = d.skills[k];
      if (typeof n === "number") skills[k] = Math.max(0, Math.min(100, n));
    }
  }
  const licenses = Array.isArray(d.licenses)
    ? d.licenses.filter((id) => GIG_LICENSE_IDS.includes(id))
    : [];
  const level = typeof d.level === "number" ? Math.max(1, Math.min(20, Math.floor(d.level))) : 1;
  return {
    level,
    xp: typeof d.xp === "number" ? Math.max(0, d.xp) : 0,
    xpToNextLevel: calcXpToNextLevel(level),
    skills,
    licenses,
    faction: d.faction && typeof d.faction === "object" ? d.faction : null,
    jobsCompleted: typeof d.jobsCompleted === "number" ? d.jobsCompleted : 0,
    jobsFailed: typeof d.jobsFailed === "number" ? d.jobsFailed : 0,
    gigCooldowns: d.gigCooldowns && typeof d.gigCooldowns === "object" ? d.gigCooldowns : {},
    jobHistory: Array.isArray(d.jobHistory) ? d.jobHistory.slice(0, 40) : [],
  };
}

export function gigById(id) {
  return JOB_CATALOG[id];
}

export function allGigs() {
  return Object.values(JOB_CATALOG);
}

export function gigsByCategory(cat) {
  return allGigs().filter((j) => j.category === cat);
}

export function nearGig(def, x, z, radius = 48) {
  const [lx, , lz] = def.locationCoords;
  return Math.hypot(x - lx, z - lz) < radius;
}

export function nearestGig(x, z, max = 48) {
  let best = null;
  let bestD = max;
  const list = allGigs();
  for (let i = 0; i < list.length; i++) {
    const job = list[i];
    const [lx, , lz] = job.locationCoords;
    const d = Math.hypot(x - lx, z - lz);
    if (d < bestD) {
      best = job;
      bestD = d;
    }
  }
  return best;
}

export function canStartGig(career, jobId, active, inventory, equippedTool) {
  return getCannotStartReason(career, jobId, active, Date.now(), inventory, equippedTool) === null;
}

export function getJobCooldownSec(career, jobId, now = Date.now()) {
  const cd = career.gigCooldowns[jobId];
  if (!cd) return 0;
  return Math.max(0, Math.ceil((cd - now) / 1000));
}

export function getCannotStartReason(career, jobId, active, now = Date.now(), inventory, equippedTool) {
  if (active) return "Un quart de travail est déjà en cours";
  const cd = career.gigCooldowns[jobId];
  if (cd && now < cd) return `Disponible dans ${getJobCooldownSec(career, jobId, now)} s`;
  const def = JOB_CATALOG[jobId];
  if (!def) return "Quart introuvable";
  if (career.level < def.levelRequired) return `Niveau ${def.levelRequired} requis`;
  if (def.skillRequired && career.skills[def.skillRequired.skill] < def.skillRequired.level) {
    return `${SKILL_LABEL[def.skillRequired.skill]} de niveau ${def.skillRequired.level} requis`;
  }
  if (def.licenseRequired && !career.licenses.includes(def.licenseRequired)) {
    return `${GIG_LICENSE_LABEL[def.licenseRequired]} requis`;
  }
  if (def.toolRequired?.length && inventory) {
    if (!playerHasTool(inventory, equippedTool ?? null, def.toolRequired)) {
      return `Outil de travail requis · ${def.toolRequired[0]}`;
    }
  }
  return null;
}

export function makeActiveGig(career, def) {
  let bonus = 1;
  if (career.faction?.factionId === def.factionId && def.factionBonus) {
    bonus += def.factionBonus / 100;
  }
  bonus += (career.level - 1) * 0.05;
  const skill = def.skillRequired?.skill ?? "endurance";
  const finalReward = Math.round((def.reward + def.bonusPerLevel * (career.skills[skill] / 10)) * bonus);
  return {
    id: def.id,
    title: def.title,
    category: def.category,
    reward: finalReward,
    progress: 0,
    stepProgress: 0,
    currentStep: 0,
    steps: def.steps,
    startedAt: Date.now(),
    durationMs: def.durationMs,
    location: def.location,
    isIllegal: def.isIllegal,
    bonusMultiplier: bonus,
    failed: false,
    stepElapsed: 0,
  };
}

export function tickActiveGig(gig, dt, skills) {
  const def = JOB_CATALOG[gig.id];
  if (!def) return { kind: "done", gig };
  const step = def.steps[gig.currentStep];
  if (!step) return { kind: "done", gig };
  const ms = dt * 1000;
  gig.stepElapsed += ms;
  gig.stepProgress = Math.min(1, gig.stepElapsed / step.duration);
  const done = gig.steps.slice(0, gig.currentStep).reduce((a, s) => a + s.duration, 0) + gig.stepElapsed;
  gig.progress = Math.min(1, done / Math.max(1, def.durationMs));
  if (gig.stepElapsed < step.duration) return { kind: "none", gig };

  if (step.skillCheck) {
    const playerSkill = skills[step.skillCheck.skill];
    const chance = Math.min(95, (playerSkill / step.skillCheck.difficulty) * 80);
    const success = Math.random() * 100 <= chance;
    if (!success && step.canFail) {
      gig.failed = true;
      return {
        kind: "fail",
        gig,
        wanted: def.isIllegal ? def.wantedOnCatch : undefined,
        penalty: step.failPenalty,
      };
    }
    gig.currentStep += 1;
    gig.stepElapsed = 0;
    gig.stepProgress = 0;
    if (gig.currentStep >= def.steps.length) return { kind: "done", gig };
    return { kind: "step", gig, skill: step.skillCheck.skill };
  }

  gig.currentStep += 1;
  gig.stepElapsed = 0;
  gig.stepProgress = 0;
  if (gig.currentStep >= def.steps.length) return { kind: "done", gig };
  return { kind: "step", gig };
}

export function applyXp(career, amount) {
  let xp = career.xp + amount;
  let level = career.level;
  let next = career.xpToNextLevel;
  let leveled = false;
  while (xp >= next && level < 20) {
    xp -= next;
    level += 1;
    next = calcXpToNextLevel(level);
    leveled = true;
  }
  return { career: { ...career, xp, level, xpToNextLevel: next }, leveled };
}

export function bumpSkill(skills, skill, amount) {
  return { ...skills, [skill]: Math.min(100, skills[skill] + amount) };
}

export function grantGigLicense(list, id) {
  return list.includes(id) ? list : [...list, id];
}

export function joinCareerFaction(id, name) {
  return { factionId: id, name, rank: 0, joinedAt: Date.now(), contribution: 0 };
}

export function addContribution(faction, amount) {
  const contribution = faction.contribution + amount;
  const thresholds = [0, 100, 300, 600, 1000, 2000];
  const rank = Math.min(5, thresholds.filter((t) => contribution >= t).length - 1);
  return { ...faction, contribution, rank };
}

export function currentStep(gig) {
  return gig.steps[gig.currentStep];
}

export const SIG = "TROXT⬡";

export default {
  JOB_CATALOG,
  DEFAULT_SKILLS,
  calcXpToNextLevel,
  emptyCareer,
  parseCareer,
  gigById,
  allGigs,
  gigsByCategory,
  nearGig,
  nearestGig,
  canStartGig,
  getJobCooldownSec,
  getCannotStartReason,
  makeActiveGig,
  tickActiveGig,
  applyXp,
  bumpSkill,
  grantGigLicense,
  joinCareerFaction,
  addContribution,
  currentStep,
  SIG
};
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql, eq } from "drizzle-orm";
import * as schema from "../schema";
import {
  jobs, jobGrades, garages, items, contracts, scheduledTasks,
  surfacePhysics, zoneConfig, zoneBounds, spawnPoints,
  JOB_SEEDS,
} from "../schema";

// ═══════════════════════════════════════════════════════════════════════════
//  SEED
//  database/drizzle/seed/index.ts
//
//  Remplit les tables de référence au premier démarrage. Sans lui, la base
//  est vide et rien ne fonctionne : pas de métier à assigner, pas de garage
//  où sortir un véhicule, pas d'objet à donner.
//
//  IDEMPOTENT
//  ──────────
//  Le script peut être relancé sans casser quoi que ce soit. Chaque
//  insertion utilise `onConflictDoUpdate` : les nouvelles valeurs écrasent
//  les anciennes, mais les identifiants restent et les clés étrangères
//  tiennent.
//
//  C'est ce qui permet d'ajuster un salaire ou un prix dans ce fichier,
//  relancer, et voir le changement sans perdre les personnages.
//
//  Usage :
//    pnpm tsx database/drizzle/seed/index.ts
//    pnpm tsx database/drizzle/seed/index.ts --only=items,jobs
//    pnpm tsx database/drizzle/seed/index.ts --reset      (⚠ vide tout)
// ═══════════════════════════════════════════════════════════════════════════

/* ══════════════════════════════════════════════════════════════ */
/*  SURFACES                                                      */
/* ══════════════════════════════════════════════════════════════ */

const SURFACES = [
  {
    surfaceKey: "asphalt" as const, displayName: "Asphalte",
    tractionMultiplier: 1.0, lateralGrip: 1.0, rollingResistance: 0.013,
    slipThreshold: 95, gripRecovery: 4.5, bumpiness: 0.05,
    walkSpeedMultiplier: 1.0, heavyVehiclePenalty: 1.0,
    particleType: "none", particleColor: "#8a7a62", particleRate: 0,
    leavesTracks: false, trackOpacity: 0,
    tireSound: "tire_asphalt", footstepSound: "step_concrete",
  },
  {
    surfaceKey: "gravel" as const, displayName: "Gravelle",
    // La Route des Lacs. On accélère encore, mais l'arrière part en virage.
    tractionMultiplier: 0.72, lateralGrip: 0.48, rollingResistance: 0.032,
    slipThreshold: 48, gripRecovery: 1.8, bumpiness: 0.55,
    walkSpeedMultiplier: 0.94, heavyVehiclePenalty: 0.85,
    particleType: "dust", particleColor: "#a89880", particleRate: 1.4,
    leavesTracks: true, trackOpacity: 0.55,
    tireSound: "tire_gravel", footstepSound: "step_gravel",
  },
  {
    surfaceKey: "dirt" as const, displayName: "Terre battue",
    tractionMultiplier: 0.62, lateralGrip: 0.55, rollingResistance: 0.04,
    slipThreshold: 42, gripRecovery: 2.2, bumpiness: 0.7,
    walkSpeedMultiplier: 0.9, heavyVehiclePenalty: 0.7,
    particleType: "dust", particleColor: "#8a7a5c", particleRate: 1.1,
    leavesTracks: true, trackOpacity: 0.65,
    tireSound: "tire_dirt", footstepSound: "step_dirt",
  },
  {
    surfaceKey: "sand" as const, displayName: "Sable",
    // La plage. On s'enlise sans jamais glisser — l'inverse de la gravelle.
    tractionMultiplier: 0.3, lateralGrip: 0.62, rollingResistance: 0.11,
    slipThreshold: 25, gripRecovery: 1.2, bumpiness: 0.35,
    walkSpeedMultiplier: 0.72, heavyVehiclePenalty: 0.4,
    particleType: "sand", particleColor: "#d8c8a4", particleRate: 1.8,
    leavesTracks: true, trackOpacity: 0.75,
    tireSound: "tire_sand", footstepSound: "step_sand",
  },
  {
    surfaceKey: "grass" as const, displayName: "Herbe",
    tractionMultiplier: 0.58, lateralGrip: 0.5, rollingResistance: 0.05,
    slipThreshold: 38, gripRecovery: 2.0, bumpiness: 0.4,
    walkSpeedMultiplier: 0.95, heavyVehiclePenalty: 0.65,
    particleType: "grass", particleColor: "#5a7a42", particleRate: 0.8,
    leavesTracks: true, trackOpacity: 0.3,
    tireSound: "tire_grass", footstepSound: "step_grass",
  },
  {
    surfaceKey: "snow" as const, displayName: "Neige",
    tractionMultiplier: 0.42, lateralGrip: 0.32, rollingResistance: 0.055,
    slipThreshold: 30, gripRecovery: 1.0, bumpiness: 0.25,
    walkSpeedMultiplier: 0.78, heavyVehiclePenalty: 0.6,
    particleType: "snow", particleColor: "#e8f0f8", particleRate: 1.6,
    leavesTracks: true, trackOpacity: 0.8,
    tireSound: "tire_snow", footstepSound: "step_snow",
  },
  {
    surfaceKey: "ice" as const, displayName: "Glace noire",
    // Le cauchemar de la 138 en février.
    tractionMultiplier: 0.18, lateralGrip: 0.12, rollingResistance: 0.008,
    slipThreshold: 14, gripRecovery: 0.4, bumpiness: 0.05,
    walkSpeedMultiplier: 0.6, heavyVehiclePenalty: 0.5,
    particleType: "none", particleColor: "#dce8f0", particleRate: 0,
    leavesTracks: false, trackOpacity: 0,
    tireSound: "tire_ice", footstepSound: "step_ice",
  },
  {
    surfaceKey: "mud" as const, displayName: "Boue",
    tractionMultiplier: 0.35, lateralGrip: 0.4, rollingResistance: 0.09,
    slipThreshold: 22, gripRecovery: 1.4, bumpiness: 0.8,
    walkSpeedMultiplier: 0.68, heavyVehiclePenalty: 0.35,
    particleType: "mud", particleColor: "#5a4a34", particleRate: 2.0,
    leavesTracks: true, trackOpacity: 0.85,
    tireSound: "tire_mud", footstepSound: "step_mud",
  },
];

/* ══════════════════════════════════════════════════════════════ */
/*  OBJETS                                                        */
/* ══════════════════════════════════════════════════════════════ */

type ItemSeed = typeof items.$inferInsert;

const ITEMS: ItemSeed[] = [
  /* ── Nourriture ────────────────────────────────────────────── */
  { id: "pain", label: "Pain", type: "food", weight: 0.5, basePrice: 4, sellPrice: 2,
    effects: { hunger: 22 }, icon: "bread",
    description: "Miche de boulangerie. Se garde deux jours." },
  { id: "poutine", label: "Poutine", type: "food", weight: 0.7, basePrice: 12, sellPrice: 5,
    effects: { hunger: 48, energy: 8 }, icon: "poutine",
    description: "Frites, fromage en grains, sauce brune. Le fromage doit couiner." },
  { id: "sandwich", label: "Sandwich", type: "food", weight: 0.3, basePrice: 8, sellPrice: 3,
    effects: { hunger: 30 }, icon: "sandwich" },
  { id: "tourtiere", label: "Tourtière", type: "food", weight: 1.2, basePrice: 18, sellPrice: 8,
    effects: { hunger: 62, energy: 6 }, icon: "pie",
    description: "Tourtière du Lac. Meilleure le lendemain." },
  { id: "feve_lard", label: "Fèves au lard", type: "food", weight: 0.6, basePrice: 9, sellPrice: 4,
    effects: { hunger: 40 }, icon: "beans" },
  { id: "sirop", label: "Sirop d'érable", type: "food", weight: 1.4, basePrice: 32, sellPrice: 22,
    stackable: true, maxStack: 12, effects: { hunger: 14, energy: 18 },
    rarity: "uncommon", icon: "syrup",
    description: "Conserve de 540 ml. Grade ambré, goût riche." },
  { id: "tire_erable", label: "Tire d'érable", type: "food", weight: 0.1, basePrice: 5, sellPrice: 2,
    effects: { hunger: 10, energy: 22 }, icon: "taffy",
    description: "Sur la neige, roulée sur un bâton." },

  /* ── Boisson ───────────────────────────────────────────────── */
  { id: "eau", label: "Bouteille d'eau", type: "drink", weight: 0.5, basePrice: 3, sellPrice: 1,
    effects: { thirst: 35 }, icon: "water" },
  { id: "cafe", label: "Café", type: "drink", weight: 0.3, basePrice: 3, sellPrice: 1,
    effects: { thirst: 18, energy: 26, bodyTemp: 0.4 }, icon: "coffee",
    description: "Format moyen, deux crèmes." },
  { id: "biere", label: "Bière", type: "drink", weight: 0.4, basePrice: 6, sellPrice: 3,
    effects: { thirst: 20, stress: -12 }, icon: "beer",
    requiredLicense: null },
  { id: "caribou", label: "Caribou", type: "drink", weight: 0.5, basePrice: 14, sellPrice: 7,
    effects: { thirst: 12, stress: -25, bodyTemp: 0.8 }, rarity: "uncommon", icon: "flask",
    description: "Vin rouge, alcool fort, sirop. Réchauffe au Carnaval." },

  /* ── Médical ───────────────────────────────────────────────── */
  { id: "bandage", label: "Bandage", type: "medical", weight: 0.1, basePrice: 15, sellPrice: 6,
    effects: { health: 25 }, icon: "bandage" },
  { id: "trousse", label: "Trousse de premiers soins", type: "medical", weight: 1.2,
    basePrice: 85, sellPrice: 35, effects: { health: 65 }, rarity: "uncommon", icon: "medkit" },
  { id: "analgesique", label: "Analgésique", type: "medical", weight: 0.05, basePrice: 22,
    sellPrice: 8, effects: { health: 12, stress: -18 }, icon: "pills" },
  { id: "couverture", label: "Couverture de survie", type: "medical", weight: 0.3,
    basePrice: 28, sellPrice: 12, effects: { bodyTemp: 1.6 }, icon: "blanket",
    description: "Aluminisée. Retient la chaleur corporelle." },

  /* ── Outils ────────────────────────────────────────────────── */
  { id: "marteau", label: "Marteau", type: "tool", weight: 1.1, basePrice: 28, sellPrice: 12,
    hasDurability: true, maxDurability: 200, icon: "hammer" },
  { id: "pelle", label: "Pelle", type: "tool", weight: 2.4, basePrice: 42, sellPrice: 18,
    hasDurability: true, maxDurability: 180, icon: "shovel" },
  { id: "hache", label: "Hache", type: "tool", weight: 2.2, basePrice: 68, sellPrice: 30,
    hasDurability: true, maxDurability: 250, icon: "axe" },
  { id: "scie_chaine", label: "Scie à chaîne", type: "tool", weight: 6.5, basePrice: 420,
    sellPrice: 180, hasDurability: true, maxDurability: 400, rarity: "uncommon", icon: "chainsaw" },
  { id: "cle_anglaise", label: "Clé anglaise", type: "tool", weight: 0.9, basePrice: 34,
    sellPrice: 14, hasDurability: true, maxDurability: 300, icon: "wrench" },
  { id: "canne_peche", label: "Canne à pêche", type: "tool", weight: 1.0, basePrice: 78,
    sellPrice: 32, hasDurability: true, maxDurability: 220, icon: "rod",
    requiredLicense: "PECHE" },
  { id: "crochet", label: "Crochet", type: "tool", weight: 0.05, basePrice: 0, sellPrice: 45,
    isIllegal: true, hasDurability: true, maxDurability: 8, rarity: "rare", icon: "lockpick",
    description: "Se brise vite. Se trouve pas en magasin." },

  /* ── Matériaux ─────────────────────────────────────────────── */
  { id: "bois", label: "Bois", type: "material", weight: 2.0, basePrice: 8, sellPrice: 5,
    maxStack: 200, icon: "log" },
  { id: "planche", label: "Planche", type: "material", weight: 1.2, basePrice: 14,
    sellPrice: 9, maxStack: 200, icon: "plank" },
  { id: "clou", label: "Clous", type: "material", weight: 0.02, basePrice: 1, sellPrice: 0,
    maxStack: 500, icon: "nail" },
  { id: "acier", label: "Acier", type: "material", weight: 3.5, basePrice: 26, sellPrice: 16,
    maxStack: 100, icon: "steel" },
  { id: "beton", label: "Béton", type: "material", weight: 5.0, basePrice: 18, sellPrice: 11,
    maxStack: 100, icon: "concrete" },
  { id: "isolant", label: "Isolant", type: "material", weight: 0.8, basePrice: 22,
    sellPrice: 13, maxStack: 150, icon: "insulation" },
  { id: "essence_bidon", label: "Bidon d'essence", type: "material", weight: 15,
    basePrice: 35, sellPrice: 18, maxStack: 4, icon: "jerrycan" },

  /* ── Munitions ─────────────────────────────────────────────── */
  { id: "ammo_22", label: "Cartouches .22", type: "ammo", weight: 0.01, basePrice: 14,
    sellPrice: 6, maxStack: 500, requiredLicense: "PAA", icon: "ammo" },
  { id: "ammo_12", label: "Cartouches calibre 12", type: "ammo", weight: 0.04,
    basePrice: 28, sellPrice: 12, maxStack: 250, requiredLicense: "PAA", icon: "shell" },
  { id: "ammo_308", label: "Cartouches .308", type: "ammo", weight: 0.03, basePrice: 45,
    sellPrice: 20, maxStack: 200, requiredLicense: "PAA", icon: "ammo" },
  { id: "ammo_9mm", label: "Cartouches 9 mm", type: "ammo", weight: 0.012, basePrice: 32,
    sellPrice: 15, maxStack: 300, requiredLicense: "PPA_R", icon: "ammo" },
  { id: "ammo_556", label: "Cartouches 5,56", type: "ammo", weight: 0.015, basePrice: 105,
    sellPrice: 60, maxStack: 300, isIllegal: true, rarity: "rare", icon: "ammo" },

  /* ── Documents ─────────────────────────────────────────────── */
  { id: "permis_conduire", label: "Permis de conduire", type: "document", weight: 0.01,
    basePrice: 0, sellPrice: 0, stackable: false, tradeable: false, icon: "card" },
  { id: "carte_assurance", label: "Carte d'assurance", type: "document", weight: 0.01,
    basePrice: 0, sellPrice: 0, stackable: false, tradeable: false, icon: "card" },
  { id: "contrat", label: "Contrat", type: "document", weight: 0.02, basePrice: 0,
    sellPrice: 0, stackable: false, icon: "paper" },

  /* ── Divers ────────────────────────────────────────────────── */
  { id: "telephone", label: "Téléphone", type: "misc", weight: 0.2, basePrice: 480,
    sellPrice: 180, stackable: false, hasDurability: true, maxDurability: 100, icon: "phone" },
  { id: "radio_portative", label: "Radio portative", type: "misc", weight: 0.4,
    basePrice: 220, sellPrice: 90, stackable: false, icon: "radio" },
  { id: "lampe_poche", label: "Lampe de poche", type: "misc", weight: 0.3, basePrice: 34,
    sellPrice: 14, hasDurability: true, maxDurability: 150, icon: "flashlight" },
  { id: "corde", label: "Corde", type: "misc", weight: 1.8, basePrice: 26, sellPrice: 11,
    maxStack: 20, icon: "rope" },
  { id: "billet_loterie", label: "Billet de loterie", type: "misc", weight: 0.005,
    basePrice: 5, sellPrice: 0, maxStack: 50, icon: "ticket" },
];

/* ══════════════════════════════════════════════════════════════ */
/*  GARAGES                                                       */
/* ══════════════════════════════════════════════════════════════ */

type GarageSeed = typeof garages.$inferInsert;

const GARAGES: GarageSeed[] = [
  { id: "gar_portneuf", name: "Garage municipal de Portneuf", village: "Portneuf",
    posX: 8600, posZ: -80, exitX: 8615, exitZ: -60, exitHeading: 1.57,
    capacity: 24, kind: "public", retrievalFee: 0 },
  { id: "gar_donnacona", name: "Garage de Donnacona", village: "Donnacona",
    posX: 6200, posZ: -110, exitX: 6218, exitZ: -92, exitHeading: 0,
    capacity: 24, kind: "public", retrievalFee: 0 },
  { id: "gar_st_raymond", name: "Garage de Saint-Raymond", village: "Saint-Raymond",
    posX: 4100, posZ: -1400, exitX: 4118, exitZ: -1382, exitHeading: 3.14,
    capacity: 18, kind: "public", retrievalFee: 0 },
  { id: "gar_st_casimir", name: "Garage de Saint-Casimir", village: "Saint-Casimir",
    posX: 1200, posZ: -900, exitX: 1216, exitZ: -884, exitHeading: 0.78,
    capacity: 16, kind: "public", retrievalFee: 0 },
  { id: "gar_st_marc", name: "Garage de Saint-Marc", village: "Saint-Marc-des-Carrières",
    posX: 2400, posZ: -300, exitX: 2418, exitZ: -284, exitHeading: 1.57,
    capacity: 16, kind: "public", retrievalFee: 0 },
  { id: "gar_neuville", name: "Garage de Neuville", village: "Neuville",
    posX: 11200, posZ: -60, exitX: 11216, exitZ: -44, exitHeading: 0,
    capacity: 14, kind: "public", retrievalFee: 0 },
  { id: "gar_pont_rouge", name: "Garage de Pont-Rouge", village: "Pont-Rouge",
    posX: 9400, posZ: -700, exitX: 9418, exitZ: -684, exitHeading: 2.35,
    capacity: 20, kind: "public", retrievalFee: 0 },
  { id: "gar_st_alban", name: "Garage de Saint-Alban", village: "Saint-Alban",
    posX: -3200, posZ: -2400, exitX: -3182, exitZ: -2384, exitHeading: 0.9,
    capacity: 12, kind: "public", retrievalFee: 0 },

  /* ── Garages de service ────────────────────────────────────── */
  { id: "gar_sq", name: "Poste de la SQ — garage", village: "Portneuf",
    posX: 8560, posZ: -140, exitX: 8578, exitZ: -122, exitHeading: 1.57,
    capacity: 16, kind: "job", restrictedToJob: "sq", retrievalFee: 0 },
  { id: "gar_ambulance", name: "Caserne ambulancière", village: "Donnacona",
    posX: 6160, posZ: -160, exitX: 6178, exitZ: -142, exitHeading: 0,
    capacity: 10, kind: "job", restrictedToJob: "ambulancier", retrievalFee: 0 },
  { id: "gar_pompier", name: "Caserne de pompiers", village: "Donnacona",
    posX: 6120, posZ: -160, exitX: 6138, exitZ: -142, exitHeading: 0,
    capacity: 8, kind: "job", restrictedToJob: "pompier", retrievalFee: 0 },
  { id: "gar_municipal", name: "Cour municipale", village: "Portneuf",
    posX: 8520, posZ: -200, exitX: 8538, exitZ: -182, exitHeading: 1.57,
    capacity: 12, kind: "job", restrictedToJob: "municipal", retrievalFee: 0 },

  /* ── Fourrière ─────────────────────────────────────────────── */
  { id: "fourriere_portneuf", name: "Fourrière du comté", village: "Portneuf",
    posX: 8700, posZ: -260, exitX: 8720, exitZ: -240, exitHeading: 1.57,
    capacity: 60, kind: "fourriere", retrievalFee: 350 },
];

/* ══════════════════════════════════════════════════════════════ */
/*  CONTRATS DE VALIDATION                                        */
/* ══════════════════════════════════════════════════════════════ */

type ContractSeed = typeof contracts.$inferInsert;

const CONTRACTS: ContractSeed[] = [
  {
    name: "character.save", version: 1, strict: true,
    description: "Sauvegarde d'un personnage depuis le créateur",
    schema: {
      type: "object",
      required: ["firstName", "lastName", "gender", "appearance"],
      properties: {
        firstName: { type: "string", minLength: 2, maxLength: 32 },
        lastName: { type: "string", minLength: 2, maxLength: 32 },
        gender: { enum: ["male", "female"] },
        appearance: { type: "object" },
      },
    },
  },
  {
    name: "player.move", version: 1, strict: true,
    description: "Position du joueur — validée à chaque paquet",
    schema: {
      type: "array",
      minItems: 6, maxItems: 7,
      items: { type: "number" },
    },
  },
  {
    name: "economy.transfer", version: 1, strict: true,
    description: "Virement entre joueurs",
    schema: {
      type: "object",
      required: ["targetId", "amount"],
      properties: {
        targetId: { type: "string", maxLength: 80 },
        amount: { type: "integer", minimum: 1, maximum: 10_000_000 },
        account: { enum: ["cash", "bank"] },
        note: { type: "string", maxLength: 120 },
      },
    },
  },
  {
    name: "vehicle.spawn", version: 1, strict: true,
    description: "Sortie d'un véhicule du garage",
    schema: {
      type: "object",
      required: ["vehicleId", "garageId"],
      properties: {
        vehicleId: { type: "string", maxLength: 80 },
        garageId: { type: "string", maxLength: 80 },
      },
    },
  },
  {
    name: "business.create", version: 1, strict: true,
    description: "Fondation d'une entreprise",
    schema: {
      type: "object",
      required: ["type", "tradeName", "village"],
      properties: {
        type: { type: "string" },
        tradeName: { type: "string", minLength: 3, maxLength: 64 },
        legalName: { type: "string", maxLength: 120 },
        village: { type: "string", maxLength: 64 },
      },
    },
  },
  {
    name: "chat.message", version: 1, strict: true,
    description: "Message de chat",
    schema: {
      type: "object",
      required: ["channel", "text"],
      properties: {
        channel: { type: "integer", minimum: 0, maximum: 7 },
        text: { type: "string", minLength: 1, maxLength: 512 },
        frequency: { type: "number", minimum: 0, maximum: 999.9 },
      },
    },
  },
];

/* ══════════════════════════════════════════════════════════════ */
/*  TÂCHES PLANIFIÉES                                             */
/* ══════════════════════════════════════════════════════════════ */

type TaskSeed = typeof scheduledTasks.$inferInsert;

const TASKS: TaskSeed[] = [
  { taskKey: "payroll", name: "Versement des paies", handler: "economy.payroll",
    intervalMs: 600_000, enabled: true },
  { taskKey: "rent", name: "Perception des loyers", handler: "properties.collectRent",
    cron: "0 4 * * 1", enabled: true },
  { taskKey: "taxes", name: "Taxes foncières", handler: "properties.collectTaxes",
    cron: "0 5 * * 1", enabled: true },
  { taskKey: "utilities", name: "Facturation des services", handler: "properties.billUtilities",
    cron: "0 6 * * 1", enabled: true },
  { taskKey: "insurance", name: "Primes d'assurance", handler: "vehicles.chargeInsurance",
    cron: "0 7 * * 1", enabled: true },
  { taskKey: "loans", name: "Versements de prêts", handler: "economy.collectLoans",
    cron: "0 8 * * 1", enabled: true },
  { taskKey: "decay", name: "Dégradation des bâtiments", handler: "properties.decay",
    cron: "0 3 * * *", enabled: true },
  { taskKey: "money_supply", name: "Instantané monétaire", handler: "economy.snapshotSupply",
    intervalMs: 3_600_000, enabled: true },
  { taskKey: "memory_decay", name: "Oubli des PNJ", handler: "npc.forgetExpired",
    intervalMs: 300_000, enabled: true },
  { taskKey: "rumors", name: "Diffusion des rumeurs", handler: "npc.deliverRumors",
    intervalMs: 60_000, enabled: true },
  { taskKey: "snapshot", name: "Instantané du monde", handler: "world.snapshot",
    intervalMs: 900_000, enabled: true },
  { taskKey: "retention", name: "Purge des journaux", handler: "db.prune",
    cron: "0 2 * * *", enabled: true },
  { taskKey: "impound_fees", name: "Frais de fourrière", handler: "vehicles.accrueImpound",
    cron: "0 1 * * *", enabled: true },
  { taskKey: "market_candles", name: "Cours du marché", handler: "economy.buildCandles",
    cron: "5 0 * * *", enabled: true },
];

/* ══════════════════════════════════════════════════════════════ */
/*  ZONES DE SAINT-ALBAN                                          */
/*  Les autres villages s'ajoutent sur le même modèle.             */
/* ══════════════════════════════════════════════════════════════ */

const CX = -3200, CZ = -2400;

const ZONES = [
  {
    config: {
      zoneName: "Village_StAlban", displayName: "Village de Saint-Alban",
      village: "Saint-Alban", kind: "village" as const,
      roadSurface: "asphalt" as const, speedLimit: 50,
      npcDensity: 0.8, pedestrianDensity: 0.7, wildlifeDensity: 0,
      trafficMix: { voiture: 0.45, pickup: 0.3, tracteur: 0.15, camion: 0.1 },
      ambientSound: "ambient_village_qc", ambientVolume: 0.55,
      fogDensity: 0.0015, fogColor: "#0a1020",
      policeResponseSeconds: 480, priority: 5,
    },
    bounds: [{ shapeType: "circle" as const, centerX: CX, centerZ: CZ, radius: 280 }],
  },
  {
    config: {
      zoneName: "Route_Des_Lacs", displayName: "Route des Lacs",
      village: "Saint-Alban", kind: "rural" as const,
      roadSurface: "gravel" as const, speedLimit: 60,
      npcDensity: 0.4, pedestrianDensity: 0.05, wildlifeDensity: 0.9,
      trafficMix: { pickup: 0.45, vr: 0.25, voiture: 0.2, camion_bois: 0.1 },
      ambientSound: "ambient_foret", ambientVolume: 0.7,
      fogDensity: 0.0028, fogColor: "#0a1614",
      policeResponseSeconds: 720, priority: 6,
    },
    bounds: [{
      shapeType: "corridor" as const, corridorWidth: 26,
      pathPoints: [
        [CX + 12, CZ - 58], [CX + 60, CZ - 195], [CX + 96, CZ - 340],
        [CX + 118, CZ - 490], [CX + 132, CZ - 640], [CX + 158, CZ - 790],
        [CX + 190, CZ - 930],
      ] as [number, number][],
    }],
  },
  {
    config: {
      zoneName: "Plage_Carillon", displayName: "Plage du lac Carillon",
      village: "Saint-Alban", kind: "recreatif" as const,
      roadSurface: "sand" as const, speedLimit: 15,
      npcDensity: 1.3, pedestrianDensity: 1.6, wildlifeDensity: 0.2,
      trafficMix: { voiture: 0.6, vr: 0.4 },
      ambientSound: "ambient_plage_lac", ambientVolume: 0.75,
      fogDensity: 0.0011, fogColor: "#0c1826",
      policeResponseSeconds: 660, allowVehicleSpawn: false,
      isSafeZone: true, priority: 8,
    },
    bounds: [{
      shapeType: "circle" as const,
      centerX: CX + 190, centerZ: CZ - 930, radius: 150,
    }],
  },
  {
    config: {
      zoneName: "Eboulis_1894", displayName: "Éboulis du 27 avril 1894",
      village: "Saint-Alban", kind: "foret" as const,
      roadSurface: "mud" as const, speedLimit: 10,
      npcDensity: 0.05, pedestrianDensity: 0.15, wildlifeDensity: 0.5,
      trafficMix: {},
      ambientSound: "ambient_vent_desole", ambientVolume: 0.8,
      fogDensity: 0.0034, fogColor: "#141410",
      policeResponseSeconds: 900, allowVehicleSpawn: false, priority: 7,
    },
    bounds: [{
      shapeType: "box" as const,
      minX: CX + 30, minZ: CZ - 480, maxX: CX + 320, maxZ: CZ - 200,
    }],
  },
];

/* ══════════════════════════════════════════════════════════════ */
/*  EXÉCUTION                                                     */
/* ══════════════════════════════════════════════════════════════ */

interface SeedResult {
  name: string;
  inserted: number;
  durationMs: number;
  error?: string;
}

async function seedAll(db: any, only?: string[]): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  const run = async (name: string, fn: () => Promise<number>) => {
    if (only && !only.includes(name)) return;
    const t0 = Date.now();
    try {
      const n = await fn();
      results.push({ name, inserted: n, durationMs: Date.now() - t0 });
    } catch (err) {
      results.push({
        name, inserted: 0, durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  /* ── Surfaces ────────────────────────────────────────────── */
  await run("surfaces", async () => {
    for (const s of SURFACES) {
      await db.insert(surfacePhysics).values(s)
        .onConflictDoUpdate({ target: surfacePhysics.surfaceKey, set: s });
    }
    return SURFACES.length;
  });

  /* ── Objets ──────────────────────────────────────────────── */
  await run("items", async () => {
    for (const it of ITEMS) {
      await db.insert(items).values(it)
        .onConflictDoUpdate({ target: items.id, set: it });
    }
    return ITEMS.length;
  });

  /* ── Métiers et grades ───────────────────────────────────── */
  await run("jobs", async () => {
    let count = 0;
    for (const j of JOB_SEEDS) {
      const row = {
        id: j.id, name: j.name, category: j.category,
        whitelisted: j.whitelisted, maxMembers: j.maxMembers,
        hasDuty: j.hasDuty,
      };
      await db.insert(jobs).values(row)
        .onConflictDoUpdate({ target: jobs.id, set: row });
      count++;

      for (const g of j.grades) {
        const grade = {
          jobId: j.id, level: g.level, name: g.name,
          salary: g.salary, permissions: g.permissions,
          hoursRequired: g.hoursRequired,
        };
        await db.insert(jobGrades).values(grade)
          .onConflictDoUpdate({
            target: [jobGrades.jobId, jobGrades.level],
            set: grade,
          });
        count++;
      }
    }
    return count;
  });

  /* ── Garages ─────────────────────────────────────────────── */
  await run("garages", async () => {
    for (const g of GARAGES) {
      await db.insert(garages).values(g)
        .onConflictDoUpdate({ target: garages.id, set: g });
    }
    return GARAGES.length;
  });

  /* ── Contrats ────────────────────────────────────────────── */
  await run("contracts", async () => {
    for (const c of CONTRACTS) {
      await db.insert(contracts).values(c)
        .onConflictDoUpdate({ target: contracts.name, set: c });
    }
    return CONTRACTS.length;
  });

  /* ── Tâches planifiées ───────────────────────────────────── */
  await run("tasks", async () => {
    for (const t of TASKS) {
      await db.insert(scheduledTasks).values(t)
        .onConflictDoUpdate({ target: scheduledTasks.taskKey, set: t });
    }
    return TASKS.length;
  });

  /* ── Zones ───────────────────────────────────────────────── */
  await run("zones", async () => {
    let count = 0;
    for (const z of ZONES) {
      await db.insert(zoneConfig).values(z.config)
        .onConflictDoUpdate({ target: zoneConfig.zoneName, set: z.config });
      count++;

      // Les limites sont remplacées — pas de clé naturelle pour un upsert
      await db.delete(zoneBounds).where(eq(zoneBounds.zoneName, z.config.zoneName));
      for (const b of z.bounds) {
        await db.insert(zoneBounds).values({ zoneName: z.config.zoneName, ...b });
        count++;
      }
    }
    return count;
  });

  return results;
}

/* ══════════════════════════════════════════════════════════════ */
/*  RÉINITIALISATION                                              */
/* ══════════════════════════════════════════════════════════════ */

/**
 * Vide toutes les tables, dans l'ordre des clés étrangères.
 *
 * `TRUNCATE ... CASCADE` serait plus rapide, mais il effacerait aussi
 * les tables liées sans qu'on le demande. L'ordre explicite est plus
 * lent et beaucoup plus sûr.
 */
async function resetAll(db: any): Promise<number> {
  let count = 0;
  for (const table of schema.TRUNCATE_ORDER) {
    await db.delete(table);
    count++;
  }
  return count;
}

/* ══════════════════════════════════════════════════════════════ */
/*  POINT D'ENTRÉE                                                */
/* ══════════════════════════════════════════════════════════════ */

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL manquante. Vérifiez votre .env");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice(7).split(",") : undefined;

  const client = postgres(url, { max: 4, onnotice: () => {} });
  const db = drizzle(client, { schema });

  console.log("\n🌱 Seed EtherWorld\n");

  if (reset) {
    console.log("⚠️  Réinitialisation complète demandée.");
    console.log("   Toutes les données seront perdues, personnages compris.");
    console.log("   Interruption dans 5 secondes — Ctrl+C pour annuler…\n");
    await new Promise((r) => setTimeout(r, 5000));

    const t0 = Date.now();
    const tables = await resetAll(db);
    console.log(`   🗑️  ${tables} tables vidées en ${Date.now() - t0} ms\n`);
  }

  if (only) {
    console.log(`   Groupes : ${only.join(", ")}\n`);
  }

  const results = await seedAll(db, only);

  let total = 0;
  let failed = 0;

  for (const r of results) {
    if (r.error) {
      console.log(`   ❌ ${r.name.padEnd(12)} ${r.error}`);
      failed++;
    } else {
      console.log(
        `   ✓  ${r.name.padEnd(12)} ${String(r.inserted).padStart(4)} lignes` +
        `   ${r.durationMs} ms`,
      );
      total += r.inserted;
    }
  }

  console.log(
    `\n${failed === 0 ? "✅" : "⚠️ "} ${total} lignes insérées` +
    (failed > 0 ? ` — ${failed} groupe(s) en échec` : "") + "\n",
  );

  await client.end();
  process.exit(failed === 0 ? 0 : 1);
}

// Exécution directe seulement — l'import du module ne déclenche rien
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("\n💥 Échec du seed :\n", err);
    process.exit(1);
  });
}

export { seedAll, resetAll, SURFACES, ITEMS, GARAGES, CONTRACTS, TASKS, ZONES };
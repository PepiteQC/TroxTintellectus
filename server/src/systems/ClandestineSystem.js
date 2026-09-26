/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CLANDESTINESYSTEM.JS (v3.0 Platinum Edition)
 * Système Clandestin, Stupéfiants & Crime Organisé du Québec
 * ═══════════════════════════════════════════════════════════════════
 * 
 * 1. PLANTATIONS DE CANNABIS (GROW-OPS) :
 *    - Hydroponique indoor (garage, sous-sol, conteneur) & Plein air (clairière, rang).
 *    - Dérivation illégale Hydro-Québec (by-pass de compteur) pour masquer la consommation.
 *    - Gestion de l'arrosage, nutriments, éclairage HPS/LED et filtres à charbon.
 *
 * 2. LABORATOIRES DE SYNTHÈSE & PRESSAGE :
 *    - Synthèse de Speed / Ice / Meth québécois avec risque réel d'explosion.
 *    - Presse à comprimés hydraulique (logos : Étoile, Canadien, Playboy, CD).
 *    - Coupage au Fentanyl (risque d'overdose mortelle pour les acheteurs).
 *
 * 3. FACTIONS & GUERRES DE TERRITOIRE (TURFS) :
 *    - Hells Angels (Motards 1% patchés, contrôle des bars et drogues lourdes).
 *    - Gangs de rue de Montréal (Allégeances Bleues / Rouges, CDP, Bo-Gars, STL).
 *    - Mafia Italienne de Montréal (Clan du Consorzio, pizzo, blanchiment, construction).
 *    - Réseau Frontalier Autochtone (Cigarettes sans taxe, importation exclusive).
 *
 * 4. DEAL DE RUE & COINS STRATÉGIQUES :
 *    - Vente de proximité, risques d'agents d'infiltration (undercover) et faux billets.
 *    - Cotes perçues par le gang contrôlant le secteur.
 *
 * 5. CONTREBANDE & BRAQUAGES MAJEURS :
 *    - Conteneurs maritimes au Port de Montréal (corruption de dockers / douanes ASFC).
 *    - Arrachement et perçage de GAB (guichets automatiques Desjardins).
 *    - Embuscades coordonnées sur fourgons blindés Garda World.
 *    - Blanchiment d'argent par entreprises de façade (lave-auto, bar, pizzeria, excavation).
 *
 * Signature : TROXT⬡ · 🛡️INTELLECTUS⬡ · PègreQuébec
 * Chemin    : server/systems/ClandestineSystem.js
 */

import { netEmit, netOn } from './net.js';
import { registerRemote } from './remotes.js';
import { sendPrivateMessage, sendChatMessage } from './chat.js';
import { triggerNotification } from './phone.js';
import { getPlayerData } from './character.js';

// Systèmes interconnectés
import { addWantedPoints, dispatchPolice } from './police.js';
import { addCash, removeCash, getAccount, pushTx } from './banking.js';
import { addToInventory, removeFromInventory, getInventoryItem } from './backpack.js';
import { modifyHealth, getPlayerHealth } from './survival.js';

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

// ═══════════════════════════════════════════════════════════════════
// CATALOGUES & CONSTANTES DES SUBSTANCES
// ═══════════════════════════════════════════════════════════════════

export const IllicitSubstance = Object.freeze({
  CANNABIS_HYDRO:       'cannabis_hydro',       // Fleur intérieure forte (Skunk / Kush)
  CANNABIS_OUTDOOR:     'cannabis_outdoor',     // Pot de rang québécois
  SHATTER_BHO:          'shatter_bho',          // Concentré de cannabis inflammable
  SPEED_ICE:            'speed_ice',            // Comprimés de méthamphétamine ("Speed")
  COKE_PURE:            'coke_pure',            // Cocaïne pure importée
  COKE_CUT:             'coke_cut',             // Poudre coupée de rue
  CRACK:                'crack',                // Cailloux de base libre
  FENTANYL_PURE:        'fentanyl_pure',        // Poudre létale de fentanyl
  FENTANYL_CUT_PILLS:   'fentanyl_cut_pills',   // Faux comprimés contrefaits
  CIGARETTES_INDIENNES: 'cigarettes_indiennes', // Cigarettes de contrebande sans taxe
  MOONSHINE_QUEBEC:     'moonshine_quebec',     // Alcool de contrebande artisanal
});

export const SubstanceQuality = Object.freeze({
  POUBELLE:             'poubelle',             // 10-25% pureté
  STANDARD_RUE:         'standard_rue',         // 40-60% pureté
  QUALITE_SUPERIEURE:   'qualite_superieure',   // 75-90% pureté
  PURE_IMPORT:          'pure_import',          // 95%+ pureté
  CONTAMINEE_FENTANYL:  'contaminee_fentanyl',  // Danger mortel d'overdose
});

export const CriminalFaction = Object.freeze({
  INDEPENDANT:      'independant',
  HELLS_ANGELS:     'hells_angels',       // Motards 1% (Chapitres QC/Trois-Rivières)
  GANG_RUE_BLEU:    'gang_rue_bleu',      // Allégeance Bleue (Crips / CDP / Saint-Michel)
  GANG_RUE_ROUGE:   'gang_rue_rouge',     // Allégeance Rouge (Bloods / Bo-Gars / Mtl-Nord)
  MAFIA_MONTREAL:   'mafia_montreal',     // Clan Italien traditionnel
  RESEAU_AUTOCHTONE:'reseau_autochtone',  // Contrebande frontalière
});

export const GrowOpEnvironment = Object.freeze({
  SOUS_SOL:          'sous_sol',
  GARAGE:            'garage',
  GRANGE_ISOLEE:     'grange_isolee',
  CLAIRIERE_FORET:   'clairiere_foret',
  CONTENEUR_ENTERRE: 'conteneur_enterre',
});

// Prix moyens du marché noir québécois (T$ par gramme/unité)
export const STREET_PRICES = Object.freeze({
  cannabis_hydro:       8,
  cannabis_outdoor:     4,
  shatter_bho:          45,
  speed_ice:            10,
  coke_pure:            100,
  coke_cut:             60,
  crack:                40,
  fentanyl_pure:        150,
  fentanyl_cut_pills:   20,
  cigarettes_indiennes: 5,
  moonshine_quebec:     15,
});

// ═══════════════════════════════════════════════════════════════════
// REGISTRES EN MÉMOIRE
// ═══════════════════════════════════════════════════════════════════

const GROW_OPS = new Map();
const LABS = new Map();
const TERRITORIES = new Map();
const FACTIONS = new Map();
const PORT_CONTAINERS = new Map();
const ACTIVE_HEISTS = new Map();

// Initialisation des territoires de contrôle de la métropole et du comté
function initTerritories() {
  const defaultZones = [
    { id: 'ter_mtl_nord',          name: 'Montréal-Nord',                gang: CriminalFaction.GANG_RUE_ROUGE },
    { id: 'ter_saint_michel',      name: 'Saint-Michel',                 gang: CriminalFaction.GANG_RUE_BLEU },
    { id: 'ter_petite_italie',     name: 'Petite-Italie & RDP',          gang: CriminalFaction.MAFIA_MONTREAL },
    { id: 'ter_portneuf_centre',   name: 'Portneuf & Rang Sainte-Anne',  gang: CriminalFaction.HELLS_ANGELS },
    { id: 'ter_donnacona_indus',   name: 'Parc Industriel Donnacona',    gang: CriminalFaction.HELLS_ANGELS },
    { id: 'ter_port_montreal',     name: 'Docks du Port de Montréal',    gang: CriminalFaction.MAFIA_MONTREAL },
    { id: 'ter_reserve_frontiere', name: 'Corridor Frontalier / Réserve',gang: CriminalFaction.RESEAU_AUTOCHTONE },
  ];

  for (const z of defaultZones) {
    TERRITORIES.set(z.id, {
      territoryId: z.id,
      zoneName: z.name,
      controllingGang: z.gang,
      controlPercentage: 80,
      dailyTaxesCollected: 1200,
      dealerSpots: [
        { x: 10, z: -20, assignedDealerId: null },
        { x: -15, z: 30, assignedDealerId: null },
      ],
      isUnderContest: false,
      warProgress: 0,
      challengerGang: null,
    });
  }

  // Initialisation des profils de factions
  const factionList = Object.values(CriminalFaction);
  for (const f of factionList) {
    FACTIONS.set(f, {
      factionId: f,
      name: f.replace(/_/g, ' ').toUpperCase(),
      leaderId: null,
      members: [],
      reputation: 50,
      bankBalance: 250000,
      safehouses: [],
      rivalFactions: f === CriminalFaction.GANG_RUE_BLEU ? [CriminalFaction.GANG_RUE_ROUGE]
                   : f === CriminalFaction.GANG_RUE_ROUGE ? [CriminalFaction.GANG_RUE_BLEU] : [],
    });
  }
}

initTerritories();

// ═══════════════════════════════════════════════════════════════════
// 1. CULTURE DE CANNABIS CLANDESTINE (GROW-OPS)
// ═══════════════════════════════════════════════════════════════════

/**
 * Crée une nouvelle plantation clandestine.
 * @param {string} ownerId 
 * @param {string} environment - sous_sol | garage | grange_isolee | clairiere_foret | conteneur_enterre
 * @param {{x: number, y: number, z: number}} position 
 * @param {number} [plantCount=12] 
 * @param {string} [gang='independant'] 
 */
export function createGrowOp(ownerId, environment, position, plantCount = 12, gang = CriminalFaction.INDEPENDANT) {
  const growId = `GROW-${Date.now().toString(36).toUpperCase()}`;

  const maxCapacities = {
    grange_isolee:     60,
    clairiere_foret:   100,
    conteneur_enterre: 30,
    garage:            20,
    sous_sol:          15,
  };
  const maxCap = maxCapacities[environment] || 20;
  const count = Math.min(Math.max(1, parseInt(plantCount, 10) || 1), maxCap);

  const growOp = {
    id: growId,
    ownerId,
    ownerGang: gang,
    environment,
    position: { ...position },
    plantCount: count,
    maxCapacity: maxCap,
    growthProgress: 0,        // 0 à 100%
    health: 100,              // 0 à 100%
    waterLevel: 80,           // 0 à 100%
    nutrientLevel: 80,        // 0 à 100%
    lightingType: environment === GrowOpEnvironment.CLAIRIERE_FORET ? 'soleil_naturel' : 'hps_puissant',
    hydroBypassInstalled: false, // Si faux -> Hydro-Québec repère les pointes de consommation
    carbonFilterQuality: 100,    // 0 = odeur puissante détectable par les patrouilles
    smellRadiusMeters: 15,
    policeSuspicion: 0,          // Raid déclenché si >= 85%
    plantedAt: Date.now(),
    lastTendedAt: Date.now(),
    estimatedYieldGrams: count * 85, // ~85 grammes par plant à maturité
  };

  GROW_OPS.set(growId, growOp);

  triggerNotification?.(ownerId, {
    title: '🌿 Plantation clandestine installée',
    body: `${count} plants en terre (${environment})\nSurveillez le niveau d'eau et le compteur Hydro !`,
    icon: '🌱',
  });

  netEmit('illegal:grow_created', { growOp, sig: SIG });
  return { ok: true, message: `Plantation active (${count} plants).`, growOp };
}

/**
 * Installe un by-pass de compteur Hydro-Québec pour masquer la consommation.
 * @param {string} growId 
 * @param {string} electricianPlayerId 
 */
export function installHydroBypass(growId, electricianPlayerId) {
  const grow = GROW_OPS.get(growId);
  if (!grow) return { ok: false, message: 'Plantation introuvable.' };
  
  if (grow.environment === GrowOpEnvironment.CLAIRIERE_FORET) {
    return { ok: false, message: 'Aucun compteur électrique en pleine forêt !' };
  }
  if (grow.hydroBypassInstalled) {
    return { ok: false, message: 'Un by-pass Hydro-Québec est déjà installé sur ce panneau.' };
  }

  const pliers = getInventoryItem?.(electricianPlayerId, 'pince_electricien') ?? 0;
  if (pliers < 1) {
    return { ok: false, message: "Il vous faut des pinces d'électricien et du fil de calibre 240V." };
  }

  // Risque d'arc électrique et d'électrocution
  if (Math.random() < 0.15) {
    modifyHealth?.(-25, electricianPlayerId);
    return { ok: false, message: '⚡ CHOC ÉLECTRIQUE ! Court-circuit sur le transformateur d\'Hydro-Québec !' };
  }

  grow.hydroBypassInstalled = true;
  grow.policeSuspicion = Math.max(0, grow.policeSuspicion - 35);

  netEmit('illegal:hydro_bypassed', { growId, sig: SIG });
  return { ok: true, message: 'Compteur Hydro-Québec dérivé ! Électricité gratuite et consommation masquée.' };
}

/**
 * Arrosage et fertilisation d'une plantation.
 * @param {string} growId 
 * @param {string} tendedById 
 * @param {boolean} [addNutrients=false] 
 */
export function tendGrowOp(growId, tendedById, addNutrients = false) {
  const grow = GROW_OPS.get(growId);
  if (!grow) return { ok: false, message: 'Plantation introuvable.', grow: null };

  grow.waterLevel = 100;
  if (addNutrients) {
    grow.nutrientLevel = 100;
    grow.health = Math.min(100, grow.health + 10);
  }
  grow.lastTendedAt = Date.now();

  netEmit('illegal:grow_tended', { growId, sig: SIG });
  return { ok: true, message: 'Plants arrosés et fertilisés avec succès.', grow };
}

/**
 * Récolte et manucure des cocottes de cannabis.
 * @param {string} growId 
 * @param {string} harvesterId 
 */
export function harvestGrowOp(growId, harvesterId) {
  const grow = GROW_OPS.get(growId);
  if (!grow) return { ok: false, yieldGrams: 0, message: 'Plantation introuvable.' };

  if (grow.growthProgress < 85) {
    return { ok: false, yieldGrams: 0, message: `Les fleurs ne sont pas prêtes (${grow.growthProgress.toFixed(0)}% de floraison) !` };
  }

  const finalYield = Math.round(grow.estimatedYieldGrams * (grow.health / 100));
  const substance = grow.environment === GrowOpEnvironment.CLAIRIERE_FORET 
    ? IllicitSubstance.CANNABIS_OUTDOOR 
    : IllicitSubstance.CANNABIS_HYDRO;

  addToInventory?.(substance, finalYield, harvesterId);
  GROW_OPS.delete(growId);

  sendChatMessage?.(`✂️ [RÉCOLTE] Une plantation de ${grow.plantCount} plants a été coupée et séchée (+${finalYield}g de Kush).`);
  netEmit('illegal:grow_harvested', { growId, yieldGrams: finalYield, harvesterId, sig: SIG });

  return {
    ok: true,
    yieldGrams: finalYield,
    message: `Récolte abondante : +${finalYield} grammes de têtes manucurées ajoutés à votre inventaire !`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 2. LABORATOIRES DE SYNTHÈSE CLANDESTINS
// ═══════════════════════════════════════════════════════════════════

/**
 * Monte une installation de laboratoire clandestin.
 * @param {string} ownerId 
 * @param {string} type - meth_speed | extraction_bho | crack_kitchen | pressage_pilules
 * @param {{x: number, y: number, z: number}} position 
 * @param {number} [tier=1] 
 */
export function setupLab(ownerId, type, position, tier = 1) {
  const labId = `LAB-${Date.now().toString(36).toUpperCase()}`;

  const lab = {
    id: labId,
    ownerId,
    ownerGang: CriminalFaction.INDEPENDANT,
    type,
    position: { ...position },
    equipmentTier: tier,
    temperature: 20,
    isCooking: false,
    cookProgress: 0,
    ingredientsLoaded: {},
    explosionRisk: tier === 1 ? 25 : tier === 2 ? 12 : 3,
    fumesDetected: false,
    totalBatchesCooked: 0,
  };

  LABS.set(labId, lab);
  netEmit('illegal:lab_created', { lab, sig: SIG });
  return { ok: true, message: `Laboratoire de [${type}] installé.`, lab };
}

/**
 * Lance une réaction chimique de synthèse.
 * @param {string} labId 
 * @param {string} cookerId 
 */
export function startChemicalCook(labId, cookerId) {
  const lab = LABS.get(labId);
  if (!lab) return { ok: false, message: 'Laboratoire introuvable.' };
  if (lab.isCooking) return { ok: false, message: 'Une réaction chimique est déjà en cours dans le ballon !' };

  lab.isCooking = true;
  lab.cookProgress = 0;
  lab.temperature = 145; // Montée thermique de la réaction

  // Risque d'explosion instantanée
  if (Math.random() < lab.explosionRisk / 100) {
    lab.isCooking = false;
    modifyHealth?.(-85, cookerId);
    dispatchPolice?.({
      location: { x: lab.position.x, z: lab.position.z },
      priority: 'critical',
      type: 'shots_fired',
      description: 'EXPLOSION MAJEURE DE LABORATOIRE CLANDESTIN SIGNALÉE PAR LES VOISINS !',
    });
    return { ok: false, message: '💥 DÉFLAGRATION ! Le réacteur a explosé sous la pression chimique !' };
  }

  netEmit('illegal:cook_started', { labId, sig: SIG });
  return { ok: true, message: 'Synthèse chimique démarrée. Surveillez la température pour éviter la surchauffe !' };
}

/**
 * Presse des comprimés de Speed / Ice aux logos québécois.
 * @param {string} labId 
 * @param {string} presserId 
 * @param {number} powderGrams 
 * @param {string} logoStamp - etoile | canadien | playboy | cd
 * @param {boolean} [cutWithFentanyl=false] 
 */
export function pressSpeedPills(labId, presserId, powderGrams, logoStamp, cutWithFentanyl = false) {
  const lab = LABS.get(labId);
  if (!lab || lab.type !== 'pressage_pilules') {
    return { ok: false, pillsCount: 0, message: 'Presse hydraulique industrielle requise.' };
  }

  const validPowder = Math.max(1, parseInt(powderGrams, 10) || 1);
  const pillsCount = validPowder * 4; // 1g = ~4 pilules avec liant

  const substance = cutWithFentanyl 
    ? IllicitSubstance.FENTANYL_CUT_PILLS 
    : IllicitSubstance.SPEED_ICE;

  addToInventory?.(substance, pillsCount, presserId);

  if (cutWithFentanyl) {
    sendChatMessage?.(`⚠️ [SANTÉ PUBLIQUE] Des comprimés de Speed contaminés au FENTANYL circulent dans la région !`);
  }

  netEmit('illegal:pills_pressed', { labId, pillsCount, stamp: logoStamp, cutWithFentanyl, sig: SIG });
  return {
    ok: true,
    pillsCount,
    message: `Pressage terminé : +${pillsCount} pilules de Speed (Logo : ${logoStamp.toUpperCase()}).`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 3. GUERRES DE TERRITOIRE & RACKET (PIZZO)
// ═══════════════════════════════════════════════════════════════════

export function claimTerritorySpot(territoryId, gang, spotIndex, dealerId) {
  const ter = TERRITORIES.get(territoryId);
  if (!ter) return { ok: false, message: 'Territoire introuvable.' };

  if (ter.controllingGang !== gang && !ter.isUnderContest) {
    return {
      ok: false,
      message: `Ce quartier appartient aux ${ter.controllingGang.toUpperCase()}. Vous devez déclarer une guerre de territoire.`,
    };
  }

  if (!ter.dealerSpots[spotIndex]) {
    return { ok: false, message: 'Point de vente (spot) invalide.' };
  }

  ter.dealerSpots[spotIndex].assignedDealerId = dealerId;
  netEmit('illegal:spot_claimed', { territoryId, spotIndex, dealerId, sig: SIG });

  return { ok: true, message: `Point de vente revendiqué pour le compte de ${gang.toUpperCase()}.` };
}

export function triggerGangWar(territoryId, attackingGang) {
  const ter = TERRITORIES.get(territoryId);
  if (!ter) return { ok: false, message: 'Territoire introuvable.' };
  if (ter.controllingGang === attackingGang) {
    return { ok: false, message: 'Votre faction contrôle déjà ce secteur.' };
  }

  ter.isUnderContest = true;
  ter.challengerGang = attackingGang;
  ter.warProgress = 0;

  sendChatMessage?.(`⚔️ [GUERRE DE RUE] Les ${attackingGang.toUpperCase()} tentent d'arracher le territoire de ${ter.zoneName} aux ${ter.controllingGang.toUpperCase()} !`);
  netEmit('illegal:gang_war_started', { territoryId, attackingGang, sig: SIG });

  return { ok: true, message: `Guerre de territoire ouverte à ${ter.zoneName} ! Tenez la zone pour l'emporter.` };
}

export function collectPizzoTax(territoryId, collectorId, gang) {
  const ter = TERRITORIES.get(territoryId);
  if (!ter) return { ok: false, collectedAmount: 0, message: 'Territoire introuvable.' };
  if (ter.controllingGang !== gang) {
    return { ok: false, collectedAmount: 0, message: 'Votre organisation ne contrôle pas ce secteur.' };
  }

  const cash = ter.dailyTaxesCollected;
  if (cash <= 0) return { ok: false, collectedAmount: 0, message: 'Aucun impôt de protection à collecter pour le moment.' };

  addCash?.(cash, collectorId);
  ter.dailyTaxesCollected = 0;

  sendPrivateMessage?.(collectorId, `💰 Enveloppe de protection perçue : +${cash}$ (argent liquide).`);
  netEmit('illegal:pizzo_collected', { territoryId, collectorId, amount: cash, sig: SIG });

  return { ok: true, collectedAmount: cash, message: `Racket perçu : ${cash}$ récoltés auprès des commerçants du secteur.` };
}

// ═══════════════════════════════════════════════════════════════════
// 4. DEAL DE RUE & INTERACTIONS CLIENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Exécute une transaction de vente de rue.
 * @param {string} sellerId 
 * @param {string} substance 
 * @param {number} quantityGrams 
 * @param {string} [territoryId] 
 */
export function executeStreetDeal(sellerId, substance, quantityGrams, territoryId = null) {
  const qty = Math.max(1, parseInt(quantityGrams, 10) || 1);
  const count = getInventoryItem?.(sellerId, substance) ?? 0;

  if (count < qty) {
    return {
      ok: false,
      revenue: 0,
      productSold: substance,
      isUndercoverCop: false,
      overdoseTriggered: false,
      message: "Vous n'avez pas assez de marchandise dans vos poches.",
    };
  }

  const unitPrice = STREET_PRICES[substance] || 10;
  const totalCash = unitPrice * qty;

  // 1. Risque d'infiltration policière (Undercover Sting)
  if (Math.random() < 0.08) {
    addWantedPoints?.(sellerId, 45, 'Trafic de stupéfiants en flagrant délit');
    return {
      ok: false,
      revenue: 0,
      productSold: substance,
      isUndercoverCop: true,
      overdoseTriggered: false,
      message: '🚨 « POLICE ! NE BOUGEZ PLUS ! » Le client était un flic en civil !',
    };
  }

  // 2. Risque d'arnaque de faux billets
  if (Math.random() < 0.05) {
    removeFromInventory?.(substance, qty, sellerId);
    return {
      ok: false,
      revenue: 0,
      productSold: substance,
      isUndercoverCop: false,
      overdoseTriggered: false,
      message: '💸 Le client s\'est enfui en vous tendant des faux billets de 20$ imprimés !',
    };
  }

  // 3. Risque d'overdose du consommateur (si fentanyl)
  let overdose = false;
  if (substance === IllicitSubstance.FENTANYL_CUT_PILLS || substance === IllicitSubstance.FENTANYL_PURE) {
    if (Math.random() < 0.35) {
      overdose = true;
      sendChatMessage?.('🚑 [URGENCE 911] Un consommateur s\'est effondré en arrêt respiratoire après avoir ingéré une dose contaminée !');
    }
  }

  // Finalisation de la transaction
  removeFromInventory?.(substance, qty, sellerId);
  addCash?.(totalCash, sellerId);

  // Redevance versée au gang du territoire
  if (territoryId) {
    const ter = TERRITORIES.get(territoryId);
    if (ter) {
      ter.dailyTaxesCollected += Math.round(totalCash * 0.15); // 15% de cote territoriale
    }
  }

  netEmit('illegal:street_deal_done', { sellerId, substance, totalCash, overdose, sig: SIG });
  return {
    ok: true,
    revenue: totalCash,
    productSold: substance,
    isUndercoverCop: false,
    overdoseTriggered: overdose,
    message: `Vente conclue : +${totalCash}$ d'argent liquide pour ${qty}g de ${substance}.`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5. IMPORTATION & CONTREBANDE AU PORT DE MONTRÉAL
// ═══════════════════════════════════════════════════════════════════

export function orderPortContainer(buyerId, origin, declared, cargo, bribeDocker = true) {
  const containerId = `CONT-${Math.floor(100000 + Math.random() * 900000)}`;
  const bribeCost = bribeDocker ? 15000 : 0;
  const cargoCost = cargo.reduce((sum, item) => sum + (item.quantity * 25), 0);
  const totalCost = cargoCost + bribeCost;

  const acct = getAccount?.(buyerId);
  if (!acct || acct.balance < totalCost) {
    return { ok: false, containerId: '', totalCost, message: 'Fonds bancaires insuffisants pour régler la cargaison et corrompre les dockers.' };
  }

  removeCash?.(totalCost, buyerId);

  const container = {
    containerId,
    originCountry: origin,
    declaredContents: declared,
    hiddenIllicitCargo: [...cargo],
    bribePaidToDocker: bribeDocker,
    customsInspected: false,
    isSeized: false,
    dockLocation: { x: 340, z: -120 },
    retrieved: false,
  };

  PORT_CONTAINERS.set(containerId, container);

  triggerNotification?.(buyerId, {
    title: '🚢 Arrivée maritime — Port de Montréal',
    body: `Cargaison #${containerId} amarrée au terminal.\nRécupérez le conteneur avant inspection douanière !`,
    icon: '📦',
  });

  netEmit('illegal:container_ordered', { container, sig: SIG });
  return { ok: true, containerId, totalCost, message: `Conteneur #${containerId} commandé avec succès.` };
}

export function unloadPortContainer(containerId, playerId) {
  const cont = PORT_CONTAINERS.get(containerId);
  if (!cont || cont.retrieved) {
    return { ok: false, seized: false, itemsRetrieved: 0, message: 'Conteneur introuvable ou déjà déchargé.' };
  }

  // Risque d'inspection et de saisie par les douaniers (ASFC)
  const seizureChance = cont.bribePaidToDocker ? 0.05 : 0.65;
  if (Math.random() < seizureChance) {
    cont.isSeized = true;
    cont.retrieved = true;
    addWantedPoints?.(playerId, 80, 'Importation internationale illégale au Port de Montréal');
    sendChatMessage?.('🚨 [ASFC / DOUANES] Saisie record d\'un conteneur de stupéfiants aux terminaux du Port de Montréal !');
    return { ok: false, seized: true, itemsRetrieved: 0, message: 'Les douaniers et chiens renifleurs ont saisi la cargaison !' };
  }

  let totalItems = 0;
  for (const item of cont.hiddenIllicitCargo) {
    addToInventory?.(item.substance, item.quantity, playerId);
    totalItems += item.quantity;
  }

  cont.retrieved = true;
  netEmit('illegal:container_unloaded', { containerId, playerId, sig: SIG });

  return {
    ok: true,
    seized: false,
    itemsRetrieved: totalItems,
    message: `Cargaison déchargée sans encombre (+${totalItems} unités chargées dans vos camions).`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 6. BRAQUAGES AVANCÉS & ATTAQUES DE FOURGONS
// ═══════════════════════════════════════════════════════════════════

export function crackAtmAdvanced(villageName, method, hackerId) {
  let loot = 0;
  let alarmChance = 0.5;

  switch (method) {
    case 'chalumeau':
      loot = Math.floor(6000 + Math.random() * 8000);
      alarmChance = 0.40;
      break;
    case 'arrachage_pickup':
      loot = Math.floor(12000 + Math.random() * 15000);
      alarmChance = 0.95; // Extrêmement bruyant
      break;
    case 'explosion_gaz':
      loot = Math.floor(18000 + Math.random() * 20000);
      alarmChance = 1.0;  // Déclenche l'alarme à coup sûr
      break;
    case 'carte_skimmer':
      loot = Math.floor(2500 + Math.random() * 4000);
      alarmChance = 0.05; // Discret
      break;
    default:
      loot = 3000;
  }

  const alarmTriggered = Math.random() < alarmChance;
  if (alarmTriggered) {
    addWantedPoints?.(hackerId, 40, `Braquage de GAB Caisse Populaire (${villageName})`);
    dispatchPolice?.({
      location: { x: 0, z: 0 },
      priority: 'high',
      type: 'bank_alarm',
      description: `Alarme effraction guichet automatique à ${villageName} (Méthode: ${method})`,
    });
  }

  addCash?.(loot, hackerId);
  netEmit('illegal:atm_cracked', { villageName, method, loot, alarmTriggered, sig: SIG });

  return {
    ok: true,
    loot,
    alarmTriggered,
    message: `GAB éventré via ${method} ! Butin : +${loot}$ ${alarmTriggered ? '(Alarme 10-90 déclenchée !)' : ''}`,
  };
}

export function ambushArmoredTruck(truckId, leaderId, crewPlayerIds = []) {
  const heistId = `HEIST-${Date.now().toString(36).toUpperCase()}`;
  const cashInTruck = Math.floor(150000 + Math.random() * 250000);

  const heist = {
    heistId,
    truckId,
    leaderId,
    crewIds: [leaderId, ...crewPlayerIds],
    lootCash: cashInTruck,
    doorBreached: true,
    c4Planted: true,
    status: 'loot_secured',
  };

  ACTIVE_HEISTS.set(heistId, heist);

  sendChatMessage?.('🚨🚨 [ATTAQUE DE FOURGON] Braquage à l\'explosif lourd en cours sur un camion blindé de transport de valeurs !');
  
  for (const member of heist.crewIds) {
    addWantedPoints?.(member, 150, 'Attaque à main armée sur fourgon blindé Garda');
    const share = Math.round(cashInTruck / heist.crewIds.length);
    addCash?.(share, member);
  }

  netEmit('illegal:armored_truck_ambushed', { heist, sig: SIG });
  return {
    ok: true,
    totalLoot: cashInTruck,
    message: `Portes du fourgon soufflées au C4 ! ${cashInTruck}$ récupérés et partagés entre les braqueurs !`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 7. BLANCHIMENT D'ARGENT SALE
// ═══════════════════════════════════════════════════════════════════

export function launderThroughBusiness(businessType, dirtyCashAmount, laundererId) {
  const cuts = {
    lave_auto:               0.20, // 20% de commission
    bar_danseuses:           0.15, // 15% (très efficace pour le cash)
    excavation_construction: 0.10, // 10% (fausses factures)
    pizzeria:                0.25, // 25%
  };

  const cutRate = cuts[businessType] || 0.20;
  const taxCut = Math.round(dirtyCashAmount * cutRate);
  const cleanCash = dirtyCashAmount - taxCut;

  const acct = getAccount?.(laundererId);
  if (acct) {
    pushTx?.(acct, 'business_income', cleanCash, `Revenus déclarés (${businessType})`, acct.balance + cleanCash);
  }

  addCash?.(cleanCash, laundererId);
  netEmit('illegal:money_laundered', { businessType, dirtyCashAmount, cleanCash, sig: SIG });

  return {
    ok: true,
    cleanCash,
    taxCut,
    message: `${dirtyCashAmount}$ blanchis via [${businessType}]. Net bancaire : +${cleanCash}$ (Frais : -${taxCut}$).`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// GESTIONNAIRE PRINCIPAL (TICK LOOP DU MAÎTRE DU JEU)
// ═══════════════════════════════════════════════════════════════════

export class IllegalManager {
  /**
   * Boucle de simulation appelée périodiquement par le serveur.
   * @param {number} dtMinutes - Temps écoulé en minutes
   */
  tick(dtMinutes = 1) {
    // 1. Croissance des plantations de cannabis
    for (const grow of GROW_OPS.values()) {
      grow.waterLevel = Math.max(0, grow.waterLevel - (dtMinutes * 0.05));
      grow.nutrientLevel = Math.max(0, grow.nutrientLevel - (dtMinutes * 0.03));

      if (grow.waterLevel > 10 && grow.nutrientLevel > 10) {
        grow.growthProgress = Math.min(100, grow.growthProgress + (dtMinutes * 0.15));
      } else {
        grow.health = Math.max(0, grow.health - (dtMinutes * 0.20));
      }

      // Détection de surconsommation Hydro-Québec
      if (!grow.hydroBypassInstalled && grow.lightingType === 'hps_puissant') {
        grow.policeSuspicion += dtMinutes * 0.08;
        if (grow.policeSuspicion >= 85 && Math.random() < 0.02) {
          dispatchPolice?.({
            location: grow.position,
            priority: 'high',
            type: 'drug_activity',
            description: 'PERQUISITION SQ : Consommation électrique anormale détectée par Hydro-Québec !',
          });
        }
      }
    }

    // 2. Synthèse et cuissons en laboratoire
    for (const lab of LABS.values()) {
      if (lab.isCooking) {
        lab.cookProgress += dtMinutes * 1.5;
        if (lab.cookProgress >= 100) {
          lab.isCooking = false;
          lab.cookProgress = 0;
          lab.totalBatchesCooked++;
          triggerNotification?.(lab.ownerId, {
            title: '🧪 Synthèse de laboratoire terminée',
            body: `La fournée de ${lab.type.toUpperCase()} est prête pour le conditionnement !`,
            icon: '⚗️',
          });
        }
      }
    }
  }

  getGrowOp(id) {
    return GROW_OPS.get(id) ?? null;
  }

  getLab(id) {
    return LABS.get(id) ?? null;
  }

  getAllTerritories() {
    return Array.from(TERRITORIES.values());
  }

  getAllGrowOps() {
    return Array.from(GROW_OPS.values());
  }
}

export const illegalSystem = new IllegalManager();

// ═══════════════════════════════════════════════════════════
// ENREGISTREMENT DES PROCÉDURES DISTANTES (REMOTES RPC)
// ═══════════════════════════════════════════════════════════

if (typeof registerRemote === 'function') {
  registerRemote('illegal:create_grow', createGrowOp);
  registerRemote('illegal:bypass_hydro', installHydroBypass);
  registerRemote('illegal:tend_grow', tendGrowOp);
  registerRemote('illegal:harvest_grow', harvestGrowOp);
  registerRemote('illegal:setup_lab', setupLab);
  registerRemote('illegal:start_cook', startChemicalCook);
  registerRemote('illegal:press_pills', pressSpeedPills);
  registerRemote('illegal:claim_spot', claimTerritorySpot);
  registerRemote('illegal:gang_war', triggerGangWar);
  registerRemote('illegal:collect_pizzo', collectPizzoTax);
  registerRemote('illegal:street_deal', executeStreetDeal);
  registerRemote('illegal:order_container', orderPortContainer);
  registerRemote('illegal:unload_container', unloadPortContainer);
  registerRemote('illegal:crack_atm', crackAtmAdvanced);
  registerRemote('illegal:ambush_truck', ambushArmoredTruck);
  registerRemote('illegal:launder', launderThroughBusiness);
}

export default illegalSystem;
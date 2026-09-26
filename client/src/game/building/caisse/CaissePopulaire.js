/**
 * ═══════════════════════════════════════════════════════════════════
 * CAISSE POPULAIRE DESJARDINS — Bâtiment 3D + Système Multijoueur
 * ═══════════════════════════════════════════════════════════════════
 *
 * BÂTIMENT :
 *  - Extérieur brique beige + bandeau vert Desjardins
 *  - 2 GAB extérieurs 24/7 (self-service)
 *  - Hall d'accueil, comptoirs vitrés
 *  - Bureaux conseillers privés
 *  - Voûte sécurisée (combinaison)
 *  - Caméras avec LED clignotantes
 *
 * SYSTÈME MULTIJOUEUR :
 *  - Joueurs employés (directeur, conseiller, caissier, sécurité)
 *  - Punch in/out avec paie horaire réelle
 *  - Files d'attente automatiques (client → caissier)
 *  - Rendez-vous conseillers (prêts, placements)
 *  - Voûte avec combinaison + rôles autorisés
 *  - GAB avec cash physique braquable
 *  - Alarme silencieuse
 *  - Braquages coordonnés multi-joueur
 *  - Fourgons Garda pour ravitaillement
 *
 * INTÉGRATIONS :
 *  - banking.js (comptes, transactions, prêts)
 *  - police.js (alarmes, appels 911)
 *  - net.js + remotes.js (RPC multijoueur)
 *  - chat.js (communication interne)
 *  - phone.js (notifications, prise RDV)
 *  - jobs.js (contrats d'embauche)
 *  - character.js (identités joueurs)
 *
 * Chemin : client/src/game/caisse/CaissePopulaire.js
 * ═══════════════════════════════════════════════════════════════════
 */

import * as THREE from "three";
import { buildGlassLeaf } from "@/components/environment/buildings/access-control/doors/door";
import { matLib } from "./materials";
import { villageCivicSpot, VILLAGES } from "@/game/worlddata";

// Réseau & multijoueur
import { netEmit, netOn } from "@/settings/net";
import { registerRemote } from "./remotes";
import { sendPrivateMessage, sendChatMessage } from "@/settings/communication/chat";
import { triggerNotification } from "./phone";
import { getPlayerData } from "./character";

// Banking
import {
  BRANCHES,
  ATMS,
  createBranch,
  getBranch,
  hireBankEmployee,
  robBank,
  openAccount,
  deposit,
  withdraw,
  requestLoan,
} from "./banking";

// Police
import { addWantedPoints, dispatchPolice } from "@/jobs/police/police";

// Monde
// import { getGameHour } from "./seasons"; const getGameHour = () => new Date().getHours();

/* ═══════════════════════════════════════════════════════════════════
 * TYPES (JSDoc — pour autocomplétion IDE sans TypeScript)
 * ═══════════════════════════════════════════════════════════════════
 *
 * @typedef {'directeur'|'directeur_adjoint'|'conseiller_financier'|'specialiste_hypotheque'|'caissier'|'agent_securite'|'commis_service'|'client'} CaisseRole
 *
 * @typedef {object} CaissePermissions
 * @property {boolean} canOperateTeller
 * @property {boolean} canApproveLoans
 * @property {boolean} canApproveMortgages
 * @property {boolean} canAccessVault
 * @property {boolean} canViewCameras
 * @property {boolean} canHireEmployees
 * @property {boolean} canFireEmployees
 * @property {boolean} canSetHours
 * @property {boolean} canOpenAccounts
 * @property {boolean} canCloseAccounts
 * @property {boolean} canFreezeAccounts
 * @property {boolean} canOrderCash
 * @property {boolean} canTriggerAlarm
 * @property {boolean} canDisableAlarm
 * @property {boolean} canAccessManagerOffice
 *
 * @typedef {object} Teller
 * @property {string} id
 * @property {string} branchId
 * @property {{x:number,y:number,z:number}} position
 * @property {string|null} operatedBy
 * @property {number} cashDrawer
 * @property {boolean} isOpen
 * @property {string|null} currentCustomerId
 * @property {string[]} waitingClients
 * @property {number} totalTransactionsToday
 * @property {number} totalRevenueToday
 *
 * @typedef {object} QueueTicket
 * @property {string} ticketId
 * @property {number} ticketNumber
 * @property {string} playerId
 * @property {string} playerName
 * @property {string} branchId
 * @property {'caissier'|'conseiller'|'hypotheque'|'ouverture_compte'} service
 * @property {number} requestedAt
 * @property {number|null} calledAt
 * @property {string|null} servedBy
 * @property {'waiting'|'called'|'in_service'|'completed'|'abandoned'} status
 *
 * @typedef {object} Appointment
 * @property {string} appointmentId
 * @property {string} branchId
 * @property {string} clientId
 * @property {string} clientName
 * @property {string|null} advisorId
 * @property {'pret'|'hypotheque'|'placement'|'ouverture_compte'|'conseil'} service
 * @property {number} scheduledFor
 * @property {number} duration
 * @property {'scheduled'|'confirmed'|'in_progress'|'completed'|'cancelled'|'no_show'} status
 * @property {string} notes
 *
 * @typedef {object} SafetyDeposit
 * @property {string} boxId
 * @property {string} ownerId
 * @property {string} ownerName
 * @property {Array<{itemId:string,quantity:number,description:string}>} contents
 * @property {number} cash
 * @property {number} rentalFee
 * @property {number} paidUntil
 *
 * @typedef {object} VaultAttempt
 * @property {string} playerId
 * @property {number} timestamp
 * @property {string} combinationTried
 * @property {boolean} success
 *
 * @typedef {object} CaisseVault
 * @property {string} id
 * @property {string} branchId
 * @property {string} combination
 * @property {number} cash
 * @property {number} gold
 * @property {SafetyDeposit[]} safetyDeposits
 * @property {boolean} isOpen
 * @property {string|null} openedBy
 * @property {number|null} openedAt
 * @property {number} lastAuditDate
 * @property {CaisseRole[]} requiredRoles
 * @property {number|null} timeLockUntil
 * @property {VaultAttempt[]} attempts
 *
 * @typedef {object} AlarmSystem
 * @property {string} branchId
 * @property {boolean} isActive
 * @property {boolean} isSilent
 * @property {string|null} triggeredBy
 * @property {number|null} triggeredAt
 * @property {boolean} policeNotified
 * @property {number} responseTime
 * @property {boolean} camerasRecording
 * @property {Array<{x:number,y:number,z:number}>} panicButtons
 *
 * @typedef {object} Robbery
 * @property {string} robberyId
 * @property {string} branchId
 * @property {string[]} robberIds
 * @property {number} startTime
 * @property {number|null} endTime
 * @property {string[]} hostages
 * @property {number} demandsCash
 * @property {number} actualLoot
 * @property {string[]} weaponsUsed
 * @property {'in_progress'|'successful'|'failed'|'escaped'} status
 * @property {number|null} policeArrivalTime
 * @property {boolean} vaultCracked
 * @property {boolean} camerasDisabled
 * @property {string[]} witnesses
 *
 * @typedef {object} GardaTruck
 * @property {string} truckId
 * @property {string|null} driverId
 * @property {string[]} guardIds
 * @property {number} cargo
 * @property {number} maxCargo
 * @property {string|null} currentBranchId
 * @property {string} targetBranchId
 * @property {Array<{x:number,z:number}>} route
 * @property {'loading'|'en_route'|'delivering'|'returning'|'hijacked'} status
 * @property {number} armorLevel
 * @property {boolean} gpsBeacon
 * @property {number} eta
 *
 * @typedef {object} TellerTransaction
 * @property {'deposit'|'withdrawal'|'check_cash'|'money_order'|'wire_transfer'} type
 * @property {number} amount
 * @property {string} accountId
 * @property {string} cashierId
 * @property {string} customerId
 *
 * @typedef {object} CaisseAtmLocal
 * @property {string} id
 * @property {number} x
 * @property {number} z
 *
 * @typedef {object} BuiltCaisse
 * @property {THREE.Group} root
 * @property {Array} swings
 * @property {CaisseAtmLocal[]} atms
 * @property {{x:number,z:number}} entrance
 * @property {{x:number,z:number}} vault
 * @property {number} width
 * @property {number} depth
 * @property {string} branchId
 */

/* ═══════════════════════════════════════════════════════════════════
 * PALETTE & CONSTANTES
 * ═══════════════════════════════════════════════════════════════════ */

export const CAISSE_PALETTE = {
  vertBandeau: 0x00874e,
  vertFonce: 0x00623a,
  vertClair: 0x2a9d63,
  briqueBeige: 0xc4b49a,
  pierreGrise: 0x9a9a94,
  betonClair: 0xbab8b0,
  vitre: 0x4a6a7a,
  cadreAlu: 0x9aa0a6,
  marbre: 0xd8d4cc,
  comptoirBois: 0x6a4a32,
  comptoirDessus: 0x3a3a3e,
  mur: 0xf0ede6,
  tapis: 0x2a6a48,
  atmCorps: 0x3a4248,
  atmFacade: 0x2a3238,
  acier: 0x6a7078,
  laiton: 0xa88a40,
  alarmeRouge: 0xff2030,
};

const P = CAISSE_PALETTE;

export const CAISSE_OPEN_FROM = 9;
export const CAISSE_OPEN_TO = 17;
export const CAISSE_MIN_WAGE = 22;                 // 22$/h min pour employé bancaire
export const CAISSE_MAX_CASH_AT_TELLER = 5000;
export const CAISSE_VAULT_CAPACITY = 2_000_000;
export const CAISSE_ATM_MAX = 150_000;

/** Durée de rétention des tickets/RDV terminés (ms) — utilisé par cleanupStaleState */
const STALE_TICKET_RETENTION_MS = 30 * 60 * 1000;   // 30 min
const STALE_APPOINTMENT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 h
const STALE_ROBBERY_RETENTION_MS = 5 * 60 * 1000;   // 5 min après end
const STALE_TRUCK_RETENTION_MS = 60 * 60 * 1000;    // 1 h

export function isCaisseOpen(hours) {
  return hours >= CAISSE_OPEN_FROM && hours < CAISSE_OPEN_TO;
}

export function caisseHoursLabel() {
  return "9 h – 17 h";
}

export function caisseNameFor(village) {
  return `Caisse Desjardins de ${village}`;
}

/* ═══════════════════════════════════════════════════════════════════
 * PERMISSIONS PAR RÔLE
 * ═══════════════════════════════════════════════════════════════════ */

export const CAISSE_ROLE_PERMS = {
  directeur: {
    canOperateTeller: true, canApproveLoans: true, canApproveMortgages: true,
    canAccessVault: true, canViewCameras: true, canHireEmployees: true,
    canFireEmployees: true, canSetHours: true, canOpenAccounts: true,
    canCloseAccounts: true, canFreezeAccounts: true, canOrderCash: true,
    canTriggerAlarm: true, canDisableAlarm: true, canAccessManagerOffice: true,
  },
  directeur_adjoint: {
    canOperateTeller: true, canApproveLoans: true, canApproveMortgages: true,
    canAccessVault: true, canViewCameras: true, canHireEmployees: true,
    canFireEmployees: false, canSetHours: false, canOpenAccounts: true,
    canCloseAccounts: true, canFreezeAccounts: true, canOrderCash: true,
    canTriggerAlarm: true, canDisableAlarm: true, canAccessManagerOffice: true,
  },
  conseiller_financier: {
    canOperateTeller: false, canApproveLoans: true, canApproveMortgages: false,
    canAccessVault: false, canViewCameras: false, canHireEmployees: false,
    canFireEmployees: false, canSetHours: false, canOpenAccounts: true,
    canCloseAccounts: false, canFreezeAccounts: false, canOrderCash: false,
    canTriggerAlarm: true, canDisableAlarm: false, canAccessManagerOffice: false,
  },
  specialiste_hypotheque: {
    canOperateTeller: false, canApproveLoans: false, canApproveMortgages: true,
    canAccessVault: false, canViewCameras: false, canHireEmployees: false,
    canFireEmployees: false, canSetHours: false, canOpenAccounts: false,
    canCloseAccounts: false, canFreezeAccounts: false, canOrderCash: false,
    canTriggerAlarm: true, canDisableAlarm: false, canAccessManagerOffice: false,
  },
  caissier: {
    canOperateTeller: true, canApproveLoans: false, canApproveMortgages: false,
    canAccessVault: false, canViewCameras: false, canHireEmployees: false,
    canFireEmployees: false, canSetHours: false, canOpenAccounts: false,
    canCloseAccounts: false, canFreezeAccounts: false, canOrderCash: false,
    canTriggerAlarm: true, canDisableAlarm: false, canAccessManagerOffice: false,
  },
  agent_securite: {
    canOperateTeller: false, canApproveLoans: false, canApproveMortgages: false,
    canAccessVault: true, canViewCameras: true, canHireEmployees: false,
    canFireEmployees: false, canSetHours: false, canOpenAccounts: false,
    canCloseAccounts: false, canFreezeAccounts: false, canOrderCash: false,
    canTriggerAlarm: true, canDisableAlarm: true, canAccessManagerOffice: false,
  },
  commis_service: {
    canOperateTeller: false, canApproveLoans: false, canApproveMortgages: false,
    canAccessVault: false, canViewCameras: false, canHireEmployees: false,
    canFireEmployees: false, canSetHours: false, canOpenAccounts: false,
    canCloseAccounts: false, canFreezeAccounts: false, canOrderCash: false,
    canTriggerAlarm: true, canDisableAlarm: false, canAccessManagerOffice: false,
  },
  client: {
    canOperateTeller: false, canApproveLoans: false, canApproveMortgages: false,
    canAccessVault: false, canViewCameras: false, canHireEmployees: false,
    canFireEmployees: false, canSetHours: false, canOpenAccounts: false,
    canCloseAccounts: false, canFreezeAccounts: false, canOrderCash: false,
    canTriggerAlarm: false, canDisableAlarm: false, canAccessManagerOffice: false,
  },
};

/* ═══════════════════════════════════════════════════════════════════
 * ÉTAT GLOBAL (multijoueur)
 * ═══════════════════════════════════════════════════════════════════ */

/** @type {Map<string, Teller>} */
const TELLERS = new Map();

/** @type {Map<string, QueueTicket>} */
const QUEUE_TICKETS = new Map();

/** @type {Map<string, Appointment>} */
const APPOINTMENTS = new Map();

/** @type {Map<string, CaisseVault>} */
const VAULTS = new Map();

/** @type {Map<string, AlarmSystem>} */
const ALARMS = new Map();

/** @type {Map<string, Robbery>} */
const ACTIVE_ROBBERIES = new Map();

/** @type {Map<string, GardaTruck>} */
const GARDA_TRUCKS = new Map();

/** @type {Map<string, {branchId:string, role:CaisseRole}>} */
const PLAYER_CAISSE_ROLES = new Map();

let queueCounter = 100;
let cleanupTimerId = null;

/* ═══════════════════════════════════════════════════════════════════
 * HELPERS INTERNES
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Génère un ID unique court avec préfixe.
 * @param {string} prefix
 * @returns {string}
 */
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Crée une Box Mesh avec le matériau partagé du matLib.
 * @returns {THREE.Mesh}
 */
function box(w, h, d, x, y, z, color, metal = 0, rough = 0.82) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matLib.get(color, rough, metal));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ═══════════════════════════════════════════════════════════════════
 * EMBAUCHE / CONGÉDIEMENT
 * ═══════════════════════════════════════════════════════════════════ */

/** @returns {{branchId:string, role:CaisseRole}|null} */
export function getPlayerCaisseRole(playerId) {
  return PLAYER_CAISSE_ROLES.get(playerId) ?? null;
}

/** @returns {CaissePermissions} */
export function getCaissePermissions(playerId) {
  const role = getPlayerCaisseRole(playerId);
  if (!role) return CAISSE_ROLE_PERMS.client;
  return CAISSE_ROLE_PERMS[role.role];
}

export function hireCaisseEmployee(
  branchId,
  hiringPlayerId,
  targetPlayerId,
  targetPlayerName,
  role,
  hourlyRate,
) {
  const branch = getBranch(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable." };

  const perms = getCaissePermissions(hiringPlayerId);
  if (!perms.canHireEmployees) {
    return { ok: false, message: "Permission d'embauche refusée." };
  }

  if (hourlyRate < CAISSE_MIN_WAGE) {
    return {
      ok: false,
      message: `Salaire minimum bancaire: ${CAISSE_MIN_WAGE}$/h`,
    };
  }

  if (role === "directeur" && branch.employees.some(e => e.role === "directeur")) {
    return { ok: false, message: "Un seul directeur par succursale." };
  }

  const existing = branch.employees.find(e => e.playerId === targetPlayerId);
  if (existing) return { ok: false, message: "Déjà employé ici." };

  const employee = {
    playerId: targetPlayerId,
    playerName: targetPlayerName,
    role,
    hourlyRate,
    isClockedIn: false,
    clockInTime: null,
    hoursWorked: 0,
    totalEarned: 0,
    performanceRating: 50,
    loansApproved: 0,
    accountsOpened: 0,
    branchId,
  };

  branch.employees.push(employee);
  PLAYER_CAISSE_ROLES.set(targetPlayerId, { branchId, role });

  triggerNotification(targetPlayerId, {
    title: "🏦 Embauché à Desjardins !",
    body: `${branch.name}\nPoste: ${role}\nSalaire: ${hourlyRate}$/h`,
    icon: "💼",
  });

  netEmit("caisse:employee_hired", { branchId, employee });

  return { ok: true, message: `${targetPlayerName} embauché comme ${role}.` };
}

export function fireCaisseEmployee(branchId, firingPlayerId, targetPlayerId) {
  const branch = getBranch(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable." };

  const perms = getCaissePermissions(firingPlayerId);
  if (!perms.canFireEmployees) return { ok: false, message: "Permission refusée." };

  const idx = branch.employees.findIndex(e => e.playerId === targetPlayerId);
  if (idx === -1) return { ok: false, message: "Employé introuvable." };

  branch.employees.splice(idx, 1);
  PLAYER_CAISSE_ROLES.delete(targetPlayerId);

  triggerNotification(targetPlayerId, {
    title: "❌ Congédié",
    body: `Vous ne travaillez plus à ${branch.name}.`,
    icon: "📋",
  });

  netEmit("caisse:employee_fired", { branchId, playerId: targetPlayerId });
  return { ok: true, message: "Employé congédié." };
}

/* ═══════════════════════════════════════════════════════════════════
 * PUNCH IN / OUT
 * ═══════════════════════════════════════════════════════════════════ */

export function clockInCaisse(branchId, playerId) {
  const branch = getBranch(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable." };

  const emp = branch.employees.find(e => e.playerId === playerId);
  if (!emp) return { ok: false, message: "Vous n'êtes pas employé." };
  if (emp.isClockedIn) return { ok: false, message: "Déjà pointé." };

  emp.isClockedIn = true;
  emp.clockInTime = Date.now();

  netEmit("caisse:clock_in", { branchId, playerId });
  return { ok: true, message: `Punché à ${new Date().toLocaleTimeString()}` };
}

export function clockOutCaisse(branchId, playerId) {
  const branch = getBranch(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable.", earnings: 0 };

  const emp = branch.employees.find(e => e.playerId === playerId);
  if (!emp || !emp.isClockedIn || !emp.clockInTime) {
    return { ok: false, message: "Pas pointé.", earnings: 0 };
  }

  const hours = (Date.now() - emp.clockInTime) / 3600000;
  const earnings = Math.round(hours * emp.hourlyRate * 100) / 100;

  emp.hoursWorked += hours;
  emp.totalEarned += earnings;
  emp.isClockedIn = false;
  emp.clockInTime = null;

  // Paie déposée dans le compte
  netEmit("bank:pay_salary", {
    employerId: `caisse_${branchId}`,
    employeeId: playerId,
    grossAmount: earnings,
    description: `Paie Desjardins ${branch.name}`,
  });

  netEmit("caisse:clock_out", { branchId, playerId, hours, earnings });
  return {
    ok: true,
    message: `Punché out. ${hours.toFixed(2)}h · ${earnings}$ payés.`,
    earnings,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 * FILE D'ATTENTE (numéros comme à la vraie caisse)
 * ═══════════════════════════════════════════════════════════════════ */

export function takeTicket(branchId, playerId, playerName, service) {
  const branch = getBranch(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable.", ticket: null };
  if (!branch.isOpen) return { ok: false, message: "Succursale fermée.", ticket: null };

  // Vérifier si déjà en file
  const existing = Array.from(QUEUE_TICKETS.values()).find(
    t => t.playerId === playerId && t.status === "waiting",
  );
  if (existing) {
    return {
      ok: false,
      message: `Vous êtes déjà en file: ${existing.ticketNumber}`,
      ticket: existing,
    };
  }

  const ticket = {
    ticketId: uid("tkt"),
    ticketNumber: queueCounter++,
    playerId,
    playerName,
    branchId,
    service,
    requestedAt: Date.now(),
    calledAt: null,
    servedBy: null,
    status: "waiting",
  };

  QUEUE_TICKETS.set(ticket.ticketId, ticket);

  triggerNotification(playerId, {
    title: `🎫 Ticket #${ticket.ticketNumber}`,
    body: `Service: ${service}\nAttendez que votre numéro soit appelé.`,
    icon: "🎟️",
  });

  netEmit("caisse:ticket_taken", { ticket });
  return { ok: true, message: `Ticket #${ticket.ticketNumber} pris.`, ticket };
}

export function callNextTicket(branchId, employeePlayerId, tellerId) {
  const perms = getCaissePermissions(employeePlayerId);
  if (!perms.canOperateTeller) {
    return { ok: false, message: "Permission refusée.", ticket: null };
  }

  const role = getPlayerCaisseRole(employeePlayerId);
  if (!role) return { ok: false, message: "Non employé.", ticket: null };

  // Trouver le prochain ticket selon le rôle
  const eligibleServices =
    role.role === "caissier" ? ["caissier"]
    : role.role === "conseiller_financier" ? ["conseiller", "ouverture_compte"]
    : role.role === "specialiste_hypotheque" ? ["hypotheque"]
    : ["caissier", "conseiller", "hypotheque", "ouverture_compte"];

  const nextTicket = Array.from(QUEUE_TICKETS.values())
    .filter(t => t.branchId === branchId && t.status === "waiting" && eligibleServices.includes(t.service))
    .sort((a, b) => a.ticketNumber - b.ticketNumber)[0];

  if (!nextTicket) {
    return { ok: false, message: "Aucun client en attente.", ticket: null };
  }

  nextTicket.status = "called";
  nextTicket.calledAt = Date.now();
  nextTicket.servedBy = employeePlayerId;

  const teller = TELLERS.get(tellerId);
  if (teller) {
    teller.currentCustomerId = nextTicket.playerId;
  }

  triggerNotification(nextTicket.playerId, {
    title: `📢 Ticket #${nextTicket.ticketNumber} appelé`,
    body: `Rendez-vous à la caisse #${tellerId.split("_").pop()}`,
    icon: "🔔",
    sound: "ding",
  });

  sendChatMessage(`📢 Numéro ${nextTicket.ticketNumber} au guichet.`);
  netEmit("caisse:ticket_called", { ticket: nextTicket, tellerId });

  return { ok: true, message: `Client #${nextTicket.ticketNumber} appelé.`, ticket: nextTicket };
}

export function completeTicketService(ticketId, employeeId) {
  const ticket = QUEUE_TICKETS.get(ticketId);
  if (!ticket) return { ok: false, message: "Ticket introuvable." };
  if (ticket.servedBy !== employeeId) return { ok: false, message: "Pas votre client." };

  ticket.status = "completed";

  // Boost performance de l'employé
  const branch = getBranch(ticket.branchId);
  if (branch) {
    const emp = branch.employees.find(e => e.playerId === employeeId);
    if (emp) emp.performanceRating = Math.min(100, emp.performanceRating + 0.5);
  }

  netEmit("caisse:ticket_completed", { ticket });
  return { ok: true, message: "Service complété." };
}

export function getQueueForBranch(branchId) {
  return Array.from(QUEUE_TICKETS.values())
    .filter(t => t.branchId === branchId && (t.status === "waiting" || t.status === "called"))
    .sort((a, b) => a.ticketNumber - b.ticketNumber);
}

/* ═══════════════════════════════════════════════════════════════════
 * RENDEZ-VOUS (Prise de RDV via téléphone)
 * ═══════════════════════════════════════════════════════════════════ */

export function scheduleAppointment(
  branchId,
  clientId,
  clientName,
  service,
  scheduledFor,
  duration = 30,
  notes = "",
) {
  const branch = getBranch(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable.", appointment: null };

  const appt = {
    appointmentId: uid("appt"),
    branchId,
    clientId,
    clientName,
    advisorId: null,
    service,
    scheduledFor,
    duration,
    status: "scheduled",
    notes,
  };

  APPOINTMENTS.set(appt.appointmentId, appt);

  // Notifier les conseillers disponibles
  const advisors = branch.employees.filter(
    e => e.role === "conseiller_financier" || e.role === "specialiste_hypotheque",
  );
  for (const adv of advisors) {
    triggerNotification(adv.playerId, {
      title: "📅 Nouveau RDV",
      body: `${clientName} — ${service}\n${new Date(scheduledFor).toLocaleString("fr-CA")}`,
      icon: "📆",
    });
  }

  triggerNotification(clientId, {
    title: "✅ RDV confirmé",
    body: `${branch.name}\n${new Date(scheduledFor).toLocaleString("fr-CA")}`,
    icon: "📅",
  });

  netEmit("caisse:appointment_scheduled", { appointment: appt });
  return { ok: true, message: "RDV pris.", appointment: appt };
}

export function assignAppointment(appointmentId, advisorId) {
  const appt = APPOINTMENTS.get(appointmentId);
  if (!appt) return { ok: false, message: "RDV introuvable." };

  appt.advisorId = advisorId;
  appt.status = "confirmed";

  netEmit("caisse:appointment_assigned", { appointment: appt });
  return { ok: true, message: "RDV assigné." };
}

/* ═══════════════════════════════════════════════════════════════════
 * GUICHETS (TELLERS) — Interaction multijoueur
 * ═══════════════════════════════════════════════════════════════════ */

export function occupyTeller(branchId, tellerId, playerId) {
  const teller = TELLERS.get(tellerId);
  if (!teller) return { ok: false, message: "Guichet introuvable." };
  if (teller.operatedBy && teller.operatedBy !== playerId) {
    return { ok: false, message: "Guichet occupé par un collègue." };
  }

  const perms = getCaissePermissions(playerId);
  if (!perms.canOperateTeller) {
    return { ok: false, message: "Vous n'êtes pas caissier." };
  }

  teller.operatedBy = playerId;
  teller.isOpen = true;

  netEmit("caisse:teller_occupied", { tellerId, playerId });
  return { ok: true, message: "Guichet ouvert. Prêt à servir." };
}

export function leaveTeller(tellerId, playerId) {
  const teller = TELLERS.get(tellerId);
  if (!teller) return { ok: false, message: "Guichet introuvable." };
  if (teller.operatedBy !== playerId) return { ok: false, message: "Pas votre guichet." };

  teller.operatedBy = null;
  teller.isOpen = false;
  teller.currentCustomerId = null;

  netEmit("caisse:teller_left", { tellerId, playerId });
  return { ok: true, message: "Guichet fermé." };
}

export function processTellerTransaction(tellerId, transaction) {
  const teller = TELLERS.get(tellerId);
  if (!teller) return { ok: false, message: "Guichet introuvable." };
  if (teller.operatedBy !== transaction.cashierId) {
    return { ok: false, message: "Pas votre guichet." };
  }

  let result;
  switch (transaction.type) {
    case "deposit":
      result = deposit(transaction.accountId, transaction.amount, null, "cash");
      if (result.ok) teller.cashDrawer += transaction.amount;
      break;
    case "withdrawal":
      if (teller.cashDrawer < transaction.amount) {
        return { ok: false, message: "Pas assez de cash au guichet — voûte requise." };
      }
      result = withdraw(transaction.accountId, transaction.amount, null);
      if (result.ok) teller.cashDrawer -= transaction.amount;
      break;
    default:
      return { ok: false, message: "Type de transaction non supporté." };
  }

  if (!result.ok) return result;

  teller.totalTransactionsToday++;
  teller.totalRevenueToday += transaction.amount;

  netEmit("caisse:teller_transaction", { tellerId, transaction, result });
  return { ok: true, message: result.message };
}

/* ═══════════════════════════════════════════════════════════════════
 * VOÛTE — Combinaison + rôles autorisés
 * ═══════════════════════════════════════════════════════════════════ */

export function createVault(branchId) {
  const vault = {
    id: uid("vault"),
    branchId,
    combination: Array(6).fill(0).map(() => Math.floor(Math.random() * 10)).join(""),
    cash: 500_000,
    gold: 0,
    safetyDeposits: [],
    isOpen: false,
    openedBy: null,
    openedAt: null,
    lastAuditDate: Date.now(),
    requiredRoles: ["directeur", "directeur_adjoint", "agent_securite"],
    timeLockUntil: null,
    attempts: [],
  };
  VAULTS.set(vault.id, vault);
  return vault;
}

export function openVault(vaultId, playerId, combination) {
  const vault = VAULTS.get(vaultId);
  if (!vault) return { ok: false, message: "Voûte introuvable." };

  // Vérifier le time-lock
  if (vault.timeLockUntil && Date.now() < vault.timeLockUntil) {
    const min = Math.ceil((vault.timeLockUntil - Date.now()) / 60000);
    return { ok: false, message: `🔒 Time-lock actif encore ${min} min.` };
  }

  // Vérifier les rôles
  const role = getPlayerCaisseRole(playerId);
  if (!role || !vault.requiredRoles.includes(role.role)) {
    return { ok: false, message: "🚫 Rôle non autorisé." };
  }

  vault.attempts.push({
    playerId,
    timestamp: Date.now(),
    combinationTried: combination,
    success: false,
  });

  if (combination !== vault.combination) {
    // 3 tentatives = alarme
    const recentFails = vault.attempts
      .filter(a => !a.success && Date.now() - a.timestamp < 300000)
      .length;

    if (recentFails >= 3) {
      triggerAlarm(vault.branchId, playerId, true);
      vault.timeLockUntil = Date.now() + 30 * 60000; // 30 min lock
      return {
        ok: false,
        message: "🚨 Trop de tentatives! Alarme déclenchée. Time-lock 30 min.",
      };
    }

    return { ok: false, message: `❌ Combinaison incorrecte (${3 - recentFails} essais restants)` };
  }

  // Succès
  vault.attempts[vault.attempts.length - 1].success = true;
  vault.isOpen = true;
  vault.openedBy = playerId;
  vault.openedAt = Date.now();

  netEmit("caisse:vault_opened", { vaultId, playerId });
  return {
    ok: true,
    message: "🔓 Voûte ouverte.",
    contents: { cash: vault.cash, gold: vault.gold },
  };
}

export function closeVault(vaultId, playerId) {
  const vault = VAULTS.get(vaultId);
  if (!vault) return { ok: false, message: "Voûte introuvable." };
  if (vault.openedBy !== playerId) return { ok: false, message: "Vous ne l'avez pas ouverte." };

  vault.isOpen = false;
  vault.openedBy = null;
  vault.openedAt = null;

  netEmit("caisse:vault_closed", { vaultId });
  return { ok: true, message: "Voûte fermée." };
}

/**
 * ✅ NOUVEAU — Fermeture administrative de la voûte (audit, incident, reset).
 * N'importe pas de vérif d'ouverture : force la fermeture.
 */
export function forceCloseVault(vaultId, adminId, reason = "manual") {
  const vault = VAULTS.get(vaultId);
  if (!vault) return { ok: false, message: "Voûte introuvable." };
  if (!vault.isOpen) return { ok: false, message: "Voûte déjà fermée." };

  const previousOpener = vault.openedBy;
  vault.isOpen = false;
  vault.openedBy = null;
  vault.openedAt = null;

  netEmit("caisse:vault_force_closed", { vaultId, adminId, previousOpener, reason });
  return { ok: true, message: `Voûte fermée de force (${reason}).` };
}

export function transferCashVaultToTeller(vaultId, tellerId, playerId, amount) {
  const vault = VAULTS.get(vaultId);
  const teller = TELLERS.get(tellerId);
  if (!vault || !teller) return { ok: false, message: "Vault ou teller introuvable." };
  if (!vault.isOpen) return { ok: false, message: "Voûte fermée." };
  if (vault.openedBy !== playerId) return { ok: false, message: "Vous n'êtes pas autorisé." };
  if (vault.cash < amount) return { ok: false, message: "Voûte vide." };

  vault.cash -= amount;
  teller.cashDrawer += amount;

  netEmit("caisse:cash_transferred_to_teller", { vaultId, tellerId, amount });
  return { ok: true, message: `${amount}$ transférés au guichet.` };
}

/* ═══════════════════════════════════════════════════════════════════
 * COFFRETS DE SÛRETÉ
 * ═══════════════════════════════════════════════════════════════════ */

export function rentSafetyDeposit(vaultId, clientId, clientName, monthsPaid) {
  const vault = VAULTS.get(vaultId);
  if (!vault) return { ok: false, message: "Voûte introuvable.", box: null };

  const rentalFee = 50; // 50$/mois
  const totalCost = rentalFee * monthsPaid;

  const box = {
    boxId: uid("box"),
    ownerId: clientId,
    ownerName: clientName,
    contents: [],
    cash: 0,
    rentalFee,
    paidUntil: Date.now() + monthsPaid * 30 * 24 * 3600 * 1000,
  };

  vault.safetyDeposits.push(box);
  netEmit("caisse:box_rented", { vaultId, box, totalCost });
  return { ok: true, message: `Coffret loué pour ${monthsPaid} mois (${totalCost}$).`, box };
}

export function accessSafetyDeposit(vaultId, boxId, playerId) {
  const vault = VAULTS.get(vaultId);
  if (!vault || !vault.isOpen) {
    return { ok: false, message: "Voûte fermée.", contents: null };
  }

  const box = vault.safetyDeposits.find(b => b.boxId === boxId);
  if (!box) return { ok: false, message: "Coffret introuvable.", contents: null };
  if (box.ownerId !== playerId) return { ok: false, message: "Pas votre coffret.", contents: null };

  return { ok: true, message: "Coffret ouvert.", contents: box };
}

/* ═══════════════════════════════════════════════════════════════════
 * ALARME
 * ═══════════════════════════════════════════════════════════════════ */

export function triggerAlarm(branchId, triggerId, silent = true) {
  let alarm = ALARMS.get(branchId);
  if (!alarm) {
    alarm = {
      branchId,
      isActive: false,
      isSilent: silent,
      triggeredBy: null,
      triggeredAt: null,
      policeNotified: false,
      responseTime: 180, // 3 min
      camerasRecording: true,
      panicButtons: [],
    };
    ALARMS.set(branchId, alarm);
  }

  if (alarm.isActive) return { ok: false, message: "Alarme déjà active." };

  alarm.isActive = true;
  alarm.isSilent = silent;
  alarm.triggeredBy = triggerId;
  alarm.triggeredAt = Date.now();
  alarm.policeNotified = true;

  const branch = getBranch(branchId);
  if (branch) {
    dispatchPolice({
      location: branch.position,
      priority: "high",
      type: "bank_alarm",
      description: `Alarme ${silent ? "silencieuse" : "sonore"} à ${branch.name}`,
      responseTime: alarm.responseTime,
    });
  }

  if (!silent) {
    sendChatMessage(`🚨 ALARME à ${branch?.name || branchId}! Tout le monde à terre!`);
  }

  netEmit("caisse:alarm_triggered", { branchId, silent, triggerId });
  return { ok: true, message: silent ? "🔔 Alarme silencieuse déclenchée." : "🚨 Alarme sonnée." };
}

export function disableAlarm(branchId, playerId, code) {
  const alarm = ALARMS.get(branchId);
  if (!alarm || !alarm.isActive) return { ok: false, message: "Aucune alarme active." };

  const perms = getCaissePermissions(playerId);
  if (!perms.canDisableAlarm) return { ok: false, message: "Permission refusée." };

  // Code fixe simplifié — pourrait être personnalisé par branche
  if (code !== "0000") return { ok: false, message: "Code invalide." };

  alarm.isActive = false;
  alarm.triggeredBy = null;

  netEmit("caisse:alarm_disabled", { branchId, playerId });
  return { ok: true, message: "Alarme désactivée." };
}

/* ═══════════════════════════════════════════════════════════════════
 * BRAQUAGE MULTIJOUEUR COORDONNÉ
 * ═══════════════════════════════════════════════════════════════════ */

export function startRobbery(branchId, leaderId, accompliceIds, weaponsUsed) {
  const branch = getBranch(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable.", robbery: null };
  if (!branch.isOpen) return { ok: false, message: "Succursale fermée.", robbery: null };

  if (ACTIVE_ROBBERIES.has(branchId)) {
    return { ok: false, message: "Braquage déjà en cours.", robbery: null };
  }

  // Trouver tous les joueurs actuellement dans la succursale = otages potentiels
  const potentialHostages = branch.employees
    .filter(e => e.isClockedIn)
    .map(e => e.playerId);

  const robbery = {
    robberyId: uid("rob"),
    branchId,
    robberIds: [leaderId, ...accompliceIds],
    startTime: Date.now(),
    endTime: null,
    hostages: potentialHostages,
    demandsCash: 0,
    actualLoot: 0,
    weaponsUsed,
    status: "in_progress",
    policeArrivalTime: null,
    vaultCracked: false,
    camerasDisabled: false,
    witnesses: potentialHostages,
  };

  ACTIVE_ROBBERIES.set(branchId, robbery);

  // Alarme silencieuse automatique via employés
  triggerAlarm(branchId, "auto", true);

  // Notifier tous les joueurs présents
  for (const hostageId of potentialHostages) {
    triggerNotification(hostageId, {
      title: "🎭 BRAQUAGE EN COURS",
      body: "Restez calme. Suivez les instructions.",
      icon: "😱",
      urgent: true,
    });
  }

  // Wanted level énorme pour les braqueurs
  for (const robberId of robbery.robberIds) {
    addWantedPoints(robberId, 200);
  }

  // Temps de réponse police (proportionnel au nombre de gardes)
  const responseTime = 120 + branch.guards.length * 30; // 2-5 min
  robbery.policeArrivalTime = Date.now() + responseTime * 1000;

  sendChatMessage(`🚨 BRAQUAGE à ${branch.name}! Police en route (~${Math.floor(responseTime/60)} min)`);
  netEmit("caisse:robbery_started", { robbery });

  return { ok: true, message: "Braquage lancé. Cracker la voûte!", robbery };
}

export function collectLoot(branchId, robberId, fromTeller, tellerId) {
  const robbery = ACTIVE_ROBBERIES.get(branchId);
  if (!robbery || !robbery.robberIds.includes(robberId)) {
    return { ok: false, message: "Pas un braqueur.", loot: 0 };
  }

  let loot = 0;
  if (fromTeller && tellerId) {
    const teller = TELLERS.get(tellerId);
    if (!teller) return { ok: false, message: "Guichet introuvable.", loot: 0 };
    loot = teller.cashDrawer;
    teller.cashDrawer = 0;
  } else {
    // Voûte
    const vault = Array.from(VAULTS.values()).find(v => v.branchId === branchId);
    if (!vault) return { ok: false, message: "Voûte introuvable.", loot: 0 };
    if (!vault.isOpen && !robbery.vaultCracked) {
      return { ok: false, message: "Voûte fermée — cracker d'abord.", loot: 0 };
    }
    loot = vault.cash;
    vault.cash = 0;
    robbery.vaultCracked = true;
  }

  robbery.actualLoot += loot;

  // Distribuer entre les braqueurs
  const share = Math.round(loot / robbery.robberIds.length);
  for (const rid of robbery.robberIds) {
    triggerNotification(rid, {
      title: "💰 Butin",
      body: `${share}$ ajoutés (cash marqué)`,
      icon: "💵",
    });
    // Cash marqué - traçable
    netEmit("player:add_marked_cash", { playerId: rid, amount: share });
  }

  netEmit("caisse:loot_collected", { branchId, loot, robbery });
  return { ok: true, message: `${loot}$ récoltés! FUYEZ!`, loot };
}

export function endRobbery(branchId, outcome) {
  const robbery = ACTIVE_ROBBERIES.get(branchId);
  if (!robbery) return { ok: false, message: "Aucun braquage." };

  robbery.status = outcome;
  robbery.endTime = Date.now();

  // Le vault se time-lock
  const vault = Array.from(VAULTS.values()).find(v => v.branchId === branchId);
  if (vault) {
    vault.timeLockUntil = Date.now() + 60 * 60000; // 1h
  }

  ACTIVE_ROBBERIES.delete(branchId);

  netEmit("caisse:robbery_ended", { robbery });
  return { ok: true, message: `Braquage: ${outcome}` };
}

/* ═══════════════════════════════════════════════════════════════════
 * FOURGON GARDA — Ravitaillement multijoueur
 * ═══════════════════════════════════════════════════════════════════ */

export function requestGardaTruck(branchId, requesterId, amount) {
  const perms = getCaissePermissions(requesterId);
  if (!perms.canOrderCash) return { ok: false, message: "Permission refusée.", truck: null };

  const branch = getBranch(branchId);
  if (!branch) return { ok: false, message: "Succursale introuvable.", truck: null };

  const truck = {
    truckId: uid("garda"),
    driverId: null,
    guardIds: [],
    cargo: amount,
    maxCargo: 500_000,
    currentBranchId: null,
    targetBranchId: branchId,
    route: [],
    status: "loading",
    armorLevel: 85,
    gpsBeacon: true,
    eta: Date.now() + 30 * 60 * 1000,
  };

  GARDA_TRUCKS.set(truck.truckId, truck);

  // Chercher des chauffeurs Garda disponibles (joueurs avec le job)
  netEmit("garda:job_available", { truck, branch });

  return { ok: true, message: `Fourgon commandé (${amount}$).`, truck };
}

export function assignGardaJob(truckId, driverId, guardIds) {
  const truck = GARDA_TRUCKS.get(truckId);
  if (!truck) return { ok: false, message: "Fourgon introuvable." };
  if (truck.driverId) return { ok: false, message: "Déjà assigné." };

  truck.driverId = driverId;
  truck.guardIds = guardIds;
  truck.status = "en_route";

  triggerNotification(driverId, {
    title: "🚚 Fourgon Garda assigné",
    body: `Livraison ${truck.cargo}$ — dirigez-vous au dépôt.`,
    icon: "🚛",
  });

  return { ok: true, message: "Fourgon assigné." };
}

export function completeGardaDelivery(truckId, driverId) {
  const truck = GARDA_TRUCKS.get(truckId);
  if (!truck || truck.driverId !== driverId) {
    return { ok: false, message: "Pas votre livraison.", payment: 0 };
  }

  const branch = getBranch(truck.targetBranchId);
  if (!branch) return { ok: false, message: "Destination invalide.", payment: 0 };

  branch.vaultCash += truck.cargo;
  const vault = Array.from(VAULTS.values()).find(v => v.branchId === branch.branchId);
  if (vault) vault.cash += truck.cargo;

  // Paie : 3% du cargo pour le chauffeur, 2% pour les gardes
  const driverPay = Math.round(truck.cargo * 0.03);
  const guardPay = Math.round(truck.cargo * 0.02);

  netEmit("bank:pay_salary", { employerId: "garda", employeeId: driverId, grossAmount: driverPay });
  for (const gid of truck.guardIds) {
    netEmit("bank:pay_salary", { employerId: "garda", employeeId: gid, grossAmount: guardPay });
  }

  truck.status = "returning";
  GARDA_TRUCKS.delete(truckId);

  return { ok: true, message: "Livraison complétée.", payment: driverPay };
}

/* ═══════════════════════════════════════════════════════════════════
 * 3D BUILDING (construit avec IDs pour interactions)
 * ═══════════════════════════════════════════════════════════════════ */

const signCache = new Map();

function signTex(label) {
  const hit = signCache.get(label);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 192;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#00874e";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px Outfit, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  signCache.set(label, tex);
  return tex;
}

function cameraDome(x, y, z, yaw, camId) {
  const g = new THREE.Group();
  g.name = `security_cam_${camId}`;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), matLib.get(0x2a2e32, 0.4, 0.55));
  g.add(body);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), matLib.getEmissive(0xff2a2a, 0xff2a2a, 1.1));
  led.position.set(0.07, 0, 0);
  led.userData.isRecLed = true;
  g.add(led);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  g.userData = { camId, isCamera: true };
  return g;
}

function panicButton(x, y, z, id) {
  const btn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16),
    matLib.getEmissive(P.alarmeRouge, 0xff0000, 0.5),
  );
  btn.position.set(x, y, z);
  btn.rotation.z = Math.PI / 2;
  btn.name = `panic_button_${id}`;
  btn.userData = { type: "panic_button", id, interactive: true };
  return btn;
}

/**
 * Construit la Caisse Populaire extérieure + enregistre la branche.
 * @param {string} [village="Portneuf"]
 * @returns {BuiltCaisse}
 */
export function buildCaissePopulaire(village = "Portneuf") {
  const g = new THREE.Group();
  g.name = "caisse_populaire";
  const w = 16.4;
  const d = 11.2;
  const h = 5.1;
  const label = caisseNameFor(village);

  // Créer la branche dans le système bancaire
  const spot = villageCivicSpot({ id: village.toLowerCase(), name: village }, "caisse");
  const branch = createBranch(label, `${village}, QC`, spot, "desjardins");
  createVault(branch.branchId);

  // Bâtiment
  g.add(box(w + 0.4, 0.42, d + 0.4, 0, 0.21, 0, P.betonClair, 0, 0.95));
  g.add(box(w, h, d, 0, 0.42 + h / 2, 0, P.briqueBeige));

  // Bandeau vert
  const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 1.05, d + 0.35), matLib.get(P.vertBandeau, 0.55));
  band.position.y = 0.42 + h - 0.35;
  g.add(band);

  // Toit
  g.add(box(w + 0.7, 0.28, d + 0.7, 0, 0.42 + h + 0.22, 0, 0x3a3e42, 0.12, 0.7));

  // Enseigne
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 1.05),
    matLib.getEmissive(P.vertBandeau, 0xffffff, 0.35),
  );
  sign.material.map = signTex(label);
  sign.material.emissiveMap = signTex(label);
  sign.position.set(0, 0.42 + h - 0.32, d / 2 + 0.2);
  sign.userData.isSign = true;
  g.add(sign);

  // Fenêtres
  for (const x of [-5.2, -1.7, 1.7, 5.2]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.35), matLib.glass(P.vitre, 0.38));
    pane.position.set(x, 2.15, d / 2 + 0.06);
    g.add(pane);
    g.add(box(2.55, 0.08, 0.08, x, 3.35, d / 2 + 0.07, P.cadreAlu, 0.55, 0.35));
  }

  // Canopée entrée
  const opening = 2.7;
  g.add(box(7.4, 0.12, 2.6, 0, 3.35, d / 2 + 1.2, P.vertFonce));
  for (const x of [-3.2, 3.2]) {
    g.add(box(0.14, 3.2, 0.14, x, 1.7, d / 2 + 2.2, P.cadreAlu, 0.6, 0.35));
  }
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 0.28),
    matLib.getEmissive(0xf0f6ff, 0xf0f6ff, 0.8),
  );
  lamp.position.set(0, 3.22, d / 2 + 1.4);
  lamp.userData.isLit = true;
  g.add(lamp);

  // Portes
  const swings = [];
  const leafW = opening / 2 - 0.05;
  const left = buildGlassLeaf(leafW, 2.45, 1, -1);
  left.hinge.position.set(-(opening / 2), 0.42, d / 2);
  g.add(left.hinge);
  swings.push(left.door);
  const right = buildGlassLeaf(leafW, 2.45, -1, 1);
  right.hinge.position.set(opening / 2, 0.42, d / 2);
  g.add(right.hinge);
  swings.push(right.door);
  g.userData.swings = swings;
  g.userData.entranceLocal = new THREE.Vector3(0, 0, d / 2 + 2.4);

  // GAB extérieurs (2)
  const atms = [];
  for (let i = 0; i < 2; i++) {
    const ax = -2.2 + i * 4.4;
    const az = d / 2 + 0.55;
    const atmId = `atm_${branch.branchId}_${i}`;

    // Enregistrer dans le registre GAB
    ATMS.set(atmId, {
      atmId,
      location: { x: ax, y: 0.42, z: az + 1.05 },
      address: `${village} - Extérieur ${i + 1}`,
      ownerBank: "desjardins",
      cash: 25000,
      maxCapacity: CAISSE_ATM_MAX,
      minCapacity: 5000,
      broken: false,
      lastRestock: Date.now(),
      lastServiced: Date.now(),
      alarmActive: false,
      transactionsCount: 0,
      totalDispensed: 0,
      isIndoor: false,
      hasSecurityGuard: false,
      robberyResistance: 40,
      interacFee: 0,
      currentUser: null,
    });

    branch.atms.push(atmId);
    g.add(buildAtmCabinet(ax, 0.42, az, false, atmId));
    atms.push({ id: atmId, x: ax, z: az + 1.05 });
  }

  // Caméras extérieures
  g.add(cameraDome(-w / 2 + 1.1, h + 0.1, d / 2 - 0.4, 0.7, `${branch.branchId}_ext1`));
  g.add(cameraDome(w / 2 - 1.1, h + 0.1, d / 2 - 0.4, -0.7, `${branch.branchId}_ext2`));

  // Plaque
  g.add(box(1.6, 0.55, 0.04, -w / 2 + 1.4, 1.7, d / 2 + 0.08, P.vertFonce));

  g.userData.buildingType = "caisse_populaire";
  g.userData.branchId = branch.branchId;
  g.userData.label = label;
  g.userData.footprint = { width: w, depth: d };
  g.userData.village = village;

  return {
    root: g,
    swings,
    atms,
    entrance: { x: 0, z: d / 2 + 2.4 },
    vault: { x: w / 2 - 2.4, z: -d / 2 + 1.6 },
    width: w,
    depth: d,
    branchId: branch.branchId,
  };
}

export function buildAtmCabinet(x = 0, y = 0, z = 0, wall = false, atmId) {
  const g = new THREE.Group();
  g.name = atmId || "atm";
  const h = wall ? 1.4 : 1.62;

  g.add(box(0.72, h, 0.52, 0, y + h / 2, 0, P.atmCorps, 0.45, 0.42));
  g.add(box(0.64, 0.72, 0.08, 0, y + h - 0.42, 0.24, P.atmFacade, 0.5, 0.38));

  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.32, 0.03),
    matLib.getEmissive(0x1a4a6a, 0x2a9d63, 0.55),
  );
  screen.position.set(0, y + h - 0.48, 0.29);
  screen.name = atmId ? `${atmId}_screen` : "atm_screen";
  g.add(screen);

  g.add(box(0.38, 0.035, 0.05, 0, y + h - 0.78, 0.28, 0x111111, 0.4, 0.4));
  g.add(box(0.26, 0.16, 0.04, 0, y + 0.52, 0.28, 0x1a1c20));
  g.add(box(0.34, 0.08, 0.08, 0, y + 0.28, 0.28, P.vertBandeau));

  g.position.set(x, 0, z);
  if (atmId) g.userData = { atmId, interactive: true, type: "atm" };
  return g;
}

export function buildCaisseInterior(branchId) {
  const g = new THREE.Group();
  g.name = "interieur_caisse";
  const W = 14.2;
  const D = 12.4;
  const H = 3.35;
  const walls = [];

  // Sol marbre
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matLib.get(P.marbre, 0.35, 0.08));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // Plafond
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matLib.get(0xe8e6e0, 0.95));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  g.add(ceil);

  // Murs
  g.add(box(W, H, 0.22, 0, H / 2, -D / 2, P.mur));
  g.add(box(W, H, 0.22, 0, H / 2, D / 2, P.mur));
  g.add(box(0.22, H, D, -W / 2, H / 2, 0, P.mur));
  g.add(box(0.22, H, D, W / 2, H / 2, 0, P.mur));
  walls.push({ minX: -W / 2, maxX: W / 2, minZ: -D / 2 - 0.14, maxZ: -D / 2 + 0.14 });
  walls.push({ minX: -W / 2, maxX: W / 2, minZ: D / 2 - 0.14, maxZ: D / 2 + 0.14 });
  walls.push({ minX: -W / 2 - 0.14, maxX: -W / 2 + 0.14, minZ: -D / 2, maxZ: D / 2 });
  walls.push({ minX: W / 2 - 0.14, maxX: W / 2 + 0.14, minZ: -D / 2, maxZ: D / 2 });

  // Bandeau vert
  g.add(box(W - 0.4, 0.22, 0.04, 0, 2.55, D / 2 - 0.14, P.vertBandeau));

  // Éclairage
  for (const x of [-4.2, 0, 4.2]) {
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.07, 0.22),
      matLib.getEmissive(0xf6faff, 0xf6faff, 1.1),
    );
    tube.position.set(x, H - 0.18, -1.2);
    tube.userData.isLit = true;
    g.add(tube);
  }

  // ═══ GUICHETS INTERACTIFS (3) ═══
  const counterW = 8.4;
  g.add(box(counterW, 1.12, 0.82, 0, 0.62, -D / 2 + 2.7, P.comptoirBois));
  g.add(box(counterW + 0.16, 0.06, 0.92, 0, 1.2, -D / 2 + 2.7, P.comptoirDessus, 0.15, 0.4));

  // Vitre protection
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(counterW, 1.25), matLib.glass(0xc8dce8, 0.22));
  shield.position.set(0, 1.88, -D / 2 + 2.7);
  g.add(shield);

  // Enregistrer les 3 guichets
  const tellerPositions = [];
  for (let i = 0; i < 3; i++) {
    const sx = -counterW / 2 + (i + 0.5) * (counterW / 3);
    const tellerId = branchId ? `teller_${branchId}_${i}` : `teller_${i}`;

    // Base ordi
    g.add(box(0.38, 0.1, 0.42, sx, 1.26, -D / 2 + 2.45, 0x8a8e92, 0.45, 0.4));
    // Écran
    const mon = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.28, 0.04),
      matLib.getEmissive(0x1a3a4a, 0x2a7a9a, 0.55),
    );
    mon.position.set(sx, 1.52, -D / 2 + 2.95);
    mon.name = `${tellerId}_monitor`;
    mon.userData = { tellerId, interactive: true, type: "teller_monitor", branchId };
    g.add(mon);

    // Numéro guichet
    g.add(box(0.2, 0.14, 0.03, sx, 2.38, -D / 2 + 2.7, P.vertBandeau));

    // Enregistrer teller
    if (branchId) {
      TELLERS.set(tellerId, {
        id: tellerId,
        branchId,
        position: { x: sx, y: 1.2, z: -D / 2 + 2.7 },
        operatedBy: null,
        cashDrawer: 5000,
        isOpen: false,
        currentCustomerId: null,
        waitingClients: [],
        totalTransactionsToday: 0,
        totalRevenueToday: 0,
      });
    }

    tellerPositions.push({ id: tellerId, x: sx, y: 1.2, z: -D / 2 + 2.7 });

    // Bouton panique sous chaque guichet
    g.add(panicButton(sx + 0.15, 0.9, -D / 2 + 2.3, `panic_${tellerId}`));
  }

  // Tapis d'entrée
  const mat_ = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.5), matLib.get(P.tapis, 0.98));
  mat_.rotation.x = -Math.PI / 2;
  mat_.position.set(0, 0.03, D / 2 - 1.5);
  g.add(mat_);

  // File d'attente (poteaux + rubans)
  for (let i = 0; i < 5; i++) {
    const px = -2.4 + (i % 3) * 2.4;
    const pz = -D / 2 + 5.1 + Math.floor(i / 3) * 1.8;
    g.add(box(0.08, 0.95, 0.08, px, 0.52, pz, 0x9a9ea2, 0.55, 0.35));
    if (i < 4) g.add(box(2.2, 0.04, 0.012, px + 1.1, 0.98, pz, P.vertBandeau));
  }

  // GAB intérieurs
  const atm1Id = branchId ? `atm_${branchId}_int1` : "atm_int1";
  const atm2Id = branchId ? `atm_${branchId}_int2` : "atm_int2";
  g.add(buildAtmCabinet(-W / 2 + 1.7, 0, -D / 2 + 0.7, true, atm1Id));
  g.add(buildAtmCabinet(-W / 2 + 3.2, 0, -D / 2 + 0.7, true, atm2Id));

  if (branchId) {
    for (const id of [atm1Id, atm2Id]) {
      ATMS.set(id, {
        atmId: id,
        location: { x: -W / 2 + 2, y: 1.4, z: -D / 2 + 0.7 },
        address: `Intérieur - ${branchId}`,
        ownerBank: "desjardins",
        cash: 50000,
        maxCapacity: CAISSE_ATM_MAX,
        minCapacity: 10000,
        broken: false,
        lastRestock: Date.now(),
        lastServiced: Date.now(),
        alarmActive: false,
        transactionsCount: 0,
        totalDispensed: 0,
        isIndoor: true,
        hasSecurityGuard: true,
        robberyResistance: 90,
        interacFee: 0,
        currentUser: null,
      });
    }
  }

  // ═══ BUREAUX CONSEILLERS (2 privés) ═══
  const offices = [];
  for (let i = 0; i < 2; i++) {
    const ox = -W / 2 + 3.6 + i * 4.4;
    const oz = D / 2 - 3.4;
    const officeId = branchId ? `office_${branchId}_${i}` : `office_${i}`;

    // Cloison vitrée
    const part = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.4), matLib.glass(0xd8e4ec, 0.22));
    part.position.set(ox, 1.25, oz - 1.4);
    g.add(part);

    // Bureau conseiller
    const desk = box(1.55, 0.72, 0.78, ox, 0.38, oz, P.comptoirBois);
    desk.name = `${officeId}_desk`;
    desk.userData = { officeId, interactive: true, type: "advisor_desk", branchId };
    g.add(desk);

    // Ordi + chaise
    g.add(box(0.42, 0.08, 0.42, ox, 0.46, oz - 0.7, 0x3a4a52));
    g.add(box(0.42, 0.5, 0.06, ox, 0.74, oz - 0.88, 0x3a4a52));

    offices.push({ id: officeId, x: ox, z: oz });
  }

  // ═══ VOÛTE INTERACTIVE ═══
  const vault = new THREE.Group();
  vault.name = "voute";
  const vaultId = branchId ? `vault_${branchId}` : "vault_default";

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.12, 10, 24), matLib.get(P.acier, 0.32, 0.78));
  ring.position.set(0, 1.15, 0);
  vault.add(ring);

  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.16, 24), matLib.get(P.acier, 0.28, 0.82));
  door.rotation.x = Math.PI / 2;
  door.position.set(0, 1.15, 0.02);
  door.name = "vault_door";
  door.userData = { vaultId, interactive: true, type: "vault_door", branchId };
  vault.add(door);

  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 16), matLib.get(P.laiton, 0.3, 0.85));
  wheel.position.set(0, 1.15, 0.14);
  vault.add(wheel);

  vault.position.set(W / 2 - 1.4, 0, -D / 2 + 1.5);
  g.add(vault);

  // ═══ CAMÉRAS INTÉRIEURES ═══
  const camPrefix = branchId ? `${branchId}` : "int";
  g.add(cameraDome(-W / 2 + 0.6, H - 0.25, -D / 2 + 0.6, -0.6, `${camPrefix}_int1`));
  g.add(cameraDome(W / 2 - 0.6, H - 0.25, D / 2 - 0.6, Math.PI, `${camPrefix}_int2`));
  g.add(cameraDome(0, H - 0.25, -D / 2 + 0.6, 0, `${camPrefix}_tellers`));
  g.add(cameraDome(W / 2 - 1.4, H - 0.25, -D / 2 + 2.5, Math.PI / 2, `${camPrefix}_vault`));

  // Porte d'entrée
  const doorGap = 1.35;
  walls.push({ minX: -W / 2, maxX: -doorGap, minZ: D / 2 - 0.2, maxZ: D / 2 + 0.2 });
  walls.push({ minX: doorGap, maxX: W / 2, minZ: D / 2 - 0.2, maxZ: D / 2 + 0.2 });

  // Écran distributeur de tickets
  const ticketMachine = box(0.5, 1.2, 0.2, W / 2 - 1, 0.6, D / 2 - 1, 0x1a3a4a, 0.3, 0.6);
  ticketMachine.name = "ticket_dispenser";
  ticketMachine.userData = { interactive: true, type: "ticket_dispenser", branchId };
  g.add(ticketMachine);

  // Affichage numéro en attente
  const displayScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.8),
    matLib.getEmissive(0x0a0a0a, 0x00ff00, 0.6),
  );
  displayScreen.position.set(0, 2.8, -D / 2 + 0.15);
  displayScreen.name = "queue_display";
  displayScreen.userData = { branchId, type: "queue_display" };
  g.add(displayScreen);

  return {
    group: g,
    spawn: new THREE.Vector3(0, 0, D / 2 - 2.2),
    spawnYaw: Math.PI,
    exit: new THREE.Vector3(0, 0, D / 2 - 0.6),
    walls,
    title: "Caisse populaire Desjardins",
    subtitle: "Guichets · conseillers · voûte",
    atmSpot: { x: -W / 2 + 1.7, z: -D / 2 + 1.6 },
    desk: { x: 0, z: -D / 2 + 3.4 },
    vaultSpot: { x: W / 2 - 1.4, z: -D / 2 + 2.4 },
    tellers: tellerPositions,
    offices,
    vaultId,
    ticketMachine: { x: W / 2 - 1, y: 0.6, z: D / 2 - 1 },
    branchId,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 * PROMPTS D'INTERACTION (contextuels par rôle)
 * ═══════════════════════════════════════════════════════════════════ */

export function caissePrompt(interactiveType, targetId, playerId, branchId) {
  const branch = getBranch(branchId);
  if (!branch) return null;

  const role = getPlayerCaisseRole(playerId);
  const isEmployee = role?.branchId === branchId;

  // ═══ EMPLOYÉS ═══
  if (isEmployee) {
    switch (interactiveType) {
      case "teller_monitor": {
        const teller = TELLERS.get(targetId || "");
        if (!teller) return null;
        if (!teller.operatedBy) return "E — Ouvrir guichet";
        if (teller.operatedBy === playerId) {
          if (teller.currentCustomerId) return "E — Servir client";
          return "E — Appeler prochain client | F — Fermer guichet";
        }
        return "Guichet occupé";
      }

      case "vault_door": {
        const perms = getCaissePermissions(playerId);
        if (!perms.canAccessVault) return "🚫 Accès refusé";
        const vault = VAULTS.get(targetId || "");
        if (!vault) return null;
        if (vault.timeLockUntil && Date.now() < vault.timeLockUntil) {
          const min = Math.ceil((vault.timeLockUntil - Date.now()) / 60000);
          return `🔒 Time-lock ${min} min`;
        }
        return vault.isOpen ? "E — Fermer voûte" : "E — Ouvrir voûte (combinaison)";
      }

      case "advisor_desk":
        return "E — Bureau conseiller";

      case "panic_button":
        return "E — Alarme silencieuse (URGENCE)";

      case "atm":
        return "E — Vérifier GAB / Réapprovisionner";
    }
  }

  // ═══ CLIENTS ═══
  if (!branch.isOpen && interactiveType !== "atm") {
    return "🔴 Caisse fermée (9h-17h)";
  }

  switch (interactiveType) {
    case "ticket_dispenser":
      return "E — Prendre un numéro";

    case "teller_monitor": {
      const teller = TELLERS.get(targetId || "");
      if (!teller?.isOpen) return "Guichet fermé";
      if (teller.currentCustomerId === playerId) return "E — Faire opération";
      return `Guichet ${teller.isOpen ? "ouvert" : "fermé"} — attendez votre tour`;
    }

    case "advisor_desk":
      return "E — Prendre RDV avec conseiller";

    case "atm":
      return "E — Utiliser GAB";

    case "vault_door":
      return "🚫 Accès autorisé aux employés";
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════
 * ANIMATIONS
 * ═══════════════════════════════════════════════════════════════════ */

export function animateCaisse(root, elapsed) {
  root.traverse((obj) => {
    const led = obj;
    if (led.userData.isRecLed && led.material) {
      const m = led.material;
      if ("emissiveIntensity" in m) {
        m.emissiveIntensity = 1.1 + Math.sin(elapsed * 3) * 0.8;
      }
    }
  });
}

export function setCaisseNight(root, night) {
  root.traverse((obj) => {
    if (!obj.userData.isLit && !obj.userData.isSign) return;
    const mesh = obj;
    const m = mesh.material;
    if (m && "emissiveIntensity" in m) {
      m.emissiveIntensity = night ? 1.6 : 0.45;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════
 * MAP MARKS
 * ═══════════════════════════════════════════════════════════════════ */

export function caisseMapMarks() {
  return VILLAGES.map((v) => {
    const p = villageCivicSpot(v, "caisse");
    return { id: `caisse_${v.id}`, name: caisseNameFor(v.name), x: p.x, z: p.z };
  });
}

export function worldOffset(origin, yaw, lx, lz) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return { x: origin.x + lx * c + lz * s, z: origin.z - lx * s + lz * c };
}

/* ═══════════════════════════════════════════════════════════════════
 * EXPORTS POUR ACCÈS EXTERNE
 * ═══════════════════════════════════════════════════════════════════ */

/** @returns {Teller|null} */
export function getTeller(tellerId) {
  return TELLERS.get(tellerId) ?? null;
}

/** @returns {Teller[]} */
export function getBranchTellers(branchId) {
  return Array.from(TELLERS.values()).filter(t => t.branchId === branchId);
}

/** @returns {CaisseVault|null} */
export function getBranchVault(branchId) {
  return Array.from(VAULTS.values()).find(v => v.branchId === branchId) ?? null;
}

/** @returns {Robbery|null} */
export function getActiveRobbery(branchId) {
  return ACTIVE_ROBBERIES.get(branchId) ?? null;
}

/* ─────────────── ✅ NOUVEAUX GETTERS / UTILITAIRES ─────────────── */

/**
 * Récupère tous les RDV d'une succursale.
 * @returns {Appointment[]}
 */
export function getBranchAppointments(branchId) {
  return Array.from(APPOINTMENTS.values()).filter(a => a.branchId === branchId);
}

/**
 * Récupère l'état d'alarme d'une branche.
 * @returns {AlarmSystem|null}
 */
export function getBranchAlarm(branchId) {
  return ALARMS.get(branchId) ?? null;
}

/**
 * Liste les fourgons Garda actuellement en circulation.
 * @returns {GardaTruck[]}
 */
export function getGardaTrucks() {
  return Array.from(GARDA_TRUCKS.values());
}

/**
 * Liste les braquages actuellement en cours (toutes branches confondues).
 * @returns {Robbery[]}
 */
export function getAllRobberies() {
  return Array.from(ACTIVE_ROBBERIES.values());
}

/**
 * Liste les rôles bancaires attribués à un joueur (pour audit admin).
 * @returns {Array<{playerId:string, branchId:string, role:CaisseRole}>}
 */
export function getAllCaisseRoles() {
  return Array.from(PLAYER_CAISSE_ROLES.entries()).map(([playerId, info]) => ({
    playerId,
    branchId: info.branchId,
    role: info.role,
  }));
}

/**
 * Statistiques agrégées (dashboard admin).
 * @returns {object}
 */
export function getCaisseStats() {
  let totalVaultCash = 0;
  let totalTellerCash = 0;
  let openTellers = 0;
  let activeAlarms = 0;
  let waitingTickets = 0;

  for (const v of VAULTS.values()) totalVaultCash += v.cash;
  for (const t of TELLERS.values()) {
    totalTellerCash += t.cashDrawer;
    if (t.isOpen) openTellers++;
  }
  for (const a of ALARMS.values()) if (a.isActive) activeAlarms++;
  for (const t of QUEUE_TICKETS.values()) if (t.status === "waiting") waitingTickets++;

  return {
    tellersCount: TELLERS.size,
    openTellersCount: openTellers,
    vaultsCount: VAULTS.size,
    totalVaultCash,
    totalTellerCash,
    totalCashInSystem: totalVaultCash + totalTellerCash,
    branchesWithAlarm: activeAlarms,
    activeRobberiesCount: ACTIVE_ROBBERIES.size,
    gardaTrucksCount: GARDA_TRUCKS.size,
    waitingTicketsCount: waitingTickets,
    appointmentsCount: APPOINTMENTS.size,
    employeesWithRole: PLAYER_CAISSE_ROLES.size,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 * MAINTENANCE — Nettoyage des états périmés
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Purge les tickets, RDV et braquages périmés.
 * Appelé automatiquement si `startCaisseCleanupLoop()` est invoqué.
 * @returns {{tickets:number, appointments:number, robberies:number, trucks:number}}
 */
export function cleanupStaleState() {
  const now = Date.now();
  let removedTickets = 0;
  let removedAppointments = 0;
  let removedRobberies = 0;
  let removedTrucks = 0;

  // Tickets terminés/abandonnés depuis > STALE_TICKET_RETENTION_MS
  for (const [id, t] of QUEUE_TICKETS) {
    const isDone = t.status === "completed" || t.status === "abandoned";
    const ts = t.calledAt || t.requestedAt;
    if (isDone && now - ts > STALE_TICKET_RETENTION_MS) {
      QUEUE_TICKETS.delete(id);
      removedTickets++;
    }
  }

  // RDV terminés/annulés depuis > STALE_APPOINTMENT_RETENTION_MS
  for (const [id, a] of APPOINTMENTS) {
    const isDone = a.status === "completed" || a.status === "cancelled" || a.status === "no_show";
    if (isDone && now - a.scheduledFor > STALE_APPOINTMENT_RETENTION_MS) {
      APPOINTMENTS.delete(id);
      removedAppointments++;
    }
  }

  // Braquages zombies (déjà retirés de ACTIVE_ROBBERIES à endRobbery,
  // mais on garde ceinture-bretelles pour d'éventuels orphelins)
  for (const [branchId, r] of ACTIVE_ROBBERIES) {
    if (r.status !== "in_progress" && r.endTime && now - r.endTime > STALE_ROBBERY_RETENTION_MS) {
      ACTIVE_ROBBERIES.delete(branchId);
      removedRobberies++;
    }
  }

  // Fourgons bloqués en "loading" depuis > STALE_TRUCK_RETENTION_MS
  for (const [id, t] of GARDA_TRUCKS) {
    if (t.status === "loading" && now - t.eta > STALE_TRUCK_RETENTION_MS) {
      GARDA_TRUCKS.delete(id);
      removedTrucks++;
    }
  }

  if (removedTickets + removedAppointments + removedRobberies + removedTrucks > 0) {
    netEmit("caisse:cleanup", {
      tickets: removedTickets,
      appointments: removedAppointments,
      robberies: removedRobberies,
      trucks: removedTrucks,
    });
  }

  return {
    tickets: removedTickets,
    appointments: removedAppointments,
    robberies: removedRobberies,
    trucks: removedTrucks,
  };
}

/**
 * Lance une boucle de maintenance périodique.
 * Idempotent — un seul timer actif à la fois.
 * @param {number} [intervalMs=10*60*1000]
 */
export function startCaisseCleanupLoop(intervalMs = 10 * 60 * 1000) {
  if (cleanupTimerId != null) return;
  cleanupTimerId = setInterval(() => {
    try {
      cleanupStaleState();
    } catch (err) {
      console.error("[caisse] cleanup error:", err);
    }
  }, intervalMs);
}

/** Arrête la boucle de maintenance. */
export function stopCaisseCleanupLoop() {
  if (cleanupTimerId != null) {
    clearInterval(cleanupTimerId);
    cleanupTimerId = null;
  }
}

/**
 * Réinitialise COMPLÈTEMENT l'état en mémoire. À n'utiliser qu'en tests
 * ou sur un reset de serveur explicite.
 */
export function resetCaisseState() {
  TELLERS.clear();
  QUEUE_TICKETS.clear();
  APPOINTMENTS.clear();
  VAULTS.clear();
  ALARMS.clear();
  ACTIVE_ROBBERIES.clear();
  GARDA_TRUCKS.clear();
  PLAYER_CAISSE_ROLES.clear();
  signCache.clear();
  queueCounter = 100;
}

/* ═══════════════════════════════════════════════════════════════════
 * REMOTES (RPC multijoueur)
 * ═══════════════════════════════════════════════════════════════════ */

registerRemote("caisse:hire", hireCaisseEmployee);
registerRemote("caisse:fire", fireCaisseEmployee);
registerRemote("caisse:clock_in", clockInCaisse);
registerRemote("caisse:clock_out", clockOutCaisse);
registerRemote("caisse:take_ticket", takeTicket);
registerRemote("caisse:call_next", callNextTicket);
registerRemote("caisse:complete_service", completeTicketService);
registerRemote("caisse:schedule_appointment", scheduleAppointment);
registerRemote("caisse:assign_appointment", assignAppointment);
registerRemote("caisse:occupy_teller", occupyTeller);
registerRemote("caisse:leave_teller", leaveTeller);
registerRemote("caisse:teller_transaction", processTellerTransaction);
registerRemote("caisse:open_vault", openVault);
registerRemote("caisse:close_vault", closeVault);
registerRemote("caisse:transfer_to_teller", transferCashVaultToTeller);
registerRemote("caisse:rent_box", rentSafetyDeposit);
registerRemote("caisse:access_box", accessSafetyDeposit);
registerRemote("caisse:trigger_alarm", triggerAlarm);
registerRemote("caisse:disable_alarm", disableAlarm);
registerRemote("caisse:start_robbery", startRobbery);
registerRemote("caisse:collect_loot", collectLoot);
registerRemote("caisse:end_robbery", endRobbery);
registerRemote("caisse:request_garda", requestGardaTruck);
registerRemote("caisse:assign_garda", assignGardaJob);
registerRemote("caisse:complete_garda", completeGardaDelivery);

// ✅ NOUVEAUX REMOTES admin
registerRemote("caisse:force_close_vault", forceCloseVault);
registerRemote("caisse:cleanup", cleanupStaleState);
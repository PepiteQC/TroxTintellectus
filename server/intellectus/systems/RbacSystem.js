/**
 * ═══════════════════════════════════════════════════════════════════
 * 🛡️ TROXT⬡ — SYSTÈME RBAC COMPLET (v3.0 Platinum)
 * ═══════════════════════════════════════════════════════════════════
 * Architecture modulaire pour gestion admin complète :
 *   - Hiérarchie Platinum RBAC (15 grades)
 *   - Métiers RP (35+ professions)
 *   - Permissions granulaires (30+ flags)
 *   - Modules RP avancés (Dispatch, Casier, Primes, Fourrière)
 *   - Système de validation et helpers
 *
 * Signature : TROXT⬡
 * Chemin    : server\intellectus\admin
 * ═══════════════════════════════════════════════════════════════════
 */

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════
// 1. GRADES STAFF (Hiérarchie RBAC)
// ═══════════════════════════════════════════════════════════════════

export const AdminRole = Object.freeze({
  // Grades joueurs
  NONE: "none",

  // Staff débutant
  TRIAL_HELPER: "trial_helper",
  HELPER: "helper",

  // Modération
  TRIAL_MOD: "trial_mod",
  MOD: "mod",
  SENIOR_MOD: "senior_mod",

  // Administration
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
  HEAD_ADMIN: "head_admin",

  // Gestion communautaire
  COMMUNITY_MANAGER: "community_manager",
  EVENT_MANAGER: "event_manager",

  // Direction
  OWNER: "owner",

  // Développement
  DEVELOPER: "developer",
  SENIOR_DEV: "senior_dev",

  // IA
  INTELLECTUS_AI: "intellectus_ai",
});

// ═══════════════════════════════════════════════════════════════════
// 2. MÉTIERS RP (Badges staff & joueurs)
// ═══════════════════════════════════════════════════════════════════

export const RpJobRole = Object.freeze({
  // Civils
  CIVILIAN: "civilian",
  UNEMPLOYED: "unemployed",
  STUDENT: "student",

  // Forces de l'ordre (SQ)
  POLICE_CHIEF: "police_chief",
  POLICE_CAPTAIN: "police_captain",
  POLICE_LIEUTENANT: "police_lieutenant",
  POLICE_SERGEANT: "police_sergeant",
  POLICE_OFFICER: "police_officer",
  POLICE_CADET: "police_cadet",
  SECRET_AGENT: "secret_agent",
  MFFP_AGENT: "mffp_agent",

  // Services d'urgence
  MEDIC_DIRECTOR: "medic_director",
  PARAMEDIC: "paramedic",
  FIREFIGHTER: "firefighter",
  CORONER: "coroner",

  // Justice & Politique
  MAYOR: "mayor",
  JUDGE: "judge",
  LAWYER: "lawyer",
  NOTARY: "notary",

  // Commerce & Industrie
  DISPENSARY_OWNER: "dispensary_owner",
  MECHANIC: "mechanic",
  TRUCKER: "trucker",
  FARMER: "farmer",
  LUMBERJACK: "lumberjack",
  FISHERMAN: "fisherman",
  MINER: "miner",
  CONSTRUCTION: "construction",

  // Médias & Services
  JOURNALIST: "journalist",
  DETECTIVE: "detective",
  TAXI_DRIVER: "taxi_driver",
  REALTOR: "realtor",
  BARTENDER: "bartender",

  // Crime organisé
  MAFIA_BOSS: "mafia_boss",
  GANGSTER: "gangster",
  DEALER: "dealer",

  // Staff technique
  ETHER_ARCHITECT: "ether_architect",
});

// ═══════════════════════════════════════════════════════════════════
// 3. DÉPARTEMENTS OFFICIELS DU COMTÉ
// ═══════════════════════════════════════════════════════════════════

export const Department = Object.freeze({
  NONE: "none",

  // Forces de l'ordre
  SQ_PORTNEUF: "sq_portneuf",
  SQ_DONNACONA: "sq_donnacona",
  MFFP: "mffp",

  // Services d'urgence
  EMS_PORTNEUF: "ems_portneuf",
  FIRE_PORTNEUF: "fire_portneuf",

  // Gouvernement
  MRC_PORTNEUF: "mrc_portneuf",
  HYDRO_QUEBEC: "hydro_quebec",
  MTQ: "mtq",
  PALAIS_JUSTICE: "palais_justice",
  PENITENCIER: "penitencier",

  // Commerce
  SQDC: "sqdc",

  // Crime
  GANG_HELLS: "gang_hells",
  GANG_MAFIA: "gang_mafia",
});

// ═══════════════════════════════════════════════════════════════════
// 4. PERMISSIONS GRANULAIRES (Flags)
// ═══════════════════════════════════════════════════════════════════

export const Permission = Object.freeze({
  // MODÉRATION JOUEUR
  KICK: "kick",
  BAN: "ban",
  MUTE: "mute",
  WARN: "warn",
  JAIL: "jail",
  FREEZE: "freeze",

  // ADMINISTRATION SYSTÈME
  TELEPORT: "teleport",
  SPAWN_VEHICLE: "spawn_vehicle",
  SPAWN_ITEM: "spawn_item",
  SPAWN_WEAPON: "spawn_weapon",
  GOD_MODE: "god_mode",
  NOCLIP: "noclip",
  INVISIBLE: "invisible",

  // GESTION ÉCONOMIQUE
  GIVE_CASH: "give_cash",
  GIVE_BANK: "give_bank",
  SET_JOB: "set_job",
  SET_SALARY: "set_salary",

  // GESTION STAFF
  PROMOTE: "promote",
  DEMOTE: "demote",
  SET_ROLE: "set_role",
  VIEW_AUDIT: "view_audit",
  STAFF_CHAT: "staff_chat",

  // GESTION DU MONDE
  SET_WEATHER: "set_weather",
  SET_TIME: "set_time",
  SPAWN_EVENT: "spawn_event",
  BUILD_MODE: "build_mode",

  // OUTILS RP AVANCÉS
  ARREST: "arrest",
  TICKET: "ticket",
  SEARCH: "search",
  SEIZE: "seize",
  HEAL: "heal",
  REVIVE: "revive",
  DISPATCH: "dispatch",
  VIEW_RECORD: "view_record",
  IMPOUND: "impound",
  BOUNTY: "bounty",
});

const ALL_PERMISSIONS = Object.values(Permission);

// ═══════════════════════════════════════════════════════════════════
// 5. MAPPING RÔLE → PERMISSIONS
// ═══════════════════════════════════════════════════════════════════

export const ROLE_PERMISSIONS = Object.freeze({
  [AdminRole.NONE]: [],

  [AdminRole.TRIAL_HELPER]: [
    Permission.STAFF_CHAT,
    Permission.WARN,
  ],

  [AdminRole.HELPER]: [
    Permission.STAFF_CHAT,
    Permission.WARN,
    Permission.HEAL,
    Permission.TELEPORT,
  ],

  [AdminRole.TRIAL_MOD]: [
    Permission.STAFF_CHAT,
    Permission.WARN,
    Permission.KICK,
    Permission.MUTE,
    Permission.JAIL,
    Permission.HEAL,
    Permission.TELEPORT,
  ],

  [AdminRole.MOD]: [
    Permission.STAFF_CHAT, Permission.WARN, Permission.KICK, Permission.MUTE,
    Permission.JAIL, Permission.FREEZE, Permission.HEAL, Permission.REVIVE,
    Permission.TELEPORT, Permission.ARREST, Permission.TICKET, Permission.SEARCH,
    Permission.DISPATCH, Permission.VIEW_RECORD, Permission.IMPOUND, Permission.BOUNTY,
  ],

  [AdminRole.SENIOR_MOD]: [
    Permission.STAFF_CHAT, Permission.WARN, Permission.KICK, Permission.MUTE,
    Permission.JAIL, Permission.FREEZE, Permission.HEAL, Permission.REVIVE,
    Permission.TELEPORT, Permission.ARREST, Permission.TICKET, Permission.SEARCH,
    Permission.SEIZE, Permission.SPAWN_VEHICLE, Permission.DISPATCH,
    Permission.VIEW_RECORD, Permission.IMPOUND, Permission.BOUNTY,
  ],

  [AdminRole.ADMIN]: [
    Permission.STAFF_CHAT, Permission.WARN, Permission.KICK, Permission.MUTE,
    Permission.JAIL, Permission.FREEZE, Permission.BAN, Permission.HEAL,
    Permission.REVIVE, Permission.TELEPORT, Permission.ARREST, Permission.TICKET,
    Permission.SEARCH, Permission.SEIZE, Permission.SPAWN_VEHICLE,
    Permission.SPAWN_ITEM, Permission.GOD_MODE, Permission.NOCLIP,
    Permission.INVISIBLE, Permission.SET_WEATHER, Permission.SET_TIME,
    Permission.DISPATCH, Permission.VIEW_RECORD, Permission.IMPOUND, Permission.BOUNTY,
  ],

  [AdminRole.SUPERADMIN]: [
    Permission.STAFF_CHAT, Permission.WARN, Permission.KICK, Permission.MUTE,
    Permission.JAIL, Permission.FREEZE, Permission.BAN, Permission.HEAL,
    Permission.REVIVE, Permission.TELEPORT, Permission.ARREST, Permission.TICKET,
    Permission.SEARCH, Permission.SEIZE, Permission.SPAWN_VEHICLE,
    Permission.SPAWN_ITEM, Permission.SPAWN_WEAPON, Permission.GOD_MODE,
    Permission.NOCLIP, Permission.INVISIBLE, Permission.GIVE_CASH,
    Permission.GIVE_BANK, Permission.SET_WEATHER, Permission.SET_TIME,
    Permission.SPAWN_EVENT, Permission.BUILD_MODE, Permission.DISPATCH,
    Permission.VIEW_RECORD, Permission.IMPOUND, Permission.BOUNTY,
  ],

  [AdminRole.HEAD_ADMIN]: ALL_PERMISSIONS,

  [AdminRole.COMMUNITY_MANAGER]: [
    Permission.STAFF_CHAT, Permission.WARN, Permission.KICK, Permission.MUTE,
    Permission.HEAL, Permission.TELEPORT, Permission.SPAWN_EVENT, Permission.SET_WEATHER,
  ],

  [AdminRole.EVENT_MANAGER]: [
    Permission.STAFF_CHAT, Permission.TELEPORT, Permission.SPAWN_EVENT,
    Permission.SPAWN_ITEM, Permission.SPAWN_VEHICLE, Permission.SET_WEATHER,
    Permission.SET_TIME, Permission.GOD_MODE, Permission.BUILD_MODE,
  ],

  [AdminRole.OWNER]: ALL_PERMISSIONS,
  [AdminRole.DEVELOPER]: ALL_PERMISSIONS,
  [AdminRole.SENIOR_DEV]: ALL_PERMISSIONS,
  [AdminRole.INTELLECTUS_AI]: ALL_PERMISSIONS,
});

// ═══════════════════════════════════════════════════════════════════
// 6. NIVEAUX D'ACCÈS AUX ZONES
// ═══════════════════════════════════════════════════════════════════

export const ZoneAccess = Object.freeze({
  PUBLIC: 0,
  RESTRICTED: 1,
  STAFF_ONLY: 2,
  DEV_ONLY: 3,
});

// ═══════════════════════════════════════════════════════════════════
// 7. HIÉRARCHIE NUMÉRIQUE
// ═══════════════════════════════════════════════════════════════════

export const ROLE_HIERARCHY = Object.freeze({
  [AdminRole.NONE]: 0,
  [AdminRole.TRIAL_HELPER]: 1,
  [AdminRole.HELPER]: 2,
  [AdminRole.TRIAL_MOD]: 3,
  [AdminRole.MOD]: 4,
  [AdminRole.SENIOR_MOD]: 5,
  [AdminRole.ADMIN]: 6,
  [AdminRole.SUPERADMIN]: 7,
  [AdminRole.HEAD_ADMIN]: 8,
  [AdminRole.COMMUNITY_MANAGER]: 8,
  [AdminRole.EVENT_MANAGER]: 7,
  [AdminRole.OWNER]: 9,
  [AdminRole.DEVELOPER]: 10,
  [AdminRole.SENIOR_DEV]: 11,
  [AdminRole.INTELLECTUS_AI]: 12,
});

export const ROLE_LADDER = Object.freeze([
  AdminRole.NONE,
  AdminRole.TRIAL_HELPER,
  AdminRole.HELPER,
  AdminRole.TRIAL_MOD,
  AdminRole.MOD,
  AdminRole.SENIOR_MOD,
  AdminRole.ADMIN,
  AdminRole.SUPERADMIN,
  AdminRole.HEAD_ADMIN,
  AdminRole.OWNER,
  AdminRole.DEVELOPER,
  AdminRole.SENIOR_DEV,
  AdminRole.INTELLECTUS_AI,
]);

// ═══════════════════════════════════════════════════════════════════
// 8. ALIAS DE PARSING (FR/EN)
// ═══════════════════════════════════════════════════════════════════

const ROLE_ALIASES = Object.freeze({
  // Français
  aucun: AdminRole.NONE,
  joueur: AdminRole.NONE,
  citoyen: AdminRole.NONE,
  stagiaire: AdminRole.TRIAL_HELPER,
  modo: AdminRole.MOD,
  moderateur: AdminRole.MOD,
  super: AdminRole.SUPERADMIN,
  head: AdminRole.HEAD_ADMIN,
  fondateur: AdminRole.OWNER,
  proprio: AdminRole.OWNER,
  dev: AdminRole.DEVELOPER,
  programmeur: AdminRole.DEVELOPER,
  intellectus: AdminRole.INTELLECTUS_AI,
  ia: AdminRole.INTELLECTUS_AI,

  // Anglais
  none: AdminRole.NONE,
  player: AdminRole.NONE,
  trial_helper: AdminRole.TRIAL_HELPER,
  helper: AdminRole.HELPER,
  help: AdminRole.HELPER,
  trial_mod: AdminRole.TRIAL_MOD,
  mod: AdminRole.MOD,
  moderator: AdminRole.MOD,
  senior_mod: AdminRole.SENIOR_MOD,
  admin: AdminRole.ADMIN,
  administrator: AdminRole.ADMIN,
  superadmin: AdminRole.SUPERADMIN,
  head_admin: AdminRole.HEAD_ADMIN,
  community: AdminRole.COMMUNITY_MANAGER,
  community_manager: AdminRole.COMMUNITY_MANAGER,
  event: AdminRole.EVENT_MANAGER,
  event_manager: AdminRole.EVENT_MANAGER,
  owner: AdminRole.OWNER,
  developer: AdminRole.DEVELOPER,
  senior_dev: AdminRole.SENIOR_DEV,
  intellectus_ai: AdminRole.INTELLECTUS_AI,
  ai: AdminRole.INTELLECTUS_AI,
});

const JOB_ALIASES = Object.freeze({
  // Civils
  civilian: RpJobRole.CIVILIAN,
  civil: RpJobRole.CIVILIAN,
  citoyen: RpJobRole.CIVILIAN,
  unemployed: RpJobRole.UNEMPLOYED,
  chomeur: RpJobRole.UNEMPLOYED,
  student: RpJobRole.STUDENT,
  etudiant: RpJobRole.STUDENT,

  // Police
  police_chief: RpJobRole.POLICE_CHIEF,
  chef: RpJobRole.POLICE_CHIEF,
  chef_sq: RpJobRole.POLICE_CHIEF,
  police_captain: RpJobRole.POLICE_CAPTAIN,
  capitaine: RpJobRole.POLICE_CAPTAIN,
  police_lieutenant: RpJobRole.POLICE_LIEUTENANT,
  lieutenant: RpJobRole.POLICE_LIEUTENANT,
  police_sergeant: RpJobRole.POLICE_SERGEANT,
  sergent: RpJobRole.POLICE_SERGEANT,
  police_officer: RpJobRole.POLICE_OFFICER,
  policier: RpJobRole.POLICE_OFFICER,
  sq: RpJobRole.POLICE_OFFICER,
  patrouilleur: RpJobRole.POLICE_OFFICER,
  constable: RpJobRole.POLICE_OFFICER,
  police_cadet: RpJobRole.POLICE_CADET,
  cadet: RpJobRole.POLICE_CADET,
  secret_agent: RpJobRole.SECRET_AGENT,
  agent: RpJobRole.SECRET_AGENT,
  infiltre: RpJobRole.SECRET_AGENT,
  mffp_agent: RpJobRole.MFFP_AGENT,
  mffp: RpJobRole.MFFP_AGENT,
  garde_chasse: RpJobRole.MFFP_AGENT,

  // Urgences
  medic_director: RpJobRole.MEDIC_DIRECTOR,
  paramedic: RpJobRole.PARAMEDIC,
  ambulancier: RpJobRole.PARAMEDIC,
  technicien: RpJobRole.PARAMEDIC,
  firefighter: RpJobRole.FIREFIGHTER,
  pompier: RpJobRole.FIREFIGHTER,
  coroner: RpJobRole.CORONER,

  // Justice
  mayor: RpJobRole.MAYOR,
  maire: RpJobRole.MAYOR,
  judge: RpJobRole.JUDGE,
  juge: RpJobRole.JUDGE,
  lawyer: RpJobRole.LAWYER,
  avocat: RpJobRole.LAWYER,
  notary: RpJobRole.NOTARY,
  notaire: RpJobRole.NOTARY,

  // Commerce
  dispensary_owner: RpJobRole.DISPENSARY_OWNER,
  sqdc: RpJobRole.DISPENSARY_OWNER,
  mechanic: RpJobRole.MECHANIC,
  mecanicien: RpJobRole.MECHANIC,
  trucker: RpJobRole.TRUCKER,
  camionneur: RpJobRole.TRUCKER,
  farmer: RpJobRole.FARMER,
  fermier: RpJobRole.FARMER,
  lumberjack: RpJobRole.LUMBERJACK,
  bucheron: RpJobRole.LUMBERJACK,
  fisherman: RpJobRole.FISHERMAN,
  pecheur: RpJobRole.FISHERMAN,
  miner: RpJobRole.MINER,
  mineur: RpJobRole.MINER,
  construction: RpJobRole.CONSTRUCTION,

  // Médias
  journalist: RpJobRole.JOURNALIST,
  journaliste: RpJobRole.JOURNALIST,
  detective: RpJobRole.DETECTIVE,
  taxi_driver: RpJobRole.TAXI_DRIVER,
  taxi: RpJobRole.TAXI_DRIVER,
  realtor: RpJobRole.REALTOR,
  courtier: RpJobRole.REALTOR,
  bartender: RpJobRole.BARTENDER,
  barman: RpJobRole.BARTENDER,

  // Crime
  mafia_boss: RpJobRole.MAFIA_BOSS,
  parrain: RpJobRole.MAFIA_BOSS,
  gangster: RpJobRole.GANGSTER,
  criminel: RpJobRole.GANGSTER,
  dealer: RpJobRole.DEALER,

  // Staff
  ether_architect: RpJobRole.ETHER_ARCHITECT,
  architecte: RpJobRole.ETHER_ARCHITECT,
});

const DEPARTMENT_ALIASES = Object.freeze({
  none: Department.NONE,
  sq_portneuf: Department.SQ_PORTNEUF,
  sq: Department.SQ_PORTNEUF,
  portneuf: Department.SQ_PORTNEUF,
  sq_donnacona: Department.SQ_DONNACONA,
  donnacona: Department.SQ_DONNACONA,
  ems_portneuf: Department.EMS_PORTNEUF,
  ems: Department.EMS_PORTNEUF,
  fire_portneuf: Department.FIRE_PORTNEUF,
  fire: Department.FIRE_PORTNEUF,
  pompier: Department.FIRE_PORTNEUF,
  mffp: Department.MFFP,
  mrc_portneuf: Department.MRC_PORTNEUF,
  mrc: Department.MRC_PORTNEUF,
  hydro_quebec: Department.HYDRO_QUEBEC,
  hydro: Department.HYDRO_QUEBEC,
  hq: Department.HYDRO_QUEBEC,
  mtq: Department.MTQ,
  palais_justice: Department.PALAIS_JUSTICE,
  justice: Department.PALAIS_JUSTICE,
  penitencier: Department.PENITENCIER,
  prison: Department.PENITENCIER,
  sqdc: Department.SQDC,
  cannabis: Department.SQDC,
  gang_hells: Department.GANG_HELLS,
  hells: Department.GANG_HELLS,
  gang_mafia: Department.GANG_MAFIA,
  mafia: Department.GANG_MAFIA,
});

// ═══════════════════════════════════════════════════════════════════
// 9. FONCTIONS DE PARSING & VÉRIFICATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse une chaîne brute en AdminRole valide.
 * @param {unknown} raw
 * @returns {string|null} AdminRole ou null si invalide
 */
export function parseAdminRole(raw) {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return ROLE_ALIASES[normalized] ?? null;
}

/**
 * Parse une chaîne brute en RpJobRole valide.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function parseRpJobRole(raw) {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return JOB_ALIASES[normalized] ?? null;
}

/**
 * Parse une chaîne brute en Department valide.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function parseDepartment(raw) {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return DEPARTMENT_ALIASES[normalized] ?? null;
}

/**
 * Vérifie si un rôle possède une permission spécifique.
 * @param {string} role - AdminRole
 * @param {string} permission - Permission
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(permission);
}

/**
 * Retourne toutes les permissions d'un rôle.
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissions(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Retourne le niveau hiérarchique numérique d'un rôle.
 * @param {string} role
 * @returns {number}
 */
export function getRoleLevel(role) {
  return ROLE_HIERARCHY[role] ?? 0;
}

/**
 * Vérifie si un acteur peut effectuer une action sur une cible.
 * L'acteur doit avoir la permission ET être hiérarchiquement supérieur.
 * @param {string} actorRole
 * @param {string} targetRole
 * @param {string} permission
 * @returns {boolean}
 */
export function canPerformAction(actorRole, targetRole, permission) {
  if (!hasPermission(actorRole, permission)) return false;
  if (actorRole === AdminRole.INTELLECTUS_AI || actorRole === AdminRole.OWNER) return true;
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}

// ═══════════════════════════════════════════════════════════════════
// 10. VALIDATION RUNTIME (remplace les type guards TS)
// ═══════════════════════════════════════════════════════════════════

const VALID_ADMIN_ROLES = new Set(Object.values(AdminRole));
const VALID_JOB_ROLES = new Set(Object.values(RpJobRole));
const VALID_PERMISSIONS = new Set(Object.values(Permission));

export function isValidAdminRole(role) {
  return typeof role === "string" && VALID_ADMIN_ROLES.has(role);
}

export function isValidRpJobRole(job) {
  return typeof job === "string" && VALID_JOB_ROLES.has(job);
}

export function isValidPermission(perm) {
  return typeof perm === "string" && VALID_PERMISSIONS.has(perm);
}

// ═══════════════════════════════════════════════════════════════════
// 11. MODULE DISPATCH 911
// ═══════════════════════════════════════════════════════════════════

export const DispatchPriority = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

export const DispatchStatus = Object.freeze({
  PENDING: "pending",
  DISPATCHED: "dispatched",
  ON_SCENE: "on_scene",
  RESOLVED: "resolved",
  CANCELLED: "cancelled",
});

export const DispatchDepartmentTag = Object.freeze({
  SQ: "sq",
  EMS: "ems",
  FIRE: "fire",
  MFFP: "mffp",
  TOUS: "tous",
});

/**
 * @typedef {object} DispatchCall
 * @property {string} id
 * @property {string} code
 * @property {string} label
 * @property {string} department - DispatchDepartmentTag
 * @property {string} priority   - DispatchPriority
 * @property {string} status     - DispatchStatus
 * @property {string} locationName
 * @property {number} x
 * @property {number} z
 * @property {string} callerId
 * @property {string} callerName
 * @property {number} createdAt
 * @property {string[]} assignedTo
 * @property {number} [resolvedAt]
 * @property {string} [notes]
 */

// ═══════════════════════════════════════════════════════════════════
// 12. MODULE CASIER JUDICIAIRE
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} CriminalCharge
 * @property {string} id
 * @property {string} identifier
 * @property {string} displayName
 * @property {string} article
 * @property {string} description
 * @property {number} fine
 * @property {number} jailMonths
 * @property {string} officerId
 * @property {string} officerName
 * @property {number} createdAt
 */

// ═══════════════════════════════════════════════════════════════════
// 13. MODULE PRIMES (BOUNTIES)
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} Bounty
 * @property {string} id
 * @property {string} targetId
 * @property {string} targetName
 * @property {number} amount
 * @property {string} issuedBy
 * @property {string} issuedByName
 * @property {string} reason
 * @property {number} createdAt
 * @property {string} [claimedBy]
 * @property {number} [claimedAt]
 * @property {boolean} active
 */

// ═══════════════════════════════════════════════════════════════════
// 14. MODULE FOURRIÈRE
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} ImpoundRecord
 * @property {string} id
 * @property {string} vehicleId
 * @property {string} ownerId
 * @property {string} ownerName
 * @property {string} reason
 * @property {number} impoundedAt
 * @property {number} feeAmount
 * @property {number} [releasedAt]
 * @property {string} [releasedBy]
 */

// ═══════════════════════════════════════════════════════════════════
// 15. MODULE SIGNALEMENTS
// ═══════════════════════════════════════════════════════════════════

export const ReportStatus = Object.freeze({
  OPEN: "open",
  CLAIMED: "claimed",
  RESOLVED: "resolved",
  DISMISSED: "dismissed",
});

/**
 * @typedef {object} PlayerReport
 * @property {string} id
 * @property {string} reporterId
 * @property {string} reporterName
 * @property {string} [targetId]
 * @property {string} [targetName]
 * @property {string} reason
 * @property {string} status - ReportStatus
 * @property {number} createdAt
 * @property {string} [claimedBy]
 * @property {number} [resolvedAt]
 * @property {string} [resolutionNote]
 */

// ═══════════════════════════════════════════════════════════════════
// 16. TYPES POUR ACTIONS ADMIN
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} AdminActionResult
 * @property {boolean} success
 * @property {string} message
 * @property {unknown} [data]
 *
 * @typedef {object} AdminAction
 * @property {string} actorId
 * @property {string} [targetId]
 * @property {string} permission - Permission
 * @property {Record<string, unknown>} [args]
 */

// ═══════════════════════════════════════════════════════════════════
// 17. CONSTANTES & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

export const ADMIN_CONSTANTS = Object.freeze({
  WARN_THRESHOLD: 3,
  AUTO_BAN_DAYS: 7,
  MAX_AUDIT_LOG: 500,
  MAX_SANCTIONS: 200,
  MAX_DISPATCH: 200,
  MAX_REPORTS: 200,
  IMPOUND_BASE_FEE: 250,
  IMPOUND_DAILY_FEE: 40,
});

// ═══════════════════════════════════════════════════════════════════
// 18. ÉVÉNEMENTS SYSTÈME
// ═══════════════════════════════════════════════════════════════════

export const AdminEvent = Object.freeze({
  ROLE_CHANGED: "admin:role_changed",
  JOB_CHANGED: "admin:job_changed",
  SANCTION_ISSUED: "admin:sanction_issued",
  SANCTION_REVOKED: "admin:sanction_revoked",
  DUTY_TOGGLED: "admin:duty_toggled",
  REPORT_CREATED: "admin:report_created",
  REPORT_RESOLVED: "admin:report_resolved",
  DISPATCH_CREATED: "admin:dispatch_created",
  DISPATCH_UPDATED: "admin:dispatch_updated",
  BOUNTY_PLACED: "admin:bounty_placed",
  BOUNTY_CLAIMED: "admin:bounty_claimed",
});

// ═══════════════════════════════════════════════════════════════════
// 19. TYPES DE COMMANDES ADMIN (JSDoc)
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} CommandContext
 * @property {{ sessionId: string, username: string, role: string }} sender
 * @property {string[]} args
 * @property {string} raw
 * @property {any} room
 *
 * @typedef {object} CommandDefinition
 * @property {string} name
 * @property {string} permission - AdminRole
 * @property {number} [minArgs]
 * @property {string} usage
 * @property {string} description
 * @property {string} category
 * @property {string[]} [aliases]
 * @property {function(CommandContext): void|unknown} handler
 *
 * @typedef {object} ServerPerformanceMetrics
 * @property {number} fps
 * @property {number} pingMs
 * @property {number} playersCount
 * @property {number} vehiclesCount
 * @property {number} entitiesCount
 * @property {number} memoryUsageMB
 * @property {number} networkKbps
 * @property {number} uptimeSeconds
 *
 * @typedef {object} StaffEntry
 * @property {string} identifier
 * @property {string} displayName
 * @property {string} role - AdminRole
 * @property {string} job - RpJobRole
 * @property {string} [department] - Department
 * @property {boolean} [onDuty]
 * @property {number} [joinedAt]
 * @property {number} [lastSeen]
 *
 * @typedef {object} RoleBadge
 * @property {string} label
 * @property {string} color
 * @property {string} bg
 * @property {string} border
 * @property {string} [icon]
 *
 * @typedef {object} JobBadge
 * @property {string} label
 * @property {string} color
 * @property {string} [department]
 * @property {string} [icon]
 */

// ═══════════════════════════════════════════════════════════════════
// EXPORT PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════

export default {
  AdminRole,
  RpJobRole,
  Department,
  Permission,
  ZoneAccess,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  ROLE_LADDER,
  DispatchPriority,
  DispatchStatus,
  DispatchDepartmentTag,
  ReportStatus,
  AdminEvent,
  ADMIN_CONSTANTS,
  parseAdminRole,
  parseRpJobRole,
  parseDepartment,
  hasPermission,
  getPermissions,
  getRoleLevel,
  canPerformAction,
  isValidAdminRole,
  isValidRpJobRole,
  isValidPermission,
  SIG,
};
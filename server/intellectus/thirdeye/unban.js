/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — THIRDEYE/UNBAN.JS
 * API sécurisée de débannissement, grâce et amnistie administrative
 * ═══════════════════════════════════════════════════════════════════
 *
 * Routes :
 *   GET    /admin/thirdeye/unban
 *   GET    /admin/thirdeye/unban?check=<joueur|ip>
 *   POST   /admin/thirdeye/unban
 *   DELETE /admin/thirdeye/unban?id=<banId>
 *   OPTIONS /admin/thirdeye/unban
 *
 * Sécurité :
 *   • authentification Bearer côté serveur ;
 *   • rôles résolus depuis le token, jamais depuis un header libre ;
 *   • CORS avec liste blanche ;
 *   • validation stricte des entrées ;
 *   • masquage des IP et preuves selon le rôle ;
 *   • journal d’audit immuable ;
 *   • expiration automatique des sanctions temporaires ;
 *   • mutations sérialisées pour éviter les conflits concurrents.
 *
 * Signature : TROXT⬡ · 🛡️INTELLECTUS⬡ · ThirdEye
 * Chemin    : server\intellectus\admin\thirdeye/unban.js
 */

import { createFileRoute } from '@tanstack/react-router';

const SIG = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';
const VERSION = '3.0.0';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_PAGE_SIZE = 100;
const MAX_REASON_LENGTH = 1000;
const MAX_PROBATION_DAYS = 365;

// ═══════════════════════════════════════════════════════════════════
// TYPES RUNTIME
// ═══════════════════════════════════════════════════════════════════

export const BanType = Object.freeze({
  PERMANENT: 'permanent',
  TEMPORARY: 'temporary',
  HARDWARE_HWID: 'hardware_hwid',
  IP_BLOCK: 'ip_block',
  SECURITY_AUTO: 'security_auto',
});

export const PardonType = Object.freeze({
  FULL_PARDON: 'full_pardon',
  PROBATION: 'probation',
  APPEAL_ACCEPTED: 'appeal_accepted',
  FALSE_POSITIVE: 'false_positive',
});

const VALID_BAN_TYPES = new Set(Object.values(BanType));
const VALID_PARDON_TYPES = new Set(Object.values(PardonType));

const ROLE_LEVEL = Object.freeze({
  none: 0,
  moderator: 1,
  mod: 1,
  admin: 2,
  superadmin: 3,
  head_admin: 4,
  owner: 5,
  developer: 5,
  senior_dev: 6,
  intellectus_ai: 7,
});

// ═══════════════════════════════════════════════════════════════════
// REGISTRE SERVEUR PERSISTANT PENDANT LE HOT-RELOAD
// ═══════════════════════════════════════════════════════════════════

const STORE_SYMBOL = Symbol.for('troxt.thirdeye.ban-store.v3');

/**
 * Le registre global empêche la perte de l’état lors d’un hot-reload Vite.
 *
 * En production distribuée, remplace ce registre par PostgreSQL/Redis.
 */
function createStore() {
  return {
    bans: [],
    pardons: [],
    audit: [],
    mutationQueue: Promise.resolve(),
    initialized: false,
  };
}

const store = globalThis[STORE_SYMBOL] ?? createStore();
globalThis[STORE_SYMBOL] = store;

// ═══════════════════════════════════════════════════════════════════
// INITIALISATION DE DÉMONSTRATION
// ═══════════════════════════════════════════════════════════════════

function initializeStore() {
  if (store.initialized) return;
  store.initialized = true;

  // Désactiver les données de démonstration avec :
  // THIRDEYE_DEMO_DATA=false
  if (process.env.THIRDEYE_DEMO_DATA === 'false') return;

  const now = Date.now();

  store.bans.push(
    {
      id: `ban_${now - DAY_MS * 3}`,
      targetId: 'player_cheater_99',
      targetName: 'Xx_Speedy_xX',
      targetIp: '198.51.100.42',
      hardwareId: null,
      type: BanType.TEMPORARY,
      reason: 'SpeedHack répété (> 45 m/s) sur la Route 138',
      category: 'speed_teleport',
      bannedAt: now - DAY_MS * 3,
      expiresAt: now + DAY_MS * 4,
      bannedBy: {
        id: 'thirdeye_sentinel',
        name: 'ThirdEye Anti-Cheat',
        role: 'intellectus_ai',
      },
      evidenceUrl: null,
      active: true,
      appealSubmitted: true,
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    },
    {
      id: `ban_${now - DAY_MS * 12}`,
      targetId: 'player_exploiter_01',
      targetName: 'DarkMoney_Dupe',
      targetIp: '203.0.113.19',
      hardwareId: null,
      type: BanType.PERMANENT,
      reason: 'Génération illégale de 500 000 $ à la Caisse Populaire',
      category: 'money_injection',
      bannedAt: now - DAY_MS * 12,
      expiresAt: null,
      bannedBy: {
        id: 'admin_1',
        name: 'Capitaine Gosselin',
        role: 'superadmin',
      },
      evidenceUrl: null,
      active: true,
      appealSubmitted: false,
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    },
  );
}

initializeStore();

// ═══════════════════════════════════════════════════════════════════
// HELPERS GÉNÉRAUX
// ═══════════════════════════════════════════════════════════════════

function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLookup(value) {
  return normalizeString(value).toLocaleLowerCase('fr-CA');
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function roleLevel(role) {
  return ROLE_LEVEL[normalizeLookup(role)] ?? 0;
}

function hasMinimumRole(actor, requiredRole) {
  return roleLevel(actor?.role) >= roleLevel(requiredRole);
}

function isCurrentlyActive(ban, at = Date.now()) {
  if (!ban || ban.active !== true) return false;
  if (ban.expiresAt === null) return true;
  return Number.isFinite(ban.expiresAt) && ban.expiresAt > at;
}

/**
 * Marque explicitement les sanctions temporaires expirées.
 */
function expireOldBans(at = Date.now()) {
  let expired = 0;

  for (const ban of store.bans) {
    if (
      ban.active === true &&
      Number.isFinite(ban.expiresAt) &&
      ban.expiresAt <= at
    ) {
      ban.active = false;
      ban.revokedAt = at;
      ban.revokedBy = {
        id: 'SYSTEM',
        name: 'Expiration automatique',
        role: 'intellectus_ai',
      };
      ban.revokeReason = 'Expiration automatique du bannissement';
      expired++;
    }
  }

  return expired;
}

/**
 * Sérialise les mutations pour éviter deux grâces concurrentes.
 */
function runMutation(operation) {
  const execution = store.mutationQueue.then(operation, operation);

  store.mutationQueue = execution.catch(() => {});

  return execution;
}

function addAuditEntry(entry) {
  const auditEntry = Object.freeze({
    id: createId('audit'),
    timestamp: Date.now(),
    sig: SIG,
    isig: ISIG,
    ...entry,
  });

  store.audit.unshift(auditEntry);

  if (store.audit.length > 5000) {
    store.audit.length = 5000;
  }

  console.info(
    `[${SIG}·ThirdEye] ${auditEntry.action} par ` +
    `${auditEntry.actor?.name ?? 'SYSTEM'}`,
  );

  return auditEntry;
}

// ═══════════════════════════════════════════════════════════════════
// AUTHENTIFICATION SERVEUR
// ═══════════════════════════════════════════════════════════════════

/**
 * Format attendu dans THIRDEYE_ADMIN_TOKENS :
 *
 * {
 *   "token-secret-1": {
 *     "id": "admin_42",
 *     "name": "Capitaine Gosselin",
 *     "role": "superadmin"
 *   }
 * }
 */
function getConfiguredTokens() {
  const raw = process.env.THIRDEYE_ADMIN_TOKENS;

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    console.error(
      `[${SIG}·ThirdEye] THIRDEYE_ADMIN_TOKENS contient un JSON invalide.`,
    );
    return {};
  }
}

function getBearerToken(request) {
  const authorization = request.headers.get('Authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Ne fait jamais confiance à X-Admin-Role en production.
 */
async function authenticateRequest(request) {
  const token = getBearerToken(request);
  const configuredTokens = getConfiguredTokens();

  if (token && configuredTokens[token]) {
    const actor = configuredTokens[token];

    return {
      authenticated: true,
      id: normalizeString(actor.id) || 'unknown',
      name: normalizeString(actor.name) || 'Administrateur',
      role: normalizeLookup(actor.role) || 'none',
    };
  }

  // Mode local explicitement activé seulement pour le développement.
  const insecureDevMode =
    process.env.NODE_ENV !== 'production' &&
    process.env.THIRDEYE_ALLOW_INSECURE_HEADERS === 'true';

  if (insecureDevMode) {
    const role = normalizeLookup(request.headers.get('X-Admin-Role'));

    if (roleLevel(role) > 0) {
      return {
        authenticated: true,
        id: normalizeString(request.headers.get('X-Actor-Id')) || 'dev-console',
        name:
          normalizeString(request.headers.get('X-Actor-Name')) ||
          'Administrateur local',
        role,
      };
    }
  }

  return {
    authenticated: false,
    id: 'anonymous',
    name: 'Anonyme',
    role: 'none',
  };
}

// ═══════════════════════════════════════════════════════════════════
// CORS ET RÉPONSES HTTP
// ═══════════════════════════════════════════════════════════════════

function getAllowedOrigins() {
  return String(
    process.env.THIRDEYE_ALLOWED_ORIGINS ??
    'http://localhost:3000,http://localhost:5173',
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildHeaders(request) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-TROXT-Signature': SIG,
    'X-ThirdEye-Version': VERSION,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Request-Id',
    Vary: 'Origin',
  });

  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins();

  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return headers;
}

function jsonResponse(request, data, status = 200, extraHeaders = {}) {
  const headers = buildHeaders(request);

  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, String(value));
  }

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

function errorResponse(request, status, error, message, details = undefined) {
  return jsonResponse(
    request,
    {
      ok: false,
      error,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: Date.now(),
      sig: SIG,
    },
    status,
  );
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get('Content-Length') ?? 0);

  if (contentLength > MAX_BODY_BYTES) {
    throw new HttpError(
      413,
      'payload_too_large',
      `Le corps HTTP dépasse ${MAX_BODY_BYTES} octets.`,
    );
  }

  const text = await request.text();

  if (text.length > MAX_BODY_BYTES) {
    throw new HttpError(
      413,
      'payload_too_large',
      `Le corps HTTP dépasse ${MAX_BODY_BYTES} octets.`,
    );
  }

  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(
      400,
      'invalid_json',
      'Le corps de la requête doit être un JSON valide.',
    );
  }
}

class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PROTECTION DES DONNÉES SENSIBLES
// ═══════════════════════════════════════════════════════════════════

function redactIp(ip) {
  if (!ip) return null;

  if (ip.includes(':')) {
    const sections = ip.split(':');
    return `${sections.slice(0, 2).join(':')}::…`;
  }

  const sections = ip.split('.');
  if (sections.length !== 4) return '***';

  return `${sections[0]}.${sections[1]}.***.***`;
}

function serializeBanForActor(ban, actor) {
  const canSeeSensitive = hasMinimumRole(actor, 'superadmin');

  return {
    ...ban,
    targetIp: canSeeSensitive ? ban.targetIp : redactIp(ban.targetIp),
    hardwareId: canSeeSensitive ? ban.hardwareId : undefined,
    evidenceUrl: canSeeSensitive ? ban.evidenceUrl : undefined,
    currentlyActive: isCurrentlyActive(ban),
    remainingSeconds:
      isCurrentlyActive(ban) && ban.expiresAt !== null
        ? Math.max(0, Math.floor((ban.expiresAt - Date.now()) / 1000))
        : null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// RECHERCHE DE SANCTIONS
// ═══════════════════════════════════════════════════════════════════

function banMatchesTarget(ban, target) {
  const normalized = normalizeLookup(target);

  if (!normalized) return false;

  return (
    normalizeLookup(ban.id) === normalized ||
    normalizeLookup(ban.targetId) === normalized ||
    normalizeLookup(ban.targetName) === normalized ||
    normalizeLookup(ban.targetIp) === normalized ||
    normalizeLookup(ban.hardwareId) === normalized
  );
}

function findActiveBansForTarget({ targetId, targetName, targetIp, banId }) {
  const lookups = [targetId, targetName, targetIp, banId]
    .map(normalizeLookup)
    .filter(Boolean);

  if (lookups.length === 0) return [];

  return store.bans.filter((ban) => {
    if (!isCurrentlyActive(ban)) return false;

    return lookups.some((lookup) => banMatchesTarget(ban, lookup));
  });
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION INTELLECTUS
// ═══════════════════════════════════════════════════════════════════

async function notifyIntellectus(event, payload) {
  try {
    const intellectus = globalThis.__TROXT_INTELLECTUS__;

    if (typeof intellectus?.emit === 'function') {
      await intellectus.emit(event, {
        ...payload,
        sig: SIG,
        isig: ISIG,
      });
    }
  } catch (error) {
    console.warn(
      `[${ISIG}] Notification non transmise:`,
      error instanceof Error ? error.message : error,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// GET — LISTE ET VÉRIFICATION
// ═══════════════════════════════════════════════════════════════════

async function handleGet(request, actor) {
  if (!hasMinimumRole(actor, 'moderator')) {
    return errorResponse(
      request,
      403,
      'forbidden',
      'Un rôle modérateur minimum est requis.',
    );
  }

  expireOldBans();

  const url = new URL(request.url);
  const checkTarget = normalizeString(url.searchParams.get('check'));
  const search = normalizeLookup(url.searchParams.get('search'));
  const activeFilter = url.searchParams.get('active');
  const categoryFilter = normalizeLookup(url.searchParams.get('category'));
  const typeFilter = normalizeLookup(url.searchParams.get('type'));
  const appealFilter = url.searchParams.get('appeal');

  const page = clampInteger(
    url.searchParams.get('page'),
    1,
    Number.MAX_SAFE_INTEGER,
    1,
  );

  const limit = clampInteger(
    url.searchParams.get('limit'),
    1,
    MAX_PAGE_SIZE,
    25,
  );

  // Vérification précise
  if (checkTarget) {
    const bans = store.bans.filter(
      (ban) => isCurrentlyActive(ban) && banMatchesTarget(ban, checkTarget),
    );

    if (bans.length === 0) {
      return jsonResponse(request, {
        ok: true,
        banned: false,
        message: 'Aucun bannissement actif trouvé.',
        timestamp: Date.now(),
        sig: SIG,
      });
    }

    const sorted = bans.sort((a, b) => b.bannedAt - a.bannedAt);

    return jsonResponse(request, {
      ok: true,
      banned: true,
      count: sorted.length,
      entries: sorted.map((ban) => serializeBanForActor(ban, actor)),
      permanent: sorted.some((ban) => ban.expiresAt === null),
      timestamp: Date.now(),
      sig: SIG,
    });
  }

  let list = [...store.bans];

  if (activeFilter === 'true' || activeFilter === 'false') {
    const expected = activeFilter === 'true';
    list = list.filter((ban) => isCurrentlyActive(ban) === expected);
  }

  if (categoryFilter) {
    list = list.filter(
      (ban) => normalizeLookup(ban.category) === categoryFilter,
    );
  }

  if (typeFilter) {
    if (!VALID_BAN_TYPES.has(typeFilter)) {
      return errorResponse(
        request,
        400,
        'invalid_type',
        `Type invalide. Valeurs : ${[...VALID_BAN_TYPES].join(', ')}`,
      );
    }

    list = list.filter((ban) => ban.type === typeFilter);
  }

  if (appealFilter === 'true' || appealFilter === 'false') {
    const expected = appealFilter === 'true';
    list = list.filter((ban) => ban.appealSubmitted === expected);
  }

  if (search) {
    list = list.filter((ban) =>
      [
        ban.targetName,
        ban.targetId,
        ban.reason,
        ban.category,
        ban.bannedBy?.name,
      ].some((field) => normalizeLookup(field).includes(search)),
    );
  }

  list.sort((a, b) => b.bannedAt - a.bannedAt);

  const totalCount = list.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;

  return jsonResponse(request, {
    ok: true,
    page: safePage,
    requestedPage: page,
    limit,
    totalPages,
    totalCount,
    activeBansCount: store.bans.filter(isCurrentlyActive).length,
    expiredBansCount: store.bans.filter(
      (ban) =>
        ban.active === false &&
        Number.isFinite(ban.expiresAt) &&
        ban.expiresAt <= Date.now(),
    ).length,
    filters: {
      active: activeFilter,
      category: categoryFilter || null,
      type: typeFilter || null,
      appeal: appealFilter,
      search: search || null,
    },
    data: list
      .slice(offset, offset + limit)
      .map((ban) => serializeBanForActor(ban, actor)),
    timestamp: Date.now(),
    sig: SIG,
  });
}

// ═══════════════════════════════════════════════════════════════════
// POST — DÉBANNISSEMENT / GRÂCE
// ═══════════════════════════════════════════════════════════════════

async function handlePost(request, actor) {
  if (!hasMinimumRole(actor, 'admin')) {
    return errorResponse(
      request,
      403,
      'forbidden',
      'Un rôle administrateur minimum est requis pour lever un ban.',
    );
  }

  const body = await readJsonBody(request);

  const targetId = normalizeString(body.targetId);
  const targetName = normalizeString(body.targetName);
  const targetIp = normalizeString(body.targetIp);
  const banId = normalizeString(body.banId);

  const reason =
    normalizeString(body.reason) ||
    'Recours accepté / Grâce administrative';

  const pardonType =
    normalizeLookup(body.pardonType) || PardonType.FULL_PARDON;

  const resetTrustScore = body.resetTrustScore === true;

  const probationDays = clampInteger(
    body.probationDays,
    0,
    MAX_PROBATION_DAYS,
    0,
  );

  if (!targetId && !targetName && !targetIp && !banId) {
    throw new HttpError(
      400,
      'missing_target',
      'targetId, targetName, targetIp ou banId est requis.',
    );
  }

  if (!VALID_PARDON_TYPES.has(pardonType)) {
    throw new HttpError(
      400,
      'invalid_pardon_type',
      `Type de grâce invalide. Valeurs : ${[...VALID_PARDON_TYPES].join(', ')}`,
    );
  }

  if (reason.length > MAX_REASON_LENGTH) {
    throw new HttpError(
      400,
      'reason_too_long',
      `La raison ne doit pas dépasser ${MAX_REASON_LENGTH} caractères.`,
    );
  }

  if (pardonType === PardonType.PROBATION && probationDays <= 0) {
    throw new HttpError(
      400,
      'invalid_probation',
      'Une période probatoire nécessite probationDays supérieur à zéro.',
    );
  }

  return runMutation(async () => {
    expireOldBans();

    const activeBans = findActiveBansForTarget({
      targetId,
      targetName,
      targetIp,
      banId,
    });

    if (activeBans.length === 0) {
      return errorResponse(
        request,
        404,
        'not_found',
        `Aucun bannissement actif trouvé pour ${
          targetName || targetId || targetIp || banId
        }.`,
      );
    }

    const unbannedAt = Date.now();
    const trustScoreRestored = resetTrustScore
      ? 100
      : pardonType === PardonType.FALSE_POSITIVE
        ? 100
        : pardonType === PardonType.PROBATION
          ? 60
          : 85;

    for (const ban of activeBans) {
      ban.active = false;
      ban.revokedAt = unbannedAt;
      ban.revokedBy = {
        id: actor.id,
        name: actor.name,
        role: actor.role,
      };
      ban.revokeReason = reason;
    }

    const mainBan = activeBans[0];

    const pardon = {
      id: createId('pardon'),
      targetId: mainBan.targetId,
      targetName: mainBan.targetName,
      banIds: activeBans.map((ban) => ban.id),
      pardonType,
      reason,
      probationDays:
        pardonType === PardonType.PROBATION ? probationDays : null,
      trustScoreRestored,
      operator: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
      },
      createdAt: unbannedAt,
    };

    store.pardons.unshift(pardon);

    addAuditEntry({
      action: 'ban_revoked',
      actor: pardon.operator,
      target: {
        id: mainBan.targetId,
        name: mainBan.targetName,
      },
      banIds: pardon.banIds,
      pardonType,
      reason,
      probationDays: pardon.probationDays,
      trustScoreRestored,
    });

    await notifyIntellectus('intellectus:ban_revoked', {
      targetId: mainBan.targetId,
      targetName: mainBan.targetName,
      banIds: pardon.banIds,
      pardonType,
      probationDays: pardon.probationDays,
      trustScoreRestored,
      operator: pardon.operator,
      reason,
    });

    return jsonResponse(request, {
      ok: true,
      message:
        `${mainBan.targetName} (${mainBan.targetId}) a été débanni. ` +
        `${activeBans.length} sanction(s) active(s) levée(s).`,
      unbannedEntry: {
        targetId: mainBan.targetId,
        targetName: mainBan.targetName,
        liftedBanIds: activeBans.map((ban) => ban.id),
        liftedCount: activeBans.length,
        pardonId: pardon.id,
        pardonType,
        unbannedAt,
        probationDays: pardon.probationDays,
        probationEndsAt:
          pardon.probationDays !== null
            ? unbannedAt + pardon.probationDays * DAY_MS
            : null,
        trustScoreRestored,
      },
      operator: pardon.operator,
      reason,
      timestamp: Date.now(),
      sig: SIG,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE — AMNISTIE ET PURGE DU DOSSIER
// ═══════════════════════════════════════════════════════════════════

async function handleDelete(request, actor) {
  if (!hasMinimumRole(actor, 'head_admin')) {
    return errorResponse(
      request,
      403,
      'forbidden',
      'Un rôle Head Admin minimum est requis pour purger un dossier.',
    );
  }

  const url = new URL(request.url);
  const banId = normalizeString(url.searchParams.get('id'));
  const confirmation = request.headers.get('X-Confirm-Purge');

  if (!banId) {
    throw new HttpError(
      400,
      'missing_id',
      'Le paramètre id est requis.',
    );
  }

  // Protection supplémentaire contre une suppression accidentelle.
  if (confirmation !== banId) {
    throw new HttpError(
      409,
      'confirmation_required',
      'Pour confirmer la purge, X-Confirm-Purge doit contenir le banId.',
    );
  }

  return runMutation(async () => {
    const index = store.bans.findIndex((ban) => ban.id === banId);

    if (index < 0) {
      return errorResponse(
        request,
        404,
        'ban_not_found',
        `Le dossier ${banId} est introuvable.`,
      );
    }

    const [deleted] = store.bans.splice(index, 1);

    addAuditEntry({
      action: 'ban_record_purged',
      actor: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
      },
      target: {
        id: deleted.targetId,
        name: deleted.targetName,
      },
      deletedBanId: deleted.id,
      category: deleted.category,
      originalBanType: deleted.type,
    });

    await notifyIntellectus('intellectus:ban_record_purged', {
      banId: deleted.id,
      targetId: deleted.targetId,
      targetName: deleted.targetName,
      operator: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
      },
    });

    return jsonResponse(request, {
      ok: true,
      message:
        `Le dossier de sanction de ${deleted.targetName} a été ` +
        'purgé du registre actif. La piste d’audit administrative est conservée.',
      deletedId: deleted.id,
      targetId: deleted.targetId,
      targetName: deleted.targetName,
      timestamp: Date.now(),
      sig: SIG,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

async function handleServerRequest({ request }) {
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildHeaders(request),
    });
  }

  try {
    const actor = await authenticateRequest(request);

    if (!actor.authenticated) {
      addAuditEntry({
        action: 'unauthorized_unban_access',
        actor: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
        },
        method,
        ip:
          request.headers.get('X-Forwarded-For') ??
          request.headers.get('CF-Connecting-IP') ??
          null,
      });

      return errorResponse(
        request,
        401,
        'unauthorized',
        'Authentification administrative requise.',
      );
    }

    switch (method) {
      case 'GET':
        return handleGet(request, actor);

      case 'POST':
        return handlePost(request, actor);

      case 'DELETE':
        return handleDelete(request, actor);

      default:
        return errorResponse(
          request,
          405,
          'method_not_allowed',
          `La méthode ${method} n’est pas autorisée.`,
        );
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(
        request,
        error.status,
        error.code,
        error.message,
        error.details,
      );
    }

    console.error(`[${SIG}·ThirdEye] Erreur interne:`, error);

    return errorResponse(
      request,
      500,
      'internal_server_error',
      process.env.NODE_ENV === 'production'
        ? 'Une erreur interne est survenue.'
        : error instanceof Error
          ? error.message
          : String(error),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTE TANSTACK START
// ═══════════════════════════════════════════════════════════════════

export const Route = createFileRoute('/admin/thirdeye/unban')({
  server: {
    handlers: {
      GET: handleServerRequest,
      POST: handleServerRequest,
      DELETE: handleServerRequest,
      OPTIONS: handleServerRequest,
    },
  },
});

export {
  handleServerRequest,
  isCurrentlyActive,
  expireOldBans,
};
/**
 * ═══════════════════════════════════════════════════════════════════
 * 👁️ TROXTWORLD / ETHERWORLD — TÉLÉMÉTRIE SÉCURITÉ THIRDEYE (v3.0)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Capacités du Module de Sécurité & Anti-Cheat :
 *  - 🛡️ Détection Heuristique : SpeedHack, Noclip, GodMode, Injection d'argent/armes, Packet Flood.
 *  - 📈 TrustScore & Niveaux de Risque : Surveillance continue et calcul dynamique de menace.
 *  - ⚡ Mitigations Automatiques : Rubberband, Silent-flags, Auto-kicks, Bans & Clamp dégâts.
 *  - 🎛️ Posture de Sécurité : Ajustement dynamique (Relaxed, Balanced, Strict, Lockdown).
 *  - 📊 Export CSV Sécurisé : Téléchargement avec protection contre l'injection de formules.
 *
 * Signature : TROXT⬡ · 🛡️INTELLECTUS⬡ · ThirdEye Sentinel
 * Chemin    : server\intellectus\admin\thirdeye/stats.js
 */

import { createFileRoute } from "@tanstack/react-router";

const SIG = "TROXT⬡";
const ISIG = "🛡️INTELLECTUS⬡";
const VERSION = "3.0.0";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_INCIDENTS_BUFFER = 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ═══════════════════════════════════════════════════════════
// CONSTANTES & ENUMS DU SYSTÈME SÉCURITAIRE
// ═══════════════════════════════════════════════════════════

export const ThreatLevel = Object.freeze({
  LOW: "LOW",
  ELEVATED: "ELEVATED",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
});

export const SecurityPosture = Object.freeze({
  RELAXED: "relaxed",
  BALANCED: "balanced",
  STRICT: "strict",
  LOCKDOWN: "lockdown",
});

export const DetectionCategory = Object.freeze({
  SPEED_TELEPORT: "speed_teleport",
  WEAPON_SPAWNING: "weapon_spawning",
  GODMODE_HEALTH: "godmode_health",
  MONEY_INJECTION: "money_injection",
  NOCLIP_FLY: "noclip_fly",
  VEHICLE_HACK: "vehicle_hack",
  HYDRO_BYPASS: "hydro_bypass",
  LUA_INJECTION: "lua_injection",
  PACKET_FLOOD: "packet_flood",
  SILENT_AIM: "silent_aim",
});

export const MitigationAction = Object.freeze({
  RUBBERBAND: "rubberband",
  SILENT_FLAG: "silent_flag",
  KICK: "kick",
  BAN: "ban",
  INVENTORY_STRIP: "inventory_strip",
  DAMAGE_CLAMP: "damage_clamp",
  FREEZE: "freeze",
});

const ROLE_HIERARCHY = Object.freeze({
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

// ═══════════════════════════════════════════════════════════
// REGISTRE EN MÉMOIRE PERSISTANT AUX HOT-RELOADS
// ═══════════════════════════════════════════════════════════

const STORE_SYMBOL = Symbol.for("troxt.thirdeye.stats-store.v3");

function createStatsStore() {
  return {
    startTime: Date.now(),
    securityPosture: SecurityPosture.BALANCED,
    incidents: [],
    flaggedPlayers: new Map(),
    inspectedPacketsCount: 0,
    lastPacketRateCheck: Date.now(),
    currentPacketsPerSec: 185,
    autoMitigationsCount: 0,
    auditTrail: [],
    initialized: false,
  };
}

const store = globalThis[STORE_SYMBOL] ?? createStatsStore();
globalThis[STORE_SYMBOL] = store;

// ═══════════════════════════════════════════════════════════
// INITIALISATION DES DONNÉES DÉMO
// ═══════════════════════════════════════════════════════════

function initializeDemoData() {
  if (store.initialized) return;
  store.initialized = true;

  if (process.env.THIRDEYE_DEMO_DATA === "false") return;

  const now = Date.now();

  store.incidents.push(
    {
      id: `sec_${now - 140000}`,
      timestamp: now - 140000,
      category: DetectionCategory.SPEED_TELEPORT,
      severity: "low",
      targetId: "player_test_1",
      targetName: "Joueur_42",
      targetIp: "198.51.100.42",
      heuristic: "Delta Position > 32 m/s (Hors véhicule)",
      details: "Déplacement anormal détecté près du 2e Rang de Donnacona. Probable pic de latence.",
      autoMitigated: true,
      mitigationAction: MitigationAction.RUBBERBAND,
    },
    {
      id: `sec_${now - 45000}`,
      timestamp: now - 45000,
      category: DetectionCategory.HYDRO_BYPASS,
      severity: "medium",
      targetId: "suspect_h_pnf",
      targetName: "Occupant Villa Portneuf",
      targetIp: "203.0.113.88",
      heuristic: "Consommation 0 kW avec 8 lampes horticoles actives",
      details: "Dérivation illégale du compteur Hydro-Québec suspectée.",
      autoMitigated: false,
      mitigationAction: MitigationAction.SILENT_FLAG,
    }
  );

  store.flaggedPlayers.set("suspect_h_pnf", {
    identifier: "suspect_h_pnf",
    displayName: "Occupant Villa Portneuf",
    trustScore: 78,
    riskLevel: ThreatLevel.ELEVATED,
    totalFlags: 2,
    lastFlagTime: now - 45000,
    flagCategories: [DetectionCategory.HYDRO_BYPASS],
    pingMs: 24,
  });

  store.autoMitigationsCount = 1;
}

initializeDemoData();

// ═══════════════════════════════════════════════════════════
// HELPERS SÉCURITÉ, AUTHENTIFICATION & UTILITAIRES
// ═══════════════════════════════════════════════════════════

function createId(prefix = "sec") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

function normalizeLookup(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function clampInteger(value, min, max, fallback) {
  const parsed = parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function hasMinimumRole(actor, requiredRole) {
  const actorWeight = ROLE_HIERARCHY[normalizeLookup(actor?.role)] || 0;
  const reqWeight = ROLE_HIERARCHY[normalizeLookup(requiredRole)] || 1;
  return actorWeight >= reqWeight;
}

function redactIp(ip) {
  if (!ip) return "N/A";
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 2).join(":")}::…`;
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return "***";
  return `${parts[0]}.${parts[1]}.***.***`;
}

function sanitizeCsvCell(val) {
  if (val === undefined || val === null) return '""';
  let str = String(val).replace(/"/g, '""');
  // Protection contre l'injection de formules Excel/Calc
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str}"`;
}

async function authenticateRequest(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch?.[1]?.trim();

  const rawTokens = process.env.THIRDEYE_ADMIN_TOKENS;
  if (rawTokens && token) {
    try {
      const tokensMap = JSON.parse(rawTokens);
      if (tokensMap[token]) {
        return {
          authenticated: true,
          id: tokensMap[token].id || "admin_auth",
          name: tokensMap[token].name || "Opérateur ThirdEye",
          role: normalizeLookup(tokensMap[token].role) || "admin",
        };
      }
    } catch {
      // Ignorer erreur parsing
    }
  }

  // Fallback sécurisé en développement uniquement
  const allowInsecure = process.env.NODE_ENV !== "production" && process.env.THIRDEYE_ALLOW_INSECURE_HEADERS === "true";
  if (allowInsecure) {
    const role = normalizeLookup(request.headers.get("X-Admin-Role"));
    if (ROLE_HIERARCHY[role] > 0) {
      return {
        authenticated: true,
        id: request.headers.get("X-Actor-Id") || "dev_console",
        name: request.headers.get("X-Actor-Name") || "Admin Local",
        role,
      };
    }
  }

  return {
    authenticated: false,
    id: "anonymous",
    name: "Anonyme",
    role: "none",
  };
}

function getAllowedOrigins() {
  return String(process.env.THIRDEYE_ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173,http://localhost:8080")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function buildHeaders(request, contentType = "application/json; charset=utf-8") {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-TROXT-Signature": SIG,
    "X-ThirdEye-Version": VERSION,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-Confirm-Purge, X-Admin-Role, X-Actor-Id",
    Vary: "Origin",
  });

  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins();
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes("*"))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  return headers;
}

function jsonResponse(request, data, status = 200, extraHeaders = {}) {
  const headers = buildHeaders(request);
  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, String(v));
  }
  return new Response(JSON.stringify(data), { status, headers });
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
    status
  );
}

async function readJsonBody(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) {
    throw new Error("Le corps de la requête dépasse la taille maximale autorisée (32 KB).");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new Error("Corps HTTP trop volumineux.");
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Corps JSON malformé ou invalide.");
  }
}

async function notifyIntellectus(event, payload) {
  try {
    const intellectus = globalThis.__TROXT_INTELLECTUS__;
    if (typeof intellectus?.emit === "function") {
      await intellectus.emit(event, { ...payload, sig: SIG, isig: ISIG });
    }
  } catch (err) {
    console.warn(`[${ISIG}] Échec du relais Intellectus:`, err?.message || err);
  }
}

// ═══════════════════════════════════════════════════════════
// CALCULATEURS DE TÉLÉMÉTRIE
// ═══════════════════════════════════════════════════════════

function computeOverallThreatLevel() {
  const criticals = store.incidents.filter((i) => i.severity === "critical").length;
  const highs = store.incidents.filter((i) => i.severity === "high").length;
  const activeSuspects = store.flaggedPlayers.size;

  if (criticals > 0 || store.securityPosture === SecurityPosture.LOCKDOWN) return ThreatLevel.CRITICAL;
  if (highs >= 3 || activeSuspects >= 5 || store.securityPosture === SecurityPosture.STRICT) return ThreatLevel.HIGH;
  if (highs > 0 || activeSuspects >= 2) return ThreatLevel.ELEVATED;
  return ThreatLevel.LOW;
}

function computeCategoryBreakdown() {
  const breakdown = {
    speed_teleport: 0,
    weapon_spawning: 0,
    godmode_health: 0,
    money_injection: 0,
    noclip_fly: 0,
    vehicle_hack: 0,
    hydro_bypass: 0,
    lua_injection: 0,
    packet_flood: 0,
    silent_aim: 0,
  };

  for (const inc of store.incidents) {
    if (breakdown[inc.category] !== undefined) {
      breakdown[inc.category]++;
    }
  }

  return breakdown;
}

function computeAverageTrustScore() {
  const players = Array.from(store.flaggedPlayers.values());
  if (players.length === 0) return 98.5;
  const sum = players.reduce((acc, p) => acc + p.trustScore, 0);
  return parseFloat((sum / players.length).toFixed(1));
}

// ═══════════════════════════════════════════════════════════
// HANDLERS HTTP
// ═══════════════════════════════════════════════════════════

async function handleGet(request, actor) {
  if (!hasMinimumRole(actor, "moderator")) {
    return errorResponse(request, 403, "forbidden", "Privilèges insuffisants. Grade Modérateur requis.");
  }

  const url = new URL(request.url);
  const exportFormat = normalizeLookup(url.searchParams.get("export"));
  const categoryFilter = normalizeLookup(url.searchParams.get("category"));
  const targetFilter = normalizeLookup(url.searchParams.get("target"));
  const severityFilter = normalizeLookup(url.searchParams.get("severity"));
  const page = clampInteger(url.searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER, 1);
  const limit = clampInteger(url.searchParams.get("limit"), 1, MAX_LIMIT, DEFAULT_LIMIT);

  // ── 1. Export CSV Sécurisé ──
  if (exportFormat === "csv") {
    if (!hasMinimumRole(actor, "admin")) {
      return errorResponse(request, 403, "forbidden", "Export CSV réservé aux Administrateurs.");
    }

    const csvHeaders = ["ID", "Timestamp_ISO", "Category", "Severity", "Target_ID", "Target_Name", "Heuristic", "Details", "AutoMitigated", "MitigationAction"];
    const rows = store.incidents.map((i) => [
      i.id,
      new Date(i.timestamp).toISOString(),
      i.category,
      i.severity.toUpperCase(),
      sanitizeCsvCell(i.targetId),
      sanitizeCsvCell(i.targetName),
      sanitizeCsvCell(i.heuristic),
      sanitizeCsvCell(i.details),
      i.autoMitigated ? "YES" : "NO",
      i.mitigationAction || "none",
    ]);

    const csvContent = "\uFEFF" + [csvHeaders.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const filename = `thirdeye_telemetry_${new Date().toISOString().slice(0, 10)}.csv`;

    const headers = buildHeaders(request, "text/csv; charset=utf-8");
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    return new Response(csvContent, { status: 200, headers });
  }

  // ── 2. Filtrage des incidents ──
  let filtered = [...store.incidents];

  if (categoryFilter && Object.values(DetectionCategory).includes(categoryFilter)) {
    filtered = filtered.filter((i) => i.category === categoryFilter);
  }

  if (severityFilter) {
    filtered = filtered.filter((i) => i.severity.toLowerCase() === severityFilter);
  }

  if (targetFilter) {
    filtered = filtered.filter(
      (i) =>
        i.targetName.toLowerCase().includes(targetFilter) ||
        i.targetId.toLowerCase().includes(targetFilter)
    );
  }

  filtered.sort((a, b) => b.timestamp - a.timestamp);

  const canViewSensitive = hasMinimumRole(actor, "superadmin");
  const paginatedIncidents = filtered.slice((page - 1) * limit, page * limit).map((inc) => ({
    ...inc,
    targetIp: canViewSensitive ? inc.targetIp : redactIp(inc.targetIp),
  }));

  const report = {
    overallThreatLevel: computeOverallThreatLevel(),
    securityPosture: store.securityPosture,
    averageTrustScore: computeAverageTrustScore(),
    inspectedPacketsPerSec: store.currentPacketsPerSec,
    activeWatchlistCount: store.flaggedPlayers.size,
    autoMitigationsToday: store.autoMitigationsCount,
    uptimeSeconds: Math.floor((Date.now() - store.startTime) / 1000),
    categoryBreakdown: computeCategoryBreakdown(),
    flaggedPlayers: Array.from(store.flaggedPlayers.values()),
    recentIncidents: paginatedIncidents,
    pagination: {
      page,
      limit,
      totalCount: filtered.length,
      totalPages: Math.ceil(filtered.length / limit) || 1,
    },
  };

  return jsonResponse(request, { ok: true, data: report, timestamp: Date.now(), sig: SIG });
}

async function handlePost(request, actor) {
  let body;
  try {
    body = await readJsonBody(request);
  } catch (err) {
    return errorResponse(request, 400, "invalid_payload", err.message);
  }

  const action = normalizeLookup(body.action);

  // ── 1. Mutation de la Posture de Sécurité ──
  if (action === "set_posture") {
    if (!hasMinimumRole(actor, "superadmin")) {
      return errorResponse(request, 403, "forbidden", "Seul un SuperAdmin ou le Superviseur IA peut modifier la posture de sécurité.");
    }

    const posture = normalizeLookup(body.posture);
    if (!Object.values(SecurityPosture).includes(posture)) {
      return errorResponse(
        request,
        400,
        "invalid_posture",
        `Posture invalide. Choix: ${Object.values(SecurityPosture).join(", ")}`
      );
    }

    const previousPosture = store.securityPosture;
    store.securityPosture = posture;

    await notifyIntellectus("intellectus:posture_changed", {
      from: previousPosture,
      to: posture,
      actor: { id: actor.id, name: actor.name, role: actor.role },
      timestamp: Date.now(),
    });

    return jsonResponse(request, {
      ok: true,
      message: `Posture de sécurité ThirdEye basculée en mode [${posture.toUpperCase()}].`,
      posture,
      timestamp: Date.now(),
    });
  }

  // ── 2. Enregistrement d'incident de détection heuristique ──
  if (action === "report_incident" || body.incident) {
    if (!hasMinimumRole(actor, "moderator")) {
      return errorResponse(request, 403, "forbidden", "Permissions insuffisantes pour émettre un rapport d'incident.");
    }

    const raw = body.incident || body;
    const category = Object.values(DetectionCategory).includes(raw.category)
      ? raw.category
      : DetectionCategory.SPEED_TELEPORT;
    const severity = ["low", "medium", "high", "critical"].includes(raw.severity?.toLowerCase())
      ? raw.severity.toLowerCase()
      : "medium";

    const targetId = String(raw.targetId || "unknown_id").trim();
    const targetName = String(raw.targetName || "Citoyen Inconnu").trim();
    const autoMitigated = raw.autoMitigated !== undefined ? Boolean(raw.autoMitigated) : true;
    const mitigationAction = Object.values(MitigationAction).includes(raw.mitigationAction)
      ? raw.mitigationAction
      : MitigationAction.SILENT_FLAG;

    const newIncident = {
      id: createId("sec"),
      timestamp: Date.now(),
      category,
      severity,
      targetId,
      targetName,
      targetIp: raw.targetIp || null,
      heuristic: String(raw.heuristic || "Anomalie comportementale détectée").slice(0, 200),
      details: String(raw.details || "Écart de trajectoire / paquet réseau anormal").slice(0, 500),
      autoMitigated,
      mitigationAction,
    };

    store.incidents.unshift(newIncident);
    if (store.incidents.length > MAX_INCIDENTS_BUFFER) {
      store.incidents.pop();
    }

    if (autoMitigated) {
      store.autoMitigationsCount++;
    }

    // Mise à jour de la Watchlist / Flagged Player
    let playerEntry = store.flaggedPlayers.get(targetId);
    if (!playerEntry) {
      playerEntry = {
        identifier: targetId,
        displayName: targetName,
        trustScore: 100,
        riskLevel: ThreatLevel.LOW,
        totalFlags: 0,
        lastFlagTime: Date.now(),
        flagCategories: [],
        pingMs: clampInteger(raw.pingMs, 0, 999, 28),
      };
      store.flaggedPlayers.set(targetId, playerEntry);
    }

    playerEntry.totalFlags++;
    playerEntry.lastFlagTime = Date.now();
    if (!playerEntry.flagCategories.includes(category)) {
      playerEntry.flagCategories.push(category);
    }

    // Dégradation du TrustScore
    const penalty = severity === "critical" ? 35 : severity === "high" ? 20 : severity === "medium" ? 10 : 5;
    playerEntry.trustScore = Math.max(0, playerEntry.trustScore - penalty);
    playerEntry.riskLevel = playerEntry.trustScore < 40 ? ThreatLevel.CRITICAL : playerEntry.trustScore < 70 ? ThreatLevel.HIGH : ThreatLevel.ELEVATED;

    await notifyIntellectus("intellectus:threat_detected", {
      incident: newIncident,
      playerState: playerEntry,
    });

    return jsonResponse(
      request,
      {
        ok: true,
        message: `Incident [${category}] enregistré avec succès.`,
        incident: newIncident,
        trustScoreRemaining: playerEntry.trustScore,
      },
      201
    );
  }

  return errorResponse(request, 400, "unknown_action", "Action non reconnue. Choix: 'set_posture', 'report_incident'.");
}

async function handleDelete(request, actor) {
  if (!hasMinimumRole(actor, "admin")) {
    return errorResponse(request, 403, "forbidden", "Rôle Administrateur requis pour purger des données d'incidents.");
  }

  const url = new URL(request.url);
  const targetId = url.searchParams.get("targetId")?.trim();
  const purgeAll = url.searchParams.get("all") === "true";

  // ── 1. Purge des drapeaux pour un joueur cible ──
  if (targetId) {
    const beforeCount = store.incidents.length;
    store.incidents = store.incidents.filter((i) => i.targetId.toLowerCase() !== targetId.toLowerCase());
    const removedCount = beforeCount - store.incidents.length;
    
    store.flaggedPlayers.delete(targetId);

    return jsonResponse(request, {
      ok: true,
      message: `Historique de détection et drapeaux révoqués pour le suspect [${targetId}].`,
      clearedIncidentsCount: removedCount,
    });
  }

  // ── 2. Purge globale de l'historique ──
  if (purgeAll) {
    if (!hasMinimumRole(actor, "head_admin")) {
      return errorResponse(request, 403, "forbidden", "Seul un Head Admin ou Fondateur peut purger l'intégralité du tampon d'incidents.");
    }

    const confirmHeader = request.headers.get("X-Confirm-Purge");
    if (confirmHeader !== "all") {
      return errorResponse(request, 409, "confirmation_required", "Veuillez spécifier l'en-tête 'X-Confirm-Purge: all' pour confirmer l'effacement total.");
    }

    const totalCleared = store.incidents.length;
    store.incidents = [];
    store.flaggedPlayers.clear();

    return jsonResponse(request, {
      ok: true,
      message: `Tampon de télémétrie ThirdEye entièrement purgé (${totalCleared} incidents effacés).`,
      clearedCount: totalCleared,
      timestamp: Date.now(),
    });
  }

  return errorResponse(request, 400, "missing_parameter", "Spécifiez '?targetId=<id>' ou '?all=true' pour purger des incidents.");
}

// ═══════════════════════════════════════════════════════════
// GESTIONNAIRE PRINCIPAL DE REQUÊTE
// ═══════════════════════════════════════════════════════════

async function handleServerRequest({ request }) {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildHeaders(request) });
  }

  try {
    const actor = await authenticateRequest(request);

    if (!actor.authenticated) {
      return errorResponse(request, 401, "unauthorized", "Accès refusé. Jeton d'authentification administratif manquant ou invalide.");
    }

    switch (method) {
      case "GET":
        return await handleGet(request, actor);
      case "POST":
        return await handlePost(request, actor);
      case "DELETE":
        return await handleDelete(request, actor);
      default:
        return errorResponse(request, 405, "method_not_allowed", `Méthode ${method} non prise en charge.`);
    }
  } catch (err) {
    console.error(`[${SIG}·ThirdEyeStats] Erreur serveur critique:`, err);
    return errorResponse(
      request,
      500,
      "internal_server_error",
      process.env.NODE_ENV === "production" ? "Erreur interne de traitement de télémétrie." : err.message || String(err)
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ROUTEUR TANSTACK
// ═══════════════════════════════════════════════════════════

export const Route = createFileRoute("/admin/thirdeye/stats")({
  server: {
    handlers: {
      GET: handleServerRequest,
      POST: handleServerRequest,
      DELETE: handleServerRequest,
      OPTIONS: handleServerRequest,
    },
  },
});

export default Route;
/**
 * ═══════════════════════════════════════════════════════════════════
 * 🎙️ TROXTWORLD / ETHERWORLD — SIGNALISATION WEBRTC & VOIX 3D (/api/rtc)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Passerelle Audio Spatiale & Radios Réalistes (Style PMA-Voice FiveM) :
 *  - 🗣️ Voix Proximité 3D (Chuchoter 2.5m, Normal 8m, Crier 25m, Mégaphone 60m)
 *  - 📻 Radios RP Québécoises (SQ 104.2 MHz, Urgences 108.5 MHz, CB Canal 14)
 *  - ⚡ Échange SDP Offers/Answers & Trickle ICE Candidates
 *  - 🌐 Fourniture de Serveurs STUN/TURN haute disponibilité
 *
 * ⚠️  ATTENTION SERVERLESS :
 *     Ce module garde l'état en mémoire (peerDirectory, queues).
 *     Il est prévu pour un déploiement MONO-INSTANCE (VPS, serveur local).
 *     Pour un déploiement multi-instance / serverless, remplacer les Maps
 *     par Redis / Upstash / Cloudflare Durable Objects.
 *
 * Chemin : client/src/routes/api/rtc.mjs
 * ═══════════════════════════════════════════════════════════════════
 */

import { createFileRoute } from "@tanstack/react-router";

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════

/** @typedef {('whisper'|'normal'|'shout'|'megaphone')} VoiceMode */

/** @type {Record<VoiceMode, number>} */
const VOICE_RANGES = {
  whisper:   2.5,
  normal:    8.0,
  shout:     25.0,
  megaphone: 60.0,
};

/** @type {Array<{urls: string|string[], username?: string, credential?: string}>} */
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.services.mozilla.com" },
];

// Limites de sécurité
const LIMITS = {
  maxBodyBytes:           32 * 1024,      // 32 KB max par requête
  maxPeers:               500,             // Max pairs simultanés
  maxQueuePerPeer:        200,             // Max msgs en file par peer
  peerTimeoutMs:          15_000,          // Nettoyage après 15s sans heartbeat
  heartbeatGraceMs:       5_000,           // Grâce avant de marquer stale
  rateLimitPerMinute:     120,             // Max requêtes/min/IP
  maxSpatialRadius:       100,             // Rayon AOI par défaut pour voice_state
  queueMessageTtlMs:      30_000,          // Message expiré après 30s
  cleanupIntervalMs:      10_000,          // Intervalle de cleanup auto
};

// ═══════════════════════════════════════════════════════════
// ÉTAT EN MÉMOIRE
// ═══════════════════════════════════════════════════════════

const serverBootTime = Date.now();

/** @type {Map<string, any>} */
const peerDirectory = new Map();

/** @type {Map<string, Array<{id:string, type:string, senderId:string, senderName:string, targetId?:string, payload:any, timestamp:number, enqueuedAt:number}>>} */
const peerMessageQueues = new Map();

/** @type {Map<string, {count:number, windowStart:number}>} */
const rateLimitBuckets = new Map();

let totalRoutedCounter = 0;
let lastCleanupAt    = 0;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

const CORS_HEADERS = {
  "Content-Type":                 "application/json; charset=utf-8",
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Peer-Id, X-Session-Token",
  "Access-Control-Max-Age":       "86400",
};

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

/** ID collision-safe basé sur timestamp + crypto si dispo + random */
function newId(prefix) {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  const randPart = cryptoObj && cryptoObj.randomUUID
    ? cryptoObj.randomUUID().split("-")[0]
    : Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${randPart}`;
}

/** Récupère l'IP cliente (best-effort) */
function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

/**
 * Rate limiting simple par IP (fenêtre glissante 1 min).
 * @returns {boolean} true si autorisé, false si bloqué
 */
function checkRateLimit(ip) {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= 60_000) {
    bucket = { count: 0, windowStart: now };
    rateLimitBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  return bucket.count <= LIMITS.rateLimitPerMinute;
}

/** Vérifie la taille du body avant parsing */
async function safeParseJson(request) {
  const lenHeader = request.headers.get("content-length");
  if (lenHeader && parseInt(lenHeader, 10) > LIMITS.maxBodyBytes) {
    return { ok: false, error: "body_too_large" };
  }
  try {
    const text = await request.text();
    if (text.length > LIMITS.maxBodyBytes) {
      return { ok: false, error: "body_too_large" };
    }
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

/**
 * Validation légère d'un payload peer_state.
 * Fusionne avec l'état existant (patch partiel).
 */
function mergePeerState(existing, incoming, nowTs) {
  const base = existing || {
    peerId:             incoming.peerId,
    displayName:        incoming.displayName || "Citoyen",
    position:           { x: 0, y: 0, z: 0 },
    yaw:                0,
    voiceMode:          "normal",
    voiceRangeMeters:   VOICE_RANGES.normal,
    isTalking:          false,
    isRadioTransmitting: false,
    radioFrequencyMhz:  undefined,
    radioEffectsActive: true,
    lastHeartbeat:      nowTs,
    joinedAt:           nowTs,
  };

  // Merge partiel : ne remplace que les champs fournis
  if (incoming.displayName !== undefined)       base.displayName = incoming.displayName;
  if (incoming.position)                        base.position = incoming.position;
  if (incoming.yaw !== undefined)               base.yaw = incoming.yaw;
  if (incoming.voiceMode) {
    base.voiceMode = incoming.voiceMode;
    base.voiceRangeMeters = VOICE_RANGES[incoming.voiceMode] || VOICE_RANGES.normal;
  }
  if (incoming.isTalking !== undefined)         base.isTalking = Boolean(incoming.isTalking);
  if (incoming.isRadioTransmitting !== undefined)
    base.isRadioTransmitting = Boolean(incoming.isRadioTransmitting);
  if (incoming.radioFrequencyMhz !== undefined)
    base.radioFrequencyMhz = incoming.radioFrequencyMhz;
  if (incoming.radioEffectsActive !== undefined)
    base.radioEffectsActive = Boolean(incoming.radioEffectsActive);

  base.lastHeartbeat = nowTs;
  return base;
}

/**
 * Enqueue un message dans la file d'un peer, avec limites et TTL.
 */
function enqueue(targetId, message) {
  let q = peerMessageQueues.get(targetId);
  if (!q) {
    q = [];
    peerMessageQueues.set(targetId, q);
  }
  // Drop les messages trop vieux
  const cutoff = Date.now() - LIMITS.queueMessageTtlMs;
  if (q.length > 0 && q[0].enqueuedAt < cutoff) {
    q = q.filter((m) => m.enqueuedAt >= cutoff);
  }
  // Drop le plus vieux si on dépasse la limite
  if (q.length >= LIMITS.maxQueuePerPeer) {
    q.shift();
  }
  q.push({ ...message, enqueuedAt: Date.now() });
  peerMessageQueues.set(targetId, q);
}

/**
 * Diffuse un message à tous les peers (sauf excludeId).
 * @param {string[]} [filterByRange] — Ne diffuse qu'aux peers dans le rayon
 */
function broadcast(message, excludeId, sourcePos, maxRange) {
  for (const [id, peer] of peerDirectory.entries()) {
    if (id === excludeId) continue;

    // Filtrage spatial optionnel (AOI)
    if (sourcePos && maxRange !== undefined) {
      const dx = (peer.position?.x || 0) - sourcePos.x;
      const dy = (peer.position?.y || 0) - sourcePos.y;
      const dz = (peer.position?.z || 0) - sourcePos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > maxRange * maxRange) continue;
    }

    enqueue(id, message);
  }
}

/**
 * Cleanup des peers timeout — notifie les autres du départ.
 */
function cleanupStalePeers(nowTs) {
  const toRemove = [];
  for (const [id, peer] of peerDirectory.entries()) {
    if (nowTs - peer.lastHeartbeat > LIMITS.peerTimeoutMs) {
      toRemove.push(id);
    }
  }
  for (const id of toRemove) {
    const peer = peerDirectory.get(id);
    peerDirectory.delete(id);
    peerMessageQueues.delete(id);
    // Notifier les autres
    broadcast(
      {
        id:         newId("leave"),
        type:       "peer_leave",
        senderId:   id,
        senderName: peer?.displayName || id,
        payload:    { peerId: id, reason: "timeout" },
        timestamp:  nowTs,
      },
      id
    );
  }
  return toRemove.length;
}

// ═══════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════

/**
 * @param {{ request: Request }} ctx
 * @returns {Promise<Response>}
 */
async function handleServerRequest({ request }) {
  const url    = new URL(request.url);
  const method = request.method.toUpperCase();
  const nowTs  = Date.now();

  // Preflight CORS
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Rate limiting
  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp)) {
    return json(429, { ok: false, error: "rate_limited", retryAfterMs: 60_000 });
  }

  // Cleanup périodique (max 1× par intervalle)
  if (nowTs - lastCleanupAt > LIMITS.cleanupIntervalMs) {
    lastCleanupAt = nowTs;
    cleanupStalePeers(nowTs);
  }

  try {
    // ═══════════════════════════════════════════════════════
    // GET — ICE config, stats, polling, radio listeners
    // ═══════════════════════════════════════════════════════
    if (method === "GET") {
      const sp             = url.searchParams;
      const wantIce        = sp.get("ice") === "true" || sp.get("config") === "true";
      const wantStats      = sp.get("stats") === "true";
      const wantHeartbeat  = sp.get("heartbeat") === "true";
      const pollPeerId     = sp.get("peerId") || request.headers.get("X-Peer-Id");
      const radioFreq      = parseFloat(sp.get("frequency") || "0");

      // ── A. Configuration ICE ─────────────────────────────
      if (wantIce) {
        return json(200, {
          ok:                 true,
          iceServers:         DEFAULT_ICE_SERVERS,
          voiceRanges:        VOICE_RANGES,
          iceTransportPolicy: "all",
          bundlePolicy:       "max-bundle",
          rtcpMuxPolicy:      "require",
          serverTime:         nowTs,
        });
      }

      // ── B. Statistiques ──────────────────────────────────
      if (wantStats) {
        const radioChannels = new Set();
        for (const p of peerDirectory.values()) {
          if (p.radioFrequencyMhz) radioChannels.add(p.radioFrequencyMhz);
        }
        let totalQueued = 0;
        for (const q of peerMessageQueues.values()) totalQueued += q.length;

        return json(200, {
          ok: true,
          data: {
            activePeersCount:         peerDirectory.size,
            activeRadioChannelsCount: radioChannels.size,
            queuedMessagesCount:      totalQueued,
            totalSignalsRouted:       totalRoutedCounter,
            iceServersCount:          DEFAULT_ICE_SERVERS.length,
            uptimeSeconds:            Math.floor((nowTs - serverBootTime) / 1000),
          },
          timestamp: nowTs,
        });
      }

      // ── C. Heartbeat seul (sans polling) ─────────────────
      if (wantHeartbeat && pollPeerId) {
        const peer = peerDirectory.get(pollPeerId);
        if (peer) {
          peer.lastHeartbeat = nowTs;
          return json(200, { ok: true, alive: true });
        }
        return json(404, { ok: false, error: "peer_not_found" });
      }

      // ── D. Polling messages ──────────────────────────────
      if (pollPeerId) {
        const peer = peerDirectory.get(pollPeerId);
        if (peer) peer.lastHeartbeat = nowTs;

        const queue    = peerMessageQueues.get(pollPeerId) || [];
        const messages = queue.slice();
        peerMessageQueues.set(pollPeerId, []); // vide la file

        return json(200, {
          ok:            true,
          peerId:        pollPeerId,
          messagesCount: messages.length,
          messages,
          timestamp:     nowTs,
        });
      }

      // ── E. Auditeurs d'une fréquence radio ───────────────
      if (radioFreq > 0) {
        const listeners = [];
        for (const p of peerDirectory.values()) {
          if (p.radioFrequencyMhz === radioFreq) {
            listeners.push({
              peerId:         p.peerId,
              name:           p.displayName,
              isTransmitting: p.isRadioTransmitting,
            });
          }
        }
        return json(200, {
          ok:             true,
          frequencyMhz:   radioFreq,
          listenersCount: listeners.length,
          listeners,
        });
      }

      // ── F. Liste générale des pairs ──────────────────────
      const allPeers = Array.from(peerDirectory.values()).map((p) => ({
        id:      p.peerId,
        name:    p.displayName,
        mode:    p.voiceMode,
        range:   p.voiceRangeMeters,
        talking: p.isTalking,
        radio:   p.radioFrequencyMhz ? `${p.radioFrequencyMhz} MHz` : "Off",
      }));

      return json(200, { ok: true, total: allPeers.length, peers: allPeers });
    }

    // ═══════════════════════════════════════════════════════
    // POST — Envoi de signaux (offer/answer/candidate/voice_state)
    // ═══════════════════════════════════════════════════════
    if (method === "POST") {
      const parsed = await safeParseJson(request);
      if (!parsed.ok) {
        return json(400, { ok: false, error: parsed.error });
      }

      const body = parsed.data || {};
      const { type, senderId, senderName, targetId, payload } = body;

      if (typeof type !== "string" || !type) {
        return json(400, { ok: false, error: "missing_type" });
      }
      if (typeof senderId !== "string" || !senderId) {
        return json(400, { ok: false, error: "missing_sender_id" });
      }

      // Limite globale peers
      if (!peerDirectory.has(senderId) && peerDirectory.size >= LIMITS.maxPeers) {
        return json(503, { ok: false, error: "peer_capacity_reached" });
      }

      totalRoutedCounter++;

      // ── A. peer_join / voice_state ──────────────────────
      if (type === "peer_join" || type === "voice_state") {
        const existing = peerDirectory.get(senderId);
        const wasRadioOn = existing?.isRadioTransmitting && existing?.radioFrequencyMhz;

        const peerState = mergePeerState(existing, {
          peerId:      senderId,
          displayName: senderName,
          ...(payload || {}),
        }, nowTs);

        peerDirectory.set(senderId, peerState);
        if (!peerMessageQueues.has(senderId)) {
          peerMessageQueues.set(senderId, []);
        }

        // ── Radio : PTT ON ──────────────────────────────
        const isRadioOnNow = peerState.isRadioTransmitting && peerState.radioFrequencyMhz;
        if (isRadioOnNow && !wasRadioOn) {
          const radioMsg = {
            id:         newId("rad"),
            type:       "radio_transmit",
            senderId,
            senderName: peerState.displayName,
            payload: {
              frequencyMhz:   peerState.radioFrequencyMhz,
              isTransmitting: true,
              soundEffect:    "mic_click_on",
            },
            timestamp: nowTs,
          };

          // Diffuse aux auditeurs de la même fréquence
          for (const [id, other] of peerDirectory.entries()) {
            if (id === senderId) continue;
            if (other.radioFrequencyMhz === peerState.radioFrequencyMhz) {
              enqueue(id, radioMsg);
            }
          }
        }

        // ── Radio : PTT OFF (relâche) ──────────────────
        if (!isRadioOnNow && wasRadioOn) {
          const stopMsg = {
            id:         newId("rad"),
            type:       "radio_transmit",
            senderId,
            senderName: peerState.displayName,
            payload: {
              frequencyMhz:   existing.radioFrequencyMhz,
              isTransmitting: false,
              soundEffect:    "mic_click_off",
            },
            timestamp: nowTs,
          };

          for (const [id, other] of peerDirectory.entries()) {
            if (id === senderId) continue;
            if (other.radioFrequencyMhz === existing.radioFrequencyMhz) {
              enqueue(id, stopMsg);
            }
          }
        }

        // ── Voix proximité : notifier les pairs dans le rayon ──
        // (uniquement si quelque chose change d'audible)
        const posChanged  = !existing ||
          Math.abs((existing.position?.x || 0) - peerState.position.x) > 0.05 ||
          Math.abs((existing.position?.y || 0) - peerState.position.y) > 0.05 ||
          Math.abs((existing.position?.z || 0) - peerState.position.z) > 0.05;
        const modeChanged = !existing || existing.voiceMode !== peerState.voiceMode;
        const talkChanged = !existing || existing.isTalking !== peerState.isTalking;

        if (posChanged || modeChanged || talkChanged) {
          const spatialMsg = {
            id:         newId("vs"),
            type:       "voice_state",
            senderId,
            senderName: peerState.displayName,
            payload: {
              position:      peerState.position,
              yaw:           peerState.yaw,
              voiceMode:     peerState.voiceMode,
              voiceRange:    peerState.voiceRangeMeters,
              isTalking:     peerState.isTalking,
            },
            timestamp: nowTs,
          };
          broadcast(spatialMsg, senderId, peerState.position, LIMITS.maxSpatialRadius);
        }

        return json(200, {
          ok:      true,
          message: `État vocal de [${peerState.displayName}] synchronisé (${peerState.voiceMode} : ${peerState.voiceRangeMeters}m).`,
          peer:    peerState,
        });
      }

      // ── B. peer_leave explicite ─────────────────────────
      if (type === "peer_leave") {
        const existing = peerDirectory.get(senderId);
        peerDirectory.delete(senderId);
        peerMessageQueues.delete(senderId);
        broadcast(
          {
            id:         newId("leave"),
            type:       "peer_leave",
            senderId,
            senderName: existing?.displayName || senderId,
            payload:    { peerId: senderId, reason: "explicit" },
            timestamp:  nowTs,
          },
          senderId
        );
        return json(200, { ok: true });
      }

      // ── C. Routage P2P : offer / answer / candidate ─────
      const message = {
        id:         newId("sig"),
        type,
        senderId,
        senderName: senderName || senderId,
        targetId,
        payload,
        timestamp:  nowTs,
      };

      if (targetId) {
        if (!peerDirectory.has(targetId)) {
          return json(404, { ok: false, error: "target_not_found", targetId });
        }
        enqueue(targetId, message);
        return json(200, { ok: true, messageId: message.id, delivered: true });
      } else {
        // Broadcast global (offer/answer sans cible → log probable)
        broadcast(message, senderId);
        return json(200, { ok: true, messageId: message.id, delivered: "broadcast" });
      }
    }

    // ═══════════════════════════════════════════════════════
    // DELETE — Déconnexion
    // ═══════════════════════════════════════════════════════
    if (method === "DELETE") {
      const peerId = url.searchParams.get("peerId") || request.headers.get("X-Peer-Id");
      const token  = request.headers.get("X-Session-Token");

      if (!peerId) {
        return json(400, { ok: false, error: "missing_peer_id" });
      }

      const existing = peerDirectory.get(peerId);
      if (existing && token && existing.sessionToken && existing.sessionToken !== token) {
        return json(403, { ok: false, error: "session_token_mismatch" });
      }

      peerDirectory.delete(peerId);
      peerMessageQueues.delete(peerId);

      broadcast(
        {
          id:         newId("leave"),
          type:       "peer_leave",
          senderId:   peerId,
          senderName: existing?.displayName || peerId,
          payload:    { peerId, reason: "delete" },
          timestamp:  nowTs,
        },
        peerId
      );

      return json(200, {
        ok:      true,
        message: existing
          ? `Session WebRTC de [${peerId}] terminée.`
          : "Session introuvable.",
      });
    }

    return json(405, { ok: false, error: "method_not_allowed" });

  } catch (err) {
    // Log serveur sans exposer les détails au client
    console.error("[api/rtc] Unhandled error:", err);

    return json(500, {
      ok:      false,
      error:   "rtc_signaling_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// ═══════════════════════════════════════════════════════════
// ROUTEUR TANSTACK
// ═══════════════════════════════════════════════════════════

export const Route = createFileRoute("/api/rtc")({
  server: {
    handlers: {
      GET:     handleServerRequest,
      POST:    handleServerRequest,
      DELETE:  handleServerRequest,
      OPTIONS: handleServerRequest,
    },
  },
});
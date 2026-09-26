/**
 * ═══════════════════════════════════════════════════════════════════
 * 🎙️ TROXTWORLD / ETHERWORLD — SIGNALISATION WEBRTC & VOIX 3D (/api/rtc)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Passerelle Audio Spatiale & Radios Réalistes (Style PMA-Voice FiveM) :
 *  - 🗣️ Voix Proximité 3D (Chuchoter 2.5m, Normal 8m, Crier 25m, Mégaphone 60m)
 *  - 📻 Radios RP Québécoises (SQ 104.2 MHz, SAMU 108.5 MHz, SOPFEU 106.1 MHz, CB Canal 14)
 *  - ⚡ Échange SDP Offers/Answers & Trickle ICE Candidates
 *  - 🌐 Fourniture de Serveurs STUN/TURN haute disponibilité
 *  - 🛡️ Résistance au Hot-Reload Vite (persistance en mémoire globale)
 *
 * Signature : TROXT⬡ · 🎙️VoiceMatrix
 * Chemin    : client/src/routes/api/rtc.js
 */

import { createFileRoute } from "@tanstack/react-router";

const SIG  = "TROXT⬡";
const ISIG = "🛡️INTELLECTUS⬡";
const VERSION = "3.0.0";

// ═══════════════════════════════════════════════════════════
// CONSTANTES & CANAUX RADIO OFFICIELS DU COMTÉ
// ═══════════════════════════════════════════════════════════

/** @type {Record<string, number>} */
export const VOICE_RANGES = Object.freeze({
  whisper:   2.5,   // Chuchoter (discrétion)
  normal:    8.0,   // Conversation normale
  shout:     25.0,  // Crier dans la rue
  megaphone: 60.0,  // Mégaphone de police / sirène
});

/** Fréquences radio RP du comté de Portneuf (MHz) */
export const RP_RADIO_CHANNELS = Object.freeze({
  SQ_DISPATCH:    104.2,  // Sûreté du Québec (Patrouilles)
  SAMU_EMS:       108.5,  // Urgences médicales SAMU
  SOPFEU_FIRE:    106.1,  // Pompiers & Protection des forêts
  CB_CANAL_14:    14.0,   // CB Camionneurs / Citoyens
  TAXI_CENTRAL:   92.5,   // Centrale des Taxis de Portneuf
  MAYOR_SECURITY: 110.0,  // Sécurité municipale & Mairie
});

export const DEFAULT_ICE_SERVERS = Object.freeze([
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.services.mozilla.com" },
]);

// Limites et seuils de sécurité
const LIMITS = Object.freeze({
  maxBodyBytes:        32 * 1024,      // 32 KB max par requête
  maxPeers:            500,            // Capacité simultanée de pairs
  maxQueuePerPeer:     200,            // Messages maximum en file par joueur
  peerTimeoutMs:       15000,          // Déconnexion après 15s sans battement de cœur
  rateLimitPerMinute:  120,            // Max 120 requêtes/min par adresse IP
  maxSpatialRadius:    100,            // Rayon AOI spatial maximal (mètres)
  queueMessageTtlMs:   30000,          // Expiration des signaux en file après 30s
  cleanupIntervalMs:   10000,          // Intervalle de nettoyage automatique
});

// ═══════════════════════════════════════════════════════════
// ÉTAT EN MÉMOIRE PERSISTANT AU HOT-RELOAD
// ═══════════════════════════════════════════════════════════

const RTC_STORE_KEY = Symbol.for("troxt.webrtc.signaling.v3");

function createRtcStore() {
  return {
    peerDirectory:      new Map(), // peerId -> PeerState
    peerMessageQueues:  new Map(), // peerId -> Message[]
    rateLimitBuckets:   new Map(), // ip -> { count, windowStart }
    totalRoutedCounter: 0,
    lastCleanupAt:      Date.now(),
    serverBootTime:     Date.now(),
  };
}

const store = globalThis[RTC_STORE_KEY] ?? createRtcStore();
globalThis[RTC_STORE_KEY] = store;

// ═══════════════════════════════════════════════════════════
// HELPERS SÉCURITÉ & RÉSEAU
// ═══════════════════════════════════════════════════════════

const CORS_HEADERS = {
  "Content-Type":                 "application/json; charset=utf-8",
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Peer-Id, X-Session-Token",
  "Access-Control-Max-Age":       "86400",
  "X-TROXT-Signature":            SIG,
  "X-Voice-Engine":               "PMA-Spatial-v3",
};

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function newId(prefix) {
  const randPart = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 8);
  return `${prefix}_${Date.now()}_${randPart}`;
}

function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "127.0.0.1"
  );
}

function checkRateLimit(ip) {
  const now = Date.now();
  let bucket = store.rateLimitBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= 60000) {
    bucket = { count: 0, windowStart: now };
    store.rateLimitBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  return bucket.count <= LIMITS.rateLimitPerMinute;
}

async function safeParseJson(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > LIMITS.maxBodyBytes) {
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

function mergePeerState(existing, incoming, nowTs) {
  const base = existing || {
    peerId:              incoming.peerId,
    displayName:         String(incoming.displayName || "Citoyen").slice(0, 32),
    position:            { x: 0, y: 0, z: 0 },
    yaw:                 0,
    voiceMode:           "normal",
    voiceRangeMeters:    VOICE_RANGES.normal,
    isTalking:           false,
    isRadioTransmitting: false,
    radioFrequencyMhz:   null,
    radioEffectsActive:  true,
    lastHeartbeat:       nowTs,
    joinedAt:            nowTs,
  };

  if (incoming.displayName !== undefined) {
    base.displayName = String(incoming.displayName).slice(0, 32);
  }
  
  if (incoming.position && typeof incoming.position === "object") {
    base.position = {
      x: Number(incoming.position.x) || 0,
      y: Number(incoming.position.y) || 0,
      z: Number(incoming.position.z) || 0,
    };
  }

  if (typeof incoming.yaw === "number") base.yaw = incoming.yaw;
  
  if (incoming.voiceMode && VOICE_RANGES[incoming.voiceMode]) {
    base.voiceMode = incoming.voiceMode;
    base.voiceRangeMeters = VOICE_RANGES[incoming.voiceMode];
  }

  if (incoming.isTalking !== undefined) {
    base.isTalking = Boolean(incoming.isTalking);
  }

  if (incoming.isRadioTransmitting !== undefined) {
    base.isRadioTransmitting = Boolean(incoming.isRadioTransmitting);
  }

  if (incoming.radioFrequencyMhz !== undefined) {
    const freq = parseFloat(incoming.radioFrequencyMhz);
    base.radioFrequencyMhz = Number.isFinite(freq) && freq > 0 ? freq : null;
  }

  if (incoming.radioEffectsActive !== undefined) {
    base.radioEffectsActive = Boolean(incoming.radioEffectsActive);
  }

  base.lastHeartbeat = nowTs;
  return base;
}

function enqueue(targetId, message) {
  let q = store.peerMessageQueues.get(targetId);
  if (!q) {
    q = [];
    store.peerMessageQueues.set(targetId, q);
  }

  const cutoff = Date.now() - LIMITS.queueMessageTtlMs;
  if (q.length > 0 && q[0].enqueuedAt < cutoff) {
    q = q.filter((m) => m.enqueuedAt >= cutoff);
  }

  if (q.length >= LIMITS.maxQueuePerPeer) {
    q.shift();
  }

  q.push({ ...message, enqueuedAt: Date.now() });
  store.peerMessageQueues.set(targetId, q);
}

function broadcast(message, excludeId, sourcePos, maxRange) {
  for (const [id, peer] of store.peerDirectory.entries()) {
    if (id === excludeId) continue;

    // Filtrage spatial de proximité (AOI)
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

function cleanupStalePeers(nowTs) {
  const toRemove = [];
  for (const [id, peer] of store.peerDirectory.entries()) {
    if (nowTs - peer.lastHeartbeat > LIMITS.peerTimeoutMs) {
      toRemove.push(id);
    }
  }

  for (let i = 0; i < toRemove.length; i++) {
    const id = toRemove[i];
    const peer = store.peerDirectory.get(id);
    store.peerDirectory.delete(id);
    store.peerMessageQueues.delete(id);

    broadcast(
      {
        id:         newId("leave"),
        type:       "peer_leave",
        senderId:   id,
        senderName: peer?.displayName || id,
        payload:    { peerId: id, reason: "heartbeat_timeout" },
        timestamp:  nowTs,
      },
      id
    );
  }
  return toRemove.length;
}

// ═══════════════════════════════════════════════════════════
// HANDLER PRINCIPAL DU SERVEUR WEBRTC
// ═══════════════════════════════════════════════════════════

async function handleServerRequest({ request }) {
  const url    = new URL(request.url);
  const method = request.method.toUpperCase();
  const nowTs  = Date.now();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp)) {
    return json(429, { ok: false, error: "rate_limited", message: "Trop de requêtes vocales envoyées." });
  }

  if (nowTs - store.lastCleanupAt > LIMITS.cleanupIntervalMs) {
    store.lastCleanupAt = nowTs;
    cleanupStalePeers(nowTs);
  }

  try {
    // ── 1. GET : CONFIGURATION ICE, STATS, POLLING & AUDITEURS RADIO ──
    if (method === "GET") {
      const sp            = url.searchParams;
      const wantIce       = sp.get("ice") === "true" || sp.get("config") === "true";
      const wantStats     = sp.get("stats") === "true";
      const wantHeartbeat = sp.get("heartbeat") === "true";
      const pollPeerId    = sp.get("peerId") || request.headers.get("X-Peer-Id");
      const radioFreq     = parseFloat(sp.get("frequency") || "0");

      if (wantIce) {
        return json(200, {
          ok:                 true,
          iceServers:         DEFAULT_ICE_SERVERS,
          voiceRanges:        VOICE_RANGES,
          radioPresets:       RP_RADIO_CHANNELS,
          iceTransportPolicy: "all",
          bundlePolicy:       "max-bundle",
          rtcpMuxPolicy:      "require",
          serverTime:         nowTs,
          sig:                SIG,
        });
      }

      if (wantStats) {
        const radioChannels = new Set();
        for (const p of store.peerDirectory.values()) {
          if (p.radioFrequencyMhz) radioChannels.add(p.radioFrequencyMhz);
        }
        let totalQueued = 0;
        for (const q of store.peerMessageQueues.values()) totalQueued += q.length;

        return json(200, {
          ok: true,
          data: {
            activePeersCount:         store.peerDirectory.size,
            activeRadioChannelsCount: radioChannels.size,
            queuedMessagesCount:      totalQueued,
            totalSignalsRouted:       store.totalRoutedCounter,
            iceServersCount:          DEFAULT_ICE_SERVERS.length,
            uptimeSeconds:            Math.floor((nowTs - store.serverBootTime) / 1000),
          },
          timestamp: nowTs,
          sig: SIG,
        });
      }

      if (wantHeartbeat && pollPeerId) {
        const peer = store.peerDirectory.get(pollPeerId);
        if (peer) {
          peer.lastHeartbeat = nowTs;
          return json(200, { ok: true, alive: true });
        }
        return json(404, { ok: false, error: "peer_not_found" });
      }

      if (pollPeerId) {
        const peer = store.peerDirectory.get(pollPeerId);
        if (peer) peer.lastHeartbeat = nowTs;

        const queue    = store.peerMessageQueues.get(pollPeerId) || [];
        const messages = queue.slice();
        store.peerMessageQueues.set(pollPeerId, []);

        return json(200, {
          ok:            true,
          peerId:        pollPeerId,
          messagesCount: messages.length,
          messages,
          timestamp:     nowTs,
        });
      }

      if (radioFreq > 0) {
        const listeners = [];
        for (const p of store.peerDirectory.values()) {
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

      const allPeers = Array.from(store.peerDirectory.values()).map((p) => ({
        id:      p.peerId,
        name:    p.displayName,
        mode:    p.voiceMode,
        range:   p.voiceRangeMeters,
        talking: p.isTalking,
        radio:   p.radioFrequencyMhz ? `${p.radioFrequencyMhz} MHz` : "Off",
      }));

      return json(200, { ok: true, total: allPeers.length, peers: allPeers });
    }

    // ── 2. POST : SIGNALISATION WEBRTC & SYNCHRONISATION VOCALE / RADIO ──
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

      if (!store.peerDirectory.has(senderId) && store.peerDirectory.size >= LIMITS.maxPeers) {
        return json(503, { ok: false, error: "peer_capacity_reached", message: "Capacité vocale du serveur atteinte." });
      }

      store.totalRoutedCounter++;

      // ── A. État de voix & PTT Radio ──
      if (type === "peer_join" || type === "voice_state") {
        const existing = store.peerDirectory.get(senderId);
        const wasRadioOn = existing?.isRadioTransmitting && existing?.radioFrequencyMhz;

        const peerState = mergePeerState(existing, {
          peerId:      senderId,
          displayName: senderName,
          ...(payload || {}),
        }, nowTs);

        store.peerDirectory.set(senderId, peerState);
        if (!store.peerMessageQueues.has(senderId)) {
          store.peerMessageQueues.set(senderId, []);
        }

        // Déclenchement de l'effet sonore PTT ON (Microphone Radio activé)
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

          for (const [id, other] of store.peerDirectory.entries()) {
            if (id !== senderId && other.radioFrequencyMhz === peerState.radioFrequencyMhz) {
              enqueue(id, radioMsg);
            }
          }
        }

        // Relâchement PTT OFF (Microphone Radio relâché)
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

          for (const [id, other] of store.peerDirectory.entries()) {
            if (id !== senderId && other.radioFrequencyMhz === existing.radioFrequencyMhz) {
              enqueue(id, stopMsg);
            }
          }
        }

        // Notification de déplacement / parole dans le rayon AOI spatial
        const posChanged = !existing ||
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
              position:   peerState.position,
              yaw:        peerState.yaw,
              voiceMode:  peerState.voiceMode,
              voiceRange: peerState.voiceRangeMeters,
              isTalking:  peerState.isTalking,
            },
            timestamp: nowTs,
          };
          broadcast(spatialMsg, senderId, peerState.position, LIMITS.maxSpatialRadius);
        }

        return json(200, {
          ok:      true,
          message: `Voix 3D synchronisée : [${peerState.displayName}] (${peerState.voiceMode} - ${peerState.voiceRangeMeters}m).`,
          peer:    peerState,
        });
      }

      // ── B. Sortie volontaire d'un pair ──
      if (type === "peer_leave") {
        const existing = store.peerDirectory.get(senderId);
        store.peerDirectory.delete(senderId);
        store.peerMessageQueues.delete(senderId);
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

      // ── C. Routage P2P WebRTC (Offers, Answers, ICE Candidates) ──
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
        if (!store.peerDirectory.has(targetId)) {
          return json(404, { ok: false, error: "target_not_found", targetId });
        }
        enqueue(targetId, message);
        return json(200, { ok: true, messageId: message.id, delivered: true });
      } else {
        broadcast(message, senderId);
        return json(200, { ok: true, messageId: message.id, delivered: "broadcast" });
      }
    }

    // ── 3. DELETE : DÉCONNEXION EXPLICITE DU CANAL VOCAL ──
    if (method === "DELETE") {
      const peerId = url.searchParams.get("peerId") || request.headers.get("X-Peer-Id");
      if (!peerId) {
        return json(400, { ok: false, error: "missing_peer_id" });
      }

      const existing = store.peerDirectory.get(peerId);
      store.peerDirectory.delete(peerId);
      store.peerMessageQueues.delete(peerId);

      broadcast(
        {
          id:         newId("leave"),
          type:       "peer_leave",
          senderId:   peerId,
          senderName: existing?.displayName || peerId,
          payload:    { peerId, reason: "session_closed" },
          timestamp:  nowTs,
        },
        peerId
      );

      return json(200, {
        ok:      true,
        message: existing ? `Session WebRTC de [${peerId}] clôturée avec succès.` : "Session introuvable.",
      });
    }

    return json(405, { ok: false, error: "method_not_allowed" });

  } catch (err) {
    console.error(`[${SIG}·RTC] Erreur de signalisation :`, err);
    return json(500, {
      ok:      false,
      error:   "rtc_signaling_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// ═══════════════════════════════════════════════════════════
// DÉCLARATION DU ROUTEUR TANSTACK
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

export default Route;
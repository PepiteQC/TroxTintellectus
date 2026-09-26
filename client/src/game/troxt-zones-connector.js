/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/TROXT-ZONES-CONNECTOR.JS
 * Connecte worldconfig (zonage RP Portneuf) au cerveau TROXT⬡
 * ═══════════════════════════════════════════════════════════════════
 * Expose le système de zones (patrouilles SQ, POI, événements,
 * factions, quêtes) au serveur RP multijoueur + sécurité Intellectus.
 *
 * NE MODIFIE PAS worldconfig : il l'importe et l'orchestre.
 *
 * ⚠️  Version CLIENT (navigateur). Le emit HTTP vers 4200 est cross-origin —
 *     le serveur 4200 doit autoriser CORS (Access-Control-Allow-Origin: *).
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/troxt-zones-connector.js
 */

import {
  worldConfig,
  ZONE_CONFIGS,
  ZONE_POIS,
  ZONE_PATROLS,
  ZONE_TRADE_ROUTES,
} from './worldconfig.js';

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

// Zone neutre renvoyée quand les coordonnées ne matchent aucune zone connue
const UNKNOWN_ZONE = {
  zoneName: 'inconnu',
  displayName: 'Zone inconnue',
  rpType: 'wilderness',
  isSafeZone: false,
  dominantFaction: null,
  speedLimit: 0,
  policeResponseSeconds: 60,
  crimeRate: 0,
  village: null,
  biome: 'mixed',
  services: [],
  requiredLevel: 0,
};

// Compte sûr pour tableaux OU objets associatifs
function countOf(x) {
  if (Array.isArray(x)) return x.length;
  if (x && typeof x === 'object') return Object.keys(x).length;
  return 0;
}

export class TroxtZonesConnector {
  constructor(emit) {
    this.sig = SIG;
    this._lastZone = null;
    this._discoveredPois = new Set();

    // ✅ N'accepte que les vraies fonctions — sinon fallback HTTP
    this.emit = (typeof emit === 'function')
      ? emit
      : (async (event, data) => {
          try {
            await fetch('http://localhost:4200/lua/emit', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ event, data: { ...data, sig: SIG } }),
              signal:  AbortSignal.timeout(1500),
            });
          } catch {
            // CORS ou réseau indisponible — non bloquant. Si tu veux debug :
            // console.warn(`[${SIG}·Zones] emit échoué:`, event);
          }
        });
  }

  // ─── SUIVI DU JOUEUR : détecte les changements de zone ─────────────────────
  updatePlayer(playerId, x, z, opts) {
    const zone = worldConfig.at(x, z) || UNKNOWN_ZONE;   // ✅ garde

    if (zone.zoneName !== this._lastZone) {
      this._lastZone = zone.zoneName;
      this.emit('troxtworld:zone_entered', {
        player_id: playerId,
        zone: zone.zoneName,
        display: zone.displayName,
        rp_type: zone.rpType,
        safe: zone.isSafeZone,
        faction: zone.dominantFaction,
        speed_limit: zone.speedLimit,
        police_response: zone.policeResponseSeconds,
        crime_rate: zone.crimeRate,
      });

      if (opts && !worldConfig.isZoneAccessible(
        zone.zoneName, opts.level ?? 1, opts.reputation ?? 0, opts.items ?? [],
      )) {
        this.emit('intellectus:zone_access_denied', {
          player_id: playerId, zone: zone.zoneName,
          required_level: zone.requiredLevel, sig: ISIG,
        });
      }
    }

    const poi = worldConfig.getNearestPOI(x, z, 15);
    if (poi && !this._discoveredPois.has(poi.id)) {
      this._discoveredPois.add(poi.id);
      this.emit('troxtworld:poi_discovered', {
        player_id: playerId, poi: poi.id, name: poi.name,
        type: poi.type, reward: poi.discoveryReward,
      });
    }

    return zone;
  }

  // ─── PATROUILLES SQ ────────────────────────────────────────────────────────
  policeMultiplierAt(x, z) {
    return worldConfig.policeCatchMul(x, z);
  }

  reportCrime(playerId, x, z, crimeType) {
    const zone = worldConfig.at(x, z) || UNKNOWN_ZONE;   // ✅ garde
    const mul  = worldConfig.policeCatchMul(x, z);

    // ✅ garde si ZONE_PATROLS n'est pas un tableau
    const patrolNearby = Array.isArray(ZONE_PATROLS)
      && ZONE_PATROLS.some(p => p.zoneName === zone.zoneName);

    this.emit('troxtworld:crime_in_zone', {
      player_id: playerId, zone: zone.zoneName,
      crime: crimeType, response_sec: zone.policeResponseSeconds,
      multiplier: mul, patrol_nearby: patrolNearby,
    });

    if (zone.isSafeZone) {
      this.emit('intellectus:crime_in_safezone', {
        player_id: playerId, zone: zone.zoneName, crime: crimeType, sig: ISIG,
      });
    }

    return {
      responseSeconds: zone.policeResponseSeconds,
      patrolNearby,
      multiplier: mul,
    };
  }

  // ─── ÉVÉNEMENTS LOCAUX ACTIFS ──────────────────────────────────────────────
  syncActiveEvents() {
    const active = worldConfig.getActiveLocalEvents() || [];
    if (active.length) {
      this.emit('troxtworld:active_events', {
        count:  active.length,
        events: active.map(e => ({
          id: e.id, name: e.name, type: e.type, location: e.location,
        })),
      });
    }
    return active;
  }

  getActiveSpawns(type, hour) {
    return worldConfig.getActiveSpawnPoints(type, hour) || [];
  }

  // ─── INFO ZONE POUR LE HUD ─────────────────────────────────────────────────
  describe(x, z) {
    return worldConfig.describe(x, z);
  }

  zoneInfo(x, z) {
    const zc = worldConfig.at(x, z) || UNKNOWN_ZONE;   // ✅ garde
    return {
      name:       zc.zoneName,
      display:    zc.displayName,
      rpType:     zc.rpType,
      village:    zc.village,
      speedLimit: zc.speedLimit,
      safe:       zc.isSafeZone,
      faction:    zc.dominantFaction,
      biome:      zc.biome,
      crimeRate:  zc.crimeRate,
      services:   zc.services,
      sig:        SIG,
    };
  }

  // ─── STATS ─────────────────────────────────────────────────────────────────
  getStats() {
    return {
      zones:       countOf(ZONE_CONFIGS),      // ✅ sûr pour tableau OU objet
      pois:        countOf(ZONE_POIS),
      patrols:     countOf(ZONE_PATROLS),
      tradeRoutes: countOf(ZONE_TRADE_ROUTES),
      discovered:  this._discoveredPois.size,
      sig:         SIG,
    };
  }

  reportToTroxt() {
    const stats = this.getStats();
    this.emit('troxtworld:zones_ready', { ...stats });
    console.log(`[${SIG}·Zones] ${stats.zones} zones · ${stats.pois} POI · ${stats.patrols} patrouilles SQ`);
  }
}

export const zonesConnector = new TroxtZonesConnector();
export { SIG };
export default TroxtZonesConnector;
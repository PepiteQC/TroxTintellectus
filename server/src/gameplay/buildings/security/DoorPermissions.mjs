/**
 * DoorPermissions — Logique d'accès
 * Path: server/src/gameplay/buildings/security/DoorPermissions.mjs
 * Signature : TROXT⬡
 */
import { LOCK_MODES, isInHours } from "../../../../../shared/buildings/doors/DoorTypes.mjs";

export class DoorPermissions {
  constructor({ keysRepository, staffRepository, residentsRepository, alarmService } = {}) {
    this.keys       = keysRepository       || new Map();  // Map<playerId, Set<uid>>
    this.staff      = staffRepository      || new Map();  // Map<buildingId, Set<playerId>>
    this.residents  = residentsRepository  || new Map();  // Map<buildingId, Set<playerId>>
    this.alarm      = alarmService;
  }

  /**
   * Vérifie si un joueur peut accéder à une porte.
   * @param {DoorState} door
   * @param {object} player
   * @param {object} [opts]
   * @returns {{allowed:boolean, reason:string}}
   */
  canAccess(door, player, opts = {}) {
    if (!door || !player) return { allowed:false, reason:"INVALID" };
    if (door.broken) return { allowed:true, reason:"BROKEN" };
    if (!door.isLocked) return { allowed:true, reason:"UNLOCKED" };
    if (player.isAdmin) return { allowed:true, reason:"ADMIN" };

    // Raid police en cours ?
    if (opts.raidActive && player.faction === "police") {
      return { allowed:true, reason:"POLICE_RAID" };
    }

    if (door.minLevel > 0 && (player.level || 1) < door.minLevel) {
      return { allowed:false, reason:"LEVEL_TOO_LOW" };
    }

    // Propriétaire / staff
    const staffSet = this.staff.get(door.buildingId);
    if (staffSet && staffSet.has(player.id)) return { allowed:true, reason:"STAFF" };

    switch (door.lockMode) {
      case LOCK_MODES.NONE:
        return { allowed:true, reason:"NO_LOCK" };

      case LOCK_MODES.HOURS: {
        const h = opts.worldHour ?? 12;
        return isInHours(door.hours, h)
          ? { allowed:true,  reason:"OPEN" }
          : { allowed:false, reason:"CLOSED" };
      }

      case LOCK_MODES.KEY: {
        const set = this.keys.get(player.id);
        if (set && set.has(door.uid)) return { allowed:true, reason:"KEY" };
        return { allowed:false, reason:"NO_KEY" };
      }

      case LOCK_MODES.BADGE: {
        if (door.isResidents) {
          const res = this.residents.get(door.buildingId);
          if (res && res.has(player.id)) return { allowed:true, reason:"RESIDENT" };
        }
        return { allowed:false, reason:"NO_BADGE" };
      }

      case LOCK_MODES.CODE:
        return { allowed:false, reason:"NEEDS_CODE" };  // validé séparément

      case LOCK_MODES.OWNER:
        return { allowed:false, reason:"OWNER_ONLY" };

      case LOCK_MODES.JOB:
        if (player.job === door.job) return { allowed:true, reason:"JOB" };
        return { allowed:false, reason:"NOT_EMPLOYED" };

      case LOCK_MODES.FACTION:
        if (player.faction === door.faction && (player.factionRank || 0) >= door.minRank) {
          return { allowed:true, reason:"FACTION" };
        }
        return { allowed:false, reason:"NOT_FACTION_MEMBER" };

      default:
        return { allowed:false, reason:"UNKNOWN_LOCK" };
    }
  }

  /** Vérifie le code numérique */
  verifyCode(door, code) {
    if (!door || !door.codeHash) return false;
    // NOTE : remplacer par bcrypt.compare() en prod
    return door.codeHash === this._hashCode(code);
  }

  /** Hash simple (à remplacer par bcrypt côté Node) */
  _hashCode(code) {
    let h = 0;
    const s = "TROXT_SALT_" + String(code);
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  // ─── Gestion des clés ───────────────────────────────────────────────────
  giveKey(playerId, doorUid) {
    if (!this.keys.has(playerId)) this.keys.set(playerId, new Set());
    this.keys.get(playerId).add(doorUid);
  }

  revokeKey(playerId, doorUid) {
    const s = this.keys.get(playerId);
    if (s) s.delete(doorUid);
  }

  hasKey(playerId, doorUid) {
    const s = this.keys.get(playerId);
    return s && s.has(doorUid);
  }

  // ─── Staff / Residents ──────────────────────────────────────────────────
  addStaff(buildingId, playerId) {
    if (!this.staff.has(buildingId)) this.staff.set(buildingId, new Set());
    this.staff.get(buildingId).add(playerId);
  }

  removeStaff(buildingId, playerId) {
    const s = this.staff.get(buildingId);
    if (s) s.delete(playerId);
  }

  addResident(buildingId, playerId) {
    if (!this.residents.has(buildingId)) this.residents.set(buildingId, new Set());
    this.residents.get(buildingId).add(playerId);
  }

  removeResident(buildingId, playerId) {
    const s = this.residents.get(buildingId);
    if (s) s.delete(playerId);
  }
}

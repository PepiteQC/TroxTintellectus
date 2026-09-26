/**
 * DoorManager — Gestionnaire central des portes (runtime + persistance)
 * Path: server/src/gameplay/buildings/security/DoorManager.mjs
 * Signature : TROXT⬡
 */
import { EventEmitter } from "node:events";
import { DoorState } from "./DoorState.mjs";
import { DoorPermissions } from "./DoorPermissions.mjs";
import { DoorAlarmService } from "./DoorAlarmService.mjs";
import { DOOR_EVENTS } from "../../../../../shared/buildings/doors/DoorEvents.mjs";
import { DOOR_ERROR, DOOR_MSG } from "../../../../../shared/buildings/doors/DoorProtocol.mjs";

export class DoorManager extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object} opts.db         — instance Drizzle
   * @param {object} opts.audit      — service d'audit (Intellectus)
   * @param {object} opts.policeDispatch — callback dispatch police
   */
  constructor(opts = {}) {
    super();
    this.db        = opts.db;
    this.audit     = opts.audit;
    this.alarmSvc  = new DoorAlarmService({ auditService: this.audit, policeDispatch: opts.policeDispatch });
    this.perm      = new DoorPermissions({ alarmService: this.alarmSvc });

    /** @type {Map<string, DoorState>} */
    this.doors = new Map();
    /** @type {Map<string, Set<string>>}  buildingId → Set<doorUid> */
    this.byBuilding = new Map();

    // Relayer les événements d'alarme
    this.alarmSvc.on(DOOR_EVENTS.ALARM_TRIGGERED, (d) => this.emit(DOOR_EVENTS.ALARM_TRIGGERED, d));
    this.alarmSvc.on(DOOR_EVENTS.ALARM_RESET,     (d) => this.emit(DOOR_EVENTS.ALARM_RESET,     d));
  }

  // ─── CHARGEMENT ──────────────────────────────────────────────────────────

  /** Charge les portes depuis la DB */
  async loadFromDB() {
    if (!this.db) return;
    const rows = await this.db.select().from(this.db.schema.doors);
    for (const row of rows) {
      const state = DoorState.fromDB(row);
      this.doors.set(state.uid, state);
      if (!this.byBuilding.has(state.buildingId)) {
        this.byBuilding.set(state.buildingId, new Set());
      }
      this.byBuilding.get(state.buildingId).add(state.uid);
    }
  }

  /** Enregistre une porte (setup initial) */
  async register(config) {
    const state = new DoorState(config);
    this.doors.set(state.uid, state);
    if (!this.byBuilding.has(state.buildingId)) {
      this.byBuilding.set(state.buildingId, new Set());
    }
    this.byBuilding.get(state.buildingId).add(state.uid);

    // Persiste en DB
    if (this.db) {
      try {
        await this.db.insert(this.db.schema.doors).values(state.toDBRow()).onConflictDoNothing();
      } catch (e) { console.error("[DoorManager] insert failed:", e.message); }
    }

    this.emit(DOOR_EVENTS.DOOR_CREATED, { uid: state.uid });
    return state;
  }

  // ─── GETTERS ────────────────────────────────────────────────────────────
  getDoor(uid)          { return this.doors.get(uid); }
  getBuildingDoors(bId) {
    const s = this.byBuilding.get(bId);
    return s ? Array.from(s).map((u) => this.doors.get(u)) : [];
  }
  getAllDoors() { return Array.from(this.doors.values()); }

  // ─── ACTIONS ────────────────────────────────────────────────────────────

  /**
   * Ouvre une porte.
   * @returns {{ok:boolean, reason?:string, door?:DoorState}}
   */
  open(uid, player, opts = {}) {
    const door = this.doors.get(uid);
    if (!door) return { ok:false, reason:DOOR_ERROR.NOT_FOUND };
    if (door.isOpen) return { ok:true, door };

    // Distance ?
    if (opts.playerX !== undefined && opts.playerZ !== undefined) {
      const dx = opts.playerX - door.position.x;
      const dz = opts.playerZ - door.position.z;
      if (Math.sqrt(dx*dx + dz*dz) > 4.5) {
        return { ok:false, reason:DOOR_ERROR.TOO_FAR };
      }
    }

    // Occupation (cabine)
    if (door.occupancy && door.occupants.size >= door.occupancy && !door.occupants.has(player.id)) {
      return { ok:false, reason:DOOR_ERROR.OCCUPIED };
    }

    const access = this.perm.canAccess(door, player, opts);
    if (!access.allowed) {
      // Code fourni ?
      if (access.reason === "NEEDS_CODE" && opts.code) {
        if (this.perm.verifyCode(door, opts.code)) {
          door.isLocked = false;
        } else {
          this.emit(DOOR_EVENTS.DOOR_CODE_FAIL, { uid, playerId: player.id });
          this.alarmSvc.trigger(door, player.id, "code_bruteforce");
          return { ok:false, reason:DOOR_ERROR.INVALID_CODE };
        }
      } else {
        this.emit(DOOR_EVENTS.DOOR_ACCESS_DENIED, { uid, playerId:player.id, reason:access.reason });
        return { ok:false, reason:access.reason };
      }
    }

    // Frais d'entrée ?
    if (door.entryFee && player.id !== door.meta.ownerId) {
      if ((player.cash || 0) < door.entryFee) {
        return { ok:false, reason:"INSUFFICIENT_FUNDS" };
      }
    }

    door.isOpen    = true;
    door.openedBy  = player.id;
    door.openedAt  = Date.now();
    door.touch();

    this.emit(DOOR_EVENTS.DOOR_OPENED, { uid, by:player.id });
    this._scheduleAutoClose(door);
    this._persist(door);

    return { ok:true, door };
  }

  /**
   * Ferme une porte.
   */
  close(uid, playerId) {
    const door = this.doors.get(uid);
    if (!door || !door.isOpen) return { ok:false, reason:DOOR_ERROR.NOT_FOUND };
    if (door.broken) return { ok:false, reason:DOOR_ERROR.BROKEN };

    door.isOpen   = false;
    door.openedBy = null;
    door.openedAt = null;
    door.touch();

    this.emit(DOOR_EVENTS.DOOR_CLOSED, { uid, by:playerId });
    this._persist(door);
    return { ok:true, door };
  }

  /**
   * Toggle open/close.
   */
  toggle(uid, player, opts = {}) {
    const door = this.doors.get(uid);
    if (!door) return { ok:false, reason:DOOR_ERROR.NOT_FOUND };
    return door.isOpen ? this.close(uid, player.id) : this.open(uid, player, opts);
  }

  /**
   * Verrouille / déverrouille.
   */
  setLock(uid, player, locked) {
    const door = this.doors.get(uid);
    if (!door) return { ok:false, reason:DOOR_ERROR.NOT_FOUND };
    if (door.broken) return { ok:false, reason:DOOR_ERROR.BROKEN };

    const allowed =
      player.isAdmin ||
      this.perm.hasKey(player.id, uid) ||
      (door.faction && player.faction === door.faction && (player.factionRank || 0) >= Math.max(door.minRank, 2)) ||
      (door.job && player.job === door.job);
    if (!allowed) return { ok:false, reason:DOOR_ERROR.NO_PERMISSION };

    door.isLocked = locked;
    if (locked && door.isOpen) this.close(uid, player.id);
    door.touch();

    this.emit(locked ? DOOR_EVENTS.DOOR_LOCKED : DOOR_EVENTS.DOOR_UNLOCKED, {
      uid, by: player.id,
    });
    this._persist(door);
    return { ok:true, door };
  }

  /**
   * Lockpick.
   */
  lockpick(uid, player, skill, tool) {
    const door = this.doors.get(uid);
    if (!door) return { ok:false, reason:DOOR_ERROR.NOT_FOUND };
    if (!door.isLocked) return { ok:false, reason:"ALREADY_UNLOCKED" };

    const def = getDoorType(door.type);
    if (door.lockMode === "biometric" || def.lockpick_diff >= 10) {
      return { ok:false, reason:"UNPICKABLE" };
    }

    const bonus  = tool === "advanced_lockpick" ? 2 : 0;
    const chance = Math.max(0.05, Math.min(0.95, 0.5 + ((skill || 0) + bonus - def.lockpick_diff) * 0.1));
    const roll   = Math.random();

    if (roll <= chance) {
      door.isLocked = false;
      door.touch();
      this.emit(DOOR_EVENTS.DOOR_LOCKPICK_OK, { uid, by:player.id });
      if (door.alarmEnabled && Math.random() < 0.35) {
        this.alarmSvc.trigger(door, player.id, "lockpick_silent");
      }
      this._persist(door);
      return { ok:true, door, chance };
    }

    const toolBroke = Math.random() < 0.4;
    this.emit(DOOR_EVENTS.DOOR_LOCKPICK_FAIL, { uid, by:player.id, tool_broke:toolBroke });
    if (door.alarmEnabled) this.alarmSvc.trigger(door, player.id, "lockpick_fail");
    return { ok:false, reason:"PICK_FAILED", tool_broke:toolBroke };
  }

  /**
   * Breach (forcer avec un outil).
   */
  breach(uid, player, tool) {
    const door = this.doors.get(uid);
    if (!door) return { ok:false, reason:DOOR_ERROR.NOT_FOUND };
    if (door.broken) return { ok:true, door, reason:"ALREADY_BROKEN" };

    if (!isBreachValid(door.type, tool)) {
      return { ok:false, reason:DOOR_ERROR.INVALID_TOOL };
    }

    const t = BREACH_TOOLS[tool];
    door.hp = Math.max(0, door.hp - t.dmg);
    door.touch();

    if (door.alarmEnabled) this.alarmSvc.trigger(door, player.id, "breach");

    if (door.hp <= 0) {
      door.broken   = true;
      door.isLocked = false;
      door.isOpen   = true;
      this.emit(DOOR_EVENTS.DOOR_BROKEN, { uid, by:player.id, tool });
    } else {
      this.emit(DOOR_EVENTS.DOOR_DAMAGED, { uid, hp:door.hp, max:door.maxHp });
    }
    this._persist(door);
    return { ok:true, door };
  }

  /**
   * Toque à la porte.
   */
  knock(uid, playerId) {
    const door = this.doors.get(uid);
    if (!door) return { ok:false, reason:DOOR_ERROR.NOT_FOUND };
    this.emit(DOOR_EVENTS.DOOR_KNOCKED, { uid, by:playerId });
    return { ok:true };
  }

  /**
   * Interphone — autoriser un visiteur.
   */
  buzz(uid, residentId, visitorId, durationMs = 300_000) {
    const door = this.doors.get(uid);
    if (!door) return { ok:false, reason:DOOR_ERROR.NOT_FOUND };
    if (!door.meta.visitors) door.meta.visitors = {};
    door.meta.visitors[visitorId] = Date.now() + durationMs;
    this.emit(DOOR_EVENTS.DOOR_BUZZ, { uid, by:residentId, visitor:visitorId });
    return { ok:true };
  }

  /**
   * Réparer une porte.
   */
  repair(uid, player) {
    const door = this.doors.get(uid);
    if (!door) return { ok:false, reason:DOOR_ERROR.NOT_FOUND };
    const cost = Math.floor((door.maxHp - door.hp) * 5);

    door.hp         = door.maxHp;
    door.broken     = false;
    door.isOpen     = false;
    door.isLocked   = door.lockMode !== "none";
    door.alarmActive= false;
    door.touch();

    this.emit(DOOR_EVENTS.DOOR_REPAIRED, { uid, by:player.id, cost });
    this._persist(door);
    return { ok:true, door, cost };
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────
  _scheduleAutoClose(door) {
    setTimeout(() => {
      const d = this.doors.get(door.uid);
      if (d && d.isOpen && !d.broken) this.close(d.uid, "auto");
    }, door.autoCloseMs);
  }

  async _persist(door) {
    if (!this.db) return;
    try {
      await this.db.update(this.db.schema.doors)
        .set(door.toDBRow())
        .where(this.db.eq(this.db.schema.doors.uid, door.uid));
    } catch (e) {
      console.error("[DoorManager] persist failed:", e.message);
    }
  }

  /** Tick périodique */
  tick() {
    this.alarmSvc.tick();
  }
}

// Import circulaire évité
import { getDoorType, BREACH_TOOLS, isBreachValid } from "../../../../../shared/buildings/doors/DoorTypes.mjs";

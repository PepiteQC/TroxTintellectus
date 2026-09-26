/**
 * DoorAlarmService — Gestion des alarmes
 * Path: server/src/gameplay/buildings/security/DoorAlarmService.mjs
 * Signature : TROXT⬡
 */
import { EventEmitter } from "node:events";
import { DOOR_EVENTS } from "../../../../../shared/buildings/doors/DoorEvents.mjs";

const ALARM_TTL_MS = 5 * 60 * 1000;  // 5 min
const COOLDOWN_MS  = 2 * 60 * 1000;  // 2 min entre déclenchements

export class DoorAlarmService extends EventEmitter {
  constructor({ auditService, policeDispatch } = {}) {
    super();
    this.audit          = auditService;
    this.policeDispatch = policeDispatch;
    /** @type {Map<string, {level:number, since:number, by:string, ttl:number}>} */
    this.alarms         = new Map();
    /** @type {Map<string, number>} */
    this.cooldowns      = new Map();
  }

  /**
   * Déclenche une alarme sur une porte.
   * @param {DoorState} door
   * @param {string} playerId
   * @param {string} cause   // "lockpick" | "breach" | "code_bruteforce"
   */
  trigger(door, playerId, cause) {
    if (!door.alarmEnabled) return false;
    const now = Date.now();
    if ((this.cooldowns.get(door.uid) || 0) > now) return false;

    door.alarmActive = true;
    door.alarmSince  = now;
    door.touch();

    this.alarms.set(door.uid, {
      level: door.alarmLevel,
      since: now,
      by:    playerId,
      ttl:   now + ALARM_TTL_MS,
    });
    this.cooldowns.set(door.uid, now + COOLDOWN_MS);

    // Audit
    if (this.audit) {
      this.audit.log("DOOR_ALARM", {
        door_uid:  door.uid,
        building:  door.buildingId,
        level:     door.alarmLevel,
        cause,
        player_id: playerId,
      });
    }

    // Dispatch police
    if (this.policeDispatch && door.alarmLevel >= 3) {
      this.policeDispatch({
        door_uid:  door.uid,
        building:  door.buildingId,
        zone:      door.meta?.zone,
        level:     door.alarmLevel,
        suspect:   playerId,
        responseIn: Math.max(10, 60 - door.alarmLevel * 10),
      });
    }

    this.emit(DOOR_EVENTS.ALARM_TRIGGERED, {
      uid: door.uid, level: door.alarmLevel, cause, by: playerId,
    });
    return true;
  }

  /** Réinitialise une alarme */
  reset(door, playerId) {
    if (!door.alarmActive) return false;
    door.alarmActive = false;
    door.alarmSince  = null;
    door.touch();
    this.alarms.delete(door.uid);
    this.cooldowns.delete(door.uid);

    if (this.audit) {
      this.audit.log("DOOR_ALARM_RESET", { door_uid: door.uid, by: playerId });
    }

    this.emit(DOOR_EVENTS.ALARM_RESET, { uid: door.uid, by: playerId });
    return true;
  }

  /** Tick périodique — expire les alarmes anciennes */
  tick() {
    const now = Date.now();
    for (const [uid, alarm] of this.alarms) {
      if (now > alarm.ttl) {
        this.alarms.delete(uid);
        this.emit(DOOR_EVENTS.ALARM_EXPIRED, { uid });
      }
    }
  }

  getActiveAlarms() {
    return Array.from(this.alarms.entries()).map(([uid, a]) => ({
      uid, level:a.level, since:a.since, by:a.by,
    }));
  }
}

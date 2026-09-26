/**
 * DoorState — État en mémoire d'une porte (runtime)
 * Path: server/src/gameplay/buildings/security/DoorState.mjs
 * Signature : TROXT⬡
 */
import { getDoorType } from "../../../../../shared/buildings/doors/DoorTypes.mjs";

export class DoorState {
  /** @param {object} config */
  constructor(config) {
    const def = getDoorType(config.type);

    this.uid          = config.uid;
    this.buildingId   = config.buildingId;
    this.doorId       = config.doorId;
    this.type         = config.type;
    this.anim         = config.anim || def.anim;
    this.openMs       = config.openMs || def.open_ms;
    this.lockMode     = config.lockMode || "none";

    // Permissions
    this.faction      = config.faction || null;
    this.job          = config.job || null;
    this.minRank      = config.minRank || 0;
    this.minLevel     = config.minLevel || 0;

    // Flags
    this.isPublic     = config.isPublic || false;
    this.isStaff      = config.isStaff || false;
    this.isResidents  = config.isResidents || false;
    this.alarmEnabled = config.alarmEnabled || false;
    this.alarmLevel   = config.alarmLevel || 2;
    this.entryFee     = config.entryFee || null;
    this.occupancy    = config.occupancy || null;
    this.hours        = config.hours || null;

    // État
    this.isOpen       = false;
    this.isLocked     = config.lockMode !== "none" && !def.never_locks;
    this.broken       = false;
    this.hp           = def.hp;
    this.maxHp        = def.hp;
    this.alarmActive  = false;
    this.alarmSince   = null;
    this.openedBy     = null;
    this.openedAt     = null;
    this.autoCloseMs  = def.auto_sensor ? 3000 : 8000;

    // Codes
    this.codeHash     = config.codeHash || null;

    // Occupation (cabines/toilettes)
    this.occupants    = new Set();

    // Meta
    this.position     = config.position || { x:0, y:0, z:0 };
    this.meta         = config.meta || {};
    this.createdAt    = Date.now();
    this.updatedAt    = Date.now();
  }

  touch() { this.updatedAt = Date.now(); }

  /** Snapshot public (sans code) envoyé au client */
  toPublicJSON() {
    return {
      uid:           this.uid,
      building_id:   this.buildingId,
      door_id:       this.doorId,
      type:          this.type,
      anim:          this.anim,
      open_ms:       this.openMs,
      is_open:       this.isOpen,
      is_locked:     this.isLocked,
      broken:        this.broken,
      hp:            this.hp,
      max_hp:        this.maxHp,
      alarm_active:  this.alarmActive,
      alarm_level:   this.alarmLevel,
      lock:          this.lockMode,
      public:        this.isPublic,
      entry_fee:     this.entryFee,
    };
  }

  /** Snapshot DB pour persistance */
  toDBRow() {
    return {
      uid:          this.uid,
      building_id:  this.buildingId,
      door_id:      this.doorId,
      type:         this.type,
      anim:         this.anim,
      open_ms:      this.openMs,
      lock_mode:    this.lockMode,
      faction:      this.faction,
      job:          this.job,
      min_rank:     this.minRank,
      min_level:    this.minLevel,
      is_public:    this.isPublic,
      is_staff:     this.isStaff,
      is_residents: this.isResidents,
      alarm_enabled:this.alarmEnabled,
      alarm_level:  this.alarmLevel,
      entry_fee:    this.entryFee,
      occupancy:    this.occupancy,
      is_open:      this.isOpen,
      is_locked:    this.isLocked,
      broken:       this.broken,
      hp:           this.hp,
      max_hp:       this.maxHp,
      alarm_active: this.alarmActive,
      code_hash:    this.codeHash,
      position:     this.position,
      meta:         this.meta,
    };
  }

  static fromDB(row) {
    const s = new DoorState({
      uid:          row.uid,
      buildingId:   row.building_id,
      doorId:       row.door_id,
      type:         row.type,
      anim:         row.anim,
      openMs:       row.open_ms,
      lockMode:     row.lock_mode,
      faction:      row.faction,
      job:          row.job,
      minRank:      row.min_rank,
      minLevel:     row.min_level,
      isPublic:     row.is_public,
      isStaff:      row.is_staff,
      isResidents:  row.is_residents,
      alarmEnabled: row.alarm_enabled,
      alarmLevel:   row.alarm_level,
      entryFee:     row.entry_fee,
      occupancy:    row.occupancy,
      codeHash:     row.code_hash,
      position:     row.position,
      meta:         row.meta,
    });
    s.isOpen      = row.is_open;
    s.isLocked    = row.is_locked;
    s.broken      = row.broken;
    s.hp          = row.hp;
    s.maxHp       = row.max_hp;
    s.alarmActive = row.alarm_active;
    return s;
  }
}

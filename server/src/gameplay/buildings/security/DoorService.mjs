/**
 * DoorService — Point d'entrée public (WebSocket handler + API)
 * Path: server/src/gameplay/buildings/security/DoorService.mjs
 * Signature : TROXT⬡
 */
import { DoorManager } from "./DoorManager.mjs";
import { DOOR_MSG, DOOR_ERROR, decodeMessage, encodeMessage } from "../../../../../shared/buildings/doors/DoorProtocol.mjs";
import { DOOR_EVENTS } from "../../../../../shared/buildings/doors/DoorEvents.mjs";

export class DoorService {
  /**
   * @param {object} opts
   * @param {object} opts.db
   * @param {object} opts.audit
   * @param {object} opts.policeDispatch
   */
  constructor(opts = {}) {
    this.manager = new DoorManager(opts);
    /** @type {Map<string, Set<WebSocket>>}  uid → set ws */
    this.subscribers = new Map();
    /** @type {Map<WebSocket, {player:object}>} */
    this.clients = new Map();
    /** @type {Map<string, {attempts:number, lockedUntil:number}>} */
    this.codeFails = new Map();

    // Repropager les events du manager
    const relay = (eventName) => {
      this.manager.on(eventName, (data) => this._broadcast(eventName, data));
    };
    [
      DOOR_EVENTS.DOOR_OPENED,
      DOOR_EVENTS.DOOR_CLOSED,
      DOOR_EVENTS.DOOR_LOCKED,
      DOOR_EVENTS.DOOR_UNLOCKED,
      DOOR_EVENTS.DOOR_BROKEN,
      DOOR_EVENTS.DOOR_DAMAGED,
      DOOR_EVENTS.ALARM_TRIGGERED,
      DOOR_EVENTS.ALARM_RESET,
      DOOR_EVENTS.DOOR_KNOCKED,
      DOOR_EVENTS.DOOR_BUZZ,
    ].forEach(relay);
  }

  // ─── API PUBLIQUE ───────────────────────────────────────────────────────
  async init() {
    await this.manager.loadFromDB();
    return this;
  }

  /** Enregistre une porte */
  register(config) {
    return this.manager.register(config);
  }

  /** Tick à appeler périodiquement (ex: setInterval 1s) */
  tick() {
    this.manager.tick();
  }

  // ─── WEBSOCKET HANDLER ──────────────────────────────────────────────────
  /**
   * @param {WebSocket} ws
   * @param {object} player
   */
  attach(ws, player) {
    this.clients.set(ws, { player });

    ws.on("message", (raw) => this._handleMessage(ws, raw));
    ws.on("close",    () => this._handleClose(ws));
    ws.on("error",    (err) => console.error("[DoorService] ws error:", err.message));
  }

  _handleClose(ws) {
    this.clients.delete(ws);
    for (const set of this.subscribers.values()) set.delete(ws);
  }

  async _handleMessage(ws, raw) {
    const decoded = decodeMessage(raw);
    if (!decoded.ok) return this._sendError(ws, decoded.error);

    const { type, data } = decoded;
    const { player } = this.clients.get(ws) || {};
    if (!player) return this._sendError(ws, "NOT_AUTHENTICATED");

    const uid = data?.uid;
    if (uid && ![DOOR_MSG.DOOR_SYNC].includes(type)) {
      // S'assurer que le client est bien abonné
      if (!this.subscribers.has(uid)) this.subscribers.set(uid, new Set());
      this.subscribers.get(uid).add(ws);
    }

    try {
      switch (type) {

        case DOOR_MSG.DOOR_OPEN: {
          const r = await this.manager.open(uid, player, data);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"open", ...r });
          break;
        }
        case DOOR_MSG.DOOR_CLOSE: {
          const r = await this.manager.close(uid, player.id);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"close", ...r });
          break;
        }
        case DOOR_MSG.DOOR_TOGGLE: {
          const r = await this.manager.toggle(uid, player, data);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"toggle", ...r });
          break;
        }
        case DOOR_MSG.DOOR_LOCK: {
          const r = await this.manager.setLock(uid, player, data?.locked !== false);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"lock", ...r });
          break;
        }
        case DOOR_MSG.DOOR_UNLOCK: {
          const r = await this.manager.setLock(uid, player, false);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"unlock", ...r });
          break;
        }
        case DOOR_MSG.DOOR_PICK: {
          const r = this.manager.lockpick(uid, player, data?.skill, data?.tool);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"pick", ...r });
          break;
        }
        case DOOR_MSG.DOOR_BREACH: {
          const r = this.manager.breach(uid, player, data?.tool);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"breach", ...r });
          break;
        }
        case DOOR_MSG.DOOR_KNOCK: {
          const r = this.manager.knock(uid, player.id);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"knock", ...r });
          break;
        }
        case DOOR_MSG.DOOR_BUZZ: {
          const r = this.manager.buzz(uid, player.id, data?.visitor, data?.durationMs);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"buzz", ...r });
          break;
        }
        case DOOR_MSG.DOOR_RESET_ALARM: {
          const door = this.manager.getDoor(uid);
          if (!door) return this._sendError(ws, DOOR_ERROR.NOT_FOUND);
          const r = this.manager.alarmSvc.reset(door, player.id);
          this._reply(ws, DOOR_MSG.DOOR_RESULT, { uid, action:"reset_alarm", ok:r });
          break;
        }
        case DOOR_MSG.DOOR_SYNC: {
          const doors = data?.building_id
            ? this.manager.getBuildingDoors(data.building_id)
            : this.manager.getAllDoors();
          this._reply(ws, DOOR_MSG.DOOR_SYNC, {
            doors: doors.map((d) => d.toPublicJSON()),
          });
          break;
        }
        default:
          this._sendError(ws, "UNKNOWN_TYPE");
      }
    } catch (e) {
      console.error("[DoorService] handler error:", e);
      this._sendError(ws, "INTERNAL_ERROR");
    }
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────
  _reply(ws, type, data) {
    try { ws.send(encodeMessage(type, data)); } catch (e) {}
  }

  _sendError(ws, reason) {
    this._reply(ws, DOOR_MSG.DOOR_RESULT, { ok:false, error:reason });
  }

  _broadcast(eventName, data) {
    // Mapper event → type de message WS
    const msgMap = {
      [DOOR_EVENTS.DOOR_OPENED]:      DOOR_MSG.DOOR_STATE,
      [DOOR_EVENTS.DOOR_CLOSED]:      DOOR_MSG.DOOR_STATE,
      [DOOR_EVENTS.DOOR_LOCKED]:      DOOR_MSG.DOOR_STATE,
      [DOOR_EVENTS.DOOR_UNLOCKED]:    DOOR_MSG.DOOR_STATE,
      [DOOR_EVENTS.DOOR_BROKEN]:      DOOR_MSG.DOOR_BROKEN,
      [DOOR_EVENTS.DOOR_DAMAGED]:     DOOR_MSG.DOOR_DAMAGED,
      [DOOR_EVENTS.ALARM_TRIGGERED]:  DOOR_MSG.DOOR_ALARM,
      [DOOR_EVENTS.ALARM_RESET]:      DOOR_MSG.DOOR_STATE,
      [DOOR_EVENTS.DOOR_KNOCKED]:     DOOR_MSG.DOOR_KNOCK,
      [DOOR_EVENTS.DOOR_BUZZ]:        DOOR_MSG.DOOR_BUZZ,
    };
    const msgType = msgMap[eventName];
    if (!msgType) return;

    const payload = { ...data, event: eventName };
    const door = data.uid ? this.manager.getDoor(data.uid) : null;
    if (door) payload.state = door.toPublicJSON();

    const set = this.subscribers.get(data.uid);
    if (!set) return;
    const raw = encodeMessage(msgType, payload);
    for (const ws of set) {
      try { ws.send(raw); } catch (e) {}
    }
  }
}

export default DoorService;

/**
 * DoorProtocol — Messages WebSocket portes
 * Path: shared/buildings/doors/DoorProtocol.mjs
 * Signature : TROXT⬡
 */

export const DOOR_MSG = Object.freeze({
  // Client → Serveur
  DOOR_OPEN:         "DOOR_OPEN",
  DOOR_CLOSE:        "DOOR_CLOSE",
  DOOR_TOGGLE:       "DOOR_TOGGLE",
  DOOR_LOCK:         "DOOR_LOCK",
  DOOR_UNLOCK:       "DOOR_UNLOCK",
  DOOR_PICK:         "DOOR_PICK",         // lockpick
  DOOR_BREACH:       "DOOR_BREACH",       // force brute
  DOOR_KNOCK:        "DOOR_KNOCK",
  DOOR_BUZZ:         "DOOR_BUZZ",         // interphone
  DOOR_REMOTE_OPEN:  "DOOR_REMOTE_OPEN",  // résident ouvre à distance
  DOOR_RESET_ALARM:  "DOOR_RESET_ALARM",
  DOOR_SYNC:         "DOOR_SYNC",         // demande d'état complet

  // Serveur → Client
  DOOR_STATE:        "DOOR_STATE",        // état changé
  DOOR_RESULT:       "DOOR_RESULT",       // réponse à une action
  DOOR_ALARM:        "DOOR_ALARM",        // alarme déclenchée
  DOOR_FX:           "DOOR_FX",           // effet visuel
  DOOR_BUZZ:         "DOOR_BUZZ",         // (broadcast)
  DOOR_SYNC:         "DOOR_SYNC",         // état complet
  DOOR_DAMAGED:      "DOOR_DAMAGED",
  DOOR_BROKEN:       "DOOR_BROKEN",
  DOOR_LOCKED:       "DOOR_LOCKED",
  DOOR_UNLOCKED:     "DOOR_UNLOCKED",
});

export const DOOR_ERROR = Object.freeze({
  NOT_FOUND:         "DOOR_NOT_FOUND",
  ACCESS_DENIED:     "ACCESS_DENIED",
  LOCKED:            "DOOR_LOCKED",
  BROKEN:            "DOOR_BROKEN",
  TOO_FAR:           "TOO_FAR",
  RATE_LIMITED:      "RATE_LIMITED",
  INVALID_CODE:      "INVALID_CODE",
  CODE_LOCKED:       "CODE_LOCKED_BRUTEFORCE",
  OCCUPIED:          "DOOR_OCCUPIED",
  INVALID_TOOL:      "INVALID_TOOL",
  NO_PERMISSION:     "NO_PERMISSION",
});

/**
 * @typedef {Object} DoorState
 * @property {string} uid
 * @property {string} building_id
 * @property {string} door_id
 * @property {string} type
 * @property {boolean} is_open
 * @property {boolean} is_locked
 * @property {boolean} broken
 * @property {number}  hp
 * @property {number}  max_hp
 * @property {boolean} alarm_active
 * @property {number}  alarm_level
 */

/**
 * @typedef {Object} DoorActionRequest
 * @property {string} uid
 * @property {string} [code]
 * @property {string} [tool]
 * @property {number} [skill]
 * @property {number} [playerX]
 * @property {number} [playerZ]
 */

/**
 * Valide un message entrant.
 * @param {any} msg
 * @returns {{ok:boolean, error?:string}}
 */
export function validateMessage(msg) {
  if (!msg || typeof msg !== "object") return { ok:false, error:"INVALID_MESSAGE" };
  if (!msg.type || typeof msg.type !== "string") return { ok:false, error:"MISSING_TYPE" };
  const isClientMsg = Object.values(DOOR_MSG).includes(msg.type);
  if (!isClientMsg) return { ok:false, error:"UNKNOWN_TYPE" };
  if (msg.data && typeof msg.data !== "object") return { ok:false, error:"INVALID_DATA" };
  return { ok:true };
}

/**
 * Sérialise + signe un message sortant.
 */
export function encodeMessage(type, data) {
  return JSON.stringify({
    type,
    data: data || {},
    ts:   Date.now(),
    sig:  "TROXT⬡",
  });
}

/**
 * Parse + valide un message entrant.
 */
export function decodeMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw.toString()); }
  catch { return { ok:false, error:"PARSE_ERROR" }; }

  const v = validateMessage(msg);
  if (!v.ok) return v;

  return { ok:true, type:msg.type, data:msg.data || {}, ts:msg.ts };
}

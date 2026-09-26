/**
 * DoorEvents — Noms d'événements internes (EventBus)
 * Path: shared/buildings/doors/DoorEvents.mjs
 * Signature : TROXT⬡
 */

export const DOOR_EVENTS = Object.freeze({
  // Cycle de vie
  DOOR_CREATED:       "door:created",
  DOOR_REMOVED:       "door:removed",

  // Actions
  DOOR_OPENED:        "door:opened",
  DOOR_CLOSED:        "door:closed",
  DOOR_LOCKED:        "door:locked",
  DOOR_UNLOCKED:      "door:unlocked",
  DOOR_TOGGLED:       "door:toggled",

  // Sécurité
  DOOR_ACCESS_DENIED: "door:access_denied",
  DOOR_LOCKPICK_OK:   "door:lockpick_ok",
  DOOR_LOCKPICK_FAIL: "door:lockpick_fail",
  DOOR_BREACHED:      "door:breached",
  DOOR_DAMAGED:       "door:damaged",
  DOOR_BROKEN:        "door:broken",
  DOOR_REPAIRED:      "door:repaired",

  // Alarmes
  ALARM_TRIGGERED:    "alarm:triggered",
  ALARM_RESET:        "alarm:reset",
  ALARM_EXPIRED:      "alarm:expired",

  // Social
  DOOR_KNOCKED:       "door:knocked",
  DOOR_BUZZ:          "door:buzz",
  DOOR_REMOTE_OPEN:   "door:remote_open",

  // Codes
  DOOR_CODE_SET:      "door:code_set",
  DOOR_CODE_CHANGED:  "door:code_changed",
  DOOR_CODE_FAIL:     "door:code_fail",
  DOOR_CODE_BLOCKED:  "door:code_blocked",

  // Visiteurs
  VISITOR_ALLOWED:    "visitor:allowed",
  VISITOR_REVOKED:    "visitor:revoked",
  VISITOR_EXPIRED:    "visitor:expired",

  // Live Sync
  STATE_CHANGED:      "state:changed",
});

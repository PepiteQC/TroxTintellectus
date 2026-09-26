/**
 * DoorTypes — Constantes partagées client ↔ serveur
 * Path: shared/buildings/doors/DoorTypes.mjs
 * Signature : TROXT⬡
 */

export const SIG = "TROXT⬡";

// ─── ANIMATIONS ────────────────────────────────────────────────────────────
export const DOOR_ANIM = Object.freeze({
  HINGED:    "hinged",
  DOUBLE:    "double",
  SLIDING:   "sliding",
  GARAGE:    "garage",
  SHUTTER:   "shutter",
  REVOLVING: "revolving",
  GATE:      "gate",
  VAULT:     "vault",
});

// ─── TYPES DE PORTES ───────────────────────────────────────────────────────
export const DOOR_TYPES = Object.freeze({
  wood:         { anim:"hinged",    hp:100,  lockpick_diff:1,  breach:"kick",     open_ms:600  },
  metal:        { anim:"hinged",    hp:300,  lockpick_diff:3,  breach:"ram",      open_ms:800  },
  glass:        { anim:"hinged",    hp:60,   lockpick_diff:2,  breach:"shatter",  open_ms:500  },
  double_glass: { anim:"double",    hp:80,   lockpick_diff:2,  breach:"shatter",  open_ms:600  },
  auto_sliding: { anim:"sliding",   hp:120,  lockpick_diff:4,  breach:"hack",     open_ms:400  },
  garage:       { anim:"garage",    hp:400,  lockpick_diff:4,  breach:"ram",      open_ms:3000 },
  shutter:      { anim:"shutter",   hp:500,  lockpick_diff:5,  breach:"torch",    open_ms:2500 },
  revolving:    { anim:"revolving", hp:200,  lockpick_diff:0,  breach:"none",     open_ms:0, never_locks:true },
  gate:         { anim:"gate",      hp:350,  lockpick_diff:3,  breach:"ram",      open_ms:2500 },
  vault:        { anim:"vault",     hp:2000, lockpick_diff:10, breach:"thermite", open_ms:6000 },
  cell:         { anim:"sliding",   hp:800,  lockpick_diff:8,  breach:"none",     open_ms:900  },
  elevator:     { anim:"sliding",   hp:300,  lockpick_diff:0,  breach:"none",     open_ms:700  },
});

// ─── MODES DE VERROUILLAGE ─────────────────────────────────────────────────
export const LOCK_MODES = Object.freeze({
  NONE:      "none",
  KEY:       "key",
  CODE:      "code",
  BADGE:     "badge",
  BIOMETRIC: "biometric",
  OWNER:     "owner",
  JOB:       "job",
  FACTION:   "faction",
  HOURS:     "hours",
});

// ─── BREACH TOOLS ──────────────────────────────────────────────────────────
export const BREACH_TOOLS = Object.freeze({
  kick:     { dmg:25,   works:["kick","shatter"] },
  crowbar:  { dmg:45,   works:["kick","shatter","ram"] },
  ram:      { dmg:120,  works:["kick","shatter","ram"] },
  torch:    { dmg:60,   works:["torch","ram","kick"] },
  hack:     { dmg:999,  works:["hack"] },
  thermite: { dmg:800,  works:["thermite","torch","ram"] },
  c4:       { dmg:2000, works:["kick","shatter","ram","torch","thermite"] },
});

// ─── SÉVÉRITÉS ─────────────────────────────────────────────────────────────
export const ALARM_LEVELS = Object.freeze({
  LOW:      2,
  MEDIUM:   3,
  HIGH:     4,
  CRITICAL: 5,
});

// ─── HELPERS ───────────────────────────────────────────────────────────────
export function getDoorType(type) {
  return DOOR_TYPES[type] || DOOR_TYPES.wood;
}

export function isBreachValid(type, tool) {
  const def = getDoorType(type);
  if (def.breach === "none") return false;
  const t = BREACH_TOOLS[tool];
  if (!t) return false;
  return t.works.includes(def.breach);
}

export function isInHours(hours, h) {
  if (!hours) return true;
  const [o, c] = hours;
  if (o === 0 && c === 24) return true;
  if (o < c) return h >= o && h < c;
  return h >= o || h < c;  // passe minuit
}

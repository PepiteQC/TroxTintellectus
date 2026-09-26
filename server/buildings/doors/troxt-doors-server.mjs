/**
 * TROXT⬡ — TROXT-DOORS-SERVER.MJS
 * Couche réseau autoritaire des portes TroxtWorld
 * Plugin : s'attache à un WebSocketServer existant SANS modifier troxt-rp-server.mjs
 *
 * Signature : TROXT⬡
 *
 * Usage (dans un fichier de démarrage séparé, ex: server/start-troxt.mjs) :
 *   import { attachDoors } from './troxt-doors-server.mjs';
 *   attachDoors({ wss, app, getPlayer: (ws) => ..., broadcast: (msg) => ... });
 *
 * Ou autonome :  node server/troxt-doors-server.mjs   (port 4150)
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIG       = 'TROXT⬡';
const DATA_DIR  = path.join(__dirname, '..', 'data');
const SAVE_FILE = path.join(DATA_DIR, 'doors.json');

const log = (lvl, msg) => {
  const i = { OK:'✓', WARN:'⚠', DOOR:'🚪', ALARM:'🚨', ERR:'✖' }[lvl] || '·';
  console.log(`[${new Date().toISOString().slice(11,19)}] ${i} [${SIG}] ${msg}`);
};

// ─── TYPES (miroir de troxt_doors.lua) ───────────────────────────────────────
export const DOOR_TYPES = {
  wood:         { anim:'hinged',    open_ms:600,  hp:100,  pick:1,  breach:'kick' },
  metal:        { anim:'hinged',    open_ms:800,  hp:300,  pick:3,  breach:'ram' },
  glass:        { anim:'hinged',    open_ms:500,  hp:60,   pick:2,  breach:'shatter' },
  double_glass: { anim:'double',    open_ms:600,  hp:80,   pick:2,  breach:'shatter' },
  auto_sliding: { anim:'sliding',   open_ms:400,  hp:120,  pick:4,  breach:'hack', sensor:true },
  garage:       { anim:'garage',    open_ms:3000, hp:400,  pick:4,  breach:'ram' },
  shutter:      { anim:'shutter',   open_ms:2500, hp:500,  pick:5,  breach:'torch' },
  revolving:    { anim:'revolving', open_ms:0,    hp:200,  pick:0,  breach:'none', never_locks:true },
  gate:         { anim:'gate',      open_ms:2500, hp:350,  pick:3,  breach:'ram' },
  vault:        { anim:'vault',     open_ms:6000, hp:2000, pick:10, breach:'thermite' },
  cell:         { anim:'sliding',   open_ms:900,  hp:800,  pick:8,  breach:'none' },
  elevator:     { anim:'sliding',   open_ms:700,  hp:300,  pick:0,  breach:'none' },
};

const BREACH_TOOLS = {
  kick:{dmg:25, w:['kick','shatter']}, crowbar:{dmg:45, w:['kick','shatter','ram']},
  ram:{dmg:120, w:['kick','shatter','ram']}, torch:{dmg:60, w:['torch','ram','kick']},
  hack:{dmg:999, w:['hack']}, thermite:{dmg:800, w:['thermite','torch','ram']},
  c4:{dmg:2000, w:['kick','shatter','ram','torch','thermite']},
};

// ─── BÂTIMENTS (miroir compact) ──────────────────────────────────────────────
const B = (name, zone, hours, extra, doors) => ({ name, zone, hours, ...extra, doors });
export const BUILDINGS = {
  commissariat: B('Commissariat','centre_ville',[0,24],{faction:'police'},[
    ['entree','double_glass','hours',{public:true}], ['accueil','metal','faction',{min_rank:1}],
    ['armurerie','vault','faction',{min_rank:3,alarm:true}], ['cellule_1','cell','faction',{min_rank:1}],
    ['cellule_2','cell','faction',{min_rank:1}], ['cellule_3','cell','faction',{min_rank:1}],
    ['bureau_chef','wood','faction',{min_rank:5}], ['garage','garage','faction',{min_rank:1}] ]),
  hopital: B('Hôpital','centre_ville',[0,24],{faction:'hopital'},[
    ['urgences','auto_sliding','none',{public:true}], ['entree','revolving','none',{public:true}],
    ['bloc_op','auto_sliding','faction',{min_rank:3}], ['pharmacie','metal','faction',{min_rank:2,alarm:true}],
    ['morgue','metal','faction',{min_rank:2}], ['ambulances','garage','faction',{min_rank:1}] ]),
  mairie: B('Mairie','centre_ville',[8,18],{},[
    ['entree','double_glass','hours',{public:true}], ['bureau_maire','wood','key',{alarm:true}],
    ['archives','metal','code',{code_len:6}] ]),
  banque_centrale: B('Banque Centrale','centre_ville',[9,17],{job:'banquier',robbable:true},[
    ['entree','double_glass','hours',{public:true,alarm:true}], ['guichets','glass','job',{}],
    ['bureau_dir','wood','job',{}], ['salle_forte','metal','badge',{alarm:true,alarm_level:4}],
    ['coffre','vault','code',{code_len:8,alarm:true,alarm_level:5,timelock:[9,17]}] ]),
  epicerie_24_7: B('Épicerie 24/7','banlieue',[0,24],{robbable:true,buyable:true,price:150000},[
    ['entree','glass','hours',{public:true}], ['reserve','wood','owner',{staff:true}],
    ['coffre','metal','code',{code_len:4,alarm:true,alarm_level:3}] ]),
  magasin_vetements: B('Boutique de vêtements','centre_ville',[10,21],{buyable:true,price:280000},[
    ['entree','double_glass','hours',{public:true}], ['cabine_1','wood','none',{public:true,occupancy:1}],
    ['cabine_2','wood','none',{public:true,occupancy:1}], ['cabine_3','wood','none',{public:true,occupancy:1}],
    ['reserve','metal','owner',{staff:true}], ['rideau','shutter','owner',{staff:true}] ]),
  armurerie: B('Ammu-Troxt','zone_industrielle',[9,20],{min_level:10,robbable:true,buyable:true,price:450000},[
    ['entree','metal','hours',{public:true}], ['stand_tir','metal','hours',{public:true}],
    ['reserve','vault','owner',{staff:true,alarm:true,alarm_level:4}], ['rideau','shutter','owner',{staff:true}] ]),
  concessionnaire: B('Troxt Motors','centre_ville',[9,19],{job:'dealer_auto'},[
    ['entree','auto_sliding','hours',{public:true}], ['showroom','garage','job',{}], ['bureau','glass','job',{}] ]),
  garage_mecano: B('TroxtGarage','zone_industrielle',[7,22],{faction:'mecano_faction',job:'mecano'},[
    ['entree','metal','hours',{public:true}], ['atelier_1','garage','job',{}],
    ['atelier_2','garage','job',{}], ['bureau','wood','faction',{min_rank:3}] ]),
  restaurant: B('Le Troxt Bistro','centre_ville',[11,23],{job:'cuisinier',buyable:true,price:320000},[
    ['entree','double_glass','hours',{public:true}], ['cuisine','metal','job',{}],
    ['chambre_froide','metal','job',{}], ['toilettes','wood','none',{public:true,occupancy:1,inside_lock:true}] ]),
  boite_de_nuit: B('Club Hexagone','port',[22,5],{min_level:5,buyable:true,price:600000},[
    ['entree','metal','hours',{public:true,entry_fee:50}], ['vip','metal','badge',{}],
    ['bureau','wood','owner',{staff:true}], ['arriere','metal','key',{}] ]),
  entrepot_port: B('Entrepôt 7','port',[0,24],{faction:'mafia'},[
    ['portail','gate','faction',{min_rank:1}], ['quai','shutter','faction',{min_rank:1}],
    ['labo','metal','code',{code_len:6,min_rank:3}] ]),
  planque_ghetto: B('Planque Street Troxt','ghetto',[0,24],{faction:'gang_rue'},[
    ['entree','metal','faction',{min_rank:1}], ['arriere','wood','faction',{min_rank:2}],
    ['stock','metal','code',{code_len:4,min_rank:3}] ]),
  immeuble_appartements: B('Résidence Troxt','banlieue',[0,24],{apartments:{floors:6,per_floor:4}},[
    ['hall','double_glass','badge',{residents:true,buzzer:true}], ['ascenseur','elevator','none',{public:true}],
    ['garage_sous_sol','garage','badge',{residents:true}], ['toit','metal','key',{}] ]),
};

// ─── ÉTAT ─────────────────────────────────────────────────────────────────────
const doors     = new Map();   // uid → state
const codes     = new Map();   // uid → code (jamais exposé)
let   keys      = {};          // player_id → { uid:true }
let   badges    = {};          // player_id → { building:true }
let   owners    = {};          // building → player_id
let   staff     = {};          // building → { player_id:true }
let   residents = {};          // building → { player_id:true }
const codeFails = new Map();
const raids     = new Map();   // zone → expires ms
let   worldHour = 12;
const stats = { opens:0, denied:0, picks_ok:0, picks_fail:0, breaches:0, alarms:0 };

const genCode = (n) => Array.from({ length:n }, () => Math.floor(Math.random()*10)).join('');
const inHours = (h, hour) => {
  if (!h) return true; const [o,c] = h;
  if (o === 0 && c === 24) return true;
  return o < c ? (hour >= o && hour < c) : (hour >= o || hour < c);
};

function registerDoor(bid, b, [id, type, lock, o]) {
  const uid = `${bid}:${id}`;
  const t   = DOOR_TYPES[type] || DOOR_TYPES.wood;
  doors.set(uid, {
    uid, building_id:bid, door_id:id, type, anim:t.anim, open_ms:t.open_ms,
    lock, faction:o.faction || b.faction, job:o.job || b.job,
    min_rank:o.min_rank || 0, min_level:o.min_level || b.min_level || 0,
    public:!!o.public, staff:!!o.staff, residents:!!o.residents,
    alarm:!!o.alarm, alarm_level:o.alarm_level || 2, entry_fee:o.entry_fee,
    occupancy:o.occupancy, occupants:new Set(), inside_lock:!!o.inside_lock,
    timelock:o.timelock, hours:b.hours,
    is_open:false, is_locked: lock !== 'none' && !t.never_locks,
    hp:t.hp, max_hp:t.hp, broken:false, alarm_active:false,
    opened_at:0, auto_close_ms: t.sensor ? 3000 : 8000,
  });
  if (lock === 'code') codes.set(uid, genCode(o.code_len || 4));
}

for (const [bid, b] of Object.entries(BUILDINGS)) {
  for (const d of b.doors) registerDoor(bid, b, d);
  if (b.apartments) {
    for (let f = 1; f <= b.apartments.floors; f++)
      for (let n = 1; n <= b.apartments.per_floor; n++)
        registerDoor(bid, b, [`apt_${f}${String(n).padStart(2,'0')}`, 'wood', 'owner', {}]);
  }
  staff[bid] ??= {}; residents[bid] ??= {};
}

// ─── PERSISTANCE ─────────────────────────────────────────────────────────────
async function load() {
  if (!existsSync(SAVE_FILE)) return;
  try {
    const s = JSON.parse(await readFile(SAVE_FILE, 'utf-8'));
    keys = s.keys || {}; badges = s.badges || {}; owners = s.owners || {};
    staff = { ...staff, ...(s.staff || {}) }; residents = { ...residents, ...(s.residents || {}) };
    for (const [uid, c] of Object.entries(s.codes || {})) codes.set(uid, c);
    for (const [uid, st] of Object.entries(s.doors || {})) {
      const d = doors.get(uid); if (!d) continue;
      Object.assign(d, { is_locked:st.is_locked, broken:st.broken, hp:st.hp });
    }
    log('OK', 'État des portes restauré');
  } catch (e) { log('ERR', `Chargement: ${e.message}`); }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await mkdir(DATA_DIR, { recursive:true });
    const doorState = {};
    for (const [uid, d] of doors) doorState[uid] = { is_locked:d.is_locked, broken:d.broken, hp:d.hp };
    await writeFile(SAVE_FILE, JSON.stringify({
      sig:SIG, keys, badges, owners, staff, residents,
      codes:Object.fromEntries(codes), doors:doorState,
    }, null, 2));
  }, 1000);
}

// ─── LOGIQUE ─────────────────────────────────────────────────────────────────
export function canAccess(uid, p, code) {
  const d = doors.get(uid);
  if (!d) return [false, 'Porte inconnue'];
  if (d.broken) return [true, 'Défoncée'];
  if (p.is_admin) return [true, 'Admin'];
  if (!d.is_locked) return [true, 'Déverrouillée'];
  const b = BUILDINGS[d.building_id];
  if (p.faction === 'police' && (raids.get(b.zone) || 0) > Date.now()) return [true, 'Raid police'];
  if (d.min_level && (p.level || 1) < d.min_level) return [false, `Niveau ${d.min_level} requis`];
  if (d.timelock && !inHours(d.timelock, worldHour)) return [false, 'Verrou temporisé'];
  if (owners[d.building_id] === p.id) return [true, 'Propriétaire'];
  if ((d.staff || d.lock === 'owner') && staff[d.building_id]?.[p.id]) return [true, 'Employé'];

  switch (d.lock) {
    case 'none':    return [true, 'Libre'];
    case 'hours':   return inHours(d.hours, worldHour) ? [true,'Ouvert'] : [false, `Fermé — ouvre à ${d.hours[0]}h`];
    case 'key':     return keys[p.id]?.[uid] ? [true,'Clé'] : [false,'Clé requise'];
    case 'badge':
      if (d.residents && residents[d.building_id]?.[p.id]) return [true,'Badge résident'];
      return badges[p.id]?.[d.building_id] ? [true,'Badge'] : [false,'Badge requis'];
    case 'code':
      if (code && code === codes.get(uid)) return [true,'Code'];
      if (d.faction && p.faction === d.faction && (p.faction_rank||0) >= d.min_rank) return [true,'Code faction'];
      return [false,'Code requis'];
    case 'owner':   return [false,'Propriétaire uniquement'];
    case 'job':     return p.job === d.job ? [true,'Employé'] : [false,'Réservé aux employés'];
    case 'faction':
      return (p.faction === d.faction && (p.faction_rank||0) >= d.min_rank)
        ? [true,'Faction'] : [false, d.min_rank > 1 ? `Rang ${d.min_rank} requis` : 'Membres uniquement'];
  }
  return [false,'Accès refusé'];
}

const pub = (d) => ({
  uid:d.uid, building_id:d.building_id, door_id:d.door_id, type:d.type, anim:d.anim,
  open_ms:d.open_ms, is_open:d.is_open, is_locked:d.is_locked, broken:d.broken,
  hp:d.hp, max_hp:d.max_hp, alarm_active:d.alarm_active, lock:d.lock,
  public:d.public, entry_fee:d.entry_fee, sig:SIG,
});

// ─── ATTACH ──────────────────────────────────────────────────────────────────
/**
 * @param {object} o
 * @param {import('ws').WebSocketServer} o.wss
 * @param {import('express').Express} [o.app]
 * @param {(ws)=>object|null} o.getPlayer   retourne { id, level, job, faction, faction_rank, cash, is_admin, rp }
 * @param {(json:string)=>void} o.broadcast
 * @param {(event:string, data:object)=>void} [o.emit]  pont vers TROXT⬡ (Lua) / Intellectus
 */
export async function attachDoors({ wss, app, getPlayer, broadcast, emit = () => {} }) {
  await load();

  const out = (type, data) => JSON.stringify({ type, data, ts:Date.now(), sig:SIG });
  const reply = (ws, type, data) => ws.readyState === 1 && ws.send(out(type, data));
  const pushState = (d) => broadcast(out('DOOR_STATE', pub(d)));

  function alarm(d, suspect, cause) {
    if (d.alarm_active) return;
    d.alarm_active = true; stats.alarms++;
    const b = BUILDINGS[d.building_id];
    log('ALARM', `${b.name} — ${d.door_id} (${cause})`);
    broadcast(out('DOOR_ALARM', { uid:d.uid, building:b.name, zone:b.zone, level:d.alarm_level, cause }));
    emit('troxtworld:alarm', { uid:d.uid, building_id:d.building_id, zone:b.zone, level:d.alarm_level, suspect, cause, sig:SIG });
    emit('troxtworld:police_alert', { player_id:suspect, wanted:Math.min(5, d.alarm_level), crime:`Effraction — ${b.name}`, sig:SIG });
    pushState(d);
  }

  function doOpen(ws, p, uid, code) {
    const d = doors.get(uid);
    if (!d) return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:'Porte inconnue' });
    if (d.is_open) return reply(ws, 'DOOR_RESULT', { uid, ok:true, msg:'Déjà ouverte' });
    if (d.occupancy && d.occupants.size >= d.occupancy && !d.occupants.has(p.id))
      return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:'Occupé' });

    const fk = p.id + uid, f = codeFails.get(fk);
    if (f?.until > Date.now())
      return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:`Clavier bloqué ${Math.ceil((f.until-Date.now())/1000)}s` });

    const [ok, why] = canAccess(uid, p, code);
    if (!ok) {
      stats.denied++;
      if (d.lock === 'code' && code) {
        const nf = { count:(f?.count||0)+1 };
        if (nf.count >= 3) { nf.until = Date.now() + 60000*nf.count; if (d.alarm) alarm(d, p.id, 'code_bruteforce'); }
        codeFails.set(fk, nf);
      }
      return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:why, needs_code: d.lock === 'code' });
    }
    codeFails.delete(fk);

    if (d.entry_fee && owners[d.building_id] !== p.id) {
      if ((p.cash ?? p.rp?.cash ?? 0) < d.entry_fee)
        return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:`Entrée: ${d.entry_fee}T$` });
      if (p.rp) p.rp.cash -= d.entry_fee;
      emit('troxtworld:door_entry_fee', { uid, player_id:p.id, amount:d.entry_fee, owner:owners[d.building_id], sig:SIG });
    }

    d.is_open = true; d.opened_at = Date.now(); stats.opens++;
    if (d.occupancy) d.occupants.add(p.id);
    pushState(d);
    reply(ws, 'DOOR_RESULT', { uid, ok:true, msg:why });
  }

  function doClose(ws, p, uid) {
    const d = doors.get(uid);
    if (!d || !d.is_open || d.broken) return;
    d.is_open = false; pushState(d);
  }

  function doLock(ws, p, uid, locked) {
    const d = doors.get(uid);
    if (!d) return;
    if (DOOR_TYPES[d.type].never_locks || d.broken)
      return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:'Impossible à verrouiller' });
    const allowed = p.is_admin
      || (d.inside_lock && d.occupants.has(p.id))
      || owners[d.building_id] === p.id
      || staff[d.building_id]?.[p.id]
      || keys[p.id]?.[uid]
      || (d.lock === 'faction' && p.faction === d.faction && (p.faction_rank||0) >= Math.max(d.min_rank, 2))
      || (d.lock === 'job' && p.job === d.job);
    if (!allowed) return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:"Tu n'as pas la clé" });
    d.is_locked = locked;
    if (locked) d.is_open = false;
    pushState(d); save();
    reply(ws, 'DOOR_RESULT', { uid, ok:true, msg: locked ? '🔒 Verrouillée' : '🔓 Déverrouillée' });
  }

  function doPick(ws, p, uid, skill = 0, tool = 'lockpick') {
    const d = doors.get(uid);
    if (!d || !d.is_locked) return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:'Rien à crocheter' });
    const diff = DOOR_TYPES[d.type].pick;
    if (diff >= 10) return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:'Impossible à crocheter' });
    const chance = Math.max(0.05, Math.min(0.95, 0.5 + (skill + (tool === 'advanced_lockpick' ? 2 : 0) - diff) * 0.1));
    emit('troxtworld:crime_hint', { player_id:p.id, crime:'theft', context:'lockpick', sig:SIG });
    if (Math.random() <= chance) {
      d.is_locked = false; stats.picks_ok++;
      if (d.alarm && Math.random() < 0.35) alarm(d, p.id, 'lockpick_silent');
      pushState(d);
      return reply(ws, 'DOOR_RESULT', { uid, ok:true, msg:`Crochetée (${Math.round(chance*100)}%)` });
    }
    stats.picks_fail++;
    const broke = Math.random() < 0.4;
    if (d.alarm) alarm(d, p.id, 'lockpick_fail');
    reply(ws, 'DOOR_RESULT', { uid, ok:false, msg: broke ? 'Crochet cassé!' : 'Échec — réessaie', tool_broke:broke });
  }

  function doBreach(ws, p, uid, tool = 'kick') {
    const d = doors.get(uid), t = BREACH_TOOLS[tool];
    if (!d || !t) return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:'Invalide' });
    if (d.broken) return reply(ws, 'DOOR_RESULT', { uid, ok:true, msg:'Déjà défoncée' });
    const need = DOOR_TYPES[d.type].breach;
    if (need === 'none') return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:'Ne peut pas être forcée' });
    if (!t.w.includes(need)) return reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:`Inefficace — il faut: ${need}` });
    d.hp = Math.max(0, d.hp - t.dmg); stats.breaches++;
    broadcast(out('DOOR_FX', { uid, fx:'impact', tool }));
    if (d.alarm) alarm(d, p.id, 'breach');
    const legal = p.faction === 'police' && (raids.get(BUILDINGS[d.building_id].zone) || 0) > Date.now();
    if (!legal) emit('troxtworld:crime_hint', { player_id:p.id, crime:'theft', context:'breach', sig:SIG });
    if (d.hp <= 0) {
      Object.assign(d, { broken:true, is_locked:false, is_open:true });
      broadcast(out('DOOR_FX', { uid, fx:'broken', tool }));
      pushState(d); save();
      log('DOOR', `Défoncée — ${uid} par ${p.id} (${tool})`);
      return reply(ws, 'DOOR_RESULT', { uid, ok:true, msg:'Porte défoncée!' });
    }
    pushState(d);
    reply(ws, 'DOOR_RESULT', { uid, ok:false, msg:`Endommagée ${d.hp}/${d.max_hp}` });
  }

  // ── Handler WS : écoute les messages DOOR_* sans interférer avec les autres ──
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg.type?.startsWith('DOOR_')) return;
      const p = getPlayer(ws);
      if (!p) return reply(ws, 'DOOR_RESULT', { ok:false, msg:'Non authentifié' });
      const d = msg.data || {};
      switch (msg.type) {
        case 'DOOR_SYNC':    return reply(ws, 'DOOR_SYNC', { doors:[...doors.values()].map(pub), hour:worldHour });
        case 'DOOR_OPEN':    return doOpen(ws, p, d.uid, d.code);
        case 'DOOR_CLOSE':   return doClose(ws, p, d.uid);
        case 'DOOR_TOGGLE':  return doors.get(d.uid)?.is_open ? doClose(ws, p, d.uid) : doOpen(ws, p, d.uid, d.code);
        case 'DOOR_LOCK':    return doLock(ws, p, d.uid, d.locked !== false);
        case 'DOOR_PICK':    return doPick(ws, p, d.uid, d.skill, d.tool);
        case 'DOOR_BREACH':  return doBreach(ws, p, d.uid, d.tool);
        case 'DOOR_KNOCK':   return broadcast(out('DOOR_FX', { uid:d.uid, fx:'knock', by:p.id }));
        case 'DOOR_BUZZ':    return broadcast(out('DOOR_BUZZ', { uid:d.uid, visitor:p.id, apt:d.apt }));
        case 'DOOR_REMOTE_OPEN': {
          const door = doors.get(d.uid);
          if (!door || !residents[door.building_id]?.[p.id]) return reply(ws, 'DOOR_RESULT', { ok:false, msg:'Résidents uniquement' });
          door.is_open = true; door.opened_at = Date.now(); return pushState(door);
        }
        case 'DOOR_LEAVE_ROOM': {
          const door = doors.get(d.uid); if (!door) return;
          door.occupants.delete(p.id); if (door.inside_lock) door.is_locked = false;
          return pushState(door);
        }
        case 'DOOR_RESET_ALARM': {
          const door = doors.get(d.uid); if (!door) return;
          const b = BUILDINGS[door.building_id];
          if (!(p.is_admin || p.faction === 'police' || owners[door.building_id] === p.id || (b.job && p.job === b.job)))
            return reply(ws, 'DOOR_RESULT', { ok:false, msg:'Accès refusé' });
          door.alarm_active = false; return pushState(door);
        }
      }
    });
  });

  // ── Tick : auto-fermeture + raids ──
  setInterval(() => {
    const now = Date.now();
    for (const d of doors.values()) {
      if (d.is_open && !d.broken && d.opened_at && now - d.opened_at >= d.auto_close_ms) {
        d.is_open = false; pushState(d);
      }
    }
    for (const [z, t] of raids) if (t <= now) raids.delete(z);
  }, 500);

  // ── API REST ──
  if (app) {
    app.get('/api/doors', (req, res) => {
      const list = [...doors.values()].filter(d => !req.query.building || d.building_id === req.query.building).map(pub);
      res.json({ ok:true, count:list.length, doors:list, sig:SIG });
    });
    app.get('/api/buildings', (req, res) => {
      res.json({ ok:true, sig:SIG, buildings:Object.entries(BUILDINGS).map(([id, b]) => ({
        id, name:b.name, zone:b.zone, hours:b.hours, open_now:inHours(b.hours, worldHour),
        owner:owners[id] || null, buyable:!!b.buyable && !owners[id], price:b.price, robbable:!!b.robbable,
      })) });
    });
    app.get('/api/doors/stats', (req, res) => res.json({ ok:true, stats, doors:doors.size, sig:SIG }));
  }

  // ── API programme (admin, économie, Lua bridge) ──
  const api = {
    setWorldHour(h) { worldHour = ((h % 24) + 24) % 24; },
    startRaid(zone, sec = 900) { raids.set(zone, Date.now() + sec*1000); broadcast(out('DOOR_RAID', { zone, sec })); },
    giveKey(pid, uid)    { (keys[pid] ??= {})[uid] = true; save(); },
    revokeKey(pid, uid)  { if (keys[pid]) delete keys[pid][uid]; save(); },
    giveBadge(pid, bid)  { (badges[pid] ??= {})[bid] = true; save(); },
    revokeBadge(pid, bid){ if (badges[pid]) delete badges[pid][bid]; save(); },
    setOwner(bid, pid) {
      owners[bid] = pid; staff[bid] = {};
      for (const d of doors.values()) if (d.building_id === bid && d.lock === 'code') codes.set(d.uid, genCode(codes.get(d.uid)?.length || 4));
      save();
    },
    hire(bid, pid)  { (staff[bid] ??= {})[pid] = true; save(); },
    fire(bid, pid)  { if (staff[bid]) delete staff[bid][pid]; save(); },
    addResident(bid, pid, apt) { (residents[bid] ??= {})[pid] = true; if (apt) api.giveKey(pid, `${bid}:${apt}`); },
    removeResident(bid, pid, apt) { if (residents[bid]) delete residents[bid][pid]; if (apt) api.revokeKey(pid, `${bid}:${apt}`); },
    revealCode(uid) { return codes.get(uid); },
    changeCode(uid, code) { codes.set(uid, code || genCode(codes.get(uid)?.length || 4)); save(); return codes.get(uid); },
    repair(uid) {
      const d = doors.get(uid); if (!d) return false;
      Object.assign(d, { hp:d.max_hp, broken:false, is_open:false, is_locked:d.lock !== 'none' });
      pushState(d); save(); return true;
    },
    lockBuilding(bid, locked) {
      for (const d of doors.values()) if (d.building_id === bid && !DOOR_TYPES[d.type].never_locks) {
        d.is_locked = locked; if (locked) d.is_open = false; pushState(d);
      }
      save();
    },
    getDoor: (uid) => doors.get(uid) && pub(doors.get(uid)),
    stats: () => ({ ...stats }),
  };

  log('OK', `Portes attachées — ${doors.size} portes · ${Object.keys(BUILDINGS).length} bâtiments`);
  return api;
}

// ─── MODE AUTONOME ───────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { default: express } = await import('express');
  const { createServer }     = await import('http');
  const { WebSocketServer }  = await import('ws');
  const app = express(); app.use(express.json());
  app.use((q, r, n) => { r.header('Access-Control-Allow-Origin', '*'); r.header('X-TROXT-Signature', SIG); n(); });
  const server = createServer(app);
  const wss    = new WebSocketServer({ server, path:'/doors' });
  const who    = new Map();
  wss.on('connection', (ws) => ws.on('message', (raw) => {
    try { const m = JSON.parse(raw); if (m.type === 'AUTH') who.set(ws, { id:m.data.player_id, ...m.data }); } catch {}
  }));
  await attachDoors({
    wss, app,
    getPlayer: (ws) => who.get(ws) || null,
    broadcast: (json) => wss.clients.forEach(c => c.readyState === 1 && c.send(json)),
  });
  server.listen(4150, () => log('OK', 'Portes autonome → ws://localhost:4150/doors · http://localhost:4150/api/doors'));
}

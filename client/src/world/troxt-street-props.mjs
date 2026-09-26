/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/TROXT-STREET-PROPS.MJS
 * Mobilier urbain de Portneuf — intégré TROXT⬡ + kernel
 * ═══════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • Matériaux LED/braises clonés (chaque instance indépendante)
 *   • action mappée sur chaque spot (interactStreetProp fonctionnel)
 *   • dt paramétrable (framerate-indépendant)
 *   • Aléatoire déterministe (replay/save/load safe)
 *   • Flags par instance (pas partagés)
 *   • dispose() pour hot-reload propre
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/world/troxt-street-props.mjs
 */

import * as THREE from 'three';
const SIG = 'TROXT⬡';

// ─── CACHE GÉOMÉTRIES & MATÉRIAUX ────────────────────────────────────────────
const _geo = new Map();
const _mat = new Map();
const geo = (key, fn) => { if (!_geo.has(key)) _geo.set(key, fn()); return _geo.get(key); };
const mat = (color, rough = 0.8, metal = 0.0) => {
  const k = `${color}_${rough}_${metal}`;
  if (!_mat.has(k)) _mat.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return _mat.get(k);
};
// ⚠️ matE reste partagé — on clonera au moment de muter (leds, braises)
const matE = (color, emissive, intensity = 1) => {
  const k = `e_${color}_${emissive}_${intensity}`;
  if (!_mat.has(k)) _mat.set(k, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.4 }));
  return _mat.get(k);
};
const mesh = (g, m, x = 0, y = 0, z = 0, shadow = true) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  if (shadow) { o.castShadow = true; o.receiveShadow = true; }
  return o;
};
const box = (w, h, d) => geo(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, s = 8) => geo(`c${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const sph = (r, s = 8) => geo(`s${r}_${s}`, () => new THREE.SphereGeometry(r, s, s));

// hash déterministe (remplace Math.random pour replay/save safe)
const hash = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// ─── COULEURS PARTAGÉES ───────────────────────────────────────────────────────
const C = {
  acier: 0x6a7078, vert_sq: 0x1a4a32, rouge: 0xcc2222, jaune: 0xffcc00,
  bois: 0x7a5c3a, beton: 0x8a8a8a, blanc: 0xf0f0f0, noir: 0x1a1a1a,
  orange: 0xff6600, bleu: 0x2244aa, vert: 0x228833,
};

// ─── CONSTRUCTEURS DE PROPS ───────────────────────────────────────────────────

function buildBusStop() {
  const g = new THREE.Group();
  g.add(mesh(box(3.2, 0.08, 1.2), mat(C.acier, 0.5, 0.5), 0, 2.4, 0));
  g.add(mesh(box(0.06, 2.4, 1.2), mat(C.acier, 0.4, 0.5), -1.55, 1.2, 0));
  g.add(mesh(box(0.06, 2.4, 1.2), mat(C.acier, 0.4, 0.5), 1.55, 1.2, 0));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.3, roughness: 0.05 }));
  glass.position.set(0, 1.2, -0.55); g.add(glass);
  g.add(mesh(box(2.4, 0.08, 0.4), mat(C.bois, 0.8), 0, 0.45, 0));
  for (const x of [-0.95, 0.95]) g.add(mesh(box(0.06, 0.45, 0.4), mat(C.acier, 0.5, 0.5), x, 0.22, 0));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), matE(C.bleu, C.bleu, 0.3));
  sign.position.set(0, 2.1, -0.52); sign.name = 'bus_sign'; g.add(sign);
  g.userData = { type: 'bus', interactive: true, action: 'take_bus' };
  return g;
}

function buildHydrant() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.12, 0.14, 0.62, 8), mat(C.rouge, 0.5, 0.1), 0, 0.31, 0));
  g.add(mesh(cyl(0.16, 0.16, 0.06, 8), mat(C.rouge, 0.5, 0.1), 0, 0.65, 0));
  g.add(mesh(cyl(0.18, 0.18, 0.06, 12), mat(C.rouge, 0.4, 0.2), 0, 0.72, 0));
  for (const a of [0, Math.PI]) {
    const cap = new THREE.Mesh(cyl(0.04, 0.04, 0.1, 6), mat(C.acier, 0.4, 0.6));
    cap.rotation.z = Math.PI / 2; cap.position.set(Math.cos(a) * 0.2, 0.38, Math.sin(a) * 0.2);
    g.add(cap);
  }
  return g;
}

function buildMailbox() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.05, 0.05, 1.2, 8), mat(C.vert_sq, 0.6), 0, 0.6, 0));
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.38),
    new THREE.MeshStandardMaterial({ color: C.rouge, roughness: 0.5, metalness: 0.1 }));
  body.position.y = 1.35; g.add(body);
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.38, 12, 1, false, 0, Math.PI), mat(C.rouge, 0.5, 0.1), 0, 1.54, 0));
  g.userData = { type: 'mail', interactive: true, action: 'send_mail' };
  return g;
}

function buildVending() {
  const g = new THREE.Group();
  g.add(mesh(box(0.7, 1.8, 0.5), mat(0x334466, 0.4, 0.3), 0, 0.9, 0));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), matE(0x112244, 0x2266ff, 0.6));
  screen.position.set(0, 1.1, 0.26); g.add(screen);
  g.add(mesh(box(0.55, 0.08, 0.04), mat(0x222233, 0.5), 0, 0.55, 0.26));
  g.userData = { type: 'vending', interactive: true, action: 'buy_item', cost: 2 };
  return g;
}

function buildTrafficLight() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.055, 0.055, 5.5, 8), mat(C.acier, 0.5, 0.5), 0, 2.75, 0));
  g.add(mesh(box(0.22, 0.62, 0.16), mat(C.noir, 0.6), 0, 5.3, 0));
  const colors = [[C.rouge, 5.5], [C.jaune, 5.28], [C.vert, 5.06]];
  const leds = [];
  for (const [col, y] of colors) {
    // 🔧 BOOST : clone → chaque feu indépendant
    const led = new THREE.Mesh(sph(0.06, 8), matE(col, col, 0.8).clone());
    led.position.set(0, y, 0.05);
    led.userData.isLed = true;
    leds.push(led);
    g.add(led);
  }
  g.userData = { type: 'tlight', leds, phase: 0, timer: 0 };
  return g;
}

function buildBench() {
  const g = new THREE.Group();
  g.add(mesh(box(2.0, 0.06, 0.38), mat(C.bois, 0.85), 0, 0.46, 0));
  g.add(mesh(box(2.0, 0.06, 0.35), mat(C.bois, 0.85), 0, 0.8, -0.14));
  for (const x of [-0.88, 0.88]) {
    g.add(mesh(box(0.06, 0.46, 0.38), mat(C.acier, 0.5, 0.5), x, 0.23, 0));
    g.add(mesh(box(0.06, 0.55, 0.08), mat(C.acier, 0.5, 0.5), x, 0.62, -0.15));
  }
  g.userData = { type: 'bench', interactive: true, action: 'sit' };
  return g;
}

function buildDumpster() {
  const g = new THREE.Group();
  g.add(mesh(box(2.4, 1.3, 1.1), mat(0x336622, 0.6), 0, 0.65, 0));
  g.add(mesh(box(2.45, 0.06, 1.15), mat(0x224411, 0.5), 0, 1.33, 0));
  for (const x of [-1.1, 1.1]) g.add(mesh(cyl(0.12, 0.12, 0.3, 6), mat(0x1a1a1a, 0.6), x, 0.15, 0));
  return g;
}

function buildGasPump() {
  const g = new THREE.Group();
  g.add(mesh(box(0.65, 1.55, 0.4), mat(0xeeeeee, 0.5), 0, 0.78, 0));
  g.add(mesh(box(0.12, 1.6, 0.12), mat(C.acier, 0.4, 0.5), 0, 0.8, 0.22));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), matE(0x001122, 0x22ff44, 0.7));
  screen.position.set(0, 1.2, 0.21); g.add(screen);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), matE(C.rouge, C.rouge, 0.4));
  logo.position.set(0, 1.45, 0.21); g.add(logo);
  g.userData = { type: 'pump', interactive: true, action: 'refuel_vehicle', cost: 50 };
  return g;
}

function buildCampfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const log = new THREE.Mesh(cyl(0.04, 0.05, 0.55, 6), mat(C.bois, 0.95));
    log.rotation.z = Math.PI / 3; log.rotation.y = a;
    log.position.set(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15);
    g.add(log);
  }
  // 🔧 BOOST : déterministe (hash au lieu de Math.random)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = 0.08 + hash(i) * 0.04;
    const rock = new THREE.Mesh(sph(r, 5), mat(0x666666, 0.9));
    rock.position.set(Math.cos(a) * 0.32, 0.04, Math.sin(a) * 0.32);
    g.add(rock);
  }
  const flame = new THREE.PointLight(0xff7700, 0.8, 6, 2);
  flame.position.set(0, 0.5, 0); flame.userData.isFlame = true; g.add(flame);
  // 🔧 BOOST : clone → chaque feu indépendant
  const embers = new THREE.Mesh(sph(0.07, 6), matE(0xff3300, 0xff6600, 1.5).clone());
  embers.position.set(0, 0.1, 0); embers.userData.isEmbers = true; g.add(embers);
  g.userData = { type: 'campfire', interactive: true, action: 'warm_up' };
  return g;
}

function buildStopSign() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.03, 0.03, 2.8, 6), mat(C.acier, 0.5, 0.5), 0, 1.4, 0));
  const oct = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.04, 8), matE(C.rouge, C.rouge, 0.2));
  oct.position.y = 2.85; g.add(oct);
  return g;
}

function buildFlag() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.025, 0.025, 5.5, 6), mat(0xdddddd, 0.5, 0.3), 0, 2.75, 0));
  // 🔧 BOOST : clone matériau → rotation par instance OK
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75),
    matE(0x003399, 0x6699ff, 0.3).clone());
  flag.position.set(0.6, 5.3, 0);
  flag.userData.isFlag = true; g.add(flag);
  return g;
}

function buildTrashCan() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.2, 0.17, 0.75, 10), mat(0x555555, 0.7), 0, 0.38, 0));
  g.add(mesh(cyl(0.21, 0.21, 0.05, 10), mat(0x333333, 0.6), 0, 0.77, 0));
  return g;
}

// ─── FABRIQUE PRINCIPALE ──────────────────────────────────────────────────────
const BUILDERS = {
  bus: buildBusStop, hydrant: buildHydrant, mail: buildMailbox,
  vending: buildVending, tlight: buildTrafficLight, bench: buildBench,
  dump: buildDumpster, pump: buildGasPump, campfire: buildCampfire,
  stop: buildStopSign, flag: buildFlag, trash: buildTrashCan,
};

export function buildStreetProp(kind) {
  const fn = BUILDERS[kind];
  if (!fn) {
    const fallback = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), mat(0x888888));
    fallback.castShadow = true;
    return fallback;
  }
  return fn();
}

// ─── MAP action ↔ kind ────────────────────────────────────────────────────────
// 🔧 BOOST : source de vérité unique pour les interactions
const KIND_ACTION = {
  bus: 'take_bus',
  vending: 'buy_item',
  pump: 'refuel_vehicle',
  bench: 'sit',
  campfire: 'warm_up',
  mail: 'send_mail',
};

// ─── GÉNÉRATION DES EMPLACEMENTS ──────────────────────────────────────────────
export function countyStreetSpots({ VILLAGES, A40_EXITS, LAKES, depanneurOffset }) {
  const out = [];
  for (const v of VILLAGES) {
    const [cx, cz] = v.center;
    const ang = v.roadAngle;
    const dX = Math.cos(ang), dZ = Math.sin(ang);
    const pX = -dZ, pZ = dX;
    const shop = depanneurOffset(v);

    out.push({ id:`bus_${v.id}`,   kind:'bus',     action:KIND_ACTION.bus,     name:`Arrêt ${v.name}`,          x:cx+dX*22+pX*8,                 z:cz+dZ*22+pZ*8,                 yaw:-ang+Math.PI });
    out.push({ id:`hyd_${v.id}`,   kind:'hydrant', action:null,                name:'Borne-incendie',           x:shop.x+Math.cos(shop.yaw)*4.2, z:shop.z+Math.sin(shop.yaw)*4.2, yaw:shop.yaw });
    out.push({ id:`mail_${v.id}`,  kind:'mail',    action:KIND_ACTION.mail,    name:'Boîte aux lettres',        x:cx+dX*8+pX*14,                 z:cz+dZ*8+pZ*14,                 yaw:-ang });
    out.push({ id:`vend_${v.id}`,  kind:'vending', action:KIND_ACTION.vending, name:`Distributeur · ${v.name}`, x:shop.x+Math.cos(shop.yaw)*6.4, z:shop.z-Math.sin(shop.yaw)*6.4, yaw:shop.yaw, cost:2 });
    out.push({ id:`bench_${v.id}`, kind:'bench',   action:KIND_ACTION.bench,   name:`Banc · ${v.name}`,         x:cx+pX*12,                      z:cz+pZ*12,                      yaw:-ang+Math.PI/2 });
    out.push({ id:`dump_${v.id}`,  kind:'dump',    action:null,                name:'Conteneur',                x:shop.x-Math.sin(shop.yaw)*7.5, z:shop.z-Math.cos(shop.yaw)*7.5, yaw:shop.yaw });
    out.push({ id:`stop_${v.id}`,  kind:'stop',    action:null,                name:'Arrêt',                    x:cx+dX*16+pX*7,                 z:cz+dZ*16+pZ*7,                 yaw:-ang });

    if (v.type === 'ville' || v.population >= 4000)
      out.push({ id:`tl_${v.id}`,   kind:'tlight', action:null,              name:'Feu',                 x:cx+dX*6+pX*10, z:cz+dZ*6+pZ*10, yaw:-ang });
    if (v.hasEglise || v.type === 'ville')
      out.push({ id:`flag_${v.id}`, kind:'flag',   action:null,              name:`Drapeau · ${v.name}`, x:cx+pX*6,       z:cz+pZ*6,       yaw:-ang });
  }

  if (A40_EXITS) for (const ex of A40_EXITS)
    out.push({ id:`pump_${ex.no}`, kind:'pump', action:KIND_ACTION.pump, name:`Petro-Canada ${ex.title}`, x:ex.x+18, z:28, yaw:Math.PI, cost:50 });

  if (LAKES) for (const l of LAKES)
    out.push({ id:`fire_${l.name.replace(/\s+/g,'_')}`, kind:'campfire', action:KIND_ACTION.campfire, name:`Feu de camp · ${l.name}`, x:l.x+l.r*0.62, z:l.z+10, yaw:0.4 });

  return out;
}

// ─── MONTAGE ──────────────────────────────────────────────────────────────────
export function mountStreetFurniture(parent, worldData) {
  const group = new THREE.Group();
  group.name = 'street-furniture';
  const spots = countyStreetSpots(worldData);
  const hot = [];
  for (const s of spots) {
    const o = buildStreetProp(s.kind);
    const y = worldData.getTerrainHeight ? worldData.getTerrainHeight(s.x, s.z) : 0;
    o.position.set(s.x, y, s.z);
    o.rotation.y = s.yaw;
    o.userData.streetId = s.id;
    o.userData.streetKind = s.kind;
    o.userData.cost = s.cost;       // 🔧 BOOST : propage le coût
    group.add(o);
    if (s.kind === 'tlight' || s.kind === 'campfire') hot.push(o);
  }
  group.userData.hot = hot;
  group.userData.spots = spots;     // 🔧 BOOST : spots accessibles depuis le group
  parent.add(group);
  return { group, spots };
}

// ─── TICK ANIMÉ ───────────────────────────────────────────────────────────────
// 🔧 BOOST : dt paramétrable (framerate-indépendant)
export function tickStreetProps(group, elapsed, kernel, dt = 0.016) {
  const hot = group.userData.hot || [];
  for (const o of hot) {
    if (o.userData.type === 'tlight') {
      o.userData.timer = (o.userData.timer || 0) + dt;
      if (o.userData.timer > 8) {
        o.userData.phase = (o.userData.phase + 1) % 3;
        o.userData.timer = 0;
        if (o.userData.leds) {
          for (let i = 0; i < 3; i++)
            o.userData.leds[i].material.emissiveIntensity = i === o.userData.phase ? 1.5 : 0.08;
        }
      }
    }
    if (o.userData.type === 'campfire') {
      o.traverse(c => {
        if (c.userData.isFlame && c.isLight) c.intensity = 0.5 + Math.sin(elapsed * 7 + Math.random() * 0.5) * 0.4;
        if (c.userData.isEmbers && c.isMesh) c.material.emissiveIntensity = 1.2 + Math.sin(elapsed * 4) * 0.5;
      });
    }
    if (o.userData.type === 'flag') {
      o.traverse(c => { if (c.userData.isFlag) c.rotation.y = Math.sin(elapsed * 1.5) * 0.18; });
    }
  }
}

// ─── INTERACTIVITÉ ────────────────────────────────────────────────────────────
export function nearestStreet(spots, x, z, max, kind) {
  let best = null, bestD = max;
  for (const s of spots) {
    if (kind && s.kind !== kind) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

// 🔧 BOOST : interactStreetProp fonctionne maintenant (action lue depuis spot)
export function interactStreetProp(spot, player, kernel) {
  if (!spot || !spot.action) return;
  const ACTIONS = {
    take_bus:       () => kernel?.route('troxtworld:transport', { type:'bus', spot:spot.id, player_id:player.id }, { trusted:true }),
    buy_item:       () => kernel?.route('troxt_economy:purchase', { item:'drink', cost:spot.cost||2, player_id:player.id }, { trusted:true }),
    refuel_vehicle: () => kernel?.route('troxtworld:refuel', { spot:spot.id, player_id:player.id, cost:spot.cost||50 }, { trusted:true }),
    sit:            () => kernel?.emit('anim:sit', { player_id:player.id }),
    warm_up:        () => kernel?.emit('troxtworld:warm_up', { player_id:player.id }),
    send_mail:      () => kernel?.emit('troxtworld:mail', { player_id:player.id }),
  };
  ACTIONS[spot.action]?.();
}

// ─── DISPOSE (hot-reload safe) ───────────────────────────────────────────────
// 🔧 BOOST : libère géos/mats du cache si tu recharges le module
export function disposeStreetProps() {
  for (const g of _geo.values()) g.dispose();
  for (const m of _mat.values()) m.dispose();
  _geo.clear();
  _mat.clear();
}

export function getStats() { return { geos: _geo.size, mats: _mat.size, sig: SIG }; }
export { SIG };
export default {
  buildStreetProp, countyStreetSpots, mountStreetFurniture,
  tickStreetProps, nearestStreet, interactStreetProp,
  disposeStreetProps, getStats,
};
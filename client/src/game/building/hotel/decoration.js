/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — ENVIRONMENT/BUILDINGS/HOTEL/DECORATION.JS (v3.0)
 * Décor, Ameublement & Éclairage Procédural pour l'Hôtellerie
 * ═══════════════════════════════════════════════════════════════════
 * Construit les éléments de décors intérieurs :
 *  • Mobilier de luxe (Lits King, Sofas, Fauteuils en velours, Tables de nuit)
 *  • Systèmes d'éclairage (Lustres en cristal, Spots encastrés, Appliques murales)
 *  • Structures communes (Portes d'ascenseurs Medeco, Sorties de secours, Foyers de briques)
 *  • Tapisserie, rideaux drapés et végétations d'accueil
 *
 * Signature : TROXT⬡ · 🏨HotelDecorator
 * Chemin    : client/src/components/buildings/hotel/decoration.js
 */

import * as THREE from "three";
import { buildDoorCasing, buildPanelLeaf, doorLabelMat } from "../access-control/doors/door.js";
import { getGeo } from "../../geometries.js";
import { matLib } from "../../materials.js";
import { tex } from "../buildings/architecture/materiaux/textures.js";
import { mountNightstandMesh } from "./nightstand.js";
import { mountSofaMesh } from "../../maison/sofa.js";

const SIG = 'TROXT⬡';

// ─── CONSTANTES CHROMATIQUES (FROZEN) ────────────────────────────────────────
const GOLD   = 0xd4a853;
const VELVET = 0x3d1c1c;
const WOOD   = 0x1e1b2e;

// ─── CACHE LOCAL DES MATÉRIAUX D'ÉTIQUETTES (ANTI-LEAK) ──────────────────────
const labelCache = new Map();

/**
 * Génère et met en cache une texture d'étiquette de porte.
 * @param {string} text 
 * @param {string} [bg="#c9a24a"] 
 * @param {string} [fg="#1a1208"] 
 * @returns {THREE.MeshLambertMaterial}
 */
export function doorLabelMatCached(text, bg = "#c9a24a", fg = "#1a1208") {
  const key = `${text}|${bg}|${fg}`;
  let hit = labelCache.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 236, 108);
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${text.length > 4 ? 38 : 54}px monospace`;
  ctx.fillText(text, 128, 66);

  const map = finishMap(new THREE.CanvasTexture(c), "clamp");
  map.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshLambertMaterial({ map, color: 0xffffff });
  mat.userData.csmWired = true;
  labelCache.set(key, mat);
  return mat;
}

/** Libère la VRAM du cache d'étiquettes */
export function disposeLabelCache() {
  labelCache.forEach((mat) => {
    if (mat.map) mat.map.dispose();
    mat.dispose();
  });
  labelCache.clear();
}

// ─── HELPERS DE CREATION RAPIDE (SANS ACCUMULATION DE GEOMETRIES) ────────────

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(getGeo("box", { w, h, d }), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(r, h, mat, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(getGeo("cylinder", { r, r2: r, h, seg }), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AMEUBLEMENT DES SUITES ET DE L'ACCUEIL
// ═══════════════════════════════════════════════════════════════════════════

export function kingBed(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const base = new THREE.Mesh(getGeo("box", { w: 2.2, h: 0.3, d: 2.2 }), tex.mat("noyer", 1.4, 1.4, 0.45, 0.08));
  base.position.y = 0.15;
  g.add(base);

  const mat = new THREE.Mesh(getGeo("box", { w: 2, h: 0.32, d: 2 }), tex.cloth("laineTricot", "laineKnitNrm", 1.8, 1.8, 0.9, 0x4a4a6a, 0.9));
  mat.position.y = 0.48;
  g.add(mat);

  const head = new THREE.Mesh(getGeo("box", { w: 2.2, h: 1.35, d: 0.14 }), matLib.get(WOOD, 0.55, 0.25));
  head.position.set(0, 1.0, -1.05);
  g.add(head);

  const trim = new THREE.Mesh(getGeo("box", { w: 2.3, h: 0.07, d: 0.16 }), matLib.get(GOLD, 0.18, 0.85));
  trim.position.set(0, 1.72, -1.05);
  g.add(trim);

  for (const sx of [-0.48, 0.48]) {
    const p = new THREE.Mesh(getGeo("box", { w: 0.65, h: 0.22, d: 0.4 }), matLib.get(0xf5f0eb, 0.95));
    p.position.set(sx, 0.72, -0.62);
    p.rotation.x = 0.28;
    g.add(p);
  }
  return g;
}

export function chandelier(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const rod = new THREE.Mesh(getGeo("cylinder", { r: 0.03, r2: 0.04, h: 0.9, seg: 8 }), matLib.get(GOLD, 0.15, 0.85));
  rod.position.y = 0.2;
  g.add(rod);

  const ring = new THREE.Mesh(getGeo("torus", { r: 0.42, tube: 0.03, seg: 24 }), matLib.get(GOLD, 0.15, 0.85));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.2;
  g.add(ring);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bulb = new THREE.Mesh(
      getGeo("sphere", { r: 0.07, seg: 8 }),
      matLib.getEmissive(0xfff5e6, 0xfff5e6, 0.85)
    );
    bulb.position.set(Math.cos(a) * 0.42, -0.38, Math.sin(a) * 0.42);
    bulb.userData.lobbyLamp = true;
    g.add(bulb);
  }

  const light = new THREE.PointLight(0xfff5e6, 3.4, 14, 2);
  light.position.y = -0.35;
  light.userData.lobbyLamp = true;
  g.add(light);

  return g;
}

export function receptionDesk(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const body = new THREE.Mesh(getGeo("box", { w: 3.2, h: 1.05, d: 0.75 }), matLib.get(WOOD, 0.4, 0.35));
  body.position.y = 0.52;
  body.castShadow = true;
  g.add(body);

  const top = new THREE.Mesh(getGeo("box", { w: 3.4, h: 0.07, d: 0.85 }), matLib.get(0xf5f0eb, 0.22, 0.15));
  top.position.y = 1.08;
  g.add(top);

  const gold = new THREE.Mesh(getGeo("box", { w: 3.2, h: 0.02, d: 0.02 }), matLib.get(GOLD, 0.15, 0.9));
  gold.position.set(0, 1.04, 0.4);
  g.add(gold);

  return g;
}

export function receptionBell(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.bell = true;

  const base = new THREE.Mesh(getGeo("cylinder", { r: 0.12, r2: 0.16, h: 0.07, seg: 16 }), matLib.get(GOLD, 0.15, 0.9));
  g.add(base);

  const dome = new THREE.Mesh(
    getGeo("hemisphere", { r: 0.1, seg: 14 }),
    matLib.get(GOLD, 0.15, 0.9)
  );
  dome.position.y = 0.07;
  g.add(dome);

  const button = new THREE.Mesh(getGeo("cylinder", { r: 0.016, r2: 0.016, h: 0.05, seg: 8 }), matLib.get(0xf5f0eb, 0.4));
  button.position.y = 0.14;
  g.add(button);

  return g;
}

export function loungeChair(x, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  g.userData.sit = true;

  const cloth = tex.cloth("laineTricot", "laineKnitNrm", 1.2, 1.2, 0.9, VELVET, 0.85);
  const seat = new THREE.Mesh(getGeo("box", { w: 0.74, h: 0.12, d: 0.7 }), cloth);
  seat.position.y = 0.42;
  seat.castShadow = true;
  g.add(seat);

  const back = new THREE.Mesh(getGeo("box", { w: 0.74, h: 0.72, d: 0.1 }), cloth);
  back.position.set(0, 0.82, -0.3);
  g.add(back);

  for (const sx of [-0.3, 0.3]) {
    const leg = new THREE.Mesh(getGeo("cylinder", { r: 0.025, h: 0.4, seg: 8 }), matLib.get(GOLD, 0.2, 0.7));
    leg.position.set(sx, 0.2, 0.22);
    g.add(leg);
    const legB = leg.clone();
    legB.position.z = -0.22;
    g.add(legB);
  }
  return g;
}

export function woolSofa(x, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  g.userData.sit = true;

  const cloth = tex.cloth("laineTricot", "laineKnitNrm", 2.2, 1.4, 0.9, 0x4a4a6a, 0.92);
  const dummy = new THREE.Group();
  dummy.name = "sofa-dummy";

  const seat = new THREE.Mesh(getGeo("box", { w: 2.1, h: 0.28, d: 0.85 }), cloth);
  seat.position.y = 0.38;
  seat.castShadow = true;
  dummy.add(seat);

  const back = new THREE.Mesh(getGeo("box", { w: 2.1, h: 0.62, d: 0.18 }), cloth);
  back.position.set(0, 0.72, -0.38);
  dummy.add(back);

  for (const sx of [-0.95, 0.95]) {
    const arm = new THREE.Mesh(getGeo("box", { w: 0.16, h: 0.38, d: 0.85 }), cloth);
    arm.position.set(sx, 0.52, 0);
    dummy.add(arm);
  }

  g.add(dummy);
  mountSofaMesh(g);
  return g;
}

export function coffeeTable(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const top = new THREE.Mesh(getGeo("box", { w: 1.15, h: 0.06, d: 0.62 }), tex.mat("noyer", 1.2, 0.7, 0.35, 0.12));
  top.position.y = 0.38;
  top.castShadow = true;
  g.add(top);

  for (const [sx, sz] of [[-0.46, -0.22], [0.46, -0.22], [-0.46, 0.22], [0.46, 0.22]]) {
    const leg = new THREE.Mesh(getGeo("cylinder", { r: 0.025, h: 0.36, seg: 8 }), matLib.get(GOLD, 0.2, 0.75));
    leg.position.set(sx, 0.18, sz);
    g.add(leg);
  }
  return g;
}

export function lobbyPlant(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const pot = new THREE.Mesh(getGeo("cylinder", { r: 0.18, r2: 0.14, h: 0.32, seg: 10 }), matLib.get(0x7a4438, 0.7));
  pot.position.y = 0.16;
  g.add(pot);

  const dirt = new THREE.Mesh(getGeo("cylinder", { r: 0.15, r2: 0.15, h: 0.04, seg: 10 }), matLib.get(0x3a2a1c, 0.95));
  dirt.position.y = 0.32;
  g.add(dirt);

  const leafGeo = getGeo("sphere", { r: 0.16, seg: 8 });
  const leafMat = matLib.get(0x2a6a38, 0.95);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(Math.cos(a) * 0.1, 0.52 + (i % 2) * 0.12, Math.sin(a) * 0.1);
    leaf.scale.set(1, 1.4, 0.55);
    g.add(leaf);
  }
  return g;
}

export function persianRug(x, z, w, d) {
  const m = new THREE.Mesh(getGeo("plane", { w, h: d }), tex.mat("velours", Math.max(1.2, w * 0.55), Math.max(1.2, d * 0.55), 0.92));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z);
  m.receiveShadow = true;
  return m;
}

export function nightstand(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const dummy = new THREE.Mesh(getGeo("box", { w: 0.48, h: 0.55, d: 0.4 }), matLib.get(WOOD, 0.42, 0.28));
  dummy.name = "nightstand-dummy";
  dummy.position.y = 0.28;
  dummy.castShadow = true;
  g.add(dummy);

  const lampG = new THREE.Group();
  lampG.name = "nightstand-lamp";
  lampG.position.y = 0.68;

  const stem = new THREE.Mesh(getGeo("cylinder", { r: 0.03, r2: 0.04, h: 0.22, seg: 8 }), matLib.get(GOLD, 0.18, 0.8));
  stem.position.y = 0;
  lampG.add(stem);

  const shade = new THREE.Mesh(
    getGeo("sphere", { r: 0.09, seg: 8 }),
    matLib.getEmissive(0xfff5e6, 0xfff5e6, 0.45)
  );
  shade.position.y = 0.14;
  lampG.add(shade);

  const light = new THREE.PointLight(0xfff0d8, 1.4, 4.5, 2);
  light.position.y = 0.14;
  lampG.add(light);

  g.add(lampG);
  mountNightstandMesh(g);
  return g;
}

export function velvetCurtain(x, z, yaw = 0, width = 2.4, height = 2.7) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;

  const rod = new THREE.Mesh(getGeo("cylinder", { r: 0.025, r2: 0.025, h: width, seg: 8 }), matLib.get(GOLD, 0.15, 0.9));
  rod.rotation.z = Math.PI / 2;
  rod.position.y = height;
  g.add(rod);

  const left = new THREE.Mesh(getGeo("box", { w: width * 0.42, h: height, d: 0.05 }), matLib.get(VELVET, 0.92));
  left.position.set(-width * 0.22, height / 2, 0);
  g.add(left);

  const right = new THREE.Mesh(getGeo("box", { w: width * 0.42, h: height, d: 0.05 }), matLib.get(VELVET, 0.92));
  right.position.set(width * 0.22, height / 2, 0);
  g.add(right);

  return g;
}

export function wallArt(x, y, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;

  const frame = new THREE.Mesh(getGeo("box", { w: 1.15, h: 0.78, d: 0.04 }), matLib.get(WOOD, 0.35, 0.25));
  g.add(frame);

  const paint = new THREE.Mesh(
    getGeo("plane", { w: 0.95, h: 0.58 }),
    matLib.getEmissive(0x4a3aff, 0x4a3aff, 0.12)
  );
  paint.position.z = 0.025;
  g.add(paint);

  const gold = new THREE.Mesh(getGeo("box", { w: 0.95, h: 0.02, d: 0.01 }), matLib.get(GOLD, 0.15, 0.9));
  gold.position.z = 0.028;
  g.add(gold);

  return g;
}

export function elevatorPlate(x, y, z) {
  const m = new THREE.Mesh(
    getGeo("box", { w: 1.6, h: 2.3, d: 0.08 }),
    matLib.get(0x8a9098, 0.32, 0.72)
  );
  m.position.set(x, y, z);
  m.userData.elevator = true;
  return m;
}

export function ceilingLight(x, y, z, intensity = 1.2) {
  const g = new THREE.Group();

  const dish = new THREE.Mesh(getGeo("cylinder", { r: 0.16, r2: 0.22, h: 0.05, seg: 12 }), matLib.get(0xf5f0eb, 0.35));
  dish.position.set(x, y, z);
  g.add(dish);

  const bulb = new THREE.Mesh(
    getGeo("sphere", { r: 0.05, seg: 8 }),
    matLib.getEmissive(0xfff5e6, 0xfff5e6, 0.7)
  );
  bulb.position.set(x, y - 0.04, z);
  g.add(bulb);

  const light = new THREE.PointLight(0xfff5e6, intensity, 9, 2);
  light.position.set(x, y - 0.12, z);
  g.add(light);

  return g;
}

export function recessedCan(x, y, z, intensity = 0.85) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const ring = new THREE.Mesh(getGeo("cylinder", { r: 0.11, r2: 0.13, h: 0.04, seg: 12 }), matLib.get(0x2a2e34, 0.4, 0.45));
  g.add(ring);

  const lamp = new THREE.Mesh(
    getGeo("cylinder", { r: 0.07, r2: 0.07, h: 0.02, seg: 10 }),
    matLib.getEmissive(0xfff3d6, 0xffe8b0, 1.15)
  );
  lamp.position.y = -0.02;
  g.add(lamp);

  if (intensity > 0) {
    const light = new THREE.PointLight(0xfff1d0, intensity, 8.5, 2);
    light.position.y = -0.14;
    g.add(light);
  }
  return g;
}

export function doorFrame(x, z, yaw = 0) {
  const g = buildDoorCasing(0.96, 2.22, 0.15);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

export function hallDoor(x, z, yaw, label, locked) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  g.userData.hallDoor = true;
  g.userData.locked = locked;
  g.userData.label = label;

  g.add(buildDoorCasing(0.96, 2.22, 0.14, matLib.get(0x1a1822, 0.55, 0.16)));
  const leaf = buildPanelLeaf(0.86, 2.1, { locked, wood: tex.mat("noyer", 1.05, 2.1, 0.5, 0.08) });
  leaf.position.set(0, 0, 0.025);
  g.add(leaf);

  const plate = new THREE.Mesh(getGeo("box", { w: 0.28, h: 0.13, d: 0.018 }), doorLabelMatCached(label));
  plate.position.set(-0.22, 1.78, 0.06);
  g.add(plate);

  const lock = box(0.07, 0.11, 0.03, matLib.get(0x14161a, 0.4, 0.5), 0.36, 1.72, 0.055);
  g.add(lock);

  const ledCol = locked ? 0xef4444 : 0x22c55e;
  const led = new THREE.Mesh(getGeo("sphere", { r: 0.016, seg: 8 }), matLib.getEmissive(ledCol, ledCol, 1.05));
  led.position.set(0.36, 1.78, 0.075);
  g.add(led);

  g.add(box(0.08, 0.14, 0.03, matLib.get(0x111318, 0.35, 0.45), 0.5, 1.18, 0.05));
  g.add(box(0.05, 0.07, 0.008, matLib.getEmissive(0x1a3a28, 0x4ade80, locked ? 0.15 : 0.55), 0.5, 1.2, 0.068));
  g.add(box(0.055, 0.012, 0.006, matLib.get(0x22262c, 0.5), 0.5, 1.13, 0.068));
  g.add(box(0.72, 0.035, 0.03, matLib.getEmissive(0xffe4b0, 0xffd080, 0.75), 0, 2.26, 0.06));

  if (locked) {
    const tag = box(0.12, 0.16, 0.01, matLib.get(0x1f2937, 0.85), -0.28, 1.38, 0.055);
    tag.rotation.z = 0.08;
    g.add(tag);
  }
  return g;
}

export function corridorBench(x, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  g.userData.sit = true;

  const wood = tex.mat("noyer", 1.2, 0.5, 0.5, 0.08);
  const velvet = tex.mat("velours", 1.1, 0.6, 0.9);

  const seat = box(1.18, 0.07, 0.44, wood, 0, 0.42, 0);
  seat.castShadow = true;
  g.add(seat);

  g.add(box(1.12, 0.05, 0.4, velvet, 0, 0.48, 0.01));
  g.add(box(1.18, 0.42, 0.07, wood, 0, 0.72, -0.18));
  g.add(box(1.12, 0.28, 0.04, velvet, 0, 0.74, -0.14));

  for (const sx of [-0.52, 0.52]) {
    g.add(box(0.07, 0.42, 0.07, matLib.get(GOLD, 0.2, 0.75), sx, 0.21, 0.14));
    g.add(box(0.07, 0.42, 0.07, matLib.get(GOLD, 0.2, 0.75), sx, 0.21, -0.14));
    g.add(box(0.08, 0.16, 0.42, wood, sx, 0.55, 0));
  }
  return g;
}

export function corridorSconce(x, y, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;

  g.add(box(0.08, 0.22, 0.04, matLib.get(0x1c1a22, 0.5, 0.25)));

  const brass = matLib.get(GOLD, 0.2, 0.82);
  const arm = new THREE.Mesh(getGeo("cylinder", { r: 0.012, h: 0.1, seg: 8 }), brass);
  arm.rotation.x = Math.PI / 2;
  arm.position.z = 0.06;
  g.add(arm);

  const shade = new THREE.Mesh(
    getGeo("cylinder", { r: 0.055, r2: 0.07, h: 0.12, seg: 10 }),
    matLib.getEmissive(0xfff0d4, 0xffe0a8, 0.65)
  );
  shade.position.set(0, -0.02, 0.12);
  g.add(shade);

  return g;
}

export function exitSign(x, y, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;

  g.add(box(0.46, 0.16, 0.04, matLib.get(0x111318, 0.45)));

  const plate = new THREE.Mesh(
    getGeo("box", { w: 0.42, h: 0.12, d: 0.012 }),
    doorLabelMatCached("SORTIE", "#14532d", "#bbf7d0")
  );
  plate.position.z = 0.025;
  g.add(plate);

  g.add(box(0.42, 0.012, 0.01, matLib.getEmissive(0x4ade80, 0x4ade80, 0.85), 0, 0.07, 0.03));
  return g;
}

export function elevatorDoors(x, z, yaw = 0, floor = "2") {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;

  const steel = matLib.get(0x8a9098, 0.32, 0.72);
  const dark = matLib.get(0x2a3036, 0.4, 0.55);

  g.add(box(1.72, 2.48, 0.1, dark, 0, 1.24, -0.02));

  const left = box(0.72, 2.18, 0.05, steel, -0.37, 1.12, 0.03);
  left.userData.elevator = true;
  g.add(left);

  g.add(box(0.72, 2.18, 0.05, steel, 0.37, 1.12, 0.03));
  g.add(box(0.02, 2.18, 0.04, matLib.get(0x111318, 0.5), 0, 1.12, 0.05));
  g.add(box(1.5, 0.08, 0.06, dark, 0, 2.28, 0.04));

  const display = new THREE.Mesh(getGeo("box", { w: 0.22, h: 0.16, d: 0.02 }), doorLabelMatCached(floor, "#111318", "#fde68a"));
  display.position.set(0, 2.42, 0.06);
  g.add(display);

  const panel = box(0.12, 0.28, 0.04, dark, 0.92, 1.22, 0.04);
  panel.userData.elevator = true;
  g.add(panel);

  g.add(box(0.05, 0.05, 0.012, matLib.getEmissive(0xd4a853, 0xd4a853, 0.7), 0.92, 1.3, 0.065));
  g.add(box(0.05, 0.05, 0.012, matLib.get(0x3a3f46, 0.5), 0.92, 1.16, 0.065));

  return g;
}

export function fireCabinet(x, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;

  g.add(box(0.42, 0.72, 0.14, matLib.get(0x8b1e1e, 0.7), 0, 1.15, 0));
  g.add(box(0.34, 0.58, 0.02, matLib.glass(0x7aa0b8, 0.35), 0, 1.16, 0.07));
  g.add(box(0.08, 0.42, 0.08, matLib.get(0xb91c1c, 0.55), 0.02, 1.12, 0.02));
  g.add(box(0.22, 0.05, 0.05, matLib.get(0x9ca3af, 0.3, 0.7), -0.04, 1.32, 0.02));

  return g;
}

export function dressHotelCorridor(g, W, D, H) {
  const wood = tex.mat("noyer", 4, 0.6, 0.55, 0.08);
  const plaster = tex.mat("platre", 3.2, 0.4, 0.88);
  const gold = matLib.get(GOLD, 0.22, 0.8);
  const edge = W / 2 - 0.09;
  const doorZs = [-6, -2, 2, 6];
  const gap = 0.64;
  const half = D / 2;
  const cuts = [-half + 0.18, ...doorZs.flatMap((z) => [z - gap, z + gap]), half - 0.18];
  
  const segs = [];
  for (let i = 0; i + 1 < cuts.length; i += 2) {
    const a = cuts[i];
    const b = cuts[i + 1];
    if (b - a > 0.2) segs.push({ z: (a + b) / 2, len: b - a });
  }

  for (const sx of [-1, 1]) {
    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s];
      g.add(box(0.045, 0.98, seg.len, wood, sx * edge, 0.49, seg.z));
      g.add(box(0.05, 0.045, seg.len, gold, sx * (edge - 0.01), 0.99, seg.z));
      g.add(box(0.03, 0.08, seg.len, matLib.get(0x2a2430, 0.7), sx * (edge + 0.01), 0.04, seg.z));
    }
    g.add(box(0.04, 0.08, D - 0.3, plaster, sx * (edge + 0.01), H - 0.05, 0));
  }

  g.add(box(W - 0.2, 0.06, 0.04, plaster, 0, H - 0.04, -D / 2 + 0.12));
  g.add(box(W - 0.2, 0.06, 0.04, plaster, 0, H - 0.04, D / 2 - 0.12));

  g.add(box(0.045, 0.01, D - 0.5, gold, -0.58, 0.018, 0));
  g.add(box(0.045, 0.01, D - 0.5, gold, 0.58, 0.018, 0));
  g.add(box(0.14, 0.02, D - 0.6, matLib.getEmissive(0xfde68a, 0xfbbf24, 0.55), 0, H - 0.03, 0));

  for (const z of [-8, -6, -2, 2, 6, 8]) {
    g.add(recessedCan(0, H - 0.04, z, Math.abs(z) === 8 ? 0.85 : 2.2));
  }

  const fill = new THREE.PointLight(0xfff1d0, 2.8, 18, 2);
  fill.position.set(0, H - 0.45, 0);
  g.add(fill);

  for (const z of [-4, 0, 4]) {
    g.add(corridorSconce(-W / 2 + 0.1, 1.55, z, Math.PI / 2));
    g.add(corridorSconce(W / 2 - 0.1, 1.55, z, -Math.PI / 2));
  }

  g.add(elevatorDoors(0, -D / 2 + 0.08, 0, "2"));
  g.add(exitSign(0, H - 0.28, D / 2 - 0.16, Math.PI));
  g.add(exitSign(0, H - 0.28, -D / 2 + 0.16, 0));
  g.add(fireCabinet(-W / 2 + 0.22, 8.2, Math.PI / 2));
  g.add(wallArt(W / 2 - 0.12, 1.7, 4, -Math.PI / 2));
  g.add(wallArt(-W / 2 + 0.12, 1.7, -8, Math.PI / 2));
  g.add(lobbyPlant(W / 2 - 0.45, -4));
  g.add(lobbyPlant(-W / 2 + 0.45, 4));
  g.add(corridorBench(-W / 2 + 0.42, 0, Math.PI / 2));
  g.add(corridorBench(W / 2 - 0.42, -4.2, -Math.PI / 2));
  g.add(hallDoor(0, D / 2 - 0.09, Math.PI, "HALL", false));
}

export function lightPanel(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.lightSwitch = true;

  const plate = new THREE.Mesh(getGeo("box", { w: 0.18, h: 0.28, d: 0.04 }), matLib.get(0xe8e4dc, 0.5));
  g.add(plate);

  const led = new THREE.Mesh(
    getGeo("sphere", { r: 0.03, seg: 8 }),
    matLib.getEmissive(0x22c55e, 0x22c55e, 0.85)
  );
  led.position.z = 0.03;
  led.userData.panelLed = true;
  g.add(led);

  return g;
}

export function baseboard(x, z, width, yaw = 0) {
  const m = new THREE.Mesh(getGeo("box", { w: width, h: 0.07, d: 0.03 }), matLib.getEmissive(0x4a3aff, 0x4a3aff, 0.12));
  m.position.set(x, 0.04, z);
  m.rotation.y = yaw;
  return m;
}

export function brickFireplace(x, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;

  const back = new THREE.Mesh(getGeo("box", { w: 1.85, h: 1.55, d: 0.22 }), tex.mat("brique", 1.4, 1.1, 0.82, 0.02));
  back.position.set(0, 0.82, 0);
  back.castShadow = true;
  g.add(back);

  const opening = new THREE.Mesh(getGeo("box", { w: 0.95, h: 0.62, d: 0.12 }), tex.mat("cheminee", 1, 0.7, 0.55, 0));
  opening.position.set(0, 0.52, 0.12);
  g.add(opening);

  const fire = new THREE.Mesh(
    getGeo("plane", { w: 0.88, h: 0.5 }),
    new THREE.MeshStandardMaterial({
      map: tex.map("cheminee", 1, 0.55),
      emissive: 0xff6a1a,
      emissiveIntensity: 0.85,
    })
  );
  fire.position.set(0, 0.5, 0.185);
  fire.userData.heatFire = true;
  g.add(fire);

  const light = new THREE.PointLight(0xff7a2a, 1.6, 5.5, 2);
  light.position.set(0, 0.55, 0.35);
  light.userData.heatFire = true;
  g.add(light);

  const mantel = new THREE.Mesh(getGeo("box", { w: 2.0, h: 0.08, d: 0.32 }), tex.mat("orBrosse", 2, 0.2, 0.28, 0.85));
  mantel.position.set(0, 1.42, 0.08);
  g.add(mantel);

  return g;
}

export function drapeCurtain(x, z, yaw = 0, width = 2.4, height = 2.5) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;

  const rod = new THREE.Mesh(getGeo("cylinder", { r: 0.02, h: width, seg: 8 }), tex.mat("orBrosse", 2, 0.2, 0.22, 0.9));
  rod.rotation.z = Math.PI / 2;
  rod.position.y = height;
  g.add(rod);

  const cloth = tex.mat("rideau", 1.4, 1.1, 0.86);

  const left = new THREE.Mesh(getGeo("box", { w: width * 0.38, h: height * 0.96, d: 0.04 }), cloth);
  left.position.set(-width * 0.24, height * 0.48, 0);
  g.add(left);

  const right = new THREE.Mesh(getGeo("box", { w: width * 0.38, h: height * 0.96, d: 0.04 }), cloth);
  right.position.set(width * 0.24, height * 0.48, 0);
  g.add(right);

  return g;
}

export function setLobbyLights(root, on) {
  root.traverse((obj) => {
    if (obj.userData.lobbyLamp && obj instanceof THREE.Mesh) {
      const mat = obj.material;
      if (mat.emissive) mat.emissiveIntensity = on ? 0.9 : 0.05;
    }
    if (obj.userData.lobbyLamp && obj instanceof THREE.PointLight) {
      obj.intensity = on ? 3.4 : 0.15;
    }
    if (obj.userData.panelLed && obj instanceof THREE.Mesh) {
      const mat = obj.material;
      mat.emissiveIntensity = on ? 0.85 : 0.08;
    }
  });
}
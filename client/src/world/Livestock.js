/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/LIVESTOCK.JS
 * Bétail 3D + simulation (vaches, poulailler, moutons, ruches)
 * Connecté à Farms.js, PoliceHelpers.js, WorldData.js
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/world/Livestock.js
 */

import * as THREE from 'three';
import { geoLib, matLib, makeRng } from './quebec-compat.js';
import { getTerrainHeight } from './WorldData.js';
import { legalFarmsteads } from './Farms.js';

const SIG = 'TROXT⬡';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
export const LIVESTOCK_CFG = {
  secondsPerGestationDay: 1,  // 1 seconde réelle = 1 jour de gestation (RP accéléré)
  movementThreshold:      0.04,
  feedThreshold:          0.4,
  sickHealthDrainPerSec:  0.1,
  hungerDecayPerSec:      0.006,
  thirstDecayPerSec:      0.008,
};

const ANIMAL_CONFIGS = {
  vache:      { baseMilk: 25, baseEggs: 0,   baseWool: 0, gestationDays: 283, feedConsumption: 25,   marketBaseValue: 2500 },
  poulailler: { baseMilk: 0,  baseEggs: 280, baseWool: 0, gestationDays: 21,  feedConsumption: 0.12, marketBaseValue: 15 },
  mouton:     { baseMilk: 2,  baseEggs: 0,   baseWool: 4, gestationDays: 150, feedConsumption: 3,    marketBaseValue: 350 },
  cochon:     { baseMilk: 0,  baseEggs: 0,   baseWool: 0, gestationDays: 114, feedConsumption: 5,    marketBaseValue: 450 },
  chevre:     { baseMilk: 3,  baseEggs: 0,   baseWool: 0, gestationDays: 150, feedConsumption: 4,    marketBaseValue: 400 },
  cheval:     { baseMilk: 0,  baseEggs: 0,   baseWool: 0, gestationDays: 340, feedConsumption: 12,   marketBaseValue: 5000 },
  abeille:    { baseMilk: 0,  baseEggs: 0,   baseWool: 0, gestationDays: 0,   feedConsumption: 0,    marketBaseValue: 200 },
  canard:     { baseMilk: 0,  baseEggs: 200, baseWool: 0, gestationDays: 28,  feedConsumption: 0.15, marketBaseValue: 25 },
};

const DISEASES = [
  { id: 'mammite',        name: 'Mammite',         affects: ['vache', 'chevre'],                          severity: 0.7, duration: 14 },
  { id: 'grippe_aviaire', name: 'Grippe aviaire',  affects: ['poulailler', 'canard'],                     severity: 0.9, duration: 7 },
  { id: 'fievre',         name: 'Fièvre aphteuse', affects: ['vache', 'cochon', 'mouton', 'chevre'],      severity: 0.8, duration: 21 },
  { id: 'varroa',         name: 'Varroa',          affects: ['abeille'],                                  severity: 0.6, duration: 30 },
  { id: 'colique',        name: 'Colique',         affects: ['cheval'],                                   severity: 0.5, duration: 3 },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function nowSec() {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
}

function farmToWorld(x, z, yaw, ox, oz) {
  return {
    x: x + Math.cos(yaw) * ox - Math.sin(yaw) * oz,
    z: z + Math.sin(yaw) * ox + Math.cos(yaw) * oz,
  };
}

function generateGenetics(kind, generation = 1) {
  const quality = 50 + Math.random() * 30 + generation * 5;
  const possibleTraits = ['haute_production', 'resistant_maladie', 'docile', 'longevite', 'fertile', 'rustique'];
  const traits = [];
  for (const t of possibleTraits) if (Math.random() < 0.2) traits.push(t);
  return { generation, quality: Math.min(100, quality), traits };
}

// Garde : un animal valide doit avoir genetics + hunger/thirst numériques
function isValidAnimal(s) {
  return s && typeof s === 'object'
      && s.genetics && typeof s.genetics.quality === 'number'
      && typeof s.hunger === 'number'
      && typeof s.thirst === 'number'
      && typeof s.healthPoints === 'number';
}

// ─── MESH BUILDERS ───────────────────────────────────────────────────────────
function buildHolstein(seed = 1) {
  const g = new THREE.Group();
  g.name = 'holstein';
  const white = matLib.get(0xfaf8f5, 0.9, 0);
  const black = matLib.get(0x1e1c1a, 0.95, 0);
  const pink  = matLib.get(0xe8bcae, 0.8, 0);
  const horn  = matLib.get(0xd2c4b1, 0.85, 0.1);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.72, 1.5), white);
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);

  const patchA = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.45, 0.6), black);
  patchA.position.set(seed % 2 === 0 ? 0.22 : -0.22, 1.05, 0.2);
  g.add(patchA);
  const patchB = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.35, 0.45), black);
  patchB.position.set(seed % 2 === 0 ? -0.22 : 0.2, 1.1, -0.4);
  g.add(patchB);

  const headGroup = new THREE.Group();
  headGroup.name = 'neck_head';
  headGroup.position.set(0, 1.25, -0.85);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.44), white);
  head.castShadow = true;
  headGroup.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.24), pink);
  snout.position.set(0, -0.12, -0.24);
  headGroup.add(snout);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.06), white);
    ear.position.set(sx * 0.25, 0.12, 0.05);
    ear.rotation.z = sx * 0.35;
    headGroup.add(ear);
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), horn);
    h.position.set(sx * 0.16, 0.22, 0.02);
    h.rotation.z = -sx * 0.55;
    h.rotation.x = -0.3;
    headGroup.add(h);
  }
  g.add(headGroup);

  const udder = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), pink);
  udder.position.set(0, 0.6, 0.15);
  g.add(udder);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 0.75, 4), black);
  tail.name = 'tail';
  tail.position.set(0, 1.1, 0.82);
  tail.rotation.x = 0.3;
  g.add(tail);

  for (const [x, z, name] of [
    [-0.24, 0.5,  'leg_back_l'],  [0.24, 0.5,  'leg_back_r'],
    [-0.24, -0.5, 'leg_front_l'], [0.24, -0.5, 'leg_front_r'],
  ]) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, 0.6, z);
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.65, 5), black);
    bone.position.y = -0.3;
    bone.castShadow = true;
    pivot.add(bone);
    g.add(pivot);
  }
  return g;
}

function buildSheep(seed) {
  const g = new THREE.Group();
  g.name = 'sheep';
  const wool = matLib.get(0xf5f5dc, 0.95, 0);
  const dark = matLib.get(0x2a2a2a, 0.9, 0);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), wool);
  body.position.y = 0.6;
  body.scale.set(1, 0.8, 1.3);
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.3), dark);
  head.position.set(0, 0.7, -0.45);
  head.castShadow = true;
  g.add(head);
  for (const [x, z] of [[-0.15, 0.3], [0.15, 0.3], [-0.15, -0.3], [0.15, -0.3]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 5), dark);
    leg.position.set(x, 0.25, z);
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

function buildPig(seed) {
  const g = new THREE.Group();
  g.name = 'pig';
  const pink = matLib.get(0xffb6c1, 0.85, 0);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), pink);
  body.position.y = 0.5;
  body.scale.set(1, 0.8, 1.4);
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), pink);
  head.position.set(0, 0.55, -0.4);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 6), pink);
  snout.position.set(0, 0.5, -0.55);
  snout.rotation.x = Math.PI / 2;
  g.add(snout);
  for (const [x, z] of [[-0.15, 0.25], [0.15, 0.25], [-0.15, -0.25], [0.15, -0.25]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 5), pink);
    leg.position.set(x, 0.2, z);
    g.add(leg);
  }
  return g;
}

function buildHorse(seed) {
  const g = new THREE.Group();
  g.name = 'horse';
  const colors = [0x8b4513, 0x2f1810, 0xd2b48c, 0xf5f5dc];
  const coat = matLib.get(colors[seed % colors.length], 0.85, 0);
  const dark = matLib.get(0x1a1a1a, 0.9, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 1.8), coat);
  body.position.y = 1.2;
  body.castShadow = true;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 6), coat);
  neck.position.set(0, 1.6, -0.8);
  neck.rotation.x = -0.4;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.5), coat);
  head.position.set(0, 1.9, -1.2);
  head.castShadow = true;
  g.add(head);
  for (const [x, z] of [[-0.2, 0.6], [0.2, 0.6], [-0.2, -0.6], [0.2, -0.6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 6), coat);
    leg.position.set(x, 0.5, z);
    leg.castShadow = true;
    g.add(leg);
  }
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.6), dark);
  mane.position.set(0, 1.8, -0.9);
  g.add(mane);
  return g;
}

function buildHen(i) {
  const g = new THREE.Group();
  const colors = [0xb35a2d, 0xf0ebe1, 0x5c5650];
  const c = colors[i % colors.length];
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), matLib.get(c, 0.9, 0));
  body.position.y = 0.2;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), matLib.get(c, 0.9, 0));
  head.position.set(0, 0.34, -0.1);
  g.add(head);
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.09), matLib.get(0xb51c1c, 0.8, 0));
  comb.position.set(0, 0.42, -0.1);
  g.add(comb);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), matLib.get(0xe89912, 0.7, 0));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.32, -0.17);
  g.add(beak);
  return g;
}

function buildCoop() {
  const g = new THREE.Group();
  g.name = 'poulailler';
  const red  = matLib.get(0x8f2d1b, 0.95);
  const grey = matLib.get(0x5c5248, 0.92);
  const house = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 1.8), red);
  house.position.y = 0.75;
  house.castShadow = true; house.receiveShadow = true;
  g.add(house);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 2.1), matLib.get(0x2d2c2a, 0.8, 0.2));
  roof.position.y = 1.6; roof.rotation.x = 0.12; roof.castShadow = true;
  g.add(roof);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 1.1), grey);
  ramp.position.set(0, 0.24, 1.2); ramp.rotation.x = -0.38;
  g.add(ramp);
  const run = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.04, 3.0), matLib.get(0x5c4a37, 1, 0));
  run.position.set(0, 0.02, 2.3); run.receiveShadow = true;
  g.add(run);
  for (let i = 0; i < 5; i++) {
    const hen = buildHen(i);
    hen.position.set(-1.1 + i * 0.55, 0, 2.0 + (i % 2) * 0.6);
    hen.rotation.y = i * 1.25;
    hen.userData.hen = true;
    hen.userData.phase = i * 2.1;
    g.add(hen);
  }
  return g;
}

function buildBeehive() {
  const g = new THREE.Group();
  g.name = 'ruche';
  const wood  = matLib.get(0xf5deb3, 0.9, 0);
  const white = matLib.get(0xffffff, 0.85, 0);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), wood);
  base.position.y = 0.05;
  g.add(base);
  for (let i = 0; i < 3; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.45), white);
    box.position.y = 0.2 + i * 0.25;
    box.castShadow = true;
    g.add(box);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), matLib.get(0x8b4513, 0.8, 0));
  roof.position.y = 0.95;
  roof.castShadow = true;
  g.add(roof);
  return g;
}

function buildPaddock(w, d) {
  const g = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), matLib.get(0x3d5c2e, 1, 0));
  grass.position.y = 0.03;
  grass.receiveShadow = true;
  g.add(grass);

  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.25, 5);
  const wood    = matLib.get(0x4a3f35, 0.95, 0);
  const posts   = [];
  const step    = 4.0;
  for (let x = -w / 2; x <= w / 2 + 0.01; x += step) posts.push([x, -d / 2], [x, d / 2]);
  for (let z = -d / 2 + step; z < d / 2; z += step) posts.push([-w / 2, z], [w / 2, z]);

  const postMesh = new THREE.InstancedMesh(postGeo, wood, posts.length);
  postMesh.castShadow = true;
  const dummy = new THREE.Object3D();
  posts.forEach(([x, z], i) => {
    dummy.position.set(x, 0.6, z);
    dummy.updateMatrix();
    postMesh.setMatrixAt(i, dummy.matrix);
  });
  g.add(postMesh);

  const railMat = matLib.get(0x3d352c, 0.9, 0);
  for (const z of [-d / 2, d / 2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.06), railMat);
    rail.position.set(0, 0.85, z);
    g.add(rail);
  }
  for (const x of [-w / 2, w / 2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, d), railMat);
    rail.position.set(x, 0.85, 0);
    g.add(rail);
  }

  const trough = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.65), matLib.get(0x70757a, 0.4, 0.5));
  trough.position.set(0, 0.25, d / 2 - 1.4);
  trough.castShadow = true;
  g.add(trough);

  const water = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.5), matLib.water(0x1d4d6e, 0.75));
  water.position.set(0, 0.42, d / 2 - 1.4);
  g.add(water);

  return g;
}

// ─── MONTAGE DU TROUPEAU ─────────────────────────────────────────────────────
export function mountHerd(parent) {
  if (!parent) return [];

  const stock = [];
  for (const farm of legalFarmsteads()) {
    // ── Paddock vaches ──
    const pad   = farmToWorld(farm.x, farm.z, farm.yaw, 18, -16);
    const padW  = 18, padD = 16;
    const paddock = buildPaddock(padW, padD);
    paddock.position.set(pad.x, getTerrainHeight(pad.x, pad.z), pad.z);
    paddock.rotation.y = farm.yaw;
    parent.add(paddock);

    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 3.8;
      const oz = (i % 2 === 0 ? -2.6 : 2.8);
      const p  = farmToWorld(pad.x, pad.z, farm.yaw, ox, oz);
      const cow = buildHolstein(farm.id.length + i);
      cow.position.set(p.x, getTerrainHeight(p.x, p.z), p.z);
      cow.rotation.y = farm.yaw + i * 0.5;
      parent.add(cow);

      const genetics = generateGenetics('vache');
      stock.push({
        id: farm.id + '_cow_' + i, kind: 'vache', farmId: farm.id,
        name: 'Holstein #' + (i + 1),
        x: p.x, z: p.z, homeX: pad.x, homeZ: pad.z, yaw: farm.yaw + i * 0.5,
        hunger: 0.6 + (i % 3) * 0.15, thirst: 0.8,
        health: 'healthy', healthPoints: 100,
        readyAt: nowSec() + 4 + i * 4, mesh: cow,
        padW, padD, padYaw: farm.yaw,
        gender: 'female', age: 730 + Math.floor(Math.random() * 1000),
        genetics, isPregnant: false, pregnancyDays: 0, gestationDays: 283,
        milkProduction: ANIMAL_CONFIGS.vache.baseMilk * (genetics.quality / 100),
        eggProduction: 0, woolProduction: 0,
        insuranceValue: 2500,
        marketValue: ANIMAL_CONFIGS.vache.marketBaseValue * (genetics.quality / 80),
        temperament: Math.random() < 0.7 ? 'docile' : 'peureux',
      });
    }

    // ── Poulailler ──
    const coopPos = farmToWorld(farm.x, farm.z, farm.yaw, 9, -11);
    const coop    = buildCoop();
    coop.position.set(coopPos.x, getTerrainHeight(coopPos.x, coopPos.z), coopPos.z);
    coop.rotation.y = farm.yaw;
    parent.add(coop);

    stock.push({
      id: farm.id + '_coop', kind: 'poulailler', farmId: farm.id,
      name: 'Poulailler ' + farm.village,
      x: coopPos.x, z: coopPos.z + Math.cos(farm.yaw) * 2.4,
      homeX: coopPos.x, homeZ: coopPos.z, yaw: farm.yaw,
      hunger: 0.7, thirst: 0.8, health: 'healthy', healthPoints: 100,
      readyAt: nowSec() + 6, mesh: coop, padW: 4, padD: 6, padYaw: farm.yaw,
      gender: 'female', age: 180,
      genetics: generateGenetics('poulailler'),
      isPregnant: false, pregnancyDays: 0, gestationDays: 21,
      milkProduction: 0, eggProduction: ANIMAL_CONFIGS.poulailler.baseEggs, woolProduction: 0,
      insuranceValue: 500, marketValue: 75, temperament: 'docile',
    });

    // ── Moutons ──
    const sheepPad = farmToWorld(farm.x, farm.z, farm.yaw, -12, -18);
    for (let i = 0; i < 2; i++) {
      const ox = i * 2.5 - 1.25;
      const p  = farmToWorld(sheepPad.x, sheepPad.z, farm.yaw, ox, 0);
      const sheep = buildSheep(farm.id.length + i);
      sheep.position.set(p.x, getTerrainHeight(p.x, p.z), p.z);
      sheep.rotation.y = farm.yaw + i * 0.8;
      parent.add(sheep);

      stock.push({
        id: farm.id + '_sheep_' + i, kind: 'mouton', farmId: farm.id,
        name: 'Mouton #' + (i + 1),
        x: p.x, z: p.z, homeX: sheepPad.x, homeZ: sheepPad.z, yaw: farm.yaw + i * 0.8,
        hunger: 0.7, thirst: 0.8, health: 'healthy', healthPoints: 100,
        readyAt: nowSec() + 8 + i * 3, mesh: sheep,
        padW: 8, padD: 8, padYaw: farm.yaw,
        gender: i % 2 === 0 ? 'female' : 'male',
        age: 365 + Math.floor(Math.random() * 500),
        genetics: generateGenetics('mouton'),
        isPregnant: false, pregnancyDays: 0, gestationDays: 150,
        milkProduction: ANIMAL_CONFIGS.mouton.baseMilk,
        eggProduction: 0, woolProduction: ANIMAL_CONFIGS.mouton.baseWool,
        insuranceValue: 350, marketValue: ANIMAL_CONFIGS.mouton.marketBaseValue,
        temperament: 'docile',
      });
    }

    // ── Ruche ──
    const hivePos = farmToWorld(farm.x, farm.z, farm.yaw, 15, 8);
    const hive    = buildBeehive();
    hive.position.set(hivePos.x, getTerrainHeight(hivePos.x, hivePos.z), hivePos.z);
    parent.add(hive);

    stock.push({
      id: farm.id + '_hive', kind: 'abeille', farmId: farm.id,
      name: 'Ruche ' + farm.village,
      x: hivePos.x, z: hivePos.z, homeX: hivePos.x, homeZ: hivePos.z, yaw: 0,
      hunger: 0.9, thirst: 0.9, health: 'healthy', healthPoints: 100,
      readyAt: nowSec() + 10, mesh: hive, padW: 2, padD: 2, padYaw: 0,
      gender: 'female', age: 365,
      genetics: generateGenetics('abeille'),
      isPregnant: false, pregnancyDays: 0, gestationDays: 0,
      milkProduction: 0, eggProduction: 0, woolProduction: 0,
      insuranceValue: 200, marketValue: 200, temperament: 'docile',
    });
  }
  return stock;
}

// ─── RECHERCHE ───────────────────────────────────────────────────────────────
export function nearestStock(list, x, z, max = 3.6) {
  if (!Array.isArray(list)) return null;
  let best = null, bestD = max;
  for (const s of list) {
    if (!s) continue;
    const reach = s.kind === 'poulailler' ? 3.8 : 3.0;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < Math.min(bestD, reach)) { best = s; bestD = d; }
  }
  return best;
}

// ─── PROMPTS ─────────────────────────────────────────────────────────────────
export function stockPrompt(s, elapsed, hasFeed) {
  if (!s) return '';
  const now = typeof elapsed === 'number' ? elapsed : nowSec();
  const ready = now >= s.readyAt;

  if (s.health === 'sick') return '⚠ ' + s.name + ' est malade (' + (s.disease || '?') + ')';

  if (s.kind === 'vache') {
    if (ready) return 'E — Traire · ' + s.name + ' (' + (s.milkProduction || 0).toFixed(1) + 'L/j)';
    if (s.hunger < LIVESTOCK_CFG.feedThreshold) return hasFeed ? 'E — Nourrir · foin' : 'Vache affamée · requiert foin';
    return 'Holstein · Montée (' + Math.max(1, Math.ceil(s.readyAt - now)) + 's)';
  }
  if (s.kind === 'poulailler') {
    if (ready) return 'E — Ramasser œufs';
    if (s.hunger < LIVESTOCK_CFG.feedThreshold) return hasFeed ? 'E — Nourrir · grain' : 'Poulailler affamé';
    return 'Ponte (' + Math.max(1, Math.ceil(s.readyAt - now)) + 's)';
  }
  if (s.kind === 'mouton') {
    if (ready) return 'E — Tondre · ' + s.name;
    if (s.hunger < LIVESTOCK_CFG.feedThreshold) return hasFeed ? 'E — Nourrir · foin' : 'Mouton affamé';
    return 'Laine (' + Math.max(1, Math.ceil(s.readyAt - now)) + 's)';
  }
  if (s.kind === 'abeille') {
    if (ready) return 'E — Récolter miel';
    return 'Miel (' + Math.max(1, Math.ceil(s.readyAt - now)) + 's)';
  }
  return s.name || '';
}

// ─── TRAVAIL SUR ANIMAL ──────────────────────────────────────────────────────
export function workStock(s, elapsed, hasHay, hasWheat) {
  if (!s) return { ok: false, notice: 'Animal introuvable.' };
  if (!isValidAnimal(s)) return { ok: false, notice: 'Animal corrompu.' };
  if (s.health === 'sick') return { ok: false, notice: s.name + ' est malade.' };

  const now = typeof elapsed === 'number' ? elapsed : nowSec();
  const feedBonus = s.hunger > 0.6;
  const genBonus  = s.genetics.quality / 100;

  if (s.kind === 'vache') {
    if (now >= s.readyAt) {
      s.readyAt = now + (feedBonus ? 16 : 26);
      s.hunger  = Math.max(0.05, s.hunger - 0.35);
      const yield_n = Math.max(1, Math.floor((feedBonus ? 2 : 1) * genBonus));
      return { ok: true, notice: 'Traite : +' + yield_n + ' bidons', loot: { id: 'lait_rang', n: yield_n } };
    }
    if (s.hunger < LIVESTOCK_CFG.feedThreshold) {
      if (!hasHay) return { ok: false, notice: 'Pas de foin.' };
      s.hunger  = 1.0;
      s.readyAt = Math.min(s.readyAt, now + 6);
      return { ok: true, notice: 'Vache alimentée', consume: 'foin' };
    }
    return { ok: false, notice: 'Pis pas encore plein.' };
  }

  if (s.kind === 'poulailler') {
    if (now >= s.readyAt) {
      s.readyAt = now + (feedBonus ? 12 : 20);
      s.hunger  = Math.max(0.05, s.hunger - 0.25);
      const eggYield = Math.max(1, Math.floor((feedBonus ? 3 : 1) * genBonus));
      return { ok: true, notice: 'Ponte : +' + eggYield + ' œufs', loot: { id: 'oeufs', n: eggYield } };
    }
    if (s.hunger < LIVESTOCK_CFG.feedThreshold) {
      if (!hasWheat) return { ok: false, notice: 'Manque de grain.' };
      s.hunger  = 1.0;
      s.readyAt = Math.min(s.readyAt, now + 4);
      return { ok: true, notice: 'Volailles nourries', consume: 'ble' };
    }
    return { ok: false, notice: 'Aucun œuf.' };
  }

  if (s.kind === 'mouton') {
    if (now >= s.readyAt) {
      s.readyAt = now + 30;
      s.hunger  = Math.max(0.05, s.hunger - 0.2);
      const woolYield = Math.max(1, Math.floor(2 * genBonus));
      return { ok: true, notice: 'Tonte : +' + woolYield + ' kg laine', loot: { id: 'laine', n: woolYield } };
    }
    if (s.hunger < LIVESTOCK_CFG.feedThreshold) {
      if (!hasHay) return { ok: false, notice: 'Pas de foin.' };
      s.hunger = 1.0;
      return { ok: true, notice: 'Mouton nourri', consume: 'foin' };
    }
    return { ok: false, notice: 'Laine pas prête.' };
  }

  if (s.kind === 'abeille') {
    if (now >= s.readyAt) {
      s.readyAt = now + 20;
      const honeyYield = Math.max(1, Math.floor(2 * genBonus));
      return { ok: true, notice: 'Récolte : +' + honeyYield + ' pots miel', loot: { id: 'miel', n: honeyYield } };
    }
    return { ok: false, notice: 'Miel pas prêt.' };
  }

  return { ok: false, notice: 'Action indisponible.' };
}

// ─── SOINS ───────────────────────────────────────────────────────────────────
export function treatAnimal(s, medicine) {
  if (!s) return { ok: false, notice: 'Animal introuvable.' };
  if (s.health !== 'sick') return { ok: false, notice: s.name + ' n\'est pas malade.' };
  if (medicine !== 'medicaments') return { ok: false, notice: 'Médicaments requis.' };
  s.health       = 'healthy';
  s.healthPoints = Math.min(100, s.healthPoints + 30);
  s.disease      = undefined;
  return { ok: true, notice: s.name + ' a été soigné.', consume: 'medicaments' };
}

// ─── MALADIE ─────────────────────────────────────────────────────────────────
export function checkForDisease(s) {
  if (!s || s.health === 'sick' || !s.genetics) return false;
  const applicable = DISEASES.filter(d => d.affects.includes(s.kind));
  if (applicable.length === 0) return false;
  if (Math.random() > 0.005) return false;

  const disease = applicable[Math.floor(Math.random() * applicable.length)];
  if (s.genetics.traits.includes('resistant_maladie') && Math.random() < 0.7) return false;

  s.health        = 'sick';
  s.disease       = disease.name;
  s.healthPoints -= disease.severity * 30;
  return true;
}

// ─── INSÉMINATION ────────────────────────────────────────────────────────────
export function inseminateAnimal(s) {
  if (!s) return { ok: false, notice: 'Animal introuvable.' };
  if (s.gender !== 'female') return { ok: false, notice: 'Seulement les femelles.' };
  if (s.isPregnant)          return { ok: false, notice: s.name + ' est déjà gestante.' };
  if (s.health !== 'healthy')return { ok: false, notice: s.name + ' doit être en santé.' };
  s.isPregnant    = true;
  s.pregnancyDays = 0;
  s.health        = 'pregnant';
  return { ok: true, notice: s.name + ' inséminée. Gestation: ' + s.gestationDays + ' jours.' };
}

// ─── NAISSANCE ───────────────────────────────────────────────────────────────
// ✅ FIX MAJEUR : la version d'origine incrémentait `pregnancyDays += 1/60`
//    à CHAQUE appel. Résultat : la vitesse de gestation dépendait du framerate
//    (60 fps = correct, 30 fps = 2× plus long, 144 fps = 2.4× plus rapide).
//    Maintenant on prend `dt` (secondes écoulées) et on convertit en jours de
//    gestation via LIVESTOCK_CFG.secondsPerGestationDay.
export function checkBirth(s, dt) {
  if (!s || !s.isPregnant) return null;
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return null;

  const daysDelta = dt / Math.max(0.01, LIVESTOCK_CFG.secondsPerGestationDay);
  s.pregnancyDays += daysDelta;

  if (s.pregnancyDays >= s.gestationDays) {
    s.isPregnant    = false;
    s.pregnancyDays = 0;
    s.health        = 'healthy';
    return {
      generation: s.genetics.generation + 1,
      quality:    Math.min(100, s.genetics.quality + Math.random() * 10),
      traits:     [...s.genetics.traits],
      parentId1:  s.id,
      kind:       s.kind,
    };
  }
  return null;
}

// ─── TICK DU TROUPEAU ────────────────────────────────────────────────────────
export function tickHerd(list, dt, elapsed) {
  if (!Array.isArray(list)) return;
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;

  const now = typeof elapsed === 'number' ? elapsed : nowSec();

  for (const s of list) {
    if (!s || !s.mesh) continue;
    if (!isValidAnimal(s)) continue;

    // Besoins
    s.hunger = Math.max(0, s.hunger - dt * LIVESTOCK_CFG.hungerDecayPerSec);
    s.thirst = Math.max(0, s.thirst - dt * LIVESTOCK_CFG.thirstDecayPerSec);

    // Maladie + naissance
    checkForDisease(s);
    checkBirth(s, dt);

    // Mortalité si malade trop longtemps
    if (s.health === 'sick') {
      s.healthPoints -= dt * LIVESTOCK_CFG.sickHealthDrainPerSec;
      if (s.healthPoints <= 0) s.health = 'dead';
    }

    // Animation
    if (s.kind === 'vache' || s.kind === 'mouton' || s.kind === 'cheval') {
      const speedSeed = 0.16 + (s.id.length % 5) * 0.02;
      const phase     = now * speedSeed + s.id.length;
      const ox = Math.cos(phase) * (s.padW * 0.28);
      const oz = Math.sin(phase * 0.85) * (s.padD * 0.28);
      const cosYaw = Math.cos(s.padYaw), sinYaw = Math.sin(s.padYaw);
      const targetX = s.homeX + cosYaw * ox - sinYaw * oz;
      const targetZ = s.homeZ + sinYaw * ox + cosYaw * oz;
      const distMoved = Math.hypot(targetX - s.x, targetZ - s.z);
      s.x = targetX; s.z = targetZ;

      const diffX = s.x - s.mesh.position.x;
      const diffZ = s.z - s.mesh.position.z;
      if (Math.hypot(diffX, diffZ) > LIVESTOCK_CFG.movementThreshold) {
        s.yaw = Math.atan2(-diffX, -diffZ);
      }
      s.mesh.position.set(s.x, getTerrainHeight(s.x, s.z), s.z);
      s.mesh.rotation.y = s.yaw;

      const walkTime = now * 5.0;
      const isMoving = distMoved > dt * 0.1;
      s.mesh.traverse((obj) => {
        if (obj.name.startsWith('leg_')) {
          const isLeft  = obj.name.endsWith('_l');
          const isFront = obj.name.includes('front');
          if (isMoving) {
            const offset = (isLeft ? 0 : Math.PI) + (isFront ? Math.PI * 0.5 : 0);
            obj.rotation.x = Math.sin(walkTime + offset) * 0.45;
          } else {
            obj.rotation.x = 0;
          }
        }
        if (obj.name === 'tail') {
          const swish = Math.sin(now * 1.5 + (s.id.length % 3)) * 0.35;
          obj.rotation.z = swish;
          obj.rotation.x = 0.35 + Math.abs(swish) * 0.2;
        }
        if (obj.name === 'neck_head') {
          const breath  = Math.sin(now * 1.2 + s.id.length) * 0.05;
          const grazing = Math.sin(now * 0.2 + s.id.length) * 0.12 + 0.1;
          obj.rotation.x = grazing + breath;
        }
      });
    } else if (s.kind === 'poulailler') {
      s.mesh.traverse((obj) => {
        if (!obj.userData.hen) return;
        const phase = obj.userData.phase;
        const time  = now * 2.8 + phase;
        const peckCycle = Math.sin(time * 0.6) > 0.3;
        if (peckCycle) obj.rotation.x = 0.5 + Math.sin(time * 6.0) * 0.25;
        else           obj.rotation.x = Math.sin(time * 1.5) * 0.1;
      });
    }
  }
}

// ─── STATS ───────────────────────────────────────────────────────────────────
export function getHerdStats(list) {
  if (!Array.isArray(list)) {
    return {
      totalAnimals: 0, byKind: {},
      healthyCount: 0, sickCount: 0, pregnantCount: 0,
      totalMilkProduction: 0, totalEggProduction: 0,
      averageGeneticQuality: 0, mortalityRate: 0,
    };
  }

  const byKind = { vache: 0, poulailler: 0, mouton: 0, cochon: 0, chevre: 0, cheval: 0, abeille: 0, canard: 0 };
  let healthyCount = 0, sickCount = 0, pregnantCount = 0, deadCount = 0;
  let totalMilk = 0, totalEggs = 0, totalQuality = 0;

  for (const s of list) {
    if (!s) continue;
    byKind[s.kind] = (byKind[s.kind] || 0) + 1;
    if (s.health === 'healthy')  healthyCount++;
    else if (s.health === 'sick') sickCount++;
    else if (s.health === 'dead') deadCount++;
    if (s.isPregnant) pregnantCount++;
    totalMilk    += s.milkProduction || 0;
    totalEggs    += s.eggProduction  || 0;
    totalQuality += (s.genetics && s.genetics.quality) || 0;
  }

  return {
    totalAnimals: list.length,
    byKind,
    healthyCount,
    sickCount,
    pregnantCount,
    deadCount,
    totalMilkProduction: totalMilk,
    totalEggProduction:  totalEggs,
    averageGeneticQuality: list.length > 0 ? totalQuality / list.length : 0,
    mortalityRate: list.length > 0 ? (deadCount / list.length) * 100 : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WRAPPERS D'INTÉGRATION
// ═══════════════════════════════════════════════════════════════════════════
// Ces wrappers permettent à troxt-world-integration.js d'appeler
// tickHerd(dt), checkBirth(), workStock(id, action, playerId) sans avoir à
// gérer lui-même la référence au troupeau monté.

let _mountedHerd = [];
let _mountedRoot = null;

/**
 * Monte le troupeau ET garde une référence pour les wrappers.
 * Si appelé 2×, la version précédente est démontée proprement d'abord.
 *
 * @param {THREE.Object3D} parent
 * @returns {Array} liste des animaux
 */
export function mountHerdAndTrack(parent) {
  // ✅ FIX : on démonte l'ancien troupeau avant de remonter pour éviter
  //    les fuites de mesh (chaque appel à mountHerdAndTrack ajoutait une
  //    nouvelle instance des mêmes vaches dans la scène).
  if (_mountedRoot && _mountedHerd.length > 0) {
    disposeHerd();
  }

  _mountedHerd = mountHerd(parent);
  _mountedRoot = parent;
  return _mountedHerd;
}

/** Démonte le troupeau courant : retire les meshes du parent, libère la réf. */
export function disposeHerd() {
  if (!_mountedRoot) { _mountedHerd = []; return 0; }
  let removed = 0;
  for (const s of _mountedHerd) {
    if (s && s.mesh && s.mesh.parent === _mountedRoot) {
      _mountedRoot.remove(s.mesh);
      s.mesh.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose?.();
      });
      removed++;
    }
  }
  _mountedHerd = [];
  _mountedRoot = null;
  return removed;
}

/**
 * Wrapper : tick du troupeau monté.
 * @param {number} dt  delta time en secondes
 */
export function tickHerdIntegrated(dt) {
  return tickHerd(_mountedHerd, dt, nowSec());
}

/**
 * Wrapper : action sur un animal identifié par son id.
 * @param {string} animalId
 * @param {string} action  'milk' | 'collect' | 'shear' | 'honey' | 'feed' | 'treat'
 * @param {string} playerId
 */
export function workStockIntegrated(animalId, action, playerId) {
  if (!animalId) return { ok: false, notice: 'ID animal requis.' };

  const s = _mountedHerd.find(x => x.id === animalId);
  if (!s) return { ok: false, notice: 'Animal introuvable.' };

  // TODO : brancher ces deux flags sur le vrai inventaire du joueur.
  // Pour l'instant on assume que le joueur a toujours du foin/du blé.
  const hasHay   = true;
  const hasWheat = true;

  const result = workStock(s, nowSec(), hasHay, hasWheat);
  return { ...result, animalId, playerId, action };
}

/**
 * Wrapper : vérifie les naissances sur le troupeau monté.
 * @param {number} dt  delta time en secondes (avant : frame-rate dependent)
 */
export function checkBirthIntegrated(dt) {
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return [];
  const births = [];
  for (const s of _mountedHerd) {
    const b = checkBirth(s, dt);
    if (b) births.push(b);
  }
  return births;
}

/**
 * Accès en lecture à la liste du troupeau monté (utile pour HUD/debug).
 */
export function getMountedHerd() {
  return _mountedHerd;
}

export { SIG };
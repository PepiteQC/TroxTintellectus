/**
 * Utilitaires domestiques du comté — chauffage, eau, Hydro-Québec, pannes.
 * Fichier : client/src/game/utils.js
 */

import * as THREE from "three";
import { matLib } from "./materials";
import { tex } from "./textures";

// ─── CATALOGUES ─────────────────────────────────────────────────────────────

export const HEAT_CATALOG = [
  {
    id: "plinthes",
    label: "Plinthes électriques",
    price: 0,
    valueAdd: 40,
    monthlyHydro: 92,
    monthlyMaint: 4,
    indoorTarget: 21,
    needsHydro: true,
    needsWood: false,
    panneProof: false,
    hint: "Le standard québécois. Hydro-Québec, tarif D.",
  },
  {
    id: "electrique",
    label: "Chauffage électrique",
    price: 160,
    valueAdd: 90,
    monthlyHydro: 82,
    monthlyMaint: 6,
    indoorTarget: 21,
    needsHydro: true,
    needsWood: false,
    panneProof: false,
    hint: "Convecteurs muraux, thermostat digital.",
  },
  {
    id: "thermopompe",
    label: "Thermopompe",
    price: 480,
    valueAdd: 280,
    monthlyHydro: 38,
    monthlyMaint: 14,
    indoorTarget: 22,
    needsHydro: true,
    needsWood: false,
    panneProof: false,
    hint: "Efficace jusqu'à −20 °C. Subvention LogisVert.",
  },
  {
    id: "central",
    label: "Système central",
    price: 640,
    valueAdd: 340,
    monthlyHydro: 58,
    monthlyMaint: 22,
    indoorTarget: 22,
    needsHydro: true,
    needsWood: false,
    panneProof: false,
    hint: "Fournaise + conduits. Confort uniforme.",
  },
  {
    id: "foyer",
    label: "Foyer",
    price: 280,
    valueAdd: 160,
    monthlyHydro: 8,
    monthlyMaint: 10,
    indoorTarget: 19,
    needsHydro: false,
    needsWood: true,
    panneProof: true,
    hint: "Chaleur d'appoint. Tient pendant le verglas.",
  },
  {
    id: "poele",
    label: "Poêle à bois",
    price: 360,
    valueAdd: 210,
    monthlyHydro: 6,
    monthlyMaint: 12,
    indoorTarget: 21,
    needsHydro: false,
    needsWood: true,
    panneProof: true,
    hint: "Rangs et chalets. Indépendant d'Hydro.",
  },
];

export const WATER_CATALOG = [
  {
    id: "municipal",
    label: "Aqueduc municipal",
    monthly: 18,
    needsHydro: false,
    hint: "Ville / MRC. Compteur, taxes d'eau.",
  },
  {
    id: "puits",
    label: "Puits artésien",
    monthly: 4,
    needsHydro: true,
    hint: "Pompe électrique. Gèle si panne et froid.",
  },
];

export const LOGISVERT = 80;
export const WOOD_MAX = 8;
export const BILL_EVERY = 95;
export const FURNACE_REPAIR = 85;
export const PIPE_THAW = 60;
export const WOOD_BURN_EVERY = 72;

const RURAL_TOWNS = new Set([
  "Saint-Casimir",
  "Saint-Alban",
  "Grondines",
  "Saint-Marc",
  "Deschambault",
  "Saint-Thuribe",
  "Saint-Ubalde",
  "Saint-Gilbert",
  "Saint-Raymond",
]);

// ─── HELPERS ────────────────────────────────────────────────────────────────

export function heatById(id) {
  return HEAT_CATALOG.find((h) => h.id === id) ?? HEAT_CATALOG[0];
}

export function waterById(id) {
  return WATER_CATALOG.find((w) => w.id === id) ?? WATER_CATALOG[0];
}

export function defaultHeat(deedId, town = "") {
  if (deedId === "H-SRY") return "poele";
  if (deedId === "H-NVL") return "foyer";
  if (deedId === "H-PTR" || deedId === "H-CPS") return "thermopompe";
  if (deedId === "H-DNC") return "plinthes";
  if (RURAL_TOWNS.has(town)) return "poele";
  return "plinthes";
}

export function defaultWater(town = "") {
  return RURAL_TOWNS.has(town) ? "puits" : "municipal";
}

export function scenicHeat(seed, rural) {
  const r = ((seed * 1103515245 + 12345) >>> 0) / 4294967296;
  if (rural) {
    if (r < 0.52) return "poele";
    if (r < 0.72) return "foyer";
    if (r < 0.88) return "plinthes";
    return "thermopompe";
  }
  if (r < 0.42) return "plinthes";
  if (r < 0.68) return "thermopompe";
  if (r < 0.84) return "electrique";
  return "central";
}

export function emptyUtils(deedId, town = "") {
  const heat = defaultHeat(deedId, town);
  return {
    heat,
    heatOn: true,
    water: defaultWater(town),
    waterOn: true,
    hydroOn: true,
    wood: heatById(heat).needsWood ? 3 : 0,
    billAcc: 0,
    indoorC: 18,
    broke: false,
    frozen: false,
  };
}

export function parseUtils(raw, deedId, town = "") {
  const base = emptyUtils(deedId, town);
  if (!raw || typeof raw !== "object") return base;
  const d = raw;
  const heat = HEAT_CATALOG.some((h) => h.id === d.heat) ? d.heat : base.heat;
  const water = WATER_CATALOG.some((w) => w.id === d.water) ? d.water : base.water;
  const n = (v, f) => (typeof v === "number" && Number.isFinite(v) ? v : f);
  return {
    heat,
    heatOn: typeof d.heatOn === "boolean" ? d.heatOn : true,
    water,
    waterOn: typeof d.waterOn === "boolean" ? d.waterOn : true,
    hydroOn: typeof d.hydroOn === "boolean" ? d.hydroOn : true,
    wood: Math.max(0, Math.min(WOOD_MAX, Math.round(n(d.wood, base.wood)))),
    billAcc: Math.max(0, n(d.billAcc, 0)),
    indoorC: Math.max(-20, Math.min(32, n(d.indoorC, 18))),
    broke: Boolean(d.broke),
    frozen: Boolean(d.frozen),
  };
}

export function heatWorks(u, grid, ambient) {
  if (!u.heatOn) return false;
  const spec = heatById(u.heat);
  if (u.broke && u.heat === "central") return false;
  if (spec.needsWood && u.wood <= 0) return false;
  if (spec.needsHydro) {
    if (!u.hydroOn) return false;
    if (grid) return false;
  }
  if (u.heat === "thermopompe" && ambient <= -22) return false;
  return true;
}

export function hydroLive(u, grid) {
  return u.hydroOn && !grid;
}

export function waterLive(u, grid) {
  if (!u.waterOn || u.frozen) return false;
  const spec = waterById(u.water);
  if (spec.needsHydro && !hydroLive(u, grid)) return false;
  return true;
}

export function indoorTarget(u, grid, ambient) {
  if (!heatWorks(u, grid, ambient)) return Math.min(ambient + 3.5, 12);
  const spec = heatById(u.heat);
  let t = spec.indoorTarget;
  if (u.heat === "thermopompe" && ambient < -16) t -= Math.min(6, (-16 - ambient) * 0.45);
  return t;
}

export function monthlyBill(u, month) {
  const winter = month <= 3 || month >= 11;
  const spec = heatById(u.heat);
  const water = waterById(u.water);
  const hydroMul = winter && spec.needsHydro ? 1.35 : 1;
  const hydro = Math.round(spec.monthlyHydro * hydroMul * (u.heatOn ? 1 : 0.22));
  const eau = water.monthly;
  const maint = spec.monthlyMaint;
  return { hydro, water: eau, maint, total: hydro + eau + maint };
}

export function outageLabel(kind) {
  if (kind === "verglas") return "Verglas · réseau Hydro-Québec hors service";
  if (kind === "panne") return "Panne Hydro-Québec";
  if (kind === "fournaise") return "Fournaise en panne";
  return "Tuyaux gelés";
}

export function heatHint(u, grid, ambient) {
  const spec = heatById(u.heat);
  if (grid && spec.needsHydro) return "Panne · le bois tient encore, pas l'électrique.";
  if (u.broke && u.heat === "central") return "Fournaise à réparer.";
  if (spec.needsWood && u.wood <= 0) return "Plus de bois · corde à la quincaillerie.";
  if (u.heat === "thermopompe" && ambient <= -20) return "Thermopompe à bout sous −20 °C.";
  if (u.frozen) return "Tuyaux gelés · faire dégeler.";
  if (!u.heatOn) return "Chauffage coupé.";
  return spec.hint;
}

// ─── TICK PRINCIPAL ─────────────────────────────────────────────────────────

export function tickHouseUtils(prev, owned, grid, dt, ctx) {
  const houses = {};
  for (const [id, row] of Object.entries(prev)) houses[id] = { ...row };
  let notice = null;
  let debit = 0;
  let label = null;
  let nextGrid = grid;

  if (nextGrid) {
    nextGrid = { ...nextGrid, t: nextGrid.t - dt };
    if (nextGrid.t <= 0) {
      nextGrid = null;
      notice = "Hydro-Québec · réseau rétabli";
    }
  } else {
    const winter = ctx.month <= 3 || ctx.month >= 11;
    if (winter && ctx.weather === "storm" && Math.random() < 0.0038 * dt) {
      nextGrid = { kind: "verglas", t: 48 + Math.random() * 42 };
      notice = outageLabel("verglas");
    } else if (winter && ctx.weather === "snow" && Math.random() < 0.0014 * dt) {
      nextGrid = { kind: "panne", t: 28 + Math.random() * 24 };
      notice = outageLabel("panne");
    }
  }

  for (const id of owned) {
    const cur = houses[id] ?? emptyUtils(id);
    const spec = heatById(cur.heat);
    let wood = cur.wood;
    let broke = cur.broke;
    let frozen = cur.frozen;
    let heatOn = cur.heatOn;
    let billAcc = cur.billAcc + dt;

    if (heatOn && spec.needsWood && wood > 0) {
      const burn = dt / WOOD_BURN_EVERY;
      wood = Math.max(0, wood - burn);
      if (wood <= 0) {
        wood = 0;
        notice = notice ?? "Plus de bois · le poêle s'éteint";
      }
    }

    if (!broke && cur.heat === "central" && (ctx.month <= 3 || ctx.month >= 11) && Math.random() < 0.0009 * dt) {
      broke = true;
      heatOn = false;
      notice = notice ?? outageLabel("fournaise");
    }

    const works = heatWorks({ ...cur, wood, broke, heatOn }, nextGrid, ctx.ambient);
    const target = indoorTarget({ ...cur, wood, broke, heatOn }, nextGrid, ctx.ambient);
    const drift = works ? 0.55 : 0.28;
    let indoorC = cur.indoorC + (target - cur.indoorC) * Math.min(1, dt * drift);
    indoorC = Math.round(indoorC * 10) / 10;

    if (!frozen && indoorC < 2.4 && ctx.ambient < -6 && cur.waterOn) {
      frozen = true;
      notice = notice ?? outageLabel("gel");
    }
    if (frozen && indoorC > 12) frozen = false;

    if (billAcc >= BILL_EVERY) {
      const bill = monthlyBill({ ...cur, heatOn }, ctx.month);
      debit += bill.total;
      billAcc = 0;
      label = `Hydro-Québec ${bill.hydro}\u00a0$ · eau ${bill.water}\u00a0$`;
    }

    houses[id] = {
      ...cur,
      heatOn,
      wood: Math.round(wood * 100) / 100,
      billAcc,
      indoorC,
      broke,
      frozen,
    };
  }

  return { houses, grid: nextGrid, notice, debit, label };
}

// ─── BUILDERS 3D ────────────────────────────────────────────────────────────

function box(w, h, d, x, y, z, color, metal = 0.15, rough = 0.55) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matLib.get(color, rough, metal));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildHeatPump() {
  const g = new THREE.Group();
  g.name = "thermopompe";
  g.add(box(0.92, 0.72, 0.38, 0, 0.42, 0, 0xb8bec4, 0.45, 0.4));
  g.add(box(0.78, 0.52, 0.06, 0, 0.44, 0.2, 0x3a4046, 0.2, 0.7));
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12), matLib.get(0x2a3036, 0.45, 0.35));
  fan.rotation.x = Math.PI / 2;
  fan.position.set(0, 0.44, 0.23);
  g.add(fan);
  g.add(box(0.08, 0.08, 0.55, 0.4, 0.82, -0.12, 0x8a9096, 0.5, 0.35));
  return g;
}

export function buildWoodPile() {
  const g = new THREE.Group();
  g.name = "corde_bois";
  const wood = tex.mat("noyer", 0.6, 0.35, 0.7, 0.05);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.72, 6), wood);
      log.rotation.z = Math.PI / 2;
      log.position.set((i - 2) * 0.16, 0.1 + row * 0.15, (row % 2) * 0.04);
      log.castShadow = true;
      g.add(log);
    }
  }
  g.add(box(0.9, 0.06, 0.4, 0, 0.03, 0, 0x4a3a28, 0, 0.92));
  return g;
}

export function buildWoodStove() {
  const g = new THREE.Group();
  g.name = "poele_bois";
  g.add(box(0.62, 0.55, 0.48, 0, 0.38, 0, 0x2a2420, 0.35, 0.45));
  g.add(box(0.72, 0.06, 0.56, 0, 0.68, 0, 0x1a1614, 0.4, 0.4));
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.28),
    matLib.getEmissive(0xff6a1a, 0xff4a10, 0.7)
  );
  glass.position.set(0, 0.4, 0.25);
  glass.userData.heatFire = true;
  g.add(glass);
  const light = new THREE.PointLight(0xff7a2a, 0.9, 4.2, 2);
  light.position.set(0, 0.45, 0.35);
  light.userData.heatFire = true;
  g.add(light);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.55, 8), matLib.get(0x3a3a3a, 0.4, 0.5));
  pipe.position.set(-0.18, 1.45, 0);
  g.add(pipe);
  return g;
}

export function buildHydroPanel() {
  const g = new THREE.Group();
  g.name = "panneau_hydro";
  g.add(box(0.42, 0.62, 0.1, 0, 1.15, 0, 0x6a6e72, 0.25, 0.5));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), matLib.getEmissive(0x4ade80, 0x22c55e, 0.85));
  led.position.set(0.12, 1.32, 0.06);
  led.userData.hydroLed = true;
  g.add(led);
  g.add(box(0.28, 0.08, 0.04, 0, 0.98, 0.06, 0x1f2937, 0.2, 0.6));
  return g;
}

export function buildWaterHeater() {
  const g = new THREE.Group();
  g.name = "chauffe_eau";
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 1.15, 12), matLib.get(0xc8ccd0, 0.35, 0.45));
  tank.position.y = 0.62;
  tank.castShadow = true;
  g.add(tank);
  g.add(box(0.12, 0.12, 0.12, 0.22, 1.05, 0, 0x3a3e42, 0.4, 0.4));
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), matLib.get(0xb45309, 0.35, 0.55));
  pipe.position.set(-0.18, 1.28, 0);
  g.add(pipe);
  return g;
}

export function buildPlinthRow(length) {
  const g = new THREE.Group();
  g.name = "plinthes";
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, 0.16, 0.08), matLib.get(0xc4c0b8, 0.55, 0.12));
  body.position.set(0, 0.12, 0);
  g.add(body);
  const grill = new THREE.Mesh(new THREE.BoxGeometry(length - 0.08, 0.04, 0.02), matLib.get(0x6a6e68, 0.5, 0.3));
  grill.position.set(0, 0.18, 0.04);
  g.add(grill);
  return g;
}

export function buildFurnace() {
  const g = new THREE.Group();
  g.name = "fournaise";
  g.add(box(0.7, 1.15, 0.55, 0, 0.58, 0, 0x8a9098, 0.3, 0.5));
  g.add(box(0.22, 0.12, 0.08, 0.18, 0.95, 0.28, 0x1f2937, 0.2, 0.55));
  const duct = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.9), matLib.get(0xb8bec4, 0.4, 0.35));
  duct.position.set(0, 1.28, -0.2);
  g.add(duct);
  return g;
}

export function setHeatGlow(root, on) {
  root.traverse((obj) => {
    if (obj.userData.heatFire && obj instanceof THREE.Mesh) {
      const mat = obj.material;
      if (mat.emissive) mat.emissiveIntensity = on ? 0.75 : 0.04;
    }
    if (obj.userData.heatFire && obj instanceof THREE.PointLight) {
      obj.intensity = on ? 0.95 : 0;
    }
    if (obj.userData.hydroLed && obj instanceof THREE.Mesh) {
      const mat = obj.material;
      if (mat.emissive) {
        mat.emissive.setHex(on ? 0x22c55e : 0x991b1b);
        mat.emissiveIntensity = 0.85;
      }
    }
  });
}

export function buildHydroMeter() {
  const g = new THREE.Group();
  g.name = "compteur_hydro";
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.05, 6), matLib.get(0x3a3e42, 0.5, 0.3));
  post.position.y = 0.52;
  g.add(post);
  g.add(box(0.28, 0.36, 0.16, 0, 1.05, 0, 0x6a6e72, 0.3, 0.45));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.03), matLib.getEmissive(0x86efac, 0x22c55e, 0.35));
  glass.position.set(0, 1.08, 0.08);
  g.add(glass);
  return g;
}

export function attachScenicHeat(parent, heat, yaw, side = 5.1, back = 3.4) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const meter = buildHydroMeter();
  meter.position.set(rx * (side * 0.55) - fx * 0.4, 0, rz * (side * 0.55) - fz * 0.4);
  meter.rotation.y = yaw + Math.PI / 2;
  parent.add(meter);
  if (heat === "thermopompe" || heat === "central" || heat === "electrique") {
    const unit = buildHeatPump();
    unit.position.set(rx * side - fx * back * 0.15, 0, rz * side - fz * back * 0.15);
    unit.rotation.y = yaw + Math.PI / 2;
    parent.add(unit);
  }
  if (heat === "poele" || heat === "foyer") {
    const pile = buildWoodPile();
    pile.position.set(-rx * (side * 0.72) - fx * 1.2, 0, -rz * (side * 0.72) - fz * 1.2);
    pile.rotation.y = yaw;
    parent.add(pile);
  }
}
/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/ROADFURNITURE.JS (v3.0 Platinum Edition)
 * Mobilier Routier MTQ, Réseau Électrique Hydro-Québec & Signalisation
 * ═══════════════════════════════════════════════════════════════════
 * Bâtit et injecte les infrastructures routières québécoises :
 *  • Réseau de poteaux de bois et lignes 25 kV Hydro-Québec avec caténaires
 *  • Glissières de sécurité en béton (Jersey) sur l'Autoroute 40
 *  • Garde-fous métalliques le long des rangs et routes régionales
 *  • Lampadaires d'autoroute et d'éclairage public des villages
 *  • Marquages routiers au sol (lignes blanches de rive et doubles jaunes)
 *  • Chevrons de virage et panneaux d'accueil de la MRC de Portneuf
 *
 * Signature : TROXT⬡ · 🛣️MTQInfrastructure
 * Chemin    : client/src/world/RoadFurniture.js
 */

import * as THREE from "three";
import { matLib } from "./materials.js";
import { sampleRoad } from "./roads.js";
import { finishMap } from "./textures.js";
import {
  A40_EXITS,
  getTerrainHeight,
  isNearVillage,
  ROADS,
  VILLAGES,
} from "./worlddata-patch.js";

const SIG = 'TROXT⬡';

// Objets temporaires réutilisables pour le positionnement d'instances (Zéro-GC)
const dummy = new THREE.Object3D();
const _v = new THREE.Vector3();
const _tangent = new THREE.Vector3();

// ─── HELPERS GÉOMÉTRIQUES ROUTIERS ──────────────────────────────────────────

/**
 * Calcule la longueur linéaire cumulée d'une route.
 * @param {object} road 
 * @returns {number}
 */
function roadLen(road) {
  let len = 0;
  for (let i = 1; i < road.points.length; i++) {
    len += Math.hypot(
      road.points[i][0] - road.points[i - 1][0],
      road.points[i][1] - road.points[i - 1][1]
    );
  }
  return len;
}

/**
 * Génère un ruban géométrique extrudé (marquages, fossés, glissières).
 * @param {object} road 
 * @param {number} divisions 
 * @param {number} width 
 * @param {number} color 
 * @param {number} yExtra 
 * @param {number} offset 
 * @param {boolean} [basic=false] 
 * @returns {THREE.Mesh}
 */
function ribbon(road, divisions, width, color, yExtra, offset, basic = false) {
  const pts = road.points.map(([x, z]) => new THREE.Vector3(x, getTerrainHeight(x, z) + yExtra, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const samples = curve.getPoints(divisions);
  const hw = width / 2;

  const positions = [];
  const uvs = [];
  const indices = [];
  let total = 0;
  const segs = [0];

  for (let i = 1; i < samples.length; i++) {
    total += samples[i].distanceTo(samples[i - 1]);
    segs.push(total);
  }

  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i];
    const next = i < samples.length - 1 ? samples[i + 1] : samples[i - 1];
    const prev = i > 0 ? samples[i - 1] : samples[i + 1];
    
    _tangent.subVectors(next, prev).normalize();
    const nx = -_tangent.z;
    const nz = _tangent.x;
    const ox = nx * offset;
    const oz = nz * offset;
    const u = total > 0 ? segs[i] / total : 0;

    positions.push(
      pt.x + ox - nx * hw,
      pt.y,
      pt.z + oz - nz * hw,
      pt.x + ox + nx * hw,
      pt.y,
      pt.z + oz + nz * hw
    );

    const v = u * (total / Math.max(1, width));
    uvs.push(0, v, 1, v);

    if (i < samples.length - 1) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = basic
    ? new THREE.MeshBasicMaterial({
        color,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        toneMapped: false,
      })
    : matLib.get(color, 0.98);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = !basic;
  mesh.frustumCulled = true;
  return mesh;
}

function nearExit(x, radius) {
  return A40_EXITS.some((ex) => Math.abs(x - ex.x) < radius);
}

// ─── GÉNÉRATION DES TEXTURES DE SIGNALISATION CANVAS (sRGB) ─────────────────

function canvasTex(draw, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return finishMap(tex, "clamp");
}

const nameTexCache = new Map();

function villageTex(name) {
  let tex = nameTexCache.get(name);
  if (tex) return tex;

  tex = canvasTex(
    (ctx, w, h) => {
      // Fond vert officiel MTQ
      ctx.fillStyle = "#1c5f32";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#f8fbf2";
      ctx.lineWidth = 10;
      ctx.strokeRect(12, 12, w - 24, h - 24);
      ctx.fillStyle = "#f8fbf2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 28px Outfit, Arial, sans-serif";
      ctx.fillText("BIENVENUE", w / 2, 58);
      ctx.font = `bold ${name.length > 18 ? 32 : 46}px Outfit, Arial, sans-serif`;
      ctx.fillText(name, w / 2, 128);
      ctx.font = "bold 22px Outfit, Arial, sans-serif";
      ctx.fillText("MRC de Portneuf", w / 2, 196);
    },
    512,
    256
  );

  nameTexCache.set(name, tex);
  return tex;
}

let chevronTex = null;

function getChevronTex() {
  if (chevronTex) return chevronTex;

  chevronTex = canvasTex(
    (ctx, w, h) => {
      ctx.fillStyle = "#e8a51a"; // Jaune de sécurité
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#1a1a1a";

      const drawChev = (ox) => {
        ctx.beginPath();
        ctx.moveTo(ox + 18, 28);
        ctx.lineTo(ox + 78, h / 2);
        ctx.lineTo(ox + 18, h - 28);
        ctx.lineTo(ox + 38, h - 28);
        ctx.lineTo(ox + 98, h / 2);
        ctx.lineTo(ox + 38, 28);
        ctx.closePath();
        ctx.fill();
      };

      drawChev(16);
      drawChev(92);
    },
    256,
    160
  );
  return chevronTex;
}

// ─── MARQUAGES AU SOL & ACCOTEMENTS ──────────────────────────────────────────

function addEdgeLines(parent) {
  for (const road of ROADS) {
    if (road.kind === "gravel" || road.kind === "ramp") continue;
    const edge = Math.max(2.4, road.width / 2 - 0.28);
    const div = road.kind === "highway" ? 48 : 28;

    // Lignes blanches de rive
    parent.add(ribbon(road, div, 0.16, 0xf4f3e9, 0.085, -edge, true));
    parent.add(ribbon(road, div, 0.16, 0xf4f3e9, 0.085, edge, true));

    // Lignes axiales
    if (road.kind === "highway") {
      parent.add(ribbon(road, div, 0.18, 0xe3b72d, 0.085, -3.7, true));
      parent.add(ribbon(road, div, 0.18, 0xe3b72d, 0.085, 3.7, true));
    } else if (road.kind === "regional") {
      parent.add(ribbon(road, div, 0.12, 0xe3b72d, 0.085, -0.2, true));
      parent.add(ribbon(road, div, 0.12, 0xe3b72d, 0.085, 0.2, true));
    }
  }
}

function addShoulders(parent) {
  const mains = ROADS.filter(
    (r) => r.id === "r138" || r.id === "a40" || r.id === "r363" || r.id === "r365"
  );
  for (const road of mains) {
    const hw = road.width / 2;
    const ditchOff = hw + 3.1;
    const grassOff = hw + 7.4;
    const div = road.kind === "highway" ? 40 : 24;
    for (const side of [-1, 1]) {
      parent.add(ribbon(road, div, 3.6, 0x3a3020, -0.18, side * ditchOff));
      parent.add(ribbon(road, div, 8.5, 0x4a6234, -0.04, side * grassOff));
    }
  }
}

// ─── GLISSIÈRES DE SÉCURITÉ EN BÉTON (JERSEY SUR A-40) ────────────────────────

function addJersey(parent) {
  const road = ROADS.find((r) => r.id === "a40");
  if (!road) return;

  const len = roadLen(road);
  const spacing = 3.1;
  const count = Math.min(420, Math.floor(len / spacing));

  const geo = new THREE.BoxGeometry(0.38, 0.92, 3.0);
  const mat = matLib.get(0xc8c8c8, 0.55, 0.22);
  const mesh = new THREE.InstancedMesh(geo, mat, count * 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  let n = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const s = sampleRoad(road, t);
      if (nearExit(s.x, 38)) continue;

      const nx = -s.tz;
      const nz = s.tx;
      const x = s.x + nx * side * 9.15;
      const z = s.z + nz * side * 9.15;

      dummy.position.set(x, getTerrainHeight(x, z) + 0.46, z);
      dummy.rotation.set(0, Math.atan2(s.tx, s.tz), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      mesh.setMatrixAt(n++, dummy.matrix);
    }
  }

  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
}

function addGuardRails(parent) {
  const rural = ROADS.filter((r) => r.kind === "rural" || r.kind === "ramp");
  const postGeo = new THREE.BoxGeometry(0.08, 0.85, 0.08);
  const postMat = matLib.get(0x888888, 0.6, 0.4);
  const posts = [];

  for (const road of rural) {
    const len = roadLen(road);
    if (len < 40) continue;

    const spacing = road.kind === "ramp" ? 4.2 : 5.5;
    const count = Math.min(80, Math.floor(len / spacing));
    const off = road.width / 2 + 0.55;

    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const s = sampleRoad(road, t);
      if (isNearVillage(s.x, s.z, 55)) continue;

      const nx = -s.tz;
      const nz = s.tx;
      const yaw = Math.atan2(s.tx, s.tz);

      const sides = road.kind === "ramp" ? [-1, 1] : (s.z < -280 ? [-1, 1] : [s.z > 0 ? 1 : -1]);
      for (const side of sides) {
        const x = s.x + nx * side * off;
        const z = s.z + nz * side * off;
        posts.push({ x, y: getTerrainHeight(x, z) + 0.42, z, yaw });
      }
    }

    parent.add(ribbon(road, 28, 0.07, 0xaaaaaa, 0.72, off));
    parent.add(ribbon(road, 28, 0.07, 0xaaaaaa, 0.72, -off));
  }

  if (posts.length === 0) return;

  const mesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  mesh.castShadow = true;

  posts.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
}

// ─── RÉSEAU HYDRO-QUÉBEC (POTEAUX & CÂBLES SUSPENDUS) ───────────────────────

function hydroSpots(road, count, lateral, skipVillage = true) {
  const spots = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const s = sampleRoad(road, t);
    if (skipVillage && isNearVillage(s.x, s.z, 70)) continue;

    const nx = -s.tz;
    const nz = s.tx;
    const x = s.x + nx * lateral;
    const z = s.z + nz * lateral;

    spots.push({
      x,
      y: getTerrainHeight(x, z),
      z,
      yaw: Math.atan2(s.tx, s.tz),
      nx,
      nz,
    });
  }
  return spots;
}

function addCatenary(parent, spots) {
  if (spots.length < 2) return;

  const offsets = [-2.4, 0, 2.4, -1.7, 0, 1.7];
  const ys = [9.4, 9.4, 9.4, 8.0, 8.0, 8.0];
  const sag = 0.55;
  const steps = 10;
  const positions = [];

  for (let i = 0; i < spots.length - 1; i++) {
    const a = spots[i];
    const b = spots[i + 1];
    const lxa = Math.cos(a.yaw);
    const lza = -Math.sin(a.yaw);
    const lxb = Math.cos(b.yaw);
    const lzb = -Math.sin(b.yaw);

    for (let w = 0; w < 6; w++) {
      const ax = a.x + lxa * offsets[w];
      const ay = a.y + ys[w];
      const az = a.z + lza * offsets[w];
      const bx = b.x + lxb * offsets[w];
      const by = b.y + ys[w];
      const bz = b.z + lzb * offsets[w];

      let px = ax;
      let py = ay;
      let pz = az;

      for (let t = 1; t <= steps; t++) {
        const u = t / steps;
        const x = ax + (bx - ax) * u;
        const y = ay + (by - ay) * u - Math.sin(u * Math.PI) * sag;
        const z = az + (bz - az) * u;

        positions.push(px, py, pz, x, y, z);
        px = x;
        py = y;
        pz = z;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x181818 }));
  line.frustumCulled = true;
  parent.add(line);
}

function addHydroNetwork(parent) {
  const wood = matLib.get(0x6a5540, 0.95);
  const woodDark = matLib.get(0x7a6050, 0.9);
  const porcelain = matLib.get(0xc0d0e0, 0.5, 0.1);

  const poleGeo = new THREE.CylinderGeometry(0.08, 0.14, 10, 8);
  const armGeo = new THREE.BoxGeometry(5.0, 0.14, 0.14);
  const arm2Geo = new THREE.BoxGeometry(3.5, 0.12, 0.12);
  const insGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6);

  const groups = [];
  const r138 = ROADS.find((r) => r.id === "r138");
  if (r138) groups.push(hydroSpots(r138, 32, 8.4, false));

  const extraRoads = ROADS.filter(
    (r) => r.id === "r363" || r.id === "r365" || r.id === "r358" || r.id === "r354"
  );
  for (const road of extraRoads) {
    groups.push(hydroSpots(road, Math.max(8, Math.floor(roadLen(road) / 58)), 8.6));
  }

  const extraSpots = groups.slice(1).flat();
  const r138Spots = groups[0] ?? [];
  const armSpots = [...r138Spots, ...extraSpots];

  if (extraSpots.length > 0) {
    const poles = new THREE.InstancedMesh(poleGeo, wood, extraSpots.length);
    poles.castShadow = true;
    extraSpots.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 5, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
    });
    poles.instanceMatrix.needsUpdate = true;
    poles.computeBoundingSphere();
    parent.add(poles);
  }

  if (armSpots.length > 0) {
    const arms = new THREE.InstancedMesh(armGeo, woodDark, armSpots.length);
    const arms2 = new THREE.InstancedMesh(arm2Geo, woodDark, armSpots.length);
    armSpots.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 9.2, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      arms.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, p.y + 7.8, p.z);
      dummy.updateMatrix();
      arms2.setMatrixAt(i, dummy.matrix);
    });
    arms.instanceMatrix.needsUpdate = true;
    arms2.instanceMatrix.needsUpdate = true;
    arms.computeBoundingSphere();
    parent.add(arms, arms2);
  }

  const insOffUpper = [-2.4, 0, 2.4];
  const insOffLower = [-1.7, 0, 1.7];
  const insulators = new THREE.InstancedMesh(insGeo, porcelain, armSpots.length * 6);
  let n = 0;

  for (const p of armSpots) {
    const lx = Math.cos(p.yaw);
    const lz = -Math.sin(p.yaw);
    for (const o of insOffUpper) {
      dummy.position.set(p.x + lx * o, p.y + 9.35, p.z + lz * o);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      insulators.setMatrixAt(n++, dummy.matrix);
    }
    for (const o of insOffLower) {
      dummy.position.set(p.x + lx * o, p.y + 7.95, p.z + lz * o);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      insulators.setMatrixAt(n++, dummy.matrix);
    }
  }

  insulators.count = n;
  insulators.instanceMatrix.needsUpdate = true;
  insulators.computeBoundingSphere();
  parent.add(insulators);

  for (const spots of groups) addCatenary(parent, spots);
}

// ─── ÉCLAIRAGE ROUTIER (AUTOROUTE & VILLAGES) ────────────────────────────────

function addHighwayLamps(parent) {
  const road = ROADS.find((r) => r.id === "a40");
  if (!road) return;

  const len = roadLen(road);
  const planned = Math.min(48, Math.floor(len / 58));

  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 9, 8);
  const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6);
  armGeo.rotateZ(Math.PI / 2);
  const fixGeo = new THREE.BoxGeometry(0.8, 0.18, 0.36);
  const glowGeo = new THREE.SphereGeometry(0.22, 8, 6);

  const metal = matLib.get(0x667080, 0.7, 0.4);
  const glow = matLib.getEmissive(0xffd090, 0xffd090, 0.05);

  const poles = new THREE.InstancedMesh(poleGeo, metal, planned);
  const arms = new THREE.InstancedMesh(armGeo, metal, planned);
  const fixtures = new THREE.InstancedMesh(fixGeo, metal, planned);
  const bulbs = new THREE.InstancedMesh(glowGeo, glow, planned);

  poles.castShadow = true;
  bulbs.userData.isStreetlight = true;

  let n = 0;
  for (let i = 0; i < planned; i++) {
    const t = i / (planned - 1);
    const s = sampleRoad(road, t);
    if (nearExit(s.x, 42)) continue;

    const side = i % 2 === 0 ? -1 : 1;
    const nx = -s.tz;
    const nz = s.tx;
    const x = s.x + nx * side * 10.2;
    const z = s.z + nz * side * 10.2;
    const y = getTerrainHeight(x, z);
    const yaw = Math.atan2(s.tx, s.tz);

    dummy.position.set(x, y + 4.5, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(n, dummy.matrix);

    dummy.position.set(x - nx * side * 1.25, y + 9, z - nz * side * 1.25);
    dummy.updateMatrix();
    arms.setMatrixAt(n, dummy.matrix);

    dummy.position.set(x - nx * side * 2.5, y + 9, z - nz * side * 2.5);
    dummy.updateMatrix();
    fixtures.setMatrixAt(n, dummy.matrix);

    dummy.position.set(x - nx * side * 2.5, y + 8.85, z - nz * side * 2.5);
    dummy.updateMatrix();
    bulbs.setMatrixAt(n, dummy.matrix);
    n++;
  }

  poles.count = n;
  arms.count = n;
  fixtures.count = n;
  bulbs.count = n;

  poles.instanceMatrix.needsUpdate = true;
  arms.instanceMatrix.needsUpdate = true;
  fixtures.instanceMatrix.needsUpdate = true;
  bulbs.instanceMatrix.needsUpdate = true;

  poles.computeBoundingSphere();
  bulbs.computeBoundingSphere();
  parent.add(poles, arms, fixtures, bulbs);
}

function addVillageLamps(parent) {
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6);
  const armGeo = new THREE.BoxGeometry(1.1, 0.07, 0.07);
  const glowGeo = new THREE.SphereGeometry(0.16, 8, 8);

  const metal = matLib.get(0x556677, 0.7, 0.4);
  const glow = matLib.getEmissive(0xffd090, 0xffd090, 0.05);

  const spots = [];
  for (const v of VILLAGES) {
    const [cx, cz] = v.center;
    const ang = v.roadAngle;
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    const perpX = -dirZ;
    const perpZ = dirX;
    const n = Math.min(10, 4 + Math.floor(v.houseCount / 3));

    for (let i = 0; i < n; i++) {
      const along = (i - (n - 1) / 2) * 18;
      const side = i % 2 === 0 ? 1 : -1;
      const x = cx + dirX * along + perpX * side * 6.1;
      const z = cz + dirZ * along + perpZ * side * 6.1;
      spots.push({ x, y: getTerrainHeight(x, z), z, nx: perpX * side, nz: perpZ * side });
    }
  }

  const poles = new THREE.InstancedMesh(poleGeo, metal, spots.length);
  const arms = new THREE.InstancedMesh(armGeo, metal, spots.length);
  const bulbs = new THREE.InstancedMesh(glowGeo, glow, spots.length);

  poles.castShadow = true;
  bulbs.userData.isStreetlight = true;

  spots.forEach((p, i) => {
    dummy.position.set(p.x, p.y + 2.1, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p.x - p.nx * 0.55, p.y + 4.05, p.z - p.nz * 0.55);
    dummy.rotation.set(0, Math.atan2(-p.nx, -p.nz), 0);
    dummy.updateMatrix();
    arms.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p.x - p.nx * 1.1, p.y + 4.0, p.z - p.nz * 1.1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
  });

  poles.instanceMatrix.needsUpdate = true;
  arms.instanceMatrix.needsUpdate = true;
  bulbs.instanceMatrix.needsUpdate = true;
  poles.computeBoundingSphere();
  parent.add(poles, arms, bulbs);
}

// ─── CHEVRONS & SIGNALISATION DE VIRAGE ───────────────────────────────────────

export function buildChevron() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 2.4, 8), matLib.get(0x777a7b, 0.6, 0.45));
  post.position.y = 1.2;
  post.castShadow = true;
  g.add(post);

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 0.85),
    new THREE.MeshLambertMaterial({ map: getChevronTex(), side: THREE.DoubleSide })
  );
  plate.position.set(0, 2.35, 0.04);
  g.add(plate);
  return g;
}

function addChevrons(parent) {
  const roads = ROADS.filter((r) => r.kind === "rural" || r.kind === "regional");
  for (const road of roads) {
    const pts = road.points;
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const next = pts[i + 1];

      const bdx = curr[0] - prev[0];
      const bdz = curr[1] - prev[1];
      const adx = next[0] - curr[0];
      const adz = next[1] - curr[1];

      const bl = Math.hypot(bdx, bdz) || 1;
      const al = Math.hypot(adx, adz) || 1;
      const dot = (bdx / bl) * (adx / al) + (bdz / bl) * (adz / al);
      const bend = Math.acos(Math.min(1, Math.max(-1, dot)));
      if (bend < 0.14) continue;

      const tx = adx / al;
      const tz = adz / al;
      const nx = -tz;
      const nz = tx;
      const cross = bdx * adz - bdz * adx;
      const side = cross > 0 ? 1 : -1;
      const off = road.width / 2 + 1.55;
      const repeats = bend > 0.35 ? 3 : bend > 0.22 ? 2 : 1;

      for (let k = 0; k < repeats; k++) {
        const along = (k - (repeats - 1) / 2) * 7;
        const x = curr[0] + tx * along + nx * side * off;
        const z = curr[1] + tz * along + nz * side * off;
        const chev = buildChevron();
        chev.position.set(x, getTerrainHeight(x, z), z);
        chev.rotation.y = Math.atan2(tx, tz);
        parent.add(chev);
      }
    }
  }
}

// ─── PANNEAUX DE MUNICIPALITÉ (MRC DE PORTNEUF) ──────────────────────────────

export function buildNameSign(name) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 2.9, 8), matLib.get(0x777a7b, 0.6, 0.45));
  post.position.y = 1.45;
  post.castShadow = true;
  g.add(post);

  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.25, 0.08), matLib.get(0x1c5f32, 0.75));
  board.position.y = 2.85;
  g.add(board);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(3.04, 1.08),
    new THREE.MeshLambertMaterial({ map: villageTex(name), side: THREE.DoubleSide })
  );
  face.position.set(0, 2.85, 0.05);
  g.add(face);
  return g;
}

function addVillageSigns(parent) {
  for (const v of VILLAGES) {
    const [cx, cz] = v.center;
    const ang = v.roadAngle;
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    const perpX = -dirZ;
    const perpZ = dirX;
    const dist = v.coreRadius + 16;

    for (const dir of [-1, 1]) {
      const x = cx + dirX * dir * dist + perpX * 6.4;
      const z = cz + dirZ * dir * dist + perpZ * 6.4;
      const sign = buildNameSign(v.name);
      sign.position.set(x, getTerrainHeight(x, z), z);
      sign.rotation.y = -ang + Math.PI / 2 + (dir < 0 ? Math.PI : 0);
      parent.add(sign);
    }
  }
}

// ─── PILOTAGE DE L'ÉCLAIRAGE JOUR / NUIT ──────────────────────────────────────

/**
 * Allume ou éteint les lampadaires du réseau routier selon le cycle jour/nuit.
 * @param {THREE.Group} parent 
 * @param {boolean} isNight 
 */
export function setRoadLighting(parent, isNight) {
  parent.traverse((obj) => {
    if (obj.userData?.isStreetlight && obj.isInstancedMesh) {
      const mat = obj.material;
      if (mat?.emissive) {
        mat.emissiveIntensity = isNight ? 1.4 : 0.05;
      }
    }
  });
}

// ─── EXPORT PRINCIPAL D'ASSEMBLAGE ──────────────────────────────────────────

/**
 * Bâtit et greffe l'intégralité du mobilier routier au groupe parent.
 * @param {THREE.Group} parent 
 */
export function buildRoadFurniture(parent) {
  addEdgeLines(parent);
  addShoulders(parent);
  addJersey(parent);
  addGuardRails(parent);
  addHydroNetwork(parent);
  addHighwayLamps(parent);
  addVillageLamps(parent);
  addChevrons(parent);
  addVillageSigns(parent);
  console.log(`[${SIG}·RoadFurniture] Mobilier routier MTQ & Hydro-Québec injecté avec succès.`);
}

export default buildRoadFurniture;
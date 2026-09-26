/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/PRISON/PRISONCOMPLEX.JS (v3.0 Platinum Edition)
 * Pénitencier de Portneuf — Construction Tridimensionnelle & Matériaux
 * ═══════════════════════════════════════════════════════════════════════════════
 * Structure :
 *   · Bâtiment administratif central avec sas d'entrée (mantrap)
 *   · 4 blocs cellulaires A/B/C/D — 2 étages × 10 cellules = 80 cellules
 *   · Cantine, gymnase, douches, salle de contrôle
 *   · Cour de promenade avec terrain de basket
 *   · Double clôture barbelée + razorwire
 *   · 4 tours de garde avec projecteur rotatif
 *
 * Signature : TROXT⬡ · ⛓️DonnaconaBuilder
 * Chemin    : client/src/world/prison/PrisonComplex.js
 */

import * as THREE from 'three';

const SIG = 'TROXT⬡';

// ─── PALETTE ET GRAPHISMES (FROZEN) ──────────────────────────────────────────
export const PRISON_PALETTE = Object.freeze({
  betonMur:      0x9a9691,
  betonSol:      0x6e6b66,
  betonSombre:   0x54514d,
  acierBarreau:  0x3e4247,
  acierPorte:    0x4a4f55,
  acierClair:    0x7a8088,
  grillage:      0x6a6e72,
  barbele:       0xb0b4b8,
  neonJaune:     0xffd88a,
  neonBlanc:     0xf0f4ff,
  projecteur:    0xfff4d0,
  peintureBleue: 0x2f4f6f,
  peintureVerte: 0x3a5a48,
  matelas:       0x5a6470,
  inox:          0xa8adb4,
  asphalteCour:  0x44474a,
  ligneCour:     0xd8d4c0,
  drapeau:       0x1e4d8f,
});

const P = PRISON_PALETTE;

// ─── DIMENSIONS DU COMPLEXE (FROZEN) ─────────────────────────────────────────
export const PRISON_DIMS = Object.freeze({
  // Cellule
  cellWidth:      2.6,
  cellDepth:      3.4,
  cellHeight:     2.8,
  cellsPerFloor:  10,
  floorsPerBlock: 2,

  // Bloc cellulaire
  corridorWidth:      3.2,
  blockWallThickness: 0.4,

  // Complexe
  yardSize:    60,
  fenceHeight: 5.5,
  fenceGap:    6,
  towerHeight: 11,

  // Bâtiment central
  adminWidth:  34,
  adminDepth:  18,
  adminHeight: 7,
});

const D = PRISON_DIMS;

// ─── GESTION SÉCURISÉE DES MATÉRIAUX ET GÉOMÉTRIES (POOLS) ────────────────────

class PrisonMaterials {
  constructor() {
    this.cache = new Map();
  }

  get(color, roughness = 0.9, metalness = 0, flat = true) {
    const key = `${color}_${roughness}_${metalness}_${flat}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: flat });
    this.cache.set(key, m);
    return m;
  }

  emissive(color, emissive, intensity) {
    const key = `em_${color}_${emissive}_${intensity}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: intensity, roughness: 0.4,
    });
    this.cache.set(key, m);
    return m;
  }

  dispose() {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
  }
}

export const prisonMat = new PrisonMaterials();

// Pool des géométries partagées (Évite l'allocation redondante au GPU)
const _geometryCache = new Map();
function getSharedGeometry(key, builder) {
  if (_geometryCache.has(key)) return _geometryCache.get(key);
  const geo = builder();
  _geometryCache.set(key, geo);
  return geo;
}

// Pool des textures procédurales générées par Canvas
const _textureCache = new Map();
function getProceduralTexture(key, builder) {
  if (_textureCache.has(key)) return _textureCache.get(key);
  const tex = builder();
  _textureCache.set(key, tex);
  return tex;
}

// ─── GENERATEURS DE TEXTURES ─────────────────────────────────────────────────

function getSignTexture() {
  return getProceduralTexture('sign', () => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1a2430";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(0, 0, 512, 8);
    ctx.fillRect(0, 120, 512, 8);
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("ÉTABLISSEMENT DE DONNACONA", 256, 56);
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#9aa4b0";
    ctx.fillText("SERVICE CORRECTIONNEL DU CANADA · MAX-SÉCURITÉ", 256, 90);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function getFenceTexture(length, height) {
  const key = `fence_${length}_${height}`;
  return getProceduralTexture(key, () => {
    const meshCanvas = document.createElement('canvas');
    meshCanvas.width = meshCanvas.height = 64;
    const ctx = meshCanvas.getContext('2d');
    ctx.strokeStyle = 'rgba(150,155,160,0.95)';
    ctx.lineWidth = 2.5;
    for (let i = -64; i < 128; i += 10) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 64); ctx.lineTo(i + 64, 0); ctx.stroke();
    }
    const meshTex = new THREE.CanvasTexture(meshCanvas);
    meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
    meshTex.repeat.set(length / 1.5, height / 1.5);
    return meshTex;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  ÉLÉMENTS DE BASE DE STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

function buildCellDoor() {
  const g = new THREE.Group();
  const barMat = prisonMat.get(P.acierBarreau, 0.6, 0.7);
  const frameMat = prisonMat.get(P.acierPorte, 0.55, 0.75);

  const w = D.cellWidth * 0.78;
  const h = 2.2;

  const frameTop = new THREE.Mesh(getSharedGeometry('frame_t', () => new THREE.BoxGeometry(w + 0.2, 0.12, 0.16)), frameMat);
  frameTop.position.y = h;
  g.add(frameTop);

  const frameBot = new THREE.Mesh(getSharedGeometry('frame_b', () => new THREE.BoxGeometry(w + 0.2, 0.1, 0.16)), frameMat);
  frameBot.position.y = 0.05;
  g.add(frameBot);

  const barCount = 9;
  const barGeo = getSharedGeometry('bar_cylinder', () => new THREE.CylinderGeometry(0.032, 0.032, h, 6));
  const barInst = new THREE.InstancedMesh(barGeo, barMat, barCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < barCount; i++) {
    dummy.position.set(-w / 2 + (i / (barCount - 1)) * w, h / 2, 0);
    dummy.updateMatrix();
    barInst.setMatrixAt(i, dummy.matrix);
  }
  barInst.instanceMatrix.needsUpdate = true;
  barInst.castShadow = true;
  g.add(barInst);

  for (const y of [h * 0.35, h * 0.72]) {
    const cross = new THREE.Mesh(getSharedGeometry(`cross_${y}`, () => new THREE.BoxGeometry(w, 0.06, 0.06)), barMat);
    cross.position.y = y;
    g.add(cross);
  }

  const lockHousing = new THREE.Mesh(getSharedGeometry('lock_box', () => new THREE.BoxGeometry(0.22, 0.3, 0.14)), frameMat);
  lockHousing.position.set(w / 2 - 0.1, h * 0.5, 0.1);
  g.add(lockHousing);

  const lockLight = new THREE.Mesh(
    getSharedGeometry('lock_led', () => new THREE.SphereGeometry(0.045, 8, 6)),
    prisonMat.emissive(0xff3020, 0xff2010, 1.4)
  );
  lockLight.position.set(w / 2 - 0.1, h * 0.5 + 0.1, 0.18);
  lockLight.userData.isLockIndicator = true;
  g.add(lockLight);

  g.userData.isCellDoor = true;
  g.userData.lockLight = lockLight;
  return g;
}

function buildCellFurniture() {
  const g = new THREE.Group();
  const steelMat = prisonMat.get(P.inox, 0.35, 0.85);
  const mattressMat = prisonMat.get(P.matelas, 0.95);
  const concreteMat = prisonMat.get(P.betonSombre, 0.95);

  for (const [y] of [[0.42], [1.42]]) {
    const frame = new THREE.Mesh(getSharedGeometry(`bed_frame_${y}`, () => new THREE.BoxGeometry(0.78, 0.08, 1.95)), steelMat);
    frame.position.set(-D.cellWidth / 2 + 0.5, y, -0.4);
    frame.castShadow = true;
    g.add(frame);

    const mattress = new THREE.Mesh(getSharedGeometry(`mattress_${y}`, () => new THREE.BoxGeometry(0.72, 0.14, 1.85)), mattressMat);
    mattress.position.set(-D.cellWidth / 2 + 0.5, y + 0.11, -0.4);
    g.add(mattress);
  }

  // Toilette inox
  const combo = new THREE.Group();
  const bowl = new THREE.Mesh(getSharedGeometry('toilet_bowl', () => new THREE.CylinderGeometry(0.19, 0.16, 0.42, 12)), steelMat);
  bowl.position.y = 0.21;
  combo.add(bowl);

  const seat = new THREE.Mesh(getSharedGeometry('toilet_seat', () => new THREE.TorusGeometry(0.19, 0.035, 6, 14)), steelMat);
  seat.rotation.x = -Math.PI / 2;
  seat.position.y = 0.43;
  combo.add(seat);

  combo.position.set(D.cellWidth / 2 - 0.42, 0, -D.cellDepth / 2 + 0.45);
  g.add(combo);

  return g;
}

function buildCell(desc) {
  const g = new THREE.Group();
  g.name = `cell_${desc.id}`;

  const wallMat = prisonMat.get(P.betonMur, 0.95);
  const floorMat = prisonMat.get(P.betonSol, 0.96);

  const w = D.cellWidth, d = D.cellDepth, h = D.cellHeight;

  const floor = new THREE.Mesh(getSharedGeometry('cell_floor', () => new THREE.BoxGeometry(w, 0.12, d)), floorMat);
  floor.position.y = -0.06;
  floor.receiveShadow = true;
  g.add(floor);

  const backWall = new THREE.Mesh(getSharedGeometry('cell_back_wall', () => new THREE.BoxGeometry(w, h, 0.18)), wallMat);
  backWall.position.set(0, h / 2, -d / 2);
  g.add(backWall);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(getSharedGeometry(`cell_side_wall_${side}`, () => new THREE.BoxGeometry(0.18, h, d)), wallMat);
    wall.position.set(side * w / 2, h / 2, 0);
    g.add(wall);
  }

  const door = buildCellDoor();
  door.position.set(0, 0, d / 2);
  g.add(door);
  desc.doorMesh = door;

  g.add(buildCellFurniture());
  g.position.copy(desc.position);
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BLOC CELLULAIRE
// ═══════════════════════════════════════════════════════════════════════════

function buildCellBlock(blockId, origin, rotationY, cells) {
  const g = new THREE.Group();
  g.name = `block_${blockId}`;

  const wallMat = prisonMat.get(P.betonMur, 0.95);
  const floorMat = prisonMat.get(P.betonSol, 0.96);
  const steelMat = prisonMat.get(P.acierClair, 0.5, 0.7);

  const n = D.cellsPerFloor;
  const blockLength = n * D.cellWidth + 2;
  const blockWidth = D.cellDepth * 2 + D.corridorWidth;
  const blockHeight = D.cellHeight * 2 + 0.6;

  const shellMat = prisonMat.get(P.betonSombre, 0.96);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(getSharedGeometry(`block_long_wall_${side}`, () => new THREE.BoxGeometry(blockLength, blockHeight, 0.5)), shellMat);
    wall.position.set(0, blockHeight / 2, (side * blockWidth) / 2);
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);
  }

  const roof = new THREE.Mesh(getSharedGeometry('block_roof', () => new THREE.BoxGeometry(blockLength + 0.6, 0.4, blockWidth + 0.6)), shellMat);
  roof.position.y = blockHeight + 0.2;
  g.add(roof);

  for (let floor = 0; floor < D.floorsPerBlock; floor++) {
    const y = floor * (D.cellHeight + 0.3);
    const slab = new THREE.Mesh(getSharedGeometry(`block_floor_slab_${floor}`, () => new THREE.BoxGeometry(blockLength, 0.2, blockWidth)), floorMat);
    slab.position.y = y - 0.1;
    slab.receiveShadow = true;
    g.add(slab);
  }

  for (let floor = 1; floor <= D.floorsPerBlock; floor++) {
    const y = (floor - 1) * (D.cellHeight + 0.3);

    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const x = -blockLength / 2 + 1 + i * D.cellWidth + D.cellWidth / 2;
        const z = side * (D.corridorWidth / 2 + D.cellDepth / 2);
        const id = `${blockId}-${floor}-${String(i + 1).padStart(2, '0')}${side > 0 ? 'B' : 'A'}`;

        const desc = {
          id, block: blockId, floor, number: i + 1,
          position: new THREE.Vector3(x, y, z),
          doorPosition: new THREE.Vector3(x, y, z - (side * D.cellDepth) / 2),
          locked: true, open: false, capacity: 2,
        };

        const cell = buildCell(desc);
        if (side > 0) cell.rotation.y = Math.PI;
        g.add(cell);
        cells.push(desc);
      }
    }
  }

  // Coursives & escalier
  const walkwayY = D.cellHeight + 0.3;
  for (const side of [-1, 1]) {
    const walkway = new THREE.Mesh(getSharedGeometry(`walkway_${side}`, () => new THREE.BoxGeometry(blockLength - 1, 0.14, 1.4)), steelMat);
    walkway.position.set(0, walkwayY - 0.07, side * (D.corridorWidth / 2 - 0.7));
    g.add(walkway);
  }

  const stairSteps = 14;
  const stepGeo = getSharedGeometry('stair_step_box', () => new THREE.BoxGeometry(1.2, 0.06, 0.28));
  const stepInst = new THREE.InstancedMesh(stepGeo, steelMat, stairSteps);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < stairSteps; i++) {
    dummy.position.set(blockLength / 2 - 1.5, (i + 1) * (walkwayY / stairSteps), -1.2 + i * 0.22);
    dummy.updateMatrix();
    stepInst.setMatrixAt(i, dummy.matrix);
  }
  stepInst.instanceMatrix.needsUpdate = true;
  g.add(stepInst);

  g.position.copy(origin);
  g.rotation.y = rotationY;
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SÉCURITÉ, CAMÉRAS & TOURS DE GARDE
// ═══════════════════════════════════════════════════════════════════════════

function buildSecurityCamera() {
  const g = new THREE.Group();
  const bodyMat = prisonMat.get(0x2a2e33, 0.5, 0.6);

  const mount = new THREE.Mesh(getSharedGeometry('cam_mount', () => new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6)), bodyMat);
  mount.rotation.z = Math.PI / 2;
  mount.position.x = -0.15;
  g.add(mount);

  const body = new THREE.Mesh(getSharedGeometry('cam_body', () => new THREE.BoxGeometry(0.3, 0.16, 0.16)), bodyMat);
  g.add(body);

  const lens = new THREE.Mesh(getSharedGeometry('cam_lens', () => new THREE.CylinderGeometry(0.055, 0.065, 0.1, 10)), prisonMat.get(0x101418, 0.2, 0.8));
  lens.rotation.z = Math.PI / 2;
  lens.position.x = 0.19;
  g.add(lens);

  const led = new THREE.Mesh(
    getSharedGeometry('cam_led_sphere', () => new THREE.SphereGeometry(0.018, 6, 5)),
    prisonMat.emissive(0xff2010, 0xff2010, 2.0)
  );
  led.position.set(0.1, 0.09, 0);
  led.userData.isRecordingLed = true;
  g.add(led);

  return g;
}

function buildGuardTower() {
  const g = new THREE.Group();
  const concreteMat = prisonMat.get(P.betonSombre, 0.95);
  const steelMat = prisonMat.get(P.acierClair, 0.5, 0.7);
  const h = D.towerHeight;

  const shaft = new THREE.Mesh(getSharedGeometry('tower_shaft', () => new THREE.CylinderGeometry(1.3, 1.7, h, 8)), concreteMat);
  shaft.position.y = h / 2;
  shaft.castShadow = true;
  g.add(shaft);

  const platform = new THREE.Mesh(getSharedGeometry('tower_platform', () => new THREE.CylinderGeometry(3.2, 3.2, 0.35, 8)), concreteMat);
  platform.position.y = h;
  g.add(platform);

  const cabin = new THREE.Mesh(getSharedGeometry('tower_cabin', () => new THREE.BoxGeometry(3.2, 2.2, 3.2)), concreteMat);
  cabin.position.y = h + 1.25;
  g.add(cabin);

  // Projecteur
  const projectorPivot = new THREE.Group();
  projectorPivot.position.y = h + 2.65;

  const housing = new THREE.Mesh(getSharedGeometry('proj_housing', () => new THREE.CylinderGeometry(0.34, 0.4, 0.6, 10)), steelMat);
  housing.rotation.z = Math.PI / 2;
  housing.position.x = 0.5;
  projectorPivot.add(housing);

  const lens = new THREE.Mesh(getSharedGeometry('proj_lens', () => new THREE.CircleGeometry(0.36, 12)), prisonMat.emissive(P.projecteur, P.projecteur, 3.0));
  lens.rotation.y = Math.PI / 2;
  lens.position.x = 0.81;
  projectorPivot.add(lens);

  const beam = new THREE.Mesh(getSharedGeometry('proj_beam_cone', () => new THREE.ConeGeometry(6, 45, 12, 1, true)), new THREE.MeshBasicMaterial({
    color: P.projecteur, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false,
  }));
  beam.rotation.z = Math.PI / 2;
  beam.position.x = 23;
  projectorPivot.add(beam);

  const spot = new THREE.SpotLight(P.projecteur, 3.5, 70, 0.22, 0.4, 1.4);
  spot.position.set(0.9, 0, 0);
  spot.target.position.set(45, -h, 0);
  projectorPivot.add(spot);
  projectorPivot.add(spot.target);

  projectorPivot.userData.isTowerProjector = true;
  g.add(projectorPivot);
  g.userData.projector = projectorPivot;

  // Drapeau
  const flag = new THREE.Mesh(getSharedGeometry('tower_flag_plane', () => new THREE.PlaneGeometry(1.8, 1.1)), prisonMat.get(P.drapeau, 0.9));
  flag.position.set(0.9, h + 3.8, 0);
  flag.userData.isFlag = true;
  g.add(flag);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  COUR, PERIMETRES & BATIMENT ADMIN
// ═══════════════════════════════════════════════════════════════════════════

function buildFenceLine(length, height, withRazorwire) {
  const g = new THREE.Group();
  const postMat = prisonMat.get(0x5a5e62, 0.6, 0.6);
  const wireMat = prisonMat.get(P.barbele, 0.4, 0.85);

  const fenceTex = getFenceTexture(length, height);
  const fence = new THREE.Mesh(
    getSharedGeometry(`fence_plane_${length}`, () => new THREE.PlaneGeometry(length, height)),
    new THREE.MeshStandardMaterial({
      map: fenceTex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.5,
    })
  );
  fence.position.y = height / 2;
  g.add(fence);

  return g;
}

function buildDoublePerimeter(size) {
  const g = new THREE.Group();
  const inner = size;
  const outer = size + D.fenceGap * 2;

  for (const [dim, hasRazor] of [[inner, true], [outer, true]]) {
    const half = dim / 2;
    const sides = [
      [0, half, 0], [0, -half, Math.PI], [half, 0, Math.PI / 2], [-half, 0, -Math.PI / 2],
    ];
    for (const [x, z, rot] of sides) {
      const line = buildFenceLine(dim, D.fenceHeight, hasRazor);
      line.position.set(x, 0, z);
      line.rotation.y = rot;
      g.add(line);
    }
  }
  return g;
}

function buildMantrap(doors) {
  const g = new THREE.Group();
  const wallMat = prisonMat.get(P.betonMur, 0.95);
  const steelMat = prisonMat.get(P.acierPorte, 0.5, 0.8);
  const w = 5, d = 8, h = 3.4;

  const body = new THREE.Mesh(getSharedGeometry('mantrap_ceiling', () => new THREE.BoxGeometry(w + 0.6, 0.35, d + 0.6)), wallMat);
  body.position.y = h;
  g.add(body);

  for (const [z, name] of [[d / 2, 'exterieure'], [-d / 2, 'interieure']]) {
    const doorGroup = new THREE.Group();
    const panel = new THREE.Mesh(getSharedGeometry('mantrap_door_panel', () => new THREE.BoxGeometry(w * 0.8, h - 0.4, 0.18)), steelMat);
    panel.position.y = (h - 0.4) / 2;
    doorGroup.add(panel);

    const indicator = new THREE.Mesh(getSharedGeometry('mantrap_led', () => new THREE.SphereGeometry(0.06, 8, 6)), prisonMat.emissive(0xff3020, 0xff2010, 1.6));
    indicator.position.set(w * 0.34, h * 0.6, 0.14);
    doorGroup.add(indicator);

    doorGroup.position.set(0, 0, z);
    doorGroup.userData.doorName = name;
    doorGroup.userData.indicator = indicator;
    g.add(doorGroup);
    doors.push(doorGroup);
  }
  return g;
}

function buildYard(size) {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(getSharedGeometry('yard_asphalt', () => new THREE.PlaneGeometry(size, size)), prisonMat.get(P.asphalteCour, 0.98));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.01;
  ground.receiveShadow = true;
  g.add(ground);

  // Paniers de Basket
  for (const side of [-1, 1]) {
    const hoop = new THREE.Group();
    const poleMat = prisonMat.get(0x5a5e62, 0.6, 0.6);
    const pole = new THREE.Mesh(getSharedGeometry('hoop_pole', () => new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8)), poleMat);
    pole.position.y = 1.8;
    hoop.add(pole);

    const board = new THREE.Mesh(getSharedGeometry('hoop_board', () => new THREE.BoxGeometry(1.8, 1.05, 0.06)), prisonMat.get(0xd8d4cc, 0.7));
    board.position.set(0, 3.4, -side * 0.9);
    hoop.add(board);

    hoop.position.set(0, 0, side * 13);
    g.add(hoop);
  }
  return g;
}

function buildAdminBuilding() {
  const g = new THREE.Group();
  const wallMat = prisonMat.get(P.betonMur, 0.95);
  const w = D.adminWidth, d = D.adminDepth, h = D.adminHeight;

  const body = new THREE.Mesh(getSharedGeometry('admin_body', () => new THREE.BoxGeometry(w, h, d)), wallMat);
  body.position.y = h / 2;
  body.castShadow = true;
  g.add(body);

  const sign = new THREE.Mesh(getSharedGeometry('admin_sign_plate', () => new THREE.PlaneGeometry(10, 2.4)), new THREE.MeshBasicMaterial({ map: getSignTexture() }));
  sign.position.set(0, 5.4, d / 2 + 0.08);
  g.add(sign);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ASSEMBLAGE ET CONTRÔLE SÉCURITAIRE DU COMPLEXE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit l'intégralité géométrique du pénitencier.
 * @param {object} [config] 
 */
export function buildPrisonComplex(config = {}) {
  const [px, py, pz] = config.position ?? [0, 0, 0];
  const group = new THREE.Group();
  group.name = 'penitencier_portneuf';

  const cells = [];
  const zones = [];
  const towerLights = [];
  const mantrapDoors = [];

  const yardSize = D.yardSize;
  const perimeterSize = yardSize + 70;

  // Dalle de base
  const slab = new THREE.Mesh(getSharedGeometry('prison_base_slab', () => new THREE.PlaneGeometry(perimeterSize + 30, perimeterSize + 30)), prisonMat.get(0x585a5c, 0.98));
  slab.rotation.x = -Math.PI / 2;
  slab.receiveShadow = true;
  group.add(slab);

  // Bâtiment administratif
  const admin = buildAdminBuilding();
  admin.position.set(0, 0, perimeterSize / 2 - 22);
  group.add(admin);

  // Sas
  const mantrap = buildMantrap(mantrapDoors);
  mantrap.position.set(0, 0, perimeterSize / 2 - 8);
  group.add(mantrap);

  // Blocs
  const blockOffset = yardSize / 2 + 14;
  const blockLayout = [
    ['A', new THREE.Vector3(-blockOffset, 0, -12), 0],
    ['B', new THREE.Vector3(blockOffset, 0, -12), 0],
    ['C', new THREE.Vector3(-blockOffset, 0, 16), 0],
    ['D', new THREE.Vector3(blockOffset, 0, 16), 0],
  ];

  for (let i = 0; i < blockLayout.length; i++) {
    const [id, pos, rot] = blockLayout[i];
    const block = buildCellBlock(id, pos, rot, cells);
    group.add(block);
  }

  // Cour de promenade
  const yard = buildYard(yardSize);
  yard.position.set(0, 0, 0);
  group.add(yard);

  // Double périmètre
  const perimeter = buildDoublePerimeter(perimeterSize);
  group.add(perimeter);

  // Miradors / Tours de garde
  const towerOffset = perimeterSize / 2 + D.fenceGap;
  const towerPositions = [
    [-towerOffset, -towerOffset], [towerOffset, -towerOffset],
    [-towerOffset, towerOffset], [towerOffset, towerOffset],
  ];

  towerPositions.forEach(([tx, tz], i) => {
    const tower = buildGuardTower();
    tower.position.set(tx, 0, tz);
    if (tower.userData.projector) {
      tower.userData.projector.rotation.y = (i / 4) * Math.PI * 2;
      towerLights.push(tower.userData.projector);
    }
    group.add(tower);
  });

  group.position.set(px, py, pz);
  if (config.rotationY) group.rotation.y = config.rotationY;

  console.log(`[${SIG}·Prison] Succès d'assemblage du complexe carcéral.`);

  return {
    group,
    cells,
    zones,
    towerLights,
    mantrapDoors,
    center: new THREE.Vector3(px, py, pz),
  };
}

/**
 * Anime les balayages de miradors et les drapeaux.
 * @param {object} prison 
 * @param {number} elapsed 
 * @param {number} delta 
 */
export function animatePrison(prison, elapsed, delta) {
  prison.towerLights.forEach((projector, i) => {
    // Balayage sinusoïdal réaliste décalé en phase
    projector.rotation.y += delta * (0.16 + i * 0.035);
    projector.rotation.x = Math.sin(elapsed * 0.5 + i) * 0.05;
  });

  prison.group.traverse((obj) => {
    if (obj.userData.isFlag) {
      obj.rotation.y = Math.sin(elapsed * 1.6) * 0.25;
    }
    if (obj.userData.isRecordingLed) {
      const mat = obj.material;
      if (mat) mat.emissiveIntensity = 1.2 + Math.sin(elapsed * 3.2) * 0.9;
    }
  });
}

/**
 * Ouvre ou ferme une cellule.
 * @param {object} cell 
 * @param {boolean} open 
 * @param {boolean} locked 
 */
export function setCellDoorState(cell, open, locked) {
  cell.open = open;
  cell.locked = locked;

  const door = cell.doorMesh;
  if (!door) return;

  const light = door.userData.lockLight;
  if (light) {
    const mat = light.material;
    mat.color.setHex(locked ? 0xff3020 : 0x30ff60);
    mat.emissive.setHex(locked ? 0xff2010 : 0x20ff50);
  }

  door.position.x = open ? D.cellWidth * 0.78 : 0;
}

/**
 * Verrouille tout le complexe (Lockdown immédiat).
 * @param {object} prison 
 */
export function triggerLockdown(prison) {
  for (let i = 0; i < prison.cells.length; i++) {
    setCellDoorState(prison.cells[i], false, true);
  }
  for (let i = 0; i < prison.mantrapDoors.length; i++) {
    const door = prison.mantrapDoors[i];
    door.position.x = 0;
    const ind = door.userData.indicator;
    if (ind) {
      const mat = ind.material;
      mat.color.setHex(0xff3020);
      mat.emissive.setHex(0xff2010);
      mat.emissiveIntensity = 2.4;
    }
  }
}

/**
 * Configure les éclairages et faisceaux nocturnes.
 * @param {object} prison 
 * @param {boolean} isNight 
 */
export function setPrisonNightMode(prison, isNight) {
  prison.group.traverse((obj) => {
    if (obj.userData.isNeon || obj.userData.isCellLight) {
      const mat = obj.material;
      if (mat) mat.emissiveIntensity = isNight ? 1.5 : 0.35;
    }
  });

  prison.towerLights.forEach((projector) => {
    projector.traverse((child) => {
      if (child instanceof THREE.SpotLight) {
        child.intensity = isNight ? 4.0 : 0;
      }
      if (child instanceof THREE.Mesh && child.material) {
        const m = child.material;
        if (m.transparent && m.opacity < 0.2) {
          m.opacity = isNight ? 0.09 : 0;
        }
      }
    });
  });
}
/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — BUILDING.JS
 * Bloc appartement haute-poly + textures HD procédurales
 * JS pur ESM · Three.js · Rapier physique
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/src/world/building.js
 */

import * as THREE from 'three';

// ─── CONSTANTES BÂTIMENT ─────────────────────────────────────────────────────
export const BUILDING = {
  FLOORS:         6,
  APTS_PER_FLOOR: 4,
  FLOOR_H:        4.0,
  WIDTH:          22,
  DEPTH:          14,
  get APT_W()     { return this.WIDTH / this.APTS_PER_FLOOR; },
  ELEV_X:         9.0,
  ELEV_Z:         7.0 + 4.2,
  LOBBY_D:        10,
  LOBBY_H:        6.4,
  get LOBBY_Z()   { return this.DEPTH / 2 + this.LOBBY_D / 2; },
  LIGHT_ON:       0xffd580,
  LIGHT_OFF:      0x0a0e1a,
};

const SIG = 'TROXT⬡';

// ─── TEXTURES HD PROCÉDURALES ────────────────────────────────────────────────
function smoothNoise(ctx, size, scale, alpha, rgb) {
  const step = Math.max(1, Math.floor(size / scale));
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const v = Math.random();
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${v * alpha})`;
      ctx.fillRect(x, y, step + 1, step + 1);
    }
  }
}

function makeConcreteHD(size = 1024, opts = {}) {
  const {
    baseR = 68, baseG = 72, baseB = 80,
    grain = 3, cracks = 32, stains = 22,
    bands = 12, repeat = 2,
  } = opts;

  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');

  c.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  c.fillRect(0, 0, size, size);

  for (let i = 0; i < 14; i++) {
    const bx = Math.random() * size, by = Math.random() * size;
    const br = 80 + Math.random() * 200;
    const g  = c.createRadialGradient(bx, by, 0, bx, by, br);
    const d  = (Math.random() - 0.5) * 28;
    g.addColorStop(0, `rgba(${d > 0 ? 255 : 0},${d > 0 ? 255 : 0},${d > 0 ? 255 : 0},${(Math.abs(d) / 255) * 0.55})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(bx - br, by - br, br * 2, br * 2);
  }

  smoothNoise(c, size, 64, 0.06, [200, 195, 180]);
  smoothNoise(c, size, 32, 0.04, [0, 0, 0]);
  smoothNoise(c, size, 16, 0.025, [255, 255, 240]);

  const id = c.getImageData(0, 0, size, size);
  const px = id.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * grain * 2;
    px[i]     = Math.min(255, Math.max(0, px[i]     + n));
    px[i + 1] = Math.min(255, Math.max(0, px[i + 1] + n));
    px[i + 2] = Math.min(255, Math.max(0, px[i + 2] + n));
  }
  c.putImageData(id, 0, 0);

  for (let b = 0; b < bands; b++) {
    const by2 = (b / bands) * size;
    c.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.07})`;
    c.fillRect(0, by2, size, 1.5 + Math.random() * 3);
  }

  for (let s = 0; s < stains; s++) {
    const sx = Math.random() * size, sy = Math.random() * size * 0.5;
    const sh = 30 + Math.random() * 120;
    const sg = c.createLinearGradient(sx, sy, sx, sy + sh);
    sg.addColorStop(0, `rgba(0,0,0,${0.06 + Math.random() * 0.12})`);
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sg;
    c.fillRect(sx - 4, sy, 3 + Math.random() * 8, sh);
  }

  c.lineCap = 'round';
  for (let cr = 0; cr < cracks; cr++) {
    c.beginPath();
    let cx = Math.random() * size, cy = Math.random() * size;
    c.moveTo(cx, cy);
    for (let st = 0; st < 5 + Math.floor(Math.random() * 9); st++) {
      cx += (Math.random() - 0.5) * 28;
      cy += (Math.random() - 0.5) * 28;
      c.lineTo(cx, cy);
    }
    c.strokeStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.14})`;
    c.lineWidth   = 0.3 + Math.random() * 0.9;
    c.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNormalHD(size = 1024, strength = 2.0, repeat = 3) {
  const hcv = document.createElement('canvas');
  hcv.width = hcv.height = size;
  const hc  = hcv.getContext('2d');
  hc.fillStyle = 'black';
  hc.fillRect(0, 0, size, size);

  smoothNoise(hc, size, 48, 0.18, [255, 255, 255]);
  smoothNoise(hc, size, 20, 0.10, [200, 200, 200]);
  smoothNoise(hc, size, 8,  0.06, [180, 180, 180]);

  const hid = hc.getImageData(0, 0, size, size);
  const hpx = hid.data;
  const ncv = document.createElement('canvas');
  ncv.width = ncv.height = size;
  const nc  = ncv.getContext('2d');
  const nid = nc.createImageData(size, size);
  const npx = nid.data;

  const getH = (x, y) => {
    const xi = ((x % size) + size) % size;
    const yi = ((y % size) + size) % size;
    return hpx[(yi * size + xi) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx  = getH(x + 1, y) - getH(x - 1, y);
      const dy  = getH(x, y + 1) - getH(x, y - 1);
      const nx2 = -dx * strength, ny2 = -dy * strength, nz2 = 1.0;
      const len = Math.sqrt(nx2 * nx2 + ny2 * ny2 + nz2 * nz2);
      const idx = (y * size + x) * 4;
      npx[idx]     = Math.floor(((nx2 / len) * 0.5 + 0.5) * 255);
      npx[idx + 1] = Math.floor(((ny2 / len) * 0.5 + 0.5) * 255);
      npx[idx + 2] = Math.floor(((nz2 / len) * 0.5 + 0.5) * 255);
      npx[idx + 3] = 255;
    }
  }
  nc.putImageData(nid, 0, 0);

  const tex = new THREE.CanvasTexture(ncv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 16;
  return tex;
}

function makeMarbleHD(size = 1024) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c  = cv.getContext('2d');
  c.fillStyle = '#c8b89a';
  c.fillRect(0, 0, size, size);

  smoothNoise(c, size, 120, 0.12, [255, 245, 220]);
  smoothNoise(c, size, 60,  0.08, [180, 155, 110]);

  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (let v = 0; v < 60; v++) {
    c.beginPath();
    let vx = Math.random() * size, vy = Math.random() * size;
    c.moveTo(vx, vy);
    for (let s = 0; s < 8 + Math.floor(Math.random() * 14); s++) {
      vx += (Math.random() - 0.3) * 40;
      vy += (Math.random() - 0.5) * 20;
      c.lineTo(vx, vy);
    }
    const alpha = 0.04 + Math.random() * 0.13;
    c.strokeStyle = Math.random() > 0.4 ? `rgba(80,60,40,${alpha})` : `rgba(255,245,220,${alpha * 0.6})`;
    c.lineWidth   = 0.4 + Math.random() * 2.2;
    c.stroke();
  }

  const ts = size / 8;
  c.strokeStyle = 'rgba(100,85,65,0.35)';
  c.lineWidth = 2.5;
  for (let t = 0; t <= 8; t++) {
    c.beginPath(); c.moveTo(t * ts, 0); c.lineTo(t * ts, size); c.stroke();
    c.beginPath(); c.moveTo(0, t * ts); c.lineTo(size, t * ts); c.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.5);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoughnessHD(size = 512, base = 0.82, repeat = 3) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c  = cv.getContext('2d');
  const b  = Math.floor(base * 255);
  c.fillStyle = `rgb(${b},${b},${b})`;
  c.fillRect(0, 0, size, size);

  smoothNoise(c, size, 64, 0.12, [255, 255, 255]);
  smoothNoise(c, size, 16, 0.08, [0, 0, 0]);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  return tex;
}

function makeAsphaltHD(size = 512) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c  = cv.getContext('2d');
  c.fillStyle = 'rgb(18,20,24)';
  c.fillRect(0, 0, size, size);

  smoothNoise(c, size, 8, 0.06, [60, 55, 50]);
  smoothNoise(c, size, 3, 0.04, [80, 75, 65]);

  for (let p = 0; p < 1800; p++) {
    const px = Math.random() * size, py = Math.random() * size;
    const pr = 0.5 + Math.random() * 2.5;
    const pg = c.createRadialGradient(px, py, 0, px, py, pr);
    const pv = 30 + Math.random() * 40;
    pg.addColorStop(0, `rgb(${pv},${pv},${pv})`);
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = pg;
    c.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── CACHE TEXTURES ──────────────────────────────────────────────────────────
let _T = null;
function getTextures() {
  if (_T) return _T;
  _T = {
    concreteMain:  makeConcreteHD(1024, { baseR:65, baseG:70, baseB:78, grain:3.5, cracks:32, repeat:3 }),
    concreteDark:  makeConcreteHD(1024, { baseR:40, baseG:45, baseB:52, grain:2.5, cracks:18, repeat:2 }),
    concretePanel: makeConcreteHD(1024, { baseR:72, baseG:76, baseB:84, bands:20,  cracks:10, repeat:4 }),
    normalMain:    makeNormalHD(1024, 2.0, 3),
    normalPanel:   makeNormalHD(1024, 1.4, 4),
    roughMain:     makeRoughnessHD(512, 0.82, 3),
    roughSmooth:   makeRoughnessHD(512, 0.45, 2),
    marble:        makeMarbleHD(1024),
    asphalt:       makeAsphaltHD(512),
  };
  return _T;
}

// ─── MATÉRIAUX ───────────────────────────────────────────────────────────────
function getMaterials() {
  const T  = getTextures();
  const mk = (o) => new THREE.MeshStandardMaterial(o);
  return {
    concreteMain:  mk({ map: T.concreteMain, normalMap: T.normalMain, roughnessMap: T.roughMain, color: 0x9a9fa8, roughness: 0.85, metalness: 0.04, normalScale: new THREE.Vector2(1.2, 1.2) }),
    concreteDark:  mk({ map: T.concreteDark, normalMap: T.normalMain, roughnessMap: T.roughMain, color: 0x6a7080, roughness: 0.9, metalness: 0.02 }),
    concretePanel: mk({ map: T.concretePanel, normalMap: T.normalPanel, roughnessMap: T.roughMain, color: 0x8e939c, roughness: 0.88, metalness: 0.03 }),
    slab:          mk({ map: T.concreteDark, normalMap: T.normalMain, color: 0x5a6070, roughness: 0.9, metalness: 0.03 }),
    marble:        mk({ map: T.marble, normalMap: T.normalPanel, roughnessMap: T.roughSmooth, color: 0xe8d5b0, roughness: 0.12, metalness: 0.14, normalScale: new THREE.Vector2(0.3, 0.3) }),
    asphalt:       mk({ map: T.asphalt, color: 0x1a1b20, roughness: 0.96 }),
    glass:         mk({ color: 0x7dd3fc, transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0.1 }),
    glassDoor:     mk({ color: 0x7dd3fc, transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0.1 }),
    frame:         mk({ color: 0x1a2535, roughness: 0.2, metalness: 0.85 }),
    gold:          mk({ color: 0xc9a84c, metalness: 0.92, roughness: 0.12 }),
    goldDark:      mk({ color: 0x8a6820, metalness: 0.88, roughness: 0.18 }),
    metal:         mk({ color: 0x2a3040, roughness: 0.25, metalness: 0.85 }),
    neon:          mk({ color: 0xa78bfa, emissive: 0xa78bfa, emissiveIntensity: 0.9, roughness: 0.3 }),
    ledBlue:       mk({ color: 0x7dd3fc, emissive: 0x7dd3fc, emissiveIntensity: 0.9, roughness: 0.2 }),
    ledWarm:       mk({ color: 0xffd580, emissive: 0xffd580, emissiveIntensity: 0.8, roughness: 0.2 }),
    doorDark:      mk({ color: 0x0d1520, roughness: 0.15, metalness: 0.7 }),
    cushion:       mk({ color: 0x1c140e, roughness: 0.85 }),
    wood:          mk({ color: 0x2a1a08, roughness: 0.5 }),
  };
}

// ─── HELPER MESH ─────────────────────────────────────────────────────────────
function box(w, h, d, ws = 1, hs = 1, ds = 1) {
  return new THREE.BoxGeometry(w, h, d, ws, hs, ds);
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE BUILDING
// ═══════════════════════════════════════════════════════════════════════════
export class Building {
  constructor(scene, world = null, RAPIER = null) {
    this.scene  = scene;
    this.world  = world;
    this.RAPIER = RAPIER;
    this.M      = null;

    // Conteneur racine Three.js
    this.root = new THREE.Group();
    this.root.name = 'TroxtBuilding_Root';
    this.scene.add(this.root);

    // État
    this.windowMeshes    = [];
    this.aptLights       = [];
    this.litStates       = [];
    this.elevatorGroup   = null;
    this.elevatorY       = 0.12;
    this.elevatorTargetY = 0.12;
    this.aptData         = [];

    // Interaction
    this.interactiveObjects = [];
    this.onAptClick         = null;
    this.camera             = null;

    // Tracking pour nettoyage strict
    this._listeners     = [];
    this._ownedMeshes   = [];
    this._rapierBodies  = [];
  }

  setCamera(camera) {
    this.camera = camera;
  }

  async build() {
    this.M = getMaterials();

    for (let f = 0; f < BUILDING.FLOORS; f++) {
      this.litStates.push([]);
      for (let a = 0; a < BUILDING.APTS_PER_FLOOR; a++) {
        this.litStates[f].push(Math.random() > 0.35);
      }
    }

    this._buildGround();
    this._buildShell();
    this._buildSlabs();
    this._buildFacade();
    this._buildWindows();
    this._buildCorridors();
    this._buildRooftop();
    this._buildSideBuildings();
    this._buildLobby();
    this._buildElevator();
    this._buildElevatorCar();
    this._buildStreetFurniture();
    this._addRapierColliders();

    console.log(
      `[${SIG}·Building] Construit — ${BUILDING.FLOORS} étages, ` +
      `${BUILDING.FLOORS * BUILDING.APTS_PER_FLOOR} appartements`
    );
  }

  _track(mesh) {
    this._ownedMeshes.push(mesh);
    return mesh;
  }

  _listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._listeners.push({ target, type, fn, opts });
  }

  // ────────────────────────────────────────────────────────────────────────
  // SOL & TROTTOIR
  // ────────────────────────────────────────────────────────────────────────
  _buildGround() {
    const ground = this._track(new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 4, 4), this.M.asphalt));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.root.add(ground);

    const swTex = makeConcreteHD(512, { baseR: 140, baseG: 138, baseB: 135, grain: 2, cracks: 12, repeat: 6 });
    const swMat = new THREE.MeshStandardMaterial({ map: swTex, color: 0xb0ada8, roughness: 0.88 });
    const sw    = this._track(new THREE.Mesh(new THREE.PlaneGeometry(55, 18, 2, 2), swMat));
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(0, 0.01, BUILDING.DEPTH / 2 + 9);
    sw.receiveShadow = true;
    this.root.add(sw);

    const dashM = new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffd060, emissiveIntensity: 0.2 });
    for (let d = -22; d < 22; d += 4.5) {
      const dash = this._track(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 2.0), dashM));
      dash.position.set(d, 0.02, BUILDING.DEPTH / 2 + 23);
      this.root.add(dash);
    }
  }

  // ── COQUILLE ────────────────────────────────────────────────────────────
  _buildShell() {
    const bH = BUILDING.FLOORS * BUILDING.FLOOR_H + 1.5;
    const shell = this._track(new THREE.Mesh(
      box(BUILDING.WIDTH + 0.8, bH, BUILDING.DEPTH + 0.8, 2, BUILDING.FLOORS, 2),
      this.M.concreteMain
    ));
    shell.position.set(0, bH / 2, 0);
    shell.castShadow = true;
    shell.receiveShadow = true;
    this.root.add(shell);
  }

  // ── DALLES ──────────────────────────────────────────────────────────────
  _buildSlabs() {
    for (let f = 0; f <= BUILDING.FLOORS; f++) {
      const fy = f * BUILDING.FLOOR_H;

      const slab = this._track(new THREE.Mesh(
        box(BUILDING.WIDTH + 1.0, 0.3, BUILDING.DEPTH + 1.0, 4, 1, 2),
        this.M.slab
      ));
      slab.position.set(0, fy, 0);
      slab.castShadow = true;
      this.root.add(slab);

      const lip = this._track(new THREE.Mesh(
        box(BUILDING.WIDTH + 1.1, 0.08, 0.14, 4, 1, 1),
        this.M.concreteDark
      ));
      lip.position.set(0, fy - 0.11, BUILDING.DEPTH / 2 + 0.55);
      this.root.add(lip);
    }
  }

  // ── NERVURES FACADE ─────────────────────────────────────────────────────
  _buildFacade() {
    const bH = BUILDING.FLOORS * BUILDING.FLOOR_H + 1.5;
    for (let r = -2; r <= 2; r++) {
      const rx  = r * (BUILDING.WIDTH / 4);
      const rib = this._track(new THREE.Mesh(
        box(0.55, bH, 0.55, 1, BUILDING.FLOORS * 2, 1),
        this.M.concretePanel
      ));
      rib.position.set(rx, bH / 2, BUILDING.DEPTH / 2 + 0.28);
      rib.castShadow = true;
      this.root.add(rib);

      const cap = this._track(new THREE.Mesh(box(0.7, 0.3, 0.7, 1, 1, 1), this.M.concretePanel));
      cap.position.set(rx, bH + 0.15, BUILDING.DEPTH / 2 + 0.28);
      this.root.add(cap);
    }
  }

  // ── FENÊTRES ────────────────────────────────────────────────────────────
  _buildWindows() {
    for (let f = 0; f < BUILDING.FLOORS; f++) {
      const rowW = [], rowL = [];
      const fy   = f * BUILDING.FLOOR_H + BUILDING.FLOOR_H / 2;

      for (let a = 0; a < BUILDING.APTS_PER_FLOOR; a++) {
        const px  = -BUILDING.WIDTH / 2 + BUILDING.APT_W / 2 + a * BUILDING.APT_W;
        const lit = this.litStates[f][a];

        // Renfoncement
        const reveal = this._track(new THREE.Mesh(
          box(BUILDING.APT_W * 0.60, BUILDING.FLOOR_H * 0.46, 0.5),
          new THREE.MeshStandardMaterial({
            map: getTextures().concreteDark,
            color: 0x3a4050,
            roughness: 0.9,
          })
        ));
        reveal.position.set(px, fy + 0.06, BUILDING.DEPTH / 2 + 0.25);
        this.root.add(reveal);

        // Vitre
        const winMat = new THREE.MeshStandardMaterial({
          color: BUILDING.LIGHT_ON,
          emissive: new THREE.Color(BUILDING.LIGHT_ON),
          emissiveIntensity: lit ? 0.65 : 0,
          transparent: true,
          opacity: 0.85,
          roughness: 0.04,
          metalness: 0.08,
        });
        const win = this._track(new THREE.Mesh(
          box(BUILDING.APT_W * 0.56, BUILDING.FLOOR_H * 0.44, 0.1),
          winMat
        ));
        win.position.set(px, fy + 0.06, BUILDING.DEPTH / 2 + 0.46);
        win.userData = { type: 'window', floor: f, apt: a, aptId: `${f}-${a}` };
        this.root.add(win);
        rowW.push(win);
        this.interactiveObjects.push(win);

        // Cadres
        const fH2 = BUILDING.FLOOR_H * 0.44, fW2 = BUILDING.APT_W * 0.56;
        [
          [fW2 + 0.12, 0.09, 0.14, px, fy + 0.06 + fH2 / 2 + 0.045, BUILDING.DEPTH / 2 + 0.52],
          [fW2 + 0.12, 0.09, 0.14, px, fy + 0.06 - fH2 / 2 - 0.045, BUILDING.DEPTH / 2 + 0.52],
          [0.09, fH2 + 0.12, 0.14, px - fW2 / 2 - 0.045, fy + 0.06, BUILDING.DEPTH / 2 + 0.52],
          [0.09, fH2 + 0.12, 0.14, px + fW2 / 2 + 0.045, fy + 0.06, BUILDING.DEPTH / 2 + 0.52],
        ].forEach(([fw, fh, fd, fx, ffy, fz]) => {
          const fm = this._track(new THREE.Mesh(box(fw, fh, fd), this.M.frame));
          fm.position.set(fx, ffy, fz);
          this.root.add(fm);
        });

        // Appui fenêtre
        const sill = this._track(new THREE.Mesh(
          box(fW2 + 0.28, 0.07, 0.24),
          new THREE.MeshStandardMaterial({ color: 0x1e2a35, metalness: 0.88, roughness: 0.2 })
        ));
        sill.position.set(px, fy + 0.06 - fH2 / 2 - 0.08, BUILDING.DEPTH / 2 + 0.57);
        this.root.add(sill);

        // Lumière intérieure
        const ptL = this._track(new THREE.PointLight(BUILDING.LIGHT_ON, lit ? 0.9 : 0, 7));
        ptL.position.set(px, fy + 0.2, BUILDING.DEPTH / 2 - 1);
        this.root.add(ptL);
        rowL.push(ptL);

        // Métadonnées RP
        if (!this.aptData[f]) this.aptData[f] = [];
        this.aptData[f][a] = {
          id:       `${f}-${a}`,
          floor:    f,
          apt:      a,
          label:    `Étage ${f} — Apt ${String.fromCharCode(65 + a)}`,
          owner:    null,
          tenant:   null,
          locked:   true,
          rent:     850 + f * 80 + a * 25,
          occupied: false,
        };
      }

      this.windowMeshes.push(rowW);
      this.aptLights.push(rowL);
    }

    const raycaster = new THREE.Raycaster();
    this._onWindowClick = (e) => {
      if (e.target?.closest?.('#hud, #apt-popup, #hud-elevator')) return;
      if (!this.camera) return;

      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(mouse, this.camera);

      const hits = raycaster.intersectObjects(this.interactiveObjects, false);
      if (hits.length > 0) {
        const target = hits[0].object;
        if (target.userData?.type === 'window') {
          const { floor, apt } = target.userData;
          this.toggleLight(floor, apt);
          if (this.onAptClick) this.onAptClick(this.aptData[floor][apt]);
        }
      }
    };
    this._listen(window, 'click', this._onWindowClick);
  }

  // ── COULOIRS ────────────────────────────────────────────────────────────
  _buildCorridors() {
    for (let f = 0; f < BUILDING.FLOORS; f++) {
      const fy = f * BUILDING.FLOOR_H;
      const cz = -BUILDING.DEPTH / 2 + 1.2;

      const floorMesh = this._track(new THREE.Mesh(box(BUILDING.WIDTH - 0.6, 0.22, 2.4), this.M.slab));
      floorMesh.position.set(0, fy + 0.11, cz);
      this.root.add(floorMesh);

      const ceil = this._track(new THREE.Mesh(box(BUILDING.WIDTH - 0.6, 0.14, 2.4), this.M.concreteDark));
      ceil.position.set(0, fy + BUILDING.FLOOR_H - 0.07, cz);
      this.root.add(ceil);

      const wall = this._track(new THREE.Mesh(
        box(BUILDING.WIDTH - 0.6, BUILDING.FLOOR_H * 0.75, 0.18),
        this.M.concretePanel
      ));
      wall.position.set(0, fy + BUILDING.FLOOR_H * 0.38, -BUILDING.DEPTH / 2 + 2.4);
      this.root.add(wall);

      const led = this._track(new THREE.Mesh(new THREE.BoxGeometry(BUILDING.WIDTH - 1.5, 0.06, 0.22), this.M.ledBlue));
      led.position.set(0, fy + BUILDING.FLOOR_H - 0.2, cz);
      this.root.add(led);

      const corrL = this._track(new THREE.PointLight(0x7dd3fc, 0.4, 14));
      corrL.position.set(0, fy + BUILDING.FLOOR_H - 0.3, cz);
      this.root.add(corrL);

      for (let a = 0; a < BUILDING.APTS_PER_FLOOR; a++) {
        const dx = -BUILDING.WIDTH / 2 + BUILDING.APT_W / 2 + a * BUILDING.APT_W;

        const doorFrame = this._track(new THREE.Mesh(
          box(1.15, BUILDING.FLOOR_H * 0.72, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x1a2535, metalness: 0.8, roughness: 0.2 })
        ));
        doorFrame.position.set(dx, fy + BUILDING.FLOOR_H * 0.36, -BUILDING.DEPTH / 2 + 2.49);
        this.root.add(doorFrame);

        const door = this._track(new THREE.Mesh(box(0.92, BUILDING.FLOOR_H * 0.68, 0.12), this.M.doorDark));
        door.position.set(dx, fy + BUILDING.FLOOR_H * 0.34, -BUILDING.DEPTH / 2 + 2.55);
        door.userData = { type: 'door', floor: f, apt: a };
        this.root.add(door);
        this.interactiveObjects.push(door);

        const handle = this._track(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), this.M.gold));
        handle.position.set(dx + 0.35, fy + BUILDING.FLOOR_H * 0.38, -BUILDING.DEPTH / 2 + 2.62);
        this.root.add(handle);

        const plate = this._track(new THREE.Mesh(box(0.28, 0.14, 0.04), this.M.gold));
        plate.position.set(dx + 0.35, fy + BUILDING.FLOOR_H * 0.55, -BUILDING.DEPTH / 2 + 2.62);
        this.root.add(plate);
      }
    }
  }

  // ── TOITURE ─────────────────────────────────────────────────────────────
  _buildRooftop() {
    const roofY = BUILDING.FLOORS * BUILDING.FLOOR_H + 0.9;
    const roof  = this._track(new THREE.Mesh(box(BUILDING.WIDTH + 1.8, 1.0, BUILDING.DEPTH + 1.8), this.M.slab));
    roof.position.set(0, roofY, 0);
    this.root.add(roof);

    const pH = 1.2;
    [
      [BUILDING.WIDTH + 1.8, pH, 0.5, 0, roofY + pH / 2 + 0.5, BUILDING.DEPTH / 2 + 0.9],
      [BUILDING.WIDTH + 1.8, pH, 0.5, 0, roofY + pH / 2 + 0.5, -BUILDING.DEPTH / 2 - 0.9],
      [0.5, pH, BUILDING.DEPTH + 1.8, BUILDING.WIDTH / 2 + 0.9, roofY + pH / 2 + 0.5, 0],
      [0.5, pH, BUILDING.DEPTH + 1.8, -BUILDING.WIDTH / 2 - 0.9, roofY + pH / 2 + 0.5, 0],
    ].forEach(([pw, ph, pd, ppx, ppy, ppz]) => {
      const p = this._track(new THREE.Mesh(box(pw, ph, pd), this.M.concreteMain));
      p.position.set(ppx, ppy, ppz);
      this.root.add(p);
    });

    const wt = this._track(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 3.0, 16), this.M.concreteDark));
    wt.position.set(-BUILDING.WIDTH / 2 + 2.5, roofY + 2.5, -BUILDING.DEPTH / 2 + 2.5);
    this.root.add(wt);

    const wtCone = this._track(new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.4, 16), this.M.metal));
    wtCone.position.set(-BUILDING.WIDTH / 2 + 2.5, roofY + 4.7, -BUILDING.DEPTH / 2 + 2.5);
    this.root.add(wtCone);

    [[4, 2], [7, -1], [1, -2]].forEach(([hx, hz]) => {
      const hvac = this._track(new THREE.Mesh(box(2.5, 1.0, 1.8), this.M.metal));
      hvac.position.set(hx, roofY + 1.0, hz);
      this.root.add(hvac);
    });
  }

  // ── BÂTIMENTS ADJACENTS ─────────────────────────────────────────────────
  _buildSideBuildings() {
    [-1, 1].forEach((side) => {
      const sbH = BUILDING.FLOORS * BUILDING.FLOOR_H * 0.65;
      const sb  = this._track(new THREE.Mesh(box(5, sbH, BUILDING.DEPTH), this.M.concreteMain));
      sb.position.set(side * (BUILDING.WIDTH / 2 + 2.7), sbH / 2, 0);
      sb.castShadow = true;
      this.root.add(sb);
    });
  }

  // ── LOBBY ───────────────────────────────────────────────────────────────
  _buildLobby() {
    const LW = BUILDING.WIDTH + 1;
    const LZ = BUILDING.LOBBY_Z;
    const LH = BUILDING.LOBBY_H;
    const LD = BUILDING.LOBBY_D;

    const lobbyFloor = this._track(new THREE.Mesh(box(LW, 0.22, LD), this.M.marble));
    lobbyFloor.position.set(0, 0.11, LZ);
    lobbyFloor.receiveShadow = true;
    this.root.add(lobbyFloor);

    const ceil = this._track(new THREE.Mesh(
      box(LW, 0.24, LD),
      new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.7 })
    ));
    ceil.position.set(0, LH - 0.12, LZ);
    this.root.add(ceil);

    const wM = new THREE.MeshStandardMaterial({ map: getTextures().marble, color: 0xd4c8a8, roughness: 0.35 });
    [
      [LW, LH, 0.22, 0, LH / 2, LZ - LD / 2],
      [0.22, LH, LD, -LW / 2, LH / 2, LZ],
      [0.22, LH, LD, LW / 2, LH / 2, LZ],
    ].forEach(([w, h, d, x, y, z]) => {
      const m = this._track(new THREE.Mesh(box(w, h, d), wM));
      m.position.set(x, y, z);
      this.root.add(m);
    });

    const colM = new THREE.MeshStandardMaterial({ color: 0xb8a060, metalness: 0.78, roughness: 0.22 });
    [[-7, LZ - 1.5], [7, LZ - 1.5], [-7, LZ + 1.5], [7, LZ + 1.5], [-7, LZ + 3.8], [7, LZ + 3.8]].forEach(([cx, cz]) => {
      const col = this._track(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, LH - 0.38, 16), colM));
      col.position.set(cx, (LH - 0.38) / 2, cz);
      col.castShadow = true;
      this.root.add(col);

      [0.1, LH - 0.3].forEach((cy) => {
        const cap = this._track(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16), this.M.gold));
        cap.position.set(cx, cy, cz);
        this.root.add(cap);
      });
    });

    // Lustre
    const chandY = LH - 0.55, chandZ = LZ;
    const rod = this._track(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.4, 8), this.M.gold));
    rod.position.set(0, chandY - 0.5, chandZ);
    this.root.add(rod);

    const chandCore = this._track(new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd580, emissive: 0xffd060, emissiveIntensity: 0.8, metalness: 0.7 })
    ));
    chandCore.position.set(0, chandY - 1.3, chandZ);
    this.root.add(chandCore);

    [new THREE.TorusGeometry(0.9, 0.04, 6, 24), new THREE.TorusGeometry(1.6, 0.035, 6, 32)].forEach((geo) => {
      const ring = this._track(new THREE.Mesh(geo, this.M.gold));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, chandY - 1.3, chandZ);
      this.root.add(ring);
    });

    const chandL = this._track(new THREE.PointLight(0xffd580, 5.5, 22));
    chandL.position.set(0, chandY - 1.4, chandZ);
    this.root.add(chandL);

    // Comptoir
    const deskM = new THREE.MeshStandardMaterial({ color: 0x0e1520, roughness: 0.2, metalness: 0.65 });
    const desk  = this._track(new THREE.Mesh(box(7, 1.15, 1.1), deskM));
    desk.position.set(-2.5, 0.57, LZ - 2.8);
    desk.castShadow = true;
    this.root.add(desk);

    const deskTop = this._track(new THREE.Mesh(box(7.15, 0.09, 1.25), this.M.marble));
    deskTop.position.set(-2.5, 1.16, LZ - 2.8);
    this.root.add(deskTop);

    // Portes vitrées
    const doorFrame = this._track(new THREE.Mesh(box(8.5, LH * 0.84, 0.25), this.M.frame));
    doorFrame.position.set(0, LH * 0.42, LZ + LD / 2);
    this.root.add(doorFrame);

    [-1.8, 1.8].forEach((dx) => {
      const dGlass = this._track(new THREE.Mesh(box(3.0, LH * 0.76, 0.08), this.M.glassDoor));
      dGlass.position.set(dx, LH * 0.42, LZ + LD / 2 + 0.04);
      this.root.add(dGlass);

      const handle = this._track(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), this.M.gold));
      handle.rotation.x = Math.PI / 2;
      handle.position.set(dx + (dx > 0 ? -0.5 : 0.5), LH * 0.42, LZ + LD / 2 + 0.1);
      this.root.add(handle);
    });

    [-7, 0, 7].forEach((gx) => {
      const gPanel = this._track(new THREE.Mesh(box(4.2, LH * 0.76, 0.08), this.M.glass));
      gPanel.position.set(gx, LH * 0.43, LZ + LD / 2 + 0.02);
      this.root.add(gPanel);

      const topBar = this._track(new THREE.Mesh(box(4.4, 0.1, 0.2), this.M.frame));
      topBar.position.set(gx, LH * 0.82, LZ + LD / 2);
      this.root.add(topBar);
    });

    // Lumières additionnelles lobby
    [[-5, LZ - 1], [5, LZ - 1], [0, LZ + 3.5]].forEach(([lx, lz]) => {
      const aL = this._track(new THREE.PointLight(0xffeedd, 1.1, 15));
      aL.position.set(lx, LH * 0.7, lz);
      this.root.add(aL);
    });
  }

  // ── PUITS ASCENSEUR ─────────────────────────────────────────────────────
  _buildElevator() {
    const EX = BUILDING.ELEV_X, EZ = BUILDING.ELEV_Z;
    const EH = BUILDING.FLOORS * BUILDING.FLOOR_H + 3;

    const shaft = this._track(new THREE.Mesh(box(2.8, EH, 2.8), this.M.metal));
    shaft.position.set(EX, EH / 2, EZ);
    this.root.add(shaft);

    const mirror = this._track(new THREE.Mesh(
      box(2.8, EH, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1a2535, roughness: 0.04, metalness: 0.95 })
    ));
    mirror.position.set(EX, EH / 2, EZ - 1.4);
    this.root.add(mirror);

    [-0.9, 0.9].forEach((side) => {
      const rail = this._track(new THREE.Mesh(box(0.07, EH, 0.07), this.M.gold));
      rail.position.set(EX + side, EH / 2, EZ);
      this.root.add(rail);
    });

    const arch = this._track(new THREE.Mesh(box(2.85, 0.14, 0.2), this.M.gold));
    arch.position.set(EX, BUILDING.FLOORS * BUILDING.FLOOR_H + 0.9, EZ - 1.4);
    this.root.add(arch);
  }

  // ── CABINE ASCENSEUR ────────────────────────────────────────────────────
  _buildElevatorCar() {
    const G = new THREE.Group();

    const carFloor = this._track(new THREE.Mesh(box(2.0, 0.12, 2.0), this.M.marble));
    carFloor.position.set(0, 0.06, 0);
    G.add(carFloor);

    const wallM = new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.15, metalness: 0.9 });
    [
      [2.0, BUILDING.FLOOR_H * 0.86, 0.09, 0, BUILDING.FLOOR_H * 0.43, -0.95],
      [0.09, BUILDING.FLOOR_H * 0.86, 2.0, -0.95, BUILDING.FLOOR_H * 0.43, 0],
      [0.09, BUILDING.FLOOR_H * 0.86, 2.0, 0.95, BUILDING.FLOOR_H * 0.43, 0],
    ].forEach(([w, h, d, x, y, z]) => {
      const wall = this._track(new THREE.Mesh(box(w, h, d), wallM));
      wall.position.set(x, y, z);
      G.add(wall);
    });

    const frontGlass = this._track(new THREE.Mesh(box(1.8, BUILDING.FLOOR_H * 0.55, 0.07), this.M.glassDoor));
    frontGlass.position.set(0, BUILDING.FLOOR_H * 0.5, 0.96);
    G.add(frontGlass);

    [
      [2.05, 0.08, 0.12, 0, BUILDING.FLOOR_H * 0.82, 0.96],
      [2.05, 0.08, 0.12, 0, 0.12, 0.96],
      [0.08, BUILDING.FLOOR_H * 0.82, 0.12, -0.98, BUILDING.FLOOR_H * 0.43, 0.96],
      [0.08, BUILDING.FLOOR_H * 0.82, 0.12, 0.98, BUILDING.FLOOR_H * 0.43, 0.96],
    ].forEach(([w, h, d, x, y, z]) => {
      const fr = this._track(new THREE.Mesh(box(w, h, d), this.M.gold));
      fr.position.set(x, y, z);
      G.add(fr);
    });

    const led = this._track(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.5), this.M.ledWarm));
    led.position.set(0, BUILDING.FLOOR_H * 0.87, 0);
    G.add(led);

    const intL = this._track(new THREE.PointLight(0xfff0d0, 1.0, 5));
    intL.position.set(0, BUILDING.FLOOR_H * 0.75, 0);
    G.add(intL);

    G.position.set(BUILDING.ELEV_X, this.elevatorY, BUILDING.ELEV_Z);
    this.root.add(G);
    this.elevatorGroup = G;
  }

  // ── MOBILIER URBAIN ─────────────────────────────────────────────────────
  _buildStreetFurniture() {
    const lampM = new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.85, roughness: 0.2 });
    const bulbM = new THREE.MeshStandardMaterial({ color: 0xffd580, emissive: 0xffd580, emissiveIntensity: 1.2 });

    [[-10, 22], [10, 22], [-10, 2], [10, 2]].forEach(([lx, lz]) => {
      const pole = this._track(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 6.5, 8), lampM));
      pole.position.set(lx, 3.25, lz);
      pole.castShadow = true;
      this.root.add(pole);

      const arm = this._track(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.08), lampM));
      arm.position.set(lx + 1.25, 6.5, lz);
      this.root.add(arm);

      const bulb = this._track(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), bulbM));
      bulb.position.set(lx + 2.5, 6.35, lz);
      this.root.add(bulb);

      const sL = this._track(new THREE.PointLight(0xffd580, 1.8, 18));
      sL.position.set(lx + 2.5, 6.2, lz);
      this.root.add(sL);
    });
  }

  // ── COLLIDERS RAPIER (CORRIGÉS) ─────────────────────────────────────────
  _addRapierColliders() {
    if (!this.world || !this.RAPIER) return;

    // 1. Sol général
    const groundBody = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(60, 0.1, 60), groundBody);
    this._rapierBodies.push(groundBody);

    const halfW = BUILDING.WIDTH / 2;
    const halfD = BUILDING.DEPTH / 2;
    const bH    = (BUILDING.FLOORS * BUILDING.FLOOR_H) / 2;

    // 2. Murs extérieurs (hx, hy, hz, x, y, z)
    const wallDefs = [
      // Gauche / Droite (épaisseur en X = 0.2)
      [0.2, bH, halfD + 0.4, -halfW - 0.2, bH, 0],
      [0.2, bH, halfD + 0.4,  halfW + 0.2, bH, 0],
      // Arrière / Avant (épaisseur en Z = 0.2)
      [halfW + 0.4, bH, 0.2, 0, bH, -halfD - 0.2],
      [halfW + 0.4, bH, 0.2, 0, bH,  halfD + 0.2],
    ];

    wallDefs.forEach(([hx, hy, hz, wx, wy, wz]) => {
      const body = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.fixed());
      body.setTranslation({ x: wx, y: wy, z: wz }, true);
      this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
      this._rapierBodies.push(body);
    });

    // 3. Dalles de plancher
    for (let f = 0; f <= BUILDING.FLOORS; f++) {
      const body = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.fixed());
      body.setTranslation({ x: 0, y: f * BUILDING.FLOOR_H, z: 0 }, true);
      this.world.createCollider(
        this.RAPIER.ColliderDesc.cuboid(halfW + 0.5, 0.15, halfD + 0.5),
        body
      );
      this._rapierBodies.push(body);
    }

    console.log(`[${SIG}·Building] Colliders Rapier construits & attachés`);
  }

  // ── TOGGLE LUMIÈRE ──────────────────────────────────────────────────────
  toggleLight(floor, apt) {
    if (!this.litStates[floor]) return;
    this.litStates[floor][apt] = !this.litStates[floor][apt];
    const lit = this.litStates[floor][apt];

    const win   = this.windowMeshes[floor]?.[apt];
    const light = this.aptLights[floor]?.[apt];

    if (win) {
      win.material.emissive.setHex(lit ? BUILDING.LIGHT_ON : BUILDING.LIGHT_OFF);
      win.material.emissiveIntensity = lit ? 0.65 : 0;
    }
    if (light) light.intensity = lit ? 0.9 : 0;

    if (typeof window !== 'undefined' && window.ETHER_BUS) {
      window.ETHER_BUS.emit('apt:light_toggle', { floor, apt, lit });
    }
  }

  // ── ASCENSEUR ───────────────────────────────────────────────────────────
  callElevator(floor) {
    const clamped = Math.max(0, Math.min(BUILDING.FLOORS - 1, floor));
    this.elevatorTargetY = clamped * BUILDING.FLOOR_H + 0.12;
  }

  getElevatorFloor() {
    return Math.round((this.elevatorY - 0.12) / BUILDING.FLOOR_H);
  }

  // ── UPDATE (Indépendant du framerate) ──────────────────────────────────
  update(dt = 0.016, _elapsed = 0) {
    if (this.elevatorGroup) {
      const diff = this.elevatorTargetY - this.elevatorY;
      if (Math.abs(diff) < 0.001) {
        this.elevatorY = this.elevatorTargetY;
      } else {
        // Amorti exponentiel (smooth damp) indépendant des FPS
        this.elevatorY += diff * (1 - Math.exp(-4.0 * dt));
      }
      this.elevatorGroup.position.y = this.elevatorY;
    }
  }

  // ── ACCÈS DATA RP ───────────────────────────────────────────────────────
  getAptData(floor, apt) {
    return this.aptData[floor]?.[apt] || null;
  }

  getAllApts() {
    const all = [];
    this.aptData.forEach((row) => row && row.forEach((a) => a && all.push(a)));
    return all;
  }

  // ── NETTOYAGE COMPLET ──────────────────────────────────────────────────
  dispose() {
    // 1. Désenregistrement des écouteurs d'événements
    for (const { target, type, fn, opts } of this._listeners) {
      try { target.removeEventListener(type, fn, opts); } catch { /* ignore */ }
    }
    this._listeners = [];
    this._onWindowClick = null;

    // 2. Nettoyage des RigidBodies Rapier
    if (this.world) {
      for (const body of this._rapierBodies) {
        try { this.world.removeRigidBody(body); } catch { /* ignore */ }
      }
    }
    this._rapierBodies = [];

    // 3. Libération des géométries et retrait de la scène
    for (const mesh of this._ownedMeshes) {
      if (mesh.geometry) mesh.geometry.dispose?.();
    }
    this._ownedMeshes = [];

    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
    this.root.clear();

    // 4. Réinitialisation de l'état
    this.windowMeshes       = [];
    this.aptLights          = [];
    this.litStates          = [];
    this.elevatorGroup      = null;
    this.aptData            = [];
    this.interactiveObjects = [];

    console.log(`[${SIG}·Building] Nettoyage terminé (RAM & VRAM libérées)`);
  }
}
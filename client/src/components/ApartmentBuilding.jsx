/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — COMPONENTS/APARTMENTBUILDING.JSX
 * Rendu 3D temps réel interactif de la Résidence Éther
 * ═══════════════════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/src/components/ApartmentBuilding.jsx
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

const FLOORS         = 6;
const APTS_PER_FLOOR = 4;
const FLOOR_H        = 4;
const BLD_W          = 22;
const BLD_D          = 14;
const APT_W          = BLD_W / APTS_PER_FLOOR;
const ELEV_X         = BLD_W / 2 - 2.2;
const ELEV_Z         = BLD_D / 2 + 4.2;
const LOBBY_D        = 10;
const LOBBY_H        = FLOOR_H * 1.6;
const LOBBY_Z        = BLD_D / 2 + LOBBY_D / 2;
const LIGHT_ON       = 0xffd580;
const LIGHT_OFF      = 0x0a0e1a;

// ─── FILTRAGE DE BRUIT ET SURFACES PROCEDURALES ──────────────────────────────
function smoothNoise(ctx, size, scale, alpha, color) {
  const step = Math.max(1, Math.floor(size / scale));
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const v = Math.random();
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${v * alpha})`;
      ctx.fillRect(x, y, step + 1, step + 1);
    }
  }
}

function makeConcreteHD(size = 1024, opts = {}) {
  const baseR = opts.baseR !== undefined ? opts.baseR : 68;
  const baseG = opts.baseG !== undefined ? opts.baseG : 72;
  const baseB = opts.baseB !== undefined ? opts.baseB : 80;
  const grainAmt = opts.grainAmt !== undefined ? opts.grainAmt : 3;
  const crackCount = opts.crackCount !== undefined ? opts.crackCount : 32;
  const stainCount = opts.stainCount !== undefined ? opts.stainCount : 22;
  const formworkBands = opts.formworkBands !== undefined ? opts.formworkBands : 12;
  const aoVariance = opts.aoVariance !== undefined ? opts.aoVariance : 28;
  const tileRepeat = opts.tileRepeat !== undefined ? opts.tileRepeat : 2;

  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const c = cv.getContext("2d");

  c.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  c.fillRect(0, 0, size, size);

  for (let i = 0; i < 14; i++) {
    const bx = Math.random() * size, by = Math.random() * size;
    const br = 80 + Math.random() * 200;
    const g = c.createRadialGradient(bx, by, 0, bx, by, br);
    const d = (Math.random() - 0.5) * aoVariance;
    g.addColorStop(0, `rgba(${d > 0 ? 255 : 0},${d > 0 ? 255 : 0},${d > 0 ? 255 : 0},${Math.abs(d) / 255 * 0.55})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(bx - br, by - br, br * 2, br * 2);
  }

  smoothNoise(c, size, 64, 0.06, [200, 195, 180]);
  smoothNoise(c, size, 32, 0.04, [0, 0, 0]);
  smoothNoise(c, size, 16, 0.025, [255, 255, 240]);

  const id = c.getImageData(0, 0, size, size);
  const px = id.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * grainAmt * 2;
    px[i]     = Math.min(255, Math.max(0, px[i]   + n));
    px[i+1] = Math.min(255, Math.max(0, px[i+1] + n));
    px[i+2] = Math.min(255, Math.max(0, px[i+2] + n));
  }
  c.putImageData(id, 0, 0);

  for (let b = 0; b < formworkBands; b++) {
    const by2 = (b / formworkBands) * size;
    const bh  = 1.5 + Math.random() * 3;
    c.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.07})`;
    c.fillRect(0, by2, size, bh);
  }

  for (let s = 0; s < stainCount; s++) {
    const sx = Math.random() * size, sy = Math.random() * size * 0.6;
    const sw = 2 + Math.random() * 8, sh = 30 + Math.random() * 120;
    const sg = c.createLinearGradient(sx, sy, sx, sy + sh);
    sg.addColorStop(0, `rgba(0,0,0,${0.06 + Math.random() * 0.12})`);
    sg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = sg; c.fillRect(sx - sw / 2, sy, sw, sh);
  }

  c.lineCap = "round"; c.lineJoin = "round";
  for (let cr = 0; cr < crackCount; cr++) {
    c.beginPath();
    let cx = Math.random() * size, cy = Math.random() * size;
    c.moveTo(cx, cy);
    const steps = 5 + Math.floor(Math.random() * 10);
    for (let st = 0; st < steps; st++) {
      cx += (Math.random() - 0.5) * 28;
      cy += (Math.random() - 0.5) * 28;
      c.lineTo(cx, cy);
    }
    c.strokeStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.14})`;
    c.lineWidth = 0.3 + Math.random() * 0.9;
    c.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(tileRepeat, tileRepeat);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNormalHD(size = 1024, strength = 1.6, tileRepeat = 2) {
  const hcv = document.createElement("canvas"); hcv.width = hcv.height = size;
  const hc = hcv.getContext("2d");
  hc.fillStyle = "black"; hc.fillRect(0, 0, size, size);
  smoothNoise(hc, size, 48, 0.18, [255, 255, 255]);
  smoothNoise(hc, size, 20, 0.10, [200, 200, 200]);
  smoothNoise(hc, size, 8,  0.06, [180, 180, 180]);

  const hid = hc.getImageData(0, 0, size, size);
  const hpx = hid.data;
  const ncv = document.createElement("canvas"); ncv.width = ncv.height = size;
  const nc  = ncv.getContext("2d");
  const nid = nc.createImageData(size, size);
  const npx = nid.data;

  const getH = (x, y) => {
    const xi = ((x % size) + size) % size;
    const yi = ((y % size) + size) % size;
    return hpx[(yi * size + xi) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = getH(x+1,y) - getH(x-1,y);
      const dy = getH(x,y+1) - getH(x,y-1);
      const nx2 = -dx * strength, ny2 = -dy * strength, nz2 = 1.0;
      const len = Math.sqrt(nx2*nx2 + ny2*ny2 + nz2*nz2);
      const idx = (y * size + x) * 4;
      npx[idx]   = Math.floor((nx2/len * 0.5 + 0.5) * 255);
      npx[idx+1] = Math.floor((ny2/len * 0.5 + 0.5) * 255);
      npx[idx+2] = Math.floor((nz2/len * 0.5 + 0.5) * 255);
      npx[idx+3] = 255;
    }
  }
  nc.putImageData(nid, 0, 0);

  const tex = new THREE.CanvasTexture(ncv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(tileRepeat, tileRepeat);
  tex.anisotropy = 16;
  return tex;
}

function makeRoughnessHD(size = 1024, baseVal = 0.78, tileRepeat = 2) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const c  = cv.getContext("2d");
  const base = Math.floor(baseVal * 255);
  c.fillStyle = `rgb(${base},${base},${base})`; c.fillRect(0, 0, size, size);
  smoothNoise(c, size, 64, 0.12, [255, 255, 255]);
  smoothNoise(c, size, 16, 0.08, [0, 0, 0]);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(tileRepeat, tileRepeat);
  tex.anisotropy = 16;
  return tex;
}

function makeMarbleHD(size = 1024) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const c  = cv.getContext("2d");
  c.fillStyle = "#c8b89a"; c.fillRect(0, 0, size, size);
  smoothNoise(c, size, 120, 0.12, [255, 245, 220]);
  smoothNoise(c, size, 60,  0.08, [180, 155, 110]);
  c.lineCap = "round"; c.lineJoin = "round";

  for (let v = 0; v < 60; v++) {
    c.beginPath();
    let vx = Math.random() * size * 1.2 - size * 0.1, vy = Math.random() * size;
    c.moveTo(vx, vy);
    const steps = 8 + Math.floor(Math.random() * 14);
    for (let s = 0; s < steps; s++) { vx += (Math.random()-0.3)*40; vy += (Math.random()-0.5)*20; c.lineTo(vx, vy); }
    const alpha = 0.04 + Math.random() * 0.13;
    c.strokeStyle = Math.random() > 0.4 ? `rgba(80,60,40,${alpha})` : `rgba(255,245,220,${alpha * 0.6})`;
    c.lineWidth = 0.4 + Math.random() * 2.2;
    c.stroke();
  }

  const tileSize = size / 8;
  c.strokeStyle = "rgba(100,85,65,0.35)"; c.lineWidth = 2.5;
  for (let t = 0; t <= 8; t++) {
    c.beginPath(); c.moveTo(t*tileSize, 0); c.lineTo(t*tileSize, size); c.stroke();
    c.beginPath(); c.moveTo(0, t*tileSize); c.lineTo(size, t*tileSize); c.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.5);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAsphaltHD(size = 1024) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const c  = cv.getContext("2d");
  c.fillStyle = "rgb(20,21,25)"; c.fillRect(0, 0, size, size);
  smoothNoise(c, size, 8, 0.06, [60, 55, 50]);
  smoothNoise(c, size, 3, 0.04, [80, 75, 65]);
  for (let p = 0; p < 2000; p++) {
    const px3 = Math.random()*size, py = Math.random()*size, pr = 0.5 + Math.random()*2.5;
    const pg = c.createRadialGradient(px3,py,0,px3,py,pr);
    const pv = 35 + Math.random()*45;
    pg.addColorStop(0, `rgb(${pv},${pv-2},${pv-5})`); pg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = pg; c.fillRect(px3-pr, py-pr, pr*2, pr*2);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8); tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlassHD(size = 512) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const c  = cv.getContext("2d");
  const g  = c.createLinearGradient(0,0,size,size);
  g.addColorStop(0, "rgba(80,130,180,0.25)"); g.addColorStop(0.5, "rgba(100,160,210,0.18)"); g.addColorStop(1, "rgba(60,100,150,0.28)");
  c.fillStyle = g; c.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(cv); 
  tex.anisotropy = 8;
  return tex;
}

function makeMetalHD(size = 512) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const c  = cv.getContext("2d");
  c.fillStyle = "rgb(38,42,50)"; c.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const v = 35 + Math.random()*18;
    c.fillStyle = `rgba(${v},${v},${v+4},0.5)`; c.fillRect(0, y, size, 1);
  }
  smoothNoise(c, size, 4, 0.05, [255,255,255]);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2,2); tex.anisotropy = 8;
  return tex;
}

// Cache local global pour empêcher la génération redondante sur Hot-Reload / re-renders
let _TC = null;
function getTextures() {
  if (!_TC) {
    _TC = {
      concreteMain:  makeConcreteHD(1024, { baseR:65, baseG:70, baseB:78, tileRepeat:3 }),
      concreteDark:  makeConcreteHD(1024, { baseR:40, baseG:45, baseB:52, tileRepeat:2 }),
      concreteLight: makeConcreteHD(1024, { baseR:90, baseG:93, baseB:100, grainAmt:2, crackCount:16, tileRepeat:3 }),
      concretePanel: makeConcreteHD(1024, { baseR:72, baseG:76, baseB:84, formworkBands:20, crackCount:10, tileRepeat:4 }),
      normalMain:    makeNormalHD(1024, 2.0, 3),
      normalPanel:   makeNormalHD(1024, 1.4, 4),
      roughMain:     makeRoughnessHD(1024, 0.82, 3),
      roughSmooth:   makeRoughnessHD(1024, 0.45, 2),
      marble:        makeMarbleHD(1024),
      asphalt:       makeAsphaltHD(1024),
      glass:         makeGlassHD(512),
      metal:         makeMetalHD(512),
    };
  }
  return _TC;
}

function clearCachedTextures() {
  if (!_TC) return;
  Object.values(_TC).forEach(t => t.dispose());
  _TC = null;
}

// ─── GEOMETRIES ───
function hpBox(w, h, d, ws = 1, hs = 1, ds = 1) {
  return new THREE.BoxGeometry(w, h, d, ws, hs, ds);
}

// ─── GENERATION DU COMPLEXE IMMOBILIER ───
function createBuilding(scene, M, T, containerGroup, allocatedGeoms) {
  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    allocatedGeoms.add(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true; 
    m.receiveShadow = true;
    containerGroup.add(m); 
    return m;
  };

  // SOL & ROUTE
  const grGeo = new THREE.PlaneGeometry(120, 120, 2, 2);
  allocatedGeoms.add(grGeo);
  const gr = new THREE.Mesh(grGeo, M.asphalt);
  gr.rotation.x = -Math.PI / 2; 
  gr.receiveShadow = true; 
  containerGroup.add(gr);

  // Trottoir
  const swTex = makeConcreteHD(512, { baseR: 140, baseG: 138, baseB: 135, grainAmt: 2, crackCount: 12, tileRepeat: 6 });
  allocatedGeoms.add(swTex);
  const swMat = new THREE.MeshStandardMaterial({ map: swTex, normalMap: T.normalPanel, color: 0xb0ada8, roughness: 0.88 });
  const swGeo = new THREE.PlaneGeometry(50, 16, 2, 2);
  allocatedGeoms.add(swGeo);
  const sw = new THREE.Mesh(swGeo, swMat);
  sw.rotation.x = -Math.PI / 2; 
  sw.position.set(0, 0.01, BLD_D / 2 + 8); 
  sw.receiveShadow = true; 
  containerGroup.add(sw);
  
  add(hpBox(50, 0.18, 0.4), M.concreteDark, 0, 0.09, BLD_D / 2 + 16.2);

  // Marquages jaunes
  const dashM = new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffd060, emissiveIntensity: 0.2 });
  const dashGeo = new THREE.BoxGeometry(0.2, 0.02, 1.8);
  allocatedGeoms.add(dashGeo);
  for (let d = -20; d < 20; d += 4) {
    add(dashGeo, dashM, d, 0.02, BLD_D / 2 + 22);
  }

  // COQUE PRINCIPALE
  const bH = FLOORS * FLOOR_H + 1.5;
  add(hpBox(BLD_W + 0.8, bH, BLD_D + 0.8, 2, FLOORS, 2), M.concreteMain, 0, bH / 2, 0);

  // Panneaux structurels
  for (let f = 0; f < FLOORS; f++) {
    const fy = f * FLOOR_H + FLOOR_H / 2;
    for (let a = 0; a < APTS_PER_FLOOR; a++) {
      const px = -BLD_W / 2 + APT_W / 2 + a * APT_W;
      add(hpBox(APT_W - 0.5, FLOOR_H * 0.32, 0.28), M.concretePanel, px, fy - FLOOR_H * 0.28, BLD_D / 2 + 0.14);
      add(hpBox(APT_W - 0.5, FLOOR_H * 0.24, 0.28), M.concretePanel, px, fy + FLOOR_H * 0.35, BLD_D / 2 + 0.14);
    }
  }

  // DALLES INTER-ETAGES
  for (let f = 0; f <= FLOORS; f++) {
    const fy = f * FLOOR_H;
    add(hpBox(BLD_W + 1.0, 0.3, BLD_D + 1.0, 4, 1, 2), M.slab, 0, fy, 0);
    add(hpBox(BLD_W + 1.1, 0.08, 0.12), M.concreteDark, 0, fy - 0.11, BLD_D / 2 + 0.5);
    add(hpBox(BLD_W + 1.1, 0.08, 0.12), M.concreteDark, 0, fy - 0.11, -BLD_D / 2 - 0.5);
  }

  // COLONNES FAÇADE & RENFORTS STRUCTURELS
  const ribMat = new THREE.MeshStandardMaterial({ map: T.concreteLight, normalMap: T.normalPanel, color: 0xaab0ba, roughness: 0.8, metalness: 0.04 });
  for (let r = -2; r <= 2; r++) {
    const rx = r * (BLD_W / 4);
    add(hpBox(0.55, bH, 0.55, 1, FLOORS * 2, 1), ribMat, rx, bH / 2, BLD_D / 2 + 0.28);
    add(hpBox(0.7, 0.3, 0.7), M.concreteLight, rx, bH + 0.15, BLD_D / 2 + 0.28);
    add(hpBox(0.4, bH, 0.4, 1, FLOORS, 1), M.concreteDark, rx, bH / 2, -BLD_D / 2 - 0.2);
  }
  for (let r = 0; r <= 2; r++) {
    const rz = -BLD_D / 2 + r * (BLD_D / 2);
    add(hpBox(0.45, bH, 0.45, 1, FLOORS, 1), M.concreteDark, BLD_W / 2 + 0.2, bH / 2, rz);
    add(hpBox(0.45, bH, 0.45, 1, FLOORS, 1), M.concreteDark, -BLD_W / 2 - 0.2, bH / 2, rz);
  }

  // ENSEMBLE DE FENÊTRES / APPARTEMENTS
  const windowMeshes = [];
  const aptLights = [];

  for (let f = 0; f < FLOORS; f++) {
    const rowW = [];
    const rowL = [];
    const fy = f * FLOOR_H + FLOOR_H / 2;
    for (let a = 0; a < APTS_PER_FLOOR; a++) {
      const px = -BLD_W / 2 + APT_W / 2 + a * APT_W;

      // Reveal béton sombre
      const revMat = new THREE.MeshStandardMaterial({ map: T.concreteDark, normalMap: T.normalMain, color: 0x3a4050, roughness: 0.9 });
      add(hpBox(APT_W * 0.60, FLOOR_H * 0.46, 0.5), revMat, px, fy + 0.06, BLD_D / 2 + 0.25);

      // Fenêtre en verre émissif
      const winMat = new THREE.MeshStandardMaterial({ map: T.glass, color: LIGHT_ON, emissive: LIGHT_ON, emissiveIntensity: 0, transparent: true, opacity: 0.85, roughness: 0.04, metalness: 0.08 });
      const win = add(hpBox(APT_W * 0.56, FLOOR_H * 0.44, 0.1), winMat, px, fy + 0.06, BLD_D / 2 + 0.46);
      win.userData = { floor: f, apt: a, type: "window" };

      // Cadre structurel
      const fH2 = FLOOR_H * 0.44, fW2 = APT_W * 0.56;
      add(hpBox(fW2 + 0.12, 0.09, 0.14), M.frame, px, fy + 0.06 + fH2 / 2 + 0.045, BLD_D / 2 + 0.52);
      add(hpBox(fW2 + 0.12, 0.09, 0.14), M.frame, px, fy + 0.06 - fH2 / 2 - 0.045, BLD_D / 2 + 0.52);
      add(hpBox(0.09, fH2 + 0.12, 0.14), M.frame, px - fW2 / 2 - 0.045, fy + 0.06, BLD_D / 2 + 0.52);
      add(hpBox(0.09, fH2 + 0.12, 0.14), M.frame, px + fW2 / 2 + 0.045, fy + 0.06, BLD_D / 2 + 0.52);
      // Meneaux de fenêtres
      add(hpBox(fW2 + 0.08, 0.06, 0.1), M.frame, px, fy + 0.06, BLD_D / 2 + 0.52);
      add(hpBox(0.06, fH2 + 0.08, 0.1), M.frame, px, fy + 0.06, BLD_D / 2 + 0.52);
      // Appui
      add(hpBox(fW2 + 0.25, 0.07, 0.22), new THREE.MeshStandardMaterial({ map: T.metal, color: 0x1e2a35, metalness: 0.88, roughness: 0.2 }), px, fy + 0.06 - fH2 / 2 - 0.08, BLD_D / 2 + 0.55);

      // Lampe ponctuelle d'intérieur
      const ptL = new THREE.PointLight(LIGHT_ON, 0, 7);
      ptL.position.set(px, fy + 0.2, BLD_D / 2 - 1);
      containerGroup.add(ptL);
      rowW.push(win); 
      rowL.push(ptL);
    }
    windowMeshes.push(rowW);
    aptLights.push(rowL);

    // COULOIRS & AMBIANCE INTERIEURE
    const cz = -BLD_D / 2 + 1.2;
    add(hpBox(BLD_W - 0.6, 0.22, 2.4, 4, 1, 2), M.slab, 0, f * FLOOR_H + 0.11, cz);
    add(hpBox(BLD_W - 0.6, 0.14, 2.4, 4, 1, 2), M.concreteDark, 0, f * FLOOR_H + FLOOR_H - 0.07, cz);
    add(hpBox(BLD_W - 0.6, FLOOR_H * 0.75, 0.18, 4, 2, 1), M.concretePanel, 0, f * FLOOR_H + FLOOR_H * 0.38, -BLD_D / 2 + 2.4);
    
    const ledM2 = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x7dd3fc, emissiveIntensity: 0.9 });
    const ledBarGeo = new THREE.BoxGeometry(BLD_W - 1.5, 0.06, 0.22);
    allocatedGeoms.add(ledBarGeo);
    add(ledBarGeo, ledM2, 0, f * FLOOR_H + FLOOR_H - 0.2, cz);

    const cL = new THREE.PointLight(0x7dd3fc, 0.4, 14);
    cL.position.set(0, f * FLOOR_H + FLOOR_H - 0.3, cz); 
    containerGroup.add(cL);

    // Portes des appartements
    for (let a = 0; a < APTS_PER_FLOOR; a++) {
      const dx = -BLD_W / 2 + APT_W / 2 + a * APT_W;
      add(hpBox(1.15, FLOOR_H * 0.72, 0.18), new THREE.MeshStandardMaterial({ map: T.metal, color: 0x1a2535, metalness: 0.8, roughness: 0.2 }), dx, f * FLOOR_H + FLOOR_H * 0.36, -BLD_D / 2 + 2.49);
      add(hpBox(0.92, FLOOR_H * 0.68, 0.12), new THREE.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.15, metalness: 0.7 }), dx, f * FLOOR_H + FLOOR_H * 0.34, -BLD_D / 2 + 2.55);
      
      const knobGeo = new THREE.SphereGeometry(0.06, 8, 8);
      allocatedGeoms.add(knobGeo);
      add(knobGeo, M.gold, dx + 0.35, f * FLOOR_H + FLOOR_H * 0.38, -BLD_D / 2 + 2.62);
      add(hpBox(0.28, 0.14, 0.04), M.gold, dx + 0.35, f * FLOOR_H + FLOOR_H * 0.55, -BLD_D / 2 + 2.62);
    }
  }

  // ROOFTOP & INFRASTRUCTURES TECHNIQUES
  const roofY = FLOORS * FLOOR_H + 0.9;
  add(hpBox(BLD_W + 1.8, 1.0, BLD_D + 1.8, 4, 1, 2), M.slab, 0, roofY, 0);
  const parH = 1.2;
  [
    [BLD_W + 1.8, parH, 0.5, 0, roofY + parH / 2 + 0.5, BLD_D / 2 + 0.9],
    [BLD_W + 1.8, parH, 0.5, 0, roofY + parH / 2 + 0.5, -BLD_D / 2 - 0.9],
    [0.5, parH, BLD_D + 1.8, BLD_W / 2 + 0.9, roofY + parH / 2 + 0.5, 0],
    [0.5, parH, BLD_D + 1.8, -BLD_W / 2 - 0.9, roofY + parH / 2 + 0.5, 0],
  ].forEach(([pw, ph, pd, ppx, ppy, ppz]) => add(hpBox(pw, ph, pd), M.concreteMain, ppx, ppy, ppz));

  add(hpBox(8, 3.5, 5, 2, 2, 2), M.concretePanel, -3, roofY + 2.25, 0);
  add(hpBox(8.4, 0.25, 5.4, 2, 1, 2), M.slab, -3, roofY + 4.12, 0);

  const cyl1 = new THREE.CylinderGeometry(0.9, 1.15, 3.0, 16);
  allocatedGeoms.add(cyl1);
  add(cyl1, M.concreteDark, -BLD_W / 2 + 2.5, roofY + 2.5, -BLD_D / 2 + 2.5);

  const cone1 = new THREE.ConeGeometry(1.1, 1.4, 16);
  allocatedGeoms.add(cone1);
  add(cone1, new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.4, metalness: 0.5 }), -BLD_W / 2 + 2.5, roofY + 4.7, -BLD_D / 2 + 2.5);

  [[4, 2], [7, -1], [1, -2]].forEach(([hx, hz]) => {
    add(hpBox(2.5, 1.0, 1.8), new THREE.MeshStandardMaterial({ map: T.metal, color: 0x1e2a3a, metalness: 0.75, roughness: 0.3 }), hx, roofY + 1.0, hz);
    
    const cyl2 = new THREE.CylinderGeometry(0.3, 0.3, 0.7, 8);
    allocatedGeoms.add(cyl2);
    add(cyl2, new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.8, roughness: 0.2 }), hx, roofY + 1.85, hz);
  });

  // BLOCS D'APPARTEMENTS ADJACENTS
  [-1, 1].forEach((side) => {
    const sbH = FLOORS * FLOOR_H * 0.65;
    add(hpBox(5, sbH, BLD_D, 2, 4, 2), M.concreteMain, side * (BLD_W / 2 + 2.7), sbH / 2, 0);
    for (let f = 0; f < Math.floor(FLOORS * 0.65); f++) {
      for (let wx = 0; wx < 2; wx++) {
        add(hpBox(1.2, FLOOR_H * 0.4, 0.12), new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.25, roughness: 0.05 }), side * (BLD_W / 2 + 2.7) + (wx - 0.5) * 2, f * FLOOR_H + FLOOR_H / 2, BLD_D / 2 + 0.07);
      }
    }
  });

  // MOBILIER DE RUE & REVERBERES
  const lampM = new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.85, roughness: 0.2 });
  const bulbM = new THREE.MeshStandardMaterial({ color: 0xffd580, emissive: 0xffd580, emissiveIntensity: 1.2 });
  const lampGeo = new THREE.CylinderGeometry(0.06, 0.1, 6.5, 8);
  const armGeo = new THREE.BoxGeometry(2.5, 0.08, 0.08);
  const bulbGeo = new THREE.SphereGeometry(0.22, 8, 8);
  allocatedGeoms.add(lampGeo);
  allocatedGeoms.add(armGeo);
  allocatedGeoms.add(bulbGeo);

  [[-10, 22], [10, 22], [-10, 2], [10, 2]].forEach(([lx, lz]) => {
    add(lampGeo, lampM, lx, 3.25, lz);
    add(armGeo, lampM, lx + 1.25, 6.5, lz);
    add(bulbGeo, bulbM, lx + 2.5, 6.35, lz);
    const sL = new THREE.PointLight(0xffd580, 1.8, 18);
    sL.position.set(lx + 2.5, 6.2, lz); 
    containerGroup.add(sL);
  });

  const benchM = new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 0.8 });
  const benchSeatGeo = new THREE.BoxGeometry(2.2, 0.12, 0.5);
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8);
  allocatedGeoms.add(benchSeatGeo);
  allocatedGeoms.add(legGeo);

  [-14, 14].forEach((bx) => {
    [14, 20].forEach((bz) => {
      add(benchSeatGeo, benchM, bx, 0.55, bz);
      [[-0.8], [0.8]].forEach(([bzoff]) => {
        add(legGeo, M.gold, bx, 0.27, bz + bzoff);
      });
    });
  });

  return { windowMeshes, aptLights };
}

// ─── GENERATION DE LA CABINE D'ASCENSEUR ───
function createElevatorCar(M, T, containerGroup, allocatedGeoms) {
  const G = new THREE.Group();
  G.name = "ElevatorCar";

  const addG = (geo, mat, x, y, z, rx, ry, rz) => {
    allocatedGeoms.add(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    G.add(m); 
    return m;
  };

  const floorM = new THREE.MeshStandardMaterial({ map: T.marble, color: 0xd8c8a0, roughness: 0.12, metalness: 0.15 });
  const wallM  = new THREE.MeshStandardMaterial({ map: T.metal, color: 0x121820, roughness: 0.15, metalness: 0.9 });
  const goldM  = new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.92, roughness: 0.1 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.22, roughness: 0.03 });

  addG(hpBox(2.0, 0.12, 2.0), floorM, 0, 0.06, 0);
  addG(hpBox(2.0, 0.10, 2.0), wallM, 0, FLOOR_H * 0.88, 0);
  addG(hpBox(2.0, FLOOR_H * 0.86, 0.09), wallM, 0, FLOOR_H * 0.43, -0.95);
  addG(hpBox(0.09, FLOOR_H * 0.86, 2.0), wallM, -0.95, FLOOR_H * 0.43, 0);
  addG(hpBox(0.09, FLOOR_H * 0.86, 2.0), wallM, 0.95, FLOOR_H * 0.43, 0);
  addG(hpBox(1.8, FLOOR_H * 0.55, 0.07), glassM, 0, FLOOR_H * 0.5, 0.96);

  [[2.05, 0.08, 0.12, 0, FLOOR_H * 0.82, 0.96], [2.05, 0.08, 0.12, 0, 0.12, 0.96],
   [0.08, FLOOR_H * 0.82, 0.12, -0.98, FLOOR_H * 0.43, 0.96], [0.08, FLOOR_H * 0.82, 0.12, 0.98, FLOOR_H * 0.43, 0.96]
  ].forEach(([w, h, d, x, y, z]) => addG(hpBox(w, h, d), goldM, x, y, z));

  // Rampe
  const hR1 = new THREE.Mesh(this ? this._createGeometry(hpBox(1.6, 0.06, 0.06)) : hpBox(1.6, 0.06, 0.06), goldM); 
  hR1.position.set(0, 0.9, -0.9); 
  G.add(hR1);

  // Plafonnier
  const ledM = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xfff0d0, emissiveIntensity: 0.8 });
  const ledGeo = new THREE.BoxGeometry(1.5, 0.04, 1.5);
  allocatedGeoms.add(ledGeo);
  addG(ledGeo, ledM, 0, FLOOR_H * 0.87, 0);

  const iL = new THREE.PointLight(0xfff0d0, 1.0, 5); 
  iL.position.set(0, FLOOR_H * 0.75, 0); 
  G.add(iL);

  G.position.set(ELEV_X, 0.12, ELEV_Z);
  containerGroup.add(G);
  return G;
}

// ─── GENERATION DU HALL PRINCIPAL (LOBBY d'Hôtel) ───
function createLobby(M, T, containerGroup, allocatedGeoms) {
  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    allocatedGeoms.add(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true; 
    m.receiveShadow = true;
    containerGroup.add(m); 
    return m;
  };

  const marbleM   = new THREE.MeshStandardMaterial({ map: T.marble, normalMap: T.normalPanel, roughnessMap: T.roughSmooth, color: 0xe8d5b0, roughness: 0.1, metalness: 0.16, normalScale: new THREE.Vector2(0.25, 0.25) });
  const wallM     = new THREE.MeshStandardMaterial({ map: T.marble, normalMap: T.normalPanel, color: 0xd4c8a8, roughness: 0.35, metalness: 0.06 });
  const ceilM     = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.7 });
  const goldM     = new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.92, roughness: 0.1 });
  const darkM     = new THREE.MeshStandardMaterial({ color: 0x0a0f1a, roughness: 0.3, metalness: 0.6 });
  const glassM    = new THREE.MeshStandardMaterial({ map: T.glass, color: 0x7dd3fc, transparent: true, opacity: 0.22, roughness: 0.03 });
  const frameM    = new THREE.MeshStandardMaterial({ map: T.metal, color: 0x1a2535, metalness: 0.88, roughness: 0.18 });
  const sofaM     = new THREE.MeshStandardMaterial({ color: 0x1c140e, roughness: 0.85 });
  const cushM     = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.9 });
  const leatherM  = new THREE.MeshStandardMaterial({ color: 0x150d08, roughness: 0.75 });
  const colM      = new THREE.MeshStandardMaterial({ color: 0xb8a060, metalness: 0.78, roughness: 0.22 });
  const crystalM  = new THREE.MeshStandardMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.72, roughness: 0.0, metalness: 0.05 });
  const emissM    = new THREE.MeshStandardMaterial({ color: 0xffd580, emissive: 0xffd060, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.1 });
  const deskBodyM = new THREE.MeshStandardMaterial({ color: 0x0e1520, roughness: 0.2, metalness: 0.65 });
  const potM      = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.5, metalness: 0.4 });
  const leafM     = new THREE.MeshStandardMaterial({ color: 0x163518, roughness: 0.85 });
  const sconceM   = new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.9, roughness: 0.1 });
  const bulbM     = new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xfff0a0, emissiveIntensity: 1.5 });

  const LW = BLD_W + 1;

  // SOL & PLAFOND
  add(hpBox(LW, 0.22, LOBBY_D), marbleM, 0, 0.11, LOBBY_Z);
  add(hpBox(LW, 0.24, LOBBY_D), ceilM, 0, LOBBY_H - 0.12, LOBBY_Z);

  // MURS INTERIEURS
  add(hpBox(LW, LOBBY_H, 0.22), wallM, 0, LOBBY_H / 2, LOBBY_Z - LOBBY_D / 2);
  add(hpBox(0.22, LOBBY_H, LOBBY_D), wallM, -LW / 2, LOBBY_H / 2, LOBBY_Z);
  add(hpBox(0.22, LOBBY_H, LOBBY_D), wallM, LW / 2, LOBBY_H / 2, LOBBY_Z);

  // COLONNES & PILIERS D'ACCUEIL
  const colBaseGeo = new THREE.CylinderGeometry(0.28, 0.34, LOBBY_H - 0.38, 16, 2);
  const ringCapGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16);
  allocatedGeoms.add(colBaseGeo);
  allocatedGeoms.add(ringCapGeo);

  [[-7, LOBBY_Z - 1.5], [7, LOBBY_Z - 1.5], [-7, LOBBY_Z + 1.5], [7, LOBBY_Z + 1.5], [-7, LOBBY_Z + 3.8], [7, LOBBY_Z + 3.8]].forEach(([cx, cz]) => {
    add(colBaseGeo, colM, cx, (LOBBY_H - 0.38) / 2, cz);
    add(ringCapGeo, goldM, cx, LOBBY_H - 0.3, cz);
    add(ringCapGeo, goldM, cx, 0.11, cz);
  });

  // GRAND LUSTRE DU HALL
  const CY = LOBBY_H - 0.55, CZ = LOBBY_Z;
  const rodGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.4, 8);
  const coreGeo = new THREE.SphereGeometry(0.42, 16, 16);
  allocatedGeoms.add(rodGeo);
  allocatedGeoms.add(coreGeo);

  add(rodGeo, goldM, 0, CY - 0.5, CZ);
  add(coreGeo, emissM, 0, CY - 1.3, CZ);

  const ring1 = new THREE.TorusGeometry(0.9, 0.04, 6, 24);
  const ring2 = new THREE.TorusGeometry(1.6, 0.035, 6, 32);
  allocatedGeoms.add(ring1);
  allocatedGeoms.add(ring2);
  add(ring1, goldM, 0, CY - 1.3, CZ, Math.PI / 2, 0, 0);
  add(ring2, goldM, 0, CY - 1.3, CZ, Math.PI / 2, 0, 0);

  const cL1 = new THREE.PointLight(0xffd580, 5.5, 22); 
  cL1.position.set(0, CY - 1.4, CZ); 
  containerGroup.add(cL1);

  // BANQUE D'ACCUEIL (DESK)
  add(hpBox(7, 1.15, 1.1), deskBodyM, -2.5, 0.57, LOBBY_Z - 2.8);
  add(hpBox(7.15, 0.09, 1.25), marbleM, -2.5, 1.16, LOBBY_Z - 2.8);

  // FAUTEUILS & CANAPES
  const makeSofa = (px, pz, ry) => {
    const G2 = new THREE.Group();
    G2.name = "LobbySofa";
    const a2 = (geo, mat, x, y, z) => {
      allocatedGeoms.add(geo);
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; G2.add(m);
    };
    a2(hpBox(3.0, 0.5, 1.1), sofaM, 0, 0.25, 0);
    a2(hpBox(1.2, 0.2, 0.9), cushM, -0.88, 0.6, 0.05);
    a2(hpBox(1.2, 0.2, 0.9), cushM, 0.88, 0.6, 0.05);
    a2(hpBox(3.0, 0.7, 0.26), leatherM, 0, 0.7, -0.42);
    
    G2.position.set(px, 0, pz); 
    G2.rotation.y = ry || 0;
    containerGroup.add(G2);
  };
  makeSofa(2.0, LOBBY_Z + 0.3, 0);
  makeSofa(2.0, LOBBY_Z + 3.4, Math.PI);

  // JARDINIERES VERTIQUES & VEGETATION
  const potGeo = new THREE.CylinderGeometry(0.28, 0.2, 0.55, 12);
  const dirtGeo = new THREE.SphereGeometry(0.25, 8, 8);
  allocatedGeoms.add(potGeo);
  allocatedGeoms.add(dirtGeo);

  const plantPos = [[-9, LOBBY_Z - 1.5], [9, LOBBY_Z - 1.5], [-9, LOBBY_Z + 4.0], [9, LOBBY_Z + 4.0]];
  plantPos.forEach(([ppx, ppz]) => {
    add(potGeo, potM, ppx, 0.27, ppz);
    add(dirtGeo, new THREE.MeshStandardMaterial({ color: 0x2a1e0e, roughness: 1 }), ppx, 0.56, ppz);
  });

  // BAIES VITREES DU HALL
  add(hpBox(LW, LOBBY_H, 0.22), new THREE.MeshStandardMaterial({ color: 0x0e1520, roughness: 0.4 }), 0, LOBBY_H / 2, LOBBY_Z + LOBBY_D / 2);
  [-7, 0, 7].forEach((gx) => {
    add(hpBox(4.2, LOBBY_H * 0.76, 0.1), glassM, gx, LOBBY_H * 0.43, LOBBY_Z + LOBBY_D / 2 + 0.02);
    add(hpBox(4.4, 0.1, 0.2), frameM, gx, LOBBY_H * 0.82, LOBBY_Z + LOBBY_D / 2);
  });

  // PORTES AUTOMATIQUES
  add(hpBox(8.5, LOBBY_H * 0.84, 0.25), frameM, 0, LOBBY_H * 0.42, LOBBY_Z + LOBBY_D / 2 + 0.02);
  [-1.8, 1.8].forEach((dx) => {
    add(hpBox(3.0, LOBBY_H * 0.76, 0.08), glassM, dx, LOBBY_H * 0.42, LOBBY_Z + LOBBY_D / 2 + 0.04);
  });

  // CANOPY EXTERIEURE
  const caTex = makeConcreteHD(512, { baseR: 50, baseG: 54, baseB: 62, grainAmt: 2 });
  allocatedGeoms.add(caTex);
  add(hpBox(10, 0.22, 5), new THREE.MeshStandardMaterial({ map: caTex, color: 0x1c2535, roughness: 0.55 }), 0, LOBBY_H * 0.88, LOBBY_Z + LOBBY_D / 2 + 2.5);

  // PUITS D'ASCENSEUR DU REZ-DE-CHAUSSEE
  add(hpBox(2.8, FLOORS * FLOOR_H + 3, 2.8), new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.2, metalness: 0.8 }), ELEV_X, (FLOORS * FLOOR_H + 3) / 2, ELEV_Z);

  // SOURCES DE LUMIERE REPARTIES
  [[-5, LOBBY_Z - 1], [5, LOBBY_Z - 1], [0, LOBBY_Z + 3.5]].forEach(([lx, lz]) => {
    const aL = new THREE.PointLight(0xffeedd, 1.1, 15); 
    aL.position.set(lx, LOBBY_H * 0.7, lz); 
    containerGroup.add(aL);
  });
}

// ─── COMPOSANT REACT PRINCIPAL ───
export default function ApartmentBuilding() {
  const mountRef    = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef   = useRef(null);
  const sceneRef    = useRef(null);
  const bldGroupRef = useRef(null);
  const elevRef     = useRef(null);
  const winsRef     = useRef(null);
  const lightsRef   = useRef(null);
  const frameRef    = useRef(null);
  const isDragRef   = useRef(false);
  const lastMRef    = useRef({ x: 0, y: 0 });
  const camRef      = useRef({ theta: 0.42, phi: 0.30, r: 62 });

  const allocatedGeomsRef = useRef(new Set());

  const [elevFloor, setElevFloor]     = useState(0);
  const [targetFloor, setTargetFloor] = useState(0);
  const [isMoving, setIsMoving]       = useState(false);
  const [selectedApt, setSelectedApt] = useState(null);
  const [panelOpen, setPanelOpen]     = useState(false);
  const [time, setTime]               = useState(new Date());

  const [litStates, setLitStates] = useState(() =>
    Array.from({ length: FLOORS }, () => Array.from({ length: APTS_PER_FLOOR }, () => Math.random() > 0.35))
  );

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleLight = useCallback((f, a) => {
    setLitStates((prev) => {
      const n = prev.map((r) => [...r]);
      n[f][a] = !n[f][a];
      return n;
    });
  }, []);

  useEffect(() => {
    if (!winsRef.current || !lightsRef.current) return;
    litStates.forEach((row, f) =>
      row.forEach((lit, a) => {
        const w = winsRef.current[f]?.[a];
        const l = lightsRef.current[f]?.[a];
        if (w) {
          w.material.emissive.setHex(lit ? LIGHT_ON : LIGHT_OFF);
          w.material.emissiveIntensity = lit ? 0.65 : 0;
        }
        if (l) l.intensity = lit ? 0.9 : 0;
      })
    );
  }, [litStates]);

  useEffect(() => {
    if (targetFloor === elevFloor) return;
    setIsMoving(true);
    const iv = setInterval(() => {
      setElevFloor((prev) => {
        const diff = targetFloor - prev;
        if (Math.abs(diff) < 0.04) {
          clearInterval(iv);
          setIsMoving(false);
          return targetFloor;
        }
        return prev + diff * 0.055;
      });
    }, 16);
    return () => clearInterval(iv);
  }, [targetFloor, elevFloor]);

  useEffect(() => {
    if (elevRef.current) {
      elevRef.current.position.y = elevFloor * FLOOR_H + 0.12;
    }
  }, [elevFloor]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth, H = mount.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x020509);
    scene.fog = new THREE.FogExp2(0x020509, 0.009);

    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 400);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0x1a2030, 1.8));
    scene.add(new THREE.HemisphereLight(0x2244aa, 0x332211, 0.55));

    const moon = new THREE.DirectionalLight(0xc0d0ff, 0.6);
    moon.position.set(-25, 50, 30);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    scene.add(moon);

    const containerGroup = new THREE.Group();
    containerGroup.name = "ComplexeEther";
    scene.add(containerGroup);
    bldGroupRef.current = containerGroup;

    const T = getTextures();
    const mk = (o) => new THREE.MeshStandardMaterial(o);

    const M = {
      concreteMain:  mk({ map: T.concreteMain, normalMap: T.normalMain, roughnessMap: T.roughMain, color: 0x9a9fa8, roughness: 0.85, metalness: 0.04 }),
      concreteDark:  mk({ map: T.concreteDark, normalMap: T.normalMain, roughnessMap: T.roughMain, color: 0x6a7080, roughness: 0.9, metalness: 0.02 }),
      concreteLight: mk({ map: T.concreteLight, normalMap: T.normalPanel, roughnessMap: T.roughMain, color: 0xb0b5be, roughness: 0.82, metalness: 0.03 }),
      concretePanel: mk({ map: T.concretePanel, normalMap: T.normalPanel, roughnessMap: T.roughMain, color: 0x8e939c, roughness: 0.88, metalness: 0.03 }),
      slab:          mk({ map: T.concreteDark, normalMap: T.normalMain, roughnessMap: T.roughMain, color: 0x5a6070, roughness: 0.9, metalness: 0.03 }),
      marble:        mk({ map: T.marble, normalMap: T.normalPanel, roughnessMap: T.roughSmooth, color: 0xe8d5b0, roughness: 0.12, metalness: 0.14 }),
      asphalt:       mk({ map: T.asphalt, color: 0x1a1b20, roughness: 0.96, metalness: 0.0 }),
      glass:         mk({ map: T.glass, color: 0x7dd3fc, transparent: true, opacity: 0.28, roughness: 0.04, metalness: 0.1 }),
      metal:         mk({ map: T.metal, color: 0x2a3040, roughness: 0.25, metalness: 0.85 }),
      gold:          mk({ color: 0xc9a84c, metalness: 0.92, roughness: 0.12 }),
      frame:         mk({ color: 0x1a2535, roughness: 0.2, metalness: 0.85 }),
    };

    const allocatedGeoms = allocatedGeomsRef.current;

    const { windowMeshes, aptLights } = createBuilding(containerGroup, M, T, containerGroup, allocatedGeoms);
    winsRef.current = windowMeshes;
    lightsRef.current = aptLights;

    createLobby(M, T, containerGroup, allocatedGeoms);
    elevRef.current = createElevatorCar(M, T, containerGroup, allocatedGeoms);

    // Étoiles d'arrière plan
    const sPos = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      sPos[i * 3] = (Math.random() - 0.5) * 280;
      sPos[i * 3 + 1] = Math.random() * 100 + 20;
      sPos[i * 3 + 2] = (Math.random() - 0.5) * 280;
    }
    const sGeo = new THREE.BufferGeometry();
    allocatedGeoms.add(sGeo);
    sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    const starPoints = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, sizeAttenuation: true }));
    scene.add(starPoints);

    const updateCam = () => {
      const { theta, phi, r } = camRef.current;
      camera.position.set(
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.sin(phi) + 10,
        r * Math.cos(theta) * Math.cos(phi)
      );
      camera.lookAt(0, FLOORS * FLOOR_H * 0.5, 4);
    };
    updateCam();

    const onDown = (e) => {
      isDragRef.current = true;
      lastMRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMove = (e) => {
      if (!isDragRef.current) return;
      camRef.current.theta -= (e.clientX - lastMRef.current.x) * 0.005;
      camRef.current.phi = Math.max(0.05, Math.min(1.25, camRef.current.phi - (e.clientY - lastMRef.current.y) * 0.005));
      lastMRef.current = { x: e.clientX, y: e.clientY };
      updateCam();
    };

    const onUp = () => {
      isDragRef.current = false;
    };

    const onWheel = (e) => {
      camRef.current.r = Math.max(18, Math.min(120, camRef.current.r + e.deltaY * 0.05));
      updateCam();
    };

    const raycaster = new THREE.Raycaster();
    const onClick = (e) => {
      const rect = mount.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera({ x: mx, y: my }, camera);
      const intersects = raycaster.intersectObjects(containerGroup.children, true);
      for (const h of intersects) {
        if (h.object.userData.type === "window") {
          const { floor, apt } = h.object.userData;
          toggleLight(floor, apt);
          setSelectedApt({ floor, apt });
          break;
        }
      }
    };

    mount.addEventListener("mousedown", onDown);
    mount.addEventListener("mousemove", onMove);
    mount.addEventListener("mouseup", onUp);
    mount.addEventListener("wheel", onWheel, { passive: true });
    mount.addEventListener("click", onClick);

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      camRef.current.theta += 0.00015;
      updateCam();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nW = mount.clientWidth, nH = mount.clientHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      mount.removeEventListener("mousedown", onDown);
      mount.removeEventListener("mousemove", onMove);
      mount.removeEventListener("mouseup", onUp);
      mount.removeEventListener("wheel", onWheel);
      mount.removeEventListener("click", onClick);

      // Libération propre des matériaux
      containerGroup.traverse((obj) => {
        if (obj.isMesh) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      // Libération des géométries
      allocatedGeoms.forEach((geo) => {
        try { geo.dispose(); } catch (err) { /* ignore */ }
      });
      allocatedGeoms.clear();

      clearCachedTextures();

      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const litCount = litStates.flat().filter(Boolean).length;

  const S = {
    root:   { width:"100vw", height:"100vh", background:"#020509", position:"relative", overflow:"hidden", fontFamily:"'JetBrains Mono','Courier New',monospace" },
    canvas: { width:"100%", height:"100%", cursor:"grab" },
    badge:  { position:"absolute", top:16, left:20, pointerEvents:"none" },
    clock:  { position:"absolute", top:16, right:20, textAlign:"right", pointerEvents:"none" },
    fab:    { position:"absolute", bottom:24, right:24, background:"rgba(2,5,9,0.92)", border:"1px solid rgba(125,211,252,0.3)", borderRadius:12, color:"#7dd3fc", padding:"10px 18px", cursor:"pointer", fontSize:11, letterSpacing:2, backdropFilter:"blur(8px)", display:"flex", alignItems:"center", gap:8, zIndex:10 },
    drawer: (open) => ({ position:"absolute", bottom:0, left:0, right:0, background:"rgba(2,5,9,0.97)", borderTop:"1px solid rgba(125,211,252,0.15)", backdropFilter:"blur(14px)", transform:open?"translateY(0)":"translateY(100%)", transition:"transform 0.35s cubic-bezier(0.4,0,0.2,1)", padding:"18px 24px 24px", zIndex:9 }),
    hint:   { position:"absolute", bottom:70, left:20, color:"#1e293b", fontSize:9, letterSpacing:2, lineHeight:1.8, pointerEvents:"none" },
  };

  return (
    <div style={S.root}>
      <div ref={mountRef} style={S.canvas} />

      <div style={S.badge}>
        <div style={{ color:"#7dd3fc", fontSize:10, letterSpacing:3, textTransform:"uppercase" }}>RÉSIDENCE ÉTHER</div>
        <div style={{ color:"#c9a84c", fontSize:18, fontWeight:700 }}>BLOC MONTRÉAL</div>
      </div>

      <div style={S.clock}>
        <div style={{ color:"#7dd3fc", fontSize:20, fontWeight:700 }}>{time.toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
        <div style={{ color:"#334155", fontSize:9, letterSpacing:2 }}>{time.toLocaleDateString("fr-CA",{weekday:"long",day:"numeric",month:"long"}).toUpperCase()}</div>
      </div>

      <div style={S.hint}>DRAG · SCROLL · CLIC FENÊTRE</div>

      <button style={S.fab} onClick={() => setPanelOpen(o => !o)}>
        <span style={{ fontSize:14 }}>{panelOpen ? "✕" : "⚙"}</span>
        {panelOpen ? "FERMER" : "CONTRÔLES"}
      </button>

      <div style={S.drawer(panelOpen)}>
        <div style={{ width:40, height:3, background:"rgba(125,211,252,0.18)", borderRadius:2, margin:"0 auto 16px" }} />
        <div style={{ display:"grid", gridTemplateColumns:"130px 1fr", gap:24, maxHeight:260, overflowY:"auto" }}>
          <div>
            <div style={{ color:"#7dd3fc", fontSize:9, letterSpacing:3, textTransform:"uppercase", marginBottom:10 }}>ASCENSEUR</div>
            <div style={{ background:"#0a0e1a", border:"1px solid rgba(125,211,252,0.25)", borderRadius:6, padding:"6px 10px", textAlign:"center", marginBottom:10 }}>
              <div style={{ color:"#334155", fontSize:9 }}>ÉTAGE</div>
              <div style={{ color:"#7dd3fc", fontSize:28, fontWeight:700, lineHeight:1 }}>{isMoving ? Math.round(elevFloor) : targetFloor}</div>
              {isMoving && <div style={{ color:"#c9a84c", fontSize:9, marginTop:2 }}>{targetFloor > elevFloor ? "▲" : "▼"} MOUVEMENT</div>}
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
              {Array.from({ length:FLOORS }, (_, i) => FLOORS-1-i).map(f => (
                <button key={f} onClick={() => setTargetFloor(f)} style={{ background:targetFloor===f?"rgba(125,211,252,0.2)":"rgba(255,255,255,0.04)", border:targetFloor===f?"1px solid rgba(125,211,252,0.6)":"1px solid rgba(255,255,255,0.06)", borderRadius:5, color:targetFloor===f?"#7dd3fc":"#475569", padding:"4px 8px", cursor:"pointer", fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>
                  {f===0?"RDC":`É${f}`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ color:"#c9a84c", fontSize:9, letterSpacing:3, textTransform:"uppercase" }}>LUMIÈRES</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:"#ffd580", fontSize:11, fontWeight:700 }}>{litCount}/{FLOORS*APTS_PER_FLOOR}</span>
                <div style={{ width:80, height:3, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${(litCount/(FLOORS*APTS_PER_FLOOR))*100}%`, background:"linear-gradient(90deg,#c9a84c,#ffd580)", borderRadius:2, transition:"width 0.3s" }} />
                </div>
              </div>
            </div>
            {Array.from({ length:FLOORS }, (_, fi) => FLOORS-1-fi).map(floor => (
              <div key={floor} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <span style={{ color:"#334155", fontSize:9, width:34, textAlign:"right", letterSpacing:1, flexShrink:0 }}>{floor===0?"RDC":`É${floor}`}</span>
                <div style={{ display:"flex", gap:4, flex:1 }}>
                  {Array.from({ length:APTS_PER_FLOOR }, (_, a) => (
                    <button key={a} onClick={() => toggleLight(floor, a)}
                      style={{ flex:1, height:22, background:litStates[floor]?.[a]?"rgba(255,213,128,0.3)":"rgba(255,255,255,0.03)", border:litStates[floor]?.[a]?"1px solid rgba(255,213,128,0.55)":"1px solid rgba(255,255,255,0.06)", borderRadius:3, cursor:"pointer", transition:"all 0.18s", boxShadow:litStates[floor]?.[a]?"0 0 7px rgba(255,213,128,0.35)":"none", fontSize:8, color:litStates[floor]?.[a]?"#ffd580":"#334155", fontFamily:"'JetBrains Mono',monospace" }}>
                      {String.fromCharCode(65+a)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedApt && !panelOpen && (
        <div style={{ position:"absolute", bottom:80, left:"50%", transform:"translateX(-50%)", background:"rgba(2,5,9,0.95)", border:"1px solid rgba(125,211,252,0.25)", borderRadius:10, padding:"9px 20px", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", gap:16, whiteSpace:"nowrap", zIndex:11 }}>
          <div>
            <div style={{ color:"#475569", fontSize:9, letterSpacing:2 }}>UNITÉ</div>
            <div style={{ color:"#7dd3fc", fontSize:14, fontWeight:700 }}>{selectedApt.floor===0?"RDC":`É${selectedApt.floor}`} — Apt {String.fromCharCode(65+selectedApt.apt)}</div>
          </div>
          <div style={{ width:1, height:28, background:"rgba(255,255,255,0.07)" }} />
          <div style={{ color:litStates[selectedApt.floor]?.[selectedApt.apt]?"#ffd580":"#475569", fontSize:11, fontWeight:600 }}>
            {litStates[selectedApt.floor]?.[selectedApt.apt] ? "● ALLUMÉE" : "○ ÉTEINTE"}
          </div>
          <button onClick={() => toggleLight(selectedApt.floor, selectedApt.apt)}
            style={{ background:"rgba(125,211,252,0.08)", border:"1px solid rgba(125,211,252,0.25)", borderRadius:5, color:"#7dd3fc", padding:"5px 12px", cursor:"pointer", fontSize:10, fontFamily:"'JetBrains Mono',monospace" }}>
            TOGGLE
          </button>
          <button onClick={() => setSelectedApt(null)} style={{ background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:15 }}>✕</button>
        </div>
      )}
    </div>
  );
}
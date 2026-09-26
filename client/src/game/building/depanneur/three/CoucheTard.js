// src/game/building/depanneur/three/CoucheTard.js
import * as THREE from 'three';

/** Helpers courts pour rester lisible */
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);

function mesh(geo, mat, { pos = [0, 0, 0], rot = null, cast = false, receive = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function CoucheTard({ position = [18, 0, -48] } = {}) {
  const g = new THREE.Group();
  g.position.set(...position);
  g.add(BuildingStructure());
  g.add(GasCanopy());
  g.add(GasPumps());
  g.add(CoucheTardSignage());
  g.add(ParkingLot());
  g.add(ExteriorLighting());
  return g;
}

function BuildingStructure() {
  const g = new THREE.Group();

  // Bâtiment principal
  g.add(mesh(box(12, 6, 12), std('#8B3A3A', { roughness: 0.9 }), { pos: [0, 3, 0], cast: true, receive: true }));
  // Toit
  g.add(mesh(box(12.5, 0.4, 12.5), std('#2a2a2a', { roughness: 0.8 }), { pos: [0, 6.2, 0], cast: true }));

  // Vitrines avant
  [-3, 0, 3].forEach((x) => {
    g.add(mesh(box(2.5, 4, 0.1), std('#1e3a5f', {
      transparent: true, opacity: 0.5, metalness: 0.8, roughness: 0.1,
      emissive: '#ffd580', emissiveIntensity: 0.3,
    }), { pos: [x, 3, 6.05], cast: true }));
  });

  // Porte vitrée
  g.add(mesh(box(2, 4, 0.05), std('#87CEEB', {
    transparent: true, opacity: 0.4, metalness: 0.9, roughness: 0.05,
    emissive: '#ffd580', emissiveIntensity: 0.4,
  }), { pos: [0, 2, 6.1], cast: true }));

  // Cadre de porte
  g.add(mesh(box(2.2, 4.2, 0.02), std('#333333', { metalness: 0.5 }), { pos: [0, 2, 6.12] }));

  // Lumière intérieure
  const light = new THREE.PointLight('#fef3c7', 3, 15);
  light.position.set(0, 4, 0);
  g.add(light);

  // Affiches promo
  [-3, 3].forEach((x, i) => {
    const c = i === 0 ? '#ED1C24' : '#FFD700';
    g.add(mesh(box(1.2, 0.8, 0.01), std(c, { emissive: c, emissiveIntensity: 0.3 }), { pos: [x, 2.5, 6.08] }));
  });

  // Accent brique côté
  [6.05, -6.05].forEach((x) => {
    g.add(mesh(box(0.1, 1, 12), std('#6B2A2A', { roughness: 0.95 }), { pos: [x, 5, 0] }));
  });

  return g;
}

function GasCanopy() {
  const g = new THREE.Group();
  g.position.set(0, 0, 14);

  g.add(mesh(box(16, 0.4, 10), std('#ffffff', { roughness: 0.5 }), { pos: [0, 5.5, 0], cast: true }));

  [5, -5].forEach((z) => {
    g.add(mesh(box(16, 0.08, 0.3), std('#ED1C24', { emissive: '#ED1C24', emissiveIntensity: 0.5 }), { pos: [0, 5.28, z] }));
  });

  [[-6, -4], [-6, 4], [6, -4], [6, 4]].forEach(([x, z]) => {
    g.add(mesh(box(0.4, 5.5, 0.4), std('#d0d0d0', { roughness: 0.5, metalness: 0.3 }), { pos: [x, 2.75, z], cast: true }));
  });

  g.add(mesh(box(14, 0.05, 8), std('#fff8e0', { emissive: '#fff8e0', emissiveIntensity: 2.5 }), { pos: [0, 5.25, 0] }));

  const l1 = new THREE.PointLight('#fff8e0', 4, 12); l1.position.set(0, 5, 0); l1.castShadow = true; g.add(l1);
  const l2 = new THREE.PointLight('#fff8e0', 2, 10); l2.position.set(-5, 5, 0); g.add(l2);
  const l3 = new THREE.PointLight('#fff8e0', 2, 10); l3.position.set(5, 5, 0); g.add(l3);

  return g;
}

function GasPumps() {
  const g = new THREE.Group();
  g.position.set(0, 0, 14);

  [-3.75, -1.25, 1.25, 3.75].forEach((x) => {
    g.add(GasPump([x, 0, 0]));
  });

  g.add(mesh(box(12, 0.2, 3), std('#d0d0d0', { roughness: 0.7 }), { pos: [0, 0.1, 0], receive: true }));
  return g;
}

function GasPump(position) {
  const g = new THREE.Group();
  g.position.set(...position);

  g.add(mesh(box(0.8, 2.2, 0.6), std('#e0e0e0', { roughness: 0.6, metalness: 0.2 }), { pos: [0, 1.2, 0], cast: true }));
  g.add(mesh(box(0.5, 0.4, 0.02), std('#000000'), { pos: [0, 1.6, 0.31] }));
  g.add(mesh(box(0.45, 0.35, 0.01), std('#00ff00', { emissive: '#00ff00', emissiveIntensity: 0.5 }), { pos: [0, 1.6, 0.32] }));
  g.add(mesh(box(0.15, 0.4, 0.08), std('#333333'), { pos: [0.3, 1.0, 0.31] }));
  g.add(mesh(cyl(0.03, 0.02, 0.3), std('#1a1a1a', { metalness: 0.7, roughness: 0.3 }), { pos: [0.35, 0.8, 0.35], rot: [0, 0, -0.3] }));
  g.add(mesh(box(0.6, 0.15, 0.02), std('#ED1C24', { emissive: '#ED1C24', emissiveIntensity: 0.4 }), { pos: [0, 2.0, 0.31] }));
  g.add(mesh(box(0.85, 0.1, 0.65), std('#c0c0c0', { metalness: 0.3 }), { pos: [0, 2.35, 0], cast: true }));

  return g;
}

function CoucheTardSignage() {
  const g = new THREE.Group();

  // Enseigne toit
  const roof = new THREE.Group(); roof.position.set(0, 7, 6);
  roof.add(mesh(box(8, 1.5, 0.3), std('#ED1C24', { emissive: '#ED1C24', emissiveIntensity: 2, roughness: 0.5 }), { cast: true }));
  roof.add(mesh(box(7, 0.8, 0.05), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.5 }), { pos: [0, 0, 0.16] }));
  roof.add(mesh(box(0.6, 0.6, 0.05), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 2 }), { pos: [-3.5, 0, 0.16] }));
  const rl = new THREE.PointLight('#ED1C24', 4, 20); rl.position.set(0, 0, 1); roof.add(rl);
  g.add(roof);

  // Bannière 24h
  g.add(mesh(box(4, 0.6, 0.1), std('#00AA00', { emissive: '#00AA00', emissiveIntensity: 1 }), { pos: [0, 0.5, 6.1] }));
  g.add(mesh(box(3.5, 0.35, 0.02), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.8 }), { pos: [0, 0.5, 6.16] }));

  // Enseigne poteau
  const pole = new THREE.Group(); pole.position.set(14, 0, 14);
  pole.add(mesh(cyl(0.2, 0.25, 10, 8), std('#555555', { metalness: 0.5, roughness: 0.4 }), { pos: [0, 5, 0], cast: true }));
  pole.add(mesh(box(4, 3, 0.3), std('#ED1C24', { emissive: '#ED1C24', emissiveIntensity: 1.5 }), { pos: [0, 10, 0], cast: true }));
  pole.add(mesh(box(3.2, 2, 0.05), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1 }), { pos: [0, 10, 0.16] }));
  pole.add(mesh(box(3.5, 1.2, 0.05), std('#000000'), { pos: [0, 8, 0.16] }));
  pole.add(mesh(box(3, 0.8, 0.02), std('#ff0000', { emissive: '#ff0000', emissiveIntensity: 1 }), { pos: [0, 8, 0.2] }));
  const pl = new THREE.PointLight('#ED1C24', 3, 25); pl.position.set(0, 10, 2); pole.add(pl);
  g.add(pole);

  return g;
}

function ParkingLot() {
  const g = new THREE.Group();
  g.position.set(0, -0.05, -8);

  g.add(mesh(new THREE.PlaneGeometry(20, 12), std('#2a2a2a', { roughness: 0.95 }), { rot: [-Math.PI / 2, 0, 0], receive: true }));

  for (let i = 0; i < 8; i++) {
    g.add(mesh(new THREE.PlaneGeometry(0.1, 5), std('#ffffff'), { pos: [-8 + i * 2.5, 0.01, 0], rot: [-Math.PI / 2, 0, 0] }));
  }
  for (let i = 0; i < 7; i++) {
    g.add(mesh(box(1.5, 0.15, 0.3), std('#ffcc00'), { pos: [-6.75 + i * 2.5, 0.1, 2] }));
  }
  return g;
}

function ExteriorLighting() {
  const g = new THREE.Group();
  const posts = [[-8, 0, -14], [8, 0, -14], [-8, 0, 22], [8, 0, 22]];

  posts.forEach(([x, y, z]) => {
    const p = new THREE.Group(); p.position.set(x, y, z);
    p.add(mesh(cyl(0.08, 0.1, 7, 6), std('#4a4a4a', { metalness: 0.5 }), { pos: [0, 3.5, 0], cast: true }));
    p.add(mesh(box(0.5, 0.2, 0.5), std('#fff8e0', { emissive: '#fff8e0', emissiveIntensity: 1.5 }), { pos: [0, 7, 0] }));
    const l = new THREE.PointLight('#fff8e0', 3.5, 20); l.position.set(0, 6.8, 0); l.castShadow = true; p.add(l);
    g.add(p);
  });

  return g;
}
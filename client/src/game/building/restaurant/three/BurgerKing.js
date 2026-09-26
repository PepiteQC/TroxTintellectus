// src/game/building/restaurant/three/BurgerKing.js
import * as THREE from 'three';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const plane = (w, h) => new THREE.PlaneGeometry(w, h);
const circle = (r, s = 16) => new THREE.CircleGeometry(r, s);
const sphere = (r, ws = 6, hs = 5) => new THREE.SphereGeometry(r, ws, hs);

function mesh(geo, mat, { pos = [0, 0, 0], rot = null, cast = false, receive = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
const point = (color, intensity, distance, pos) => {
  const l = new THREE.PointLight(color, intensity, distance);
  l.position.set(...pos);
  return l;
};

export function BurgerKing({ position = [50, 0, -100] } = {}) {
  const g = new THREE.Group();
  g.position.set(...position);
  g.add(Restaurant());
  g.add(BKSignage());
  g.add(DriveThru());
  g.add(Playground());
  g.add(BKParkingLot());
  g.add(BKLighting());
  return g;
}

function Restaurant() {
  const g = new THREE.Group();

  g.add(mesh(box(16, 6, 14), std('#f7e8b5', { roughness: 0.8 }), { pos: [0, 3, 0], cast: true, receive: true }));
  g.add(mesh(box(17, 0.6, 15), std('#8B4513', { roughness: 0.7 }), { pos: [0, 6.3, 0], cast: true }));
  g.add(mesh(box(16.1, 0.5, 14.1), std('#d62300', { roughness: 0.7 }), { pos: [0, 5.5, 0] }));

  [-5, -2, 1, 4].forEach((x) => {
    g.add(mesh(box(2.5, 4, 0.1), std('#1e3a5f', {
      transparent: true, opacity: 0.5, metalness: 0.8, roughness: 0.1,
      emissive: '#ffd580', emissiveIntensity: 0.3,
    }), { pos: [x, 3, 7.05], cast: true }));
  });

  g.add(mesh(box(2.5, 4.2, 0.05), std('#87CEEB', {
    transparent: true, opacity: 0.35, metalness: 0.9, roughness: 0.05,
    emissive: '#ffd580', emissiveIntensity: 0.4,
  }), { pos: [-1, 2.2, 7.1] }));
  g.add(mesh(box(2.7, 4.4, 0.02), std('#333333', { metalness: 0.5 }), { pos: [-1, 2.2, 7.12] }));

  [-4, -1, 2, 5].forEach((z) => {
    g.add(mesh(box(0.1, 3, 2), std('#1e3a5f', {
      transparent: true, opacity: 0.5, emissive: '#ffd580', emissiveIntensity: 0.2,
    }), { pos: [8.05, 3, z] }));
  });

  g.add(point('#fef3c7', 3, 18, [0, 4, 0]));
  g.add(point('#fef3c7', 1.5, 10, [-4, 4, 3]));
  g.add(point('#fef3c7', 1.5, 10, [4, 4, 3]));

  g.add(mesh(box(10, 1.2, 1), std('#5a3a1a', { roughness: 0.8 }), { pos: [0, 1.5, -2], cast: true }));

  [-3, 0, 3].forEach((x) => {
    g.add(mesh(box(2.5, 2, 0.1), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.5 }), { pos: [x, 4, -5], cast: true }));
  });

  return g;
}

function BKSignage() {
  const g = new THREE.Group();

  const sign = new THREE.Group(); sign.position.set(12, 0, 12);
  sign.add(mesh(cyl(0.25, 0.3, 7, 8), std('#555555', { metalness: 0.5, roughness: 0.4 }), { pos: [0, 3.5, 0], cast: true }));
  sign.add(mesh(box(4, 3.5, 0.4), std('#d62300', { roughness: 0.6 }), { pos: [0, 8, 0], cast: true }));
  sign.add(mesh(cyl(1.3, 1.3, 0.1, 16), std('#f7e8b5', { emissive: '#f7e8b5', emissiveIntensity: 1.5 }), { pos: [0, 8.5, 0.21], rot: [Math.PI / 2, 0, 0] }));
  sign.add(mesh(box(1.8, 0.3, 0.05), std('#d62300', { emissive: '#d62300', emissiveIntensity: 1 }), { pos: [0, 8.9, 0.27] }));
  sign.add(mesh(box(1.8, 0.3, 0.05), std('#d62300', { emissive: '#d62300', emissiveIntensity: 1 }), { pos: [0, 8.1, 0.27] }));
  sign.add(mesh(box(3.5, 0.6, 0.05), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.2 }), { pos: [0, 7, 0.21] }));
  sign.add(point('#d62300', 5, 30, [0, 8, 2]));
  sign.add(point('#f7e8b5', 3, 20, [0, 8, -2]));
  g.add(sign);

  g.add(mesh(box(6, 1, 0.2), std('#d62300', { roughness: 0.5 }), { pos: [0, 5.8, 7.2], cast: true }));
  g.add(mesh(box(5.5, 0.6, 0.02), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1 }), { pos: [0, 5.8, 7.31] }));
  g.add(point('#ffffff', 2, 10, [0, 5.8, 8]));

  return g;
}

function DriveThru() {
  const g = new THREE.Group();
  g.position.set(-10, 0, -3);

  g.add(mesh(plane(4, 20), std('#3a3a3a', { roughness: 0.9 }), { pos: [0, 0.01, 0], rot: [-Math.PI / 2, 0, 0], receive: true }));
  [-5, 0, 5].forEach((z) => {
    g.add(mesh(plane(0.8, 1.5), std('#ffffff'), { pos: [0, 0.02, z], rot: [-Math.PI / 2, 0, 0] }));
  });
  g.add(mesh(box(0.3, 0.3, 20), std('#888888'), { pos: [2, 0.15, 0] }));

  // Panneau menu
  const menu = new THREE.Group(); menu.position.set(2.5, 0, -4);
  menu.add(mesh(box(0.2, 3, 0.2), std('#333333'), { pos: [0, 1.5, 0], cast: true }));
  menu.add(mesh(box(2.5, 2.5, 0.2), std('#1a1a1a'), { pos: [0, 2.5, 0], cast: true }));
  menu.add(mesh(box(2.2, 2.2, 0.02), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.8 }), { pos: [0, 2.5, 0.11] }));
  [0.6, 0, -0.6].forEach((y, i) => {
    const c = i === 0 ? '#d62300' : i === 1 ? '#f7e8b5' : '#00AA00';
    menu.add(mesh(box(1.8, 0.4, 0.01), std(c, { emissive: c, emissiveIntensity: 0.3 }), { pos: [0, 2.5 + y, 0.13] }));
  });
  menu.add(point('#ffffff', 1, 5, [0, 2.5, 1]));
  g.add(menu);

  // Poste speaker
  const speaker = new THREE.Group(); speaker.position.set(2.5, 0, -2);
  speaker.add(mesh(cyl(0.08, 0.08, 2, 6), std('#333333', { metalness: 0.5 }), { pos: [0, 1, 0], cast: true }));
  speaker.add(mesh(box(0.3, 0.4, 0.15), std('#1a1a1a'), { pos: [0, 1.5, 0], cast: true }));
  speaker.add(mesh(box(0.25, 0.3, 0.01), std('#555555', { metalness: 0.7 }), { pos: [0, 1.5, 0.08] }));
  g.add(speaker);

  // Auvent service
  const canopy = new THREE.Group(); canopy.position.set(-8, 4, 3);
  canopy.add(mesh(box(3, 0.2, 2), std('#d62300'), { cast: true }));
  canopy.add(point('#fff8e0', 1.5, 5, [0, -0.3, 0]));
  g.add(canopy);

  // Flèches directionnelles
  [-7, -3, 1].forEach((z) => {
    const arrow = new THREE.Group(); arrow.position.set(-2.5, 0, z);
    arrow.add(mesh(cyl(0.04, 0.04, 1, 6), std('#333333'), { pos: [0, 0.5, 0], cast: true }));
    arrow.add(mesh(box(0.6, 0.4, 0.05), std('#d62300', { emissive: '#d62300', emissiveIntensity: 0.5 }), { pos: [0, 1, 0] }));
    g.add(arrow);
  });

  return g;
}

function Playground() {
  const g = new THREE.Group();
  g.position.set(12, 0, -4);

  g.add(mesh(circle(4, 16), std('#d4a574', { roughness: 1 }), { pos: [0, 0.02, 0], rot: [-Math.PI / 2, 0, 0], receive: true }));

  // Clôture
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(mesh(cyl(0.04, 0.04, 1, 4), std('#888888', { metalness: 0.5 }), { pos: [Math.cos(a) * 4, 0.5, Math.sin(a) * 4], cast: true }));
  }
  for (let i = 0; i < 16; i++) {
    const a1 = (i / 16) * Math.PI * 2;
    const a2 = ((i + 1) / 16) * Math.PI * 2;
    const x = (Math.cos(a1) * 4 + Math.cos(a2) * 4) / 2;
    const z = (Math.sin(a1) * 4 + Math.sin(a2) * 4) / 2;
    g.add(mesh(box(1.6, 0.06, 0.06), std('#888888', { metalness: 0.5 }), { pos: [x, 0.8, z], rot: [0, -a1 - Math.PI / 16, 0] }));
  }

  // Glissade
  const slide = new THREE.Group(); slide.position.set(-1, 0, 0);
  slide.add(mesh(box(2, 0.2, 2), std('#d62300'), { pos: [0, 2, 0], cast: true }));
  slide.add(mesh(box(0.8, 2, 0.1), std('#FFD700', { metalness: 0.3 }), { pos: [0, 1, -1], cast: true }));
  [0.5, 1, 1.5].forEach((y) => {
    slide.add(mesh(box(0.8, 0.08, 0.15), std('#FFD700', { metalness: 0.3 }), { pos: [0, y, -1] }));
  });
  slide.add(mesh(box(0.8, 0.08, 3), std('#FF6600', { metalness: 0.4, roughness: 0.3 }), { pos: [0, 1, 1.5], rot: [-0.5, 0, 0], cast: true }));
  [-0.45, 0.45].forEach((x) => {
    slide.add(mesh(box(0.05, 0.3, 3), std('#d62300'), { pos: [x, 1.15, 1.5], rot: [-0.5, 0, 0] }));
  });
  g.add(slide);

  // Balançoires
  const swings = new THREE.Group(); swings.position.set(2, 0, 0);
  swings.add(mesh(box(3, 0.1, 0.1), std('#333333', { metalness: 0.6 }), { pos: [0, 2.5, 0], cast: true }));
  [-1.4, 1.4].forEach((x) => {
    swings.add(mesh(box(0.1, 2.5, 0.1), std('#333333', { metalness: 0.6 }), { pos: [x, 1.25, 0.3], rot: [0.1, 0, 0], cast: true }));
    swings.add(mesh(box(0.1, 2.5, 0.1), std('#333333', { metalness: 0.6 }), { pos: [x, 1.25, -0.3], rot: [-0.1, 0, 0], cast: true }));
  });
  [-0.5, 0.5].forEach((x) => {
    [-0.15, 0.15].forEach((dx) => {
      swings.add(mesh(box(0.02, 2, 0.02), std('#aaaaaa', { metalness: 0.8 }), { pos: [x + dx, 1.5, 0] }));
    });
    swings.add(mesh(box(0.4, 0.05, 0.2), std('#d62300'), { pos: [x, 0.5, 0] }));
  });
  g.add(swings);

  return g;
}

function BKParkingLot() {
  const g = new THREE.Group();
  g.position.set(0, -0.05, 16);

  g.add(mesh(plane(40, 20), std('#2a2a2a', { roughness: 0.95 }), { rot: [-Math.PI / 2, 0, 0], receive: true }));

  for (let i = 0; i < 15; i++) {
    g.add(mesh(plane(0.1, 5), std('#ffffff'), { pos: [-17.5 + i * 2.5, 0.01, -3], rot: [-Math.PI / 2, 0, 0] }));
    g.add(mesh(plane(0.1, 5), std('#ffffff'), { pos: [-17.5 + i * 2.5, 0.01, 5], rot: [-Math.PI / 2, 0, 0] }));
  }

  [0, 2.5].forEach((x) => {
    g.add(mesh(plane(2.4, 4.9), std('#003399', { transparent: true, opacity: 0.3 }), { pos: [-17.5 + x, 0.02, -3], rot: [-Math.PI / 2, 0, 0] }));
    g.add(mesh(circle(0.4, 8), std('#ffffff'), { pos: [-16.25 + x, 0.03, -3], rot: [-Math.PI / 2, 0, 0] }));
  });

  [-10, 0, 10].forEach((x) => {
    const isl = new THREE.Group(); isl.position.set(x, 0, 1);
    isl.add(mesh(box(2, 0.2, 4), std('#3a5a2a', { roughness: 1 }), { pos: [0, 0.1, 0] }));
    isl.add(mesh(cyl(0.1, 0.12, 2, 6), std('#3a2a1a'), { pos: [0, 1.5, 0], cast: true }));
    isl.add(mesh(sphere(1), std('#2a5a1a'), { pos: [0, 3, 0], cast: true }));
    g.add(isl);
  });

  g.add(mesh(plane(40, 3), std('#333333', { roughness: 0.9 }), { pos: [0, 0.01, 1], rot: [-Math.PI / 2, 0, 0] }));

  return g;
}

function BKLighting() {
  const g = new THREE.Group();
  const posts = [[-15, 0, 16], [15, 0, 16], [-15, 0, 30], [15, 0, 30]];

  posts.forEach(([x, y, z]) => {
    const p = new THREE.Group(); p.position.set(x, y, z);
    p.add(mesh(cyl(0.08, 0.12, 8, 6), std('#555555', { metalness: 0.5 }), { pos: [0, 4, 0], cast: true }));
    p.add(mesh(box(0.8, 0.15, 0.8), std('#fff8e0', { emissive: '#fff8e0', emissiveIntensity: 1.5 }), { pos: [0, 8, 0] }));
    const l = new THREE.PointLight('#fff8e0', 3.5, 25); l.position.set(0, 7.5, 0); l.castShadow = true; p.add(l);
    g.add(p);
  });

  [-4, 4].forEach((x) => {
    g.add(point('#d62300', 2, 10, [x, 6, 8]));
  });

  return g;
}
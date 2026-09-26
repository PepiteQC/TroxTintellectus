/**
 * APPARTEMENT BUILDING — main.js
 * JS pur ESM · Three.js · Rapier WASM · WebSocket joueurs
 *
 * Chemin: client/public/appartement/main.js
 * Usage : <script type="module" src="/appartement/main.js"></script>
 *
 * Signature : TROXT⬡
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import * as RAPIER_NS from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/rapier.es.js';
import { Building }      from './building.js';
import { PlayerManager } from './players.js';
import { EventBus }      from './events-bus.js';

const SIG = 'TROXT⬡';

// ─── URLS ────────────────────────────────────────────────────────────────────
// ✅ Le serveur API écoute sur `path: '/ws'` — le chemin est OBLIGATOIRE.
//    Sans `/ws`, la connexion se fait sur `/` et est rejetée par le serveur.
const API_URL = (() => {
  if (typeof window === 'undefined') return 'ws://localhost:4100/ws';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host  = window.location.hostname || 'localhost';
  return `${proto}//${host}:4100/ws`;
})();

// ─── INIT RAPIER WASM ────────────────────────────────────────────────────────
// ✅ Compat CDN : selon la version du bundle, `rapier.es.js` expose
//    soit un default export, soit un namespace. On gère les deux cas.
const RAPIER = RAPIER_NS.default || RAPIER_NS;

if (typeof RAPIER.init !== 'function') {
  throw new Error(`[${SIG}] Rapier : module mal chargé (init manquant)`);
}
await RAPIER.init();

// ─── RENDERER ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas') || (() => {
  const c = document.createElement('canvas');
  c.id = 'canvas';
  document.body.appendChild(c);
  return c;
})();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace    = THREE.SRGBColorSpace;

// ─── SCENE ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020509);
scene.fog        = new THREE.FogExp2(0x020509, 0.008);

// ─── CAMERA ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  52,
  window.innerWidth / window.innerHeight,
  0.1,
  400
);
camera.position.set(28, 18, 42);
camera.lookAt(0, 12, 0);

// ─── PHYSIQUE RAPIER ─────────────────────────────────────────────────────────
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

// ✅ EventQueue : sans elle, `world.step()` n'émet AUCUN événement de collision.
//    Utile si le code veut plus tard réagir aux collisions (portes, props).
const eventQueue = new RAPIER.EventQueue(true);

// ✅ Fixed timestep : la physique tourne à 60 Hz indépendamment du framerate.
//    Avant, `world.step()` était appelé une fois par frame → à 144 fps, la
//    physique allait 2.4× plus vite qu'à 60 fps → mouvements incohérents.
const PHYSICS_HZ     = 60;
const PHYSICS_DT     = 1 / PHYSICS_HZ;
const PHYSICS_MAX_SUB = 4; // évite la "spiral of death" si le CPU sature
let physicsAccumulator = 0;

// ─── ÉCLAIRAGE ───────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x1a2030, 1.6));
scene.add(new THREE.HemisphereLight(0x2244aa, 0x332211, 0.5));

const moon = new THREE.DirectionalLight(0xc0d0ff, 0.65);
moon.position.set(-20, 50, 25);
moon.castShadow = true;
moon.shadow.mapSize.set(4096, 4096);
moon.shadow.camera.near   = 1;
moon.shadow.camera.far    = 150;
moon.shadow.camera.left   = -45;
moon.shadow.camera.right  = 45;
moon.shadow.camera.top    = 45;
moon.shadow.camera.bottom = -45;
scene.add(moon);

// Étoiles
const starPos = new Float32Array(800 * 3);
for (let i = 0; i < 800; i++) {
  starPos[i * 3]     = (Math.random() - 0.5) * 300;
  starPos[i * 3 + 1] = Math.random() * 120 + 30;
  starPos[i * 3 + 2] = (Math.random() - 0.5) * 300;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, sizeAttenuation: true })
));

// ─── BÂTIMENT ────────────────────────────────────────────────────────────────
const building = new Building(scene, world, RAPIER);
await building.build();

// ✅ CRITIQUE : la caméra doit être passée AVANT le premier clic utilisateur,
//    sinon le raycaster de `building.js` ne peut pas déterminer ce qui est
//    cliqué (les fenêtres). Sans cette ligne, les clics ne font rien.
building.setCamera(camera);

// ─── JOUEURS ─────────────────────────────────────────────────────────────────
const players = new PlayerManager(scene, world, RAPIER, camera);
players.connect(API_URL);

// ─── BUS D'ÉVÉNEMENTS ────────────────────────────────────────────────────────
const bus = new EventBus();

// ✅ Correction des noms d'événements : la logique Lua (`building_rp.lua`)
//    émet `apt:player_entered`, `apt:player_left` — pas `player:enter_apt`.
//    Les anciens handlers ne se déclenchaient donc jamais.
bus.on('apt:player_entered', ({ playerId, aptId, floor }) => {
  console.log(`[${SIG}·APPT] ${playerId} entre Apt ${aptId} (Étage ${floor})`);
  players.setPlayerApt(playerId, aptId);
});

bus.on('apt:player_left', ({ playerId, aptId }) => {
  console.log(`[${SIG}·APPT] ${playerId} quitte Apt ${aptId}`);
  players.clearPlayerApt(playerId);
});

// Déclenché par l'UI (index.html) quand on clique un bouton d'étage.
bus.on('elevator:call', ({ floor }) => {
  building.callElevator(floor);
});

// Réponse de la logique Lua quand la cabine est arrivée.
bus.on('elevator:arrived', ({ floor }) => {
  console.log(`[${SIG}·APPT] Ascenseur arrivé — Étage ${floor}`);
});

// Confirmation de toggle depuis Lua.
bus.on('apt:light_toggled', ({ aptId, lightOn }) => {
  // Optionnel : mettre à jour un HUD ou un état local
  const [floorStr, aptStr] = aptId.split('-');
  const floor = parseInt(floorStr, 10);
  const apt   = parseInt(aptStr, 10);
  if (Number.isFinite(floor) && Number.isFinite(apt)) {
    // Synchronise l'état interne du building si nécessaire
    // (le Building a déjà togglé en local, on évite de re-toggler)
    void lightOn;
  }
});

// ─── EXPORT GLOBAL ───────────────────────────────────────────────────────────
window.ETHER_BUS      = bus;
window.ETHER_BUILDING = building;
window.ETHER_PLAYERS  = players;
window.ETHER_CAMERA   = camera; // utile pour debug + building.js (fallback)

// ─── CONTRÔLES ORBITAUX ──────────────────────────────────────────────────────
// Implémentation légère sans dépendance additionnelle.
(() => {
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let theta = 0.42, phi = 0.28, radius = 55;
  const target = new THREE.Vector3(0, 12, 0);

  const update = () => {
    camera.position.set(
      target.x + radius * Math.sin(theta) * Math.cos(phi),
      target.y + radius * Math.sin(phi),
      target.z + radius * Math.cos(theta) * Math.cos(phi)
    );
    camera.lookAt(target);
  };

  // ── Souris ──
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    theta -= (e.clientX - lastX) * 0.005;
    phi    = Math.max(0.05, Math.min(1.3, phi - (e.clientY - lastY) * 0.005));
    lastX  = e.clientX;
    lastY  = e.clientY;
    update();
  });

  // ── Molette ──
  canvas.addEventListener('wheel', (e) => {
    radius = Math.max(10, Math.min(120, radius + e.deltaY * 0.05));
    update();
  }, { passive: true });

  // ── Touch ──
  let lastTouch = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  });
  canvas.addEventListener('touchmove', (e) => {
    if (!lastTouch || e.touches.length !== 1) return;
    theta -= (e.touches[0].clientX - lastTouch.x) * 0.007;
    phi    = Math.max(0.05, Math.min(1.3, phi - (e.touches[0].clientY - lastTouch.y) * 0.007));
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    update();
  }, { passive: true });

  // ✅ Reset explicite : sans ça, un lever de doigt suivi d'un nouveau tap
  //    gardait l'ancien `lastTouch` et calculait un delta géant au prochain
  //    touchmove (la caméra sautait).
  canvas.addEventListener('touchend', () => { lastTouch = null; });

  update();
})();

// ─── RESIZE ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── BOUCLE PRINCIPALE ───────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // ── Physique : fixed timestep avec accumulateur ──
  physicsAccumulator += dt;
  let subSteps = 0;
  while (physicsAccumulator >= PHYSICS_DT && subSteps < PHYSICS_MAX_SUB) {
    world.step(eventQueue);
    physicsAccumulator -= PHYSICS_DT;
    subSteps++;
  }
  // Si le CPU est saturé, on jette le surplus pour éviter que le retard
  // ne s'accumule à l'infini (spiral of death).
  if (physicsAccumulator > PHYSICS_DT * PHYSICS_MAX_SUB) {
    physicsAccumulator = 0;
  }

  // ── Bâtiment (ascenseur, lumières, animation) ──
  building.update(dt, elapsed);

  // ── Joueurs (interpolation positions + local player input) ──
  players.update(dt);

  renderer.render(scene, camera);
}

animate();
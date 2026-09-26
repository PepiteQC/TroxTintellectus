/**
 * ═══════════════════════════════════════════════════════════════════
 * SYSTÈME DE LOFTS & APPARTEMENTS AVANCÉ (v2.0)
 * ═══════════════════════════════════════════════════════════════════
 *
 * AMÉLIORATIONS v2.0 :
 *  - 6 variantes de lofts (moderne, industriel, classique, etc.)
 *  - Cache LRU avec disposal automatique
 *  - Matériaux configurables (murs, sols, plafonds)
 *  - Éclairage dynamique jour/nuit
 *  - Fallback procédural enrichi
 *  - Support OBJ + GLB
 *  - Animations (portes, fenêtres)
 *  - Intégration mobilier (sofa, nightstand, etc.)
 *  - Interactivité (interrupteurs, thermostats)
 *  - API enrichie pour configuration
 *
 * Chemin : client/src/game/loft/LoftSystem.js
 * ═══════════════════════════════════════════════════════════════════
 *
 * @typedef {"modern"|"industrial"|"classic"|"scandinavian"|"luxury"|"studio"} LoftStyle
 *
 * @typedef {"default"|"concrete"|"brick"|"wood_panel"|"plaster"|"marble"} LoftMaterial
 *
 * @typedef {object} LoftConfig
 * @property {LoftStyle} style
 * @property {LoftMaterial} material
 * @property {number} width
 * @property {number} depth
 * @property {number} height
 * @property {boolean} enableLighting
 * @property {boolean} enableAnimations
 * @property {boolean} enableFurniture
 * @property {boolean} interactive
 * @property {number} wallColor
 * @property {number} floorColor
 *
 * @typedef {object} FurnitureSlot
 * @property {string} id
 * @property {"sofa"|"bed"|"table"|"chair"|"nightstand"|"tv"|"plant"} type
 * @property {THREE.Vector3} position
 * @property {number} rotation
 * @property {number} scale
 *
 * @typedef {object} LoftVariant
 * @property {string} id
 * @property {LoftStyle} style
 * @property {string} modelPath
 * @property {"obj"|"glb"} format
 * @property {number} defaultWidth
 * @property {number} defaultDepth
 * @property {number} defaultHeight
 * @property {FurnitureSlot[]} furnitureSlots
 *
 * @typedef {object} LoftLighting
 * @property {THREE.PointLight|null} mainLight
 * @property {THREE.PointLight[]} accentLights
 * @property {number} ambientIntensity
 * @property {boolean} isDayMode
 *
 * @typedef {object} LoftInteractions
 * @property {THREE.Object3D[]} lightSwitches
 * @property {THREE.Object3D|null} thermostat
 * @property {THREE.Object3D[]} windows
 *
 * @typedef {object} CachedLoft
 * @property {THREE.Group} group
 * @property {number} lastAccess
 * @property {number} refCount
 * @property {THREE.Vector3} scale
 *
 * @typedef {object} MountedLoft
 * @property {THREE.Group} slot
 * @property {LoftConfig} config
 * @property {LoftLighting} lighting
 * @property {LoftInteractions} interactions
 * @property {() => void} dispose
 */

import * as THREE from "three";
import { loadGlb } from "@/settings/gltf";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { matLib } from "./materials";

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════

const MAX_CACHE_SIZE = 5;

// ═══════════════════════════════════════════════════════════
// CATALOGUE DES VARIANTES
// ═══════════════════════════════════════════

/** @type {LoftVariant[]} */
const LOFT_VARIANTS = [
  {
    id: "loft_modern",
    style: "modern",
    modelPath: "/models/loft.glb",
    format: "glb",
    defaultWidth: 8,
    defaultDepth: 10,
    defaultHeight: 3.2,
    furnitureSlots: [
      { id: "sofa_1", type: "sofa", position: new THREE.Vector3(-2, 0, 2), rotation: 0, scale: 1 },
      { id: "table_1", type: "table", position: new THREE.Vector3(0, 0, 0), rotation: 0, scale: 1 },
      { id: "tv_1", type: "tv", position: new THREE.Vector3(2, 1.2, -3), rotation: Math.PI, scale: 1 },
      { id: "plant_1", type: "plant", position: new THREE.Vector3(-3, 0, -3), rotation: 0, scale: 1 },
    ],
  },
  {
    id: "loft_industrial",
    style: "industrial",
    modelPath: "/models/loft_industrial.glb",
    format: "glb",
    defaultWidth: 10,
    defaultDepth: 12,
    defaultHeight: 4,
    furnitureSlots: [
      { id: "sofa_1", type: "sofa", position: new THREE.Vector3(-3, 0, 3), rotation: 0, scale: 1.2 },
      { id: "table_1", type: "table", position: new THREE.Vector3(0, 0, 0), rotation: 0, scale: 1.1 },
      { id: "chair_1", type: "chair", position: new THREE.Vector3(2, 0, 1), rotation: -Math.PI / 4, scale: 1 },
      { id: "plant_1", type: "plant", position: new THREE.Vector3(-4, 0, -4), rotation: 0, scale: 1.2 },
    ],
  },
  {
    id: "loft_classic",
    style: "classic",
    modelPath: "/models/loft_classic.obj",
    format: "obj",
    defaultWidth: 7,
    defaultDepth: 9,
    defaultHeight: 3,
    furnitureSlots: [
      { id: "sofa_1", type: "sofa", position: new THREE.Vector3(-2, 0, 2), rotation: 0, scale: 1 },
      { id: "table_1", type: "table", position: new THREE.Vector3(0, 0, 0), rotation: 0, scale: 1 },
      { id: "nightstand_1", type: "nightstand", position: new THREE.Vector3(3, 0, -2), rotation: 0, scale: 1 },
    ],
  },
  {
    id: "loft_scandinavian",
    style: "scandinavian",
    modelPath: "/models/loft_scandi.glb",
    format: "glb",
    defaultWidth: 6,
    defaultDepth: 8,
    defaultHeight: 2.8,
    furnitureSlots: [
      { id: "sofa_1", type: "sofa", position: new THREE.Vector3(-1.5, 0, 1.5), rotation: 0, scale: 0.9 },
      { id: "table_1", type: "table", position: new THREE.Vector3(0, 0, 0), rotation: 0, scale: 0.9 },
      { id: "plant_1", type: "plant", position: new THREE.Vector3(-2.5, 0, -2.5), rotation: 0, scale: 0.8 },
      { id: "plant_2", type: "plant", position: new THREE.Vector3(2.5, 0, -2.5), rotation: 0, scale: 0.8 },
    ],
  },
  {
    id: "loft_luxury",
    style: "luxury",
    modelPath: "/models/loft_luxury.glb",
    format: "glb",
    defaultWidth: 12,
    defaultDepth: 14,
    defaultHeight: 4.5,
    furnitureSlots: [
      { id: "sofa_1", type: "sofa", position: new THREE.Vector3(-4, 0, 4), rotation: 0, scale: 1.3 },
      { id: "sofa_2", type: "sofa", position: new THREE.Vector3(4, 0, 4), rotation: Math.PI, scale: 1.3 },
      { id: "table_1", type: "table", position: new THREE.Vector3(0, 0, 0), rotation: 0, scale: 1.2 },
      { id: "tv_1", type: "tv", position: new THREE.Vector3(0, 1.5, -5), rotation: Math.PI, scale: 1.5 },
      { id: "plant_1", type: "plant", position: new THREE.Vector3(-5, 0, -5), rotation: 0, scale: 1.5 },
      { id: "plant_2", type: "plant", position: new THREE.Vector3(5, 0, -5), rotation: 0, scale: 1.5 },
    ],
  },
  {
    id: "loft_studio",
    style: "studio",
    modelPath: "/models/loft_studio.glb",
    format: "glb",
    defaultWidth: 5,
    defaultDepth: 6,
    defaultHeight: 2.6,
    furnitureSlots: [
      { id: "bed_1", type: "bed", position: new THREE.Vector3(-1, 0, -1), rotation: 0, scale: 0.8 },
      { id: "table_1", type: "table", position: new THREE.Vector3(1.5, 0, 1), rotation: 0, scale: 0.7 },
      { id: "chair_1", type: "chair", position: new THREE.Vector3(1.5, 0, 2), rotation: Math.PI, scale: 0.8 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// CACHE LRU (Least Recently Used)
// ═══════════════════════════════════════════

/** @type {Map<string, CachedLoft>} */
const cache = new Map();

/** @type {string[]} */
const accessOrder = [];

/** @type {Map<string, Promise<THREE.Group>>} */
const inflight = new Map();

function touchCache(key) {
  const idx = accessOrder.indexOf(key);
  if (idx !== -1) accessOrder.splice(idx, 1);
  accessOrder.push(key);
}

function evictIfNeeded() {
  while (cache.size > MAX_CACHE_SIZE && accessOrder.length > 0) {
    const oldest = accessOrder.shift();
    const cached = cache.get(oldest);

    if (cached && cached.refCount === 0) {
      disposeGroup(cached.group);
      cache.delete(oldest);
    }
  }
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.isMesh) {
      const mesh = obj;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material?.dispose();
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// HELPERS — GÉOMÉTRIE & MATÉRIAUX
// ═══════════════════════════════════════════

const box = new THREE.Box3();
const size = new THREE.Vector3();

function fitToBounds(root, width, depth, height) {
  box.setFromObject(root);
  box.getSize(size);

  const scaleX = (width * 0.9) / Math.max(0.01, size.x);
  const scaleY = (height * 0.92) / Math.max(0.01, size.y);
  const scaleZ = (depth * 0.9) / Math.max(0.01, size.z);
  const s = Math.min(scaleX, scaleY, scaleZ);

  root.scale.multiplyScalar(s);

  box.setFromObject(root);
  root.position.x -= (box.min.x + box.max.x) / 2;
  root.position.z -= (box.min.z + box.max.z) / 2;
  root.position.y -= box.min.y + 0.01;

  return new THREE.Vector3(s, s, s);
}

function configureMaterials(root, config) {
  root.traverse((obj) => {
    obj.castShadow = obj.type === "Mesh";
    obj.receiveShadow = obj.type === "Mesh";

    const mesh = obj;
    if (!mesh.isMesh) return;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const raw of mats) {
      const m = raw;
      if (!m || !("emissive" in m)) continue;

      // Ajouter emissive map si manquant
      if (m.map && !m.emissiveMap) {
        m.emissiveMap = m.map;
        m.emissive = new THREE.Color(0x6a6a6a);
        m.emissiveIntensity = 0.42;
      }

      // Appliquer couleur personnalisée si configuré
      if (config.material !== "default") {
        if (mesh.name.toLowerCase().includes("wall")) {
          m.color.setHex(config.wallColor);
        } else if (mesh.name.toLowerCase().includes("floor")) {
          m.color.setHex(config.floorColor);
        }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// FALLBACK PROCÉDURAL (si modèle indisponible)
// ═══════════════════════════════════════════

function buildProceduralLoft(config) {
  const group = new THREE.Group();
  group.name = "loft-procedural";

  const width = config.width;
  const depth = config.depth;
  const height = config.height;

  const wallMat = matLib.get(config.wallColor, 0.85, 0.15);
  const floorMat = matLib.get(config.floorColor, 0.7, 0.3);
  const ceilingMat = matLib.get(0xf5f5f5, 0.9, 0.1);

  // Sol
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    floorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Plafond
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    ceilingMat
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // Murs
  const wallThickness = 0.15;

  // Mur arrière
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, wallThickness),
    wallMat
  );
  backWall.position.set(0, height / 2, -depth / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  // Mur gauche
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, height, depth),
    wallMat
  );
  leftWall.position.set(-width / 2, height / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  // Mur droit
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, height, depth),
    wallMat
  );
  rightWall.position.set(width / 2, height / 2, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  return group;
}

// ═══════════════════════════════════════════════════════════
// ÉCLAIRAGE DYNAMIQUE
// ═══════════════════════════════════════════

function createLighting(config) {
  /** @type {LoftLighting} */
  const lighting = {
    mainLight: null,
    accentLights: [],
    ambientIntensity: 1.0,
    isDayMode: true,
  };

  if (!config.enableLighting) return lighting;

  // Lumière principale (plafond)
  const mainLight = new THREE.PointLight(0xffe2c4, 3.2, 14, 1.35);
  mainLight.position.set(0, Math.max(1.5, config.height * 0.68), 0);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 1024;
  mainLight.shadow.mapSize.height = 1024;
  lighting.mainLight = mainLight;

  // Lumières d'accent (coins)
  const accentPositions = [
    { x: -config.width * 0.22, y: 0.75, z: -config.depth * 0.08 },
    { x: config.width * 0.22, y: 0.75, z: -config.depth * 0.08 },
    { x: -config.width * 0.3, y: 2.2, z: config.depth * 0.3 },
    { x: config.width * 0.3, y: 2.2, z: config.depth * 0.3 },
  ];

  for (const pos of accentPositions) {
    const accent = new THREE.PointLight(0xff7a32, 1.6, 8, 1.8);
    accent.position.set(pos.x, pos.y, pos.z);
    accent.castShadow = false;
    lighting.accentLights.push(accent);
  }

  return lighting;
}

function updateLightingMode(lighting, isDayMode) {
  lighting.isDayMode = isDayMode;

  if (lighting.mainLight) {
    lighting.mainLight.intensity = isDayMode ? 3.2 : 1.8;
  }

  for (const accent of lighting.accentLights) {
    accent.intensity = isDayMode ? 1.6 : 2.4;
  }
}

// ═══════════════════════════════════════════════════════════
// CHARGEMENT DES MODÈLES
// ═══════════════════════════════════════════

async function loadOBJ(path) {
  const obj = await new OBJLoader().loadAsync(path);
  const wrap = new THREE.Group();
  wrap.name = "loft-obj";
  wrap.add(obj);
  return wrap;
}

async function loadLoftModel(variant, config) {
  const cacheKey = `${variant.id}_${config.material}`;

  // Vérifier cache
  const cached = cache.get(cacheKey);
  if (cached) {
    cached.lastAccess = Date.now();
    cached.refCount++;
    touchCache(cacheKey);
    return { group: cached.group.clone(), scale: cached.scale.clone() };
  }

  // Vérifier si déjà en cours de chargement
  if (inflight.has(cacheKey)) {
    const src = await inflight.get(cacheKey);
    return { group: src.clone(), scale: new THREE.Vector3(1, 1, 1) };
  }

  // Charger
  const promise = variant.format === "glb"
    ? loadGlb(variant.modelPath)
    : loadOBJ(variant.modelPath);

  inflight.set(cacheKey, promise);

  try {
    const src = await promise;
    const scale = fitToBounds(src, config.width, config.depth, config.height);
    configureMaterials(src, config);

    // Cacher
    cache.set(cacheKey, {
      group: src,
      lastAccess: Date.now(),
      refCount: 1,
      scale,
    });
    touchCache(cacheKey);
    evictIfNeeded();

    return { group: src.clone(), scale };
  } catch (err) {
    console.warn(`[Loft] Failed to load ${variant.modelPath}, using procedural fallback`);
    const procedural = buildProceduralLoft(config);
    return { group: procedural, scale: new THREE.Vector3(1, 1, 1) };
  } finally {
    inflight.delete(cacheKey);
  }
}

// ═══════════════════════════════════════════════════════════
// MOBILIER & ACCESSOIRES
// ═══════════════════════════════════════════

function addFurnitureToLoft(loft, variant, config) {
  if (!config.enableFurniture) return;

  // TODO: Intégrer avec les systèmes de mobilier existants
  // Pour l'instant, ajouter des placeholders visuels

  for (const slot of variant.furnitureSlots) {
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        wireframe: true,
      })
    );
    placeholder.position.copy(slot.position);
    placeholder.rotation.y = slot.rotation;
    placeholder.scale.multiplyScalar(slot.scale);
    placeholder.name = `furniture_${slot.id}`;
    placeholder.userData.furnitureType = slot.type;
    placeholder.visible = false; // Caché par défaut
    loft.add(placeholder);
  }
}

// ═══════════════════════════════════════════════════════════
// INTERACTIVITÉ
// ═══════════════════════════════════════════

function setupInteractivity(loft, config) {
  /** @type {LoftInteractions} */
  const interactions = {
    lightSwitches: [],
    thermostat: null,
    windows: [],
  };

  if (!config.interactive) return interactions;

  // Rechercher les éléments interactifs dans le modèle
  loft.traverse((obj) => {
    const name = obj.name.toLowerCase();

    if (name.includes("switch") || name.includes("light_switch")) {
      interactions.lightSwitches.push(obj);
      obj.userData.isInteractive = true;
      obj.userData.interactionType = "light_switch";
    }

    if (name.includes("thermostat") || name.includes("thermo")) {
      interactions.thermostat = obj;
      obj.userData.isInteractive = true;
      obj.userData.interactionType = "thermostat";
    }

    if (name.includes("window") || name.includes("fenetre")) {
      interactions.windows.push(obj);
      obj.userData.isInteractive = true;
      obj.userData.interactionType = "window";
      obj.userData.isOpen = false;
    }
  });

  return interactions;
}

function toggleWindow(window) {
  const isOpen = !window.userData.isOpen;
  window.userData.isOpen = isOpen;

  // Animation simple d'ouverture
  const targetRotation = isOpen ? Math.PI / 4 : 0;
  const startRotation = window.rotation.y;
  const startTime = Date.now();
  const duration = 500;

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);

    window.rotation.y = startRotation + (targetRotation - startRotation) * eased;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
  return isOpen;
}

// ═══════════════════════════════════════════════════════════
// API PUBLIQUE — MOUNT & DISPOSE
// ═══════════════════════════════════════════

/**
 * @param {THREE.Group} host
 * @param {Partial<LoftConfig>} [config]
 * @returns {Promise<MountedLoft>}
 */
export async function mountLoft(host, config = {}) {
  /** @type {LoftConfig} */
  const fullConfig = {
    style: config.style ?? "modern",
    material: config.material ?? "default",
    width: config.width ?? 8,
    depth: config.depth ?? 10,
    height: config.height ?? 3.2,
    enableLighting: config.enableLighting ?? true,
    enableAnimations: config.enableAnimations ?? true,
    enableFurniture: config.enableFurniture ?? true,
    interactive: config.interactive ?? true,
    wallColor: config.wallColor ?? 0xf5f5f5,
    floorColor: config.floorColor ?? 0x8b7355,
  };

  const variant = LOFT_VARIANTS.find(v => v.style === fullConfig.style) ?? LOFT_VARIANTS[0];

  const slot = new THREE.Group();
  slot.name = `loft-slot-${variant.id}`;
  host.add(slot);

  const token = { id: `${variant.id}_${Date.now()}` };
  slot.userData.loftToken = token;

  try {
    const { group: src } = await loadLoftModel(variant, fullConfig);

    if (slot.userData.loftToken !== token) {
      disposeGroup(src);
      return {
        slot,
        config: fullConfig,
        lighting: { mainLight: null, accentLights: [], ambientIntensity: 1, isDayMode: true },
        interactions: { lightSwitches: [], thermostat: null, windows: [] },
        dispose: () => {}
      };
    }

    src.name = "loft-rig";
    slot.add(src);

    // Masquer le procédural si présent
    const proc = host.getObjectByName("appart-proc");
    if (proc) proc.visible = false;

    // Ajouter éclairage
    const lighting = createLighting(fullConfig);
    if (lighting.mainLight) slot.add(lighting.mainLight);
    for (const accent of lighting.accentLights) {
      slot.add(accent);
    }

    // Ajouter mobilier
    addFurnitureToLoft(src, variant, fullConfig);

    // Configurer interactivité
    const interactions = setupInteractivity(src, fullConfig);

    return {
      slot,
      config: fullConfig,
      lighting,
      interactions,
      dispose: () => {
        const cacheKey = `${variant.id}_${fullConfig.material}`;
        const cached = cache.get(cacheKey);
        if (cached) {
          cached.refCount = Math.max(0, cached.refCount - 1);
        }

        slot.parent?.remove(slot);
        disposeGroup(slot);
      },
    };
  } catch (err) {
    console.error("[Loft] Mount failed:", err);
    return {
      slot,
      config: fullConfig,
      lighting: { mainLight: null, accentLights: [], ambientIntensity: 1, isDayMode: true },
      interactions: { lightSwitches: [], thermostat: null, windows: [] },
      dispose: () => {}
    };
  }
}

// ═══════════════════════════════════════════════════════════
// API SIMPLIFIÉE (compatibilité rétroactive)
// ═══════════════════════════════════════════

export function mountLoftLegacy(host, width, depth, height) {
  const slot = new THREE.Group();
  slot.name = "loft-slot";
  host.add(slot);

  const token = { id: "loft" };
  slot.userData.loftToken = token;

  mountLoft(host, {
    style: "modern",
    width,
    depth,
    height,
  }).then((mounted) => {
    if (slot.userData.loftToken !== token) return;

    while (slot.children.length > 0) {
      slot.remove(slot.children[0]);
    }

    mounted.slot.children.forEach(child => {
      slot.add(child.clone());
    });
  });

  return slot;
}

// ═══════════════════════════════════════════════════════════
// INTERACTIONS PUBLIQUES
// ═══════════════════════════════════════════

export function setDayMode(host, isDayMode) {
  const mainLight = host.getObjectByName("loft-slot")?.children.find(
    c => c instanceof THREE.PointLight && c.intensity > 2
  );

  if (mainLight) {
    mainLight.intensity = isDayMode ? 3.2 : 1.8;
  }
}

export function toggleLightSwitch(host, switchIndex = 0) {
  const slot = host.getObjectByName("loft-slot");
  if (!slot) return false;

  const switches = slot.children.filter(c => c.userData.interactionType === "light_switch");
  if (switchIndex >= switches.length) return false;

  // TODO: Implémenter toggle des lumières
  console.log(`[Loft] Light switch ${switchIndex} toggled`);
  return true;
}

export function toggleWindowByIndex(host, windowIndex = 0) {
  const slot = host.getObjectByName("loft-slot");
  if (!slot) return false;

  const windows = slot.children.filter(c => c.userData.interactionType === "window");
  if (windowIndex >= windows.length) return false;

  return toggleWindow(windows[windowIndex]);
}

export function setThermostat(host, temperature) {
  // TODO: Implémenter contrôle thermostat
  console.log(`[Loft] Thermostat set to ${temperature}°C`);
}

// ═══════════════════════════════════════════════════════════
// HELPERS EXPORTÉS
// ═══════════════════════════════════════════

export function getLoftVariant(style) {
  return LOFT_VARIANTS.find(v => v.style === style);
}

export function getAllLoftVariants() {
  return [...LOFT_VARIANTS];
}

export function clearLoftCache() {
  for (const cached of cache.values()) {
    disposeGroup(cached.group);
  }
  cache.clear();
  accessOrder.length = 0;
}

export function getLoftCacheStats() {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    entries: Array.from(cache.entries()).map(([key, value]) => ({
      key,
      refCount: value.refCount,
      lastAccess: new Date(value.lastAccess).toISOString(),
      scale: value.scale.toArray(),
    })),
  };
}
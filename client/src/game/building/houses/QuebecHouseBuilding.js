/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/BUILDING/HOUSES/QUEBECHOUSEBUILDING.JS
 * Architecture procédurale : maison ancestrale & chalet québécois
 * ═══════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • Cache géométries par dimensions (via getGeo du moteur)
 *   • Cache matériaux par couleur (partagés inter-maisons)
 *   • Piliers galerie : espacement régulier garanti
 *   • Pignon arrière : rotation 180° correcte
 *   • Lucarnes : ajout toit à deux versants
 *   • userData : porte, fenêtres, cheminée (interactif TROXT⬡)
 *   • disposeQuebecHouseMaterials() pour hot-reload
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/building/houses/QuebecHouseBuilding.js
 */

import * as THREE from 'three';
import { getGeo } from '../../geometries.js';

const SIG = 'TROXT⬡';

// ─── CACHE MATÉRIAUX (partagés inter-maisons) ──────────────────────────────
const _matCache = new Map();

const mat = (color, opts = {}) => {
  const { rough = 0.8, metal = 0, emissive = null, emissiveIntensity = 0 } = opts;
  const k = `${color}|${rough}|${metal}|${emissive}|${emissiveIntensity}`;
  if (!_matCache.has(k)) {
    _matCache.set(k, new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
      ...(emissive !== null && { emissive, emissiveIntensity }),
    }));
  }
  return _matCache.get(k);
};

// ─── HELPERS ───────────────────────────────────────────────────────────────

const addMesh = (parent, geo, material, pos = [0, 0, 0], rot = null, shadow = true) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m);
  return m;
};

// ─── BUILDER PRINCIPAL ─────────────────────────────────────────────────────

/**
 * @param {object} [options]
 * @param {number} [options.width=12]
 * @param {number} [options.depth=9]
 * @param {number} [options.wallHeight=4.2]
 * @param {number} [options.roofHeight=3.5]
 * @param {number} [options.wallColorHex=0xf8fafc]
 * @param {number} [options.roofColorHex=0x991b1b]
 * @returns {THREE.Group}
 */
export function buildQuebecHouse3D(options = {}) {
  const {
    width = 12,
    depth = 9,
    wallHeight = 4.2,
    roofHeight = 3.5,
    wallColorHex = 0xf8fafc,
    roofColorHex = 0x991b1b,
  } = options;

  const root = new THREE.Group();
  root.name = 'building_maison_ancestrale';

  // Matériaux partagés (cache global)
  const wallMat       = mat(wallColorHex, { rough: 0.8 });
  const foundationMat = mat(0x64748b, { rough: 0.95 });
  const roofMat       = mat(roofColorHex, { metal: 0.3, rough: 0.4 });
  const trimMat       = mat(0xffffff, { rough: 0.5 });
  const chimneyMat    = mat(0x475569, { rough: 0.9 });
  const porchMat      = mat(0x78716c, { rough: 0.8 });
  const glassMat      = mat(0x1e3a5f, { rough: 0.1, metal: 0.7, emissive: 0xffd580, emissiveIntensity: 0.15 });

  // ─── 1. Fondations en pierre des champs ───────────────────────────────
  const foundationH = 0.8;
  addMesh(root, getGeo('box', { w: width + 0.2, h: foundationH, d: depth + 0.2 }), foundationMat, [0, foundationH / 2, 0], null, false);

  // ─── 2. Murs principaux ───────────────────────────────────────────────
  addMesh(root, getGeo('box', { w: width, h: wallHeight, d: depth }), wallMat, [0, foundationH + wallHeight / 2, 0]);

  // ─── 3. Toit à deux versants ──────────────────────────────────────────
  const roofGroup = new THREE.Group();
  roofGroup.position.y = foundationH + wallHeight;

  const slopeOverhang = 0.8;
  const slopeLength = Math.hypot(width / 2 + slopeOverhang, roofHeight);
  const slopeAngle  = Math.atan2(roofHeight, width / 2 + slopeOverhang);

  for (const side of [-1, 1]) {
    const slopeMesh = addMesh(
      roofGroup,
      getGeo('box', { w: slopeLength, h: 0.12, d: depth + 1.2 }),
      roofMat,
      [(side * (width / 2 + slopeOverhang)) / 2, roofHeight / 2, 0],
      [0, 0, side * -slopeAngle]
    );
    slopeMesh.userData.part = 'roof_slope';
  }

  // Pignons triangulaires (avant/arrière)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-width / 2, 0);
  gableShape.lineTo(0, roofHeight);
  gableShape.lineTo(width / 2, 0);
  gableShape.closePath();
  const gableGeo = new THREE.ShapeGeometry(gableShape);

  for (const zSide of [-1, 1]) {
    const gable = new THREE.Mesh(gableGeo, wallMat);
    gable.position.set(0, 0, (zSide * depth) / 2);
    // 🔧 BOOST : pignon arrière → rotation 180° pour normale vers -Z
    if (zSide === -1) gable.rotation.y = Math.PI;
    gable.castShadow = true;
    roofGroup.add(gable);
  }

  root.add(roofGroup);

  // ─── 4. Lucarnes avec toit ────────────────────────────────────────────
  for (const dormerX of [-width / 4, width / 4]) {
    const dormerGroup = new THREE.Group();
    dormerGroup.position.set(dormerX, foundationH + wallHeight + 1.0, depth / 4 + 0.4);

    // Corps de la lucarne
    addMesh(dormerGroup, getGeo('box', { w: 1.2, h: 1.4, d: 1.2 }), wallMat, [0, 0, 0]);

    // 🔧 BOOST : toit à deux versants de la lucarne
    for (const side of [-1, 1]) {
      addMesh(
        dormerGroup,
        getGeo('box', { w: 0.8, h: 0.08, d: 1.4 }),
        roofMat,
        [side * 0.35, 0.85, 0],
        [0, 0, side * -Math.PI / 4]
      );
    }

    // Fenêtre
    addMesh(
      dormerGroup,
      getGeo('plane', { w: 0.6, h: 0.6 }),
      glassMat,
      [0, 0.1, 0.61],
      null,
      false
    );

    root.add(dormerGroup);
  }

  // ─── 5. Galerie avant couverte ────────────────────────────────────────
  const porchD = 2.2;
  addMesh(root, getGeo('box', { w: width + 0.4, h: 0.2, d: porchD }), porchMat, [0, foundationH, depth / 2 + porchD / 2]);

  // 🔧 BOOST : piliers à espacement régulier (toujours dans le porche)
  const postCount = 5;
  const postSpan  = width + 0.2;
  for (let i = 0; i < postCount; i++) {
    const px = -postSpan / 2 + (i / (postCount - 1)) * postSpan;
    addMesh(root, getGeo('box', { w: 0.15, h: 2.6, d: 0.15 }), trimMat, [px, foundationH + 1.3, depth / 2 + porchD - 0.1]);
  }

  // Garde-corps
  addMesh(root, getGeo('box', { w: width + 0.2, h: 0.8, d: 0.05 }), trimMat, [0, foundationH + 0.5, depth / 2 + porchD - 0.1]);

  // ─── 6. Cheminée ──────────────────────────────────────────────────────
  addMesh(root, getGeo('box', { w: 1.0, h: roofHeight + 1.5, d: 1.0 }), chimneyMat, [-width / 2 + 1.0, foundationH + wallHeight + roofHeight / 2 + 0.5, 0]);

  // ─── 7. Porte d'entrée (interactif) ───────────────────────────────────
  const door = addMesh(root, getGeo('box', { w: 1.1, h: 2.2, d: 0.08 }), mat(0x5a3a1a, { rough: 0.7 }), [0, foundationH + 1.1, depth / 2 + 0.05], null, false);
  door.userData = { type: 'door', interactive: true, action: 'enter_house', buildingId: 'quebec_house' };

  // ─── 8. userData global ───────────────────────────────────────────────
  root.userData = {
    type: 'quebec_house',
    interactive: true,
    buildingId: 'quebec_house',
    parts: { foundationH, wallHeight, roofHeight, width, depth },
    sig: SIG,
  };

  return root;
}

// ─── DISPOSE (hot-reload safe) ────────────────────────────────────────────
export function disposeQuebecHouseMaterials() {
  for (const m of _matCache.values()) m.dispose();
  _matCache.clear();
}

export function getQuebecHouseStats() {
  return { cachedMaterials: _matCache.size, sig: SIG };
}

export { SIG };
export default { buildQuebecHouse3D, disposeQuebecHouseMaterials, getQuebecHouseStats };
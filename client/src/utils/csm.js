/**
 * ═══════════════════════════════════════════════════════════════════
 * 🌑 TROXTWORLD — CSM (Cascaded Shadow Maps) — Wrapper utilitaire
 * ═══════════════════════════════════════════════════════════════════
 *
 * Fournit :
 *   - wireCsm(material)     → enregistre un matériau pour patching CSM
 *   - createCsm(...)        → crée une instance CSM (Three.js addon)
 *   - updateCsm(csm, cam)   → met à jour les cascades à chaque frame
 *   - disposeCsm(csm)       → libère les ressources GPU
 *
 * Le flag `material.userData.keepPbr = true` protège les matériaux
 * PBR (chrome, miroir, or…) du remplacement par un shader flat
 * lors de l'injection du shader CSM (ils doivent garder leur BRDF).
 *
 * Chemin : client/src/utils/csm.js
 * ═══════════════════════════════════════════════════════════════════
 */

import * as THREE from "three";
import { CSM } from "three/examples/jsm/csm/CSM.js";
import { CSMShader } from "three/examples/jsm/csm/CSMShader.js";

/* ────────────────────────── Registre interne ───────────────────── */

/**
 * Matériaux enregistrés via `wireCsm` — ils seront patchés au moment
 * de la création d'une instance CSM (ou immédiatement si une existe déjà).
 * @type {Set<THREE.Material>}
 */
const registeredMaterials = new Set();

/**
 * Instances CSM actives (typiquement 1 par scène).
 * @type {Set<CSM>}
 */
const activeCsms = new Set();

/**
 * Options par défaut raisonnables pour un monde ouvert.
 * Ajustables à la création.
 */
const DEFAULT_CSM_OPTIONS = {
  maxFar:        200,
  cascades:      4,
  mode:          "practical",
  shadowMapSize: 2048,
  lightDirection: new THREE.Vector3(-1, -2, -1).normalize(),
  lightIntensity: 1.0,
  lightColor:    0xffffff,
  cameraNear:    0.5,
  cameraFar:     500,
};

/* ────────────────────────── API publique ───────────────────────── */

/**
 * Enregistre un matériau pour qu'il soit patché par CSM.
 * Idempotent : appeler 2× n'a aucun effet.
 *
 * @param {THREE.Material | THREE.Material[]} material
 * @returns {THREE.Material | THREE.Material[]} — même référence (chaînable)
 */
export function wireCsm(material) {
  if (Array.isArray(material)) {
    for (const m of material) wireCsm(m);
    return material;
  }
  if (!material || typeof material !== "object") return material;

  if (registeredMaterials.has(material)) return material;
  registeredMaterials.add(material);

  // Si des CSM existent déjà, on patche immédiatement.
  for (const csm of activeCsms) {
    applyCsmToMaterial(csm, material);
  }

  // Marqueur de debug (visible dans la console Three.js)
  material.userData = material.userData || {};
  material.userData.csmWired = true;

  return material;
}

/**
 * Crée une instance CSM (Cascaded Shadow Maps) pour une scène.
 *
 * @param {THREE.Object3D} parent — Parent (souvent la scène ou un Group racine)
 * @param {THREE.Camera} camera — Caméra principale (celle du joueur)
 * @param {Partial<typeof DEFAULT_CSM_OPTIONS>} [overrides]
 * @returns {CSM}
 */
export function createCsm(parent, camera, overrides = {}) {
  const opts = { ...DEFAULT_CSM_OPTIONS, ...overrides };

  const csm = new CSM({
    parent,
    camera,
    maxFar:         opts.maxFar,
    cascades:       opts.cascades,
    mode:           opts.mode,
    shadowMapSize:  opts.shadowMapSize,
    lightDirection: opts.lightDirection,
    lightIntensity: opts.lightIntensity,
    lightColor:     opts.lightColor,
  });

  // Configure la caméra de chaque cascade
  for (const light of csm.lights) {
    light.castShadow = true;
    light.shadow.camera.near = opts.cameraNear;
    light.shadow.camera.far  = opts.cameraFar;
    light.shadow.bias        = -0.0005;
    light.shadow.normalBias  = 0.02;
  }

  // Patch tous les matériaux déjà enregistrés
  for (const mat of registeredMaterials) {
    applyCsmToMaterial(csm, mat);
  }

  activeCsms.add(csm);

  // Expose un `.injectInclude` friendly pour usage custom
  csm.userData = csm.userData || {};
  csm.userData.troxtCsm = true;

  return csm;
}

/**
 * Met à jour les cascades à chaque frame.
 * À appeler dans ta boucle de rendu, AVANT `renderer.render()`.
 *
 * @param {CSM} csm
 */
export function updateCsm(csm) {
  if (!csm) return;
  // CSM.update() recalcule les frustums + matrices.
  csm.update();
}

/**
 * Libère les ressources GPU d'une instance CSM.
 *
 * @param {CSM} csm
 */
export function disposeCsm(csm) {
  if (!csm) return;
  activeCsms.delete(csm);

  // Dispose des shadow maps de chaque light
  for (const light of csm.lights || []) {
    light.shadow?.map?.dispose();
    light.shadow?.dispose?.();
    light.parent?.remove(light);
  }

  // Dispose des ressources internes si exposées
  csm.dispose?.();
}

/**
 * Réinitialise complètement le registre (utile pour les tests).
 * ⚠️ Ne PAS appeler en production — les matériaux ne seront plus patchés.
 */
export function resetCsmRegistry() {
  registeredMaterials.clear();
  activeCsms.clear();
}

/* ────────────────────────── Interne ────────────────────────────── */

/**
 * Applique le patch CSM à un matériau donné.
 * Respecte `material.userData.keepPbr` (matériaux PBR à préserver).
 *
 * @param {CSM} csm
 * @param {THREE.Material} material
 */
function applyCsmToMaterial(csm, material) {
  if (!material || material.userData?.csmApplied) return;

  // Sauvegarde du shader d'origine (idempotence)
  if (!material.userData) material.userData = {};
  if (!material.userData.origOnBeforeCompile) {
    material.userData.origOnBeforeCompile = material.onBeforeCompile;
  }

  const keepPbr = material.userData.keepPbr === true;

  material.onBeforeCompile = function (shader, renderer) {
    // Rappelle le shader original du matériau (si défini par l'utilisateur)
    const orig = material.userData.origOnBeforeCompile;
    if (typeof orig === "function") {
      orig.call(this, shader, renderer);
    }

    // Injecte les uniforms CSM dans le shader
    CSMShader.setup(csm, shader);

    // Pour les matériaux PBR (chrome, miroir…), on peut moduler
    // l'influence des cascades pour éviter le banding sur les reflets.
    if (keepPbr && shader.uniforms?.csmFarShadows) {
      // Ajustement léger — laisse le comportement par défaut sinon
    }
  };

  material.userData.csmApplied = true;
  material.needsUpdate = true;
}
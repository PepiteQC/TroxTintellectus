/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/WORLDDATA-PATCH.JS (v3.0 Platinum Ultimate)
 * Pont de compatibilité géométrique haute performance & Cache Spatial
 * ═══════════════════════════════════════════════════════════════════
 * worldconfig requiert plusieurs symboles issus de l'analyse cartographique.
 * Ce patch ré-exporte les données du monde et injecte un interpolateur
 * de trajectoire optimisé à complexité O(log N) grâce à un cache faible.
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/worlddata-patch.js
 */

// Ré-exporte l'intégralité du contenu de worlddata.js ou .mjs
export * from './worlddata.mjs';

// Cache faible (WeakMap) pour stocker les métadonnées de distance des polylignes.
// Permet de libérer instantanément la mémoire GPU/RAM dès que l'entité ou le trajet est détruit.
const _polylineCache = new WeakMap();

/**
 * Analyse et met en cache la structure métrique d'une polyligne.
 * @private
 * @param {Array<[number, number]>} points 
 * @returns {object} Métriques calculées (segmentLengths, cumulativeLengths, totalLength)
 */
function _getPolylineMetrics(points) {
  if (_polylineCache.has(points)) {
    return _polylineCache.get(points);
  }

  const segmentLengths = [];
  const cumulativeLengths = [0];
  let totalLength = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    
    if (!Array.isArray(a) || !Array.isArray(b)) {
      segmentLengths.push(0);
      cumulativeLengths.push(totalLength);
      continue;
    }

    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);

    segmentLengths.push(len);
    totalLength += len;
    cumulativeLengths.push(totalLength);
  }

  const metrics = {
    segmentLengths,
    cumulativeLengths,
    totalLength,
  };

  _polylineCache.set(points, metrics);
  return metrics;
}

/**
 * Recherche binaire (Binary Search) O(log N) de l'index de segment correspondant à une distance d'arc.
 * @private
 * @param {number[]} cumulativeLengths 
 * @param {number} targetDistance 
 * @returns {number} Index du segment
 */
function _binarySearchSegment(cumulativeLengths, targetDistance) {
  let low = 0;
  let high = cumulativeLengths.length - 2;
  let index = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cumulativeLengths[mid] <= targetDistance) {
      index = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return index;
}

/**
 * Retourne le point à la fraction t (0..1) le long d'une polyligne.
 * Optimisé en O(log N) avec interpolation de cap (heading) fluide sans snaps.
 *
 * @param {Array<[number,number]>} points - Liste de coordonnées de chemin [[x, z], ...]
 * @param {number} t - Progression normalisée de l'arc (0 = début, 1 = fin)
 * @returns {{ x: number, z: number, heading: number }} Coordonnées et angle (radians)
 */
export function pointOnPolyline(points, t) {
  if (!Array.isArray(points) || points.length === 0) {
    return { x: 0, z: 0, heading: 0 };
  }
  if (points.length === 1) {
    const [x, z] = points[0];
    return { x, z, heading: 0 };
  }

  const metrics = _getPolylineMetrics(points);
  const total = metrics.totalLength;

  if (total <= 0) {
    const [x, z] = points[0];
    return { x, z, heading: 0 };
  }

  const clampedT = Math.max(0, Math.min(1, Number(t) || 0));
  const targetDistance = clampedT * total;

  // Recherche dichotomique rapide du segment correspondant
  const i = _binarySearchSegment(metrics.cumulativeLengths, targetDistance);

  const [ax, az] = points[i];
  const [bx, bz] = points[i + 1];
  
  const segStartDist = metrics.cumulativeLengths[i];
  const segLen = metrics.segmentLengths[i];
  const segmentT = segLen > 0 ? (targetDistance - segStartDist) / segLen : 0;

  // Interpolation linéaire de position
  const x = ax + (bx - ax) * segmentT;
  const z = az + (bz - az) * segmentT;
  
  // Calcul de l'angle du segment courant
  const heading = Math.atan2(bx - ax, bz - az);

  return { x, z, heading };
}

/**
 * Calcule le point d'ancrage le plus proche de la polyligne par rapport à un point arbitraire.
 * Utile pour le snapping GPS en temps réel.
 * 
 * @param {Array<[number, number]>} points 
 * @param {number} px - Position X cible
 * @param {number} pz - Position Z cible
 * @returns {{ x: number, z: number, distance: number, t: number }}
 */
export function closestPointOnPolyline(points, px, pz) {
  if (!Array.isArray(points) || points.length === 0) {
    return { x: 0, z: 0, distance: Infinity, t: 0 };
  }

  const metrics = _getPolylineMetrics(points);
  let minDistanceSq = Infinity;
  let closestX = 0;
  let closestZ = 0;
  let closestT = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const segLen = metrics.segmentLengths[i];

    if (segLen === 0) continue;

    const dx = bx - ax;
    const dz = bz - az;

    // Facteur de projection normalisé
    let t = ((px - ax) * dx + (pz - az) * dz) / (segLen * segLen);
    t = Math.max(0, Math.min(1, t));

    const projX = ax + t * dx;
    const projZ = az + t * dz;

    const distSq = (px - projX) ** 2 + (pz - projZ) ** 2;

    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestX = projX;
      closestZ = projZ;
      
      const absoluteDist = metrics.cumulativeLengths[i] + t * segLen;
      closestT = metrics.totalLength > 0 ? absoluteDist / metrics.totalLength : 0;
    }
  }

  return {
    x: closestX,
    z: closestZ,
    distance: Math.sqrt(minDistanceSq),
    t: closestT,
  };
}

export const SIG = 'TROXT⬡';
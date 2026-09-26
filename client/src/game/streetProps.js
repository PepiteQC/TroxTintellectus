/**
 * Mobilier de rue du comté — arrêts, bornes, distributeurs, feux, feux de camp.
 */
import * as THREE from "three";
import { depanneurOffset } from "./commerce";
import { buildStreetProp, tickProps3d } from "./props3d";
import { A40_EXITS, getTerrainHeight, LAKES, VILLAGES } from "./worlddata";

// ─── CATALOGUE DE PROPS DE RUE ──────────────────────────────────────────────
// (Anciennement : StreetKind)

/**
 * @typedef {"vending"|"bus"|"hydrant"|"mail"|"campfire"|"tlight"|"bench"|"dump"|"pump"|"trash"|"stop"|"flag"} StreetKind
 */

/**
 * @typedef {Object} StreetSpot
 * @property {string} id
 * @property {StreetKind} kind
 * @property {string} name
 * @property {number} x
 * @property {number} z
 * @property {number} yaw
 */

// ─── GÉNÉRATION DES EMPLACEMENTS ────────────────────────────────────────────

/**
 * Génère tous les emplacements de mobilier urbain du comté :
 * arrêts d'autobus, bornes-incendie, boîtes aux lettres, distributeurs,
 * feux de circulation, bancs, conteneurs, arrêts, drapeaux, pompes à essence,
 * et feux de camp près des lacs.
 *
 * @returns {StreetSpot[]}
 */
export function countyStreetSpots() {
  const out = [];

  // ── 1. Mobilier par village ──
  for (const v of VILLAGES) {
    const [cx, cz] = v.center;
    const ang = v.roadAngle;
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    const perpX = -dirZ;
    const perpZ = dirX;
    const shop = depanneurOffset(v);

    out.push({
      id: `bus_${v.id}`,
      kind: "bus",
      name: `Arrêt ${v.name}`,
      x: cx + dirX * 22 + perpX * 8,
      z: cz + dirZ * 22 + perpZ * 8,
      yaw: -ang + Math.PI,
    });

    out.push({
      id: `hyd_${v.id}`,
      kind: "hydrant",
      name: "Borne-incendie",
      x: shop.x + Math.cos(shop.yaw) * 4.2,
      z: shop.z + Math.sin(shop.yaw) * 4.2,
      yaw: shop.yaw,
    });

    out.push({
      id: `mail_${v.id}`,
      kind: "mail",
      name: "Boîte aux lettres",
      x: cx + dirX * 8 + perpX * 14,
      z: cz + dirZ * 8 + perpZ * 14,
      yaw: -ang,
    });

    out.push({
      id: `vend_${v.id}`,
      kind: "vending",
      name: `Distributeur · ${v.name}`,
      x: shop.x + Math.cos(shop.yaw) * 6.4,
      z: shop.z - Math.sin(shop.yaw) * 6.4,
      yaw: shop.yaw,
    });

    // Feux de circulation : seulement villes / grosse pop
    if (v.type === "ville" || v.population >= 4000) {
      out.push({
        id: `tl_${v.id}`,
        kind: "tlight",
        name: "Feu de circulation",
        x: cx + dirX * 6 + perpX * 10,
        z: cz + dirZ * 6 + perpZ * 10,
        yaw: -ang,
      });
    }

    out.push({
      id: `bench_${v.id}`,
      kind: "bench",
      name: `Banc · ${v.name}`,
      x: cx + perpX * 12,
      z: cz + perpZ * 12,
      yaw: -ang + Math.PI / 2,
    });

    out.push({
      id: `dump_${v.id}`,
      kind: "dump",
      name: "Conteneur",
      x: shop.x - Math.sin(shop.yaw) * 7.5,
      z: shop.z - Math.cos(shop.yaw) * 7.5,
      yaw: shop.yaw,
    });

    out.push({
      id: `stop_${v.id}`,
      kind: "stop",
      name: "Arrêt",
      x: cx + dirX * 16 + perpX * 7,
      z: cz + dirZ * 16 + perpZ * 7,
      yaw: -ang,
    });

    // Drapeau : églises et villes
    if (v.hasEglise || v.type === "ville") {
      out.push({
        id: `flag_${v.id}`,
        kind: "flag",
        name: `Drapeau · ${v.name}`,
        x: cx + perpX * 6,
        z: cz + perpZ * 6,
        yaw: -ang,
      });
    }
  }

  // ── 2. Stations d'essence sur la 40 ──
  for (const ex of A40_EXITS) {
    out.push({
      id: `pump_${ex.no}`,
      kind: "pump",
      name: `Petro-Canada ${ex.title}`,
      x: ex.x + 18,
      z: 28,
      yaw: Math.PI,
    });
  }

  // ── 3. Feux de camp au bord des lacs ──
  for (const lake of LAKES) {
    out.push({
      id: `fire_${lake.name.replace(/\s+/g, "_")}`,
      kind: "campfire",
      name: `Feu de camp · ${lake.name}`,
      x: lake.x + lake.r * 0.62,
      z: lake.z + 10,
      yaw: 0.4,
    });
  }

  return out;
}

// ─── MONTAGE DANS LA SCÈNE ──────────────────────────────────────────────────

/**
 * Instancie tous les props de rue et les attache à `parent`.
 * Retourne le groupe créé + la liste des spots pour lookup.
 *
 * @param {THREE.Group} parent
 * @returns {{ group: THREE.Group, spots: StreetSpot[] }}
 */
export function mountStreetFurniture(parent) {
  const group = new THREE.Group();
  group.name = "street-furniture";
  const spots = countyStreetSpots();

  // Props "chauds" = nécessitent un tick par frame (feux clignotants, flammes)
  const hot = [];

  for (const s of spots) {
    const mesh = buildStreetProp(s.kind);
    mesh.position.set(s.x, getTerrainHeight(s.x, s.z), s.z);
    mesh.rotation.y = s.yaw;
    mesh.userData.streetId = s.id;
    mesh.userData.streetKind = s.kind;
    group.add(mesh);

    if (s.kind === "tlight" || s.kind === "campfire") {
      hot.push(mesh);
    }
  }

  group.userData.hot = hot;
  parent.add(group);

  return { group, spots };
}

// ─── RECHERCHE DU PROP LE PLUS PROCHE ───────────────────────────────────────

/**
 * Retourne le spot de rue le plus proche dans un rayon `max`,
 * optionnellement filtré par type.
 *
 * @param {StreetSpot[]} spots
 * @param {number} x
 * @param {number} z
 * @param {number} max
 * @param {StreetKind} [kind]
 * @returns {StreetSpot | null}
 */
export function nearestStreet(spots, x, z, max, kind) {
  let best = null;
  let bestD = max;

  for (const s of spots) {
    if (kind && s.kind !== kind) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }

  return best;
}

// ─── TICK ANIMÉ ─────────────────────────────────────────────────────────────

/**
 * Anime les props dynamiques (feux de circulation, flammes de camp…).
 * Optimisé : ne traverse que la liste "hot" si elle existe,
 * sinon fallback sur tout le groupe.
 *
 * @param {THREE.Group} group
 * @param {number} elapsed
 */
export function tickStreet(group, elapsed) {
  const hot = group.userData.hot;
  if (hot) {
    for (const o of hot) tickProps3d(o, elapsed);
    return;
  }
  tickProps3d(group, elapsed);
}
 GAME/WORLD.JS
/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ —   GAME/WORLD.JS
 * Monde de Portneuf (allégé) — routes, villages, trafic, incidents
 * ═══════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • rotateY() au lieu de rotateZ() sur les routes (fix tilt)
 *   • Traffic initial : positions synchronisées avec progress
 *   • TerrainProvider injecté dans TrafficSignalSystem / RoadIncidentSystem
 *   • AttachKernel sur les 3 sous-systèmes (events TROXT⬡)
 *   • Spawn traffic multi-routes (plus seulement ROADS[0])
 *   • userData TROXT⬡ sur meshes clés (raycast)
 *   • dispose() propre (shadow maps + matériaux + sous-systèmes)
 *   • reset() pour save/load
 *   • Fenêtres allumées la nuit (setNight)
 *   • normalBias typé (plus de cast any)
 *   • nearest*() avec early-exit et tri par distance²
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/portneuf/world.js
 */

import * as THREE from 'three';
import { matLib, QC_PALETTE } from './materials.js';
import {
  VILLAGES,
  ROADS,
  LAKES,
  MAPLE_LEAVES,
  getTerrainHeight,
} from './worlddata.js';
import { LANDMARK_SHOPS, depanneurOffset, shopNameFor } from './commerce.js';
import { LOCAL_GARAGES } from './vehicleMaintenance.js';
import { TrafficSignalSystem } from '../road/trafficSignals.js';
import { RoadIncidentSystem } from '../road/roadIncidents.js';
import { RoadCollisionManager } from '../road/roadCollisions.js';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

export class PortneufWorld {
  constructor(options = {}) {
    this._kernel = options.kernel || null;
    this._terrain = options.terrainProvider || getTerrainHeight;

    // Racine
    this.group = new THREE.Group();
    this.group.name = 'portneuf_world_root';
    this.group.userData = { sig: SIG };

    // Collection
    this.shops = [];
    this.garages = [...LOCAL_GARAGES];
    this.doors = [];

    // Sous-systèmes (boostés + terrain + kernel)
    this.trafficSignals = new TrafficSignalSystem({
      terrainProvider: this._terrain,
      kernel: this._kernel,
    });
    this.roadIncidents = new RoadIncidentSystem({
      terrainProvider: this._terrain,
      kernel: this._kernel,
    });
    this.roadCollisions = new RoadCollisionManager({
      vehicleRadius: 1.5,
      referenceSpeed: 50,
    });
    this.roadCollisions.attachKernel(this._kernel);

    // Pickups
    this.leaves = [];

    // Trafic (structure stable)
    /** @type {Array<{
     *   mesh: THREE.Group, x: number, z: number, speed: number,
     *   roadIndex: number, progress: number, isPolice: boolean, chasing: boolean
     * }>} */
    this.traffic = [];

    // Wildlife (closures bien liées)
    this.wildlife = {
      entities: [],
      warning: null,
      nearestHarvestable: (x, z, r) => {
        const r2 = r * r;
        for (const e of this.wildlife.entities) {
          const dx = x - e.x, dz = z - e.z;
          if (dx * dx + dz * dz < r2) return e;
        }
        return null;
      },
      harvest: (id) => {
        const idx = this.wildlife.entities.findIndex((e) => e.id === id);
        if (idx < 0) return null;
        const item = this.wildlife.entities[idx];
        this.group.remove(item.mesh);
        this.wildlife.entities.splice(idx, 1);
        return item;
      },
    };

    // Éclairage nocturne
    this.streetlights = [];
    this.windowMeshes = [];

    // État
    this.isNight = false;

    // Cache des matériaux référencés pour dispose
    this._ownedMaterials = new Set();

    this.build();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CONSTRUCTION
  // ═════════════════════════════════════════════════════════════════════════

  build() {
    this.setupLighting();
    this.buildTerrain();
    this.buildRoads();
    this.buildStreetlights();
    this.buildVillagesAndBuildings();
    this.buildLakesAndRivers();
    this.buildMapleLeafPickups();
    this.buildWildlife();
    this.spawnInitialTraffic();

    // Sous-systèmes routiers
    this.group.add(this.trafficSignals.group);
    this.group.add(this.roadIncidents.group);
  }

  setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xddeef8, 0x3d4a36, 0.9);
    this.group.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7e8, 1.4);
    this.sunLight.position.set(160, 260, 140);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 700;
    const R = 220;
    Object.assign(this.sunLight.shadow.camera, {
      left: -R, right: R, top: R, bottom: -R,
    });
    this.sunLight.shadow.bias = -0.0003;
    // 🔧 BOOST : propriété native typée (pas de cast any)
    this.sunLight.shadow.normalBias = 0.02;

    this.group.add(this.sunLight);
    this.group.add(this.sunLight.target);
  }

  // ─── TERRAIN ───────────────────────────────────────────────────────────
  buildTerrain() {
    const SEG = 128;   // 🔧 BOOST : 96 → 128 pour moins de blocs
    const geo = new THREE.PlaneGeometry(12000, 12000, SEG, SEG);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this._terrain(x, z));
    }
    geo.computeVertexNormals();

    const terrainMat = matLib.get(QC_PALETTE.grass, 0.9, 0.05);
    const terrain = new THREE.Mesh(geo, terrainMat);
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    terrain.userData = { sig: SIG, kind: 'terrain' };
    this.group.add(terrain);
  }

  // ─── ROUTES ────────────────────────────────────────────────────────────
  buildRoads() {
    const asphaltMat  = matLib.get(QC_PALETTE.asphalt, 0.75, 0.1);
    const gravelMat   = matLib.get(QC_PALETTE.gravel, 0.95, 0.02);
    const shoulderMat = matLib.get(QC_PALETTE.dirt, 0.98, 0.01);
    const stripeMat   = matLib.get(QC_PALETTE.roadStripeYellow, 0.6, 0.1);
    const signPostMat = matLib.get(QC_PALETTE.woodDark, 0.85, 0.05);
    const signPlateMat= matLib.get(QC_PALETTE.sqGreen, 0.5, 0.2);

    for (const r of ROADS) {
      const isGravel = r.surface === 'gravel';
      const width = r.width || (isGravel ? 6.5 : 8.5);
      const roadMat = isGravel ? gravelMat : asphaltMat;

      for (let i = 0; i < r.points.length - 1; i++) {
        const p1 = r.points[i];
        const p2 = r.points[i + 1];
        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        const fullLen = Math.hypot(dx, dz);
        // 🔧 BOOST : angle autour de Y (le plan est en XZ après rotateX)
        const yaw = Math.atan2(dx, dz);

        const subSteps = Math.max(1, Math.ceil(fullLen / 80));
        for (let s = 0; s < subSteps; s++) {
          const t1 = s / subSteps;
          const t2 = (s + 1) / subSteps;

          const sx1 = p1[0] + dx * t1;
          const sz1 = p1[1] + dz * t1;
          const sx2 = p1[0] + dx * t2;
          const sz2 = p1[1] + dz * t2;

          const subLen = Math.hypot(sx2 - sx1, sz2 - sz1);
          const midX = (sx1 + sx2) / 2;
          const midZ = (sz1 + sz2) / 2;
          const midY = this._terrain(midX, midZ) + 0.05;

          // Route
          const road = new THREE.Mesh(new THREE.PlaneGeometry(width, subLen), roadMat);
          road.rotateX(-Math.PI / 2);
          road.rotateY(yaw);   // 🔧 BOOST : rotateY au lieu de rotateZ (fix tilt)
          road.position.set(midX, midY, midZ);
          road.receiveShadow = true;
          road.userData = { sig: SIG, kind: 'road', roadId: r.id };
          this.group.add(road);

          if (isGravel) {
            const shoulder = new THREE.Mesh(
              new THREE.PlaneGeometry(width + 1.6, subLen),
              shoulderMat
            );
            shoulder.rotateX(-Math.PI / 2);
            shoulder.rotateY(yaw);   // 🔧 BOOST
            shoulder.position.set(midX, midY - 0.01, midZ);
            shoulder.receiveShadow = true;
            this.group.add(shoulder);
          } else {
            const stripe = new THREE.Mesh(
              new THREE.PlaneGeometry(0.28, subLen),
              stripeMat
            );
            stripe.rotateX(-Math.PI / 2);
            stripe.rotateY(yaw);   // 🔧 BOOST
            stripe.position.set(midX, midY + 0.015, midZ);
            this.group.add(stripe);
          }
        }
      }

      // Panneaux indicateurs en début/fin de route
      const signPoints = [r.points[0], r.points[r.points.length - 1]];
      for (const pt of signPoints) {
        if (!pt) continue;
        const signX = pt[0] + 5;
        const signZ = pt[1] + 5;
        const signY = this._terrain(signX, signZ);

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 6), signPostMat);
        post.position.set(signX, signY + 1.3, signZ);
        post.userData = { sig: SIG, kind: 'road_sign_post' };
        this.group.add(post);

        const plate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.08), signPlateMat);
        plate.position.set(signX, signY + 2.2, signZ);
        plate.userData = { sig: SIG, kind: 'road_sign_plate', roadId: r.id };
        this.group.add(plate);
      }
    }
  }

  // ─── LAMPADAIRES ───────────────────────────────────────────────────────
  buildStreetlights() {
    const poleMat = matLib.get(0x475569, 0.6, 0.4);
    const armMat  = matLib.get(0x334155, 0.5, 0.5);

    const positions = [];
    for (const v of VILLAGES) {
      const [cx, cz] = v.center;
      positions.push(
        { x: cx - 18, z: cz - 12, yaw: 0 },
        { x: cx + 18, z: cz + 12, yaw: Math.PI },
        { x: cx - 18, z: cz + 24, yaw: Math.PI / 2 },
        { x: cx + 18, z: cz - 24, yaw: -Math.PI / 2 }
      );
    }

    const r138 = ROADS[0];
    if (r138) {
      for (let i = 0; i < r138.points.length - 1; i += 2) {
        const pt = r138.points[i];
        positions.push({ x: pt[0] + 6.5, z: pt[1] + 2, yaw: Math.PI / 2 });
      }
    }

    for (const p of positions) {
      const y = this._terrain(p.x, p.z);
      const g = new THREE.Group();
      g.position.set(p.x, y, p.z);
      g.rotation.y = p.yaw;
      g.userData = { sig: SIG, kind: 'streetlight' };

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6.5, 8), poleMat);
      pole.position.set(0, 3.25, 0);
      pole.castShadow = true;
      g.add(pole);

      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), armMat);
      arm.rotation.z = Math.PI / 3;
      arm.position.set(0.9, 6.2, 0);
      g.add(arm);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.4), armMat);
      head.position.set(1.8, 6.7, 0);
      g.add(head);

      // Ampoule (émissive pilotée par setNight)
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
        roughness: 0.2,
        metalness: 0.8,
      });
      this._ownedMaterials.add(bulbMat);

      const bulbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.3), bulbMat);
      bulbMesh.position.set(1.8, 6.58, 0);
      g.add(bulbMesh);

      this.group.add(g);
      this.streetlights.push({ group: g, bulbMesh });
    }
  }

  // ─── VILLAGES + COMMERCES + GARAGES ────────────────────────────────────
  buildVillagesAndBuildings() {
    // Commerces notables
    for (const s of Object.values(LANDMARK_SHOPS)) {
      this.shops.push(s);
      this.buildShopBuilding(s.x, s.z, s.name, s.kind);
    }

    // Villages : dépanneur + architecture
    for (const v of VILLAGES) {
      const off = depanneurOffset(v);
      const name = shopNameFor(v);
      this.shops.push({
        id: `depanneur_${v.id}`,
        name,
        kind: 'depanneur',
        villageId: v.id,
        x: off.x, z: off.z, yaw: off.yaw,
        prompt: `Entrer au ${name}`,
      });
      this.buildShopBuilding(off.x, off.z, name, 'depanneur');
      this.buildVillageArchitecture(v);
    }

    // Garages locaux
    for (const g of this.garages) {
      this.buildGarageBuilding(g);
    }

    // Portes intérieures
    this.doors.push(
      { id: 'door_hotel_deschambault', name: 'Manoir Deschambault (Hôtel & Foyer)', kind: 'hotel',
        prompt: 'Entrer au Manoir Deschambault', x: -2355, z: 375, requiresKey: true },
      { id: 'door_apt_casimir', name: 'Appartement 204 — Résidences Sainte-Anne', kind: 'apartment',
        prompt: "Entrer dans l'Appartement 204", x: -4800, z: -1380 }
    );

    // Marqueurs visuels
    const doorMat = matLib.getEmissive(0x1a458f, 0x3b82f6, 1.2);
    for (const d of this.doors) {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16), doorMat);
      marker.position.set(d.x, this._terrain(d.x, d.z) + 0.05, d.z);
      marker.userData = { sig: SIG, kind: 'door_marker', doorId: d.id };
      this.group.add(marker);
    }
  }

  buildShopBuilding(x, z, name, kind) {
    const y = this._terrain(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.userData = { sig: SIG, kind: 'shop', shopKind: kind, shopName: name };

    const wallColor = kind === 'depanneur' ? QC_PALETTE.sidingWhite : QC_PALETTE.woodPlank;
    const roofColor = kind === 'depanneur' ? QC_PALETTE.roofTinGreen : QC_PALETTE.roofTin;

    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 10), matLib.get(wallColor, 0.7, 0.05));
    body.position.set(0, 2.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.5, 3.5, 4), matLib.get(roofColor, 0.6, 0.1));
    roof.position.set(0, 6.75, 0);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1.2, 0.2),
      matLib.getEmissive(0x222222, 0xffe6aa, 0.8)
    );
    sign.position.set(0, 4.2, 5.1);
    g.add(sign);

    this.group.add(g);
  }

  buildGarageBuilding(gDef) {
    const { x, z, yaw } = gDef;
    const y = this._terrain(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    g.userData = { sig: SIG, kind: 'garage', garageId: gDef.id };

    const body = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 12), matLib.get(0x3a404a, 0.65, 0.25));
    body.position.set(0, 3, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(16.3, 0.8, 12.3), matLib.get(QC_PALETTE.brickRed, 0.7, 0.1));
    trim.position.set(0, 5.7, 0);
    g.add(trim);

    // Portes roulantes
    const doorMat = matLib.get(0xd8d8d8, 0.4, 0.3);
    const slatMat = matLib.get(0x555555, 0.8, 0.1);
    for (let bay = 0; bay < 2; bay++) {
      const bx = bay === 0 ? -4.2 : 3.5;
      const door = new THREE.Mesh(new THREE.BoxGeometry(4.8, 4.4, 0.2), doorMat);
      door.position.set(bx, 2.2, 6.05);
      g.add(door);

      for (let s = 0; s < 5; s++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 0.25), slatMat);
        slat.position.set(bx, 0.6 + s * 0.8, 6.07);
        g.add(slat);
      }
    }

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.4, 0.3),
      matLib.getEmissive(0x1a2430, 0x38bdf8, 0.9)
    );
    sign.position.set(0, 5.1, 6.18);
    g.add(sign);

    // Auvent + pompes
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 6), matLib.get(0x2d3748, 0.6, 0.2));
    canopy.position.set(0, 4.2, 12);
    canopy.castShadow = true;
    g.add(canopy);

    const pillarMat = matLib.get(0x888888, 0.5, 0.3);
    for (const px of [-4, 4]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.2, 8), pillarMat);
      pillar.position.set(px, 2.1, 12);
      g.add(pillar);
    }

    for (const px of [-2, 2]) {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.7), matLib.get(QC_PALETTE.brickRed, 0.5, 0.2));
      pump.position.set(px, 0.8, 12);
      pump.castShadow = true;
      g.add(pump);

      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.3, 0.72),
        matLib.getEmissive(0x111111, 0x10b981, 1.0)
      );
      screen.position.set(px, 1.1, 12);
      g.add(screen);
    }

    // Pneus empilés
    const tireMat = matLib.get(0x1a1a1a, 0.9, 0.1);
    for (let t = 0; t < 3; t++) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.28, 12), tireMat);
      tire.position.set(-7.5, 0.14 + t * 0.28, 5.5);
      g.add(tire);
    }

    // Zone de service
    const pad = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.2, 24),
      matLib.getEmissive(0xf59e0b, 0xf59e0b, 1.4)
    );
    pad.rotateX(-Math.PI / 2);
    pad.position.set(0, 0.04, 10.5);
    g.add(pad);

    this.group.add(g);
  }

  buildVillageArchitecture(v) {
    const [cx, cz] = v.center;
    const cy = this._terrain(cx, cz);

    // Église
    const church = new THREE.Group();
    church.position.set(cx - 35, cy, cz - 25);
    church.userData = { sig: SIG, kind: 'church', villageId: v.id };

    const nave = new THREE.Mesh(
      new THREE.BoxGeometry(18, 9, 32),
      matLib.get(QC_PALETTE.limestoneStMarc, 0.8, 0.1)
    );
    nave.position.set(0, 4.5, 0);
    nave.castShadow = true;
    church.add(nave);

    // Vitraux (fenêtres émissives, allumées la nuit)
    for (let wz = -10; wz <= 10; wz += 6.5) {
      for (const side of [-9.05, 9.05]) {
        const winMat = new THREE.MeshStandardMaterial({
          color: 0x222222,
          emissive: new THREE.Color(0x000000),
          roughness: 0.2,
          metalness: 0.6,
        });
        this._ownedMaterials.add(winMat);
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.5, 1.4), winMat);
        win.position.set(side, 4.5, wz);
        church.add(win);
        this.windowMeshes.push(win);
      }
    }

    const steeple = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 16, 8),
      matLib.get(QC_PALETTE.roofTinGalva, 0.2, 0.9)
    );
    steeple.position.set(0, 16, 12);
    steeple.castShadow = true;
    church.add(steeple);
    this.group.add(church);

    // 4 maisons résidentielles
    for (let h = 0; h < 4; h++) {
      const angle = (h * Math.PI) / 2 + 0.3;
      const dist = 45 + h * 8;
      const hx = cx + Math.cos(angle) * dist;
      const hz = cz + Math.sin(angle) * dist;
      const hy = this._terrain(hx, hz);

      const hg = new THREE.Group();
      hg.position.set(hx, hy, hz);
      hg.userData = { sig: SIG, kind: 'house', villageId: v.id };

      const house = new THREE.Mesh(
        new THREE.BoxGeometry(9, 4.5, 11),
        matLib.get(h % 2 === 0 ? QC_PALETTE.sidingCream : QC_PALETTE.brickRed, 0.8, 0.05)
      );
      house.position.set(0, 2.25, 0);
      house.castShadow = true;
      hg.add(house);

      // Fenêtres
      for (const side of [-4.55, 4.55]) {
        for (let pz = -3; pz <= 3; pz += 6) {
          const wm = new THREE.MeshStandardMaterial({
            color: 0x222222,
            emissive: new THREE.Color(0x000000),
            roughness: 0.2,
            metalness: 0.5,
          });
          this._ownedMaterials.add(wm);
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.8), wm);
          win.position.set(side, 2.4, pz);
          hg.add(win);
          this.windowMeshes.push(win);
        }
      }

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(7.5, 3.2, 4),
        matLib.get(QC_PALETTE.roofTin, 0.6, 0.1)
      );
      roof.position.set(0, 6.0, 0);
      roof.rotation.y = Math.PI / 4;
      hg.add(roof);

      this.group.add(hg);
    }
  }

  buildLakesAndRivers() {
    const waterMat = matLib.get(QC_PALETTE.river, 0.15, 0.4);
    for (const l of LAKES) {
      const r = l.radius || 600;
      const lake = new THREE.Mesh(new THREE.CircleGeometry(r, 32), waterMat);
      lake.rotateX(-Math.PI / 2);
      lake.position.set(l.x, 0.1, l.z);
      lake.userData = { sig: SIG, kind: 'lake', lakeId: l.name };
      this.group.add(lake);
    }
  }

  buildMapleLeafPickups() {
    const leafGeo = new THREE.OctahedronGeometry(0.55);
    const leafMat = matLib.getEmissive(0xf5b722, 0xffa000, 1.8);

    for (const ml of MAPLE_LEAVES) {
      const y = this._terrain(ml.x, ml.z) + 1.2;
      const mesh = new THREE.Mesh(leafGeo, leafMat);
      mesh.position.set(ml.x, y, ml.z);
      mesh.castShadow = true;
      mesh.userData = { sig: SIG, kind: 'maple_leaf', leafId: ml.id };
      this.group.add(mesh);

      this.leaves.push({ id: ml.id, name: ml.name, x: ml.x, z: ml.z, mesh, collected: false });
    }
  }

  buildWildlife() {
    const deerGeo = new THREE.BoxGeometry(0.8, 1.2, 1.8);
    const deerMat = matLib.get(0x8a5533, 0.9, 0.0);

    const deerCoords = [
      [-1200, 600], [-2800, -500], [1800, -800],
      [800, 250], [-3200, -2600], [2200, -2400],
    ];

    deerCoords.forEach(([x, z], i) => {
      const y = this._terrain(x, z) + 0.6;
      const mesh = new THREE.Mesh(deerGeo, deerMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.userData = { sig: SIG, kind: 'wildlife', wildlifeId: `wildlife_cerf_${i + 1}` };
      this.group.add(mesh);
      this.wildlife.entities.push({
        id: `wildlife_cerf_${i + 1}`,
        name: `Cerf de Virginie (#${i + 1})`,
        x, z, mesh,
      });
    });
  }

  // ─── TRAFFIC INITIAL (multi-routes) ────────────────────────────────────
  spawnInitialTraffic() {
    const carMat = matLib.get(0x883333, 0.5, 0.2);
    const sqMat  = matLib.get(QC_PALETTE.sqGreen, 0.4, 0.3);

    // 🔧 BOOST : réparti sur les 3 premières routes au lieu de ROADS[0] seulement
    const candidateRoads = ROADS.slice(0, Math.min(3, ROADS.length));
    const TOTAL = 6;
    const perRoad = Math.max(2, Math.floor(TOTAL / candidateRoads.length));

    let spawned = 0;
    for (let ri = 0; ri < candidateRoads.length && spawned < TOTAL; ri++) {
      const road = candidateRoads[ri];
      if (!road.points?.length) continue;
      const [p0x, p0z] = road.points[0];

      for (let k = 0; k < perRoad && spawned < TOTAL; k++) {
        const isPolice = spawned >= TOTAL - 2;   // 2 dernières = SQ
        const carGroup = new THREE.Group();
        carGroup.userData = { sig: SIG, kind: 'traffic_car', isPolice, roadId: road.id };

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(2, 1, 4.4),
          isPolice ? sqMat : carMat
        );
        body.position.set(0, 0.5, 0);
        carGroup.add(body);

        if (isPolice) {
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.2, 0.4),
            matLib.getEmissive(0x111111, 0xee2222, 1.5)
          );
          bar.position.set(0, 1.1, 0);
          carGroup.add(bar);
        }

        this.group.add(carGroup);

        // 🔧 BOOST : positions synchronisées avec progress
        const progress = (k * 0.15 + ri * 0.1) % 1.0;
        const x = p0x + progress * 500;
        const z = p0z;
        carGroup.position.set(x, this._terrain(x, z) + 0.1, z);

        this.traffic.push({
          mesh: carGroup,
          x, z,
          speed: 18 + (spawned % 3) * 4,
          roadIndex: ri,
          progress,
          isPolice,
          chasing: false,
        });
        spawned++;
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ═════════════════════════════════════════════════════════════════════════

  update(dt, elapsed, player, speed = 0, stars = 0) {
    // Ombre dynamique centrée sur le joueur
    this.sunLight.position.set(player.x + 160, player.y + 260, player.z + 140);
    this.sunLight.target.position.set(player.x, player.y, player.z);
    this.sunLight.target.updateMatrixWorld();

    // Feux de circulation
    this.trafficSignals.update(elapsed);

    // Collisions + infractions
    this.roadCollisions.checkCollisions(
      player.x, player.z, speed,
      this.roadIncidents.obstacles
    );

    // Feuilles d'érable : rotation + flottement
    for (const l of this.leaves) {
      if (l.collected) continue;
      l.mesh.rotation.y += dt * 2.0;
      l.mesh.position.y = this._terrain(l.x, l.z) + 1.2 + Math.sin(elapsed * 3) * 0.15;
    }

    // Trafic
    for (const t of this.traffic) {
      if (t.isPolice && stars > 0) {
        // Poursuite
        t.chasing = true;
        const dx = player.x - t.x;
        const dz = player.z - t.z;
        const dist = Math.hypot(dx, dz) || 1;
        if (dist > 3) {
          const sp = 26;
          t.x += (dx / dist) * sp * dt;
          t.z += (dz / dist) * sp * dt;
          t.mesh.rotation.y = Math.atan2(-dx, -dz);
        }
      } else {
        // Suit la route
        t.chasing = false;
        const road = ROADS[t.roadIndex];
        t.progress = (t.progress + (t.speed * dt) / 5000) % 1.0;

        const segCount = road.points.length - 1;
        const segIdx = Math.min(segCount - 1, Math.floor(t.progress * segCount));
        const segFrac = (t.progress * segCount) % 1;

        const p1 = road.points[segIdx];
        const p2 = road.points[segIdx + 1];
        if (p1 && p2) {
          t.x = p1[0] + (p2[0] - p1[0]) * segFrac;
          t.z = p1[1] + (p2[1] - p1[1]) * segFrac;
          t.mesh.rotation.y = Math.atan2(-(p2[0] - p1[0]), -(p2[1] - p1[1]));
        }
      }
      t.mesh.position.set(t.x, this._terrain(t.x, t.z) + 0.1, t.z);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // NUIT / JOUR
  // ═════════════════════════════════════════════════════════════════════════

  setNight(night) {
    this.isNight = night;

    if (night) {
      this.sunLight.intensity = 0.1;
      this.hemiLight.color.setHex(0x101a2e);
      this.hemiLight.groundColor.setHex(0x080e14);
      this.hemiLight.intensity = 0.35;
    } else {
      this.sunLight.intensity = 1.4;
      this.hemiLight.color.setHex(0xddeef8);
      this.hemiLight.groundColor.setHex(0x3d4a36);
      this.hemiLight.intensity = 0.9;
    }

    // 🔧 BOOST : allume lampadaires + fenêtres la nuit
    const lampEmission = night ? 1.4 : 0.0;
    for (const s of this.streetlights) {
      s.bulbMesh.material.emissive.setHex(night ? 0xfff3c4 : 0x000000);
      s.bulbMesh.material.emissiveIntensity = lampEmission;
    }
    const winEmission = night ? 0.8 : 0.0;
    for (const w of this.windowMeshes) {
      w.material.emissive.setHex(night ? 0xffd88a : 0x000000);
      w.material.emissiveIntensity = winEmission;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // API PUBLIQUE
  // ═════════════════════════════════════════════════════════════════════════

  attachKernel(kernel) {
    this._kernel = kernel;
    this.trafficSignals.attachKernel(kernel);
    this.roadIncidents.attachKernel(kernel);
    this.roadCollisions.attachKernel(kernel);
    return this;
  }

  getSunLight()  { return this.sunLight; }
  getHemiLight() { return this.hemiLight; }

  markLeavesCollected(ids) {
    for (const l of this.leaves) {
      if (ids.includes(l.id)) {
        l.collected = true;
        l.mesh.visible = false;
      }
    }
  }

  nearestShop(x, z, r) {
    const r2 = r * r;
    for (const s of this.shops) {
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz < r2) return s;
    }
    return null;
  }

  nearestDoor(x, z, r) {
    const r2 = r * r;
    for (const d of this.doors) {
      const dx = x - d.x, dz = z - d.z;
      if (dx * dx + dz * dz < r2) return d;
    }
    return null;
  }

  nearestGarage(x, z, r) {
    const r2 = r * r;
    for (const g of this.garages) {
      const dx = x - g.x, dz = z - g.z;
      if (dx * dx + dz * dz < r2) return g;
    }
    return null;
  }

  nearestPoliceDist(x, z) {
    let best = Infinity;
    for (const t of this.traffic) {
      if (!t.isPolice) continue;
      const dx = x - t.x, dz = z - t.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < best) best = d;
    }
    return best;
  }

  nearestLeaf(x, z, r) {
    const r2 = r * r;
    for (const l of this.leaves) {
      if (l.collected) continue;
      const dx = x - l.x, dz = z - l.z;
      if (dx * dx + dz * dz < r2) return l;
    }
    return null;
  }

  collectLeaf(id) {
    const l = this.leaves.find((leaf) => leaf.id === id);
    if (!l || l.collected) return null;
    l.collected = true;
    l.mesh.visible = false;
    return l;
  }

  // ─── Reset / Save ──────────────────────────────────────────────────────
  reset() {
    this.markLeavesCollected(this.leaves.map((l) => l.id)); // reset = tout collecter
    this.leaves.forEach((l) => {
      l.collected = false;
      l.mesh.visible = true;
    });
    this.roadCollisions.reset();
    this.trafficSignals.reset();
  }

  // ─── Dispose ───────────────────────────────────────────────────────────
  dispose() {
    // Sous-systèmes routiers
    this.trafficSignals.dispose();
    this.roadIncidents.dispose();

    // Géométries/matériaux propres à cette instance
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        // Ne dispose que les matériaux qu'on a créés localement
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m && this._ownedMaterials.has(m)) m.dispose();
        }
      }
      if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
    });

    // Matériaux partagés globaux
    matLib.dispose();

    // Détache la racine
    if (this.group.parent) this.group.parent.remove(this.group);

    this._ownedMaterials.clear();
    this.shops = [];
    this.garages = [];
    this.doors = [];
    this.leaves = [];
    this.traffic = [];
    this.wildlife.entities = [];
    this.streetlights = [];
    this.windowMeshes = [];
  }
}

export default PortneufWorld;
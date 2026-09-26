/**
 * ═══════════════════════════════════════════════════════════════════
 * 💡 TROXTWORLD — SYSTÈME DE PHARES & ÉCLAIRAGE NOCTURNE DE VÉHICULE
 * ═══════════════════════════════════════════════════════════════════
 *
 * 📁 Emplacement : src/vehicle/lights/VehicleLightRig.js
 *
 * ✨ Contenu :
 *    - Feux de croisement / route (SpotLight + cône volumétrique)
 *    - Feux de jour (DRL) automatiques quand les phares sont éteints
 *    - Veilleuses + feux stop (lissés, pas de "pop" visuel)
 *    - Feux de recul
 *    - Clignotants avant/arrière (gauche / droite / warning) avec cadence
 *    - Feux de brouillard avant (éclairage d'intersection) et arrière
 *    - Éclairage de plaque + plafonnier d'habitacle
 *    - Gyrophare rotatif optionnel (police / ambulance / dépanneuse)
 *    - Réglage automatique de l'assiette des phares selon vitesse/freinage
 *    - Lissage temporel (delta-time) sur toutes les intensités
 *    - 3 niveaux de qualité pour maîtriser le coût GPU
 *    - Presets par type de véhicule + fonction de dispose propre
 *
 * 🚀 v2 — Corrections & optimisation :
 *    - `interiorBulb` exposé dans le rig (fix crash update)
 *    - `blinkTimer` : modulo propre, plus de dérive flottante
 *    - `castShadow` désactivé par défaut (perf)
 *    - `headlightsOn` : défaut `false` (plus de phares en plein jour)
 *    - `shadow.camera.far` synchronisé avec `spot.distance`
 *    - `QUALITY_RANK` hoisté au niveau module
 *    - `dispose()` : dédup géométries & matériaux via Set
 * ═══════════════════════════════════════════════════════════════════
 */

import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════
 * CONSTANTES
 * ═══════════════════════════════════════════════════════════════════ */

/** Désactivé par défaut : 40 shadow maps @ 512² tuent le framerate. */
const DEFAULT_OPTIONS = {
  frontZ: 2.15,
  backZ: -2.15,
  width: 1.45,
  height: 0.75,
  xenon: false,
  castShadow: false,
  shadowMapSize: 512,
  beamLength: 30,
  baseIntensity: 2.8,
  highBeamIntensity: 4.6,
  quality: "medium",
  hasBeacon: false,
};

/** Hoisté : plus d'allocation par frame dans updateVehicleLights. */
const QUALITY_RANK = {
  low: 0,
  medium: 1,
  high: 2,
};

const TAIL_RED = 0xff1100;
const BRAKE_RED = 0xff2200;
const TAIL_RED_LOW = 0xd01000;
const AMBER = 0xff9a1f;
const XENON_WHITE = 0xe8f4ff;
const HALOGEN_WHITE = 0xfffae8;

/** Durée d'un cycle de clignotant (s) */
const BLINK_PERIOD = 0.66;
/** Fraction du cycle où le clignotant est allumé */
const BLINK_DUTY = 0.45;

/* ═══════════════════════════════════════════════════════════════════
 * PRESETS PAR TYPE DE VÉHICULE
 * ═══════════════════════════════════════════════════════════════════ */

export const VEHICLE_LIGHT_PRESETS = {
  citadine: { width: 1.45, height: 0.75, frontZ: 2.15, backZ: -2.15 },
  berline: { width: 1.55, height: 0.72, frontZ: 2.6, backZ: -2.6 },
  sportive: {
    width: 1.62,
    height: 0.6,
    frontZ: 2.5,
    backZ: -2.5,
    xenon: true,
    baseIntensity: 3.2,
    castShadow: true,
  },
  suv: { width: 1.7, height: 0.95, frontZ: 2.7, backZ: -2.7 },
  camion: {
    width: 2.2,
    height: 1.6,
    frontZ: 4.2,
    backZ: -4.2,
    castShadow: false,
    quality: "low",
  },
  moto: { width: 0.6, height: 0.85, frontZ: 1.1, backZ: -1.1 },
  police: {
    width: 1.6,
    height: 0.75,
    frontZ: 2.5,
    backZ: -2.5,
    quality: "high",
    castShadow: true,
    hasBeacon: true,
  },
  ambulance: {
    width: 1.9,
    height: 1.3,
    frontZ: 3.2,
    backZ: -3.2,
    quality: "high",
    hasBeacon: true,
  },
  depanneuse: {
    width: 2.1,
    height: 1.2,
    frontZ: 3.4,
    backZ: -3.4,
    quality: "high",
    hasBeacon: true,
  },
};

/* ═══════════════════════════════════════════════════════════════════
 * CRÉATION DU RIG
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Crée un rig d'éclairage complet pour un véhicule.
 *
 * Deux syntaxes supportées :
 *   createVehicleLightRig({ width: 1.6, xenon: true })   // recommandé
 *   createVehicleLightRig(2.15, -2.15, 1.45, 0.75, true) // ancienne API
 */
export function createVehicleLightRig(
  optionsOrFrontZ = {},
  legacyBackZ,
  legacyWidth,
  legacyHeight,
  legacyXenon,
) {
  /* ---------- Résolution des options ---------- */
  const o =
    typeof optionsOrFrontZ === "number"
      ? {
          ...DEFAULT_OPTIONS,
          frontZ: optionsOrFrontZ,
          backZ: legacyBackZ ?? DEFAULT_OPTIONS.backZ,
          width: legacyWidth ?? DEFAULT_OPTIONS.width,
          height: legacyHeight ?? DEFAULT_OPTIONS.height,
          xenon: legacyXenon ?? DEFAULT_OPTIONS.xenon,
        }
      : { ...DEFAULT_OPTIONS, ...optionsOrFrontZ };

  const q = QUALITY_RANK[o.quality];

  const { frontZ, backZ, width, height } = o;
  const halfW = width / 2;
  const headColor = o.xenon ? XENON_WHITE : HALOGEN_WHITE;

  const group = new THREE.Group();
  group.name = "vehicle_light_rig";

  /* ---------- Helpers ---------- */

  const makeBulb = (
    geo,
    x,
    y,
    z,
    color,
    emissive,
    emissiveIntensity,
  ) => {
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity,
      roughness: 0.12,
      metalness: 0.05,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.renderOrder = 1;
    group.add(mesh);
    return mesh;
  };

  const makePointLight = (
    color,
    x,
    y,
    z,
    distance,
    decay = 2,
  ) => {
    const l = new THREE.PointLight(color, 0, distance, decay);
    l.position.set(x, y, z);
    l.visible = false;
    group.add(l);
    return l;
  };

  /* ═══════════════ 1. PHARES (SpotLight + volumétrie) ═══════════════ */

  const headSpots = [];
  const headTargets = [];

  const createHeadSpot = (x) => {
    const spot = new THREE.SpotLight(
      headColor,
      o.baseIntensity,
      70,
      Math.PI / 7,
      0.65,
      1.4,
    );
    spot.position.set(x, height, frontZ);
    spot.castShadow = o.castShadow;

    if (o.castShadow) {
      spot.shadow.mapSize.set(o.shadowMapSize, o.shadowMapSize);
      spot.shadow.camera.near = 0.5;
      spot.shadow.camera.far = 90;
      spot.shadow.bias = -0.002;
      spot.shadow.normalBias = 0.02;
    }

    const target = new THREE.Object3D();
    target.position.set(x * 0.4, 0, frontZ + 45);

    group.add(spot, target);
    spot.target = target;

    headSpots.push(spot);
    headTargets.push(target);
    return spot;
  };

  const leftSpot = createHeadSpot(-halfW);
  const rightSpot = createHeadSpot(halfW);

  // Cône volumétrique : étroit au niveau de l'optique, large au loin.
  const beamGeo = new THREE.CylinderGeometry(1.35, 0.06, 1, 20, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, 0.5);

  const makeBeam = (x) => {
    const mat = new THREE.MeshBasicMaterial({
      color: headColor,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(beamGeo, mat);
    mesh.position.set(x, height, frontZ);
    mesh.scale.z = o.beamLength;
    mesh.renderOrder = 2;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  };

  const beamL = makeBeam(-halfW);
  const beamR = makeBeam(halfW);

  /* ═══════════════ 2. LENTILLES AVANT & FEUX DE JOUR ═══════════════ */

  const headBulbGeo = new THREE.BoxGeometry(0.2, 0.13, 0.05);
  const headBulbs = [
    makeBulb(headBulbGeo, -halfW, height, frontZ + 0.02, 0xeaf2ff, headColor, 0.1),
    makeBulb(headBulbGeo, halfW, height, frontZ + 0.02, 0xeaf2ff, headColor, 0.1),
  ];

  const drlGeo = new THREE.BoxGeometry(0.3, 0.045, 0.04);
  const drlBulbs = [
    makeBulb(drlGeo, -halfW, height - 0.12, frontZ + 0.02, 0xffffff, 0xdfe9ff, 2.0),
    makeBulb(drlGeo, halfW, height - 0.12, frontZ + 0.02, 0xffffff, 0xdfe9ff, 2.0),
  ];

  /* ═══════════════ 3. FEUX ARRIÈRE ═══════════════ */

  const tailBulbGeo = new THREE.BoxGeometry(0.24, 0.1, 0.05);
  const tailBulbs = [
    makeBulb(tailBulbGeo, -halfW, height, backZ - 0.02, 0x9b0d0d, TAIL_RED, 0.08),
    makeBulb(tailBulbGeo, halfW, height, backZ - 0.02, 0x9b0d0d, TAIL_RED, 0.08),
  ];

  const tailPoint = makePointLight(TAIL_RED, 0, height, backZ - 0.4, 12);

  const reverseGeo = new THREE.BoxGeometry(0.12, 0.08, 0.04);
  const reverseBulbs = [
    makeBulb(reverseGeo, -halfW * 0.55, height - 0.06, backZ - 0.02, 0xd8d8d8, 0xffffff, 0.05),
    makeBulb(reverseGeo, halfW * 0.55, height - 0.06, backZ - 0.02, 0xd8d8d8, 0xffffff, 0.05),
  ];

  const reversePoint = makePointLight(0xffffff, 0, height - 0.1, backZ - 0.3, 10);

  const rearFogGeo = new THREE.BoxGeometry(0.1, 0.06, 0.04);
  const rearFogBulbs = [
    makeBulb(rearFogGeo, -halfW * 0.3, height - 0.14, backZ - 0.03, 0x5a0000, BRAKE_RED, 0.05),
  ];
  const rearFogPoint = makePointLight(BRAKE_RED, -halfW * 0.3, height - 0.14, backZ - 0.35, 8);

  /* ═══════════════ 4. CLIGNOTANTS ═══════════════ */

  const indGeo = new THREE.BoxGeometry(0.1, 0.07, 0.04);

  const indicatorBulbs = {
    left: [
      makeBulb(indGeo, -halfW, height - 0.02, frontZ + 0.06, 0x5a3a00, AMBER, 0.05),
      makeBulb(indGeo, -halfW, height - 0.03, backZ - 0.06, 0x5a3a00, AMBER, 0.05),
    ],
    right: [
      makeBulb(indGeo, halfW, height - 0.02, frontZ + 0.06, 0x5a3a00, AMBER, 0.05),
      makeBulb(indGeo, halfW, height - 0.03, backZ - 0.06, 0x5a3a00, AMBER, 0.05),
    ],
  };

  const indicatorLights = {
    left: makePointLight(AMBER, -halfW, height, frontZ + 0.12, 6),
    right: makePointLight(AMBER, halfW, height, frontZ + 0.12, 6),
  };

  /* ═══════════════ 5. BROUILLARD AVANT / INTERSECTION ═══════════════ */

  const fogBulbGeo = new THREE.BoxGeometry(0.12, 0.08, 0.04);
  const frontFogBulbs = [
    makeBulb(fogBulbGeo, -halfW * 0.85, height - 0.35, frontZ + 0.02, 0xe8e0c8, 0xfff2cc, 0.05),
    makeBulb(fogBulbGeo, halfW * 0.85, height - 0.35, frontZ + 0.02, 0xe8e0c8, 0xfff2cc, 0.05),
  ];

  const frontFogLights = [
    makePointLight(0xfff2cc, -halfW * 0.85, height - 0.35, frontZ + 0.15, 16),
    makePointLight(0xfff2cc, halfW * 0.85, height - 0.35, frontZ + 0.15, 16),
  ];

  /* ═══════════════ 6. PLAQUE + HABITACLE ═══════════════ */

  const licensePlateLight = makePointLight(0xffffff, 0, height - 0.18, backZ - 0.25, 2.5);

  const interiorLight = makePointLight(0xffd9a0, 0, height + 0.3, 0.1, 3.5);
  const interiorBulb = makeBulb(
    new THREE.BoxGeometry(0.16, 0.03, 0.16),
    0,
    height + 0.36,
    0.1,
    0xfff0d0,
    0xffd9a0,
    0.05,
  );

  /* ═══════════════ 7. GYROPHARE (optionnel) ═══════════════ */

  let beacon = null;
  // Créé si le preset le demande OU si qualité high
  if (o.hasBeacon || q >= 2) {
    const beaconGroup = new THREE.Group();
    beaconGroup.name = "vehicle_beacon";
    beaconGroup.position.set(0, height + 0.22, 0.2);

    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      emissive: 0xff5500,
      emissiveIntensity: 0.05,
      roughness: 0.25,
      transparent: true,
      opacity: 0.95,
    });
    const domeGeo = new THREE.SphereGeometry(0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, domeMat);
    beaconGroup.add(dome);

    const beaconLight = new THREE.PointLight(0xff5500, 0, 22, 2);
    beaconLight.position.set(0.14, 0.02, 0);
    beaconGroup.add(beaconLight);

    group.add(beaconGroup);
    beacon = { group: beaconGroup, light: beaconLight, dome };
  }

  /* ═══════════════ 8. RETOUR ═══════════════ */

  return {
    group,
    leftSpot,
    rightSpot,
    headSpots,
    leftTarget: headTargets[0],
    rightTarget: headTargets[1],
    headTargets,
    volumetricBeams: [beamL, beamR],
    headBulbs,
    drlBulbs,
    tailPoint,
    tailBulbs,
    reversePoint,
    reverseBulbs,
    rearFogPoint,
    rearFogBulbs,
    indicatorBulbs,
    indicatorLights,
    frontFogLights,
    frontFogBulbs,
    licensePlateLight,
    interiorLight,
    interiorBulb, // ✅ correctement exposé
    beacon,
    isHighBeam: false,
    isOn: false, // ✅ cohérent avec headlightsOn=false par défaut
    settings: o,
    state: {
      isOn: false,
      isHighBeam: false,
      isBraking: false,
      isReversing: false,
      isFogOn: false,
      isFrontFogOn: false,
      isRearFogOn: false,
      isInteriorOn: false,
      isBeaconOn: false,
      indicator: "off",
      blinkTimer: 0,
      blinkOn: false,
      headGlow: 0,
      highBeamGlow: 0,
      brakeGlow: 0,
      reverseGlow: 0,
      fogGlow: 0,
      interiorGlow: 0,
      beaconAngle: 0,
      speedKmh: 0,
    },
  };
}

/** Raccourci : crée un rig à partir d'un preset nommé. */
export function createVehicleLightRigFromPreset(
  preset,
  overrides = {},
) {
  return createVehicleLightRig({
    ...(VEHICLE_LIGHT_PRESETS[preset] ?? VEHICLE_LIGHT_PRESETS.citadine),
    ...overrides,
  });
}

/* ═══════════════════════════════════════════════════════════════════
 * MISE À JOUR (à appeler chaque frame)
 * ═══════════════════════════════════════════════════════════════════ */

export function updateVehicleLights(
  rig,
  opts = {},
) {
  const dt = Math.min(Math.max(opts.delta ?? 1 / 60, 0), 0.1);
  const st = rig.state;
  const s = rig.settings;
  const q = QUALITY_RANK[s.quality];

  /* ---------- 1. État logique ---------- */
  // ✅ Défaut false : pas de phares en plein jour sans contexte explicite
  const wantHead = opts.headlightsOn ?? opts.isNight ?? false;
  const wantHigh =
    wantHead && (opts.highBeam === true || opts.flashHighBeam === true);
  const braking = opts.isBraking === true;
  const reversing = opts.isReversing === true;
  const indicator = opts.indicator ?? "off";

  st.isOn = wantHead;
  st.isHighBeam = wantHigh;
  st.isBraking = braking;
  st.isReversing = reversing;
  st.speedKmh = opts.speedKmh ?? 0;

  rig.isOn = wantHead;
  rig.isHighBeam = wantHigh;

  /* ---------- 2. Clignotants ---------- */
  // ✅ Modulo propre : pas de dérive flottante sur des heures de jeu
  st.blinkTimer += dt;
  if (st.blinkTimer >= BLINK_PERIOD) {
    st.blinkTimer -= BLINK_PERIOD * Math.floor(st.blinkTimer / BLINK_PERIOD);
  }
  const phase = st.blinkTimer / BLINK_PERIOD;
  const blinkOn = phase < BLINK_DUTY;

  st.indicator = indicator;
  st.blinkOn = blinkOn && indicator !== "off";

  const leftBlink = st.blinkOn && (indicator === "left" || indicator === "hazards");
  const rightBlink = st.blinkOn && (indicator === "right" || indicator === "hazards");

  /* ---------- 3. Lissage temporel ---------- */
  st.headGlow = THREE.MathUtils.damp(st.headGlow, wantHead ? 1 : 0, wantHead ? 16 : 10, dt);
  st.highBeamGlow = THREE.MathUtils.damp(st.highBeamGlow, wantHigh ? 1 : 0, 14, dt);
  st.brakeGlow = THREE.MathUtils.damp(
    st.brakeGlow,
    braking ? 1 : 0,
    braking ? 26 : 12,
    dt,
  );
  st.reverseGlow = THREE.MathUtils.damp(st.reverseGlow, reversing ? 1 : 0, 20, dt);

  const hb = st.highBeamGlow;

  /* ---------- 4. Phares ---------- */
  const lowI = s.baseIntensity * st.headGlow;
  const highI = s.highBeamIntensity * st.highBeamGlow;
  const spotI = Math.max(lowI, highI);

  for (const spot of rig.headSpots) {
    const dist = THREE.MathUtils.lerp(65, 115, hb);
    spot.intensity = spotI;
    spot.distance = dist;
    spot.angle = THREE.MathUtils.lerp(Math.PI / 6.2, Math.PI / 9, hb);
    spot.penumbra = THREE.MathUtils.lerp(0.7, 0.45, hb);
    spot.visible = spotI > 0.002;

    // ✅ Sync shadow.far avec la portée réelle + marge
    if (spot.castShadow) {
      spot.shadow.camera.far = dist + 5;
      spot.shadow.camera.updateProjectionMatrix();
    }
  }

  // Assiette dynamique : phares se relèvent avec la vitesse,
  // plongent légèrement au freinage (effet "plongée" réaliste).
  const speed = st.speedKmh;
  const aimY = -0.5 + THREE.MathUtils.clamp(speed / 180, 0, 1) * 0.55 - st.brakeGlow * 0.15;
  for (const t of rig.headTargets) t.position.y = aimY;

  // Faisceaux volumétriques
  const beamOpacity = st.headGlow * (0.075 + hb * 0.075);
  const beamScaleZ = s.beamLength * (1 + hb * 0.8);
  for (const b of rig.volumetricBeams) {
    b.visible = beamOpacity > 0.002;
    b.material.opacity = beamOpacity;
    b.scale.z = beamScaleZ;
  }

  // Lentilles avant
  const headEmissive = 0.06 + st.headGlow * (2.2 + hb * 1.9);
  for (const b of rig.headBulbs) {
    b.material.emissiveIntensity = headEmissive;
  }

  // Feux de jour : allumés quand les phares sont éteints
  const drlGlow = 1 - st.headGlow;
  for (const b of rig.drlBulbs) {
    b.material.emissiveIntensity = 0.05 + drlGlow * 2.0;
  }

  /* ---------- 5. Feux arrière (veilleuse + stop) ---------- */
  const posGlow = st.headGlow;
  const tailEmissive = 0.05 + posGlow * 0.9 + st.brakeGlow * 3.2;
  const tailHex = st.brakeGlow > 0.35 ? BRAKE_RED : TAIL_RED_LOW;

  for (const b of rig.tailBulbs) {
    const m = b.material;
    m.emissiveIntensity = tailEmissive;
    m.emissive.setHex(tailHex);
  }

  rig.tailPoint.intensity = posGlow * 0.7 + st.brakeGlow * 3.4;
  rig.tailPoint.color.setHex(tailHex);
  rig.tailPoint.visible = rig.tailPoint.intensity > 0.002;

  /* ---------- 6. Feux de recul ---------- */
  rig.reversePoint.intensity = st.reverseGlow * 2.2;
  rig.reversePoint.visible = st.reverseGlow > 0.01;

  for (const b of rig.reverseBulbs) {
    b.material.emissiveIntensity =
      0.05 + st.reverseGlow * 3.0;
  }

  /* ---------- 7. Brouillard arrière ---------- */
  const rearFogOn = opts.rearFog === true && (wantHead || posGlow > 0.05);
  rig.rearFogPoint.intensity = rearFogOn ? 2.0 : 0;
  rig.rearFogPoint.visible = rearFogOn && q >= 1;

  for (const b of rig.rearFogBulbs) {
    b.material.emissiveIntensity = rearFogOn
      ? 3.0
      : 0.05;
  }

  /* ---------- 8. Clignotants ---------- */
  const indEmissive = (on) => (on ? 3.0 : 0.05);
  for (const b of rig.indicatorBulbs.left) {
    b.material.emissiveIntensity = indEmissive(leftBlink);
  }
  for (const b of rig.indicatorBulbs.right) {
    b.material.emissiveIntensity = indEmissive(rightBlink);
  }

  rig.indicatorLights.left.intensity = leftBlink ? 1.6 : 0;
  rig.indicatorLights.left.visible = leftBlink && q >= 1;
  rig.indicatorLights.right.intensity = rightBlink ? 1.6 : 0;
  rig.indicatorLights.right.visible = rightBlink && q >= 1;

  /* ---------- 9. Brouillard avant / intersection ---------- */
  const frontFogOn = opts.frontFog === true;
  const cornerLeft = indicator === "left" || indicator === "hazards";
  const cornerRight = indicator === "right" || indicator === "hazards";

  const fogLI = (frontFogOn ? 1.8 : 0) + (cornerLeft && !frontFogOn ? 0.8 : 0);
  const fogRI = (frontFogOn ? 1.8 : 0) + (cornerRight && !frontFogOn ? 0.8 : 0);

  rig.frontFogLights[0].intensity = fogLI;
  rig.frontFogLights[0].visible = fogLI > 0.01 && q >= 1;
  rig.frontFogLights[1].intensity = fogRI;
  rig.frontFogLights[1].visible = fogRI > 0.01 && q >= 1;

  for (let i = 0; i < rig.frontFogBulbs.length; i++) {
    const target = i === 0 ? fogLI : fogRI;
    rig.frontFogBulbs[i].material.emissiveIntensity =
      target > 0.01 ? 1.2 + target * 0.8 : 0.05;
  }

  st.isFrontFogOn = frontFogOn;
  st.isRearFogOn = rearFogOn;
  st.isFogOn = frontFogOn || rearFogOn;

  /* ---------- 10. Plaque ---------- */
  const plateOn = posGlow > 0.05;
  rig.licensePlateLight.intensity = plateOn ? 0.35 : 0;
  rig.licensePlateLight.visible = plateOn && q >= 2;

  /* ---------- 11. Plafonnier ---------- */
  const interiorOn = opts.interior === true;
  st.interiorGlow = THREE.MathUtils.damp(st.interiorGlow, interiorOn ? 1 : 0, 10, dt);
  st.isInteriorOn = interiorOn;

  rig.interiorLight.intensity = st.interiorGlow * 1.2;
  rig.interiorLight.visible = st.interiorGlow > 0.01 && q >= 2;

  // ✅ Fixed : interiorBulb est maintenant exposé dans le rig
  rig.interiorBulb.material.emissiveIntensity =
    0.05 + st.interiorGlow * 1.8;

  /* ---------- 12. Gyrophare ---------- */
  if (rig.beacon) {
    const beaconOn = opts.beacon === true;
    st.isBeaconOn = beaconOn;

    st.beaconAngle += dt * 7;
    if (st.beaconAngle > Math.PI * 2) st.beaconAngle -= Math.PI * 2;
    rig.beacon.group.rotation.y = st.beaconAngle;

    const pulse = 0.5 + 0.5 * Math.sin(st.beaconAngle * 3);
    rig.beacon.light.intensity = beaconOn ? 1.0 + pulse * 2.8 : 0;
    rig.beacon.light.visible = beaconOn;

    rig.beacon.dome.material.emissiveIntensity =
      beaconOn ? 1.5 + pulse * 2.2 : 0.05;
  }
}

/* ═══════════════════════════════════════════════════════════════════
 * UTILITAIRES
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Attache le rig à un véhicule (Group / Mesh / Object3D).
 * Le rig est en coordonnées locales du véhicule.
 */
export function attachVehicleLightRigToVehicle(
  rig,
  vehicle,
  localPosition,
) {
  if (localPosition) {
    rig.group.position.set(localPosition.x, localPosition.y, localPosition.z);
  }
  vehicle.add(rig.group);
  return rig.group;
}

/** Allume / éteint instantanément tout le rig (utile pour le culling). */
export function setVehicleLightRigVisible(rig, visible) {
  rig.group.visible = visible;
}

/**
 * Libère toutes les ressources GPU du rig.
 * ⚠️ À appeler impérativement quand tu retires un véhicule de la scène,
 * sinon tu accumules des géométries / matériaux / shadow maps en mémoire.
 *
 * ✅ Dédup via Set : les géométries et matériaux partagés entre meshes
 * ne sont disposés qu'une seule fois.
 */
export function disposeVehicleLightRig(rig) {
  const disposedGeo = new Set();
  const disposedMat = new Set();

  rig.group.traverse((obj) => {
    if (obj.geometry && !disposedGeo.has(obj.geometry)) {
      disposedGeo.add(obj.geometry);
      obj.geometry.dispose();
    }

    const mat = obj.material;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of mats) {
      if (!disposedMat.has(m)) {
        disposedMat.add(m);
        m.dispose();
      }
    }

    if (obj.isSpotLight) {
      obj.shadow?.map?.dispose();
    }

    if (obj.isPointLight) {
      obj.shadow?.map?.dispose();
    }
  });

  rig.group.clear();
  rig.group.removeFromParent();
}
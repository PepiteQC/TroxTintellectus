/**
 * Gyrophare SQ / SPVM — rotateurs mécaniques, strobes, flèche ambre, takedown.
 * Les SpotLight de balayage ne sont montés que sur l'intercepteur joueur (hero).
 * Le trafic n'a que les meshes (pas de lumière par voiture).
 */
import * as THREE from "three";
import { wireCsm } from "@/utils/csm";

const GEO = {
  foot: new THREE.BoxGeometry(0.08, 0.08, 0.32),
  base: new THREE.BoxGeometry(1.42, 0.05, 0.34),
  rail: new THREE.BoxGeometry(1.44, 0.018, 0.018),
  dome: new THREE.BoxGeometry(1.46, 0.12, 0.36),
  lens: new THREE.BoxGeometry(0.52, 0.1, 0.33),
  divider: new THREE.BoxGeometry(0.2, 0.1, 0.35),
  emblem: new THREE.BoxGeometry(0.12, 0.04, 0.02),
  endCap: new THREE.BoxGeometry(0.05, 0.1, 0.36),
  rib: new THREE.BoxGeometry(0.012, 0.108, 0.368),
  dish: (() => {
    const g = new THREE.CylinderGeometry(0.1, 0.04, 0.09, 16, 1, true);
    g.rotateX(Math.PI / 2);
    return g;
  })(),
  dishBack: (() => {
    const g = new THREE.CircleGeometry(0.04, 12);
    g.rotateX(Math.PI / 2);
    return g;
  })(),
  bulb: new THREE.SphereGeometry(0.038, 12, 10),
  strobe: new THREE.BoxGeometry(0.08, 0.06, 0.08),
  led: new THREE.BoxGeometry(0.08, 0.04, 0.02),
  take: new THREE.BoxGeometry(0.09, 0.045, 0.02),
  alley: new THREE.BoxGeometry(0.02, 0.05, 0.08),
};

const MAT = {
  chrome: new THREE.MeshStandardMaterial({ color: 0xc5ced8, metalness: 0.95, roughness: 0.16 }),
  dome: new THREE.MeshLambertMaterial({ color: 0xd8e4ee, transparent: true, opacity: 0.22, depthWrite: false }),
  casing: new THREE.MeshLambertMaterial({ color: 0x09090b }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xf4f7fb, metalness: 1, roughness: 0.06 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xcaa24d, metalness: 0.82, roughness: 0.28 }),
  redOn: new THREE.MeshBasicMaterial({ color: 0xff1e1e }),
  redOff: new THREE.MeshLambertMaterial({ color: 0x550505 }),
  redLensOn: new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.42, depthWrite: false }),
  redLensOff: new THREE.MeshLambertMaterial({
    color: 0x8a1818,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  }),
  blueOn: new THREE.MeshBasicMaterial({ color: 0x3b82f6 }),
  blueOff: new THREE.MeshLambertMaterial({ color: 0x04184a }),
  blueLensOn: new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.42, depthWrite: false }),
  blueLensOff: new THREE.MeshLambertMaterial({
    color: 0x122a6a,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  }),
  amberOn: new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
  amberOff: new THREE.MeshLambertMaterial({ color: 0x451a03 }),
  whiteOn: new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
  whiteOff: new THREE.MeshLambertMaterial({ color: 0x334155 }),
};

let matsWired = false;
function wireBarMats() {
  if (matsWired) return;
  matsWired = true;
  MAT.chrome.userData.keepPbr = true;
  MAT.mirror.userData.keepPbr = true;
  MAT.gold.userData.keepPbr = true;
  wireCsm(MAT.chrome);
  wireCsm(MAT.mirror);
  wireCsm(MAT.gold);
  wireCsm(MAT.casing);
  wireCsm(MAT.redOff);
  wireCsm(MAT.blueOff);
  wireCsm(MAT.amberOff);
  wireCsm(MAT.whiteOff);
}

function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  m.frustumCulled = true;
  return m;
}

function isEmergency(active, pattern) {
  return active && (pattern === "code2_visual" || pattern === "code3_emergency" || pattern === "pursuit_hyper");
}

function deptColors(department) {
  const sq = department === "SQ";
  return {
    leftHex: sq ? 0xef4444 : 0x2563eb,
    rightHex: 0x2563eb,
    leftOn: sq ? MAT.redOn : MAT.blueOn,
    leftOff: sq ? MAT.redOff : MAT.blueOff,
    leftLensOn: sq ? MAT.redLensOn : MAT.blueLensOn,
    leftLensOff: sq ? MAT.redLensOff : MAT.blueLensOff,
    rightOn: MAT.blueOn,
    rightOff: MAT.blueOff,
    rightLensOn: MAT.blueLensOn,
    rightLensOff: MAT.blueLensOff,
  };
}

export function buildPoliceLightbar(
  scale = 1,
  department = "SQ",
  hero = false,
) {
  wireBarMats();
  const group = new THREE.Group();
  group.name = "sq-lightbar";
  group.scale.setScalar(scale);
  const col = deptColors(department);

  group.add(mesh(GEO.foot, MAT.chrome, -0.6, -0.06, 0));
  group.add(mesh(GEO.foot, MAT.chrome, 0.6, -0.06, 0));
  group.add(mesh(GEO.base, MAT.chrome, 0, 0, 0));
  group.add(mesh(GEO.rail, MAT.chrome, 0, 0.035, 0.175));
  group.add(mesh(GEO.rail, MAT.chrome, 0, 0.035, -0.175));
  group.add(mesh(GEO.endCap, MAT.chrome, -0.735, 0.06, 0));
  group.add(mesh(GEO.endCap, MAT.chrome, 0.735, 0.06, 0));

  const dome = mesh(GEO.dome, MAT.dome, 0, 0.07, 0);
  group.add(dome);

  const leftLens = mesh(GEO.lens, col.leftLensOff, -0.48, 0.07, 0);
  const rightLens = mesh(GEO.lens, col.rightLensOff, 0.48, 0.07, 0);
  group.add(leftLens, rightLens);

  for (const x of [-0.62, -0.34, 0.34, 0.62]) {
    group.add(mesh(GEO.rib, MAT.chrome, x, 0.07, 0));
  }

  const divider = mesh(GEO.divider, MAT.casing, 0, 0.06, 0);
  group.add(divider);
  const emblem = mesh(GEO.emblem, MAT.gold, 0, 0.08, 0.175);
  group.add(emblem);

  const leftSpin = new THREE.Group();
  leftSpin.add(mesh(GEO.dish, MAT.mirror, 0, 0, 0));
  leftSpin.add(mesh(GEO.dishBack, MAT.mirror, 0, 0, -0.02));
  const leftBulb = mesh(GEO.bulb, col.leftOff, 0, 0, 0);
  leftSpin.add(leftBulb);
  const leftMount = new THREE.Group();
  leftMount.position.set(-0.45, 0.06, 0);
  leftMount.add(leftSpin);
  group.add(leftMount);

  const rightSpin = new THREE.Group();
  rightSpin.add(mesh(GEO.dish, MAT.mirror, 0, 0, 0));
  rightSpin.add(mesh(GEO.dishBack, MAT.mirror, 0, 0, -0.02));
  const rightBulb = mesh(GEO.bulb, col.rightOff, 0, 0, 0);
  rightSpin.add(rightBulb);
  const rightMount = new THREE.Group();
  rightMount.position.set(0.45, 0.06, 0);
  rightMount.add(rightSpin);
  group.add(rightMount);

  const strobeLF = mesh(GEO.strobe, col.leftOff, -0.66, 0.06, 0.12);
  const strobeRF = mesh(GEO.strobe, col.rightOff, 0.66, 0.06, 0.12);
  const strobeLR = mesh(GEO.strobe, col.leftOff, -0.66, 0.06, -0.12);
  const strobeRR = mesh(GEO.strobe, col.rightOff, 0.66, 0.06, -0.12);
  group.add(strobeLF, strobeRF, strobeLR, strobeRR);

  const advisor = [];
  const advRoot = new THREE.Group();
  advRoot.position.set(0, 0.06, -0.165);
  for (const x of [-0.32, -0.19, -0.06, 0.06, 0.19, 0.32]) {
    const led = mesh(GEO.led, MAT.amberOff, x, 0, 0);
    advisor.push(led);
    advRoot.add(led);
  }
  group.add(advRoot);

  const takeL = mesh(GEO.take, MAT.whiteOff, -0.18, 0.06, 0.165);
  const takeR = mesh(GEO.take, MAT.whiteOff, 0.18, 0.06, 0.165);
  group.add(takeL, takeR);

  const alleyL = mesh(GEO.alley, MAT.whiteOff, -0.74, 0.06, 0);
  const alleyR = mesh(GEO.alley, MAT.whiteOff, 0.74, 0.06, 0);
  group.add(alleyL, alleyR);

  let leftSpot = null;
  let rightSpot = null;
  let leftTarget = null;
  let rightTarget = null;
  let takeSpot = null;
  let halo = null;

  if (hero) {
    leftTarget = new THREE.Object3D();
    leftTarget.position.set(0, -4.2, 6);
    leftMount.add(leftTarget);
    leftSpot = new THREE.SpotLight(col.leftHex, 0, 18, 0.78, 0.45, 2);
    leftSpot.position.set(0, 0.08, 0);
    leftSpot.target = leftTarget;
    leftSpot.castShadow = false;
    leftSpot.visible = false;
    leftMount.add(leftSpot);

    rightTarget = new THREE.Object3D();
    rightTarget.position.set(0, -4.2, 6);
    rightMount.add(rightTarget);
    rightSpot = new THREE.SpotLight(col.rightHex, 0, 18, 0.78, 0.45, 2);
    rightSpot.position.set(0, 0.08, 0);
    rightSpot.target = rightTarget;
    rightSpot.castShadow = false;
    rightSpot.visible = false;
    rightMount.add(rightSpot);

    const takeAim = new THREE.Object3D();
    takeAim.position.set(0, -0.6, 18);
    group.add(takeAim);
    takeSpot = new THREE.SpotLight(0xf8fafc, 0, 28, 0.55, 0.4, 2);
    takeSpot.position.set(0, 0.08, 0.2);
    takeSpot.target = takeAim;
    takeSpot.castShadow = false;
    takeSpot.visible = false;
    group.add(takeSpot);

    halo = new THREE.PointLight(department === "SQ" ? 0x3b82f6 : 0x60a5fa, 0, 11, 2);
    halo.position.set(0, 0.28, 0);
    halo.castShadow = false;
    halo.visible = false;
    group.add(halo);
  }

  const handle = {
    group,
    tick(elapsed, opts) {
      const pattern = opts.pattern ?? "code3_emergency";
      const advisorDir = opts.trafficAdvisor ?? "off";
      const emer = isEmergency(opts.active, pattern);
      const phase = opts.sirenPhase ?? 0;
      const rpm = pattern === "pursuit_hyper" ? 16 : 11.5;
      const rot = emer ? (elapsed * rpm + phase * Math.PI) % (Math.PI * 2) : 0;
      leftSpin.rotation.y = -rot;
      rightSpin.rotation.y = rot + Math.PI * 0.5;
      leftBulb.material = emer ? col.leftOn : col.leftOff;
      rightBulb.material = emer ? col.rightOn : col.rightOff;
      leftLens.material = emer ? col.leftLensOn : col.leftLensOff;
      rightLens.material = emer ? col.rightLensOn : col.rightLensOff;

      if (emer) {
        const tick = Math.floor(elapsed * 12) % 4;
        const leftOn = tick < 2;
        strobeLF.material = leftOn ? col.leftOn : col.leftOff;
        strobeLR.material = leftOn ? col.leftOn : col.leftOff;
        strobeRF.material = leftOn ? col.rightOff : col.rightOn;
        strobeRR.material = leftOn ? col.rightOff : col.rightOn;
      } else {
        strobeLF.material = col.leftOff;
        strobeLR.material = col.leftOff;
        strobeRF.material = col.rightOff;
        strobeRR.material = col.rightOff;
      }

      const advOn = opts.active && advisorDir !== "off";
      const step = Math.floor(elapsed * 6) % 6;
      const half = Math.floor(elapsed * 4) % 3;
      for (let i = 0; i < advisor.length; i++) {
        let lit = false;
        if (advOn) {
          if (advisorDir === "left") lit = i === 5 - step;
          else if (advisorDir === "right") lit = i === step;
          else lit = i === 2 - half || i === 3 + half;
        }
        advisor[i].material = lit ? MAT.amberOn : MAT.amberOff;
      }

      const take = Boolean(opts.takedown);
      takeL.material = take ? MAT.whiteOn : MAT.whiteOff;
      takeR.material = take ? MAT.whiteOn : MAT.whiteOff;

      const alley = Boolean(opts.alleyLights);
      alleyL.material = alley ? MAT.whiteOn : MAT.whiteOff;
      alleyR.material = alley ? MAT.whiteOn : MAT.whiteOff;

      if (leftSpot && leftTarget && rightSpot && rightTarget) {
        if (emer) {
          leftTarget.position.set(Math.cos(-rot) * 6.2, -4.2, Math.sin(-rot) * 6.2);
          rightTarget.position.set(Math.cos(rot + Math.PI * 0.5) * 6.2, -4.2, Math.sin(rot + Math.PI * 0.5) * 6.2);
          const hot = pattern === "pursuit_hyper" ? 220 : 150;
          leftSpot.intensity = hot;
          rightSpot.intensity = hot;
          leftSpot.visible = true;
          rightSpot.visible = true;
        } else {
          leftSpot.intensity = 0;
          rightSpot.intensity = 0;
          leftSpot.visible = false;
          rightSpot.visible = false;
        }
      }

      if (takeSpot) {
        takeSpot.intensity = take ? 260 : 0;
        takeSpot.visible = take;
      }

      if (halo) {
        if (emer) {
          const tick = Math.floor(elapsed * 12) % 4;
          halo.color.setHex(tick < 2 ? col.leftHex : col.rightHex);
          halo.intensity = pattern === "pursuit_hyper" ? 28 : alley ? 22 : 16;
          halo.visible = true;
        } else {
          halo.intensity = 0;
          halo.visible = false;
        }
      }
    },
  };

  group.userData.lightbar = handle;
  group.userData.policeBar = true;
  return group;
}

export function findLightbar(root) {
  if (root.userData.lightbar) return root.userData.lightbar;
  let found = null;
  root.traverse((o) => {
    if (!found && o.userData.lightbar) found = o.userData.lightbar;
  });
  return found;
}

export const LIGHTBAR_CYCLE = [
  "off",
  "code1_advisor",
  "code2_visual",
  "code3_emergency",
];

export const LIGHTBAR_LABEL = {
  off: "Gyrophares éteints",
  code1_advisor: "Code 1 · flèche ambre",
  code2_visual: "Code 2 · gyrophares",
  code3_emergency: "Code 3 · urgence",
  pursuit_hyper: "Poursuite",
};
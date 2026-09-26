/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/PORTNEUF/SKY.JS
 * Cycle jour/nuit continu — ciel boréal québécois + aurores
 * ═══════════════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • moonOpacity : formule INVERSE corrigée (nouvelle lune = invisible)
 *   • moonScale : plus gros à la pleine lune
 *   • SSR-safe : guard document dans tous les Canvas
 *   • RNG déterministe (mulberry32) pour étoiles et nuages
 *   • sunDirection() : retourne un vector frais (pas tmp partagé)
 *   • Aurora repositionnée : 0..300 au lieu de -200..600
 *   • Aurora intensity clampée ≥ 0
 *   • Cache skySnap : memoization par clé
 *   • userData TROXT⬡ sur tous les meshes
 *   • dispose() : ordre correct (mesh → geometry → material → texture)
 *   • windSpeed effectif sur drift clouds
 *   • Étoiles : rotation synchrone avec heure (RA)
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/portneuf/sky.js
 */

import * as THREE from 'three';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════
// JSDoc — types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} SkySnap
 * @property {number}  hours
 * @property {number}  elev
 * @property {number}  azimuth
 * @property {boolean} night
 * @property {boolean} dawn
 * @property {boolean} dusk
 * @property {boolean} goldenHour
 * @property {boolean} blueHour
 * @property {number}  hemiSky
 * @property {number}  hemiGround
 * @property {number}  hemiIntensity
 * @property {number}  ambient
 * @property {number}  fog
 * @property {number}  fogDensity
 * @property {number}  bg
 * @property {number}  horizonColor
 * @property {number}  zenithColor
 * @property {number}  sunColor
 * @property {number}  sunIntensity
 * @property {number}  sunHaloOpacity
 * @property {number}  moonPhase       - 0=new, 0.5=full, 1=new
 * @property {number}  moonOpacity
 * @property {number}  cloudOpacity
 * @property {number}  cloudTint
 * @property {number}  cloudCoverage
 * @property {number}  auroraIntensity
 * @property {number}  lamp
 * @property {number}  river
 * @property {number}  starOpacity
 * @property {number}  windSpeed
 */

/**
 * @typedef {object} SkySystem
 * @property {THREE.Group}  root
 * @property {THREE.Mesh}   domeMesh
 * @property {THREE.Sprite} sunSprite
 * @property {THREE.Sprite} sunHalo
 * @property {THREE.Sprite} moonSprite
 * @property {THREE.Points} starsMesh
 * @property {THREE.Group}  cloudsGroup
 * @property {THREE.Mesh}   auroraMesh
 * @property {(snap: SkySnap, dt: number) => void} update
 * @property {() => void}   dispose
 * @property {(day: number) => void} setLunarDay
 */

// ═══════════════════════════════════════════════════════════════════════════
// UTILITAIRES COULEUR + INTERPOLATION
// ═══════════════════════════════════════════════════════════════════════════

const _colA = new THREE.Color();
const _colB = new THREE.Color();
const _colTemp = new THREE.Color();

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Interpolation HEX linéaire */
function lerpHex(a, b, t) {
  _colA.setHex(a);
  _colB.setHex(b);
  return _colA.lerp(_colB, clamp01(t)).getHex();
}

/** Smoothstep (ease-in-out) */
function smoothStep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** PRNG déterministe */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCULS SOLAIRES / LUNAIRES
// ═══════════════════════════════════════════════════════════════════════════

/** Élévation solaire normalisée (-0.35..1) */
export function sunElevation(hours) {
  const t = (hours - 5.7) / 12.8;
  if (t <= 0 || t >= 1) return -0.35;
  return Math.sin(t * Math.PI);
}

/**
 * Direction du soleil (vector frais — 🔧 BOOST : plus de tmp partagé)
 * @returns {THREE.Vector3}
 */
export function sunDirection(hours) {
  const elev = Math.max(0.045, sunElevation(hours));
  const az = ((hours - 6) / 12) * Math.PI;
  return new THREE.Vector3(
    Math.cos(az) * 0.82,
    -elev,
    Math.sin(az) * 0.52
  ).normalize();
}

/** Position monde du soleil */
export function sunPosition(hours, radius = 800) {
  const elev = sunElevation(hours);
  const az = ((hours - 6) / 12) * Math.PI;
  return new THREE.Vector3(
    Math.cos(az) * radius * 0.9,
    elev * radius,
    Math.sin(az) * radius * 0.9
  );
}

/** Position lunaire (opposée au soleil) */
export function moonPosition(hours, radius = 800) {
  const moonHours = (hours + 12) % 24;
  const elev = sunElevation(moonHours);
  const az = ((moonHours - 6) / 12) * Math.PI;
  return new THREE.Vector3(
    Math.cos(az) * radius * 0.9,
    elev * radius,
    Math.sin(az) * radius * 0.9
  );
}

/** Phase lunaire (0=nouvelle, 0.5=pleine, 1=nouvelle) */
export function lunarPhase(day) {
  const cycle = 29.53;
  return (day % cycle) / cycle;
}

/** 🔧 BOOST : intensité lunaire cohérente avec la phase */
export function moonVisibility(phase) {
  // distance à la pleine lune (0.5)
  const d = Math.abs(phase - 0.5) * 2; // 0 (pleine) à 1 (nouvelle)
  return clamp01(1 - d); // full=1, new=0
}

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT ATMOSPHÉRIQUE (memoization)
// ═══════════════════════════════════════════════════════════════════════════

const _snapCache = new Map();
const SNAP_CACHE_MAX = 64;

export function skySnap(hours, weather, windSpeed = 3.5, lunarDay = 15) {
  // 🔧 BOOST : memoize (arrondi de 0.02h ≈ 1 min)
  const key = `${hours.toFixed(2)}|${weather}|${windSpeed.toFixed(1)}|${lunarDay}`;
  if (_snapCache.has(key)) return _snapCache.get(key);

  const elev = sunElevation(hours);
  const azimuth = ((hours - 6) / 12) * Math.PI;

  const night = elev < 0.07;
  const dawn = hours >= 5.2 && hours < 7.6;
  const dusk = hours >= 17.4 && hours < 21.2;
  const goldenHour = (hours >= 5.8 && hours < 7.0) || (hours >= 18.5 && hours < 19.8);
  const blueHour = (hours >= 4.8 && hours < 5.4) || (hours >= 20.2 && hours < 20.9);

  const lamp = clamp01(1 - (elev + 0.05) / 0.28);
  const moonPhase = lunarPhase(lunarDay);

  // Défauts journée claire
  let hemiSky = 0xb8d0e8, hemiGround = 0x3a4a32;
  let hemiIntensity = 0.72, ambient = 0.28;
  let fog = 0x8aa0a8, fogDensity = 0.0018, bg = 0x7a9aaa;
  let horizonColor = 0xd4c8b8, zenithColor = 0x4a7ab8;
  let sunColor = 0xfff1d0, sunIntensity = 1.25, sunHaloOpacity = 0.4;
  let river = 0x2a4a68;
  let cloudOpacity = 0.85, cloudTint = 0xf8f4e8, cloudCoverage = 0.35;
  let starOpacity = 0, moonOpacity = 0, auroraIntensity = 0;

  // ─── NUIT ────────────────────────────────────────────────────────────────
  if (night) {
    hemiSky = 0x1a2a48; hemiGround = 0x101820;
    hemiIntensity = 0.14; ambient = 0.07;
    fog = 0x0a1020; fogDensity = 0.0028; bg = 0x080e1a;
    horizonColor = 0x1a2038; zenithColor = 0x040614;
    sunColor = 0x8899bb; sunIntensity = 0.07; sunHaloOpacity = 0;
    river = 0x101c2c;
    cloudOpacity = 0.45; cloudTint = 0x384860;
    starOpacity = 0.95;
    // 🔧 BOOST : formule lunaire CORRIGÉE
    moonOpacity = 0.85 * moonVisibility(moonPhase);
    auroraIntensity = 0.6;
  }
  // ─── AUBE ────────────────────────────────────────────────────────────────
  else if (dawn) {
    const k = smoothStep(0, 1, (hours - 5.2) / 2.4);
    hemiSky = lerpHex(0x4a3048, 0xb8d0e8, k);
    hemiGround = lerpHex(0x2a2018, 0x3a4a32, k);
    hemiIntensity = 0.28 + k * 0.44; ambient = 0.12 + k * 0.16;
    fog = lerpHex(0x6a4860, 0x8aa0a8, k); fogDensity = 0.0026 - k * 0.0008;
    bg = lerpHex(0xc87858, 0x7a9aaa, k);
    horizonColor = lerpHex(0xff9060, 0xd4c8b8, k);
    zenithColor = lerpHex(0x2a3a68, 0x4a7ab8, k);
    sunColor = lerpHex(0xff8a4a, 0xfff1d0, k);
    sunIntensity = 0.35 + k * 0.9; sunHaloOpacity = 0.7 - k * 0.3;
    river = lerpHex(0x1a2838, 0x2a4a68, k);
    cloudTint = lerpHex(0xff9878, 0xf8f4e8, k);
    starOpacity = Math.max(0, 0.6 - k * 0.7);
    moonOpacity = 0.85 * moonVisibility(moonPhase) * Math.max(0, 1 - k * 1.4);
    auroraIntensity = Math.max(0, 0.5 - k * 0.7);
  }
  // ─── CRÉPUSCULE ──────────────────────────────────────────────────────────
  else if (dusk) {
    const k = smoothStep(0, 1, (hours - 17.4) / 3.8);
    hemiSky = lerpHex(0xb8d0e8, 0x2a2448, k);
    hemiGround = lerpHex(0x3a4a32, 0x181420, k);
    hemiIntensity = 0.72 - k * 0.56; ambient = 0.28 - k * 0.2;
    fog = lerpHex(0x8aa0a8, 0x2a2038, k); fogDensity = 0.0018 + k * 0.001;
    bg = lerpHex(0xc07048, 0x140e22, k);
    horizonColor = lerpHex(0xffa068, 0x2a2440, k);
    zenithColor = lerpHex(0x4a7ab8, 0x0a0e1c, k);
    sunColor = lerpHex(0xffc070, 0x8899bb, k);
    sunIntensity = 1.15 - k * 1.05; sunHaloOpacity = 0.75 - k * 0.5;
    river = lerpHex(0x2a4a68, 0x101c2c, k);
    cloudTint = lerpHex(0xffb090, 0x484858, k);
    starOpacity = k * 0.85;
    moonOpacity = 0.85 * moonVisibility(moonPhase) * k;
    auroraIntensity = k * 0.5;
  }

  // ─── MÉTÉO ───────────────────────────────────────────────────────────────
  switch (weather) {
    case 'fog':
    case 'dense_fog':
      fog = night ? 0x1a2430 : 0x9aa8b0;
      fogDensity *= 2.8; hemiIntensity *= 0.85;
      cloudCoverage = 0.85; cloudOpacity *= 0.6;
      horizonColor = lerpHex(horizonColor, fog, 0.7);
      auroraIntensity *= 0.15;
      break;
    case 'rain':
    case 'heavy_rain':
      hemiIntensity *= 0.72; fogDensity *= 1.4;
      cloudCoverage = 0.9; cloudTint = lerpHex(cloudTint, 0x606870, 0.6);
      if (!night) bg = 0x5a6a78;
      auroraIntensity = 0;
      break;
    case 'thunderstorm':
    case 'storm':
      hemiIntensity *= 0.45;
      bg = night ? 0x050810 : 0x3a4450;
      sunIntensity *= 0.4;
      fog = night ? 0x121820 : 0x6a7480;
      fogDensity *= 1.8;
      cloudCoverage = 1.0; cloudTint = 0x2a3038; cloudOpacity = 0.95;
      auroraIntensity = 0;
      break;
    case 'blizzard':
    case 'snowstorm':
      hemiIntensity *= 0.38; ambient *= 0.7;
      fog = night ? 0x1a2430 : 0xb8c4cc; fogDensity *= 3.5;
      bg = night ? 0x101820 : 0xa8b4bc; sunIntensity *= 0.22;
      hemiSky = night ? 0x1a2438 : 0xc4ced6;
      cloudCoverage = 1.0; cloudTint = night ? 0x384048 : 0xd0d8dc; cloudOpacity = 0.98;
      windSpeed *= 4.5;
      auroraIntensity = 0;
      break;
    case 'snow':
    case 'light_snow':
      fog = night ? 0x1a2438 : 0xc8d4dc; fogDensity *= 1.6;
      if (!night) bg = 0xc0c8d0;
      hemiIntensity *= 0.78; sunIntensity *= 0.65;
      cloudCoverage = 0.75;
      cloudTint = night ? 0x4a5560 : 0xdce4e8;
      windSpeed *= 2.0;
      auroraIntensity *= 0.3;
      break;
    case 'poudrerie':
      fog = 0xd8e0e6; fogDensity *= 2.2; windSpeed *= 3.5;
      cloudCoverage = 0.55; hemiIntensity *= 0.6; auroraIntensity *= 0.4;
      break;
    case 'verglas':
      fog = 0xa8b8c4; fogDensity *= 1.9;
      cloudCoverage = 0.95; cloudTint = 0x8898a4; hemiIntensity *= 0.55;
      auroraIntensity = 0;
      break;
    case 'overcast':
    case 'cloudy':
      cloudCoverage = 0.85; cloudOpacity *= 0.9; hemiIntensity *= 0.8;
      sunHaloOpacity *= 0.4; auroraIntensity *= 0.2;
      break;
    case 'clear':
    case 'clear_night':
      if (night) auroraIntensity = 0.85;
      break;
  }

  // 🔧 BOOST : clamp aurora ≥ 0
  auroraIntensity = Math.max(0, Math.min(1, auroraIntensity));

  /** @type {SkySnap} */
  const snap = {
    hours, elev, azimuth, night, dawn, dusk, goldenHour, blueHour,
    hemiSky, hemiGround, hemiIntensity, ambient,
    fog, fogDensity, bg, horizonColor, zenithColor,
    sunColor, sunIntensity, sunHaloOpacity,
    moonPhase, moonOpacity,
    cloudOpacity, cloudTint, cloudCoverage,
    auroraIntensity,
    lamp, river, starOpacity, windSpeed,
  };

  if (_snapCache.size >= SNAP_CACHE_MAX) {
    _snapCache.delete(_snapCache.keys().next().value);
  }
  _snapCache.set(key, snap);
  return snap;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHADERS
// ═══════════════════════════════════════════════════════════════════════════

const SKY_DOME_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SKY_DOME_FRAG = /* glsl */ `
  uniform vec3  uHorizonColor;
  uniform vec3  uZenithColor;
  uniform vec3  uSunPosition;
  uniform vec3  uSunColor;
  uniform float uSunIntensity;
  uniform float uTime;
  varying vec3  vWorldPos;
  varying vec3  vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 dir = normalize(vWorldPos);
    float elevation = clamp(dir.y * 1.2, 0.0, 1.0);
    float horizonBlend = pow(1.0 - elevation, 2.5);

    vec3 skyColor = mix(uZenithColor, uHorizonColor, horizonBlend);

    vec3 sunDir = normalize(uSunPosition);
    float sunDot = max(0.0, dot(dir, sunDir));
    float sunGlow   = pow(sunDot, 8.0)  * 0.4;
    float sunBloom  = pow(sunDot, 32.0) * 0.8;
    float sunCorona = pow(sunDot, 4.0)  * 0.15;

    skyColor += uSunColor * (sunGlow + sunBloom + sunCorona) * uSunIntensity;

    float turb = noise(dir.xz * 4.0 + uTime * 0.02) * 0.015;
    skyColor += vec3(turb);
    skyColor = pow(skyColor, vec3(0.94));

    gl_FragColor = vec4(skyColor, 1.0);
  }
`;

const AURORA_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const AURORA_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec3  vWorldPos;
  varying vec2  vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    if (uIntensity < 0.01) discard;
    vec2 uv = vUv;
    float wave1 = fbm(vec2(uv.x * 3.0 + uTime * 0.08, uv.y * 6.0));
    float wave2 = fbm(vec2(uv.x * 5.0 - uTime * 0.05, uv.y * 8.0 + uTime * 0.1));
    float curtain = wave1 * wave2;
    curtain = smoothstep(0.15, 0.6, curtain);
    float verticalFade = smoothstep(0.0, 0.3, uv.y) * (1.0 - smoothstep(0.7, 1.0, uv.y));
    vec3 green   = vec3(0.2, 1.0, 0.5);
    vec3 magenta = vec3(0.8, 0.3, 0.9);
    vec3 color = mix(green, magenta, wave2 * 0.4);
    float alpha = curtain * verticalFade * uIntensity * 0.7;
    gl_FragColor = vec4(color, alpha);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// TEXTURES PROCÉDURALES (SSR-safe)
// ═══════════════════════════════════════════════════════════════════════════

function _canvas(size) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function createSunTexture() {
  const size = 256;
  const c = _canvas(size);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 240, 1.0)');
  grad.addColorStop(0.2, 'rgba(255, 240, 200, 0.9)');
  grad.addColorStop(0.5, 'rgba(255, 200, 120, 0.4)');
  grad.addColorStop(1.0, 'rgba(255, 180, 80, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHaloTexture() {
  const size = 512;
  const c = _canvas(size);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 220, 160, 0.6)');
  grad.addColorStop(0.3, 'rgba(255, 200, 140, 0.3)');
  grad.addColorStop(0.7, 'rgba(255, 180, 100, 0.1)');
  grad.addColorStop(1.0, 'rgba(255, 160, 80, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMoonTexture() {
  const size = 256;
  const c = _canvas(size);
  if (!c) return null;
  const ctx = c.getContext('2d');

  const grad = ctx.createRadialGradient(size / 2 - 20, size / 2 - 20, 20, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 250, 235, 1.0)');
  grad.addColorStop(0.7, 'rgba(220, 220, 210, 1.0)');
  grad.addColorStop(0.95, 'rgba(180, 180, 175, 0.9)');
  grad.addColorStop(1.0, 'rgba(180, 180, 175, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.fill();

  // Cratères
  const craters = [
    { x: 120, y: 100, r: 22, o: 0.15 },
    { x: 145, y: 145, r: 15, o: 0.12 },
    { x: 100, y: 145, r: 12, o: 0.10 },
    { x: 165, y: 105, r:  8, o: 0.08 },
    { x:  90, y: 105, r: 10, o: 0.10 },
    { x: 130, y: 175, r:  9, o: 0.09 },
    { x: 175, y: 155, r:  6, o: 0.07 },
  ];
  for (const cr of craters) {
    const cg = ctx.createRadialGradient(cr.x, cr.y, 0, cr.x, cr.y, cr.r);
    cg.addColorStop(0, `rgba(120, 118, 115, ${cr.o + 0.15})`);
    cg.addColorStop(1, 'rgba(160, 155, 150, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cr.x, cr.y, cr.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCloudTexture(seed = 1) {
  const size = 256;
  const c = _canvas(size);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed * 1000 + 7);

  const puffs = 12 + Math.floor(rng() * 8);
  for (let i = 0; i < puffs; i++) {
    const cx = size * 0.5 + (rng() - 0.5) * size * 0.7;
    const cy = size * 0.55 + (rng() - 0.5) * size * 0.4;
    const r  = size * (0.15 + rng() * 0.2);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0,   'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

/** 🔧 BOOST : RNG déterministe */
function createStarField(count = 2500, radius = 780, seed = 42) {
  const rng = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const u = rng();
    const v = rng() * 0.5 + 0.5;
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.92 + rng() * 0.06);

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const tint = rng();
    if (tint < 0.6) {
      colors[i * 3] = 1.0; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 1.0;
    } else if (tint < 0.85) {
      colors[i * 3] = 0.8; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 1.0;
    } else {
      colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.7;
    }

    sizes[i] = rng() < 0.05 ? 3.5 : rng() < 0.2 ? 2.0 : 1.2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0.0 },
      uTime:    { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3  color;
      varying vec3  vColor;
      varying float vSize;
      void main() {
        vColor = color;
        vSize = size;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uTime;
      varying vec3  vColor;
      varying float vSize;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d);
        float twinkle = 1.0 + sin(uTime * 3.0 + vSize * 100.0) * 0.15;
        gl_FragColor = vec4(vColor, alpha * uOpacity * twinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'stars';
  points.userData = { sig: SIG, kind: 'stars' };
  return points;
}

// ═══════════════════════════════════════════════════════════════════════════
// AURORES + NUAGES
// ═══════════════════════════════════════════════════════════════════════════

function createAurora(radius = 700) {
  // 🔧 BOOST : span 0..300 (au-dessus du sol) au lieu de -200..600
  const geo = new THREE.CylinderGeometry(radius * 0.7, radius * 0.85, 300, 64, 1, true);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uIntensity: { value: 0 },
    },
    vertexShader: AURORA_VERT,
    fragmentShader: AURORA_FRAG,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 150; // 🔧 BOOST : 150 au lieu de 200 → span 0..300
  mesh.renderOrder = -940;
  mesh.name = 'aurora';
  mesh.userData = { sig: SIG, kind: 'aurora' };
  return mesh;
}

function createClouds(count = 24, seed = 7) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'clouds_layer';
  group.userData = { sig: SIG, kind: 'clouds' };
  const instances = [];

  const textures = [];
  for (let i = 0; i < 5; i++) textures.push(createCloudTexture(i + 1));

  for (let i = 0; i < count; i++) {
    const tex = textures[i % textures.length];
    const mat = new THREE.SpriteMaterial({
      map: tex || null,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: true,
      fog: false,
      color: 0xffffff,
    });

    const sprite = new THREE.Sprite(mat);
    const angle    = rng() * Math.PI * 2;
    const distance = 380 + rng() * 200;
    const height   = 180 + rng() * 140;
    const scale    = 180 + rng() * 220;

    sprite.position.set(Math.cos(angle) * distance, height, Math.sin(angle) * distance);
    sprite.scale.set(scale, scale * 0.55, 1);
    sprite.renderOrder = -920;
    sprite.userData = { sig: SIG, kind: 'cloud' };

    group.add(sprite);
    instances.push({
      sprite, angle, height, distance, scale,
      driftSpeed: 0.6 + rng() * 0.8,
      baseOpacity: 0.7 + rng() * 0.25,
    });
  }

  return { group, instances, textures };
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTÈME CÉLESTE COMPLET
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @returns {SkySystem}
 */
export function createSkySystem() {
  const root = new THREE.Group();
  root.name = 'sky_system';
  root.userData = { sig: SIG };

  let currentLunarDay = 15;
  let elapsedTime = 0;

  // Toutes les ressources pour dispose propre
  const disposables = [];

  // ─── DÔME CÉLESTE ────────────────────────────────────────────────────────
  const domeGeo = new THREE.SphereGeometry(1000, 32, 16);
  const domeMat = new THREE.ShaderMaterial({
    uniforms: {
      uHorizonColor: { value: new THREE.Color(0xd4c8b8) },
      uZenithColor:  { value: new THREE.Color(0x4a7ab8) },
      uSunPosition:  { value: new THREE.Vector3(0, 800, 0) },
      uSunColor:     { value: new THREE.Color(0xfff1d0) },
      uSunIntensity: { value: 1.0 },
      uTime:         { value: 0 },
    },
    vertexShader: SKY_DOME_VERT,
    fragmentShader: SKY_DOME_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const domeMesh = new THREE.Mesh(domeGeo, domeMat);
  domeMesh.renderOrder = -1000;
  domeMesh.name = 'sky_dome';
  domeMesh.userData = { sig: SIG, kind: 'dome' };
  root.add(domeMesh);
  disposables.push(domeGeo, domeMat);

  // ─── SOLEIL ──────────────────────────────────────────────────────────────
  const sunTex = createSunTexture();
  const sunMat = new THREE.SpriteMaterial({
    map: sunTex, transparent: true,
    depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    color: 0xffffff, fog: false,
  });
  const sunSprite = new THREE.Sprite(sunMat);
  sunSprite.scale.set(80, 80, 1);
  sunSprite.renderOrder = -900;
  sunSprite.name = 'sun';
  sunSprite.userData = { sig: SIG, kind: 'sun' };
  root.add(sunSprite);
  if (sunTex) disposables.push(sunTex);
  disposables.push(sunMat);

  // ─── HALO ────────────────────────────────────────────────────────────────
  const haloTex = createHaloTexture();
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex, transparent: true,
    depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.4, fog: false,
  });
  const sunHalo = new THREE.Sprite(haloMat);
  sunHalo.scale.set(240, 240, 1);
  sunHalo.renderOrder = -910;
  sunHalo.name = 'sun_halo';
  root.add(sunHalo);
  if (haloTex) disposables.push(haloTex);
  disposables.push(haloMat);

  // ─── LUNE ────────────────────────────────────────────────────────────────
  const moonTex = createMoonTexture();
  const moonMat = new THREE.SpriteMaterial({
    map: moonTex, transparent: true,
    depthWrite: false, depthTest: false,
    opacity: 0, fog: false,
  });
  const moonSprite = new THREE.Sprite(moonMat);
  moonSprite.scale.set(55, 55, 1);
  moonSprite.renderOrder = -890;
  moonSprite.name = 'moon';
  moonSprite.userData = { sig: SIG, kind: 'moon' };
  root.add(moonSprite);
  if (moonTex) disposables.push(moonTex);
  disposables.push(moonMat);

  // ─── ÉTOILES ─────────────────────────────────────────────────────────────
  const starsMesh = createStarField(2800, 780, 42);
  starsMesh.renderOrder = -950;
  root.add(starsMesh);
  disposables.push(starsMesh.geometry, starsMesh.material);

  // ─── AURORES ─────────────────────────────────────────────────────────────
  const auroraMesh = createAurora(700);
  root.add(auroraMesh);
  disposables.push(auroraMesh.geometry, auroraMesh.material);

  // ─── NUAGES ──────────────────────────────────────────────────────────────
  const { group: cloudsGroup, instances: cloudInstances, textures: cloudTextures } = createClouds(28, 7);
  root.add(cloudsGroup);
  for (const t of cloudTextures) if (t) disposables.push(t);

  // ─── UPDATE ──────────────────────────────────────────────────────────────
  const lerp = THREE.MathUtils.lerp;

  function update(snap, dt) {
    elapsedTime += dt;
    const fastK = Math.min(1, dt * 3);
    const slowK = Math.min(1, dt * 2);

    // Dôme — interpolation douce des couleurs
    _colTemp.setHex(snap.horizonColor);
    domeMat.uniforms.uHorizonColor.value.lerp(_colTemp, fastK);

    _colTemp.setHex(snap.zenithColor);
    domeMat.uniforms.uZenithColor.value.lerp(_colTemp, fastK);

    _colTemp.setHex(snap.sunColor);
    domeMat.uniforms.uSunColor.value.lerp(_colTemp, fastK);

    domeMat.uniforms.uSunIntensity.value = lerp(
      domeMat.uniforms.uSunIntensity.value,
      snap.sunIntensity * 0.8,
      fastK
    );
    domeMat.uniforms.uTime.value = elapsedTime;

    const sunPos = sunPosition(snap.hours);
    domeMat.uniforms.uSunPosition.value.copy(sunPos);

    // Soleil
    sunSprite.position.copy(sunPos);
    sunSprite.material.color.setHex(snap.sunColor);
    sunSprite.material.opacity = clamp01(snap.sunIntensity * 1.2);
    const horizonBoost = 1 + Math.pow(1 - Math.max(0, snap.elev), 2) * 0.6;
    const sunScale = 80 * horizonBoost;
    sunSprite.scale.set(sunScale, sunScale, 1);

    // Halo
    sunHalo.position.copy(sunPos);
    sunHalo.material.color.setHex(snap.sunColor);
    sunHalo.material.opacity = snap.sunHaloOpacity;
    const haloScale = (220 + Math.max(0, snap.sunIntensity) * 80) * horizonBoost;
    sunHalo.scale.set(haloScale, haloScale, 1);

    // Lune — 🔧 BOOST : taille cohérente avec la phase
    const moonPos = moonPosition(snap.hours);
    moonSprite.position.copy(moonPos);
    moonSprite.material.opacity = snap.moonOpacity;
    const phaseVis = moonVisibility(snap.moonPhase); // 0=new, 1=full
    const moonScale = 45 + phaseVis * 20;           // full plus grosse
    moonSprite.scale.set(moonScale, moonScale, 1);

    // Étoiles
    const starMat = starsMesh.material;
    starMat.uniforms.uOpacity.value = snap.starOpacity;
    starMat.uniforms.uTime.value = elapsedTime;
    // 🔧 BOOST : rotation liée à l'heure (RA réelle)
    starsMesh.rotation.y = (snap.hours / 24) * Math.PI * 2 + elapsedTime * 0.001;

    // Aurores
    const auroraMat = auroraMesh.material;
    auroraMat.uniforms.uTime.value = elapsedTime;
    auroraMat.uniforms.uIntensity.value = lerp(
      auroraMat.uniforms.uIntensity.value,
      snap.auroraIntensity,
      slowK
    );

    // Nuages — 🔧 BOOST : windSpeed effectif
    const windBase = snap.windSpeed / 400; // 3.5 → 0.0087 rad/s (≈ 30 s/tour)
    for (const cloud of cloudInstances) {
      cloud.angle += windBase * cloud.driftSpeed * dt;
      if (cloud.angle > Math.PI * 2) cloud.angle -= Math.PI * 2;

      cloud.sprite.position.x = Math.cos(cloud.angle) * cloud.distance;
      cloud.sprite.position.z = Math.sin(cloud.angle) * cloud.distance;
      cloud.sprite.position.y = cloud.height + Math.sin(elapsedTime * 0.3 + cloud.angle * 3) * 4;

      const targetOpacity = cloud.baseOpacity * snap.cloudCoverage * snap.cloudOpacity;
      const mat = cloud.sprite.material;
      mat.opacity = lerp(mat.opacity, targetOpacity, slowK);
      mat.color.lerp(_colA.setHex(snap.cloudTint), slowK);
    }
  }

  function setLunarDay(day) {
    currentLunarDay = day;
  }

  function dispose() {
    root.clear();
    for (const d of disposables) {
      try { d.dispose?.(); } catch { /* ignore */ }
    }
    disposables.length = 0;
  }

  return {
    root, domeMesh, sunSprite, sunHalo, moonSprite, starsMesh,
    cloudsGroup, auroraMesh,
    update, dispose, setLunarDay,
  };
}

// ─── Exports modules ────────────────────────────────────────────────────────
export { lerpHex, smoothStep, mulberry32 };
export { SIG };
export default { createSkySystem, skySnap, sunElevation, sunDirection, sunPosition, moonPosition, lunarPhase, moonVisibility };
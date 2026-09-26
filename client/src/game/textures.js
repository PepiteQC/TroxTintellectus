/**
 * ═════════════════════════════════════════════════════════════════════════════
 * GESTIONNAIRE DE TEXTURES & MATÉRIAUX PBR (v3.0) — MOTEUR DE PORTNEUF
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Bibliothèque HD centralisée pour le rendu urbain et naturel.
 * FEATURES :
 *  - Cache mémoire agressif et réutilisation d'instances de textures.
 *  - ColorSpace dynamique (sRGB pour albedo, Linéaire pour Normals/AO).
 *  - Génération procédurale de matériaux PBR, Lamertiens et Decals (tracés/impacts).
 *  - Compression et downscaling automatique pour le mobile.
 * ═════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from "three";
import { wireCsm } from "@/utils/csm";
import { usePbr } from "../../../../materials";

// ═══════════════════════════════════════════════════════════
// CATALOGUE DES IDENTIFIANTS HD
// ═══════════════════════════════════════════════════════════

/**
 * @typedef {"parquet"|"marbre"|"platre"|"murNuit"|"velours"|"chene"|"moquette"|"plafond"|"noyer"|"laine"|"laineTricot"|"laineNrm"|"laineKnitNrm"|"carAo"|"cuir"|"cuirNrm"|"betonTrous"|"betonTrousNrm"|"betonDalles"|"betonDallesNrm"|"betonMur"|"betonMurNrm"|"platreGris"|"porteGrange"|"porteGrangeNrm"|"brique"|"orBrosse"|"metalPlie"|"cheminee"|"rideau"|"porteAcier"|"parquetLoft"|"asphalteSombre"|"asphalteUsee"|"asphalteUseeNrm"|"asphalteUseeAo"|"trottoirBeton"|"trottoirBetonNrm"|"briqueSale"|"briqueSaleNrm"|"murGraffiti"|"metalRouille"|"metalRouilleNrm"|"metalRouilleRgh"|"grillageAcier"|"grillageAcierAlpha"|"vitrineCommerces"|"vitrineSqdc"|"boisRustique"|"boisRustiqueNrm"|"carrosserieBase"|"carrosserieNrm"|"pneuUsee"|"pneuUseeNrm"|"douilleLaiton"|"traceFreinage"|"traceFreinageAlpha"|"impactBalle"|"impactBalleAlpha"|"salissureRoute"|"salissureRouteAlpha"} TexId
 */

const FILES = {
  parquet: "/textures/parquet.jpg",
  marbre: "/textures/marbre.jpg",
  platre: "/textures/platre.jpg",
  murNuit: "/textures/mur-nuit.jpg",
  velours: "/textures/velours.jpg",
  chene: "/textures/chene.jpg",
  moquette: "/textures/moquette.jpg",
  plafond: "/textures/plafond.jpg",
  noyer: "/textures/noyer.jpg",
  laine: "/textures/laine.jpg",
  laineTricot: "/textures/laine-tricot.png",
  laineNrm: "/textures/laine-nrm.jpg",
  laineKnitNrm: "/textures/laine-tricot-nrm.jpg",
  carAo: "/textures/car-ao.jpg",
  cuir: "/textures/cuir.jpg",
  cuirNrm: "/textures/cuir-nrm.png",
  betonTrous: "/textures/beton-trous.jpg",
  betonTrousNrm: "/textures/beton-trous-nrm.png",
  betonDalles: "/textures/beton-dalles.jpg",
  betonDallesNrm: "/textures/beton-dalles-nrm.png",
  betonMur: "/textures/beton-mur.jpg",
  betonMurNrm: "/textures/beton-mur-nrm.png",
  platreGris: "/textures/platre-gris.jpg",
  porteGrange: "/textures/porte-grange.jpg",
  porteGrangeNrm: "/textures/porte-grange-nrm.png",
  brique: "/textures/brique.jpg",
  orBrosse: "/textures/or-brosse.png",
  metalPlie: "/textures/metal-plie.jpg",
  cheminee: "/textures/cheminee.jpg",
  rideau: "/textures/rideau.jpg",
  porteAcier: "/textures/porte-acier.jpg",
  parquetLoft: "/textures/parquet-loft.jpg",

  // --- Urbain ---
  asphalteSombre: "/textures/rp/asphalte-sombre.jpg",
  asphalteUsee: "/textures/rp/asphalte-usee.jpg",
  asphalteUseeNrm: "/textures/rp/asphalte-usee-nrm.png",
  asphalteUseeAo: "/textures/rp/asphalte-usee-ao.jpg",
  trottoirBeton: "/textures/rp/trottoir.jpg",
  trottoirBetonNrm: "/textures/rp/trottoir-nrm.png",
  briqueSale: "/textures/rp/brique-sale.jpg",
  briqueSaleNrm: "/textures/rp/brique-sale-nrm.png",
  murGraffiti: "/textures/rp/mur-graffiti.jpg",
  metalRouille: "/textures/rp/metal-rouille.jpg",
  metalRouilleNrm: "/textures/rp/metal-rouille-nrm.png",
  metalRouilleRgh: "/textures/rp/metal-rouille-rgh.jpg",
  grillageAcier: "/textures/rp/grillage.jpg",
  grillageAcierAlpha: "/textures/rp/grillage-alpha.jpg",

  // --- Décors RP ---
  vitrineCommerces: "/textures/rp/vitrine-shop.jpg",
  vitrineSqdc: "/textures/rp/vitrine-sqdc.jpg",
  boisRustique: "/textures/rp/bois-rustique.jpg",
  boisRustiqueNrm: "/textures/rp/bois-rustique-nrm.png",

  // --- Véhicules & Props ---
  carrosserieBase: "/textures/rp/car-base.jpg",
  carrosserieNrm: "/textures/rp/car-nrm.png",
  pneuUsee: "/textures/rp/pneu-use.jpg",
  pneuUseeNrm: "/textures/rp/pneu-use-nrm.png",
  douilleLaiton: "/textures/rp/douille.jpg",

  // --- Decals ---
  traceFreinage: "/textures/rp/traces-pneus.png",
  traceFreinageAlpha: "/textures/rp/traces-pneus-alpha.png",
  impactBalle: "/textures/rp/impact-balle.png",
  impactBalleAlpha: "/textures/rp/impact-balle-alpha.png",
  salissureRoute: "/textures/rp/dirt.png",
  salissureRouteAlpha: "/textures/rp/dirt-alpha.png",
};

/** Textures contenant des données non-colorimétriques (Espace linéaire strict pour le PBR) */
const DATA_MAPS = new Set([
  "laineNrm", "laineKnitNrm", "cuirNrm", "betonTrousNrm",
  "betonDallesNrm", "betonMurNrm", "porteGrangeNrm", "carAo",
  "asphalteUseeNrm", "asphalteUseeAo", "trottoirBetonNrm",
  "briqueSaleNrm", "metalRouilleNrm", "metalRouilleRgh",
  "grillageAcierAlpha", "boisRustiqueNrm", "carrosserieNrm",
  "pneuUseeNrm", "traceFreinageAlpha", "impactBalleAlpha", "salissureRouteAlpha"
]);

/** Textures prioritaires chargées de façon synchrone au lancement du moteur */
const PRIORITY_TEX = ["asphalteUsee", "trottoirBeton", "briqueSale", "murGraffiti"];

/**
 * @typedef {"repeat"|"clamp"|"ui"} MapKind
 */

/**
 * @typedef {Object} TexMetrics
 * @property {number} loaded
 * @property {number} failed
 * @property {number} clones
 * @property {number} mats
 * @property {number} memEstimateMB
 * @property {number} loadTimeMs
 */

// ═══════════════════════════════════════════════════════════
// CLASSE PRINCIPALE DU GESTIONNAIRE
// ═══════════════════════════════════════════════════════════

class TextureLibrary {
  constructor() {
    this.loader = new THREE.TextureLoader();
    this.renderer = null;

    this.maps = new Map();
    this.mats = new Map();
    this.clones = new Map();
    this.failed = new Set();

    this.placeholderTex = null;
    this.loadStart = 0;
    this.loadCount = 0;
    this.failCount = 0;

    this.aniso = 4;
    this.maxTextureSize = 2048;

    this.createPlaceholder();
  }

  createPlaceholder() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#5c5c5c";
    ctx.fillRect(0, 0, 2, 2);

    this.placeholderTex = new THREE.CanvasTexture(canvas);
    this.placeholderTex.colorSpace = THREE.SRGBColorSpace;
  }

  attach(renderer) {
    this.renderer = renderer;
    const max = renderer.capabilities.getMaxAnisotropy();
    const isMobile = Math.min(window.innerWidth, window.innerHeight) < 768;
    this.aniso = Math.max(1, Math.min(isMobile ? 4 : 16, max || 1));
    this.maxTextureSize = isMobile ? 1024 : 2048;

    this.maps.forEach((t) => { t.anisotropy = this.aniso; });
    this.clones.forEach((t) => { t.anisotropy = this.aniso; });
  }

  async preloadPriority() {
    this.loadStart = performance.now();
    const promises = PRIORITY_TEX.map((id) => {
      return new Promise((resolve) => {
        this.loader.load(
          FILES[id],
          (loadedTex) => {
            this.ingest(id, this.raw(id), loadedTex);
            resolve();
          },
          undefined,
          () => {
            this.failCount++;
            this.failed.add(id);
            resolve();
          }
        );
      });
    });
    await Promise.all(promises);
  }

  finish(tex, kind = "clamp", isData = false) {
    // Espace sRGB pour les couleurs (Albedo/Diffuse), Linéaire pour les normales/roughness.
    tex.colorSpace = isData ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    tex.anisotropy = kind === "ui" ? 1 : this.aniso;

    if (kind === "repeat") {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
    } else if (kind === "ui") {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    } else {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
    }
    return tex;
  }

  raw(id) {
    let map = this.maps.get(id);
    if (map) return map;

    map = this.placeholderTex.clone();
    this.finish(map, "repeat", DATA_MAPS.has(id));
    this.maps.set(id, map);

    this.loader.load(
      FILES[id],
      (src) => this.ingest(id, map, src),
      undefined,
      () => {
        this.failCount++;
        this.failed.add(id);
        console.warn(`[TextureLibrary] Échec du chargement HTTP : ${FILES[id]}`);
      }
    );
    return map;
  }

  ingest(id, target, loadedTex) {
    const img = loadedTex.image;

    const applyToGPU = (imageSource) => {
      target.image = imageSource;
      target.needsUpdate = true;

      if (this.renderer) {
        this.renderer.initTexture(target);
      }

      this.clones.forEach((clone, key) => {
        if (key.startsWith(`${id}_`)) {
          clone.image = imageSource;
          clone.needsUpdate = true;
          if (this.renderer) this.renderer.initTexture(clone);
        }
      });

      loadedTex.dispose();
      this.loadCount++;
    };

    const w = img.width || 0;
    const h = img.height || 0;
    const limit = this.maxTextureSize;
    const fitsRequirements = w > 0 && h > 0 && w <= limit && h <= limit;

    if (fitsRequirements) {
      applyToGPU(img);
      return;
    }

    // Traitement GPU asynchrone des images trop grandes
    if (typeof createImageBitmap === "function") {
      void createImageBitmap(img, {
        resizeWidth: limit,
        resizeHeight: limit,
        resizeQuality: "high",
      })
        .then(applyToGPU)
        .catch(() => applyToGPU(img)); // Fallback silencieux
      return;
    }

    // Fallback vieux navigateurs
    const canvas = document.createElement("canvas");
    canvas.width = limit;
    canvas.height = limit;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, limit, limit);
      applyToGPU(canvas);
    } else {
      applyToGPU(img);
    }
  }

  tile(id, repeatX, repeatY) {
    const key = `${id}_${repeatX}_${repeatY}`;
    let cached = this.clones.get(key);
    if (cached) return cached;

    const base = this.raw(id);
    const clone = base.clone();
    this.finish(clone, "repeat", DATA_MAPS.has(id));
    clone.repeat.set(repeatX, repeatY);

    this.clones.set(key, clone);
    return clone;
  }

  // ─── BUILDERS DE MATÉRIAUX STANDARDS & PBR ─────────────────

  mat(id, repeatX, repeatY, roughness = 0.7, metalness = 0) {
    const isPbr = usePbr(roughness, metalness);
    const key = `${isPbr ? "pbr" : "lam"}_${id}_${repeatX}_${repeatY}_${roughness}_${metalness}`;

    const cached = this.mats.get(key);
    if (cached) return cached;

    const diffuseMap = this.tile(id, repeatX, repeatY);
    const material = isPbr
      ? new THREE.MeshStandardMaterial({ map: diffuseMap, roughness, metalness, color: 0xffffff })
      : new THREE.MeshLambertMaterial({ map: diffuseMap, color: 0xffffff });

    this.mats.set(key, material);
    wireCsm(material);
    return material;
  }

  cloth(albedo, nrm, repeatX, repeatY, roughness = 0.88, tint = 0xffffff, bump = 0.65) {
    const isPbr = usePbr(roughness, 0);
    const key = `cloth_${isPbr ? "pbr" : "lam"}_${albedo}_${nrm}_${repeatX}_${repeatY}_${roughness}_${tint}_${bump}`;

    const cached = this.mats.get(key);
    if (cached) return cached;

    const map = this.tile(albedo, repeatX, repeatY);
    const material = isPbr
      ? new THREE.MeshStandardMaterial({ map, color: tint, roughness, metalness: 0 })
      : new THREE.MeshLambertMaterial({ map, color: tint });

    if (nrm && isPbr) {
      material.normalMap = this.tile(nrm, repeatX, repeatY);
      material.normalScale = new THREE.Vector2(bump, bump);
    }

    this.mats.set(key, material);
    wireCsm(material);
    return material;
  }

  pbr(albedo, nrm, repeatX, repeatY, roughness = 0.85, metalness = 0, tint = 0xffffff, bump = 0.8, aoMapId = null) {
    const isPbr = usePbr(roughness, metalness);
    const key = `pbr_${isPbr ? "s" : "l"}_${albedo}_${nrm}_${repeatX}_${repeatY}_${roughness}_${metalness}_${tint}_${bump}_${aoMapId}`;

    const cached = this.mats.get(key);
    if (cached) return cached;

    const map = this.tile(albedo, repeatX, repeatY);
    const material = isPbr
      ? new THREE.MeshStandardMaterial({ map, color: tint, roughness, metalness })
      : new THREE.MeshLambertMaterial({ map, color: tint });

    if (isPbr) {
      if (nrm) {
        material.normalMap = this.tile(nrm, repeatX, repeatY);
        material.normalScale = new THREE.Vector2(bump, bump);
      }
      if (aoMapId) {
        material.aoMap = this.tile(aoMapId, repeatX, repeatY);
        material.aoMapIntensity = 1.0;
      }
    }

    this.mats.set(key, material);
    wireCsm(material);
    return material;
  }

  // ─── BUILDERS SPÉCIAUX (DECALS & VEHICULES) ─────────────────

  /**
   * Matériau de "Decal" (Traces de pneus, impacts, tags).
   * Utilise la transparence et le polygonOffset pour éviter le Z-fighting sur la route.
   */
  decal(albedo, alpha, repeatX = 1, repeatY = 1, tint = 0xffffff) {
    const key = `decal_${albedo}_${alpha}_${repeatX}_${repeatY}_${tint}`;
    const cached = this.mats.get(key);
    if (cached) return cached;

    const map = this.tile(albedo, repeatX, repeatY);
    const material = new THREE.MeshLambertMaterial({
      map,
      color: tint,
      transparent: true,
      depthWrite: false, // Empêche l'écrasement du Z-Buffer
      polygonOffset: true,
      polygonOffsetFactor: -1, // Force le rendu par-dessus la géométrie coplanaire
      polygonOffsetUnits: -1,
    });

    if (alpha) {
      material.alphaMap = this.tile(alpha, repeatX, repeatY);
    }

    this.mats.set(key, material);
    return material;
  }

  /**
   * Matériau CarPaint HD (Reflets prononcés, vernis).
   */
  carPaint(albedo, nrm, repeatX = 1, repeatY = 1, color = 0xffffff, metalness = 0.6, roughness = 0.2) {
    const key = `carpaint_${albedo}_${nrm}_${repeatX}_${repeatY}_${color}_${metalness}_${roughness}`;
    const cached = this.mats.get(key);
    if (cached) return cached;

    const material = new THREE.MeshStandardMaterial({
      map: albedo !== "carrosserieBase" ? this.tile(albedo, repeatX, repeatY) : null,
      color: color,
      metalness: metalness,
      roughness: roughness,
      envMapIntensity: 2.0, // Boost les reflets de l'environnement (Skybox HD)
    });

    if (nrm) {
      material.normalMap = this.tile(nrm, repeatX, repeatY);
      material.normalScale = new THREE.Vector2(0.5, 0.5); // Normales polies
    }

    this.mats.set(key, material);
    wireCsm(material);
    return material;
  }

  map(id, repeatX = 1, repeatY = 1) {
    return this.tile(id, repeatX, repeatY);
  }

  getMetrics() {
    let memEstimate = 0;
    const calculateMemory = (t) => {
      const img = t.image;
      if (img && img.width) memEstimate += img.width * img.height * 4 * 1.33; // +33% mipmaps
    };
    this.maps.forEach(calculateMemory);
    this.clones.forEach(calculateMemory);

    return {
      loaded: this.loadCount,
      failed: this.failCount,
      clones: this.clones.size,
      mats: this.mats.size,
      memEstimateMB: Math.round(memEstimate / (1024 * 1024)),
      loadTimeMs: this.loadStart ? performance.now() - this.loadStart : 0,
    };
  }

  isFailed(id) {
    return this.failed.has(id);
  }

  dispose() {
    this.mats.forEach((m) => m.dispose());
    this.clones.forEach((t) => t.dispose());
    this.maps.forEach((t) => t.dispose());
    this.placeholderTex.dispose();

    this.mats.clear();
    this.clones.clear();
    this.maps.clear();
    this.failed.clear();
  }
}

export const tex = new TextureLibrary();

export function finishMap(map, kind = "clamp") {
  tex.finish(map, kind);
  map.needsUpdate = true;
  return map;
}
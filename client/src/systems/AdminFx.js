/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SYSTEMS/ADMINFX.JS (v3.0 Platinum Edition)
 * Moteur d'Effets Visuels 3D, Hybrides & Surcouches d'Écran Admin
 * ═══════════════════════════════════════════════════════════════════
 * Gère le rendu et la temporisation des effets spéciaux :
 *  • 28 effets d'immersion (20 d'administration, 6 d'impacts/physiques, 2 légendaires)
 *  • Double système de rendu : Scène 3D synchrone & calques d'effets d'écran DOM
 *  • Pool de ressources (Matériaux & Géométries) pour prévenir la fuite de VRAM
 *  • Interpolation fluide et amortissement physique sans impact sur la boucle principale
 *
 * Signature : TROXT⬡ · 🔮FxEngine
 * Chemin    : client/src/systems/AdminFx.js
 */

import * as THREE from "three";

const SIG = 'TROXT⬡';

// ─── CONFIGURATION DES 28 EFFETS EXCLUSIFS (FROZEN) ──────────────────────────

export const ADMIN_EFFECTS = Object.freeze({
  lightning:      { id: "lightning", name: "Foudre céleste", icon: "⚡", color: "#7fd4ff", duration: 1400 },
  meteor:         { id: "meteor", name: "Pluie de météores", icon: "☄️", color: "#ff7a33", duration: 2600 },
  portal:         { id: "portal", name: "Faille dimensionnelle", icon: "🌀", color: "#b06fff", duration: 2200 },
  blessing:       { id: "blessing", name: "Pluie bénie", icon: "✨", color: "#ffe066", duration: 2600 },
  shadowrealm:    { id: "shadowrealm", name: "Royaume des ombres", icon: "🌑", color: "#5a1e8a", duration: 2600 },
  matrixrain:     { id: "matrixrain", name: "Pluie de code", icon: "🟩", color: "#22ff66", duration: 2400 },
  icecapsule:     { id: "icecapsule", name: "Capsule de givre", icon: "🧊", color: "#8be8ff", duration: 2200 },
  explosion:      { id: "explosion", name: "Détonation", icon: "💥", color: "#ff5522", duration: 1600 },
  godrays:        { id: "godrays", name: "Rayons divins", icon: "🌟", color: "#fff3c4", duration: 2800 },
  banhammer:      { id: "banhammer", name: "Marteau du bannissement", icon: "🔨", color: "#ff3333", duration: 1500 },
  confetti:       { id: "confetti", name: "Confettis", icon: "🎉", color: "#ff66cc", duration: 2400 },
  impact:         { id: "impact", name: "Choc caméra", icon: "📳", color: "#ffffff", duration: 550 },
  chromaticpulse: { id: "chromaticpulse", name: "Pulsation chromatique", icon: "🌈", color: "#ff33aa", duration: 700 },
  slowmotion:     { id: "slowmotion", name: "Ralenti", icon: "🎬", color: "#3aa0ff", duration: 2200 },
  glassshatter:   { id: "glassshatter", name: "Verre brisé", icon: "🔻", color: "#cfe8ff", duration: 1200 },
  
  // Légendaires
  apocalypse:     { id: "apocalypse", name: "Apocalypse", icon: "🔥", color: "#ff2200", duration: 3600 },
  divinejudgment: { id: "divinejudgment", name: "Jugement divin", icon: "⚖️", color: "#fff6c9", duration: 3000 },
  realitytear:    { id: "realitytear", name: "Déchirure", icon: "🕳️", color: "#b06fff", duration: 2800 },
  phoenixrebirth: { id: "phoenixrebirth", name: "Phénix", icon: "🐦‍🔥", color: "#ff9933", duration: 3200 },
  starfall:       { id: "starfall", name: "Chute d'étoiles", icon: "🌠", color: "#9fd8ff", duration: 3200 },
  
  // Effets physiques de base
  fire:           { id: "fire", name: "Feu", icon: "🔥", color: "#c44a3a", duration: 2800 },
  smoke:          { id: "smoke", name: "Fumée", icon: "💨", color: "#8a9084", duration: 3200 },
  sparks:         { id: "sparks", name: "Étincelles", icon: "✨", color: "#ece8de", duration: 1800 },
  water:          { id: "water", name: "Éclaboussures", icon: "💦", color: "#7a9aaa", duration: 1400 },
  blood:          { id: "blood", name: "Impact", icon: "🔴", color: "#c44a3a", duration: 1100 },
  electric:       { id: "electric", name: "Arc électrique", icon: "⚡", color: "#7a9aaa", duration: 1200 },
  
  // Nouveaux effets v3.0
  healing_circle: { id: "healing_circle", name: "Cercle Runique", icon: "💚", color: "#33ff88", duration: 3000 },
  cosmic_shield:  { id: "cosmic_shield", name: "Bouclier d'Énergie", icon: "🛡️", color: "#00e8ff", duration: 3400 },
});

export const ADMIN_EFFECT_IDS = Object.freeze(Object.keys(ADMIN_EFFECTS));

export const FX_ALIASES = Object.freeze({
  fire: "fire",
  fire_medium: "fire",
  medium_fire: "fire",
  smoke: "smoke",
  sparks: "sparks",
  spark: "sparks",
  water: "water",
  water_splash: "water",
  splash: "water",
  blood: "blood",
  blood_impact: "blood",
  electric: "electric",
  electric_arc: "electric",
  arc: "electric",
  fx_fire: "fire",
  fx_smoke: "smoke",
});

// Variables temporaires statiques (Évite les allocations dans les calculs)
const _dummyObj = new THREE.Object3D();
const _colorConverter = new THREE.Color();

// ═══════════════════════════════════════════════════════════════════
// CLASSE DES EFFETS ADMIN
// ═══════════════════════════════════════════════════════════════════

export class AdminFx {
  /**
   * @param {THREE.Scene} scene 
   * @param {THREE.Camera} camera 
   * @param {THREE.WebGLRenderer} renderer 
   * @param {function(): THREE.Vector3} target - Callback de position de cible (joueur)
   */
  constructor(scene, camera, renderer, target) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.target = typeof target === "function" ? target : () => new THREE.Vector3(0, 0, 0);

    this.group = new THREE.Group();
    this.group.name = "admin-fx-container";
    this.scene.add(this.group);

    this.entries = [];
    this.overlay = null;
    this.chroma = null;
    this.t = 0;
    this.active = null;
    this.until = 0;

    // Pools internes de ressources (anti-leak et allocations)
    this._geos = new Map();
    this._mats = new Map();

    // Géométrie partagée de base
    this.ball = this._getSharedGeometry("ball_sphere", () => new THREE.SphereGeometry(1, 8, 6));
  }

  // ─── POOLS DE RESSOURCES (MATÉRIAUX & GÉOMÉTRIES) ──────────────────────────

  _getSharedGeometry(key, builder) {
    if (this._geos.has(key)) return this._geos.get(key);
    const geo = builder();
    this._geos.set(key, geo);
    return geo;
  }

  _getSharedMaterial(colorHex, opacity = 1, transparent = false) {
    const key = `${colorHex}_${opacity}_${transparent}`;
    if (this._mats.has(key)) return this._mats.get(key);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
    this._mats.set(key, mat);
    return mat;
  }

  _glow(color, intensity = 5) {
    const opacity = Math.min(1, 0.22 + intensity * 0.12);
    return this._getSharedMaterial(color, opacity, true);
  }

  // ─── API DE LECTURE DES EFFETS ─────────────────────────────────────────────

  play(id) {
    if (typeof id !== "string") return false;
    const key = id.toLowerCase().trim();
    const resolved = FX_ALIASES[key] ?? (key in ADMIN_EFFECTS ? key : null);
    if (!resolved) return false;

    const meta = ADMIN_EFFECTS[resolved];
    this.active = meta.id;
    this.until = this.t + meta.duration / 1000;

    const dispatch = {
      lightning:      (m) => this.lightning(m),
      meteor:         (m) => this.meteor(m),
      portal:         (m) => this.portal(m),
      blessing:       (m) => this.blessing(m),
      shadowrealm:    (m) => this.shadow(m),
      matrixrain:     (m) => this.matrix(m),
      icecapsule:     (m) => this.ice(m),
      explosion:      (m) => this.boom(m),
      godrays:        (m) => this.rays(m),
      banhammer:      (m) => this.hammer(m),
      confetti:       (m) => this.confetti(m),
      impact:         (m) => this.domImpact(m),
      chromaticpulse: (m) => this.domChroma(m),
      slowmotion:     (m) => this.domSlow(m),
      glassshatter:   (m) => this.domGlass(m),
      apocalypse:     (m) => this.apocalypse(m),
      divinejudgment: (m) => this.judgment(m),
      realitytear:    (m) => this.tear(m),
      phoenixrebirth: (m) => this.phoenix(m),
      starfall:       (m) => this.stars(m),
      fire:           (m) => this.fire(m),
      smoke:          (m) => this.smoke(m),
      sparks:         (m) => this.sparks(m),
      water:          (m) => this.water(m),
      blood:          (m) => this.blood(m),
      electric:       (m) => this.electric(m),
      healing_circle: (m) => this.healingCircle(m),
      cosmic_shield:  (m) => this.cosmicShield(m),
    };

    dispatch[meta.id](meta);
    return true;
  }

  getActive() {
    return this.active;
  }

  // Boucle de mise à jour (à appeler chaque frame)
  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.t += dt;
    if (this.active && this.t >= this.until) this.active = null;

    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      e.age += dt;
      if (e.tick) e.tick(e.mesh, dt, this.t, e);
      if (e.age >= e.ttl) {
        this.end(e);
        this.entries.splice(i, 1);
      }
    }
  }

  clear() {
    for (let i = 0; i < this.entries.length; i++) {
      this.end(this.entries[i]);
    }
    this.entries = [];
    this.active = null;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    
    // Libération de la VRAM des géométries poolées
    this._geos.forEach((g) => g.dispose());
    this._geos.clear();

    // Libération de la VRAM des matériaux poolés
    this._mats.forEach((m) => m.dispose());
    this._mats.clear();

    // Retrait strict des calques DOM (anti-fuite)
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.chroma) {
      const svgParent = this.chroma.parentElement;
      if (svgParent) svgParent.remove();
      this.chroma = null;
    }
  }

  // ─── INTERNE — ENREGISTREMENT ET FIN D'EFFETS ──────────────────────────────

  private add(mesh, ttl, tick = undefined, onEnd = undefined, dom = undefined) {
    if (mesh) this.group.add(mesh);
    this.entries.push({ mesh, ttl, age: 0, tick, onEnd, dom });
  }

  private end(e) {
    if (e.mesh) {
      this.group.remove(e.mesh);
      e.mesh.traverse((o) => {
        if (o.isMesh || o.isPoints || o.isLine) {
          // Ne dispose que les géométries non-poolées (ex: TubeGeometry générées en cours)
          if (o.geometry && !this._isPooledGeometry(o.geometry)) {
            o.geometry.dispose();
          }
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (let i = 0; i < mats.length; i++) {
              if (!this._isPooledMaterial(mats[i])) mats[i].dispose();
            }
          }
        }
      });
    }
    if (e.dom) {
      try { e.dom.remove(); } catch {}
    }
    if (e.onEnd) {
      try { e.onEnd(); } catch {}
    }
  }

  _isPooledGeometry(geo) {
    return Array.from(this._geos.values()).includes(geo);
  }

  _isPooledMaterial(mat) {
    return Array.from(this._mats.values()).includes(mat);
  }

  // ─── SYSTÈMES DE PARTICULES UNIFIÉS ────────────────────────────────────────

  private spark(x, z, color) {
    const ringGeo = this._getSharedGeometry("ring_spark", () => new THREE.RingGeometry(0.05, 0.1, 16));
    const ring = new THREE.Mesh(ringGeo, this._glow(color, 5));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.04, z);

    this.add(ring, 0.45, (mesh, _d, _t, e) => {
      mesh.scale.setScalar(1 + (e.age / e.ttl) * 7);
      mesh.material.opacity = Math.max(0, 1 - e.age / e.ttl);
    });

    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = new THREE.Mesh(this.ball, this._glow(color, 6));
      s.scale.setScalar(0.03);
      s.position.set(x, 0.08, z);
      const vy = 1.2 + Math.random();

      this.add(s, 0.45, (mesh, dt) => {
        mesh.position.y += vy * dt;
        mesh.position.x += Math.cos(a) * dt;
        mesh.position.z += Math.sin(a) * dt;
      });
    }
  }

  private burst(origin, opts) {
    const n = Math.max(8, Math.min(220, opts.count));
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.18;
      pos[i3] = origin.x + Math.cos(a) * r;
      pos[i3 + 1] = origin.y + 0.12;
      pos[i3 + 2] = origin.z + Math.sin(a) * r;

      const s = opts.speed * (0.35 + Math.random());
      vel[i3] = Math.cos(a) * s * (Math.random() - 0.5) * 2;
      vel[i3 + 1] = (opts.upward ? Math.abs(Math.sin(a)) : Math.sin(a)) * s + (opts.upward ? opts.speed * 0.35 : 0);
      vel[i3 + 2] = Math.sin(a) * s * (Math.random() - 0.5) * 2;

      _colorConverter.setHex(opts.colors[i % opts.colors.length]);
      col[i3] = _colorConverter.r;
      col[i3 + 1] = _colorConverter.g;
      col[i3 + 2] = _colorConverter.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
      size: opts.size,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true,
    });

    const pts = new THREE.Points(geo, mat);

    this.add(pts, opts.life, (mesh, dt, _t, e) => {
      const attr = mesh.geometry.getAttribute("position");
      const arr = attr.array;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        vel[i3 + 1] += opts.gravity * dt;
        arr[i3] += vel[i3] * dt;
        arr[i3 + 1] += vel[i3 + 1] * dt;
        arr[i3 + 2] += vel[i3 + 2] * dt;
      }
      attr.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - e.age / e.ttl);
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  MOTEURS D'EFFETS PHYSIQUES & ÉLÉMENTAIRES
  // ═════════════════════════════════════════════════════════════════

  private fire(meta) {
    const p = this.target();
    const light = new THREE.PointLight(meta.color, 4, 8);
    light.position.set(p.x, p.y + 0.6, p.z);
    this.add(light, 2.6, (mesh, _d, _t, e) => {
      mesh.intensity = 3.4 * Math.max(0, 1 - e.age / e.ttl);
    });
    this.burst(p, {
      count: 110, colors: [0xc44a3a, 0xa04838, 0xece8de], life: 2.5,
      gravity: 1.6, speed: 1.8, size: 0.22, additive: true, upward: true,
    });
    this.burst(p, {
      count: 50, colors: [0x8a9084, 0x5c6270], life: 2.8,
      gravity: 0.4, speed: 0.7, size: 0.42, upward: true,
    });
  }

  private smoke(meta) {
    const p = this.target();
    this.burst(p, {
      count: 90, colors: [0x8a9084, 0x5c6270, 0x2f3330], life: 3.1,
      gravity: 0.35, speed: 0.85, size: 0.55, upward: true,
    });
    const sphereGeo = this._getSharedGeometry("smoke_puff_sphere", () => new THREE.SphereGeometry(0.22, 10, 8));
    const puff = new THREE.Mesh(sphereGeo, this._glow(meta.color, 2));
    puff.position.set(p.x, p.y + 0.3, p.z);
    this.add(puff, 2.4, (mesh, _d, _t, e) => {
      mesh.scale.setScalar(1 + e.age * 2.2);
      mesh.position.y += 0.55 * 0.016;
      mesh.material.opacity = Math.max(0, 0.35 * (1 - e.age / e.ttl));
    });
  }

  private sparks(meta) {
    const p = this.target();
    this.burst(p, {
      count: 80, colors: [0xece8de, 0xc4b8a8, 0xa04838], life: 1.4,
      gravity: -2.4, speed: 4.2, size: 0.08, additive: true,
    });
    this.spark(p.x, p.z, meta.color);
  }

  private water(meta) {
    const p = this.target();
    this.burst(p, {
      count: 100, colors: [0x7a9aaa, 0xc8d8dc, 0x4a6a72], life: 1.2,
      gravity: -8, speed: 4.6, size: 0.1, upward: true,
    });
  }

  private blood(meta) {
    const p = this.target();
    this.burst(p, {
      count: 70, colors: [0xc44a3a, 0x6a2a24, 0xa04838], life: 0.95,
      gravity: -9, speed: 3.4, size: 0.09, upward: true,
    });
  }

  private electric(meta) {
    const p = this.target();
    const flash = new THREE.PointLight(meta.color, 8, 10);
    flash.position.set(p.x, p.y + 1.4, p.z);
    this.add(flash, 0.55, (mesh, _d, _t, e) => {
      mesh.intensity = 8 * Math.max(0, 1 - e.age / e.ttl);
    });

    for (let i = 0; i < 6; i++) {
      const pts = [];
      const dir = new THREE.Vector3(Math.random() - 0.5, 0.2 + Math.random() * 0.6, Math.random() - 0.5).normalize();
      const len = 1.1 + Math.random() * 1.8;
      for (let j = 0; j <= 7; j++) {
        const t = j / 7;
        pts.push(
          new THREE.Vector3(
            p.x + dir.x * len * t + (Math.random() - 0.5) * 0.22,
            p.y + 0.4 + dir.y * len * t + (Math.random() - 0.5) * 0.18,
            p.z + dir.z * len * t + (Math.random() - 0.5) * 0.22
          )
        );
      }
      const bolt = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.012, 5, false),
        this._glow(meta.color, 7)
      );
      this.add(bolt, 0.7, (mesh, _d, _t, e) => {
        mesh.material.opacity = Math.max(0, 1 - e.age / e.ttl);
      });
    }

    this.burst(p, {
      count: 40, colors: [0x7a9aaa, 0xece8de], life: 0.7,
      gravity: 0, speed: 3.2, size: 0.07, additive: true,
    });
  }

  // ─── EFFETS D'ADMINISTRATION SECONDAIRES ────────────────────────────────────

  private lightning(meta) {
    const p = this.target();
    const flash = new THREE.PointLight(meta.color, 10, 16);
    flash.position.set(p.x, p.y + 3, p.z);
    this.add(flash, 0.45, (mesh, _d, _t, e) => {
      mesh.intensity = 10 * Math.max(0, 1 - e.age / e.ttl);
    });

    for (let i = 0; i < 3; i++) {
      const pts = [];
      const ox = p.x + (Math.random() - 0.5) * 1.1;
      const oz = p.z + (Math.random() - 0.5) * 1.1;
      for (let j = 0; j <= 8; j++) {
        pts.push(new THREE.Vector3(ox + (Math.random() - 0.5) * 0.35, 5.5 - j * 0.65, oz + (Math.random() - 0.5) * 0.35));
      }
      const bolt = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.022 - i * 0.004, 5, false),
        this._glow(meta.color, 8)
      );
      this.add(bolt, 0.32 + i * 0.05, (mesh, _d, _t, e) => {
        mesh.material.opacity = Math.max(0, 1 - e.age / e.ttl);
      });
    }

    const ringGeo = this._getSharedGeometry("lightning_ring", () => new THREE.TorusGeometry(0.55, 0.045, 8, 36));
    const ring = new THREE.Mesh(ringGeo, this._glow(meta.color, 6));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.06, p.z);
    this.add(ring, 0.9, (mesh, _d, _t, e) => {
      mesh.scale.setScalar(1 + (e.age / e.ttl) * 4);
      mesh.material.opacity = Math.max(0, 1 - e.age / e.ttl);
    });
  }

  private meteor(meta) {
    const p = this.target();
    const headGeo = this._getSharedGeometry("meteor_head", () => new THREE.SphereGeometry(0.08, 8, 6));
    const trailGeo = this._getSharedGeometry("meteor_trail", () => new THREE.ConeGeometry(0.045, 0.5, 6));

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = 1.3 + Math.random();
      const startY = 6 + Math.random() * 2;
      const delay = Math.random() * 0.9;
      
      const head = new THREE.Mesh(headGeo, this._glow(meta.color, 6));
      const trail = new THREE.Mesh(trailGeo, this._glow(meta.color, 3));
      trail.position.y = 0.3;
      
      const g = new THREE.Group();
      g.add(head, trail);
      
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      g.position.set(x, startY, z);
      g.visible = false;

      this.add(g, 1.6 + delay, (mesh, _d, _t, e) => {
        if (e.age < delay) return;
        mesh.visible = true;
        mesh.position.y = startY - (e.age - delay) * (startY / 0.95);
        if (mesh.position.y <= 0.08 && !e.hit) {
          e.hit = true;
          this.spark(x, z, meta.color);
        }
      });
    }
  }

  private portal(meta) {
    const p = this.target();
    const circleGeo = this._getSharedGeometry("portal_circle", () => new THREE.CircleGeometry(0.05, 32));
    const torusGeo = this._getSharedGeometry("portal_ring", () => new THREE.TorusGeometry(0.05, 0.03, 8, 48));

    const disc = new THREE.Mesh(
      circleGeo,
      new THREE.MeshBasicMaterial({ color: meta.color, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(p.x, 0.03, p.z);
    
    const ring = new THREE.Mesh(torusGeo, this._glow(meta.color, 7));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.04, p.z);

    const scale = (_m, e, base) => {
      const k = e.age / e.ttl;
      const s = k < 0.35 ? k / 0.35 : k > 0.75 ? Math.max(0.001, 1 - (k - 0.75) / 0.25) : 1;
      return 0.02 + s * base;
    };

    this.add(disc, 2.1, (mesh, dt, _t, e) => {
      mesh.scale.setScalar(scale(mesh, e, 1.5));
      mesh.rotation.z += dt * 0.6;
    });
    this.add(ring, 2.1, (mesh, dt, _t, e) => {
      mesh.scale.setScalar(scale(mesh, e, 1.6));
      mesh.rotation.z -= dt * 1.1;
    });

    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.2 + Math.random() * 1.1;
      const s = new THREE.Mesh(this.ball, this._glow(meta.color, 5));
      s.scale.setScalar(0.02);
      this.add(s, 2, (mesh, _d, t) => {
        const ang = a + t * 1.2;
        mesh.position.set(p.x + Math.cos(ang) * r, 0.08 + Math.sin(t * 3 + i) * 0.12, p.z + Math.sin(ang) * r);
      });
    }
  }

  private blessing(meta) {
    const p = this.target();
    const glowL = new THREE.PointLight(meta.color, 3, 8);
    glowL.position.copy(p);
    this.add(glowL, 2.5, (mesh, _d, _t, e) => {
      mesh.intensity = 3 * (1 - e.age / e.ttl);
    });

    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.1;
      const startY = 3.2 + Math.random() * 1.6;
      const s = new THREE.Mesh(this.ball, this._glow(meta.color, 6));
      s.scale.setScalar(0.025);
      s.position.set(p.x + Math.cos(a) * r, startY, p.z + Math.sin(a) * r);
      const vy = 0.5 + Math.random() * 0.5;
      this.add(s, 2.5, (mesh, dt) => {
        mesh.position.y -= vy * dt * 0.65;
        if (mesh.position.y < 0.06) mesh.position.y = startY;
      });
    }
  }

  private shadow(meta) {
    const p = this.target();
    const sphere24Geo = this._getSharedGeometry("shadow_sphere", () => new THREE.SphereGeometry(1.5, 24, 12));
    const fog = new THREE.Mesh(
      sphere24Geo,
      new THREE.MeshBasicMaterial({ color: meta.color, transparent: true, opacity: 0.01, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
    );
    fog.position.copy(p);
    this.add(fog, 2.5, (mesh, dt, _t, e) => {
      const k = e.age / e.ttl;
      const op = k < 0.3 ? (k / 0.3) * 0.28 : k > 0.7 ? Math.max(0, 0.28 * (1 - (k - 0.7) / 0.3)) : 0.28;
      mesh.material.opacity = op;
      mesh.rotation.y += dt * 0.2;
    });
  }

  private matrix(meta) {
    const p = this.target();
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = meta.color;
    ctx.font = "16px monospace";
    ctx.fillText(String.fromCharCode(0x30a0 + Math.floor(Math.random() * 90)), 6, 22);
    const tex = new THREE.CanvasTexture(canvas);

    for (let i = 0; i < 14; i++) {
      const x = p.x + (Math.random() - 0.5) * 2.2;
      const z = p.z + (Math.random() - 0.5) * 2.2;
      const startY = 3 + Math.random() * 1.6;
      const plane = new THREE.Mesh(
        getSharedGeometry("matrix_plane", () => new THREE.PlaneGeometry(0.14, 0.14)),
        new THREE.MeshBasicMaterial({ map: tex, color: meta.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
      );
      plane.position.set(x, startY, z);
      const vy = 1.2 + Math.random();
      this.add(plane, 2.3, (mesh, dt, _t, e) => {
        mesh.position.y -= vy * dt;
        mesh.lookAt(this.camera.position);
        if (mesh.position.y < 0) mesh.position.y = startY;
        mesh.material.opacity = Math.max(0, 1 - e.age / e.ttl);
      });
    }
  }

  private ice(meta) {
    const p = this.target();
    const iceGeo = this._getSharedGeometry("ice_icosahedron", () => new THREE.IcosahedronGeometry(1, 1));
    const shell = new THREE.Mesh(
      iceGeo,
      new THREE.MeshBasicMaterial({ color: meta.color, transparent: true, opacity: 0.01, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
    );
    shell.position.copy(p);
    this.add(shell, 2.1, (mesh, dt, _t, e) => {
      const k = e.age / e.ttl;
      const op = k < 0.25 ? (k / 0.25) * 0.5 : k > 0.8 ? Math.max(0, 0.5 * (1 - (k - 0.8) / 0.2)) : 0.5;
      mesh.material.opacity = op;
      mesh.rotation.y += dt * 0.15;
      if (k > 0.8 && !e.hit) {
        e.hit = true;
        this.spark(p.x, p.z, meta.color);
      }
    });
  }

  private boom(meta) {
    const p = this.target();
    const flash = new THREE.PointLight(meta.color, 8, 10);
    flash.position.copy(p);
    this.add(flash, 0.45, (mesh, _d, _t, e) => {
      mesh.intensity = 8 * Math.max(0, 1 - e.age / e.ttl);
    });
    
    const boomGeo = this._getSharedGeometry("boom_sphere", () => new THREE.SphereGeometry(0.28, 12, 10));
    const ball = new THREE.Mesh(boomGeo, this._glow(meta.color, 6));
    ball.position.copy(p);
    this.add(ball, 0.45, (mesh, _d, _t, e) => {
      mesh.scale.setScalar(1 + (e.age / e.ttl) * 3);
      mesh.material.opacity = Math.max(0, 1 - e.age / e.ttl);
    });
    this.spark(p.x, p.z, meta.color);
    this.domImpact(ADMIN_EFFECTS.impact);
  }

  private rays(meta) {
    const p = this.target();
    const beamGeo = this._getSharedGeometry("godray_beam_cylinder", () => new THREE.CylinderGeometry(0.07, 0.22, 4.2, 10, 1, true));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({ color: meta.color, transparent: true, opacity: 0.01, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
      );
      beam.position.set(p.x + Math.cos(a) * 0.55, p.y + 2, p.z + Math.sin(a) * 0.55);
      this.add(beam, 2.6, (mesh, _d, _t, e) => {
        const k = e.age / e.ttl;
        const op = k < 0.2 ? (k / 0.2) * 0.22 : k > 0.75 ? Math.max(0, 0.22 * (1 - (k - 0.75) / 0.25)) : 0.22;
        mesh.material.opacity = op;
      });
    }
  }

  private hammer(meta) {
    const p = this.target();
    const g = new THREE.Group();
    const handle = new THREE.Mesh(
      getSharedGeometry("hammer_handle_cylinder", () => new THREE.CylinderGeometry(0.05, 0.05, 1.05, 8)),
      this._getSharedMaterial(0x332211)
    );
    handle.position.y = 0.52;
    const head = new THREE.Mesh(getSharedGeometry("hammer_head_box", () => new THREE.BoxGeometry(0.5, 0.32, 0.32)), this._glow(meta.color, 3));
    head.position.y = 1.1;
    g.add(handle, head);
    g.position.set(p.x, p.y + 4, p.z);
    g.rotation.z = 0.5;
    this.add(g, 1.25, (mesh, _d, _t, e) => {
      const k = Math.min(1, e.age / 0.5);
      mesh.position.y = (p.y + 4) * (1 - k) + p.y * k;
      mesh.rotation.z = 0.5 * (1 - k);
      if (k >= 1 && !e.hit) {
        e.hit = true;
        this.spark(p.x, p.z, meta.color);
        this.domImpact(ADMIN_EFFECTS.impact);
      }
    });
  }

  private confetti(meta) {
    const p = this.target();
    const colors = [meta.color, "#ffe066", "#66ff99", "#66ccff", "#ff6699"];
    const planeGeo = this._getSharedGeometry("confetti_plane", () => new THREE.PlaneGeometry(0.06, 0.1));
    for (let i = 0; i < 36; i++) {
      const c = colors[i % colors.length];
      const bit = new THREE.Mesh(planeGeo, this._glow(c, 1.4));
      bit.position.set(p.x, p.y + 1.5, p.z);
      const vx = (Math.random() - 0.5) * 2.4;
      const vz = (Math.random() - 0.5) * 2.4;
      const vy0 = 2 + Math.random();
      const spin = (Math.random() - 0.5) * 8;
      this.add(bit, 2.2, (mesh, dt, _t, e) => {
        mesh.position.x += vx * dt;
        mesh.position.z += vz * dt;
        mesh.position.y += (vy0 - 3.2 * e.age) * dt;
        mesh.rotation.x += spin * dt;
        if (mesh.position.y < 0) mesh.position.y = 0;
      });
    }
  }

  private apocalypse(meta) {
    this.CleanUpAndRun(meta);
  }

  private CleanUpAndRun(meta) {
    this.meteor(meta);
    this.domImpact(ADMIN_EFFECTS.impact);
    const overlay = this.ensureOverlay();
    const tint = document.createElement("div");
    Object.assign(tint.style, {
      position: "absolute",
      inset: "0",
      background: `radial-gradient(circle at 50% 25%, ${meta.color}33, #1a000099 80%)`,
      mixBlendMode: "multiply",
      opacity: "0",
    });
    overlay.appendChild(tint);
    this.add(null, meta.duration / 1000, (_m, _d, _t, e) => {
      const k = e.age / e.ttl;
      const env = k < 0.15 ? k / 0.15 : k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : 1;
      tint.style.opacity = String(env * 0.5);
    }, undefined, tint);
  }

  private judgment(meta) {
    const p = this.target();
    this.rays(meta);
    const flash = new THREE.PointLight(meta.color, 0, 14);
    flash.position.set(p.x, p.y + 3, p.z);
    this.add(flash, 1, (mesh, _d, _t, e) => {
      mesh.intensity = Math.sin(Math.min(1, e.age / e.ttl) * Math.PI) * 12;
    });
    this.domImpact(ADMIN_EFFECTS.impact);
  }

  private tear(meta) {
    this.portal(meta);
    this.domGlass(meta);
    this.domChroma(ADMIN_EFFECTS.chromaticpulse);
  }

  private phoenix(meta) {
    const p = this.target();
    const coneGeo = this._getSharedGeometry("phoenix_cone", () => new THREE.ConeGeometry(0.045, 0.26, 6));
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.2 + Math.random() * 0.5;
      const flame = new THREE.Mesh(coneGeo, this._glow(meta.color, 6));
      flame.position.set(p.x + Math.cos(a) * r, p.y, p.z + Math.sin(a) * r);
      const vy = 1 + Math.random();
      this.add(flame, 1.6, (mesh, dt, _t, e) => {
        mesh.position.y += vy * dt;
        mesh.material.opacity = Math.max(0, 1 - e.age / e.ttl);
      });
    }
    this.domImpact(ADMIN_EFFECTS.impact);
  }

  private stars(meta) {
    const p = this.target();
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * 2;
      const sx = p.x + Math.cos(a) * dist;
      const sz = p.z + Math.sin(a) * dist;
      const sy = 3 + Math.random() * 2;
      const star = new THREE.Mesh(this.ball, this._glow(meta.color, 7));
      star.scale.setScalar(0.05);
      star.position.set(sx, sy, sz);
      star.visible = false;
      const delay = Math.random() * 1;
      this.add(star, 2.3 + delay, (mesh, _d, _t, e) => {
        if (e.age < delay) return;
        mesh.visible = true;
        const k = Math.min(1, (e.age - delay) / Math.max(0.2, e.ttl - delay));
        mesh.position.set(sx + (p.x - sx) * k, sy + (0.12 - sy) * k, sz + (p.z - sz) * k);
        if (k >= 1 && !e.hit) {
          e.hit = true;
          this.spark(p.x, p.z, meta.color);
        }
      });
    }
  }

  // ─── EFFETS SPÉCIAUX ADDITIONNELS v3.0 ─────────────────────────────────────

  private healingCircle(meta) {
    const p = this.target();
    const ringGeo = this._getSharedGeometry("healing_ring_torus", () => new THREE.TorusGeometry(0.8, 0.04, 8, 48));
    const ring = new THREE.Mesh(ringGeo, this._glow(meta.color, 6));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.03, p.z);
    
    this.add(ring, 3.0, (mesh, dt, t, e) => {
      mesh.rotation.z += dt * 0.5;
      const k = e.age / e.ttl;
      mesh.material.opacity = k < 0.15 ? (k / 0.15) : k > 0.85 ? Math.max(0, 1 - (k - 0.85) / 0.15) : 1;
    });

    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 0.4;
      const rune = new THREE.Mesh(this.ball, this._glow(meta.color, 5));
      rune.scale.setScalar(0.03);
      rune.position.set(p.x + Math.cos(a) * r, 0.06, p.z + Math.sin(a) * r);
      const vy = 0.4 + Math.random() * 0.4;
      this.add(rune, 3.0, (mesh, dt, t, e) => {
        mesh.position.y += vy * dt;
        mesh.material.opacity = Math.max(0, 1 - e.age / e.ttl);
      });
    }
  }

  private cosmicShield(meta) {
    const p = this.target();
    const shieldGeo = this._getSharedGeometry("shield_sphere", () => new THREE.SphereGeometry(1.3, 16, 16));
    const shield = new THREE.Mesh(
      shieldGeo,
      new THREE.MeshStandardMaterial({
        color: meta.color,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.2,
        wireframe: true,
      })
    );
    shield.position.copy(p).add(new THREE.Vector3(0, 1, 0));
    
    this.add(shield, 3.4, (mesh, dt, t, e) => {
      mesh.rotation.y += dt * 0.5;
      mesh.rotation.x += dt * 0.3;
      const k = e.age / e.ttl;
      mesh.material.opacity = k < 0.1 ? (k / 0.1) * 0.25 : k > 0.85 ? Math.max(0, 0.25 * (1 - (k - 0.85) / 0.15)) : 0.25;
    });
  }

  // ─── EFFETS EN SURCOUCHE D'ÉCRAN (DOM/CSS) ─────────────────────────────────

  private ensureOverlay() {
    if (this.overlay) return this.overlay;
    const parent = this.renderer.domElement.parentElement || document.body;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    const div = document.createElement("div");
    Object.assign(div.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "60", overflow: "hidden" });
    parent.appendChild(div);
    this.overlay = div;
    return div;
  }

  private ensureChroma() {
    if (this.chroma) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "ae-chroma-filter");
    filter.innerHTML = `<feOffset in="SourceGraphic" dx="-4" dy="0" result="r"/><feOffset in="SourceGraphic" dx="4" dy="0" result="b"/><feBlend in="r" in2="SourceGraphic" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>`;
    svg.appendChild(filter);
    document.body.appendChild(svg);
    this.chroma = filter;
  }

  private domImpact(meta) {
    const el = this.renderer.domElement;
    const origT = el.style.transform;
    const origF = el.style.filter;
    this.add(null, meta.duration / 1000, (_m, _d, t, e) => {
      const k = e.age / e.ttl;
      const env = Math.sin(k * Math.PI) * (1 - k);
      el.style.transform = `scale(${1 + env * 0.03}) translate(${Math.sin(t * 50) * env * 5}px, ${Math.cos(t * 44) * env * 3}px)`;
      el.style.filter = `brightness(${1 + env * 0.55})`;
    }, () => {
      el.style.transform = origT;
      el.style.filter = origF;
    });
  }

  private domChroma(meta) {
    this.ensureChroma();
    const el = this.renderer.domElement;
    const orig = el.style.filter;
    this.add(null, meta.duration / 1000, (_m, _d, _t, e) => {
      const env = Math.sin((e.age / e.ttl) * Math.PI);
      el.style.filter = `url(#ae-chroma-filter) saturate(${1 + env * 0.5})`;
    }, () => {
      el.style.filter = orig;
    });
  }

  private domSlow(meta) {
    const overlay = this.ensureOverlay();
    const v = document.createElement("div");
    Object.assign(v.style, {
      position: "absolute",
      inset: "0",
      background: `radial-gradient(circle at 50% 50%, transparent 35%, ${meta.color}22 100%)`,
      opacity: "0",
    });
    overlay.appendChild(v);
    const el = this.renderer.domElement;
    const orig = el.style.filter;
    this.add(null, meta.duration / 1000, (_m, _d, _t, e) => {
      const k = e.age / e.ttl;
      const env = k < 0.15 ? k / 0.15 : k > 0.85 ? Math.max(0, 1 - (k - 0.85) / 0.15) : 1;
      v.style.opacity = String(env * 0.55);
      el.style.filter = `saturate(${1 - env * 0.3})`;
    }, () => {
      el.style.filter = orig;
    }, v);
  }

  private domGlass(meta) {
    const overlay = this.ensureOverlay();
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0" });
    const cx = 48, cy = 46;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = 28 + (i % 3) * 10;
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", String(cx));
      line.setAttribute("y1", String(cy));
      line.setAttribute("x2", String(cx + Math.cos(a) * len));
      line.setAttribute("y2", String(cy + Math.sin(a) * len));
      line.setAttribute("stroke", meta.color);
      line.setAttribute("stroke-width", "0.35");
      svg.appendChild(line);
    }
    overlay.appendChild(svg);
    this.add(null, meta.duration / 1000, (_m, _d, _t, e) => {
      const k = e.age / e.ttl;
      const env = k < 0.1 ? k / 0.1 : k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1;
      svg.style.opacity = String(env);
    }, undefined, svg);
  }
}

export function listFx() {
  return ADMIN_EFFECT_IDS.map((id) => {
    const meta = ADMIN_EFFECTS[id];
    const mark = meta.icon ? `${meta.icon} ` : "";
    return `${mark}${id} — ${meta.name}`;
  }).join("\n");
}

export const SIG = 'TROXT⬡';
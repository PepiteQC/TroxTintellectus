// src/troxtmod3d/AuraEngine.js
// ETHERWORLD RP — AuraEngine v4.1 (18 auras + shader)

import * as THREE from 'three';

export const PLATINUM_AURAS = {
  lich_king:  { id:'lich_king',  name:'Lich King Frost',  subtitle:'Aura de Givre Glaciale', icon:'❄️', color:'#00d4ff', lightColor:0x00ccff, particleColor:0x88e5ff, ringColor:0x00d4ff, shader:'frost',    intensity:3.5, particles:140, rotationSpeed:0.8 },
  illidan:    { id:'illidan',    name:'Illidan Felfire',  subtitle:'Flammes Démoniaques',   icon:'🔥', color:'#10b981', lightColor:0x10b981, particleColor:0x34d399, ringColor:0x10b981, shader:'flame',    intensity:3.8, particles:160, rotationSpeed:1.2 },
  void:       { id:'void',       name:'Void Essence',     subtitle:'Ombres du Vide',        icon:'🔮', color:'#a855f7', lightColor:0x9333ea, particleColor:0xc084fc, ringColor:0x9333ea, shader:'cosmic',   intensity:3.2, particles:120, rotationSpeed:0.6 },
  holy:       { id:'holy',       name:'Holy Paladin',     subtitle:'Éclat Sacré & Doré',    icon:'✨', color:'#eab308', lightColor:0xeab308, particleColor:0xfde047, ringColor:0xeab308, shader:'cosmic',   intensity:4.0, particles:180, rotationSpeed:0.4 },
  blood:      { id:'blood',      name:'Blood Knight',     subtitle:'Aura de Sang Profond',  icon:'🩸', color:'#ef4444', lightColor:0xdc2626, particleColor:0xf87171, ringColor:0xdc2626, shader:'flame',    intensity:3.5, particles:130, rotationSpeed:1.0 },
  frost:      { id:'frost',      name:'Frost Bite',       subtitle:'Glace Pure',            icon:'🧊', color:'#7dd3fc', lightColor:0x7dd3fc, particleColor:0xbae6fd, ringColor:0x7dd3fc, shader:'frost',    intensity:3.0, particles:120, rotationSpeed:0.7 },
  fire:       { id:'fire',       name:'Inferno',          subtitle:'Feu Élémentaire',       icon:'🔥', color:'#f97316', lightColor:0xf97316, particleColor:0xfbbf24, ringColor:0xf97316, shader:'flame',    intensity:4.2, particles:180, rotationSpeed:1.5 },
  nature:     { id:'nature',     name:'Nature\'s Wrath',  subtitle:'Sève Druidique',        icon:'🌿', color:'#22c55e', lightColor:0x22c55e, particleColor:0x86efac, ringColor:0x22c55e, shader:'cosmic',   intensity:3.0, particles:140, rotationSpeed:0.5 },
  cyber:      { id:'cyber',      name:'Cyber Neon',       subtitle:'Circuits Néon',         icon:'⚡', color:'#06b6d4', lightColor:0x06b6d4, particleColor:0x67e8f9, ringColor:0x06b6d4, shader:'electric', intensity:4.5, particles:200, rotationSpeed:2.0 },
  shadow:     { id:'shadow',     name:'Shadow Cloak',     subtitle:'Voile d\'Ombres',       icon:'🌑', color:'#4c1d95', lightColor:0x4c1d95, particleColor:0xa78bfa, ringColor:0x4c1d95, shader:'cosmic',   intensity:2.8, particles:100, rotationSpeed:0.3 },
  lightning:  { id:'lightning',  name:'Thunder God',      subtitle:'Foudre Divine',         icon:'⚡', color:'#facc15', lightColor:0xfacc15, particleColor:0xfef08a, ringColor:0xfacc15, shader:'electric', intensity:5.0, particles:220, rotationSpeed:2.5 },
  rainbow:    { id:'rainbow',    name:'Prismatic',        subtitle:'Arc-en-Ciel Magique',   icon:'🌈', color:'#ec4899', lightColor:0xff69b4, particleColor:0xffaaff, ringColor:0xec4899, shader:'rainbow',  intensity:4.0, particles:200, rotationSpeed:1.0 },
  cosmic:     { id:'cosmic',     name:'Cosmic Void',      subtitle:'Étoiles & Galaxies',    icon:'🌌', color:'#6366f1', lightColor:0x6366f1, particleColor:0xc7d2fe, ringColor:0x6366f1, shader:'cosmic',   intensity:3.8, particles:250, rotationSpeed:0.4 },
  necrotic:   { id:'necrotic',   name:'Necrotic Plague',  subtitle:'Peste Mortuaire',       icon:'💀', color:'#65a30d', lightColor:0x65a30d, particleColor:0xbef264, ringColor:0x65a30d, shader:'cosmic',   intensity:3.0, particles:150, rotationSpeed:0.6 },
  sonic:      { id:'sonic',      name:'Sonic Wave',       subtitle:'Ondes Vibratoires',     icon:'🔊', color:'#0ea5e9', lightColor:0x0ea5e9, particleColor:0x7dd3fc, ringColor:0x0ea5e9, shader:'electric', intensity:3.8, particles:160, rotationSpeed:3.0 },
  infernal:   { id:'infernal',   name:'Infernal Gate',    subtitle:'Portail Démoniaque',    icon:'😈', color:'#dc2626', lightColor:0xdc2626, particleColor:0xfb923c, ringColor:0xdc2626, shader:'flame',    intensity:5.5, particles:240, rotationSpeed:2.2 },
  celestial:  { id:'celestial',  name:'Celestial Light',  subtitle:'Lumière Céleste',       icon:'😇', color:'#fef3c7', lightColor:0xfef3c7, particleColor:0xffffff, ringColor:0xfef3c7, shader:'cosmic',   intensity:5.0, particles:260, rotationSpeed:0.3 },
};

function makeParticleTexture(shape = 'circle') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (shape === 'star') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 28 : 12;
      ctx.lineTo(32 + Math.cos(ang) * r, 32 + Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else if (shape === 'flame') {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,200,100,0.8)');
    g.addColorStop(0.7, 'rgba(255,80,20,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  } else {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class AuraEngine {
  constructor(parentGroup) {
    this.parentGroup = parentGroup;
    this.auraGroup = new THREE.Group();
    this.auraGroup.name = 'troxt_aura_group_v4';
    this.parentGroup.add(this.auraGroup);
    this.currentLight = null;
    this.currentRings = [];
    this.particles = null;
    this.orbitingSpheres = [];
    this.beamMesh = null;
    this.currentDef = null;
    this.shaderTime = { value: 0 };
  }

  setAura(auraId) {
    this.clear();
    if (!auraId || auraId === 'none') return;
    const def = PLATINUM_AURAS[auraId] || PLATINUM_AURAS.lich_king;
    this.currentDef = def;

    // Point light
    this.currentLight = new THREE.PointLight(def.lightColor, def.intensity || 3.5, 8, 2);
    this.currentLight.position.set(0, 0.9, 0);
    this.auraGroup.add(this.currentLight);

    // Rings
    const ringPositions = [0.04, 0.9, 1.6];
    const ringRadii = [0.85, 0.6, 0.4];
    ringPositions.forEach((y, i) => {
      const ringGeo = new THREE.TorusGeometry(ringRadii[i], 0.018 - i * 0.004, 12, 64);
      const ringMat = new THREE.MeshStandardMaterial({
        color: def.ringColor || def.lightColor,
        emissive: def.ringColor || def.lightColor,
        emissiveIntensity: 2.5 - i * 0.5,
        transparent: true,
        opacity: 0.85 - i * 0.15,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this.currentRings.push(ring);
      this.auraGroup.add(ring);
    });

    // Particles
    const count = def.particles || 140;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.2 + Math.random() * 0.9;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 2.4;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      sizes[i] = 0.02 + Math.random() * 0.05;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const shape = def.shader === 'flame' ? 'flame' : def.shader === 'cosmic' ? 'star' : 'circle';
    const tex = makeParticleTexture(shape);

    const pMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.shaderTime,
        uColor: { value: new THREE.Color(def.particleColor) },
        uTex: { value: tex },
      },
      vertexShader: `
        attribute float size;
        uniform float uTime;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * 0.6, 2.4);
          float pulse = sin(uTime * 3.0 + p.x * 5.0 + p.z * 5.0) * 0.5 + 0.5;
          vAlpha = 0.4 + pulse * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = size * (600.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform sampler2D uTex;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a < 0.05) discard;
          gl_FragColor = vec4(uColor, t.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(pGeo, pMat);
    this.auraGroup.add(this.particles);

    // Orbiting spheres
    const orbitCount = def.shader === 'cosmic' || def.shader === 'celestial' ? 5 : 3;
    for (let i = 0; i < orbitCount; i++) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 12, 12),
        new THREE.MeshBasicMaterial({ color: def.particleColor, toneMapped: false })
      );
      this.orbitingSpheres.push(sphere);
      this.auraGroup.add(sphere);
    }

    // Beam
    if (def.shader === 'electric' || (def.intensity && def.intensity > 4)) {
      const beamGeo = new THREE.CylinderGeometry(0.02, 0.02, 3.5, 8, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: def.lightColor,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
      this.beamMesh.position.y = 1.75;
      this.auraGroup.add(this.beamMesh);
    }
  }

  update(time) {
    this.shaderTime.value = time;

    this.currentRings.forEach((ring, i) => {
      const speed = (this.currentDef?.rotationSpeed || 1.0) * (i % 2 === 0 ? 1 : -1);
      ring.rotation.z = time * speed * 0.8;
      const s = 1 + Math.sin(time * 2.5 + i) * 0.05;
      ring.scale.setScalar(s);
    });

    if (this.currentLight && this.currentDef) {
      const base = this.currentDef.intensity || 3.5;
      this.currentLight.intensity = base + Math.sin(time * 3.0) * (base * 0.2);
    }

    const orbitRadius = 0.9;
    const orbitSpeed = this.currentDef?.rotationSpeed || 1.0;
    this.orbitingSpheres.forEach((sphere, i) => {
      const ang = time * orbitSpeed * 0.9 + (i / this.orbitingSpheres.length) * Math.PI * 2;
      const y = 0.8 + Math.sin(time * 1.5 + i) * 0.5;
      sphere.position.set(Math.cos(ang) * orbitRadius, y, Math.sin(ang) * orbitRadius);
    });

    if (this.beamMesh) {
      const mat = this.beamMesh.material;
      mat.opacity = 0.15 + Math.sin(time * 5) * 0.1;
      this.beamMesh.rotation.y = time * 0.5;
    }
  }

  clear() {
    this.auraGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose?.());
        } else {
          child.material.dispose?.();
          if (child.material.map) child.material.map.dispose?.();
        }
      }
    });
    while (this.auraGroup.children.length > 0) {
      this.auraGroup.remove(this.auraGroup.children[0]);
    }
    this.currentLight = null;
    this.currentRings = [];
    this.particles = null;
    this.orbitingSpheres = [];
    this.beamMesh = null;
    this.currentDef = null;
  }
}
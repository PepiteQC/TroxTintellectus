/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/EMERGENCYWORLD.JS (v3.0 Platinum Edition)
 * Marqueurs 3D & Balises d'interventions 911 (Babylon.js & Three.js)
 * ═══════════════════════════════════════════════════════════════════
 * Gère le rendu visuel spatial des appels d'urgence :
 *  • Balises 3D volumétriques au-dessus des lieux d'intervention
 *  • Ondes radar pulsées au sol et gyrophares stroboscopiques
 *  • Synchronisation automatique avec la centrale de répartition 911
 *  • Support simultané ou isolé Babylon.js (scène de jeu) & Three.js (minicarte)
 *
 * Signature : TROXT⬡ · 🚨EmergencyDispatch
 * Chemin    : client/src/world/EmergencyWorld.js
 */

import * as THREE from 'three';

// Import tolérant de Babylon.js (ne crashe pas si utilisé uniquement avec Three.js)
let BABYLON = null;
try {
  BABYLON = await import('@babylonjs/core');
} catch {
  // Mode Three.js pur
}

const SIG = 'TROXT⬡';

// ─── COULEURS ET PRIORITÉS DES CODES D'URGENCE ──────────────────────────────
export const EMERGENCY_PRIORITIES = Object.freeze({
  code_1_normal: {
    label:   'Code 1 — Routine',
    colorHex: 0x4caf50, // Vert émeraude
    rgb:     [0.30, 0.69, 0.31],
    strobe:  false,
    pulseSpeed: 1.5,
  },
  code_2_urgent: {
    label:   'Code 2 — Urgent (Gyros)',
    colorHex: 0xff9800, // Ambre / Orange
    rgb:     [1.00, 0.60, 0.00],
    strobe:  false,
    pulseSpeed: 3.0,
  },
  code_3_critique: {
    label:   'Code 3 — Urgence Maximale (Sirène)',
    colorHex: 0xf44336, // Rouge vif
    rgb:     [0.96, 0.26, 0.21],
    strobe:  true,
    pulseSpeed: 6.0,
  },
  '10-80': {
    label:   '10-80 — Poursuite en cours',
    colorHex: 0x2196f3, // Bleu police
    rgb:     [0.13, 0.59, 0.95],
    strobe:  true,
    pulseSpeed: 8.0,
  },
  '10-71': {
    label:   '10-71 — Coups de feu tirés',
    colorHex: 0xe91e63, // Rose foncé / Alerte rouge
    rgb:     [0.91, 0.12, 0.39],
    strobe:  true,
    pulseSpeed: 7.0,
  },
});

export class EmergencyWorld {
  /**
   * @param {object} [babylonScene=null] - Instance de la scène Babylon.js
   * @param {THREE.Scene} [threeScene=null] - Scène Three.js optionnelle pour la minicarte
   */
  constructor(babylonScene = null, threeScene = null) {
    this.scene = babylonScene;
    this.threeScene = threeScene || new THREE.Scene();
    this.threeScene.name = 'EmergencyMinimap_Scene';

    /** @type {Map<string, { call: object, babylon?: any, threeGroup?: THREE.Group, pulseRing?: THREE.Mesh, beaconMesh?: THREE.Mesh, pConfig: object, createdAt: number }>} */
    this.markers = new Map();

    // Pool de géométries Three.js partagées (Zéro fuite mémoire)
    this._sharedGeometries = {
      sphere: new THREE.SphereGeometry(1.2, 16, 16),
      ring:   new THREE.RingGeometry(0.5, 2.5, 32),
      beam:   new THREE.CylinderGeometry(0.1, 0.8, 12, 16, 1, true),
    };

    this.sig = SIG;
  }

  /**
   * Normalise les coordonnées reçues.
   * @private
   */
  _extractCoordinates(call) {
    if (Array.isArray(call.coordinates)) {
      return {
        x: Number(call.coordinates[0]) || 0,
        y: Number(call.coordinates[1]) || 1.5,
        z: Number(call.coordinates[2]) || 0,
      };
    }
    if (call.position && typeof call.position === 'object') {
      return {
        x: Number(call.position.x) || 0,
        y: Number(call.position.y) || 1.5,
        z: Number(call.position.z) || 0,
      };
    }
    return {
      x: Number(call.posX ?? call.x) || 0,
      y: Number(call.posY ?? call.y) || 1.5,
      z: Number(call.posZ ?? call.z) || 0,
    };
  }

  /**
   * Ajoute une balise 3D d'urgence sur la carte.
   * @param {object} call 
   */
  addCall(call) {
    if (!call || !call.id || this.markers.has(call.id)) return;

    const coords = this._extractCoordinates(call);
    const pConfig = EMERGENCY_PRIORITIES[call.priority] || EMERGENCY_PRIORITIES[call.code] || EMERGENCY_PRIORITIES.code_1_normal;

    let babylonMesh = null;

    // ─── 1. RENDU BABYLON.JS (Scène Principale) ──────────────────────────────
    if (this.scene && BABYLON) {
      try {
        const { MeshBuilder, StandardMaterial, Color3, Vector3 } = BABYLON;
        const bColor = new Color3(pConfig.rgb[0], pConfig.rgb[1], pConfig.rgb[2]);

        const sphere = MeshBuilder.CreateSphere(`em_b_${call.id}`, { diameter: 1.4 }, this.scene);
        sphere.position = new Vector3(coords.x, coords.y + 1.0, coords.z);

        const mat = new StandardMaterial(`emMat_${call.id}`, this.scene);
        mat.emissiveColor = bColor;
        mat.diffuseColor  = bColor;
        mat.specularColor = new Color3(1, 1, 1);
        sphere.material   = mat;

        babylonMesh = sphere;
      } catch (err) {
        console.warn(`[${SIG}·Emergency] Impossible d'instancier la balise Babylon.js :`, err.message);
      }
    }

    // ─── 2. RENDU THREE.JS (Minicarte & Effets Volumétriques) ─────────────────
    const threeGroup = new THREE.Group();
    threeGroup.name = `EmergencyMarker_${call.id}`;
    threeGroup.position.set(coords.x, coords.y, coords.z);

    // Sphère centrale lumineuse
    const sphereMat = new THREE.MeshBasicMaterial({
      color: pConfig.colorHex,
      transparent: true,
      opacity: 0.9,
    });
    const beaconMesh = new THREE.Mesh(this._sharedGeometries.sphere, sphereMat);
    beaconMesh.position.y = 1.5;
    threeGroup.add(beaconMesh);

    // Onde radar au sol
    const ringMat = new THREE.MeshBasicMaterial({
      color: pConfig.colorHex,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const pulseRing = new THREE.Mesh(this._sharedGeometries.ring, ringMat);
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.position.y = 0.1;
    threeGroup.add(pulseRing);

    // Faisceau lumineux vertical (pour repérer l'intervention de loin)
    const beamMat = new THREE.MeshBasicMaterial({
      color: pConfig.colorHex,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const beamMesh = new THREE.Mesh(this._sharedGeometries.beam, beamMat);
    beamMesh.position.y = 6.0;
    threeGroup.add(beamMesh);

    this.threeScene.add(threeGroup);

    // Enregistrement
    this.markers.set(call.id, {
      call,
      babylon:    babylonMesh,
      threeGroup,
      beaconMesh,
      pulseRing,
      beamMesh,
      pConfig,
      createdAt:  Date.now(),
    });
  }

  /**
   * Retire une balise d'intervention résolue et libère les ressources GPU.
   * @param {string} callId 
   */
  removeCall(callId) {
    const entry = this.markers.get(callId);
    if (!entry) return;

    // Nettoyage Babylon.js
    if (entry.babylon) {
      try {
        if (entry.babylon.material) entry.babylon.material.dispose();
        entry.babylon.dispose();
      } catch {}
    }

    // Nettoyage Three.js
    if (entry.threeGroup) {
      this.threeScene.remove(entry.threeGroup);
      
      // Libération des matériaux individuels
      entry.threeGroup.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    this.markers.delete(callId);
  }

  /**
   * Synchronise l'ensemble des balises avec la liste active du Dispatcher.
   * @param {Array<object>} calls - Liste des appels actifs
   */
  sync(calls = []) {
    const activeIds = new Set(calls.map((c) => c.id));

    // Suppression des appels terminés
    for (const id of this.markers.keys()) {
      if (!activeIds.has(id)) {
        this.removeCall(id);
      }
    }

    // Ajout ou mise à jour des appels courants
    for (let i = 0; i < calls.length; i++) {
      this.addCall(calls[i]);
    }
  }

  /**
   * Boucle d'animation (Pulsation radar, balancement et gyrophares).
   * À appeler dans votre boucle de rendu (ex: requestAnimationFrame ou engine.runRenderLoop).
   * @param {number} [dt=0.016] 
   */
  update(dt = 0.016) {
    const now = Date.now() / 1000;

    for (const entry of this.markers.values()) {
      const { threeGroup, beaconMesh, pulseRing, beamMesh, pConfig, createdAt } = entry;
      const age = (Date.now() - createdAt) / 1000;

      // 1. Animation de lévitation sinusoïdale de la sphère
      if (beaconMesh) {
        beaconMesh.position.y = 1.5 + Math.sin(now * 3.0) * 0.25;
        beaconMesh.rotation.y += dt * 1.5;

        // Effet stroboscopique pour urgence critique (Code 3)
        if (pConfig.strobe) {
          const flash = Math.sin(now * pConfig.pulseSpeed * Math.PI) > 0;
          beaconMesh.material.opacity = flash ? 1.0 : 0.2;
        }
      }

      // 2. Pulsation de l'anneau radar au sol
      if (pulseRing) {
        const pulseProgress = (age * (pConfig.pulseSpeed * 0.4)) % 1.0;
        const scale = 1.0 + pulseProgress * 3.5;
        pulseRing.scale.set(scale, scale, scale);
        pulseRing.material.opacity = Math.max(0, 0.8 * (1.0 - pulseProgress));
      }

      // 3. Rotation lente du faisceau
      if (beamMesh) {
        beamMesh.rotation.y += dt * 0.5;
      }

      // 4. Animation Babylon.js si disponible
      if (entry.babylon) {
        entry.babylon.position.y = 1.5 + Math.sin(now * 3.0) * 0.25;
      }
    }
  }

  /**
   * Vide l'intégralité des balises actives.
   */
  clear() {
    const ids = Array.from(this.markers.keys());
    for (let i = 0; i < ids.length; i++) {
      this.removeCall(ids[i]);
    }
  }

  /**
   * Destruction complète du module et libération de la VRAM.
   */
  dispose() {
    this.clear();

    // Destruction des géométries partagées Three.js
    Object.values(this._sharedGeometries).forEach((geo) => {
      try { geo.dispose(); } catch {}
    });

    if (this.threeScene.parent) {
      this.threeScene.parent.remove(this.threeScene);
    }
    this.threeScene.clear();

    this.scene = null;
    console.log(`[${SIG}·Emergency] Scène et balises d'urgence libérées du GPU.`);
  }
}

export default EmergencyWorld;
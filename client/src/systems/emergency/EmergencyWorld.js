'use strict';
import { MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';
import * as THREE from 'three';

export class EmergencyWorld {
  constructor(scene) {
    this.scene = scene;
    this.markers = new Map(); // callId → { babylon, three }

    // Three.js fallback : scène légère pour mini-carte / world map
    this.threeScene = new THREE.Scene();
  }

  /** Ajoute un marqueur 3D à la position de l'appel. */
  addCall(call) {
    if (this.markers.has(call.id)) return;

    const color = {
      code_1_normal:   new Color3(0.30, 0.69, 0.31),
      code_2_urgent:   new Color3(1.00, 0.60, 0.00),
      code_3_critique: new Color3(0.96, 0.26, 0.21),
    }[call.priority] || new Color3(1, 1, 1);

    // Babylon
    const sphere = MeshBuilder.CreateSphere(`em_${call.id}`, { diameter: 1.2 }, this.scene);
    sphere.position = new Vector3(...call.coordinates);
    const mat = new StandardMaterial(`emMat_${call.id}`, this.scene);
    mat.emissiveColor = color;
    mat.diffuseColor  = color;
    sphere.material = mat;

    // Three.js (pour la mini-carte)
    const threeColor = new THREE.Color(color.r, color.g, color.b);
    const threeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: threeColor })
    );
    threeMesh.position.set(...call.coordinates);
    this.threeScene.add(threeMesh);

    this.markers.set(call.id, { babylon: sphere, three: threeMesh });
  }

  removeCall(callId) {
    const entry = this.markers.get(callId);
    if (!entry) return;
    entry.babylon.dispose();
    this.threeScene.remove(entry.three);
    entry.three.geometry.dispose();
    entry.three.material.dispose();
    this.markers.delete(callId);
  }

  sync(calls) {
    const activeIds = new Set(calls.map(c => c.id));
    for (const id of this.markers.keys()) {
      if (!activeIds.has(id)) this.removeCall(id);
    }
    for (const call of calls) this.addCall(call);
  }
}
// src/game/building/depanneur/babylon/CoucheTard.js
import {
  Scene, TransformNode, MeshBuilder, StandardMaterial, Color3,
  Vector3, PointLight,
} from '@babylonjs/core';

/**
 * @param {Scene} scene
 * @param {{position?: [number,number,number]}} [opts]
 * @returns {TransformNode}
 */
export function createCoucheTard(scene, { position = [18, 0, -48] } = {}) {
  const root = new TransformNode('coucheTard', scene);
  root.position = new Vector3(...position);

  const std = (hex) => {
    const m = new StandardMaterial(`m_${hex}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    return m;
  };

  // Bâtiment principal
  const building = MeshBuilder.CreateBox('building', { width: 12, height: 6, depth: 12 }, scene);
  building.position = new Vector3(0, 3, 0);
  building.material = std('#8B3A3A');
  building.parent = root;

  const roof = MeshBuilder.CreateBox('roof', { width: 12.5, height: 0.4, depth: 12.5 }, scene);
  roof.position = new Vector3(0, 6.2, 0);
  roof.material = std('#2a2a2a');
  roof.parent = root;

  // Enseigne toit
  const sign = MeshBuilder.CreateBox('sign', { width: 8, height: 1.5, depth: 0.3 }, scene);
  sign.position = new Vector3(0, 7, 6);
  sign.material = std('#ED1C24');
  sign.parent = root;

  // Auvent
  const canopy = MeshBuilder.CreateBox('canopy', { width: 16, height: 0.4, depth: 10 }, scene);
  canopy.position = new Vector3(0, 5.5, 14);
  canopy.material = std('#ffffff');
  canopy.parent = root;

  // Pompe à essence (1 exemple)
  const pump = MeshBuilder.CreateBox('pump', { width: 0.8, height: 2.2, depth: 0.6 }, scene);
  pump.position = new Vector3(-3.75, 1.2, 14);
  pump.material = std('#e0e0e0');
  pump.parent = root;

  // Lumière intérieure
  const light = new PointLight('interior', new Vector3(0, 4, 0), scene);
  light.diffuse = Color3.FromHexString('#fef3c7');
  light.intensity = 1.5;
  light.range = 15;
  light.parent = root;

  return root;
}
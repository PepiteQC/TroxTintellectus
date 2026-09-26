// src/game/scene.js
import * as THREE from 'three';
import { CoucheTardThree } from './building/depanneur/index.js';
import { BurgerKingThree } from './building/restaurant/index.js';
import { depanneurManager } from './building/depanneur/index.js';

export function setupCity(scene) {
  scene.add(CoucheTardThree({ position: [18, 0, -48] }));
  scene.add(BurgerKingThree({ position: [50, 0, -100] }));

  // Interaction démo
  const result = depanneurManager.purchaseItem('inv_sloche');
  console.log(result.message);        // "Achat confirmé: Sloche Bleue Format Géant (3.25 $)"
  console.log(depanneurManager.getCashRegisterBalance()); // 453.25
}
/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/BUILDING/DEPANNEUR/STOREARCHITECTURE.JSX
 * Intérieur 3D du dépanneur (comptoir, frigos, caisse, sloche…)
 * ═══════════════════════════════════════════════════════════════════
 * Aligné sur DepanneurManager (fixtures / inventory / zones)
 *   • Caisse interactive → purchaseItem
 *   • Frigo laiterie interactive
 *   • Machine Sloche interactive
 *   • Cafetière Van Houtte interactive
 *   • Étagère croustilles interactive
 *   • ATM (retrait — event kernel)
 *   • Porte arrière + caméra de sécurité (décoratives)
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/building/depanneur/StoreArchitecture.jsx
 */

'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { DepanneurManager } from './DepanneurManager.js';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════
// CACHE MATÉRIAUX MODULE (partagé)
// ═══════════════════════════════════════════════════════════════════════════
const _matCache = new Map();
const getMat = (key, factory) => {
  if (!_matCache.has(key)) _matCache.set(key, factory());
  return _matCache.get(key);
};
const stdMat = (c, r = 0.8, m = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });

const M = {
  floorTiles:   ()  => getMat('floorTiles',   () => stdMat('#d4d4d8', 0.6, 0.05)),
  wall:         ()  => getMat('wall',         () => stdMat('#e5e7eb', 0.85)),
  ceiling:      ()  => getMat('ceiling',      () => stdMat('#f3f4f6', 0.9)),
  counterTop:   ()  => getMat('counterTop',   () => stdMat('#1f2937', 0.3, 0.15)),
  counterBase:  ()  => getMat('counterBase',  () => stdMat('#0f172a', 0.7)),
  fridgeBody:   ()  => getMat('fridgeBody',   () => stdMat('#e5e7eb', 0.4, 0.3)),
  fridgeGlass:  ()  => getMat('fridgeGlass',  () => stdMat('#93c5fd', 0.05, 0.1, {
    transparent: true, opacity: 0.55, emissive: '#bfdbfe', emissiveIntensity: 0.2,
  })),
  slushBody:    ()  => getMat('slushBody',    () => stdMat('#334155', 0.5, 0.2)),
  slushBlue:    ()  => getMat('slushBlue',    () => stdMat('#3b82f6', 0.2, 0, { emissive: '#3b82f6', emissiveIntensity: 0.6 })),
  slushRed:     ()  => getMat('slushRed',     () => stdMat('#dc2626', 0.2, 0, { emissive: '#dc2626', emissiveIntensity: 0.6 })),
  coffeeBody:   ()  => getMat('coffeeBody',   () => stdMat('#1c1917', 0.6, 0.3)),
  coffeeLed:    ()  => getMat('coffeeLed',    () => stdMat('#22c55e', 0.3, 0, { emissive: '#22c55e', emissiveIntensity: 1.2 })),
  shelf:        ()  => getMat('shelf',        () => stdMat('#78716c', 0.85)),
  snackBag:     (c) => getMat(`snack_${c}`,   () => stdMat(c, 0.9)),
  atm:          ()  => getMat('atm',          () => stdMat('#0f172a', 0.5, 0.4)),
  atmScreen:    ()  => getMat('atmScreen',    () => stdMat('#1e3a5f', 0.2, 0, { emissive: '#22d3ee', emissiveIntensity: 0.9 })),
  neonRed:      ()  => getMat('neonRed',      () => stdMat('#dc2626', 0.3, 0, { emissive: '#dc2626', emissiveIntensity: 1.6 })),
  neonGreen:    ()  => getMat('neonGreen',    () => stdMat('#22c55e', 0.3, 0, { emissive: '#22c55e', emissiveIntensity: 1.6 })),
};

export function disposeStoreMaterials() {
  for (const m of _matCache.values()) m.dispose();
  _matCache.clear();
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const safeVec3 = (v, fb = [0, 0, 0]) =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? v : fb;

// ═══════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════

function CashRegister({ position }) {
  return (
    <group
      position={position}
      userData={{
        type: 'cash_register',
        interactive: true,
        action: 'open_shop',
        fixtureId: 'fix_register_1',
      }}
    >
      {/* Base */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.6, 1.0, 0.5]} />
        <primitive object={M.counterBase()} attach="material" />
      </mesh>
      {/* Écran */}
      <mesh position={[0, 1.15, 0.1]} rotation={[-0.4, 0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.35, 0.04]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[0, 1.16, 0.13]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[0.42, 0.26]} />
        <primitive object={M.atmScreen()} attach="material" />
      </mesh>
      <pointLight position={[0, 1.2, 0.4]} intensity={0.4} color="#22d3ee" distance={2} />
    </group>
  );
}

function Fridge({ position, rotation = [0, 0, 0] }) {
  return (
    <group
      position={position}
      rotation={rotation}
      userData={{
        type: 'fridge',
        interactive: true,
        action: 'open_shop',
        fixtureId: 'fix_fridge_dairy',
      }}
    >
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[2.4, 2.0, 0.8]} />
        <primitive object={M.fridgeBody()} attach="material" />
      </mesh>
      {/* Vitrine */}
      <mesh position={[0, 1.0, 0.41]}>
        <planeGeometry args={[2.2, 1.8]} />
        <primitive object={M.fridgeGlass()} attach="material" />
      </mesh>
      {/* Clayettes */}
      {[0.4, 0.9, 1.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0.05]}>
          <boxGeometry args={[2.2, 0.03, 0.6]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.6} />
        </mesh>
      ))}
      <pointLight position={[0, 1.6, 0.4]} intensity={0.5} color="#bae6fd" distance={3} />
    </group>
  );
}

function SlushMachine({ position }) {
  return (
    <group
      position={position}
      userData={{
        type: 'slush',
        interactive: true,
        action: 'open_shop',
        fixtureId: 'fix_slush_machine',
      }}
    >
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[1.4, 2.0, 0.6]} />
        <primitive object={M.slushBody()} attach="material" />
      </mesh>
      {/* 2 bols (bleu / rouge) */}
      <mesh position={[-0.35, 1.2, 0.32]}>
        <cylinderGeometry args={[0.28, 0.28, 0.9, 12]} />
        <primitive object={M.slushBlue()} attach="material" />
      </mesh>
      <mesh position={[0.35, 1.2, 0.32]}>
        <cylinderGeometry args={[0.28, 0.28, 0.9, 12]} />
        <primitive object={M.slushRed()} attach="material" />
      </mesh>
      <pointLight position={[0, 1.6, 0.5]} intensity={0.8} color="#93c5fd" distance={2.5} />
    </group>
  );
}

function CoffeeMachine({ position }) {
  return (
    <group
      position={position}
      userData={{
        type: 'coffee',
        interactive: true,
        action: 'open_shop',
        fixtureId: 'fix_coffee_van_houtte',
      }}
    >
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.7, 1.8, 0.5]} />
        <primitive object={M.coffeeBody()} attach="material" />
      </mesh>
      <mesh position={[0, 1.3, 0.26]}>
        <planeGeometry args={[0.4, 0.15]} />
        <primitive object={M.coffeeLed()} attach="material" />
      </mesh>
      <pointLight position={[0, 1.3, 0.4]} intensity={0.4} color="#22c55e" distance={2} />
    </group>
  );
}

function SnackShelf({ position, rotation = [0, 0, 0] }) {
  const bags = useMemo(
    () => [
      { c: '#fbbf24', x: -0.9, y: 0.4 },
      { c: '#f97316', x: -0.3, y: 0.4 },
      { c: '#ef4444', x:  0.3, y: 0.4 },
      { c: '#a3e635', x:  0.9, y: 0.4 },
      { c: '#fbbf24', x: -0.9, y: 0.9 },
      { c: '#ef4444', x: -0.3, y: 0.9 },
      { c: '#f97316', x:  0.3, y: 0.9 },
      { c: '#fde047', x:  0.9, y: 0.9 },
    ],
    []
  );

  return (
    <group
      position={position}
      rotation={rotation}
      userData={{ type: 'shelf', interactive: true, action: 'open_shop' }}
    >
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[2.2, 2.0, 0.5]} />
        <primitive object={M.shelf()} attach="material" />
      </mesh>
      {bags.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, 0.28]}>
          <boxGeometry args={[0.35, 0.45, 0.12]} />
          <primitive object={M.snackBag(b.c)} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

function ATM({ position }) {
  return (
    <group
      position={position}
      userData={{ type: 'atm', interactive: true, action: 'atm_withdraw' }}
    >
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.9, 2.0, 0.5]} />
        <primitive object={M.atm()} attach="material" />
      </mesh>
      <mesh position={[0, 1.3, 0.26]}>
        <planeGeometry args={[0.5, 0.35]} />
        <primitive object={M.atmScreen()} attach="material" />
      </mesh>
      <pointLight position={[0, 1.5, 0.6]} intensity={0.5} color="#22d3ee" distance={2.5} />
    </group>
  );
}

function NeonSign({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[2.0, 0.35, 0.1]} />
        <primitive object={M.neonRed()} attach="material" />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[1.2, 0.25, 0.1]} />
        <primitive object={M.neonGreen()} attach="material" />
      </mesh>
      <pointLight position={[0, 0, 0.5]} intensity={1.2} color="#f87171" distance={4} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function StoreArchitecture({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  isOpen = true,
  onShopOpen = null,
}) {
  const pos = safeVec3(position);
  const rot = safeVec3(rotation);

  const manager = DepanneurManager.getInstance();

  const userData = useMemo(
    () => ({ buildingId: 'depanneur_couche_tard', manager, sig: SIG }),
    [manager]
  );

  // Dimensions boutique
  const W = 12, D = 10, H = 3.5;

  return (
    <group position={pos} rotation={rot} name="store_architecture" userData={userData}>
      {/* ─── Sol carrelé ─── */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <primitive object={M.floorTiles()} attach="material" />
      </mesh>

      {/* ─── Murs ─── */}
      <mesh position={[0, H / 2, -D / 2]} receiveShadow castShadow>
        <boxGeometry args={[W, H, 0.2]} />
        <primitive object={M.wall()} attach="material" />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[D, H, 0.2]} />
        <primitive object={M.wall()} attach="material" />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[D, H, 0.2]} />
        <primitive object={M.wall()} attach="material" />
      </mesh>

      {/* ─── Plafond ─── */}
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <primitive object={M.ceiling()} attach="material" />
      </mesh>

      {/* ─── Comptoir caisse ─── */}
      <mesh position={[-3, 0.5, D / 2 - 1.5]} castShadow receiveShadow>
        <boxGeometry args={[4, 1.0, 1.2]} />
        <primitive object={M.counterBase()} attach="material" />
      </mesh>
      <mesh position={[-3, 1.02, D / 2 - 1.5]} castShadow>
        <boxGeometry args={[4.1, 0.05, 1.3]} />
        <primitive object={M.counterTop()} attach="material" />
      </mesh>
      <CashRegister position={[-3.8, 1.05, D / 2 - 1.5]} />
      <ATM position={[-1.4, 0, D / 2 - 1.5]} />

      {/* ─── Frigos ─── */}
      <Fridge position={[-W / 2 + 1.4, 0, -1]} rotation={[0, Math.PI / 2, 0]} />
      <Fridge position={[-W / 2 + 1.4, 0,  1.6]} rotation={[0, Math.PI / 2, 0]} />

      {/* ─── Machine Sloche ─── */}
      <SlushMachine position={[W / 2 - 1.0, 0, 1.5]} />

      {/* ─── Cafetière ─── */}
      <CoffeeMachine position={[W / 2 - 1.0, 0, 3.0]} />

      {/* ─── Étagères croustilles ─── */}
      <SnackShelf position={[1.5, 0, -D / 2 + 0.6]} />
      <SnackShelf position={[4.0, 0, -D / 2 + 0.6]} />

      {/* ─── Néon intérieur ─── */}
      <NeonSign position={[0, H - 0.5, -D / 2 + 0.2]} />

      {/* ─── Éclairage plafond ─── */}
      <pointLight position={[-3, H - 0.3, 0]} intensity={0.9} color="#fff8e0" distance={8} />
      <pointLight position={[3, H - 0.3, 0]} intensity={0.9} color="#fff8e0" distance={8} />

      {/* ─── État boutique (fermé = pas d'interaction) ─── */}
      {!isOpen && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W, D]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

StoreArchitecture.displayName = 'StoreArchitecture';
export default StoreArchitecture;
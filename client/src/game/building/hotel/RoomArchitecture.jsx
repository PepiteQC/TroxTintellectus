/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/BUILDING/HOTEL/ROOMARCHITECTURE.JSX (v3)
 * Architecture de chambre d'hôtel procédurale — variantes & partage
 * ═══════════════════════════════════════════════════════════════════
 * Boost v3 :
 *   • Option A : matériaux PARTAGÉS au niveau module (scale 50+ chambres)
 *   • 3 variantes : standard | penthouse | chalet
 *   • Action 'sleep' branchée sur hotelRealtimeSecurity + kernel
 *   • Extras conditionnels (chandelier, foyer, tapis, piano)
 *   • Dimensionnement dynamique via config
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/building/hotel/RoomArchitecture.jsx
 */

'use client';

import React, { useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { SecurityDoor } from '@/components/SecurityDoor';
import { WindowWithCurtains } from '@/components/WindowWithCurtains';
import { BathroomFixtures } from '@/components/BathroomFixtures';
import { hotelRealtimeSecurity } from './HotelRealtimeSecurity.js';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════
// CACHE MATÉRIAUX — partagé au niveau MODULE (survit aux re-renders)
// ═══════════════════════════════════════════════════════════════════════════
const _matCache = new Map();

const getMat = (key, factory) => {
  if (!_matCache.has(key)) _matCache.set(key, factory());
  return _matCache.get(key);
};

// Fabrique standard
const stdMat = (color, rough = 0.8, metal = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

// ─── Accesseurs memoïsés par variante ──────────────────────────────────────
const M = {
  wall:         (c) => getMat(`wall_${c}`,        () => stdMat(c, 0.7)),
  floor:        (c) => getMat(`floor_${c}`,       () => stdMat(c, 0.4, 0.1)),
  bedFrame:     (c) => getMat(`bedFrame_${c}`,    () => stdMat(c, 0.8)),
  mattress:     ()  => getMat('mattress',         () => stdMat('#f8fafc', 0.9)),
  pillow:       ()  => getMat('pillow',           () => stdMat('#e2e8f0')),
  woodTrim:     (c) => getMat(`woodTrim_${c}`,    () => stdMat(c, 0.85)),
  metalGold:    ()  => getMat('metalGold',        () => stdMat('#c9a227', 0.2, 0.9)),
  crystal:      ()  => getMat('crystal',          () => stdMat('#e0f2fe', 0.1, 0.3, { emissive: '#bae6fd', emissiveIntensity: 0.4 })),
  brick:        ()  => getMat('brick',            () => stdMat('#7c2d12', 0.95)),
  fire:         ()  => getMat('fire',             () => stdMat('#ff6600', 0.5, 0, { emissive: '#ff4400', emissiveIntensity: 1.8 })),
};

export function disposeHotelRoomMaterials() {
  for (const m of _matCache.values()) m.dispose();
  _matCache.clear();
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANTES DE CHAMBRE
// ═══════════════════════════════════════════════════════════════════════════
const VARIANTS = Object.freeze({
  standard: Object.freeze({
    wallColor: '#1e293b',
    floorColor: '#0f172a',
    bedFrameColor: '#334155',
    size: [7, 3, 6],          // [width, height, depth]
    hasChandelier: false,
    hasFireplace: false,
    hasRug: false,
    hasPiano: false,
    lightColor: '#fef08a',
  }),
  penthouse: Object.freeze({
    wallColor: '#1a1a2e',
    floorColor: '#0a0a14',
    bedFrameColor: '#4c1d95',
    size: [9, 3.5, 8],
    hasChandelier: true,
    hasFireplace: false,
    hasRug: true,
    hasPiano: true,
    lightColor: '#e0e7ff',
  }),
  chalet: Object.freeze({
    wallColor: '#4a3728',
    floorColor: '#2a1f14',
    bedFrameColor: '#6b4423',
    size: [8, 3, 7],
    hasChandelier: false,
    hasFireplace: true,
    hasRug: true,
    hasPiano: false,
    lightColor: '#fbbf24',
  }),
});

const ROOM_PALETTES = Object.freeze({
  villa_nova:     Object.freeze({ curtain: '#0284c7', access: 'resident', variant: 'standard'  }),
  modern_loft:    Object.freeze({ curtain: '#a855f7', access: 'vip',      variant: 'penthouse' }),
  suburban_dream: Object.freeze({ curtain: '#059669', access: 'resident', variant: 'chalet'    }),
});

const DEFAULT_PALETTE = Object.freeze({ curtain: '#059669', access: 'resident', variant: 'standard' });

// ═══════════════════════════════════════════════════════════════════════════
// HOOK — interaction 'sleep'
// ═══════════════════════════════════════════════════════════════════════════
export function useHotelSleepAction(roomId, playerId = 'player-local', kernel = null) {
  return useCallback(async () => {
    const door = hotelRealtimeSecurity.getRoomDoorState(roomId);
    if (!door) return { ok: false, message: 'Chambre introuvable' };
    if (door.isLocked) return { ok: false, message: 'Porte verrouillée — passez une carte' };
    if (door.state === 'lockout') return { ok: false, message: 'Lecteur en lockout' };

    kernel?.emit?.('troxtworld:hotel.sleep', { roomId, player_id: playerId });
    return { ok: true, message: `Bonne nuit dans ${roomId}` };
  }, [roomId, playerId, kernel]);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const safeVec3 = (v, fallback = [0, 0, 0]) =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? v : fallback;

const labelFromRoomId = (id) => String(id).replace(/_/g, ' ').toUpperCase();

// ═══════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS EXTRAS
// ═══════════════════════════════════════════════════════════════════════════

function Chandelier({ y }) {
  return (
    <group position={[0, y, 0]} userData={{ type: 'chandelier' }}>
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
        <primitive object={M.metalGold()} attach="material" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.35, 12, 8]} />
        <primitive object={M.crystal()} attach="material" />
      </mesh>
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.45, -0.15, Math.sin(a) * 0.45]}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <primitive object={M.crystal()} attach="material" />
        </mesh>
      ))}
      <pointLight position={[0, -0.5, 0]} intensity={1.6} color="#fff8e0" distance={6} />
    </group>
  );
}

function Fireplace({ position = [0, 0, 0] }) {
  return (
    <group position={position} userData={{ type: 'fireplace', interactive: true, action: 'warm_up' }}>
      {/* Manteau en brique */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.8, 0.5]} />
        <primitive object={M.brick()} attach="material" />
      </mesh>
      {/* Ouverture */}
      <mesh position={[0, 0.6, 0.26]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
      {/* Flammes */}
      <mesh position={[0, 0.4, 0.27]}>
        <coneGeometry args={[0.25, 0.55, 6]} />
        <primitive object={M.fire()} attach="material" />
      </mesh>
      <pointLight position={[0, 0.6, 0.5]} intensity={1.2} color="#ff8844" distance={5} />
    </group>
  );
}

function Rug({ size = [2.5, 0.02, 1.5], color = '#7c3aed' }) {
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size[0], size[2]]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function Piano({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation} userData={{ type: 'piano', interactive: true, action: 'play_piano' }}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.4, 0.8, 0.6]} />
        <primitive object={M.woodTrim('#1a1a1a')} attach="material" />
      </mesh>
      <mesh position={[0, 0.85, -0.05]} rotation={[-0.15, 0, 0]} castShadow>
        <boxGeometry args={[1.4, 0.05, 0.6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function RoomArchitecture({
  roomId,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  isNight = true,
  variant: variantOverride = null,
}) {
  const pos = safeVec3(position);
  const rot = safeVec3(rotation);

  const palette = ROOM_PALETTES[roomId] || DEFAULT_PALETTE;
  const variantKey = variantOverride || palette.variant;
  const cfg = VARIANTS[variantKey] || VARIANTS.standard;

  const [W, H, D] = cfg.size;

  const label = useMemo(() => labelFromRoomId(roomId), [roomId]);
  const userData = useMemo(
    () => ({ buildingId: 'hotel', roomId, variant: variantKey, sig: SIG }),
    [roomId, variantKey]
  );

  return (
    <group position={pos} rotation={rot} name={`room_${roomId}`} userData={userData}>
      {/* ─── Murs ─── */}
      <mesh position={[0, H / 2, -D / 2]} receiveShadow castShadow>
        <boxGeometry args={[W, H, 0.2]} />
        <primitive object={M.wall(cfg.wallColor)} attach="material" />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[D, H, 0.2]} />
        <primitive object={M.wall(cfg.wallColor)} attach="material" />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[D, H, 0.2]} />
        <primitive object={M.wall(cfg.wallColor)} attach="material" />
      </mesh>

      {/* ─── Plancher ─── */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <primitive object={M.floor(cfg.floorColor)} attach="material" />
      </mesh>

      {/* ─── Tapis (penthouse / chalet) ─── */}
      {cfg.hasRug && (
        <Rug
          size={[W * 0.5, 0.02, D * 0.35]}
          color={variantKey === 'chalet' ? '#7c2d12' : '#4c1d95'}
        />
      )}

      {/* ─── Porte de sécurité ─── */}
      <SecurityDoor
        position={[0, 0, D / 2]}
        rotation={[0, Math.PI, 0]}
        doorId={`${roomId}_door`}
        accessLevel={palette.access}
        label={label}
      />

      {/* ─── Fenêtre + rideaux ─── */}
      <WindowWithCurtains
        position={[0, H * 0.6, -D / 2 + 0.15]}
        size={[2.5, 1.8]}
        curtainColor={palette.curtain}
        isNight={isNight}
      />

      {/* ─── Salle de bain ─── */}
      <BathroomFixtures
        position={[-W / 2 + 1.5, 0, -D / 2 + 1.2]}
        rotation={[0, Math.PI / 4, 0]}
      />

      {/* ─── Lit ─── */}
      <group
        position={[W / 2 - 1.7, 0, -D / 2 + 1.5]}
        userData={{ type: 'bed', interactive: true, action: 'sleep', roomId }}
      >
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[2, 0.5, 2.2]} />
          <primitive object={M.bedFrame(cfg.bedFrameColor)} attach="material" />
        </mesh>
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.9, 0.25, 2.1]} />
          <primitive object={M.mattress()} attach="material" />
        </mesh>
        <mesh position={[-0.45, 0.7, -0.7]} castShadow>
          <boxGeometry args={[0.7, 0.12, 0.4]} />
          <primitive object={M.pillow()} attach="material" />
        </mesh>
        <mesh position={[0.45, 0.7, -0.7]} castShadow>
          <boxGeometry args={[0.7, 0.12, 0.4]} />
          <primitive object={M.pillow()} attach="material" />
        </mesh>
      </group>

      {/* ─── Extras conditionnels ─── */}
      {cfg.hasChandelier && <Chandelier y={H - 0.4} />}
      {cfg.hasFireplace && <Fireplace position={[-W / 2 + 1.2, 0, D / 2 - 1.2]} />}
      {cfg.hasPiano && <Piano position={[-W / 2 + 1.5, 0, 0]} rotation={[0, Math.PI / 2, 0]} />}

      {/* ─── Lumière ambiante ─── */}
      <pointLight
        position={[0, H - 0.5, 0]}
        intensity={isNight ? 0.6 : 1.1}
        color={cfg.lightColor}
        distance={Math.max(W, D) + 2}
      />
    </group>
  );
}

RoomArchitecture.displayName = 'RoomArchitecture';
export { VARIANTS as ROOM_VARIANTS };
export default RoomArchitecture;
// src/troxtmod3d/Character3D.jsx
// ETHERWORLD RP — Character3D v4.1 (JSX pur, 16 races, 20 tenues, 16 armes)

import React, { useRef } from 'react';
import { Box, Sphere, Cylinder, Cone, Torus, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { RACES, BODY_TYPES, HAIR_STYLES, FACIAL_HAIR } from './constants';

const darken = (hex, k = 0.85) => {
  try { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }
  catch { return hex; }
};

export function Character3D({ cfg }) {
  const groupRef = useRef();
  const armLRef = useRef();
  const armRRef = useRef();
  const headRef = useRef();
  const tRef = useRef(0);

  const race = RACES.find((r) => r.id === cfg.race) || RACES[0];
  const body = BODY_TYPES.find((b) => b.id === cfg.bodyType) || BODY_TYPES[1];
  const isGhost = cfg.race === 'ghost';
  const isAndroid = cfg.race === 'android' || cfg.race === 'ai';
  const isRobot = cfg.outfit === 'robot';

  // (le useFrame est géré par EngineIntegrator dans le parent)

  const skin = race.skinTint || cfg.skinColor;
  const skinDark = darken(skin, 0.85);
  const hair = cfg.hairColor;
  const eye = cfg.eyeColor;
  const out1 = cfg.outfitColor;
  const out2 = cfg.outfitColor2;

  const fat = cfg.fatness / 100;
  const mus = cfg.muscular / 100;
  const hgt = 0.85 + cfg.height * 0.003;

  const torsoW = (0.7 + fat * 0.15 + mus * 0.1) * body.scaleX * race.scaleX;
  const torsoH = 0.9;
  const torsoD = (0.4 + fat * 0.1 + mus * 0.05) * body.scaleZ;
  const legW = 0.28 * body.scaleX;
  const armW = (0.22 + mus * 0.05) * body.scaleX;
  const totalH = race.scaleY * hgt;
  const headSize = 0.55 * race.scaleX * (0.95 + fat * 0.1);

  const mkMat = (color, emissive = false, transparent = false, opacity = 1, metalness = 0, roughness = 0.8) => (
    <meshPhysicalMaterial
      color={color}
      emissive={emissive ? color : '#000'}
      emissiveIntensity={emissive ? 0.35 : 0}
      transparent={transparent}
      opacity={opacity}
      metalness={metalness}
      roughness={roughness}
      clearcoat={metalness > 0.5 ? 0.8 : 0.15}
      clearcoatRoughness={0.3}
      sheen={0.4}
      sheenColor={color}
    />
  );

  const renderEquipment = () => {
    const eqCol = cfg.equipmentColor || '#aaaaaa';
    switch (cfg.equipment) {
      case 'sword': return (
        <group position={[torsoW / 2 + armW + 0.12, 0.85, 0]} rotation={[0, 0, -0.15]}>
          <Box args={[0.06, 0.95, 0.06]}><meshPhysicalMaterial color={eqCol} metalness={0.95} roughness={0.1} clearcoat={1} /></Box>
          <Box args={[0.32, 0.06, 0.06]} position={[0, 0.02, 0]}><meshPhysicalMaterial color="#885533" /></Box>
        </group>
      );
      case 'gun': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.72, 0.1]}>
          <Box args={[0.1, 0.22, 0.5]}><meshPhysicalMaterial color="#222" metalness={0.9} roughness={0.15} clearcoat={1} /></Box>
        </group>
      );
      case 'bow': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.9, 0]}>
          <Torus args={[0.4, 0.02, 8, 32, Math.PI * 1.5]} rotation={[Math.PI / 2, 0, 0]}><meshPhysicalMaterial color="#774422" roughness={0.85} /></Torus>
        </group>
      );
      case 'staff': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.6, 0]}>
          <Cylinder args={[0.04, 0.04, 1.6, 10]}><meshPhysicalMaterial color="#552211" roughness={0.9} /></Cylinder>
          <Sphere args={[0.14, 20, 20]} position={[0, 0.9, 0]}>
            <meshPhysicalMaterial color={eye} emissive={eye} emissiveIntensity={1.2} transmission={0.3} clearcoat={1} />
          </Sphere>
        </group>
      );
      case 'shield': return (
        <Box args={[0.08, 0.7, 0.6]} position={[-(torsoW / 2 + armW + 0.15), 0.9, 0]}>
          <meshPhysicalMaterial color={out2 || '#2244aa'} metalness={0.7} roughness={0.25} clearcoat={0.9} />
        </Box>
      );
      case 'lance': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.5, 0]}>
          <Cylinder args={[0.03, 0.03, 2.3, 10]}><meshPhysicalMaterial color="#774422" roughness={0.85} /></Cylinder>
          <Cone args={[0.08, 0.35, 8]} position={[0, 1.25, 0]}><meshPhysicalMaterial color="#dddddd" metalness={0.9} roughness={0.1} clearcoat={1} /></Cone>
        </group>
      );
      case 'bomb': return (
        <group position={[torsoW / 2 + armW + 0.15, 0.72, 0]}>
          <Sphere args={[0.16, 16, 16]}><meshPhysicalMaterial color="#222" roughness={0.6} /></Sphere>
        </group>
      );
      case 'axe': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.7, 0]}>
          <Cylinder args={[0.03, 0.03, 1.4, 10]}><meshPhysicalMaterial color="#553311" roughness={0.9} /></Cylinder>
          <Box args={[0.35, 0.28, 0.05]} position={[0.15, 0.6, 0]}><meshPhysicalMaterial color="#888" metalness={0.8} roughness={0.3} /></Box>
        </group>
      );
      case 'dagger': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.7, 0]}>
          <Box args={[0.03, 0.4, 0.03]}><meshPhysicalMaterial color="#ccc" metalness={0.95} roughness={0.05} clearcoat={1} /></Box>
        </group>
      );
      case 'hammer': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.7, 0]}>
          <Cylinder args={[0.03, 0.03, 0.9, 8]}><meshPhysicalMaterial color="#442211" roughness={0.9} /></Cylinder>
          <Box args={[0.3, 0.25, 0.25]} position={[0, 0.5, 0]}><meshPhysicalMaterial color="#666" metalness={0.85} roughness={0.3} /></Box>
        </group>
      );
      case 'scythe': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.5, 0]}>
          <Cylinder args={[0.03, 0.03, 1.8, 8]}><meshPhysicalMaterial color="#111" roughness={0.8} /></Cylinder>
          <Torus args={[0.5, 0.025, 8, 24, Math.PI * 0.9]} position={[0.3, 1.05, 0]} rotation={[0, 0, Math.PI / 2]}><meshPhysicalMaterial color="#333" metalness={0.9} roughness={0.2} /></Torus>
        </group>
      );
      case 'wand': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.75, 0]}>
          <Cylinder args={[0.015, 0.02, 0.6, 8]}><meshPhysicalMaterial color="#442211" roughness={0.8} /></Cylinder>
          <Sphere args={[0.07, 16, 16]} position={[0, 0.35, 0]}><meshPhysicalMaterial color={eye} emissive={eye} emissiveIntensity={2} /></Sphere>
          <Sparkles count={12} scale={0.3} position={[0, 0.35, 0]} color={eye} size={2} speed={0.4} />
        </group>
      );
      case 'rifle': return (
        <group position={[torsoW / 2 + armW + 0.1, 0.75, 0.15]}>
          <Box args={[0.07, 0.1, 0.9]}><meshPhysicalMaterial color="#1a1a1a" metalness={0.9} roughness={0.15} /></Box>
        </group>
      );
      case 'claws': return (
        <group position={[torsoW / 2 + armW + 0.02, 0.55, 0.05]}>
          {[0, 1, 2, 3].map((i) => (
            <Cone key={i} args={[0.02, 0.25, 6]} position={[0, 0.15 + i * 0.03, i * 0.02 - 0.03]} rotation={[-Math.PI / 2, 0, 0]}>
              <meshPhysicalMaterial color="#ccc" metalness={0.95} roughness={0.05} />
            </Cone>
          ))}
        </group>
      );
      case 'orb': return (
        <group position={[torsoW / 2 + armW + 0.15, 0.9, 0]}>
          <Sphere args={[0.16, 24, 24]}>
            <meshPhysicalMaterial color={eye} emissive={eye} emissiveIntensity={1.8} transmission={0.6} roughness={0.02} thickness={0.1} clearcoat={1} />
          </Sphere>
          <Sparkles count={20} scale={0.5} color={eye} size={3} speed={0.6} />
        </group>
      );
      default: return null;
    }
  };

  const renderWings = () => {
    if (cfg.accessories?.wings === 'Aucune' || !cfg.accessories) return null;
    const col = race.traitColor || '#ffffff';
    return (
      <group position={[0, 1.15, -torsoD / 2 - 0.05]}>
        <group rotation={[0, -0.3, 0.2]} position={[-torsoW * 0.6, 0, 0]}>
          <Box args={[0.5, 0.9, 0.03]} position={[-0.25, 0.3, 0]}><meshPhysicalMaterial color={col} roughness={0.4} clearcoat={0.9} transparent opacity={0.9} /></Box>
        </group>
        <group rotation={[0, 0.3, -0.2]} position={[torsoW * 0.6, 0, 0]}>
          <Box args={[0.5, 0.9, 0.03]} position={[0.25, 0.3, 0]}><meshPhysicalMaterial color={col} roughness={0.4} clearcoat={0.9} transparent opacity={0.9} /></Box>
        </group>
      </group>
    );
  };

  const renderTail = () => {
    if (!cfg.accessories || cfg.accessories.tail === 'Aucune') return null;
    const col = race.traitColor || skinDark;
    return (
      <group position={[0, 0.5, -torsoD / 2]}>
        <Cylinder args={[0.04, 0.06, 0.9, 8]} rotation={[Math.PI / 3, 0, 0]} position={[0, -0.3, -0.3]}>
          <meshPhysicalMaterial color={col} roughness={0.7} />
        </Cylinder>
      </group>
    );
  };

  const renderHalo = () => {
    if (!cfg.accessories || cfg.accessories.halo === 'Aucun') return null;
    const col = race.traitColor || '#ffe066';
    return (
      <group position={[0, 2.35 * totalH, 0]}>
        <Torus args={[0.35, 0.04, 8, 32]} rotation={[Math.PI / 2, 0, 0]}>
          <meshPhysicalMaterial color={col} emissive={col} emissiveIntensity={2} metalness={1} roughness={0.1} toneMapped={false} />
        </Torus>
      </group>
    );
  };

  const renderHat = () => {
    const hat = cfg.accessories?.hat;
    if (!hat || hat === 'Aucun') return null;
    const hatCol = out2 || '#222';
    const hatY = 2.28;
    switch (hat) {
      case 'Casquette': return (
        <group position={[0, hatY, 0]}>
          <Sphere args={[headSize * 0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]}><meshPhysicalMaterial color={hatCol} roughness={0.7} /></Sphere>
          <Box args={[headSize * 0.9, 0.03, 0.25]} position={[0, -0.02, 0.3]}><meshPhysicalMaterial color={hatCol} roughness={0.7} /></Box>
        </group>
      );
      case 'Bonnet': return (
        <group position={[0, hatY + 0.05, 0]}>
          <Sphere args={[headSize * 0.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7]}><meshPhysicalMaterial color={hatCol} roughness={0.9} /></Sphere>
          <Sphere args={[0.06, 12, 12]} position={[0, 0.35, 0]}><meshPhysicalMaterial color={hatCol} roughness={0.9} /></Sphere>
        </group>
      );
      case 'Fedora': return (
        <group position={[0, hatY, 0]}>
          <Cylinder args={[headSize * 0.95, headSize * 0.95, 0.04, 24]}><meshPhysicalMaterial color={hatCol} roughness={0.7} /></Cylinder>
          <Cylinder args={[headSize * 0.55, headSize * 0.6, 0.4, 20]} position={[0, 0.22, 0]}><meshPhysicalMaterial color={hatCol} roughness={0.7} /></Cylinder>
        </group>
      );
      case 'Capuche': return (
        <group position={[0, hatY - 0.05, 0]}>
          <Sphere args={[headSize * 0.75, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65]}><meshPhysicalMaterial color={out1} roughness={0.9} /></Sphere>
        </group>
      );
      case 'Béret': return (
        <group position={[-0.06, hatY, 0]}>
          <Sphere args={[headSize * 0.65, 16, 12]}><meshPhysicalMaterial color={hatCol} roughness={0.8} /></Sphere>
        </group>
      );
      case 'Couronne': return (
        <group position={[0, hatY, 0]}>
          <Cylinder args={[headSize * 0.55, headSize * 0.55, 0.12, 16, 1, true]}><meshPhysicalMaterial color="#ffd700" metalness={1} roughness={0.1} side={THREE.DoubleSide} /></Cylinder>
          {[-0.3, -0.15, 0, 0.15, 0.3].map((x, i) => (
            <Cone key={i} args={[0.05, 0.15, 4]} position={[x, 0.12, 0]}><meshPhysicalMaterial color="#ffd700" metalness={1} roughness={0.1} emissive="#ffaa00" emissiveIntensity={0.3} /></Cone>
          ))}
        </group>
      );
      case 'Chapeau de sorcière': return (
        <group position={[0, hatY, 0]}>
          <Cylinder args={[headSize * 1.1, headSize * 1.1, 0.04, 24]}><meshPhysicalMaterial color={darken(out1, 0.5)} roughness={0.85} /></Cylinder>
          <Cone args={[headSize * 0.55, 0.9, 12]} position={[0.06, 0.42, 0]} rotation={[0, 0, -0.15]}><meshPhysicalMaterial color={darken(out1, 0.5)} roughness={0.85} /></Cone>
        </group>
      );
      case 'Casque': return (
        <group position={[0, hatY, 0]}>
          <Sphere args={[headSize * 0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.75]}><meshPhysicalMaterial color="#555" metalness={0.9} roughness={0.3} clearcoat={1} /></Sphere>
          <Box args={[headSize * 0.9, 0.08, 0.15]} position={[0, 0.05, 0.25]}><meshPhysicalMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.4} metalness={0.9} /></Box>
        </group>
      );
      case 'Bandeau': return (
        <group position={[0, hatY - 0.15, 0]}>
          <Torus args={[headSize * 0.55, 0.035, 8, 32]} rotation={[Math.PI / 2, 0, 0]}><meshPhysicalMaterial color={out2} roughness={0.7} /></Torus>
        </group>
      );
      default: return null;
    }
  };

  const renderGlasses = () => {
    if (!cfg.accessories || cfg.accessories.glasses === 'Aucun') return null;
    const gCol = out2 || '#111';
    return (
      <group position={[0, 1.97 * hgt, 0.27]}>
        <Box args={[0.08, 0.04, 0.02]} position={[-0.1, 0, 0]}><meshPhysicalMaterial color={gCol} metalness={0.9} roughness={0.15} /></Box>
        <Box args={[0.08, 0.04, 0.02]} position={[0.1, 0, 0]}><meshPhysicalMaterial color={gCol} metalness={0.9} roughness={0.15} /></Box>
        <Box args={[0.09, 0.05, 0.005]} position={[-0.1, 0, 0.012]}><meshPhysicalMaterial color="#000" transmission={0.7} thickness={0.05} transparent opacity={0.6} /></Box>
        <Box args={[0.09, 0.05, 0.005]} position={[0.1, 0, 0.012]}><meshPhysicalMaterial color="#000" transmission={0.7} thickness={0.05} transparent opacity={0.6} /></Box>
      </group>
    );
  };

  const renderCape = () => {
    if (!cfg.accessories || cfg.accessories.cape === 'Aucune') return null;
    const len = cfg.accessories.cape === 'Longue' ? 1.4 : 0.8;
    return (
      <group position={[0, 0.65, -torsoD / 2 - 0.04]}>
        <Box args={[torsoW * 1.05, len, 0.03]} position={[0, len / 2 - 0.1, 0]}>
          <meshPhysicalMaterial color={out1} roughness={0.9} side={THREE.DoubleSide} />
        </Box>
      </group>
    );
  };

  return (
    <group ref={groupRef} scale={[1, totalH, 1]} position={[0, -0.5, 0]}>
      {cfg.auraEnabled && <pointLight position={[0, 1.5, 0]} color={cfg.auraColor} intensity={1.5} distance={3} />}

      {/* Jambes */}
      <Box args={[legW, 0.9, legW * 1.1]} position={[0.19, 0.18, 0]} castShadow>{mkMat(out1, false, isGhost, isGhost ? 0.7 : 1)}</Box>
      <Box args={[legW, 0.9, legW * 1.1]} position={[-0.19, 0.18, 0]} castShadow>{mkMat(out1, false, isGhost, isGhost ? 0.7 : 1)}</Box>
      <Box args={[legW + 0.04, 0.12, legW * 1.4]} position={[0.19, -0.28, 0.05]} castShadow>{mkMat(out2 || '#1a1a1a')}</Box>
      <Box args={[legW + 0.04, 0.12, legW * 1.4]} position={[-0.19, -0.28, 0.05]} castShadow>{mkMat(out2 || '#1a1a1a')}</Box>

      {/* Torse */}
      <Box args={[torsoW, torsoH, torsoD]} position={[0, 1.08, 0]} castShadow>
        {mkMat(out1, cfg.race === 'ai', isGhost, isGhost ? 0.65 : 1, isRobot || isAndroid ? 0.6 : 0, isRobot || isAndroid ? 0.3 : 0.8)}
      </Box>
      {(isRobot || isAndroid) && (
        <Box args={[torsoW * 0.5, torsoH * 0.4, torsoD + 0.01]} position={[0, 1.1, 0]}>{mkMat(out2 || '#00aaff', true, false, 1, 0.8, 0.1)}</Box>
      )}

      {/* Ceinture */}
      <Box args={[torsoW + 0.02, 0.12, torsoD + 0.02]} position={[0, 0.64, 0]}>{mkMat(out2 || '#111111')}</Box>

      {/* Bras */}
      <group ref={armLRef} position={[-(torsoW / 2 + armW / 2 + 0.04), 1.06, 0]}>
        <Box args={[armW, 0.78, armW * 1.1]} castShadow>{mkMat(out1, false, isGhost, isGhost ? 0.6 : 1, isRobot || isAndroid ? 0.5 : 0)}</Box>
        <Box args={[armW + 0.02, 0.22, armW + 0.02]} position={[0, -0.4, 0]}>{mkMat(skin)}</Box>
      </group>
      <group ref={armRRef} position={[torsoW / 2 + armW / 2 + 0.04, 1.06, 0]}>
        <Box args={[armW, 0.78, armW * 1.1]} castShadow>{mkMat(out1, false, isGhost, isGhost ? 0.6 : 1, isRobot || isAndroid ? 0.5 : 0)}</Box>
        <Box args={[armW + 0.02, 0.22, armW + 0.02]} position={[0, -0.4, 0]}>{mkMat(skin)}</Box>
      </group>

      {/* Cou */}
      <Box args={[0.2, 0.18, 0.2]} position={[0, 1.58, 0]}>{mkMat(skin)}</Box>

      {/* Tête */}
      <group ref={headRef}>
        <Box args={[headSize, 0.58, headSize * 0.95]} position={[0, 1.94, 0]} castShadow>
          {mkMat(skin, false, isGhost, isGhost ? 0.6 : 1)}
        </Box>
        <Box args={[headSize * 0.77, 0.28, 0.01]} position={[0, 1.94, headSize * 0.48 + 0.005]}>
          {mkMat(isAndroid ? '#002244' : cfg.race === 'demon' ? '#440000' : skinDark)}
        </Box>

        {/* Yeux */}
        <Box args={[0.1, 0.08, 0.03]} position={[0.12 * race.scaleX, 1.97, headSize * 0.5 - 0.01]}>{mkMat(eye, cfg.race === 'ai' || cfg.race === 'android', false, 1, 0, 0.1)}</Box>
        <Box args={[0.1, 0.08, 0.03]} position={[-0.12 * race.scaleX, 1.97, headSize * 0.5 - 0.01]}>{mkMat(eye, cfg.race === 'ai' || cfg.race === 'android', false, 1, 0, 0.1)}</Box>
        <Box args={[0.03, 0.04, 0.01]} position={[0.12 * race.scaleX, 1.97, headSize * 0.5 + 0.01]}>{mkMat('#000')}</Box>
        <Box args={[0.03, 0.04, 0.01]} position={[-0.12 * race.scaleX, 1.97, headSize * 0.5 + 0.01]}>{mkMat('#000')}</Box>

        {/* Sourcils */}
        <Box args={[0.11, 0.02, 0.02]} position={[0.12 * race.scaleX, 2.03, headSize * 0.5 - 0.005]}>{mkMat(hair)}</Box>
        <Box args={[0.11, 0.02, 0.02]} position={[-0.12 * race.scaleX, 2.03, headSize * 0.5 - 0.005]}>{mkMat(hair)}</Box>

        {/* Bouche */}
        <Box args={[0.16, 0.04, 0.02]} position={[0, 1.86, headSize * 0.5 - 0.005]}>{mkMat('#bb7755')}</Box>
      </group>

      {/* Coiffure - 16 styles */}
      {cfg.hairStyle !== 'Aucun' && cfg.hairStyle !== 'Rasé' && (
        <>
          {cfg.hairStyle === 'Mohawk' ? (
            <Box args={[0.1 * race.scaleX, 0.45, 0.5]} position={[0, 2.38, 0]}>{mkMat(hair)}</Box>
          ) : cfg.hairStyle === 'Long' ? (
            <>
              <Box args={[0.57 * race.scaleX, 0.12, 0.52]} position={[0, 2.27, 0]}>{mkMat(hair)}</Box>
              <Box args={[0.12, 0.6, 0.1]} position={[0.26 * race.scaleX, 1.9, -0.2]}>{mkMat(hair)}</Box>
              <Box args={[0.12, 0.6, 0.1]} position={[-0.26 * race.scaleX, 1.9, -0.2]}>{mkMat(hair)}</Box>
              <Box args={[0.52 * race.scaleX, 0.6, 0.08]} position={[0, 1.9, -0.28]}>{mkMat(hair)}</Box>
            </>
          ) : cfg.hairStyle === 'Tresses' ? (
            <>
              <Box args={[0.57 * race.scaleX, 0.12, 0.52]} position={[0, 2.27, 0]}>{mkMat(hair)}</Box>
              <Cylinder args={[0.07, 0.05, 0.7, 6]} position={[0.24 * race.scaleX, 1.75, 0]}>{mkMat(hair)}</Cylinder>
              <Cylinder args={[0.07, 0.05, 0.7, 6]} position={[-0.24 * race.scaleX, 1.75, 0]}>{mkMat(hair)}</Cylinder>
            </>
          ) : cfg.hairStyle === 'Bouclés' ? (
            <>
              <Box args={[0.62 * race.scaleX, 0.18, 0.58]} position={[0, 2.28, 0]}>{mkMat(hair)}</Box>
              <Box args={[0.62 * race.scaleX, 0.18, 0.1]} position={[0, 2.16, -0.2]}>{mkMat(hair)}</Box>
            </>
          ) : cfg.hairStyle === 'Punk' ? (
            <>
              <Box args={[0.58 * race.scaleX, 0.13, 0.53]} position={[0, 2.27, 0]}>{mkMat(hair)}</Box>
              <Cone args={[0.06, 0.3, 4]} position={[0, 2.55, 0]}>{mkMat(hair)}</Cone>
              <Cone args={[0.05, 0.22, 4]} position={[0.15, 2.48, 0]} rotation={[0, 0, -0.3]}>{mkMat(hair)}</Cone>
              <Cone args={[0.05, 0.22, 4]} position={[-0.15, 2.48, 0]} rotation={[0, 0, 0.3]}>{mkMat(hair)}</Cone>
            </>
          ) : cfg.hairStyle === 'Couettes' ? (
            <>
              <Box args={[0.58 * race.scaleX, 0.13, 0.53]} position={[0, 2.27, 0]}>{mkMat(hair)}</Box>
              <Sphere args={[0.15, 12, 12]} position={[0.35 * race.scaleX, 2.15, -0.1]}>{mkMat(hair)}</Sphere>
              <Sphere args={[0.15, 12, 12]} position={[-0.35 * race.scaleX, 2.15, -0.1]}>{mkMat(hair)}</Sphere>
            </>
          ) : cfg.hairStyle === 'Chignon' ? (
            <>
              <Box args={[0.58 * race.scaleX, 0.13, 0.53]} position={[0, 2.27, 0]}>{mkMat(hair)}</Box>
              <Sphere args={[0.18, 16, 16]} position={[0, 2.5, -0.2]}>{mkMat(hair)}</Sphere>
            </>
          ) : cfg.hairStyle === 'Dreadlocks' ? (
            <>
              <Box args={[0.6 * race.scaleX, 0.16, 0.55]} position={[0, 2.28, 0]}>{mkMat(hair)}</Box>
              {[0.28, 0.14, -0.14, -0.28].map((x, i) => (
                <Cylinder key={i} args={[0.03, 0.03, 0.7, 6]} position={[x * race.scaleX, 1.9, -0.15]}>{mkMat(hair)}</Cylinder>
              ))}
            </>
          ) : cfg.hairStyle === 'Carré' ? (
            <>
              <Box args={[0.6 * race.scaleX, 0.2, 0.55]} position={[0, 2.27, 0]}>{mkMat(hair)}</Box>
              <Box args={[0.6 * race.scaleX, 0.35, 0.06]} position={[0, 2.0, -0.28]}>{mkMat(hair)}</Box>
            </>
          ) : cfg.hairStyle === 'Frange' ? (
            <>
              <Box args={[0.58 * race.scaleX, 0.13, 0.53]} position={[0, 2.27, 0]}>{mkMat(hair)}</Box>
              <Box args={[0.58 * race.scaleX, 0.18, 0.06]} position={[0, 2.15, 0.24]}>{mkMat(hair)}</Box>
            </>
          ) : cfg.hairStyle === 'Queue de cheval' ? (
            <>
              <Box args={[0.58 * race.scaleX, 0.13, 0.53]} position={[0, 2.27, 0]}>{mkMat(hair)}</Box>
              <Cylinder args={[0.07, 0.05, 0.7, 8]} position={[0, 2.05, -0.3]} rotation={[0.3, 0, 0]}>{mkMat(hair)}</Cylinder>
            </>
          ) : cfg.hairStyle === 'Afro' ? (
            <Sphere args={[0.42, 24, 24]} position={[0, 2.4, 0]}>{mkMat(hair)}</Sphere>
          ) : cfg.hairStyle === 'Ondulé' ? (
            <>
              <Box args={[0.6 * race.scaleX, 0.15, 0.55]} position={[0, 2.28, 0]}>{mkMat(hair)}</Box>
              {[0.24, -0.24].map((x, i) => (
                <Cylinder key={i} args={[0.05, 0.05, 0.9, 8]} position={[x * race.scaleX, 1.85, -0.1]} rotation={[0.15, 0, 0]}>{mkMat(hair)}</Cylinder>
              ))}
            </>
          ) : (
            <Box args={[0.58 * race.scaleX, 0.13, 0.53]} position={[0, 2.27, 0]}>{mkMat(hair)}</Box>
          )}
        </>
      )}

      {/* Barbe */}
      {cfg.facialHair !== 'Aucun' && (
        <group position={[0, 1.78, headSize * 0.35]}>
          {cfg.facialHair === 'Moustache' && <Box args={[0.16, 0.04, 0.03]} position={[0, 0.05, 0]}>{mkMat(hair)}</Box>}
          {cfg.facialHair === 'Bouc' && <Box args={[0.1, 0.12, 0.06]} position={[0, -0.04, 0]}>{mkMat(hair)}</Box>}
          {cfg.facialHair === 'Barbe complète' && (
            <>
              <Box args={[headSize * 0.75, 0.2, 0.1]} position={[0, -0.08, 0]}>{mkMat(hair)}</Box>
              <Box args={[0.16, 0.04, 0.03]} position={[0, 0.05, 0]}>{mkMat(hair)}</Box>
            </>
          )}
        </group>
      )}

      {/* Traits de race */}
      {race.trait === 'horns' && (
        <>
          <Cylinder args={[0.04, 0.09, 0.4, 6]} position={[0.18 * race.scaleX, 2.5, 0]} rotation={[0, 0, 0.3]}>{mkMat(race.traitColor || '#660022')}</Cylinder>
          <Cylinder args={[0.04, 0.09, 0.4, 6]} position={[-0.18 * race.scaleX, 2.5, 0]} rotation={[0, 0, -0.3]}>{mkMat(race.traitColor || '#660022')}</Cylinder>
        </>
      )}
      {race.trait === 'catEars' && (
        <>
          <Cone args={[0.08, 0.2, 4]} position={[0.18 * race.scaleX, 2.3, 0]} rotation={[0, Math.PI / 4, 0]}>{mkMat(hair)}</Cone>
          <Cone args={[0.08, 0.2, 4]} position={[-0.18 * race.scaleX, 2.3, 0]} rotation={[0, Math.PI / 4, 0]}>{mkMat(hair)}</Cone>
        </>
      )}
      {race.trait === 'tusks' && (
        <>
          <Cone args={[0.02, 0.1, 4]} position={[0.09, 1.78, headSize * 0.4]} rotation={[Math.PI / 2, 0, 0]}>{mkMat('#ffffff')}</Cone>
          <Cone args={[0.02, 0.1, 4]} position={[-0.09, 1.78, headSize * 0.4]} rotation={[Math.PI / 2, 0, 0]}>{mkMat('#ffffff')}</Cone>
        </>
      )}
      {race.trait === 'ears' && (
        <>
          <Cone args={[0.05, 0.25, 4]} position={[0.32 * race.scaleX, 2.0, 0]} rotation={[0, 0, -0.3]}>{mkMat(skin)}</Cone>
          <Cone args={[0.05, 0.25, 4]} position={[-0.32 * race.scaleX, 2.0, 0]} rotation={[0, 0, 0.3]}>{mkMat(skin)}</Cone>
        </>
      )}
      {race.trait === 'ring' && (
        <Torus args={[0.38, 0.025, 8, 32]} position={[0, 2.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshPhysicalMaterial color={race.traitColor || eye} emissive={race.traitColor || eye} emissiveIntensity={2.5} toneMapped={false} />
        </Torus>
      )}
      {race.trait === 'visor' && (
        <Box args={[headSize * 0.8, 0.08, 0.02]} position={[0, 1.97, headSize * 0.5 + 0.01]}>
          <meshPhysicalMaterial color={race.traitColor || '#00aaff'} emissive={race.traitColor || '#00aaff'} emissiveIntensity={2} toneMapped={false} />
        </Box>
      )}
      {race.trait === 'halo' && (
        <Torus args={[0.35, 0.04, 8, 32]} position={[0, 2.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshPhysicalMaterial color={race.traitColor || '#ffe066'} emissive={race.traitColor || '#ffe066'} emissiveIntensity={2} metalness={1} roughness={0.1} toneMapped={false} />
        </Torus>
      )}

      {renderWings()}
      {renderTail()}
      {renderHalo()}
      {renderHat()}
      {renderGlasses()}
      {renderCape()}
      {renderEquipment()}

      {isGhost && <Sparkles count={30} scale={[1.2, 2, 1.2]} position={[0, 1.5, 0]} size={2} speed={0.3} color="#88ddff" />}
      {cfg.auraEnabled && <Sparkles count={40} scale={[1.5, 2.5, 1.5]} position={[0, 1, 0]} size={2.5} speed={0.5} color={cfg.auraColor} />}
    </group>
  );
}
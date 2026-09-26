// src/troxtmod3d/Scene.jsx
// ETHERWORLD RP — R3F Scene (IBL + PostFX + Platform + Particles)

import React from 'react';
import { Environment, ContactShadows, Sparkles, Stars, Grid } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, SMAA, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Character3D } from './Character3D';
import { EngineIntegrator } from './tabs/EngineIntegrator';

export function Scene({ cfg, groupRef, auraId, animMode }) {
  const accent = cfg.auraColor || cfg.outfitColor || '#aa55ff';

  return (
    <>
      <Environment preset="city" />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-5, 3, -3]} intensity={0.4} color="#4488ff" />
      <directionalLight position={[2, 5, -6]} intensity={0.8} color="#00d4ff" />
      <pointLight position={[0, 3, 2]} intensity={0.6} color="#aa55ff" />

      {/* Platform */}
      <mesh position={[0, -1.05, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3, 96]} />
        <meshPhysicalMaterial color="#0a0e1a" roughness={0.15} metalness={0.85} clearcoat={0.9} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[0, -1.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.3, 2.7, 96]} />
        <meshPhysicalMaterial color={accent} emissive={accent} emissiveIntensity={1.2} toneMapped={false} transparent opacity={0.8} />
      </mesh>

      <Grid
        args={[12, 12]} position={[0, -1.03, 0]}
        cellSize={0.5} cellThickness={0.5} cellColor={accent}
        sectionSize={2} sectionThickness={1} sectionColor={accent}
        fadeDistance={8} fadeStrength={1} infiniteGrid
      />

      {/* Personnage + Moteurs */}
      <group ref={groupRef}>
        <Character3D cfg={cfg} />
        <EngineIntegrator groupRef={groupRef} auraId={auraId} animMode={animMode} />
      </group>

      <ContactShadows position={[0, -1.04, 0]} opacity={0.7} scale={4} blur={2.5} far={2} color="#000000" />
      <Stars radius={30} depth={40} count={1500} factor={3} saturation={0.6} fade speed={0.8} />
      <Sparkles count={80} scale={[8, 6, 8]} position={[0, 2, 0]} size={2} speed={0.4} opacity={0.5} color="#7dd3fc" />

      <EffectComposer>
        <Bloom intensity={0.5} luminanceThreshold={0.85} luminanceSmoothing={0.9} mipmapBlur />
        <ChromaticAberration offset={[0.0008, 0.0008]} blendFunction={BlendFunction.NORMAL} />
        <Vignette eskil={false} offset={0.25} darkness={0.7} />
        <SMAA />
      </EffectComposer>
    </>
  );
}
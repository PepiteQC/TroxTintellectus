// client/src/game/hotel/HotelBuilding.jsx
// 🎮 Composant React Three Fiber — Bâtiment d'hôtel procédural complet
'use client'

import { useRef, useMemo, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ════════════════════════════════════════════════════════════════════════════

const FLOORS = 4
const FLOOR_H = 3.6
const BLDG_W = 20
const BLDG_D = 12
const BLDG_TOTAL_H = FLOORS * FLOOR_H
const LOBBY_DEPTH = 10
const LOBBY_WIDTH = 18
const LOBBY_HEIGHT = FLOOR_H

// ════════════════════════════════════════════════════════════════════════════
// TEXTURES PROCÉDURALES
// ════════════════════════════════════════════════════════════════════════════

function createCanvasTexture(w, h, draw, repeat) {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  draw(ctx, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping
  if (repeat) tex.repeat.set(repeat[0], repeat[1])
  tex.needsUpdate = true
  return tex
}

function useBuildingTexture() {
  return useMemo(() => createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2d313a'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 2000; i++) {
      const s = 40 + Math.random() * 12
      ctx.fillStyle = `rgba(${s},${s + 2},${s + 6},0.04)`
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
    for (let y = 0; y < h; y += 64) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.fillRect(0, y, w, 1.5)
    }
  }, [2, FLOORS]), [])
}

function useLobbyFloorTexture() {
  return useMemo(() => createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d4c8b0'
    ctx.fillRect(0, 0, w, h)
    const ts = w / 4
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = c * ts, y = r * ts
      const shade = 195 + Math.random() * 20
      ctx.fillStyle = `rgb(${shade},${shade - 5},${shade - 12})`
      ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2)
      ctx.strokeStyle = 'rgba(160,140,110,0.2)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x, y, ts, ts)
    }
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `rgba(180,165,140,0.1)`
      ctx.lineWidth = 0.8
      ctx.beginPath()
      let x = Math.random() * w, y = Math.random() * h
      ctx.moveTo(x, y)
      for (let j = 0; j < 4; j++) {
        x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60
        ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, x, y)
      }
      ctx.stroke()
    }
  }, [4, 3]), [])
}

function useWallTexture() {
  return useMemo(() => createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8e2d8'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 1000; i++) {
      const s = 220 + Math.random() * 15
      ctx.fillStyle = `rgba(${s},${s - 3},${s - 8},0.03)`
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
  }, [2, 2]), [])
}

function useWindowTexture() {
  return useMemo(() => createCanvasTexture(64, 96, (ctx, w, h) => {
    ctx.fillStyle = '#2a2a3e'
    ctx.fillRect(0, 0, w, h)
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#1a3050'); grad.addColorStop(0.5, '#1e3a5f'); grad.addColorStop(1, '#152a45')
    ctx.fillStyle = grad
    ctx.fillRect(3, 3, w - 6, h - 6)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(4, 4, w * 0.4, h * 0.5)
    ctx.fillStyle = '#2a2a3e'
    ctx.fillRect(w / 2 - 1, 3, 2, h - 6)
    ctx.fillRect(3, h / 2 - 1, w - 6, 2)
  }), [])
}

function useParkingTexture() {
  return useMemo(() => createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#22242a'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 3000; i++) {
      const s = 28 + Math.random() * 15
      ctx.fillStyle = `rgb(${s},${s},${s + 2})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2)
    }
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.8
      ctx.beginPath()
      let x = Math.random() * w, y = Math.random() * h
      ctx.moveTo(x, y)
      for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; ctx.lineTo(x, y) }
      ctx.stroke()
    }
  }, [4, 4]), [])
}

// ════════════════════════════════════════════════════════════════════════════
// ENSEIGNE HÔTEL
// ════════════════════════════════════════════════════════════════════════════

const HotelSign = memo(function HotelSign({ position }) {
  const glowRef = useRef(null)

  useFrame((state) => {
    if (glowRef.current) {
      const mat = glowRef.current.material
      mat.emissiveIntensity = 0.25 + Math.sin(state.clock.elapsedTime * 1.5) * 0.08
    }
  })

  return (
    <group position={position}>
      <mesh position={[0, -0.6, 0]} castShadow>
        <boxGeometry args={[5.5, 0.1, 0.8]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      {[-2.2, 2.2].map((x, i) => (
        <mesh key={i} position={[x, -1.2, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.2, 4]} />
          <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      <mesh castShadow>
        <boxGeometry args={[5.8, 1.6, 0.2]} />
        <meshStandardMaterial color="#0f1419" roughness={0.6} metalness={0.2} />
      </mesh>

      <mesh position={[0, 0, 0.105]}>
        <boxGeometry args={[5.6, 1.4, 0.005]} />
        <meshStandardMaterial color="#8b6914" roughness={0.2} metalness={0.6} />
      </mesh>

      <mesh ref={glowRef} position={[0, 0.1, 0.11]}>
        <boxGeometry args={[5.2, 0.9, 0.01]} />
        <meshStandardMaterial color="#1a0a05" emissive="#ff4422" emissiveIntensity={0.25} />
      </mesh>

      <Text position={[0, 0.15, 0.13]} fontSize={0.55} color="#ff6633" anchorX="center" anchorY="middle" fontWeight="bold">
        HÔTEL ETHERWORLD
      </Text>
      <Text position={[0, -0.3, 0.13]} fontSize={0.18} color="#fef3c7" anchorX="center" anchorY="middle">
        ★ ★ ★ ★ ★
      </Text>

      <pointLight position={[0, 0.5, 1.5]} color="#ff3322" intensity={0.6} distance={12} decay={2} />
      <spotLight position={[0, 1, 0.5]} angle={Math.PI / 4} penumbra={0.5} intensity={0.5} color="#ff6644" distance={8} />
    </group>
  )
})

// ════════════════════════════════════════════════════════════════════════════
// ANTENNE
// ════════════════════════════════════════════════════════════════════════════

const Antenna = memo(function Antenna({ position }) {
  const ledRef = useRef(null)

  useFrame((state) => {
    if (ledRef.current) {
      const mat = ledRef.current.material
      mat.emissiveIntensity = Math.sin(state.clock.elapsedTime * 3) > 0.8 ? 1.5 : 0.1
    }
  })

  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.08, 4.2, 6]} />
        <meshStandardMaterial color="#2d3436" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -1.8, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#333" metalness={0.5} roughness={0.5} />
      </mesh>
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 0]} rotation={[0, 0, i === 0 ? 0.3 : -0.3]}>
          <cylinderGeometry args={[0.015, 0.015, 1, 4]} />
          <meshStandardMaterial color="#444" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh ref={ledRef} position={[0, 2.1, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={0.1} />
      </mesh>
      <pointLight position={[0, 2.1, 0]} color="#ff0000" intensity={0.3} distance={8} decay={2} />
    </group>
  )
})

// ════════════════════════════════════════════════════════════════════════════
// FENÊTRES EXTÉRIEURES
// ════════════════════════════════════════════════════════════════════════════

const ExteriorWindows = memo(function ExteriorWindows() {
  const winTex = useWindowTexture()

  const windowArray = useMemo(() => {
    const arr = []
    const glows = ['#ffd97d', '#ffecb3', '#ffe0b2', '#80deea', '#ffe0b2', '#ffcc80', '#b2dfdb']
    let gi = 0

    for (let floor = 1; floor < FLOORS; floor++) {
      for (const x of [-8, -5, -2, 2, 5, 8]) {
        const isOff = Math.sin(floor * 7 + x * 13) * 0.5 + 0.5 > 0.6
        arr.push({ floor, x, glowColor: glows[gi % glows.length], isOff, side: 'front' })
        gi++
      }
      for (const x of [-7, -3, 1, 5]) {
        arr.push({ floor, x, glowColor: glows[gi % glows.length], isOff: Math.random() > 0.5, side: 'back' })
        gi++
      }
      for (const z of [-3, 1, 4]) {
        arr.push({ floor, x: 0, glowColor: glows[gi % glows.length], isOff: Math.random() > 0.4, side: 'left' })
        arr.push({ floor, x: 0, glowColor: glows[gi % glows.length], isOff: Math.random() > 0.4, side: 'right' })
        gi++
      }
    }
    return arr
  }, [])

  return (
    <group>
      {windowArray.map((w, idx) => {
        const y = w.floor * FLOOR_H + FLOOR_H / 2
        let px = w.x, py = y, pz = 0, rx = 0, ry = 0, rz = 0

        if (w.side === 'front') { pz = BLDG_D / 2 + 0.02 }
        else if (w.side === 'back') { pz = -BLDG_D / 2 - 0.02 }
        else if (w.side === 'left') { px = -BLDG_W / 2 - 0.02; pz = w.x * 2; ry = Math.PI / 2 }
        else { px = BLDG_W / 2 + 0.02; pz = w.x * 2; ry = -Math.PI / 2 }

        return (
          <group key={idx} position={[px, py, pz]} rotation={[rx, ry, rz]}>
            <mesh>
              <boxGeometry args={[1.95, 1.95, 0.04]} />
              <meshStandardMaterial color="#1e272e" roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.025]}>
              <boxGeometry args={[1.8, 1.8, 0.02]} />
              <meshStandardMaterial
                map={winTex}
                color={w.isOff ? '#0a0e14' : w.glowColor}
                emissive={w.isOff ? '#000000' : w.glowColor}
                emissiveIntensity={w.isOff ? 0 : 0.5}
                transparent opacity={0.8}
                metalness={w.isOff ? 0.8 : 0.15}
                roughness={0.1}
              />
            </mesh>
            <mesh position={[0, -1.02, 0.06]}>
              <boxGeometry args={[2.05, 0.06, 0.12]} />
              <meshStandardMaterial color="#3a3a4a" roughness={0.5} metalness={0.2} />
            </mesh>
            {!w.isOff && w.side === 'front' && (
              <pointLight position={[0, 0, 0.5]} color={w.glowColor} intensity={0.3} distance={4} decay={2} />
            )}
          </group>
        )
      })}
    </group>
  )
})

// ════════════════════════════════════════════════════════════════════════════
// BALCONS
// ════════════════════════════════════════════════════════════════════════════

const Balconies = memo(function Balconies() {
  return (
    <group>
      {[1, 2, 3].map((floor) =>
        [-6.5, 0, 6.5].map((x, idx) => (
          <group key={`${floor}-${idx}`} position={[x, floor * FLOOR_H + 0.1, BLDG_D / 2]}>
            <mesh position={[0, 0, 1.2]} castShadow receiveShadow>
              <boxGeometry args={[3.2, 0.12, 2.4]} />
              <meshStandardMaterial color="#3a3d44" roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.08, 1.2]}>
              <boxGeometry args={[3.15, 0.04, 2.35]} />
              <meshStandardMaterial color="#2a2d34" roughness={0.9} />
            </mesh>

            <mesh position={[0, 0.5, 2.38]} castShadow>
              <boxGeometry args={[3.2, 0.04, 0.04]} />
              <meshStandardMaterial color="#1e272e" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.25, 2.38]}>
              <boxGeometry args={[3.2, 0.02, 0.02]} />
              <meshStandardMaterial color="#2a2e36" metalness={0.6} roughness={0.3} />
            </mesh>
            {Array.from({ length: 8 }).map((_, bi) => (
              <mesh key={bi} position={[-1.4 + bi * 0.4, 0.3, 2.38]}>
                <boxGeometry args={[0.015, 0.5, 0.015]} />
                <meshStandardMaterial color="#2a2e36" metalness={0.6} roughness={0.3} />
              </mesh>
            ))}

            <mesh position={[0, 0.53, 2.38]}>
              <boxGeometry args={[3.25, 0.03, 0.06]} />
              <meshStandardMaterial color="#ff8800" emissive="#ff5500" emissiveIntensity={0.3} roughness={0.2} metalness={0.3} />
            </mesh>

            {[-1.58, 1.58].map((bx, sideIdx) => (
              <mesh key={sideIdx} position={[bx, 0.3, 1.2]}>
                <boxGeometry args={[0.04, 0.6, 2.35]} />
                <meshStandardMaterial color="#1e272e" metalness={0.6} roughness={0.4} />
              </mesh>
            ))}

            {idx === 1 && floor === 2 && (
              <>
                <mesh position={[-0.5, 0.3, 1.5]} castShadow>
                  <boxGeometry args={[0.4, 0.04, 0.4]} />
                  <meshStandardMaterial color="#6b4423" roughness={0.7} />
                </mesh>
                <mesh position={[0.6, 0.25, 1.6]} castShadow>
                  <cylinderGeometry args={[0.12, 0.14, 0.2, 6]} />
                  <meshStandardMaterial color="#5a4a3a" roughness={0.8} />
                </mesh>
                <mesh position={[0.6, 0.45, 1.6]}>
                  <sphereGeometry args={[0.18, 6, 6]} />
                  <meshStandardMaterial color="#2d6a1e" roughness={0.85} />
                </mesh>
              </>
            )}
          </group>
        ))
      )}
    </group>
  )
})

// ════════════════════════════════════════════════════════════════════════════
// LOBBY INTÉRIEUR
// ════════════════════════════════════════════════════════════════════════════

const LobbyInterior = memo(function LobbyInterior() {
  const floorTex = useLobbyFloorTexture()
  const wallTex = useWallTexture()

  return (
    <group position={[0, 0, BLDG_D / 2]}>
      <mesh position={[0, 0.01, LOBBY_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[LOBBY_WIDTH, LOBBY_DEPTH]} />
        <meshStandardMaterial map={floorTex} color="#d4c8b0" roughness={0.2} metalness={0.2} />
      </mesh>

      <mesh position={[0, 0.015, LOBBY_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2, 16]} />
        <meshStandardMaterial color="#b8a888" roughness={0.15} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.016, LOBBY_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.8, 2, 16]} />
        <meshStandardMaterial color="#8b6914" roughness={0.2} metalness={0.6} />
      </mesh>

      <mesh position={[0, LOBBY_HEIGHT, LOBBY_DEPTH / 2]}>
        <boxGeometry args={[LOBBY_WIDTH, 0.1, LOBBY_DEPTH]} />
        <meshStandardMaterial color="#1a1a2a" roughness={0.9} />
      </mesh>

      <mesh position={[-LOBBY_WIDTH / 2, LOBBY_HEIGHT / 2, LOBBY_DEPTH / 2]}>
        <boxGeometry args={[0.15, LOBBY_HEIGHT, LOBBY_DEPTH]} />
        <meshStandardMaterial map={wallTex} color="#e8e2d8" roughness={0.8} />
      </mesh>
      <mesh position={[LOBBY_WIDTH / 2, LOBBY_HEIGHT / 2, LOBBY_DEPTH / 2]}>
        <boxGeometry args={[0.15, LOBBY_HEIGHT, LOBBY_DEPTH]} />
        <meshStandardMaterial map={wallTex} color="#e8e2d8" roughness={0.8} />
      </mesh>
      <mesh position={[0, LOBBY_HEIGHT / 2, 0]}>
        <boxGeometry args={[LOBBY_WIDTH, LOBBY_HEIGHT, 0.15]} />
        <meshStandardMaterial map={wallTex} color="#e0dcd4" roughness={0.85} />
      </mesh>

      {[-6, -2, 2, 6].map((x, i) => (
        <group key={`col-${i}`} position={[x, 0, LOBBY_DEPTH / 2]}>
          <mesh position={[0, 0.15, 0]} castShadow>
            <boxGeometry args={[0.5, 0.3, 0.5]} />
            <meshStandardMaterial color="#d4c8b0" roughness={0.35} metalness={0.15} />
          </mesh>
          <mesh position={[0, LOBBY_HEIGHT / 2, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.2, LOBBY_HEIGHT - 0.5, 8]} />
            <meshStandardMaterial color="#d4c8b0" roughness={0.4} metalness={0.1} />
          </mesh>
          <mesh position={[0, LOBBY_HEIGHT - 0.15, 0]}>
            <boxGeometry args={[0.5, 0.15, 0.5]} />
            <meshStandardMaterial color="#d4c8b0" roughness={0.35} metalness={0.15} />
          </mesh>
        </group>
      ))}

      <group position={[0, 0, 2]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[5, 1, 1]} />
          <meshStandardMaterial color="#2a1a0e" roughness={0.5} metalness={0.08} />
        </mesh>
        <mesh position={[0, 1.02, 0]} castShadow>
          <boxGeometry args={[5.1, 0.04, 1.1]} />
          <meshStandardMaterial color="#d4c8b0" roughness={0.15} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0.5, 0.51]}>
          <boxGeometry args={[5, 0.95, 0.02]} />
          <meshStandardMaterial color="#1a1020" roughness={0.55} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.98, 0.52]}>
          <boxGeometry args={[5.05, 0.025, 0.01]} />
          <meshStandardMaterial color="#8b6914" roughness={0.2} metalness={0.6} />
        </mesh>

        {[-1.5, 1.5].map((x, i) => (
          <group key={`pc-${i}`} position={[x, 1.3, 0]}>
            <mesh><boxGeometry args={[0.55, 0.4, 0.03]} /><meshStandardMaterial color="#1a1a2e" roughness={0.4} metalness={0.3} /></mesh>
            <mesh position={[0, 0, 0.018]}><boxGeometry args={[0.48, 0.33, 0.005]} /><meshStandardMaterial color="#0a1628" emissive="#3b82f6" emissiveIntensity={0.3} /></mesh>
            <mesh position={[0, -0.28, 0.08]}><boxGeometry args={[0.05, 0.12, 0.05]} /><meshStandardMaterial color="#374151" metalness={0.5} roughness={0.4} /></mesh>
          </group>
        ))}

        <mesh position={[0, 1.08, 0.3]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 0.05, 12]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
        </mesh>

        <mesh position={[0, 1.6, 0.4]}>
          <boxGeometry args={[1.2, 0.3, 0.04]} />
          <meshStandardMaterial color="#1a1020" roughness={0.5} metalness={0.2} />
        </mesh>
        <Text position={[0, 1.6, 0.44]} fontSize={0.1} color="#fef3c7" anchorX="center" anchorY="middle">
          RÉCEPTION
        </Text>
      </group>

      <group position={[6, 0, 6]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[2.2, 0.18, 0.8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.45, -0.3]} castShadow>
          <boxGeometry args={[2.2, 0.4, 0.1]} />
          <meshStandardMaterial color="#1e293b" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.22, 1]}>
          <boxGeometry args={[1, 0.04, 0.5]} />
          <meshStandardMaterial color="#2a1a0e" roughness={0.4} metalness={0.1} />
        </mesh>
      </group>

      {[[-8, 3], [8, 3], [-8, 8], [8, 8]].map(([x, z], i) => (
        <group key={`plant-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.3, 0.4, 8]} />
            <meshStandardMaterial color="#4a4050" roughness={0.5} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.6, 0]} castShadow>
            <sphereGeometry args={[0.4, 6, 6]} />
            <meshStandardMaterial color="#2d6a1e" roughness={0.85} />
          </mesh>
        </group>
      ))}

      <group position={[0, LOBBY_HEIGHT - 0.2, LOBBY_DEPTH / 2]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 0.04, 12]} />
          <meshStandardMaterial color="#8b6914" metalness={0.85} roughness={0.12} />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <group key={i} rotation={[0, a, 0]}>
              <mesh position={[0.4, -0.15, 0]}>
                <coneGeometry args={[0.06, 0.1, 6]} />
                <meshStandardMaterial color="#fef3c7" emissive="#fef3c7" emissiveIntensity={0.4} />
              </mesh>
            </group>
          )
        })}
        <pointLight position={[0, -0.2, 0]} intensity={1.2} color="#fef3c7" distance={8} decay={2} castShadow />
      </group>

      <ambientLight intensity={0.2} color="#fef3c7" />
      <pointLight position={[-5, 2.5, 5]} intensity={0.5} color="#fef3c7" distance={8} decay={2} />
      <pointLight position={[5, 2.5, 5]} intensity={0.5} color="#fef3c7" distance={8} decay={2} />
    </group>
  )
})

// ════════════════════════════════════════════════════════════════════════════
// PORTES D'ENTRÉE
// ════════════════════════════════════════════════════════════════════════════

const EntranceDoors = memo(function EntranceDoors() {
  return (
    <group position={[0, 0, BLDG_D / 2]}>
      <mesh position={[0, FLOOR_H - 0.3, 3]} castShadow>
        <boxGeometry args={[8, 0.12, 6]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, FLOOR_H - 0.38, 3]}>
        <boxGeometry args={[7.5, 0.02, 5.5]} />
        <meshStandardMaterial color="#fff8e0" emissive="#fff8e0" emissiveIntensity={0.15} />
      </mesh>

      {[-3.5, 3.5].map((x, i) => (
        <mesh key={i} position={[x, FLOOR_H / 2 - 0.2, 5.5]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, FLOOR_H - 0.4, 8]} />
          <meshStandardMaterial color="#8a8a9a" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      <mesh position={[0, FLOOR_H / 2, 0.02]}>
        <boxGeometry args={[LOBBY_WIDTH - 2, FLOOR_H - 0.5, 0.04]} />
        <meshPhysicalMaterial color="#88aacc" transmission={0.75} thickness={0.02} roughness={0.05} transparent opacity={0.3} metalness={0.6} />
      </mesh>

      {[-9, -6, -3, 0, 3, 6, 9].map((x, i) => (
        <mesh key={`frame-v-${i}`} position={[x, FLOOR_H / 2, 0.04]}>
          <boxGeometry args={[0.08, FLOOR_H - 0.3, 0.06]} />
          <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, FLOOR_H - 0.2, 0.04]}>
        <boxGeometry args={[LOBBY_WIDTH - 1, 0.08, 0.06]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.4} />
      </mesh>

      {[-1.3, 1.3].map((x, i) => (
        <group key={`door-${i}`}>
          <mesh position={[x, FLOOR_H / 2 - 0.3, 0.06]}>
            <boxGeometry args={[2.2, FLOOR_H - 0.8, 0.05]} />
            <meshPhysicalMaterial color="#6366f1" transmission={0.85} thickness={0.03} roughness={0.05} transparent opacity={0.2} metalness={0.8} ior={1.5} />
          </mesh>
          <mesh position={[x, FLOOR_H / 2 - 0.3, 0.065]}>
            <boxGeometry args={[2.25, FLOOR_H - 0.75, 0.015]} />
            <meshStandardMaterial color="#2a2a3e" metalness={0.5} roughness={0.3} transparent opacity={0.3} />
          </mesh>
          <mesh position={[x + (i === 0 ? 0.9 : -0.9), FLOOR_H / 2 - 0.5, 0.12]}>
            <boxGeometry args={[0.025, 0.45, 0.035]} />
            <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, FLOOR_H / 2 - 0.3, 0.065]}>
        <boxGeometry args={[0.1, FLOOR_H - 0.7, 0.06]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.4} />
      </mesh>

      <mesh position={[0, FLOOR_H - 0.5, 0.15]}>
        <boxGeometry args={[0.3, 0.06, 0.08]} />
        <meshStandardMaterial color="#222" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, FLOOR_H - 0.52, 0.2]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
      </mesh>

      <mesh position={[0, 0.01, 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 2]} />
        <meshStandardMaterial color="#1a1010" roughness={0.95} />
      </mesh>

      {[0, 1, 2].map((step) => (
        <mesh key={step} position={[0, 0.06 + step * 0.06, 4.5 + step * 0.35]} castShadow>
          <boxGeometry args={[6, 0.06, 0.35]} />
          <meshStandardMaterial color="#8a8078" roughness={0.6} metalness={0.1} />
        </mesh>
      ))}

      {[-4.5, 4.5].map((x, i) => (
        <group key={i} position={[x, 0, 4]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.35, 0.6, 8]} />
            <meshStandardMaterial color="#5a5a6a" roughness={0.5} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.03, 8]} />
            <meshStandardMaterial color="#8b6914" roughness={0.2} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.8, 0]} castShadow>
            <sphereGeometry args={[0.5, 6, 6]} />
            <meshStandardMaterial color="#2d6a1e" roughness={0.85} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, FLOOR_H - 0.3, 0.15]}>
        <boxGeometry args={[1.2, 0.35, 0.06]} />
        <meshStandardMaterial color="#0f1419" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, FLOOR_H - 0.3, 0.19]}>
        <boxGeometry args={[1.1, 0.25, 0.005]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.4} />
      </mesh>

      <spotLight position={[0, FLOOR_H - 0.5, 3]} angle={Math.PI / 3} penumbra={0.8} intensity={1.5} color="#fff8e0" castShadow shadow-mapSize={[512, 512]} />
      {[-3, 3].map((x, i) => (
        <pointLight key={i} position={[x, 2.5, 3]} intensity={0.4} color="#fef3c7" distance={6} decay={2} />
      ))}
    </group>
  )
})

// ════════════════════════════════════════════════════════════════════════════
// VOITURES STATIONNÉES
// ════════════════════════════════════════════════════════════════════════════

const ParkedCars = memo(function ParkedCars() {
  const cars = useMemo(() => [
    { x: -7, z: 12, ry: 0, color: '#1b2a4a' },
    { x: -3.5, z: 12.5, ry: 0.06, color: '#a51c1c' },
    { x: 3.5, z: 12, ry: 0, color: '#2d3436' },
    { x: 7, z: 13, ry: -0.05, color: '#f39c12' },
    { x: -7, z: 17, ry: 0.02, color: '#1a5c2a' },
    { x: 3, z: 17.5, ry: -0.03, color: '#4a4a5a' },
  ], [])

  return (
    <group>
      {cars.map((c, idx) => (
        <group key={idx} position={[c.x, 0, c.z]} rotation={[0, c.ry, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[1.8, 0.65, 4.0]} />
            <meshStandardMaterial color={c.color} roughness={0.35} metalness={0.25} />
          </mesh>
          <mesh position={[0, 0.92, -0.15]} castShadow>
            <boxGeometry args={[1.6, 0.45, 2.2]} />
            <meshStandardMaterial color={c.color} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.88, 0.85]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[1.45, 0.5, 0.03]} />
            <meshStandardMaterial color="#1a2a3a" transparent opacity={0.5} metalness={0.8} roughness={0.05} />
          </mesh>
          <mesh position={[0, 0.88, -1.15]} rotation={[-0.3, 0, 0]}>
            <boxGeometry args={[1.4, 0.4, 0.03]} />
            <meshStandardMaterial color="#1a2a3a" transparent opacity={0.5} metalness={0.8} roughness={0.05} />
          </mesh>
          {[-0.7, 0.7].map((x, hi) => (
            <mesh key={hi} position={[x, 0.45, 2.02]}>
              <boxGeometry args={[0.3, 0.12, 0.02]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.05} roughness={0.1} metalness={0.5} />
            </mesh>
          ))}
          {[-0.7, 0.7].map((x, hi) => (
            <mesh key={`tail-${hi}`} position={[x, 0.45, -2.02]}>
              <boxGeometry args={[0.25, 0.1, 0.02]} />
              <meshStandardMaterial color="#cc2222" emissive="#cc2222" emissiveIntensity={0.05} />
            </mesh>
          ))}
          {[[-0.92, 0.28, 1.15], [0.92, 0.28, 1.15], [-0.92, 0.28, -1.15], [0.92, 0.28, -1.15]].map((wp, wIdx) => (
            <group key={wIdx} position={wp}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.28, 0.28, 0.18, 8]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.14, 0.14, 0.19, 6]} />
                <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          ))}
          {[-0.95, 0.95].map((x, mi) => (
            <mesh key={`mirror-${mi}`} position={[x, 0.85, 0.6]}>
              <boxGeometry args={[0.12, 0.08, 0.06]} />
              <meshStandardMaterial color={c.color} roughness={0.35} metalness={0.25} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
})

// ════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — HotelBuilding
// ════════════════════════════════════════════════════════════════════════════

export function HotelBuilding({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) {
  const buildingTex = useBuildingTexture()
  const parkingTex = useParkingTexture()

  return (
    <group position={position} rotation={rotation}>
      <group>
        <mesh position={[0, BLDG_TOTAL_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[BLDG_W, BLDG_TOTAL_H, BLDG_D]} />
          <meshStandardMaterial map={buildingTex} color="#2d313a" roughness={0.88} />
        </mesh>

        {Array.from({ length: FLOORS + 1 }).map((_, fIdx) => (
          <mesh key={`floor-band-${fIdx}`} position={[0, fIdx * FLOOR_H, 0]} castShadow>
            <boxGeometry args={[BLDG_W + 0.4, 0.2, BLDG_D + 0.4]} />
            <meshStandardMaterial color="#1e2024" roughness={0.85} metalness={0.1} />
          </mesh>
        ))}

        {[-BLDG_W / 2 - 0.1, BLDG_W / 2 + 0.1].map((x, idx) => (
          <mesh key={idx} position={[x, BLDG_TOTAL_H / 2, 0]} castShadow>
            <boxGeometry args={[0.3, BLDG_TOTAL_H + 0.5, BLDG_D + 0.1]} />
            <meshStandardMaterial color="#8b251e" roughness={0.75} metalness={0.1} />
          </mesh>
        ))}

        <mesh position={[0, BLDG_TOTAL_H + 0.15, 0]} castShadow>
          <boxGeometry args={[BLDG_W + 0.8, 0.3, BLDG_D + 0.8]} />
          <meshStandardMaterial color="#111216" roughness={0.8} metalness={0.15} />
        </mesh>
        <mesh position={[0, BLDG_TOTAL_H + 0.32, 0]}>
          <boxGeometry args={[BLDG_W + 0.6, 0.04, BLDG_D + 0.6]} />
          <meshStandardMaterial color="#8b6914" roughness={0.2} metalness={0.6} />
        </mesh>

        {[[-BLDG_W / 2 - 0.2, 0, BLDG_W + 0.4, 0.1], [BLDG_W / 2 + 0.2, 0, 0.1, BLDG_D], [0, -BLDG_D / 2 - 0.2, BLDG_W + 0.4, 0.1], [0, BLDG_D / 2 + 0.2, BLDG_W + 0.4, 0.1]].map(([x, z, w, d], i) => (
          <mesh key={`roof-rail-${i}`} position={[x, BLDG_TOTAL_H + 0.6, z]}>
            <boxGeometry args={[i < 2 ? 0.08 : w, 0.5, i < 2 ? d : 0.08]} />
            <meshStandardMaterial color="#333" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}

        {[-6, 0, 6].map((x, i) => (
          <group key={`ac-${i}`} position={[x, BLDG_TOTAL_H + 0.7, -3]}>
            <mesh castShadow>
              <boxGeometry args={[3, 1.2, 2.2]} />
              <meshStandardMaterial color="#555" metalness={0.4} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 0.12, 10]} />
              <meshStandardMaterial color="#444" metalness={0.5} roughness={0.5} />
            </mesh>
          </group>
        ))}

        <Antenna position={[8, BLDG_TOTAL_H + 2.1, -2]} />
        <HotelSign position={[0, BLDG_TOTAL_H + 1.5, BLDG_D / 2 + 0.2]} />
        <ExteriorWindows />
        <Balconies />
      </group>

      <LobbyInterior />
      <EntranceDoors />

      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, BLDG_D / 2 + 14]} receiveShadow>
          <planeGeometry args={[28, 18]} />
          <meshStandardMaterial map={parkingTex} color="#22242a" roughness={0.88} />
        </mesh>

        {[-9, -5.5, -2, 2, 5.5, 9].map((x, idx) => (
          <mesh key={idx} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, BLDG_D / 2 + 11]}>
            <planeGeometry args={[0.08, 5]} />
            <meshStandardMaterial color="#ffbb00" transparent opacity={0.5} />
          </mesh>
        ))}

        {[-7.25, -3.75, -0.25, 3.75].map((x, i) => (
          <Text key={i} position={[x, 0.025, BLDG_D / 2 + 9]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.4} color="rgba(255,255,255,0.15)">
            {`P${i + 1}`}
          </Text>
        ))}

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-11, 0.015, BLDG_D / 2 + 11]}>
          <planeGeometry args={[3.5, 5]} />
          <meshStandardMaterial color="#2244aa" transparent opacity={0.15} roughness={0.9} />
        </mesh>

        {[-9, -5.5, -2, 2, 5.5, 9].map((x, i) => (
          <mesh key={`bumper-${i}`} position={[x + 1.75, 0.06, BLDG_D / 2 + 8.5]} castShadow>
            <boxGeometry args={[2, 0.08, 0.1]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.6} />
          </mesh>
        ))}

        {[-10, 10].map((x, idx) => (
          <group key={idx} position={[x, 0, BLDG_D / 2 + 19]}>
            <mesh position={[0, 3.5, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.08, 7, 6]} />
              <meshStandardMaterial color="#2d3436" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <boxGeometry args={[0.3, 0.08, 0.3]} />
              <meshStandardMaterial color="#444" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0, 7.1, -0.4]} rotation={[0.1, 0, 0]}>
              <boxGeometry args={[0.3, 0.15, 1.2]} />
              <meshStandardMaterial color="#222" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, 7.0, -0.4]}>
              <boxGeometry args={[0.26, 0.02, 0.9]} />
              <meshStandardMaterial color="#fff6e0" emissive="#fff6e0" emissiveIntensity={0.4} />
            </mesh>
            <pointLight position={[0, 6.8, -0.4]} color="#fff0d0" intensity={0.5} distance={15} decay={2} />
          </group>
        ))}

        {[-13, -12, 12, 13].map((x, i) => (
          <group key={`bollard-${i}`} position={[x, 0, BLDG_D / 2 + 6]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
              <meshStandardMaterial color="#fbbf24" roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.065, 0.065, 0.06, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.5} />
            </mesh>
          </group>
        ))}

        <ParkedCars />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, BLDG_D / 2 + 3]} receiveShadow>
          <planeGeometry args={[12, 6]} />
          <meshStandardMaterial color="#8a8a9a" roughness={0.7} />
        </mesh>
      </group>

      {[-8, -5, 5, 8].map((x, i) => (
        <group key={`flag-${i}`} position={[x, 0, BLDG_D / 2 + 7]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.025, 0.025, 5, 6]} />
            <meshStandardMaterial color="#888" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.25, 2.3, 0]}>
            <boxGeometry args={[0.5, 0.35, 0.008]} />
            <meshStandardMaterial color={['#cc0000', '#0044aa', '#ffffff', '#cc0000'][i]} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
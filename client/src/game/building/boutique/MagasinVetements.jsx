// client/src/game/boutique/MagasinVetements.jsx
/**
 * BOUTIQUE ÉTHER — Magasin de vêtements québécois
 * Stack: React + @react-three/fiber + @react-three/rapier + Three.js
 *
 * npm install three @react-three/fiber @react-three/rapier @react-three/drei
 */

import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import {
  PerspectiveCamera, OrbitControls, Text, Billboard,
  Environment, ContactShadows, MeshReflectorMaterial,
} from "@react-three/drei";
import * as THREE from "three";

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  wall:      "#1a1f2e",
  wallLight: "#242b3d",
  floor:     "#0d0f16",
  ceiling:   "#111520",
  glass:     "#7dd3fc",
  frame:     "#1a2535",
  gold:      "#c9a84c",
  accent:    "#7c3aed",
  neon:      "#a78bfa",
  white:     "#f0ede8",
  darkwood:  "#1c1209",
  lightwood: "#2d1f0e",
  rack:      "#2a2a35",
  carpet:    "#14101f",
  sign:      "#0a0c14",
};

// ─── VÊTEMENTS DATA (Québec style, marques mondiales) ─────────────────────────
const BRANDS = [
  { name:"Nike",       color:"#111", tag:"Espadrilles & Sport",   price:"89$–299$" },
  { name:"Adidas",     color:"#000", tag:"Sportwear Toute Saison", price:"69$–249$" },
  { name:"Levi's",     color:"#1a3a6b", tag:"Jeans & Denim",     price:"79$–189$" },
  { name:"Canada Goose", color:"#8b1a1a", tag:"Manteaux d'Hiver", price:"499$–1299$" },
  { name:"Roots",      color:"#5c3317", tag:"Casual Canadien",    price:"59$–299$" },
  { name:"Zara",       color:"#111", tag:"Mode Contemporaine",    price:"39$–199$" },
  { name:"H&M",        color:"#cc0000", tag:"Tendances Abordables",price:"19$–129$" },
  { name:"Stone Island",color:"#2a2a2a",tag:"Streetwear Premium", price:"299$–899$" },
  { name:"Patagonia",  color:"#1a5276", tag:"Plein Air & Éco",    price:"149$–599$" },
  { name:"Ralph Lauren",color:"#1a2a4a",tag:"Classique Américain",price:"99$–499$" },
  { name:"Carhartt",   color:"#4a3000", tag:"Vêtements de Travail",price:"79$–249$" },
  { name:"Supreme",    color:"#cc0000", tag:"Streetwear Exclusif", price:"69$–599$" },
];

const GARMENT_TYPES = [
  "Manteau d'hiver", "Chandail", "Pantalon", "Jeans", "Veste",
  "Robe", "Sarrau", "Combinaison", "Short", "Tuque", "Foulard",
  "Mitaines", "Bas", "Ceinture", "Coton ouaté",
];

const CLOTHES_COLORS = [
  "#cc0000","#1a3a6b","#2d1f0e","#111827","#4a3000",
  "#1a5276","#5c3317","#2a2a2a","#8b1a1a","#1c3a1c",
  "#3d1a5c","#c9a84c","#d4c8a0","#334155","#0e1520",
];

// ─── PROCEDURAL TEXTURES ─────────────────────────────────────────────────────
function makeTileFloor(size = 512) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const c  = cv.getContext("2d");
  c.fillStyle = "#0d0f16"; c.fillRect(0, 0, size, size);
  const ts = size / 8;
  for (let tx = 0; tx < 8; tx++) {
    for (let ty = 0; ty < 8; ty++) {
      const v = 12 + Math.random() * 8;
      c.fillStyle = `rgb(${v},${v+1},${v+3})`;
      c.fillRect(tx*ts+1, ty*ts+1, ts-2, ts-2);
      c.beginPath();
      for (let vn = 0; vn < 4; vn++) {
        const vx = tx*ts + Math.random()*ts, vy = ty*ts + Math.random()*ts;
        c.moveTo(vx, vy);
        c.lineTo(vx+(Math.random()-.5)*20, vy+(Math.random()-.5)*20);
      }
      c.strokeStyle = `rgba(40,40,50,${0.3+Math.random()*0.4})`; c.lineWidth=0.5; c.stroke();
    }
  }
  c.strokeStyle = "rgba(100,100,130,0.25)"; c.lineWidth = 1.5;
  for (let i = 0; i <= 8; i++) {
    c.beginPath();c.moveTo(i*ts,0);c.lineTo(i*ts,size);c.stroke();
    c.beginPath();c.moveTo(0,i*ts);c.lineTo(size,i*ts);c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4,4); t.anisotropy=16;
  return t;
}

function makeCarpetTex(size = 256) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const c  = cv.getContext("2d");
  c.fillStyle = C.carpet; c.fillRect(0,0,size,size);
  for (let i = 0; i < 8000; i++) {
    const x=Math.random()*size, y=Math.random()*size;
    const v = 25 + Math.random()*20;
    c.fillStyle=`rgba(${v},${v-5},${v+10},0.6)`; c.fillRect(x,y,1,1);
  }
  c.strokeStyle="rgba(160,130,200,0.12)"; c.lineWidth=1;
  for (let i=0;i<size;i+=8){c.beginPath();c.moveTo(i,0);c.lineTo(i,size);c.stroke();}
  const t = new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,3);
  return t;
}

function makeWallTex(size = 512) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const c  = cv.getContext("2d");
  c.fillStyle = C.wall; c.fillRect(0,0,size,size);
  for (let i=0;i<3000;i++) {
    const x=Math.random()*size,y=Math.random()*size,v=(Math.random()-.5)*8;
    c.fillStyle=`rgba(${v>0?255:0},${v>0?255:0},${v>0?255:0},${Math.abs(v)/255*0.4})`;
    c.fillRect(x,y,2,2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2); t.anisotropy=8;
  return t;
}

function makeWoodTex(size = 256, dark = true) {
  const cv = document.createElement("canvas"); cv.width=cv.height=size;
  const c  = cv.getContext("2d");
  const base = dark ? [28,18,9] : [45,31,14];
  c.fillStyle=`rgb(${base.join(",")})`; c.fillRect(0,0,size,size);
  for (let i=0;i<40;i++) {
    const gy = c.createLinearGradient(0,i*(size/40),0,(i+1)*(size/40));
    const v=Math.random()*10-5;
    gy.addColorStop(0,`rgba(${v>0?255:0},${v>0?200:0},${v>0?100:0},${Math.abs(v)/255*0.3})`);
    gy.addColorStop(1,"rgba(0,0,0,0)");
    c.fillStyle=gy; c.fillRect(0,i*(size/40),size,size/40);
  }
  for (let g=0;g<20;g++){
    c.beginPath();c.moveTo(Math.random()*size,0);c.lineTo(Math.random()*size,size);
    c.strokeStyle=`rgba(0,0,0,${0.05+Math.random()*0.12})`;c.lineWidth=0.5+Math.random()*1.5;c.stroke();
  }
  const t=new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1,3);
  return t;
}

// ─── TEXTURE CACHE ────────────────────────────────────────────────────────────
let _TEXCACHE = null;
function getStoreTex() {
  if (!_TEXCACHE) _TEXCACHE = {
    floor:  makeTileFloor(512),
    carpet: makeCarpetTex(256),
    wall:   makeWallTex(512),
    darkWood: makeWoodTex(256, true),
    lightWood:makeWoodTex(256, false),
  };
  return _TEXCACHE;
}

// ─── GEOMETRY HELPERS ─────────────────────────────────────────────────────────
function Box({ pos=[0,0,0], size=[1,1,1], color="#fff", ...props }) {
  return (
    <mesh position={pos} castShadow receiveShadow {...props}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} {...props.matProps} />
    </mesh>
  );
}

// ─── CLOTHES HANGER (one garment on rack) ────────────────────────────────────
function Garment({ pos, color, type, brand, onClick }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = pos[1] + Math.sin(clock.elapsedTime * 0.5 + pos[0]) * 0.012;
  });
  return (
    <group ref={ref} position={pos} onClick={onClick}>
      {/* Hanger wire */}
      <mesh position={[0, 0.18, 0]}>
        <torusGeometry args={[0.12, 0.012, 6, 20, Math.PI]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Hook */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
        <meshStandardMaterial color="#aaa" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Garment body */}
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.28, 0.38, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Brand label */}
      <Billboard position={[0, 0.05, 0.03]}>
        <Text fontSize={0.025} color={C.gold} anchorX="center" anchorY="middle" font={undefined}>
          {brand}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── CLOTHING RACK ────────────────────────────────────────────────────────────
function ClothingRack({ pos=[0,0,0], length=2.2, clothes=[], onSelect }) {
  const T = getStoreTex();
  return (
    <group position={pos}>
      {/* Uprights */}
      {[-length/2+0.04, length/2-0.04].map((x,i) => (
        <mesh key={i} position={[x, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 1.7, 10]} />
          <meshStandardMaterial color={C.rack} metalness={0.88} roughness={0.15} />
        </mesh>
      ))}
      {/* Feet */}
      {[[-length/2+0.04,-0.04,-0.3],[-length/2+0.04,-0.04,0.3],[length/2-0.04,-0.04,-0.3],[length/2-0.04,-0.04,0.3]].map((fp,i) => (
        <mesh key={i} position={fp} castShadow>
          <cylinderGeometry args={[0.018,0.018,0.6,8]} />
          <meshStandardMaterial color={C.rack} metalness={0.85} roughness={0.2} />
        </mesh>
      ))}
      {/* Crossbar */}
      <mesh position={[0,1.72,0]} castShadow>
        <cylinderGeometry args={[0.018,0.018,length,10]} rotation={[0,0,Math.PI/2]} />
        <meshStandardMaterial color={C.rack} metalness={0.88} roughness={0.12} />
      </mesh>
      {/* Clothes */}
      {clothes.map((cl, i) => (
        <Garment
          key={i}
          pos={[-length/2 + 0.18 + i*(length-0.3)/(Math.max(clothes.length-1,1)||1), 1.42, 0]}
          color={cl.color}
          type={cl.type}
          brand={cl.brand}
          onClick={() => onSelect && onSelect(cl)}
        />
      ))}
    </group>
  );
}

// ─── DISPLAY TABLE ────────────────────────────────────────────────────────────
function DisplayTable({ pos=[0,0,0], items=[], onSelect }) {
  const T = getStoreTex();
  return (
    <group position={pos}>
      {/* Table top */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.06, 0.9]} />
        <meshStandardMaterial map={T.lightWood} color="#3d2810" roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Legs */}
      {[[-0.72,-0.34,-0.38],[0.72,-0.34,-0.38],[-0.72,-0.34,0.38],[0.72,-0.34,0.38]].map((lp,i) => (
        <mesh key={i} position={lp} castShadow>
          <cylinderGeometry args={[0.04,0.04,0.72,8]} />
          <meshStandardMaterial color={C.darkwood} roughness={0.5} />
        </mesh>
      ))}
      {/* Folded garments stack */}
      {items.map((it, i) => (
        <group key={i} onClick={() => onSelect && onSelect(it)}>
          <mesh position={[(i%3-1)*0.42, 0.76 + Math.floor(i/3)*0.06, (Math.floor(i/3)-0.5)*0.22]} castShadow>
            <boxGeometry args={[0.34, 0.04, 0.28]} />
            <meshStandardMaterial color={it.color} roughness={0.9} />
          </mesh>
          <Billboard position={[(i%3-1)*0.42, 0.82 + Math.floor(i/3)*0.06, (Math.floor(i/3)-0.5)*0.22 + 0.16]}>
            <Text fontSize={0.022} color={C.gold} anchorX="center">{it.brand}</Text>
          </Billboard>
        </group>
      ))}
    </group>
  );
}

// ─── WALL SHELF ───────────────────────────────────────────────────────────────
function WallShelf({ pos=[0,0,0], width=2, items=[], onSelect }) {
  const T = getStoreTex();
  return (
    <group position={pos}>
      {/* Shelf board */}
      <mesh castShadow>
        <boxGeometry args={[width, 0.05, 0.38]} />
        <meshStandardMaterial map={T.darkWood} color="#2a1a08" roughness={0.5} />
      </mesh>
      {/* Brackets */}
      {[-width/2+0.1, width/2-0.1].map((bx,i) => (
        <mesh key={i} position={[bx,-0.06,-0.15]} castShadow>
          <boxGeometry args={[0.04, 0.12, 0.3]} />
          <meshStandardMaterial color={C.gold} metalness={0.88} roughness={0.15} />
        </mesh>
      ))}
      {/* Items */}
      {items.map((it, i) => (
        <group key={i} onClick={() => onSelect && onSelect(it)}>
          <mesh position={[-width/2+0.25+i*(width-0.4)/(Math.max(items.length-1,1)||1), 0.12, 0]}>
            <boxGeometry args={[0.18, 0.28, 0.14]} />
            <meshStandardMaterial color={it.color} roughness={0.8} />
          </mesh>
          <Billboard position={[-width/2+0.25+i*(width-0.4)/(Math.max(items.length-1,1)||1), 0.34, 0.1]}>
            <Text fontSize={0.025} color={C.white} anchorX="center">{it.brand}</Text>
          </Billboard>
        </group>
      ))}
    </group>
  );
}

// ─── FITTING ROOM ─────────────────────────────────────────────────────────────
function FittingRoom({ pos=[0,0,0], num=1 }) {
  const T = getStoreTex();
  const wallM = { color: C.wallLight, roughness:0.7, metalness:0.02 };
  return (
    <group position={pos}>
      {/* Back wall */}
      <mesh position={[0,1.5,-0.95]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 3.0, 0.12]} />
        <meshStandardMaterial {...wallM} />
      </mesh>
      {/* Side walls */}
      {[-0.64,0.64].map((x,i) => (
        <mesh key={i} position={[x,1.5,0]} castShadow receiveShadow>
          <boxGeometry args={[0.12,3.0,2.0]} />
          <meshStandardMaterial {...wallM} />
        </mesh>
      ))}
      {/* Curtain rod */}
      <mesh position={[0,2.55,0.88]} castShadow>
        <cylinderGeometry args={[0.018,0.018,1.42,10]} />
        <meshStandardMaterial color={C.gold} metalness={0.92} roughness={0.1} />
      </mesh>
      {/* Curtain */}
      <mesh position={[0,1.7,0.88]} castShadow>
        <boxGeometry args={[1.2,1.8,0.04]} />
        <meshStandardMaterial color="#1a0a2e" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* Mirror */}
      <mesh position={[0,1.3,-0.88]}>
        <boxGeometry args={[0.9,1.8,0.04]} />
        <meshStandardMaterial color="#c0c8d8" metalness={0.85} roughness={0.05} />
      </mesh>
      {/* Number */}
      <Billboard position={[0, 2.9, 0.9]}>
        <Text fontSize={0.12} color={C.gold} anchorX="center">{"Cabine " + num}</Text>
      </Billboard>
      {/* Hook */}
      <mesh position={[0.55,1.8,-0.88]} castShadow>
        <torusGeometry args={[0.04,0.012,6,12,Math.PI]} />
        <meshStandardMaterial color={C.gold} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Seat bench */}
      <mesh position={[0,0.22,-0.7]} castShadow receiveShadow>
        <boxGeometry args={[1.1,0.08,0.36]} />
        <meshStandardMaterial color={C.darkwood} roughness={0.6} />
      </mesh>
      {[[-0.45,-0.22,0.52],[0.45,-0.22,0.52],[-0.45,-0.22,-0.9],[0.45,-0.22,-0.9]].map((lp,i) => (
        <mesh key={i} position={[lp[0]+0,0.18+lp[1],-0.7+lp[2]]} castShadow>
          <cylinderGeometry args={[0.025,0.025,0.32,8]} />
          <meshStandardMaterial color={C.rack} roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ─── CASH REGISTER / CAISSE ───────────────────────────────────────────────────
function Caisse({ pos=[0,0,0] }) {
  const T = getStoreTex();
  return (
    <group position={pos}>
      {/* Counter body */}
      <mesh position={[0,0.52,0]} castShadow receiveShadow>
        <boxGeometry args={[2.8,1.05,0.9]} />
        <meshStandardMaterial color="#0e1520" roughness={0.25} metalness={0.6} />
      </mesh>
      {/* Counter top */}
      <mesh position={[0,1.08,0]} castShadow>
        <boxGeometry args={[2.85,0.07,0.95]} />
        <meshStandardMaterial map={T.lightWood} color="#c9a84c" roughness={0.12} metalness={0.18} />
      </mesh>
      {/* Front panel decorative ribs */}
      {[-1.1,-0.55,0,0.55,1.1].map((rx,i) => (
        <mesh key={i} position={[rx,0.5,-0.44]} castShadow>
          <boxGeometry args={[0.04,0.9,0.04]} />
          <meshStandardMaterial color={C.gold} metalness={0.9} roughness={0.12} />
        </mesh>
      ))}
      {/* Cash register terminal */}
      <mesh position={[0.6,1.25,0.1]} castShadow>
        <boxGeometry args={[0.4,0.28,0.28]} />
        <meshStandardMaterial color="#0a0c10" roughness={0.15} metalness={0.7} />
      </mesh>
      {/* Screen */}
      <mesh position={[0.6,1.32,0.25]}>
        <boxGeometry args={[0.3,0.18,0.02]} />
        <meshStandardMaterial color="#1a3a6b" emissive="#1a3a6b" emissiveIntensity={0.6} roughness={0.1} />
      </mesh>
      {/* Card reader */}
      <mesh position={[-0.2,1.18,0.2]} castShadow>
        <boxGeometry args={[0.14,0.08,0.2]} />
        <meshStandardMaterial color="#111" roughness={0.2} metalness={0.6} />
      </mesh>
      {/* Bags display */}
      <mesh position={[-0.9,1.2,0.12]} castShadow>
        <boxGeometry args={[0.5,0.28,0.1]} />
        <meshStandardMaterial color={C.accent} roughness={0.8} />
      </mesh>
      {/* Sign */}
      <mesh position={[0,1.85,-0.42]}>
        <boxGeometry args={[2.2,0.45,0.06]} />
        <meshStandardMaterial color={C.sign} roughness={0.1} />
      </mesh>
      <Billboard position={[0,1.85,-0.38]}>
        <Text fontSize={0.11} color={C.gold} anchorX="center">CAISSE — BOUTIQUE ÉTHER</Text>
      </Billboard>
      {/* Partition glass back */}
      <mesh position={[0,1.8,0.44]}>
        <boxGeometry args={[2.85,0.7,0.04]} />
        <meshStandardMaterial color={C.glass} transparent opacity={0.18} roughness={0.02} />
      </mesh>
    </group>
  );
}

// ─── MANNEQUIN ────────────────────────────────────────────────────────────────
function Mannequin({ pos=[0,0,0], outfitColor="#1a3a6b", brand="" }) {
  return (
    <group position={pos}>
      {/* Base */}
      <mesh position={[0,-0.02,0]} castShadow>
        <cylinderGeometry args={[0.18,0.22,0.04,16]} />
        <meshStandardMaterial color={C.rack} metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Pole */}
      <mesh position={[0,0.7,0]} castShadow>
        <cylinderGeometry args={[0.018,0.018,1.4,8]} />
        <meshStandardMaterial color={C.rack} metalness={0.88} roughness={0.12} />
      </mesh>
      {/* Torso */}
      <mesh position={[0,1.3,0]} castShadow>
        <boxGeometry args={[0.38,0.55,0.22]} />
        <meshStandardMaterial color="#d4c8b0" roughness={0.7} />
      </mesh>
      {/* Outfit on torso */}
      <mesh position={[0,1.3,0.01]} castShadow>
        <boxGeometry args={[0.4,0.52,0.18]} />
        <meshStandardMaterial color={outfitColor} roughness={0.8} />
      </mesh>
      {/* Shoulders */}
      {[-0.24,0.24].map((sx,i) => (
        <mesh key={i} position={[sx,1.56,0]} castShadow>
          <sphereGeometry args={[0.07,10,10]} />
          <meshStandardMaterial color="#d4c8b0" roughness={0.7} />
        </mesh>
      ))}
      {/* Neck */}
      <mesh position={[0,1.62,0]} castShadow>
        <cylinderGeometry args={[0.05,0.06,0.12,10]} />
        <meshStandardMaterial color="#d4c8b0" roughness={0.7} />
      </mesh>
      {/* Head */}
      <mesh position={[0,1.78,0]} castShadow>
        <sphereGeometry args={[0.12,14,14]} />
        <meshStandardMaterial color="#d4c8b0" roughness={0.65} />
      </mesh>
      {/* Hips */}
      <mesh position={[0,0.98,0]} castShadow>
        <boxGeometry args={[0.34,0.3,0.2]} />
        <meshStandardMaterial color={outfitColor} roughness={0.85} />
      </mesh>
      {/* Brand tag */}
      <Billboard position={[0,0.6,0.2]}>
        <Text fontSize={0.06} color={C.gold} anchorX="center">{brand}</Text>
      </Billboard>
    </group>
  );
}

// ─── NEON SIGN ────────────────────────────────────────────────────────────────
function NeonSign({ pos=[0,0,0], text="BOUTIQUE ÉTHER", color="#a78bfa" }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime*2)*0.3;
  });
  return (
    <group position={pos}>
      <mesh ref={ref} position={[0,0,-0.02]}>
        <boxGeometry args={[3.2,0.5,0.06]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} roughness={0.3} />
      </mesh>
      <Billboard position={[0,0,0.08]}>
        <Text fontSize={0.18} color="#fff" anchorX="center" anchorY="middle"
          outlineColor={color} outlineWidth={0.008}>
          {text}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── SPOTLIGHT ────────────────────────────────────────────────────────────────
function StoreSpot({ pos=[0,3,0], target=[0,0,0], color="#fff8e8", intensity=2.5 }) {
  const light = useRef();
  const targetRef = useRef();
  return (
    <>
      <spotLight
        ref={light}
        position={pos}
        intensity={intensity}
        angle={0.35}
        penumbra={0.5}
        color={color}
        castShadow
        shadow-mapSize={[512,512]}
      />
    </>
  );
}

// ─── GLASS WALL PANEL ────────────────────────────────────────────────────────
function GlassPanel({ pos=[0,0,0], size=[1,3,0.06], ry=0, frame=true }) {
  return (
    <group position={pos} rotation={[0,ry,0]}>
      <mesh castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={C.glass} transparent opacity={0.18} roughness={0.02} metalness={0.1} />
      </mesh>
      {frame && (
        <>
          <mesh position={[0,size[1]/2,0]}>
            <boxGeometry args={[size[0]+0.05, 0.06, size[2]+0.04]} />
            <meshStandardMaterial color={C.frame} metalness={0.88} roughness={0.18} />
          </mesh>
          <mesh position={[0,-size[1]/2,0]}>
            <boxGeometry args={[size[0]+0.05, 0.06, size[2]+0.04]} />
            <meshStandardMaterial color={C.frame} metalness={0.88} roughness={0.18} />
          </mesh>
          <mesh position={[-size[0]/2,0,0]}>
            <boxGeometry args={[0.06, size[1], size[2]+0.04]} />
            <meshStandardMaterial color={C.frame} metalness={0.88} roughness={0.18} />
          </mesh>
          <mesh position={[size[0]/2,0,0]}>
            <boxGeometry args={[0.06, size[1], size[2]+0.04]} />
            <meshStandardMaterial color={C.frame} metalness={0.88} roughness={0.18} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ─── STORE STRUCTURE ──────────────────────────────────────────────────────────
function StoreBuilding({ onSelectItem }) {
  const T = getStoreTex();
  const W = 20, D = 14, H = 4.2;

  const clothes = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 80; i++) {
      arr.push({
        brand: BRANDS[i % BRANDS.length].name,
        color: CLOTHES_COLORS[i % CLOTHES_COLORS.length],
        type:  GARMENT_TYPES[i % GARMENT_TYPES.length],
        price: BRANDS[i % BRANDS.length].price,
        tag:   BRANDS[i % BRANDS.length].tag,
      });
    }
    return arr;
  }, []);

  return (
    <group>
      {/* ── FLOOR ── */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
          <planeGeometry args={[W,D,4,4]} />
          <meshStandardMaterial map={T.floor} color="#1a1c24" roughness={0.15} metalness={0.12} />
        </mesh>
      </RigidBody>

      {/* ── CEILING ── */}
      <mesh position={[0,H,0]} rotation={[Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[W,D]} />
        <meshStandardMaterial color={C.ceiling} roughness={0.9} />
      </mesh>

      {/* ── BACK WALL ── */}
      <RigidBody type="fixed">
        <mesh position={[0,H/2,-D/2]} castShadow receiveShadow>
          <boxGeometry args={[W,H,0.22]} />
          <meshStandardMaterial map={T.wall} color="#1a1f2e" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* ── LEFT WALL (opaque) ── */}
      <RigidBody type="fixed">
        <mesh position={[-W/2,H/2,0]} castShadow receiveShadow>
          <boxGeometry args={[0.22,H,D]} />
          <meshStandardMaterial map={T.wall} color="#1a1f2e" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* ── RIGHT WALL — VITRÉ (côté droit entier) ── */}
      <RigidBody type="fixed">
        <mesh position={[W/2,H/2,0]}>
          <boxGeometry args={[0.12,H,D]} />
          <meshStandardMaterial color={C.frame} metalness={0.88} roughness={0.2} />
        </mesh>
      </RigidBody>
      {/* Glass panels right wall — 6 panels */}
      {[-5,-3,-1,1,3,5].map((pz,i) => (
        <GlassPanel key={i} pos={[W/2,H/2-0.15,pz]} size={[0.08,H-0.3,2.1]} ry={0} />
      ))}

      {/* ── FRONT WALL — EN VITRE avec portes ── */}
      {/* Left glass section */}
      <GlassPanel pos={[-6.5,H/2-0.15,D/2]} size={[5,H-0.3,0.08]} />
      {/* Right glass section */}
      <GlassPanel pos={[6.5,H/2-0.15,D/2]} size={[5,H-0.3,0.08]} />
      {/* Door frame center */}
      <mesh position={[0,H/2,D/2]}>
        <boxGeometry args={[0.12,H,0.12]} />
        <meshStandardMaterial color={C.frame} metalness={0.88} roughness={0.15} />
      </mesh>
      {/* Door panels (glass) */}
      {[-1.2,1.2].map((dx,i) => (
        <GlassPanel key={i} pos={[dx,H/2-0.15,D/2]} size={[2.2,H-0.3,0.06]} />
      ))}
      {/* Door handles */}
      {[-1.2,1.2].map((dx,i) => (
        <mesh key={i} position={[dx+(dx>0?-0.6:0.6), H/2-0.5, D/2+0.08]} castShadow>
          <cylinderGeometry args={[0.025,0.025,0.55,10]} />
          <meshStandardMaterial color={C.gold} metalness={0.92} roughness={0.08} />
        </mesh>
      ))}
      {/* Top beam front */}
      <mesh position={[0,H-0.1,D/2]} castShadow>
        <boxGeometry args={[W,0.2,0.25]} />
        <meshStandardMaterial color={C.frame} metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Bottom beam front */}
      <mesh position={[0,0.04,D/2]} castShadow>
        <boxGeometry args={[W,0.08,0.2]} />
        <meshStandardMaterial color={C.frame} metalness={0.8} roughness={0.25} />
      </mesh>

      {/* ── CEILING TRACK LIGHTS ── */}
      {[[-6,-3,0,3,6],[-4,-1,2,5]].map((row,ri) =>
        row.map((x,ci) => (
          <group key={`${ri}-${ci}`} position={[x,H-0.06,ri===0?-2:2]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.04,0.04,0.18,8]} />
              <meshStandardMaterial color={C.rack} metalness={0.88} roughness={0.15} />
            </mesh>
            <StoreSpot pos={[x,H-0.1,ri===0?-2:2]} intensity={2.2} />
          </group>
        ))
      )}

      {/* ── CARPET ZONE (centre) ── */}
      <mesh position={[0,0.005,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[10,8]} />
        <meshStandardMaterial map={T.carpet} color="#1a1426" roughness={0.95} />
      </mesh>

      {/* ── ENSEIGNE NÉON ── */}
      <NeonSign pos={[0,H-0.45,-D/2+0.16]} text="BOUTIQUE ÉTHER — QUÉBEC" color={C.neon} />

      {/* ── MANNEQUINS VITRINE (avant) ── */}
      <Mannequin pos={[-7.5,0,D/2-1.4]} outfitColor="#cc0000" brand="Nike" />
      <Mannequin pos={[-5.5,0,D/2-1.4]} outfitColor="#1a3a6b" brand="Levi's" />
      <Mannequin pos={[5.5,0,D/2-1.4]}  outfitColor="#8b1a1a" brand="Canada Goose" />
      <Mannequin pos={[7.5,0,D/2-1.4]}  outfitColor="#2a2a2a" brand="Stone Island" />

      {/* ── RANGÉES DE LINGE (racks) ── */}
      <ClothingRack pos={[-7,0,-4.5]} length={5.5}
        clothes={clothes.slice(0,10)} onSelect={onSelectItem} />
      <ClothingRack pos={[0,0,-4.5]} length={5.5}
        clothes={clothes.slice(10,20)} onSelect={onSelectItem} />
      <ClothingRack pos={[7,0,-4.5]} length={5.5}
        clothes={clothes.slice(20,30)} onSelect={onSelectItem} />
      <ClothingRack pos={[-6,0,0]} length={4.5} clothes={clothes.slice(30,38)} onSelect={onSelectItem} />
      <ClothingRack pos={[6,0,0]}  length={4.5} clothes={clothes.slice(38,46)} onSelect={onSelectItem} />
      <ClothingRack pos={[0,0,1.5]} length={4.0} clothes={clothes.slice(46,54)} onSelect={onSelectItem} />

      {/* ── WALL SHELVES (left wall) ── */}
      <WallShelf pos={[-W/2+0.25,2.5,-4]} width={3.5} items={clothes.slice(54,60)} onSelect={onSelectItem} />
      <WallShelf pos={[-W/2+0.25,1.6,-4]} width={3.5} items={clothes.slice(60,66)} onSelect={onSelectItem} />
      <WallShelf pos={[-W/2+0.25,2.5,-0.5]} width={3} items={clothes.slice(66,71)} onSelect={onSelectItem} />

      {/* ── DISPLAY TABLES ── */}
      <DisplayTable pos={[-4,0,1]} items={clothes.slice(71,77)} onSelect={onSelectItem} />
      <DisplayTable pos={[4,0,1]}  items={clothes.slice(77,80).concat(clothes.slice(0,3))} onSelect={onSelectItem} />

      {/* ── CAISSE / COMPTOIR ── */}
      <Caisse pos={[-5.5,0,-6.2]} />

      {/* ── FITTING ROOMS (droite arrière) ── */}
      <FittingRoom pos={[7.8,0,-3.5]} num={1} />
      <FittingRoom pos={[7.8,0,-1.2]} num={2} />
      <FittingRoom pos={[7.8,0,1.1]}  num={3} />
      <Billboard position={[7.8,3.1,-0.2]}>
        <Text fontSize={0.13} color={C.gold} anchorX="center">🧥 CABINES D'ESSAYAGE</Text>
      </Billboard>
      <mesh position={[6.2,0.2,-0.2]} castShadow receiveShadow>
        <boxGeometry args={[0.6,0.08,3]} />
        <meshStandardMaterial color={C.darkwood} roughness={0.5} />
      </mesh>
      {[[-0.22,-3],[-0.22,3],[0.22,-3],[0.22,3]].map(([lx,lz],i) => (
        <mesh key={i} position={[6.2+lx,0.1,-0.2+lz*0.45]} castShadow>
          <cylinderGeometry args={[0.025,0.025,0.2,8]} />
          <meshStandardMaterial color={C.rack} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* ── DÉCO PLAFOND — track rail ── */}
      {[-8,-4,0,4,8].map((rx,i) => (
        <mesh key={i} position={[rx,H-0.02,0]} castShadow>
          <boxGeometry args={[0.06,0.04,D-0.5]} />
          <meshStandardMaterial color={C.rack} metalness={0.85} roughness={0.2} />
        </mesh>
      ))}

      {/* ── PILIERS ── */}
      {[[-7,3],[7,3],[-7,-3],[7,-3]].map(([px,pz],i) => (
        <group key={i}>
          <RigidBody type="fixed">
            <mesh position={[px,H/2,pz]} castShadow>
              <cylinderGeometry args={[0.18,0.22,H,16,4]} />
              <meshStandardMaterial color="#1a2035" roughness={0.4} metalness={0.6} />
            </mesh>
          </RigidBody>
          <mesh position={[px,0.04,pz]}>
            <torusGeometry args={[0.22,0.04,8,24]} />
            <meshStandardMaterial color={C.gold} metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[px,H-0.04,pz]}>
            <torusGeometry args={[0.22,0.04,8,24]} />
            <meshStandardMaterial color={C.gold} metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      ))}

      {/* ── ZONE MARQUES (back wall displays) ── */}
      {BRANDS.slice(0,6).map((b,i) => (
        <group key={i} position={[-7.5+i*3, H-0.55, -D/2+0.2]}>
          <mesh castShadow>
            <boxGeometry args={[2.4,0.38,0.08]} />
            <meshStandardMaterial color={C.sign} roughness={0.1} />
          </mesh>
          <Billboard position={[0,0,0.06]}>
            <Text fontSize={0.1} color={C.gold} anchorX="center">{b.name}</Text>
          </Billboard>
        </group>
      ))}

      {/* ── AMBIANCE LIGHTS ── */}
      <ambientLight intensity={0.4} color="#1a2030" />
      <pointLight position={[-7,3.5,-4]} intensity={1.2} color="#ffeedd" distance={10} />
      <pointLight position={[7,3.5,-4]}  intensity={1.2} color="#ffeedd" distance={10} />
      <pointLight position={[0,3.5,0]}   intensity={1.5} color="#fff8e8" distance={14} />
      <pointLight position={[0,3.5,5]}   intensity={1.0} color="#ffeedd" distance={10} />
      <pointLight position={[-6,2,1]}    intensity={0.6} color={C.neon}  distance={8}  />
    </group>
  );
}

// ─── PRODUCT POPUP ────────────────────────────────────────────────────────────
function ProductPopup({ item, onClose }) {
  if (!item) return null;
  return (
    <div style={{
      position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)",
      background:"rgba(10,12,20,0.97)", border:"1px solid rgba(167,139,250,0.4)",
      borderRadius:14, padding:"18px 28px", zIndex:100,
      backdropFilter:"blur(12px)", display:"flex", alignItems:"center", gap:22,
      fontFamily:"'JetBrains Mono','Courier New',monospace", minWidth:340,
      boxShadow:"0 0 40px rgba(124,58,237,0.25)",
    }}>
      <div style={{ width:44, height:44, borderRadius:8, background:item.color, border:"2px solid rgba(201,168,76,0.5)", flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div style={{ color:"#a78bfa", fontSize:10, letterSpacing:3, textTransform:"uppercase", marginBottom:2 }}>{item.type}</div>
        <div style={{ color:"#c9a84c", fontSize:18, fontWeight:700, marginBottom:2 }}>{item.brand}</div>
        <div style={{ color:"#64748b", fontSize:11 }}>{item.tag}</div>
      </div>
      <div style={{ textAlign:"right" }}>
        <div style={{ color:"#f0ede8", fontSize:20, fontWeight:700 }}>{item.price}</div>
        <div style={{ color:"#334155", fontSize:9, letterSpacing:1 }}>+ taxes</div>
      </div>
      <button onClick={onClose} style={{ background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:18, padding:"0 4px" }}>✕</button>
    </div>
  );
}

// ─── CAMERA CONTROLLER ───────────────────────────────────────────────────────
function CameraSetup() {
  return (
    <PerspectiveCamera makeDefault fov={55} position={[0, 3.5, 12]} near={0.1} far={200} />
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function MagasinVetements() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [showInfo,     setShowInfo]     = useState(false);

  return (
    <div style={{ width:"100vw", height:"100vh", background:"#08090f", position:"relative", overflow:"hidden", fontFamily:"'JetBrains Mono','Courier New',monospace" }}>

      {/* Header HUD */}
      <div style={{ position:"absolute", top:0, left:0, right:0, padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"linear-gradient(180deg,rgba(8,9,15,0.95) 0%,transparent 100%)", zIndex:10, pointerEvents:"none" }}>
        <div>
          <div style={{ color:"#a78bfa", fontSize:10, letterSpacing:4, textTransform:"uppercase" }}>EST. 2024 — QUÉBEC</div>
          <div style={{ color:"#c9a84c", fontSize:22, fontWeight:700, letterSpacing:1 }}>BOUTIQUE ÉTHER</div>
        </div>
        <div style={{ textAlign:"right", pointerEvents:"auto" }}>
          <button onClick={() => setShowInfo(i => !i)} style={{ background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.4)", borderRadius:8, color:"#a78bfa", padding:"7px 16px", cursor:"pointer", fontSize:11, letterSpacing:2, fontFamily:"inherit" }}>
            {showInfo ? "FERMER INFO" : "À PROPOS"}
          </button>
        </div>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div style={{ position:"absolute", top:70, right:20, background:"rgba(10,12,20,0.96)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:12, padding:"18px 22px", zIndex:20, backdropFilter:"blur(10px)", maxWidth:280 }}>
          <div style={{ color:"#c9a84c", fontSize:13, fontWeight:700, marginBottom:10 }}>🏪 Boutique Éther</div>
          <div style={{ color:"#64748b", fontSize:11, lineHeight:1.7 }}>
            Magasin de vêtements haut de gamme situé au cœur du Québec.<br/>
            Marques mondiales, style urbain.<br/><br/>
            <span style={{ color:"#a78bfa" }}>Contrôles :</span><br/>
            Clic gauche + drag → orbiter<br/>
            Scroll → zoomer<br/>
            Clic droit + drag → panoramique<br/>
            Cliquer un vêtement → infos
          </div>
        </div>
      )}

      {/* Brand strip */}
      <div style={{ position:"absolute", bottom:80, left:0, right:0, display:"flex", justifyContent:"center", gap:24, padding:"8px 24px", background:"linear-gradient(0deg,rgba(8,9,15,0.9) 0%,transparent 100%)", zIndex:5, pointerEvents:"none", flexWrap:"wrap" }}>
        {BRANDS.slice(0,8).map(b => (
          <div key={b.name} style={{ color:"#334155", fontSize:9, letterSpacing:2, textTransform:"uppercase" }}>{b.name}</div>
        ))}
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        dpr={Math.min(window.devicePixelRatio, 2)}
        gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.05 }}
        style={{ position:"absolute", inset:0 }}
      >
        <Suspense fallback={null}>
          <CameraSetup />
          <OrbitControls
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI/2.1}
            minDistance={4}
            maxDistance={28}
            enablePan={true}
            panSpeed={0.6}
            rotateSpeed={0.5}
            target={[0, 1.5, 0]}
          />

          <fog attach="fog" args={["#08090f", 20, 50]} />

          <Physics gravity={[0, -9.81, 0]}>
            <StoreBuilding onSelectItem={setSelectedItem} />
          </Physics>

          <ContactShadows
            position={[0, 0.001, 0]}
            width={22} height={15} far={3}
            blur={2.5} opacity={0.6} color="#000"
          />
        </Suspense>
      </Canvas>

      {/* Product popup */}
      <ProductPopup item={selectedItem} onClose={() => setSelectedItem(null)} />

      {/* Corner hint */}
      <div style={{ position:"absolute", bottom:16, right:20, color:"#1e293b", fontSize:9, letterSpacing:2, lineHeight:1.8, textAlign:"right" }}>
        CLIQUER UN VÊTEMENT POUR VOIR LES INFOS<br/>
        DRAG · SCROLL · PANORAMIQUE
      </div>
    </div>
  );
}
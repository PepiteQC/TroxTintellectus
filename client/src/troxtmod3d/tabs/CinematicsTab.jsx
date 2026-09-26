// src/troxtmod3d/tabs/CinematicsTab.jsx
import React from 'react';

export const ANIM_MODES = [
  { id: 'idle',          label: 'Idle',       icon: '🧘' },
  { id: 'walk',          label: 'Marche',     icon: '🚶' },
  { id: 'run',           label: 'Course',     icon: '🏃' },
  { id: 'jump',          label: 'Saut',       icon: '🤸' },
  { id: 'wave',          label: 'Saluer',     icon: '👋' },
  { id: 'dance',         label: 'Danser',     icon: '💃' },
  { id: 'flex',          label: 'Flex',       icon: '💪' },
  { id: 'bow',           label: 'Révérence',  icon: '🙇' },
  { id: 'threaten',      label: 'Menacer',    icon: '👊' },
  { id: 'sit',           label: 'S\'asseoir', icon: '🪑' },
  { id: 'lie',           label: 'S\'allonger',icon: '🛏️' },
  { id: 'point',         label: 'Pointer',    icon: '👉' },
  { id: 'salute',        label: 'Salut',      icon: '🫡' },
  { id: 'meditate',      label: 'Méditer',    icon: '🧘‍♂️' },
  { id: 'combat_idle',   label: 'Combat',     icon: '⚔️' },
  { id: 'combat_strike', label: 'Attaque',    icon: '🗡️' },
  { id: 'cast_spell',    label: 'Sort',       icon: '🪄' },
  { id: 'injured',       label: 'Blessé',     icon: '🤕' },
  { id: 'victory',       label: 'Victoire',   icon: '🏆' },
  { id: 'crouch',        label: 'Accroupi',   icon: '🙈' },
  { id: 'power_pose',    label: 'Pose',       icon: '🦸' },
  { id: 'floating',      label: 'Flotter',    icon: '🎈' },
];

export function CinematicsTab({ mode, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ color: '#444', fontSize: '9px', fontWeight: 700 }}>22 MODES D'ANIMATION</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {ANIM_MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => onChange(m.id)} style={{
              padding: '10px 8px',
              background: active ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '9px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            }}>
              <span style={{ fontSize: '20px' }}>{m.icon}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: active ? '#cc88ff' : '#888' }}>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
// src/troxtmod3d/tabs/AurasTab.jsx
import React from 'react';
import { PLATINUM_AURAS } from '../AuraEngine';

export function AurasTab({ auraId, auraColor, auraEnabled, onChange, onColorChange, onToggle }) {
  const auraList = Object.values(PLATINUM_AURAS);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <button onClick={onToggle} style={{
        padding: '10px',
        background: auraEnabled ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${auraEnabled ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '9px',
        color: auraEnabled ? '#7dd3fc' : '#666',
        fontSize: '11px', fontWeight: 800, cursor: 'pointer',
      }}>
        {auraEnabled ? '✨ AURA ACTIVÉE' : '💤 Aura désactivée'}
      </button>

      <button onClick={() => onChange(null)} style={{
        padding: '8px',
        background: !auraId ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${!auraId ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '8px',
        color: !auraId ? '#cc88ff' : '#666',
        fontSize: '10px', fontWeight: 700, cursor: 'pointer',
      }}>🚫 Aucune aura</button>

      <div style={{ color: '#444', fontSize: '9px', fontWeight: 700 }}>18 AURAS PLATINUM</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {auraList.map((a) => {
          const active = auraId === a.id;
          return (
            <button key={a.id} onClick={() => onChange(a.id)} style={{
              padding: '8px 6px',
              background: active ? `${a.color}22` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? `${a.color}88` : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '9px',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              boxShadow: active ? `0 0 12px ${a.color}44` : 'none',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: '20px' }}>{a.icon}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: active ? a.color : '#888' }}>{a.name}</span>
              <span style={{ fontSize: '7px', color: '#555', textAlign: 'center' }}>{a.subtitle}</span>
            </button>
          );
        })}
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' }}>COULEUR AURA PERSONNALISÉE</div>
        <input type="color" value={auraColor} onChange={(e) => onColorChange(e.target.value)}
          style={{ width: '100%', height: '28px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', background: 'transparent', padding: '2px' }} />
      </div>
    </div>
  );
}
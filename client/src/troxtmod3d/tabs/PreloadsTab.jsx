// src/troxtmod3d/tabs/PreloadsTab.jsx
import React, { useState } from 'react';
import { PRELOADED_CHARACTERS } from '../preloadedCharacters';
import { PLATINUM_AURAS } from '../AuraEngine';

export function PreloadsTab({ onLoad }) {
  const categories = Array.from(new Set(PRELOADED_CHARACTERS.map((c) => c.category)));
  const [filter, setFilter] = useState('all');
  const visible = filter === 'all' ? PRELOADED_CHARACTERS : PRELOADED_CHARACTERS.filter((c) => c.category === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>FILTRER PAR CATÉGORIE</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
        <button onClick={() => setFilter('all')} style={pill(filter === 'all')}>
          Tous ({PRELOADED_CHARACTERS.length})
        </button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)} style={pill(filter === cat)}>{cat}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visible.map((p) => (
          <div key={p.id} onClick={() => onLoad(p.state)} style={card} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(170,85,255,0.08)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '26px' }}>{p.avatarIcon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#e8e8f0' }}>{p.name}</div>
                <div style={{ fontSize: '10px', color: '#666', marginTop: '1px' }}>{p.jobTitle}</div>
              </div>
              <span style={badge}>{p.badge}</span>
            </div>
            <div style={{ fontSize: '10px', color: '#555', lineHeight: 1.4, marginBottom: '6px' }}>{p.description}</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <span style={tag('#7dd3fc')}>{p.category}</span>
              {p.defaultAura && PLATINUM_AURAS[p.defaultAura] && (
                <span style={tag(PLATINUM_AURAS[p.defaultAura].color)}>
                  {PLATINUM_AURAS[p.defaultAura].icon} {PLATINUM_AURAS[p.defaultAura].name}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const pill = (active) => ({
  padding: '4px 10px',
  background: active ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.04)',
  border: `1px solid ${active ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.07)'}`,
  borderRadius: '20px',
  color: active ? '#cc88ff' : '#666',
  fontSize: '9px', fontWeight: 700, cursor: 'pointer',
});

const card = {
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '10px',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const badge = {
  padding: '2px 8px',
  background: 'rgba(170,85,255,0.15)',
  border: '1px solid rgba(170,85,255,0.35)',
  borderRadius: '20px',
  fontSize: '8px',
  color: '#cc88ff',
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const tag = (color) => ({
  padding: '2px 7px',
  background: `${color}22`,
  border: `1px solid ${color}55`,
  borderRadius: '12px',
  fontSize: '8px',
  color: color,
  fontWeight: 700,
});
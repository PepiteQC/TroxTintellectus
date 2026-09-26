// src/troxtmod3d/CharacterCreatorV4.jsx
// ETHERWORLD RP — CharacterCreator v4.1 GTA-RP EDITION (JSX pur)
// ⚠️ AUCUN stat RPG fantastique — profil RP uniquement

import React, { useRef, useState, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

import { DEFAULT_STATE, DISTRICTS, JOBS } from './constants';
import { Scene } from './Scene';
import { PreloadsTab } from './tabs/PreloadsTab';
import { AurasTab } from './tabs/AurasTab';
import { ImportTab } from './tabs/ImportTab';
import { CinematicsTab } from './tabs/CinematicsTab';
import { RPTab } from './tabs/RPTab';

// ═══════════════════════════════════════════════════════════
//  CONSTANTES UI
// ═══════════════════════════════════════════════════════════
const TABS = [
  'preloads', 'identite', 'rp', 'race', 'corps', 'visage',
  'tenue', 'accessoires', 'equipement', 'auras', 'animation', 'import', 'sauvegarde',
];

const TAB_ICONS = {
  preloads: '⭐', identite: '📇', rp: '📊', race: '🌍', corps: '💪',
  visage: '😊', tenue: '👕', accessoires: '👑', equipement: '⚔️',
  auras: '✨', animation: '🎬', import: '📦', sauvegarde: '💾',
};

// (les listes RACES, BODY_TYPES, HAIR_STYLES, FACE_SHAPES, EYE_SHAPES,
//  NOSE_SHAPES, MOUTH_SHAPES, EYEBROW_SHAPES, FACIAL_HAIR, OUTFITS,
//  EQUIPMENTS, ACC_*, PERSONALITIES, VOICES, NATIONALITIES, EMOTES,
//  SKIN_PRESETS, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS, AURA_COLORS
//  sont dans ./constants.js)

import {
  RACES, BODY_TYPES, HAIR_STYLES, FACE_SHAPES, EYE_SHAPES, NOSE_SHAPES,
  MOUTH_SHAPES, EYEBROW_SHAPES, FACIAL_HAIR, OUTFITS, EQUIPMENTS,
  ACC_GLASSES, ACC_HATS, ACC_JEWELRY, ACC_WINGS, ACC_TAIL, ACC_HALO,
  ACC_MASK, ACC_CAPE, ACC_BACKPACK, ACC_WATCH,
  PERSONALITIES, VOICES, NATIONALITIES, EMOTES,
  SKIN_PRESETS, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS, AURA_COLORS,
} from './constants';

// ═══════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function CharacterCreatorV4() {
  const [cfg, setCfg] = useState(DEFAULT_STATE);
  const [tab, setTab] = useState('preloads');
  const [savedChars, setSavedChars] = useState(() => {
    try { return JSON.parse(localStorage.getItem('etherworld_chars_v4') || '[]'); }
    catch { return []; }
  });
  const [auraId, setAuraId] = useState(null);
  const [animMode, setAnimMode] = useState('idle');
  const [importedScene, setImportedScene] = useState(null);
  const [toast, setToast] = useState('');
  const groupRef = useRef(null);

  const set = useCallback((p) => setCfg((prev) => ({ ...prev, ...p })), []);
  const setAccessory = useCallback((key, value) => {
    setCfg((prev) => ({ ...prev, accessories: { ...prev.accessories, [key]: value } }));
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const applyPreload = (s) => {
    setCfg(s);
    setAuraId(s.activeAura || null);
    showToast(`✅ Préchargé : ${s.name}`);
  };

  const handleSave = () => {
    const updated = savedChars.filter((c) => c.name !== cfg.name);
    const next = [cfg, ...updated].slice(0, 40);
    setSavedChars(next);
    localStorage.setItem('etherworld_chars_v4', JSON.stringify(next));
    showToast('💾 Personnage sauvegardé !');
  };

  const handleImportState = (s) => { setCfg(s); showToast(`📥 État importé : ${s.name}`); };
  const handleImportModel = (scene, meta) => { setImportedScene(scene); showToast(`📦 Modèle importé : ${meta.fileName}`); };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ew_${cfg.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
  };

  const randomize = () => {
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const next = {
      ...cfg,
      race: rnd(RACES).id,
      bodyType: rnd(BODY_TYPES).id,
      skinColor: rnd(SKIN_PRESETS),
      hairStyle: rnd(HAIR_STYLES),
      hairColor: rnd(HAIR_COLORS),
      eyeColor: rnd(EYE_COLORS),
      outfit: rnd(OUTFITS).id,
      outfitColor: rnd(OUTFIT_COLORS),
      outfitColor2: rnd(OUTFIT_COLORS),
      equipment: rnd(EQUIPMENTS).id,
      height: 30 + Math.floor(Math.random() * 60),
      muscular: 20 + Math.floor(Math.random() * 70),
      fatness: 10 + Math.floor(Math.random() * 70),
      auraColor: rnd(AURA_COLORS),
      auraEnabled: Math.random() > 0.5,
    };
    setCfg(next);
    showToast('🎲 Personnage aléatoire généré !');
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#030609', overflow: 'hidden', fontFamily: 'system-ui, sans-serif', color: '#fff' }}>

      {/* ══════════════ LEFT PANEL ══════════════ */}
      <div style={{ width: '340px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#060912', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '11px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ color: '#aa55ff', fontWeight: 800, fontSize: '13px' }}>🧬 ETHERWORLD CREATOR v4.1</div>
          <div style={{ color: '#333', fontSize: '10px', marginTop: '1px' }}>GTA-RP Québec · 16 races · 22 anims · 18 auras</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: '1 0 auto',
              padding: '8px 5px',
              background: tab === t ? 'rgba(170,85,255,0.1)' : 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid #aa55ff' : '2px solid transparent',
              color: tab === t ? '#aa55ff' : '#444',
              cursor: 'pointer', fontSize: '12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              minWidth: '44px',
            }}>
              <span>{TAB_ICONS[t]}</span>
              <span style={{ fontSize: '6.5px', fontWeight: 700 }}>{t}</span>
            </button>
          ))}
        </div>

        {/* Actions rapides */}
        <div style={{ display: 'flex', gap: '4px', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={randomize} style={miniBtn('#aa55ff')}>🎲 Random</button>
          <button onClick={exportJSON} style={miniBtn('#44ffaa')}>📥 Export</button>
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '11px' }}>
          {tab === 'preloads' && <PreloadsTab onLoad={applyPreload} />}
          {tab === 'rp' && <RPTab cfg={cfg} set={set} />}
          {tab === 'auras' && (
            <AurasTab
              auraId={auraId}
              auraColor={cfg.auraColor || '#00d4ff'}
              auraEnabled={cfg.auraEnabled ?? false}
              onChange={(id) => { setAuraId(id); set({ activeAura: id }); }}
              onColorChange={(c) => set({ auraColor: c })}
              onToggle={() => set({ auraEnabled: !cfg.auraEnabled })}
            />
          )}
          {tab === 'animation' && <CinematicsTab mode={animMode} onChange={setAnimMode} />}
          {tab === 'import' && <ImportTab onStateImported={handleImportState} onModelImported={handleImportModel} />}

          {tab === 'identite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Field label="NOM">
                <input value={cfg.name} onChange={(e) => set({ name: e.target.value })} style={input} />
              </Field>
              <Field label="GENRE">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                  {['male', 'female', 'other'].map((g) => (
                    <button key={g} onClick={() => set({ gender: g })} style={btn(cfg.gender === g)}>
                      {g === 'male' ? '♂' : g === 'female' ? '♀' : '⚧'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="NATIONALITÉ">
                <select value={cfg.nationality} onChange={(e) => set({ nationality: e.target.value })} style={input}>
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="PERSONNALITÉ">
                <PillGroup items={PERSONALITIES} value={cfg.personality} onChange={(v) => set({ personality: v })} />
              </Field>
              <Field label="VOIX">
                <PillGroup items={VOICES} value={cfg.voice} onChange={(v) => set({ voice: v })} />
              </Field>
              <Field label="BIO">
                <textarea value={cfg.bio || ''} onChange={(e) => set({ bio: e.target.value })} rows={4} style={{ ...input, resize: 'none', fontFamily: 'inherit' }} />
              </Field>
            </div>
          )}

          {tab === 'race' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {RACES.map((r) => (
                <button key={r.id} onClick={() => set({ race: r.id })} style={{
                  padding: '9px 12px',
                  background: cfg.race === r.id ? 'rgba(170,85,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${cfg.race === r.id ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', gap: '10px', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '22px' }}>{r.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: cfg.race === r.id ? '#cc88ff' : '#bbb' }}>{r.label}</div>
                    <div style={{ fontSize: '9px', color: '#444', marginTop: '1px' }}>{r.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === 'corps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={sectionLabel}>TYPE DE CORPS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {BODY_TYPES.map((bt) => (
                    <button key={bt.id} onClick={() => set({ bodyType: bt.id })} style={{
                      padding: '10px 8px',
                      background: cfg.bodyType === bt.id ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${cfg.bodyType === bt.id ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '9px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                    }}>
                      <div style={{ width: `${28 * bt.scaleX}px`, height: '46px', background: cfg.bodyType === bt.id ? '#aa55ff' : '#334', borderRadius: '4px' }} />
                      <div style={{ fontSize: '9px', fontWeight: 700, color: cfg.bodyType === bt.id ? '#cc88ff' : '#777' }}>{bt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              {['height', 'muscular', 'fatness'].map((k) => (
                <div key={k}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={sectionLabel}>
                      {k === 'height' ? 'TAILLE' : k === 'muscular' ? 'MUSCULATURE' : 'EMBONPOINT'}
                    </span>
                    <span style={{ color: '#aa55ff', fontSize: '10px', fontWeight: 700 }}>{cfg[k]}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={cfg[k]} onChange={(e) => set({ [k]: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#aa55ff' }} />
                </div>
              ))}
              <Field label="COULEUR DE PEAU">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '7px' }}>
                  {SKIN_PRESETS.map((c) => (
                    <Swatch key={c} color={c} active={cfg.skinColor === c} onClick={() => set({ skinColor: c })} />
                  ))}
                </div>
                <input type="color" value={cfg.skinColor} onChange={(e) => set({ skinColor: e.target.value })} style={colorInput} />
              </Field>
            </div>
          )}

          {tab === 'visage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'COIFFURE',        list: HAIR_STYLES,    key: 'hairStyle' },
                { label: 'FORME VISAGE',    list: FACE_SHAPES,    key: 'faceShape' },
                { label: 'YEUX',            list: EYE_SHAPES,     key: 'eyeShape' },
                { label: 'NEZ',             list: NOSE_SHAPES,    key: 'noseShape' },
                { label: 'BOUCHE',          list: MOUTH_SHAPES,   key: 'mouthShape' },
                { label: 'SOURCILS',        list: EYEBROW_SHAPES, key: 'eyebrowShape' },
                { label: 'BARBE',           list: FACIAL_HAIR,    key: 'facialHair' },
              ].map(({ label, list, key }) => (
                <Field key={key} label={label}>
                  <PillGroup items={list} value={cfg[key]} onChange={(v) => set({ [key]: v })} />
                </Field>
              ))}
              <Field label="COULEUR CHEVEUX">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                  {HAIR_COLORS.map((c) => <Swatch key={c} color={c} active={cfg.hairColor === c} onClick={() => set({ hairColor: c })} />)}
                </div>
                <input type="color" value={cfg.hairColor} onChange={(e) => set({ hairColor: e.target.value })} style={colorInput} />
              </Field>
              <Field label="COULEUR YEUX">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                  {EYE_COLORS.map((c) => <Swatch key={c} color={c} active={cfg.eyeColor === c} onClick={() => set({ eyeColor: c })} round />)}
                </div>
                <input type="color" value={cfg.eyeColor} onChange={(e) => set({ eyeColor: e.target.value })} style={colorInput} />
              </Field>
            </div>
          )}

          {tab === 'tenue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label={`TYPE DE TENUE (${OUTFITS.length})`}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                  {OUTFITS.map((o) => (
                    <button key={o.id} onClick={() => set({ outfit: o.id })} style={{
                      padding: '7px 6px',
                      background: cfg.outfit === o.id ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${cfg.outfit === o.id ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '8px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                    }}>
                      <span style={{ fontSize: '18px' }}>{o.icon}</span>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: cfg.outfit === o.id ? '#cc88ff' : '#666' }}>{o.label}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="COULEUR PRINCIPALE">
                <ColorGrid colors={OUTFIT_COLORS} value={cfg.outfitColor} onChange={(c) => set({ outfitColor: c })} />
              </Field>
              <Field label="COULEUR SECONDAIRE">
                <ColorGrid colors={OUTFIT_COLORS} value={cfg.outfitColor2} onChange={(c) => set({ outfitColor2: c })} />
              </Field>
            </div>
          )}

          {tab === 'accessoires' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                ['LUNETTES',   ACC_GLASSES, 'glasses'],
                ['CHAPEAU',    ACC_HATS,    'hat'],
                ['BIJOUX',     ACC_JEWELRY, 'jewelry'],
                ['AILES',      ACC_WINGS,   'wings'],
                ['QUEUE',      ACC_TAIL,    'tail'],
                ['HALO',       ACC_HALO,    'halo'],
                ['MASQUE',     ACC_MASK,    'mask'],
                ['CAPE',       ACC_CAPE,    'cape'],
                ['SAC À DOS',  ACC_BACKPACK,'backpack'],
                ['MONTRE',     ACC_WATCH,   'watch'],
              ].map(([label, list, key]) => (
                <Field key={key} label={label}>
                  <PillGroup items={list} value={cfg.accessories?.[key]} onChange={(v) => setAccessory(key, v)} />
                </Field>
              ))}
            </div>
          )}

          {tab === 'equipement' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label={`ÉQUIPEMENT (${EQUIPMENTS.length})`}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {EQUIPMENTS.map((eq) => (
                    <button key={eq.id} onClick={() => set({ equipment: eq.id })} style={{
                      padding: '10px 8px',
                      background: cfg.equipment === eq.id ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${cfg.equipment === eq.id ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '9px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    }}>
                      <span style={{ fontSize: '20px' }}>{eq.icon}</span>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: cfg.equipment === eq.id ? '#cc88ff' : '#666' }}>{eq.label}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="COULEUR ÉQUIPEMENT">
                <input type="color" value={cfg.equipmentColor || '#aaaaaa'} onChange={(e) => set({ equipmentColor: e.target.value })} style={colorInput} />
              </Field>
            </div>
          )}

          {tab === 'sauvegarde' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={handleSave} style={btnPrimary}>💾 Sauvegarder</button>
              <button onClick={exportJSON} style={btnSecondary}>📥 Export JSON</button>
              <button onClick={() => { if (confirm('Nouveau personnage ?')) setCfg(DEFAULT_STATE); }} style={btnSecondary}>
                ✨ Nouveau personnage
              </button>
              {savedChars.length > 0 && (
                <div>
                  <div style={sectionLabel}>SAUVEGARDES ({savedChars.length})</div>
                  {savedChars.map((c) => (
                    <div key={c.name} style={{
                      display: 'flex', gap: '6px', padding: '8px 10px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px', marginBottom: '4px', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '10px', flex: 1, color: '#ccc' }}>{c.name}</span>
                      <button onClick={() => setCfg(c)} style={tinyBtn('#aa55ff')}>Charger</button>
                      <button onClick={() => { const u = savedChars.filter((x) => x.name !== c.name); setSavedChars(u); localStorage.setItem('etherworld_chars_v4', JSON.stringify(u)); }} style={{ background: 'none', border: 'none', color: '#ff4444', fontSize: '12px', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ RIGHT : 3D VIEWPORT ══════════════ */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 1.5, 3.8], fov: 45 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={<Html center><span style={{ color: '#aa55ff' }}>⏳ Chargement…</span></Html>}>
            <Scene cfg={cfg} groupRef={groupRef} auraId={auraId} animMode={animMode} />
            {importedScene && <primitive object={importedScene} position={[0, -0.5, 0]} />}
          </Suspense>
          <OrbitControls target={[0, 0.5, 0]} maxDistance={10} minDistance={1.5} enablePan={false} />
        </Canvas>

        {/* Fiche RP flottante */}
        {cfg.rp && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(3,6,9,0.75)', border: '1px solid rgba(170,85,255,0.25)',
            borderRadius: '8px', padding: '10px 14px', fontSize: '10px', color: '#888', minWidth: '180px',
          }}>
            <div style={{ color: '#cc88ff', fontWeight: 800, marginBottom: '4px', fontSize: '9px' }}>📇 FICHE RP</div>
            <div><b style={{ color: '#fff' }}>{cfg.rp.age} ans</b> · {DISTRICTS.find((d) => d.id === cfg.rp.district)?.label}</div>
            <div>💼 {JOBS.find((j) => j.id === cfg.rp.job)?.label || 'Sans-emploi'}</div>
            <div>💰 ${cfg.rp.cash.toLocaleString()}</div>
            <div style={{ color: '#ff4444', marginTop: '2px' }}>
              {'★'.repeat(cfg.rp.wantedLevel)}{'☆'.repeat(5 - cfg.rp.wantedLevel)}
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(170,85,255,0.9)', color: '#fff', padding: '8px 18px',
            borderRadius: '20px', fontSize: '11px', fontWeight: 700,
            boxShadow: '0 4px 20px rgba(170,85,255,0.5)', pointerEvents: 'none',
          }}>{toast}</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MICRO-COMPOSANTS (helpers UI)
// ═══════════════════════════════════════════════════════════

function Field({ label, children }) {
  return (
    <div>
      <div style={sectionLabel}>{label}</div>
      {children}
    </div>
  );
}

function PillGroup({ items, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {items.map((v) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: '4px 9px',
          background: value === v ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${value === v ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: '20px',
          color: value === v ? '#cc88ff' : '#666',
          fontSize: '9px', fontWeight: 700, cursor: 'pointer',
        }}>{v}</button>
      ))}
    </div>
  );
}

function Swatch({ color, active, onClick, round }) {
  return (
    <button onClick={onClick} style={{
      width: '24px', height: '24px', background: color,
      border: `2px solid ${active ? '#fff' : 'rgba(255,255,255,0.15)'}`,
      borderRadius: round ? '50%' : '5px', cursor: 'pointer',
    }} />
  );
}

function ColorGrid({ colors, value, onChange }) {
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
        {colors.map((c) => (
          <button key={c} onClick={() => onChange(c)} style={{
            width: '22px', height: '22px', background: c,
            border: `2px solid ${value === c ? '#fff' : 'transparent'}`,
            borderRadius: '4px', cursor: 'pointer',
          }} />
        ))}
      </div>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={colorInput} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════
const sectionLabel = { color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' };

const input = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '7px',
  padding: '7px 10px',
  color: '#fff',
  fontSize: '11px',
  outline: 'none',
  boxSizing: 'border-box',
};

const colorInput = { width: '100%', height: '26px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', background: 'transparent', padding: '2px' };

const btnPrimary = { padding: '10px', background: 'rgba(170,85,255,0.2)', border: '1px solid rgba(170,85,255,0.4)', borderRadius: '9px', color: '#cc88ff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' };

const btnSecondary = { padding: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: '#666', fontSize: '10px', fontWeight: 700, cursor: 'pointer' };

const miniBtn = (color) => ({ flex: 1, padding: '5px', background: `${color}22`, border: `1px solid ${color}55`, borderRadius: '6px', color: color, fontSize: '10px', fontWeight: 700, cursor: 'pointer' });

const tinyBtn = (color) => ({ background: `${color}22`, border: `1px solid ${color}55`, borderRadius: '5px', color: color, fontSize: '9px', padding: '3px 7px', cursor: 'pointer' });

const btn = (active) => ({
  padding: '8px 4px',
  background: active ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.03)',
  border: `1px solid ${active ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.06)'}`,
  borderRadius: '7px',
  color: active ? '#cc88ff' : '#666',
  fontSize: '10px', fontWeight: 700, cursor: 'pointer',
});
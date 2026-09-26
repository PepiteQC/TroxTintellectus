// src/troxtmod3d/tabs/RPTab.jsx
// Profil RP GTA-style (AUCUN stat RPG fantastique)

import React from 'react';
import { JOBS, GANGS, CRIMINAL_RECORDS, VEHICLES, DISTRICTS } from '../constants';

export function RPTab({ cfg, set }) {
  const rp = cfg.rp;
  const setRp = (p) => set({ rp: { ...rp, ...p } });
  const setLic = (k) => setRp({ licenses: { ...rp.licenses, [k]: !rp.licenses[k] } });
  const selectedJob = JOBS.find((j) => j.id === rp.job);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#444', fontSize: '9px', fontWeight: 700 }}>ÂGE</span>
          <span style={{ color: '#aa55ff', fontSize: '11px', fontWeight: 800 }}>{rp.age} ans</span>
        </div>
        <input type="range" min={18} max={75} value={rp.age} onChange={(e) => setRp({ age: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#aa55ff' }} />
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' }}>QUARTIER DE RÉSIDENCE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {DISTRICTS.map((d) => (
            <button key={d.id} onClick={() => setRp({ district: d.id })} style={pill(rp.district === d.id)}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' }}>MÉTIER — {selectedJob?.label || 'Aucun'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', maxHeight: '240px', overflowY: 'auto' }}>
          {JOBS.map((j) => (
            <button key={j.id} onClick={() => setRp({ job: j.id, salary: j.salary })} style={{
              padding: '7px 6px',
              background: rp.job === j.id ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${rp.job === j.id ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '8px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            }}>
              <span style={{ fontSize: '16px' }}>{j.icon}</span>
              <span style={{ fontSize: '8px', fontWeight: 700, color: rp.job === j.id ? '#cc88ff' : '#888', textAlign: 'center' }}>{j.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>TITRE / POSTE</div>
        <input value={rp.jobTitle} onChange={(e) => setRp({ jobTitle: e.target.value })} placeholder="ex: Sergent-détective" style={input} />
        <input value={rp.employer} onChange={(e) => setRp({ employer: e.target.value })} placeholder="Entreprise / Organisation" style={{ ...input, marginTop: '6px' }} />
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' }}>AFFILIATION / GANG</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
          {GANGS.map((g) => (
            <button key={g.id} onClick={() => setRp({ gang: g.id })} style={{
              padding: '4px 10px',
              background: rp.gang === g.id ? `${g.color}33` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${rp.gang === g.id ? `${g.color}99` : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '20px', color: rp.gang === g.id ? g.color : '#666',
              fontSize: '9px', fontWeight: 700, cursor: 'pointer',
            }}>
              {g.icon} {g.label}
            </button>
          ))}
        </div>
        <input value={rp.gangRank} onChange={(e) => setRp({ gangRank: e.target.value })} placeholder="Rang dans le gang" style={input} />
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' }}>CASIER JUDICIAIRE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {CRIMINAL_RECORDS.map((c) => (
            <button key={c.id} onClick={() => setRp({ criminalRecord: c.id })} style={{
              padding: '4px 10px',
              background: rp.criminalRecord === c.id ? `${c.color}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${rp.criminalRecord === c.id ? `${c.color}88` : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '20px', color: rp.criminalRecord === c.id ? c.color : '#666',
              fontSize: '9px', fontWeight: 700, cursor: 'pointer',
            }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#444', fontSize: '9px', fontWeight: 700 }}>NIVEAU DE RECHERCHE</span>
          <span style={{ color: '#ff4444', fontSize: '12px', fontWeight: 800 }}>
            {'★'.repeat(rp.wantedLevel)}{'☆'.repeat(5 - rp.wantedLevel)}
          </span>
        </div>
        <input type="range" min={0} max={5} value={rp.wantedLevel} onChange={(e) => setRp({ wantedLevel: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#ff0000' }} />
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' }}>FINANCES</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div>
            <div style={{ fontSize: '8px', color: '#666', marginBottom: '3px' }}>💵 CASH</div>
            <input type="number" value={rp.cash} onChange={(e) => setRp({ cash: parseInt(e.target.value) || 0 })} style={inputMoney} />
          </div>
          <div>
            <div style={{ fontSize: '8px', color: '#666', marginBottom: '3px' }}>🏦 BANQUE</div>
            <input type="number" value={rp.bank} onChange={(e) => setRp({ bank: parseInt(e.target.value) || 0 })} style={inputMoney} />
          </div>
        </div>
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' }}>PERMIS & LICENCES</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {[
            ['conduire', '🚗 Conduire'],
            ['armes',    '🔫 Armes'],
            ['vol',      '✈️ Vol'],
            ['bateau',   '⛵ Bateau'],
            ['chasse',   '🦌 Chasse'],
            ['peche',    '🎣 Pêche'],
            ['taxi',     '🚖 Taxi'],
          ].map(([k, label]) => (
            <button key={k} onClick={() => setLic(k)} style={{
              padding: '6px 8px',
              background: rp.licenses[k] ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${rp.licenses[k] ? 'rgba(0,200,150,0.45)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '7px', color: rp.licenses[k] ? '#44ffaa' : '#666',
              fontSize: '10px', fontWeight: 700, cursor: 'pointer',
            }}>
              {rp.licenses[k] ? '✅' : '❌'} {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' }}>VÉHICULE PERSONNEL</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
          {VEHICLES.map((v) => (
            <button key={v.id} onClick={() => setRp({ vehicleType: v.id })} style={pill(rp.vehicleType === v.id)}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        <input value={rp.vehicleModel} onChange={(e) => setRp({ vehicleModel: e.target.value })} placeholder="Modèle (ex: Bravado Banshee)" style={{ ...input, marginBottom: '5px' }} />
        <input type="color" value={rp.vehicleColor} onChange={(e) => setRp({ vehicleColor: e.target.value })} style={{ width: '100%', height: '26px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', background: 'transparent', padding: '2px' }} />
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>NUMÉRO DE TÉLÉPHONE RP</div>
        <input value={rp.phone} onChange={(e) => setRp({ phone: e.target.value })} placeholder="514-555-0000" style={{ ...input, color: '#44ff88', fontFamily: 'monospace' }} />
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>BACKSTORY RP</div>
        <textarea value={rp.backstory} onChange={(e) => setRp({ backstory: e.target.value })} rows={4} placeholder="D'où vient ton personnage ?" style={{ ...input, resize: 'none', fontFamily: 'inherit' }} />
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>OBJECTIFS RP</div>
        <textarea value={rp.goals} onChange={(e) => setRp({ goals: e.target.value })} rows={3} placeholder="Que veut accomplir ton personnage ?" style={{ ...input, resize: 'none', fontFamily: 'inherit' }} />
      </div>

      <div style={{ padding: '10px', background: 'rgba(170,85,255,0.06)', border: '1px solid rgba(170,85,255,0.2)', borderRadius: '8px' }}>
        <div style={{ color: '#cc88ff', fontSize: '9px', fontWeight: 700, marginBottom: '6px' }}>📇 FICHE RP</div>
        <div style={{ fontSize: '10px', color: '#888', lineHeight: 1.6 }}>
          <div><b style={{ color: '#fff' }}>{cfg.name}</b>, {rp.age} ans</div>
          <div>📍 {DISTRICTS.find((d) => d.id === rp.district)?.label}</div>
          <div>💼 {selectedJob?.label} — {rp.jobTitle || 'Sans titre'}</div>
          {rp.gang !== 'aucun' && <div>🎭 {GANGS.find((g) => g.id === rp.gang)?.label} {rp.gangRank && `(${rp.gangRank})`}</div>}
          <div>💰 ${rp.cash.toLocaleString()} cash · ${rp.bank.toLocaleString()} banque</div>
          <div>🚗 {rp.vehicleModel || 'Aucun véhicule'}</div>
          <div style={{ marginTop: '4px' }}>
            <span style={{ color: '#ff4444', fontWeight: 800 }}>{'★'.repeat(rp.wantedLevel)}{'☆'.repeat(5 - rp.wantedLevel)}</span> · {CRIMINAL_RECORDS.find((c) => c.id === rp.criminalRecord)?.label}
          </div>
        </div>
      </div>
    </div>
  );
}

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

const inputMoney = { ...input, color: '#44ff88', fontWeight: 700 };

const pill = (active) => ({
  padding: '4px 10px',
  background: active ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.04)',
  border: `1px solid ${active ? 'rgba(170,85,255,0.45)' : 'rgba(255,255,255,0.07)'}`,
  borderRadius: '20px',
  color: active ? '#cc88ff' : '#666',
  fontSize: '9px',
  fontWeight: 700,
  cursor: 'pointer',
});
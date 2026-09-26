// src/troxtmod3d/tabs/ImportTab.jsx
import React, { useState } from 'react';
import { ModelImporter } from '../ModelImporter';

export function ImportTab({ onStateImported, onModelImported }) {
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file) => {
    setErr(''); setMeta(null); setLoading(true);
    try {
      const result = await ModelImporter.parseModelFile(file);
      setMeta(result.metadata);
      if (result.characterState) onStateImported(result.characterState);
      else onModelImported(result.sceneOrMesh, result.metadata);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const handleURL = async () => {
    if (!url.trim()) return;
    setErr(''); setMeta(null); setLoading(true);
    try {
      const result = await ModelImporter.parseFromURL(url.trim());
      setMeta(result.metadata);
      onModelImported(result.sceneOrMesh, result.metadata);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
        style={{
          padding: '24px 16px',
          background: dragOver ? 'rgba(170,85,255,0.15)' : 'rgba(255,255,255,0.03)',
          border: `2px dashed ${dragOver ? 'rgba(170,85,255,0.6)' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: '12px', textAlign: 'center', transition: 'all 0.2s',
        }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
        <div style={{ color: '#cc88ff', fontSize: '12px', fontWeight: 800, marginBottom: '4px' }}>Glisser-déposer un fichier</div>
        <div style={{ color: '#555', fontSize: '10px' }}>GLB · GLTF · FBX · JSON</div>
        <input type="file" accept=".glb,.gltf,.fbx,.json" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} style={{ display: 'none' }} id="import-file-input" />
        <label htmlFor="import-file-input" style={{
          display: 'inline-block', marginTop: '12px', padding: '8px 16px',
          background: 'rgba(170,85,255,0.2)', border: '1px solid rgba(170,85,255,0.4)',
          borderRadius: '8px', color: '#cc88ff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
        }}>📁 Choisir un fichier</label>
      </div>

      <div>
        <div style={{ color: '#444', fontSize: '9px', fontWeight: 700, marginBottom: '5px' }}>OU URL DISTANTE</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://...glb" style={{
            flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '7px', padding: '8px 10px', color: '#fff', fontSize: '11px', outline: 'none',
          }} />
          <button onClick={handleURL} style={{
            padding: '8px 12px', background: 'rgba(0,200,150,0.15)',
            border: '1px solid rgba(0,200,150,0.35)', borderRadius: '7px',
            color: '#44ffaa', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
          }}>⬇ Load</button>
        </div>
      </div>

      {loading && <div style={msgBox('#aa55ff')}>⏳ Analyse en cours…</div>}
      {err && <div style={msgBox('#ff4444')}>❌ {err}</div>}

      {meta && (
        <div style={{ padding: '10px', background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.25)', borderRadius: '8px' }}>
          <div style={{ color: '#44ffaa', fontSize: '10px', fontWeight: 800, marginBottom: '6px' }}>✅ {meta.fileName}</div>
          <div style={{ fontSize: '9px', color: '#888', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span>Format : <b style={{ color: '#fff' }}>{meta.format.toUpperCase()}</b></span>
            <span>Taille : <b style={{ color: '#fff' }}>{meta.fileSizeFormatted}</b></span>
            <span>Maillages : <b style={{ color: '#fff' }}>{meta.meshCount}</b></span>
            <span>Triangles : <b style={{ color: '#fff' }}>{meta.triangleCount.toLocaleString()}</b></span>
            <span>Vertices : <b style={{ color: '#fff' }}>{meta.vertexCount.toLocaleString()}</b></span>
            <span>Os : <b style={{ color: '#fff' }}>{meta.boneCount}</b></span>
            <span>Animations : <b style={{ color: '#fff' }}>{meta.animations.length}</b></span>
          </div>
        </div>
      )}
    </div>
  );
}

const msgBox = (color) => ({
  padding: '10px',
  background: `${color}18`,
  border: `1px solid ${color}44`,
  borderRadius: '8px',
  color: color,
  fontSize: '10px',
  textAlign: 'center',
});
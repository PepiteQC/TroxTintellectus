// src/components/TroxtSyncDebug.jsx
// Panneau de debug pour la sync (dev uniquement)

import React, { useEffect, useState } from 'react';
import { getSyncStats } from '../store-troxt-sync.js';

export function TroxtSyncDebug() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setStats(getSyncStats()), 500);
    return () => clearInterval(id);
  }, []);

  if (!stats) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 10, left: 10, zIndex: 9999,
      background: 'rgba(3,6,9,0.9)', border: '1px solid rgba(170,85,255,0.4)',
      borderRadius: 8, padding: '8px 12px', fontSize: 10,
      color: '#ccc', fontFamily: 'monospace', minWidth: 180,
    }}>
      <div style={{ color: '#aa55ff', fontWeight: 800, marginBottom: 4 }}>🔌 TROXT SYNC</div>
      <div>📥 IN: <b style={{ color: '#44ff88' }}>{stats.eventsIn}</b></div>
      <div>📤 OUT: <b style={{ color: '#44ffaa' }}>{stats.eventsOut}</b></div>
      <div>❌ ERR: <b style={{ color: '#ff4444' }}>{stats.errors}</b></div>
      <div>📥 Queue: <b style={{ color: '#ffbb44' }}>{stats.queue}</b></div>
      <div>🔁 Reconnects: <b>{stats.reconnects}</b></div>
      <div>⚡ RTT: <b style={{ color: stats.rtt > 200 ? '#ff4444' : '#44ff88' }}>{stats.rtt}ms</b></div>
      {stats.lag && <div style={{ color: '#ff4444', fontWeight: 800 }}>⚠️ LAG DETECTED</div>}
    </div>
  );
}
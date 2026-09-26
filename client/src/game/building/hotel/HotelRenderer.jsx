/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/BUILDING/HOTEL/HOTELRENDERER.JSX
 * Rendu Canvas 2D isométrique / top-down pour les couloirs d'hôtel
 * ═══════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • RAF stable (indépendant de l'état React, via refs)
 *   • Canvas DPR-aware + resize observer
 *   • Layout dynamique : les chambres s'adaptent à la largeur
 *   • Subscribe : diff-check avant setState
 *   • Compte à rebours lockout affiché en secondes
 *   • Gardes null sur forceLock / forceUnlock / toggleOpen
 *   • Erreurs loggées (console.warn)
 *   • Ref pour éviter les closures stale
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/building/hotel/HotelRenderer.jsx
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  hotelRealtimeSecurity,
  HOTEL_ROOMS,
  makeAccessAttempt,
} from './HotelRealtimeSecurity.js';

const SIG = 'TROXT⬡';

// ─── Palette (source unique) ───────────────────────────────────────────────
const PALETTE = Object.freeze({
  bg:          '#0f172a',
  bgPanel:     '#090d16',
  textMuted:   '#94a3b8',
  textMain:    '#e2e8f0',
  textStatus:  '#cbd5e1',
  corridor:    '#1e293b',
  corridorEdge:'#334155',
  roomBg:      '#0f172a',
  roomSelected:'#1e1b4b',
  roomEdge:    '#334155',
  roomEdgeSel: '#6366f1',
  doorFrame:   '#475569',
  stateLocked:   '#ef4444',
  stateOpen:     '#3b82f6',
  stateUnlocked: '#22c55e',
  stateLockout:  '#a855f7',
});

const stateColor = (state) => {
  switch (state) {
    case 'open':     return PALETTE.stateOpen;
    case 'unlocked': return PALETTE.stateUnlocked;
    case 'lockout':  return PALETTE.stateLockout;
    case 'locked':
    default:         return PALETTE.stateLocked;
  }
};

const stateLabel = (state) => {
  switch (state) {
    case 'open':     return 'OUVERTE';
    case 'unlocked': return 'DÉVERROUILLÉ';
    case 'lockout':  return 'LOCKOUT';
    case 'locked':
    default:         return 'VERROUILLÉ';
  }
};

// ─── COMPOSANT ─────────────────────────────────────────────────────────────

export function HotelRenderer() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Refs de rendu (indépendants du cycle React)
  const doorStatesRef = useRef(hotelRealtimeSecurity.getSnapshot());
  const selectedRoomRef = useRef('villa_nova');

  // État React (UI)
  const [selectedRoomId, setSelectedRoomId] = useState('villa_nova');
  const [cardUidInput, setCardUidInput] = useState('CARD-1234');
  const [pinInput, setPinInput] = useState('1234');
  const [lastFeedback, setLastFeedback] = useState('');
  const [doorStates, setDoorStates] = useState(hotelRealtimeSecurity.getSnapshot());
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 220 });

  // Synchronise les refs avec l'état React
  useEffect(() => { selectedRoomRef.current = selectedRoomId; }, [selectedRoomId]);
  useEffect(() => { doorStatesRef.current = doorStates; }, [doorStates]);

  // ─── Subscribe au store (avec diff-check) ────────────────────────────────
  useEffect(() => {
    const unsub = hotelRealtimeSecurity.subscribe(() => {
      const snap = hotelRealtimeSecurity.getSnapshot();
      setDoorStates((prev) => {
        // 🔧 BOOST : diff grossier par référence des states par door
        let changed = false;
        const keys = Object.keys(snap);
        if (keys.length !== Object.keys(prev).length) changed = true;
        else {
          for (const k of keys) {
            if (prev[k] !== snap[k]) { changed = true; break; }
          }
        }
        return changed ? { ...snap } : prev;
      });
    });
    return () => { unsub(); };
  }, []);

  // ─── Resize observer (canvas DPR-aware) ─────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.max(320, Math.floor(entries[0].contentRect.width));
      const h = 220;
      setCanvasSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Boucle RAF stable (n'écoute plus [doorStates, selectedRoomId]) ─────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    let disposed = false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 🔧 BOOST : DPR handling
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvasSize.w;
    const H = canvasSize.h;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const render = () => {
      if (disposed) return;
      const states = doorStatesRef.current;
      const selected = selectedRoomRef.current;

      // ── Fond
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(0, 0, W, H);

      // ── Titre
      ctx.fillStyle = PALETTE.textMuted;
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText('HOTEL ETHERWORLD — SÉCURITÉ DES PORTES & COULOIRS 2D', 16, 24);

      // ── Couloir
      const padX = 24;
      const corrY = 60;
      const corrH = 100;
      const corrW = W - padX * 2;
      ctx.fillStyle = PALETTE.corridor;
      ctx.fillRect(padX, corrY, corrW, corrH);
      ctx.strokeStyle = PALETTE.corridorEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(padX, corrY, corrW, corrH);

      // ── Distribution dynamique des chambres ──────────────────────────────
      const count = HOTEL_ROOMS.length;
      const slotW = corrW / count;
      const roomW = Math.min(slotW - 24, 160);
      const doorW = Math.min(slotW * 0.55, 80);

      HOTEL_ROOMS.forEach((room, index) => {
        const slotCenter = padX + slotW * (index + 0.5);
        const roomX = slotCenter - roomW / 2;
        const doorX = slotCenter - doorW / 2;

        const doorState = states[hotelRealtimeSecurity.getRoomDoorState(room.id)?.doorId]
          || hotelRealtimeSecurity.getRoomDoorState(room.id);

        const isSelected = room.id === selected;

        // ── Boîte de chambre
        ctx.fillStyle = isSelected ? PALETTE.roomSelected : PALETTE.roomBg;
        ctx.fillRect(roomX, corrY - 52, roomW, 46);
        ctx.strokeStyle = isSelected ? PALETTE.roomEdgeSel : PALETTE.roomEdge;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(roomX, corrY - 52, roomW, 46);

        // ── Nom de chambre (tronqué si trop long)
        ctx.fillStyle = PALETTE.textMain;
        ctx.font = '700 12px system-ui, sans-serif';
        const name = room.name.length > 20 ? room.name.slice(0, 18) + '…' : room.name;
        ctx.fillText(name, roomX + 8, corrY - 28);

        // ── Cadre de porte
        ctx.fillStyle = PALETTE.doorFrame;
        ctx.fillRect(doorX, corrY, doorW, 15);

        // ── État
        const color = stateColor(doorState?.state);
        const label = stateLabel(doorState?.state);

        // LED pulse si lockout
        const isLockout = doorState?.state === 'lockout';
        const pulse = isLockout ? 0.6 + 0.4 * Math.sin(performance.now() / 200) : 1;

        ctx.globalAlpha = pulse;
        ctx.fillStyle = color;
        ctx.fillRect(doorX + 5, corrY + 2, doorW - 10, 11);
        ctx.globalAlpha = 1;

        // ── Statut texte
        ctx.fillStyle = PALETTE.textStatus;
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(label, doorX + 4, corrY + 30);

        // ── Compte à rebours lockout
        if (isLockout && doorState?.lockoutUntil) {
          const remainMs = Math.max(0, doorState.lockoutUntil - Date.now());
          const s = (remainMs / 1000).toFixed(1);
          ctx.fillStyle = PALETTE.stateLockout;
          ctx.fillText(`(${s}s)`, doorX + 4, corrY + 44);
        }
      });

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
    };
  }, [canvasSize.w, canvasSize.h]); // 🔧 BOOST : ne dépend plus de doorStates ni selectedRoom

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleAttempt = async (method) => {
    try {
      const res = await makeAccessAttempt({
        roomId: selectedRoomId,
        method,
        cardUid: cardUidInput,
        pin: pinInput,
      });
      setLastFeedback(`[${res.granted ? 'OK' : 'REFUS'}] ${res.message}`);
    } catch (err) {
      // 🔧 BOOST : log explicite
      console.warn(`[${SIG}·HotelRenderer] access attempt failed`, err);
      setLastFeedback(`Erreur: ${err?.message || err}`);
    }
  };

  const handleToggleDoor = () => {
    const door = hotelRealtimeSecurity.getRoomDoorState(selectedRoomId);
    if (!door) return;
    hotelRealtimeSecurity.toggleOpen(door.doorId);
  };

  const handleForceLock = () => {
    const door = hotelRealtimeSecurity.getRoomDoorState(selectedRoomId);
    if (!door) return;
    hotelRealtimeSecurity.forceLock(door.doorId);
  };

  const handleForceUnlock = () => {
    const door = hotelRealtimeSecurity.getRoomDoorState(selectedRoomId);
    if (!door) return;
    hotelRealtimeSecurity.forceUnlock(door.doorId);
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        background: PALETTE.bgPanel,
        color: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          maxWidth: canvasSize.w,
          borderRadius: 8,
          border: `1px solid ${PALETTE.corridorEdge}`,
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: PALETTE.textMuted, marginBottom: 4 }}>
            Chambre sélectionnée
          </label>
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            style={styles.input}
          >
            {HOTEL_ROOMS.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              type="text"
              placeholder="Card UID"
              value={cardUidInput}
              onChange={(e) => setCardUidInput(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            />
            <button
              onClick={() => handleAttempt('magnetic_card')}
              style={{ ...styles.btn, background: '#2563eb' }}
            >
              Passer Carte
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="text"
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            />
            <button
              onClick={() => handleAttempt('numpad')}
              style={{ ...styles.btn, background: '#059669' }}
            >
              Valider PIN
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, color: PALETTE.textMuted, marginBottom: 4 }}>
            Actions rapides
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleToggleDoor} style={{ ...styles.btn, background: '#4f46e5' }}>
              Pousser / Tirer la Porte
            </button>
            <button onClick={handleForceLock} style={{ ...styles.btn, background: '#dc2626' }}>
              Force Lock (Staff)
            </button>
            <button onClick={handleForceUnlock} style={{ ...styles.btn, background: '#16a34a' }}>
              Force Unlock (Staff)
            </button>
          </div>

          {lastFeedback && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                background: '#0284c715',
                border: '1px solid #0284c730',
                color: '#38bdf8',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {lastFeedback}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles partagés ───────────────────────────────────────────────────────
const styles = {
  input: {
    padding: 8,
    background: '#1e293b',
    border: '1px solid #475569',
    color: '#fff',
    borderRadius: 6,
    fontSize: 13,
  },
  btn: {
    padding: '8px 12px',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
};

export default HotelRenderer;
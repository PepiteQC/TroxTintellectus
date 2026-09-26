/**
 * ══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/VEHICLE/VEHICLETUNINGWORKSHOP.JSX
 * Atelier de tuning & customisation 3D (garage overlay)
 * ══════════════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • SVG preview réagit aux angles (perspective CSS 3D réelle)
 *   • IDs SVG uniques via useId() → multi-instances safe
 *   • Draft isolé du store jusqu'à confirmation
 *   • Sync auto si currentSavedTuning change externe
 *   • Guard complet (ownedParts, formatCad, costs ≥ 0)
 *   • Double-click prevention sur Achète
 *   • Feedback auto-dismiss (6 s)
 *   • isParkedInsideGarage utilisé (bouton Acheter désactivé si pas dedans)
 *   • Validation véhicule ↔ bodykit
 *   • type="button" partout + aria-label sur les icônes
 *   • useMemo sur toutes les dérivées
 *   • resetDraft() exposé
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/vehicle/VehicleTuningWorkshop.jsx
 */

import React, { useState, useMemo, useEffect, useRef, useId, useCallback } from 'react';
import {
  Palette, Disc, Boxes, Check, Sparkles, RotateCcw, Eye,
  Sliders, DollarSign, AlertCircle, Truck,
} from 'lucide-react';
import { useGameStore } from './store.js';
import {
  TUNING_COLORS,
  TUNING_FINISHES,
  TUNING_RIMS,
  TUNING_BODYKITS,
} from './vehicleTuning.js';
import { formatCad } from './commerce.js';
import { inventoryAudio } from './inventoryAudio.js';

const SIG = 'TROXT⬡';
const FEEDBACK_TIMEOUT_MS = 6000;

// ─── Helpers ───────────────────────────────────────────────────────────────

const safeFormatCad = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? formatCad(n) : formatCad(0);
};

const safeArray = (v) => (Array.isArray(v) ? v : []);

const findByOrFirst = (list, id) => {
  const arr = safeArray(list);
  return arr.find((x) => x.id === id) || arr[0] || null;
};

const clampCost = (v) => Math.max(0, Number(v) || 0);

// Angles de preview → transform CSS 3D (le SVG reste en 2D profil)
const PREVIEW_TRANSFORMS = Object.freeze({
  front34: 'perspective(900px) rotateX(6deg) rotateY(-28deg) scale(1.02)',
  side:    'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)',
  rear34:  'perspective(900px) rotateX(6deg) rotateY(28deg) scale(1.02) scaleX(-1)',
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function VehicleTuningWorkshop({
  garageName,
  isParkedInsideGarage = true,
}) {
  const store = useGameStore();
  const currentSavedTuning = store.vehicleTuning;

  // 🔧 BOOST : IDs SVG uniques par instance
  const uid = useId().replace(/[:]/g, '');
  const IDS = useMemo(() => ({
    body:   `bodyGrad_${uid}`,
    window: `windowGrad_${uid}`,
    rim:    `rimGrad_${uid}`,
  }), [uid]);

  // ─── Draft local (isolé du store jusqu'à confirmation) ─────────────────
  const [draftTuning, setDraftTuning] = useState(() => ({ ...currentSavedTuning }));
  const [activeCategory, setActiveCategory] = useState('paint');
  const [previewAngle, setPreviewAngle] = useState('front34');
  const [feedback, setFeedback] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Ref pour le timeout feedback
  const feedbackTimerRef = useRef(null);

  // 🔧 BOOST : sync si le store change externe (load async, reset…)
  useEffect(() => {
    setDraftTuning((prev) => {
      if (
        prev.colorId === currentSavedTuning.colorId &&
        prev.finish === currentSavedTuning.finish &&
        prev.rimsId === currentSavedTuning.rimsId &&
        prev.bodykitId === currentSavedTuning.bodykitId
      ) {
        return prev; // pas de changement externe → on garde le draft
      }
      // Changement externe détecté → on resync le draft
      return { ...currentSavedTuning };
    });
  }, [
    currentSavedTuning.colorId,
    currentSavedTuning.finish,
    currentSavedTuning.rimsId,
    currentSavedTuning.bodykitId,
  ]);

  // 🔧 BOOST : feedback auto-dismiss
  useEffect(() => {
    if (!feedback) return;
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_TIMEOUT_MS);
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [feedback]);

  // ─── Owned parts (safe) ────────────────────────────────────────────────
  const ownedColors   = useMemo(() => safeArray(draftTuning.ownedParts?.colors),   [draftTuning.ownedParts]);
  const ownedRims     = useMemo(() => safeArray(draftTuning.ownedParts?.rims),     [draftTuning.ownedParts]);
  const ownedBodykits = useMemo(() => safeArray(draftTuning.ownedParts?.bodykits), [draftTuning.ownedParts]);

  // ─── Dérivées memoïsées ────────────────────────────────────────────────
  const currentColor    = useMemo(() => findByOrFirst(TUNING_COLORS, draftTuning.colorId),    [draftTuning.colorId]);
  const currentRim      = useMemo(() => findByOrFirst(TUNING_RIMS, draftTuning.rimsId),       [draftTuning.rimsId]);
  const currentBodykit  = useMemo(() => findByOrFirst(TUNING_BODYKITS, draftTuning.bodykitId), [draftTuning.bodykitId]);
  const currentFinish   = useMemo(() => findByOrFirst(TUNING_FINISHES, draftTuning.finish),    [draftTuning.finish]);

  // ─── Coûts (clamp ≥ 0) ─────────────────────────────────────────────────
  const colorCost    = useMemo(() => clampCost(ownedColors.includes(draftTuning.colorId)    ? 0 : currentColor?.price   ?? 0), [ownedColors, draftTuning.colorId, currentColor]);
  const finishCost   = useMemo(() => clampCost(draftTuning.finish === currentSavedTuning.finish ? 0 : currentFinish?.price ?? 0), [draftTuning.finish, currentSavedTuning.finish, currentFinish]);
  const rimCost      = useMemo(() => clampCost(ownedRims.includes(draftTuning.rimsId)      ? 0 : currentRim?.price     ?? 0), [ownedRims, draftTuning.rimsId, currentRim]);
  const bodykitCost  = useMemo(() => clampCost(ownedBodykits.includes(draftTuning.bodykitId) ? 0 : currentBodykit?.price ?? 0), [ownedBodykits, draftTuning.bodykitId, currentBodykit]);

  const totalUpgradeCost = colorCost + finishCost + rimCost + bodykitCost;

  const hasChanges = useMemo(
    () =>
      draftTuning.colorId    !== currentSavedTuning.colorId    ||
      draftTuning.finish     !== currentSavedTuning.finish     ||
      draftTuning.rimsId     !== currentSavedTuning.rimsId     ||
      draftTuning.bodykitId  !== currentSavedTuning.bodykitId,
    [draftTuning, currentSavedTuning]
  );

  // ─── Handlers ──────────────────────────────────────────────────────────

  const setDraft = useCallback((patch) => {
    setDraftTuning((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectColor = useCallback((color) => {
    setDraft({ colorId: color.id, colorHex: color.hex });
  }, [setDraft]);

  const handleSelectFinish = useCallback((finishId) => {
    setDraft({ finish: finishId });
  }, [setDraft]);

  const handleSelectRims = useCallback((rim) => {
    setDraft({ rimsId: rim.id });
  }, [setDraft]);

  const handleSelectBodykit = useCallback((kit) => {
    setDraft({ bodykitId: kit.id });
  }, [setDraft]);

  const handleReset = useCallback(() => {
    setDraftTuning({ ...currentSavedTuning });
    setFeedback({ msg: 'Aperçu réinitialisé à votre configuration actuelle.', isError: false });
  }, [currentSavedTuning]);

  const handleConfirmPurchase = useCallback(async () => {
    if (isPurchasing) return;              // 🔧 BOOST : double-click prevention
    if (!hasChanges && totalUpgradeCost === 0) return;

    if (!isParkedInsideGarage) {
      inventoryAudio.playConsumeSound('error');
      setFeedback({ msg: 'Le véhicule doit être stationné à l\'intérieur du garage.', isError: true });
      return;
    }

    const cash = Number(store.cash) || 0;
    if (totalUpgradeCost > 0 && cash < totalUpgradeCost) {
      inventoryAudio.playConsumeSound('error');
      setFeedback({
        msg: `Fonds insuffisants ! Il vous manque ${safeFormatCad(totalUpgradeCost - cash)} pour installer ces pièces.`,
        isError: true,
      });
      return;
    }

    setIsPurchasing(true);
    try {
      const result = store.purchaseVehicleTuning(draftTuning, totalUpgradeCost);
      setFeedback({ msg: result.message, isError: !result.success });
      if (result.success) {
        // 🔧 BOOST : on ne garde que les changements réellement appliqués
        setDraftTuning((prev) => ({ ...prev, ...draftTuning }));
      }
    } catch (err) {
      console.warn(`[${SIG}·Tuning] purchase failed`, err);
      setFeedback({ msg: `Erreur : ${err?.message || err}`, isError: true });
    } finally {
      setIsPurchasing(false);
    }
  }, [isPurchasing, hasChanges, totalUpgradeCost, isParkedInsideGarage, store, draftTuning]);

  // ─── SVG helpers ───────────────────────────────────────────────────────
  const bodyColor  = draftTuning.colorHex || '#64748b';
  const finishAlpha = draftTuning.finish === 'matte' ? 0.75 : 0.45;
  const bodykitId  = draftTuning.bodykitId;
  const rimId      = draftTuning.rimsId;

  const rimStops = useMemo(() => {
    switch (rimId) {
      case 'rally_gold':      return ['#fde047', '#ca8a04'];
      case 'cyber_aero':      return ['#06b6d4', '#0f172a'];
      case 'chrome_deepdish': return ['#ffffff', '#94a3b8'];
      default:                return ['#64748b', '#1e293b'];
    }
  }, [rimId]);

  // 🔧 BOOST : if (!currentColor) return null ; si tout est vide
  if (!currentColor || !currentRim || !currentBodykit || !currentFinish) {
    return (
      <div className="p-6 rounded-xl bg-slate-950 border border-rose-500/40 text-rose-200 text-sm">
        Erreur : données de tuning manquantes. Vérifie <code>vehicleTuning.js</code>.
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-widget-in">
      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-3 rounded-xl border text-xs flex items-center justify-between shadow ${
            feedback.isError
              ? 'bg-rose-950/50 border-rose-500/50 text-rose-200'
              : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.isError
              ? <AlertCircle className="w-4 h-4 text-rose-400" />
              : <Sparkles className="w-4 h-4 text-emerald-400" />}
            <span>{feedback.msg}</span>
          </div>
          <button
            type="button"
            aria-label="Fermer le message"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white font-bold ml-2 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* ── 3D VISUAL LIVE VEHICLE PREVIEW CARD ── */}
      <div className="relative rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Baie de Prévisualisation Temps Réel
                <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 text-[9px] font-mono">
                  {garageName}
                </span>
                {!isParkedInsideGarage && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/30 text-[9px] font-mono">
                    HORS GARAGE
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                Aperçu instantané des éléments cosmétiques et kit carrosserie
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
            {[
              { id: 'front34', label: '3/4 Avant' },
              { id: 'side',    label: 'Profil' },
              { id: 'rear34',  label: '3/4 Arrière' },
            ].map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Vue ${a.label}`}
                onClick={() => setPreviewAngle(a.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                  previewAngle === a.id
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* 🔧 BOOST : la perspective CSS change réellement l'angle */}
        <div className="relative h-44 rounded-xl border border-slate-800/80 bg-slate-950/80 flex items-center justify-center overflow-hidden p-4">
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                'linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div
            className="absolute bottom-6 w-3/4 h-8 rounded-full blur-2xl transition-all duration-500"
            style={{ backgroundColor: bodyColor, opacity: 0.55 }}
          />

          <div
            className="relative z-10 w-full max-w-md flex flex-col items-center transition-transform duration-500 ease-out"
            style={{ transform: PREVIEW_TRANSFORMS[previewAngle] }}
          >
            <svg
              viewBox="0 0 500 180"
              className="w-full max-h-36 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
              role="img"
              aria-label="Aperçu véhicule"
            >
              <defs>
                <linearGradient id={IDS.body} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={bodyColor} stopOpacity="1" />
                  <stop offset="100%" stopColor={bodyColor} stopOpacity={finishAlpha} />
                </linearGradient>
                <linearGradient id={IDS.window} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id={IDS.rim} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={rimStops[0]} />
                  <stop offset="100%" stopColor={rimStops[1]} />
                </linearGradient>
              </defs>

              <ellipse cx="250" cy="155" rx="200" ry="14" fill="#000000" opacity="0.65" />

              {/* Bodykit couches arrière */}
              {bodykitId === 'overland' && (
                <path d="M 270 45 L 370 45 L 390 100 L 270 100 Z" fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
              )}
              {bodykitId === 'sport' && (
                <g>
                  <line x1="390" y1="95" x2="400" y2="40" stroke="#0f172a" strokeWidth="5" />
                  <line x1="420" y1="95" x2="415" y2="40" stroke="#0f172a" strokeWidth="5" />
                  <path d="M 375 40 Q 410 35 435 40" stroke="#0284c7" strokeWidth="8" fill="none" strokeLinecap="round" />
                  <rect x="428" y="30" width="8" height="24" rx="2" fill="#0369a1" />
                </g>
              )}

              {/* Cabine + corps */}
              <path
                d="M 60 120 L 70 95 L 435 95 L 445 125 L 435 135 L 60 135 Z"
                fill={`url(#${IDS.body})`}
                stroke="#0f172a"
                strokeWidth="2"
              />
              <path
                d="M 160 95 L 205 45 L 290 45 L 310 95 Z"
                fill={`url(#${IDS.body})`}
                stroke="#0f172a"
                strokeWidth="2"
              />
              <polygon points="170,92 210,50 245,50 245,92" fill={`url(#${IDS.window})`} />
              <polygon points="252,50 285,50 302,92 252,92" fill={`url(#${IDS.window})`} />
              <rect x="310" y="88" width="125" height="8" rx="2" fill="#334155" />
              <polygon points="62,100 70,100 68,114 60,114" fill="#fef08a" opacity="0.9" />
              <polygon points="440,100 445,100 443,118 438,118" fill="#ef4444" opacity="0.9" />

              {/* Kits avant */}
              {bodykitId === 'offroad' && (
                <g>
                  <rect x="44" y="90" width="16" height="42" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
                  <line x1="42" y1="102" x2="65" y2="102" stroke="#334155" strokeWidth="4" />
                  <circle cx="225" cy="38" r="5" fill="#fef08a" stroke="#1e293b" strokeWidth="2" />
                  <circle cx="245" cy="38" r="5" fill="#fef08a" stroke="#1e293b" strokeWidth="2" />
                  <circle cx="265" cy="38" r="5" fill="#fef08a" stroke="#1e293b" strokeWidth="2" />
                  <path d="M 195 90 L 195 40 L 205 35" fill="none" stroke="#0f172a" strokeWidth="4" />
                </g>
              )}
              {bodykitId === 'sport' && (
                <g>
                  <rect x="40" y="136" width="30" height="5" rx="2" fill="#0f172a" />
                  <line x1="46" y1="126" x2="48" y2="136" stroke="#94a3b8" strokeWidth="1.5" />
                  <polygon points="120,95 140,88 150,95" fill="#0f172a" />
                </g>
              )}
              {bodykitId === 'widebody' && (
                <g>
                  <path d="M 100 135 C 100 95 160 95 160 135" fill="none" stroke="#0f172a" strokeWidth="10" />
                  <path d="M 330 135 C 330 95 390 95 390 135" fill="none" stroke="#0f172a" strokeWidth="10" />
                  <polygon points="432,92 444,82 440,94" fill="#0f172a" />
                </g>
              )}

              {/* Roues */}
              {[130, 360].map((cx, idx) => (
                <g key={idx} transform={`translate(${cx}, 135)`}>
                  <circle cx="0" cy="0" r="28" fill="#18181b" stroke="#27272a" strokeWidth="3" />
                  <circle cx="0" cy="0" r="18" fill={`url(#${IDS.rim})`} stroke="#09090b" strokeWidth="2" />
                  <circle cx="0" cy="0" r="6" fill="#09090b" />
                  {rimId === 'sport_5spoke' && (
                    <>
                      <line x1="0" y1="0" x2="0" y2="-17" stroke="#cbd5e1" strokeWidth="3.5" />
                      <line x1="0" y1="0" x2="16" y2="-5" stroke="#cbd5e1" strokeWidth="3.5" />
                      <line x1="0" y1="0" x2="10" y2="14" stroke="#cbd5e1" strokeWidth="3.5" />
                      <line x1="0" y1="0" x2="-10" y2="14" stroke="#cbd5e1" strokeWidth="3.5" />
                      <line x1="0" y1="0" x2="-16" y2="-5" stroke="#cbd5e1" strokeWidth="3.5" />
                    </>
                  )}
                  {rimId === 'cyber_aero' && (
                    <circle cx="0" cy="0" r="16" fill="none" stroke="#00f5ff" strokeWidth="2" strokeDasharray="6,4" />
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Spécifications actuelles */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-white/5 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-inner" style={{ backgroundColor: bodyColor }} />
              <strong className="text-white">{currentColor.name}</strong>
              <span className="text-slate-500 font-mono text-[10px]">({currentFinish.name})</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">
              Jantes : <strong className="text-white">{currentRim.name}</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">
              Kit : <strong className="text-cyan-400">{currentBodykit.name}</strong>
            </span>
          </div>

          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Rétablir origine</span>
            </button>
          )}
        </div>
      </div>

      {/* ── TUNING CATEGORY SUB-TABS ── */}
      <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 gap-1.5">
        {[
          { id: 'paint',   label: 'Peinture & Finition', Icon: Palette },
          { id: 'rims',    label: 'Jantes & Roues',      Icon: Disc },
          { id: 'bodykit', label: 'Kit Carrosserie',     Icon: Boxes },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveCategory(id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeCategory === id
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: PEINTURE & FINITIONS ── */}
      {activeCategory === 'paint' && (
        <div className="space-y-4 animate-widget-in">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Vernis &amp; Texture de Finition
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {TUNING_FINISHES.length} Traitement{TUNING_FINISHES.length > 1 ? 's' : ''} disponible{TUNING_FINISHES.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {TUNING_FINISHES.map((fin) => {
                const isSelected = draftTuning.finish === fin.id;
                return (
                  <button
                    key={fin.id}
                    type="button"
                    onClick={() => handleSelectFinish(fin.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{fin.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">{fin.tag}</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold mt-2">
                      {fin.price === 0 ? 'Inclus' : `+${safeFormatCad(fin.price)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                Palette Nuancier Portneuf &amp; Sport
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {TUNING_COLORS.length} Teinte{TUNING_COLORS.length > 1 ? 's' : ''} québécoise{TUNING_COLORS.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {TUNING_COLORS.map((col) => {
                const isSelected = draftTuning.colorId === col.id;
                const isOwned = ownedColors.includes(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleSelectColor(col)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-slate-800 border-amber-400 shadow-md ring-1 ring-amber-400'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-lg border border-white/20 shadow-inner shrink-0" style={{ backgroundColor: col.hex }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-white truncate">{col.name}</div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px] font-mono text-slate-400 uppercase">{col.category}</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-400">
                          {isOwned ? 'Possédé' : col.price === 0 ? 'Gratuit' : safeFormatCad(col.price)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: JANTES & ROUES ── */}
      {activeCategory === 'rims' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-widget-in">
          {TUNING_RIMS.map((rim) => {
            const isSelected = draftTuning.rimsId === rim.id;
            const isOwned = ownedRims.includes(rim.id);
            return (
              <button
                key={rim.id}
                type="button"
                onClick={() => handleSelectRims(rim)}
                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between text-left ${
                  isSelected
                    ? 'bg-slate-800/90 border-amber-400 shadow-lg ring-1 ring-amber-400'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-white">{rim.name}</h4>
                      <p className="text-[10px] text-amber-400/90 font-mono mt-0.5">{rim.specs}</p>
                    </div>
                    {isSelected && (
                      <span className="p-1 rounded-full bg-amber-500 text-slate-950">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{rim.description}</p>
                </div>
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5 text-xs">
                  <span className="text-[10px] text-slate-400 font-mono">Teinte : {rim.colorName}</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {isOwned ? 'Équipé / Détenu' : rim.price === 0 ? 'Inclus' : safeFormatCad(rim.price)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── TAB 3: KIT CARROSSERIE ── */}
      {activeCategory === 'bodykit' && (
        <div className="space-y-3 animate-widget-in">
          {TUNING_BODYKITS.map((kit) => {
            const isSelected = draftTuning.bodykitId === kit.id;
            const isOwned = ownedBodykits.includes(kit.id);
            return (
              <div
                key={kit.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectBodykit(kit)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectBodykit(kit); } }}
                className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-400 shadow-xl ring-1 ring-cyan-400'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{kit.name}</h4>
                      <p className="text-[11px] text-cyan-300 font-medium">{kit.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{kit.description}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {safeArray(kit.features).map((feat, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-slate-950/70 border border-slate-800 text-[10px] text-slate-300 flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-white/5">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Prix d'atelier</span>
                    <span className="font-mono text-base font-black text-emerald-400">
                      {isOwned ? 'Déjà Acquis' : kit.price === 0 ? 'De Série' : safeFormatCad(kit.price)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSelectBodykit(kit); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 font-black shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                    <span>{isSelected ? 'Sélectionné' : 'Choisir ce kit'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ACTION FOOTER & CASH CHECKOUT ── */}
      <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
              Compte Portneuf AccèsD (Cash)
            </span>
            <div className="text-base font-mono font-bold text-white flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{safeFormatCad(store.cash)}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
              Total Modifs à Régler
            </span>
            <div className="text-base font-mono font-extrabold text-amber-400">
              {totalUpgradeCost === 0 ? '0,00 $ CAD (Déjà réglé)' : safeFormatCad(totalUpgradeCost)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleConfirmPurchase}
            disabled={isPurchasing || (!hasChanges && totalUpgradeCost === 0) || !isParkedInsideGarage}
            aria-busy={isPurchasing}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg ${
              isPurchasing || (!hasChanges && totalUpgradeCost === 0) || !isParkedInsideGarage
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black'
            }`}
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>
              {isPurchasing
                ? 'Installation en cours…'
                : !isParkedInsideGarage
                ? 'Stationner au garage requis'
                : totalUpgradeCost > 0
                ? `Installer & Acheter (${safeFormatCad(totalUpgradeCost)})`
                : 'Appliquer la Configuration'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

VehicleTuningWorkshop.displayName = 'VehicleTuningWorkshop';
export default VehicleTuningWorkshop;
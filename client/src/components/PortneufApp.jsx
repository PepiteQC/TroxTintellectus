/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — COMPONENTS/PORTNEUFAPP.JSX (v3.0 Platinum Edition)
 * Coque Principale du Comté de Portneuf · HUD, Carte, Menus & Overlays
 * ═══════════════════════════════════════════════════════════════════
 * Orchestre l'ensemble de l'interface en jeu :
 *  • Moteur 3D temps réel (Three.js Engine bootstrap & canvas)
 *  • ATH / HUD complet (Vitesse, radar SQ, météo/saisons, finances, survie)
 *  • Cartographie 2D vectorielle haute performance (Minicarte & Carte plein écran)
 *  • Overlays RP (Téléphone, Dépanneur, Inventaire, Fourrière, Garage, Admin)
 *  • Contrôles tactiles (Joystick virtuel & boutons d'action mobile)
 *
 * Signature : TROXT⬡ · 🍁PortneufRP
 * Chemin    : client/src/components/PortneufApp.jsx
 */

import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import {
  Briefcase, Car, CloudFog, CloudLightning, CloudRain, Compass, DoorOpen,
  Droplets, Eye, Flame, Footprints, Gauge, Hammer, Hand, Handshake, KeyRound,
  Leaf, Map as MapIcon, MessageSquare, Moon, Music2, Pause, Play, Pointer,
  Radio, RotateCcw, Shield, ShoppingBag, ShoppingCart, Smartphone, Snowflake,
  Sparkles, Sprout, Star, Sun, Terminal, Truck, User, Users, Video, Wallet,
  X, Zap
} from "lucide-react";

// ─── COMPOSANTS & OVERLAYS DU MONDE ─────────────────────────────────────────
import { AdminBar } from "./AdminBar.jsx";
import { BuilderOverlay } from "./buildui.jsx";
import { ChatOverlay, RpNetBridge } from "./chat.jsx";
import { CreatorOverlay } from "./creator.jsx";
import { ElevatorOverlay } from "./elevator.jsx";
import { FirmOverlay } from "./firm.jsx";
import { ShopOverlay } from "./shop.jsx";
import { JobsOverlay } from "./haul.jsx";
import { IntellectusOverlay, startIntellectusHeartbeat } from "./Intellectus.jsx";
import { TroxTChatOverlay } from "./troxtchat.jsx";
import { GarageOverlay, InventoryOverlay } from "./inventory.jsx";
import { FourriereOverlay } from "./fourriereUi.jsx";
import { CartOverlay } from "./panier.jsx";
import { LockOverlay, PhoneOverlay } from "./phone.jsx";
import { AtmOverlay, DeedOverlay } from "./rpui.jsx";

// ─── SERVICES, AUDIO & SYSTÈMES ÉCONOMIQUES ─────────────────────────────────
import {
  bagCapacity, bagWeight, cartCount, formatCad, itemById,
  LANDMARK_SHOPS
} from "./commerce.js";
import { input } from "./input.js";
import { persist, useGameStore } from "./store.js";
import { STANDING_LABEL, STANDING_TONE, standingOf } from "./reputation.js";
import { sugarMapMarks } from "./sugar.js";
import { spatialAudio } from "./audio3d.js";
import { quebecFM } from "./radio.js";
import { AdminRole, getRoleBadgeStyle } from "./adminPerms.js";
import {
  INDUSTRY_LABEL, MAPLE_LEAVES, SPAWN, getVillageAt, getWorldStats,
  VILLAGES, POIS, A40_EXITS, WORLD, ROADS, LAKES
} from "./worlddata.js";
import { SEASON_LABEL, CONDITION_LABEL, PLOW_STATUS_LABEL } from "./seasons.js";
import { ownedIds, COMMERCIALS } from "./realestate.js";
import { depMapMarks } from "./depanneur.js";
import { farmMapMarks, CROPS } from "./farms.js";
import { DEEDS } from "./rp.js";
import { rpNet } from "./net.js";
import { clusterSites } from "./cones.js";

const SIG = 'TROXT⬡';

// ─── HELPER D'ICÔNE MÉTÉOROLOGIQUE ──────────────────────────────────────────
function getWeatherIcon(condition) {
  switch (condition) {
    case "ensoleille":     return Sun;
    case "pluie_fine":     return CloudRain;
    case "orage_ete":
    case "tempete_neige":  return CloudLightning;
    case "nuageux":        return CloudFog;
    default:               return Snowflake;
  }
}

function survivalAlertLabel(type) {
  const map = {
    hypothermie:      "Hypothermie",
    coup_de_chaleur:  "Coup de chaleur",
    famine:           "Famine",
    deshydratation:   "Déshydratation",
  };
  return map[type] || "Survie";
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSANT RACINE : PortneufApp
// ═══════════════════════════════════════════════════════════════════

export function PortneufApp() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  // Sélecteurs Zustand
  const playing       = useGameStore((s) => s.playing);
  const paused        = useGameStore((s) => s.paused);
  const loading       = useGameStore((s) => s.loading);
  const showMap       = useGameStore((s) => s.showMap);
  const shopOpen      = useGameStore((s) => s.shopOpen);
  const phoneOpen     = useGameStore((s) => s.phoneOpen);
  const lockOpen      = useGameStore((s) => s.lockOpen);
  const consoleOpen   = useGameStore((s) => s.consoleOpen);
  const intelOpen     = useGameStore((s) => s.intelOpen);
  const citationOpen  = useGameStore((s) => s.citationOpen);
  const creatorOpen   = useGameStore((s) => s.creatorOpen);
  const inventoryOpen = useGameStore((s) => s.inventoryOpen);
  const garageOpen    = useGameStore((s) => s.garageOpen);
  const fourriereOpen = useGameStore((s) => s.fourriereOpen);
  const jobsOpen      = useGameStore((s) => s.jobsOpen);
  const firmOpen      = useGameStore((s) => s.firmOpen);
  const cartOpen      = useGameStore((s) => s.cartOpen);
  const atmOpen       = useGameStore((s) => s.atmOpen);
  const propertyOpen  = useGameStore((s) => s.propertyOpen);
  const elevatorOpen  = useGameStore((s) => s.elevatorOpen);
  const chatOpen      = useGameStore((s) => s.chatOpen);
  const buildOpen     = useGameStore((s) => s.buildOpen);
  const copiloteOpen  = useGameStore((s) => s.copiloteOpen);

  const [bootError, setBootError] = useState(null);

  // ─── AMORÇAGE DU MOTEUR THREE.JS ──────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    const qa = new URLSearchParams(window.location.search).get("qa") === "1";
    if (qa) {
      useGameStore.getState().setHud({
        x: SPAWN.x,
        z: SPAWN.z,
        yaw: SPAWN.yaw,
        night: false,
        paused: false,
      });
    }

    let cancelled = false;

    import("./engine.js")
      .then(({ PortneufEngine }) => {
        if (cancelled || !canvasRef.current) return;
        try {
          const engine = new PortneufEngine(canvasRef.current);
          engineRef.current = engine;
          window.__portneuf = engine;
          window.__store = useGameStore;
          engine.start();
          if (qa) useGameStore.getState().start();
        } catch (err) {
          useGameStore.getState().setHud({ loading: false });
          setBootError(err instanceof Error ? err.message : "Échec d'initialisation du moteur 3D.");
        }
      })
      .catch((err) => {
        useGameStore.getState().setHud({ loading: false });
        setBootError(err instanceof Error ? err.message : "Impossible de charger le moteur 3D.");
      });

    return () => {
      cancelled = true;
      engineRef.current?.dispose?.();
      engineRef.current = null;
    };
  }, []);

  // Persistance à la fermeture
  useEffect(() => {
    const onHide = () => persist();
    window.addEventListener("beforeunload", onHide);
    return () => window.removeEventListener("beforeunload", onHide);
  }, []);

  // Heartbeat Intellectus
  useEffect(() => {
    const id = startIntellectusHeartbeat();
    return () => window.clearInterval(id);
  }, []);

  const isAnyOverlayOpen = (
    showMap || shopOpen || phoneOpen || lockOpen || consoleOpen || intelOpen ||
    citationOpen || creatorOpen || inventoryOpen || garageOpen || fourriereOpen ||
    jobsOpen || firmOpen || cartOpen || atmOpen || propertyOpen || elevatorOpen ||
    chatOpen || buildOpen || copiloteOpen
  );

  return (
    <div className="game-root relative w-full h-full overflow-hidden select-none font-sans bg-bg">
      {/* Canevas WebGL Three.js */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Interface Tête-Haute (ATH / HUD) */}
      <Hud />

      {/* Contrôles tactiles (Smartphone / Tablette) */}
      <TouchPad />

      {/* Écran d'accueil si non démarré */}
      {!playing && <StartScreen loading={loading} error={bootError} />}

      {/* Menu Pause */}
      {playing && paused && !isAnyOverlayOpen && <PauseMenu engine={engineRef.current} />}

      {/* Overlays Modulaires */}
      {playing && showMap && <MapOverlay engine={engineRef.current} />}
      {playing && shopOpen && <ShopOverlay />}
      {playing && phoneOpen && <PhoneOverlay />}
      {playing && lockOpen && <LockOverlay onGranted={() => engineRef.current?.enterPendingInterior()} />}
      {playing && consoleOpen && <AdminBar engine={engineRef.current} />}
      {playing && intelOpen && <IntellectusOverlay engine={engineRef.current} />}
      {playing && citationOpen && <CitationOverlay />}
      {playing && creatorOpen && <CreatorOverlay engine={engineRef.current} />}
      {playing && inventoryOpen && <InventoryOverlay engine={engineRef.current} />}
      {playing && garageOpen && <GarageOverlay engine={engineRef.current} />}
      {playing && fourriereOpen && <FourriereOverlay engine={engineRef.current} />}
      {playing && jobsOpen && <JobsOverlay />}
      {playing && firmOpen && <FirmOverlay />}
      {playing && cartOpen && <CartOverlay />}
      {playing && atmOpen && <AtmOverlay />}
      {playing && propertyOpen && <DeedOverlay engine={engineRef.current} />}
      {playing && elevatorOpen && <ElevatorOverlay onFloor={(id) => engineRef.current?.showFloor(id)} />}
      {playing && buildOpen && <BuilderOverlay engine={engineRef.current} />}
      {playing && <RpNetBridge />}
      {playing && chatOpen && <ChatOverlay />}
      {playing && copiloteOpen && <TroxTChatOverlay />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉCRAN D'AMORÇAGE (STARTSCREEN)
// ═══════════════════════════════════════════════════════════════════

function StartScreen({ loading, error }) {
  const boot = (openCreator) => {
    useGameStore.getState().start();
    if (openCreator) useGameStore.getState().openCreator();
    spatialAudio.unlock?.();
    quebecFM.ensure?.().then(() => {
      const s = useGameStore.getState();
      if (s.radioOn && s.radioId) quebecFM.setStation(s.radioId);
    });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-end bg-gradient-to-t from-bg via-bg/80 to-transparent px-6 pb-16 pt-10 sm:justify-center sm:pb-0 backdrop-blur-sm">
      <div className="max-w-xl text-center">
        <p className="text-xs tracking-[0.35em] text-accent uppercase font-mono">
          Comté de Portneuf · Québec 🍁
        </p>
        <h1 className="mt-3 font-display text-6xl italic leading-none text-fg sm:text-7xl">
          Portneuf
        </h1>
        <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted">
          Le Chemin du Roy, l'A-40 Félix-Leclerc, les rangs laitiers et les grands espaces boréaux.
          Explorez les villages, exploitez vos terres et découvrez la vie du comté.
        </p>

        {error ? (
          <p className="mt-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => boot(false)}
              className="inline-flex h-12 min-w-52 items-center justify-center rounded-lg bg-fg px-8 text-sm font-medium text-accent-fg transition-all duration-150 hover:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-lg"
            >
              {loading ? "Chargement du comté…" : "Prendre la route"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => boot(true)}
              className="inline-flex h-12 min-w-52 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-8 text-sm font-medium text-fg hover:bg-surface-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <User className="size-4" />
              Personnage
            </button>
          </div>
        )}

        <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-1 text-left text-[11px] font-mono text-subtle">
          <li>W / Z — Accélérer · Marcher</li>
          <li>S — Freiner · Reculer</li>
          <li>A / D — Braquer</li>
          <li>Espace — Frein à main</li>
          <li>Maj — Courir · Boost</li>
          <li>E — Interagir · Entrer</li>
          <li>T — Chat vocal / Textuel</li>
          <li>C — Caméra · N — Nuit</li>
          <li>M — Carte · P — Téléphone</li>
          <li>R — Radio FM · I — Sac</li>
          <li>J — Contrats de transport</li>
          <li>F1 — Console d'administration</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AFFICHAGE TÊTE-HAUTE (HUD)
// ═══════════════════════════════════════════════════════════════════

function Hud() {
  const playing       = useGameStore((s) => s.playing);
  const speed         = useGameStore((s) => s.speedKmh);
  const limit         = useGameStore((s) => s.limit);
  const zone          = useGameStore((s) => s.zone);
  const surface       = useGameStore((s) => s.surface);
  const speeding      = useGameStore((s) => s.speeding);
  const fineFlash     = useGameStore((s) => s.fineFlash);
  const policeEta     = useGameStore((s) => s.policeEta);
  const safeZone      = useGameStore((s) => s.safeZone);
  const night         = useGameStore((s) => s.night);
  const poi           = useGameStore((s) => s.poi);
  const poiDesc       = useGameStore((s) => s.poiDesc);
  const yaw           = useGameStore((s) => s.yaw);
  const timeHours     = useGameStore((s) => s.timeHours);
  const mode          = useGameStore((s) => s.mode);
  const prompt        = useGameStore((s) => s.prompt);
  const leaves        = useGameStore((s) => s.leaves);
  const cash          = useGameStore((s) => s.cash);
  const bank          = useGameStore((s) => s.bank);
  const reputation    = useGameStore((s) => s.reputation);
  const notice        = useGameStore((s) => s.notice);
  const shopOpen      = useGameStore((s) => s.shopOpen);
  const fauna         = useGameStore((s) => s.fauna);
  const chat          = useGameStore((s) => s.chat);
  const flyMode       = useGameStore((s) => s.flyMode);
  const wantedStars   = useGameStore((s) => s.wantedStars);
  const wantedReason  = useGameStore((s) => s.wantedReason);
  const bounty        = useGameStore((s) => s.bounty);
  const evading       = useGameStore((s) => s.evading);
  const activeGig     = useGameStore((s) => s.activeGig);
  const radioOn       = useGameStore((s) => s.radioOn);
  const radioTrack    = useGameStore((s) => s.radioTrack);
  const radioId       = useGameStore((s) => s.radioId);
  const dispatch      = useGameStore((s) => s.dispatch);
  const citationOpen  = useGameStore((s) => s.citationOpen);
  const playerName    = useGameStore((s) => s.appearance.name);
  const licenses      = useGameStore((s) => s.licenses) ?? [];
  const creatorOpen   = useGameStore((s) => s.creatorOpen);
  const inventoryOpen = useGameStore((s) => s.inventoryOpen);
  const garageOpen    = useGameStore((s) => s.garageOpen);
  const fourriereOpen = useGameStore((s) => s.fourriereOpen);
  const jobsOpen      = useGameStore((s) => s.jobsOpen);
  const firmOpen      = useGameStore((s) => s.firmOpen);
  const cartOpen      = useGameStore((s) => s.cartOpen);
  const cart          = useGameStore((s) => s.cart);
  const haul          = useGameStore((s) => s.job);
  const hx            = useGameStore((s) => s.x);
  const hz            = useGameStore((s) => s.z);
  const inventory     = useGameStore((s) => s.inventory);
  const pack          = useGameStore((s) => s.equippedPack);
  const selectedSeed  = useGameStore((s) => s.selectedSeed);
  const ownedProps    = useGameStore((s) => s.ownedProps);
  const realty        = useGameStore((s) => s.realty);
  const firm          = useGameStore((s) => s.firm);
  const surv          = useGameStore((s) => s.surv);
  const gridOutage    = useGameStore((s) => s.gridOutage);
  const houses        = useGameStore((s) => s.houses);
  const deedId        = useGameStore((s) => s.deedId);
  const interiorKind  = useGameStore((s) => s.interiorKind);
  const netPeers      = useGameStore((s) => s.netPeers);
  const riskLevel     = useGameStore((s) => s.riskLevel);
  const chatOpen      = useGameStore((s) => s.chatOpen);
  const season        = useGameStore((s) => s.season);
  const wxCondition   = useGameStore((s) => s.wxCondition);
  const wxTemp        = useGameStore((s) => s.wxTemp);
  const snowCm        = useGameStore((s) => s.snowCm);
  const plowStatus    = useGameStore((s) => s.plowStatus);
  const eventBanner   = useGameStore((s) => s.eventBanner);
  const eventSeverity = useGameStore((s) => s.eventSeverity);
  const vanished      = useGameStore((s) => s.vanished);
  const staffFrozen   = useGameStore((s) => s.staffFrozen);
  const adminRole     = useGameStore((s) => s.adminRole);
  const sirenMode     = useGameStore((s) => s.sirenMode);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => useGameStore.getState().setHud({ notice: null }), 2400);
    return () => window.clearTimeout(t);
  }, [notice]);

  if (!playing || creatorOpen || inventoryOpen || garageOpen || fourriereOpen || jobsOpen || firmOpen || cartOpen) {
    return null;
  }

  const hh = Math.floor(timeHours);
  const mm = Math.floor((timeHours % 1) * 60);
  const onFoot = mode !== "drive";
  const loadKg = bagWeight(inventory);
  const loadCap = bagCapacity(pack);
  const loadFill = loadCap > 0 ? loadKg / loadCap : 0;
  const here = getVillageAt(hx, hz);
  const holdings = ownedIds(ownedProps, realty);
  const crop = selectedSeed ? CROPS[selectedSeed] : null;

  const WeatherIcon = getWeatherIcon(wxCondition);

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 font-sans">
        {/* Barre Supérieure */}
        <div className="absolute top-4 right-4 left-4 flex items-start justify-between gap-3">
          {/* Panneau Secteur & Ville */}
          <div className="hud-panel max-w-[70%] rounded-lg px-3 py-2 sm:max-w-sm backdrop-blur-md">
            <p className="text-[10px] tracking-[0.2em] text-subtle uppercase font-mono">
              {mode === "interior" ? "Intérieur" : "Secteur"}
            </p>
            <p className="font-display text-xl italic leading-tight text-fg">
              {zone}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {playerName} · {surface}
              {firm?.isOpen ? ` · ${firm.tradeName} ouvert` : ""}
              {licenses.length > 0 ? ` · ${licenses.join(" · ")}` : ""}
            </p>

            {adminRole && adminRole !== AdminRole.NONE && (
              <p className={`mt-0.5 text-[10px] tracking-[0.16em] uppercase font-bold ${getRoleBadgeStyle(adminRole).color}`}>
                {getRoleBadgeStyle(adminRole).label}
              </p>
            )}

            {mode !== "interior" && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle">
                <Gauge className="size-3" />
                {limit > 0 ? `${limit} km/h` : "—"}
                {policeEta > 0 ? ` · SQ ${Math.max(1, Math.round(policeEta / 60))} min` : ""}
                {safeZone ? " · Zone sécurisée" : ""}
              </p>
            )}

            {here && (
              <p className="mt-0.5 text-[11px] text-subtle">
                {here.motto} · {INDUSTRY_LABEL[here.industry]} · Fondé en {here.founded}
              </p>
            )}
          </div>

          {/* Widgets Supérieurs Droits (Temps, Météo, Finances, Survie) */}
          <div className="flex flex-col items-end gap-2">
            {/* Horloge Circadienne */}
            <div className="hud-panel flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted">
              {night ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
              <span className="hud-num font-mono">
                {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}
              </span>
            </div>

            {/* Météo & Saison */}
            <div className="hud-panel flex max-w-[11.5rem] flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-xs text-muted">
              <p className="flex items-center gap-1.5">
                <WeatherIcon className="size-3.5 text-accent" />
                <span className="text-fg">{SEASON_LABEL[season]}</span>
                <span className="hud-num text-fg font-mono">{Math.round(wxTemp)}°C</span>
              </p>
              <p className="truncate text-[11px] text-subtle">
                {CONDITION_LABEL[wxCondition]}
                {snowCm >= 1 ? ` · ${Math.round(snowCm)} cm neige` : ""}
              </p>
              {plowStatus !== "idle" && (
                <p className="truncate text-[10px] text-accent">
                  {PLOW_STATUS_LABEL[plowStatus]}
                </p>
              )}
            </div>

            {/* Portefeuille & Banque */}
            <div className="hud-panel flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted">
              <Wallet className="size-3.5 text-accent" />
              <span className="hud-num text-fg font-mono">{formatCad(cash)}</span>
              <span className="text-subtle">·</span>
              <span className="hud-num font-mono text-muted">{formatCad(bank)}</span>
            </div>

            {/* Réputation */}
            {reputation?.player && (
              <div className="hud-panel flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs">
                <Shield className={`size-3.5 ${STANDING_TONE[standingOf(reputation.player)]}`} />
                <span className={STANDING_TONE[standingOf(reputation.player)]}>
                  {STANDING_LABEL[standingOf(reputation.player)]}
                </span>
              </div>
            )}

            {/* Panier d'achat */}
            {cartCount(cart) > 0 && (
              <button
                type="button"
                className="pointer-events-auto hud-panel flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:text-fg transition-colors"
                onClick={() => useGameStore.getState().openCart()}
              >
                <ShoppingCart className="size-3.5 text-accent" />
                <span className="hud-num text-fg font-mono">{cartCount(cart)}</span>
              </button>
            )}

            {/* Feuilles d'érable collectionnées */}
            <div className="hud-panel flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted">
              <Leaf className="size-3.5 text-ok" />
              <span className="hud-num text-fg font-mono">{leaves.length}/{MAPLE_LEAVES.length}</span>
            </div>

            {/* Jauge de Survie & Charge */}
            {onFoot && (
              <div className="hud-panel w-[7.5rem] rounded-lg px-2.5 py-1.5">
                <p className={`hud-num text-[10px] font-mono ${loadFill > 1 ? "text-danger font-bold" : "text-muted"}`}>
                  {loadKg.toFixed(1)}/{loadCap} kg
                </p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full ${loadFill > 1 ? "bg-danger" : loadFill > 0.8 ? "bg-accent" : "bg-ok"}`}
                    style={{ width: `${Math.min(100, loadFill * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Barres de Santé/Faim/Soif */}
            <div className="hud-panel w-[7.5rem] rounded-lg px-2.5 py-1.5">
              <p className="hud-num text-[10px] text-muted font-mono">
                {surv.bodyTemp.toFixed(1)} °C
              </p>
              <div className="mt-1 space-y-0.5">
                <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full ${surv.hunger < 20 ? "bg-danger" : "bg-ok"}`} style={{ width: `${surv.hunger}%` }} />
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full ${surv.thirst < 20 ? "bg-danger" : "bg-accent"}`} style={{ width: `${surv.thirst}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bannière d'Événements du Monde */}
        {eventBanner && !shopOpen && !citationOpen && (
          <div className="absolute top-24 left-1/2 z-10 w-[min(92%,22rem)] -translate-x-1/2">
            <div className={`hud-panel rounded-lg px-3 py-2 text-center border ${eventSeverity === "catastrophe" ? "border-danger" : eventSeverity === "majeur" ? "border-amber-500" : "border-border"}`}>
              <p className="text-[10px] tracking-[0.18em] text-subtle uppercase font-mono">
                {eventSeverity === "catastrophe" ? "Catastrophe" : eventSeverity === "majeur" ? "Alerte Majeure" : "Avis Public"}
              </p>
              <p className={`text-sm leading-snug font-bold ${eventSeverity === "catastrophe" ? "text-danger" : "text-fg"}`}>
                {eventBanner}
              </p>
            </div>
          </div>
        )}

        {/* Étoiles de Recherche de Police (Wanted) */}
        {wantedStars > 0 && !shopOpen && !citationOpen && (
          <div className="absolute top-20 left-1/2 z-10 -translate-x-1/2">
            <div className="hud-panel rounded-lg px-4 py-2 text-center border border-danger/40">
              <div className="flex items-center justify-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${i < wantedStars ? "fill-danger text-danger animate-pulse" : "text-subtle"}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-[11px] font-bold text-fg">
                {evading ? "Fuite en cours..." : "Poursuite SQ active"} · {wantedReason}
              </p>
            </div>
          </div>
        )}

        {/* Tachymètre / Compteur de Vitesse (Centre Bas) */}
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          {prompt && !citationOpen && (
            <div className="hud-panel flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-fg animate-bounce">
              {onFoot ? <DoorOpen className="size-4 text-accent" /> : <Footprints className="size-4 text-accent" />}
              <span>{prompt}</span>
            </div>
          )}

          {!citationOpen && (
            <div className={`hud-panel rounded-xl px-6 py-2.5 text-center ${speeding ? "border-danger text-danger" : ""}`}>
              <p className="hud-num font-display text-5xl leading-none tabular-nums">
                {Math.round(speed)}
              </p>
              <p className="mt-0.5 text-[10px] tracking-[0.25em] text-muted uppercase font-mono">
                {onFoot ? "km/h à pied" : limit > 0 ? `km/h · limite ${limit}` : "km/h"}
              </p>
            </div>
          )}
        </div>

        {/* Minicarte & Boussole (Coin Bas Gauche & Droite) */}
        <div className="absolute right-4 bottom-6 hidden sm:block">
          <MiniMap />
        </div>

        <div className="absolute bottom-6 left-4 flex items-center gap-2">
          <div className="hud-panel flex size-12 items-center justify-center rounded-full">
            <Compass
              className="size-6 text-accent transition-transform duration-75"
              style={{ transform: `rotate(${-yaw * (180 / Math.PI)}deg)` }}
            />
          </div>
          <button
            type="button"
            className="pointer-events-auto hud-panel flex size-12 items-center justify-center rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
            onClick={() => useGameStore.getState().openPhone()}
            aria-label="Téléphone"
          >
            <Smartphone className="size-5 text-accent" />
          </button>
          <button
            type="button"
            className="pointer-events-auto hud-panel flex size-12 items-center justify-center rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
            onClick={() => {
              const s = useGameStore.getState();
              if (s.chatOpen) s.closeChat();
              else s.openChat();
            }}
            aria-label="Chat"
          >
            <MessageSquare className="size-5 text-accent" />
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MINICARTE VECTORIELLE 2D (CANVAS RENDERING)
// ═══════════════════════════════════════════════════════════════════

function paintCountyDraw(ctx, w, h, opts) {
  const sx = (px) => ((px - WORLD.minX) / WORLD.width) * w;
  const sy = (pz) => ((pz - WORLD.minZ) / WORLD.depth) * h;

  ctx.fillStyle = opts.labels ? "#121a16" : "#141c18";
  ctx.fillRect(0, 0, w, h);

  // Fleuve Saint-Laurent
  ctx.fillStyle = opts.labels ? "#1c3a52" : "#2a4a68";
  ctx.fillRect(0, sy(96), w, h);

  // Routes
  for (const road of ROADS) {
    if (road.kind === "highway") {
      ctx.strokeStyle = "#e8c84a";
      ctx.lineWidth = opts.labels ? 4 : 3.2;
    } else if (road.kind === "regional") {
      ctx.strokeStyle = "#d8d0c0";
      ctx.lineWidth = opts.labels ? 2.6 : 2.2;
    } else {
      ctx.strokeStyle = opts.labels ? "#5a5a62" : "#4a4a52";
      ctx.lineWidth = opts.labels ? 1.6 : 1.4;
    }
    ctx.beginPath();
    road.points.forEach(([px, pz], i) => {
      if (i === 0) ctx.moveTo(sx(px), sy(pz));
      else ctx.lineTo(sx(px), sy(pz));
    });
    ctx.stroke();
  }

  // Villages
  ctx.fillStyle = "#6a9a62";
  for (const v of VILLAGES) {
    ctx.beginPath();
    ctx.arc(sx(v.center[0]), sy(v.center[1]), opts.labels ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (opts.labels) {
      ctx.fillStyle = "#ece8de";
      ctx.font = "bold 11px Outfit, sans-serif";
      ctx.fillText(v.name, sx(v.center[0]) + 8, sy(v.center[1]) + 4);
      ctx.fillStyle = "#6a9a62";
    }
  }

  // Position Joueur
  ctx.fillStyle = "#ece8de";
  ctx.save();
  ctx.translate(sx(opts.x), sy(opts.z));
  ctx.rotate(-opts.yaw);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function MiniMap() {
  const x = useGameStore((s) => s.x);
  const z = useGameStore((s) => s.z);
  const yaw = useGameStore((s) => s.yaw);
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintCountyDraw(ctx, canvas.width, canvas.height, {
      x, z, yaw, labels: false,
    });
  }, [x, z, yaw]);

  return (
    <div className="hud-panel overflow-hidden rounded-lg p-1">
      <canvas ref={ref} width={148} height={110} className="block rounded-md" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MENU PAUSE
// ═══════════════════════════════════════════════════════════════════

function PauseMenu({ engine }) {
  const km = useGameStore((s) => s.km);
  const cash = useGameStore((s) => s.cash);
  const night = useGameStore((s) => s.night);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/70 px-4 backdrop-blur-sm">
      <div className="hud-panel w-full max-w-md rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-subtle uppercase font-mono">Pause</p>
            <h2 className="font-display text-3xl italic">Portneuf</h2>
          </div>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-md text-muted hover:text-fg cursor-pointer"
            onClick={() => useGameStore.getState().togglePause()}
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-muted">
          {formatCad(cash)} · {km.toFixed(1)} km parcourus
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <MenuBtn
            icon={<Play className="size-4" />}
            label="Reprendre"
            onClick={() => useGameStore.getState().togglePause()}
          />
          <MenuBtn
            icon={<MapIcon className="size-4" />}
            label="Carte"
            onClick={() => useGameStore.getState().setHud({ showMap: true, paused: true })}
          />
          <MenuBtn
            icon={night ? <Sun className="size-4" /> : <Moon className="size-4" />}
            label={night ? "Mode Jour" : "Mode Nuit"}
            onClick={() => engine?.toggleNight?.()}
          />
          <MenuBtn
            icon={<RotateCcw className="size-4" />}
            label="Respawn Route 138"
            onClick={() => {
              engine?.respawn?.();
              useGameStore.getState().togglePause();
            }}
          />
          <MenuBtn
            icon={<ShoppingBag className="size-4" />}
            label="Sac à dos"
            onClick={() => useGameStore.getState().openInventory()}
          />
          <MenuBtn
            icon={<Terminal className="size-4" />}
            label="Console"
            onClick={() => useGameStore.getState().openConsole()}
          />
        </div>
      </div>
    </div>
  );
}

function MenuBtn({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface-2 text-sm text-fg transition-colors hover:border-border-strong cursor-pointer"
    >
      {icon}
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CARTE DU COMTÉ & CONSTAT D'INFRACTION
// ═══════════════════════════════════════════════════════════════════

function MapOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/60 p-4 backdrop-blur-md">
      <div className="hud-panel w-full max-w-2xl rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl italic">Carte du comté de Portneuf</h2>
          <button
            type="button"
            className="size-10 flex items-center justify-center rounded-md text-muted hover:text-fg cursor-pointer"
            onClick={() => useGameStore.getState().setHud({ showMap: false, paused: false })}
          >
            <X className="size-5" />
          </button>
        </div>
        <BigMap />
      </div>
    </div>
  );
}

function BigMap() {
  const x = useGameStore((s) => s.x);
  const z = useGameStore((s) => s.z);
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintCountyDraw(ctx, canvas.width, canvas.height, {
      x, z, yaw: 0, labels: true,
    });
  }, [x, z]);

  return <canvas ref={ref} width={640} height={360} className="w-full rounded-lg block" />;
}

function CitationOverlay() {
  const citation = useGameStore((s) => s.citation);
  if (!citation) return null;
  const arrest = citation.kind === "arrest";

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-bg/80 px-3 py-4 backdrop-blur-sm sm:items-center">
      <div className="hud-panel w-full max-w-md rounded-xl p-5 border border-danger/50">
        <p className="text-[10px] tracking-[0.25em] text-subtle uppercase font-mono">
          {arrest ? "Sûreté du Québec · Arrestation" : "Constat d'infraction"}
        </p>
        <h2 className="mt-1 font-display text-3xl italic">
          {arrest ? "Mise sous arrêt" : "Contravention CSR"}
        </h2>
        <p className="mt-3 text-sm text-fg font-mono">{citation.article}</p>
        <p className="mt-1 text-sm text-muted">{citation.description}</p>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <span className="text-xs text-subtle font-mono">
            {citation.points > 0 ? `${citation.points} points d'inaptitude` : "Sans points"}
          </span>
          <span className="hud-num text-lg text-danger font-bold">
            {formatCad(citation.fine)}
          </span>
        </div>
        <button
          type="button"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-fg text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity cursor-pointer"
          onClick={() => useGameStore.getState().closeCitation()}
        >
          <Shield className="size-4" />
          {arrest ? "Signer et purger" : "Payer le constat"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONTRÔLES TACTILES MOBILES (TOUCHPAD & JOYSTICK)
// ═══════════════════════════════════════════════════════════════════

function TouchPad() {
  const playing = useGameStore((s) => s.playing);
  const paused  = useGameStore((s) => s.paused);
  const prompt  = useGameStore((s) => s.prompt);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const sync = () => {
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      setShow(isTouch);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  if (!playing || paused || !show) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]">
      <Stick />
      <div className="pointer-events-auto absolute right-4 bottom-28 flex flex-col gap-3">
        {prompt && (
          <HoldBtn label="E" onHold={(v) => { input.touchInteract = v; }} />
        )}
        <HoldBtn label="Gaz" onHold={(v) => { input.touchThrottle = v ? 1 : 0; }} />
        <HoldBtn label="Frein" onHold={(v) => { input.touchBrake = v ? 1 : 0; }} />
      </div>
    </div>
  );
}

function HoldBtn({ label, onHold }) {
  return (
    <button
      type="button"
      className="h-12 min-w-20 rounded-lg border border-border bg-surface/80 px-4 text-sm text-fg font-mono active:scale-95 transition-transform"
      onPointerDown={(e) => { e.preventDefault(); onHold(true); }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}

function Stick() {
  const ref = useRef(null);
  const knob = useRef(null);
  const pid = useRef(null);

  const onMove = (cx, cy, x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const m = Math.min(46, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const lx = Math.cos(a) * m;
    const ly = Math.sin(a) * m;
    if (knob.current) knob.current.style.transform = `translate(${lx}px, ${ly}px)`;
    input.touchSteer = Math.max(-1, Math.min(1, -lx / 46));
  };

  const onEnd = () => {
    pid.current = null;
    input.touchSteer = 0;
    if (knob.current) knob.current.style.transform = "translate(0,0)";
  };

  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute bottom-24 left-6 size-32 rounded-full border border-border bg-surface/50 touch-none"
      onPointerDown={(e) => {
        pid.current = e.pointerId;
        e.target.setPointerCapture(e.pointerId);
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        onMove(box.left + box.width / 2, box.top + box.height / 2, e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pid.current !== e.pointerId) return;
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        onMove(box.left + box.width / 2, box.top + box.height / 2, e.clientX, e.clientY);
      }}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
    >
      <div
        ref={knob}
        className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg/80 pointer-events-none"
      />
    </div>
  );
}

export default PortneufApp;
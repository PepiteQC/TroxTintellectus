import { useState, useRef, useEffect, useCallback } from "react";
import { SafeTimer } from "../utils/timer";
import {
  ArrowLeft, Building, Sun, Moon, CloudRain, Snowflake, Car, DollarSign,
  Compass, Volume2, VolumeX, Smartphone, Shield, Heart, Battery, X, Package,
  Check, Utensils, MapPin, Sparkles, Save, FolderDown, FolderUp, Download,
  Trash2, Plus, RefreshCw, FileText, Database, Copy, Layers, ShieldAlert,
  Settings, Plane, Cpu, Terminal, Zap, Radio, ChevronLeft, ChevronRight,
  CheckCircle2, HardDrive
} from "lucide-react";
import * as THREE from "three";
import { ShaderManager } from "../core/ShaderManager";
import { CityArchitect } from "../game/CityArchitect";
import { AudioManager } from "../game/AudioManager";
import { useUserPersona } from "../context/UserPersonaContext";
import { EtherForgePreviewModal } from "./EtherForgePreviewModal";
import { GModBuilder, GMOD_CATALOG, addCustomCatalogItem } from "../game/GModBuilder";
import { parseAndExecuteAdminCommand } from "../admin/AdminCommandSystem";
import { GModMenu } from "./GModMenu";
import { PhysicsEngine } from "../game/PhysicsEngine";
import { PROCEDURAL_TEXTURES } from "../utils/proceduralTextures";
import { RPProximityChat } from "./RPProximityChat";
import { RemotePlayers3D } from "./RemotePlayers3D";
import { Vehicles3D } from "./Vehicles3D";
import { RPInteractionRadial } from "./RPInteractionRadial";
import { EnvironmentController } from "./EnvironmentController";
import { AdminPanel } from "./AdminPanel";
import { PhoneApp } from "../game/phone/PhoneApp";
import { PoliceLawEnforcementUI } from "./PoliceLawEnforcementUI";
import { Wildlife3D } from "./Wildlife3D";
import { Wildlife3DManager } from "../game/wildlife/Wildlife3DManager";
import { PoliceSystem } from "../game/police/PoliceSystem";
import { Client as ColyseusClient } from "colyseus.js";
import { Route138ImmersiveWorld, ROUTE138_HUBS } from "../world/Route138ImmersiveWorld";
import { Route138MapModal } from "./Route138MapModal";
import { CommerceShopModal } from "./CommerceShopModal";
import { RealEstateModal } from "./RealEstateModal";
import { ShoppingBag, Home as HomeIcon } from "lucide-react";
import { getZoneName } from "../utils/townsAndRoads";

// ─── DONNÉES RP (GESTES / EMOTES) ───────────────────────────────────────────

export const RP_GESTURES = [
  { id: "wave", label: "Saluer", icon: "👋", description: "Signe de main amical" },
  { id: "surrender", label: "Se Rendre", icon: "🙌", keyHint: "X", description: "Mains en l'air (Police / Otage)" },
  { id: "cross_arms", label: "Bras Croisés", icon: "🙅", description: "Attitude ferme / Attente" },
  { id: "point", label: "Pointer", icon: "👉", description: "Désigner un lieu ou joueur" },
  { id: "dance", label: "Danse RP", icon: "🕺", description: "Mouvements de danse" },
  { id: "gang_sign", label: "Signe RP", icon: "🤙", description: "Check de Gang / Amitié" },
  { id: "sit", label: "S'asseoir", icon: "🧘", description: "S'asseoir au sol" },
  { id: "phone", label: "Téléphoner", icon: "📱", description: "Main à l'oreille" },
  { id: "salute", label: "Salut Militaire", icon: "🫡", description: "Respect / Sécurité" },
];

export const ETHERWORLD_LOAD_STAGES = [
  {
    stageNum: 1,
    title: "INITIALISATION MOTEUR 3D & SHADERS",
    subtitle: "Allocation Mémoire GPU & Instanciation WebGL Canvas",
    detail: "Three.js v0.160 • Texture Buffers • Shadowmaps HD • Depth Peeling",
    packageName: "engine_core_v28.pak (24.5 MB)"
  },
  {
    stageNum: 2,
    title: "HANDSHAKE & ETHERCLOUD SYNC",
    subtitle: "Négociation Protocoles TLS 1.3 & Réservation Slot Joueur",
    detail: "Serveur Portneuf RP #1 • Cryptage Quic • Session Token Validé",
    packageName: "cloud_session_handshake.pak (8.2 MB)"
  },
  {
    stageNum: 3,
    title: "TÉLÉCHARGEMENT DES DONNÉES DE LA CITÉ",
    subtitle: "Chargement Progressif des Chunks 3D, Routes & Bâtiments HD",
    detail: "Chunk Terrain #01-A4 • Modèles Villa & Cantine • Shaders PBR",
    packageName: "portneuf_city_chunks_hd.pak (88.4 MB)"
  },
  {
    stageNum: 4,
    title: "CHARGEMENT DONNÉES RP & ÉCONOMIE",
    subtitle: "Synchronisation des Banques, Inventaires, Jobs & Marqueurs",
    detail: "Base Firestore Directe • Profils Joueurs • Métiers & Factions",
    packageName: "economy_inventory_sync.pak (42.1 MB)"
  },
  {
    stageNum: 5,
    title: "SYNCHRONISATION MULTIJOUEUR LIVE",
    subtitle: "Indexation Entités Joueurs, Audio Vocale & Shaders Météo",
    detail: "Canaux WebRTC • Audio Proximité 3D • Stream Radio FMRadio",
    packageName: "multiplayer_live_mesh.pak (21.8 MB)"
  }
];

export const ETHERWORLD_RP_TIPS = [
  "💡 ASTUCE: Pressez 'G' pour ouvrir la roue radiale des gestes et émotes RP.",
  "💡 ASTUCE: Activez le mode de vol libre 'Noclip' via la touche 'N' ou les Paramètres.",
  "💡 ASTUCE: Pressez 'V' pour changer de mode caméra (Vue Épaule GTA 5, Orbitale, FPS...).",
  "💡 ASTUCE: Pressez 'X' pour lever les mains en l'air et vous rendre sans conflit.",
  "💡 ASTUCE: Interagissez avec les véhicules, portes et magasins proches avec 'E'.",
  "💡 ASTUCE: Accédez au Téléphone Portable RP avec l'icône de smartphone en haut.",
  "💡 ASTUCE: Utilisez 'EtherForge' pour placer et construire vos propres structures 3D."
];

export const PORTNEUF_WORLD_OBJECTS = [
  { id: "gpu_shaders", name: "Pipeline WebGL2 & Shaders GLSL (Eau, Ciel, Brume)", category: "GPU & Shaders", icon: "✨", count: 6, vramMB: 8.4, log: "[GLSL] Shaders Eau, Brume et Ciel Rayleigh compilés sur WebGL2", coords: "Contexte GPU" },
  { id: "route_138", name: "Chaussée Asphalte Route 138 & Lignes de Peinture", category: "Topographie & Routes", icon: "🛣️", count: 24, vramMB: 6.8, log: "[TERRAIN] Route 138 (12 segments de chaussée) & bordures instanciées", coords: "Axe Principal" },
  { id: "fleuve_st_laurent", name: "Berge Rocheuse & Quai du Fleuve Saint-Laurent", category: "Topographie & Routes", icon: "🌊", count: 18, vramMB: 12.5, log: "[WATER] Fleuve St-Laurent & dynamique de vagues en temps réel", coords: "Littoral Sud" },
  { id: "depanneur_beau_soir", name: "Dépanneur « Le Beau-Soir » & Pompes à Essence Shell", category: "Commerces & Services", icon: "🏪", count: 14, vramMB: 5.2, log: "[COMMERCE] Dépanneur Le Beau-Soir, Enseigne lumineuse & Pompes à essence", coords: "(-15, 0, -12)" },
  { id: "cantine_gaston", name: "Cantine Chez Gaston (Roulotte à Patates & Poutine)", category: "Commerces & Services", icon: "🍟", count: 10, vramMB: 4.1, log: "[COMMERCE] Cantine Chez Gaston, Terrasses & Menu Poutine du Terroir", coords: "(-10, 0, -18)" },
  { id: "caisse_desjardins", name: "Caisse Populaire Desjardins & Guichets Automatiques", category: "Commerces & Services", icon: "🏦", count: 12, vramMB: 4.8, log: "[BANK] Caisse Desjardins & Borne de retrait d'argent liquide", coords: "(12, 0, -16)" },
  { id: "caserne_pompiers", name: "Caserne des Pompiers #12 & Portes de Garages", category: "Commerces & Services", icon: "🚒", count: 16, vramMB: 6.2, log: "[SERVICES] Caserne Incendie #12, Tour de séchage & Portes d'intervention", coords: "(-25, 0, -22)" },
  { id: "phare_maritime", name: "Phare Maritime Fluvial & Faisceau Rotatif", category: "Commerces & Services", icon: "⚓", count: 9, vramMB: 4.5, log: "[NAVAL] Phare maritime de Portneuf & Balises d'amarrage fluviales", coords: "(45, 0, 35)" },
  { id: "kiosque_parc", name: "Kiosque & Gazebo Octogonal du Parc Municipal", category: "Commerces & Services", icon: "🏛️", count: 11, vramMB: 3.6, log: "[PARC] Kiosque musical en bois sculpté & Bancs publics", coords: "(0, 0, 5)" },
  { id: "villa_nova", name: "Villa Nova (Résidence d'Architecte Contemporaine)", category: "Architecture & Villas", icon: "🏡", count: 18, vramMB: 8.4, log: "[RESIDENTIAL] Domaine Villa Nova instancié avec baies vitrées et garage", coords: "(-28, 0, 15)" },
  { id: "villa_celeste", name: "Villa Céleste & Terrasse Panoramique", category: "Architecture & Villas", icon: "⚜️", count: 20, vramMB: 9.1, log: "[RESIDENTIAL] Villa Céleste de Portneuf & Belvédère panoramique", coords: "(28, 0, 15)" },
  { id: "quartier_pavillons", name: "Pavillons Résidentiels & Clôtures en Cèdre Québécois", category: "Architecture & Villas", icon: "🏠", count: 26, vramMB: 6.7, log: "[HOUSING] 14 Pavillons résidentiels & Clôtures de cèdre naturel", coords: "Zone Nord" },
  { id: "cabane_a_sucre", name: "Cabane à Sucre de Portneuf & Évaporateur Artisanal", category: "Forêts & Érablières", icon: "🍁", count: 14, vramMB: 4.9, log: "[ÉTABLIÈRE] Cabane à Sucre traditionnelle & Réserve de bois de chauffage", coords: "(35, 0, -32)" },
  { id: "foret_erables_sapins", name: "Forêt d'Érables Rouges & Sapins Baumiers Laurentiens", category: "Forêts & Érablières", icon: "🌲", count: 48, vramMB: 12.8, log: "[FLORA] 84 Érables à sucre & Sapins baumiers semés dans le relief", coords: "Collines Boisées" },
  { id: "cannon_physics", name: "Moteur Physique Cannon.js & Boîtes de Collision", category: "Physique Cannon.js", icon: "📦", count: 32, vramMB: 8.9, log: "[PHYSICS] 184 Boîtes de collision Cannon.js générées et indexées", coords: "Espace Physique" },
  { id: "patrouille_sq", name: "Autopatrouille Dodge Charger Sûreté du Québec #402", category: "Véhicules & Flotte", icon: "🚔", count: 14, vramMB: 7.2, log: "[POLICE] Dodge Charger SQ #402 avec gyrophare Whelen stroboscopique", coords: "(4, 0, -2)" },
  { id: "vehicules_civils", name: "Supercar Québec & Véhicules Civils d'Intervention", category: "Véhicules & Flotte", icon: "🚗", count: 12, vramMB: 6.4, log: "[VEHICLES] Véhicules civils & Châssis de suspension configurés", coords: "(-6, 0, 10)" },
  { id: "faune_orignaux", name: "Harde d'Orignaux d'Amérique (IA Navigation & Pâturage)", category: "Faune Sauvage", icon: "🦌", count: 8, vramMB: 3.7, log: "[FAUNE] IA des orignaux (4 individus) & Traces de pas sur sentiers", coords: "(42, 0, -25)" },
  { id: "faune_loups", name: "Meute de Loups des Forêts Laurentiennes", category: "Faune Sauvage", icon: "🐺", count: 6, vramMB: 3.2, log: "[FAUNE] Meute de loups de Portneuf & IA de traque boréale", coords: "(-38, 0, 32)" },
  { id: "audio_radio_fm", name: "Moteur Web Audio Spatial 3D & Fréquences Radio Québec", category: "Réseau & Données RP", icon: "📻", count: 8, vramMB: 2.8, log: "[AUDIO] Moteur Audio spatial 3D & Stations FM CKOI / Énergie prêtes", coords: "DSP Audio" },
  { id: "sync_profil_rp", name: "Synchronisation Citoyenne: Profil, Inventaire & Desjardins", category: "Réseau & Données RP", icon: "👤", count: 6, vramMB: 1.5, log: "[DATABASE] Profil Citoyen, Portefeuille Desjardins & Clés chargés", coords: "Compte Joueur" },
  { id: "serveur_portneuf_live", name: "Serveur Cité Portneuf RP #1 (Handshake & Session Live)", category: "Réseau & Données RP", icon: "🌐", count: 6, vramMB: 1.2, log: "[CONNECT] Session Portneuf RP validée • Prêt à entrer dans la cité !", coords: "Serveur #1" }
];

export const PORTNEUF_GTA_ARTWORKS = [
  {
    title: "SÛRETÉ DU QUÉBEC",
    tagline: "District Capitale-Nationale • Poste de Portneuf",
    category: "FORCES DE L'ORDRE",
    description: "Les patrouilleurs de la Sûreté du Québec veillent 24/7 sur la Route 138 et le centre de Portneuf. Respectez les limitations de vitesse et les codes RP pour éviter l'intervention d'urgence.",
    accentColor: "from-amber-400 to-yellow-600",
    bgGradient: "from-blue-950/90 via-slate-950/95 to-black",
    icon: "🚔",
    tips: "Pressez 'X' pour lever les mains en l'air lors d'un contrôle policier."
  },
  {
    title: "LE DOMAINE VILLA NOVA",
    tagline: "Résidences d'Exception & Fleuve Saint-Laurent",
    category: "SECTEUR IMMOBILIER",
    description: "L'architecture contemporaine rencontre la nature québécoise. Propriétés privatives avec baies vitrées, quais privés et panoramas imprenables sur les marées du fleuve.",
    accentColor: "from-cyan-400 to-blue-600",
    bgGradient: "from-cyan-950/90 via-slate-950/95 to-black",
    icon: "🏡",
    tips: "Visitez le quartier résidentiel pour acquérir votre première propriété."
  },
  {
    title: "CANTINE CHEZ GASTON & LE BEAU-SOIR",
    tagline: "Le Cœur Battant de la Vie Locale",
    category: "COMMERCES DE PROXIMITÉ",
    description: "Faites le plein au dépanneur avant votre virée en forêt ou savourez la meilleure poutine extra-fromage en grains à la célèbre roulotte locale Chez Gaston.",
    accentColor: "from-emerald-400 to-teal-600",
    bgGradient: "from-emerald-950/90 via-slate-950/95 to-black",
    icon: "🍟",
    tips: "Interagissez avec 'E' devant les portes de commerce pour entrer et commander."
  },
  {
    title: "LA FORÊT DES LAURENTIDES",
    tagline: "Orignaux, Loups & Cabane à Sucre",
    category: "TERRITOIRE SAUVAGE",
    description: "Une vaste étendue de sapins baumiers et d'érables à sucre. Suivez les sentiers balisés pour observer la harde d'orignaux et visitez la cabane à sucre traditionnelle.",
    accentColor: "from-orange-400 to-red-600",
    bgGradient: "from-amber-950/90 via-slate-950/95 to-black",
    icon: "🍁",
    tips: "Activez le mode 'Noclip' avec 'N' pour explorer librement tout le territoire."
  }
];

const POINTS_OF_INTEREST = [
  { id: "cantine_gaston", name: "Chez Gaston (La Roulotte)", type: "cantine", icon: "🍟", x: -10, z: -15, radius: 4.5, prompt: "Commander la Poutine & Blé d'Inde" },
  { id: "villa_celeste", name: "Villa Céleste (Domaine Portneuf)", type: "villa", icon: "⚜️", x: 28, z: -8, radius: 5.0, prompt: "Inspecter la propriété Villa Céleste" },
  { id: "villa_nova", name: "Villa Nova", type: "villa", icon: "🏠", x: -28, z: 8, radius: 5.0, prompt: "Accéder à Villa Nova" },
  { id: "boutique_ether", name: "Boutique Éther (Mode & Custom)", type: "shop", icon: "👕", x: -22, z: 10, radius: 4.5, prompt: "Essayer des vêtements RP" },
  { id: "atm_desjardins", name: "Guichet Caisse Desjardins", type: "bank", icon: "🏧", x: 15, z: -5, radius: 3.5, prompt: "Opération bancaire / Dépôt" },
  { id: "supercar_1", name: "Supercar Québec (Sports)", type: "vehicle", icon: "🚗", x: 5, z: 15, radius: 4.0, prompt: "Conduire la Supercar Québec" },
  { id: "weapons_dealer_secret", name: "L'Armurier Clandestin (Marchand d'Armes)", type: "shop", icon: "⚔️", x: 148, z: 125, radius: 5.5, prompt: "Chuchoter à l'Armurier Clandestin [Marché Noir]" },
  { id: "hub_saint_casimir", name: "Saint-Casimir (Pont de Fer & Marmites)", type: "villa", icon: "🌉", x: -3800, z: -1200, radius: 45.0, prompt: "Explorer Saint-Casimir" },
  { id: "hub_saint_marc", name: "Saint-Marc-des-Carrières (Calcaire)", type: "villa", icon: "⛏️", x: -2600, z: -800, radius: 45.0, prompt: "Explorer Saint-Marc-des-Carrières" },
  { id: "hub_saint_alban", name: "Saint-Alban (Gorges & Canyon)", type: "villa", icon: "🌲", x: -2800, z: -2600, radius: 45.0, prompt: "Explorer Saint-Alban" },
  { id: "hub_deschambault", name: "Deschambault-Grondines (Moulin 1674)", type: "villa", icon: "🌾", x: -2000, z: 200, radius: 45.0, prompt: "Explorer Deschambault-Grondines" },
  { id: "hub_portneuf", name: "Portneuf (Grand Quai & Phare)", type: "villa", icon: "⚓", x: 0, z: 0, radius: 45.0, prompt: "Explorer Portneuf" },
  { id: "hub_pont_rouge", name: "Pont-Rouge (Pont Rouge & Jacques-Cartier)", type: "villa", icon: "🏛️", x: 2000, z: -1000, radius: 45.0, prompt: "Explorer Pont-Rouge" },
  { id: "hub_saint_raymond", name: "Saint-Raymond (Vallée Bras-du-Nord)", type: "villa", icon: "❄️", x: 1600, z: -3600, radius: 45.0, prompt: "Explorer Saint-Raymond" },
  { id: "hub_quebec", name: "Québec (Porte de la Capitale)", type: "villa", icon: "⚜️", x: 5400, z: 300, radius: 50.0, prompt: "Bienvenue à Québec" }
];

export default function TroxTWorld({ onBack }) {
  const persona = useUserPersona();

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const minimapCanvasRef = useRef(null);

  // Core UI state
  const [weather, setWeather] = useState("clear");
  const [cameraMode, setCameraMode] = useState("gta5_close");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Route 138 Immersive Regional State
  const [isRoute138ModalOpen, setIsRoute138ModalOpen] = useState(false);
  const [isCommerceModalOpen, setIsCommerceModalOpen] = useState(false);
  const [isRealEstateModalOpen, setIsRealEstateModalOpen] = useState(false);
  const [currentZoneName, setCurrentZoneName] = useState("Portneuf Centre");
  const [activeGpsHub, setActiveGpsHub] = useState(null);
  const route138WorldRef = useRef(null);
  const currentZoneRef = useRef("Portneuf Centre");

  // Loading Screen
  const [isLoadingScreen, setIsLoadingScreen] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStageIndex, setLoadStageIndex] = useState(0);
  const [currentLoadingObjectIndex, setCurrentLoadingObjectIndex] = useState(0);
  const [loadedObjectsCount, setLoadedObjectsCount] = useState(0);
  const totalObjectsCount = 338;
  const [loadedVramMB, setLoadedVramMB] = useState(0);
  const totalVramMB = 124.5;
  const [downloadSpeed, setDownloadSpeed] = useState(42.8);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [activeArtworkIndex, setActiveArtworkIndex] = useState(0);
  const [isReadyToEnter, setIsReadyToEnter] = useState(false);
  const [showArrivalBanner, setShowArrivalBanner] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([
    "[00:00.02] [INIT] WebGL2 Context bound on GPU Pipeline",
    "[00:00.08] [CONNECT] Handshake TLS 1.3 avec EtherCloud Portneuf #1"
  ]);

  // Audio tone helper for loading milestones
  const playLoadingTone = useCallback((freq = 520, duration = 0.08) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, []);

  // Progressive Loading Engine
  useEffect(() => {
    if (!isLoadingScreen) return;

    setLoadProgress(0);
    setLoadedObjectsCount(0);
    setLoadedVramMB(0);
    setCurrentLoadingObjectIndex(0);
    setIsReadyToEnter(false);
    setLoadStageIndex(0);

    let currentObjIdx = 0;
    let accumulatedCount = 0;
    let accumulatedVram = 0;
    const totalAssets = PORTNEUF_WORLD_OBJECTS.length;
    const stepDurationMs = 110;

    const loadStepInterval = setInterval(() => {
      if (currentObjIdx < totalAssets) {
        const obj = PORTNEUF_WORLD_OBJECTS[currentObjIdx];
        accumulatedCount += obj.count;
        accumulatedVram = parseFloat((accumulatedVram + obj.vramMB).toFixed(1));

        setCurrentLoadingObjectIndex(currentObjIdx);
        setLoadedObjectsCount(accumulatedCount);
        setLoadedVramMB(accumulatedVram);
        setDownloadSpeed(parseFloat((38.0 + Math.random() * 24.0).toFixed(1)));

        const now = new Date();
        const timeStr = `[00:${String(Math.floor((currentObjIdx * stepDurationMs) / 1000)).padStart(2, "0")}.${String(Math.floor(((currentObjIdx * stepDurationMs) % 1000) / 10)).padStart(2, "0")}]`;
        setTerminalLogs((prev) => [...prev.slice(-14), `${timeStr} ${obj.log}`]);

        const progress = Math.min(100, Math.floor(((currentObjIdx + 1) / totalAssets) * 100));
        setLoadProgress(progress);

        if (currentObjIdx < 3) setLoadStageIndex(0);
        else if (currentObjIdx < 9) setLoadStageIndex(1);
        else if (currentObjIdx < 14) setLoadStageIndex(2);
        else if (currentObjIdx < 18) setLoadStageIndex(3);
        else setLoadStageIndex(4);

        if (currentObjIdx % 5 === 0) {
          playLoadingTone(440 + currentObjIdx * 25, 0.05);
        }

        currentObjIdx++;
      } else {
        clearInterval(loadStepInterval);
        setLoadProgress(100);
        setLoadedObjectsCount(totalObjectsCount);
        setLoadedVramMB(totalVramMB);
        setIsReadyToEnter(true);
        playLoadingTone(880, 0.2);

        setTimeout(() => {
          setIsLoadingScreen(false);
          setShowArrivalBanner(true);
          setTimeout(() => setShowArrivalBanner(false), 6000);
        }, 350);
      }
    }, stepDurationMs);

    const tipInterval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % ETHERWORLD_RP_TIPS.length);
    }, 2800);

    const artworkInterval = setInterval(() => {
      setActiveArtworkIndex((prev) => (prev + 1) % PORTNEUF_GTA_ARTWORKS.length);
    }, 3200);

    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        clearInterval(loadStepInterval);
        setLoadProgress(100);
        setLoadedObjectsCount(totalObjectsCount);
        setLoadedVramMB(totalVramMB);
        setIsLoadingScreen(false);
        setShowArrivalBanner(true);
        setTimeout(() => setShowArrivalBanner(false), 6000);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(loadStepInterval);
      clearInterval(tipInterval);
      clearInterval(artworkInterval);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLoadingScreen, playLoadingTone]);

  // Noclip Flight Mode State & Refs
  const [isNoclipEnabled, setIsNoclipEnabled] = useState(false);
  const isNoclipEnabledRef = useRef(isNoclipEnabled);
  useEffect(() => { isNoclipEnabledRef.current = isNoclipEnabled; }, [isNoclipEnabled]);

  const [noclipSpeed, setNoclipSpeed] = useState(18);
  const noclipSpeedRef = useRef(noclipSpeed);
  useEffect(() => { noclipSpeedRef.current = noclipSpeed; }, [noclipSpeed]);

  // RP Gestures / Emotes State & Ref
  const [activeGesture, setActiveGesture] = useState("none");
  const activeGestureRef = useRef(activeGesture);
  useEffect(() => { activeGestureRef.current = activeGesture; }, [activeGesture]);

  const [isGestureWheelOpen, setIsGestureWheelOpen] = useState(false);
  const isGestureWheelOpenRef = useRef(isGestureWheelOpen);
  useEffect(() => { isGestureWheelOpenRef.current = isGestureWheelOpen; }, [isGestureWheelOpen]);

  const [timeOfDay, setTimeOfDay] = useState(14.0);

  // RP Multiplayer & Synchronization State
  const [remotePlayers, setRemotePlayers] = useState([]);
  const [worldVehicles, setWorldVehicles] = useState([]);
  const [rpMessages, setRpMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // RP Centralized Raycast & Radial Interaction State
  const [targetedEntity, setTargetedEntity] = useState(null);
  const [radialMenuTarget, setRadialMenuTarget] = useState(null);

  // Vehicle UI speed state
  const [isInVehicle, setIsInVehicle] = useState(persona.vehicleState.isInVehicle);
  const [currentVehicleId, setCurrentVehicleId] = useState(null);
  const [vehicleSpeed, setVehicleSpeed] = useState(0);

  // Interaction State
  const [activePOI, setActivePOI] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [modalFeedback, setModalFeedback] = useState(null);

  // Admin Panel, Phone & Law Enforcement Overlay state
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isPhoneOpen, setIsPhoneOpen] = useState(false);
  const [isPoliceUIOpen, setIsPoliceUIOpen] = useState(false);
  const [radialTarget, setRadialTarget] = useState(null);

  // Builder & Grid-Snapping mode state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [placedCount, setPlacedCount] = useState(0);
  const [etherForgePreviewOpen, setEtherForgePreviewOpen] = useState(false);
  const [gridSnapSize, setGridSnapSize] = useState(0.5);
  const [objectSnapEnabled, setObjectSnapEnabled] = useState(true);
  const [selectedBuildItemId, setSelectedBuildItemId] = useState("b_wall_01");
  const [manualRotationY, setManualRotationY] = useState(0);
  const [isSpawnMenuOpen, setIsSpawnMenuOpen] = useState(false);
  const [snapStatusMsg, setSnapStatusMsg] = useState("");

  // Cannon.js 3D Physics State
  const physicsEngineRef = useRef(null);
  const [isPhysicsPanelOpen, setIsPhysicsPanelOpen] = useState(false);
  const [gravityMode, setGravityMode] = useState("earth");
  const [activePhysicsCount, setActivePhysicsCount] = useState(0);

  const [physicsSnapSize, setPhysicsSnapSize] = useState(1.0);
  const physicsSnapSizeRef = useRef(1.0);
  useEffect(() => { physicsSnapSizeRef.current = physicsSnapSize; }, [physicsSnapSize]);

  const [selectedPhysicsObjectId, setSelectedPhysicsObjectId] = useState(null);
  const [selectedObjColor, setSelectedObjColor] = useState('#3b82f6');
  const [selectedObjOpacity, setSelectedObjOpacity] = useState(1.0);
  const [selectedObjFriction, setSelectedObjFriction] = useState(0.4);
  const [selectedObjRestitution, setSelectedObjRestitution] = useState(0.4);
  const [selectedObjMass, setSelectedObjMass] = useState(10);
  const [selectedObjTexture, setSelectedObjTexture] = useState('none');
  const selectionHelperRef = useRef(null);
  const sceneRef = useRef(null);

  // Primitive Shape Customizer
  const [selectedPrimitiveType, setSelectedPrimitiveType] = useState('cube');
  const [primitiveSize, setPrimitiveSize] = useState(1.0);
  const [primitiveColor, setPrimitiveColor] = useState('#3b82f6');
  const [primitiveMass, setPrimitiveMass] = useState(10);
  const [primitiveBounciness, setPrimitiveBounciness] = useState(0.4);
  const [primitiveSpawnMode, setPrimitiveSpawnMode] = useState('throw');
  const [primitiveTexture, setPrimitiveTexture] = useState('none');

  // Sandbox Save/Load
  const [sandboxSaves, setSandboxSaves] = useState(() => {
    try {
      const stored = localStorage.getItem("troxt_sandbox_saves_v1");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn("Failed to read sandbox saves from localStorage:", e);
      return [];
    }
  });
  const [isSandboxSaveManagerOpen, setIsSandboxSaveManagerOpen] = useState(false);
  const [newSaveName, setNewSaveName] = useState("");
  const [saveStatusNotice, setSaveStatusNotice] = useState(null);
  const [importJsonInput, setImportJsonInput] = useState("");
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [isFlying, setIsFlying] = useState(false);

  // First Person Controller & Pointer Lock
  const fpsLookRef = useRef({ pitch: 0, yaw: 0 });
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const isPointerLockedRef = useRef(false);
  const cameraModeRef = useRef(cameraMode);
  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);

  const gmodBuilderRef = useRef(null);

  const gridSnapSizeRef = useRef(gridSnapSize);
  useEffect(() => { gridSnapSizeRef.current = gridSnapSize; }, [gridSnapSize]);

  const objectSnapEnabledRef = useRef(objectSnapEnabled);
  useEffect(() => { objectSnapEnabledRef.current = objectSnapEnabled; }, [objectSnapEnabled]);

  const selectedBuildItemIdRef = useRef(selectedBuildItemId);
  useEffect(() => { selectedBuildItemIdRef.current = selectedBuildItemId; }, [selectedBuildItemId]);

  const manualRotationYRef = useRef(manualRotationY);
  useEffect(() => { manualRotationYRef.current = manualRotationY; }, [manualRotationY]);

  const builderOpenRef = useRef(builderOpen);
  useEffect(() => { builderOpenRef.current = builderOpen; }, [builderOpen]);

  const personaRef = useRef(persona);
  useEffect(() => { personaRef.current = persona; }, [persona]);

  const weatherRef = useRef(weather);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const isInVehicleRef = useRef(isInVehicle);
  useEffect(() => { isInVehicleRef.current = isInVehicle; }, [isInVehicle]);

  // References for Animation & Physics Loop
  const animFrameId = useRef(0);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const cityRef = useRef(null);
  const wildlifeManagerRef = useRef(null);
  const [wildlifeAlert, setWildlifeAlert] = useState(null);
  const [playerWantedHud, setPlayerWantedHud] = useState({
    stars: 0, isWanted: false, inPursuit: false, evasionTimer: 0, heat: 0, nearestPoliceDist: 999
  });
  const lastWantedSyncRef = useRef(0);

  // Player & Vehicle Meshes
  const playerGroupRef = useRef(null);
  const playerLimbsRef = useRef(null);
  const vehicleGroupRef = useRef(null);
  const vehicleWheelsRef = useRef([]);
  const weatherParticlesRef = useRef(null);

  // Throttling refs
  const lastActivePoiIdRef = useRef(null);
  const lastSpeedometerUpdateRef = useRef(0);
  const currentDisplaySpeedRef = useRef(0);
  const lastPersonaSyncRef = useRef(0);

  const playerPhysics = useRef({
    x: persona.position.x || 0,
    y: persona.position.y || 0,
    z: persona.position.z || 10,
    vx: 0, vy: 0, vz: 0,
    rotY: persona.position.rotY || 0,
    targetRotY: persona.position.rotY || 0,
    isGrounded: true,
    isSprinting: false,
    animTime: 0
  });

  const vehiclePhysics = useRef({
    x: persona.vehicleState.x || 5,
    y: persona.vehicleState.y || 0.4,
    z: persona.vehicleState.z || 15,
    speed: persona.vehicleState.speed || 0,
    angle: persona.vehicleState.angle || 0,
    steering: 0
  });

  // Colyseus Real-time Multiplayer
  const colyseusRoomRef = useRef(null);

  useEffect(() => {
    let activeRoom = null;
    let isSubscribed = true;

    try {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}`;
      const client = new ColyseusClient(wsUrl);

      client.joinOrCreate("rp_room", {
        username: persona.name || "Citoyen",
        job: persona.job || "Civil",
        aura: "aura_divine"
      }).then((room) => {
        if (!isSubscribed) { room.leave(); return; }
        activeRoom = room;
        colyseusRoomRef.current = room;
        console.log(`✅ [Colyseus] Connecté à la room RP (${room.roomId}) !`);

        room.onStateChange((state) => {
          if (!isSubscribed) return;

          const remPlayers = [];
          if (state.players) {
            state.players.forEach((p, sessionId) => {
              if (sessionId !== room.sessionId) {
                remPlayers.push({
                  id: p.id || sessionId,
                  name: p.username || "Citoyen",
                  job: p.job || "Civil",
                  aura: p.aura || "none",
                  position: [p.x ?? 0, p.y ?? 0, p.z ?? 0],
                  rotation: p.rotation ?? 0,
                  animation: p.animation || "idle",
                  health: p.health ?? 100,
                  vehicleId: p.vehicleId || null
                });
              }
            });
          }
          setRemotePlayers(remPlayers);

          if (state.vehicles) {
            const vehs = [];
            state.vehicles.forEach((v) => {
              vehs.push({
                id: v.id, type: v.type, name: v.name,
                position: [v.x ?? 0, v.y ?? 0, v.z ?? 0],
                rotation: v.rotation ?? 0,
                speed: v.speed ?? 0,
                health: v.health ?? 100,
                locked: v.locked ?? false,
                driverId: v.driverId || null,
                siren: v.siren ?? false,
                headlights: v.headlights ?? true
              });
            });
            if (vehs.length > 0) setWorldVehicles(vehs);
          }

          if (state.chatMessages) {
            const msgs = [];
            state.chatMessages.forEach((m) => {
              msgs.push({
                id: m.id, senderId: m.senderId, senderName: m.senderName,
                type: m.type || "local", text: m.text,
                position: [m.x ?? 0, m.y ?? 0, m.z ?? 0],
                timestamp: m.timestamp || Date.now()
              });
            });
            setRpMessages(msgs);
          }

          if (state.timeOfDay !== undefined) setTimeOfDay(state.timeOfDay);
        });

        room.onLeave(() => { colyseusRoomRef.current = null; });
      }).catch((err) => {
        console.warn("⚠️ [Colyseus] Connexion room WS échouée, fallback HTTP active:", err);
      });
    } catch (e) {
      console.warn("⚠️ [Colyseus] Erreur client:", e);
    }

    // Fallback REST Polling
    const fetchInterval = setInterval(async () => {
      if (colyseusRoomRef.current) return;
      try {
        const res = await fetch("/api/multiplayer/state");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setRemotePlayers((data.players || []).filter((p) => p.id !== "local_player"));
            if (data.vehicles) setWorldVehicles(data.vehicles);
            if (data.chat) setRpMessages(data.chat);
          }
        }
      } catch (e) {}
    }, 1000);

    return () => {
      isSubscribed = false;
      clearInterval(fetchInterval);
      if (activeRoom) activeRoom.leave();
    };
  }, [persona.name, persona.job]);

  // Sync local player position & actions
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const phys = playerPhysics.current;
      let animName = "idle";
      const speedSq = phys.vx * phys.vx + phys.vz * phys.vz;
      if (speedSq > 15) animName = "run";
      else if (speedSq > 0.5) animName = "walk";

      const payload = {
        position: [phys.x, phys.y, phys.z],
        rotation: phys.rotY,
        animation: animName,
        health: persona.health || 100,
        vehicleId: currentVehicleId || "",
        username: persona.name || "Citoyen",
        job: persona.job || "Civil",
        aura: "aura_divine"
      };

      if (colyseusRoomRef.current) {
        colyseusRoomRef.current.send("update_player", payload);
      } else {
        fetch("/api/multiplayer/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player: {
              id: "local_player",
              name: payload.username,
              job: payload.job,
              aura: payload.aura,
              position: payload.position,
              rotation: payload.rotation,
              animation: payload.animation,
              health: payload.health,
              vehicleId: payload.vehicleId
            }
          })
        }).catch(() => {});
      }
    }, 150);

    return () => clearInterval(syncInterval);
  }, [persona.name, persona.job, persona.health, currentVehicleId]);

  const handleSendRpMessage = useCallback((msg) => {
    if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send("chat_message", { type: msg.type, text: msg.text });
    } else {
      fetch("/api/multiplayer/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg })
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.message) {
            setRpMessages((prev) => [...prev, data.message]);
          }
        }
      }).catch(() => {});
    }
  }, []);

  const handlePayCash = useCallback((targetName, amount) => {
    persona.updateEconomy(-amount, 0);
  }, [persona]);

  const handleEnterVehicle = useCallback((vehId) => {
    setCurrentVehicleId(vehId);
    setIsInVehicle(true);
  }, []);

  const handleRadialAction = useCallback((actionId, target) => {
    if (actionId === "enter_driver") {
      handleEnterVehicle(target.id);
    } else if (actionId === "issue_ticket" || actionId === "arrest_jail") {
      setIsPoliceUIOpen(true);
    } else if (actionId === "cuff_player") {
      const cuffed = PoliceSystem.toggleCuff(target.id);
      setModalFeedback(cuffed ? `🔒 ${target.name} a été menotté !` : `🔓 ${target.name} libéré !`);
      setTimeout(() => setModalFeedback(null), 3000);
    } else if (actionId === "inspect_id") {
      setModalFeedback(`👤 Identité : ${target.name} • Permis de conduire QC Valide`);
      setTimeout(() => setModalFeedback(null), 4000);
    } else if (actionId === "give_cash") {
      handlePayCash(target.name, 500);
    }
  }, [handleEnterVehicle, handlePayCash]);

  const cameraOrbit = useRef({
    yaw: Math.PI, pitch: 0.35, dist: 11,
    isDragging: false, lastX: 0, lastY: 0
  });

  const keysRef = useRef({});

  const playSfx = useCallback((type) => {
    if (!soundEnabledRef.current) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;

      if (type === "click") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.08);
        osc.start(t); osc.stop(t + 0.08);
      } else if (type === "buy") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.setValueAtTime(600, t + 0.08);
        osc.frequency.setValueAtTime(1200, t + 0.18);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.3);
        osc.start(t); osc.stop(t + 0.3);
      } else if (type === "step") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.06);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.06);
        osc.start(t); osc.stop(t + 0.06);
      } else if (type === "jump") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(450, t + 0.2);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
        osc.start(t); osc.stop(t + 0.2);
      } else if (type === "collision") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.12);
        osc.start(t); osc.stop(t + 0.12);
      } else if (type === "door" || type === "engine") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.25);
        osc.start(t); osc.stop(t + 0.25);
      }
    } catch {}
  }, []);

  const handleEnterGame = useCallback(() => {
    setIsLoadingScreen(false);
    setShowArrivalBanner(true);
    playSfx("buy");
    setTimeout(() => setShowArrivalBanner(false), 6000);
  }, [playSfx]);

  const travelToHub = useCallback((hub) => {
    playerPhysics.current.x = hub.pos.x;
    playerPhysics.current.y = hub.pos.y + 1;
    playerPhysics.current.z = hub.pos.z + 15;
    playerPhysics.current.vy = 0;
    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(hub.pos.x, hub.pos.y + 1, hub.pos.z + 15);
    }
    if (isInVehicleRef.current) {
      vehiclePhysics.current.x = hub.pos.x;
      vehiclePhysics.current.y = hub.pos.y + 1;
      vehiclePhysics.current.z = hub.pos.z + 15;
      vehiclePhysics.current.speed = 0;
      if (vehicleGroupRef.current) {
        vehicleGroupRef.current.position.set(hub.pos.x, hub.pos.y + 1, hub.pos.z + 15);
      }
    }
    setCurrentZoneName(hub.name);
    currentZoneRef.current = hub.name;
    playSfx("click");
  }, [playSfx]);

  const handlePlaceEtherForgeModel = useCallback((item, customColor, scale = 1.0) => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    let pX = playerPhysics.current.x + Math.sin(playerPhysics.current.rotY) * 3;
    let pZ = playerPhysics.current.z + Math.cos(playerPhysics.current.rotY) * 3;
    let pY = playerPhysics.current.y;

    const snapSize = gridSnapSizeRef.current;
    if (snapSize > 0) {
      pX = Math.round(pX / snapSize) * snapSize;
      pZ = Math.round(pZ / snapSize) * snapSize;
    }

    const group = new THREE.Group();
    group.name = `etherforge_prop_${item.id}_${Date.now()}`;
    group.position.set(pX, pY, pZ);

    const activeColor = customColor || item.color;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(activeColor),
      metalness: item.metalness,
      roughness: item.roughness,
      emissive: item.emissive ? new THREE.Color(item.emissive) : new THREE.Color(0x000000),
      emissiveIntensity: item.emissiveIntensity ?? 0
    });

    const [w, h, d] = item.dimensions;
    let mesh;

    switch (item.geometryType) {
      case 'cylinder':
        mesh = new THREE.Mesh(new THREE.CylinderGeometry((w * scale) / 2, (w * scale) / 2, h * scale, 24), mat);
        break;
      case 'sphere':
        mesh = new THREE.Mesh(new THREE.SphereGeometry((w * scale) / 2, 24, 24), mat);
        break;
      case 'torus':
        mesh = new THREE.Mesh(new THREE.TorusGeometry((w * scale) / 2, (h * scale) / 6, 16, 32), mat);
        break;
      case 'plane':
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * scale, h * scale), mat);
        mesh.rotation.x = -Math.PI / 2;
        break;
      case 'box':
      default:
        mesh = new THREE.Mesh(new THREE.BoxGeometry(w * scale, h * scale, d * scale), mat);
        break;
    }

    mesh.position.y = (h * scale) / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (item.emissive || item.category === 'weapons' || item.category === 'structures') {
      const light = new THREE.PointLight(new THREE.Color(activeColor), 2.5, 8);
      light.position.set(0, h * scale + 0.3, 0);
      group.add(light);
    }

    scene.add(group);
    setPlacedCount((c) => c + 1);
    playSfx("buy");

    if (item.source !== 'gmod') {
      addCustomCatalogItem({
        id: `forge_${item.id}_${Date.now()}`,
        name: item.name,
        category: item.category === 'weapons' ? 'outdoor' : item.category === 'structures' ? 'outdoor' : 'decor',
        size: [w * scale, h * scale, d * scale],
        color: activeColor,
        description: item.description,
        icon: 'Sparkles',
        price: item.price
      });
    }
  }, [playSfx]);

  const updateSelectionHelper = useCallback((id) => {
    if (!sceneRef.current) return;
    if (selectionHelperRef.current) {
      sceneRef.current.remove(selectionHelperRef.current);
      selectionHelperRef.current.dispose?.();
      selectionHelperRef.current = null;
    }
    if (id && physicsEngineRef.current) {
      const obj = physicsEngineRef.current.getPhysicsObjectById(id);
      if (obj) {
        const helper = new THREE.BoxHelper(obj.mesh, 0x06b6d4);
        sceneRef.current.add(helper);
        selectionHelperRef.current = helper;
      }
    }
  }, []);

  const handleSelectPhysicsObject = useCallback((id) => {
    setSelectedPhysicsObjectId(id);
    updateSelectionHelper(id);
    if (id && physicsEngineRef.current) {
      const obj = physicsEngineRef.current.getPhysicsObjectById(id);
      if (obj) {
        let mat = null;
        obj.mesh.traverse((child) => {
          if (!mat && child.isMesh) {
            const m = child.material;
            if (m) mat = Array.isArray(m) ? m[0] : m;
          }
        });
        if (mat) {
          if (mat.color) setSelectedObjColor("#" + mat.color.getHexString());
          setSelectedObjOpacity(mat.opacity !== undefined ? mat.opacity : 1.0);
        }
        if (obj.body.material) {
          setSelectedObjFriction(obj.body.material.friction ?? 0.4);
          setSelectedObjRestitution(obj.body.material.restitution ?? 0.4);
        }
        setSelectedObjMass(obj.body.mass ?? 10);
        setSelectedObjTexture(obj.mesh.userData.textureType || 'none');
      }
    }
  }, [updateSelectionHelper]);

  const handleUpdateSelectedObjProperty = useCallback((options) => {
    if (options.color !== undefined) setSelectedObjColor(options.color);
    if (options.opacity !== undefined) setSelectedObjOpacity(options.opacity);
    if (options.friction !== undefined) setSelectedObjFriction(options.friction);
    if (options.restitution !== undefined) setSelectedObjRestitution(options.restitution);
    if (options.mass !== undefined) setSelectedObjMass(options.mass);
    if (options.textureType !== undefined) setSelectedObjTexture(options.textureType);

    if (selectedPhysicsObjectId && physicsEngineRef.current) {
      physicsEngineRef.current.updateObjectProperties(selectedPhysicsObjectId, options);
      if (options.color || options.opacity || options.textureType) {
        updateSelectionHelper(selectedPhysicsObjectId);
      }
    }
  }, [selectedPhysicsObjectId, updateSelectionHelper]);

  const handleDeleteSelectedPhysicsObject = useCallback(() => {
    if (selectedPhysicsObjectId && physicsEngineRef.current) {
      physicsEngineRef.current.unregisterProp(selectedPhysicsObjectId);
      handleSelectPhysicsObject(null);
      setActivePhysicsCount(physicsEngineRef.current.getActiveObjectsCount());
      playSfx("click");
    }
  }, [selectedPhysicsObjectId, handleSelectPhysicsObject, playSfx]);

  const handleImpulseSelectedObject = useCallback(() => {
    if (selectedPhysicsObjectId && physicsEngineRef.current) {
      physicsEngineRef.current.applyImpulseToObject(selectedPhysicsObjectId, new THREE.Vector3(0, 15, 0));
      playSfx("collision");
    }
  }, [selectedPhysicsObjectId, playSfx]);

  const handleSpawnPrimitiveShape = useCallback((customType) => {
    if (physicsEngineRef.current && cameraRef.current) {
      const type = customType || selectedPrimitiveType;
      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3();
      cameraRef.current.getWorldPosition(origin);
      cameraRef.current.getWorldDirection(dir);

      let spawnPos = origin.clone();
      let initialVelocity = undefined;

      if (primitiveSpawnMode === 'throw' || customType) {
        spawnPos.add(dir.clone().multiplyScalar(1.8));
        initialVelocity = dir.clone().multiplyScalar(18);
      } else if (primitiveSpawnMode === 'drop') {
        spawnPos.add(dir.clone().multiplyScalar(2)).add(new THREE.Vector3(0, 5, 0));
      } else {
        spawnPos.add(dir.clone().multiplyScalar(2.5));
        spawnPos.y = Math.max(primitiveSize / 2, spawnPos.y);
      }

      const snap = physicsSnapSizeRef.current;
      if (snap > 0) {
        spawnPos.x = Math.round(spawnPos.x / snap) * snap;
        spawnPos.z = Math.round(spawnPos.z / snap) * snap;
        if (primitiveSpawnMode === 'ground' || primitiveSpawnMode === 'drop') {
          spawnPos.y = Math.round(spawnPos.y / snap) * snap;
          spawnPos.y = Math.max(primitiveSize / 2, spawnPos.y);
        }
      }

      const spawnedInfo = physicsEngineRef.current.spawnPrimitiveShape({
        shapeType: type,
        position: spawnPos,
        size: [primitiveSize, primitiveSize, primitiveSize],
        color: primitiveColor,
        mass: primitiveMass,
        isDynamic: primitiveMass > 0,
        bounciness: primitiveBounciness,
        initialVelocity,
        textureType: primitiveTexture
      });

      playSfx("jump");
      setActivePhysicsCount(physicsEngineRef.current.getActiveObjectsCount());
      if (spawnedInfo) handleSelectPhysicsObject(spawnedInfo.id);
    }
  }, [selectedPrimitiveType, primitiveSize, primitiveColor, primitiveMass, primitiveBounciness, primitiveSpawnMode, primitiveTexture, playSfx, handleSelectPhysicsObject]);

  const handleLaunchPhysicsProp = useCallback((type) => {
    if (physicsEngineRef.current && cameraRef.current) {
      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3();
      cameraRef.current.getWorldPosition(origin);
      cameraRef.current.getWorldDirection(dir);
      origin.add(dir.clone().multiplyScalar(1.5));
      physicsEngineRef.current.launchPhysicsProp(type, origin, dir, 25);
      playSfx("jump");
      setActivePhysicsCount(physicsEngineRef.current.getActiveObjectsCount());
    }
  }, [playSfx]);

  const handleSetGravityMode = useCallback((mode) => {
    setGravityMode(mode);
    playSfx("click");
    if (!physicsEngineRef.current) return;
    if (mode === "earth") physicsEngineRef.current.setGravity(-9.81);
    else if (mode === "moon") physicsEngineRef.current.setGravity(-1.6);
    else if (mode === "zero") physicsEngineRef.current.setGravity(0);
    else if (mode === "heavy") physicsEngineRef.current.setGravity(-25);
  }, [playSfx]);

  const handleTriggerExplosion = useCallback(() => {
    if (physicsEngineRef.current && playerGroupRef.current) {
      physicsEngineRef.current.applyExplosionImpulse(playerGroupRef.current.position, 12, 50);
      playSfx("collision");
    }
  }, [playSfx]);

  const persistSandboxSaves = useCallback((saves) => {
    setSandboxSaves(saves);
    try {
      localStorage.setItem("troxt_sandbox_saves_v1", JSON.stringify(saves));
    } catch (e) {
      console.error("Failed to persist sandbox saves:", e);
    }
  }, []);

  const showSaveNotice = useCallback((msg) => {
    setSaveStatusNotice(msg);
    setTimeout(() => setSaveStatusNotice(null), 4500);
  }, []);

  const handleSaveCurrentSandbox = useCallback((customName) => {
    const physData = physicsEngineRef.current ? physicsEngineRef.current.exportState() : [];
    const propData = gmodBuilderRef.current ? gmodBuilderRef.current.placedProps : [];
    const slotName = customName || newSaveName.trim() || `Sandbox ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newSlot = {
      id: slotId, name: slotName, timestamp: Date.now(),
      physicsObjects: physData, placedProps: propData,
      environment: { gravityMode, weather }
    };

    const updated = [newSlot, ...sandboxSaves.filter((s) => s.name !== slotName)];
    persistSandboxSaves(updated);
    setNewSaveName("");
    playSfx("click");
    showSaveNotice(`✅ Sandbox "${slotName}" sauvegardé (${physData.length} formes, ${propData.length} objets GMod)!`);
  }, [newSaveName, gravityMode, weather, sandboxSaves, persistSandboxSaves, playSfx, showSaveNotice]);

  const handleQuickSave = useCallback(() => {
    handleSaveCurrentSandbox("Sauvegarde Rapide (QuickSave)");
  }, [handleSaveCurrentSandbox]);

  const handleLoadSandboxSlot = useCallback((slot) => {
    if (physicsEngineRef.current && slot.physicsObjects) {
      physicsEngineRef.current.importState(slot.physicsObjects);
      setActivePhysicsCount(physicsEngineRef.current.getActiveObjectsCount());
    }
    if (gmodBuilderRef.current && slot.placedProps) {
      gmodBuilderRef.current.clearAllProps();
      gmodBuilderRef.current.placedProps = JSON.parse(JSON.stringify(slot.placedProps));
      gmodBuilderRef.current.instantiateAllStoredProps();
      gmodBuilderRef.current.saveToStorage();
    }
    if (slot.environment) {
      if (slot.environment.gravityMode) {
        setGravityMode(slot.environment.gravityMode);
        if (physicsEngineRef.current) {
          const gravValues = { earth: -9.81, moon: -1.62, zero: 0, heavy: -25 };
          physicsEngineRef.current.setGravity(gravValues[slot.environment.gravityMode]);
        }
      }
      if (slot.environment.weather) setWeather(slot.environment.weather);
    }
    handleSelectPhysicsObject(null);
    playSfx("click");
    showSaveNotice(`📂 Sandbox "${slot.name}" restauré avec succès (${slot.physicsObjects?.length || 0} formes 3D, ${slot.placedProps?.length || 0} objets GMod) !`);
  }, [handleSelectPhysicsObject, playSfx, showSaveNotice]);

  const handleQuickLoad = useCallback(() => {
    const quickSlot = sandboxSaves.find((s) => s.name === "Sauvegarde Rapide (QuickSave)");
    if (quickSlot) handleLoadSandboxSlot(quickSlot);
    else if (sandboxSaves.length > 0) handleLoadSandboxSlot(sandboxSaves[0]);
    else showSaveNotice("⚠️ Aucune sauvegarde rapide trouvée dans le LocalStorage.");
  }, [sandboxSaves, handleLoadSandboxSlot, showSaveNotice]);

  const handleDeleteSandboxSlot = useCallback((slotId) => {
    const slot = sandboxSaves.find((s) => s.id === slotId);
    const updated = sandboxSaves.filter((s) => s.id !== slotId);
    persistSandboxSaves(updated);
    playSfx("click");
    if (slot) showSaveNotice(`🗑️ Sauvegarde "${slot.name}" supprimée.`);
  }, [sandboxSaves, persistSandboxSaves, playSfx, showSaveNotice]);

  const handleClearCurrentSandbox = useCallback(() => {
    if (physicsEngineRef.current) {
      physicsEngineRef.current.clearAll();
      setActivePhysicsCount(0);
    }
    if (gmodBuilderRef.current) {
      gmodBuilderRef.current.clearAllProps();
      setPlacedCount(0);
    }
    handleSelectPhysicsObject(null);
    playSfx("click");
    showSaveNotice("🧹 Sandbox réinitialisé : tous les objets ont été retirés de la scène.");
  }, [handleSelectPhysicsObject, playSfx, showSaveNotice]);

  const handleExportSandboxJSON = useCallback(() => {
    const physData = physicsEngineRef.current ? physicsEngineRef.current.exportState() : [];
    const propData = gmodBuilderRef.current ? gmodBuilderRef.current.placedProps : [];
    const exportObject = {
      version: 1, timestamp: Date.now(),
      name: "TroxT 3D Sandbox Export",
      physicsObjects: physData, placedProps: propData,
      environment: { gravityMode, weather }
    };
    const jsonStr = JSON.stringify(exportObject, null, 2);
    setImportJsonInput(jsonStr);
    setShowJsonModal(true);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        showSaveNotice("📋 Export JSON copié dans le presse-papier !");
      }).catch(() => {});
    }
  }, [gravityMode, weather, showSaveNotice]);

  const handleImportSandboxJSON = useCallback(() => {
    try {
      const parsed = JSON.parse(importJsonInput);
      if (parsed && (parsed.physicsObjects || parsed.placedProps)) {
        const slot = {
          id: `import_${Date.now()}`,
          name: parsed.name || "Imported Sandbox",
          timestamp: parsed.timestamp || Date.now(),
          physicsObjects: parsed.physicsObjects || [],
          placedProps: parsed.placedProps || [],
          environment: parsed.environment
        };
        handleLoadSandboxSlot(slot);
        setShowJsonModal(false);
        setImportJsonInput("");
        showSaveNotice("✨ Sandbox importé et instancié depuis le JSON !");
      } else {
        alert("JSON invalide. Doit contenir des données de physicsObjects ou placedProps.");
      }
    } catch (e) {
      alert("Erreur de lecture du JSON : " + e.message);
    }
  }, [importJsonInput, handleLoadSandboxSlot, showSaveNotice]);

  const handleLoadPresetSandbox = useCallback((presetType) => {
    handleClearCurrentSandbox();
    if (!physicsEngineRef.current) return;

    if (presetType === 'pyramid') {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];
      let colorIdx = 0;
      const basePos = new THREE.Vector3(0, 0.5, -3);
      for (let row = 4; row >= 1; row--) {
        const rowY = (4 - row) * 1.05 + 0.5;
        const startX = -((row - 1) * 1.1) / 2;
        for (let col = 0; col < row; col++) {
          const posX = startX + col * 1.1;
          physicsEngineRef.current.spawnPrimitiveShape({
            shapeType: 'cube',
            position: new THREE.Vector3(posX, rowY, basePos.z),
            size: [1, 1, 1],
            color: colors[colorIdx % colors.length],
            mass: 10, isDynamic: true, bounciness: 0.3
          });
          colorIdx++;
        }
      }
      showSaveNotice("🏗️ Modèle 'Pyramide 3D' généré dans la scène !");
    } else if (presetType === 'domino') {
      for (let i = 0; i < 8; i++) {
        physicsEngineRef.current.spawnPrimitiveShape({
          shapeType: 'cube',
          position: new THREE.Vector3(0, 1.0, -2 - i * 1.2),
          size: [1.2, 2.0, 0.25],
          color: i % 2 === 0 ? '#10b981' : '#f59e0b',
          mass: 5, isDynamic: true, bounciness: 0.1
        });
      }
      physicsEngineRef.current.spawnPrimitiveShape({
        shapeType: 'sphere',
        position: new THREE.Vector3(0, 2.2, 0.5),
        size: [0.9, 0.9, 0.9],
        color: '#ef4444', mass: 30, isDynamic: true, bounciness: 0.6
      });
      showSaveNotice("🎳 Circuit 'Dominos & Balle Lourde' créé !");
    } else if (presetType === 'furniture') {
      if (gmodBuilderRef.current) {
        gmodBuilderRef.current.placedProps = [
          { uuid: 'prop_p1', itemId: 'couch_nova', position: { x: 0, y: 0, z: -4 }, rotation: { x: 0, y: 0, z: 0 } },
          { uuid: 'prop_p2', itemId: 'coffee_table', position: { x: 0, y: 0, z: -2.2 }, rotation: { x: 0, y: 0, z: 0 } },
          { uuid: 'prop_p3', itemId: 'lcd_tv', position: { x: 0, y: 0, z: -0.8 }, rotation: { x: 0, y: Math.PI, z: 0 } },
          { uuid: 'prop_p4', itemId: 'standing_lamp', position: { x: -1.8, y: 0, z: -4 }, rotation: { x: 0, y: 0, z: 0 } },
          { uuid: 'prop_p5', itemId: 'potted_plant', position: { x: 1.8, y: 0, z: -4 }, rotation: { x: 0, y: 0, z: 0 } }
        ];
        gmodBuilderRef.current.instantiateAllStoredProps();
        gmodBuilderRef.current.saveToStorage();
        setPlacedCount(gmodBuilderRef.current.placedProps.length);
      }
      showSaveNotice("🛋️ Aménagement 'Salon Design GMod' instancié !");
    }

    setActivePhysicsCount(physicsEngineRef.current.getActiveObjectsCount());
    playSfx("click");
  }, [handleClearCurrentSandbox, playSfx, showSaveNotice]);

  const handleClearPhysicsObjects = useCallback(() => {
    if (physicsEngineRef.current) {
      physicsEngineRef.current.clearAll();
      setActivePhysicsCount(0);
      playSfx("click");
    }
  }, [playSfx]);

  useEffect(() => {
    AudioManager.getInstance().init();
  }, []);

  // Player Mesh
  const createPlayerMesh = useCallback(() => {
    const group = new THREE.Group();
    group.name = "Player_Avatar_Group";

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c29b, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.2 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });

    const shadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.01;
    group.add(shadowMesh);

    const body = new THREE.Group();
    body.position.y = 0.85;
    group.add(body);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.42), jacketMat);
    torso.position.y = 0.45; torso.castShadow = true;
    body.add(torso);

    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.44), goldMat);
    collar.position.set(0, 0.88, 0);
    body.add(collar);

    const head = new THREE.Group();
    head.position.set(0, 1.25, 0);
    body.add(head);

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skinMat);
    headMesh.castShadow = true;
    head.add(headMesh);

    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.2, 0.58), hairMat);
    hair.position.set(0, 0.3, -0.02);
    head.add(hair);

    const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.3), jacketMat);
    capVisor.position.set(0, 0.28, 0.35);
    head.add(capVisor);

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), eyeMat);
    eyeL.position.set(-0.14, 0.05, 0.28);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;
    head.add(eyeL, eyeR);

    const armL = new THREE.Group();
    armL.position.set(-0.48, 0.8, 0);
    const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), jacketMat);
    armLMesh.position.y = -0.3; armLMesh.castShadow = true;
    armL.add(armLMesh);
    body.add(armL);

    const armR = new THREE.Group();
    armR.position.set(0.48, 0.8, 0);
    const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), jacketMat);
    armRMesh.position.y = -0.3; armRMesh.castShadow = true;
    armR.add(armRMesh);
    body.add(armR);

    const legL = new THREE.Group();
    legL.position.set(-0.2, 0, 0);
    const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.26), pantsMat);
    legLMesh.position.y = -0.375; legLMesh.castShadow = true;
    legL.add(legLMesh);

    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.38), shoeMat);
    shoeL.position.set(0, -0.72, 0.05);
    legL.add(shoeL);
    body.add(legL);

    const legR = new THREE.Group();
    legR.position.set(0.2, 0, 0);
    const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.26), pantsMat);
    legRMesh.position.y = -0.375; legRMesh.castShadow = true;
    legR.add(legRMesh);

    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.38), shoeMat);
    shoeR.position.set(0, -0.72, 0.05);
    legR.add(shoeR);
    body.add(legR);

    playerLimbsRef.current = { legL, legR, armL, armR, head, body };
    return group;
  }, []);

  // Vehicle Mesh
  const createVehicleMesh = useCallback(() => {
    const carGroup = new THREE.Group();
    carGroup.name = "Quebec_Supercar_Mesh";

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.15, metalness: 0.85 });
    const darkGlassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.4), bodyMat);
    chassis.position.y = 0.55; chassis.castShadow = true;
    carGroup.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), darkGlassMat);
    cabin.position.set(0, 1.1, -0.2); cabin.castShadow = true;
    carGroup.add(cabin);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.4), bodyMat);
    wing.position.set(0, 1.15, -2.1);
    carGroup.add(wing);

    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), lightMat);
    hlL.position.set(-0.75, 0.65, 2.21);
    const hlR = hlL.clone();
    hlR.position.x = 0.75;
    carGroup.add(hlL, hlR);

    const headSpotL = new THREE.SpotLight(0x38bdf8, 5, 25, Math.PI / 6, 0.5);
    headSpotL.position.set(-0.75, 0.65, 2.2);
    headSpotL.target.position.set(-0.75, 0, 15);
    carGroup.add(headSpotL);
    carGroup.add(headSpotL.target);

    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), tailMat);
    tlL.position.set(-0.7, 0.7, -2.21);
    const tlR = tlL.clone();
    tlR.position.x = 0.7;
    carGroup.add(tlL, tlR);

    vehicleWheelsRef.current = [];
    const wheelPositions = [
      [-1.15, 0.4, 1.3],
      [1.15, 0.4, 1.3],
      [-1.15, 0.4, -1.3],
      [1.15, 0.4, -1.3]
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wx, wy, wz);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.32, 16), tireMat);
      tire.rotation.z = Math.PI / 2; tire.castShadow = true;
      wGroup.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.33, 10), rimMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);

      carGroup.add(wGroup);
      vehicleWheelsRef.current.push(tire);
    });

    carGroup.position.set(vehiclePhysics.current.x, vehiclePhysics.current.y, vehiclePhysics.current.z);
    return carGroup;
  }, []);

  // THREEJS SCENE INITIALIZATION & UNIFIED RENDER LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.Fog(0x93c5fd, 300, 7500);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 8500);
    camera.position.set(0, 8, 20);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    // 4. Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.0);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff7ed, 2.5);
    sun.position.set(40, 60, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 600;
    const sSize = 150;
    sun.shadow.camera.left = -sSize;
    sun.shadow.camera.right = sSize;
    sun.shadow.camera.top = sSize;
    sun.shadow.camera.bottom = -sSize;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    // 5. Build City
    ShaderManager.getInstance().compileEngineShaders(renderer, scene, camera);
    const city = new CityArchitect(scene);
    city.buildStreetNetwork();
    city.buildStreetlamps();
    city.buildSceneryProps();
    city.buildResidentialHouses("completed");
    city.buildCompleteVillageImprovements();
    cityRef.current = city;

    // 5b. Route 138
    const route138World = new Route138ImmersiveWorld();
    scene.add(route138World.root);
    route138WorldRef.current = route138World;

    // 5c. Wildlife
    const wildlifeManager = new Wildlife3DManager(scene);
    wildlifeManagerRef.current = wildlifeManager;

    // 5d. Physics
    const physicsEngine = new PhysicsEngine(scene);
    physicsEngine.onCollisionCallback = (impact) => {
      if (impact > 2.2) playSfx("collision");
    };
    physicsEngineRef.current = physicsEngine;

    // 5e. GMod Builder
    const builder = new GModBuilder(scene);
    builder.physicsEngine = physicsEngine;
    builder.instantiateAllStoredProps();
    gmodBuilderRef.current = builder;
    setPlacedCount(builder.placedProps.length);

    // 6. Player Avatar & Vehicle
    const playerMesh = createPlayerMesh();
    playerMesh.position.set(playerPhysics.current.x, playerPhysics.current.y, playerPhysics.current.z);
    scene.add(playerMesh);
    playerGroupRef.current = playerMesh;

    const vehicleMesh = createVehicleMesh();
    scene.add(vehicleMesh);
    vehicleGroupRef.current = vehicleMesh;

    // 7. Weather Particles
    const particleCount = 600;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 120;
      particlePos[i * 3 + 1] = Math.random() * 30;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.15, transparent: true, opacity: 0.6 });
    const weatherParticles = new THREE.Points(particleGeo, particleMat);
    weatherParticles.visible = false;
    scene.add(weatherParticles);
    weatherParticlesRef.current = weatherParticles;

    // 8. Event Listeners
    const onKeyDown = (e) => {
      keysRef.current[e.code] = true;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;

      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        if (activeGestureRef.current !== "none") setActiveGesture("none");
      }

      if (e.code === "KeyV" && !e.ctrlKey && !e.metaKey) {
        setCameraMode((prev) => {
          const modes = ["gta5_close", "follow", "far", "firstperson", "topdown"];
          return modes[(modes.indexOf(prev) + 1) % modes.length];
        });
        playSfx("click");
      }

      if (e.code === "KeyN" && !e.ctrlKey && !e.metaKey) {
        setIsNoclipEnabled((prev) => !prev);
        playSfx("click");
      }

      if (e.code === "KeyX" && !e.ctrlKey && !e.metaKey) {
        setActiveGesture((prev) => (prev === "surrender" ? "none" : "surrender"));
        playSfx("click");
      }

      if (e.code === "KeyG" && !e.ctrlKey && !e.metaKey && !builderOpenRef.current) {
        setIsGestureWheelOpen((prev) => !prev);
        playSfx("click");
      }

      if (builderOpenRef.current || selectedBuildItemIdRef.current) {
        if (e.code === "KeyR") {
          setManualRotationY((prev) => (prev + Math.PI / 4) % (Math.PI * 2));
          playSfx("click");
        } else if (e.code === "KeyG") {
          setGridSnapSize((prev) => {
            const steps = [0, 0.25, 0.5, 1.0, 2.0];
            return steps[(steps.indexOf(prev) + 1) % steps.length];
          });
          playSfx("click");
        } else if (e.code === "KeyS" && e.shiftKey) {
          setObjectSnapEnabled((prev) => !prev);
          playSfx("click");
        } else if (e.code === "KeyZ" && (e.ctrlKey || e.metaKey)) {
          if (gmodBuilderRef.current) {
            gmodBuilderRef.current.undo();
            setPlacedCount(gmodBuilderRef.current.placedProps.length);
            playSfx("click");
          }
        } else if (e.code === "Escape") {
          setSelectedBuildItemId(null);
          setIsSpawnMenuOpen(false);
          setIsGestureWheelOpen(false);
        }
      }

      if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey && !builderOpenRef.current) {
        handleLaunchPhysicsProp('sphere');
      }
    };
    const onKeyUp = (e) => { keysRef.current[e.code] = false; };

    const onPointerLockChange = () => {
      const isLocked = document.pointerLockElement === canvas;
      isPointerLockedRef.current = isLocked;
      setIsPointerLocked(isLocked);
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let mouseStartPos = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      mouseStartPos = { x: e.clientX, y: e.clientY };
      if (cameraModeRef.current === "firstperson" && !isPointerLockedRef.current && e.button === 0) {
        try { canvas.requestPointerLock(); } catch {}
      }
      if (e.button === 0 || e.button === 2) {
        cameraOrbit.current.isDragging = true;
        cameraOrbit.current.lastX = e.clientX;
        cameraOrbit.current.lastY = e.clientY;
      }
    };

    const onMouseUp = (e) => {
      cameraOrbit.current.isDragging = false;
      const dx = Math.abs(e.clientX - mouseStartPos.x);
      const dy = Math.abs(e.clientY - mouseStartPos.y);
      if (dx < 5 && dy < 5 && e.button === 0 && physicsEngineRef.current && cameraRef.current) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, cameraRef.current);
        const physObjects = physicsEngineRef.current.getPhysicsObjects();
        const meshes = physObjects.map((o) => o.mesh);
        const intersects = raycaster.intersectObjects(meshes, true);
        if (intersects.length > 0) {
          let hitMesh = intersects[0].object;
          while (hitMesh.parent && !physObjects.some((o) => o.mesh === hitMesh) && hitMesh.parent !== scene) {
            hitMesh = hitMesh.parent;
          }
          const found = physObjects.find((o) => o.mesh === hitMesh || o.mesh.children.includes(hitMesh));
          if (found) {
            handleSelectPhysicsObject(found.id);
            setIsPhysicsPanelOpen(true);
            playSfx("click");
          }
        }
      }
    };

    const onMouseMove = (e) => {
      if (cameraModeRef.current === "firstperson") {
        if (isPointerLockedRef.current || cameraOrbit.current.isDragging) {
          const sensitivity = 0.0024;
          const dx = e.movementX !== undefined && e.movementX !== 0 ? e.movementX : (e.clientX - cameraOrbit.current.lastX);
          const dy = e.movementY !== undefined && e.movementY !== 0 ? e.movementY : (e.clientY - cameraOrbit.current.lastY);
          fpsLookRef.current.yaw -= dx * sensitivity;
          fpsLookRef.current.pitch -= dy * sensitivity;
          const maxPitch = Math.PI / 2 - 0.08;
          fpsLookRef.current.pitch = Math.max(-maxPitch, Math.min(maxPitch, fpsLookRef.current.pitch));
          cameraOrbit.current.yaw = fpsLookRef.current.yaw;
          cameraOrbit.current.lastX = e.clientX;
          cameraOrbit.current.lastY = e.clientY;
        }
        return;
      }
      if (!cameraOrbit.current.isDragging) return;
      const dx = e.clientX - cameraOrbit.current.lastX;
      const dy = e.clientY - cameraOrbit.current.lastY;
      cameraOrbit.current.yaw -= dx * 0.005;
      cameraOrbit.current.pitch = Math.max(0.08, Math.min(Math.PI / 2.2, cameraOrbit.current.pitch + dy * 0.004));
      cameraOrbit.current.lastX = e.clientX;
      cameraOrbit.current.lastY = e.clientY;
    };

    const onWheel = (e) => {
      cameraOrbit.current.dist = Math.max(4, Math.min(30, cameraOrbit.current.dist + e.deltaY * 0.015));
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: true });

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // MAIN RENDER LOOP
    const clock = new SafeTimer();
    let stepSoundTimer = 0;

    const gameLoop = () => {
      animFrameId.current = requestAnimationFrame(gameLoop);
      const delta = Math.min(clock.getDelta(), 0.05);
      const keys = keysRef.current;
      const now = performance.now();

      if (cityRef.current && cityRef.current.windmillSails) {
        cityRef.current.windmillSails.rotation.z += 0.01;
      }
      if (cityRef.current && cityRef.current.lighthouseBeam) {
        cityRef.current.lighthouseBeam.rotation.y += 0.018;
      }

      const pPos = [playerPhysics.current.x, playerPhysics.current.y, playerPhysics.current.z];
      if (wildlifeManagerRef.current) {
        const isCrouching = keys["ControlLeft"] || keys["KeyC"] || false;
        const sirenWailing = PoliceSystem.getVehicleLightbarState().sirenSound;
        wildlifeManagerRef.current.update(delta, pPos, isCrouching, sirenWailing, false);
        if (wildlifeManagerRef.current.activeAlert !== wildlifeAlert) {
          setWildlifeAlert(wildlifeManagerRef.current.activeAlert);
        }
      }

      const nearestPoliceDist = PoliceSystem.updateAIPatrolVehicles(delta, pPos);
      const wantedState = PoliceSystem.updateWantedState(delta, pPos, nearestPoliceDist);
      const nowMs = performance.now();
      if (nowMs - lastWantedSyncRef.current > 250) {
        lastWantedSyncRef.current = nowMs;
        setPlayerWantedHud({
          stars: wantedState.stars,
          isWanted: wantedState.isWanted,
          inPursuit: wantedState.inPursuit,
          evasionTimer: Math.ceil(wantedState.evasionTimer),
          heat: Math.round(wantedState.heat),
          nearestPoliceDist: Math.round(nearestPoliceDist)
        });
      }

      const currentW = weatherRef.current;
      if (weatherParticlesRef.current) {
        const wp = weatherParticlesRef.current;
        if (currentW === "rain" || currentW === "snow") {
          wp.visible = true;
          const posAttr = wp.geometry.attributes.position;
          const arr = posAttr.array;
          const fallSpeed = currentW === "rain" ? 25 : 8;
          for (let i = 0; i < particleCount; i++) {
            arr[i * 3 + 1] -= delta * fallSpeed;
            if (arr[i * 3 + 1] < 0) {
              arr[i * 3 + 1] = 25;
              arr[i * 3] = playerPhysics.current.x + (Math.random() - 0.5) * 80;
              arr[i * 3 + 2] = playerPhysics.current.z + (Math.random() - 0.5) * 80;
            }
          }
          posAttr.needsUpdate = true;
        } else {
          wp.visible = false;
        }
      }

      if (physicsEngineRef.current) physicsEngineRef.current.step(delta);

      if (scene.background) {
        let skyHex = 0x7dd3fc;
        if (currentW === "night") skyHex = 0x090e1c;
        else if (currentW === "rain") skyHex = 0x334155;
        else if (currentW === "snow") skyHex = 0x64748b;
        scene.background.setHex(skyHex);
        if (scene.fog && 'color' in scene.fog) scene.fog.color.setHex(skyHex);
      }

      if (route138WorldRef.current) {
        route138WorldRef.current.update(delta, clock.getElapsedTime());
      }

      if (gmodBuilderRef.current) {
        gmodBuilderRef.current.enableObjectSnapping = objectSnapEnabledRef.current;
        if (builderOpenRef.current || selectedBuildItemIdRef.current) {
          const rayOrigin = new THREE.Vector3();
          const rayDirection = new THREE.Vector3();
          if (cameraRef.current) {
            cameraRef.current.getWorldPosition(rayOrigin);
            cameraRef.current.getWorldDirection(rayDirection);
          }
          const groundObjects = [];
          scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.visible && !obj.name.startsWith('ghost') && !obj.name.startsWith('player')) {
              groundObjects.push(obj);
            }
          });
          gmodBuilderRef.current.updateGhostPreview(
            selectedBuildItemIdRef.current, rayOrigin, rayDirection,
            gridSnapSizeRef.current,
            playerPhysics.current.rotY + manualRotationYRef.current,
            groundObjects
          );
          if (gmodBuilderRef.current.lastSnapMessage) {
            setSnapStatusMsg(gmodBuilderRef.current.lastSnapMessage);
          }
        } else {
          gmodBuilderRef.current.clearGhost();
        }
      }

      const inVehicle = isInVehicleRef.current;
      if (inVehicle) {
        const veh = vehiclePhysics.current;
        const isBoost = keys["ShiftLeft"] || keys["ShiftRight"];
        const accel = keys["KeyW"] || keys["ArrowUp"] ? (isBoost ? 28 : 18) : keys["KeyS"] || keys["ArrowDown"] ? -14 : 0;
        const steer = keys["KeyA"] || keys["ArrowLeft"] ? 1 : keys["KeyD"] || keys["ArrowRight"] ? -1 : 0;
        const maxForward = isBoost ? 62 : 42;
        if (accel !== 0) {
          veh.speed = Math.max(-16, Math.min(maxForward, veh.speed + accel * delta));
        } else {
          veh.speed *= 0.97;
        }
        if (Math.abs(veh.speed) > 0.1) {
          veh.angle += steer * 1.8 * delta * (veh.speed > 0 ? 1 : -1);
        }
        veh.x += Math.sin(veh.angle) * veh.speed * delta;
        veh.z += Math.cos(veh.angle) * veh.speed * delta;
        veh.x = Math.max(-6500, Math.min(7500, veh.x));
        veh.z = Math.max(-5500, Math.min(3000, veh.z));
        if (vehicleGroupRef.current) {
          vehicleGroupRef.current.position.set(veh.x, veh.y, veh.z);
          vehicleGroupRef.current.rotation.y = veh.angle;
        }
        vehicleWheelsRef.current.forEach((wheel) => { wheel.rotation.x += veh.speed * delta * 0.5; });
        if (playerGroupRef.current) {
          playerGroupRef.current.position.set(veh.x, veh.y, veh.z);
          playerGroupRef.current.visible = false;
        }
        if (now - lastSpeedometerUpdateRef.current > 100) {
          lastSpeedometerUpdateRef.current = now;
          const displayKmh = Math.abs(Math.round(veh.speed * 3.6));
          if (displayKmh !== currentDisplaySpeedRef.current) {
            currentDisplaySpeedRef.current = displayKmh;
            setVehicleSpeed(displayKmh);
          }
        }
      } else if (isNoclipEnabledRef.current) {
        const p = playerPhysics.current;
        p.isSprinting = !!keys["ShiftLeft"] || !!keys["ShiftRight"];
        p.isGrounded = false;
        p.vy = 0;
        let currentSpeed = noclipSpeedRef.current;
        if (p.isSprinting) currentSpeed *= 2.5;
        else if (keys["ControlLeft"] || keys["ControlRight"] || keys["AltLeft"]) currentSpeed *= 0.4;
        const forwardX = Math.sin(cameraOrbit.current.yaw);
        const forwardZ = Math.cos(cameraOrbit.current.yaw);
        const rightX = Math.cos(cameraOrbit.current.yaw);
        const rightZ = -Math.sin(cameraOrbit.current.yaw);
        let moveX = 0, moveY = 0, moveZ = 0;
        if (keys["KeyW"] || keys["ArrowUp"]) { moveX -= forwardX; moveZ -= forwardZ; }
        if (keys["KeyS"] || keys["ArrowDown"]) { moveX += forwardX; moveZ += forwardZ; }
        if (keys["KeyA"] || keys["ArrowLeft"]) { moveX -= rightX; moveZ -= rightZ; }
        if (keys["KeyD"] || keys["ArrowRight"]) { moveX += rightX; moveZ += rightZ; }
        if (keys["Space"] || keys["KeyE"]) moveY += 1;
        if (keys["KeyC"] || keys["ControlLeft"] || keys["KeyQ"]) moveY -= 1;
        const isMoving = moveX !== 0 || moveY !== 0 || moveZ !== 0;
        if (isMoving) {
          const horizontalLen = Math.hypot(moveX, moveZ);
          if (horizontalLen > 0) {
            p.x += (moveX / horizontalLen) * currentSpeed * delta;
            p.z += (moveZ / horizontalLen) * currentSpeed * delta;
            p.targetRotY = Math.atan2(moveX, moveZ);
          }
          p.y += moveY * currentSpeed * delta;
        }
        let diff = p.targetRotY - p.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        p.rotY += diff * 0.15;
        p.x = Math.max(-6500, Math.min(7500, p.x));
        p.y = Math.max(-5, Math.min(500, p.y));
        p.z = Math.max(-5500, Math.min(3000, p.z));
        if (playerGroupRef.current) {
          playerGroupRef.current.position.set(p.x, p.y, p.z);
          playerGroupRef.current.rotation.y = p.rotY;
          playerGroupRef.current.visible = cameraModeRef.current !== "firstperson" && !inVehicle;
        }
        if (playerLimbsRef.current) {
          const limbs = playerLimbsRef.current;
          const flyTime = now * 0.005;
          limbs.body.position.y = 0.85 + Math.sin(flyTime * 3) * 0.08;
          limbs.armL.rotation.x = -Math.PI / 6;
          limbs.armR.rotation.x = -Math.PI / 6;
          limbs.armL.rotation.z = -Math.PI / 6 + Math.sin(flyTime * 2) * 0.05;
          limbs.armR.rotation.z = Math.PI / 6 - Math.sin(flyTime * 2) * 0.05;
          limbs.legL.rotation.x = Math.PI / 8;
          limbs.legR.rotation.x = Math.PI / 8;
          limbs.head.rotation.x = -Math.PI / 10;
        }
      } else {
        const p = playerPhysics.current;
        p.isSprinting = !!keys["ShiftLeft"] || !!keys["ShiftRight"];
        const speed = p.isSprinting ? 11 : 5.5;
        const forwardX = Math.sin(cameraOrbit.current.yaw);
        const forwardZ = Math.cos(cameraOrbit.current.yaw);
        const rightX = Math.cos(cameraOrbit.current.yaw);
        const rightZ = -Math.sin(cameraOrbit.current.yaw);
        let moveX = 0, moveZ = 0;
        if (keys["KeyW"] || keys["ArrowUp"]) { moveX -= forwardX; moveZ -= forwardZ; }
        if (keys["KeyS"] || keys["ArrowDown"]) { moveX += forwardX; moveZ += forwardZ; }
        if (keys["KeyA"] || keys["ArrowLeft"]) { moveX -= rightX; moveZ -= rightZ; }
        if (keys["KeyD"] || keys["ArrowRight"]) { moveX += rightX; moveZ += rightZ; }
        const isMoving = moveX !== 0 || moveZ !== 0;
        if (isMoving) {
          const len = Math.hypot(moveX, moveZ);
          moveX = (moveX / len) * speed * delta;
          moveZ = (moveZ / len) * speed * delta;
          p.x += moveX;
          p.z += moveZ;
          p.targetRotY = Math.atan2(moveX, moveZ);
          stepSoundTimer += delta;
          if (stepSoundTimer > (p.isSprinting ? 0.22 : 0.38)) {
            playSfx("step");
            stepSoundTimer = 0;
          }
        }
        if (keys["Space"] && p.isGrounded) {
          p.vy = 8.5;
          p.isGrounded = false;
          playSfx("jump");
        }
        if (!p.isGrounded) {
          p.vy -= 22 * delta;
          p.y += p.vy * delta;
          if (p.y <= 0) { p.y = 0; p.vy = 0; p.isGrounded = true; }
        }
        let diff = p.targetRotY - p.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        p.rotY += diff * 0.15;
        p.x = Math.max(-6500, Math.min(7500, p.x));
        p.z = Math.max(-5500, Math.min(3000, p.z));
        if (playerGroupRef.current) {
          playerGroupRef.current.position.set(p.x, p.y, p.z);
          playerGroupRef.current.rotation.y = p.rotY;
          playerGroupRef.current.visible = cameraModeRef.current !== "firstperson" && !inVehicle;
        }
        if (playerLimbsRef.current) {
          const limbs = playerLimbsRef.current;
          const currentGesture = activeGestureRef.current;
          if (isMoving) {
            if (currentGesture !== "none") setActiveGesture("none");
            p.animTime += delta * (p.isSprinting ? 14 : 8);
            const swing = Math.sin(p.animTime) * (p.isSprinting ? 0.8 : 0.5);
            limbs.legL.rotation.x = swing;
            limbs.legR.rotation.x = -swing;
            limbs.armL.rotation.x = -swing * 0.8;
            limbs.armR.rotation.x = swing * 0.8;
            limbs.armL.rotation.z = 0;
            limbs.armR.rotation.z = 0;
            limbs.armL.rotation.y = 0;
            limbs.armR.rotation.y = 0;
            limbs.legL.rotation.z = 0;
            limbs.legR.rotation.z = 0;
            limbs.head.rotation.set(0, 0, 0);
            limbs.body.position.y = 0.85 + Math.abs(Math.sin(p.animTime * 2)) * 0.08;
          } else if (currentGesture !== "none") {
            const gTime = now * 0.005;
            limbs.legL.rotation.x *= 0.8;
            limbs.legR.rotation.x *= 0.8;
            if (currentGesture === "wave") {
              limbs.armR.rotation.x = -Math.PI / 1.1;
              limbs.armR.rotation.z = Math.PI / 4 + Math.sin(gTime * 2) * 0.35;
              limbs.armL.rotation.x = Math.sin(gTime) * 0.05;
              limbs.head.rotation.y = Math.sin(gTime) * 0.1;
            } else if (currentGesture === "surrender") {
              limbs.armL.rotation.x = -Math.PI / 1.05;
              limbs.armR.rotation.x = -Math.PI / 1.05;
              limbs.armL.rotation.z = -0.25;
              limbs.armR.rotation.z = 0.25;
              limbs.head.rotation.x = -0.15;
            } else if (currentGesture === "cross_arms") {
              limbs.armL.rotation.x = -Math.PI / 2.2;
              limbs.armR.rotation.x = -Math.PI / 2.2;
              limbs.armL.rotation.y = 0.75;
              limbs.armR.rotation.y = -0.75;
            } else if (currentGesture === "point") {
              limbs.armR.rotation.x = -Math.PI / 2;
              limbs.armR.rotation.y = 0;
              limbs.armR.rotation.z = 0;
              limbs.head.rotation.y = 0.1;
            } else if (currentGesture === "dance") {
              const danceBeat = Math.sin(gTime * 3);
              limbs.armL.rotation.x = danceBeat * 0.7;
              limbs.armR.rotation.x = -danceBeat * 0.7;
              limbs.armL.rotation.z = -0.3 + Math.cos(gTime * 3) * 0.2;
              limbs.armR.rotation.z = 0.3 + Math.cos(gTime * 3) * 0.2;
              limbs.body.position.y = 0.85 + Math.abs(danceBeat) * 0.12;
              limbs.legL.rotation.z = Math.sin(gTime * 3) * 0.15;
              limbs.legR.rotation.z = -Math.sin(gTime * 3) * 0.15;
            } else if (currentGesture === "gang_sign") {
              limbs.armR.rotation.x = -Math.PI / 2.2;
              limbs.armR.rotation.z = -0.3;
              limbs.head.rotation.z = 0.15;
            } else if (currentGesture === "sit") {
              limbs.body.position.y = 0.38;
              limbs.legL.rotation.x = -Math.PI / 2.1;
              limbs.legR.rotation.x = -Math.PI / 2.1;
              limbs.legL.rotation.y = 0.3;
              limbs.legR.rotation.y = -0.3;
              limbs.armL.rotation.x = -0.2;
              limbs.armR.rotation.x = -0.2;
            } else if (currentGesture === "phone") {
              limbs.armR.rotation.x = -Math.PI / 1.3;
              limbs.armR.rotation.y = -0.5;
              limbs.armR.rotation.z = 0.35;
              limbs.head.rotation.z = -0.15;
            } else if (currentGesture === "salute") {
              limbs.armR.rotation.x = -Math.PI / 1.25;
              limbs.armR.rotation.y = -0.6;
              limbs.armR.rotation.z = 0.45;
              limbs.head.rotation.x = 0.1;
            }
          } else {
            p.animTime += delta * 2;
            limbs.legL.rotation.x *= 0.8;
            limbs.legR.rotation.x *= 0.8;
            limbs.armL.rotation.x *= 0.8;
            limbs.armR.rotation.x *= 0.8;
            limbs.armL.rotation.z *= 0.8;
            limbs.armR.rotation.z *= 0.8;
            limbs.armL.rotation.y *= 0.8;
            limbs.armR.rotation.y *= 0.8;
            limbs.legL.rotation.z *= 0.8;
            limbs.legR.rotation.z *= 0.8;
            limbs.head.rotation.set(0, 0, 0);
            limbs.body.position.y = 0.85 + Math.sin(p.animTime) * 0.02;
          }
        }
      }

      const targetPos = inVehicle
        ? new THREE.Vector3(vehiclePhysics.current.x, vehiclePhysics.current.y + 1.2, vehiclePhysics.current.z)
        : new THREE.Vector3(playerPhysics.current.x, playerPhysics.current.y + 1.2, playerPhysics.current.z);

      const currentCamMode = cameraModeRef.current;

      if (currentCamMode === "gta5_close") {
        const yaw = cameraOrbit.current.yaw;
        const pitch = cameraOrbit.current.pitch;
        const closeDist = Math.max(2.2, Math.min(4.0, cameraOrbit.current.dist * 0.35));
        const shoulderRightX = Math.cos(yaw) * 0.65;
        const shoulderRightZ = -Math.sin(yaw) * 0.65;
        const camX = targetPos.x - Math.sin(yaw) * Math.cos(pitch) * closeDist + shoulderRightX;
        const camY = targetPos.y + Math.sin(pitch) * closeDist + 0.35;
        const camZ = targetPos.z - Math.cos(yaw) * Math.cos(pitch) * closeDist + shoulderRightZ;
        const lookAtTarget = new THREE.Vector3(
          targetPos.x + shoulderRightX * 0.4,
          targetPos.y + 0.25,
          targetPos.z + shoulderRightZ * 0.4
        );
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.22);
        camera.lookAt(lookAtTarget);
      } else if (currentCamMode === "firstperson") {
        const yaw = fpsLookRef.current.yaw;
        const pitch = fpsLookRef.current.pitch;
        const lookDir = new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch)
        );
        camera.position.set(targetPos.x, targetPos.y + 0.45, targetPos.z);
        camera.lookAt(camera.position.clone().add(lookDir));
      } else if (currentCamMode === "follow") {
        const dist = cameraOrbit.current.dist;
        const pitch = cameraOrbit.current.pitch;
        const yaw = cameraOrbit.current.yaw;
        const camX = targetPos.x - Math.sin(yaw) * Math.cos(pitch) * dist;
        const camY = targetPos.y + Math.sin(pitch) * dist + 1.0;
        const camZ = targetPos.z - Math.cos(yaw) * Math.cos(pitch) * dist;
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.12);
        camera.lookAt(targetPos);
      } else if (currentCamMode === "far") {
        const dist = 22;
        const pitch = cameraOrbit.current.pitch;
        const yaw = cameraOrbit.current.yaw;
        const camX = targetPos.x - Math.sin(yaw) * Math.cos(pitch) * dist;
        const camY = targetPos.y + Math.sin(pitch) * dist + 2.5;
        const camZ = targetPos.z - Math.cos(yaw) * Math.cos(pitch) * dist;
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.1);
        camera.lookAt(targetPos);
      } else if (currentCamMode === "topdown") {
        camera.position.lerp(new THREE.Vector3(targetPos.x, targetPos.y + 35, targetPos.z + 0.1), 0.1);
        camera.lookAt(targetPos);
      }

      const px = inVehicle ? vehiclePhysics.current.x : playerPhysics.current.x;
      const pz = inVehicle ? vehiclePhysics.current.z : playerPhysics.current.z;

      let foundPOI = null;
      for (const poi of POINTS_OF_INTEREST) {
        const dist = Math.hypot(px - poi.x, pz - poi.z);
        if (dist <= poi.radius) { foundPOI = poi; break; }
      }
      if (foundPOI?.id !== lastActivePoiIdRef.current) {
        lastActivePoiIdRef.current = foundPOI?.id || null;
        setActivePOI(foundPOI);
      }

      if (now - lastPersonaSyncRef.current > 250) {
        lastPersonaSyncRef.current = now;
        personaRef.current.updatePosition({
          x: playerPhysics.current.x,
          y: playerPhysics.current.y,
          z: playerPhysics.current.z,
          rotY: playerPhysics.current.rotY
        });
        personaRef.current.updateVehicleState({
          isInVehicle: inVehicle,
          x: vehiclePhysics.current.x,
          y: vehiclePhysics.current.y,
          z: vehiclePhysics.current.z,
          angle: vehiclePhysics.current.angle,
          speed: vehiclePhysics.current.speed
        });
      }

      if (selectionHelperRef.current) {
        selectionHelperRef.current.update();
      }

      ShaderManager.getInstance().updateTimeUniforms(clock.getElapsedTime());
      renderer.render(scene, camera);
    };

    gameLoop();

    return () => {
      personaRef.current.updatePosition({
        x: playerPhysics.current.x,
        y: playerPhysics.current.y,
        z: playerPhysics.current.z,
        rotY: playerPhysics.current.rotY
      });
      personaRef.current.updateVehicleState({
        isInVehicle: isInVehicleRef.current,
        x: vehiclePhysics.current.x,
        y: vehiclePhysics.current.y,
        z: vehiclePhysics.current.z,
        angle: vehiclePhysics.current.angle,
        speed: vehiclePhysics.current.speed
      });

      cancelAnimationFrame(animFrameId.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", handleResize);
      wildlifeManagerRef.current?.dispose();
      renderer.dispose();
      scene.clear();
    };
  }, [createPlayerMesh, createVehicleMesh, playSfx]);

  // Minimap Radar
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const interval = setInterval(() => {
      const px = isInVehicle ? vehiclePhysics.current.x : playerPhysics.current.x;
      const pz = isInVehicle ? vehiclePhysics.current.z : playerPhysics.current.z;

      const zName = getZoneName(px, pz);
      if (zName !== currentZoneRef.current) {
        currentZoneRef.current = zName;
        setCurrentZoneName(zName);
      }

      ctx.clearRect(0, 0, 160, 160);
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, 160, 160);

      ctx.strokeStyle = "rgba(0, 212, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(80, 80, 70, 0, Math.PI * 2);
      ctx.arc(80, 80, 45, 0, Math.PI * 2);
      ctx.stroke();

      const scale = isInVehicle ? 0.035 : 0.25;

      const riverScreenY = 80 + (1600 - pz) * scale;
      if (riverScreenY < 160) {
        ctx.fillStyle = "rgba(12, 35, 64, 0.85)";
        ctx.fillRect(0, Math.max(0, riverScreenY), 160, 160);
      }

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = isInVehicle ? 3 : 5;
      ctx.beginPath();
      ctx.moveTo(80 + (-4800 - px) * scale, 80 + (300 - pz) * scale);
      ctx.lineTo(80 + (5600 - px) * scale, 80 + (280 - pz) * scale);
      ctx.stroke();

      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80 + (-3500 - px) * scale, 80 + (250 - pz) * scale);
      ctx.lineTo(80 + (-3800 - px) * scale, 80 + (-1200 - pz) * scale);
      ctx.moveTo(80 + (-2000 - px) * scale, 80 + (200 - pz) * scale);
      ctx.lineTo(80 + (-2600 - px) * scale, 80 + (-800 - pz) * scale);
      ctx.lineTo(80 + (-2800 - px) * scale, 80 + (-2600 - pz) * scale);
      ctx.moveTo(80 + (2200 - px) * scale, 80 + (80 - pz) * scale);
      ctx.lineTo(80 + (2000 - px) * scale, 80 + (-1000 - pz) * scale);
      ctx.lineTo(80 + (1600 - px) * scale, 80 + (-3600 - pz) * scale);
      ctx.stroke();

      if (activeGpsHub) {
        const gx = 80 + (activeGpsHub.pos.x - px) * scale;
        const gz = 80 + (activeGpsHub.pos.z - pz) * scale;
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(80, 80);
        ctx.lineTo(gx, gz);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ROUTE138_HUBS.forEach((hub) => {
        const hx = 80 + (hub.pos.x - px) * scale;
        const hz = 80 + (hub.pos.z - pz) * scale;
        if (hx >= 4 && hx <= 156 && hz >= 4 && hz <= 156) {
          ctx.fillStyle = hub.color;
          ctx.beginPath();
          ctx.arc(hx, hz, activeGpsHub?.id === hub.id ? 4.5 : 3.0, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      POINTS_OF_INTEREST.forEach((poi) => {
        const mx = 80 + (poi.x - px) * scale;
        const my = 80 + (poi.z - pz) * scale;
        if (mx >= 5 && mx <= 155 && my >= 5 && my <= 155) {
          ctx.fillStyle = poi.type === "cantine" ? "#f59e0b" : poi.type === "vehicle" ? "#ef4444" : "#00d4ff";
          ctx.beginPath();
          ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.save();
      ctx.translate(80, 80);
      const rot = isInVehicle ? vehiclePhysics.current.angle : playerPhysics.current.rotY;
      ctx.rotate(-rot);
      ctx.fillStyle = "#00ff88";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }, 100);

    return () => clearInterval(interval);
  }, [isInVehicle, activeGpsHub]);

  const handleInteract = () => {
    if (!activePOI) return;
    playSfx("click");
    if (activePOI.id === "supercar_1") {
      const nextInVehicle = !isInVehicle;
      setIsInVehicle(nextInVehicle);
      isInVehicleRef.current = nextInVehicle;
      playSfx("engine");
    } else if (activePOI.id === "cantine_gaston") {
      setActiveModal("cantine");
    } else if (activePOI.id === "villa_celeste" || activePOI.id === "villa_nova") {
      setActiveModal("villa");
    } else if (activePOI.id === "boutique_ether") {
      setActiveModal("shop");
    } else if (activePOI.id === "atm_desjardins") {
      setActiveModal("bank");
    } else if (activePOI.id === "weapons_dealer_secret") {
      setActiveModal("weapons_dealer");
    }
  };

  const handleBuyWeapon = (wp) => {
    if (persona.cash < wp.cost) {
      setModalFeedback("❌ Vous n'avez pas assez d'argent liquide !");
      setTimeout(() => setModalFeedback(null), 2500);
      return;
    }
    persona.updateEconomy(-wp.cost, 0);
    playSfx("buy");
    persona.addInventoryItem({
      name: wp.name, icon: wp.icon, category: "weapon",
      description: wp.desc, quantity: 1
    });
    if (["pistol", "shotgun", "bat", "hammer", "sword", "pipe"].includes(wp.type)) {
      handleAdminCommand("weapon", [wp.type]);
      setModalFeedback(`⚔️ "${wp.name}" acheté et équipé en main !`);
    } else if (wp.type === "armor") {
      setModalFeedback(`🛡️ Gilet Pare-Balles équipé (+50 Armure) !`);
    } else {
      setModalFeedback(`📦 Munitions ajoutées à vos réserves !`);
    }
    setTimeout(() => setModalFeedback(null), 3000);
  };

  const handleBuyFood = (food) => {
    if (persona.cash < food.cost) {
      setModalFeedback("❌ Espèces insuffisantes !");
      setTimeout(() => setModalFeedback(null), 2000);
      return;
    }
    persona.updateEconomy(-food.cost, 0);
    persona.addInventoryItem({
      name: food.name, icon: food.icon, category: "food",
      hpRestore: food.hp, energyRestore: 20,
      description: food.desc, quantity: 1
    });
    persona.updateVitals(food.hp, 20);
    playSfx("buy");
    setModalFeedback(`✅ ${food.name} ajouté à votre inventaire RP (-${food.cost}$) !`);
    setTimeout(() => setModalFeedback(null), 2500);
  };

  const [nearDoor, setNearDoor] = useState(null);

  const handleAdminCommand = (cmd, args) => {
    const cleanCmd = cmd.toLowerCase();

    if (cleanCmd === "admin" || cleanCmd === "panel" || cleanCmd === "cmd") {
      setIsAdminPanelOpen((prev) => !prev);
      playSfx("click");
      return;
    }
    if (cleanCmd === "builder") {
      setBuilderOpen((prev) => !prev);
      playSfx("click");
      return;
    }

    const fullCmdStr = args.length > 0 ? `/${cleanCmd} ${args.join(" ")}` : `/${cleanCmd}`;
    const result = parseAndExecuteAdminCommand(fullCmdStr, {
      executorName: persona.name || "Admin",
      executorRole: "superadmin",
      playerPhysics,
      persona,
      gmodBuilder: gmodBuilderRef.current,
      weather,
      setWeather: (w) => setWeather(w),
      isFlying,
      setIsFlying,
      nearDoor,
      setNearDoor,
      playSfx,
      addLog: (msg) => {
        setRpMessages((prev) => [...prev, {
          id: `sys-${Date.now()}-${Math.random()}`,
          senderId: "system", senderName: "STAFF SERVER",
          type: "system", text: msg, timestamp: Date.now()
        }]);
      },
      broadcastMessage: (msg) => {
        setRpMessages((prev) => [...prev, {
          id: `broad-${Date.now()}-${Math.random()}`,
          senderId: "system", senderName: "📢 ANNONCE OFFICIELLE",
          type: "system", text: msg, timestamp: Date.now()
        }]);
      }
    });

    if (result.success) {
      if (gmodBuilderRef.current) {
        setPlacedCount(gmodBuilderRef.current.placedProps.length);
      }
    }
  };

  // ─── RENDER (JSX pur, identique à l'original) ─────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#030610] text-slate-100 overflow-hidden select-none relative font-mono">
      {isLoadingScreen && (
        <div className="fixed inset-0 z-50 bg-[#02040a] text-slate-100 flex flex-col justify-between p-4 md:p-6 lg:p-8 font-mono select-none overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/30 via-[#030611] to-[#010206] pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-cyan-400 to-purple-500 shadow-[0_0_20px_rgba(56,189,248,0.9)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:28px_28px] opacity-40 pointer-events-none" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 via-cyan-500/20 to-blue-600/30 border border-amber-400/40 flex items-center justify-center text-amber-300 text-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse">⚜️</div>
              <div>
                <h1 className="text-base md:text-lg font-black tracking-wider text-white uppercase flex items-center gap-2">
                  ETHERWORLD <span className="text-amber-400">ROLEPLAY</span>
                  <span className="text-[10px] bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 px-2 py-0.5 rounded-full font-mono">PORTNEUF v2.8 HD</span>
                </h1>
                <p className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>📍 Cité Portneuf #1</span>
                  <span>•</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    24/64 Joueurs Synchronisés
                  </span>
                  <span>•</span>
                  <span className="text-cyan-300 hidden sm:inline">Route 138 & Fleuve St-Laurent</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-right text-xs hidden sm:flex items-center gap-4">
                <div>
                  <div className="text-slate-400 text-[9px] flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-cyan-400" /> VRAM GPU:
                  </div>
                  <div className="text-cyan-300 font-mono font-bold text-[11px]">{loadedVramMB.toFixed(1)} / {totalVramMB} MB</div>
                </div>
                <div className="border-l border-white/10 pl-3">
                  <div className="text-slate-400 text-[9px]">PING / TICKS:</div>
                  <div className="text-emerald-400 font-mono font-bold text-[11px]">12 ms • 120 Hz</div>
                </div>
              </div>
              <button onClick={() => setIsTerminalOpen(!isTerminalOpen)} className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition cursor-pointer ${isTerminalOpen ? "bg-amber-500/20 border-amber-400 text-amber-300" : "bg-white/5 border-white/15 text-slate-300 hover:bg-white/10"}`} title="Afficher/Masquer le terminal des logs">
                <Terminal className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Logs Moteur</span>
              </button>
              <button onClick={onBack} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-xs text-slate-300 hover:text-white transition cursor-pointer">← Quitter</button>
            </div>
          </div>
      {isLoadingScreen && (
        <div className="fixed inset-0 z-50 bg-[#02040a] text-slate-100 flex flex-col justify-between p-4 md:p-6 lg:p-8 font-mono select-none overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/30 via-[#030611] to-[#010206] pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-cyan-400 to-purple-500 shadow-[0_0_20px_rgba(56,189,248,0.9)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:28px_28px] opacity-40 pointer-events-none" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 via-cyan-500/20 to-blue-600/30 border border-amber-400/40 flex items-center justify-center text-amber-300 text-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse">⚜️</div>
              <div>
                <h1 className="text-base md:text-lg font-black tracking-wider text-white uppercase flex items-center gap-2">
                  ETHERWORLD <span className="text-amber-400">ROLEPLAY</span>
                  <span className="text-[10px] bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 px-2 py-0.5 rounded-full font-mono">PORTNEUF v2.8 HD</span>
                </h1>
                <p className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>📍 Cité Portneuf #1</span>
                  <span>•</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    24/64 Joueurs Synchronisés
                  </span>
                  <span>•</span>
                  <span className="text-cyan-300 hidden sm:inline">Route 138 & Fleuve St-Laurent</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-right text-xs hidden sm:flex items-center gap-4">
                <div>
                  <div className="text-slate-400 text-[9px] flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-cyan-400" /> VRAM GPU:
                  </div>
                  <div className="text-cyan-300 font-mono font-bold text-[11px]">{loadedVramMB.toFixed(1)} / {totalVramMB} MB</div>
                </div>
                <div className="border-l border-white/10 pl-3">
                  <div className="text-slate-400 text-[9px]">PING / TICKS:</div>
                  <div className="text-emerald-400 font-mono font-bold text-[11px]">12 ms • 120 Hz</div>
                </div>
              </div>
              <button onClick={() => setIsTerminalOpen(!isTerminalOpen)} className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition cursor-pointer ${isTerminalOpen ? "bg-amber-500/20 border-amber-400 text-amber-300" : "bg-white/5 border-white/15 text-slate-300 hover:bg-white/10"}`} title="Afficher/Masquer le terminal des logs">
                <Terminal className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Logs Moteur</span>
              </button>
              <button onClick={onBack} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-xs text-slate-300 hover:text-white transition cursor-pointer">← Quitter</button>
            </div>
          </div>

          <div className="relative z-10 w-full max-w-7xl mx-auto my-auto py-3 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between bg-[#080d1e]/90 border border-cyan-500/25 rounded-3xl p-5 md:p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(6,182,212,0.15)] relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${PORTNEUF_GTA_ARTWORKS[activeArtworkIndex].accentColor}`} />
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-black tracking-widest uppercase">{PORTNEUF_GTA_ARTWORKS[activeArtworkIndex].category}</span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span>GTA RP ARTWORK</span>
                    <span className="text-amber-400 font-bold">#{activeArtworkIndex + 1}/4</span>
                  </div>
                </div>
                <div className="bg-black/60 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-amber-500/20 border border-white/15 flex items-center justify-center text-4xl shadow-inner mb-3 transform group-hover:scale-105 transition-transform duration-300">{PORTNEUF_GTA_ARTWORKS[activeArtworkIndex].icon}</div>
                  <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-wider">{PORTNEUF_GTA_ARTWORKS[activeArtworkIndex].title}</h2>
                  <p className="text-xs text-amber-300 font-sans mt-0.5 font-medium">{PORTNEUF_GTA_ARTWORKS[activeArtworkIndex].tagline}</p>
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">{PORTNEUF_GTA_ARTWORKS[activeArtworkIndex].description}</p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between text-[11px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span className="text-slate-400 text-[10px]">RADIO PORTNEUF:</span>
                    <span className="text-amber-300 font-bold">CKOI 96.9 FM (Live Waves)</span>
                  </div>
                  <span className="text-emerald-400 text-[10px] font-bold">● EN DIRECT</span>
                </div>
              </div>
              <div className="pt-4 border-t border-white/10 mt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => setActiveArtworkIndex((prev) => (prev - 1 + PORTNEUF_GTA_ARTWORKS.length) % PORTNEUF_GTA_ARTWORKS.length)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer" title="Artwork précédent">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {PORTNEUF_GTA_ARTWORKS.map((_, i) => (
                      <button key={i} onClick={() => setActiveArtworkIndex(i)} className={`h-1.5 rounded-full transition-all cursor-pointer ${i === activeArtworkIndex ? "w-6 bg-amber-400" : "w-1.5 bg-slate-700 hover:bg-slate-500"}`} />
                    ))}
                  </div>
                  <button onClick={() => setActiveArtworkIndex((prev) => (prev + 1) % PORTNEUF_GTA_ARTWORKS.length)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer" title="Artwork suivant">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[11px] text-amber-200/90 font-sans bg-amber-500/10 border border-amber-400/20 rounded-xl p-2.5 flex items-start gap-2">
                  <span className="text-amber-400 shrink-0">💡</span>
                  <span>{PORTNEUF_GTA_ARTWORKS[activeArtworkIndex].tips}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
              <div className="bg-[#090f26]/90 border border-cyan-500/30 rounded-3xl p-5 md:p-6 backdrop-blur-xl shadow-[0_0_50px_rgba(6,182,212,0.18)] relative overflow-hidden space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-xs font-black tracking-wider text-white uppercase">MATÉRIALISATION DES OBJETS 3D EN TEMPS RÉEL</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 border border-amber-400/40 text-amber-300 px-2.5 py-0.5 rounded-full font-bold">OBJET {currentLoadingObjectIndex + 1} / {PORTNEUF_WORLD_OBJECTS.length}</span>
                </div>

                {PORTNEUF_WORLD_OBJECTS[currentLoadingObjectIndex] && (
                  <div className="bg-black/50 border border-cyan-500/40 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden shadow-inner">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(6,182,212,0.4)] shrink-0 animate-pulse">{PORTNEUF_WORLD_OBJECTS[currentLoadingObjectIndex].icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">{PORTNEUF_WORLD_OBJECTS[currentLoadingObjectIndex].category}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{PORTNEUF_WORLD_OBJECTS[currentLoadingObjectIndex].coords}</span>
                      </div>
                      <h3 className="text-sm md:text-base font-black text-white truncate mt-1">{PORTNEUF_WORLD_OBJECTS[currentLoadingObjectIndex].name}</h3>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span className="text-emerald-400 font-bold">+{PORTNEUF_WORLD_OBJECTS[currentLoadingObjectIndex].count} Entités instanciées</span>
                        <span>•</span>
                        <span className="text-amber-300 font-bold">+{PORTNEUF_WORLD_OBJECTS[currentLoadingObjectIndex].vramMB} MB VRAM</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">OBJETS CHARGÉS</div>
                    <div className="text-base font-black text-amber-400 font-mono">{loadedObjectsCount} <span className="text-xs text-slate-400">/ 338</span></div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">MÉMOIRE GPU</div>
                    <div className="text-base font-black text-cyan-400 font-mono">{loadedVramMB.toFixed(1)} <span className="text-xs text-slate-400">MB</span></div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">COLLIDERS CANNON</div>
                    <div className="text-base font-black text-emerald-400 font-mono">{Math.min(184, Math.floor((loadProgress / 100) * 184))} <span className="text-xs text-slate-400">/ 184</span></div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">DÉBIT CACHE</div>
                    <div className="text-base font-black text-purple-400 font-mono">{downloadSpeed} <span className="text-xs text-slate-400">MB/s</span></div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300 font-bold flex items-center gap-2">
                      <span>SYNCHRONISATION GLOBALE DU MONDE :</span>
                      <span className="text-cyan-400 font-black animate-pulse">{loadProgress.toFixed(0)}%</span>
                    </span>
                    <span className="text-amber-300 font-bold text-[11px]">{loadProgress >= 100 ? "PRÊT POUR L'IMMERSION" : "COMPILATION DU MONDE..."}</span>
                  </div>
                  <div className="w-full h-4 bg-slate-950 border border-white/20 rounded-full p-0.5 relative overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-100 ease-out shadow-[0_0_20px_rgba(56,189,248,0.9)] relative" style={{ width: `${loadProgress}%` }}>
                      <div className="absolute top-0 bottom-0 right-0 w-3 bg-white/90 rounded-full blur-[2px] animate-pulse" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {ETHERWORLD_LOAD_STAGES.map((st, idx) => (
                    <div key={st.stageNum} className={`h-1.5 rounded-full transition-all duration-200 ${idx < loadStageIndex ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : idx === loadStageIndex ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "bg-slate-800"}`} title={st.title} />
                  ))}
                </div>
              </div>

              <div className="bg-[#030611]/95 border border-white/10 rounded-2xl p-3 backdrop-blur-md shadow-inner flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    <span className="font-bold text-slate-300">CONSOLE MOTEUR EN DIRECT (PORTNEUF ENGINE v2.8)</span>
                  </div>
                  <span className="text-emerald-400 font-bold">● VITESSE SYNC : {downloadSpeed} MB/s</span>
                </div>
                <div className="font-mono text-[10px] space-y-1 max-h-24 md:max-h-28 overflow-y-auto pr-1 select-text scrollbar-thin scrollbar-thumb-cyan-500/40">
                  {terminalLogs.slice(-5).map((log, i) => (
                    <div key={i} className={`truncate ${i === terminalLogs.slice(-5).length - 1 ? "text-cyan-300 font-bold animate-pulse" : "text-slate-400"}`}>
                      <span className="text-amber-400/80 mr-1.5">&gt;</span>
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-amber-200/90 font-sans flex items-center justify-between gap-3">
                <span className="font-mono text-[10.5px] leading-relaxed truncate">{ETHERWORLD_RP_TIPS[currentTipIndex]}</span>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">({currentTipIndex + 1}/{ETHERWORLD_RP_TIPS.length})</span>
              </div>
            </div>
          </div>

          {isTerminalOpen && (
            <div className="absolute inset-x-4 top-20 bottom-24 z-40 bg-[#02040c]/98 border-2 border-amber-500/50 rounded-3xl p-6 shadow-[0_0_60px_rgba(245,158,11,0.25)] flex flex-col justify-between backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">CONSOLE D'INSTANCIATION MOTEUR 3D • CITÉ DE PORTNEUF</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">{loadedObjectsCount} / {totalObjectsCount} Entités Matérialisées</span>
                  <button onClick={() => setIsTerminalOpen(false)} className="p-1 text-slate-400 hover:text-white transition cursor-pointer"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 my-4 overflow-y-auto space-y-1.5 font-mono text-xs pr-2 scrollbar-thin scrollbar-thumb-amber-500/50 select-text">
                {terminalLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-slate-300 hover:bg-white/5 p-1 rounded">
                    <span className="text-amber-400 shrink-0">&gt;&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Mémoire GPU Dédiée : {loadedVramMB.toFixed(1)} MB / {totalVramMB} MB</span>
                <button onClick={() => setIsTerminalOpen(false)} className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl font-bold cursor-pointer">Fermer la Console</button>
              </div>
            </div>
          )}

          <div className="relative z-10 border-t border-white/10 pt-3 flex flex-col items-center justify-center gap-1.5 text-center">
            <button onClick={handleEnterGame} className="w-full max-w-2xl mx-auto py-3.5 px-8 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm md:text-base rounded-2xl shadow-[0_0_35px_rgba(245,158,11,0.6)] transition-all transform hover:scale-[1.01] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
              <Zap className="w-5 h-5 text-slate-950 fill-current" />
              <span>{isReadyToEnter ? "🎉 CHARGEMENT DES 338 OBJETS TERMINÉ • ENTRER DANS LA CITÉ DE PORTNEUF" : `ENTRER IMMÉDIATEMENT DANS LA CITÉ (${loadedObjectsCount}/338 • ${loadProgress.toFixed(0)}%) • ENTRÉE`}</span>
            </button>
            <p className="text-[10px] text-slate-400 font-mono">
              Appuyez sur <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">Entrée</kbd> ou <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">Espace</kbd> pour forcer le spawn instantanément sans attendre.
            </p>
          </div>
        </div>
      )}

      {showArrivalBanner && !isLoadingScreen && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-auto animate-bounce font-mono">
          <div className="bg-[#080d1a]/95 border-2 border-cyan-400/80 rounded-2xl p-4 shadow-[0_0_40px_rgba(0,212,255,0.4)] backdrop-blur-xl text-center min-w-[320px] max-w-lg space-y-2 relative">
            <button onClick={() => setShowArrivalBanner(false)} className="absolute top-2 right-2 text-slate-400 hover:text-white transition cursor-pointer p-1"><X className="w-4 h-4" /></button>
            <div className="flex items-center justify-center gap-2 text-xs font-black text-amber-400 tracking-wider uppercase">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>ARRIVÉE REUSSIE EN JEU</span>
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            </div>
            <h2 className="text-base font-black text-white tracking-wide">⚜️ VILLE DE PORTNEUF • QUÉBEC 🇨🇦</h2>
            <p className="text-[11px] text-cyan-200">Secteur Villa Nova • Route 138 • Connecté au Serveur RP #1 (24 Joueurs)</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-white/10 text-[9px]">
              <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">🟢 SHADERS PBR & RENDU 3D : OPTIMAL</span>
              <span className="bg-blue-950/80 border border-blue-500/40 text-blue-300 px-2.5 py-0.5 rounded-full font-bold">📡 LATENCE LIVE : 12 ms</span>
            </div>
          </div>
        </div>
      )}

      <div className="h-12 bg-[#060a18]/95 border-b border-cyan-500/20 px-4 flex items-center justify-between z-40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚜️</span>
            <div>
              <div className="text-xs font-black text-white flex items-center gap-1.5">
                ETHERWORLD 3D <span className="text-[9px] text-cyan-400 font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20">QUÉBEC PORTNEUF</span>
              </div>
              <div className="text-[9px] text-slate-400">Route 138 • Avenue des Alliés • Secteur Villa Nova</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5">
            {[
              { id: "clear", icon: <Sun className="w-3.5 h-3.5 text-amber-400" /> },
              { id: "night", icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> },
              { id: "rain", icon: <CloudRain className="w-3.5 h-3.5 text-cyan-400" /> },
              { id: "snow", icon: <Snowflake className="w-3.5 h-3.5 text-sky-200" /> }
            ].map((w) => (
              <button key={w.id} onClick={() => setWeather(w.id)} className={`p-1.5 rounded transition cursor-pointer ${weather === w.id ? "bg-white/15" : "hover:bg-white/5"}`}>{w.icon}</button>
            ))}
          </div>

          <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5 gap-0.5">
            {[
              { id: "gta5_close", label: "🎮 GTA 5 Épaule", title: "Vue Rapprochée Épaule GTA V (Raccourci: V)" },
              { id: "follow", label: "👁️ Orbit", title: "Vue 3ème Personne Orbitale" },
              { id: "far", label: "🔭 Éloigné", title: "Vue Panoramique Éloignée" },
              { id: "firstperson", label: "🎯 FPS", title: "Vue 1ère Personne" },
              { id: "topdown", label: "🗺️ Ciel", title: "Vue Supérieure Top-Down" }
            ].map((m) => (
              <button key={m.id} onClick={() => { setCameraMode(m.id); playSfx("click"); }} title={m.title} className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer flex items-center gap-1 ${cameraMode === m.id ? "bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 shadow shadow-cyan-500/20" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>{m.label}</button>
            ))}
          </div>

          <button onClick={() => { setIsSettingsOpen(!isSettingsOpen); playSfx("click"); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${isSettingsOpen || isNoclipEnabled ? "bg-amber-500/30 border-amber-400/60 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.4)]" : "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10"}`} title="Menu des Paramètres du Simulateur 3D & Mode Noclip (Raccourci Noclip: N)">
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px]">Paramètres</span>
            {isNoclipEnabled && <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black text-[9px] rounded uppercase animate-pulse">Noclip</span>}
          </button>

          <button onClick={() => { setIsGestureWheelOpen((prev) => !prev); playSfx("click"); }} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${isGestureWheelOpen || activeGesture !== "none" ? "bg-purple-500/30 border-purple-400/60 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.4)]" : "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10"}`} title="Menu des Gestes RP & Emotes (Raccourci: G)">
            <span>🎭</span>
            <span>Gestes RP</span>
            <span className="text-[9px] font-mono opacity-60 bg-black/40 px-1 rounded">G</span>
          </button>

          <button onClick={() => setIsPhoneOpen(!isPhoneOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${isPhoneOpen ? "bg-indigo-500/30 border-indigo-500/60 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.4)]" : "bg-white/5 border-white/10 text-slate-300 hover:text-white"}`} title="Ouvrir le téléphone RP (Raccourci: P)">
            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px]">Téléphone</span>
          </button>

          <button onClick={() => setIsPoliceUIOpen(!isPoliceUIOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${isPoliceUIOpen ? "bg-blue-500/30 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.4)]" : "bg-blue-950/40 border-blue-500/30 text-blue-300 hover:text-white"}`} title="Système de Police / SQ - Amendes & Arrestations">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px]">Police / SQ</span>
          </button>

          <button onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${isAdminPanelOpen ? "bg-purple-500/30 border-purple-500/60 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.4)]" : "bg-purple-950/40 border-purple-500/30 text-purple-300 hover:text-white"}`} title="Panneau Administrateur & Commandes RP (F10 / Shift+A)">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px]">Admin System</span>
          </button>

          <button onClick={() => setEtherForgePreviewOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 font-bold text-xs cursor-pointer transition shadow-[0_0_15px_rgba(0,212,255,0.2)]" title="Prévisualiser les modèles 3D disponibles dans l'EtherForge">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[10px]">🔥 Modèles EtherForge</span>
          </button>

          <button onClick={() => setBuilderOpen(!builderOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${builderOpen ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`}>
            <Building className="w-3.5 h-3.5" />
            <span className="text-[10px]">Mode Build</span>
          </button>

          <button onClick={() => setIsPhysicsPanelOpen(!isPhysicsPanelOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${isPhysicsPanelOpen ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`} title="Ouvrir le menu de physique 3D Cannon.js (Gravité, Lancer d'objets, Impulsion)">
            <span className="text-xs">⚛️</span>
            <span className="text-[10px]">Physique 3D</span>
            {activePhysicsCount > 0 && <span className="ml-0.5 px-1.5 py-0.2 bg-cyan-500/30 text-cyan-300 text-[9px] rounded-full font-mono">{activePhysicsCount}</span>}
          </button>

          <button onClick={() => setIsRoute138ModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer bg-gradient-to-r from-blue-600/40 via-cyan-600/30 to-blue-600/40 border-cyan-500/60 text-cyan-200 hover:text-white hover:border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]" title="Carte régionale immersive de la Route 138 (Saint-Casimir à Québec)">
            <Compass className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-tight">Route 138 ({currentZoneName})</span>
          </button>

          <button onClick={() => setIsCommerceModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border-purple-500/50 text-purple-200 hover:text-white hover:border-purple-300" title="Magasins & Commerces v2.0 (Achat, Vente, Marché des joueurs)">
            <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-mono font-bold tracking-tight">Commerces</span>
          </button>

          <button onClick={() => setIsRealEstateModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer bg-gradient-to-r from-amber-600/30 to-yellow-600/30 border-amber-500/50 text-amber-200 hover:text-white hover:border-amber-300" title="Immobilier v2.0 (Achat de propriétés, Location de baux, Maintenance)">
            <HomeIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-mono font-bold tracking-tight">Immobilier</span>
          </button>

          <button onClick={() => setIsSandboxSaveManagerOpen(!isSandboxSaveManagerOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${isSandboxSaveManagerOpen ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`} title="Gestionnaire de sauvegardes LocalStorage pour le Sandbox 3D">
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px]">Sauvegardes ({sandboxSaves.length})</span>
          </button>

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-[10px] font-mono">
            <span className="text-amber-400 font-bold">🕒 {Math.floor(timeOfDay)}:00</span>
            <input type="range" min="0" max="24" step="0.5" value={timeOfDay} onChange={(e) => setTimeOfDay(parseFloat(e.target.value))} className="w-16 accent-amber-400 cursor-pointer" title="Cycle Jour/Nuit (0h - 24h)" />
          </div>

          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer">
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#04060f]">
        <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

        {saveStatusNotice && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 font-mono text-xs px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
            <span>💾</span>
            <span>{saveStatusNotice}</span>
          </div>
        )}

        {cameraMode === "firstperson" && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#06b6d4] opacity-90" />
              <div className="absolute w-7 h-[1.5px] bg-cyan-400/60" />
              <div className="absolute h-7 w-[1.5px] bg-cyan-400/60" />
            </div>
            {!isPointerLocked && (
              <div className="absolute top-16 bg-black/85 border border-cyan-500/50 px-4 py-2.5 rounded-xl backdrop-blur-md text-center pointer-events-auto shadow-2xl animate-bounce">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 justify-center">
                  <span>🎯</span> Cliquez pour verrouiller le regard souris FPS
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">WASD pour vous déplacer • Échap pour libérer le curseur</div>
              </div>
            )}
          </div>
        )}

        <div className="absolute top-4 left-4 z-20 pointer-events-auto flex flex-col gap-2">
          <div className="bg-[#080d1a]/85 backdrop-blur-md border border-cyan-500/30 p-3 rounded-xl shadow-xl w-64">
            <div className="flex items-center gap-2.5 mb-2 border-b border-white/10 pb-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg shadow-md font-bold text-white">👤</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-white truncate">{persona.name}</div>
                <div className="text-[9px] text-cyan-400 font-mono flex items-center gap-1"><Shield className="w-3 h-3" /> {persona.job}</div>
              </div>
            </div>
            <div className="space-y-1.5 text-[9px] mb-2.5">
              <div>
                <div className="flex justify-between text-slate-400 mb-0.5">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" /> Santé</span>
                  <span className="text-red-400 font-bold">{persona.health}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${persona.health}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-400 mb-0.5">
                  <span className="flex items-center gap-1"><Battery className="w-3 h-3 text-amber-400" /> Énergie</span>
                  <span className="text-amber-400 font-bold">{persona.energy}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${persona.energy}%` }} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-lg text-emerald-400 font-bold flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> {persona.cash.toLocaleString()}$
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 p-1.5 rounded-lg text-blue-300 font-bold flex items-center gap-1">
                <Building className="w-3 h-3" /> {persona.bank.toLocaleString()}$
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setActiveModal("phone")} className="flex-1 bg-[#080d1a]/80 backdrop-blur-md border border-white/10 hover:border-cyan-500/40 p-2 rounded-xl text-xs font-bold text-slate-300 hover:text-cyan-300 transition flex items-center justify-center gap-1.5 shadow-lg cursor-pointer">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Smart Tablet</span>
            </button>
            <button onClick={() => setActiveModal("inventory")} className="bg-[#080d1a]/80 backdrop-blur-md border border-amber-500/30 hover:border-amber-400 p-2 rounded-xl text-xs font-bold text-amber-300 transition flex items-center justify-center gap-1.5 shadow-lg cursor-pointer">
              <Package className="w-4 h-4 text-amber-400" />
              <span>Inventaire ({persona.inventory.length})</span>
            </button>
          </div>
        </div>

        {(builderOpen || selectedBuildItemId) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-1.5 animate-fade-in font-mono">
            <div className="bg-[#080d1a]/95 backdrop-blur-xl border border-cyan-500/40 p-2.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs text-slate-200">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{GMOD_CATALOG.find((i) => i.id === selectedBuildItemId)?.name || "Structure Modulaire"}</span>
              </div>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                <span className="text-[9px] text-slate-400 uppercase font-black px-1.5">Grille:</span>
                {[
                  { label: "Libre", val: 0 },
                  { label: "0.25m", val: 0.25 },
                  { label: "0.5m", val: 0.5 },
                  { label: "1.0m", val: 1.0 },
                  { label: "2.0m", val: 2.0 }
                ].map((s) => (
                  <button key={s.label} onClick={() => { setGridSnapSize(s.val); playSfx("click"); }} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${gridSnapSize === s.val ? "bg-cyan-500 text-black shadow-md font-black" : "text-slate-400 hover:text-white hover:bg-white/10"}`}>{s.label}</button>
                ))}
              </div>
              <button onClick={() => { setObjectSnapEnabled(!objectSnapEnabled); playSfx("click"); }} className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10px] font-bold transition cursor-pointer ${objectSnapEnabled ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`} title="Bascule le magnétisme automatique avec les faces des objets existants">
                <span>⚡</span>
                <span>Magnétisme {objectSnapEnabled ? "ON" : "OFF"}</span>
              </button>
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                <button onClick={() => { setManualRotationY((r) => (r + Math.PI / 4) % (Math.PI * 2)); playSfx("click"); }} className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-cyan-500 hover:text-black text-[10px] font-bold text-slate-200 transition cursor-pointer" title="Pivoter de 45° [Touche R]">↻ Pivoter [R]</button>
              </div>
              <button onClick={() => setIsSpawnMenuOpen(true)} className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-[11px] shadow-lg transition cursor-pointer flex items-center gap-1">
                <span>📦</span>
                <span>Catalogue</span>
              </button>
              <button onClick={() => { if (gmodBuilderRef.current && selectedBuildItemId) { const placed = gmodBuilderRef.current.spawnItemAtGhost(selectedBuildItemId); if (placed) { playSfx("buy"); setPlacedCount(gmodBuilderRef.current.placedProps.length); const item = gmodBuilderRef.current.getItemById(selectedBuildItemId); setModalFeedback(`✅ ${item?.name || 'Structure'} alignée & placée !`); setTimeout(() => setModalFeedback(null), 2000); } } }} className="px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-[11px] py-1 shadow-lg transition cursor-pointer">Placer [Clic]</button>
            </div>
            {snapStatusMsg && (
              <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 font-mono text-[10px] px-3 py-0.5 rounded-full shadow-lg flex items-center gap-2">
                <span>{snapStatusMsg}</span>
              </div>
            )}
          </div>
        )}

        {activePOI && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-bounce">
            <button onClick={handleInteract} className="bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 text-white font-black text-xs px-6 py-3 rounded-xl border border-cyan-400/50 shadow-2xl shadow-cyan-500/30 flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform">
              <span className="text-xl">{activePOI.icon}</span>
              <span>[E] {activePOI.prompt}</span>
            </button>
          </div>
        )}

        <div className="absolute bottom-4 left-4 z-20 pointer-events-none flex flex-col gap-1">
          <div className="w-40 h-40 rounded-2xl bg-black/80 border-2 border-cyan-500/30 overflow-hidden shadow-2xl relative">
            <canvas ref={minimapCanvasRef} width={160} height={160} className="w-full h-full block" />
            <div className="absolute top-1 left-2 text-[8px] text-cyan-400 font-bold">GPS PORTNEUF</div>
          </div>
          <div className="text-[9px] text-slate-400 bg-black/60 px-2 py-0.5 rounded border border-white/5 w-fit">WASD: Déplacer • MAJ: Courir • E: Interagir</div>
        </div>

        <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
          {isInVehicle ? (
            <div className="bg-[#080d1a]/90 backdrop-blur-md border border-red-500/40 p-4 rounded-2xl shadow-2xl text-center min-w-[140px]">
              <div className="text-[9px] text-red-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1"><Car className="w-3.5 h-3.5" /> SUPERCAR</div>
              <div className="text-4xl font-black text-white font-mono my-1">{vehicleSpeed}</div>
              <div className="text-[10px] text-slate-400 font-mono">KM/H</div>
              <div className="text-[9px] text-amber-400 mt-2 font-bold">[E] Sortir du véhicule</div>
            </div>
          ) : (
            <div className="bg-black/60 backdrop-blur-sm border border-white/10 p-3 rounded-xl text-[10px] text-slate-400 space-y-1">
              <div><b className="text-cyan-400">WASD:</b> Se déplacer</div>
              <div><b className="text-amber-400">MAJ:</b> Sprinter</div>
              <div><b className="text-emerald-400">ESPACE:</b> Sauter</div>
              <div><b className="text-purple-400">E:</b> Interagir / Véhicule</div>
            </div>
          )}
        </div>

        {builderOpen && (
          <aside className="absolute top-20 right-4 z-30 w-72 bg-[#080d1a]/95 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-xs font-mono space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-bold text-amber-400 flex items-center gap-1.5"><Building className="w-4 h-4" /> Alignement & Structures</span>
              <button onClick={() => setBuilderOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[10px] text-slate-400">Alignez précisément les structures modulaires avec la grille et les objets voisins.</p>
            <button onClick={() => setIsSpawnMenuOpen(true)} className="w-full py-2 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-[11px] rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 border border-cyan-400/40">
              <span>🗂️ SPANNER & CATALOGUE COMPLET</span>
            </button>
            <button onClick={() => setEtherForgePreviewOpen(true)} className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black text-[10px] rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 border border-amber-400/40">
              <Sparkles className="w-3.5 h-3.5 text-black animate-pulse" />
              <span>🔥 CATALOGUE ETHERFORGE 3D</span>
            </button>
            <div className="space-y-1 pt-1 border-t border-white/10">
              <div className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider mb-1">Structures Modulaires Recommandées:</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "b_wall_01", name: "Mur Modulaire", icon: "🧱" },
                  { id: "b_cube_btp", name: "Bloc BTP", icon: "📦" },
                  { id: "o_fence_01", name: "Clôture Métal", icon: "🚧" },
                  { id: "f_sofa_01", name: "Canapé Nova", icon: "🛋️" },
                  { id: "f_table_01", name: "Table Bois", icon: "🪑" },
                  { id: "o_lamp_01", name: "Lampadaire", icon: "💡" }
                ].map((p) => (
                  <button key={p.id} onClick={() => { setSelectedBuildItemId(p.id); playSfx("click"); }} className={`p-2 rounded-xl border text-left cursor-pointer transition flex items-center gap-2 ${selectedBuildItemId === p.id ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold" : "bg-white/5 border-white/10 hover:border-amber-500/40 text-slate-300"}`}>
                    <span className="text-base">{p.icon}</span>
                    <span className="text-[10px] truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[9px] text-slate-400 pt-2 border-t border-white/10 flex justify-between items-center">
              <span>Objets placés: <b>{placedCount}</b></span>
              <div className="flex gap-2">
                <button onClick={() => { if (gmodBuilderRef.current) { gmodBuilderRef.current.undo(); setPlacedCount(gmodBuilderRef.current.placedProps.length); playSfx("click"); } }} className="text-amber-400 hover:underline font-bold" title="Rétablir le dernier état (Ctrl+Z)">Annuler [Ctrl+Z]</button>
                <button onClick={() => { if (gmodBuilderRef.current) { gmodBuilderRef.current.clearAllProps(); setPlacedCount(0); playSfx("click"); } }} className="text-red-400 hover:underline font-bold">Vider tout</button>
              </div>
            </div>
          </aside>
        )}

        <RPProximityChat
          localPlayerId="local_player"
          localPlayerName={persona.name || "Citoyen"}
          localPlayerPos={[playerPhysics.current.x, playerPhysics.current.y, playerPhysics.current.z]}
          onSendMessage={handleSendRpMessage}
          messages={rpMessages}
          isOpen={isChatOpen}
          onToggleOpen={setIsChatOpen}
          onPayCash={handlePayCash}
          onAdminCommand={handleAdminCommand}
        />

        <RPInteractionRadial
          target={radialMenuTarget}
          onClose={() => setRadialMenuTarget(null)}
          onAction={handleRadialAction}
        />
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-mono animate-fade-in">
          <div className="bg-[#080d1a] border border-cyan-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            {activeModal === "cantine" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                  <span className="text-3xl">🍟</span>
                  <div>
                    <h3 className="text-base font-black text-amber-400">Chez Gaston — Cantine de Portneuf</h3>
                    <p className="text-[10px] text-slate-400">Spécialités Québécoises Réconfortantes</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { name: "Poutine Grande Portneuf", cost: 14, icon: "🍟", hp: 35, desc: "Frites fraîches, fromage en grain couic-couic" },
                    { name: "Blé d'Inde de Neuville", cost: 5, icon: "🌽", hp: 15, desc: "Maïs chaud beurré" },
                    { name: "Bière Rousse du Terroir", cost: 7, icon: "🍺", hp: 10, desc: "Brasserie locale Portneuf" },
                    { name: "Tire d'Érable sur Neige", cost: 4, icon: "🍯", hp: 12, desc: "Sucre d'érable pur 100%" }
                  ].map((food, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5"><span>{food.icon}</span> {food.name}</div>
                        <div className="text-[9px] text-slate-400">{food.desc}</div>
                      </div>
                      <button onClick={() => handleBuyFood(food)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-lg transition cursor-pointer">{food.cost}$</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeModal === "villa" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                  <span className="text-3xl">⚜️</span>
                  <div>
                    <h3 className="text-base font-black text-cyan-400">Domaine de Luxe — Villa Céleste</h3>
                    <p className="text-[10px] text-slate-400">Propriété d'exception avec vue sur le Fleuve Saint-Laurent</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Statut:</span><span className="text-emerald-400 font-bold">À Vendre</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Prix d'Achat:</span><span className="text-amber-400 font-bold">250 000 $</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Superficie:</span><span className="text-white">450 m² (4 chambres, garage double)</span></div>
                </div>
                <button onClick={() => { if (persona.cash >= 250000) { persona.updateEconomy(-250000, 0); persona.addInventoryItem({ name: "Clef Villa Céleste", icon: "🗝️", category: "property", description: "Propriétaire légal Villa Céleste Portneuf", quantity: 1 }); setModalFeedback("🔑 Félicitations ! Vous avez acquis la Villa Céleste !"); } else { setModalFeedback("❌ Vous avez besoin de 250 000$ en espèces."); } setTimeout(() => setModalFeedback(null), 3000); }} className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer hover:from-cyan-500 hover:to-blue-500 transition">Acquérir la propriété (250 000$)</button>
              </div>
            )}

            {activeModal === "bank" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                  <span className="text-3xl">🏧</span>
                  <div>
                    <h3 className="text-base font-black text-emerald-400">Guichet Caisse Desjardins</h3>
                    <p className="text-[10px] text-slate-400">Service Bancaire Automatisé Portneuf</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <div className="text-[9px] text-slate-400 uppercase">Espèces</div>
                    <div className="text-lg font-bold text-emerald-400">{persona.cash.toLocaleString()}$</div>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <div className="text-[9px] text-slate-400 uppercase">Solde Banque</div>
                    <div className="text-lg font-bold text-blue-300">{persona.bank.toLocaleString()}$</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { if (persona.cash >= 1000) { persona.updateEconomy(-1000, 1000); playSfx("buy"); } }} className="flex-1 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-500 transition cursor-pointer">Déposer 1000$</button>
                  <button onClick={() => { if (persona.bank >= 1000) { persona.updateEconomy(1000, -1000); playSfx("buy"); } }} className="flex-1 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 transition cursor-pointer">Retirer 1000$</button>
                </div>
              </div>
            )}

            {activeModal === "weapons_dealer" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-red-500/20 pb-3">
                  <span className="text-3xl p-2 bg-red-950/80 rounded-xl border border-red-500/40 text-red-400">⚔️</span>
                  <div>
                    <h3 className="text-base font-black text-red-500 flex items-center gap-2">
                      <span>L'Armurier Clandestin</span>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-500/30">MARCHÉ NOIR PORTNEUF</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 italic">"Bienvenue. Garde ça sous le manteau, la SQ patrouille dans le secteur..."</p>
                  </div>
                </div>
                {modalFeedback && (
                  <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-xs text-red-200 text-center font-bold animate-pulse">{modalFeedback}</div>
                )}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {[
                    { name: "Pistolet Semi-Auto 9mm", type: "pistol", cost: 850, icon: "🔫", dmg: 35, desc: "Série SQ fiable avec chargeur 15 coups." },
                    { name: "Fusil à Pompe Remington", type: "shotgun", cost: 1450, icon: "💥", dmg: 75, desc: "Puissance brute pour la défense et la chasse." },
                    { name: "Batte de Combat Aluminium", type: "bat", cost: 250, icon: "🏏", dmg: 25, desc: "Batte renforcée pour frappes lourdes." },
                    { name: "Marteau de Scierie Lourd", type: "hammer", cost: 180, icon: "🔨", dmg: 45, desc: "Outil industriel lourd détourné." },
                    { name: "Sabre Éthéré de Collection", type: "sword", cost: 2200, icon: "🗡️", dmg: 55, desc: "Lame forée en acier précieux." },
                    { name: "Gilet Pare-Balles Tactique", type: "armor", cost: 600, icon: "🛡️", dmg: 0, desc: "Protection balistique renforcée (+50 Armure)." },
                    { name: "Caisse de Cartouches 9mm (x50)", type: "ammo", cost: 120, icon: "📦", dmg: 0, desc: "Ravitaillement en munitions." }
                  ].map((wp, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-red-500/20 hover:border-red-500/50 transition">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{wp.icon}</span> {wp.name}
                          {wp.dmg > 0 && <span className="text-[9px] px-1.5 py-0.2 bg-red-950 text-red-400 font-bold rounded">Dmg: {wp.dmg}</span>}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{wp.desc}</div>
                      </div>
                      <button onClick={() => handleBuyWeapon(wp)} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-lg transition cursor-pointer shrink-0 ml-2 shadow-lg shadow-red-900/40">{wp.cost}$</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(activeModal === "inventory" || activeModal === "phone") && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{activeModal === "phone" ? "📱" : "🎒"}</span>
                    <div>
                      <h3 className="text-base font-black text-cyan-400">{activeModal === "phone" ? "TroxT Smart Tablet OS" : "Inventaire RP du Personnage"}</h3>
                      <p className="text-[10px] text-slate-400">{activeModal === "phone" ? "Applications Citoyennes & Sac" : "Objet(s) en possession du joueur"}</p>
                    </div>
                  </div>
                </div>
                {activeModal === "phone" && (
                  <div className="grid grid-cols-3 gap-2 text-center pb-2">
                    {[
                      { name: "Inventaire", icon: "🎒", action: () => setActiveModal("inventory") },
                      { name: "Banque", icon: "🏦", action: () => setActiveModal("bank") },
                      { name: "Cantine", icon: "🍟", action: () => setActiveModal("cantine") }
                    ].map((app, i) => (
                      <button key={i} onClick={app.action} className="p-2.5 bg-white/5 border border-white/10 hover:border-cyan-500/40 rounded-xl text-center cursor-pointer transition">
                        <div className="text-xl mb-0.5">{app.icon}</div>
                        <div className="text-[10px] text-slate-300 font-bold">{app.name}</div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between">
                    <span>Objets du Sac ({persona.inventory.length})</span>
                    <span>Quantité</span>
                  </div>
                  {persona.inventory.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">Votre inventaire est vide.</div>
                  ) : (
                    persona.inventory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1">{item.name}</div>
                            <div className="text-[9px] text-slate-400">{item.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-cyan-400">x{item.quantity}</span>
                          {item.category === "food" && (
                            <button onClick={() => { const used = persona.useInventoryItem(item.id); if (used) { playSfx("buy"); setModalFeedback(`😋 Vous avez consommé ${item.name} (+Santé/Énergie) !`); setTimeout(() => setModalFeedback(null), 2000); } }} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition cursor-pointer">Consommer</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {modalFeedback && (
              <div className="mt-3 p-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs text-center rounded-lg animate-fade-in">{modalFeedback}</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Le reste : Physics Panel, Save Manager, JSON Modal, GMod Menu, Admin, Phone, Police, etc. ═══ */}

      <GModMenu
        isOpen={isSpawnMenuOpen}
        onClose={() => setIsSpawnMenuOpen(false)}
        onSelectItem={(itemId) => { setSelectedBuildItemId(itemId); setIsSpawnMenuOpen(false); if (itemId) setBuilderOpen(true); }}
        selectedItemId={selectedBuildItemId}
        gridSnapSize={gridSnapSize}
        onSetGridSnapSize={setGridSnapSize}
        onClearAllProps={() => { if (gmodBuilderRef.current) { gmodBuilderRef.current.clearAllProps(); setPlacedCount(0); } }}
      />

      <EtherForgePreviewModal
        isOpen={etherForgePreviewOpen}
        onClose={() => setEtherForgePreviewOpen(false)}
        onPlaceInSandbox={handlePlaceEtherForgeModel}
        playerPos={playerPhysics.current}
      />

      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        colyseusRoom={colyseusRoomRef.current}
        manager={null}
        onAdminCommand={handleAdminCommand}
        playerState={{
          health: persona.health, cash: persona.cash,
          activeStreet: "Rue Portneuf", isSprinting: false,
          isBuilding: builderOpen, selectedItemId: selectedBuildItemId,
          gridSnapSize: gridSnapSize, activeMount: null, activeCombatMove: null,
          combatLogs: [], weedSeeds: 10, weedBuds: 5, gangBeastsMode: false,
          jointStiffness: "stiff", unlockedFurnitureIds: [], currentWeapon: "none"
        }}
      />

      <PhoneApp
        isOpen={isPhoneOpen}
        onClose={() => setIsPhoneOpen(false)}
        playerName={persona.name}
        cashAmount={persona.cash}
        bankAmount={persona.bank}
        onPayCash={handlePayCash}
        onSetWaypoint={(x, z) => console.log("Waypoint:", x, z)}
        onSendAdminAlert={(msg) => handleSendRpMessage({ senderId: persona.name, senderName: persona.name, type: "ooc", text: `[STAFF ALERT] ${msg}`, position: [playerPhysics.current.x, playerPhysics.current.y, playerPhysics.current.z] })}
        onAdminCommand={handleAdminCommand}
      />

      <PoliceLawEnforcementUI
        isOpen={isPoliceUIOpen}
        onClose={() => setIsPoliceUIOpen(false)}
        playerName={persona.name}
        playerRole={persona.job.toLowerCase().includes("police") || persona.job.toLowerCase().includes("sq") ? "sq" : "admin"}
        playerCash={persona.cash}
        playerBank={persona.bank}
        onJobChange={(newJob) => persona.setJob(newJob)}
        onDeductCash={(amt) => persona.updateEconomy(-amt, 0)}
        onTeleportToJail={() => { playerPhysics.current.x = -18; playerPhysics.current.y = 0.5; playerPhysics.current.z = -25; }}
        onTeleportFromJail={() => { playerPhysics.current.x = 0; playerPhysics.current.y = 0.5; playerPhysics.current.z = 0; }}
      />

      <RPInteractionRadial
        target={radialTarget}
        onClose={() => setRadialTarget(null)}
        onAction={handleRadialAction}
      />

      {wildlifeAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-bounce">
          <div className="bg-amber-950/90 border border-amber-500/80 backdrop-blur-md text-amber-100 px-5 py-2.5 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.6)] flex items-center gap-3">
            <span className="text-2xl">🐾</span>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-300">Faune Québécoise Détectée</div>
              <div className="text-xs font-bold text-white">{wildlifeAlert}</div>
            </div>
          </div>
        </div>
      )}

      {playerWantedHud.stars > 0 && (
        <div className="absolute top-20 right-6 z-40 pointer-events-auto flex flex-col items-end gap-2">
          <div className="bg-slate-950/90 border border-red-500/70 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-[0_0_35px_rgba(239,68,68,0.4)] flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400">AVIS DE RECHERCHE SQ</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((starIndex) => (
                  <span key={starIndex} className={`text-lg transition-all transform ${starIndex <= playerWantedHud.stars ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] scale-110 animate-pulse" : "text-slate-700 opacity-40"}`}>★</span>
                ))}
              </div>
            </div>
            {playerWantedHud.inPursuit ? (
              <div className="flex items-center gap-2 bg-red-950/80 border border-red-500/50 px-2.5 py-1 rounded-xl text-[10px] text-white font-black animate-pulse">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping mr-1" />
                POURSUITE CODE-3 (Patrouille à {playerWantedHud.nearestPoliceDist}m)
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-500/50 px-2.5 py-1 rounded-xl text-[10px] text-amber-200 font-bold">
                <span>💨 Évasion en cours :</span>
                <span className="font-mono text-white font-black text-xs">{playerWantedHud.evasionTimer}s</span>
              </div>
            )}
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-gradient-to-r from-amber-500 to-red-600 transition-all duration-300" style={{ width: `${Math.min(100, (playerWantedHud.heat / 350) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {activeGesture !== "none" && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-pulse">
          <div className="bg-purple-950/90 border border-purple-400/80 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-[0_0_25px_rgba(168,85,247,0.5)] flex items-center gap-3">
            <span className="text-xl">{RP_GESTURES.find((g) => g.id === activeGesture)?.icon || "🎭"}</span>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-purple-200">Geste RP: {RP_GESTURES.find((g) => g.id === activeGesture)?.label || activeGesture}</div>
              <div className="text-[10px] text-purple-300/80 font-mono">Appuyez sur <span className="text-white font-bold">Z/Q/S/D</span> ou <span className="text-white font-bold">Échap</span> pour annuler</div>
            </div>
            <button onClick={() => setActiveGesture("none")} className="pointer-events-auto ml-2 bg-purple-800/80 hover:bg-purple-700 text-white p-1 rounded-full text-xs font-bold transition cursor-pointer" title="Arrêter le geste">✕</button>
          </div>
        </div>
      )}

      {isGestureWheelOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b0f1f]/95 border border-purple-500/40 rounded-3xl max-w-xl w-full p-6 shadow-[0_0_50px_rgba(168,85,247,0.3)] space-y-6 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-600/30 border border-purple-400/40 flex items-center justify-center text-xl shadow-inner">🎭</div>
                <div>
                  <h3 className="text-base font-black text-white tracking-wide uppercase flex items-center gap-2">
                    ROUE DE GESTES RP <span className="text-xs text-purple-400 font-mono">ETHERWORLD GTA 5</span>
                  </h3>
                  <p className="text-xs text-slate-400">Interactions gestuelles & animations de personnage en direct</p>
                </div>
              </div>
              <button onClick={() => setIsGestureWheelOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-3 relative z-10 max-h-[380px] overflow-y-auto pr-1">
              {RP_GESTURES.map((g) => {
                const isActive = activeGesture === g.id;
                return (
                  <button key={g.id} onClick={() => { setActiveGesture(g.id); setIsGestureWheelOpen(false); playSfx("click"); }} className={`p-3.5 rounded-2xl border text-left transition duration-200 cursor-pointer flex flex-col justify-between space-y-2 relative group ${isActive ? "bg-purple-600/40 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-[1.02]" : "bg-white/5 border-white/10 hover:border-purple-400/50 hover:bg-purple-950/30"}`}>
                    <div className="flex items-start justify-between">
                      <span className="text-2xl group-hover:scale-110 transition duration-200">{g.icon}</span>
                      {g.keyHint && <span className="text-[9px] font-mono font-black bg-purple-500/30 border border-purple-400/50 text-purple-200 px-1.5 py-0.5 rounded">Touche {g.keyHint}</span>}
                    </div>
                    <div>
                      <div className="text-xs font-black text-white group-hover:text-purple-200 transition">{g.label}</div>
                      <div className="text-[10px] text-slate-400 line-clamp-1">{g.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-purple-500/20 relative z-10">
              {activeGesture !== "none" ? (
                <button onClick={() => { setActiveGesture("none"); setIsGestureWheelOpen(false); }} className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 text-red-200 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5">
                  <span>⏹️</span>
                  <span>Arrêter l'animation actuelle</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500 italic">Aucun geste RP actif</span>
              )}
              <div className="text-[10px] text-slate-400 font-mono">
                Raccourci rapide: <span className="text-cyan-400 font-bold">G</span> (Roue) • <span className="text-cyan-400 font-bold">X</span> (Mains en l'air)
              </div>
            </div>
          </div>
        </div>
      )}

      {isNoclipEnabled && (
        <div className="absolute top-16 left-4 z-30 pointer-events-none">
          <div className="bg-amber-950/90 border border-amber-400/80 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.5)] flex items-center gap-3">
            <span className="text-xl animate-bounce">🚀</span>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-200 flex items-center gap-2">
                <span>MODE NOCLIP ACTIF</span>
                <span className="bg-amber-400 text-slate-950 font-mono text-[9px] px-1.5 py-0.2 rounded font-bold">{noclipSpeed}m/s</span>
              </div>
              <div className="text-[10px] text-amber-300/80 font-mono">Espace/E = Monter • C/Ctrl = Descendre • Maj = Turbo • N = Quitter</div>
            </div>
            <button onClick={() => setIsNoclipEnabled(false)} className="pointer-events-auto ml-2 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/50 text-amber-200 px-2 py-1 rounded-xl text-[10px] font-bold transition cursor-pointer" title="Désactiver le noclip">Désactiver</button>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-mono animate-in fade-in duration-200">
          <div className="bg-[#0b0f1f]/95 border border-amber-500/40 rounded-3xl max-w-xl w-full p-6 shadow-[0_0_50px_rgba(245,158,11,0.25)] space-y-6 relative overflow-hidden text-slate-100">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-600/30 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold text-xl shadow-inner">⚙️</div>
                <div>
                  <h3 className="font-black text-base text-white tracking-wide uppercase flex items-center gap-2">
                    PARAMÈTRES DU SIMULATEUR <span className="text-xs text-amber-400 font-mono">3D</span>
                  </h3>
                  <p className="text-xs text-slate-400">Mode Vol Libre Noclip, Rendu, Caméra & Options Physiques</p>
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer">✕</button>
            </div>
            <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1 relative z-10">
              <div className={`p-4 rounded-2xl border transition duration-300 ${isNoclipEnabled ? "bg-gradient-to-r from-amber-950/60 to-orange-950/60 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.3)]" : "bg-white/5 border-white/10"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <div className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        Mode Noclip (Vol Libre 3D)
                        {isNoclipEnabled && <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">ACTIF</span>}
                      </div>
                      <div className="text-xs text-slate-400">Déplacement volant à 360° sans collision à travers les bâtiments et décors.</div>
                    </div>
                  </div>
                  <button onClick={() => { setIsNoclipEnabled(!isNoclipEnabled); playSfx("click"); }} className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 cursor-pointer flex items-center ${isNoclipEnabled ? "bg-amber-500 justify-end" : "bg-slate-800 justify-start"}`}>
                    <div className="w-6 h-6 rounded-full bg-white shadow-md transform transition-transform" />
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-bold">Vitesse de Vol Libre:</span>
                    <span className="text-amber-400 font-mono font-bold">{noclipSpeed} m/s ({Math.round(noclipSpeed * 3.6)} km/h)</span>
                  </div>
                  <input type="range" min="5" max="60" step="1" value={noclipSpeed} onChange={(e) => setNoclipSpeed(parseInt(e.target.value))} className="w-full accent-amber-400 cursor-pointer" />
                  <div className="flex gap-1.5 pt-1">
                    {[
                      { label: "Lent (8m/s)", speed: 8 },
                      { label: "Normal (18m/s)", speed: 18 },
                      { label: "Rapide (35m/s)", speed: 35 },
                      { label: "Éclair (50m/s)", speed: 50 }
                    ].map((p) => (
                      <button key={p.speed} onClick={() => setNoclipSpeed(p.speed)} className={`flex-1 py-1 rounded-lg border text-[10px] font-bold transition cursor-pointer ${noclipSpeed === p.speed ? "bg-amber-500/30 border-amber-400 text-amber-200" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 p-3 bg-black/50 border border-amber-500/20 rounded-xl text-[10px] text-amber-200/90 space-y-1">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <span>🎮 Commandes en Mode Noclip:</span>
                    <span className="text-[9px] font-mono text-slate-400 ml-auto">(Raccourci clavier: <strong className="text-amber-300">N</strong>)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-300 pt-1">
                    <div>• <span className="font-bold text-white">Z/Q/S/D</span>: Vol horizontal 360°</div>
                    <div>• <span className="font-bold text-white">Espace / E</span>: Monter (Altitude +)</div>
                    <div>• <span className="font-bold text-white">C / Ctrl</span>: Descendre (Altitude -)</div>
                    <div>• <span className="font-bold text-white">Maj (Shift)</span>: Turbo Vitesse x2.5</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2"><span>🌤️ Environnement & Rendu Météo</span></div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Météo Actuelle:</label>
                    <select value={weather} onChange={(e) => setWeather(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl p-2 text-xs text-white outline-none focus:border-amber-400">
                      <option value="clear">☀️ Soleil & Ciel Dégagé</option>
                      <option value="night">🌙 Nuit Étoilée Cyberpunk</option>
                      <option value="rain">🌧️ Pluie & Orage</option>
                      <option value="snow">❄️ Neige Portneuf</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Mode Caméra:</label>
                    <select value={cameraMode} onChange={(e) => setCameraMode(e.target.value)} className="w-full bg-black/60 border border-white/20 rounded-xl p-2 text-xs text-white outline-none focus:border-amber-400">
                      <option value="gta5_close">🎮 GTA 5 Épaule</option>
                      <option value="follow">👁️ 3ème Personne Orbit</option>
                      <option value="far">🔭 Éloigné Panoramique</option>
                      <option value="firstperson">🎯 1ère Personne FPS</option>
                      <option value="topdown">🗺️ Vue Ciel Top-Down</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span>Cycle Heure de la Journée:</span>
                    <span className="font-bold text-amber-400 font-mono">{Math.floor(timeOfDay)}:00</span>
                  </div>
                  <input type="range" min="0" max="24" step="0.5" value={timeOfDay} onChange={(e) => setTimeOfDay(parseFloat(e.target.value))} className="w-full accent-amber-400 cursor-pointer" />
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2"><span>📍 Téléportation Rapide</span></div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button onClick={() => { playerPhysics.current.x = 0; playerPhysics.current.y = 1.0; playerPhysics.current.z = 0; setIsSettingsOpen(false); playSfx("click"); }} className="p-2.5 bg-black/40 hover:bg-white/10 border border-white/10 rounded-xl text-left transition cursor-pointer">
                    <div className="font-bold text-white">🏙️ Centre-Ville Portneuf</div>
                    <div className="text-[10px] text-slate-400">Position (0, 1, 0)</div>
                  </button>
                  <button onClick={() => { playerPhysics.current.x = -15; playerPhysics.current.y = 1.0; playerPhysics.current.z = 30; setIsSettingsOpen(false); playSfx("click"); }} className="p-2.5 bg-black/40 hover:bg-white/10 border border-white/10 rounded-xl text-left transition cursor-pointer">
                    <div className="font-bold text-white">🏡 Secteur Villa Nova</div>
                    <div className="text-[10px] text-slate-400">Position (-15, 1, 30)</div>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl space-y-2">
                <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2"><span>🔄 Synchronisation & Données du Jeu</span></div>
                <p className="text-[11px] text-slate-400">Relancer la séquence progressive de téléchargement et de synchronisation des paquets du serveur EtherWorld.</p>
                <button onClick={() => { setIsSettingsOpen(false); setIsLoadingScreen(true); playSfx("click"); }} className="w-full py-2.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/40 hover:to-blue-500/40 border border-cyan-400/50 text-cyan-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <span>🚀</span>
                  <span>Relancer le Loading & Téléchargement des Données</span>
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/10 relative z-10">
              <span className="text-[10px] text-slate-500 font-mono">EtherWorld 3D Engine • Version 2.8</span>
              <button onClick={() => setIsSettingsOpen(false)} className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs rounded-xl shadow transition cursor-pointer">Fermer</button>
            </div>
          </div>
        </div>
      )}

      <Route138MapModal
        isOpen={isRoute138ModalOpen}
        onClose={() => setIsRoute138ModalOpen(false)}
        playerX={isInVehicle ? vehiclePhysics.current.x : playerPhysics.current.x}
        playerZ={isInVehicle ? vehiclePhysics.current.z : playerPhysics.current.z}
        onTravel={(hub) => { travelToHub(hub); setIsRoute138ModalOpen(false); }}
        onSetGps={(hub) => { setActiveGpsHub(hub); }}
        currentGpsId={activeGpsHub?.id}
      />

      <CommerceShopModal
        isOpen={isCommerceModalOpen}
        onClose={() => setIsCommerceModalOpen(false)}
        playerCash={persona.cash}
        onUpdateCash={(newCash) => persona.updateEconomy(newCash - persona.cash, 0)}
      />

      <RealEstateModal
        isOpen={isRealEstateModalOpen}
        onClose={() => setIsRealEstateModalOpen(false)}
        playerCash={persona.cash}
        onUpdateCash={(newCash) => persona.updateEconomy(newCash - persona.cash, 0)}
        onSetGpsPosition={(pos, label) => {
          setActiveGpsHub({
            id: 'real_estate_gps', name: label, subtitle: 'Propriété / Bail',
            pos: new THREE.Vector3(pos.x, pos.y, pos.z),
            color: '#f59e0b', icon: '🏡', description: label
          });
        }}
      />

      {!isPhoneOpen && !builderOpen && !isGestureWheelOpen && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full flex items-center gap-3 text-[10px] text-slate-300 font-mono shadow-2xl">
            <div className="flex items-center gap-1 text-cyan-400 font-bold">
              <span>🎮</span>
              <span>GTA 5 RP Controls:</span>
            </div>
            <div className="flex items-center gap-2">
              <span><kbd className="bg-white/10 px-1 rounded text-white font-bold">Z/Q/S/D</kbd> Bouger</span>
              <span>•</span>
              <span><kbd className="bg-amber-500/30 text-amber-200 px-1 rounded font-bold">N</kbd> Noclip ({isNoclipEnabled ? "ON" : "OFF"})</span>
              <span>•</span>
              <span><kbd className="bg-white/10 px-1 rounded text-white font-bold">Maj</kbd> Courir/Turbo</span>
              <span>•</span>
              <span><kbd className="bg-white/10 px-1 rounded text-white font-bold">V</kbd> Vue ({cameraMode === "gta5_close" ? "Épaule" : cameraMode})</span>
              <span>•</span>
              <span><kbd className="bg-purple-500/30 text-purple-200 px-1 rounded font-bold">X</kbd> Se Rendre</span>
              <span>•</span>
              <span><kbd className="bg-purple-500/30 text-purple-200 px-1 rounded font-bold">G</kbd> Gestes RP</span>
              <span>•</span>
              <span><kbd className="bg-white/10 px-1 rounded text-white font-bold">E</kbd> Interagir</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
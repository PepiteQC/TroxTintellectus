/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SRC/STORE.JS  v2.0 PLATINUM EDITION
 * Store d'état global client (Zustand) — TroxtWorld
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : src/store.js
 *
 * npm install zustand immer
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ═══════════════════════════════════════════════════════════════════
// ÉTAT INITIAL
// ═══════════════════════════════════════════════════════════════════
const initial = {
  sig:     SIG,
  version: '2.0.0',

  // ── TEMPS MONDE ──
  timeOfDay:  12,
  dayCount:   1,
  season:     'summer',
  weather:    'sunny',
  moonPhase:  0,
  timeScale:  1,
  timePaused: false,
  timeFrozen: false,
  activeEvent:    null,
  upcomingEvents: [],
  isNight:  false,
  isDay:    true,
  sunAngle: 0,

  // ── JOUEUR LOCAL ──
  player: {
    id:          null,
    username:    null,
    displayName: null,
    level:       1,
    xp:          0,
    xpNext:      100,
    cash:        2500,
    bank:        0,
    job:         null,
    jobRank:     null,
    faction:     null,
    org:         null,
    orgRank:     null,
    wanted:      0,
    pos:         { x: 0, y: 0, z: 0 },
    rot:         { x: 0, y: 0, z: 0 },
    vel:         { x: 0, y: 0, z: 0 },
    needs:       { health: 100, hunger: 100, thirst: 100, energy: 100, stress: 0 },
    armor:       0,
    stamina:     100,
    skills: {
      driving: 0, shooting: 0, strength: 0, stealth: 0,
      hacking: 0, medicine: 0, charisma: 0, crafting: 0,
    },
    reputation: {
      police: 0, civilians: 0, underworld: 0,
    },
    stats: {
      kills: 0, deaths: 0, assists: 0, distanceKm: 0, playtimeSec: 0,
      jobsDone: 0, moneyEarned: 0, moneySpent: 0, arrests: 0,
      timesArrested: 0, vehiclesStolen: 0, missionsDone: 0, racesWon: 0,
    },
    kills:  0,
    deaths: 0,
  },

  // ── ZONE ──
  zone: {
    name:       'campagne',
    display:    '',
    speedLimit: 70,
    safe:       false,
    faction:    null,
    interior:   false,
    building:   null,
  },

  // ── RÉSEAU ──
  connected:     false,
  connecting:    false,
  pingMs:        0,
  packetLoss:    0,
  playersOnline: 0,
  serverInfo: {
    name: null, map: null, gamemode: null, maxPlayers: 128, rules: [],
  },
  party:   { id: null, leader: null, members: [] },
  friends: { online: [], offline: [], requests: [] },
  voice: {
    enabled: false, channel: null, muted: false, deafened: false,
    speaking: {}, volume: { master: 0.8, voice: 1.0, game: 0.8 },
  },
  blocked:    [],
  muted:      [],
  trustScore: 100,

  // ── INVENTAIRE ──
  inventory: {
    items:          [],
    weight:         0,
    maxWeight:      50,
    hotbar:         [null, null, null, null, null, null, null, null, null],
    selectedSlot:   0,
    favorites:      [],
    search:         '',
    filterCategory: null,
    sortBy:         'name',
    sortDir:        'asc',
  },

  // ── VÉHICULE ──
  vehicle: {
    current: null, fuel: 100, engineHealth: 100, bodyHealth: 100,
    locked: false, engineOn: false, lightsOn: false, radio: null,
    speed: 0, gear: 'P', owned: [], entering: false, exiting: false,
  },

  // ── QUÊTES ──
  quests: {
    active: [], completed: [], failed: [],
    tracked: null, available: [], cooldowns: {},
  },

  // ── MONDE ──
  world: {
    discoveredPOI: [], businesses: [], properties: [], waypoints: [],
    activeEvents: [], trafficDensity: 0.5, pedestrianDensity: 0.5, policeDensity: 0.3,
  },

  // ── HUD ──
  hud: {
    prompt: null, notice: null,
    chatOpen: false, mapOpen: false, inventoryOpen: false,
    notifications: [],
    crosshair: 'default', hitMarker: null, damageFlash: null,
    killfeed: [], speedometer: true, minimap: true,
    healthBar: true, armorBar: true,
    menuOpen: false, settingsOpen: false, phoneOpen: false,
    radioOpen: false, weaponWheelOpen: false, emoteWheelOpen: false,
    characterCreatorOpen: false,
    loading: false, loadingText: '', loadingProgress: 0,
  },

  // ── PHONE ──
  phone: {
    open: false, currentApp: null,
    apps: ['messages', 'calls', 'bleeter', 'snapmatic', 'bank', 'stocks', 'map', 'settings'],
    messages: [], calls: [], contacts: [],
    bleeter:   { feed: [], trending: [], followers: 0, following: 0 },
    snapmatic: { posts: [], followers: 0, likes: 0 },
    stocks:    { holdings: {}, watchlist: [], market: {} },
    battery: 100, signal: 4, wallpaper: 'default',
  },

  // ── RADIO ──
  radio: {
    open: false, enabled: false, station: null, stations: [],
    volume: 0.5, nowPlaying: null, history: [],
  },

  // ── STUDIO ──
  studio: {
    photoMode: false, freeCam: false, cinematic: false,
    filters: ['none', 'noir', 'vintage', 'cyberpunk', 'vhs', 'sepia'],
    activeFilter: 'none', fov: 50, depthOfField: false, tiltShift: false,
    recording: false, recordTime: 0, photosTaken: [],
  },

  // ── RÉGLAGES ──
  settings: {
    quality: 'high', shadows: true, fov: 75, vsync: true,
    resolution: 'auto', dlss: false, rayTracing: false, motionBlur: false,
    bloom: true, ssao: false, antialiasing: 'msaa',
    volume: 0.7, masterVolume: 1.0, musicVolume: 0.5, sfxVolume: 0.8, voiceVolume: 1.0,
    sensitivity: 1.0, invertY: false, vibration: true, autoAim: true,
    aimAssist: 'normal', crouchToggle: false, sprintToggle: false,
    showFps: false, showPing: false, minimapZoom: 1.0, hudScale: 1.0,
    crosshair: 'default',
    subtitles: true, subtitleSize: 'medium', colorblind: 'off',
    highContrast: false, reduceMotion: false, textToSpeech: false, speechToText: false,
    language: 'fr', region: 'qc-ca', units: 'metric', currency: 'CAD',
    difficulty: 'normal', autoSave: true, autoSaveInterval: 300,
    showDamageNumbers: true, goreLevel: 'normal',
    keybinds: {
      forward:   ['KeyW', 'ArrowUp'],
      backward:  ['KeyS', 'ArrowDown'],
      left:      ['KeyA', 'ArrowLeft'],
      right:     ['KeyD', 'ArrowRight'],
      jump:      ['Space'],
      sprint:    ['ShiftLeft'],
      crouch:    ['ControlLeft'],
      interact:  ['KeyE'],
      vehicle:   ['KeyF'],
      work:      ['KeyG'],
      reload:    ['KeyR'],
      emote:     ['KeyB'],
      phone:     ['KeyT'],
      inventory: ['KeyI'],
      map:       ['KeyM'],
      radio:     ['KeyU'],
      weapon1:   ['Digit1'],
      weapon2:   ['Digit2'],
      weapon3:   ['Digit3'],
      weapon4:   ['Digit4'],
    },
  },

  // ── PERFORMANCE ──
  perf: {
    fps: 60, frameMs: 16.6, drawCalls: 0, triangles: 0,
    memory: { used: 0, total: 0 }, gpuTemp: null, cpuLoad: null,
    autoQuality: true, lagDetected: false, lowFpsSince: null,
  },

  // ── SÉCURITÉ ──
  security: {
    reports: [], blockList: [], ignoreList: [],
    reportedBy: 0, flagged: false, lastViolation: null,
  },

  // ── DEV TOOLS ──
  dev: {
    debugMode: false, showHitboxes: false, showNavMesh: false,
    showTriggers: false, showStats: false,
    netSim: { enabled: false, lag: 0, loss: 0, jitter: 0 },
    logs: [], selectedEntity: null,
    godMode: false, noclip: false, freeCam: false,
    flySpeed: 10, speedMultiplier: 1,
  },

  // ── EVENT BUS ──
  _listeners: {},
};

// ═══════════════════════════════════════════════════════════════════
// STORE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export const useGameState = create(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initial,

          // ── EVENT BUS ──
          on(event, fn) {
            set((s) => {
              if (!s._listeners[event]) s._listeners[event] = [];
              s._listeners[event].push(fn);
            });
            return () => get().off(event, fn);
          },
          off(event, fn) {
            set((s) => {
              if (s._listeners[event]) {
                s._listeners[event] = s._listeners[event].filter((f) => f !== fn);
              }
            });
          },
          emit(event, payload) {
            const list = get()._listeners[event] || [];
            list.forEach((fn) => {
              try { fn(payload); } catch (e) { console.warn(e); }
            });
          },

          // ── TEMPS ──
          setTimeOfDay: (h) => set((s) => {
            const t = ((h % 24) + 24) % 24;
            s.timeOfDay = t;
            s.isNight   = t >= 19.5 || t <= 5.5;
            s.isDay     = !s.isNight;
            s.sunAngle  = ((t - 6) / 12) * 180;
          }),
          advanceTime: (dtHours) => {
            const st = get();
            if (st.timePaused || st.timeFrozen) return;
            st.setTimeOfDay(st.timeOfDay + dtHours * st.timeScale);
          },
          setDay:       (n)  => set((s) => { s.dayCount   = n;  }),
          setSeason:    (v)  => set((s) => { s.season     = v;  }),
          setWeather:   (w)  => set((s) => { s.weather    = w;  }),
          setMoonPhase: (p)  => set((s) => { s.moonPhase  = clamp(p, 0, 7); }),
          setTimeScale: (v)  => set((s) => { s.timeScale  = clamp(v, 0, 10); }),
          pauseTime:    ()   => set((s) => { s.timePaused = true; }),
          resumeTime:   ()   => set((s) => { s.timePaused = false; }),
          togglePause:  ()   => set((s) => { s.timePaused = !s.timePaused; }),
          freezeTime:   (v)  => set((s) => { s.timeFrozen = !!v; }),
          startWorldEvent: (event) => set((s) => { s.activeEvent = event; }),
          endWorldEvent:   ()      => set((s) => { s.activeEvent = null; }),

          // ── JOUEUR ──
          setPlayer:    (patch)     => set((s) => { Object.assign(s.player, patch); }),
          setPlayerPos: (x, y, z)   => set((s) => { s.player.pos.x = x; s.player.pos.y = y; s.player.pos.z = z; }),
          setPlayerRot: (x, y, z)   => set((s) => { s.player.rot.x = x; s.player.rot.y = y; s.player.rot.z = z; }),
          setNeeds:     (needs)     => set((s) => { Object.assign(s.player.needs, needs); }),
          setCash:      (cash)      => set((s) => { s.player.cash = cash; }),
          setBank:      (bank)      => set((s) => { s.player.bank = bank; }),
          setWanted:    (wanted)    => set((s) => { s.player.wanted = clamp(wanted, 0, 5); }),
          setJob:       (job)       => set((s) => { s.player.job = job; }),
          setFaction:   (faction)   => set((s) => { s.player.faction = faction; }),
          setOrg:       (org, rank = null) => set((s) => { s.player.org = org; s.player.orgRank = rank; }),
          addXp: (amount) => set((s) => {
            s.player.xp += amount;
            while (s.player.xp >= s.player.xpNext) {
              s.player.xp     -= s.player.xpNext;
              s.player.level  += 1;
              s.player.xpNext  = Math.floor(s.player.xpNext * 1.15);
            }
          }),
          addSkill: (skill, amount) => set((s) => {
            if (s.player.skills[skill] !== undefined) {
              s.player.skills[skill] = clamp(s.player.skills[skill] + amount, 0, 100);
            }
          }),
          addReputation: (type, amount) => set((s) => {
            if (s.player.reputation[type] !== undefined) {
              s.player.reputation[type] = clamp(s.player.reputation[type] + amount, -100, 100);
            }
          }),
          setArmor:   (v) => set((s) => { s.player.armor   = clamp(v, 0, 100); }),
          setStamina: (v) => set((s) => { s.player.stamina = clamp(v, 0, 100); }),
          addStat: (stat, amount = 1) => set((s) => {
            if (s.player.stats[stat] !== undefined) s.player.stats[stat] += amount;
            if (stat === 'kills')  s.player.kills  = s.player.stats.kills;
            if (stat === 'deaths') s.player.deaths = s.player.stats.deaths;
          }),
          setStats: (patch) => set((s) => { Object.assign(s.player.stats, patch); }),

          // ── ZONE ──
          setZone: (zone) => set((s) => { Object.assign(s.zone, zone); }),

          // ── RÉSEAU ──
          setConnected:     (connected) => set((s) => { s.connected = connected; s.connecting = false; }),
          setConnecting:    (v)         => set((s) => { s.connecting = v; }),
          setPing:          (pingMs)    => set((s) => { s.pingMs = pingMs; }),
          setPacketLoss:    (v)         => set((s) => { s.packetLoss = clamp(v, 0, 100); }),
          setPlayersOnline: (n)         => set((s) => { s.playersOnline = n; }),
          setServerInfo:    (info)      => set((s) => { Object.assign(s.serverInfo, info); }),

          setParty:    (party)   => set((s) => { Object.assign(s.party, party); }),
          createParty: (leader)  => set((s) => { s.party = { id: uid('party'), leader, members: [leader] }; }),
          joinParty:   (partyId, member) => set((s) => {
            s.party.id = partyId;
            if (!s.party.members.includes(member)) s.party.members.push(member);
          }),
          leaveParty:  () => set((s) => { s.party = { id: null, leader: null, members: [] }; }),

          setFriends:       (list) => set((s) => { Object.assign(s.friends, list); }),
          addFriendRequest: (req)  => set((s) => { s.friends.requests.push(req); }),
          acceptFriend:     (id)   => set((s) => {
            s.friends.requests = s.friends.requests.filter((r) => r.id !== id);
            s.friends.online.push(id);
          }),

          setVoiceChannel: (channel) => set((s) => { s.voice.channel = channel; }),
          toggleMute:      ()        => set((s) => { s.voice.muted = !s.voice.muted; }),
          toggleDeafen:    ()        => set((s) => { s.voice.deafened = !s.voice.deafened; }),
          setSpeaking:     (playerId, v) => set((s) => { s.voice.speaking[playerId] = v; }),
          setVoiceVolume:  (patch)   => set((s) => { Object.assign(s.voice.volume, patch); }),

          setTrustScore: (v) => set((s) => { s.trustScore = clamp(v, 0, 100); }),

          // ── INVENTAIRE ──
          invAdd: (item) => set((s) => {
            const existing = s.inventory.items.find((i) => i.id === item.id && !i.unique);
            if (existing && !item.unique) {
              existing.qty += (item.qty ?? 1);
            } else {
              s.inventory.items.push({
                uid:      uid('item'),
                id:       item.id,
                name:     item.name ?? item.id,
                icon:     item.icon ?? '📦',
                qty:      item.qty ?? 1,
                weight:   item.weight ?? 1,
                category: item.category ?? 'misc',
                rarity:   item.rarity ?? 'common',
                equipped: false,
                unique:   !!item.unique,
                metadata: item.metadata ?? null,
              });
            }
            s.inventory.weight = s.inventory.items.reduce((sum, i) => sum + i.weight * i.qty, 0);
          }),
          invRemove: (itemId, qty = 1) => set((s) => {
            const idx = s.inventory.items.findIndex((i) => i.id === itemId || i.uid === itemId);
            if (idx < 0) return;
            s.inventory.items[idx].qty -= qty;
            if (s.inventory.items[idx].qty <= 0) s.inventory.items.splice(idx, 1);
            s.inventory.weight = s.inventory.items.reduce((sum, i) => sum + i.weight * i.qty, 0);
          }),
          invUse: (itemId) => {
            get().emit('inventory:use', { itemId });
          },
          invClear: () => set((s) => {
            s.inventory.items  = [];
            s.inventory.weight = 0;
          }),
          invSetHotbar:      (slot, itemId) => set((s) => { s.inventory.hotbar[clamp(slot, 0, 8)] = itemId; }),
          invSelectSlot:     (slot)         => set((s) => { s.inventory.selectedSlot = clamp(slot, 0, 8); }),
          invToggleFavorite: (itemId)       => set((s) => {
            const idx = s.inventory.favorites.indexOf(itemId);
            if (idx >= 0) s.inventory.favorites.splice(idx, 1);
            else s.inventory.favorites.push(itemId);
          }),
          invSetSearch: (q)   => set((s) => { s.inventory.search = q; }),
          invSetFilter: (cat) => set((s) => { s.inventory.filterCategory = cat; }),
          invSetSort:   (by, dir) => set((s) => { s.inventory.sortBy = by; s.inventory.sortDir = dir; }),

          // ── VÉHICULE ──
          enterVehicle: (veh) => {
            set((s) => {
              s.vehicle.current      = veh;
              s.vehicle.entering     = true;
              s.vehicle.exiting      = false;
              s.vehicle.fuel         = veh.fuel ?? 100;
              s.vehicle.engineHealth = veh.engineHealth ?? 100;
              s.vehicle.bodyHealth   = veh.bodyHealth ?? 100;
            });
            setTimeout(() => set((st) => { st.vehicle.entering = false; }), 800);
          },
          exitVehicle: () => {
            set((s) => { s.vehicle.exiting = true; });
            setTimeout(() => set((st) => {
              st.vehicle.current  = null;
              st.vehicle.exiting  = false;
              st.vehicle.engineOn = false;
            }), 800);
          },
          updateVehicle:      (patch) => set((s) => { Object.assign(s.vehicle, patch); }),
          toggleEngine:       ()      => set((s) => { s.vehicle.engineOn = !s.vehicle.engineOn; }),
          toggleLights:       ()      => set((s) => { s.vehicle.lightsOn = !s.vehicle.lightsOn; }),
          toggleLock:         ()      => set((s) => { s.vehicle.locked   = !s.vehicle.locked; }),
          setFuel:            (v)     => set((s) => { s.vehicle.fuel     = clamp(v, 0, 100); }),
          addOwnedVehicle:    (v)     => set((s) => { s.vehicle.owned.push(v); }),
          removeOwnedVehicle: (id)    => set((s) => {
            s.vehicle.owned = s.vehicle.owned.filter((v) => v.id !== id);
          }),

          // ── QUÊTES ──
          questStart: (quest) => set((s) => {
            s.quests.active.push({ ...quest, tracked: false, startedAt: Date.now() });
          }),
          questComplete: (id) => set((s) => {
            const idx = s.quests.active.findIndex((q) => q.id === id);
            if (idx < 0) return;
            const [q] = s.quests.active.splice(idx, 1);
            s.quests.completed.push({ ...q, completedAt: Date.now() });
            if (s.quests.tracked === id) s.quests.tracked = null;
          }),
          questFail: (id) => set((s) => {
            const idx = s.quests.active.findIndex((q) => q.id === id);
            if (idx < 0) return;
            const [q] = s.quests.active.splice(idx, 1);
            s.quests.failed.push({ ...q, failedAt: Date.now() });
          }),
          questTrack: (id) => set((s) => {
            s.quests.tracked = (s.quests.tracked === id) ? null : id;
          }),
          questUpdateObjective: (questId, objIdx, done) => set((s) => {
            const q = s.quests.active.find((x) => x.id === questId);
            if (q?.objectives?.[objIdx]) q.objectives[objIdx].done = done;
          }),
          questSetAvailable: (list) => set((s) => { s.quests.available = list; }),

          // ── MONDE ──
          poiDiscover: (poi) => set((s) => {
            if (!s.world.discoveredPOI.find((p) => p.id === poi.id)) {
              s.world.discoveredPOI.push({ ...poi, discoveredAt: Date.now() });
            }
          }),
          setBusinesses: (list) => set((s) => { s.world.businesses = list; }),
          setProperties: (list) => set((s) => { s.world.properties = list; }),
          addWaypoint: (wp) => set((s) => {
            s.world.waypoints.push({ id: uid('wp'), createdAt: Date.now(), ...wp });
          }),
          removeWaypoint: (id) => set((s) => {
            s.world.waypoints = s.world.waypoints.filter((w) => w.id !== id);
          }),
          clearWaypoints: () => set((s) => { s.world.waypoints = []; }),
          startWorldEventInstance: (ev) => set((s) => {
            s.world.activeEvents.push({ id: uid('ev'), startedAt: Date.now(), ...ev });
          }),
          endWorldEventInstance: (id) => set((s) => {
            s.world.activeEvents = s.world.activeEvents.filter((e) => e.id !== id);
          }),
          setTrafficDensity: (v) => set((s) => { s.world.trafficDensity = clamp(v, 0, 1); }),

          // ── HUD ──
          setPrompt: (prompt) => set((s) => { s.hud.prompt = prompt; }),
          setNotice: (notice) => {
            set((s) => { s.hud.notice = notice; });
            if (notice) setTimeout(() => set((s) => { s.hud.notice = null; }), 3500);
          },
          toggleChat:             () => set((s) => { s.hud.chatOpen             = !s.hud.chatOpen; }),
          toggleMap:              () => set((s) => { s.hud.mapOpen              = !s.hud.mapOpen; }),
          toggleInventory:        () => set((s) => { s.hud.inventoryOpen        = !s.hud.inventoryOpen; }),
          toggleMenu:             () => set((s) => { s.hud.menuOpen             = !s.hud.menuOpen; }),
          toggleSettings:         () => set((s) => { s.hud.settingsOpen         = !s.hud.settingsOpen; }),
          toggleWeaponWheel:      () => set((s) => { s.hud.weaponWheelOpen      = !s.hud.weaponWheelOpen; }),
          toggleEmoteWheel:       () => set((s) => { s.hud.emoteWheelOpen       = !s.hud.emoteWheelOpen; }),
          toggleCharacterCreator: () => set((s) => { s.hud.characterCreatorOpen = !s.hud.characterCreatorOpen; }),

          pushNotification: (n) => set((s) => {
            const id = n.id ?? uid('notif');
            s.hud.notifications.push({
              id,
              type:     n.type ?? 'info',
              title:    n.title ?? '',
              message:  n.message ?? '',
              icon:     n.icon ?? null,
              ts:       Date.now(),
              ttl:      n.ttl ?? 4000,
              priority: n.priority ?? 'normal',
            });
            if (s.hud.notifications.length > 20) s.hud.notifications.shift();
          }),
          dismissNotification: (id) => set((s) => {
            s.hud.notifications = s.hud.notifications.filter((n) => n.id !== id);
          }),
          clearNotifications: () => set((s) => { s.hud.notifications = []; }),

          showHitMarker:   (type = 'hit') => set((s) => { s.hud.hitMarker = { ts: Date.now(), type }; }),
          showDamageFlash: (amount, direction = null) => set((s) => {
            s.hud.damageFlash = { ts: Date.now(), amount, direction };
          }),
          addKillfeed: (entry) => set((s) => {
            s.hud.killfeed.unshift({ ...entry, ts: Date.now() });
            if (s.hud.killfeed.length > 8) s.hud.killfeed.pop();
          }),
          clearKillfeed: () => set((s) => { s.hud.killfeed = []; }),
          setCrosshair:  (type) => set((s) => { s.hud.crosshair = type; }),

          setLoading: (v, text = '', progress = 0) => set((s) => {
            s.hud.loading         = v;
            s.hud.loadingText     = text;
            s.hud.loadingProgress = progress;
          }),

          // ── PHONE ──
          togglePhone: () => set((s) => {
            s.phone.open = !s.phone.open;
            s.phone.currentApp = s.phone.open ? 'home' : null;
          }),
          openPhoneApp:    (app) => set((s) => { s.phone.currentApp = app; }),
          closePhoneApp:   ()    => set((s) => { s.phone.currentApp = 'home'; }),
          addPhoneMessage: (msg) => set((s) => { s.phone.messages.push({ id: uid('msg'), ts: Date.now(), ...msg }); }),
          addPhoneCall:    (call)=> set((s) => { s.phone.calls.push({ id: uid('call'), ts: Date.now(), ...call }); }),
          setContacts:     (list)=> set((s) => { s.phone.contacts = list; }),
          setPhoneBattery: (v)   => set((s) => { s.phone.battery = clamp(v, 0, 100); }),
          setPhoneSignal:  (v)   => set((s) => { s.phone.signal  = clamp(v, 0, 4); }),

          bleeterAddPost: (post) => set((s) => {
            s.phone.bleeter.feed.unshift({ id: uid('tweet'), ts: Date.now(), ...post });
          }),
          bleeterLike: (postId) => set((s) => {
            const p = s.phone.bleeter.feed.find((x) => x.id === postId);
            if (p) p.likes = (p.likes ?? 0) + 1;
          }),
          bleeterSetFeed: (list) => set((s) => { s.phone.bleeter.feed = list; }),

          snapmaticAddPost: (post) => set((s) => {
            s.phone.snapmatic.posts.unshift({ id: uid('snap'), ts: Date.now(), ...post });
          }),

          stocksSetMarket: (m) => set((s) => { s.phone.stocks.market = m; }),
          stocksBuy: (ticker, shares, price) => set((s) => {
            const h = s.phone.stocks.holdings[ticker] ?? { shares: 0, avgPrice: 0 };
            const totalCost   = h.avgPrice * h.shares + price * shares;
            const totalShares = h.shares + shares;
            h.shares   = totalShares;
            h.avgPrice = totalCost / totalShares;
            s.phone.stocks.holdings[ticker] = h;
          }),
          stocksSell: (ticker, shares) => set((s) => {
            const h = s.phone.stocks.holdings[ticker];
            if (!h) return;
            h.shares -= shares;
            if (h.shares <= 0) delete s.phone.stocks.holdings[ticker];
          }),

          // ── RADIO ──
          toggleRadio:      () => set((s) => { s.radio.enabled = !s.radio.enabled; }),
          openRadio:        () => set((s) => { s.radio.open = true; }),
          closeRadio:       () => set((s) => { s.radio.open = false; }),
          setRadioStation:  (station) => set((s) => { s.radio.station = station; }),
          setRadioVolume:   (v)       => set((s) => { s.radio.volume = clamp(v, 0, 1); }),
          setRadioStations: (list)    => set((s) => { s.radio.stations = list; }),
          setNowPlaying: (song) => set((s) => {
            if (s.radio.nowPlaying) s.radio.history.unshift(s.radio.nowPlaying);
            s.radio.nowPlaying = song;
            if (s.radio.history.length > 20) s.radio.history.pop();
          }),

          // ── STUDIO ──
          togglePhotoMode: () => set((s) => { s.studio.photoMode = !s.studio.photoMode; }),
          toggleFreeCam:   () => set((s) => { s.studio.freeCam   = !s.studio.freeCam; }),
          toggleCinematic: () => set((s) => { s.studio.cinematic = !s.studio.cinematic; }),
          setFilter:       (f) => set((s) => { s.studio.activeFilter = f; }),
          setStudioFov:    (v) => set((s) => { s.studio.fov = clamp(v, 10, 120); }),
          toggleRecording: () => set((s) => {
            s.studio.recording  = !s.studio.recording;
            s.studio.recordTime = 0;
          }),
          addPhoto: (photo) => set((s) => {
            s.studio.photosTaken.unshift({ id: uid('photo'), ts: Date.now(), ...photo });
          }),

          // ── RÉGLAGES ──
          setSettings:   (patch)         => set((s) => { Object.assign(s.settings, patch); }),
          setKeybind:    (action, keys)  => set((s) => { s.settings.keybinds[action] = keys; }),
          resetKeybinds: ()              => set((s) => { s.settings.keybinds = initial.settings.keybinds; }),

          // ── PERFORMANCE ──
          updatePerf:     (patch) => set((s) => { Object.assign(s.perf, patch); }),
          setAutoQuality: (v)     => set((s) => { s.perf.autoQuality = v; }),

          // ── SÉCURITÉ ──
          reportPlayer: (targetId, reason) => set((s) => {
            s.security.reports.push({
              id: uid('report'), targetId, reason,
              ts: Date.now(), status: 'pending',
            });
          }),
          blockPlayer:  (id) => set((s) => {
            if (!s.security.blockList.includes(id)) s.security.blockList.push(id);
          }),
          unblockPlayer:(id) => set((s) => {
            s.security.blockList = s.security.blockList.filter((x) => x !== id);
          }),
          ignorePlayer: (id) => set((s) => {
            if (!s.security.ignoreList.includes(id)) s.security.ignoreList.push(id);
          }),

          // ── DEV TOOLS ──
          toggleDebug:      () => set((s) => { s.dev.debugMode    = !s.dev.debugMode; }),
          toggleHitboxes:   () => set((s) => { s.dev.showHitboxes = !s.dev.showHitboxes; }),
          toggleNavMesh:    () => set((s) => { s.dev.showNavMesh  = !s.dev.showNavMesh; }),
          toggleTriggers:   () => set((s) => { s.dev.showTriggers = !s.dev.showTriggers; }),
          toggleGodMode:    () => set((s) => { s.dev.godMode      = !s.dev.godMode; }),
          toggleNoclip:     () => set((s) => { s.dev.noclip       = !s.dev.noclip; }),
          toggleFreeCamDev: () => set((s) => { s.dev.freeCam      = !s.dev.freeCam; }),
          setNetSim:        (patch) => set((s) => { Object.assign(s.dev.netSim, patch); }),
          selectEntity:     (e)     => set((s) => { s.dev.selectedEntity = e; }),
          pushLog: (msg, level = 'info') => set((s) => {
            s.dev.logs.push({ id: uid('log'), msg, level, ts: Date.now() });
            if (s.dev.logs.length > 200) s.dev.logs.shift();
          }),
          clearLogs: () => set((s) => { s.dev.logs = []; }),

          // ── PONT TROXT⬡ ──
          applyTroxtEvent: (type, data) => {
            const st = get();
            switch (type) {
              case 'troxtworld:world_pulse':
              case 'WORLD_STATE': {
                if (data.time) {
                  const h = typeof data.time === 'string'
                    ? parseInt(data.time.slice(0, 2), 10) + parseInt(data.time.slice(3, 5), 10) / 60
                    : data.time;
                  st.setTimeOfDay(h);
                }
                if (data.day)     st.setDay(data.day);
                if (data.weather) st.setWeather(typeof data.weather === 'string' ? data.weather : data.weather.id);
                if (data.season)  st.setSeason(data.season);
                break;
              }
              case 'troxtworld:weather_changed': st.setWeather(data.new || data.weather); break;
              case 'troxtworld:new_day':         st.setDay(data.day); break;

              case 'troxtworld:cash_updated':
                if (data.cash !== undefined) st.setCash(data.cash);
                if (data.bank !== undefined) st.setBank(data.bank);
                break;
              case 'troxtworld:needs_updated':
                if (data.needs) st.setNeeds(data.needs);
                break;
              case 'troxtworld:xp_gained':
                if (data.amount) st.addXp(data.amount);
                break;
              case 'troxtworld:skill_up':
                if (data.skill && data.amount) st.addSkill(data.skill, data.amount);
                break;

              case 'troxtworld:wanted_add':
              case 'troxtworld:wanted_decay':
                if (data.stars !== undefined) st.setWanted(data.stars);
                break;

              case 'troxtworld:zone_entered':
                st.setZone({
                  name:       data.zone,
                  display:    data.display,
                  speedLimit: data.speed_limit,
                  safe:       data.safe,
                  faction:    data.faction,
                  interior:   data.interior ?? false,
                  building:   data.building ?? null,
                });
                st.pushNotification({
                  type: 'info', icon: '📍',
                  message: data.display || data.zone, ttl: 2500,
                });
                break;
              case 'troxtworld:poi_discovered':
                st.poiDiscover({ id: data.id, name: data.name, x: data.x, y: data.y, z: data.z });
                st.pushNotification({ type: 'success', icon: '🔍', message: `Découvert : ${data.name}` });
                break;

              case 'troxtworld:item_added':
                if (data.item) st.invAdd(data.item);
                break;
              case 'troxtworld:item_removed':
                if (data.itemId) st.invRemove(data.itemId, data.qty ?? 1);
                break;

              case 'troxtworld:vehicle_entered':
                if (data.vehicle) st.enterVehicle(data.vehicle);
                break;
              case 'troxtworld:vehicle_exited':
                st.exitVehicle();
                break;
              case 'troxtworld:vehicle_update':
                st.updateVehicle(data);
                break;

              case 'troxtworld:quest_started':
                if (data.quest) st.questStart(data.quest);
                break;
              case 'troxtworld:quest_completed':
                if (data.id) st.questComplete(data.id);
                break;
              case 'troxtworld:quest_objective':
                st.questUpdateObjective(data.questId, data.index, data.done);
                break;

              case 'troxtworld:hit_marker':
                st.showHitMarker(data.type || 'hit');
                break;
              case 'troxtworld:damage':
                st.showDamageFlash(data.amount ?? 0, data.direction);
                break;
              case 'troxtworld:kill':
                st.addKillfeed({
                  killer:   data.killer,
                  victim:   data.victim,
                  weapon:   data.weapon,
                  headshot: !!data.headshot,
                });
                break;

              case 'troxtworld:player_joined':
                st.pushNotification({ type: 'info', icon: '👋', message: `${data.name} a rejoint` });
                break;
              case 'troxtworld:player_left':
                st.pushNotification({ type: 'info', icon: '👋', message: `${data.name} est parti` });
                break;
              case 'troxtworld:ping':
                st.setPing(data.ms ?? 0);
                break;

              case 'troxtworld:sms_received':
                st.addPhoneMessage({ from: data.from, to: data.to, body: data.body, read: false });
                st.pushNotification({ type: 'info', icon: '💬', message: `SMS de ${data.from}` });
                break;
              case 'troxtworld:call_incoming':
                st.addPhoneCall({ from: data.from, type: 'incoming', duration: 0 });
                st.pushNotification({ type: 'info', icon: '📞', message: `Appel de ${data.from}` });
                break;

              case 'troxtworld:radio_playing':
                st.setNowPlaying({ title: data.title, artist: data.artist, artwork: data.artwork });
                break;

              case 'troxtworld:event_started':
                st.startWorldEventInstance({ id: data.id, name: data.name, endsAt: data.endsAt });
                st.pushNotification({ type: 'warn', icon: '⚡', message: `Événement : ${data.name}` });
                break;
              case 'troxtworld:event_ended':
                st.endWorldEventInstance(data.id);
                break;

              case 'troxtworld:flagged':
                st.setTrustScore(data.trustScore ?? 50);
                st.pushNotification({ type: 'error', icon: '⚠️', message: 'Comportement suspect détecté' });
                break;

              case 'troxtworld:loading_start':
                st.setLoading(true, data.text || 'Chargement…', 0);
                break;
              case 'troxtworld:loading_progress':
                st.setLoading(true, data.text, data.progress);
                break;
              case 'troxtworld:loading_end':
                st.setLoading(false);
                break;
            }
          },

          // ── RESET ──
          reset: () => set((s) => {
            const listeners = s._listeners;
            Object.assign(s, initial);
            s._listeners = listeners;
          }),
          resetPlayer: () => set((s) => {
            const listeners = s._listeners;
            s.player    = initial.player;
            s.inventory = initial.inventory;
            s.vehicle   = initial.vehicle;
            s.quests    = initial.quests;
            s.phone     = initial.phone;
            s._listeners = listeners;
          }),
        }))
      ),
      {
        name:    'troxt-game-state',
        version: 2,
        partialize: (state) => ({
          settings: state.settings,
          language: state.settings.language,
          dev:      { debugMode: state.dev.debugMode },
        }),
        migrate: (persisted, version) => {
          if (version < 2) {
            persisted.settings = { ...initial.settings, ...(persisted.settings || {}) };
          }
          return persisted;
        },
      }
    ),
    { name: 'troxt-game-state', enabled: process.env.NODE_ENV === 'development' }
  )
);

// ═══════════════════════════════════════════════════════════════════
// SÉLECTEURS PRÊTS À L'EMPLOI
// ═══════════════════════════════════════════════════════════════════

// Temps / monde
export const selectTimeOfDay   = (s) => s.timeOfDay;
export const selectIsNight     = (s) => s.isNight;
export const selectIsDay       = (s) => s.isDay;
export const selectWeather     = (s) => s.weather;
export const selectSeason      = (s) => s.season;
export const selectMoonPhase   = (s) => s.moonPhase;
export const selectDayCount    = (s) => s.dayCount;
export const selectTimePaused  = (s) => s.timePaused;
export const selectActiveEvent = (s) => s.activeEvent;

// Joueur
export const selectPlayer       = (s) => s.player;
export const selectPlayerPos    = (s) => s.player.pos;
export const selectPlayerNeeds  = (s) => s.player.needs;
export const selectPlayerStats  = (s) => s.player.stats;
export const selectPlayerSkills = (s) => s.player.skills;
export const selectCash         = (s) => s.player.cash;
export const selectBank         = (s) => s.player.bank;
export const selectWanted       = (s) => s.player.wanted;
export const selectJob          = (s) => s.player.job;
export const selectHealth       = (s) => s.player.needs.health;
export const selectStamina      = (s) => s.player.stamina;
export const selectArmor        = (s) => s.player.armor;
export const selectXP           = (s) => ({ xp: s.player.xp, next: s.player.xpNext, level: s.player.level });

// Zone
export const selectZone       = (s) => s.zone;
export const selectZoneName   = (s) => s.zone.name;
export const selectIsSafeZone = (s) => s.zone.safe;

// Réseau
export const selectConnected     = (s) => s.connected;
export const selectPing          = (s) => s.pingMs;
export const selectPlayersOnline = (s) => s.playersOnline;
export const selectParty         = (s) => s.party;
export const selectFriends       = (s) => s.friends;
export const selectVoice         = (s) => s.voice;

// HUD
export const selectHud           = (s) => s.hud;
export const selectPrompt        = (s) => s.hud.prompt;
export const selectNotice        = (s) => s.hud.notice;
export const selectNotifications = (s) => s.hud.notifications;
export const selectKillfeed      = (s) => s.hud.killfeed;
export const selectHitMarker     = (s) => s.hud.hitMarker;
export const selectLoading       = (s) => ({
  loading:  s.hud.loading,
  text:     s.hud.loadingText,
  progress: s.hud.loadingProgress,
});

// Inventaire
export const selectInventory       = (s) => s.inventory;
export const selectInventoryItems  = (s) => s.inventory.items;
export const selectInventoryWeight = (s) => ({ current: s.inventory.weight, max: s.inventory.maxWeight });
export const selectHotbar          = (s) => s.inventory.hotbar;
export const selectSelectedSlot    = (s) => s.inventory.selectedSlot;

// Véhicule
export const selectVehicle        = (s) => s.vehicle;
export const selectCurrentVehicle = (s) => s.vehicle.current;
export const selectVehicleFuel    = (s) => s.vehicle.fuel;
export const selectVehicleSpeed   = (s) => s.vehicle.speed;

// Quêtes
export const selectQuests       = (s) => s.quests;
export const selectActiveQuests = (s) => s.quests.active;
export const selectTrackedQuest = (s) =>
  s.quests.active.find((q) => q.id === s.quests.tracked) || null;

// Monde
export const selectWorld         = (s) => s.world;
export const selectDiscoveredPOI = (s) => s.world.discoveredPOI;
export const selectWaypoints     = (s) => s.world.waypoints;

// Phone
export const selectPhone         = (s) => s.phone;
export const selectPhoneMessages = (s) => s.phone.messages;
export const selectPhoneOpen     = (s) => s.phone.open;

// Radio
export const selectRadio      = (s) => s.radio;
export const selectNowPlaying = (s) => s.radio.nowPlaying;

// Studio
export const selectStudio = (s) => s.studio;

// Réglages
export const selectSettings  = (s) => s.settings;
export const selectLanguage  = (s) => s.settings.language;
export const selectKeybinds  = (s) => s.settings.keybinds;
export const selectQuality   = (s) => s.settings.quality;

// Performance
export const selectPerf = (s) => s.perf;
export const selectFps  = (s) => s.perf.fps;

// Sécurité
export const selectSecurity   = (s) => s.security;
export const selectTrustScore = (s) => s.trustScore;

// Dev
export const selectDev       = (s) => s.dev;
export const selectDebugMode = (s) => s.dev.debugMode;

// Raccourci shallow
export const selectPlayerCashShallow = (s) => s.player.cash;

/** Hook shallow générique */
export function useShallow(selector) {
  return useGameState((s) => selector(s));
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════
export { SIG, uid, clamp, initial as INITIAL_STATE };
export default useGameState;
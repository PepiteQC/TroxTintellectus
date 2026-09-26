/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/WEATHER/QUEBECFM.JS (v3.0 Platinum Edition)
 * Synthétiseur Acoustique Procédural, CB Radio & Ondes Police
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡ · 📻QuebecFM
 * Chemin    : client/src/world/weather/QuebecFM.js
 */

import { netEmit } from '../../settings/net.js';

// ─── STATIONS FM COMPACTS ───────────────────────────────────────────────────
export const QUEBEC_FM_STATIONS = [
  {
    id: "ckoi", name: "CKOI 96,9", freq: "96,9", category: "fm", genre: "Pop québécois & Hits",
    slogan: "Le son de Montréal et de la Rive-Nord", color: "#06b6d4", djName: "Martin & l'équipe du matin",
    tracks: [
      { title: "Sous les étoiles de Portneuf", artist: "Marie-Laure", duration: 48, bpm: 124, genre: "pop", keyNotes: [261.63, 329.63, 392.00, 523.25], bassline: [130.81, 130.81, 164.81, 174.61] },
      { title: "Ruelle Saint-Denis (Remix)", artist: "Électro-Pop Québec", duration: 44, bpm: 128, genre: "electro", keyNotes: [293.66, 349.23, 440.00, 587.33], bassline: [73.42, 73.42, 87.31, 98.00] }
    ],
    jingles: [{ id: "ckoi_j_1", tagline: "CKOI 96-9... La puissance musicale !", duration: 4, chimeFrequencies: [523.25, 659.25, 783.99, 1046.50] }]
  },
  {
    id: "energie", name: "ÉNERGIE 98,5", freq: "98,5", category: "fm", genre: "Classic Rock & Québ Rock",
    slogan: "Plus de rock, plus d'Énergie !", color: "#e11d48", djName: "Le Boost ÉNERGIE",
    tracks: [
      { title: "L'Autoroute 40 à minuit", artist: "Les Pistons de Donnacona", duration: 46, bpm: 134, genre: "rock", keyNotes: [110.00, 130.81, 146.83, 164.81], bassline: [55.00, 55.00, 65.41, 73.42] },
      { title: "Chemin du Roy (V8 Engine)", artist: "Roxanne & The V8", duration: 52, bpm: 128, genre: "rock", keyNotes: [146.83, 174.61, 220.00, 261.63], bassline: [73.42, 73.42, 87.31, 110.00] }
    ],
    jingles: [{ id: "energie_j", tagline: "É-NER-GIE ! 98... 5 !", duration: 3, chimeFrequencies: [220.00, 329.63, 440.00, 880.00] }]
  },
  {
    id: "chom", name: "CHOM 97,7", freq: "97,7", category: "fm", genre: "Classic Rock Heritage",
    slogan: "The Spirit of Rock · En direct de Montréal", color: "#f59e0b", djName: "Terry DiMonte Classic",
    tracks: [
      { title: "Laurentian Highway Blues", artist: "St-Laurent Delta Band", duration: 55, bpm: 116, genre: "rock", keyNotes: [196.00, 246.94, 293.66, 392.00], bassline: [98.00, 98.00, 123.47, 146.83] }
    ],
    jingles: [{ id: "chom_j", tagline: "CHOM 97-7... Montreal's Spirit of Rock.", duration: 3, chimeFrequencies: [196.00, 293.66, 392.00, 587.33] }]
  },
  {
    id: "rythme", name: "Rythme 105,7", freq: "105,7", category: "fm", genre: "Variétés & Pop Adulte",
    slogan: "La musique de votre vie", color: "#a855f7", djName: "Sébastien & Marie-Ève",
    tracks: [
      { title: "Douce brise du fleuve", artist: "Trio Saint-Laurent", duration: 52, bpm: 92, genre: "chanson", keyNotes: [261.63, 329.63, 392.00, 493.88], bassline: [130.81, 130.81, 164.81, 196.00] }
    ],
    jingles: [{ id: "rythme_j", tagline: "Rythme FM... Votre plus belle journée.", duration: 3, chimeFrequencies: [440.00, 554.37, 659.25, 880.00] }]
  },
  {
    id: "ici", name: "ICI Première 104,7", freq: "104,7", category: "fm", genre: "Information & Météo",
    slogan: "L'information juste, en direct de Radio-Canada", color: "#3b82f6", djName: "Alain Gravel & la rédaction",
    tracks: [
      { title: "Météo et État des Routes MTQ", artist: "ICI Québec", duration: 42, bpm: 76, genre: "news", keyNotes: [440.00, 523.25, 659.25, 880.00], bassline: [110.00, 110.00, 110.00, 110.00] }
    ],
    jingles: [{ id: "ici_j", tagline: "ICI Première... Radio-Canada.", duration: 2, chimeFrequencies: [523.25, 659.25, 783.99] }]
  },
  {
    id: "clandestine", name: "Clandestine 107,9", freq: "107,9", category: "pirate", genre: "Rap Québ & Trap",
    slogan: "Diffusé depuis les toits de Montréal-Nord", color: "#6366f1", djName: "DJ Hangar 514",
    tracks: [
      { title: "Règles du bitume (514/418)", artist: "Krew Saint-Michel", duration: 48, bpm: 140, genre: "rap_queb", keyNotes: [146.83, 174.61, 220.00, 261.63], bassline: [36.71, 36.71, 43.65, 49.00] }
    ],
    jingles: [{ id: "clandestine_j", tagline: "107-9... Pas de nom, pas de visage.", duration: 2, chimeFrequencies: [73.42, 110.00, 146.83] }]
  }
];

export const CB_CHANNELS = Object.freeze({
  19: { name: "Canal 19 — Corridor A-40 / A-20", description: "Le canal officiel des camionneurs longue distance ( SQ)" },
  10: { name: "Canal 10 — Rangs & Agricole", description: "Échanges ruraux, laitiers, producteurs et érablières" },
  9:  { name: "Canal 9 — Urgence & Sauvetage", description: "Fréquence de secours réservée aux détresses" },
});

// Émetteur d'urgence "En Alerte"
let emergencyState = { id: "", active: false, type: "meteo_extreme", headline: "", message: "", startedAt: 0, durationSeconds: 15 };

export function triggerEmergencyBroadcast(type, headline, message, durationSec = 20) {
  emergencyState = { id: `ALERT-${Date.now()}`, active: true, type, headline, message, startedAt: Date.now(), durationSeconds: durationSec };
  quebecFM.playAlertReadyTone();
  netEmit?.("radio:emergency_alert", { emergencyState });
}

// ─── CONTEXTE AUDIO PHYSIQUE (WEB AUDIO API) ─────────────────────────────────

class QuebecFM {
  constructor() {
    this.on = false;
    this.stationId = QUEBEC_FM_STATIONS[0].id;
    this.volume = 0.25;

    this.cbActive = false;
    this.cbChannel = 19;
    this.cbMessages = [];

    this.ctx = null;
    this.masterGain = null;
    this.carFilter = null;
    this.staticGain = null;

    this.acc = 0;
    this.startedAt = Date.now();
    this.isTuning = false;
    this._sharedNoiseBuffer = null;

    this._initDefaultCBMessages();
  }

  _initDefaultCBMessages() {
    this.cbMessages = [
      { id: "cb_1", channel: 19, senderCallsign: "Gros-Bison-104", senderName: "Trucker Marc", message: "Gaffe les boys, y'a une autopatrouille SQ cachée à la sortie 281 !", timestamp: Date.now() - 45000 },
      { id: "cb_2", channel: 19, senderCallsign: "L'Aigle-du-Nord", senderName: "Ti-Guy", message: "10-4 Bison ! Merci du call, je lâche le throttle.", timestamp: Date.now() - 20000 }
    ];
  }

  station() {
    return QUEBEC_FM_STATIONS.find((s) => s.id === this.stationId) ?? QUEBEC_FM_STATIONS[0];
  }

  nowPlaying() {
    const s = this.station();
    const elapsed = Math.max(0, (Date.now() - this.startedAt) / 1000);
    const total = s.tracks.reduce((sum, t) => sum + t.duration, 0) || 1;
    let t = elapsed % total;

    for (const track of s.tracks) {
      if (t < track.duration) {
        return { station: s, track, progress: t, isJingle: false, isEmergencyAlert: emergencyState.active, currentDJText: s.djName };
      }
      t -= track.duration;
    }
    return { station: s, track: s.tracks[0], progress: 0, isJingle: false, isEmergencyAlert: emergencyState.active, currentDJText: s.djName };
  }

  /**
   * Initialise le moteur Web Audio à la première interaction utilisateur.
   */
  async ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.on ? this.volume : 0;

    // Égaliseur passe-bas de l'habitacle
    this.carFilter = this.ctx.createBiquadFilter();
    this.carFilter.type = "lowpass";
    this.carFilter.frequency.value = 18000;

    this.masterGain.connect(this.carFilter);
    this.carFilter.connect(this.ctx.destination);

    // Initialisation du bruit de syntonisation
    this.initStaticNoise();

    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  initStaticNoise() {
    if (!this.ctx || !this.masterGain) return;

    // Buffer de bruit blanc pré-alloué réutilisable (anti Garbage Collection)
    const bufferSize = this.ctx.sampleRate * 2;
    this._sharedNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this._sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.staticGain = this.ctx.createGain();
    this.staticGain.gain.value = 0;
    this.staticGain.connect(this.masterGain);

    const playStatic = () => {
      if (!this.ctx || !this.staticGain || !this._sharedNoiseBuffer) return;
      const source = this.ctx.createBufferSource();
      source.buffer = this._sharedNoiseBuffer;
      source.loop = true;
      source.connect(this.staticGain);
      source.start();
    };

    playStatic();
  }

  setOn(on) {
    this.on = on;
    void this.ensure();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.08);
    }
  }

  setStation(id) {
    if (id !== this.stationId) {
      this.startedAt = Date.now();
      this.playTuningStatic();
    }
    this.stationId = id;
    this.setOn(true);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && this.on) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setSignalQuality(qualityPercent) {
    if (!this.staticGain || !this.carFilter || !this.ctx) return;
    const factor = 1 - Math.max(0, Math.min(1, qualityPercent / 100));

    this.staticGain.gain.setTargetAtTime(factor * 0.12, this.ctx.currentTime, 0.1);
    this.carFilter.frequency.setTargetAtTime(18000 * (1 - factor * 0.7), this.ctx.currentTime, 0.1);
  }

  playTuningStatic() {
    if (!this.staticGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.staticGain.gain.setValueAtTime(0.08, t);
    this.staticGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  }

  playAlertReadyTone() {
    void this.ensure();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const alertGain = this.ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(853, t);
    osc2.frequency.setValueAtTime(932, t);

    alertGain.gain.setValueAtTime(0.22, t);
    alertGain.gain.setValueAtTime(0.22, t + 2.5);
    alertGain.gain.exponentialRampToValueAtTime(0.001, t + 3.0);

    osc1.connect(alertGain);
    osc2.connect(alertGain);
    alertGain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 3.0);
    osc2.stop(t + 3.0);
  }

  sendCBMessage(senderCallsign, senderName, message) {
    const msg = {
      id: `cb_${Date.now()}`,
      channel: this.cbChannel,
      senderCallsign,
      senderName,
      message,
      timestamp: Date.now(),
    };

    this.cbMessages.unshift(msg);
    if (this.cbMessages.length > 30) this.cbMessages.pop();

    this.playRogerBeep();
    netEmit?.("radio:cb_message", { message: msg });
  }

  playRogerBeep() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1000, t);
    osc.frequency.setValueAtTime(1400, t + 0.08);

    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // ─── INSTRUMENTS DU SYNTHÉTISEUR (MÉMOISÉS / PRÉCIS) ───────────────────────

  tick(dt, audible) {
    if (!this.on || !audible || !this.ctx || !this.masterGain) return;
    if (this.ctx.state !== "running") return;

    if (emergencyState.active) {
      if (Date.now() - emergencyState.startedAt > emergencyState.durationSeconds * 1000) {
        emergencyState.active = false;
      }
      return;
    }

    this.acc += dt;
    if (this.acc < 0.2) return;
    this.acc = 0;

    this.synthesizeBeat();
  }

  synthesizeBeat() {
    const ctx = this.ctx;
    const dest = this.masterGain;
    if (!ctx || !dest) return;

    const { station, track, progress } = this.nowPlaying();
    const t = ctx.currentTime;
    const beatDuration = 60 / track.bpm;
    const step = Math.floor((progress % (beatDuration * 4)) / (beatDuration / 4));
    const id = station.id;

    if (id === "ici") {
      if (step === 0 && Math.floor(progress) % 8 === 0) {
        this.tone(t, 523.25, "sine", 0.25, 0.07);
      }
      return;
    }

    if (id === "clandestine") {
      if (step % 8 === 0) this.sub808(t, 0.25, 42);
      if (step % 8 === 4) this.snare(t, 0.14, "sine");
      return;
    }

    // Synthétiseur générique Pop/Rock
    if (step % 4 === 0) this.kick(t, 0.14, 120);
    if (step % 8 === 4) this.snare(t, 0.09, "sine");
  }

  kick(t, vol, startPitch = 140) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(startPitch, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.1);

    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  sub808(t, vol, freq = 45) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq + 40, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.08);

    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.46);
  }

  snare(t, vol, type = "triangle") {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);

    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  tone(t, freq, type, dur, vol) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  dispose() {
    this.setOn(false);
    try {
      this.ctx?.close();
    } catch { /* ignore */ }
    this.ctx = null;
    this.masterGain = null;
    this.carFilter = null;
    this.staticGain = null;
    this._sharedNoiseBuffer = null;
  }
}

export const quebecFM = new QuebecFM();
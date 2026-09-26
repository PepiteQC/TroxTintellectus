/**
 * TroxTWorld — Procedural Urban & Nature Audio Engine
 * Client-Side Web Audio API Synthesizer
 * 
 * Génère des environnements sonores en temps réel adaptés à la géographie de Saint-Alban :
 * - Vent : Bruit blanc modulé par un LFO.
 * - Rivière & Chutes : Bruit blanc filtré passe-bande basse fréquence pour le grondement.
 * - Trafic : Voitures générées mathématiquement (effet Doppler).
 * - Nature : Synthèse d'oiseaux et de grillons via des oscillateurs.
 * 
 * Chemin : client/src/core/AudioManager.mjs
 */

export class AudioManager {
  static instance = null;

  constructor() {
    // Web Audio Context & Core Nodes
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.masterVolume = 0.5;

    // Individual Layer Gain Nodes (mixage fluide)
    this.windGain = null;
    this.trafficHumGain = null;
    this.trafficEventGain = null;
    this.crowdGain = null;
    this.natureGain = null;
    this.waterGain = null;

    // Synthesis Generators & Modulators
    this.noiseBuffer = null;
    this.isInitialized = false;
    this.activeZone = 'stalban_village';

    // Timers
    this.carTimer = null;
    this.natureTimer = null;
  }

  static getInstance() {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Initialise le contexte audio (doit être appelé suite à un clic/interaction du joueur)
   */
  async init() {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.error("Web Audio API not supported in this browser.");
        return;
      }

      this.ctx = new AudioContextClass();
      
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Création du buffer de bruit blanc (1 seconde)
      const bufferSize = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Initialisation des modules
      this.setupWindModule();
      this.setupTrafficModule();
      this.setupCrowdModule();
      this.setupNatureModule();
      this.setupWaterModule();

      // Démarrage des événements aléatoires
      this.startCarScheduler();
      this.startNatureScheduler();

      this.isInitialized = true;
      this.applyZoneMix(this.activeZone, true); 
      console.log("🌱 TroxT Procedural Audio Engine (Saint-Alban) initialized!");
    } catch (e) {
      console.error("Failed to initialize procedural audio engine:", e);
    }
  }

  // ─── AMBIENT MODULES ───────────────────────────────────────────────────────

  setupWindModule() {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.windGain.connect(this.masterGain);

    const windSource = this.ctx.createBufferSource();
    windSource.buffer = this.noiseBuffer;
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    windFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    // LFO pour simuler les bourrasques de vent
    const gustLfo = this.ctx.createOscillator();
    gustLfo.frequency.setValueAtTime(0.08, this.ctx.currentTime); 
    
    const gustLfoGain = this.ctx.createGain();
    gustLfoGain.gain.setValueAtTime(120, this.ctx.currentTime);

    gustLfo.connect(gustLfoGain);
    gustLfoGain.connect(windFilter.frequency);

    windSource.connect(windFilter);
    windFilter.connect(this.windGain);

    windSource.start(0);
    gustLfo.start(0);
  }

  setupWaterModule() {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;

    // Son de la rivière / Barrage
    this.waterGain = this.ctx.createGain();
    this.waterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.waterGain.connect(this.masterGain);

    const waterSource = this.ctx.createBufferSource();
    waterSource.buffer = this.noiseBuffer;
    waterSource.loop = true;

    const waterFilter = this.ctx.createBiquadFilter();
    waterFilter.type = 'bandpass';
    waterFilter.frequency.setValueAtTime(250, this.ctx.currentTime); // Fréquence sourde pour le grondement
    waterFilter.Q.setValueAtTime(0.5, this.ctx.currentTime);

    waterSource.connect(waterFilter);
    waterFilter.connect(this.waterGain);

    waterSource.start(0);
  }

  setupTrafficModule() {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;
    const t = this.ctx.currentTime;

    this.trafficHumGain = this.ctx.createGain();
    this.trafficHumGain.gain.setValueAtTime(0, t);
    this.trafficHumGain.connect(this.masterGain);

    this.trafficEventGain = this.ctx.createGain();
    this.trafficEventGain.gain.setValueAtTime(0, t);
    this.trafficEventGain.connect(this.masterGain);

    const roadSource = this.ctx.createBufferSource();
    roadSource.buffer = this.noiseBuffer;
    roadSource.loop = true;

    const roadFilter = this.ctx.createBiquadFilter();
    roadFilter.type = 'bandpass';
    roadFilter.frequency.setValueAtTime(180, t);
    roadFilter.Q.setValueAtTime(1.0, t);

    roadSource.connect(roadFilter);
    roadFilter.connect(this.trafficHumGain);
    roadSource.start(0);
  }

  setupCrowdModule() {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;
    const t = this.ctx.currentTime;

    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.setValueAtTime(0, t);
    this.crowdGain.connect(this.masterGain);

    const crowdNoise = this.ctx.createBufferSource();
    crowdNoise.buffer = this.noiseBuffer;
    crowdNoise.loop = true;

    const crowdFilter = this.ctx.createBiquadFilter();
    crowdFilter.type = 'bandpass';
    crowdFilter.frequency.setValueAtTime(450, t);
    crowdFilter.Q.setValueAtTime(1.2, t);

    const crowdNoiseGain = this.ctx.createGain();
    crowdNoiseGain.gain.setValueAtTime(0.03, t);

    crowdNoise.connect(crowdFilter);
    crowdFilter.connect(crowdNoiseGain);
    crowdNoiseGain.connect(this.crowdGain);
    crowdNoise.start(0);
  }

  setupNatureModule() {
    if (!this.ctx || !this.masterGain) return;
    this.natureGain = this.ctx.createGain();
    this.natureGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.natureGain.connect(this.masterGain);
  }

  // ─── DYNAMIC EVENTS ────────────────────────────────────────────────────────

  triggerPassingCar() {
    if (!this.ctx || !this.trafficEventGain || this.isMuted) return;

    // Pas de voitures dans les bois ou près des chutes !
    if (this.activeZone === 'stalban_gorge_secteur' || this.activeZone === 'stalban_chutes') {
      return; 
    }

    const t = this.ctx.currentTime;
    const duration = 2.4 + Math.random() * 1.2;

    const carOsc = this.ctx.createOscillator();
    carOsc.type = 'sawtooth';

    // Effet Doppler
    const startFreq = 160 + Math.random() * 40;
    carOsc.frequency.setValueAtTime(startFreq, t);
    carOsc.frequency.exponentialRampToValueAtTime(startFreq * 1.15, t + duration * 0.4);
    carOsc.frequency.exponentialRampToValueAtTime(startFreq * 0.65, t + duration);

    const carFilter = this.ctx.createBiquadFilter();
    carFilter.type = 'lowpass';
    carFilter.frequency.setValueAtTime(120, t);
    carFilter.frequency.linearRampToValueAtTime(650, t + duration * 0.4);
    carFilter.frequency.linearRampToValueAtTime(90, t + duration);

    const carGain = this.ctx.createGain();
    carGain.gain.setValueAtTime(0, t);
    carGain.gain.linearRampToValueAtTime(0.2, t + duration * 0.4);
    carGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    carOsc.connect(carFilter);
    carFilter.connect(carGain);
    carGain.connect(this.trafficEventGain);

    carOsc.start(t);
    carOsc.stop(t + duration);
  }

  triggerNatureChirp() {
    if (!this.ctx || !this.natureGain || this.isMuted) return;

    // Pas de nature bruyante en plein centre du village
    if (this.activeZone === 'stalban_village' && Math.random() > 0.2) return;

    const t = this.ctx.currentTime;
    const isCricket = Math.random() > 0.6;

    if (isCricket) {
      const pulseCount = 4 + Math.floor(Math.random() * 5);
      const pulseRate = 0.05; 
      
      for (let i = 0; i < pulseCount; i++) {
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(4500 + Math.random() * 200, t + i * pulseRate);
        
        oscGain.gain.setValueAtTime(0, t + i * pulseRate);
        oscGain.gain.linearRampToValueAtTime(0.04, t + i * pulseRate + 0.01);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, t + i * pulseRate + pulseRate - 0.01);

        osc.connect(oscGain);
        oscGain.connect(this.natureGain);

        osc.start(t + i * pulseRate);
        osc.stop(t + i * pulseRate + pulseRate);
      }
    } else {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const duration = 0.12 + Math.random() * 0.1;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2800 + Math.random() * 500, t);
      osc.frequency.exponentialRampToValueAtTime(1500, t + duration);

      oscGain.gain.setValueAtTime(0, t);
      oscGain.gain.linearRampToValueAtTime(0.06, t + duration * 0.2);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(oscGain);
      oscGain.connect(this.natureGain);

      osc.start(t);
      osc.stop(t + duration);
    }
  }

  startCarScheduler() {
    if (this.carTimer) clearInterval(this.carTimer);
    this.carTimer = setInterval(() => {
      if (Math.random() > 0.45) this.triggerPassingCar();
    }, 3000);
  }

  startNatureScheduler() {
    if (this.natureTimer) clearInterval(this.natureTimer);
    this.natureTimer = setInterval(() => {
      const triggerChance = this.activeZone === 'stalban_foret_nord' ? 0.75 : 0.35;
      if (Math.random() < triggerChance) this.triggerNatureChirp();
    }, 2000);
  }

  // ─── ZONE MANAGEMENT ───────────────────────────────────────────────────────

  setZone(zone) {
    if (zone === this.activeZone) return;
    this.activeZone = zone;
    if (this.isInitialized) {
      this.applyZoneMix(zone, false);
    }
  }

  getActiveZone() {
    return this.activeZone;
  }

  applyZoneMix(zone, immediate = false) {
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const rampTime = immediate ? 0.01 : 3.0; // Transition très douce de 3 secondes

    let targetWind = 0.0;
    let targetTrafficHum = 0.0;
    let targetTrafficEvent = 0.0;
    let targetCrowd = 0.0;
    let targetNature = 0.0;
    let targetWater = 0.0;

    switch (zone) {
      case 'stalban_village':
        targetWind = 0.15;
        targetTrafficHum = 0.10;
        targetTrafficEvent = 0.20;
        targetCrowd = 0.15;
        targetNature = 0.05;
        targetWater = 0.0;
        break;

      case 'stalban_gorge_secteur':
        targetWind = 0.35;
        targetTrafficHum = 0.0;
        targetTrafficEvent = 0.0;
        targetCrowd = 0.0;
        targetNature = 0.25;
        targetWater = 0.60; // Gorges de la rivière (eau forte)
        break;

      case 'stalban_chutes':
        targetWind = 0.20;
        targetTrafficHum = 0.0;
        targetTrafficEvent = 0.0;
        targetCrowd = 0.0;
        targetNature = 0.10;
        targetWater = 1.0; // Barrage hydroélectrique (grondement maximal)
        break;

      case 'stalban_foret_nord':
        targetWind = 0.40;
        targetTrafficHum = 0.0;
        targetTrafficEvent = 0.05; // Motoneiges/VTT occasionnels
        targetCrowd = 0.0;
        targetNature = 0.60;
        targetWater = 0.05;
        break;
    }

    const rampGain = (gainNode, value) => {
      if (!gainNode || !this.ctx) return;
      if (immediate) {
        gainNode.gain.setValueAtTime(value, t);
      } else {
        gainNode.gain.linearRampToValueAtTime(value, t + rampTime);
      }
    };

    rampGain(this.windGain, targetWind);
    rampGain(this.trafficHumGain, targetTrafficHum);
    rampGain(this.trafficEventGain, targetTrafficEvent);
    rampGain(this.crowdGain, targetCrowd);
    rampGain(this.natureGain, targetNature);
    rampGain(this.waterGain, targetWater);
  }

  // ─── SFX ACTIONS ───────────────────────────────────────────────────────────

  playSuccessSound() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, t);
      osc1.frequency.setValueAtTime(783.99, t + 0.1);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc1.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      osc1.start(t);
      osc1.stop(t + 0.4);
    } catch (e) {}
  }

  playErrorSound() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.35);
    } catch (e) {}
  }

  playPunchSound() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch (e) {}
  }

  playCashRegisterSound() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1800, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc1.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      osc1.start(t);
      osc1.stop(t + 0.4);
    } catch (e) {}
  }

  playDoorLockSound() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.setValueAtTime(650, t + 0.04);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.14);
    } catch (e) {}
  }

  // ─── SETTINGS ──────────────────────────────────────────────────────────────

  setVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.1);
    }
  }

  setMuted(mute) {
    this.isMuted = mute;
    if (this.ctx && this.masterGain) {
      const targetGain = mute ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    }
  }
}
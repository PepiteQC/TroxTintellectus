// ═══════════════════════════════════════════════════════════
//  DynamicEvents.mjs — Directeur d'événements Portneuf
//  (port du DynamicEventsService d'EtherWorld)
// ═══════════════════════════════════════════════════════════
import { EventEmitter } from 'node:events';

export class DynamicEvents extends EventEmitter {
  constructor() {
    super();
    this.activeEvents = [];
    this.maxEvents = 20;
  }

  // ── Templates québécois estivaux & Style GTA ──
  
  _summerStorm() {
    return {
      title: 'Alerte d\'orages violents et inondations éclairs',
      category: 'meteo', severity: 'majeur',
      locationName: 'Région de Portneuf (A-40 et routes secondaires)',
      coordinates: [-130, 2, 8],
      description: 'Cellule orageuse très intense. Pluies torrentielles, risques d\'aquaplanage et vents violents.',
      durationMinutes: 60,
      impacts: ['Routes extrêmement glissantes', 'Visibilité réduite', 'Risque d\'arbres déracinés'],
      globalModifiers: { speedLimitMultiplier: 0.6, policeAggressiveness: 0.8, weatherForce: 'stormy' },
    };
  }

  _outage() {
    return {
      title: 'Panne générale Hydro-Québec - Surchauffe réseau',
      category: 'infrastructures', severity: 'majeur',
      locationName: 'Bourg patrimonial de Saint-Casimir',
      coordinates: [-900, 2, -280],
      description: 'Bris de matériel sur le réseau suite à une surchauffe des transformateurs (canicule).',
      durationMinutes: 90,
      impacts: ['Coupure d\'éclairage public', 'Feux de circulation hors service', 'Génératrices actives'],
      globalModifiers: { powerOutage: true },
    };
  }

  _sqCheckpoint() {
    return {
      title: 'Opération Marteau - Barrage routier SQ',
      category: 'urgence', severity: 'mineur',
      locationName: 'Route 138, entrée est de Saint-Alban',
      coordinates: [-450, 2, -150],
      description: 'Contrôle routier intensif SQ (capacités affaiblies + inspection de véhicules modifiés).',
      durationMinutes: 45,
      impacts: ['Ralentissements majeurs', 'Fouilles aléatoires', 'Tolérance zéro CSR'],
      globalModifiers: { policeAggressiveness: 1.5 },
    };
  }

  _streetRacing() {
    return {
      title: 'Rassemblement illégal et courses de rue',
      category: 'criminalite', severity: 'majeur',
      locationName: 'Le Rang des Gars Chauds',
      coordinates: [-3200, 15, -1500],
      description: 'Une centaine de street racers bloquent le rang pour faire des courses d\'accélération.',
      durationMinutes: 120,
      impacts: ['Circulation civile bloquée', 'Paris illégaux en cours', 'Intervention anti-émeute SQ imminente'],
      globalModifiers: { policeAggressiveness: 2.0, crimeRateMultiplier: 1.8 },
    };
  }

  _festival() {
    return {
      title: 'Festival estival de la patate et foire agricole',
      category: 'social', severity: 'mineur',
      locationName: 'Parc municipal de Portneuf',
      coordinates: [120, 2, 400],
      description: 'Rassemblement populaire estival, kiosques de producteurs locaux et bière de microbrasserie.',
      durationMinutes: 180,
      impacts: ['Stationnement interdit autour du parc', 'Patrouilleurs à pied', 'Hausse du commerce local'],
    };
  }

  trigger(templateKey) {
    const map = {
      storm: () => this._summerStorm(),
      outage: () => this._outage(),
      sq_checkpoint: () => this._sqCheckpoint(),
      street_racing: () => this._streetRacing(),
      festival: () => this._festival(),
    };
    const gen = map[templateKey];
    if (!gen) return null;

    // Vérifie si un événement de cette catégorie est déjà actif
    const cat = gen().category;
    const existing = this.activeEvents.find(e => e.active && e.category === cat);
    if (existing) {
      existing.startedAt = Date.now();
      return existing;
    }

    const ev = {
      ...gen(),
      id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      startedAt: Date.now(),
      active: true,
    };
    
    this.activeEvents.unshift(ev);
    if (this.activeEvents.length > this.maxEvents) this.activeEvents.length = this.maxEvents;
    console.log('[Events] ' + ev.severity.toUpperCase() + ' ' + ev.title);
    this.emit('event', ev);
    return ev;
  }

  triggerRandom() {
    const keys = ['storm', 'outage', 'sq_checkpoint', 'street_racing', 'festival'];
    return this.trigger(keys[Math.floor(Math.random() * keys.length)]);
  }

  resolve(id) {
    const e = this.activeEvents.find(x => x.id === id);
    if (!e || !e.active) return false;
    e.active = false;
    this.emit('resolved', e);
    return true;
  }

  resolveCategory(cat) {
    let n = 0;
    for (const e of this.activeEvents) {
      if (e.category === cat && e.active) { 
        e.active = false; 
        n++; 
      }
    }
    return n;
  }

  clearAll() {
    for (const e of this.activeEvents) e.active = false;
  }

  getActive() { 
    return this.activeEvents.filter(e => e.active); 
  }

  getAll() { 
    return [...this.activeEvents]; 
  }

  tick() {
    const now = Date.now();
    for (const e of this.activeEvents) {
      if (!e.active) continue;
      if (now - e.startedAt > e.durationMinutes * 60_000) {
        e.active = false;
        this.emit('expired', e);
      }
    }
  }

  banner() {
    const live = this.getActive();
    if (live.length === 0) return null;
    const rank = { catastrophe: 3, majeur: 2, mineur: 1 };
    live.sort((a, b) => rank[b.severity] - rank[a.severity]);
    return { title: live[0].title, severity: live[0].severity, locationName: live[0].locationName };
  }

  hasGlobalModifier(key) {
    return this.getActive().some(e => e.globalModifiers && e.globalModifiers[key]);
  }

  snapshot() {
    return {
      activeCount: this.getActive().length,
      totalCount: this.activeEvents.length,
      banner: this.banner(),
      events: this.getActive(),
      modifiers: {
        speedLimitMultiplier: this.hasGlobalModifier('speedLimitMultiplier'),
        policeAggressiveness: this.hasGlobalModifier('policeAggressiveness'),
        powerOutage: this.hasGlobalModifier('powerOutage'),
        weatherForce: this.hasGlobalModifier('weatherForce'),
        crimeRateMultiplier: this.hasGlobalModifier('crimeRateMultiplier'),
      },
    };
  }
}

export default DynamicEvents;
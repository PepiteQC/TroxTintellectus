/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — DATABASE/SEED.JS
 * Données d'initialisation géographiques & physiques — Saint-Alban (Portneuf)
 * ═══════════════════════════════════════════════════════════════════
 * Zones · Physique de surface · Bounds · Spawns · World state initial
 * Connecté au cerveau TROXT⬡ via dbEvents.
 *
 * Chemin : database/seed.js
 */

import { zoneConfig, surfacePhysics, zoneBounds, spawnPoints, worldState }
  from './schema.js';
import { dbEvents, SIG } from './index.js';

const log = (lvl, msg) => {
  const i = { OK:'✓', SEED:'🌱', WARN:'⚠', INFO:'ℹ' }[lvl] || '·';
  console.log(`[${new Date().toISOString().slice(11,19)}] ${i} [${SIG}·Seed] ${msg}`);
};

// ─── ZONES DE SAINT-ALBAN ────────────────────────────────────────────────────
const ZONES = [
  {
    zoneKey: 'stalban_village',
    name: 'Saint-Alban — Cœur Villageois',
    type: 'urban',
    colorHex: '#2b8a3e',
    speedLimitKmh: 40,
    lawStrictness: 'standard',
    respawnHospital: 'clinique_saint_casimir',
    policeStation: 'poste_sq_saint_marc',
    metadata: {
      description: 'Village historique québécois fondé en 1831 sur les rives de la Sainte-Anne.',
      pointsOfInterest: ['Église Saint-Alban', 'Dépanneur du Rang', 'Vieux Pont'],
    },
  },
  {
    zoneKey: 'stalban_gorge_secteur',
    name: 'Gorges de la Rivière Sainte-Anne',
    type: 'sacred',
    colorHex: '#1971c2',
    speedLimitKmh: 20,
    lawStrictness: 'federal',
    respawnHospital: 'ch_portneuf_nord',
    policeStation: 'sq_gardes_chasse',
    metadata: {
      description: 'Canyon calcaire spectaculaire et marmites de géants creusées par les eaux.',
      dangerLevel: 'high',
    },
  },
  {
    zoneKey: 'stalban_chutes',
    name: 'Secteur des Chutes et Barrage',
    type: 'industrial',
    colorHex: '#f59f00',
    speedLimitKmh: 30,
    lawStrictness: 'standard',
    respawnHospital: 'clinique_saint_casimir',
    policeStation: 'sq_portneuf_nord',
    metadata: { description: 'Centrale hydroélectrique historique et déversoir tumultueux.' },
  },
  {
    zoneKey: 'stalban_foret_nord',
    name: 'Forêt Laurentienne — Rang Saint-Marc',
    type: 'forest',
    colorHex: '#2f9e44',
    speedLimitKmh: 70,
    lawStrictness: 'low',
    respawnHospital: 'ch_portneuf_nord',
    policeStation: 'sq_gardes_chasse',
    metadata: { description: 'Érablières denses, camps de chasse et pistes de VTT fédérées.' },
  },
];

// ─── PHYSIQUE DE SURFACE (Style GTA) ─────────────────────────────────────────
const SURFACES = [
  { surfaceType:'asphalt_qc',        friction:0.88, drag:0.02, maxSpeedMult:1.00, dustParticle:'dust_grey_light',    skidSound:'skid_asphalt',     slipAngleDeg:12.0 },
  { surfaceType:'dirt_gravel_qc',    friction:0.65, drag:0.07, maxSpeedMult:0.82, dustParticle:'dust_gravel_cloud',  skidSound:'skid_gravel',      slipAngleDeg:24.0 },
  { surfaceType:'calcaire_rock_face',friction:0.78, drag:0.05, maxSpeedMult:0.70, dustParticle:'dust_rock_spark',    skidSound:'skid_rock',        slipAngleDeg:16.0 },
  { surfaceType:'grass_field',       friction:0.70, drag:0.10, maxSpeedMult:0.85, dustParticle:'dirt_kickup',        skidSound:'skid_grass',       slipAngleDeg:20.0 },
  { surfaceType:'mud_trail',         friction:0.40, drag:0.25, maxSpeedMult:0.60, dustParticle:'mud_splatter',       skidSound:'skid_mud',         slipAngleDeg:35.0 },
];

// ─── BOUNDS ──────────────────────────────────────────────────────────────────
const BOUNDS = [
  { zoneKey:'stalban_village', minX:-3500, minZ:-2800, maxX:-2800, maxZ:-2000,
    polygonJson:[[-3500,-2800],[-2800,-2800],[-2800,-2000],[-3500,-2000]], elevationBase:42.0 },
  { zoneKey:'stalban_gorge_secteur', minX:-3200, minZ:-3600, maxX:-2600, maxZ:-2800,
    polygonJson:[[-3200,-3600],[-2600,-3600],[-2600,-2800],[-3200,-2800]], elevationBase:28.0 },
  { zoneKey:'stalban_chutes', minX:-2800, minZ:-2800, maxX:-2200, maxZ:-2200,
    polygonJson:[[-2800,-2800],[-2200,-2800],[-2200,-2200],[-2800,-2200]], elevationBase:35.0 },
  { zoneKey:'stalban_foret_nord', minX:-4200, minZ:-2000, maxX:-2800, maxZ:-600,
    polygonJson:[[-4200,-2000],[-2800,-2000],[-2800,-600],[-4200,-600]], elevationBase:120.0 },
];

// ─── SPAWNS ──────────────────────────────────────────────────────────────────
const SPAWNS = [
  { zoneKey:'stalban_village',      pointType:'player_default',     posX:-3150, posY:42.5, posZ:-2420, headingDeg:180, isReserved:0 },
  { zoneKey:'stalban_village',      pointType:'police_car',         posX:-3140, posY:42.2, posZ:-2405, headingDeg:90,  isReserved:1 },
  { zoneKey:'stalban_village',      pointType:'ambulance',          posX:-3120, posY:42.2, posZ:-2440, headingDeg:90,  isReserved:1 },
  { zoneKey:'stalban_gorge_secteur',pointType:'trail_hiking_start', posX:-2890, posY:31.0, posZ:-3120, headingDeg:270, isReserved:0 },
  { zoneKey:'stalban_chutes',       pointType:'player_default',     posX:-2500, posY:35.0, posZ:-2500, headingDeg:0,   isReserved:0 },
  { zoneKey:'stalban_foret_nord',   pointType:'dirtbike_start',     posX:-3500, posY:120.0,posZ:-1300, headingDeg:45,  isReserved:0 },
];

// ─── SEED PRINCIPAL ──────────────────────────────────────────────────────────
export async function seedSaintAlban(db) {
  log('SEED', 'Insertion des données de Saint-Alban (Portneuf)...');
  const report = { zones:0, surfaces:0, bounds:0, spawns:0 };

  // 1. Zones
  const z = await db.insert(zoneConfig).values(ZONES).onConflictDoNothing().returning?.() ?? [];
  report.zones = ZONES.length;
  log('OK', `${ZONES.length} zones insérées`);

  // 2. Physique de surface
  await db.insert(surfacePhysics).values(SURFACES).onConflictDoNothing();
  report.surfaces = SURFACES.length;
  log('OK', `${SURFACES.length} surfaces physiques insérées`);

  // 3. Bounds
  await db.insert(zoneBounds).values(BOUNDS).onConflictDoNothing();
  report.bounds = BOUNDS.length;
  log('OK', `${BOUNDS.length} zone bounds insérées`);

  // 4. Spawns
  await db.insert(spawnPoints).values(SPAWNS).onConflictDoNothing();
  report.spawns = SPAWNS.length;
  log('OK', `${SPAWNS.length} points d'apparition insérés`);

  // 5. World state initial (Été québécois)
  if (worldState) {
    await db.insert(worldState).values({
      id: 'singleton', weather: 'sunny', timeHours: 14.0,
      season: 'summer', dayCount: 1, taxRate: 0.05, crimeRate: 0.35,
      metadata: { region: 'Portneuf', locale: 'fr-CA', founded: 'Saint-Alban 1831' },
    }).onConflictDoNothing();
    log('OK', 'World state initial — été, 14:00, Portneuf');
  }

  // Informer le cerveau TROXT⬡
  dbEvents.emit('troxtworld:seed_complete', { region: 'Saint-Alban', ...report, sig: SIG });

  log('SEED', `Saint-Alban initialisé — ${report.zones} zones · ${report.spawns} spawns`);
  return report;
}

export { ZONES, SURFACES, BOUNDS, SPAWNS };
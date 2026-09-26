/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛣️ WORLD SCHEMA, SURFACE DYNAMICS & TIRE PHYSICS — QUEBEC EDITION (JS)
 * ═══════════════════════════════════════════════════════════════════════════
 * Physique avancée des sols de la MRC de Portneuf :
 *   - 8 biomes de surfaces (Asphalte, Garnotte, Glace, Neige, Boue, etc.)
 *   - Gestion thermique des pneus (gomme d'été sous les 7°C)
 *   - Réglementation de la SAAQ (obligation légale du 1er décembre au 15 mars)
 *   - Dynamique d'aquaplanage sur chaussée mouillée
 *   - Multiplicateurs d'adhérence selon la monte de pneumatiques
 */

export const SURFACE_KINDS = Object.freeze([
  "asphalt", "dirt", "grass", "snow", "gravel", "ice", "mud", "water_shallow",
]);

export const TIRE_KINDS = Object.freeze([
  "summer", "winter", "studded", "offroad",
]);

export const WEATHER_KINDS = Object.freeze([
  "clear", "rain", "snow", "fog", "storm",
]);

// ─────────────────────────────────────────────────────────────────────────────
// PROPRIÉTÉS PHYSIQUES DES SURFACES PORTNEUVOISES (VALLÉE, RANGS ET FLEUVE)
// ─────────────────────────────────────────────────────────────────────────────
export const SURFACE_PROPERTIES = Object.freeze({
  asphalt: Object.freeze({
    kind: "asphalt",
    name: "Asphalte / Route 138 & Autoroute 40",
    friction: 1.0,
    rollingResistance: 0.012,
    slipThreshold: 0.85,
    driftMultiplier: 1.1,
    maxTractionForce: 1.0,
    soundProfile: "screech",
    particleFX: "smoke",
  }),
  gravel: Object.freeze({
    kind: "gravel",
    name: "Garnotte / Rangs de campagne",
    friction: 0.65,
    rollingResistance: 0.045,
    slipThreshold: 0.45,
    driftMultiplier: 1.6,
    maxTractionForce: 0.75,
    soundProfile: "gravel_crunch",
    particleFX: "pebbles",
  }),
  dirt: Object.freeze({
    kind: "dirt",
    name: "Terre battue / Sentiers forestiers du Nord",
    friction: 0.60,
    rollingResistance: 0.038,
    slipThreshold: 0.50,
    driftMultiplier: 1.4,
    maxTractionForce: 0.70,
    soundProfile: "dirt_roll",
    particleFX: "dust",
  }),
  snow: Object.freeze({
    kind: "snow",
    name: "Neige damée / Chemin d'hiver",
    friction: 0.35,
    rollingResistance: 0.080,
    slipThreshold: 0.28,
    driftMultiplier: 2.2,
    maxTractionForce: 0.45,
    soundProfile: "snow_crunch",
    particleFX: "snow_spray",
  }),
  ice: Object.freeze({
    kind: "ice",
    name: "Glace noire / Verglas routier",
    friction: 0.10,
    rollingResistance: 0.005,
    slipThreshold: 0.12,
    driftMultiplier: 3.5,
    maxTractionForce: 0.18,
    soundProfile: "ice_slide",
    particleFX: "none",
  }),
  grass: Object.freeze({
    kind: "grass",
    name: "Pelouse humide / Pâturages agricoles",
    friction: 0.48,
    rollingResistance: 0.050,
    slipThreshold: 0.42,
    driftMultiplier: 1.5,
    maxTractionForce: 0.60,
    soundProfile: "grass_swish",
    particleFX: "dust",
  }),
  mud: Object.freeze({
    kind: "mud",
    name: "Boue profonde / Saison de la sloche",
    friction: 0.30,
    rollingResistance: 0.150,
    slipThreshold: 0.25,
    driftMultiplier: 1.8,
    maxTractionForce: 0.35,
    soundProfile: "dirt_roll",
    particleFX: "mud_splat",
  }),
  water_shallow: Object.freeze({
    kind: "water_shallow",
    name: "Flaque d'eau / Crue du Saint-Laurent",
    friction: 0.40,
    rollingResistance: 0.110,
    slipThreshold: 0.35,
    driftMultiplier: 1.7,
    maxTractionForce: 0.48,
    soundProfile: "splash",
    particleFX: "water_spray",
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGIQUE CLIMATIQUE & THERMIQUE DYNAMIQUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Détermine la surface effective selon la météo et la température.
 * Ex: Pluie torrentielle sous 0°C → L'asphalte devient une plaque de verglas.
 */
export function getEffectiveSurface(baseSurface, weather, temperatureC, snowDepthCm = 0) {
  // Transformation de l'asphalte mouillé sous 0°C en glace noire (verglas routier)
  if (baseSurface === "asphalt" &&
      (weather === "rain" || weather === "storm") &&
      temperatureC <= 0) {
    return "ice";
  }

  // Neige accumulée sur la chaussée
  if (snowDepthCm > 3.0 &&
      (baseSurface === "asphalt" || baseSurface === "gravel" || baseSurface === "grass")) {
    return "snow";
  }

  // Boue printanière (Terre + Pluie/Températures positives)
  if (baseSurface === "dirt" &&
      (weather === "rain" || weather === "storm") &&
      temperatureC > 1) {
    return "mud";
  }

  return baseSurface;
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATE GRIP — LOGIQUE COMPLÈTE DE PNEUMATIQUES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule l'adhérence finale effective selon pneu, température, vitesse, eau.
 * @param {string} surface        Type de surface effective résolue
 * @param {string} tire           Type de pneu équipé
 * @param {number} speedKmH       Vitesse linéaire actuelle en km/h
 * @param {number} temperatureC   Température ambiante en °C
 * @param {number} treadDepth     Usure bande de roulement (1.0 = Neuf, 0.0 = Slick)
 * @returns {number}              Grip final [0.05 .. 1.5]
 */
export function calculateGrip(surface, tire, speedKmH, temperatureC, treadDepth = 1.0) {
  const props = SURFACE_PROPERTIES[surface] || SURFACE_PROPERTIES.asphalt;
  let grip = props.friction;

  // 1. DURCISSEMENT DE LA GOMME (seuil critique 7°C)
  if (temperatureC < 7.0 && tire === "summer") {
    // Pneus été : perte d'élasticité sous 7°C
    grip *= 0.70;
  } else if (temperatureC >= 15.0 && (tire === "winter" || tire === "studded")) {
    // Pneus hiver/clous : s'écrasent sur asphalte sec au-dessus de 15°C
    if (surface === "asphalt") grip *= 0.88;
  }

  // 2. MODIFICATEURS PAR SURFACE ET PNEU
  switch (surface) {
    case "snow":
      if (tire === "winter")        grip *= 1.70;
      else if (tire === "studded")  grip *= 1.85;
      else if (tire === "offroad")  grip *= 1.40;
      else                          grip *= 0.50;
      break;

    case "ice":
      if (tire === "studded")       grip *= 3.20;
      else if (tire === "winter")   grip *= 1.45;
      else if (tire === "offroad")  grip *= 0.60;
      else                          grip *= 0.25;
      break;

    case "mud":
    case "dirt":
      if (tire === "offroad")       grip *= 1.60;
      else if (tire === "winter")   grip *= 1.10;
      else if (tire === "studded")  grip *= 1.00;
      else                          grip *= 0.80;
      break;

    case "gravel":
      if (tire === "offroad")       grip *= 1.25;
      else                          grip *= 1.00;
      break;

    case "water_shallow": {
      // Aquaplanage selon usure
      const aquaplaneRisk = calculateAquaplaneRisk(speedKmH, treadDepth);
      grip *= (1.0 - aquaplaneRisk);
      break;
    }

    case "asphalt":
      if (tire === "offroad")       grip *= 0.85;
      else if (tire === "studded")  grip *= 0.80;
      break;
  }

  // 3. USURE GÉNÉRALE DU PNEU (jusqu'à 15% perdu si slick)
  const wearImpact = 0.85 + (treadDepth * 0.15);
  grip *= wearImpact;

  // 4. CHUTE DE GRIP À TRÈS HAUTE VITESSE
  if (speedKmH > 140) {
    const highSpeedPenalty = Math.max(0.65, 1.0 - (speedKmH - 140) * 0.0025);
    grip *= highSpeedPenalty;
  }

  // Clamp final : 0.05 .. 1.5 (super-pneus/clous)
  return Math.min(1.5, Math.max(0.05, grip));
}

// ─────────────────────────────────────────────────────────────────────────────
// LOIS CIVILES ET CALCULS GÉOMÉTRIQUES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loi sur la sécurité routière du Québec (SAAQ) :
 * Pneus d'hiver certifiés obligatoires du 1er décembre au 15 mars inclusivement.
 */
export function isWinterTireMandatory(date = new Date()) {
  const month = date.getMonth(); // Janvier = 0, Décembre = 11
  const day   = date.getDate();

  if (month === 11 || month === 0 || month === 1) return true;      // Déc, Jan, Fév
  if (month === 2 && day <= 15) return true;                         // Mars ≤ 15
  return false;
}

/**
 * Risque d'aquaplanage sur chaussée inondée.
 * @returns {number} 0.0 (adhérence nominale) → 1.0 (perte totale de contact)
 */
export function calculateAquaplaneRisk(speedKmH, treadDepth) {
  // Vitesse critique : 70 km/h si slick (0.0), 100 km/h si neuf (1.0)
  const criticalSpeed = 70.0 + (treadDepth * 30.0);

  if (speedKmH < criticalSpeed) return 0.0;

  const overshoot = speedKmH - criticalSpeed;
  const risk = overshoot * 0.025;   // Perte totale après ~40 km/h d'excès

  return Math.min(1.0, Math.max(0.0, risk));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT (pratique pour import unique)
// ─────────────────────────────────────────────────────────────────────────────
export default {
  SURFACE_KINDS,
  TIRE_KINDS,
  WEATHER_KINDS,
  SURFACE_PROPERTIES,
  getEffectiveSurface,
  calculateGrip,
  isWinterTireMandatory,
  calculateAquaplaneRisk,
};
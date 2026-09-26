/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CORE/TROXT-PHYSICS-BRIDGE.MJS
 * Relie TroxtPhysics (Rapier) ↔ TroxtMechanics ↔ kernel
 * ═══════════════════════════════════════════════════════════════════
 * Sans ce pont, mechanics fait un anti-cheat "distance simple".
 * Avec, la physique Rapier devient l'AUTORITÉ : le serveur simule,
 * valide chaque position contre la simulation, corrige les tricheurs.
 *
 * Branche aussi : spawn joueur → character controller,
 *                 spawn véhicule → raycast vehicle,
 *                 collisions → dégâts → TROXT⬡.
 *
 * Signature : TROXT⬡
 * Chemin    : core/troxt-physics-bridge.mjs
 *
 * import { installPhysicsBridge } from './core/troxt-physics-bridge.mjs';
 * installPhysicsBridge({ kernel, physics, mechanics });
 */

const SIG = 'TROXT⬡';

export function installPhysicsBridge({ kernel, physics, mechanics }) {
  if (!kernel || !physics || !mechanics) {
    throw new Error('kernel + physics + mechanics requis');
  }

  // ── 1. Joueur rejoint → crée un character controller physique ──
  kernel.on('kernel:player_join', (d) => {
    const id = d.player_id;
    const p  = kernel.getPlayer(id);
    physics.addCharacter(id, p?.pos || { x: 0, y: 2, z: 0 });
    mechanics.initHealth?.(id);
  });

  kernel.on('kernel:player_leave', (d) => {
    physics.removeBody(d.player_id);
  });

  // ── 2. Remplace l'anti-cheat mechanics par la validation physique ──
  //    Hook de sécurité prioritaire : valide contre la simulation Rapier.
  //    NOTE : ce hook est appelé EN PLUS du hook _antiCheat de mechanics.
  //    Les deux tournent — la physique donne la décision autoritaire, le
  //    fallback distance reste actif en sécurité secondaire.
  kernel.addSecurityHook((type, data, ctx) => {
    if (type !== 'mech:move' || !ctx.playerId || !data.pos) return { allowed: true };

    // Le serveur simule le mouvement demandé de façon autoritaire
    if (data.desiredMove) {
      physics.moveCharacter(ctx.playerId, data.desiredMove);
    }

    // Compare la position client à la simulation
    const check = physics.validatePosition(ctx.playerId, data.pos);
    if (!check.valid) {
      return {
        allowed: false,
        reason: 'PHYSICS_DESYNC',
        rollback: check.correctedPos,
        desync: check.desync,
      };
    }
    return { allowed: true };
  });

  // ── 3. Véhicule enregistré → crée un raycast vehicle physique ──
  //    Patch de mechanics.registerVehicle : appelle l'original puis crée
  //    le corps Rapier correspondant côté physics.
  const origRegister = mechanics.registerVehicle.bind(mechanics);
  mechanics.registerVehicle = (vid, info = {}) => {
    origRegister(vid, info);
    physics.addVehicle(vid, info.pos || { x: 0, y: 1, z: 0 }, {
      mass:   info.mass,
      width:  info.width,
      length: info.length,
    });
  };

  // ── 4. Commandes véhicule → physique Rapier ──
  kernel.on('mech:vehicle_drive', (d) => {
    physics.driveVehicle(d.vehicle_id, d.throttle, d.steer, d.brake);
  });

  // ── 5. États physiques véhicule → broadcast clients 3D ──
  kernel.on('physics:vehicle_state', (d) => {
    kernel._toClients?.('vehicle_sync', d);
  });

  // ── 6. Crash véhicule → dégâts (déjà routé par physics) ──
  kernel.on('mech:vehicle_crash', (d) => {
    mechanics.damageVehicle?.(d.vehicle_id, 25);
  });

  // ── 7. Saut ──
  kernel.on('mech:jump', (d) => {
    physics.jumpCharacter(d.player_id);
  });

  console.log(`[${SIG}·PhysicsBridge] Physique Rapier reliée aux mécaniques (autorité serveur)`);

  return {
    // API pratique pour piloter depuis le serveur
    drive: (vid, throttle, steer, brake) =>
      kernel.route('mech:vehicle_drive', { vehicle_id: vid, throttle, steer, brake }, { trusted: true }),
    jump: (playerId) =>
      kernel.route('mech:jump', { player_id: playerId }, { trusted: true }),
    stats: () => physics.getStats(),
  };
}

export { SIG };
export default installPhysicsBridge;
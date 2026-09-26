/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CORE/TROXT-PHYSICS.MJS
 * Moteur physique Rapier WASM — coordonné via le kernel
 * ═══════════════════════════════════════════════════════════════════
 * Physique déterministe pour TroxtWorld :
 *   • Corps rigides (joueurs, véhicules, props)
 *   • Character controller (marche, saut, pentes, escaliers)
 *   • Raycast vehicle (suspension, roues, drift)
 *   • Collisions → événements kernel → TROXT⬡ + Intellectus
 *   • Anti-cheat physique (validation serveur autoritaire)
 *
 * Fonctionne côté SERVEUR (autorité) ET côté CLIENT (prédiction).
 * Rapier est identique en Node et navigateur (WASM).
 *
 * Signature : TROXT⬡
 * Chemin    : core/troxt-physics.mjs
 */

const SIG  = 'TROXT⬡';
const ISIG = '🛡️INTELLECTUS⬡';

// ─── CONSTANTES PHYSIQUES ────────────────────────────────────────────────────
const CFG = {
  gravity:          -9.81,
  fixedTimeStep:    1 / 60,
  maxSubSteps:      3,

  // Character controller
  charOffset:       0.08,
  charMaxSlope:     45 * Math.PI / 180,
  charMinSlope:     30 * Math.PI / 180,
  charAutoStep:     0.5,
  charSnapDist:     0.5,
  charJumpVel:      5.0,

  // Véhicule (raycast)
  suspensionRest:   0.5,
  suspensionStiff:  24,
  suspensionDamp:   2.3,
  suspensionTravel: 0.3,
  wheelRadius:      0.4,
  wheelFriction:    1.5,
  engineForce:      1800,
  brakeForce:       120,
  maxSteer:         0.6,

  // Anti-cheat
  maxDesyncM:       3.0,
};

export class TroxtPhysics {
  constructor(kernel) {
    if (!kernel) throw new Error('kernel requis');
    this.k    = kernel;
    this.sig  = SIG;
    this.RAPIER = null;
    this.world  = null;
    this.ready  = false;

    this._bodies      = new Map();
    this._characters  = new Map();
    this._vehicles    = new Map();
    this._eventQueue  = null;

    this._accumulator = 0;
    this.stats = { bodies: 0, steps: 0, collisions: 0, corrections: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════
  async init(RAPIER) {
    this.RAPIER = RAPIER;
    if (typeof RAPIER.init === 'function') await RAPIER.init();

    const g = new RAPIER.Vector3(0, CFG.gravity, 0);
    this.world = new RAPIER.World(g);
    this.world.timestep = CFG.fixedTimeStep;
    this._eventQueue = new RAPIER.EventQueue(true);
    this.ready = true;

    console.log(`[${SIG}·Physics] Rapier WASM initialisé — gravité ${CFG.gravity}`);
    this.k.emit('physics:ready', { sig: SIG });
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════
  // TERRAIN
  // ═══════════════════════════════════════════════════════════════════
  addGround(y = 0, size = 2000) {
    const { RAPIER } = this;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, y, 0);
    const body = this.world.createRigidBody(bodyDesc);
    const col  = RAPIER.ColliderDesc.cuboid(size / 2, 0.1, size / 2);
    this.world.createCollider(col, body);
    this._bodies.set('__ground__', { body, kind: 'ground' });
    return '__ground__';
  }

  addHeightfield(heights, rows, cols, scale = { x: 2000, y: 1, z: 2000 }) {
    const { RAPIER } = this;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed();
    const body = this.world.createRigidBody(bodyDesc);
    const col  = RAPIER.ColliderDesc.heightfield(
      rows, cols, new Float32Array(heights),
      new RAPIER.Vector3(scale.x, scale.y, scale.z)
    );
    this.world.createCollider(col, body);
    this._bodies.set('__terrain__', { body, kind: 'terrain' });
    console.log(`[${SIG}·Physics] Heightfield ${rows}×${cols} monté`);
    return '__terrain__';
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHARACTER CONTROLLER
  // ═══════════════════════════════════════════════════════════════════
  addCharacter(id, pos = { x:0,y:2,z:0 }, opts = {}) {
    const { RAPIER } = this;
    const radius = opts.radius || 0.35;
    const height = opts.height || 1.2;

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(pos.x, pos.y, pos.z);
    const body = this.world.createRigidBody(bodyDesc);

    const colDesc = RAPIER.ColliderDesc.capsule(height / 2, radius);
    const collider = this.world.createCollider(colDesc, body);

    const controller = this.world.createCharacterController(CFG.charOffset);
    controller.enableAutostep(CFG.charAutoStep, 0.3, true);
    controller.enableSnapToGround(CFG.charSnapDist);
    controller.setMaxSlopeClimbAngle(CFG.charMaxSlope);
    controller.setMinSlopeSlideAngle(CFG.charMinSlope);
    controller.setApplyImpulsesToDynamicBodies(true);

    this._characters.set(id, { controller, collider, body, grounded: false, velY: 0 });
    this.stats.bodies++;
    return id;
  }

  moveCharacter(id, desiredMove, dt = CFG.fixedTimeStep) {
    const c = this._characters.get(id);
    if (!c) return null;
    if (!desiredMove) desiredMove = {};
    const { RAPIER } = this;

    c.velY += CFG.gravity * dt;
    if (c.grounded && c.velY < 0) c.velY = -0.5;

    const move = new RAPIER.Vector3(
      desiredMove.x || 0,
      (desiredMove.y || 0) + c.velY * dt,
      desiredMove.z || 0
    );

    c.controller.computeColliderMovement(c.collider, move);
    const corrected = c.controller.computedMovement();
    c.grounded = c.controller.computedGrounded();
    if (c.grounded) c.velY = 0;

    const t = c.body.translation();
    const next = { x: t.x + corrected.x, y: t.y + corrected.y, z: t.z + corrected.z };
    c.body.setNextKinematicTranslation(new RAPIER.Vector3(next.x, next.y, next.z));

    return { pos: next, grounded: c.grounded };
  }

  jumpCharacter(id) {
    const c = this._characters.get(id);
    if (c && c.grounded) { c.velY = CFG.charJumpVel; c.grounded = false; }
  }

  // ═══════════════════════════════════════════════════════════════════
  // VÉHICULES
  // ═══════════════════════════════════════════════════════════════════
  addVehicle(vid, pos = { x:0,y:1,z:0 }, opts = {}) {
    const { RAPIER } = this;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(0.1).setAngularDamping(0.5);
    const chassis = this.world.createRigidBody(bodyDesc);

    const hx = opts.width || 1.0, hy = opts.height || 0.5, hz = opts.length || 2.2;
    const colDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setMass(opts.mass || 1200)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.world.createCollider(colDesc, chassis);

    const controller = this.world.createVehicleController(chassis);

    const wheelPositions = [
      { x: -hx, y: -hy * 0.5, z:  hz * 0.7 },
      { x:  hx, y: -hy * 0.5, z:  hz * 0.7 },
      { x: -hx, y: -hy * 0.5, z: -hz * 0.7 },
      { x:  hx, y: -hy * 0.5, z: -hz * 0.7 },
    ];
    const wheels = [];
    for (let i = 0; i < 4; i++) {
      const wp = wheelPositions[i];
      controller.addWheel(
        new RAPIER.Vector3(wp.x, wp.y, wp.z),
        new RAPIER.Vector3(0, -1, 0),
        new RAPIER.Vector3(-1, 0, 0),
        CFG.suspensionRest,
        CFG.wheelRadius
      );
      controller.setWheelSuspensionStiffness(i, CFG.suspensionStiff);
      controller.setWheelMaxSuspensionTravel(i, CFG.suspensionTravel);
      controller.setWheelFrictionSlip(i, CFG.wheelFriction);
      wheels.push({ index: i, steer: i < 2, drive: i >= 2 });
    }

    this._vehicles.set(vid, { chassis, controller, wheels, throttle: 0, steer: 0, brake: 0 });
    this._bodies.set(vid, { body: chassis, kind: 'vehicle' });
    this.stats.bodies++;
    return vid;
  }

  driveVehicle(vid, throttle, steer, brake = 0) {
    const v = this._vehicles.get(vid);
    if (!v) return;
    v.throttle = Math.max(-1, Math.min(1, throttle));
    v.steer    = Math.max(-1, Math.min(1, steer));
    v.brake    = Math.max(0, Math.min(1, brake));

    for (const w of v.wheels) {
      if (w.drive) v.controller.setWheelEngineForce(w.index, v.throttle * CFG.engineForce);
      if (w.steer) v.controller.setWheelSteering(w.index, v.steer * CFG.maxSteer);
      v.controller.setWheelBrake(w.index, v.brake * CFG.brakeForce);
    }
  }

  getVehicleState(vid) {
    const v = this._vehicles.get(vid);
    if (!v) return null;
    const t = v.chassis.translation();
    const r = v.chassis.rotation();
    let speed = 0;
    try { speed = v.controller.currentVehicleSpeed() || 0; } catch { /* noop */ }
    return {
      pos: { x: t.x, y: t.y, z: t.z },
      rot: { x: r.x, y: r.y, z: r.z, w: r.w },
      speed_kmh: Math.abs(speed) * 3.6,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PROPS
  // ═══════════════════════════════════════════════════════════════════
  addBox(id, pos, size = { x:0.5,y:0.5,z:0.5 }, mass = 10) {
    const { RAPIER } = this;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z)
    );
    const col = RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z).setMass(mass);
    this.world.createCollider(col, body);
    this._bodies.set(id, { body, kind: 'prop' });
    this.stats.bodies++;
    return id;
  }

  getBodyState(id) {
    const b = this._bodies.get(id);
    if (!b || !b.body.translation) return null;
    const t = b.body.translation();
    const r = b.body.rotation();
    return { pos: { x: t.x, y: t.y, z: t.z }, rot: { x: r.x, y: r.y, z: r.z, w: r.w } };
  }

  removeBody(id) {
    const b = this._bodies.get(id);
    if (b?.body) this.world.removeRigidBody(b.body);
    this._bodies.delete(id);
    this._characters.delete(id);
    this._vehicles.delete(id);
  }

  // ═══════════════════════════════════════════════════════════════════
  // ANTI-CHEAT PHYSIQUE
  // ═══════════════════════════════════════════════════════════════════
  validatePosition(id, clientPos) {
    let serverPos = null;
    const b = this._bodies.get(id);
    if (b?.body?.translation) {
      const t = b.body.translation();
      serverPos = { x: t.x, y: t.y, z: t.z };
    } else {
      const c = this._characters.get(id);
      if (c) {
        const t = c.body.translation();
        serverPos = { x: t.x, y: t.y, z: t.z };
      }
    }
    if (!serverPos) return { valid: true };

    const dx = clientPos.x - serverPos.x;
    const dy = clientPos.y - serverPos.y;
    const dz = clientPos.z - serverPos.z;
    const desync = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (desync > CFG.maxDesyncM) {
      this.stats.corrections++;
      this.k.route('intellectus:physics_desync', {
        player_id: id, desync: Math.round(desync * 100) / 100, server_pos: serverPos,
      }, { trusted: true });
      return { valid: false, correctedPos: serverPos, desync };
    }
    return { valid: true, desync };
  }

  // ═══════════════════════════════════════════════════════════════════
  // TICK
  // ═══════════════════════════════════════════════════════════════════
  tick(dt) {
    if (!this.ready) return;

    this._accumulator += dt;
    let steps = 0;
    while (this._accumulator >= CFG.fixedTimeStep && steps < CFG.maxSubSteps) {
      for (const v of this._vehicles.values()) {
        v.controller.updateVehicle(CFG.fixedTimeStep);
      }

      this.world.step(this._eventQueue);
      this._accumulator -= CFG.fixedTimeStep;
      this.stats.steps++;
      steps++;

      this._eventQueue.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        this.stats.collisions++;
        this.k.emit('physics:collision', { h1, h2 });
        for (const [vid, v] of this._vehicles) {
          const ch = v.chassis.handle;
          if (ch === h1 || ch === h2) {
            this.k.route('mech:vehicle_crash', { vehicle_id: vid }, { trusted: true });
          }
        }
      });
    }

    this._syncStates();
  }

  _syncStates() {
    for (const [vid] of this._vehicles) {
      const s = this.getVehicleState(vid);
      if (s) this.k.emit('physics:vehicle_state', { vehicle_id: vid, ...s });
    }
  }

  getStats() { return { ...this.stats, bodies: this._bodies.size, sig: SIG }; }

  dispose() {
    if (this.world) this.world.free?.();
    this._bodies.clear(); this._characters.clear(); this._vehicles.clear();
    this.ready = false;
  }
}

export { SIG, CFG };
export default TroxtPhysics;
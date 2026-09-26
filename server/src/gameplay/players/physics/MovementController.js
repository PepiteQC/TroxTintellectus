// C:\troxt\server\src\admin\components\physics\MovementController.js
import { EventEmitter } from 'events';

export class MovementController extends EventEmitter {
  constructor(kernel, physics) {
    super();
    this.kernel = kernel;
    this.physics = physics;
    
    this.players = new Map();  // playerId → MovementState
    this.inputBuffer = new Map(); // playerId → InputState
    
    this.config = {
      walkSpeed: 3,
      runSpeed: 6,
      sprintSpeed: 9,
      crouchSpeed: 1.5,
      jumpForce: 5,
      swimSpeed: 2,
      climbSpeed: 2.5,
      slideSpeed: 8,
      dodgeSpeed: 12,
      maxStamina: 100,
      sprintStaminaDrain: 15, // par seconde
      staminaRegen: 10,       // par seconde
      crouchHeight: 0.8,
      proneHeight: 0.3,
      standHeight: 1.8,
      slopeLimit: 45,         // degrés
      stepHeight: 0.3
    };
  }

  initialize() {
    this.kernel.bus.on('player:input', (data) => {
      this.handleInput(data.playerId, data.input);
    });

    // Boucle de mouvement
    this._movementInterval = setInterval(() => this._tickMovement(), 1000 / 60);
    
    console.log('[Movement] Controller initialisé');
    return this;
  }

  registerPlayer(playerId) {
    this.players.set(playerId, {
      state: 'idle', // idle, walking, running, sprinting, crouching, prone, jumping, falling, swimming, climbing, sliding, dodging, dead
      speed: 0,
      direction: { x: 0, y: 0, z: 0 },
      lookDirection: { x: 0, y: 0, z: 0 },
      stamina: this.config.maxStamina,
      stance: 'stand', // stand, crouch, prone
      isGrounded: true,
      isSwimming: false,
      isClimbing: false,
      isSliding: false,
      velocity: { x: 0, y: 0, z: 0 },
      lastJump: 0,
      lastDodge: 0,
      slideTimer: 0,
      movementModifiers: {
        speedMultiplier: 1.0,
        jumpMultiplier: 1.0,
        staminaMultiplier: 1.0
      }
    });

    // Créer le corps physique
    this.physics.createPlayerBody(playerId);
    
    this.emit('player:registered', { playerId });
  }

  unregisterPlayer(playerId) {
    this.players.delete(playerId);
    this.inputBuffer.delete(playerId);
    this.emit('player:unregistered', { playerId });
  }

  handleInput(playerId, input) {
    this.inputBuffer.set(playerId, {
      ...input,
      timestamp: Date.now(),
      processed: false
    });
  }

  // ─── MOUVEMENTS SPÉCIAUX ────────────────────────────

  dodge(playerId, direction) {
    const player = this.players.get(playerId);
    if (!player) return false;

    const now = Date.now();
    if (now - player.lastDodge < 1000) return false; // Cooldown 1s
    if (player.stamina < 20) return false;

    player.lastDodge = now;
    player.stamina -= 20;
    player.state = 'dodging';

    // Appliquer la force
    const dodgeDir = {
      x: direction.x * this.config.dodgeSpeed,
      y: 2,
      z: direction.z * this.config.dodgeSpeed
    };

    this.physics.movePlayer(playerId, dodgeDir, 1, 0.2);

    // Reset après 200ms
    setTimeout(() => {
      if (player.state === 'dodging') {
        player.state = 'idle';
      }
    }, 200);

    return true;
  }

  slide(playerId) {
    const player = this.players.get(playerId);
    if (!player) return false;
    if (!player.isGrounded) return false;

    // Doit courir ou sprinter pour slide
    if (player.state !== 'running' && player.state !== 'sprinting') return false;

    player.state = 'sliding';
    player.stance = 'crouch';
    player.slideTimer = Date.now();

    // Effet de slide (physique)
    const forward = player.lookDirection;
    this.physics.movePlayer(playerId, forward, this.config.slideSpeed, 0.5);

    // Durée max du slide
    setTimeout(() => {
      if (player.state === 'sliding') {
        player.state = 'idle';
        player.stance = 'stand';
      }
    }, 1500);

    return true;
  }

  climb(playerId, climbPoint) {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.state = 'climbing';
    player.isClimbing = true;

    // Animer le climb vers le point
    this.physics.setPlayerPosition(playerId, climbPoint);

    setTimeout(() => {
      player.state = 'idle';
      player.isClimbing = false;
    }, 1000);

    return true;
  }

  // ─── TICK DE MOUVEMENT ──────────────────────────────

  _tickMovement() {
    const now = Date.now();

    for (const [playerId, player] of this.players) {
      if (player.state === 'dead') continue;

      const input = this.inputBuffer.get(playerId);
      if (!input || input.processed) continue;

      input.processed = true;

      // Vérifier l'état
      const isGrounded = this.physics._isOnGround(
        this.physics.bodies.get(playerId)
      );

      player.isGrounded = isGrounded;

      // Appliquer les mouvements basés sur l'input
      this._processMovement(playerId, player, input, now);
    }
  }

  _processMovement(playerId, player, input, now) {
    const { forward, backward, left, right, jump, sprint, crouch, prone, dodge, slide } = input;

    // Direction du mouvement
    const moveDir = { x: 0, y: 0, z: 0 };
    if (forward) moveDir.z -= 1;
    if (backward) moveDir.z += 1;
    if (left) moveDir.x -= 1;
    if (right) moveDir.x += 1;

    // Normaliser
    const length = Math.sqrt(moveDir.x**2 + moveDir.z**2);
    if (length > 0) {
      moveDir.x /= length;
      moveDir.z /= length;
    }

    // Regarder dans la direction du regard
    const lookDir = input.lookDirection || { x: 0, y: 0, z: -1 };

    // Déterminer l'état
    let speed = 0;
    let state = 'idle';

    if (length > 0) {
      if (sprint && player.stamina > 0 && player.stance === 'stand') {
        state = 'sprinting';
        speed = this.config.sprintSpeed;
        player.stamina -= this.config.sprintStaminaDrain * (1/60) * (player.movementModifiers.staminaMultiplier || 1);
      } else {
        state = 'running';
        speed = player.stance === 'crouch' ? this.config.crouchSpeed : this.config.runSpeed;
      }
    } else if (player.stance === 'crouch') {
      state = 'crouching';
    } else {
      state = 'idle';
    }

    // Appliquer les modificateurs
    speed *= (player.movementModifiers.speedMultiplier || 1);

    // Stance
    if (crouch) {
      player.stance = player.stance === 'crouch' ? 'stand' : 'crouch';
    }
    if (prone) {
      player.stance = player.stance === 'prone' ? 'stand' : 'prone';
    }

    // Mettre à jour la hauteur du corps
    this._updateBodyHeight(playerId, player);

    // Appliquer le mouvement physique
    if (speed > 0) {
      this.physics.movePlayer(playerId, moveDir, speed, 1/60);
    }

    // Saut
    if (jump && player.isGrounded && now - player.lastJump > 500) {
      player.lastJump = now;
      this.physics.jumpPlayer(playerId, this.config.jumpForce);
      state = 'jumping';
    }

    // Mise à jour de l'état
    player.state = state;
    player.speed = speed;
    player.direction = moveDir;
    player.lookDirection = lookDir;

    // Regen stamina
    if (state !== 'sprinting') {
      player.stamina = Math.min(
        this.config.maxStamina,
        player.stamina + this.config.staminaRegen * (1/60) * (player.movementModifiers.staminaMultiplier || 1)
      );
    }

    // Émettre mise à jour
    this.kernel.bus.emit('player:moving', {
      playerId,
      state,
      speed,
      position: this.physics.getPlayerPosition(playerId),
      direction: moveDir,
      lookDirection: lookDir,
      stance: player.stance,
      stamina: player.stamina
    });
  }

  _updateBodyHeight(playerId, player) {
    const body = this.physics.bodies.get(playerId);
    if (!body) return;

    let targetHeight;
    switch (player.stance) {
      case 'crouch':
        targetHeight = this.config.crouchHeight;
        break;
      case 'prone':
        targetHeight = this.config.proneHeight;
        break;
      default:
        targetHeight = this.config.standHeight;
    }

    // Animer la hauteur
    const currentHeight = body.shapes[0].height || this.config.standHeight;
    const newHeight = currentHeight + (targetHeight - currentHeight) * 0.3;

    // Mettre à jour le shape
    body.removeShape(body.shapes[0]);
    body.addShape(new CANNON.Cylinder(0.3, 0.3, newHeight, 8));
    
    // Ajuster la position Y
    body.position.y += (newHeight - currentHeight) / 2;
  }

  getPlayerState(playerId) {
    return this.players.get(playerId) || null;
  }

  setMovementModifier(playerId, modifier, value) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.movementModifiers[modifier] = value;
  }

  resetMovementModifiers(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.movementModifiers = {
      speedMultiplier: 1.0,
      jumpMultiplier: 1.0,
      staminaMultiplier: 1.0
    };
  }

  destroy() {
    if (this._movementInterval) {
      clearInterval(this._movementInterval);
    }
    this.removeAllListeners();
    this.players.clear();
    this.inputBuffer.clear();
  }
}
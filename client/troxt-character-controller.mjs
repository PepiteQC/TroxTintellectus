/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — CLIENT/TROXT-CHARACTER-CONTROLLER.MJS  v3.0 RP GTA EDITION
 * Contrôleur de personnage jouable — input → animation → physique → réseau
 * ═══════════════════════════════════════════════════════════════════════════════
 * La pièce qui rend le personnage VIVANT côté client :
 *   • Lit les inputs (clavier/manette/touch) : WASD, saut, sprint, viser, tirer
 *   • Pilote l'animation fluide (CharacterAnimator) selon la vitesse réelle
 *   • Applique la physique Rapier locale (prédiction) + réconciliation serveur
 *   • Gère caméra 1ère/3ère personne avec collision, lock-on et shake
 *   • Détecte les interactions monde (portes, véhicules, PNJ, entreprises)
 *   • Gère combat (armes, munitions, dégâts, HP, stamina, cover, furtif)
 *   • Système RP : téléphone, banque, jobs, emotes, arrestation, EMS
 *   • Envoie au serveur (autorité) et applique les corrections
 *
 * Signature : TROXT⬡
 * Chemin    : client/troxt-character-controller.mjs
 *
 * import { CharacterController } from './client/troxt-character-controller.mjs';
 * const ctrl = new CharacterController({ THREE, camera, adapter, animator, client, physics });
 * // boucle : ctrl.update(dt);
 */

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CONFIG ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const CFG = {
  // Mouvement
  walkSpeed:      2.0,
  runSpeed:       5.0,
  sprintSpeed:    8.5,
  crouchSpeed:    1.3,
  stealthSpeed:   1.1,
  swimSpeed:      2.5,
  climbSpeed:     1.8,
  slideBoost:     1.6,
  jumpForce:      5.0,
  gravity:       -9.81,
  rotSpeed:       10,

  // Caméra
  camDistance:    6,
  camHeight:      2.2,
  camLerp:        0.12,
  camFirstPerson: false,
  camShoulder:    0.0,        // -1 gauche, 0 centre, 1 droite
  camShakeDecay:  0.9,
  camMinDist:     1.5,

  // Interaction
  interactRange:  3.0,
  pickupRange:    2.2,
  vehicleRange:   4.0,
  lockOnRange:    25.0,

  // Combat
  maxHealth:      100,
  maxArmor:       100,
  maxStamina:     100,
  staminaDrain:   18,         // par seconde en sprint
  staminaRegen:   12,         // par seconde au repos
  sprintMinStamina: 5,

  // Réseau
  netSendHz:      20,
  netMaxDrift:    1.5,        // distance max avant correction forcée

  // Inclinaisons
  maxSlopeAngle:  Math.PI / 3,
  stepHeight:     0.35,
  wallRunMinSpeed: 6.0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── BINDINGS CLAVIER PAR DÉFAUT ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_BINDINGS = {
  // Mouvement
  forward:  ['KeyW', 'ArrowUp'],
  backward: ['KeyS', 'ArrowDown'],
  left:     ['KeyA', 'ArrowLeft'],
  right:    ['KeyD', 'ArrowRight'],
  jump:     ['Space'],
  sprint:   ['ShiftLeft', 'ShiftRight'],
  crouch:   ['ControlLeft', 'ControlRight'],
  stealth:  ['KeyX'],
  slide:    ['KeyC'],

  // Actions
  interact: ['KeyE'],
  vehicle:  ['KeyF'],
  work:     ['KeyG'],
  reload:   ['KeyR'],
  emote:    ['KeyB'],
  phone:    ['KeyT'],
  atm:      ['KeyY'],
  holster:  ['KeyH'],

  // Combat
  aim:      ['MouseRight'],
  fire:     ['MouseLeft'],
  melee:    ['KeyV'],
  grenade:  ['KeyN'],
  weapon1:  ['Digit1'],
  weapon2:  ['Digit2'],
  weapon3:  ['Digit3'],
  weapon4:  ['Digit4'],
  weaponWheel: ['Tab'],

  // Caméra
  camToggle:  ['KeyV'],  // shift+? à gérer
  camSwitch:  ['KeyQ'],
  lockOn:     ['Tab'],
  zoom:       ['MouseWheel'],

  // Systèmes
  inventory:  ['KeyI'],
  map:        ['KeyM'],
  scoreboard: ['KeyU'],
  menu:       ['Escape'],
  screenshot: ['F12'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DÉFINITIONS D'ARMES (GTA-style) ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const WEAPONS = {
  fists:      { id:'fists',      name:'Poings',           icon:'✊', dmg:8,   range:1.8,  rpm:120, ammo:Infinity, spread:0,    recoil:0.1, melee:true },
  knife:      { id:'knife',      name:'Couteau',          icon:'🗡️', dmg:35,  range:1.6,  rpm:80,  ammo:Infinity, spread:0,    recoil:0.05, melee:true },
  bat:        { id:'bat',        name:'Batte de baseball',icon:'🏏', dmg:22,  range:2.2,  rpm:70,  ammo:Infinity, spread:0,    recoil:0.15, melee:true },
  pistol:     { id:'pistol',     name:'Pistolet',         icon:'🔫', dmg:18,  range:25,   rpm:300, ammo:12,       spread:0.02, recoil:0.3, mag:12, reloadTime:1.8 },
  smg:        { id:'smg',        name:'SMG',              icon:'🔫', dmg:12,  range:20,   rpm:750, ammo:30,       spread:0.05, recoil:0.2, mag:30, reloadTime:2.1 },
  rifle:      { id:'rifle',      name:'Fusil d\'assaut',  icon:'🔫', dmg:28,  range:45,   rpm:600, ammo:30,       spread:0.03, recoil:0.25, mag:30, reloadTime:2.4 },
  shotgun:    { id:'shotgun',    name:'Fusil à pompe',    icon:'🔫', dmg:55,  range:12,   rpm:80,  ammo:6,        spread:0.15, recoil:0.9, mag:6, reloadTime:2.8 },
  sniper:     { id:'sniper',     name:'Sniper',           icon:'🎯', dmg:120, range:150,  rpm:40,  ammo:5,        spread:0.001, recoil:1.5, mag:5, reloadTime:3.2 },
  rpg:        { id:'rpg',        name:'Lance-roquettes',  icon:'💥', dmg:200, range:80,   rpm:30,  ammo:1,        spread:0.02, recoil:2.0, mag:1, reloadTime:4.0, explosive:true },
  grenade:    { id:'grenade',    name:'Grenade',          icon:'💣', dmg:150, range:25,   rpm:60,  ammo:3,        spread:0,    recoil:0.1, explosive:true, throwable:true },
  bow:        { id:'bow',        name:'Arc',              icon:'🏹', dmg:45,  range:60,   rpm:50,  ammo:12,       spread:0.01, recoil:0.2, mag:1, reloadTime:1.5 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── EMOTES DISPONIBLES ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const EMOTES = [
  'wave','dance','flex','bow','threaten','sit','point','salute',
  'meditate','smoke','drink','selfie','guitar','pushup','clap',
  'laugh','cry','taunt','facepalm','thumbsup','peace','middlefinger',
  'stop','come','facepalm','shrug','micdrop','surrender','faint','sleep',
];

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
//  CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
export class CharacterController {
  constructor({ THREE, camera, adapter, animator, client, physics = null, objectId = 'player_local', bindings = {}, config = {} } = {}) {
    if (!THREE) throw new Error('THREE requis');
    this.THREE    = THREE;
    this.camera   = camera;
    this.adapter  = adapter;      // engine-adapter (déplace le mesh)
    this.animator = animator;     // CharacterAnimator
    this.client   = client;       // TroxtClient WebSocket
    this.physics  = physics;      // TroxtPhysics local (optionnel)
    this.objectId = objectId;
    this.sig      = SIG;

    // Config fusionnée
    this.CFG = { ...CFG, ...config };
    this.bindings = { ...DEFAULT_BINDINGS, ...bindings };

    // ── État mouvement ──
    this.pos = new THREE.Vector3(0, 0, 0);
    this.rot = 0;                 // yaw (radians)
    this.vel = new THREE.Vector3();
    this.grounded = true;
    this.crouching = false;
    this.stealthing = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.wallRunning = false;
    this.wallRunTimer = 0;
    this.climbing = false;
    this.swimming = false;
    this.inVehicle = null;        // id du véhicule si embarqué
    this.vehicleSeat = 0;         // siège dans le véhicule
    this.currentJob = null;
    this.working = false;

    // ── État combat ──
    this.aiming = false;
    this.firing = false;
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.health = this.CFG.maxHealth;
    this.armor = 0;
    this.stamina = this.CFG.maxStamina;
    this.currentWeapon = 'fists';
    this.weaponInventory = ['fists','pistol']; // armes possédées
    this.weaponAmmo = { pistol: 48, smg: 90, rifle: 90, shotgun: 24, sniper: 15, rpg: 3, grenade: 3, bow: 24 };
    this.lockOnTarget = null;
    this.dead = false;
    this.deadTimer = 0;
    this.holstered = false;

    // ── État RP ──
    this.phoneOpen = false;
    this.atmOpen = false;
    this.wantedLevel = 0;         // 0-5 étoiles (sync serveur)
    this.cash = 500;
    this.bank = 2500;
    this.currentEmote = null;
    this.emoteTimer = 0;

    // ── Input ──
    this.input = {
      fwd: 0, right: 0, jump: false, sprint: false, crouch: false,
      aim: false, fire: false, stealth: false, slide: false,
      melee: false, grenade: false,
      axisX: 0, axisY: 0, axisLookX: 0, axisLookY: 0,   // manette
      touchMove: { x: 0, y: 0 }, touchLook: { x: 0, y: 0 },
    };
    this._keys = new Set();
    this._keyPressedThisFrame = new Set();
    this._gamepadIndex = null;

    // ── Caméra ──
    this._camTarget = new THREE.Vector3();
    this._camShake = { intensity: 0, time: 0 };
    this._mouseX = 0; this._mouseY = 0;
    this._mouseLocked = false;
    this._zoomTarget = this.CFG.camDistance;
    this._zoomCurrent = this.CFG.camDistance;

    // ── Interactions ──
    this._interactables = [];
    this._nearestInteract = null;
    this._interactPromptShown = false;
    this._pickupsInRange = [];

    // ── Réseau ──
    this._netAccum = 0;
    this._lastServerPos = new THREE.Vector3();
    this._lastServerRot = 0;
    this._serverTick = 0;
    this._ping = 0;
    this._lastPingSent = 0;

    // ── Audio hooks (à brancher) ──
    this.onSound = null;          // (name, opts) => play
    this.onPrompt = null;         // (interact | null) => afficher UI
    this.onHUDUpdate = null;      // ({ health, armor, stamina, ammo, weapon, cash }) => ...
    this.onDamage = null;         // (amount, type, from) => ...
    this.onKill = null;           // (victim) => ...
    this.onDeath = null;          // () => ...
    this.onRespawn = null;
    this.onPhoneOpen = null;
    this.onATMOpen = null;
    this.onVehicleEnter = null;
    this.onVehicleExit = null;
    this.onWantedLevelChange = null;
    this.onEmoteChange = null;
    this.onWeaponChange = null;
    this.onAmmoChange = null;
    this.onStaminaChange = null;
    this.onHealthChange = null;

    this._bindInput();
    this._bindGamepad();
    this._bindTouch();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT — CLAVIER / SOURIS
  // ═══════════════════════════════════════════════════════════════════════════
  _bindInput() {
    if (typeof window === 'undefined') return;

    this._onKeyDown = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      this._keys.add(e.code);
      this._keyPressedThisFrame.add(e.code);
      // Empêche le scroll
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => this._keys.delete(e.code);

    this._onMouseDown = (e) => {
      if (e.button === 2) this.aiming = true;
      if (e.button === 0) {
        if (this.aiming || !this.holstered) this._fire();
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 2) this.aiming = false;
      if (e.button === 0) this.firing = false;
    };

    this._onMouseMove = (e) => {
      if (!this._mouseLocked) return;
      this._mouseX -= e.movementX * 0.002;
      this._mouseY = Math.max(-0.8, Math.min(0.8, this._mouseY - e.movementY * 0.002));
    };

    this._onWheel = (e) => {
      this._zoomTarget = Math.max(this.CFG.camMinDist, Math.min(12, this._zoomTarget + e.deltaY * 0.005));
    };

    this._onPointerLockChange = () => {
      this._mouseLocked = document.pointerLockElement === document.body;
    };

    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup',   this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('wheel',     this._onWheel, { passive: true });
    window.addEventListener('contextmenu', this._onContextMenu);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT — MANETTE
  // ═══════════════════════════════════════════════════════════════════════════
  _bindGamepad() {
    if (typeof window === 'undefined') return;
    window.addEventListener('gamepadconnected', (e) => {
      this._gamepadIndex = e.gamepad.index;
      console.log(`[${SIG}] 🎮 Manette connectée: ${e.gamepad.id}`);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this._gamepadIndex = null;
    });
  }

  _readGamepad() {
    if (this._gamepadIndex === null || typeof navigator === 'undefined') return;
    const gp = navigator.getGamepads?.()[this._gamepadIndex];
    if (!gp) return;

    // Deadzone
    const dz = (v) => Math.abs(v) < 0.15 ? 0 : v;

    // Stick gauche → mouvement
    this.input.axisX = dz(gp.axes[0]);
    this.input.axisY = dz(gp.axes[1]);

    // Stick droit → caméra
    this.input.axisLookX = dz(gp.axes[2]);
    this.input.axisLookY = dz(gp.axes[3]);

    // Boutons
    this.input.jump   = gp.buttons[0]?.pressed; // A
    this.input.fire   = gp.buttons[7]?.pressed; // RT
    this.input.aim    = gp.buttons[6]?.pressed; // LT
    this.input.sprint = gp.buttons[10]?.pressed; // L3
    this.input.crouch = gp.buttons[11]?.pressed; // R3
    this.input.reload = gp.buttons[2]?.pressed;  // X

    // Rotation caméra par stick droit
    if (this.input.axisLookX || this.input.axisLookY) {
      this._mouseX -= this.input.axisLookX * 0.04;
      this._mouseY = Math.max(-0.8, Math.min(0.8, this._mouseY - this.input.axisLookY * 0.04));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT — TOUCH (mobile)
  // ═══════════════════════════════════════════════════════════════════════════
  _bindTouch() {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return;
    // Interface à brancher par ton UI (joysticks virtuels)
    // On expose juste les méthodes publiques : setTouchMove(x,y), setTouchLook(x,y)
  }

  // API publique pour l'UI mobile
  setTouchMove(x, y) { this.input.touchMove.x = x; this.input.touchMove.y = y; }
  setTouchLook(x, y) { this.input.touchLook.x = x; this.input.touchLook.y = y; }
  setTouchFire(f)    { if (f) this._fire(); }
  setTouchAim(a)     { this.aiming = a; }
  setTouchJump()     { if (this.grounded) this._doJump(); }
  setTouchSprint(s)  { this.input.sprint = s; }

  // ═══════════════════════════════════════════════════════════════════════════
  // LECTURE DES INPUTS
  // ═══════════════════════════════════════════════════════════════════════════
  _isPressed(action) {
    const keys = this.bindings[action];
    if (!keys) return false;
    for (const k of keys) {
      if (k.startsWith('Mouse')) {
        if (k === 'MouseLeft'  && this._mouseDownL) return true;
        if (k === 'MouseRight' && this.aiming)     return true;
      } else if (this._keys.has(k)) {
        return true;
      }
    }
    return false;
  }

  _isJustPressed(action) {
    const keys = this.bindings[action];
    if (!keys) return false;
    for (const k of keys) {
      if (this._keyPressedThisFrame.has(k)) return true;
    }
    return false;
  }

  _readInput() {
    const k = this._keys;

    // Mouvement clavier
    const kFwd    = (k.has('KeyW') || k.has('ArrowUp'))    ? 1 : 0;
    const kBack   = (k.has('KeyS') || k.has('ArrowDown'))  ? 1 : 0;
    const kRight  = (k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0;
    const kLeft   = (k.has('KeyA') || k.has('ArrowLeft'))  ? 1 : 0;

    // Manette
    this._readGamepad();
    const gpX = this.input.axisX;
    const gpY = -this.input.axisY; // inverser (stick up = -1)

    // Touch
    const tx = this.input.touchMove.x;
    const ty = this.input.touchMove.y;

    // Fusion (clavier prioritaire si non-zero, sinon manette, sinon touch)
    let fwd = kFwd - kBack;
    let right = kRight - kLeft;
    if (fwd === 0 && right === 0) {
      if (Math.abs(gpX) > 0.1 || Math.abs(gpY) > 0.1) {
        right = gpX; fwd = gpY;
      } else if (Math.abs(tx) > 0.1 || Math.abs(ty) > 0.1) {
        right = tx; fwd = ty;
      }
    }

    // Normalise pour diagonale
    const mag = Math.hypot(fwd, right);
    if (mag > 1) { fwd /= mag; right /= mag; }

    this.input.fwd   = fwd;
    this.input.right = right;
    this.input.jump   = k.has('Space')   || this.input.jump;
    this.input.sprint = (k.has('ShiftLeft') || k.has('ShiftRight')) || this.input.sprint;
    this.input.crouch = (k.has('ControlLeft') || k.has('ControlRight')) || this.input.crouch;
    this.input.stealth = k.has('KeyX');
    this.input.slide   = k.has('KeyC');

    // ── Actions (uniquement "just pressed") ──
    if (this._isJustPressed('interact')) { this._tryInteract(); this._keyPressedThisFrame.delete('KeyE'); }
    if (this._isJustPressed('vehicle'))  { this._toggleVehicle(); this._keyPressedThisFrame.delete('KeyF'); }
    if (this._isJustPressed('work'))     { this._toggleWork(); this._keyPressedThisFrame.delete('KeyG'); }
    if (this._isJustPressed('reload'))   { this._reload(); }
    if (this._isJustPressed('emote'))    { this._openEmoteWheel(); }
    if (this._isJustPressed('phone'))    { this._togglePhone(); }
    if (this._isJustPressed('atm'))      { this._toggleATM(); }
    if (this._isJustPressed('holster'))  { this._toggleHolster(); }
    if (this._isJustPressed('melee'))    { this._melee(); }
    if (this._isJustPressed('grenade'))  { this._throwGrenade(); }
    if (this._isJustPressed('camSwitch')) { this._switchShoulder(); }

    // Armes 1-4
    if (this._isJustPressed('weapon1')) this._equipWeaponSlot(1);
    if (this._isJustPressed('weapon2')) this._equipWeaponSlot(2);
    if (this._isJustPressed('weapon3')) this._equipWeaponSlot(3);
    if (this._isJustPressed('weapon4')) this._equipWeaponSlot(4);

    // Visée / tir continu
    if (this.aiming || this.input.aim) this.aiming = true;
    if (this.input.fire && !this.firing) { this.firing = true; this._fire(); }

    // Reset "just pressed"
    this._keyPressedThisFrame.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE — la boucle principale du personnage
  // ═══════════════════════════════════════════════════════════════════════════
  update(dt) {
    // Clamp dt pour stabilité (lag spike)
    dt = Math.min(dt, 0.05);

    if (this.dead) {
      this.deadTimer += dt;
      if (this.deadTimer > 5) this.respawn();
      this._updateCamera(dt);
      return;
    }

    this._readInput();

    // Cooldowns
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.reloading = false; this._finishReload(); }
    }
    if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) { this.currentEmote = null; this.onEmoteChange?.(null); }
    }

    // Stamina
    this._updateStamina(dt);

    // État
    this.stealthing = this.input.stealth && !this.crouching;
    if (this.input.slide && !this.sliding && this.grounded &&
        Math.hypot(this.vel.x, this.vel.z) > this.CFG.runSpeed * 0.9) {
      this._startSlide();
    }
    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.sliding = false;
    }

    if (this.inVehicle) {
      this._updateVehicle(dt);
    } else if (this.swimming) {
      this._updateSwimming(dt);
    } else if (this.climbing) {
      this._updateClimbing(dt);
    } else {
      this._updateOnFoot(dt);
    }

    this._updateLockOn(dt);
    this._updateCamera(dt);
    this._updateAnimation(dt);
    this._updateInteractPrompt();
    this._updatePickups();
    this._sendToServer(dt);
    this._updatePing(dt);

    // HUD update (throttle à 10 Hz)
    if (!this._hudAccum) this._hudAccum = 0;
    this._hudAccum += dt;
    if (this._hudAccum > 0.1) {
      this._hudAccum = 0;
      this._emitHUD();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUVEMENT À PIED (version enrichie — conserve la logique originale)
  // ═══════════════════════════════════════════════════════════════════════════
  _updateOnFoot(dt) {
    const { THREE } = this;
    this.crouching = this.input.crouch;

    // Vitesse cible
    let maxSpeed = this.CFG.walkSpeed;
    if (this.crouching)        maxSpeed = this.CFG.crouchSpeed;
    else if (this.stealthing)  maxSpeed = this.CFG.stealthSpeed;
    else if (this.sliding)     maxSpeed = this.CFG.sprintSpeed * this.CFG.slideBoost;
    else if (this.input.sprint && this.input.fwd > 0 && this.stamina > this.CFG.sprintMinStamina) {
      maxSpeed = this.CFG.sprintSpeed;
    }
    else if (this.input.fwd !== 0 || this.input.right !== 0) maxSpeed = this.CFG.runSpeed;

    if (this.aiming) maxSpeed *= 0.55;

    // Direction dans le repère caméra
    const camYaw = this._getCameraYaw();
    const moveX = this.input.right, moveZ = this.input.fwd;
    const len = Math.hypot(moveX, moveZ);

    if (len > 0) {
      const worldAngle = camYaw + Math.atan2(moveX, moveZ);
      this.vel.x = Math.sin(worldAngle) * maxSpeed;
      this.vel.z = Math.cos(worldAngle) * maxSpeed;

      // Rotation fluide du perso
      const targetRot = this.aiming ? camYaw : worldAngle;
      this.rot = this._lerpAngle(this.rot, targetRot, this.CFG.rotSpeed * dt);
    } else {
      // Friction
      const friction = this.grounded ? 0.8 : 0.98;
      this.vel.x *= friction;
      this.vel.z *= friction;
      if (this.aiming) this.rot = this._lerpAngle(this.rot, camYaw, this.CFG.rotSpeed * dt);
    }

    // Saut
    if (this.input.jump && this.grounded) {
      this._doJump();
    }

    // Physique locale via Rapier
    if (this.physics) {
      const result = this.physics.moveCharacter(this.objectId, {
        x: this.vel.x * dt, y: 0, z: this.vel.z * dt,
      }, dt);
      if (result) {
        this.pos.set(result.pos.x, result.pos.y, result.pos.z);
        const wasGrounded = this.grounded;
        this.grounded = result.grounded;
        if (!wasGrounded && this.grounded) {
          this.animator?.land?.(this.vel.y < -8);
          this.onSound?.('land', { hard: this.vel.y < -8 });
          this._camShake.intensity = Math.min(0.5, Math.abs(this.vel.y) * 0.03);
        }
      }
    } else {
      // Intégration simple
      this.vel.y += this.CFG.gravity * dt;
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vel.y = 0;
        if (!this.grounded) {
          this.animator?.land?.();
          this.onSound?.('land');
        }
        this.grounded = true;
      }
    }

    // Applique au mesh
    this.adapter?.move(this.objectId, this.pos, { x: 0, y: this.rot, z: 0 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUVEMENT — NATATION
  // ═══════════════════════════════════════════════════════════════════════════
  _updateSwimming(dt) {
    const { THREE } = this;
    const camYaw = this._getCameraYaw();
    const moveX = this.input.right, moveZ = this.input.fwd;
    const len = Math.hypot(moveX, moveZ);

    if (len > 0) {
      const worldAngle = camYaw + Math.atan2(moveX, moveZ);
      this.vel.x = Math.sin(worldAngle) * this.CFG.swimSpeed;
      this.vel.z = Math.cos(worldAngle) * this.CFG.swimSpeed;
      this.rot = this._lerpAngle(this.rot, worldAngle, this.CFG.rotSpeed * dt);
    } else {
      this.vel.x *= 0.9; this.vel.z *= 0.9;
    }

    // Flottaison + plongée
    const targetY = this._waterLevel + 0.2;
    this.vel.y = (targetY - this.pos.y) * 3 - (this.input.jump ? 2 : 0);

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    this.adapter?.move(this.objectId, this.pos, { x: 0, y: this.rot, z: 0 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUVEMENT — ESCALADE
  // ═══════════════════════════════════════════════════════════════════════════
  _updateClimbing(dt) {
    this.vel.x = 0; this.vel.z = 0;
    this.vel.y = this.input.fwd * this.CFG.climbSpeed;
    this.pos.y += this.vel.y * dt;
    // Fin d'escalade si sol atteint
    if (this.pos.y <= 0) {
      this.climbing = false;
      this.pos.y = 0;
    }
    this.adapter?.move(this.objectId, this.pos, { x: 0, y: this.rot, z: 0 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLISSADE (slide)
  // ═══════════════════════════════════════════════════════════════════════════
  _startSlide() {
    this.sliding = true;
    this.slideTimer = 0.9;
    this.onSound?.('slide');
    this.animator?.slide?.();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAUT
  // ═══════════════════════════════════════════════════════════════════════════
  _doJump() {
    this.vel.y = this.CFG.jumpForce;
    this.grounded = false;
    this.animator?.jump?.();
    this.client?._send?.('JUMP', {});
    this.onSound?.('jump');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VÉHICULE
  // ═══════════════════════════════════════════════════════════════════════════
  _updateVehicle(dt) {
    const v = this.inVehicle;
    const throttle = this.input.fwd;
    const steer = -this.input.right;
    const brake = this._keys.has('Space') ? 1 : 0;
    const horn = this._isJustPressed('interact') ? 1 : 0;
    const handbrake = this._keys.has('ShiftLeft') ? 1 : 0;

    this.client?._send?.('DRIVE', {
      vehicle_id: v,
      seat: this.vehicleSeat,
      throttle, steer, brake, handbrake, horn,
    });
    this.animator?.driveVehicle?.(steer, throttle);
    if (horn) this.onSound?.('car_horn');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT — TIR
  // ═══════════════════════════════════════════════════════════════════════════
  _fire() {
    if (this.reloading || this.dead) return;
    const w = WEAPONS[this.currentWeapon];
    if (!w) return;

    // Cooldown cadence
    const minInterval = 60 / w.rpm;
    if (this.fireCooldown > 0) return;
    this.fireCooldown = minInterval;

    // Munitions
    if (!w.melee && !w.throwable) {
      if ((this.weaponAmmo[w.id] ?? 0) <= 0) {
        this.onSound?.('empty_click');
        return;
      }
      this.weaponAmmo[w.id] -= 1;
      this.onAmmoChange?.(w.id, this.weaponAmmo[w.id]);
    }

    // Recul caméra
    this._camShake.intensity = Math.min(0.6, this._camShake.intensity + w.recoil * 0.15);

    // Animation
    this.animator?.fire?.();
    this.onSound?.(`fire_${w.id}`);

    // Raycast (côté client, prédictif)
    const hit = this._raycastShot(w.range, w.spread);
    if (hit) {
      // Serveur valide les dégâts (anti-cheat)
      this.client?._send?.('ATTACK', {
        weapon: w.id,
        target_id: hit.objectId,
        hit_pos: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
        dmg: w.dmg,
      });
      // Feedback local
      this.onDamage?.(w.dmg, 'bullet', hit.objectId);
    } else {
      this.client?._send?.('ATTACK', { weapon: w.id, miss: true });
    }
  }

  _raycastShot(range, spread) {
    // Utilise THREE.Raycaster
    // À brancher : this.physics?.raycast(...) OU un spatial index
    if (!this.physics?.raycast) return null;
    const origin = this.pos.clone().add(new this.THREE.Vector3(0, 1.5, 0));
    const dir = new this.THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // Spread
    if (spread > 0) {
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
    }
    return this.physics.raycast(origin, dir, range);
  }

  _melee() {
    this.currentWeapon = 'fists';
    this.animator?.punch?.();
    this._camShake.intensity = 0.15;
    this.onSound?.('punch');
    this.client?._send?.('ATTACK', { weapon: 'fists', melee: true });
  }

  _throwGrenade() {
    if ((this.weaponAmmo.grenade ?? 0) <= 0) return;
    this.weaponAmmo.grenade -= 1;
    this.animator?.throwItem?.();
    this.onSound?.('throw');
    this.client?._send?.('ATTACK', { weapon: 'grenade', throwable: true });
    this.onAmmoChange?.('grenade', this.weaponAmmo.grenade);
  }

  _reload() {
    const w = WEAPONS[this.currentWeapon];
    if (!w || w.melee || this.reloading) return;
    const current = this.weaponAmmo[w.id] ?? 0;
    if (current >= w.mag) return;
    this.reloading = true;
    this.reloadTimer = w.reloadTime;
    this.animator?.reload?.();
    this.onSound?.(`reload_${w.id}`);
  }

  _finishReload() {
    const w = WEAPONS[this.currentWeapon];
    if (!w) return;
    this.weaponAmmo[w.id] = w.mag;
    this.onAmmoChange?.(w.id, this.weaponAmmo[w.id]);
  }

  _equipWeaponSlot(slot) {
    // Armes dans l'inventaire par slot
    const list = this.weaponInventory;
    const idx = slot - 1;
    if (idx >= 0 && idx < list.length) {
      this._equipWeapon(list[idx]);
    }
  }

  _equipWeapon(id) {
    if (!WEAPONS[id]) return;
    if (!this.weaponInventory.includes(id)) return;
    this.currentWeapon = id;
    this.reloading = false;
    this.holstered = false;
    this.onWeaponChange?.(WEAPONS[id]);
    this.animator?.equipWeapon?.(id);
    this.onSound?.(`equip_${id}`);
  }

  _toggleHolster() {
    this.holstered = !this.holstered;
    this.animator?.holster?.(this.holstered);
  }

  _openWeaponWheel() {
    // UI affiche la roue
    // this.onWeaponWheelOpen?.();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DÉGÂTS / VIE
  // ═══════════════════════════════════════════════════════════════════════════
  takeDamage(amount, type = 'generic', from = null) {
    if (this.dead) return;
    // Absorption armure (50%)
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.5);
      this.armor -= absorbed;
      remaining = amount - absorbed;
    }
    this.health -= remaining;
    this._camShake.intensity += 0.3;
    this.onDamage?.(amount, type, from);
    this.onSound?.('hit');
    this.onHealthChange?.(this.health, this.armor);
    if (this.health <= 0) {
      this.health = 0;
      this._die();
    }
  }

  heal(amount) {
    this.health = Math.min(this.CFG.maxHealth, this.health + amount);
    this.onHealthChange?.(this.health, this.armor);
  }

  addArmor(amount) {
    this.armor = Math.min(this.CFG.maxArmor, this.armor + amount);
    this.onHealthChange?.(this.health, this.armor);
  }

  _die() {
    this.dead = true;
    this.deadTimer = 0;
    this.animator?.die?.();
    this.client?._send?.('DEATH', {});
    this.onDeath?.();
  }

  respawn() {
    this.dead = false;
    this.deadTimer = 0;
    this.health = this.CFG.maxHealth;
    this.armor = 0;
    this.stamina = this.CFG.maxStamina;
    this.vel.set(0, 0, 0);
    this.onRespawn?.();
    this.onHealthChange?.(this.health, this.armor);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAMINA
  // ═══════════════════════════════════════════════════════════════════════════
  _updateStamina(dt) {
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.5;
    const sprinting = this.input.sprint && moving && this.input.fwd > 0 && !this.crouching;
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - this.CFG.staminaDrain * dt);
    } else {
      this.stamina = Math.min(this.CFG.maxStamina, this.stamina + this.CFG.staminaRegen * dt);
    }
    if (this._lastStamina !== Math.floor(this.stamina)) {
      this._lastStamina = Math.floor(this.stamina);
      this.onStaminaChange?.(this.stamina);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCK-ON
  // ═══════════════════════════════════════════════════════════════════════════
  _updateLockOn(dt) {
    if (!this._isLockOnHeld()) { this.lockOnTarget = null; return; }
    // Cherche la cible la plus proche dans le cône caméra
    if (!this._potentialTargets) return;
    let best = null, bestScore = -Infinity;
    const camDir = new this.THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    for (const t of this._potentialTargets) {
      const toT = new this.THREE.Vector3(t.pos.x - this.pos.x, 0, t.pos.z - this.pos.z);
      const dist = toT.length();
      if (dist > this.CFG.lockOnRange) continue;
      toT.normalize();
      const dot = toT.dot(camDir);
      if (dot < 0.5) continue;
      const score = dot * 100 - dist;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    this.lockOnTarget = best;
    if (best) {
      const targetYaw = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
      this.rot = this._lerpAngle(this.rot, targetYaw, 5 * dt);
    }
  }

  _isLockOnHeld() { return this._keys.has('Tab'); }

  setPotentialTargets(list) { this._potentialTargets = list; }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMÉRA — 1ère/3ère personne, shoulder, collision, shake
  // ═══════════════════════════════════════════════════════════════════════════
  _updateCamera(dt) {
    if (!this.camera) return;
    const { THREE } = this;

    // Smooth zoom
    this._zoomCurrent += (this._zoomTarget - this._zoomCurrent) * 0.15;

    // Shake decay
    this._camShake.intensity *= this.CFG.camShakeDecay;

    // FPS mode : directement sur les yeux
    if (this.CFG.camFirstPerson) {
      const eyeY = this.pos.y + 1.65;
      this.camera.position.set(this.pos.x, eyeY, this.pos.z);
      const yaw = this._mouseX;
      const pitch = this._mouseY;
      const dir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch)
      );
      this.camera.lookAt(this.pos.x + dir.x, eyeY + dir.y, this.pos.z + dir.z);
      return;
    }

    // 3e personne
    const dist = this.aiming ? this._zoomCurrent * 0.6 : this._zoomCurrent;
    const behind = new THREE.Vector3(
      Math.sin(this.rot + Math.PI) * dist,
      this.CFG.camHeight,
      Math.cos(this.rot + Math.PI) * dist
    );

    // Shoulder offset
    const right = new THREE.Vector3(Math.cos(this.rot), 0, -Math.sin(this.rot));
    behind.add(right.multiplyScalar(this.CFG.camShoulder * 0.8));

    this._camTarget.copy(this.pos).add(behind);

    // Collision : raycast depuis le joueur vers la caméra
    if (this.physics?.raycast) {
      const origin = this.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
      const toCam = this._camTarget.clone().sub(origin);
      const dist2 = toCam.length();
      toCam.normalize();
      const hit = this.physics.raycast(origin, toCam, dist2);
      if (hit && hit.dist < dist2) {
        this._camTarget.copy(origin).add(toCam.multiplyScalar(hit.dist * 0.9));
      }
    }

    // Shake
    if (this._camShake.intensity > 0.01) {
      this._camShake.time += dt * 30;
      const s = this._camShake.intensity;
      this._camTarget.x += Math.sin(this._camShake.time * 1.3) * s * 0.1;
      this._camTarget.y += Math.cos(this._camShake.time * 1.7) * s * 0.1;
    }

    this.camera.position.lerp(this._camTarget, this.CFG.camLerp);
    this.camera.lookAt(this.pos.x, this.pos.y + 1.5, this.pos.z);
  }

  _switchShoulder() {
    // Cycle : centre → droite → gauche → centre
    if (this.CFG.camShoulder === 0) this.CFG.camShoulder = 1;
    else if (this.CFG.camShoulder === 1) this.CFG.camShoulder = -1;
    else this.CFG.camShoulder = 0;
    this.onSound?.('cam_switch');
  }

  toggleFirstPerson() {
    this.CFG.camFirstPerson = !this.CFG.camFirstPerson;
    this.animator?.setFirstPerson?.(this.CFG.camFirstPerson);
  }

  _getCameraYaw() {
    if (!this.camera) return this.rot;
    if (this.CFG.camFirstPerson) return this._mouseX;
    const dir = new this.THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return Math.atan2(dir.x, dir.z);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION
  // ═══════════════════════════════════════════════════════════════════════════
  _updateAnimation(dt) {
    if (!this.animator) return;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const moveAngle = Math.atan2(this.vel.x, this.vel.z);
    const relDir = this._angleDiff(moveAngle, this.rot);

    this.animator.setLocomotion?.(speed, relDir, this.grounded, {
      velocityY: this.vel.y,
      crouching: this.crouching,
      stealthing: this.stealthing,
      sliding: this.sliding,
      swimming: this.swimming,
      climbing: this.climbing,
      aiming: this.aiming,
      inVehicle: !!this.inVehicle,
      weapon: this.currentWeapon,
      holstered: this.holstered,
      dead: this.dead,
    });

    if (this.aiming) {
      const dir = new this.THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const aimTarget = this.pos.clone().add(dir.multiplyScalar(20));
      this.animator.setAiming?.(true, aimTarget);
    } else {
      this.animator.setAiming?.(false);
    }

    this.animator.tick?.(dt);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERACTIONS MONDE (conservé + étendu)
  // ═══════════════════════════════════════════════════════════════════════════
  registerInteractables(list) {
    this._interactables = list || [];
  }

  _updateInteractPrompt() {
    if (!this._interactables) return;
    let nearest = null, bestD = this.CFG.interactRange;
    for (const it of this._interactables) {
      if (!it.pos) continue;
      const d = Math.hypot(it.pos.x - this.pos.x, it.pos.z - this.pos.z);
      if (d < bestD) { bestD = d; nearest = it; }
    }
    if (nearest !== this._nearestInteract) {
      this._nearestInteract = nearest;
      this.onPrompt?.(nearest ? { ...nearest, key: this._promptKey(nearest.type) } : null);
    }
  }

  _updatePickups() {
    // Ramassage automatique des items proches (argent, munitions)
    if (!this._pickupsInRange?.length) return;
    for (const p of this._pickupsInRange) {
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (d < this.CFG.pickupRange) {
        this.client?._send?.('INTERACT', { target_type: 'pickup', target_id: p.id });
      }
    }
    this._pickupsInRange = [];
  }

  _promptKey(type) {
    return {
      door:      'E',
      vehicle:   'F',
      business:  'G',
      npc:       'E',
      pickup:    'E',
      atm:       'Y',
      shop:      'E',
      house:     'E',
      job:       'G',
      loot:      'E',
      revive:    'E',
      arrest:    'E',
    }[type] || 'E';
  }

  _tryInteract() {
    const it = this._nearestInteract;
    if (!it) return;
    switch (it.type) {
      case 'door':
        this.animator?.openDoor?.();
        this.client?._send?.('DOOR', { uid: it.id, action: 'toggle' });
        this.onSound?.('door');
        break;
      case 'pickup':
        this.animator?.pickup?.();
        this.client?._send?.('INTERACT', { target_type: 'pickup', target_id: it.id });
        break;
      case 'npc':
      case 'business':
      case 'shop':
      case 'house':
      case 'job':
        this.animator?.interact?.();
        this.client?._send?.('INTERACT', { target_type: it.type, target_id: it.id });
        break;
      case 'atm':
        this._toggleATM();
        break;
      case 'revive':
        this.client?._send?.('RP_ACTION', { action: 'REVIVE', target_id: it.id });
        this.animator?.kneel?.();
        break;
      case 'arrest':
        this.client?._send?.('RP_ACTION', { action: 'ARREST', target_id: it.id });
        this.animator?.cuff?.();
        break;
      case 'loot':
        this.client?._send?.('INTERACT', { target_type: 'loot', target_id: it.id });
        break;
    }
  }

  _toggleVehicle() {
    if (this.inVehicle) {
      this.client?._send?.('INTERACT', { target_type: 'vehicle', target_id: this.inVehicle, action: 'exit' });
      this.animator?.exitVehicle?.();
      this.onVehicleExit?.(this.inVehicle);
      this.inVehicle = null;
      this.vehicleSeat = 0;
    } else {
      const it = this._nearestInteract;
      if (it?.type === 'vehicle') {
        this.client?._send?.('INTERACT', {
          target_type: 'vehicle',
          target_id: it.id,
          action: 'enter',
          seat: it.seat ?? 0,
        });
        this.animator?.enterVehicle?.();
        this.onVehicleEnter?.(it.id);
        this.inVehicle = it.id;
        this.vehicleSeat = it.seat ?? 0;
      }
    }
  }

  _toggleWork() {
    const it = this._nearestInteract;
    if (this.working) {
      this.working = false;
      this.animator?.stopWork?.();
      this.client?._send?.('RP_ACTION', { action: 'STOP_WORK' });
    } else if (it?.type === 'business' || it?.type === 'job') {
      this.working = true;
      this.currentJob = it.job || 'livreur';
      this.animator?.work?.(this.currentJob);
      this.client?._send?.('RP_ACTION', { action: 'WORK', job: this.currentJob });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RP — TÉLÉPHONE / ATM / EMOTES
  // ═══════════════════════════════════════════════════════════════════════════
  _togglePhone() {
    this.phoneOpen = !this.phoneOpen;
    this.animator?.phonePose?.(this.phoneOpen);
    this.onPhoneOpen?.(this.phoneOpen);
    if (this.phoneOpen) this._openPhoneUI?.();
  }

  _toggleATM() {
    // Nécessite d'être proche d'un ATM
    const it = this._nearestInteract;
    if (!this.atmOpen && it?.type !== 'atm') return;
    this.atmOpen = !this.atmOpen;
    this.animator?.atmPose?.(this.atmOpen);
    this.onATMOpen?.(this.atmOpen);
    if (this.atmOpen) this._openATMUI?.();
  }

  deposit(amount) {
    if (amount <= 0 || amount > this.cash) return false;
    this.cash -= amount;
    this.bank += amount;
    this.client?._send?.('BANK', { action: 'DEPOSIT', amount });
    return true;
  }

  withdraw(amount) {
    if (amount <= 0 || amount > this.bank) return false;
    this.bank -= amount;
    this.cash += amount;
    this.client?._send?.('BANK', { action: 'WITHDRAW', amount });
    return true;
  }

  transfer(toPlayerId, amount) {
    if (amount <= 0 || amount > this.bank) return false;
    this.bank -= amount;
    this.client?._send?.('BANK', { action: 'TRANSFER', to: toPlayerId, amount });
    return true;
  }

  _openEmoteWheel() {
    // UI
    this.onEmoteWheelOpen?.();
  }

  playEmote(name) {
    if (!EMOTES.includes(name)) return;
    this.currentEmote = name;
    this.emoteTimer = 4.0;
    this.animator?.emote?.(name);
    this.onEmoteChange?.(name);
    this.client?._send?.('RP_ACTION', { action: 'EMOTE', emote: name });
  }

  // Actions manuelles (compatibilité conservée)
  setJob(job)  { this.currentJob = job; }
  doWork()     { if (this.currentJob) this.animator?.work?.(this.currentJob); }
  wave()       { this.playEmote('wave'); }
  dance()      { this.playEmote('dance'); }
  point()      { this.playEmote('point'); }
  salute()     { this.playEmote('salute'); }
  sit()        { this.playEmote('sit'); }
  selfie()     { this.playEmote('selfie'); }

  // ═══════════════════════════════════════════════════════════════════════════
  // NIVEAU DE RECHERCHE (GTA-style)
  // ═══════════════════════════════════════════════════════════════════════════
  setWantedLevel(level) {
    const old = this.wantedLevel;
    this.wantedLevel = Math.max(0, Math.min(5, level | 0));
    if (old !== this.wantedLevel) {
      this.onWantedLevelChange?.(this.wantedLevel);
      this.onSound?.(this.wantedLevel > old ? 'wanted_up' : 'wanted_down');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSEAU (conservé + enrichi)
  // ═══════════════════════════════════════════════════════════════════════════
  _sendToServer(dt) {
    this._netAccum += dt;
    if (this._netAccum < 1 / this.CFG.netSendHz) return;
    this._netAccum = 0;
    if (this.inVehicle) return;
    this.client?._send?.('MOVE', {
      pos: { x: this.pos.x, y: this.pos.y, z: this.pos.z },
      rot: { x: 0, y: this.rot, z: 0 },
      vel: { x: this.vel.x, y: this.vel.y, z: this.vel.z },
      desiredMove: { x: this.vel.x * dt, y: 0, z: this.vel.z * dt },
      anim: this.animator?.getState?.().base ?? 'idle',
      inVehicle: !!this.inVehicle,
      stealth: this.stealthing,
      crouch: this.crouching,
      slide: this.sliding,
      aiming: this.aiming,
      weapon: this.currentWeapon,
      health: this.health,
      stamina: this.stamina,
    });
  }

  _updatePing(dt) {
    this._lastPingSent += dt;
    if (this._lastPingSent > 2) {
      this._lastPingSent = 0;
      this.client?._send?.('PING', { t: performance.now() });
    }
  }

  // Le serveur a corrigé notre position (anti-cheat)
  applyServerCorrection(pos, rot) {
    if (!pos) return;
    const drift = Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z);
    // Interpolation si petit écart, snap si gros
    if (drift < this.CFG.netMaxDrift) {
      this.pos.x += (pos.x - this.pos.x) * 0.3;
      this.pos.y = pos.y;
      this.pos.z += (pos.z - this.pos.z) * 0.3;
    } else {
      // Teleport (rollback)
      this.pos.set(pos.x, pos.y, pos.z);
      if (this.physics) {
        this.physics.removeBody?.(this.objectId);
        this.physics.addCharacter?.(this.objectId, pos);
      }
    }
    if (rot) this.rot = this._lerpAngle(this.rot, rot.y, 0.5);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI)  diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * Math.min(1, t);
  }

  _angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI)  d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  _emitHUD() {
    const w = WEAPONS[this.currentWeapon];
    this.onHUDUpdate?.({
      health: this.health,
      armor: this.armor,
      stamina: this.stamina,
      weapon: w,
      ammo: w?.melee ? null : (this.weaponAmmo[w.id] ?? 0),
      reserveAmmo: this.weaponAmmo[w.id + '_reserve'] ?? 0,
      cash: this.cash,
      bank: this.bank,
      wantedLevel: this.wantedLevel,
      inVehicle: !!this.inVehicle,
      working: this.working,
      job: this.currentJob,
    });
  }

  getState() {
    return {
      pos: this.pos,
      rot: this.rot,
      vel: this.vel,
      grounded: this.grounded,
      crouching: this.crouching,
      stealthing: this.stealthing,
      sliding: this.sliding,
      swimming: this.swimming,
      climbing: this.climbing,
      inVehicle: this.inVehicle,
      vehicleSeat: this.vehicleSeat,
      working: this.working,
      job: this.currentJob,
      health: this.health,
      armor: this.armor,
      stamina: this.stamina,
      dead: this.dead,
      aiming: this.aiming,
      reloading: this.reloading,
      weapon: this.currentWeapon,
      wantedLevel: this.wantedLevel,
      emote: this.currentEmote,
      anim: this.animator?.getState?.(),
      sig: SIG,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════
  dispose() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup',   this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('wheel',     this._onWheel);
    window.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════
export { SIG, CFG, WEAPONS, EMOTES, DEFAULT_BINDINGS };
export default CharacterController;
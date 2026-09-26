/**
 * PLAYERS.js — Logique joueurs online + sync WebSocket
 * JS pur ESM · Three.js · Rapier
 *
 * Chemin: public/appartement/players.js
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const PLAYER_COLORS = [
  0x7c3aed, 0x059669, 0xdc2626, 0xd97706,
  0x2563eb, 0xdb2777, 0x0891b2, 0x65a30d,
];

// ─── CLASSE JOUEUR LOCAL ──────────────────────────────────────────────────────
class LocalPlayer {
  constructor(scene, world, RAPIER) {
    this.scene  = scene;
    this.world  = world;
    this.RAPIER = RAPIER;
    this.id     = null;
    this.mesh   = null;
    this.body   = null;
    this.speed  = 6.0;
    this.keys   = {};
    this.aptId  = null;
    this.floor  = 0;

    this._initPhysics();
    this._initMesh();
    this._initControls();
  }

  _initPhysics() {
    const desc = this.RAPIER.RigidBodyDesc
      .dynamic()
      .setTranslation(0, 2, 8)
      .lockRotations();
    this.body = this.world.createRigidBody(desc);

    const collider = this.RAPIER.ColliderDesc
      .capsule(0.65, 0.38)
      .setFriction(0.8)
      .setRestitution(0.0);
    this.world.createCollider(collider, this.body);
  }

  _initMesh() {
    const G = new THREE.Group();

    // Corps
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 1.3, 6, 12),
      new THREE.MeshStandardMaterial({ color:0x7c3aed, roughness:0.7 })
    );
    body.position.y = 0.65;
    body.castShadow = true;
    G.add(body);

    // Tête
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 14),
      new THREE.MeshStandardMaterial({ color:0xd4c8b0, roughness:0.65 })
    );
    head.position.y = 1.78;
    head.castShadow = true;
    G.add(head);

    // Indicateur au-dessus
    const indicator = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.25, 8),
      new THREE.MeshStandardMaterial({ color:0x7c3aed, emissive:0x7c3aed, emissiveIntensity:0.8 })
    );
    indicator.position.y = 2.25;
    G.add(indicator);

    this.mesh   = G;
    this.indicatorMesh = indicator;
    this.scene.add(G);
  }

  _initControls() {
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });
  }

  update(dt, camera) {
    if (!this.body) return;

    const pos = this.body.translation();

    // Mouvement
    const vel   = this.body.linvel();
    const front = new THREE.Vector3();
    camera.getWorldDirection(front);
    front.y = 0; front.normalize();
    const right = new THREE.Vector3().crossVectors(front, new THREE.Vector3(0, 1, 0));

    let moveX = 0, moveZ = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    { moveX += front.x; moveZ += front.z; }
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  { moveX -= front.x; moveZ -= front.z; }
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  { moveX -= right.x; moveZ -= right.z; }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) { moveX += right.x; moveZ += right.z; }

    // Saut
    const onGround = Math.abs(vel.y) < 0.1;
    if ((this.keys['Space'] || this.keys['KeyE']) && onGround) {
      this.body.setLinvel({ x: vel.x, y: 6.5, z: vel.z }, true);
    }

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      this.body.setLinvel({ x: (moveX/len)*this.speed, y: vel.y, z: (moveZ/len)*this.speed }, true);
    } else {
      this.body.setLinvel({ x: vel.x * 0.85, y: vel.y, z: vel.z * 0.85 }, true);
    }

    // Sync mesh
    this.mesh.position.set(pos.x, pos.y - 1.0, pos.z);

    // Rotation vers direction
    if (len > 0) {
      this.mesh.rotation.y = Math.atan2(moveX, moveZ);
    }

    // Pulsation indicateur
    this.indicatorMesh.position.y = 2.25 + Math.sin(Date.now() * 0.004) * 0.06;
  }

  getPosition() {
    const p = this.body.translation();
    return { x: p.x, y: p.y, z: p.z };
  }

  setPosition(x, y, z) {
    this.body.setTranslation({ x, y, z }, true);
  }
}

// ─── CLASSE JOUEUR DISTANT ────────────────────────────────────────────────────
class RemotePlayer {
  constructor(scene, id, data) {
    this.scene  = scene;
    this.id     = id;
    this.data   = data;
    this.targetPos = new THREE.Vector3();
    this.mesh   = null;
    this.label  = null;
    this._build();
  }

  _build() {
    const G = new THREE.Group();
    const color = PLAYER_COLORS[parseInt(this.id, 36) % PLAYER_COLORS.length] || 0x059669;

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 1.3, 6, 12),
      new THREE.MeshStandardMaterial({ color, roughness:0.7 })
    );
    body.position.y = 0.65;
    body.castShadow = true;
    G.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 14),
      new THREE.MeshStandardMaterial({ color:0xd4c8b0, roughness:0.65 })
    );
    head.position.y = 1.78;
    G.add(head);

    // Nom flottant (sprite canvas)
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = 256; nameCanvas.height = 64;
    const nc = nameCanvas.getContext('2d');
    nc.fillStyle = 'rgba(10,12,20,0.85)';
    nc.roundRect(4, 4, 248, 56, 8);
    nc.fill();
    nc.fillStyle = '#c9a84c';
    nc.font      = 'bold 28px JetBrains Mono, monospace';
    nc.textAlign = 'center';
    nc.fillText(this.data.username || `Joueur-${this.id.slice(0, 4)}`, 128, 40);
    const nameTex = new THREE.CanvasTexture(nameCanvas);
    const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:nameTex, transparent:true }));
    nameSprite.position.y = 2.4;
    nameSprite.scale.set(1.8, 0.45, 1);
    G.add(nameSprite);

    this.mesh = G;
    this.scene.add(G);
  }

  update(dt) {
    if (!this.mesh) return;
    this.mesh.position.lerp(this.targetPos, 0.18);
  }

  setTarget(x, y, z) {
    this.targetPos.set(x, y - 1.0, z);
    const dx = x - this.mesh.position.x;
    const dz = z - this.mesh.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.05) {
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
  }
}

// ─── PLAYER MANAGER ──────────────────────────────────────────────────────────
export class PlayerManager {
  constructor(scene, world, RAPIER, camera) {
    this.scene    = scene;
    this.world    = world;
    this.RAPIER   = RAPIER;
    this.camera   = camera;
    this.local    = null;
    this.remotes  = new Map();   // id → RemotePlayer
    this.ws       = null;
    this.playerId = null;
    this._syncInterval = null;
    this._pingInterval = null;
    this._latency  = 0;
    this._lastPing = 0;

    // Stats
    this.stats = {
      connected: false,
      playerCount: 1,
      latency: 0,
      floor: 0,
      aptId: null,
    };
  }

  connect(wsUrl) {
    this.local = new LocalPlayer(this.scene, this.world, this.RAPIER);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.stats.connected = true;
        console.log('[PLAYERS] WebSocket connecté');
        this.ws.send(JSON.stringify({ type: 'PLAYER_JOIN', data: { username: this._getUsername() } }));
        this._startSync();
        this._startPing();
        this._updateHUD();
      };

      this.ws.onmessage = e => {
        try { this._handleMessage(JSON.parse(e.data)); } catch (err) {}
      };

      this.ws.onclose = () => {
        this.stats.connected = false;
        console.log('[PLAYERS] WebSocket déconnecté — reconnexion dans 3s');
        clearInterval(this._syncInterval);
        clearInterval(this._pingInterval);
        setTimeout(() => this.connect(wsUrl), 3000);
        this._updateHUD();
      };

      this.ws.onerror = () => {};

    } catch (e) {
      console.warn('[PLAYERS] WebSocket indisponible — mode offline');
      this.stats.connected = false;
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {

      case 'PLAYER_INIT':
        this.playerId = msg.data.id;
        this.local.id = msg.data.id;
        if (msg.data.position) {
          this.local.setPosition(msg.data.position.x, msg.data.position.y, msg.data.position.z);
        }
        break;

      case 'WORLD_STATE':
        // Snapshot complet de tous les joueurs
        const ids = new Set(msg.data.players.map(p => p.id));
        // Ajouter nouveaux
        msg.data.players.forEach(p => {
          if (p.id === this.playerId) return;
          if (!this.remotes.has(p.id)) {
            this.remotes.set(p.id, new RemotePlayer(this.scene, p.id, p));
          }
          this.remotes.get(p.id).setTarget(p.position.x, p.position.y, p.position.z);
        });
        // Supprimer partis
        this.remotes.forEach((r, id) => {
          if (!ids.has(id)) { r.dispose(); this.remotes.delete(id); }
        });
        this.stats.playerCount = msg.data.players.length;
        this._updateHUD();
        break;

      case 'PLAYER_MOVE':
        if (msg.data.id === this.playerId) return;
        if (!this.remotes.has(msg.data.id)) {
          this.remotes.set(msg.data.id, new RemotePlayer(this.scene, msg.data.id, msg.data));
        }
        this.remotes.get(msg.data.id).setTarget(msg.data.x, msg.data.y, msg.data.z);
        break;

      case 'PLAYER_LEAVE':
        if (this.remotes.has(msg.data.id)) {
          this.remotes.get(msg.data.id).dispose();
          this.remotes.delete(msg.data.id);
        }
        this.stats.playerCount = Math.max(1, this.stats.playerCount - 1);
        this._updateHUD();
        break;

      case 'APT_EVENT':
        if (window.ETHER_BUS) window.ETHER_BUS.emit(msg.data.event, msg.data);
        break;

      case 'PONG':
        this._latency    = Date.now() - this._lastPing;
        this.stats.latency = this._latency;
        this._updateHUD();
        break;

      case 'CHAT':
        this._showChat(msg.data);
        break;
    }
  }

  _startSync() {
    // Envoyer position 20x/sec
    this._syncInterval = setInterval(() => {
      if (!this.local || !this.ws || this.ws.readyState !== 1) return;
      const pos = this.local.getPosition();
      this.ws.send(JSON.stringify({
        type: 'PLAYER_MOVE',
        data: { x: pos.x, y: pos.y, z: pos.z, floor: this.local.floor, aptId: this.local.aptId },
      }));
    }, 50);
  }

  _startPing() {
    this._pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        this._lastPing = Date.now();
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 2000);
  }

  setPlayerApt(playerId, aptId) {
    if (playerId === this.playerId && this.local) {
      this.local.aptId = aptId;
    }
    this.stats.aptId = aptId;
    this._updateHUD();
  }

  clearPlayerApt(playerId) {
    if (playerId === this.playerId && this.local) {
      this.local.aptId = null;
    }
    this.stats.aptId = null;
    this._updateHUD();
  }

  _getUsername() {
    return localStorage.getItem('ether_username') || `Citoyen-${Math.floor(Math.random() * 9999)}`;
  }

  _showChat(data) {
    const hud = document.getElementById('hud-chat');
    if (!hud) return;
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `<span style="color:#c9a84c">${data.username}</span>: ${data.message}`;
    hud.prepend(el);
    setTimeout(() => el.remove(), 8000);
  }

  sendChat(message) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({
      type: 'CHAT',
      data: { username: this._getUsername(), message },
    }));
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  update(dt) {
    if (this.local) {
      this.local.update(dt, this.camera);
      // Suivre caméra sur le joueur (optionnel — commenté pour laisser l'orbite libre)
      // const pos = this.local.getPosition();
      // this.camera.lookAt(pos.x, pos.y + 1, pos.z);
    }
    this.remotes.forEach(r => r.update(dt));
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  _updateHUD() {
    const hud = document.getElementById('hud-players');
    if (!hud) return;
    hud.innerHTML = `
      <div class="hud-row">
        <span class="hud-dot ${this.stats.connected ? 'online' : 'offline'}"></span>
        ${this.stats.connected ? `En ligne · ${this.stats.playerCount} joueur(s)` : 'Hors ligne'}
      </div>
      ${this.stats.latency ? `<div class="hud-row" style="color:#64748b">Latence: ${this.stats.latency}ms</div>` : ''}
      ${this.stats.aptId ? `<div class="hud-row" style="color:#c9a84c">Apt: ${this.stats.aptId}</div>` : ''}
    `;
  }
}

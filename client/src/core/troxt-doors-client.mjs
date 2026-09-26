/**
 * TROXT⬡ — TROXT-DOORS-CLIENT.MJS
 * Animation et interaction des portes côté Three.js
 * 8 types d'anim · États verrou · Alarmes · Prompts · Effets
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/core/troxt-doors-client.mjs
 *
 * import * as THREE from 'three';
 * import { DoorManager } from './core/troxt-doors-client.mjs';
 * const doorMgr = new DoorManager({ THREE, scene, camera, client });
 */

const SIG = 'TROXT⬡';

// Courbe d'accélération douce (easeInOutCubic)
const easeInOut = (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;

export class DoorManager {
  constructor({ THREE, scene, camera, client, onPrompt } = {}) {
    this.THREE    = THREE;
    this.scene    = scene;
    this.camera   = camera;
    this.client   = client;       // TroxtClient (WebSocket)
    this.onPrompt = onPrompt || (() => {});   // callback UI: (promptData|null)
    this.sig      = SIG;

    this.doors      = new Map();  // uid → { mesh, pivot, state, anim, from, to, t, dur }
    this.animating  = new Set();
    this.interactDist = 3.5;
    this._nearest   = null;

    if (client) this._bindClient();
  }

  // ─── ENREGISTREMENT D'UNE PORTE 3D ─────────────────────────────────────────
  // meshOrPivot : l'Object3D à animer. Pour les battants, passe un pivot placé sur la charnière.
  register(uid, meshOrPivot, serverState = {}) {
    const rec = {
      uid,
      obj    : meshOrPivot,
      anim   : serverState.anim || 'hinged',
      open_ms: serverState.open_ms || 600,
      is_open: !!serverState.is_open,
      is_locked: serverState.is_locked !== false,
      broken : !!serverState.broken,
      building_id: serverState.building_id,
      door_id: serverState.door_id,
      type   : serverState.type,
      lock   : serverState.lock,
      entry_fee: serverState.entry_fee,
      // Transforms de repos (fermé)
      restPos: meshOrPivot.position.clone(),
      restRot: meshOrPivot.rotation.clone(),
      restScale: meshOrPivot.scale.clone(),
      // Dimensions (facultatif — sinon défauts utilisés dans _applyFactor)
      width  : serverState.width  ?? meshOrPivot.userData?.width,
      height : serverState.height ?? meshOrPivot.userData?.height,
      // Animation en cours
      t: serverState.is_open ? 1 : 0,
      target: serverState.is_open ? 1 : 0,
    };
    this.doors.set(uid, rec);
    this._applyInstant(rec);
    return rec;
  }

  // ─── PONT WEBSOCKET ────────────────────────────────────────────────────────
  _bindClient() {
    this.client.addEventListener('message', (e) => {
      const msg = e.detail;
      if (!msg?.type?.startsWith('DOOR_')) return;
      this._handle(msg.type, msg.data);
    });
  }

  _handle(type, data) {
    switch (type) {
      case 'DOOR_STATE': {
        const rec = this.doors.get(data.uid);
        if (!rec) return;
        rec.is_locked = data.is_locked;
        rec.broken    = data.broken;
        if (data.is_open !== rec.is_open) {
          rec.is_open = data.is_open;
          this._animateTo(rec, data.is_open ? 1 : 0);
        }
        if (rec.broken) this._applyBroken(rec);
        break;
      }
      case 'DOOR_RESULT':
        this.onPrompt({ kind:'result', ...data });
        if (data.needs_code) this.onPrompt({ kind:'code_input', uid:data.uid });
        break;
      case 'DOOR_ALARM':
        this._alarmFx(data.uid, data.level);
        this.onPrompt({ kind:'alarm', ...data });
        break;
      case 'DOOR_FX':
        this._fx(data.uid, data.fx, data.tool);
        break;
      case 'DOOR_BUZZ':
        this.onPrompt({ kind:'buzz', ...data });
        break;
      case 'DOOR_SYNC':
        for (const s of data.doors || []) {
          const rec = this.doors.get(s.uid);
          if (rec) {
            rec.is_locked = s.is_locked;
            rec.broken    = s.broken;
            if (s.is_open !== rec.is_open) {
              rec.is_open = s.is_open;
              this._animateTo(rec, s.is_open ? 1 : 0);
            }
          }
        }
        break;
    }
  }

  // ─── ACTIONS (→ serveur) ───────────────────────────────────────────────────
  sync()                { this.client?._send('DOOR_SYNC', {}); }
  open(uid, code)       { this.client?._send('DOOR_OPEN',   { uid, code }); }
  close(uid)            { this.client?._send('DOOR_CLOSE',  { uid }); }
  toggle(uid, code)     { this.client?._send('DOOR_TOGGLE', { uid, code }); }
  lock(uid, locked=true){ this.client?._send('DOOR_LOCK',   { uid, locked }); }
  pick(uid, skill, tool){ this.client?._send('DOOR_PICK',   { uid, skill, tool }); }
  breach(uid, tool)     { this.client?._send('DOOR_BREACH', { uid, tool }); }
  knock(uid)            { this.client?._send('DOOR_KNOCK',  { uid }); }
  buzz(uid, apt)        { this.client?._send('DOOR_BUZZ',   { uid, apt }); }
  resetAlarm(uid)       { this.client?._send('DOOR_RESET_ALARM', { uid }); }

  // ─── ANIMATION ─────────────────────────────────────────────────────────────
  _animateTo(rec, target) {
    rec.target    = target;
    rec.animStart = performance.now();
    rec.animFrom  = rec.t;
    this.animating.add(rec.uid);
  }

  // Applique la transformation selon anim + facteur t (0=fermé, 1=ouvert)
  _applyFactor(rec, t) {
    const { THREE } = this;
    const o = rec.obj;
    o.position.copy(rec.restPos);
    o.rotation.copy(rec.restRot);
    o.scale.copy(rec.restScale);

    switch (rec.anim) {
      case 'hinged':      // battant — rotation 95° sur Y
        o.rotation.y = rec.restRot.y - t * (Math.PI * 0.53);
        break;
      case 'double':      // deux battants (children [0],[1])
        if (o.children[0]) o.children[0].rotation.y = -t * (Math.PI * 0.53);
        if (o.children[1]) o.children[1].rotation.y =  t * (Math.PI * 0.53);
        break;
      case 'sliding':     // coulisse latérale
        o.position.x = rec.restPos.x + t * (rec.width || 1.0);
        break;
      case 'garage':      // monte verticalement
        o.position.y = rec.restPos.y + t * (rec.height || 2.4);
        break;
      case 'shutter':     // rideau — scale Y du haut vers le bas
        o.scale.y = Math.max(0.02, 1 - t);
        o.position.y = rec.restPos.y + t * (rec.height || 2.4) * 0.5;
        break;
      case 'gate':        // portail — double battant large
        if (o.children[0]) o.children[0].rotation.y = -t * (Math.PI * 0.5);
        if (o.children[1]) o.children[1].rotation.y =  t * (Math.PI * 0.5);
        else o.rotation.y = rec.restRot.y - t * (Math.PI * 0.5);
        break;
      case 'revolving':   // tambour — rotation continue quand "ouvert"
        o.rotation.y = rec.restRot.y + t * Math.PI * 0.5;
        break;
      case 'vault':       // coffre — recule puis pivote
        o.position.z = rec.restPos.z - t * 0.3;
        o.rotation.y = rec.restRot.y - t * (Math.PI * 0.5);
        break;
      default:
        o.rotation.y = rec.restRot.y - t * (Math.PI * 0.53);
    }
  }

  _applyInstant(rec) { this._applyFactor(rec, rec.t); }

  _applyBroken(rec) {
    // Porte défoncée : penche + entrouverte + teinte sombre
    const o = rec.obj;
    this._applyFactor(rec, 1);
    o.rotation.z = (rec.restRot.z || 0) + 0.15;
    o.traverse?.((c) => {
      if (c.material) {
        c.material = c.material.clone?.() || c.material;
        if (c.material.color) c.material.color.multiplyScalar(0.6);
      }
    });
  }

  // Boucle d'update — à appeler chaque frame
  update(dt) {
    const now = performance.now();

    // Animation des battants en cours
    for (const uid of this.animating) {
      const rec = this.doors.get(uid);
      if (!rec) { this.animating.delete(uid); continue; }
      const elapsed = now - rec.animStart;
      const raw     = Math.min(1, elapsed / rec.open_ms);
      const eased   = easeInOut(raw);
      rec.t = rec.animFrom + (rec.target - rec.animFrom) * eased;
      this._applyFactor(rec, rec.t);
      if (raw >= 1) { rec.t = rec.target; this.animating.delete(uid); }
    }

    // Rotation continue des portes tambour ouvertes
    for (const rec of this.doors.values()) {
      if (rec.anim === 'revolving' && rec.is_open) rec.obj.rotation.y += dt * 1.2;
    }

    // Détection de la porte la plus proche pour le prompt
    this._updateNearest();

    // Secousses + clignotement d'alarme
    this._updateAlarms(dt);
  }

  // ─── PROMPT DE PROXIMITÉ ───────────────────────────────────────────────────
  _updateNearest() {
    if (!this.camera) return;
    const cam = this.camera.position;
    let best = null, bestD = this.interactDist;
    for (const rec of this.doors.values()) {
      const p = rec.obj.getWorldPosition(new this.THREE.Vector3());
      const d = p.distanceTo(cam);
      if (d < bestD) { bestD = d; best = rec; }
    }
    if (best !== this._nearest) {
      this._nearest = best;
      if (best) {
        const actions = ['open'];
        if (best.is_locked && !best.broken) actions.push('pick', 'breach');
        if (!best.is_locked) actions.push('lock');
        actions.push('knock');
        this.onPrompt({
          kind:'proximity', uid:best.uid, door_id:best.door_id,
          building_id:best.building_id, is_locked:best.is_locked,
          is_open:best.is_open, broken:best.broken, type:best.type,
          entry_fee:best.entry_fee, actions,
          label: best.broken ? '🚪 Défoncée' :
                 best.is_locked ? '🔒 Verrouillée' :
                 best.is_open ? '🚪 Ouverte' : '🚪 Fermée',
        });
      } else {
        this.onPrompt(null);
      }
    }
  }

  get nearest() { return this._nearest?.uid || null; }

  // Raccourci : agir sur la porte la plus proche (touche E, etc.)
  interactNearest(code) { if (this._nearest) this.toggle(this._nearest.uid, code); }

  // ─── EFFETS VISUELS ────────────────────────────────────────────────────────
  _fx(uid, fx, tool) {
    const rec = this.doors.get(uid);
    if (!rec) return;
    if (fx === 'impact') {
      rec._shake = 0.25;
    } else if (fx === 'broken') {
      this._applyBroken(rec);
      rec._shake = 0.5;
    } else if (fx === 'knock') {
      rec._shake = 0.08;
    }
  }

  _alarmFx(uid, level) {
    const rec = this.doors.get(uid);
    if (!rec) return;
    rec._alarm = { level: level || 2, t: 0, light: this._makeAlarmLight(rec) };
  }

  _makeAlarmLight(rec) {
    if (!this.THREE || !this.scene) return null;
    const light = new this.THREE.PointLight(0xff0000, 0, 8);
    const p = rec.obj.getWorldPosition(new this.THREE.Vector3());
    light.position.copy(p).add(new this.THREE.Vector3(0, 2, 0));
    this.scene.add(light);
    return light;
  }

  _updateAlarms(dt) {
    for (const rec of this.doors.values()) {
      // Secousse (impact / breach / knock)
      if (rec._shake > 0) {
        rec._shake = Math.max(0, rec._shake - dt * 2);
        rec.obj.position.x = rec.restPos.x + (Math.random() - 0.5) * rec._shake * 0.1;
        if (rec._shake === 0) this._applyFactor(rec, rec.t);
      }

      // Clignotement d'alarme — intensité sinusoïdale tant que rec._alarm existe.
      // La coupure se fait via clearAlarm(uid) déclenché par un DOOR_STATE serveur.
      if (rec._alarm) {
        rec._alarm.t += dt;
        if (rec._alarm.light) {
          rec._alarm.light.intensity = (Math.sin(rec._alarm.t * 10) * 0.5 + 0.5) * 3;
        }
      }
    }
  }

  clearAlarm(uid) {
    const rec = this.doors.get(uid);
    if (rec?._alarm?.light) {
      this.scene?.remove(rec._alarm.light);
      rec._alarm = null;
    }
  }

  // ─── NETTOYAGE ─────────────────────────────────────────────────────────────
  remove(uid) {
    this.clearAlarm(uid);
    this.doors.delete(uid);
    this.animating.delete(uid);
  }

  dispose() {
    for (const uid of [...this.doors.keys()]) this.remove(uid);
  }

  get count() { return this.doors.size; }
}

// ─── HELPER : construire une porte battante avec pivot sur charnière ──────────
// Retourne un pivot Object3D à ajouter à la scène, prêt pour register(uid, pivot)
export function makeHingedDoor({ THREE, width = 1.0, height = 2.1, thickness = 0.08, color = 0x6b4423, hingeSide = 'left' }) {
  const pivot = new THREE.Object3D();
  const geo   = new THREE.BoxGeometry(width, height, thickness);
  const mat   = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
  const panel = new THREE.Mesh(geo, mat);
  // décaler le panneau pour que la charnière soit au bord
  panel.position.x = (hingeSide === 'left' ? width / 2 : -width / 2);
  panel.castShadow = panel.receiveShadow = true;
  // poignée
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 })
  );
  handle.position.set(hingeSide === 'left' ? width - 0.12 : -width + 0.12, 0, thickness);
  panel.add(handle);
  pivot.add(panel);
  pivot.userData.width  = width;
  pivot.userData.height = height;
  return pivot;
}

// Double porte : deux battants enfants children[0] (gauche) et children[1] (droite)
export function makeDoubleDoor({ THREE, width = 1.0, height = 2.1, thickness = 0.08, color = 0x6b4423 }) {
  const group = new THREE.Object3D();
  const left  = makeHingedDoor({ THREE, width, height, thickness, color, hingeSide: 'left' });
  const right = makeHingedDoor({ THREE, width, height, thickness, color, hingeSide: 'right' });
  left.position.x  = -width;
  right.position.x =  width;
  group.add(left, right);
  group.userData.width  = width;
  group.userData.height = height;
  return group;
}

export { SIG };
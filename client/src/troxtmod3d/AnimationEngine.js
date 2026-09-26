// src/troxtmod3d/AnimationEngine.js
// ETHERWORLD RP — AnimationEngine v4.1 (22 modes)

const DEFAULT_CONFIGS = {
  idle:           { amplitude: 1.0, speed: 1.0, bobble: 0.012 },
  walk:           { amplitude: 1.0, speed: 4.0, bobble: 0.030 },
  run:            { amplitude: 1.2, speed: 8.0, bobble: 0.050 },
  power_pose:     { amplitude: 1.5, speed: 2.0, bobble: 0.020 },
  floating:       { amplitude: 1.0, speed: 2.0, bobble: 0.080 },
  jump:           { amplitude: 1.5, speed: 3.0, bobble: 0.150 },
  crouch:         { amplitude: 0.6, speed: 1.0, bobble: 0.008 },
  wave:           { amplitude: 1.0, speed: 5.0, bobble: 0.010 },
  dance:          { amplitude: 1.8, speed: 6.0, bobble: 0.060 },
  flex:           { amplitude: 1.2, speed: 3.0, bobble: 0.015 },
  bow:            { amplitude: 1.0, speed: 1.5, bobble: 0.005 },
  threaten:       { amplitude: 1.4, speed: 4.0, bobble: 0.025 },
  sit:            { amplitude: 0.5, speed: 0.5, bobble: 0.004 },
  lie:            { amplitude: 0.3, speed: 0.3, bobble: 0.002 },
  point:          { amplitude: 1.0, speed: 2.5, bobble: 0.008 },
  salute:         { amplitude: 1.0, speed: 2.0, bobble: 0.006 },
  meditate:       { amplitude: 0.8, speed: 0.8, bobble: 0.010 },
  combat_idle:    { amplitude: 1.2, speed: 3.5, bobble: 0.018 },
  combat_strike:  { amplitude: 2.0, speed: 8.0, bobble: 0.040 },
  cast_spell:     { amplitude: 1.3, speed: 2.5, bobble: 0.015 },
  injured:        { amplitude: 0.8, speed: 2.0, bobble: 0.020 },
  victory:        { amplitude: 1.6, speed: 4.0, bobble: 0.045 },
};

export class AnimationEngine {
  constructor(targetGroup) {
    this.targetGroup = targetGroup;
    this.mode = 'idle';
    this.config = { ...DEFAULT_CONFIGS.idle };
    this.blendTarget = null;
    this.blendProgress = 0;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.blendTarget = mode;
    this.blendProgress = 0;
    this.mode = mode;
    this.config = { ...DEFAULT_CONFIGS[mode] };
  }

  setConfig(partial) {
    this.config = { ...this.config, ...partial };
  }

  update(time, delta) {
    if (!this.targetGroup) return;
    if (this.blendTarget && this.blendProgress < 1) {
      this.blendProgress = Math.min(1, this.blendProgress + delta * 4);
      if (this.blendProgress >= 1) this.blendTarget = null;
    }

    const { amplitude, speed, bobble } = this.config;
    const t = time * speed;

    this.targetGroup.rotation.x *= 0.9;
    this.targetGroup.rotation.z *= 0.9;

    switch (this.mode) {
      case 'idle':
        this.targetGroup.position.y = Math.sin(t * 1.5) * bobble * amplitude;
        this.targetGroup.rotation.y = Math.sin(t * 0.4) * 0.05 * amplitude;
        break;
      case 'walk':
        this.targetGroup.position.y = Math.abs(Math.sin(t)) * bobble * amplitude;
        this.targetGroup.rotation.y = Math.sin(t * 0.5) * 0.08 * amplitude;
        break;
      case 'run':
        this.targetGroup.position.y = Math.abs(Math.sin(t)) * bobble * amplitude;
        this.targetGroup.rotation.y = Math.sin(t * 0.5) * 0.15 * amplitude;
        this.targetGroup.rotation.z = Math.sin(t * 0.5) * 0.05;
        break;
      case 'jump': {
        const jumpPhase = (t % 2.0) / 2.0;
        this.targetGroup.position.y = Math.sin(jumpPhase * Math.PI) * bobble * amplitude;
        break;
      }
      case 'floating':
        this.targetGroup.position.y = 0.2 + Math.sin(t) * bobble * amplitude;
        this.targetGroup.rotation.y = time * 0.25;
        break;
      case 'dance':
        this.targetGroup.position.y = Math.abs(Math.sin(t * 0.5)) * bobble;
        this.targetGroup.rotation.y = Math.sin(t * 0.3) * 0.4;
        this.targetGroup.rotation.z = Math.sin(t) * 0.15;
        break;
      case 'wave':
        this.targetGroup.rotation.y = Math.sin(t) * 0.3;
        this.targetGroup.rotation.z = Math.sin(t * 2) * 0.1;
        break;
      case 'flex':
        this.targetGroup.position.y = Math.sin(t) * bobble;
        this.targetGroup.rotation.z = Math.sin(t * 0.5) * 0.1;
        break;
      case 'bow':
        this.targetGroup.rotation.x = Math.min(0.6, Math.sin(t * 0.5) * 0.6);
        break;
      case 'threaten':
        this.targetGroup.position.y = Math.abs(Math.sin(t * 2)) * bobble;
        this.targetGroup.rotation.y = Math.sin(t * 3) * 0.15;
        break;
      case 'sit':
        this.targetGroup.position.y = -0.15 + Math.sin(t * 0.3) * bobble;
        break;
      case 'lie':
        this.targetGroup.rotation.x = Math.PI / 2;
        this.targetGroup.position.y = -0.4 + Math.sin(t) * bobble;
        break;
      case 'point':
        this.targetGroup.rotation.y = Math.sin(t * 0.2) * 0.2;
        break;
      case 'salute':
        this.targetGroup.rotation.x = -0.15;
        this.targetGroup.position.y = Math.sin(t * 0.5) * bobble * 0.5;
        break;
      case 'meditate':
        this.targetGroup.position.y = -0.05 + Math.sin(t) * bobble;
        this.targetGroup.rotation.y = Math.sin(t * 0.2) * 0.1;
        break;
      case 'combat_idle':
        this.targetGroup.position.y = Math.sin(t * 2) * bobble;
        this.targetGroup.rotation.z = Math.sin(t) * 0.08;
        break;
      case 'combat_strike': {
        const strike = Math.sin(t);
        this.targetGroup.rotation.z = strike * 0.3;
        this.targetGroup.rotation.x = Math.max(0, -strike * 0.4);
        break;
      }
      case 'cast_spell':
        this.targetGroup.position.y = Math.sin(t * 1.5) * bobble * 2;
        this.targetGroup.rotation.y = Math.sin(t * 0.8) * 0.25;
        break;
      case 'injured':
        this.targetGroup.rotation.z = Math.sin(t * 3) * 0.15;
        this.targetGroup.position.y = Math.sin(t * 4) * bobble;
        break;
      case 'victory':
        this.targetGroup.position.y = Math.abs(Math.sin(t * 0.5)) * bobble * 2;
        this.targetGroup.rotation.y = Math.sin(t * 0.5) * 0.4;
        break;
      case 'crouch':
        this.targetGroup.position.y = -0.2 + Math.sin(t) * bobble;
        break;
      default:
        this.targetGroup.position.y = Math.sin(t * 2) * bobble * amplitude;
        this.targetGroup.rotation.y = Math.sin(t * 0.8) * 0.12 * amplitude;
    }
  }
}
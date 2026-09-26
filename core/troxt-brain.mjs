/**
 * ████████╗██████╗  ██████╗ ██╗  ██╗████████╗
 *    ██╔══╝██╔══██╗██╔═══██╗╚██╗██╔╝    ██╔══╝
 *    ██║   ██████╔╝██║   ██║ ╚███╔╝     ██║
 *    ██║   ██╔══██╗██║   ██║ ██╔██╗     ██║
 *    ██║   ██║  ██║╚██████╔╝██╔╝ ██╗    ██║
 *    ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝
 *
 * TROXT — The Autonomous Orchestrator of EtherWorld
 * Cerveau central · Superviseur temps réel · Gardien du système
 *
 * Logique TROXT :
 *   → Il ne réagit pas — il anticipe
 *   → Il ne corrige pas — il prévient
 *   → Il ne surveille pas — il comprend
 *   → Chaque décision laisse une trace signée TROXT
 *
 * @version 1.0.0
 * @author  EtherWorld / PepiteQC
 * Chemin  : core/troxt-brain.mjs
 */

import { EventEmitter } from 'node:events';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONSTANTES TROXT ─────────────────────────────────────────────────────────

const TROXT_VERSION   = '1.0.0';
const TROXT_SIGNATURE = '⬡ TROXT';
const MEMORY_FILE     = path.join(__dirname, 'troxt_memory.json');
const LOG_FILE        = path.join(__dirname, 'troxt_log.json');

// Fréquences de pulse (ms)
const PULSE_FAST   = 1_000;   // surveillance critique
const PULSE_NORMAL = 5_000;   // état des agents
const PULSE_SLOW   = 30_000;  // analyse profonde + rappel de tâches

// Seuils d'alerte
const THRESHOLDS = {
  agentSilenceMs:    15_000,
  agentDeadMs:       60_000,
  errorRatePerMin:   5,
  memoryUsagePct:    85,
  taskStalledMs:     120_000,
};

// ─── REGISTRE DES AGENTS ÉTHER ────────────────────────────────────────────────

const ETHER_AGENTS = {
  etherprism: {
    id:          'etherprism',
    name:        'EtherPrism',
    icon:        '🗄️',
    role:        'RP database management — Players, Vehicles, Houses, Jobs, Factions, Inventory, Banking',
    apiBase:     'http://localhost:4100/api/prism',
    healthEndpoint: '/tables',
    tasks: [
      'Maintenir l\'intégrité de toutes les tables RP',
      'Exécuter les CRUD en moins de 50ms',
      'Valider les relations entre players/vehicles/houses',
      'Prévenir les corruptions de données',
      'Synchroniser les bank_accounts en temps réel',
    ],
    criticalFields: ['players', 'bank_accounts', 'inventory'],
    status:      'unknown',
    lastSeen:    null,
    errorCount:  0,
    taskQueue:   [],
  },

  etherforge: {
    id:          'etherforge',
    name:        'EtherForge',
    icon:        '⚒️',
    role:        '3D creation workshop — Build, sculpt, export 3D assets. Controlled by TROXT.',
    apiBase:     'http://localhost:4100',
    healthEndpoint: '/api/platforms',
    tasks: [
      'Maintenir la scène 3D cohérente (pas de platforms orphelines)',
      'Valider les exports GLTF/GLB avant livraison',
      'Synchroniser les platforms avec le world state',
      'Prévenir les collisions de IDs de platforms',
      'Exécuter les auto-saves toutes les 60s',
    ],
    criticalFields: ['platforms', 'world_state', 'snapshots'],
    status:      'unknown',
    lastSeen:    null,
    errorCount:  0,
    taskQueue:   [],
  },

  etherweave: {
    id:          'etherweave',
    name:        'EtherWeave',
    icon:        '🧵',
    role:        'Procedural texture weaver — Noise, Voronoi, seamless tiling, PNG/WebP export',
    apiBase:     null,
    healthEndpoint: null,
    tasks: [
      'Générer des textures seamless sans artéfacts aux bords',
      'Valider les paramètres Voronoi (seed, fréquence, amplitude)',
      'Optimiser les exports PNG/WebP < 500KB par défaut',
      'Maintenir le système de layers sans overflow mémoire',
      'Exporter les métadonnées de texture avec chaque fichier',
    ],
    criticalFields: ['layers', 'noise_params', 'export_queue'],
    status:      'standby',
    lastSeen:    null,
    errorCount:  0,
    taskQueue:   [],
  },

  etherlens: {
    id:          'etherlens',
    name:        'EtherLens',
    icon:        '🔬',
    role:        'Analytical eye of TROXT — Object detection, OCR, precision measure, PDF/JSON reports',
    apiBase:     null,
    healthEndpoint: null,
    tasks: [
      'Scanner les scènes 3D pour détecter les anomalies visuelles',
      'Exécuter l\'OCR sur les assets texte importés',
      'Mesurer les dimensions précises des objets 3D',
      'Générer des rapports PDF/JSON après chaque analyse',
      'Alerter TROXT si une cible visuelle dévie du référentiel',
    ],
    criticalFields: ['scan_queue', 'detection_results', 'report_cache'],
    status:      'standby',
    lastSeen:    null,
    errorCount:  0,
    taskQueue:   [],
  },

  platformTester: {
    id:          'platformTester',
    name:        'Platform Tester 3D',
    icon:        '🎮',
    role:        'The 3D world — Players, platforms, WebSocket multiplayer, world generation',
    apiBase:     'http://localhost:4100',
    healthEndpoint: '/api/admin/metrics',
    tasks: [
      'Maintenir le WebSocket stable (< 50ms latence)',
      'Synchroniser les positions joueurs 20x/sec',
      'Valider chaque platform avant insertion dans le monde',
      'Exécuter les auto-saves world state toutes les 60s',
      'Détecter et kicker les joueurs déconnectés > 30s',
    ],
    criticalFields: ['players', 'platforms', 'websocket_connections'],
    status:      'unknown',
    lastSeen:    null,
    errorCount:  0,
    taskQueue:   [],
  },
};

// ─── MÉMOIRE TROXT ────────────────────────────────────────────────────────────

class TroxtMemory {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(MEMORY_FILE)) {
        return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      }
    } catch (e) {}
    return {
      version:      TROXT_VERSION,
      created_at:   new Date().toISOString(),
      troxt_cycles: 0,
      agent_history: {},
      decisions:    [],
      incidents:    [],
      task_completions: {},
      world_snapshots:  [],
    };
  }

  save() {
    try {
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.data, null, 2));
    } catch (e) {}
  }

  recordDecision(decision) {
    this.data.decisions.unshift({
      id:        `D-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...decision,
    });
    if (this.data.decisions.length > 200) this.data.decisions.pop();
    this.save();
  }

  recordIncident(incident) {
    this.data.incidents.unshift({
      id:        `I-${Date.now()}`,
      timestamp: new Date().toISOString(),
      resolved:  false,
      ...incident,
    });
    if (this.data.incidents.length > 100) this.data.incidents.pop();
    this.save();
  }

  recordAgentSeen(agentId, status, data = {}) {
    if (!this.data.agent_history[agentId]) {
      this.data.agent_history[agentId] = [];
    }
    this.data.agent_history[agentId].unshift({
      timestamp: new Date().toISOString(),
      status, ...data,
    });
    if (this.data.agent_history[agentId].length > 50) {
      this.data.agent_history[agentId].pop();
    }
  }

  getAgentHistory(agentId, limit = 10) {
    return (this.data.agent_history[agentId] || []).slice(0, limit);
  }

  incrementCycle() {
    this.data.troxt_cycles++;
    if (this.data.troxt_cycles % 10 === 0) this.save();
  }
}

// ─── LOGGER TROXT ─────────────────────────────────────────────────────────────

class TroxtLogger {
  constructor() {
    this.entries = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
      }
    } catch (e) {}
    return [];
  }

  _write(level, source, message, data = {}) {
    const entry = {
      ts:      new Date().toISOString(),
      level,
      source:  `${TROXT_SIGNATURE}${source ? ' › ' + source : ''}`,
      message,
      data,
    };

    const colors = {
      INFO:     '\x1b[36m',
      WARN:     '\x1b[33m',
      ERROR:    '\x1b[31m',
      CRITICAL: '\x1b[35m',
      SUCCESS:  '\x1b[32m',
      DECISION: '\x1b[34m',
    };
    const reset = '\x1b[0m';
    const color = colors[level] || '\x1b[37m';
    const icon  = { INFO:'ℹ', WARN:'⚠', ERROR:'✖', CRITICAL:'🔴', SUCCESS:'✓', DECISION:'⬡' }[level] || '·';

    console.log(`${color}[${entry.ts.slice(11,19)}] ${icon} ${entry.source} — ${message}${reset}`);
    if (Object.keys(data).length > 0) {
      console.log(`${color}   ↳ ${JSON.stringify(data)}${reset}`);
    }

    this.entries.unshift(entry);
    if (this.entries.length > 500) this.entries.pop();

    try {
      fs.writeFileSync(LOG_FILE, JSON.stringify(this.entries.slice(0, 300), null, 2));
    } catch (e) {}

    return entry;
  }

  info    (src, msg, data) { return this._write('INFO',     src, msg, data); }
  warn    (src, msg, data) { return this._write('WARN',     src, msg, data); }
  error   (src, msg, data) { return this._write('ERROR',    src, msg, data); }
  critical(src, msg, data) { return this._write('CRITICAL', src, msg, data); }
  success (src, msg, data) { return this._write('SUCCESS',  src, msg, data); }
  decision(src, msg, data) { return this._write('DECISION', src, msg, data); }

  getLast(n = 50) { return this.entries.slice(0, n); }
}

// ─── MOTEUR DE DÉCISION TROXT ─────────────────────────────────────────────────

class TroxtDecisionEngine {
  constructor(memory, logger) {
    this.memory  = memory;
    this.logger  = logger;
    this.ruleBook = this._buildRuleBook();
    this._lastFired = new Map();
  }

  _buildRuleBook() {
    return [
      {
        id:        'AGENT_SILENT_WARNING',
        severity:  'WARN',
        cooldownMs: 30_000,
        condition: (agent) =>
          agent.lastSeen &&
          Date.now() - agent.lastSeen > THRESHOLDS.agentSilenceMs &&
          Date.now() - agent.lastSeen < THRESHOLDS.agentDeadMs &&
          agent.status !== 'standby',
        action: (agent) => ({
          type:    'REMIND_TASK',
          message: `${agent.icon} ${agent.name} est silencieux depuis ${Math.round((Date.now()-agent.lastSeen)/1000)}s. Rappel des tâches critiques.`,
          tasks:   agent.tasks.slice(0, 3),
        }),
      },
      {
        id:        'AGENT_DEAD',
        severity:  'CRITICAL',
        cooldownMs: 60_000,
        condition: (agent) =>
          agent.lastSeen &&
          Date.now() - agent.lastSeen > THRESHOLDS.agentDeadMs &&
          agent.status !== 'standby',
        action: (agent) => ({
          type:    'ESCALATE',
          message: `${agent.icon} ${agent.name} ne répond plus depuis ${Math.round((Date.now()-agent.lastSeen)/1000)}s. Escalade requise.`,
          escalation: 'restart_or_alert_human',
        }),
      },
      {
        id:        'AGENT_ERROR_SPIKE',
        severity:  'ERROR',
        cooldownMs: 20_000,
        condition: (agent) => agent.errorCount >= THRESHOLDS.errorRatePerMin,
        action: (agent) => ({
          type:    'INVESTIGATE',
          message: `${agent.icon} ${agent.name} a ${agent.errorCount} erreurs récentes. Investigation requise.`,
          errorCount: agent.errorCount,
        }),
      },
      {
        id:        'TASK_STALLED',
        severity:  'WARN',
        cooldownMs: 60_000,
        condition: (agent) =>
          agent.taskQueue.some(t => t.startedAt && Date.now() - t.startedAt > THRESHOLDS.taskStalledMs),
        action: (agent) => {
          const stalled = agent.taskQueue.filter(t => t.startedAt && Date.now() - t.startedAt > THRESHOLDS.taskStalledMs);
          return {
            type:    'FORCE_REMIND',
            message: `${agent.icon} ${agent.name} a ${stalled.length} tâche(s) bloquée(s). Rappel forcé.`,
            stalledTasks: stalled.map(t => t.description),
          };
        },
      },
      {
        id:        'MEMORY_PRESSURE',
        severity:  'WARN',
        cooldownMs: 60_000,
        condition: () => {
          const mem = process.memoryUsage();
          return (mem.heapUsed / mem.heapTotal) * 100 > THRESHOLDS.memoryUsagePct;
        },
        action: () => {
          const mem = process.memoryUsage();
          return {
            type:    'OPTIMIZE',
            message: `Pression mémoire détectée: ${Math.round((mem.heapUsed/mem.heapTotal)*100)}% heap utilisé.`,
            heapUsedMB: Math.round(mem.heapUsed/1024/1024),
          };
        },
      },
    ];
  }

  _canFire(ruleId, agentId) {
    const key  = `${ruleId}:${agentId}`;
    const rule = this.ruleBook.find(r => r.id === ruleId);
    const last = this._lastFired.get(key) || 0;
    if (Date.now() - last < rule.cooldownMs) return false;
    this._lastFired.set(key, Date.now());
    return true;
  }

  evaluate(agents, context = {}) {
    const decisions = [];

    for (const agent of Object.values(agents)) {
      for (const rule of this.ruleBook) {
        if (!rule.condition(agent, context)) continue;
        if (!this._canFire(rule.id, agent.id)) continue;

        const action = rule.action(agent, context);
        const decision = {
          rule:     rule.id,
          severity: rule.severity,
          agentId:  agent.id,
          agentName: agent.name,
          ...action,
          timestamp: new Date().toISOString(),
        };

        decisions.push(decision);
        this.memory.recordDecision(decision);

        this.logger[rule.severity === 'CRITICAL' ? 'critical'
          : rule.severity === 'ERROR' ? 'error'
          : rule.severity === 'WARN'  ? 'warn'
          : 'info'](agent.name, action.message, { rule: rule.id });
      }
    }

    return decisions;
  }
}

// ─── TROXT CORE ───────────────────────────────────────────────────────────────

class Troxt extends EventEmitter {
  constructor() {
    super();
    this.version   = TROXT_VERSION;
    this.startedAt = Date.now();
    this.agents    = JSON.parse(JSON.stringify(ETHER_AGENTS));
    this.memory    = new TroxtMemory();
    this.logger    = new TroxtLogger();
    this.engine    = new TroxtDecisionEngine(this.memory, this.logger);
    this.cycles    = 0;
    this._pulses   = [];
    this._taskIdCounter = 0;
  }

  boot() {
    this._printBanner();
    this.logger.info(null, `TROXT v${TROXT_VERSION} — Système en ligne`, {
      agents: Object.keys(this.agents).length,
      memory_cycles: this.memory.data.troxt_cycles,
    });

    this._startPulses();
    this.emit('boot', { timestamp: new Date().toISOString() });
    return this;
  }

  _printBanner() {
    console.log('\x1b[35m');
    console.log('  ████████╗██████╗  ██████╗ ██╗  ██╗████████╗');
    console.log('     ██╔══╝██╔══██╗██╔═══██╗╚██╗██╔╝    ██╔══╝');
    console.log('     ██║   ██████╔╝██║   ██║ ╚███╔╝     ██║   ');
    console.log('     ██║   ██╔══██╗██║   ██║ ██╔██╗     ██║   ');
    console.log('     ██║   ██║  ██║╚██████╔╝██╔╝ ██╗    ██║   ');
    console.log('     ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ');
    console.log('');
    console.log('  Cerveau central EtherWorld · v' + TROXT_VERSION);
    console.log('  Superviseur · Orchestrateur · Gardien');
    console.log('\x1b[0m');
  }

  _startPulses() {
    this._pulses.push(setInterval(() => this._pulseFast(),   PULSE_FAST));
    this._pulses.push(setInterval(() => this._pulseNormal(), PULSE_NORMAL));
    this._pulses.push(setInterval(() => this._pulseSlow(),   PULSE_SLOW));
  }

  async _pulseFast() {
    this.cycles++;
    this.memory.incrementCycle();

    const mem = process.memoryUsage();
    const pct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
    if (pct > THRESHOLDS.memoryUsagePct) {
      this.logger.warn('SYSTÈME', `Heap ${pct}% — pression mémoire`, { heapMB: Math.round(mem.heapUsed/1024/1024) });
    }

    const criticalAgents = Object.values(this.agents).filter(a =>
      a.status !== 'standby' && a.lastSeen && Date.now() - a.lastSeen > THRESHOLDS.agentDeadMs
    );
    if (criticalAgents.length > 0) {
      this.engine.evaluate(
        Object.fromEntries(criticalAgents.map(a => [a.id, a])),
        { pulse: 'fast' }
      );
    }
  }

  async _pulseNormal() {
    this.logger.info('PULSE', `Cycle #${this.cycles} — Vérification agents`, {
      online:  Object.values(this.agents).filter(a => a.status === 'online').length,
      standby: Object.values(this.agents).filter(a => a.status === 'standby').length,
      unknown: Object.values(this.agents).filter(a => a.status === 'unknown').length,
    });

    for (const agent of Object.values(this.agents)) {
      if (agent.apiBase && agent.healthEndpoint) {
        await this._pingAgent(agent);
      }
    }

    const decisions = this.engine.evaluate(this.agents, { pulse: 'normal' });
    if (decisions.length > 0) {
      this.emit('decisions', decisions);
    }
  }

  async _pulseSlow() {
    this.logger.decision('ANALYSE', 'Analyse profonde du système', {
      uptime_min: Math.round((Date.now() - this.startedAt) / 60000),
      total_cycles: this.cycles,
    });

    for (const agent of Object.values(this.agents)) {
      if (agent.status === 'online') {
        this._remindTasks(agent);
      }
    }

    const report = this._generateReport();
    this.emit('report', report);

    this.memory.data.world_snapshots.unshift({
      timestamp:    new Date().toISOString(),
      agent_states: Object.fromEntries(
        Object.values(this.agents).map(a => [a.id, {
          status:     a.status,
          errorCount: a.errorCount,
          taskCount:  a.taskQueue.length,
        }])
      ),
    });
    if (this.memory.data.world_snapshots.length > 20) {
      this.memory.data.world_snapshots.pop();
    }
    this.memory.save();
  }

  async _pingAgent(agent) {
    const url = `${agent.apiBase}${agent.healthEndpoint}`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        agent.status   = 'online';
        agent.lastSeen = Date.now();
        agent.errorCount = Math.max(0, agent.errorCount - 1);
        this.memory.recordAgentSeen(agent.id, 'online', { endpoint: url });

        this.logger.success(agent.name, `En ligne · ${agent.healthEndpoint}`, {
          status: res.status,
        });

        this.emit('agent:online', { agent: agent.id, data });
        return true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      agent.status = 'error';
      agent.errorCount++;
      this.memory.recordAgentSeen(agent.id, 'error', { error: err.message });

      this.logger.error(agent.name, `Inaccessible — ${err.message}`, { url });
      this.emit('agent:error', { agent: agent.id, error: err.message });
      return false;
    }
  }

  _remindTasks(agent) {
    this.logger.decision(agent.name, `Rappel de tâches`, {
      tasks: agent.tasks,
    });
    this.emit('agent:remind', {
      agentId:   agent.id,
      agentName: agent.name,
      icon:      agent.icon,
      tasks:     agent.tasks,
      timestamp: new Date().toISOString(),
    });
  }

  assignTask(agentId, description, priority = 'normal') {
    const agent = this.agents[agentId];
    if (!agent) {
      this.logger.error('TROXT', `Agent inconnu: ${agentId}`);
      return null;
    }

    const task = {
      id:          `T-${++this._taskIdCounter}`,
      agentId,
      description,
      priority,
      status:      'pending',
      createdAt:   Date.now(),
      startedAt:   null,
      completedAt: null,
    };

    agent.taskQueue.push(task);
    this.logger.decision(agent.name, `Tâche assignée: ${description}`, {
      taskId:   task.id,
      priority,
      queueLen: agent.taskQueue.length,
    });

    this.memory.recordDecision({
      type:    'TASK_ASSIGNED',
      agentId, description, priority,
      taskId:  task.id,
    });

    this.emit('task:assigned', task);
    return task;
  }

  completeTask(taskId) {
    for (const agent of Object.values(this.agents)) {
      const task = agent.taskQueue.find(t => t.id === taskId);
      if (task) {
        task.status      = 'completed';
        task.completedAt = Date.now();
        agent.taskQueue  = agent.taskQueue.filter(t => t.id !== taskId);

        this.logger.success(agent.name, `Tâche complétée: ${task.description}`, {
          taskId,
          duration_ms: task.completedAt - task.createdAt,
        });

        this.memory.data.task_completions[taskId] = {
          ...task, completedAt: new Date().toISOString(),
        };
        this.memory.save();
        this.emit('task:completed', task);
        return task;
      }
    }
    return null;
  }

  _generateReport() {
    const mem    = process.memoryUsage();
    const uptime = Math.round((Date.now() - this.startedAt) / 1000);

    return {
      signature: TROXT_SIGNATURE,
      version:   this.version,
      timestamp: new Date().toISOString(),
      uptime_seconds: uptime,
      cycles:    this.cycles,
      system: {
        heap_used_mb:  Math.round(mem.heapUsed  / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        heap_pct:      Math.round((mem.heapUsed / mem.heapTotal) * 100),
      },
      agents: Object.fromEntries(
        Object.values(this.agents).map(a => [a.id, {
          name:       a.name,
          icon:       a.icon,
          status:     a.status,
          lastSeen:   a.lastSeen ? new Date(a.lastSeen).toISOString() : null,
          errorCount: a.errorCount,
          tasksPending: a.taskQueue.filter(t => t.status === 'pending').length,
        }])
      ),
      recent_decisions: this.memory.data.decisions.slice(0, 10),
      recent_incidents: this.memory.data.incidents.slice(0, 5),
    };
  }

  getReport() { return this._generateReport(); }

  getAgentStatus(agentId) {
    const agent = this.agents[agentId];
    if (!agent) return null;
    return {
      ...agent,
      ws: undefined,
      history: this.memory.getAgentHistory(agentId, 5),
    };
  }

  async forcePing(agentId) {
    const agent = this.agents[agentId];
    if (!agent) return false;
    if (!agent.apiBase) {
      this.logger.info(agent.name, `Agent en développement — ping simulé`);
      agent.lastSeen = Date.now();
      return true;
    }
    return await this._pingAgent(agent);
  }

  shutdown() {
    this.logger.warn('TROXT', 'Arrêt du système...');
    this._pulses.forEach(p => clearInterval(p));
    this.memory.save();
    this.logger.info('TROXT', 'Mémoire sauvegardée. TROXT hors ligne.');
    this.emit('shutdown', { timestamp: new Date().toISOString() });
  }
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
export default Troxt;
export { Troxt, TroxtMemory, TroxtLogger, ETHER_AGENTS, THRESHOLDS };
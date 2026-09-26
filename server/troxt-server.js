/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SERVER/TROXT-SERVER.JS
 * Serveur API, Cerveau Central TROXT & Pont d'événements Lua
 * ═══════════════════════════════════════════════════════════════════
 * Signature : ⬡ TROXT
 * Port      : 4200 (configurable via TROXT_API_PORT ou PORT)
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { TroxtBrain } from './troxt/TroxtBrain.js';
import { Events } from './troxt/troxt_events.js';

dotenv.config();

const SIG  = '⬡ TROXT';
const PORT = parseInt(process.env.TROXT_API_PORT || process.env.PORT || '4200', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server });

// Configuration de la sécurité et des en-têtes CORS
app.use(express.json());
app.use((req, res, next) => {
  const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-TROXT-Key');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ─── AMORÇAGE DU CERVEAU CENTRAL ──────────────────────────────────────────────
async function bootstrap() {
  try {
    if (typeof TroxtBrain.boot === 'function') {
      await TroxtBrain.boot();
    }
    console.log(`[${SIG}] Cerveau initialisé avec succès.`);
  } catch (err) {
    console.error(`[${SIG}] Erreur lors du démarrage du cerveau:`, err);
  }
}

await bootstrap();

// ─── GESTION DE LA DIFFUSION WEBSOCKET ────────────────────────────────────────
const wsClients = new Set();

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, ts: new Date().toISOString(), sig: SIG });
  wsClients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(msg);
    }
  });
}

// Relais des événements du cerveau vers les clients connectés
Events.on('troxt:decision_applied', (d) => broadcast('TROXT_DECISION', d));
Events.on('troxt:mode_changed',     (m) => broadcast('TROXT_MODE',     m));
Events.on('troxt:prediction',       (p) => broadcast('TROXT_PREDICTION', p));
Events.on('troxt:report',           (r) => broadcast('TROXT_REPORT',     r));
Events.on('agent:online',           (a) => broadcast('AGENT_ONLINE',     a));
Events.on('agent:error',            (a) => broadcast('AGENT_ERROR',      a));
Events.on('task:assigned',          (t) => broadcast('TASK_ASSIGNED',    t));
Events.on('task:completed',         (t) => broadcast('TASK_COMPLETED',   t));

// ─── CLIENTS WEBSOCKET DU CERVEAU ─────────────────────────────────────────────
wss.on('connection', (ws) => {
  wsClients.add(ws);

  // Envoi du rapport initial à la connexion
  try {
    ws.send(JSON.stringify({
      type: 'TROXT_HELLO',
      data: typeof TroxtBrain.get_report === 'function' ? TroxtBrain.get_report() : {},
      ts:   new Date().toISOString(),
      sig:  SIG,
    }));
  } catch (e) {
    console.error(`[${SIG}·WS] Erreur envoi rapport initial:`, e.message);
  }

  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'FORCE_DECISION' && typeof TroxtBrain.force_decision === 'function') {
        TroxtBrain.force_decision(msg.action, msg.data, msg.priority);
      } else if (msg.type === 'PING_AGENT' && msg.agentId && typeof TroxtBrain.forcePing === 'function') {
        TroxtBrain.forcePing(msg.agentId).then((ok) => {
          ws.send(JSON.stringify({ type: 'PING_RESULT', agentId: msg.agentId, ok }));
        });
      }
    } catch {
      // Ignorer les messages mal formés
    }
  });
});

// ─── PONT D'ÉVÉNEMENTS LUA (Reçoit les événements des autres services) ─────────
app.post('/lua/emit', (req, res) => {
  const { event, data } = req.body || {};

  if (!event) {
    return res.status(400).json({ error: 'event name required' });
  }

  // Émission directe dans le bus d'événements TROXT
  Events.emit(event, data || {});

  // Notification WebSocket globale
  broadcast('LUA_EVENT', { event, data });

  res.json({ ok: true, received: event, sig: SIG });
});

// ─── API REST D'INSPECTION COGNITIVE ─────────────────────────────────────────

// Rapport complet d'état
app.get('/troxt/report', (_req, res) => {
  res.json(typeof TroxtBrain.get_report === 'function' ? TroxtBrain.get_report() : {});
});

// Diagnostic de santé du cerveau
app.get('/troxt/health', (_req, res) => {
  res.json(typeof TroxtBrain.get_health === 'function' ? TroxtBrain.get_health() : { status: 'online' });
});

// Liste des agents
app.get('/troxt/agents', (_req, res) => {
  const agents = TroxtBrain.agents || {};
  res.json({
    agents: Object.fromEntries(
      Object.entries(agents).map(([id, a]) => [id, {
        id:         a.id,
        name:       a.name,
        icon:       a.icon,
        role:       a.role,
        status:     a.status,
        lastSeen:   a.lastSeen ? new Date(a.lastSeen).toISOString() : null,
        errorCount: a.errorCount || 0,
        tasks:      a.tasks || [],
        taskQueue:  a.taskQueue || [],
      }])
    ),
  });
});

app.get('/troxt/agents/:id', (req, res) => {
  const getStatus = TroxtBrain.getAgentStatus || TroxtBrain.get_agent_status;
  const status = getStatus ? getStatus(req.params.id) : null;
  if (!status) return res.status(404).json({ error: 'Agent inconnu' });
  res.json(status);
});

// Liste des décisions récentes
app.get('/troxt/decisions', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const getDecisions = TroxtBrain.get_decisions || (() => []);
  res.json({ decisions: getDecisions(limit) });
});

// Prédictions actives de l'anti-cheat / moteur
app.get('/troxt/predictions', (_req, res) => {
  const getPredictions = TroxtBrain.get_predictions || (() => []);
  res.json({ predictions: getPredictions() });
});

// Logs récents
app.get('/troxt/logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  const logger = TroxtBrain.logger;
  res.json({ logs: logger && typeof logger.getLast === 'function' ? logger.getLast(limit) : [] });
});

// Mémoire TROXT
app.get('/troxt/memory', (_req, res) => {
  res.json(TroxtBrain.memory ? TroxtBrain.memory.data : {});
});

// Forcer une décision ou une action
app.post('/troxt/decide', (req, res) => {
  const { type, data, priority, action } = req.body || {};
  const actionType = type || action;
  if (!actionType) return res.status(400).json({ error: 'decision type or action required' });

  if (typeof TroxtBrain.force_decision === 'function') {
    TroxtBrain.force_decision(actionType, data, priority);
  }
  res.json({ ok: true, triggered: actionType, sig: SIG });
});

// Assigner une tâche
app.post('/troxt/tasks', (req, res) => {
  const { agentId, description, priority } = req.body;
  if (!agentId || !description) {
    return res.status(400).json({ error: 'agentId et description requis' });
  }
  if (typeof TroxtBrain.assignTask === 'function') {
    const task = TroxtBrain.assignTask(agentId, description, priority || 'normal');
    if (!task) return res.status(404).json({ error: 'Agent inconnu' });
    return res.json({ success: true, task });
  }
  res.status(501).json({ error: 'Non implémenté sur ce module' });
});

// ─── DÉMARRAGE DU SERVEUR DU CERVEAU ──────────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log('');
  console.log(`\x1b[35m[${SIG}] Cerveau Central & Pont Lua Actif\x1b[0m`);
  console.log(`     → REST API  : http://${HOST}:${PORT}/troxt/report`);
  console.log(`     → Pont Lua  : http://${HOST}:${PORT}/lua/emit`);
  console.log(`     → WebSocket : ws://${HOST}:${PORT}`);
  console.log('');
});

// Arrêt propre
const shutdown = async () => {
  console.log(`[${SIG}] Arrêt du serveur en cours...`);
  if (typeof TroxtBrain.shutdown === 'function') {
    await TroxtBrain.shutdown();
  }
  wss.close();
  server.close();
  process.exit(0);
};

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

export default TroxtBrain;
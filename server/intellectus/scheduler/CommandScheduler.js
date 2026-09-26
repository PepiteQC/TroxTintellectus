/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — SCHEDULER/COMMANDSCHEDULER.JS
 * Planificateur de commandes différées et récurrentes
 * ═══════════════════════════════════════════════════════════════════
 * Fonctionnalités :
 *   • schedule(afterMs)      : Exécute une commande après un délai (one-shot)
 *   • scheduleAt(timestamp)  : Exécute à une date précise
 *   • every(intervalMs)      : Commande récurrente périodique
 *   • tick(now)              : Moteur déterministe (testable sans timer)
 *   • start() / stop()       : Pilote automatique avec timer réel
 *   • cancel, pause, resume, list
 *
 * Signature : TROXT⬡
 * Chemin    : server/intellectus/scheduler/CommandScheduler.js
 */

const SIG = 'TROXT⬡';

export class CommandScheduler {
  /**
   * @param {object} options
   * @param {(raw: string, sender: object) => Promise<void>|void} options.runner - Callback d'exécution
   * @param {Function} [options.now=Date.now]                                    - Injecteur temporel
   * @param {number} [options.tickIntervalMs=1000]                               - Fréquence de tick du timer réel
   */
  constructor(options) {
    if (typeof options?.runner !== 'function') {
      throw new Error('[CommandScheduler] Un callback runner est requis.');
    }

    this.runner = options.runner;
    this.now = options.now ?? (() => Date.now());
    this.tickIntervalMs = options.tickIntervalMs ?? 1000;

    this.tasks = new Map();
    this.seq = 0;
    this.timer = null;
    this.sig = SIG;
  }

  // ─────────────────────────────────────────────────────────────────
  //  CRÉATION DE TÂCHES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Planifie une commande après un délai donné en millisecondes.
   */
  schedule(raw, sender, afterMs, label = undefined) {
    return this._create(raw, sender, this.now() + afterMs, null, null, label);
  }

  /**
   * Planifie une commande à un instant précis (timestamp ms).
   */
  scheduleAt(raw, sender, timestamp, label = undefined) {
    return this._create(raw, sender, timestamp, null, null, label);
  }

  /**
   * Planifie une commande récurrente toutes les `intervalMs`.
   * @param {string} raw
   * @param {object} sender
   * @param {number} intervalMs
   * @param {object} [options]
   * @param {number} [options.startAfterMs]
   * @param {number} [options.maxRuns]
   * @param {string} [options.label]
   */
  every(raw, sender, intervalMs, options = {}) {
    const first = this.now() + (options.startAfterMs ?? intervalMs);
    return this._create(
      raw,
      sender,
      first,
      intervalMs,
      options.maxRuns ?? null,
      options.label
    );
  }

  /**
   * Fabrique et enregistre une tâche dans la table interne.
   * @private
   */
  _create(raw, sender, nextRun, intervalMs, maxRuns, label) {
    const task = {
      id: `task_${this.now()}_${this.seq++}`,
      raw,
      sender,
      nextRun,
      intervalMs,
      runCount: 0,
      maxRuns,
      paused: false,
      label,
      createdAt: this.now(),
    };

    this.tasks.set(task.id, task);
    return task;
  }

  // ─────────────────────────────────────────────────────────────────
  //  MOTEUR D'EXÉCUTION (TICK DÉTERMINISTE)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Exécute toutes les tâches arrivées à échéance à l'instant `at`.
   * @param {number} [at=this.now()]
   * @returns {Promise<number>} Nombre de tâches exécutées
   */
  async tick(at = this.now()) {
    let executed = 0;

    for (const task of [...this.tasks.values()]) {
      if (task.paused) continue;
      if (task.nextRun > at) continue;

      // Exécution sécurisée (une erreur n'interrompt pas les autres tâches)
      try {
        await this.runner(task.raw, task.sender);
      } catch (err) {
        console.error(`[${SIG}·Scheduler] Erreur tâche ${task.id} (${task.raw}):`, err?.message);
      }

      task.runCount++;
      executed++;

      const reachedMax = task.maxRuns !== null && task.runCount >= task.maxRuns;

      if (task.intervalMs === null || reachedMax) {
        this.tasks.delete(task.id);
      } else {
        // Recale l'exécution au créneau strictement futur suivant
        let next = task.nextRun + task.intervalMs;
        while (next <= at) next += task.intervalMs;
        task.nextRun = next;
      }
    }

    return executed;
  }

  // ─────────────────────────────────────────────────────────────────
  //  TIMER RÉEL
  // ─────────────────────────────────────────────────────────────────

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.tickIntervalMs);

    // Empêche le timer de bloquer la fermeture du process Node.js
    if (typeof this.timer?.unref === 'function') {
      this.timer.unref();
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  GESTION & CONTRÔLE
  // ─────────────────────────────────────────────────────────────────

  cancel(id) {
    return this.tasks.delete(id);
  }

  pause(id) {
    const t = this.tasks.get(id);
    if (!t) return false;
    t.paused = true;
    return true;
  }

  resume(id) {
    const t = this.tasks.get(id);
    if (!t) return false;
    t.paused = false;
    return true;
  }

  get(id) {
    return this.tasks.get(id);
  }

  getTasks() {
    return this.list();
  }

  list() {
    return Array.from(this.tasks.values()).sort((a, b) => a.nextRun - b.nextRun);
  }

  clear() {
    this.tasks.clear();
  }
}

export default CommandScheduler;
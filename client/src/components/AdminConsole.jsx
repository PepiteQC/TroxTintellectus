/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — COMPONENTS/ADMINCONSOLE.JSX  (v2.0 Platinum Edition)
 * Console interactive d'administration en jeu (In-Game Terminal)
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/src/components/AdminConsole.jsx
 */

import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Terminal, Send, Trash2, HelpCircle, CheckCircle2, AlertTriangle,
  ShieldAlert, UserX, Ban, Gift, Zap, CornerDownLeft, Search,
  ChevronUp, ChevronDown, Command
} from 'lucide-react';
import {
  getAllAdminCommands,
  parseAndExecuteAdminCommand,
  subscribeAuditLogs,
} from '../server/admin/commands/AdminCommandSystem.js';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES DE SÉCURITÉ ET FORMATAGE
// ═══════════════════════════════════════════════════════════════════

const SENSITIVE_COMMANDS = Object.freeze([
  'ban', 'kick', 'clearprops', 'clear', 'wipe', 'reset', 'killall',
  'kickall', 'unban', 'lockout', 'poweroutage', 'mod:ban', 'mod:kick',
  'restart', 'shutdown', 'nuke', 'spawnevent', 'apocalypse'
]);

const CATEGORIES = Object.freeze([
  'all', 'moderation', 'player', 'gmod', 'teleport',
  'economy', 'world', 'system', 'security'
]);

const MAX_HISTORY = 50;
const MAX_LOGS_RENDERED = 200;

// ═══════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} AdminConsoleProps
 * @property {any} [manager]                                   - Instance GameManager si disponible
 * @property {(cmd: string, args: string[]) => void} [onAdminCommand] - Handler externe
 * @property {string} [executorName]                           - Nom de l'admin
 * @property {'moderator'|'admin'|'superadmin'|'owner'} [executorRole] - Rôle
 * @property {string} [executorId]                             - Session ID
 */

/** @param {AdminConsoleProps} props */
export const AdminConsole = ({
  manager,
  onAdminCommand,
  executorName = 'Admin',
  executorRole = 'superadmin',
  executorId = 'admin_session',
}) => {
  // ─── ÉTATS ─────────────────────────────────────────────────────────
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [pendingConfirmationCmd, setPendingConfirmationCmd] = useState(null);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);

  // ─── RÉFÉRENCES ────────────────────────────────────────────────────
  const logEndRef = useRef(null);
  const inputRef = useRef(null);
  const logContainerRef = useRef(null);
  const tabCycleRef = useRef({ prefix: '', index: 0, matches: [] });

  // ═════════════════════════════════════════════════════════════════
  // SOUSCRIPTION AUX LOGS D'AUDIT (RÉACTIF)
  // ═════════════════════════════════════════════════════════════════
  useEffect(() => {
    const unsubscribe = subscribeAuditLogs((auditLogs) => {
      const consoleLogs = auditLogs.map((a) => ({
        id: a.id,
        timestamp: a.timestamp,
        command: a.command,
        result: {
          success: a.success,
          message: a.message,
        },
        executor: a.executor,
        category: a.category || 'system',
      }));
      // Limite d'affichage anti-freeze (garde uniquement les N plus récents)
      setLogs(consoleLogs.slice(0, MAX_LOGS_RENDERED));
    });
    return () => unsubscribe();
  }, []);

  // ═════════════════════════════════════════════════════════════════
  // AUTO-SCROLL INTELLIGENT (respecte le scroll manuel)
  // ═════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [logs, autoScroll]);

  // Détecte si l'utilisateur défile manuellement pour désactiver l'auto-scroll
  const handleScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // ═════════════════════════════════════════════════════════════════
  // DÉTECTION DES COMMANDES SENSIBLES
  // ═════════════════════════════════════════════════════════════════
  const isSensitiveCommand = useCallback((cmdText) => {
    const trimmed = cmdText.trim().toLowerCase();
    const clean = trimmed.startsWith('/') || trimmed.startsWith('!')
      ? trimmed.substring(1)
      : trimmed;
    const name = clean.split(/\s+/)[0];
    return SENSITIVE_COMMANDS.includes(name);
  }, []);

  // ═════════════════════════════════════════════════════════════════
  // MOTEUR D'EXÉCUTION (DIRECT & AVEC CONFIRMATION)
  // ═════════════════════════════════════════════════════════════════
  const executeCommandDirectly = useCallback((cmdText) => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;

    let fullCmd = trimmed;
    if (!fullCmd.startsWith('/') && !fullCmd.startsWith('!')) {
      fullCmd = '/' + fullCmd;
    }

    const parts = fullCmd.substring(1).trim().split(/\s+/);
    const cmdName = parts[0];
    const args = parts.slice(1);

    // Enregistre dans l'historique navigable (sans doublon consécutif)
    setCommandHistory((prev) => {
      if (prev[0] === fullCmd) return prev;
      const next = [fullCmd, ...prev].slice(0, MAX_HISTORY);
      return next;
    });
    setHistoryIndex(-1);

    // Exécute la commande
    let result;

    if (manager && typeof manager.executeConsoleCommand === 'function') {
      result = manager.executeConsoleCommand(fullCmd);
    } else {
      result = parseAndExecuteAdminCommand(fullCmd, {
        executorName,
        executorRole,
        executorId,
        addLog: (msg) => console.log(`[${SIG}·AdminLog]`, msg),
      });
    }

    // Callback externe (pour intégration avec le serveur multi-joueur)
    if (typeof onAdminCommand === 'function') {
      onAdminCommand(cmdName, args);
    }

    // Ajout instantané au journal (sans attendre le subscribe)
    const newLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }),
      command: fullCmd,
      result: result || { success: false, message: 'Aucune réponse du système.' },
      executor: executorName,
      category: 'system',
    };
    setLogs((prev) => [newLog, ...prev].slice(0, MAX_LOGS_RENDERED));
  }, [manager, executorName, executorRole, executorId, onAdminCommand]);

  const executeCommand = useCallback((cmdText) => {
    if (isSensitiveCommand(cmdText)) {
      setPendingConfirmationCmd(cmdText);
      return;
    }
    executeCommandDirectly(cmdText);
  }, [isSensitiveCommand, executeCommandDirectly]);

  const handleFormSubmit = useCallback((e) => {
    e.preventDefault();
    if (!input.trim()) return;
    executeCommand(input);
    setInput('');
    tabCycleRef.current = { prefix: '', index: 0, matches: [] };
  }, [input, executeCommand]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // ═════════════════════════════════════════════════════════════════
  // NAVIGATION HISTORIQUE + AUTOCOMPLETION TAB
  // ═════════════════════════════════════════════════════════════════
  const allCmds = useMemo(() => getAllAdminCommands(), []);

  const handleKeyDown = useCallback((e) => {
    // Historique navigable (↑ / ↓)
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const newIdx = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(newIdx);
      setInput(commandHistory[newIdx]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setInput('');
        return;
      }
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setInput(commandHistory[newIdx]);
      return;
    }

    // Autocomplétion Tab (cycle intelligent)
    if (e.key === 'Tab') {
      e.preventDefault();
      const query = input.replace(/^[/!]/, '').split(/\s+/)[0].toLowerCase();
      if (!query) return;

      // Rebuild du cycle si l'input a changé
      if (tabCycleRef.current.prefix !== query) {
        const matches = allCmds
          .filter((c) => c.name.toLowerCase().startsWith(query))
          .map((c) => c.name);
        tabCycleRef.current = { prefix: query, index: 0, matches };
      } else {
        tabCycleRef.current.index =
          (tabCycleRef.current.index + 1) % tabCycleRef.current.matches.length;
      }

      const match = tabCycleRef.current.matches[tabCycleRef.current.index];
      if (match) {
        const prefix = input.startsWith('!') ? '!' : '/';
        setInput(`${prefix}${match} `);
      }
      return;
    }

    // Ctrl+L : Effacer la console (comme dans un terminal Unix)
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      clearLogs();
      return;
    }

    // Escape : Ferme la modale de confirmation
    if (e.key === 'Escape' && pendingConfirmationCmd) {
      e.preventDefault();
      setPendingConfirmationCmd(null);
    }
  }, [input, historyIndex, commandHistory, allCmds, clearLogs, pendingConfirmationCmd]);

  // ═════════════════════════════════════════════════════════════════
  // FILTRAGE DES LOGS (MÉMOISATION)
  // ═════════════════════════════════════════════════════════════════
  const filteredLogs = useMemo(() => {
    if (!logSearchQuery.trim()) return logs;
    const q = logSearchQuery.toLowerCase().trim();
    return logs.filter((log) =>
      log.executor.toLowerCase().includes(q) ||
      log.command.toLowerCase().includes(q) ||
      log.result.message.toLowerCase().includes(q)
    );
  }, [logs, logSearchQuery]);

  const filteredCmds = useMemo(() => {
    if (selectedCategory === 'all') return allCmds;
    return allCmds.filter((c) => c.category === selectedCategory);
  }, [allCmds, selectedCategory]);

  // ═════════════════════════════════════════════════════════════════
  // RENDU
  // ═════════════════════════════════════════════════════════════════
  return (
    <div
      className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden font-mono shadow-2xl"
      role="region"
      aria-label="Console d'administration TROXT⬡"
    >
      {/* HEADER */}
      <ConsoleHeader
        executorName={executorName}
        executorRole={executorRole}
        onHelp={() => executeCommand('/help')}
        onClear={clearLogs}
      />

      {/* RACCOURCIS RAPIDES */}
      <QuickBar setInput={setInput} executeCommand={executeCommand} />

      {/* FILTRE DE RECHERCHE */}
      <SearchBar
        value={logSearchQuery}
        onChange={setLogSearchQuery}
      />

      {/* JOURNAL DES LOGS */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs text-slate-200 select-text"
      >
        {filteredLogs.length === 0 ? (
          <EmptyState hasSearch={!!logSearchQuery} hasLogs={logs.length > 0} />
        ) : (
          filteredLogs.map((log) => <LogEntry key={log.id} log={log} />)
        )}
        <div ref={logEndRef} />
      </div>

      {/* INDICATEUR DE PAUSE AUTO-SCROLL */}
      {!autoScroll && logs.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-32 right-6 z-10 px-3 py-1.5 bg-cyan-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-cyan-500 transition animate-bounce flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronDown className="w-3 h-3" />
          Nouveaux logs
        </button>
      )}

      {/* SÉLECTEUR DE CATÉGORIE */}
      <CategorySelector
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* SUGGESTIONS RAPIDES DES COMMANDES */}
      <SuggestionChips
        commands={filteredCmds.slice(0, 15)}
        onSelect={(name) => {
          setInput(`/${name} `);
          inputRef.current?.focus();
        }}
      />

      {/* FORMULAIRE DE SAISIE */}
      <form onSubmit={handleFormSubmit} className="bg-slate-900 p-3 border-t border-slate-800 flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5 text-cyan-400 font-black text-xs pointer-events-none">
            &gt;
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (historyIndex !== -1) setHistoryIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tapez une commande (ex: /kick player1, /tp spawn, /god)... [↑↓ historique · Tab autocompléter]"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-xs text-cyan-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition font-mono"
            autoFocus
            aria-label="Champ de commande"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-lg shadow-cyan-950"
          aria-label="Lancer la commande"
        >
          <span>Lancer</span>
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* MODAL DE CONFIRMATION SENSIBLE */}
      {pendingConfirmationCmd && (
        <ConfirmationModal
          command={pendingConfirmationCmd}
          onCancel={() => setPendingConfirmationCmd(null)}
          onConfirm={() => {
            const cmdToRun = pendingConfirmationCmd;
            setPendingConfirmationCmd(null);
            executeCommandDirectly(cmdToRun);
          }}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS MÉMOISÉS (Performance ↑)
// ═══════════════════════════════════════════════════════════════════

const ConsoleHeader = memo(({ executorName, executorRole, onHelp, onClear }) => (
  <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
        <Terminal className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
          Console d'Administration TROXT⬡
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        </h3>
        <p className="text-[10px] text-slate-400">
          Exécuteur: <span className="text-cyan-300 font-bold">{executorName}</span>
          <span className="text-slate-600 mx-1">·</span>
          <span className="text-amber-300">{executorRole?.toUpperCase()}</span>
        </p>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <button
        onClick={onHelp}
        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition flex items-center gap-1 cursor-pointer"
        title="Afficher l'aide générale"
      >
        <HelpCircle className="w-3 h-3 text-cyan-400" /> Aide
      </button>
      <button
        onClick={onClear}
        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition cursor-pointer"
        title="Effacer la console (Ctrl+L)"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
));
ConsoleHeader.displayName = 'ConsoleHeader';

const QuickBar = memo(({ setInput, executeCommand }) => (
  <div className="bg-slate-900/40 px-3 py-2 border-b border-slate-800/80 flex flex-wrap items-center gap-2 text-[10px]">
    <span className="text-slate-500 font-bold uppercase text-[9px]">Raccourcis :</span>

    <QuickButton icon={UserX} label="/kick [id]" onClick={() => setInput('/kick ')}
      color="amber" />
    <QuickButton icon={Ban} label="/ban [id]" onClick={() => setInput('/ban ')}
      color="rose" />
    <QuickButton icon={Gift} label="/giveitem [item]" onClick={() => setInput('/giveitem ')}
      color="purple" />
    <QuickButton icon={Zap} label="/god (Toggle)" onClick={() => executeCommand('/god')}
      color="emerald" />
    <QuickButton icon={null} label="❤️ /heal" onClick={() => executeCommand('/heal')}
      color="blue" />
    <QuickButton icon={null} label="🧹 /clearprops" onClick={() => executeCommand('/clearprops')}
      color="slate" />
  </div>
));
QuickBar.displayName = 'QuickBar';

const QuickButton = memo(({ icon: Icon, label, onClick, color }) => {
  const colors = {
    amber:   'bg-amber-950/60 hover:bg-amber-900 text-amber-300 border-amber-800/60',
    rose:    'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-800/60',
    purple:  'bg-purple-950/60 hover:bg-purple-900 text-purple-300 border-purple-800/60',
    emerald: 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-800/60',
    blue:    'bg-blue-950/60 hover:bg-blue-900 text-blue-300 border-blue-800/60',
    slate:   'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700',
  };
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 border rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${colors[color] || colors.slate}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
});
QuickButton.displayName = 'QuickButton';

const SearchBar = memo(({ value, onChange }) => (
  <div className="bg-slate-900/60 px-3 py-1.5 border-b border-slate-800/80 flex items-center gap-2">
    <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Filtrer les logs par exécuteur, commande ou message..."
      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-cyan-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="text-xs font-bold text-slate-500 hover:text-slate-300 px-1 cursor-pointer"
        title="Effacer le filtre"
      >
        ✕
      </button>
    )}
  </div>
));
SearchBar.displayName = 'SearchBar';

const LogEntry = memo(({ log }) => (
  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1 hover:border-slate-700 transition">
    <div className="flex items-center justify-between text-[10px] text-slate-500">
      <span className="text-cyan-400 font-bold">
        [{log.timestamp}] {log.executor}:
      </span>
      <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-slate-300 border border-slate-800 max-w-[60%] truncate">
        {log.command}
      </span>
    </div>
    <div className={`text-xs whitespace-pre-wrap leading-relaxed flex items-start gap-2 ${
      log.result.success ? 'text-emerald-300' : 'text-rose-400'
    }`}>
      {log.result.success ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
      )}
      <div className="flex-1">{log.result.message}</div>
    </div>
  </div>
));
LogEntry.displayName = 'LogEntry';

const EmptyState = memo(({ hasSearch, hasLogs }) => (
  <div className="text-center py-12 text-slate-600 italic text-xs flex flex-col items-center gap-3">
    <Command className="w-8 h-8 text-slate-800" />
    {hasSearch
      ? 'Aucune entrée ne correspond à votre filtre de recherche.'
      : hasLogs
        ? 'Aucune correspondance dans les logs actuels.'
        : "Le journal de la console est vide. Entrez une commande ci-dessous pour commencer."}
  </div>
));
EmptyState.displayName = 'EmptyState';

const CategorySelector = memo(({ selected, onSelect }) => (
  <div className="bg-slate-900/80 px-3 py-1.5 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[9.5px]">
    <span className="text-slate-500 uppercase font-bold shrink-0">Catégories:</span>
    {CATEGORIES.map((cat) => (
      <button
        key={cat}
        onClick={() => onSelect(cat)}
        className={`px-2 py-0.5 rounded-md font-bold uppercase transition shrink-0 cursor-pointer ${
          selected === cat
            ? 'bg-cyan-600 text-white'
            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
        }`}
      >
        {cat}
      </button>
    ))}
  </div>
));
CategorySelector.displayName = 'CategorySelector';

const SuggestionChips = memo(({ commands, onSelect }) => (
  <div className="bg-slate-950 px-3 py-2 border-t border-slate-900 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
    {commands.length === 0 ? (
      <span className="text-[10px] text-slate-700 italic px-2 py-0.5">
        Aucune commande dans cette catégorie
      </span>
    ) : (
      commands.map((cmd) => (
        <button
          key={cmd.id || cmd.name}
          onClick={() => onSelect(cmd.name)}
          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 hover:text-cyan-200 text-[10px] font-mono transition flex items-center gap-1 cursor-pointer"
          title={`${cmd.description}\nUsage: ${cmd.usage}`}
        >
          <span>/{cmd.name}</span>
        </button>
      ))
    )}
  </div>
));
SuggestionChips.displayName = 'SuggestionChips';

const ConfirmationModal = memo(({ command, onCancel, onConfirm }) => (
  <div
    className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onClick={onCancel}
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
  >
    <div
      className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 text-left font-mono"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <div className="w-9 h-9 rounded-xl bg-rose-950 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h3 id="confirm-title" className="text-sm font-black text-rose-300 uppercase tracking-wide">
            Êtes-vous sûr ?
          </h3>
          <p className="text-[10px] text-slate-400">Confirmation d'action d'administration sensible</p>
        </div>
      </div>

      <div className="space-y-2 text-xs text-slate-200">
        <p className="font-sans font-medium text-slate-300">
          Voulez-vous vraiment exécuter la commande suivante ?
        </p>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-cyan-300 font-mono font-bold break-words">
          {command}
        </div>
        <p className="text-[10.5px] text-rose-400/90 italic font-sans">
          ⚠️ Cette action aura un impact direct et irréversible sur le joueur ou l'état du serveur.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
          autoFocus
        >
          Annuler (Esc)
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:brightness-110 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-950/50 transition cursor-pointer flex items-center gap-1.5"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Confirmer et exécuter</span>
        </button>
      </div>
    </div>
  </div>
));
ConfirmationModal.displayName = 'ConfirmationModal';

// ═══════════════════════════════════════════════════════════════════
// EXPORT PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════
export default AdminConsole;
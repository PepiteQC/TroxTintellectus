/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — COMPONENTS/ADMINCONSOLEUI.JSX (v2.1 Platinum Edition)
 * Interface Terminal somptueuse et performante pour l'Administration
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/src/components/AdminConsoleUI.jsx
 */

import React, { useEffect, useRef, useState, useCallback, memo } from "react";

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION DE DESIGN & COULEURS
// ═══════════════════════════════════════════════════════════════════

const LINE_COLORS = Object.freeze({
  input:   "text-cyan-400 font-bold selection:bg-cyan-500/30",
  success: "text-emerald-400 selection:bg-emerald-500/30",
  error:   "text-rose-400 font-semibold selection:bg-rose-500/30 animate-pulse",
  warn:    "text-amber-400 selection:bg-amber-500/30",
  info:    "text-cyan-300 selection:bg-cyan-500/30",
  system:  "text-slate-500 selection:bg-slate-500/30 italic",
});

const makeId = () => `line_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// ═══════════════════════════════════════════════════════════════════
// HOOK DE CONSOLE: useAdminConsole
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook personnalisé orchestrant l'état interne et les flux d'entrées/sorties du terminal.
 * @param {object} options
 * @param {function(string): Promise<{success: boolean, message: string}>} options.onCommand - Exécuteur
 * @param {function(): string|null} [options.getHistoryPrevious] - Historique précédent
 * @param {function(): string|null} [options.getHistoryNext]     - Historique suivant
 * @param {function(string): {input: string, suggestions: string[], hint: string}} [options.onComplete] - Autocomplétion Tab
 * @param {string[]} [options.welcome] - Lignes de démarrage personnalisé
 */
export function useAdminConsole(options = {}) {
  const { onCommand, getHistoryPrevious, getHistoryNext, onComplete, welcome } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [lines, setLines] = useState(() => {
    const defaultWelcome = [
      "  ╔══════════════════════════════════════════════╗",
      `  ║   ${SIG} CONSOLE ADMIn — ÉTHER PLAZA         ║`,
      "  ╚══════════════════════════════════════════════╝",
      'Tapez "help" ou "h" pour afficher les commandes autorisées.',
      "--------------------------------------------------",
    ];
    return (welcome || defaultWelcome).map((text) => ({
      id: makeId(),
      type: "system",
      text,
      time: Date.now(),
    }));
  });
  const [commandCount, setCommandCount] = useState(0);

  // Injection sécurisée de lignes de texte dans la sortie
  const pushLine = useCallback((type, text) => {
    if (typeof text !== "string") return;
    setLines((prev) => [
      ...prev,
      ...text.split("\n").map((t) => ({
        id: makeId(),
        type,
        text: t,
        time: Date.now(),
      })),
    ]);
  }, []);

  const open  = useCallback(() => { setIsOpen(true); setIsMinimized(false); }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle= useCallback(() => setIsOpen((v) => !v), []);
  const clear = useCallback(() => setLines([]), []);

  const run = useCallback(async (raw) => {
    const value = raw.trim();
    if (!value) return;

    pushLine("input", `> ${value}`);
    setCommandCount((c) => c + 1);

    // Commandes système rapides d'évacuation de la vue
    if (value === "clear" || value === "cls") {
      clear();
      return;
    }

    try {
      const res = await onCommand(value);
      pushLine(res.success ? "success" : "error", res.message);
    } catch (err) {
      pushLine("error", err instanceof Error ? err.message : "Échec critique d'exécution réseau.");
    }
  }, [onCommand, pushLine, clear]);

  return {
    isOpen,
    isMinimized,
    lines,
    commandCount,
    open,
    close,
    toggle,
    clear,
    run,
    pushLine,
    setIsMinimized,
    getHistoryPrevious,
    getHistoryNext,
    onComplete,
  };
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSANT COMPAGNON INDIVIDUEL ET MÉMOISÉ
// ═══════════════════════════════════════════════════════════════════

const ConsoleLine = memo(({ line }) => (
  <div className={`whitespace-pre-wrap break-words transition-colors ${LINE_COLORS[line.type] || "text-white"}`}>
    {line.text}
  </div>
));
ConsoleLine.displayName = "ConsoleLine";

// ═══════════════════════════════════════════════════════════════════
// COMPOSANT TERMINAL PRINCIPAL: AdminConsoleUI
// ═══════════════════════════════════════════════════════════════════

/** @param {{ console: ReturnType<typeof useAdminConsole>, title?: string }} props */
export const AdminConsoleUI = ({
  console: c,
  title = "ADMIN CONSOLE",
}) => {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const outputRef = useRef(null);

  // Défilement automatique vers le bas à chaque log supplémentaire
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [c.lines]);

  // Focus immédiat de l'input à l'ouverture
  useEffect(() => {
    if (c.isOpen && !c.isMinimized) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [c.isOpen, c.isMinimized]);

  const handleKeyDown = (e) => {
    switch (e.key) {
      case "Enter": {
        e.preventDefault();
        const value = input;
        setInput("");
        void c.run(value);
        break;
      }
      case "Escape": {
        e.preventDefault();
        c.close();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = c.getHistoryPrevious?.();
        if (prev !== null && prev !== undefined) setInput(prev);
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        const next = c.getHistoryNext?.();
        if (next !== null && next !== undefined) setInput(next);
        break;
      }
      case "Tab": {
        e.preventDefault();
        if (c.onComplete) {
          const res = c.onComplete(input);
          setInput(res.input);
          
          if (Array.isArray(res.suggestions) && res.suggestions.length > 1) {
            c.pushLine("system", res.suggestions.join("   "));
          }
          if (res.hint) {
            c.pushLine("info", res.hint);
          }
        }
        break;
      }
    }
  };

  if (!c.isOpen) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/95 font-mono text-xs shadow-2xl shadow-black/80 backdrop-blur-md transition-all duration-200"
      style={{
        width: c.isMinimized ? 280 : 640,
        height: c.isMinimized ? 44 : 420,
      }}
    >
      {/* BARRE DE CONTROLE D'EN-TETE */}
      <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-900/90 px-3 py-2.5 select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
          <span className="font-bold tracking-wider text-zinc-200 uppercase text-[10px]">
            {title}
          </span>
          <span className="ml-2 rounded bg-zinc-850 border border-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500 font-semibold">
            {c.commandCount} CMD EXEC
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => c.setIsMinimized(!c.isMinimized)}
            className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800/40 border border-zinc-800 hover:bg-zinc-700/80 text-zinc-400 hover:text-white transition cursor-pointer"
            title={c.isMinimized ? "Maximiser" : "Minimiser"}
          >
            {c.isMinimized ? "▢" : "—"}
          </button>
          <button
            type="button"
            onClick={c.close}
            className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800/40 border border-zinc-800 hover:bg-rose-900/80 hover:border-rose-700 text-zinc-400 hover:text-rose-200 transition cursor-pointer"
            title="Fermer la console (ESC)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ZONE TERMINAL & SAISIE (SI NON MINIMISE) */}
      {!c.isMinimized && (
        <>
          {/* SORTIE FLUX DES LOGS */}
          <div
            ref={outputRef}
            className="flex-1 space-y-1 overflow-y-auto px-4 py-3 leading-relaxed border-b border-zinc-900"
          >
            {c.lines.map((line) => (
              <ConsoleLine key={line.id} line={line} />
            ))}
          </div>

          {/* CHAMP DE SAISIE DE COMMANDE */}
          <div className="flex items-center gap-2 bg-zinc-900/60 px-4 py-2.5">
            <span className="text-emerald-500 font-black select-none text-sm">$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
              placeholder='Saisissez votre commande admin... ("help")'
              className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-700 outline-none caret-cyan-400 font-bold"
              aria-label="Terminal de commande"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminConsoleUI;
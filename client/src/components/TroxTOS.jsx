/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — COMPONENTS/TROXTOS.JSX (v3.0 Platinum Edition)
 * Interface Système d'Exploitation Virtuelle EtherOS / TroxTOS
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 * Chemin    : client/src/components/TroxTOS.jsx
 */

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { X, Terminal, Cpu, Folder } from "lucide-react";

const SIG = 'TROXT⬡';

// ─── COMPOSANT LIGNE DE TERMINAL MÉMOISÉ ─────────────────────────────────────
const TerminalLine = memo(({ line }) => {
  const isInput = line.startsWith("root@");
  const isOk = line.startsWith("[OK]");
  return (
    <div className="leading-relaxed">
      {isInput ? (
        <span className="text-cyan-400 font-bold">{line}</span>
      ) : isOk ? (
        <span className="text-emerald-400">{line}</span>
      ) : (
        <span>{line}</span>
      )}
    </div>
  );
});
TerminalLine.displayName = "TerminalLine";

// ─── COMPOSANT DE MODULE D'APPLICATION RÉACTIF ───────────────────────────────
const AppCard = memo(({ app, onNavigate, onClose }) => (
  <div
    onClick={() => {
      onNavigate(app.id);
      onClose();
    }}
    className={`p-4 rounded-xl bg-gradient-to-br ${app.color} border hover:scale-105 transition-all cursor-pointer group`}
  >
    <div className="text-3xl mb-2">{app.icon}</div>
    <div className="text-sm font-bold text-white font-mono group-hover:text-cyan-300 transition-colors">
      {app.title}
    </div>
    <div className="text-[10px] text-slate-400 font-mono mt-1">{app.desc}</div>
  </div>
));
AppCard.displayName = "AppCard";

// ─── COMPOSANT PRINCIPAL DE L'OS ─────────────────────────────────────────────
export default function TroxTOS({ onClose, onNavigate }) {
  const [activeTab, setActiveTab] = useState("terminal");
  const [terminalHistory, setTerminalHistory] = useState([
    "EtherOS Kernel v5.0.4-NEURAL [x86_64]",
    "System initialisé. Type 'help' pour les commandes disponibles.",
  ]);
  const [input, setInput] = useState("");
  const terminalRef = useRef(null);

  // Auto-scroll du terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  const handleCommand = useCallback((cmd) => {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;

    setTerminalHistory((prev) => [...prev, `root@etheros:~# ${cleanCmd}`]);

    const parts = cleanCmd.split(" ");
    const mainCmd = parts[0].toLowerCase();

    switch (mainCmd) {
      case "help":
        setTerminalHistory((prev) => [
          ...prev,
          "Commandes disponibles :",
          "  apps        - Liste des applications système",
          "  status      - Statut des services EtherWorld",
          "  clear       - Effacer le terminal",
          "  open <app>  - Lancer un module (ex: open forge)",
          "  reboot      - Redémarrer EtherOS",
        ]);
        break;
      case "apps":
        setTerminalHistory((prev) => [
          ...prev,
          "Modules disponibles :",
          "  - intellectus (Neural Dashboard)",
          "  - forge       (3D World Editor)",
          "  - builder     (3D Scene Builder)",
          "  - mod3d       (3D Character Creator)",
          "  - prisma      (QBCore Database Manager)",
        ]);
        break;
      case "status":
        setTerminalHistory((prev) => [
          ...prev,
          "[OK] PostgreSQL DB: Connecté (0.4ms)",
          "[OK] ThreeJS Engine: Initialisé (60 FPS)",
          "[OK] Cerveau Central TROXT⬡: En ligne (ACTIVE)",
          "[OK] ThirdEye Security: Actif",
        ]);
        break;
      case "open": {
        const target = parts[1]?.toLowerCase();
        const routes = {
          forge:       "ether-forge",
          intellectus: "intellectus",
          builder:     "builder",
          mod3d:       "troxtmod3d",
          prisma:      "ether-prisma"
        };
        if (routes[target]) {
          onNavigate(routes[target]);
          onClose();
        } else {
          setTerminalHistory((prev) => [...prev, `App inconnue: "${target}". Tapez 'apps' pour la liste.`]);
        }
        break;
      }
      case "clear":
        setTerminalHistory([]);
        break;
      case "reboot":
        setTerminalHistory(["Redémarrage d'EtherOS..."]);
        setTimeout(() => {
          setTerminalHistory([
            "EtherOS Kernel v5.0.4-NEURAL [x86_64]",
            "System initialisé.",
          ]);
        }, 1000);
        break;
      default:
        setTerminalHistory((prev) => [...prev, `Commande non reconnue: "${mainCmd}". Tapez 'help'.`]);
    }
    setInput("");
  }, [onNavigate, onClose]);

  return (
    <div className="fixed inset-8 z-50 bg-[#060913]/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_80px_rgba(0,212,255,0.2)] flex flex-col overflow-hidden backdrop-blur-2xl animate-fade-in font-mono">
      
      {/* Titlebar */}
      <div className="h-10 bg-[#090e1f] border-b border-cyan-500/20 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 cursor-pointer hover:brightness-110" onClick={onClose} />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-white tracking-wider">
            EtherOS Neural Environment v5.0
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main OS Window Body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-48 bg-[#04060f] border-r border-slate-800/80 p-3 flex flex-col gap-1 shrink-0 text-xs">
          {[
            { id: "terminal", label: "Terminal", icon: <Terminal className="w-3.5 h-3.5" /> },
            { id: "apps", label: "Applications", icon: <Folder className="w-3.5 h-3.5" /> },
            { id: "system", label: "Système", icon: <Cpu className="w-3.5 h-3.5" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === item.id
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          <div className="mt-auto p-3 bg-cyan-500/5 border border-cyan-500/15 rounded-xl">
            <div className="text-[9px] font-bold text-cyan-400 uppercase">Status Kernel</div>
            <div className="text-[10px] text-slate-400 mt-1">CPU: 2.4%</div>
            <div className="text-[10px] text-slate-400">RAM: 412 MB</div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#060913]">
          
          {/* TERMINAL TAB */}
          {activeTab === "terminal" && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden text-xs">
              <div ref={terminalRef} className="flex-1 overflow-y-auto space-y-1.5 text-slate-300 select-text">
                {terminalHistory.map((line, idx) => (
                  <TerminalLine key={idx} line={line} />
                ))}
              </div>

              {/* Terminal Input */}
              <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800">
                <span className="text-cyan-400 font-bold">root@etheros:~#</span>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCommand(input)}
                  className="flex-1 bg-transparent text-cyan-300 outline-none text-xs font-mono"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* APPS TAB */}
          {activeTab === "apps" && (
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto">
              {[
                { id: "intellectus", title: "Intellectus", desc: "Neural Dashboard", icon: "⚡", color: "from-purple-500/20 to-indigo-500/20 border-purple-500/30" },
                { id: "ether-forge", title: "EtherForge", desc: "Éditeur 3D Temps Réel", icon: "🔥", color: "from-red-500/20 to-orange-500/20 border-red-500/30" },
                { id: "builder", title: "Builder 3D", desc: "Éditeur de Scène 3D", icon: "⚒️", color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30" },
                { id: "troxtmod3d", title: "TroxTMOD3D", desc: "Créateur de Personnages 3D", icon: "👤", color: "from-fuchsia-500/20 to-purple-500/20 border-fuchsia-500/30" },
                { id: "trox3d", title: "TroxTWorld 3D", desc: "Monde RP GTA Sandbox", icon: "🌐", color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30" },
                { id: "ether-prisma", title: "EtherPrisma", desc: "FiveM QBCore Manager", icon: "💎", color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30" },
              ].map((app) => (
                <AppCard key={app.id} app={app} onNavigate={onNavigate} onClose={onClose} />
              ))}
            </div>
          )}

          {/* SYSTEM TAB */}
          {activeTab === "system" && (
            <div className="p-6 space-y-4 text-xs">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
                <div className="text-cyan-400 font-bold">EtherOS Architecture</div>
                <div className="text-slate-400">Kernel Version: 5.0.4-NEURAL (JS)</div>
                <div className="text-slate-400">Render Pipeline: ThreeJS WebGL sRGB</div>
                <div className="text-slate-400">Database Engine: TroxtPrism / PostgreSQL Drizzle</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
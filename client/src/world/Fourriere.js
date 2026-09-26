/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — WORLD/FOURRIERE.JS (v3.0 Platinum Edition)
 * Fourrière municipale de Portneuf — Saisies SAAQ, SQ & Régie Voix
 * ═══════════════════════════════════════════════════════════════════
 * Gère le parc de saisie des véhicules du comté :
 *  • Tarification légale (Art. 202 CSR, stationnement, défaut d'assurance)
 *  • Calcul d'amortissement journalier des frais de garde
 *  • Rendu 3D de la cour municipale de saisie et de la remorqueuse (Three.js)
 *  • Interface React (HUD) d'amende et de libération Desjardins
 *
 * Signature : TROXT⬡ · 🚧ImpoundLot
 * Chemin    : client/src/world/Fourriere.js
 */

import React, { useMemo, useCallback } from "react";
import * as THREE from "three";
import { Landmark, Lock, Truck, X } from "lucide-react";

import { matLib, QC_PALETTE } from "./materials.js";
import { buildRemorqueuse, buildSedan } from "./architecture.js";
import { fleetById, isVehicleId } from "./fleet.js";
import { LOCAL_PLAYER_ID } from "./adminPerms.js";
import { FOURRIERE } from "./worlddata.js";
import { formatCad } from "./commerce.js";
import { persist, useGameStore } from "./store.js";

const SIG = 'TROXT⬡';

// ─── TYPES & GRILLES TARIFAIRES (FROZEN) ─────────────────────────────────────

export const REASON_LABEL = Object.freeze({
  csr_202:   "Facultés affaiblies · Art. 202 CSR",
  parking:   "Stationnement interdit",
  uninsured: "Aucune preuve d'assurance",
  abandoned: "Véhicule abandonné",
  radar:     "Excès de vitesse · saisie",
  staff:     "Saisie administrative",
});

export const BASE_FEE = Object.freeze({
  csr_202:   850,
  parking:   185,
  uninsured: 420,
  abandoned: 250,
  radar:     320,
  staff:     500,
});

const STORAGE_PER_DAY = 15;
const LOT_RADIUS      = 16;

// ─── UTILS DE CALCUL ET D'ANALYSE (SANS ALLOCATION MEMOIRE) ──────────────────

export function parseReason(raw) {
  const k = String(raw || "").trim().toLowerCase();
  if (k === "csr_202" || k === "alcool" || k === "dui" || k === "202") return "csr_202";
  if (k === "parking" || k === "stationnement" || k === "park") return "parking";
  if (k === "uninsured" || k === "assurance" || k === "saaq") return "uninsured";
  if (k === "abandoned" || k === "abandon") return "abandoned";
  if (k === "radar" || k === "vitesse") return "radar";
  return "staff";
}

export function dueNow(entry, now = Date.now()) {
  if (entry.releasedAt) return 0;
  const days = Math.max(0, Math.floor((now - entry.impoundedAt) / 86400000));
  return entry.feeAmount + (days * STORAGE_PER_DAY);
}

export function daysHeld(entry, now = Date.now()) {
  const end = entry.releasedAt ?? now;
  return Math.max(0, Math.floor((end - entry.impoundedAt) / 86400000));
}

export function activeLot(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((e) => !e.releasedAt);
}

export function heldVehicle(list, vehicleId, ownerId = LOCAL_PLAYER_ID) {
  return activeLot(list).find((e) => e.vehicleId === vehicleId && e.ownerId === ownerId) ?? null;
}

export function nearLot(x, z, radius = LOT_RADIUS) {
  return Math.hypot(x - FOURRIERE.x, z - FOURRIERE.z) < radius;
}

// ─── PARSING ET SEEDING DES ENTRÉES ──────────────────────────────────────────

export function seedLot() {
  const now = Date.now();
  return [
    {
      id: "imp_seed_gagnon",
      vehicleId: "npc_jetta_gagnon",
      ownerId: "npc_gagnon",
      ownerName: "Marc-André Gagnon",
      reasonCode: "abandoned",
      reason: "Abandon · 2e Rang Donnacona · 14 jours",
      plate: "TGP 482",
      vehicleName: "Jetta 2014",
      officerName: "Agent Bouchard",
      impoundedAt: now - 86400000 * 14,
      feeAmount: BASE_FEE.abandoned,
    },
    {
      id: "imp_seed_lacroix",
      vehicleId: "npc_sedan_lacroix",
      ownerId: "npc_lacroix",
      ownerName: "Julie Lacroix",
      reasonCode: "parking",
      reason: "Stationnement · quai de Portneuf",
      plate: "FRL 917",
      vehicleName: "Berline Cap-Santé",
      officerName: "PORTNEUF-104",
      impoundedAt: now - 86400000 * 2,
      feeAmount: BASE_FEE.parking,
    },
  ];
}

export function parseImpounds(raw) {
  if (!Array.isArray(raw)) return seedLot();
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") continue;
    const vehicleId = typeof row.vehicleId === "string" ? row.vehicleId : "";
    if (!vehicleId) continue;
    const reasonCode = parseReason(row.reasonCode);
    
    out.push({
      id:          typeof row.id === "string" ? row.id : `imp_${out.length}`,
      vehicleId,
      ownerId:     typeof row.ownerId === "string" ? row.ownerId : LOCAL_PLAYER_ID,
      ownerName:   typeof row.ownerName === "string" ? row.ownerName : "Citoyen",
      reasonCode,
      reason:      typeof row.reason === "string" ? row.reason : REASON_LABEL[reasonCode],
      plate:       typeof row.plate === "string" ? row.plate : plateOf(vehicleId, out.length),
      vehicleName: typeof row.vehicleName === "string" ? row.vehicleName : nameOf(vehicleId),
      officerName: typeof row.officerName === "string" ? row.officerName : "SQ Portneuf",
      impoundedAt: typeof row.impoundedAt === "number" ? row.impoundedAt : Date.now(),
      feeAmount:   typeof row.feeAmount === "number" ? row.feeAmount : BASE_FEE[reasonCode],
      releasedAt:  typeof row.releasedAt === "number" ? row.releasedAt : undefined,
      releasedBy:  typeof row.releasedBy === "string" ? row.releasedBy : undefined,
    });
  }
  return out.length ? out : seedLot();
}

export function seizeVehicle(list, opts) {
  const ownerId = opts.ownerId ?? LOCAL_PLAYER_ID;
  if (heldVehicle(list, opts.vehicleId, ownerId)) {
    return { ok: false, message: "Véhicule déjà consigné à la fourrière." };
  }
  const feeAmount = BASE_FEE[opts.reasonCode];
  const entry = {
    id: `imp_${Date.now().toString(36)}`,
    vehicleId: opts.vehicleId,
    ownerId,
    ownerName: opts.ownerName,
    reasonCode: opts.reasonCode,
    reason: REASON_LABEL[opts.reasonCode],
    plate: opts.plate ?? plateOf(opts.vehicleId, list.length),
    vehicleName: nameOf(opts.vehicleId),
    officerName: opts.officerName ?? "SQ Portneuf",
    impoundedAt: Date.now(),
    feeAmount,
  };
  return { ok: true, list: [entry, ...list].slice(0, 40), entry };
}

export function claimVehicle(list, id, opts) {
  const idx = list.findIndex((e) => e.id === id && !e.releasedAt);
  if (idx < 0) return { ok: false, message: "Dossier d'amende introuvable." };
  const entry = { ...list[idx] };
  const fee = opts.waive ? 0 : dueNow(entry);
  entry.releasedAt = Date.now();
  entry.releasedBy = opts.actor;
  const next = list.slice();
  next[idx] = entry;
  return { ok: true, list: next, entry, fee };
}

function nameOf(id) {
  if (isVehicleId(id)) return fleetById(id).name;
  if (id.includes("jetta")) return "Jetta 2014";
  if (id.includes("sedan")) return "Berline Cap-Santé";
  return id;
}

function plateOf(id, n) {
  const letters = id.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "P");
  return `${letters} ${(100 + n).toString().padStart(3, "0")}`;
}

// ─── MODÈLE 3D DE LA COUR COMMUNALE (THREE.JS) ───────────────────────────────

function signTex(title, sub) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#1c241c";
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#c9a24a";
  g.fillRect(0, 0, 512, 10);
  g.fillRect(0, 246, 512, 10);
  g.fillStyle = "#ece8de";
  g.font = "bold 42px monospace";
  g.textAlign = "center";
  g.fillText(title, 256, 110);
  g.fillStyle = "#8a9084";
  g.font = "bold 20px monospace";
  g.fillText(sub, 256, 160);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildFourriereYard() {
  const g = new THREE.Group();
  g.name = "fourriere_portneuf";
  const w = 28;
  const d = 20;

  const pad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), matLib.get(0x4a4840, 0.95, 0.4));
  pad.receiveShadow = true;
  pad.position.y = 0.04;
  g.add(pad);

  const gravel = new THREE.Mesh(new THREE.BoxGeometry(w - 1.2, 0.04, d - 1.2), matLib.get(0x5a564c, 1, 0.55));
  gravel.receiveShadow = true;
  gravel.position.y = 0.1;
  g.add(gravel);

  const fenceMat = matLib.get(0x3a3e38, 0.55, 0.4);
  const postMat  = matLib.get(0x2a2e2a, 0.7, 0.5);
  const fenceH   = 1.85;
  for (const [sx, sz, rot] of [
    [0, -d / 2, 0],
    [0, d / 2, 0],
    [-w / 2, 0, Math.PI / 2],
    [w / 2, 0, Math.PI / 2],
  ]) {
    const len = rot === 0 ? w : d;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(len - 0.4, fenceH, 0.08), fenceMat);
    panel.position.set(sx, fenceH / 2, sz);
    panel.rotation.y = rot;
    panel.castShadow = true;
    g.add(panel);
    
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.12), postMat);
    top.position.set(sx, fenceH + 0.04, sz);
    top.rotation.y = rot;
    g.add(top);
  }

  const gate = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.6, 0.1), matLib.get(0x2c3028, 0.5, 0.35));
  gate.position.set(0, 0.85, d / 2 + 0.04);
  g.add(gate);

  const booth = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.1, 3.6), matLib.get(QC_PALETTE.toleVerte ?? 0x3f4a3c, 0.9));
  booth.position.set(-w / 2 + 3.4, 1.55, d / 2 - 3.2);
  booth.castShadow = true;
  g.add(booth);
  
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.22, 4.1), matLib.get(QC_PALETTE.toleNoire, 0.9));
  roof.position.set(-w / 2 + 3.4, 3.22, d / 2 - 3.2);
  g.add(roof);
  
  const wicket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.08), matLib.get(0x1a1c18, 0.4, 0.2));
  wicket.position.set(-w / 2 + 3.4, 1.45, d / 2 - 3.2 + 1.85);
  g.add(wicket);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 2.5),
    new THREE.MeshBasicMaterial({ map: signTex("FOURRIÈRE", "SAAQ  ·  SQ Portneuf"), toneMapped: false }),
  );
  sign.position.set(0, 3.4, d / 2 + 0.2);
  g.add(sign);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.2, 8), matLib.get(0x5a5e62, 0.5, 0.65));
  pole.position.set(w / 2 - 2.2, 2.6, d / 2 - 1.4);
  g.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), matLib.getEmissive(0xe8dcc0, 0xe8dcc0, 0.55));
  lamp.position.set(w / 2 - 2.2, 5.15, d / 2 - 1.4);
  g.add(lamp);

  const tow = buildRemorqueuse();
  tow.position.set(w / 2 - 6.2, 0.42, -2.4);
  tow.rotation.y = 0.4;
  tow.scale.setScalar(0.92);
  g.add(tow);

  const a = buildSedan(0x4a3a32);
  a.position.set(-6.5, 0.38, -3.2);
  a.rotation.y = -0.2;
  a.scale.setScalar(0.9);
  g.add(a);
  const b = buildSedan(0x3a4650);
  b.position.set(-2.2, 0.38, -4.6);
  b.rotation.y = 0.15;
  b.scale.setScalar(0.9);
  g.add(b);

  g.userData.footprint = { width: w + 2, depth: d + 2 };
  g.userData.interactive = true;
  g.userData.type = "fourriere";
  return g;
}

// ─── INTERFACE GRAPHIQUE REACT (FOURRIÈRE OVERLAY) ───────────────────────────

function payLine(e) {
  const days = daysHeld(e);
  const due = dueNow(e);
  return days > 0 ? `${formatCad(due)} · ${days} j de garde` : formatCad(due);
}

export const FourriereOverlay = ({ engine }) => {
  const cash   = useGameStore((s) => s.cash);
  const bank   = useGameStore((s) => s.bank);
  const list   = useGameStore((s) => s.impounds);
  const notice = useGameStore((s) => s.notice);
  const name   = useGameStore((s) => s.appearance.name);

  // Mémoïsation pour éviter les filtres de liste à chaque render
  const mine = useMemo(() => activeLot(list).filter((e) => e.ownerId === LOCAL_PLAYER_ID), [list]);
  const others = useMemo(() => activeLot(list).filter((e) => e.ownerId !== LOCAL_PLAYER_ID), [list]);

  const handleClaim = useCallback((entry, source) => {
    const due = dueNow(entry);
    const s = useGameStore.getState();

    if (source === "cash" && s.cash < due) {
      s.setHud({ notice: "Espèces de poche insuffisantes pour la SAAQ." });
      return;
    }
    if (source === "bank" && s.bank < due) {
      s.setHud({ notice: "Solde bancaire Desjardins insuffisant." });
      return;
    }

    const res = claimVehicle(s.impounds, entry.id, { actor: name || "Citoyen" });
    if (!res.ok) {
      s.setHud({ notice: res.message });
      return;
    }

    const cashN = source === "cash" ? Math.round((s.cash - due) * 100) / 100 : s.cash;
    const bankN = source === "bank" ? Math.round((s.bank - due) * 100) / 100 : s.bank;

    s.setHud({
      impounds: res.list,
      cash: cashN,
      bank: bankN,
      fourriereOpen: false,
      paused: false,
      notice: due > 0 ? `Véhicule libéré · ${formatCad(due)}` : "Libéré d'office.",
    });

    persist();
    engine?.releaseFromLot?.(entry.vehicleId);
  }, [name, engine]);

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-bg/70 px-3 py-4 backdrop-blur-sm sm:items-center">
      <div className="hud-panel flex max-h-[min(560px,88dvh)] w-full max-w-lg flex-col overflow-hidden rounded-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] text-subtle uppercase">
              <Landmark className="size-3.5 text-accent" />
              Fourrière municipale
            </p>
            <h2 className="font-display text-3xl italic">Portneuf</h2>
            <p className="mt-1 text-sm text-muted">
              Guichet SAAQ / SQ · {formatCad(cash)} · Compte Desjardins {formatCad(bank)}
            </p>
          </div>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-md text-muted hover:text-fg cursor-pointer"
            onClick={() => useGameStore.getState().closeFourriere()}
            aria-label="Fermer la fourrière"
          >
            <X className="size-5" />
          </button>
        </div>
        
        {notice && <p className="px-5 pt-3 text-sm text-accent">{notice}</p>}
        
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[10px] tracking-[0.2em] text-subtle uppercase">Vos véhicules saisis</p>
          {mine.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aucun dossier à votre nom.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {mine.map((e) => (
                <li key={e.id} className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                  <p className="flex items-center gap-2 text-sm text-fg">
                    <Truck className="size-4 text-accent" />
                    {e.vehicleName}
                    <span className="font-mono text-[11px] text-muted">{e.plate}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted">{e.reason}</p>
                  <p className="mt-1 text-[11px] text-subtle">
                    {e.officerName} · {payLine(e)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="h-10 rounded-md border border-border-strong bg-surface px-3 text-xs text-fg cursor-pointer hover:bg-surface-2 transition"
                      onClick={() => handleClaim(e, "cash")}
                    >
                      Régler en espèces
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-md border border-border bg-surface px-3 text-xs text-muted cursor-pointer hover:bg-surface-2 transition"
                      onClick={() => handleClaim(e, "bank")}
                    >
                      Payer par carte
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          
          <p className="mt-5 text-[10px] tracking-[0.2em] text-subtle uppercase">Cour de saisie générale</p>
          {others.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Pas d'autre véhicule saisi pour le moment.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {others.map((e) => (
                <li key={e.id} className="rounded-lg border border-border bg-surface px-3 py-3">
                  <p className="flex items-center gap-2 text-sm text-fg">
                    <Lock className="size-3.5 text-subtle" />
                    {e.vehicleName}
                    <span className="font-mono text-[11px] text-muted">{e.plate}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {e.ownerName} · {e.reason}
                  </p>
                  <p className="mt-1 text-[11px] text-subtle">{payLine(e)} · Non réclamé</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export function fourriereHeldLabel(vehicleId, list) {
  const hit = heldVehicle(list, vehicleId);
  return hit ? `Saisi par la SAAQ · ${hit.plate}` : null;
}
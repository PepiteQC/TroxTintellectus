/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/SHOP/SHOPOVERLAY.JSX
 * Overlay d'achat/vente pour commerces (dépanneur, SQDC, casse-croûte…)
 * ═══════════════════════════════════════════════════════════════════════════
 * Boost v2 — correctifs :
 *   • useMemo sur toutes les dérivées (items, bag, promos, totals)
 *   • Résolution d'aisle unique (1 appel par catalogue)
 *   • Guard SSR sur window.__portneuf
 *   • SQDC : ID enforced (age gate)
 *   • Escape handler (fermeture clavier)
 *   • Taxes québécoises affichées (14.975%)
 *   • notice auto-dismiss
 *   • useGameStore.getState() → actions destructurées
 *   • État vide pour les 2 onglets
 *   • aria-label + role corrects
 *
 * Signature : TROXT⬡
 * Chemin    : client/src/game/shop/ShopOverlay.jsx
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ShoppingBag, ShoppingCart, Wallet, X } from 'lucide-react';
import {
  cartCount,
  cartTotals,
  catalogFor,
  formatCad,
  itemById,
  sellPrice,
  LANDMARK_SHOPS,
} from '../commerce.js';
import { catalogForCasseAisle } from '../casse.js';
import { catalogForAisle } from '../depanneur.js';
import { ProductThumb } from '../productThumb.jsx';
import {
  activePromos,
  getFinalPrice,
  isShopOpen,
  promoFor,
  stockOf,
} from '../shopSim.js';
import { catalogForSqdcAisle } from '../sqdc.js';
import { useGameStore } from '../store.js';

const QC_TAX_RATE = 0.14975;
const NOTICE_TIMEOUT_MS = 5000;

// ─── Helpers ───────────────────────────────────────────────────────────────
const safeArr = (v) => (Array.isArray(v) ? v : []);

/**
 * Résout le "kind" du shop + la liste d'items.
 * 🔧 BOOST : résolution UNIQUE (1 appel par catalogue).
 */
function resolveShopContext({ shopAisle, season, shop }) {
  if (shopAisle) {
    let aisle = safeArr(catalogForAisle(shopAisle));
    if (aisle.length) return { items: aisle, kind: 'depanneur', source: 'depanneur' };

    aisle = safeArr(catalogForCasseAisle(shopAisle));
    if (aisle.length) return { items: aisle, kind: 'casse', source: 'casse' };

    aisle = safeArr(catalogForSqdcAisle(shopAisle));
    if (aisle.length) return { items: aisle, kind: 'sqdc', source: 'sqdc' };

    return { items: [], kind: 'depanneur', source: 'empty' };
  }
  const kind = shop?.kind ?? 'depanneur';
  return { items: safeArr(catalogFor(kind, season)), kind, source: 'catalog' };
}

// ─── COMPOSANT ─────────────────────────────────────────────────────────────
export function ShopOverlay() {
  const shopId       = useGameStore((s) => s.shopId);
  const shopAisle    = useGameStore((s) => s.shopAisle);
  const cash         = useGameStore((s) => s.cash);
  const inventory    = useGameStore((s) => s.inventory) || {};
  const notice       = useGameStore((s) => s.notice);
  const cart         = useGameStore((s) => s.cart) || {};
  const season       = useGameStore((s) => s.season);
  const timeHours    = useGameStore((s) => s.timeHours);
  const shopStock    = useGameStore((s) => s.shopStock) || {};
  const day          = useGameStore((s) => s.economy?.day ?? 0);

  const [tab, setTab] = useState('buy');
  const [localNotice, setLocalNotice] = useState(null);

  // 🔧 BOOST : reset onglet sur changement de boutique ET d'aisle
  useEffect(() => { setTab('buy'); setLocalNotice(null); }, [shopId, shopAisle]);

  // 🔧 BOOST : auto-dismiss notice
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => {
      try { useGameStore.getState().clearNotice?.(); } catch {}
    }, NOTICE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // 🔧 BOOST : Escape handler
  const handleClose = useCallback(() => {
    useGameStore.getState().closeShop?.();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  // 🔧 BOOST : SSR-safe world shops
  const worldShops = useMemo(() => {
    if (typeof window === 'undefined') return [];
    return safeArr(window.__portneuf?.world?.shops);
  }, []);

  const shop = useMemo(
    () => worldShops.find((s) => s.id === shopId) ?? LANDMARK_SHOPS.find((s) => s.id === shopId),
    [worldShops, shopId]
  );

  // 🔧 BOOST : résolution unique
  const { items: rawItems, kind } = useMemo(
    () => resolveShopContext({ shopAisle, season, shop }),
    [shopAisle, season, shop]
  );

  const items = useMemo(
    () => rawItems.filter((it) => !it.season || it.season === season),
    [rawItems, season]
  );

  const title = useMemo(
    () => shop?.name ?? (kind === 'sqdc' ? 'SQDC' : kind === 'casse' ? 'Casse-croûte' : 'Dépanneur'),
    [shop?.name, kind]
  );

  // ─── Bag (inventaire revendable) ─────────────────────────────────────────
  const bag = useMemo(
    () => Object.entries(inventory)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ item: itemById(id), n }))
      .filter((x) => Boolean(x.item)),
    [inventory]
  );

  const sqdc = kind === 'sqdc';
  const hasId = (inventory.identite ?? 0) > 0;
  const ageOk = !sqdc || hasId; // 🔧 BOOST : age gate effective
  const open = shop ? isShopOpen(shop, timeHours) : true;

  // ─── Promos + totaux ────────────────────────────────────────────────────
  const promos = useMemo(() => activePromos(season ?? 'ete', day), [season, day]);
  const totals = useMemo(() => cartTotals(cart, promos), [cart, promos]);

  // 🔧 BOOST : taxes québécoises affichées
  const subtotal = totals.total;
  const tax = Math.round(subtotal * QC_TAX_RATE * 100) / 100;
  const grandTotal = Math.round((subtotal + tax) * 100) / 100;

  const cartN = cartCount(cart);

  // ─── Actions ────────────────────────────────────────────────────────────
  const handleAddToCart = useCallback((itemId) => {
    if (!ageOk) {
      setLocalNotice('Pièce d\'identité requise pour la SQDC.');
      return;
    }
    useGameStore.getState().addToCart?.(itemId);
  }, [ageOk]);

  const handleSell = useCallback((itemId) => {
    useGameStore.getState().sellItem?.(itemId);
  }, []);

  const handleOpenCart = useCallback(() => {
    if (!ageOk) {
      setLocalNotice('Pièce d\'identité requise pour acheter à la SQDC.');
      return;
    }
    useGameStore.getState().openCart?.();
  }, [ageOk]);

  const shownNotice = localNotice || notice;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="absolute inset-0 z-30 flex items-end justify-center bg-bg/70 px-3 py-4 backdrop-blur-sm sm:items-center"
    >
      <div className="hud-panel w-full max-w-lg rounded-xl p-5">
        {/* ─── En-tête ─── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-subtle uppercase">
              {sqdc ? 'SQDC · 21 ans et plus' : shopAisle || 'Commerce'}
            </p>
            <h2 className="font-display text-3xl italic">{title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Wallet className="size-3.5 text-accent" />
              {formatCad(cash)}
              {shop?.hours ? <span className="text-subtle">· {shop.hours}</span> : null}
              <span className={open ? 'text-ok' : 'text-danger'}>
                {open ? 'Ouvert' : 'Fermé'}
              </span>
            </p>
            {sqdc && (
              <p className={`mt-2 text-xs ${hasId ? 'text-ok' : 'text-danger'}`}>
                {hasId ? 'Identité vérifiée' : 'Pièce d\'identité requise à la caisse'}
              </p>
            )}
          </div>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-md text-muted hover:text-fg"
            onClick={handleClose}
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* ─── Onglets ─── */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
          <button
            type="button"
            aria-pressed={tab === 'buy'}
            className={`h-9 rounded-md text-sm ${tab === 'buy' ? 'bg-surface-2 text-fg' : 'text-muted'}`}
            onClick={() => setTab('buy')}
          >
            Acheter
          </button>
          <button
            type="button"
            aria-pressed={tab === 'sell'}
            className={`h-9 rounded-md text-sm ${tab === 'sell' ? 'bg-surface-2 text-fg' : 'text-muted'}`}
            onClick={() => setTab('sell')}
          >
            Vendre {bag.length > 0 && <span className="text-subtle">({bag.length})</span>}
          </button>
        </div>

        {/* ─── Notice ─── */}
        {shownNotice && (
          <p role="status" className="mt-3 text-sm text-accent">{shownNotice}</p>
        )}

        {/* ─── Liste ─── */}
        <ul className="mt-4 max-h-[46vh] space-y-1 overflow-auto">
          {/* ACHAT */}
          {tab === 'buy' && items.length === 0 && (
            <li className="px-1 py-6 text-center text-sm text-subtle">
              Aucun article en rayon pour le moment.
            </li>
          )}

          {tab === 'buy' && items.map((item) => {
            const owned = inventory[item.id] ?? 0;
            const inCart = cart[item.id] ?? 0;
            const left = stockOf(shopStock, shopId, item.id);
            const sale = promoFor(item.id, promos);
            const price = getFinalPrice(item, promos);
            const soldOut = left <= 0;
            const blocked = sqdc && !ageOk;
            const disabled = soldOut || blocked;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleAddToCart(item.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-left disabled:opacity-40"
                >
                  <ProductThumb id={item.id} icon={item.icon} alt={item.name} className="size-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-fg">
                      {item.name}
                      {owned > 0 ? <span className="text-subtle"> · ×{owned}</span> : null}
                      {inCart > 0 ? <span className="text-accent"> · panier {inCart}</span> : null}
                      {sale ? <span className="text-ok"> · −{sale.discountPercent} %</span> : null}
                    </span>
                    <span className="block text-xs text-muted">
                      {soldOut ? 'Rupture de stock' : `${left} en rayon`}
                      {item.hunger || item.thirst ? (
                        <span className="text-subtle">
                          {item.hunger ? ` · faim +${item.hunger}` : ''}
                          {item.thirst ? ` · soif +${item.thirst}` : ''}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="hud-num shrink-0 text-sm text-fg">
                    {sale ? (
                      <>
                        <span className="mr-1 text-xs text-subtle line-through">{formatCad(item.price)}</span>
                        {formatCad(price)}
                      </>
                    ) : (
                      formatCad(item.price)
                    )}
                  </span>
                </button>
              </li>
            );
          })}

          {/* VENTE */}
          {tab === 'sell' && bag.length === 0 && (
            <li className="px-1 py-6 text-center text-sm text-subtle">
              Sac vide — rien à revendre (60 %).
            </li>
          )}

          {tab === 'sell' && bag.map(({ item, n }) => {
            const price = sellPrice(item);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSell(item.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-left"
                >
                  <ProductThumb id={item.id} icon={item.icon} alt={item.name} className="size-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-fg">
                      {item.name}
                      <span className="text-subtle"> · ×{n}</span>
                    </span>
                    <span className="block text-xs text-muted">Le magasin rachète à 60 %</span>
                  </span>
                  <span className="hud-num shrink-0 text-sm text-ok">+{formatCad(price)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* ─── Bouton caisse ─── */}
        {tab === 'buy' && cartN > 0 && (
          <button
            type="button"
            onClick={handleOpenCart}
            disabled={sqdc && !ageOk}
            className={`mt-4 flex h-11 w-full items-center justify-between rounded-md px-3 text-sm disabled:opacity-60 ${
              sqdc ? 'bg-sqdc text-fg' : 'bg-accent text-bg'
            }`}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="size-4" />
              Caisse · {cartN} article{cartN > 1 ? 's' : ''}
            </span>
            <span className="hud-num flex flex-col items-end leading-tight">
              <span>{formatCad(grandTotal)}</span>
              <span className="text-[9px] opacity-80">
                {formatCad(subtotal)} + {formatCad(tax)} TVQ/TPS
              </span>
            </span>
          </button>
        )}

        <p className="mt-4 flex items-center gap-2 text-xs text-subtle">
          <ShoppingBag className="size-3.5" />
          E ou Échap pour ressortir
        </p>
      </div>
    </div>
  );
}

ShopOverlay.displayName = 'ShopOverlay';
export default ShopOverlay;
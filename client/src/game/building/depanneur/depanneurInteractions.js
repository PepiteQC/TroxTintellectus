/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/BUILDING/DEPANNEUR/DEPANNEURINTERACTIONS.JS
 * Bridge entre StoreArchitecture (3D) et DepanneurManager (logique)
 * ═══════════════════════════════════════════════════════════════════
 * Signature : TROXT⬡
 */

import { DepanneurManager } from './DepanneurManager.js';

const SIG = 'TROXT⬡';

const manager = DepanneurManager.getInstance();

/**
 * Achète un item à la caisse / au frigo / etc.
 * @param {string} itemId
 * @param {{ id?: string }} player
 * @param {object|null} kernel
 */
export function tryPurchase(itemId, player = {}, kernel = null) {
  const res = manager.purchaseItem(itemId);
  kernel?.route?.(
    'troxt_economy:purchase',
    {
      itemId,
      sku: res.item?.sku,
      price: res.item?.price,
      player_id: player.id || 'player-local',
      success: res.success,
    },
    { trusted: true }
  );
  kernel?.emit?.('troxt:ui.toast', { msg: res.message });
  return res;
}

/**
 * Ouvre l'UI d'achat ciblée sur un fixture.
 * @param {string} fixtureId
 * @param {{ id?: string }} player
 * @param {object|null} kernel
 */
export function openShopUI(fixtureId, player = {}, kernel = null) {
  const registry = manager.getRegistry();
  const fixture = registry.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) {
    kernel?.emit?.('troxt:ui.toast', { msg: 'Équipement introuvable' });
    return null;
  }

  const inv = registry.inventory.filter((i) => i.fixtureId === fixtureId && i.stock > 0);

  kernel?.emit?.('troxt:ui.openShop', {
    buildingId: registry.buildingId,
    fixtureId,
    fixtureType: fixture.type,
    label: fixture.label,
    items: inv.map((i) => ({
      id: i.id, sku: i.sku, label: i.label, price: i.price, stock: i.stock,
    })),
    player_id: player.id || 'player-local',
  });

  return { fixture, items: inv };
}

/** Retrait ATM → event kernel (l'économie gère la suite) */
export function tryAtmWithdraw(amount = 20, player = {}, kernel = null) {
  if (amount <= 0) return { ok: false, message: 'Montant invalide' };
  kernel?.route?.(
    'troxt_economy:withdraw',
    { amount, player_id: player.id || 'player-local' },
    { trusted: true }
  );
  kernel?.emit?.('troxt:ui.toast', { msg: `Retrait de ${amount} $` });
  return { ok: true, amount };
}

/** Snapshot complet (inventaire + caisse + alarme) pour UI overlay */
export function getDepanneurSnapshot() {
  return {
    buildingId: 'depanneur_couche_tard',
    cash: manager.getCashRegisterBalance(),
    alarm: manager.isAlarmActive(),
    inventory: manager.getInventory().map((i) => ({
      id: i.id, sku: i.sku, label: i.label, price: i.price, stock: i.stock,
    })),
  };
}

/** Arme / désarme l'alarme depuis l'UI */
export function setAlarm(armed, kernel = null) {
  manager.setAlarmArmed(armed);
  kernel?.emit?.('troxtworld:alarm', { buildingId: 'depanneur_couche_tard', armed });
  return { ok: true, armed };
}

export { SIG, manager };
export default { tryPurchase, openShopUI, tryAtmWithdraw, getDepanneurSnapshot, setAlarm };
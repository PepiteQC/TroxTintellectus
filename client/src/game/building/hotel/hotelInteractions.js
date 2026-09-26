/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — GAME/BUILDING/HOTEL/HOTELINTERACTIONS.JS
 * Bridge entre le mesh 3D (RoomArchitecture) et le store de sécurité
 * ═══════════════════════════════════════════════════════════════════
 * Expose une API unifiée pour :
 *   • Dormir dans une chambre (nécessite porte déverrouillée)
 *   • Utiliser la porte (carte / PIN) depuis l'UI 3D
 *   • S'abonner aux événements kernel (troxtworld:hotel.*)
 *
 * Signature : TROXT⬡
 */

import {
  hotelRealtimeSecurity,
  makeAccessAttempt,
  getDoorByRoom,
  HOTEL_ROOMS,
} from './HotelRealtimeSecurity.js';

const SIG = 'TROXT⬡';

/**
 * Sleep : vérifie que la porte est déverrouillée, émet un event kernel.
 * @param {string} roomId
 * @param {{ id?: string }} player
 * @param {object|null} kernel
 * @returns {Promise<{ok:boolean,message:string}>}
 */
export async function tryHotelSleep(roomId, player = {}, kernel = null) {
  const door = hotelRealtimeSecurity.getRoomDoorState(roomId);
  if (!door) return { ok: false, message: 'Chambre introuvable' };
  if (door.isLocked) {
    kernel?.emit?.('troxt:ui.toast', { msg: 'Porte verrouillée — passez une carte' });
    return { ok: false, message: 'Porte verrouillée' };
  }
  if (door.state === 'lockout') {
    kernel?.emit?.('troxt:ui.toast', { msg: 'Lecteur en lockout' });
    return { ok: false, message: 'Lockout actif' };
  }
  kernel?.emit?.('troxtworld:hotel.sleep', { roomId, player_id: player.id || 'player-local' });
  kernel?.emit?.('troxt:ui.toast', { msg: `Bonne nuit dans ${roomId}` });
  return { ok: true, message: 'Sleep OK' };
}

/**
 * Tente un accès et émet les events kernel correspondants.
 */
export async function tryHotelDoorAccess({ roomId, method, cardUid, pin, actorId = 'player-local' }, kernel = null) {
  try {
    const res = await makeAccessAttempt({ roomId, method, cardUid, pin, actorId });
    kernel?.emit?.('troxtworld:hotel.door', {
      roomId,
      doorId: getDoorByRoom(roomId)?.id,
      method,
      granted: res.granted,
      reason: res.reason,
      actor_id: actorId,
    });
    kernel?.emit?.('troxt:ui.toast', { msg: res.message });
    return res;
  } catch (err) {
    kernel?.emit?.('troxt:ui.toast', { msg: `Erreur: ${err?.message || err}` });
    return { granted: false, message: String(err?.message || err), reason: 'error' };
  }
}

/** Retourne la liste des chambres + état courant (pour UI overlay) */
export function listHotelRoomStates() {
  return HOTEL_ROOMS.map((r) => {
    const door = hotelRealtimeSecurity.getRoomDoorState(r.id);
    return { roomId: r.id, name: r.name, state: door?.state, isLocked: door?.isLocked };
  });
}

/** Abonnement global aux changements de porte (retourne unsubscribe) */
export function onHotelDoorChange(handler) {
  return hotelRealtimeSecurity.subscribe(() => {
    handler(hotelRealtimeSecurity.getSnapshot());
  });
}

export { SIG };
export default { tryHotelSleep, tryHotelDoorAccess, listHotelRoomStates, onHotelDoorChange };
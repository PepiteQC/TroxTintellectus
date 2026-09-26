// server/src/systems/emergency/responder.js
import { getPlayer } from './bridge.js';

export const RESPONDER_JOB_CATEGORY = 'securite_urgence';
export const CALL_COOLDOWN_MS = 120_000;

export function responderCheck(playerId) {
  const p = getPlayer(playerId);
  if (!p) {
    return { playerId, isResponder: false, via: 'aucune', onDuty: false,
             detail: 'Joueur introuvable.' };
  }
  if (p.rp?.faction === 'SQ' || p.rp?.faction === 'police_sq') {
    return { playerId, isResponder: true, via: 'sq', onDuty: true,
             detail: `SQ rang ${p.factionRank ?? 0}` };
  }
  if (p.rp?.job && p.rp?.jobCategory === RESPONDER_JOB_CATEGORY) {
    return { playerId, isResponder: true, via: 'emploi_securite_urgence', onDuty: true,
             detail: p.rp.job };
  }
  return { playerId, isResponder: false, via: 'aucune', onDuty: false,
           detail: 'Aucun matricule SQ ni emploi securite_urgence.' };
}

export function phoneOf(playerId) {
  let h = 0;
  for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) % 10_000_000;
  const d = String(h).padStart(7, '0');
  return `418-${d.slice(0, 3)}-${d.slice(3, 7)}`;
}

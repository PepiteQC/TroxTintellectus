let _broadcast = () => {};
let _sendToPlayer = () => {};
let _playerOf = () => null;

export function configureEmergencyBridge({ broadcast, sendToPlayer, playerOf }) {
  _broadcast = broadcast;
  _sendToPlayer = sendToPlayer;
  _playerOf = playerOf;
}

export function broadcastEmergency(type, payload) {
  _broadcast(JSON.stringify({ type, data: payload, ts: Date.now(), sig: 'TROXT⬡' }));
}

export function sendTo(playerId, type, payload) {
  _sendToPlayer(playerId, type, payload);
}

export function getPlayer(playerId) {
  return _playerOf(playerId);
}
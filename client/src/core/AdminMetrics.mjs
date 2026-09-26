/**
 * AdminMetrics — compteur FPS et latence.
 * Path: client/src/game/core/AdminMetrics.mjs
 */
let _fps = 60;
let _last = performance.now();
let _frames = 0;

function _loop() {
  _frames++;
  const now = performance.now();
  if (now - _last >= 1000) {
    _fps = Math.round((_frames * 1000) / (now - _last));
    _frames = 0;
    _last = now;
  }
  requestAnimationFrame(_loop);
}
if (typeof window !== "undefined") requestAnimationFrame(_loop);

export const AdminMetrics = {
  getMetrics: () => ({ fps: _fps, last: _last }),
  setFps: (n) => { _fps = n; },
};

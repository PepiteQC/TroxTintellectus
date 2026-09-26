/**
 * ═══════════════════════════════════════════════════════════════════
 * TROXT⬡ — CORE/TROXT-BOOT.MJS
 * Assemblage complet — le point où TOUT se coordonne
 * ═══════════════════════════════════════════════════════════════════
 * Montre comment brancher ensemble :
 *   kernel ← cerveau TROXT⬡ ← sécurité Intellectus ← moteur 3D
 *          ← mécaniques ← monde ← villages ← portes ← économie
 *
 * Deux modes :
 *   • SERVEUR (Node)  : bootServer()  — autorité, DB, WebSocket
 *   • CLIENT (browser): bootClient()  — rendu 3D, envoie au serveur
 *
 * Signature : TROXT⬡
 * Chemin    : core/troxt-boot.mjs
 */

import { TroxtKernel }    from './troxt-kernel.mjs';
import { TroxtMechanics } from './troxt-mechanics.mjs';
import { TroxtPhysics }   from './troxt-physics.mjs';
import { installPhysicsBridge } from './troxt-physics-bridge.mjs';
import { TroxtLuaRuntime } from './troxt-lua-runtime.mjs';
import { createEngineAdapter } from './troxt-engine-adapter.mjs';

const SIG = 'TROXT⬡';

// ═══════════════════════════════════════════════════════════════════
// CÔTÉ SERVEUR (Node.js) — l'autorité
// ═══════════════════════════════════════════════════════════════════
export async function bootServer(opts = {}) {
  console.log(`\n  ${SIG} — Démarrage SERVEUR TroxtWorld\n`);

  // 1. Pont Lua (vers cerveau TROXT⬡ + Intellectus en Lua)
  const luaEmit = async (event, data) => {
    try {
      await fetch(opts.luaBridge || 'http://localhost:4200/lua/emit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data }),
        signal: AbortSignal.timeout(1500),
      });
    } catch { /* non bloquant */ }
  };

  // 2. Broadcast WebSocket (fourni par ton serveur RP)
  const wsBroadcast = opts.wsBroadcast || (() => {});

  // 3. Le kernel
  const kernel = new TroxtKernel({ luaEmit, wsBroadcast });

  // 4+5. Cerveau TROXT⬡ + Sécurité Intellectus
  let luaRuntime = null;
  if (opts.luaDir) {
    // VRAIS fichiers .lua exécutés en Lua 5.4 WASM (wasmoon)
    luaRuntime = new TroxtLuaRuntime(kernel);
    await luaRuntime.init();
    await luaRuntime.loadAll(opts.luaDir);
    luaRuntime.attachToKernel();      // branche brain + intellectus + économie + monde + portes
    console.log('  ✓ Runtime Lua actif — cerveau TROXT⬡ + 🛡️INTELLECTUS⬡ en Lua réel');
  } else {
    // Stubs minimaux si pas de Lua (mode dégradé)
    kernel.register('brain', { decide: () => ({ via: SIG }) });
    kernel.register('intellectus', { checkAction: () => ({ allowed: true }), tick: () => {} });
    console.log('  ℹ Lua désactivé (passe opts.luaDir pour brancher tes .lua)');
  }

  // 6. Mécaniques RP
  const mechanics = new TroxtMechanics(kernel);
  mechanics.install();
  kernel.register('mechanics', mechanics);

  // 6b. Physique Rapier WASM (autorité serveur) — optionnelle
  let physics = null;
  if (opts.RAPIER) {
    physics = new TroxtPhysics(kernel);
    await physics.init(opts.RAPIER);
    physics.addGround(0);                 // sol de base (ou addHeightfield)
    installPhysicsBridge({ kernel, physics, mechanics });
    kernel.register('physics', physics);
    console.log('  ✓ Physique Rapier WASM active (autorité serveur)');
  } else {
    console.log('  ℹ Physique désactivée (passe opts.RAPIER pour l\'activer)');
  }

  // 7. Boucle de tick coordonnée
  kernel.startTick(opts.tickHz || 20);

  console.log(`  ✓ Serveur prêt — santé: ${kernel.getHealth().grade}\n`);
  return { kernel, mechanics, physics, luaRuntime };
}

// ═══════════════════════════════════════════════════════════════════
// CÔTÉ CLIENT (navigateur) — le rendu 3D
// ═══════════════════════════════════════════════════════════════════
/**
 * @param {object} cfg
 * @param {object} cfg.engineConfig  { THREE, scene, GLTFLoader, FBXLoader } OU { BABYLON, scene }
 * @param {object} [cfg.client]      TroxtClient WebSocket
 * @param {string} [cfg.assetBase]   URL de base des modèles (asset-server:4200)
 */
export async function bootClient(cfg = {}) {
  console.log(`\n  ${SIG} — Démarrage CLIENT TroxtWorld\n`);

  // 1. Kernel local (léger — l'autorité reste serveur)
  const client = cfg.client;
  const kernel = new TroxtKernel({
    wsBroadcast: null,
    luaEmit: null,
  });

  // 2. Moteur 3D (Three.js OU Babylon.js — détecté auto)
  const engine = createEngineAdapter(cfg.engineConfig);
  kernel.register('engine', engine);
  console.log(`  ✓ Moteur 3D: ${engine.engine}`);

  // 3. Précharge les modèles GLB/FBX depuis l'asset-server
  const base = cfg.assetBase || 'http://localhost:4200/assets/files';
  const models = cfg.models || [];
  for (const m of models) {
    try {
      await engine.loadModel(`${base}/${m.path}`, m.opts);
      console.log(`  ✓ Modèle: ${m.path}`);
    } catch (e) {
      console.warn(`  ⚠ ${m.path}: ${e.message}`);
    }
  }

  // 4. Relaie les événements serveur → moteur 3D
  if (client) {
    client.addEventListener('player_update', (e) => {
      const d = e.detail;
      engine.move(`player_${d.player_id}`, d.pos, d.rot);
    });
    client.addEventListener('player_join', (e) => {
      const d = e.detail;
      // Spawn l'avatar du nouveau joueur (modèle par défaut)
      engine.spawn(`${base}/${cfg.playerModel || 'avatar.glb'}`, d.pos, d.rot, {
        id: `player_${d.player_id}`, animate: true,
      });
    });
    client.addEventListener('player_leave', (e) => {
      engine.remove(`player_${e.detail.player_id}`);
    });
  }

  // 5. Boucle de rendu — appelle engine.tick pour les animations
  let last = performance.now();
  function renderLoop(now) {
    const dt = (now - last) / 1000;
    last = now;
    engine.tick(dt);
    kernel.emit('kernel:frame', { dt });
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  console.log(`  ✓ Client prêt — rendu ${engine.engine}\n`);
  return { kernel, engine };
}

export { SIG, TroxtKernel, TroxtMechanics, TroxtPhysics, TroxtLuaRuntime, createEngineAdapter };
export default { bootServer, bootClient };

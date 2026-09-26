import { LuaFactory } from 'wasmoon';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let _instance: EmergencyLuaEngine | null = null;

export class EmergencyLuaEngine {
  private engine: any = null;
  public ready: Promise<void>;

  static getInstance(): EmergencyLuaEngine {
    return (_instance ??= new EmergencyLuaEngine());
  }

  constructor() {
    this.ready = this._init();
  }

  private async _init(): Promise<void> {
    const factory = new LuaFactory();
    this.engine = await factory.createEngine();

    // 1. Charger le module d'événements TROXT
    const eventsCode = readFileSync(resolve(process.cwd(), 'lua/troxt/troxt_events.lua'), 'utf-8');
    await this.engine.doString(eventsCode);

    // 2. Charger les règles de dispatch
    const dispatchCode = readFileSync(resolve(process.cwd(), 'lua/dispatch_rules.lua'), 'utf-8');
    await this.engine.doString(dispatchCode);

    // 3. Configurer le pont JS global dans l'environnement Lua pour les émissions d'événements
    this.engine.global.set('js', {
      emit: (event: string, data: any) => {
        this.handleJsEmit(event, data);
      }
    });
  }

  private handleJsEmit(event: string, data: any): void {
    // Point d'interception optionnel pour propager les événements Lua vers EventEmitter de Node.js
    // console.log(`[JS BRIDGE] Événement capturé depuis Lua -> [${event}]`, data);
  }

  async recommendPriority(call: { type: string; details?: string }): Promise<string> {
    await this.ready;
    const details = String(call.details || '').replace(/"/g, '\\"');
    const result = await this.engine.doString(
      `return recommend_priority({ type = "${call.type}", details = "${details}", location = "" })`
    );
    return String(result || 'code_1_normal');
  }

  async recommendUnits(type: string, priority: string): Promise<string[]> {
    await this.ready;
    const result = await this.engine.doString(
      `local u = recommend_units("${type}","${priority}") return table.concat(u,"|")`
    );
    return String(result || '').split('|').filter(Boolean);
  }

  /**
   * Émet un événement directement dans le bus Lua depuis Node.js
   */
  async emitLuaEvent(event: string, data: any = {}): Promise<number> {
    await this.ready;
    // On passe par une fonction globale ou un appel direct au module Events
    const luaCode = `
      local events = ...
      -- Si le module global Events est accessible ou renvoyé
      if Events and Events.emit then
        return Events.emit("${event}", ${JSON.stringify(data)})
      end
      return 0
    `;
    // Alternative simplifiée selon la portée globale de votre script Lua
    return await this.engine.doString(`return Events.emit("${event}", ${JSON.stringify(data).replace(/"/g, '\\"')})`);
  }
}

export const emergencyLua = EmergencyLuaEngine.getInstance();
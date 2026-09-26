import { eq } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { coronerBodies, autopsies } from '../../../db/schema.js';
import { emit } from './net.js';

const CAUSES = ['Traumatisme crânien par projectile','Choc cardiogénique','Inhalation de monoxyde','Surdose de stimulants'];
let _instance = null;

export class CoronerService {
  static getInstance() { return (_instance ??= new CoronerService()); }

  reportDeceased({ victimName, victimPlayerId = null, cause, position, belongings = [] }) {
    const body = {
      id: 'corpse_' + Date.now(), victimName, victimPlayerId,
      timeOfDeath: Date.now(), causeOfDeath: cause, isBagged: false,
      position, inventory: belongings, evidenceTagged: false,
    };
    db.insert(coronerBodies).values({
      id: body.id, victimName, victimPlayerId,
      timeOfDeath: body.timeOfDeath, causeOfDeath: cause, isBagged: false,
      x: position[0], y: position[1], z: position[2],
      inventory: JSON.stringify(belongings), evidenceTagged: false,
    }).run();
    emit('coroner', 'new_body', body);
    return body;
  }
  attemptResuscitation(bodyId, medicalLevel) {
    const row = db.select().from(coronerBodies).where(eq(coronerBodies.id, bodyId)).get();
    if (!row) return false;
    if ((Date.now() - row.timeOfDeath) / 60_000 > 4) return false;
    const success = Math.random() < Math.min(0.95, 0.3 + medicalLevel * 0.1);
    if (success) {
      db.delete(coronerBodies).where(eq(coronerBodies.id, bodyId)).run();
      emit('coroner', 'revived', { id: bodyId, victimName: row.victimName });
    }
    return success;
  }
  bagBody(bodyId) {
    const row = db.select().from(coronerBodies).where(eq(coronerBodies.id, bodyId)).get();
    if (!row) return false;
    db.update(coronerBodies).set({ isBagged: true }).where(eq(coronerBodies.id, bodyId)).run();
    emit('coroner', 'body_bagged', { id: bodyId });
    return true;
  }
  performAutopsy(bodyId, coronerId = null) {
    const row = db.select().from(coronerBodies).where(eq(coronerBodies.id, bodyId)).get();
    if (!row) throw new Error("Corps introuvable");
    const result = {
      id: 'autopsy_' + Date.now(), bodyId,
      cause: row.causeOfDeath || CAUSES[Math.floor(Math.random() * CAUSES.length)],
      toxScreen: Math.random() > 0.5 ? 'Alcoolémie élevée, traces de THC' : 'Négatif',
      verdict: 'Dossier transmis à la SQ.',
      performedAt: Date.now(), coronerId,
    };
    db.insert(autopsies).values(result).run();
    db.update(coronerBodies).set({ evidenceTagged: true }).where(eq(coronerBodies.id, bodyId)).run();
    emit('coroner', 'autopsy_completed', result);
    return result;
  }
  getBodies() {
    return db.select().from(coronerBodies).all().map(r => ({
      id: r.id, victimName: r.victimName, victimPlayerId: r.victimPlayerId,
      timeOfDeath: r.timeOfDeath, causeOfDeath: r.causeOfDeath, isBagged: r.isBagged,
      position: [r.x, r.y, r.z], inventory: JSON.parse(r.inventory), evidenceTagged: r.evidenceTagged,
    }));
  }
}
export const coronerService = CoronerService.getInstance();

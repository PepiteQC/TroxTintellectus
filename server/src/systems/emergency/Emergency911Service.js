import { eq, desc, and, ne } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { emergencyCalls, emergencyUnits } from '../../../db/schema.js';

let _instance = null;

export class Emergency911Service {
  static getInstance() { return (_instance ??= new Emergency911Service()); }

  getAllCalls() {
    const rows = db.select().from(emergencyCalls).orderBy(desc(emergencyCalls.timestamp)).all();
    const units = db.select().from(emergencyUnits).all();
    return rows.map(r => this._hydrate(r, units));
  }
  getActiveCalls() { return this.getAllCalls().filter(c => c.status !== 'resolu'); }
  getCall(id) {
    const row = db.select().from(emergencyCalls).where(eq(emergencyCalls.id, id)).get();
    if (!row) return null;
    const units = db.select().from(emergencyUnits).where(eq(emergencyUnits.callId, id)).all();
    return this._hydrate(row, units);
  }
  createEmergencyCall({ callerName, callerPhone, callerPlayerId, type, priority,
                       locationDescription, coordinates, details }) {
    const id = 'call_911_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const callNumber = '911-2026-' + Math.floor(100 + Math.random() * 900);
    db.insert(emergencyCalls).values({
      id, callNumber, timestamp: Date.now(),
      callerName, callerPhone, callerPlayerId,
      type, priority, locationDescription,
      x: coordinates[0], y: coordinates[1], z: coordinates[2],
      details, status: 'en_attente',
    }).run();
    return this.getCall(id);
  }
  findRecentActiveByPhone(phone, windowMs) {
    const cutoff = Date.now() - windowMs;
    const row = db.select().from(emergencyCalls)
      .where(and(eq(emergencyCalls.callerPhone, phone), ne(emergencyCalls.status, 'resolu')))
      .orderBy(desc(emergencyCalls.timestamp)).get();
    if (!row || row.timestamp < cutoff) return null;
    return this._hydrate(row, []);
  }
  dispatchUnit(callId, unitName, responderPlayerId = null) {
    if (!this.getCall(callId)) return false;
    db.insert(emergencyUnits).values({
      id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      callId, unitName, assignedAt: Date.now(), responderPlayerId,
    }).run();
    db.update(emergencyCalls).set({ status: 'unites_en_route' })
      .where(eq(emergencyCalls.id, callId)).run();
    return true;
  }
  resolveCall(callId, notes) {
    const call = this.getCall(callId);
    if (!call || call.status === 'resolu') return false;
    db.update(emergencyCalls).set({
      status: 'resolu',
      resolvedAt: Date.now(),
      details: notes ? call.details + '\n[Clôture ' + new Date().toISOString() + '] ' + notes : call.details,
    }).where(eq(emergencyCalls.id, callId)).run();
    return true;
  }
  _hydrate(row, allUnits) {
    return {
      id: row.id, callNumber: row.callNumber, timestamp: row.timestamp,
      callerName: row.callerName, callerPhone: row.callerPhone,
      callerPlayerId: row.callerPlayerId,
      type: row.type, priority: row.priority,
      locationDescription: row.locationDescription,
      coordinates: [row.x, row.y, row.z],
      details: row.details,
      assignedUnits: allUnits.filter(u => u.callId === row.id).map(u => u.unitName),
      status: row.status,
    };
  }
}
export const emergency911Service = Emergency911Service.getInstance();

// src/game/building/depanneur/core/DepanneurTypes.js
/**
 * Types "documentaires" (JSDoc) — pas d'exécution, juste pour l'IDE.
 *
 * @typedef {[number, number, number]} Vector3Tuple
 *
 * @typedef {'customer'|'staff'|'security'|'delivery'|'waste'|'parking'|'fuel'|'inventory'|'cash'} DepanneurZoneType
 *
 * @typedef {'shelf'|'fridge'|'counter'|'cash_register'|'atm'|'coffee'|'slush'|'hotdog'|'lottery'|'security_camera'|'fuel_pump'|'ice_cage'|'waste_bin'|'delivery_door'|'neon_sign'} DepanneurFixtureType
 *
 * @typedef {Object} DepanneurZone
 * @property {string} id
 * @property {string} buildingId
 * @property {DepanneurZoneType} type
 * @property {string} label
 * @property {Vector3Tuple} position
 * @property {Vector3Tuple} size
 * @property {'public'|'staff'|'manager'|'security'} access
 * @property {string} firebaseCollection
 *
 * @typedef {Object} DepanneurFixture
 * @property {string} id
 * @property {string} buildingId
 * @property {DepanneurFixtureType} type
 * @property {string} label
 * @property {Vector3Tuple} position
 * @property {number} [rotationY]
 * @property {Vector3Tuple} [scale]
 * @property {string} zoneId
 * @property {string} [firebaseCollection]
 * @property {boolean} [interactive]
 *
 * @typedef {Object} DepanneurInventoryItem
 * @property {string} id
 * @property {string} sku
 * @property {string} label
 * @property {'snack'|'drink'|'coffee'|'hot_food'|'lottery'|'utility'|'fuel'} category
 * @property {number} price
 * @property {number} stock
 * @property {string} zoneId
 * @property {string} fixtureId
 * @property {string} firebaseCollection
 *
 * @typedef {Object} DepanneurSecurityCamera
 * @property {string} id
 * @property {string} buildingId
 * @property {string} label
 * @property {Vector3Tuple} position
 * @property {Vector3Tuple} rotation
 * @property {string[]} coverageZoneIds
 * @property {string} eventCollection
 *
 * @typedef {Object} DepanneurRegistryShape
 * @property {string} buildingId
 * @property {string} version
 * @property {DepanneurZone[]} zones
 * @property {DepanneurFixture[]} fixtures
 * @property {DepanneurInventoryItem[]} inventory
 * @property {DepanneurSecurityCamera[]} cameras
 */

export const DEPANNEUR_TYPES_VERSION = '2.1.0';
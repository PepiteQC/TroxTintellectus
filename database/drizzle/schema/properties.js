// database/drizzle/schema/properties.js
import {
  pgTable, serial, text, integer, timestamp, real, boolean,
  jsonb, index, uniqueIndex, pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { characters } from "./characters.js";
import { businesses } from "./businesses.js";

/* ══════════════════ ÉNUMÉRATIONS ══════════════════ */

export const propertyTypeEnum = pgEnum("property_type", [
  "maison", "duplex", "triplex", "appartement", "condo", "penthouse",
  "chalet", "ferme", "terrain", "garage", "entrepot", "local_commercial",
  "bureau", "immeuble", "grange", "cabane_sucre",
]);

export const zoningEnum = pgEnum("zoning", [
  "residentiel", "commercial", "industriel", "agricole",
  "mixte", "recreatif", "public",
]);

export const propertyStateEnum = pgEnum("property_state", [
  "neuf", "bon", "usage", "vetuste", "delabre", "ruine",
]);

export const ownershipEnum = pgEnum("ownership_kind", [
  "character", "business", "municipal", "bank", "npc",
]);

export const leaseStatusEnum = pgEnum("lease_status", [
  "actif", "en_retard", "resilie", "expire", "eviction",
]);

export const utilityKindEnum = pgEnum("utility_kind", [
  "electricite", "chauffage", "internet", "eau", "dechets", "gaz",
]);

export const renovationStageEnum = pgEnum("renovation_stage", [
  "planifie", "demolition", "structure", "plomberie", "electricite",
  "isolation", "finition", "inspection", "termine", "abandonne", "arrete",
]);

export const lockTypeEnum = pgEnum("lock_type", [
  "aucune", "simple", "pene_dormant", "electronique", "biometrique",
]);

/* ══════════════════ PROPRIÉTÉ ══════════════════ */

export const properties = pgTable("properties", {
  id: text("id").primaryKey(),
  cadastreNumber: text("cadastre_number").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  village: text("village").notNull(),
  postalCode: text("postal_code"),
  type: propertyTypeEnum("type").notNull(),
  zoning: zoningEnum("zoning").notNull().default("residentiel"),
  state: propertyStateEnum("state").notNull().default("bon"),
  posX: real("pos_x").notNull(),
  posY: real("pos_y").notNull().default(0),
  posZ: real("pos_z").notNull(),
  heading: real("heading").notNull().default(0),
  entranceX: real("entrance_x"),
  entranceY: real("entrance_y"),
  entranceZ: real("entrance_z"),
  interiorTemplate: text("interior_template"),
  livingAreaM2: real("living_area_m2").notNull().default(0),
  lotAreaM2: real("lot_area_m2").notNull().default(0),
  floors: integer("floors").notNull().default(1),
  bedrooms: integer("bedrooms").notNull().default(0),
  bathrooms: real("bathrooms").notNull().default(0),
  garageSlots: integer("garage_slots").notNull().default(0),
  storageCapacity: real("storage_capacity").notNull().default(50),
  yearBuilt: integer("year_built"),
  hasBasement: boolean("has_basement").notNull().default(false),
  hasPool: boolean("has_pool").notNull().default(false),
  hasFireplace: boolean("has_fireplace").notNull().default(false),
  ownerKind: ownershipEnum("owner_kind").notNull().default("municipal"),
  ownerCharacterId: integer("owner_character_id")
    .references(() => characters.id, { onDelete: "set null" }),
  ownerBusinessId: text("owner_business_id")
    .references(() => businesses.id, { onDelete: "set null" }),
  assessedValue: integer("assessed_value").notNull(),
  askingPrice: integer("asking_price"),
  forSale: boolean("for_sale").notNull().default(false),
  forRent: boolean("for_rent").notNull().default(false),
  rentPerWeek: integer("rent_per_week"),
  lastSalePrice: integer("last_sale_price"),
  lastSaleAt: timestamp("last_sale_at", { withTimezone: true }),
  municipalTax: integer("municipal_tax").notNull().default(0),
  schoolTax: integer("school_tax").notNull().default(0),
  taxDueAt: timestamp("tax_due_at", { withTimezone: true }),
  taxOwed: integer("tax_owed").notNull().default(0),
  condition: real("condition").notNull().default(100),
  insulation: real("insulation").notNull().default(50),
  lastMaintenanceAt: timestamp("last_maintenance_at", { withTimezone: true }),
  lockType: lockTypeEnum("lock_type").notNull().default("simple"),
  locked: boolean("locked").notNull().default(true),
  hasAlarm: boolean("has_alarm").notNull().default(false),
  alarmArmed: boolean("alarm_armed").notNull().default(false),
  alarmCode: text("alarm_code"),
  cameraCount: integer("camera_count").notNull().default(0),
  lastBurglaryAt: timestamp("last_burglary_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  cadastreIdx:   uniqueIndex("properties_cadastre_idx").on(t.cadastreNumber),
  ownerCharIdx:  index("properties_owner_char_idx").on(t.ownerCharacterId),
  ownerBizIdx:   index("properties_owner_biz_idx").on(t.ownerBusinessId),
  villageIdx:    index("properties_village_idx").on(t.village),
  typeIdx:       index("properties_type_idx").on(t.type),
  zoningIdx:     index("properties_zoning_idx").on(t.zoning),
  marketIdx:     index("properties_market_idx").on(t.village, t.forSale, t.askingPrice),
  rentIdx:       index("properties_rent_idx").on(t.village, t.forRent, t.rentPerWeek),
  taxIdx:        index("properties_tax_idx").on(t.taxDueAt, t.taxOwed),
}));

/* ══════════════════ HYPOTHÈQUES ══════════════════ */

export const mortgages = pgTable("mortgages", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  borrowerId: integer("borrower_id").notNull()
    .references(() => characters.id, { onDelete: "restrict" }),
  lender: text("lender").notNull().default("Caisse Desjardins"),
  principal: integer("principal").notNull(),
  balance: integer("balance").notNull(),
  downPayment: integer("down_payment").notNull(),
  interestRate: real("interest_rate").notNull(),
  termWeeks: integer("term_weeks").notNull(),
  paymentPerWeek: integer("payment_per_week").notNull(),
  nextPaymentAt: timestamp("next_payment_at", { withTimezone: true }).notNull(),
  paymentsMade: integer("payments_made").notNull().default(0),
  paymentsMissed: integer("payments_missed").notNull().default(0),
  insuranceRequired: boolean("insurance_required").notNull().default(false),
  insurancePremium: integer("insurance_premium").notNull().default(0),
  status: text("status", {
    enum: ["actif", "en_retard", "rembourse", "saisie", "refinance"],
  }).notNull().default("actif"),
  foreclosureWarningAt: timestamp("foreclosure_warning_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidOffAt: timestamp("paid_off_at", { withTimezone: true }),
}, (t) => ({
  propertyIdx: index("mortgages_property_idx").on(t.propertyId),
  borrowerIdx: index("mortgages_borrower_idx").on(t.borrowerId),
  dueIdx:      index("mortgages_due_idx").on(t.nextPaymentAt, t.status),
  lateIdx:     index("mortgages_late_idx").on(t.status, t.paymentsMissed),
}));

/* ══════════════════ ASSURANCES ══════════════════ */

export const propertyInsurance = pgTable("property_insurance", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  holderId: integer("holder_id").notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  insurer: text("insurer").notNull().default("Assurances Portneuf"),
  coversFire: boolean("covers_fire").notNull().default(true),
  coversTheft: boolean("covers_theft").notNull().default(true),
  coversWater: boolean("covers_water").notNull().default(false),
  coversVandalism: boolean("covers_vandalism").notNull().default(false),
  coverageAmount: integer("coverage_amount").notNull(),
  deductible: integer("deductible").notNull(),
  premiumPerWeek: integer("premium_per_week").notNull(),
  nextPaymentAt: timestamp("next_payment_at", { withTimezone: true }).notNull(),
  claimsCount: integer("claims_count").notNull().default(0),
  premiumMultiplier: real("premium_multiplier").notNull().default(1),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
}, (t) => ({
  propertyIdx: uniqueIndex("insurance_property_idx").on(t.propertyId)
    .where(sql`${t.active} = true`),
  holderIdx: index("insurance_holder_idx").on(t.holderId),
  dueIdx:    index("insurance_due_idx").on(t.nextPaymentAt, t.active),
}));

/* ══════════════════ UTILITÉS ══════════════════ */

export const propertyUtilities = pgTable("property_utilities", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  kind: utilityKindEnum("kind").notNull(),
  provider: text("provider").notNull(),
  connected: boolean("connected").notNull().default(false),
  suspended: boolean("suspended").notNull().default(false),
  baseRate: integer("base_rate").notNull().default(0),
  consumption: real("consumption").notNull().default(0),
  unitRate: real("unit_rate").notNull().default(0),
  balanceOwed: integer("balance_owed").notNull().default(0),
  nextBillAt: timestamp("next_bill_at", { withTimezone: true }),
  lastPaidAt: timestamp("last_paid_at", { withTimezone: true }),
  lifetimeConsumption: real("lifetime_consumption").notNull().default(0),
}, (t) => ({
  propertyIdx: index("utilities_property_idx").on(t.propertyId),
  uniqueKind:  uniqueIndex("utilities_unique_idx").on(t.propertyId, t.kind),
  overdueIdx:  index("utilities_overdue_idx").on(t.balanceOwed, t.suspended),
}));

/* ══════════════════ BAUX ══════════════════ */

export const leases = pgTable("leases", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  landlordId: integer("landlord_id")
    .references(() => characters.id, { onDelete: "set null" }),
  landlordBusinessId: text("landlord_business_id")
    .references(() => businesses.id, { onDelete: "set null" }),
  tenantId: integer("tenant_id").notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  rentPerWeek: integer("rent_per_week").notNull(),
  deposit: integer("deposit").notNull().default(0),
  utilitiesIncluded: boolean("utilities_included").notNull().default(false),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  nextPaymentAt: timestamp("next_payment_at", { withTimezone: true }).notNull(),
  paymentsMade: integer("payments_made").notNull().default(0),
  paymentsMissed: integer("payments_missed").notNull().default(0),
  arrears: integer("arrears").notNull().default(0),
  status: leaseStatusEnum("status").notNull().default("actif"),
  evictionNoticeAt: timestamp("eviction_notice_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  terminatedAt: timestamp("terminated_at", { withTimezone: true }),
}, (t) => ({
  propertyIdx: index("leases_property_idx").on(t.propertyId),
  tenantIdx:   index("leases_tenant_idx").on(t.tenantId),
  landlordIdx: index("leases_landlord_idx").on(t.landlordId),
  activeIdx:   uniqueIndex("leases_active_idx").on(t.propertyId)
    .where(sql`${t.status} = 'actif'`),
  dueIdx:      index("leases_due_idx").on(t.nextPaymentAt, t.status),
}));

/* ══════════════════ CLÉS ══════════════════ */

export const propertyKeys = pgTable("property_keys", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  holderId: integer("holder_id").notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  masterKey: boolean("master_key").notNull().default(false),
  canLock: boolean("can_lock").notNull().default(true),
  canAccessGarage: boolean("can_access_garage").notNull().default(false),
  canAccessStorage: boolean("can_access_storage").notNull().default(false),
  canDisarmAlarm: boolean("can_disarm_alarm").notNull().default(false),
  grantedBy: integer("granted_by").references(() => characters.id),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isCopy: boolean("is_copy").notNull().default(false),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => ({
  propertyIdx: index("keys_property_idx").on(t.propertyId),
  holderIdx:   index("keys_holder_idx").on(t.holderId),
  uniqueKey:   uniqueIndex("keys_unique_idx").on(t.propertyId, t.holderId)
    .where(sql`${t.revokedAt} IS NULL`),
}));

/* ══════════════════ CAMÉRAS ══════════════════ */

export const propertyCameras = pgTable("property_cameras", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  posX: real("pos_x").notNull(),
  posY: real("pos_y").notNull(),
  posZ: real("pos_z").notNull(),
  rotationY: real("rotation_y").notNull().default(0),
  fov: real("fov").notNull().default(70),
  range: real("range").notNull().default(14),
  active: boolean("active").notNull().default(true),
  damaged: boolean("damaged").notNull().default(false),
  retentionHours: integer("retention_hours").notNull().default(72),
  installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  propertyIdx: index("cameras_property_idx").on(t.propertyId),
}));

/* ══════════════════ ÉVÉNEMENTS SÉCURITÉ ══════════════════ */

export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  kind: text("kind", {
    enum: [
      "alarme_declenchee", "alarme_armee", "alarme_desarmee",
      "porte_forcee", "camera_detruite", "intrusion",
      "cle_utilisee", "code_errone", "police_alertee",
    ],
  }).notNull(),
  characterId: integer("character_id")
    .references(() => characters.id, { onDelete: "set null" }),
  cameraId: integer("camera_id")
    .references(() => propertyCameras.id, { onDelete: "set null" }),
  details: text("details"),
  policeNotified: boolean("police_notified").notNull().default(false),
  responseSeconds: integer("response_seconds"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (t) => ({
  propertyIdx:  index("security_property_idx").on(t.propertyId),
  characterIdx: index("security_character_idx").on(t.characterId),
  dateIdx:      index("security_date_idx").on(t.occurredAt),
  expiryIdx:    index("security_expiry_idx").on(t.expiresAt),
}));

/* ══════════════════ MEUBLES ══════════════════ */

export const propertyFurniture = pgTable("property_furniture", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  furnitureId: text("furniture_id").notNull(),
  label: text("label").notNull(),
  category: text("category").notNull(),
  posX: real("pos_x").notNull(),
  posY: real("pos_y").notNull(),
  posZ: real("pos_z").notNull(),
  rotationY: real("rotation_y").notNull().default(0),
  scale: real("scale").notNull().default(1),
  colorHex: text("color_hex"),
  isContainer: boolean("is_container").notNull().default(false),
  containerCapacity: real("container_capacity").notNull().default(0),
  powerDraw: real("power_draw").notNull().default(0),
  purchasePrice: integer("purchase_price").notNull().default(0),
  placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  propertyIdx: index("furniture_property_idx").on(t.propertyId),
}));

/* ══════════════════ RÉNOVATIONS ══════════════════ */

export const renovations = pgTable("renovations", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  contractorId: text("contractor_id")
    .references(() => businesses.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  fromType: propertyTypeEnum("from_type").notNull(),
  toType: propertyTypeEnum("to_type").notNull(),
  fromZoning: zoningEnum("from_zoning").notNull(),
  toZoning: zoningEnum("to_zoning").notNull(),
  addBedrooms: integer("add_bedrooms").notNull().default(0),
  addBathrooms: real("add_bathrooms").notNull().default(0),
  addFloors: integer("add_floors").notNull().default(0),
  addGarageSlots: integer("add_garage_slots").notNull().default(0),
  addAreaM2: real("add_area_m2").notNull().default(0),
  insulationGain: real("insulation_gain").notNull().default(0),
  permitNumber: text("permit_number"),
  permitApproved: boolean("permit_approved").notNull().default(false),
  permitCost: integer("permit_cost").notNull().default(0),
  requiresZoningChange: boolean("requires_zoning_change").notNull().default(false),
  zoningApproved: boolean("zoning_approved").notNull().default(false),
  zoningRequestedAt: timestamp("zoning_requested_at", { withTimezone: true }),
  estimatedCost: integer("estimated_cost").notNull(),
  actualCost: integer("actual_cost").notNull().default(0),
  overrun: integer("overrun").notNull().default(0),
  materialsRequired: jsonb("materials_required").notNull().default({}),
  materialsDelivered: jsonb("materials_delivered").notNull().default({}),
  stage: renovationStageEnum("stage").notNull().default("planifie"),
  progress: real("progress").notNull().default(0),
  laborHoursRequired: real("labor_hours_required").notNull(),
  laborHoursDone: real("labor_hours_done").notNull().default(0),
  assignedWorkers: jsonb("assigned_workers").notNull().default([]),
  inspectionPassed: boolean("inspection_passed").notNull().default(false),
  inspectionNotes: text("inspection_notes"),
  inspectedBy: text("inspected_by"),
  inspectedAt: timestamp("inspected_at", { withTimezone: true }),
  stopWorkOrder: boolean("stop_work_order").notNull().default(false),
  stopWorkReason: text("stop_work_reason"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  deadline: timestamp("deadline", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  propertyIdx:   index("renovations_property_idx").on(t.propertyId),
  clientIdx:     index("renovations_client_idx").on(t.clientId),
  contractorIdx: index("renovations_contractor_idx").on(t.contractorId),
  stageIdx:      index("renovations_stage_idx").on(t.stage),
  activeIdx:     uniqueIndex("renovations_active_idx").on(t.propertyId)
    .where(sql`${t.stage} NOT IN ('termine', 'abandonne')`),
}));

/* ══════════════════ TRANSACTIONS ══════════════════ */

export const propertyTransactions = pgTable("property_transactions", {
  id: serial("id").primaryKey(),
  propertyId: text("property_id").notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  kind: text("kind", {
    enum: ["vente", "achat", "saisie", "heritage", "don", "expropriation"],
  }).notNull(),
  sellerId: integer("seller_id").references(() => characters.id, { onDelete: "set null" }),
  buyerId: integer("buyer_id").references(() => characters.id, { onDelete: "set null" }),
  salePrice: integer("sale_price").notNull(),
  transferTax: integer("transfer_tax").notNull().default(0),
  notaryFee: integer("notary_fee").notNull().default(0),
  notaryName: text("notary_name"),
  brokerFee: integer("broker_fee").notNull().default(0),
  brokerBusinessId: text("broker_business_id")
    .references(() => businesses.id, { onDelete: "set null" }),
  totalCost: integer("total_cost").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  propertyIdx: index("prop_tx_property_idx").on(t.propertyId),
  buyerIdx:    index("prop_tx_buyer_idx").on(t.buyerId),
  sellerIdx:   index("prop_tx_seller_idx").on(t.sellerId),
  dateIdx:     index("prop_tx_date_idx").on(t.completedAt),
}));

/* ══════════════════ RELATIONS ══════════════════ */

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  ownerCharacter: one(characters, {
    fields: [properties.ownerCharacterId],
    references: [characters.id],
  }),
  ownerBusiness: one(businesses, {
    fields: [properties.ownerBusinessId],
    references: [businesses.id],
  }),
  mortgage: one(mortgages, {
    fields: [properties.id],
    references: [mortgages.propertyId],
  }),
  insurance: one(propertyInsurance, {
    fields: [properties.id],
    references: [propertyInsurance.propertyId],
  }),
  utilities: many(propertyUtilities),
  leases: many(leases),
  keys: many(propertyKeys),
  cameras: many(propertyCameras),
  furniture: many(propertyFurniture),
  renovations: many(renovations),
  transactions: many(propertyTransactions),
}));

/* ══════════════════ FONCTIONS MÉTIER ══════════════════ */

export function computeTransferTax(salePrice) {
  const tiers = [
    [58_900, 0.005],
    [294_600, 0.010],
    [Infinity, 0.015],
  ];
  let tax = 0;
  let remaining = salePrice;
  let previousCap = 0;
  for (const [cap, rate] of tiers) {
    if (remaining <= 0) break;
    const bracket = Math.min(remaining, cap - previousCap);
    tax += bracket * rate;
    remaining -= bracket;
    previousCap = cap;
  }
  return Math.round(tax);
}

export function computeNotaryFee(salePrice) {
  return Math.max(1_200, Math.round(salePrice * 0.009));
}

export function computePurchaseCost(salePrice, withBroker = false) {
  const transferTax = computeTransferTax(salePrice);
  const notaryFee = computeNotaryFee(salePrice);
  const brokerFee = withBroker ? Math.round(salePrice * 0.05) : 0;
  const breakdown = [
    { label: "Prix de vente", amount: salePrice },
    { label: "Droits de mutation", amount: transferTax },
    { label: "Honoraires du notaire", amount: notaryFee },
  ];
  if (brokerFee > 0) breakdown.push({ label: "Commission du courtier", amount: brokerFee });
  return {
    salePrice, transferTax, notaryFee, brokerFee,
    total: salePrice + transferTax + notaryFee + brokerFee,
    breakdown,
  };
}

export function computeMortgagePayment(principal, annualRate, weeks) {
  const weeklyRate = annualRate / 100 / 52;
  if (weeklyRate === 0) return Math.ceil(principal / weeks);
  const factor = Math.pow(1 + weeklyRate, weeks);
  return Math.ceil((principal * weeklyRate * factor) / (factor - 1));
}

export function minimumDownPayment(price) {
  if (price <= 500_000) return Math.ceil(price * 0.05);
  return Math.ceil(500_000 * 0.05 + (price - 500_000) * 0.10);
}

export function mortgageInsuranceRequired(price, down) {
  return down / price < 0.20;
}

export function computeMortgageInsurance(principal, down, price) {
  const ratio = down / price;
  if (ratio >= 0.20) return 0;
  const rate = ratio >= 0.15 ? 0.028 : ratio >= 0.10 ? 0.031 : 0.040;
  return Math.round(principal * rate);
}

export function computeElectricityBill(areaM2, insulation, month, avgTemperature, applianceDraw = 0) {
  const baseKwh = areaM2 * 0.9 + applianceDraw * 7;
  const degreeDays = Math.max(0, 18 - avgTemperature) * 7;
  const insulationFactor = 2.2 - (insulation / 100) * 1.6;
  const heatingKwh = degreeDays * areaM2 * 0.028 * insulationFactor;
  const totalKwh = baseKwh + heatingKwh;
  const firstTier = Math.min(totalKwh, 280);
  const secondTier = Math.max(0, totalKwh - 280);
  const cost = firstTier * 0.0678 + secondTier * 0.1046;
  return {
    kwh: Math.round(totalKwh),
    cost: Math.round(cost * 100) / 100,
    heatingShare: totalKwh > 0 ? Math.round((heatingKwh / totalKwh) * 100) : 0,
  };
}

export function computePropertyTaxes(assessedValue, zoning) {
  const municipalRate =
    zoning === "commercial" ? 0.0198 :
    zoning === "industriel" ? 0.0224 :
    zoning === "agricole"   ? 0.0062 : 0.0089;
  const municipal = Math.round(assessedValue * municipalRate);
  const school = Math.round(assessedValue * 0.001054);
  return { municipal, school, total: municipal + school };
}

const MATERIAL_COSTS = {
  demolition:  { cost: 45,  hours: 0.8 },
  structure:   { cost: 380, hours: 4.2 },
  plomberie:   { cost: 210, hours: 2.6 },
  electricite: { cost: 175, hours: 2.2 },
  isolation:   { cost: 95,  hours: 1.4 },
  finition:    { cost: 240, hours: 3.5 },
};

export function quoteRenovation(params) {
  const blockers = [];
  const breakdown = [];
  const materials = {};
  const stages = [];
  const area = params.areaM2 + (params.addAreaM2 ?? 0);
  let cost = 0;
  let hours = 0;

  const typeChanged = params.currentType !== params.targetType;
  const demoRatio = typeChanged ? 0.7 : 0.25;
  const demoCost = Math.round(area * MATERIAL_COSTS.demolition.cost * demoRatio);
  const demoHours = area * MATERIAL_COSTS.demolition.hours * demoRatio;
  cost += demoCost; hours += demoHours;
  stages.push({ stage: "demolition", hours: Math.round(demoHours), cost: demoCost });
  breakdown.push({ label: "Démolition et préparation", amount: demoCost });
  materials["conteneur_dechets"] = Math.ceil(area / 40);

  if ((params.addAreaM2 ?? 0) > 0 || (params.addFloors ?? 0) > 0) {
    const structArea = (params.addAreaM2 ?? 0) + (params.addFloors ?? 0) * params.areaM2;
    const structCost = Math.round(structArea * MATERIAL_COSTS.structure.cost);
    const structHours = structArea * MATERIAL_COSTS.structure.hours;
    cost += structCost; hours += structHours;
    stages.push({ stage: "structure", hours: Math.round(structHours), cost: structCost });
    breakdown.push({ label: "Structure et agrandissement", amount: structCost });
    materials["bois_charpente"] = Math.ceil(structArea * 1.8);
    materials["beton"] = Math.ceil(structArea * 0.35);
  }

  const toCommercial =
    params.targetZoning === "commercial" || params.targetZoning === "industriel";
  const systemsRatio = toCommercial ? 1 : typeChanged ? 0.6 : 0.3;
  const plumbCost = Math.round(area * MATERIAL_COSTS.plomberie.cost * systemsRatio);
  const plumbHours = area * MATERIAL_COSTS.plomberie.hours * systemsRatio;
  cost += plumbCost; hours += plumbHours;
  stages.push({ stage: "plomberie", hours: Math.round(plumbHours), cost: plumbCost });
  breakdown.push({ label: "Plomberie", amount: plumbCost });
  materials["tuyauterie"] = Math.ceil(area * 0.6 * systemsRatio);

  const elecCost = Math.round(area * MATERIAL_COSTS.electricite.cost * systemsRatio);
  const elecHours = area * MATERIAL_COSTS.electricite.hours * systemsRatio;
  cost += elecCost; hours += elecHours;
  stages.push({ stage: "electricite", hours: Math.round(elecHours), cost: elecCost });
  breakdown.push({ label: "Électricité", amount: elecCost });
  materials["cable_electrique"] = Math.ceil(area * 2.2 * systemsRatio);

  const insulationGain = Math.max(
    0, (params.insulationTarget ?? params.currentInsulation) - params.currentInsulation
  );
  if (insulationGain > 0) {
    const insulCost = Math.round(area * MATERIAL_COSTS.isolation.cost * (insulationGain / 50));
    const insulHours = area * MATERIAL_COSTS.isolation.hours * (insulationGain / 50);
    cost += insulCost; hours += insulHours;
    stages.push({ stage: "isolation", hours: Math.round(insulHours), cost: insulCost });
    breakdown.push({
      label: `Isolation (+${Math.round(insulationGain)} points)`,
      amount: insulCost,
    });
    materials["isolant"] = Math.ceil(area * 1.1);
  }

  const finishCost = Math.round(area * MATERIAL_COSTS.finition.cost);
  const finishHours = area * MATERIAL_COSTS.finition.hours;
  cost += finishCost; hours += finishHours;
  stages.push({ stage: "finition", hours: Math.round(finishHours), cost: finishCost });
  breakdown.push({ label: "Finition intérieure", amount: finishCost });
  materials["gypse"] = Math.ceil(area * 1.4);
  materials["peinture"] = Math.ceil(area * 0.12);

  if (params.currentCondition < 40) {
    const surcharge = Math.round(cost * (0.4 - params.currentCondition / 100) * 1.5);
    cost += surcharge;
    breakdown.push({ label: "Majoration — bâtiment délabré", amount: surcharge });
  }

  const requiresPermit = true;
  const permitCost = Math.max(280, Math.round(cost * 0.008));
  cost += permitCost;
  breakdown.push({ label: "Permis municipal de rénovation", amount: permitCost });

  const requiresZoningChange = params.currentZoning !== params.targetZoning;
  let zoningApprovalChance = 1;
  if (requiresZoningChange) {
    const zoningFee = 850;
    cost += zoningFee;
    breakdown.push({ label: "Demande de changement de zonage", amount: zoningFee });
    const key = `${params.currentZoning}->${params.targetZoning}`;
    const chances = {
      "residentiel->commercial": 0.55,
      "residentiel->mixte":      0.75,
      "commercial->residentiel": 0.70,
      "commercial->mixte":       0.85,
      "commercial->industriel":  0.35,
      "agricole->residentiel":   0.25,
      "agricole->commercial":    0.15,
      "industriel->commercial":  0.65,
      "mixte->commercial":       0.80,
    };
    zoningApprovalChance = chances[key] ?? 0.45;
    if (zoningApprovalChance < 0.3) {
      blockers.push(
        `Changement de zonage ${params.currentZoning} vers ${params.targetZoning} ` +
        `rarement accordé (${Math.round(zoningApprovalChance * 100)} % de chances)`
      );
    }
  }

  const requiresContractor = cost > 25_000;
  if (requiresContractor) {
    blockers.push("Travaux de plus de 25 000 $ — un entrepreneur licencié RBQ est requis");
  }
  if (params.currentCondition < 15) {
    blockers.push("Bâtiment en ruine — démolition complète recommandée");
  }
  if (params.targetType === "immeuble" && (params.addFloors ?? 0) < 2) {
    blockers.push("Un immeuble exige au moins trois étages");
  }

  return {
    feasible: blockers.filter(b => b.startsWith("Bâtiment en ruine")).length === 0,
    blockers,
    estimatedCost: cost,
    laborHours: Math.round(hours),
    materials,
    requiresPermit,
    permitCost,
    requiresZoningChange,
    zoningApprovalChance,
    requiresContractor,
    stages,
    breakdown,
  };
}

export function estimateValueAfterRenovation(currentValue, quote, targetZoning, villagePopulation) {
  const marketFactor = Math.min(1.4, 0.55 + Math.log10(villagePopulation) * 0.22);
  const zoningFactor =
    targetZoning === "commercial" ? (villagePopulation > 2000 ? 1.35 : 0.85) :
    targetZoning === "industriel" ? (villagePopulation > 3000 ? 1.25 : 0.7) :
    targetZoning === "mixte"      ? 1.15 : 1;
  const addedValue = Math.round(quote.estimatedCost * marketFactor * zoningFactor);
  const newValue = currentValue + addedValue;
  const gain = addedValue - quote.estimatedCost;
  return {
    newValue,
    gain,
    roi: quote.estimatedCost > 0 ? Math.round((gain / quote.estimatedCost) * 100) : 0,
  };
}

export function canHostBusiness(propertyType, zoning, areaM2, businessType) {
  if (zoning === "residentiel") {
    return { ok: false, reason: "Zonage résidentiel — changement de zonage requis" };
  }
  if (zoning === "agricole") {
    const agricoleOk = ["agricole", "forestiere"];
    if (!agricoleOk.includes(businessType)) {
      return { ok: false, reason: "Zonage agricole — usage limité" };
    }
  }
  const minArea = {
    restaurant: 90, bar: 110, hotel: 400, concessionnaire: 500,
    garage: 180, depanneur: 70, cafe: 55, immobilier: 45,
    construction: 120, transport: 200, forestiere: 150,
    securite: 60, nettoyage: 45, paysagiste: 80,
    deneigement: 100, agricole: 0,
  };
  const required = minArea[businessType] ?? 50;
  if (areaM2 < required) {
    return {
      ok: false,
      reason: `Superficie insuffisante — ${required} m² requis, ${Math.round(areaM2)} m² disponibles`,
    };
  }
  return { ok: true };
}

export function computeDecay(currentCondition, weeksSinceMaintenance, month, yearBuilt, currentYear) {
  let decayRate = 0.12;
  if (month === 3 || month === 4) decayRate *= 2.2;
  else if (month === 1 || month === 2) decayRate *= 1.6;
  else if (month === 11 || month === 12) decayRate *= 1.4;
  if (yearBuilt) {
    const age = currentYear - yearBuilt;
    decayRate *= 1 + Math.min(1.5, age / 80);
  }
  if (weeksSinceMaintenance > 26) decayRate *= 1.8;
  return Math.max(0, currentCondition - decayRate);
}
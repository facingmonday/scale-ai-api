const mongoose = require("mongoose");

const StoreType = require("../storeType/storeType.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const { STORE_TYPE_PRESETS } = require("../store/storeTypePresets");

const classroomTemplateSchema = new mongoose.Schema(
  {
    // null => global template maintained by developers
    // ObjectId => org-owned template copy
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      default: null,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sourceTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassroomTemplate",
      required: false,
      default: null,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Base fields (intentionally *not* requiring organization, unlike baseSchema)
    createdBy: {
      type: String,
      required: true,
    },
    createdDate: Date,
    updatedBy: {
      type: String,
      required: true,
    },
    updatedDate: Date,
  },
  {
    minimize: false,
    timestamps: {
      createdAt: "createdDate",
      updatedAt: "updatedDate",
    },
  }
);

// Allow same key to exist globally and per org
classroomTemplateSchema.index(
  { organization: 1, key: 1 },
  { unique: true, sparse: true }
);
classroomTemplateSchema.index({ organization: 1, isActive: 1 });

// ----------------------------
// Default builder statics
// ----------------------------

/**
 * Default submission variable definitions (template blueprint).
 * Sourced from prior Classroom seed builder.
 */
classroomTemplateSchema.statics.getDefaultSubmissionVariableDefinitions =
  function () {
    return [
      {
        key: "demandOutlook",
        label: "How busy do you expect this week to be?",
        description:
          "Your overall expectation of customer demand for the upcoming week.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "dropdown",
        options: ["LOW", "AVERAGE", "HIGH"],
        defaultValue: "AVERAGE",
        min: null,
        max: null,
        required: true,
        isActive: true,
      },
      {
        key: "inventoryRiskTolerance",
        label: "Which outcome worries you more this week?",
        description:
          "Choose whether you are more concerned about running out of product or ending the week with leftovers.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "selectbutton",
        options: ["STOCKOUT_AVERSION", "BALANCED", "OVERSTOCK_AVERSION"],
        defaultValue: "BALANCED",
        min: null,
        max: null,
        required: true,
        isActive: true,
      },
      {
        key: "reorderIntensityRefrigerated",
        label: "How aggressively are you restocking cold ingredients?",
        description:
          "Cold inventory is costly to store and prone to waste if over-ordered. Scale: 0 = Very Conservative, 50 = Balanced, 100 = Very Aggressive.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        options: [],
        defaultValue: 50,
        min: 0,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "reorderIntensityAmbient",
        label: "What's your plan for shelf-stable supplies?",
        description:
          "Shelf-stable inventory is cheaper to hold but still ties up cash. Scale: 0 = Very Conservative, 50 = Balanced, 100 = Very Aggressive.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "knob",
        options: [],
        defaultValue: 50,
        min: 0,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "reorderIntensityOps",
        label:
          "How cautious are you about running out of everyday operating supplies?",
        description:
          "Operating supplies don't generate revenue but can limit production if they run out. Scale: 0 = Very Conservative, 50 = Balanced, 100 = Very Aggressive.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "knob",
        options: [],
        defaultValue: 50,
        min: 0,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "productionPush",
        label: "How hard are you pushing production this week?",
        description:
          "Pushing production can increase sales or lead to waste if demand is lower than expected. Scale: 0 = Limited, 50 = Normal, 100 = Maximize.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        options: [],
        defaultValue: 50,
        min: 0,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "wasteDiscipline",
        label: "How strict is your team about minimizing waste?",
        description:
          "Stricter waste discipline reduces spoilage but may slow down operations. Scale: 0 = Loose, 50 = Standard, 100 = Strict.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        options: [],
        defaultValue: 50,
        min: 0,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "pricingStrategy",
        label: "How are you pricing your product this week?",
        description:
          "Pricing affects customer demand, revenue, and how quickly inventory moves.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "multiple-choice",
        options: ["DISCOUNT", "STANDARD", "PREMIUM"],
        defaultValue: "STANDARD",
        min: null,
        max: null,
        required: true,
        isActive: true,
      },
      {
        key: "serviceLevelFocus",
        label: "What matters more to you this week?",
        description:
          "Balancing cost control versus fulfilling every possible customer order.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "dropdown",
        options: ["COST_FOCUSED", "BALANCED", "SERVICE_FOCUSED"],
        defaultValue: "BALANCED",
        min: null,
        max: null,
        required: true,
        isActive: true,
      },
    ];
  };

/**
 * Default storeType variable definitions (template blueprint).
 * Sourced from prior Classroom seed builder.
 */
classroomTemplateSchema.statics.getDefaultStoreTypeVariableDefinitions =
  function () {
    return [
      {
        key: "capacity-units-refrigerated",
        label: "Capacity Units (Refrigerated)",
        description:
          "Maximum cold storage capacity in abstract inventory units.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 40,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "starting-units-refrigerated",
        label: "Starting Inventory Units (Refrigerated)",
        description:
          "Initial refrigerated inventory units available at store start.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 24,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "goods-per-unit-refrigerated",
        label: "Goods per Unit (Refrigerated)",
        description:
          "Number of finished goods supported by one refrigerated inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 2.5,
        min: 0.1,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "avg-unit-cost-refrigerated",
        label: "Avg Unit Cost (Refrigerated)",
        description: "Average dollar value of one refrigerated inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 9.5,
        min: 0,
        max: 1000,
        required: true,
        isActive: true,
      },
      {
        key: "holding-cost-per-unit-refrigerated",
        label: "Holding Cost per Unit per Week (Refrigerated)",
        description: "Weekly cost to hold one refrigerated inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 0.75,
        min: 0,
        max: 50,
        required: true,
        isActive: true,
      },
      {
        key: "capacity-units-ambient",
        label: "Capacity Units (Ambient)",
        description:
          "Maximum dry or shelf storage capacity in abstract inventory units.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 80,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "starting-units-ambient",
        label: "Starting Inventory Units (Ambient)",
        description:
          "Initial ambient inventory units available at store start.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 45,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "goods-per-unit-ambient",
        label: "Goods per Unit (Ambient)",
        description:
          "Number of finished goods supported by one ambient inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 5,
        min: 0.1,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "avg-unit-cost-ambient",
        label: "Avg Unit Cost (Ambient)",
        description: "Average dollar value of one ambient inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 4.25,
        min: 0,
        max: 1000,
        required: true,
        isActive: true,
      },
      {
        key: "holding-cost-per-unit-ambient",
        label: "Holding Cost per Unit per Week (Ambient)",
        description: "Weekly cost to hold one ambient inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 0.25,
        min: 0,
        max: 50,
        required: true,
        isActive: true,
      },
      {
        key: "capacity-units-operating-supply",
        label: "Capacity Units (Operating Supplies)",
        description:
          "Maximum capacity for non-resale operating supplies such as packaging and disposables.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 60,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "starting-units-operating-supply",
        label: "Starting Inventory Units (Operating Supplies)",
        description:
          "Initial operating supply inventory units available at store start.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 35,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "goods-per-unit-operating-supply",
        label: "Goods per Unit (Operating Supplies)",
        description:
          "Number of finished goods supported by one operating supply unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 12,
        min: 0.1,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "avg-unit-cost-operating-supply",
        label: "Avg Unit Cost (Operating Supplies)",
        description:
          "Average dollar value of one operating supply inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 1.75,
        min: 0,
        max: 1000,
        required: true,
        isActive: true,
      },
      {
        key: "holding-cost-per-unit-operating-supply",
        label: "Holding Cost per Unit per Week (Operating Supplies)",
        description: "Weekly cost to hold one operating supply inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 0.15,
        min: 0,
        max: 50,
        required: true,
        isActive: true,
      },
    ];
  };

// ----------------------------
// Template lifecycle statics
// ----------------------------

classroomTemplateSchema.statics.GLOBAL_DEFAULT_KEY = "default_supply_chain_101";

/**
 * Default classroom prompts (prepended to OpenAI messages).
 * These prompts do NOT depend on scenario/submission/store data.
 */
classroomTemplateSchema.statics.getDefaultClassroomPrompts = function () {
  const warehouseRules = `
WAREHOUSE RULES - YOU MUST OBEY THESE RULES. Outputs that violate these rules are invalid.

1. INVENTORY BUCKETS
Inventory exists ONLY in these buckets:
- refrigerated
- ambient
- notForResaleDry

All units belong to exactly one bucket.

2. CAPACITY (HARD LIMITS)
Each bucket has a fixed capacity:
- refrigeratedCapacityUnits
- ambientCapacityUnits
- notForResaleCapacityUnits

Rule:
endUnits(bucket) ≤ capacityUnits(bucket)

3. INVENTORY RECONCILIATION (REQUIRED)
For EACH bucket track:
beginUnits, receivedUnits, usedUnits, wasteUnits, endUnits

This equation MUST hold:
endUnits = beginUnits + receivedUnits - usedUnits - wasteUnits

4. RECEIPTS & OVERFLOW
If beginUnits + receivedUnits > capacityUnits, you MUST apply overflowStoragePolicy.

PAY_FOR_OVERFLOW:
- Excess units incur overflowStorageCost
- Excess units do NOT increase endUnits
- Excess units are not usable

DISCARD_EXCESS:
- Excess units become wasteUnits
- Waste disposal cost applies

EMERGENCY_REPLENISHMENT:
- Excess units rejected
- Emergency units incur expediteCost
- Capacity rules still apply

Overflow inventory may NEVER be carried forward as normal inventory.

5. USAGE (MAKE)
Inventory may only be used if it exists:
usedUnits ≤ beginUnits + receivedUnits

Default consumption order:
refrigerated → ambient → notForResaleDry

6. WASTE
wasteUnits ≥ 0
wasteUnits ≤ beginUnits + receivedUnits - usedUnits
Waste must be explicitly recorded per bucket.

7. HOLDING COST
After inventory movement:
holdingCost(bucket) = endUnits(bucket) × holdingCostPerUnit(bucket)

Total holding cost = sum across all buckets.

8. PROHIBITED
You MUST NEVER:
- Create inventory without receipt
- Use inventory that does not exist
- Store inventory outside buckets
- Exceed capacity without overflow handling
- Adjust inventory to force profitability

9. LEDGER REQUIREMENTS
If inventory exists, ledger MUST include:
- education.materialFlowByBucket
- holdingCost
- overflowStorageCost (if any)
- wasteDisposalCost (if any)

10. CAUSAL EXPLANATIONS
Narratives must follow physical causality:
overstock → overflow/waste → higher cost
understock → stockout → lost sales
cold inventory → higher holding cost

Narratives may NOT contradict inventory math.

11. INVENTORY ORDERING (REQUIRED)
You MUST calculate receivedUnits for each bucket based on the student's reorder policy and submission decisions:

REORDER_POINT:
- Order when: beginUnits < (capacityUnits × reorderPointPercent / 100) for that bucket
- Order quantity: typically replenish to 80-90% of capacity (higher for BALANCED/HIGH safetyStockByBucketStrategy, lower for LOW)
- Apply inventoryProtectionPriority to determine bucket ordering sequence
- Example: If refrigeratedCapacityUnits=500, reorderPointRefrigeratedPercent=20, and beginUnits=80, then 80 < 100, so ORDER

FIXED_INTERVAL:
- Order every week/interval regardless of current stock level
- Order quantity: typically 60-80% of capacity (adjust based on demandCommitmentLevel: AGGRESSIVE=higher, CONSERVATIVE=lower)
- Consider safetyStockByBucketStrategy: HIGH=more, LOW=less
- Example: If refrigeratedCapacityUnits=500 and demandCommitmentLevel=AGGRESSIVE, order ~350-400 units

DEMAND_TRIGGERED:
- Order based on plannedProductionUnits, expected demand, and current inventory
- Order quantity: sufficient to support plannedProductionUnits plus safety stock (based on safetyStockByBucketStrategy)
- Factor in supplierLeadTime: SHORT=less buffer needed, LONG=more buffer needed

ORDER DISTRIBUTION:
- receivedUnits must be allocated across buckets based on:
  - inventoryProtectionPriority (REFRIGERATED_FIRST prioritizes cold storage, etc.)
  - The bucket's capacity limits
  - The bucket's reorderPointPercent threshold (for REORDER_POINT policy)
  
- For each bucket, calculate:
  - Should I order? (based on policy)
  - How much should I order? (based on capacity, strategy, and demand)
  - Add to receivedUnits for that bucket

MULTI-BUCKET ORDERING REQUIREMENT:
- You MUST order inventory for ALL buckets that are part of operations, not just refrigerated
- Typical distribution for pizza operations:
  - Refrigerated: 50-70% of total order (cheese, meat, produce - perishable items)
  - Ambient: 20-35% of total order (flour, canned goods, dry ingredients)
  - NotForResaleDry: 10-20% of total order (paper goods, cleaning supplies, packaging)
- Adjust distribution based on inventoryProtectionPriority:
  - REFRIGERATED_FIRST: 60-75% refrigerated, 20-30% ambient, 5-15% notForResaleDry
  - AMBIENT_FIRST: 40-50% refrigerated, 40-50% ambient, 10-20% notForResaleDry
  - BALANCED: 50-60% refrigerated, 30-40% ambient, 10-20% notForResaleDry

SAFETY STOCK REQUIREMENT:
- DO NOT use 100% of received inventory in the same period it was received
- Maintain safety stock: endUnits should typically be 10-30% of capacity (higher for HIGH safetyStockByBucketStrategy)
- If you receive 400 units, don't use all 400 - leave some as ending inventory for next period
- Example: If capacity is 500 and you receive 400 units, use 300-350 for production, leaving 50-100 as safety stock
- This prevents stockouts if there are delays in next period's deliveries

CRITICAL: receivedUnits must be > 0 for buckets where ordering is triggered OR where beginUnits = 0. Do NOT set all receivedUnits to 0 unless the student explicitly chose to order nothing.

12. FINAL CHECK
Before returning output:
- Buckets reconcile: endUnits = beginUnits + receivedUnits - usedUnits - wasteUnits for EACH bucket
- No capacity violations: endUnits ≤ capacityUnits for each bucket
- Costs match inventory state: holdingCost = sum of (endUnits × holdingCostPerUnit) for each bucket
- No inventory appears or disappears
- receivedUnits reflect ordering decisions based on reorder policy
- MULTI-BUCKET: At least 2 buckets should have receivedUnits > 0 (refrigerated + at least one other)
- SAFETY STOCK: endUnits should not be 0 for all buckets unless operations are ceasing
- CONSISTENCY: inventoryState.refrigeratedUnits MUST equal education.materialFlowByBucket.refrigerated.endUnits
- CONSISTENCY: inventoryState.ambientUnits MUST equal education.materialFlowByBucket.ambient.endUnits
- CONSISTENCY: inventoryState.notForResaleUnits MUST equal education.materialFlowByBucket.notForResaleDry.endUnits
`;

  return [
    {
      role: "system",
      content:
        "You are the SCALE.ai simulation engine for a supply chain class using a pizza shop game. Calculate outcomes for one student based on store configuration, scenario context, global outcome, and the student's decisions. Apply realistic business logic and environmental effects.\n\n" +
        "Return ONLY valid JSON matching the provided schema. You may invent reasonable intermediate numbers when needed. Also compute the required education metrics so instructors can explain results (service level, stockouts/lost sales, by-bucket material flow, and cost breakdown).",
    },
    { role: "system", content: warehouseRules },
  ];
};

function buildDefaultStoreTypeValuesByStoreTypeKey() {
  // These values are intended to be small, classroom-friendly “abstract units”
  // while still reflecting meaningful differences between store types.
  const defaultsByKey = {
    "capacity-units-refrigerated": 40,
    "starting-units-refrigerated": 24,
    "goods-per-unit-refrigerated": 2.5,
    "avg-unit-cost-refrigerated": 9.5,
    "holding-cost-per-unit-refrigerated": 0.75,

    "capacity-units-ambient": 80,
    "starting-units-ambient": 45,
    "goods-per-unit-ambient": 5,
    "avg-unit-cost-ambient": 4.25,
    "holding-cost-per-unit-ambient": 0.25,

    "capacity-units-operating-supply": 60,
    "starting-units-operating-supply": 35,
    "goods-per-unit-operating-supply": 12,
    "avg-unit-cost-operating-supply": 1.75,
    "holding-cost-per-unit-operating-supply": 0.15,
  };

  // Hand-tuned adjustments using STORE_TYPE_PRESETS as qualitative guidance:
  // - Fine dining: higher cost, higher cold-chain intensity, lower conversion efficiency
  // - Street cart/festival: high throughput + packaging emphasis
  // - Franchise: scale efficiencies lower cost, higher capacity
  const overrides = {
    food_truck: {
      "capacity-units-refrigerated": 45,
      "starting-units-refrigerated": 30,
      "capacity-units-ambient": 60,
      "starting-units-ambient": 25,
      "capacity-units-operating-supply": 55,
      "starting-units-operating-supply": 30,
    },
    cafe: {
      // balanced defaults
    },
    bar_and_grill: {
      "capacity-units-refrigerated": 55,
      "starting-units-refrigerated": 35,
      "capacity-units-ambient": 95,
      "starting-units-ambient": 55,
      "capacity-units-operating-supply": 70,
      "starting-units-operating-supply": 40,
    },
    fine_dining: {
      "capacity-units-refrigerated": 90,
      "starting-units-refrigerated": 60,
      "goods-per-unit-refrigerated": 1.8,
      "avg-unit-cost-refrigerated": 18,
      "holding-cost-per-unit-refrigerated": 1.5,

      "capacity-units-ambient": 60,
      "starting-units-ambient": 30,
      "goods-per-unit-ambient": 4,
      "avg-unit-cost-ambient": 6,
      "holding-cost-per-unit-ambient": 0.35,

      "capacity-units-operating-supply": 60,
      "starting-units-operating-supply": 35,
      "goods-per-unit-operating-supply": 10,
      "avg-unit-cost-operating-supply": 2.2,
      "holding-cost-per-unit-operating-supply": 0.18,
    },
    street_cart: {
      "capacity-units-refrigerated": 20,
      "starting-units-refrigerated": 12,
      "goods-per-unit-refrigerated": 3.2,
      "avg-unit-cost-refrigerated": 7,
      "holding-cost-per-unit-refrigerated": 0.6,

      "capacity-units-ambient": 70,
      "starting-units-ambient": 40,
      "goods-per-unit-ambient": 6.5,
      "avg-unit-cost-ambient": 3.8,
      "holding-cost-per-unit-ambient": 0.2,

      "capacity-units-operating-supply": 90,
      "starting-units-operating-supply": 60,
      "goods-per-unit-operating-supply": 14,
      "avg-unit-cost-operating-supply": 1.4,
      "holding-cost-per-unit-operating-supply": 0.12,
    },
    late_night_window: {
      "capacity-units-refrigerated": 50,
      "starting-units-refrigerated": 30,
      "capacity-units-ambient": 80,
      "starting-units-ambient": 45,
      "capacity-units-operating-supply": 75,
      "starting-units-operating-supply": 45,
    },
    ghost_kitchen: {
      "capacity-units-refrigerated": 65,
      "starting-units-refrigerated": 40,
      "avg-unit-cost-refrigerated": 10,
      "holding-cost-per-unit-refrigerated": 0.9,

      "capacity-units-ambient": 90,
      "starting-units-ambient": 50,
      "capacity-units-operating-supply": 80,
      "starting-units-operating-supply": 50,
    },
    campus_kiosk: {
      "capacity-units-refrigerated": 55,
      "starting-units-refrigerated": 32,
      "capacity-units-ambient": 100,
      "starting-units-ambient": 60,
      "capacity-units-operating-supply": 85,
      "starting-units-operating-supply": 55,
    },
    upscale_bistro: {
      "capacity-units-refrigerated": 70,
      "starting-units-refrigerated": 45,
      "goods-per-unit-refrigerated": 2.2,
      "avg-unit-cost-refrigerated": 14,
      "holding-cost-per-unit-refrigerated": 1.1,

      "capacity-units-ambient": 85,
      "starting-units-ambient": 45,
      "avg-unit-cost-ambient": 5.5,
      "holding-cost-per-unit-ambient": 0.3,

      "capacity-units-operating-supply": 65,
      "starting-units-operating-supply": 35,
    },
    festival_vendor: {
      "capacity-units-refrigerated": 60,
      "starting-units-refrigerated": 30,
      "capacity-units-ambient": 120,
      "starting-units-ambient": 70,
      "capacity-units-operating-supply": 110,
      "starting-units-operating-supply": 70,
    },
    franchise_location: {
      "capacity-units-refrigerated": 80,
      "starting-units-refrigerated": 50,
      "avg-unit-cost-refrigerated": 8.5,
      "holding-cost-per-unit-refrigerated": 0.7,

      "capacity-units-ambient": 110,
      "starting-units-ambient": 70,
      "avg-unit-cost-ambient": 3.8,
      "holding-cost-per-unit-ambient": 0.22,

      "capacity-units-operating-supply": 80,
      "starting-units-operating-supply": 45,
      "avg-unit-cost-operating-supply": 1.5,
      "holding-cost-per-unit-operating-supply": 0.14,
    },
  };

  const result = {};
  Object.keys(STORE_TYPE_PRESETS || {}).forEach((storeTypeKey) => {
    result[storeTypeKey] = {
      ...defaultsByKey,
      ...(overrides[storeTypeKey] || {}),
    };
  });

  return result;
}

classroomTemplateSchema.statics.ensureGlobalDefaultTemplate =
  async function () {
    const key = this.GLOBAL_DEFAULT_KEY;
    const existing = await this.findOne({ organization: null, key });
    if (existing) {
      // Backfill missing payload sections for older globals (idempotent)
      const payload =
        existing.payload && typeof existing.payload === "object"
          ? existing.payload
          : {};

      if (
        !Array.isArray(payload.storeTypes) ||
        payload.storeTypes.length === 0
      ) {
        payload.storeTypes = Object.keys(STORE_TYPE_PRESETS || {}).map((k) => ({
          key: k,
          label: STORE_TYPE_PRESETS[k]?.label || k,
          description: STORE_TYPE_PRESETS[k]?.description || "",
          startingBalance: Number(STORE_TYPE_PRESETS[k]?.startingBalance) || 0,
          initialStartupCost:
            Number(STORE_TYPE_PRESETS[k]?.initialStartupCost) || 0,
          isActive: true,
        }));
      } else {
        // Backfill startingBalance / initialStartupCost for older templates
        payload.storeTypes = payload.storeTypes.map((st) => {
          if (!st || !st.key) return st;
          const preset = STORE_TYPE_PRESETS?.[st.key] || {};
          return {
            ...st,
            startingBalance:
              st.startingBalance !== undefined && st.startingBalance !== null
                ? Number(st.startingBalance)
                : Number(preset.startingBalance) || 0,
            initialStartupCost:
              st.initialStartupCost !== undefined &&
              st.initialStartupCost !== null
                ? Number(st.initialStartupCost)
                : Number(preset.initialStartupCost) || 0,
          };
        });
      }

      if (
        !payload.storeTypeValuesByStoreTypeKey ||
        typeof payload.storeTypeValuesByStoreTypeKey !== "object" ||
        Object.keys(payload.storeTypeValuesByStoreTypeKey).length === 0
      ) {
        payload.storeTypeValuesByStoreTypeKey =
          buildDefaultStoreTypeValuesByStoreTypeKey();
      }

      if (!Array.isArray(payload.prompts) || payload.prompts.length === 0) {
        payload.prompts = this.getDefaultClassroomPrompts();
      }

      existing.payload = payload;
      existing.updatedBy = existing.updatedBy || "system_startup";
      await existing.save();
      return existing;
    }

    const payload = {
      storeTypes: Object.keys(STORE_TYPE_PRESETS || {}).map((key) => ({
        key,
        label: STORE_TYPE_PRESETS[key]?.label || key,
        description: STORE_TYPE_PRESETS[key]?.description || "",
        startingBalance: Number(STORE_TYPE_PRESETS[key]?.startingBalance) || 0,
        initialStartupCost:
          Number(STORE_TYPE_PRESETS[key]?.initialStartupCost) || 0,
        isActive: true,
      })),
      variableDefinitionsByAppliesTo: {
        storeType: this.getDefaultStoreTypeVariableDefinitions(),
        store: [],
        submission: this.getDefaultSubmissionVariableDefinitions(),
        scenario: [],
      },
      storeTypeValuesByStoreTypeKey:
        buildDefaultStoreTypeValuesByStoreTypeKey(),
      prompts: this.getDefaultClassroomPrompts(),
    };

    const doc = new this({
      organization: null,
      key,
      label: "Supply Chain 101 (Default)",
      description:
        "Default developer-managed template for SCALE.ai Supply Chain 101 simulation.",
      isActive: true,
      version: 1,
      payload,
      createdBy: "system_startup",
      updatedBy: "system_startup",
    });

    await doc.save();
    return doc;
  };

classroomTemplateSchema.statics.copyGlobalToOrganization = async function (
  organizationId,
  clerkUserId
) {
  const globalTemplate = await this.ensureGlobalDefaultTemplate();
  const existingOrgTemplate = await this.findOne({
    organization: organizationId,
    key: globalTemplate.key,
  });
  if (existingOrgTemplate) {
    // Backfill missing values on org templates created before storeTypeValues existed
    const payload =
      existingOrgTemplate.payload &&
      typeof existingOrgTemplate.payload === "object"
        ? existingOrgTemplate.payload
        : {};

    if (
      !payload.storeTypeValuesByStoreTypeKey ||
      typeof payload.storeTypeValuesByStoreTypeKey !== "object" ||
      Object.keys(payload.storeTypeValuesByStoreTypeKey).length === 0
    ) {
      payload.storeTypeValuesByStoreTypeKey =
        globalTemplate.payload?.storeTypeValuesByStoreTypeKey || {};
      existingOrgTemplate.payload = payload;
      existingOrgTemplate.updatedBy = clerkUserId;
      await existingOrgTemplate.save();
    }

    // Backfill prompts if missing
    if (!Array.isArray(payload.prompts) || payload.prompts.length === 0) {
      payload.prompts =
        globalTemplate.payload?.prompts || this.getDefaultClassroomPrompts();
      existingOrgTemplate.payload = payload;
      existingOrgTemplate.updatedBy = clerkUserId;
      await existingOrgTemplate.save();
    }

    // Backfill storeTypes financial fields (startingBalance, initialStartupCost) if missing
    if (Array.isArray(payload.storeTypes) && payload.storeTypes.length > 0) {
      const byKey = new Map(
        (globalTemplate.payload?.storeTypes || []).map((st) => [st.key, st])
      );
      const patched = payload.storeTypes.map((st) => {
        if (!st || !st.key) return st;
        const globalSt = byKey.get(st.key) || {};
        return {
          ...st,
          startingBalance:
            st.startingBalance !== undefined && st.startingBalance !== null
              ? Number(st.startingBalance)
              : Number(globalSt.startingBalance) || 0,
          initialStartupCost:
            st.initialStartupCost !== undefined &&
            st.initialStartupCost !== null
              ? Number(st.initialStartupCost)
              : Number(globalSt.initialStartupCost) || 0,
        };
      });
      payload.storeTypes = patched;
      existingOrgTemplate.payload = payload;
      existingOrgTemplate.updatedBy = clerkUserId;
      await existingOrgTemplate.save();
    }
    return existingOrgTemplate;
  }

  const orgTemplate = new this({
    organization: organizationId,
    key: globalTemplate.key,
    label: globalTemplate.label,
    description: globalTemplate.description,
    version: globalTemplate.version,
    isActive: true,
    sourceTemplateId: globalTemplate._id,
    payload: globalTemplate.payload,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await orgTemplate.save();
  return orgTemplate;
};

// ----------------------------
// Apply template to classroom
// ----------------------------

function normalizeVariableDefinitionsByAppliesTo(payload) {
  const src = payload?.variableDefinitionsByAppliesTo || {};
  return {
    storeType: Array.isArray(src.storeType) ? src.storeType : [],
    store: Array.isArray(src.store) ? src.store : [],
    submission: Array.isArray(src.submission) ? src.submission : [],
    scenario: Array.isArray(src.scenario) ? src.scenario : [],
  };
}

classroomTemplateSchema.methods.applyToClassroom = async function ({
  classroomId,
  organizationId,
  clerkUserId,
}) {
  if (!classroomId) throw new Error("classroomId is required");
  if (!organizationId) throw new Error("organizationId is required");

  const stats = {
    storeTypesCreated: 0,
    storeTypesSkipped: 0,
    variableDefinitionsCreated: 0,
    variableDefinitionsSkipped: 0,
    variableValuesCreated: 0,
    variableValuesSkipped: 0,
  };

  const payload = this.payload || {};
  const defsByScope = normalizeVariableDefinitionsByAppliesTo(payload);
  const storeTypesPayload = Array.isArray(payload.storeTypes)
    ? payload.storeTypes
    : [];
  const storeTypeValuesByKey =
    payload.storeTypeValuesByStoreTypeKey &&
    typeof payload.storeTypeValuesByStoreTypeKey === "object"
      ? payload.storeTypeValuesByStoreTypeKey
      : {};

  // 1) Create StoreTypes (classroom-scoped)
  const storeTypeDocs = [];
  for (const st of storeTypesPayload) {
    if (!st || !st.key) continue;
    const existing = await StoreType.findOne({
      organization: organizationId,
      classroomId,
      key: st.key,
    }).select("_id");
    if (existing) {
      stats.storeTypesSkipped += 1;
      continue;
    }

    const doc = new StoreType({
      organization: organizationId,
      classroomId,
      key: st.key,
      label: st.label || st.key,
      description: st.description || "",
      startingBalance:
        st.startingBalance !== undefined && st.startingBalance !== null
          ? Number(st.startingBalance)
          : 0,
      initialStartupCost:
        st.initialStartupCost !== undefined && st.initialStartupCost !== null
          ? Number(st.initialStartupCost)
          : 0,
      isActive: st.isActive !== false,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    await doc.save();
    storeTypeDocs.push(doc);
    stats.storeTypesCreated += 1;
  }

  // If template didn't include store types, we still may want values/defs; store types are required for values.
  const allStoreTypesInClass = storeTypeDocs.length
    ? storeTypeDocs
    : await StoreType.find({
        organization: organizationId,
        classroomId,
        isActive: true,
      });

  // 2) Create VariableDefinitions (classroom-scoped, create-only)
  const allDefs = [
    ...defsByScope.storeType,
    ...defsByScope.store,
    ...defsByScope.submission,
    ...defsByScope.scenario,
  ];

  for (const def of allDefs) {
    if (!def || !def.key || !def.appliesTo) continue;
    const exists = await VariableDefinition.findOne({
      organization: organizationId,
      classroomId,
      appliesTo: def.appliesTo,
      key: def.key,
    }).select("_id");

    if (exists) {
      stats.variableDefinitionsSkipped += 1;
      continue;
    }

    await VariableDefinition.createDefinition(
      classroomId,
      def,
      organizationId,
      clerkUserId
    );
    stats.variableDefinitionsCreated += 1;
  }

  // 3) Create storeType VariableValues for each storeType × storeType definition (create-only)
  const storeTypeDefs = defsByScope.storeType;
  if (allStoreTypesInClass.length > 0 && storeTypeDefs.length > 0) {
    const storeTypeIds = allStoreTypesInClass.map((s) => s._id);
    const defKeys = storeTypeDefs.map((d) => d.key);

    const existing = await VariableValue.find({
      organization: organizationId,
      classroomId,
      appliesTo: "storeType",
      ownerId: { $in: storeTypeIds },
      variableKey: { $in: defKeys },
    }).select("ownerId variableKey");

    const existingSet = new Set(
      (existing || []).map((v) => `${v.ownerId.toString()}::${v.variableKey}`)
    );

    const ops = [];
    for (const st of allStoreTypesInClass) {
      const overrideMap =
        storeTypeValuesByKey && storeTypeValuesByKey[st.key]
          ? storeTypeValuesByKey[st.key]
          : null;

      for (const def of storeTypeDefs) {
        const compound = `${st._id.toString()}::${def.key}`;
        if (existingSet.has(compound)) {
          stats.variableValuesSkipped += 1;
          continue;
        }

        const value =
          overrideMap && overrideMap[def.key] !== undefined
            ? overrideMap[def.key]
            : def.defaultValue;

        ops.push({
          insertOne: {
            document: {
              organization: organizationId,
              classroomId,
              appliesTo: "storeType",
              ownerId: st._id,
              variableKey: def.key,
              value,
              createdBy: clerkUserId,
              updatedBy: clerkUserId,
            },
          },
        });
      }
    }

    if (ops.length > 0) {
      const res = await VariableValue.bulkWrite(ops, { ordered: false });
      stats.variableValuesCreated += res?.insertedCount || 0;
    }
  }

  return stats;
};

const ClassroomTemplate = mongoose.model(
  "ClassroomTemplate",
  classroomTemplateSchema
);

module.exports = ClassroomTemplate;

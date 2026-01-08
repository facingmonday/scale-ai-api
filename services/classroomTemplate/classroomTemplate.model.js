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
        key: "demand-outlook",
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
        key: "inventory-risk-tolerance",
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
        key: "reorder-intensity-refrigerated",
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
        key: "reorder-intensity-ambient",
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
        key: "reorder-intensity-ops",
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
        key: "production-push",
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
        key: "waste-discipline",
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
        key: "pricing-multiplier",
        label: "Pricing Adjustment",
        description:
          "Adjust your pricing relative to your store's baseline price. 0.90 = 10% discount, 1.05 = 5% premium, 1.15 = aggressive pricing. This affects demand and revenue.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        options: [],
        defaultValue: 1.0,
        min: 0.85,
        max: 1.15,
        required: true,
        isActive: true,
      },
      {
        key: "service-level-focus",
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
          "The maximum number of refrigerated inventory units you can store. Think of one unit as a bundle of cold ingredients like cheese, meat, and produce. Example: With a capacity of 40 units and 2.5 finished goods per unit, you can make up to 100 finished goods (40 × 2.5) from refrigerated inventory. This limit shows up in your ledger as inventoryState.refrigeratedUnits and you can never exceed it.",
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
          "How many refrigerated inventory units you start with when opening your store. Example: Starting with 24 units and 2.5 finished goods per unit means you can make 60 finished goods (24 × 2.5) before needing to order more. This must be less than your capacity (40 units). This number appears in your first ledger entry as inventoryState.refrigeratedUnits.",
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
          "How many finished goods you can make from one refrigerated inventory unit. Example: If this is 2.5, then one unit of cold ingredients makes 2.5 finished goods. With a unit cost of $9.50, each finished good costs $3.80 from refrigerated ingredients ($9.50 ÷ 2.5). This shows up in your results as costPerGoodRefrigerated. With a capacity of 40 units, you can make up to 100 finished goods (40 × 2.5) from refrigerated inventory.",
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
        description:
          "How much it costs to buy one refrigerated inventory unit (cold ingredients like cheese, meat, produce). Example: At $9.50 per unit and 2.5 finished goods per unit, each finished good costs $3.80 from refrigerated ingredients ($9.50 ÷ 2.5). This shows up in your results as costPerGoodRefrigerated and is part of your total ingredientCost. If you sell finished goods for $16, you make $12.20 profit per finished good from refrigerated ingredients ($16 - $3.80).",
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
        description:
          "How much it costs each week to keep one refrigerated inventory unit in storage (electricity for refrigeration, storage space, etc.). Example: If you end the week with 20 units in storage and holding cost is $0.75 per unit, you pay $15 in holding costs that week (20 × $0.75). This shows up in your ledger as costBreakdown.holdingCost. Higher holding costs mean it's more expensive to keep inventory, so you'll want to order less and more often.",
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
          "The maximum number of ambient inventory units you can store. Think of one unit as a bundle of dry ingredients like flour, canned goods, and dry spices. Example: With a capacity of 80 units and 5 finished goods per unit, you can make up to 400 finished goods (80 × 5) from ambient inventory. This limit shows up in your ledger as inventoryState.ambientUnits and you can never exceed it.",
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
          "How many ambient inventory units you start with when opening your store. Example: Starting with 45 units and 5 finished goods per unit means you can make 225 finished goods (45 × 5) before needing to order more. This must be less than your capacity (80 units). This number appears in your first ledger entry as inventoryState.ambientUnits.",
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
          "How many finished goods you can make from one ambient inventory unit. Example: If this is 5, then one unit of dry ingredients makes 5 finished goods. With a unit cost of $4.25, each finished good costs $0.85 from ambient ingredients ($4.25 ÷ 5). This shows up in your results as costPerGoodAmbient. With a capacity of 80 units, you can make up to 400 finished goods (80 × 5) from ambient inventory.",
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
        description:
          "How much it costs to buy one ambient inventory unit (dry ingredients like flour, canned goods, spices). Example: At $4.25 per unit and 5 finished goods per unit, each finished good costs $0.85 from ambient ingredients ($4.25 ÷ 5). This shows up in your results as costPerGoodAmbient and is part of your total ingredientCost. If you sell finished goods for $16, you make $15.15 profit per finished good from ambient ingredients ($16 - $0.85).",
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
        description:
          "How much it costs each week to keep one ambient inventory unit in storage (storage space, management, etc.). Example: If you end the week with 50 units in storage and holding cost is $0.25 per unit, you pay $12.50 in holding costs that week (50 × $0.25). This shows up in your ledger as costBreakdown.holdingCost. Since ambient items don't need refrigeration, this is usually cheaper than refrigerated holding costs.",
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
          "The maximum number of operating supply inventory units you can store. Think of one unit as a bundle of supplies like packaging, napkins, cleaning supplies, and other items you need to run the business (but don't sell). Example: With a capacity of 60 units and 12 finished goods per unit, you can make up to 720 finished goods (60 × 12) from operating supplies. This limit shows up in your ledger as inventoryState.notForResaleUnits and you can never exceed it.",
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
          "How many operating supply inventory units you start with when opening your store. Example: Starting with 35 units and 12 finished goods per unit means you can make 420 finished goods (35 × 12) before needing to order more supplies. This must be less than your capacity (60 units). This number appears in your first ledger entry as inventoryState.notForResaleUnits.",
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
          "How many finished goods you can make from one operating supply inventory unit. Example: If this is 12, then one unit of supplies (packaging, napkins, etc.) supports 12 finished goods. With a unit cost of $1.75, each finished good costs $0.15 from operating supplies ($1.75 ÷ 12). This shows up in your results as costPerGoodOperatingSupply. With a capacity of 60 units, you can make up to 720 finished goods (60 × 12) from operating supplies.",
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
          "How much it costs to buy one operating supply inventory unit (packaging, napkins, cleaning supplies, etc.). Example: At $1.75 per unit and 12 finished goods per unit, each finished good costs $0.15 from operating supplies ($1.75 ÷ 12). This shows up in your results as costPerGoodOperatingSupply and is part of your total ingredientCost. If you sell finished goods for $16, you make $15.85 profit per finished good from operating supplies ($16 - $0.15).",
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
        description:
          "How much it costs each week to keep one operating supply inventory unit in storage (storage space, management, etc.). Example: If you end the week with 30 units in storage and holding cost is $0.15 per unit, you pay $4.50 in holding costs that week (30 × $0.15). This shows up in your ledger as costBreakdown.holdingCost. Operating supplies usually have the lowest holding costs since they don't need refrigeration or special storage.",
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
      {
        key: "avg-selling-price-per-unit",
        label: "Average Selling Price per Unit",
        description:
          "The normal selling price for one finished good at this type of store. Example: If this is $16, that's your baseline price. Students can adjust this with a pricing-multiplier (like 0.90 for 10% off or 1.10 for 10% more). The actual price you charge shows up in your results as realizedUnitPrice. Your revenue = number of finished goods sold × realizedUnitPrice. Example: If total cost per finished good is $4.80 ($3.80 refrigerated + $0.85 ambient + $0.15 supplies) and you sell for $16, you make $11.20 profit per finished good. This profit shows up in your ledger as netProfit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 16.0,
        min: 5,
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
- Order based on planned-production-units, expected demand, and current inventory
- Order quantity: sufficient to support planned-production-units plus safety stock (based on safetyStockByBucketStrategy)
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

12. PRICING CALCULATION (REQUIRED)
Pricing is explicit and calculated from store type baseline and student decisions.

BASELINE PRICE:
- Store type provides: avg-selling-price-per-unit (baseline, expected price for this store type)
- This is NOT a student decision - it's part of the store's identity
- Examples: campus kiosk ~$10.50, casual dine-in ~$16, fine dining ~$28

STUDENT PRICING DECISION:
- Student provides: pricing-multiplier (range: 0.85 to 1.15)
- This adjusts price relative to baseline
- 0.90 = 10% discount, 1.05 = 5% premium, 1.15 = aggressive pricing

CALCULATION:
realizedUnitPrice = avgSellingPricePerUnit × pricing-multiplier

SCENARIO EFFECTS:
- Apply scenario context (cost volatility, market sensitivity, competitive pressure) to adjust demand elasticity
- Higher prices may reduce demand more in price-sensitive scenarios
- Cost spikes may justify price increases, but customers may resist
- Market conditions affect how much pricing changes impact volume

REVENUE:
revenue = sales × realizedUnitPrice

OUTPUT REQUIREMENT:
- MUST include realizedUnitPrice in education.realizedUnitPrice
- This makes pricing transparent and explainable to instructors and students
- Revenue should equal sales × realizedUnitPrice (within reasonable rounding)

13. FINAL CHECK
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
- PRICING: realizedUnitPrice MUST be included in education object
- PRICING: revenue MUST equal sales × realizedUnitPrice (within reasonable rounding)
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

    "avg-selling-price-per-unit": 16.0,
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
      "avg-selling-price-per-unit": 16.0,
    },
    cafe: {
      // balanced defaults
      "avg-selling-price-per-unit": 16.0,
    },
    bar_and_grill: {
      "capacity-units-refrigerated": 55,
      "starting-units-refrigerated": 35,
      "capacity-units-ambient": 95,
      "starting-units-ambient": 55,
      "capacity-units-operating-supply": 70,
      "starting-units-operating-supply": 40,
      "avg-selling-price-per-unit": 16.0,
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
      "avg-selling-price-per-pizza": 28.0,
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
      "avg-selling-price-per-pizza": 10.5,
    },
    late_night_window: {
      "capacity-units-refrigerated": 50,
      "starting-units-refrigerated": 30,
      "capacity-units-ambient": 80,
      "starting-units-ambient": 45,
      "capacity-units-operating-supply": 75,
      "starting-units-operating-supply": 45,
      "avg-selling-price-per-unit": 16.0,
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
      "avg-selling-price-per-unit": 16.0,
    },
    campus_kiosk: {
      "capacity-units-refrigerated": 55,
      "starting-units-refrigerated": 32,
      "capacity-units-ambient": 100,
      "starting-units-ambient": 60,
      "capacity-units-operating-supply": 85,
      "starting-units-operating-supply": 55,
      "avg-selling-price-per-pizza": 10.5,
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
      "avg-selling-price-per-pizza": 22.0,
    },
    festival_vendor: {
      "capacity-units-refrigerated": 60,
      "starting-units-refrigerated": 30,
      "capacity-units-ambient": 120,
      "starting-units-ambient": 70,
      "capacity-units-operating-supply": 110,
      "starting-units-operating-supply": 70,
      "avg-selling-price-per-unit": 16.0,
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
      "avg-selling-price-per-unit": 16.0,
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

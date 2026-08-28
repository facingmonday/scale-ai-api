const mongoose = require("mongoose");

const ProfileType = require("../profileType/profileType.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");
const { STORE_TYPE_PRESETS } = require("../profile/profileTypePresets");
const defaultTemplatesData = require("./defaultTemplatesData");
/**
 * @openapi
 * components:
 *   schemas:
 *     ClassroomTemplate:
 *       type: object
 *       required:
 *         - key
 *         - label
 *         - createdBy
 *         - updatedBy
 *       properties:
 *         _id:
 *           type: string
 *         organization:
 *           type: string
 *           description: The organization ID or null if global.
 *         key:
 *           type: string
 *         label:
 *           type: string
 *         description:
 *           type: string
 *         version:
 *           type: number
 *         isActive:
 *           type: boolean
 *         sourceTemplateId:
 *           type: string
 *         payload:
 *           type: object
 *           description: Flexible template payload definition containing presets and configurations.
 *         createdBy:
 *           type: string
 *         createdDate:
 *           type: string
 *           format: date-time
 *         updatedBy:
 *           type: string
 *         updatedDate:
 *           type: string
 *           format: date-time
 */
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
 * Default decision variable definitions (template blueprint).
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
        appliesTo: "decision",
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
        appliesTo: "decision",
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
          "Cold inventory is costly to profile and prone to waste if over-ordered. Scale: 0 = Very Conservative, 50 = Balanced, 100 = Very Aggressive.",
        appliesTo: "decision",
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
        appliesTo: "decision",
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
        appliesTo: "decision",
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
        appliesTo: "decision",
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
        appliesTo: "decision",
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
          "Adjust your pricing relative to your profile's baseline price. 0.90 = 10% discount, 1.05 = 5% premium, 1.15 = aggressive pricing. This affects demand and revenue.",
        appliesTo: "decision",
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
        appliesTo: "decision",
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
 * Default profileType variable definitions (template blueprint).
 * Sourced from prior Classroom seed builder.
 */
classroomTemplateSchema.statics.getDefaultStoreTypeVariableDefinitions =
  function () {
    return [
      {
        key: "capacity-units-refrigerated",
        label: "Capacity Units (Refrigerated)",
        description:
          "The maximum number of refrigerated inventory units you can profile. Think of one unit as a bundle of cold ingredients like cheese, meat, and produce. Example: With a capacity of 40 units and 2.5 finished goods per unit, you can make up to 100 finished goods (40 × 2.5) from refrigerated inventory. This limit shows up in your ledger as inventoryState.refrigeratedUnits and you can never exceed it.",
        appliesTo: "profileType",
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
          "How many refrigerated inventory units you start with when opening your profile. Example: Starting with 24 units and 2.5 finished goods per unit means you can make 60 finished goods (24 × 2.5) before needing to order more. This must be less than your capacity (40 units). This number appears in your first ledger entry as inventoryState.refrigeratedUnits.",
        appliesTo: "profileType",
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
        appliesTo: "profileType",
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
        appliesTo: "profileType",
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
        appliesTo: "profileType",
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
          "The maximum number of ambient inventory units you can profile. Think of one unit as a bundle of dry ingredients like flour, canned goods, and dry spices. Example: With a capacity of 80 units and 5 finished goods per unit, you can make up to 400 finished goods (80 × 5) from ambient inventory. This limit shows up in your ledger as inventoryState.ambientUnits and you can never exceed it.",
        appliesTo: "profileType",
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
          "How many ambient inventory units you start with when opening your profile. Example: Starting with 45 units and 5 finished goods per unit means you can make 225 finished goods (45 × 5) before needing to order more. This must be less than your capacity (80 units). This number appears in your first ledger entry as inventoryState.ambientUnits.",
        appliesTo: "profileType",
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
        appliesTo: "profileType",
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
        appliesTo: "profileType",
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
        appliesTo: "profileType",
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
          "The maximum number of operating supply inventory units you can profile. Think of one unit as a bundle of supplies like packaging, napkins, cleaning supplies, and other items you need to run the business (but don't sell). Example: With a capacity of 60 units and 12 finished goods per unit, you can make up to 720 finished goods (60 × 12) from operating supplies. This limit shows up in your ledger as inventoryState.notForResaleUnits and you can never exceed it.",
        appliesTo: "profileType",
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
          "How many operating supply inventory units you start with when opening your profile. Example: Starting with 35 units and 12 finished goods per unit means you can make 420 finished goods (35 × 12) before needing to order more supplies. This must be less than your capacity (60 units). This number appears in your first ledger entry as inventoryState.notForResaleUnits.",
        appliesTo: "profileType",
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
        appliesTo: "profileType",
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
        appliesTo: "profileType",
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
        appliesTo: "profileType",
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
          "The normal selling price for one finished good at this type of profile. Example: If this is $16, that's your baseline price. Students can adjust this with a pricing-multiplier (like 0.90 for 10% off or 1.10 for 10% more). The actual price you charge shows up in your results as realizedUnitPrice. Your revenue = number of finished goods sold × realizedUnitPrice. Example: If total cost per finished good is $4.80 ($3.80 refrigerated + $0.85 ambient + $0.15 supplies) and you sell for $16, you make $11.20 profit per finished good. This profit shows up in your ledger as netProfit.",
        appliesTo: "profileType",
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

const DEFAULT_COST_GUARDRAILS_PROMPT = `
COST GUARDRAILS AND REALISM CONSTRAINTS

All operating costs must remain realistic, proportional, and capacity-aware. These costs should generally be low relative to revenue, but may vary based on profile type, challenge conditions, and challenge outcome.

1. Labor Cost
- Labor cost MUST scale with sales volume and operational intensity.
- Labor cost MUST remain within plausible bounds for the profile type.
- Labor cost should increase under conditions such as:
  - High sales volume
  - Overtime or rush conditions
  - Service-level prioritization
- Labor cost MUST NOT grow faster than sales volume.
- If capacity limits are reached, labor cost should plateau rather than explode.

2. Logistics Cost
- Logistics cost represents delivery, expediting, or supplier-related friction.
- Logistics cost should be near zero in normal conditions.
- Logistics cost may increase modestly when:
  - Challenge outcome includes supply disruption
  - Inventory is expedited to avoid stockouts
- Logistics cost MUST be small relative to ingredient costs.
- Logistics cost MUST NOT exceed a reasonable fraction of total inventory purchasing cost.

3. Overflow Storage Cost
- Overflow storage cost applies only when inventory exceeds on-site capacity.
- Overflow storage cost should be zero if capacity limits are respected.
- If overflow occurs, cost should:
  - Scale with excess units
  - Be modest but persistent
- Overflow storage MUST NOT be used as a profit penalty mechanism.
- Overflow storage cost MUST NOT exceed holding costs by an order of magnitude.

4. Waste Cost
- Waste cost must be tied directly to wasted inventory units.
- Waste should increase under conditions such as:
  - Overproduction
  - Poor demand forecasting
  - Low waste discipline
- Waste cost MUST be proportional to unit costs.
- Waste MUST NOT exceed the inventory actually available.
- Waste cost should be a meaningful but not dominant expense.

5. Disposal Cost
- Disposal cost applies only when waste occurs.
- Disposal cost should be a small add-on to waste cost.
- Disposal cost may increase slightly under:
  - Environmental regulation challenges
  - Large waste volumes
- Disposal cost MUST remain minor compared to waste cost itself.

6. Other Cost
- Other cost represents miscellaneous operational friction.
- Other cost should be low and often zero.
- Other cost may be introduced sparingly to explain:
  - Minor equipment issues
  - Administrative overhead
  - One-time operational inefficiencies
- Other cost MUST NOT be used to absorb excess profit or loss.
- Other cost MUST remain a small fraction of total costs.

7. Global Cost Constraints
- No single cost category may dominate total costs unless explicitly justified by the challenge outcome.
- Total operating costs MUST scale sensibly with sales and capacity.
- Costs MUST NOT increase without a clear operational or challenge-driven cause.
- If costs exceed plausible bounds, adjust them downward to the nearest realistic level.
`;

function ensureDefaultCostGuardrailsPrompt(prompts) {
  const arr = Array.isArray(prompts) ? prompts : [];
  const alreadyPresent = arr.some(
    (p) =>
      p &&
      typeof p === "object" &&
      typeof p.content === "string" &&
      p.content.includes("COST GUARDRAILS AND REALISM CONSTRAINTS")
  );
  if (alreadyPresent) return arr;
  return [...arr, { role: "system", content: DEFAULT_COST_GUARDRAILS_PROMPT }];
}

/**
 * Default classroom prompts (prepended to OpenAI messages).
 * These are GENERIC across all classroom types — domain-specific prompts
 * live in template payloads (e.g. pizza-shop supply-chain warehouse rules).
 */
classroomTemplateSchema.statics.getDefaultClassroomPrompts = function () {
  return [
    {
      role: "system",
      content:
        "You are a learning-simulation engine. Given a profile configuration, a challenge, a global outcome, the student's decisions, and the prior ledger entry, compute the metrics listed in metrics_to_calculate. " +
        "For each metric, follow its aiPromptRule when present. Use the dataType to determine the value type. " +
        "Return ONLY valid JSON matching the provided schema. Always include `summary` (string) and `randomEvent` (string or null).",
    },
  ];
};

/**
 * Pizza-shop supply-chain warehouse + cost prompts. Used as the seed prompts
 * for the `default_supply_chain_101` template payload.
 */
classroomTemplateSchema.statics.getPizzaShopPrompts = function () {
  const warehouseRules = `
WAREHOUSE RULES - YOU MUST OBEY THESE RULES. Outputs that violate these rules are invalid.

1. INVENTORY BUCKETS
Inventory exists ONLY in these buckets:
- refrigerated
- ambient
- notForResale

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
refrigerated → ambient → notForResale

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
- Profile inventory outside buckets
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
You MUST calculate receivedUnits for each bucket based on the student's reorder policy and decision decisions:

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
  - REFRIGERATED_FIRST: 60-75% refrigerated, 20-30% ambient, 5-15% notForResale
  - AMBIENT_FIRST: 40-50% refrigerated, 40-50% ambient, 10-20% notForResale
  - BALANCED: 50-60% refrigerated, 30-40% ambient, 10-20% notForResale

SAFETY STOCK REQUIREMENT:
- DO NOT use 100% of received inventory in the same period it was received
- Maintain safety stock: endUnits should typically be 10-30% of capacity (higher for HIGH safetyStockByBucketStrategy)
- If you receive 400 units, don't use all 400 - leave some as ending inventory for next period
- Example: If capacity is 500 and you receive 400 units, use 300-350 for production, leaving 50-100 as safety stock
- This prevents stockouts if there are delays in next period's deliveries

CRITICAL: receivedUnits must be > 0 for buckets where ordering is triggered OR where beginUnits = 0. Do NOT set all receivedUnits to 0 unless the student explicitly chose to order nothing.

12. PRICING CALCULATION (REQUIRED)
Pricing is explicit and calculated from profile type baseline and student decisions.

BASELINE PRICE:
- Profile type provides: avg-selling-price-per-unit (baseline, expected price for this profile type)
- This is NOT a student decision - it's part of the profile's identity
- Examples: campus kiosk ~$10.50, casual dine-in ~$16, fine dining ~$28

STUDENT PRICING DECISION:
- Student provides: pricing-multiplier (range: 0.85 to 1.15)
- This adjusts price relative to baseline
- 0.90 = 10% discount, 1.05 = 5% premium, 1.15 = aggressive pricing

CALCULATION:
realizedUnitPrice = avgSellingPricePerUnit × pricing-multiplier

SCENARIO EFFECTS:
- Apply challenge context (cost volatility, market sensitivity, competitive pressure) to adjust demand elasticity
- Higher prices may reduce demand more in price-sensitive challenges
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
- CONSISTENCY: inventoryState.notForResaleUnits MUST equal education.materialFlowByBucket.notForResale.endUnits
- PRICING: realizedUnitPrice MUST be included in education object
- PRICING: revenue MUST equal sales × realizedUnitPrice (within reasonable rounding)
`;

  return [
    {
      role: "system",
      content:
        "You are the SCALE LXP simulation engine for a supply chain class using a pizza shop game. " +
        "Compute the metrics listed in metrics_to_calculate based on the profile configuration, challenge, global outcome, and the student's decisions. " +
        "Apply realistic business logic and environmental effects. Return ONLY valid JSON matching the provided schema.",
    },
    { role: "system", content: warehouseRules },
    { role: "system", content: DEFAULT_COST_GUARDRAILS_PROMPT },
  ];
};

/**
 * Default metric definitions for the pizza-shop supply-chain template.
 */
classroomTemplateSchema.statics.getPizzaShopMetricDefinitions = function () {
  return [
    {
      key: "sales",
      label: "Sales",
      description: "Units sold during this challenge.",
      dataType: "number",
      format: "count",
      aggregation: "sum",
      aiPromptRule:
        "Whole-number units of finished goods sold this period, bounded by demand and inventory available for sale.",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: false, detail: true },
      sortOrder: 10,
    },
    {
      key: "revenue",
      label: "Revenue",
      description: "Total revenue earned this challenge.",
      dataType: "number",
      format: "currency",
      aggregation: "sum",
      aiPromptRule:
        "revenue = sales * realizedUnitPrice, rounded to cents. realizedUnitPrice = avgSellingPricePerUnit * (pricing-multiplier from decisions, default 1).",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: false, detail: true },
      sortOrder: 20,
    },
    {
      key: "costs",
      label: "Costs",
      description: "Total operating costs this challenge.",
      dataType: "number",
      format: "currency",
      aggregation: "sum",
      aiPromptRule:
        "Total of ingredient, labor, logistics, holding, overflow, waste-disposal and other costs (see COST GUARDRAILS).",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: false, detail: true },
      sortOrder: 30,
    },
    {
      key: "waste",
      label: "Waste",
      description: "Cost of wasted/spoiled inventory.",
      dataType: "number",
      format: "currency",
      aggregation: "sum",
      aiPromptRule:
        "Cost of inventory wasted this period (wasteUnits × unit cost across buckets).",
      displayIn: { table: true, kpi: false, chart: true, leaderboard: false, detail: true },
      sortOrder: 40,
    },
    {
      key: "netProfit",
      label: "Net Profit",
      description: "revenue - costs.",
      dataType: "number",
      format: "currency",
      aggregation: "sum",
      aiPromptRule:
        "netProfit = revenue - costs, rounded to cents. Must equal cashAfter - cashBefore.",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: true, detail: true },
      sortOrder: 50,
    },
    {
      key: "cashBefore",
      label: "Cash Before",
      description: "Cash balance entering this challenge.",
      dataType: "number",
      format: "currency",
      aggregation: "last",
      aiPromptRule:
        "Carry-forward: this MUST equal the previous ledger entry's cashAfter (or the starting balance for the first entry). Do not modify.",
      displayIn: { table: false, kpi: false, chart: false, leaderboard: false, detail: true },
      sortOrder: 60,
    },
    {
      key: "cashAfter",
      label: "Cash Balance",
      description: "Cash balance after this challenge.",
      dataType: "number",
      format: "currency",
      aggregation: "last",
      aiPromptRule:
        "cashAfter = cashBefore + netProfit, rounded to cents.",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: false, detail: true },
      sortOrder: 70,
    },
  ];
};

/**
 * Default metric definitions for the marketing-101 template.
 */
classroomTemplateSchema.statics.getMarketing101MetricDefinitions = function () {
  return [
    {
      key: "instagramFollowers",
      label: "Instagram Followers",
      description: "Total Instagram followers at end of period.",
      dataType: "number",
      format: "count",
      aggregation: "last",
      aiPromptRule:
        "Carry-forward integer count. Increase based on engagement, ad spend, and outcome conditions. Decrease modestly only under negative outcomes.",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: true, detail: true },
      sortOrder: 10,
    },
    {
      key: "tiktokFollowers",
      label: "TikTok Followers",
      description: "Total TikTok followers at end of period.",
      dataType: "number",
      format: "count",
      aggregation: "last",
      aiPromptRule:
        "Carry-forward integer count. Influenced by content cadence and TikTok-specific outcome variables.",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: false, detail: true },
      sortOrder: 20,
    },
    {
      key: "emailSubscribers",
      label: "Email Subscribers",
      description: "Total email list subscribers at end of period.",
      dataType: "number",
      format: "count",
      aggregation: "last",
      aiPromptRule:
        "Carry-forward integer count. Increase based on lead-magnet investment and conversions; decrease modestly when unsubscribes are likely.",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: false, detail: true },
      sortOrder: 30,
    },
    {
      key: "impressions",
      label: "Impressions",
      description: "Ad/content impressions delivered this period.",
      dataType: "number",
      format: "count",
      aggregation: "sum",
      aiPromptRule:
        "Period total integer. Scale with ad spend and channel performance multipliers from outcome.",
      displayIn: { table: true, kpi: false, chart: true, leaderboard: false, detail: true },
      sortOrder: 40,
    },
    {
      key: "engagementRate",
      label: "Engagement Rate",
      description: "Average engagement rate across channels.",
      dataType: "number",
      format: "percent",
      aggregation: "avg",
      aiPromptRule:
        "Decimal 0-1 (e.g. 0.045 = 4.5%). Reflects content quality and audience match.",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: false, detail: true },
      sortOrder: 50,
    },
    {
      key: "conversionRate",
      label: "Conversion Rate",
      description: "Visitor-to-customer conversion rate.",
      dataType: "number",
      format: "percent",
      aggregation: "avg",
      aiPromptRule:
        "Decimal 0-1. Depends on funnel quality, offer strength, and outcome conditions.",
      displayIn: { table: true, kpi: true, chart: true, leaderboard: false, detail: true },
      sortOrder: 60,
    },
    {
      key: "adSpend",
      label: "Ad Spend",
      description: "Total ad spend this period.",
      dataType: "number",
      format: "currency",
      aggregation: "sum",
      aiPromptRule:
        "Sum of all ad investments this period, rounded to cents. Bounded by the student's decided budget.",
      displayIn: { table: true, kpi: false, chart: true, leaderboard: false, detail: true },
      sortOrder: 70,
    },
  ];
};

/**
 * Default decision variable definitions for the marketing-101 template.
 */
classroomTemplateSchema.statics.getMarketing101DecisionVariableDefinitions =
  function () {
    return [
      {
        key: "ad-budget",
        label: "Weekly ad budget",
        description: "How much to spend on paid acquisition this week.",
        appliesTo: "decision",
        dataType: "number",
        inputType: "slider",
        min: 0,
        max: 5000,
        defaultValue: 500,
        required: true,
        isActive: true,
      },
      {
        key: "channel-focus",
        label: "Primary channel focus",
        description:
          "Where you concentrate your marketing efforts this week.",
        appliesTo: "decision",
        dataType: "string",
        inputType: "selectbutton",
        options: ["INSTAGRAM", "TIKTOK", "EMAIL", "MIXED"],
        defaultValue: "MIXED",
        required: true,
        isActive: true,
      },
      {
        key: "content-cadence",
        label: "Content cadence",
        description: "How aggressively you publish content this week.",
        appliesTo: "decision",
        dataType: "string",
        inputType: "dropdown",
        options: ["LOW", "AVERAGE", "HIGH"],
        defaultValue: "AVERAGE",
        required: true,
        isActive: true,
      },
    ];
  };

/**
 * Default outcome variable definitions for the marketing-101 template.
 */
classroomTemplateSchema.statics.getMarketing101OutcomeVariableDefinitions =
  function () {
    return [
      {
        key: "platform-algorithm-shift",
        label: "Platform algorithm shift",
        description: "Realized change in platform algorithm reach this period.",
        appliesTo: "outcome",
        dataType: "string",
        inputType: "selectbutton",
        options: ["NEGATIVE", "NEUTRAL", "POSITIVE"],
        defaultValue: "NEUTRAL",
        required: true,
        isActive: true,
      },
      {
        key: "ad-cpm-multiplier",
        label: "Ad CPM multiplier",
        description: "Multiplier applied to ad cost-per-thousand impressions.",
        appliesTo: "outcome",
        dataType: "number",
        inputType: "slider",
        min: 0.5,
        max: 3,
        defaultValue: 1,
        required: false,
        isActive: true,
      },
    ];
  };

function buildDefaultStoreTypeValuesByStoreTypeKey() {
  // These values are intended to be small, classroom-friendly “abstract units”
  // while still reflecting meaningful differences between profile types.
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
      "avg-selling-price-per-unit": 10.0,
    },
    cafe: {
      // balanced defaults
      "avg-selling-price-per-unit": 20.0,
    },
    bar_and_grill: {
      "capacity-units-refrigerated": 55,
      "starting-units-refrigerated": 35,
      "capacity-units-ambient": 95,
      "starting-units-ambient": 55,
      "capacity-units-operating-supply": 70,
      "starting-units-operating-supply": 40,
      "avg-selling-price-per-unit": 22.0,
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
      "avg-selling-price-per-unit": 48.0,
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
      "avg-selling-price-per-unit": 7.0,
    },
    late_night_window: {
      "capacity-units-refrigerated": 50,
      "starting-units-refrigerated": 30,
      "capacity-units-ambient": 80,
      "starting-units-ambient": 45,
      "capacity-units-operating-supply": 75,
      "starting-units-operating-supply": 45,
      "avg-selling-price-per-unit": 11.0,
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
      "avg-selling-price-per-unit": 24.0,
    },
    campus_kiosk: {
      "capacity-units-refrigerated": 55,
      "starting-units-refrigerated": 32,
      "capacity-units-ambient": 100,
      "starting-units-ambient": 60,
      "capacity-units-operating-supply": 85,
      "starting-units-operating-supply": 55,
      "avg-selling-price-per-unit": 6.0,
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
      "avg-selling-price-per-unit": 36.0,
    },
    festival_vendor: {
      "capacity-units-refrigerated": 60,
      "starting-units-refrigerated": 30,
      "capacity-units-ambient": 120,
      "starting-units-ambient": 70,
      "capacity-units-operating-supply": 110,
      "starting-units-operating-supply": 70,
      "avg-selling-price-per-unit": 9.0,
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
      "avg-selling-price-per-unit": 18.0,
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
        !Array.isArray(payload.profileTypes) ||
        payload.profileTypes.length === 0
      ) {
        payload.profileTypes = Object.keys(STORE_TYPE_PRESETS || {}).map((k) => ({
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
        payload.profileTypes = payload.profileTypes.map((st) => {
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
        payload.prompts = this.getPizzaShopPrompts();
      } else {
        payload.prompts = ensureDefaultCostGuardrailsPrompt(payload.prompts);
      }

      if (!Array.isArray(payload.metricDefinitions)) {
        payload.metricDefinitions = this.getPizzaShopMetricDefinitions();
      }

      existing.payload = payload;
      existing.updatedBy = existing.updatedBy || "system_startup";
      await existing.save();
      return existing;
    }

    const payload = {
      profileTypes: Object.keys(STORE_TYPE_PRESETS || {}).map((key) => ({
        key,
        label: STORE_TYPE_PRESETS[key]?.label || key,
        description: STORE_TYPE_PRESETS[key]?.description || "",
        startingBalance: Number(STORE_TYPE_PRESETS[key]?.startingBalance) || 0,
        initialStartupCost:
          Number(STORE_TYPE_PRESETS[key]?.initialStartupCost) || 0,
        isActive: true,
      })),
      variableDefinitionsByAppliesTo: {
        profileType: this.getDefaultStoreTypeVariableDefinitions(),
        profile: [],
        decision: this.getDefaultSubmissionVariableDefinitions(),
        challenge: [],
        outcome: [],
      },
      storeTypeValuesByStoreTypeKey:
        buildDefaultStoreTypeValuesByStoreTypeKey(),
      metricDefinitions: this.getPizzaShopMetricDefinitions(),
      prompts: this.getPizzaShopPrompts(),
    };

    const doc = new this({
      organization: null,
      key,
      label: "Supply Chain 101 (Default)",
      description:
        "Default developer-managed template for SCALE LXP Supply Chain 101 simulation.",
      isActive: true,
      version: 1,
      payload,
      createdBy: "system_startup",
      updatedBy: "system_startup",
    });

    await doc.save();
    return doc;
  };

classroomTemplateSchema.statics.MARKETING_101_KEY = "default_marketing_101";

/**
 * Ensure the global marketing-101 template exists. Idempotent.
 */
classroomTemplateSchema.statics.ensureGlobalMarketing101Template =
  async function () {
    const key = this.MARKETING_101_KEY;
    const existing = await this.findOne({ organization: null, key });
    if (existing) return existing;

    const payload = {
      profileTypes: [
        {
          key: "solo_creator",
          label: "Solo Creator",
          description: "An individual creator running their own brand.",
          startingBalance: 0,
          initialStartupCost: 0,
          isActive: true,
        },
        {
          key: "small_brand",
          label: "Small Brand",
          description:
            "A small but growing brand with a small content + marketing team.",
          startingBalance: 0,
          initialStartupCost: 0,
          isActive: true,
        },
        {
          key: "agency",
          label: "Marketing Agency",
          description:
            "A marketing agency managing campaigns for client accounts.",
          startingBalance: 0,
          initialStartupCost: 0,
          isActive: true,
        },
      ],
      variableDefinitionsByAppliesTo: {
        profileType: [],
        profile: [],
        decision: this.getMarketing101DecisionVariableDefinitions(),
        challenge: [],
        outcome: this.getMarketing101OutcomeVariableDefinitions(),
      },
      storeTypeValuesByStoreTypeKey: {
        solo_creator: {},
        small_brand: {},
        agency: {},
      },
      metricDefinitions: this.getMarketing101MetricDefinitions(),
      prompts: [
        {
          role: "system",
          content:
            "You are a learning-simulation engine for a marketing course. Compute the metrics in metrics_to_calculate based on the brand profile, the challenge, the realized outcome, and the student's decisions. Reflect realistic platform dynamics: algorithm shifts, ad CPM swings, and audience response. Return ONLY valid JSON matching the provided schema.",
        },
      ],
    };

    const doc = new this({
      organization: null,
      key,
      label: "Marketing 101 (Default)",
      description:
        "Default developer-managed template for SCALE LXP Marketing 101 simulation. Demonstrates dynamic metrics with non-supply-chain outputs.",
      isActive: true,
      version: 1,
      payload,
      createdBy: "system_startup",
      updatedBy: "system_startup",
    });

    await doc.save();
    return doc;
  };

// Helpers for dynamic course template generation
function getLabelForKey(key) {
  const result = key.replace(/([A-Z])/g, " $1");
  return (result.charAt(0).toUpperCase() + result.slice(1)).trim();
}

function getMetricFormatAndAggregation(key) {
  const lower = key.toLowerCase();
  let format = "count";
  if (
    lower.endsWith("rate") ||
    lower.endsWith("percent") ||
    lower.endsWith("ratio") ||
    lower.endsWith("probability") ||
    lower.endsWith("elasticity")
  ) {
    format = "percent";
  } else if (
    lower.startsWith("cost") ||
    lower.startsWith("price") ||
    lower.startsWith("budget") ||
    lower.startsWith("revenue") ||
    lower.startsWith("profit") ||
    lower.includes("spend") ||
    lower.includes("cost") ||
    lower.includes("revenue") ||
    lower.includes("profit") ||
    lower.includes("income") ||
    lower.includes("expense") ||
    lower.includes("asset") ||
    lower.includes("liabilit") ||
    lower.includes("equity") ||
    lower.includes("balance") ||
    lower.includes("funding") ||
    lower.includes("fee") ||
    lower.includes("price") ||
    lower.includes("value") ||
    lower.includes("valuation") ||
    lower.includes("tax") ||
    lower.includes("worth") ||
    lower.includes("savings") ||
    lower.includes("fund") ||
    lower.includes("paid") ||
    lower.includes("sales") ||
    lower.includes("capital") ||
    lower.includes("margin") ||
    lower.includes("ticket")
  ) {
    format = "currency";
  }

  let aggregation = "sum";
  if (format === "percent") {
    aggregation = "avg";
  } else if (
    lower.endsWith("followers") ||
    lower.endsWith("subscribers") ||
    lower.endsWith("score") ||
    lower.endsWith("trust") ||
    lower.endsWith("morale") ||
    lower.endsWith("capacity") ||
    lower.endsWith("runway") ||
    lower.endsWith("months") ||
    lower.endsWith("level") ||
    lower.endsWith("inventory") ||
    lower.endsWith("balance") ||
    lower.endsWith("worth") ||
    lower.endsWith("density") ||
    lower.endsWith("index") ||
    lower.endsWith("size") ||
    lower.endsWith("value") ||
    lower.endsWith("valuation") ||
    lower.endsWith("fund") ||
    lower.endsWith("savings") ||
    lower.endsWith("satisfaction") ||
    lower.endsWith("morale") ||
    lower.endsWith("demand") ||
    lower.endsWith("awareness") ||
    lower.endsWith("efficiency") ||
    lower.endsWith("utilization") ||
    lower.endsWith("exposure") ||
    lower.endsWith("progress") ||
    lower.endsWith("stability") ||
    lower.endsWith("availability") ||
    lower.endsWith("alignment") ||
    lower.endsWith("quality") ||
    lower.endsWith("health")
  ) {
    aggregation = "last";
  }

  return { format, aggregation };
}

function getAiPromptRule(key, label, format, aggregation) {
  if (format === "percent") {
    return `Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the ${label.toLowerCase()}. Scale dynamically based on decisions, challenges, and profile constraints.`;
  }
  if (format === "currency") {
    if (aggregation === "last") {
      return `Carry-forward currency value representing the current ${label.toLowerCase()} balance. Add revenues/funding and subtract costs/expenses.`;
    }
    return `Currency value representing the total ${label.toLowerCase()} for this period. Compute based on operations, pricing, and event outcomes.`;
  }
  if (aggregation === "last") {
    return `Carry-forward count/value representing the latest ${label.toLowerCase()} at the end of this period.`;
  }
  return `Total count representing the ${label.toLowerCase()} accumulated during this period.`;
}

function getVariablesForTemplate(templateKey) {
  const customVars = {
    default_digital_marketing_101: {
      decision: [
        { key: "ad-budget", label: "Weekly ad budget", description: "How much to spend on paid acquisition this week.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 1000, required: true, isActive: true },
        { key: "seo-focus", label: "SEO priority focus", description: "Where to focus organic SEO optimization.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["CONTENT", "TECHNICAL", "BACKLINKS", "BALANCED"], defaultValue: "BALANCED", required: true, isActive: true },
        { key: "pricing-multiplier", label: "Pricing multiplier", description: "Adjust baseline product prices.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: true, isActive: true }
      ],
      outcome: [
        { key: "ad-cpm-multiplier", label: "Ad CPM multiplier", description: "Ad cost fluctuation this period.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0.5, max: 3.0, defaultValue: 1.0, required: false, isActive: true },
        { key: "search-engine-algorithm-shift", label: "Search algorithm shift", description: "Google organic search reach change.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NEGATIVE", "NEUTRAL", "POSITIVE"], defaultValue: "NEUTRAL", required: false, isActive: true }
      ]
    },
    default_entrepreneurship_101: {
      decision: [
        { key: "pricing-multiplier", label: "Pricing multiplier", description: "Adjust baseline pricing.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: true, isActive: true },
        { key: "marketing-spend", label: "Marketing spend", description: "Customer acquisition budget.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 15000, defaultValue: 1500, required: true, isActive: true },
        { key: "rd-investment", label: "R&D investment", description: "Product research and development spend.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 1000, required: true, isActive: true },
        { key: "staff-hiring", label: "Staff hires count", description: "Number of staff to hire this period.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 5, defaultValue: 0, required: true, isActive: true }
      ],
      outcome: [
        { key: "market-demand-shift", label: "Market demand shift", description: "Change in macro customer demand.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["LOW", "NORMAL", "HIGH"], defaultValue: "NORMAL", required: false, isActive: true },
        { key: "competitor-action", label: "Competitor aggressiveness", description: "Aggressiveness of competitors.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["PASSIVE", "AGGRESSIVE"], defaultValue: "PASSIVE", required: false, isActive: true }
      ]
    },
    default_intro_to_business_101: {
      decision: [
        { key: "pricing-multiplier", label: "Pricing multiplier", description: "Pricing adjustment relative to baseline.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: true, isActive: true },
        { key: "marketing-budget", label: "Marketing budget", description: "Brand awareness spend.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 5000, defaultValue: 500, required: true, isActive: true },
        { key: "operational-spending", label: "Operational spending", description: "Equipment upgrade investment.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 1000, required: true, isActive: true },
        { key: "employee-wages", label: "Employee wage rate", description: "Hourly wage offered to staff.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 10, max: 50, defaultValue: 20, required: true, isActive: true }
      ],
      outcome: [
        { key: "economic-condition", label: "Economic condition", description: "General market status.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["RECESSION", "STABLE", "BOOM"], defaultValue: "STABLE", required: false, isActive: true }
      ]
    },
    default_accounting_101: {
      decision: [
        { key: "inventory-purchase", label: "Inventory purchase", description: "Spending on new inventory.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 2000, required: true, isActive: true },
        { key: "pricing-multiplier", label: "Pricing multiplier", description: "Product pricing adjustments.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: true, isActive: true },
        { key: "credit-terms-offered", label: "Credit terms offered", description: "Customer invoice payment timeline.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["NONE", "NET_30", "NET_60"], defaultValue: "NET_30", required: true, isActive: true },
        { key: "depreciation-method", label: "Depreciation method", description: "Asset depreciation accounting choice.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["STRAIGHT_LINE", "DOUBLE_DECLINING"], defaultValue: "STRAIGHT_LINE", required: true, isActive: true }
      ],
      outcome: [
        { key: "customer-default-rate", label: "Customer default rate", description: "Uncollectible receivables rate.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0, max: 0.2, defaultValue: 0.02, required: false, isActive: true }
      ]
    },
    default_finance_101: {
      decision: [
        { key: "capital-expenditure", label: "Capital expenditure (CapEx)", description: "Long-term fixed asset investments.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 50000, defaultValue: 5000, required: true, isActive: true },
        { key: "debt-funding-raised", label: "Debt funding raised", description: "Amount of new debt financing raised.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 100000, defaultValue: 0, required: true, isActive: true },
        { key: "dividend-payout-rate", label: "Dividend payout rate", description: "Percentage of profit returned to shareholders.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 1.0, defaultValue: 0.1, required: true, isActive: true },
        { key: "pricing-multiplier", label: "Pricing multiplier", description: "Pricing adjustment relative to baseline.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: true, isActive: true }
      ],
      outcome: [
        { key: "interest-rate-change", label: "Interest rate change", description: "Federal Reserve interest rate adjustment.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: -0.02, max: 0.05, defaultValue: 0.0, required: false, isActive: true },
        { key: "market-beta", label: "Market beta", description: "Volatility coefficient indicator.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: false, isActive: true }
      ]
    },
    default_personal_finance_101: {
      decision: [
        { key: "savings-allocation-rate", label: "Savings rate", description: "Ratio of net income allocated to savings.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 0.8, defaultValue: 0.15, required: true, isActive: true },
        { key: "debt-repayment-extra", label: "Extra debt payment", description: "Additional monthly payments to outstanding debts.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 2000, defaultValue: 100, required: true, isActive: true },
        { key: "investment-risk-profile", label: "Investment risk profile", description: "Asset allocation risk tier.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"], defaultValue: "MODERATE", required: true, isActive: true },
        { key: "discretionary-spending", label: "Discretionary spending", description: "Budget for entertainment and non-essentials.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 2000, defaultValue: 400, required: true, isActive: true }
      ],
      outcome: [
        { key: "market-return-rate", label: "Market return rate", description: "S&P 500 return percentage for this period.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: -0.15, max: 0.25, defaultValue: 0.08, required: false, isActive: true },
        { key: "unexpected-expense", label: "Emergency expense", description: "Unforeseen medical or repair expense.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0, max: 5000, defaultValue: 0, required: false, isActive: true }
      ]
    },
    default_economics_101: {
      decision: [
        { key: "price-set", label: "Set price", description: "Selling price set by the firm.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 1, max: 100, defaultValue: 10, required: true, isActive: true },
        { key: "production-quantity", label: "Production quantity", description: "Target supply volume produced.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 5000, defaultValue: 500, required: true, isActive: true },
        { key: "wage-rate", label: "Labor wage rate", description: "Hourly salary offered to labor.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 5, max: 40, defaultValue: 15, required: true, isActive: true }
      ],
      outcome: [
        { key: "market-demand-elasticity", label: "Market demand elasticity", description: "Price sensitivity index of customers.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0.5, max: 3.0, defaultValue: 1.0, required: false, isActive: true },
        { key: "tax-rate-change", label: "Corporate tax rate shift", description: "Corporate tax adjustment percentage.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: -0.05, max: 0.10, defaultValue: 0.0, required: false, isActive: true }
      ]
    },
    default_operations_management_101: {
      decision: [
        { key: "production-target", label: "Production target", description: "Units targeted for manufacturing.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 1000, required: true, isActive: true },
        { key: "staff-level", label: "Staff level count", description: "Active operations crew size.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 1, max: 50, defaultValue: 10, required: true, isActive: true },
        { key: "quality-control-budget", label: "QC budget", description: "Quality assurance inspection spend.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 5000, defaultValue: 500, required: true, isActive: true },
        { key: "maintenance-frequency", label: "Maintenance level", description: "Machine preventative maintenance checks.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["LOW", "MEDIUM", "HIGH"], defaultValue: "MEDIUM", required: true, isActive: true }
      ],
      outcome: [
        { key: "machine-breakdown-count", label: "Machine breakdowns", description: "Number of assembly breakdowns.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0, max: 5, defaultValue: 0, required: false, isActive: true },
        { key: "supply-defect-rate", label: "Supplier defect rate", description: "Defect percentage in incoming raw parts.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0, max: 0.1, defaultValue: 0.02, required: false, isActive: true }
      ]
    },
    default_logistics_101: {
      decision: [
        { key: "shipping-carrier", label: "Shipping mode", description: "Shipping delivery tier chosen.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["STANDARD", "EXPRESS", "ECO_FRIENDLY"], defaultValue: "STANDARD", required: true, isActive: true },
        { key: "warehouse-safety-stock", label: "Safety stock level", description: "Buffer inventory levels maintained.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 5000, defaultValue: 500, required: true, isActive: true },
        { key: "delivery-routes-count", label: "Routes count", description: "Active truck dispatch routes.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 1, max: 10, defaultValue: 3, required: true, isActive: true },
        { key: "driver-incentive-bonus", label: "Driver bonus rate", description: "Bonus incentive offered to courier drivers.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 500, defaultValue: 0, required: true, isActive: true }
      ],
      outcome: [
        { key: "fuel-price-multiplier", label: "Fuel price index", description: "Fuel cost fluctuation factor.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0.7, max: 2.0, defaultValue: 1.0, required: false, isActive: true },
        { key: "weather-delay-severity", label: "Weather severity", description: "Transit delays due to storm fronts.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NONE", "MODERATE", "SEVERE"], defaultValue: "NONE", required: false, isActive: true }
      ]
    },
    default_hospitality_management_101: {
      decision: [
        { key: "pricing-multiplier", label: "Pricing multiplier", description: "Adjust menu prices relative to baseline.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: true, isActive: true },
        { key: "staffing-ratio", label: "Staffing level multiplier", description: "Service staff roster size factor.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: true, isActive: true },
        { key: "ingredient-quality-tier", label: "Ingredient quality tier", description: "Quality rating of food supplies ordered.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["STANDARD", "PREMIUM", "ORGANIC"], defaultValue: "STANDARD", required: true, isActive: true },
        { key: "marketing-spend", label: "Local marketing spend", description: "Local coupon and social ad spend.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 3000, defaultValue: 300, required: true, isActive: true }
      ],
      outcome: [
        { key: "critic-review-score", label: "Critic review score", description: "Published local food critic rating (1-5).", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 1, max: 5, defaultValue: 4, required: false, isActive: true },
        { key: "no-show-rate", label: "Reservation cancel rate", description: "Percentage of bookings who cancel last minute.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0, max: 0.3, defaultValue: 0.1, required: false, isActive: true }
      ]
    },
    default_event_management_101: {
      decision: [
        { key: "ticket-price", label: "Ticket price", description: "Registration ticket fee.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 10, max: 500, defaultValue: 50, required: true, isActive: true },
        { key: "marketing-budget", label: "Promo budget", description: "Event promotional spending.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 1000, required: true, isActive: true },
        { key: "security-staff-count", label: "Security team size", description: "Active safety officers rostered.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 1, max: 50, defaultValue: 5, required: true, isActive: true },
        { key: "catering-spend-per-guest", label: "Catering cost per guest", description: "Food & beverage allocation per head.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 5, max: 100, defaultValue: 20, required: true, isActive: true }
      ],
      outcome: [
        { key: "weather-condition", label: "Weather forecast", description: "Disrupted turnout risk.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["SUNNY", "RAINY", "STORMY"], defaultValue: "SUNNY", required: false, isActive: true }
      ]
    },
    default_agribusiness_101: {
      decision: [
        { key: "crop-selection", label: "Crop selection", description: "Principal crop planted this season.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["CORN", "SOYBEANS", "WHEAT", "ORGANIC_VEG"], defaultValue: "CORN", required: true, isActive: true },
        { key: "fertilizer-usage-level", label: "Fertilizer amount", description: "Soil nitrogen booster application level.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["LOW", "RECOMMENDED", "HIGH"], defaultValue: "RECOMMENDED", required: true, isActive: true },
        { key: "water-irrigation-allocation", label: "Irrigation water allocation", description: "Acre-feet of water pumped.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 5000, required: true, isActive: true },
        { key: "crop-insurance-coverage", label: "Crop insurance level", description: "Disaster protection plan payout tier.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["NONE", "50_PERCENT", "80_PERCENT"], defaultValue: "NONE", required: true, isActive: true }
      ],
      outcome: [
        { key: "pest-outbreak-severity", label: "Pest infestation severity", description: "Yield impact from crop pests.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NONE", "MILD", "SEVERE"], defaultValue: "NONE", required: false, isActive: true },
        { key: "rainfall-deviation", label: "Rainfall deviation percent", description: "Water index deviation from average.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: -50, max: 50, defaultValue: 0, required: false, isActive: true }
      ]
    },
    default_environmental_science_101: {
      decision: [
        { key: "renewable-energy-ratio", label: "Renewable energy share", description: "Ratio of power sourced from solar/wind.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 1.0, defaultValue: 0.1, required: true, isActive: true },
        { key: "waste-recycling-target", label: "Recycling diversion target", description: "Percentage of solid waste diverted to recycling.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 1.0, defaultValue: 0.3, required: true, isActive: true },
        { key: "compliance-audit-budget", label: "Audit budget", description: "EPA standard compliance checks.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 5000, defaultValue: 500, required: true, isActive: true },
        { key: "sustainability-initiative", label: "Sustainability plan", description: "Specific eco-program active.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["NONE", "CARBON_OFFSET", "WATER_CONSERVATION"], defaultValue: "NONE", required: true, isActive: true }
      ],
      outcome: [
        { key: "regulatory-standards-strictness", label: "EPA policy strictness", description: "Environmental standard severity tier.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["STANDARD", "STRICT", "VERY_STRICT"], defaultValue: "STANDARD", required: false, isActive: true }
      ]
    },
    default_public_administration_101: {
      decision: [
        { key: "program-funding-allocation", label: "Program funding allocation", description: "Grants or budget allocated to department operations.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 100000, defaultValue: 10000, required: true, isActive: true },
        { key: "department-staffing-level", label: "Staffing headcount", description: "Active public workers rostered.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 1, max: 100, defaultValue: 10, required: true, isActive: true },
        { key: "service-outreach-focus", label: "Service outreach focus", description: "Regional prioritization for service dispatch.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["URBAN", "RURAL", "EQUAL"], defaultValue: "EQUAL", required: true, isActive: true }
      ],
      outcome: [
        { key: "citizen-satisfaction-variance", label: "Citizen sentiment variance", description: "Public approval swing factor.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: -20, max: 20, defaultValue: 0, required: false, isActive: true }
      ]
    },
    default_civics_government_101: {
      decision: [
        { key: "tax-rate-income", label: "Income tax rate", description: "Flat tax rate on citizen incomes.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.1, max: 0.5, defaultValue: 0.25, required: true, isActive: true },
        { key: "education-budget-share", label: "Education budget share", description: "Percentage of revenue assigned to public schools.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.1, max: 0.4, defaultValue: 0.2, required: true, isActive: true },
        { key: "public-safety-funding", label: "Public safety funding share", description: "Percentage of revenue assigned to first responders.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.05, max: 0.3, defaultValue: 0.15, required: true, isActive: true },
        { key: "infrastructure-spending", label: "Infrastructure share", description: "Percentage of revenue assigned to road and grid repair.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.05, max: 0.3, defaultValue: 0.15, required: true, isActive: true }
      ],
      outcome: [
        { key: "voter-sentiment-index", label: "Voter sentiment index", description: "Aggregated approval index score.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 30, max: 100, defaultValue: 60, required: false, isActive: true }
      ]
    },
    default_healthcare_administration_101: {
      decision: [
        { key: "nurse-to-patient-ratio", label: "Staff-to-patient ratio", description: "Rostered nurse coverage density.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.1, max: 0.5, defaultValue: 0.2, required: true, isActive: true },
        { key: "medical-supplies-order", label: "Medical supplies spend", description: "Order budget for surgical/PPE equipment.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 1000, max: 50000, defaultValue: 5000, required: true, isActive: true },
        { key: "telehealth-expansion", label: "Telehealth system active", description: "Offer remote medical visits.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["NO", "YES"], defaultValue: "NO", required: true, isActive: true },
        { key: "pricing-multiplier", label: "Pricing multiplier", description: "Clinic copay price adjustments.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: true, isActive: true }
      ],
      outcome: [
        { key: "influenza-outbreak-level", label: "Influenza breakout wave", description: "Severity of seasonal flu cases.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NONE", "MODERATE", "SEVERE"], defaultValue: "NONE", required: false, isActive: true }
      ]
    },
    default_public_health_101: {
      decision: [
        { key: "campaign-funding", label: "Outreach funding", description: "Outreach health awareness program budget.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 20000, defaultValue: 2000, required: true, isActive: true },
        { key: "vaccine-procurement-units", label: "Vaccine batches ordered", description: "Immunization supply batch count.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 1000, required: true, isActive: true },
        { key: "mask-mandate-active", label: "Public health guidelines", description: "Implement strict indoor rules.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["NO", "YES"], defaultValue: "NO", required: true, isActive: true }
      ],
      outcome: [
        { key: "epidemic-transmission-rate", label: "Transmission rate (R0)", description: "Infection transmission severity factor.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0.5, max: 4.0, defaultValue: 1.2, required: false, isActive: true }
      ]
    },
    default_project_management_101: {
      decision: [
        { key: "sprint-velocity-target", label: "Velocity target", description: "Committed story points for the sprint.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 10, max: 100, defaultValue: 40, required: true, isActive: true },
        { key: "quality-assurance-focus", label: "QA focus level", description: "Sprint hours allocated to test coverage validation.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["LOW", "NORMAL", "HIGH"], defaultValue: "NORMAL", required: true, isActive: true },
        { key: "resource-allocation-buffer", label: "Scope buffer percentage", description: "Schedule slack percentage for contingencies.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 0.3, defaultValue: 0.1, required: true, isActive: true }
      ],
      outcome: [
        { key: "scope-creep-intensity", label: "Scope creep intensity", description: "Unplanned client feature requests.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NONE", "LOW", "HIGH"], defaultValue: "NONE", required: false, isActive: true }
      ]
    },
    default_software_development_101: {
      decision: [
        { key: "feature-points-committed", label: "Sprint story points target", description: "Product features committed for release.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 5, max: 80, defaultValue: 30, required: true, isActive: true },
        { key: "refactoring-time-allocation", label: "Refactor time ratio", description: "Sprint hours dedicated to cleaning technical debt.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 0.5, defaultValue: 0.15, required: true, isActive: true },
        { key: "testing-rigor-level", label: "Testing rigor", description: "Code testing depth.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["MINIMAL", "STANDARD", "COMPREHENSIVE"], defaultValue: "STANDARD", required: true, isActive: true }
      ],
      outcome: [
        { key: "api-service-outage", label: "Cloud service outage", description: "System downtime due to hosting outage.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NO", "YES"], defaultValue: "NO", required: false, isActive: true }
      ]
    },
    default_cybersecurity_101: {
      decision: [
        { key: "security-awareness-training-frequency", label: "Training frequency", description: "Phishing test and training cycle speed.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["ANNUAL", "QUARTERLY", "MONTHLY"], defaultValue: "QUARTERLY", required: true, isActive: true },
        { key: "patch-cycle-speed", label: "Patch cycle speed", description: "Software security patch deployment protocol.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["STANDARD", "EXPEDITED", "IMMEDIATE"], defaultValue: "STANDARD", required: true, isActive: true },
        { key: "firewall-strictness", label: "Firewall strictness", description: "Rule restrictiveness for web network traffic.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["LOW", "MEDIUM", "HIGH"], defaultValue: "MEDIUM", required: true, isActive: true },
        { key: "backup-frequency", label: "Data backup cycle", description: "Corporate server backup cadence.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["WEEKLY", "DAILY", "HOURLY"], defaultValue: "DAILY", required: true, isActive: true }
      ],
      outcome: [
        { key: "phishing-campaign-intensity", label: "Hacker phishing density", description: "Email attack campaign severity.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["LOW", "MEDIUM", "HIGH"], defaultValue: "MEDIUM", required: false, isActive: true },
        { key: "zero-day-vulnerability-discovered", label: "Zero-day vulnerability", description: "Critical unpatched exploit threat.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NO", "YES"], defaultValue: "NO", required: false, isActive: true }
      ]
    },
    default_human_resources_101: {
      decision: [
        { key: "employee-bonus-percent", label: "Annual bonus percentage", description: "Incentive bonus percent offered to staff.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 0.3, defaultValue: 0.05, required: true, isActive: true },
        { key: "training-hours-per-employee", label: "Training hours allocation", description: "Hours dedicated to training and education programs.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 40, defaultValue: 8, required: true, isActive: true },
        { key: "diversity-hiring-focus", label: "Diversity hiring focus", description: "Prioritize target hiring outreach programs.", appliesTo: "string", inputType: "selectbutton", options: ["STANDARD", "ENHANCED"], defaultValue: "STANDARD", required: true, isActive: true }
      ],
      outcome: [
        { key: "industry-hiring-competition", label: "Recruiter poaching index", description: "Industry talent recruitment difficulty.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["LOW", "MEDIUM", "HIGH"], defaultValue: "MEDIUM", required: false, isActive: true }
      ]
    },
    default_education_administration_101: {
      decision: [
        { key: "teacher-professional-dev-budget", label: "Teacher training budget", description: "Funding for professional certification programs.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 5000, defaultValue: 1000, required: true, isActive: true },
        { key: "student-counseling-ratio", label: "Guidance counselor ratio", description: "Counselors to students percentage target.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.01, max: 0.05, defaultValue: 0.02, required: true, isActive: true },
        { key: "after-school-programs-active", label: "After school programs", description: "Activate student enrichment courses.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["NO", "YES"], defaultValue: "YES", required: true, isActive: true }
      ],
      outcome: [
        { key: "funding-grant-awarded", label: "Title I grant award", description: "Receiving additional state grants.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NO", "YES"], defaultValue: "NO", required: false, isActive: true }
      ]
    },
    default_nonprofit_management_101: {
      decision: [
        { key: "fundraising-spend", label: "Fundraising campaign budget", description: "Promotional spending to secure donations.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 1000, required: true, isActive: true },
        { key: "volunteer-coordinator-salary", label: "Volunteer manager wage", description: "Salary assigned to the volunteer recruiting coordinator.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 5000, defaultValue: 2500, required: true, isActive: true },
        { key: "program-expansion-rate", label: "Community program growth", description: "Target scope increase for aid programs.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 0.5, defaultValue: 0.1, required: true, isActive: true }
      ],
      outcome: [
        { key: "major-donor-contribution", label: "Major donor windfall", description: "Unrestricted large estate gift received.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0, max: 50000, defaultValue: 0, required: false, isActive: true }
      ]
    },
    default_construction_management_101: {
      decision: [
        { key: "safety-compliance-rigor", label: "Safety protocols level", description: "Site inspection frequency rules.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["STANDARD", "STRICT"], defaultValue: "STANDARD", required: true, isActive: true },
        { key: "subcontractor-quality-tier", label: "Subcontractor selection", description: "Experience level of hired specialty teams.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["BASIC", "STANDARD", "PREMIUM"], defaultValue: "STANDARD", required: true, isActive: true },
        { key: "overtime-hours-authorized", label: "Overtime hours cap", description: "Max hours crew can work beyond normal shifts.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 20, defaultValue: 0, required: true, isActive: true }
      ],
      outcome: [
        { key: "material-supply-shortage", label: "Subcontractor delay", description: "Material or supply delays on site.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NO", "YES"], defaultValue: "NO", required: false, isActive: true },
        { key: "weather-delay-days", label: "Weather stoppage days", description: "Days lost to precipitation or extreme cold.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0, max: 5, defaultValue: 0, required: false, isActive: true }
      ]
    },
    default_manufacturing_101: {
      decision: [
        { key: "raw-material-order-volume", label: "Raw inventory batch order", description: "Batches of raw ingredients purchased.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 2000, required: true, isActive: true },
        { key: "machine-speed-percent", label: "Assembly belt speed", description: "Speed modifier for production lines.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.8, max: 1.2, defaultValue: 1.0, required: true, isActive: true },
        { key: "preventative-maintenance-hours", label: "Maintenance downtime hours", description: "Hours machines are offline for cleaning.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10, defaultValue: 2, required: true, isActive: true }
      ],
      outcome: [
        { key: "defect-surge", label: "Calibration drift surge", description: "Sudden tool misalignment defect surge.", appliesTo: "outcome", dataType: "string", inputType: "selectbutton", options: ["NO", "YES"], defaultValue: "NO", required: false, isActive: true }
      ]
    },
    default_real_estate_101: {
      decision: [
        { key: "asking-rent-multiplier", label: "Asking rent multiplier", description: "Adjust unit rent relative to average baseline market rate.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.8, max: 1.2, defaultValue: 1.0, required: true, isActive: true },
        { key: "maintenance-spending-percent", label: "Maintenance spending ratio", description: "Ratio of rental income spent on property repairs.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.05, max: 0.20, defaultValue: 0.10, required: true, isActive: true },
        { key: "tenant-screening-strictness", label: "Tenant screening rules", description: "Credit score and history requirements for leasing.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["LOW", "MEDIUM", "HIGH"], defaultValue: "MEDIUM", required: true, isActive: true }
      ],
      outcome: [
        { key: "local-economic-growth-rate", label: "Local job growth index", description: "Local hiring market multiplier swing.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: -0.05, max: 0.05, defaultValue: 0.02, required: false, isActive: true }
      ]
    },
    default_media_content_creation_101: {
      decision: [
        { key: "content-post-frequency", label: "Weekly publish frequency", description: "Number of videos/articles published.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 1, max: 14, defaultValue: 3, required: true, isActive: true },
        { key: "production-quality-spend", label: "Production quality budget", description: "Camera, sound, and editor spending.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 5000, defaultValue: 500, required: true, isActive: true },
        { key: "sponsor-ad-load", label: "Ad sponsor density", description: "Ad load frequency on audience videos.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["NONE", "LIGHT", "HEAVY"], defaultValue: "LIGHT", required: true, isActive: true }
      ],
      outcome: [
        { key: "viral-video-multiplier", label: "Algorithm recommendation boost", description: "Unexpected organic discovery boost (viral factor).", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 1, max: 10, defaultValue: 1, required: false, isActive: true }
      ]
    }
  };

  const defaultFallback = {
    decision: [
      { key: "pricing-multiplier", label: "Pricing multiplier", description: "Pricing adjustment relative to baseline.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0.5, max: 2.0, defaultValue: 1.0, required: true, isActive: true },
      { key: "operating-budget", label: "Operating budget", description: "Budget allocated for operations this period.", appliesTo: "decision", dataType: "number", inputType: "slider", min: 0, max: 10000, defaultValue: 1000, required: true, isActive: true },
      { key: "strategic-focus", label: "Strategic focus", description: "Strategic focus for this period.", appliesTo: "decision", dataType: "string", inputType: "selectbutton", options: ["GROWTH", "EFFICIENCY", "QUALITY", "BALANCED"], defaultValue: "BALANCED", required: true, isActive: true }
    ],
    outcome: [
      { key: "market-condition-factor", label: "Market condition factor", description: "Market condition fluctuation factor.", appliesTo: "outcome", dataType: "number", inputType: "slider", min: 0.5, max: 1.5, defaultValue: 1.0, required: false, isActive: true }
    ]
  };

  return customVars[templateKey] || defaultFallback;
}

classroomTemplateSchema.statics.ensureGlobalCourseTemplate = async function (templateData) {
  const key = templateData.key;
  const existing = await this.findOne({ organization: null, key });

  const metricDefinitions = templateData.metrics.map((metricInput, index) => {
    const isObject = metricInput && typeof metricInput === "object";
    const metricKey = isObject ? metricInput.key : metricInput;
    const label = isObject && metricInput.label ? metricInput.label : getLabelForKey(metricKey);
    const { format: autoFormat, aggregation: autoAggregation } = getMetricFormatAndAggregation(metricKey);

    const format = isObject && metricInput.format ? metricInput.format : autoFormat;
    const aggregation = isObject && metricInput.aggregation ? metricInput.aggregation : autoAggregation;
    const description = isObject && metricInput.description ? metricInput.description : `Computed ${label.toLowerCase()} for the period.`;

    const defaultRule = getAiPromptRule(metricKey, label, format, aggregation);
    const aiPromptRule = isObject && metricInput.aiPromptRule ? metricInput.aiPromptRule : defaultRule;
    const displayIn = isObject && metricInput.displayIn ? metricInput.displayIn : { table: true, kpi: true, chart: true, leaderboard: true, detail: true };

    return {
      key: metricKey,
      label,
      description,
      dataType: "number",
      format,
      aggregation,
      aiPromptRule,
      displayIn,
      sortOrder: (index + 1) * 10,
    };
  });

  const { decision: decisionVars, outcome: outcomeVars } = getVariablesForTemplate(key);

  const payload = {
    profileTypes: templateData.profileTypes.map(pt => ({
      key: pt.key,
      label: pt.label,
      description: pt.description,
      startingBalance: Number(pt.startingBalance) || 0,
      initialStartupCost: Number(pt.initialStartupCost) || 0,
      isActive: pt.isActive !== false,
    })),
    variableDefinitionsByAppliesTo: {
      profileType: [],
      profile: [],
      decision: decisionVars,
      challenge: [],
      outcome: outcomeVars,
    },
    storeTypeValuesByStoreTypeKey: templateData.profileTypes.reduce((acc, pt) => {
      acc[pt.key] = {};
      return acc;
    }, {}),
    metricDefinitions,
    prompts: [
      {
        role: "system",
        content:
          `You are a learning-simulation engine for a ${templateData.label} course. ` +
          `Compute the metrics in metrics_to_calculate based on the active profile, the challenge, the realized outcome, and the student's decisions. ` +
          `Reflect realistic dynamics and domain-specific constraints relevant to ${templateData.label}. ` +
          `Return ONLY valid JSON matching the provided schema. Always include \`summary\` (string) and \`randomEvent\` (string or null).`
      }
    ],
  };

  if (existing) {
    existing.payload = payload;
    existing.label = templateData.label;
    existing.description = templateData.description;
    existing.updatedBy = "system_startup";
    await existing.save();
    return existing;
  }

  const doc = new this({
    organization: null,
    key,
    label: templateData.label,
    description: templateData.description,
    isActive: true,
    version: 1,
    payload,
    createdBy: "system_startup",
    updatedBy: "system_startup",
  });

  await doc.save();
  return doc;
};

classroomTemplateSchema.statics.ensureAllGlobalTemplates = async function () {
  await this.ensureGlobalDefaultTemplate();
  await this.ensureGlobalMarketing101Template();

  for (const templateData of defaultTemplatesData) {
    try {
      await this.ensureGlobalCourseTemplate(templateData);
    } catch (e) {
      console.error(`⚠️  Failed ensuring global template ${templateData.key}:`, e?.message || e);
    }
  }
};

classroomTemplateSchema.statics.copyGlobalToOrganization = async function (
  organizationId,
  clerkUserId
) {
  // Find all active global templates
  const globalTemplates = await this.find({
    organization: null,
    isActive: true,
  });

  const copiedTemplates = [];

  for (const globalTemplate of globalTemplates) {
    const existingOrgTemplate = await this.findOne({
      organization: organizationId,
      key: globalTemplate.key,
    });

    if (existingOrgTemplate) {
      // Sync/Backfill missing payload sections from global template (idempotent)
      const payload =
        existingOrgTemplate.payload &&
          typeof existingOrgTemplate.payload === "object"
          ? existingOrgTemplate.payload
          : {};

      let hasChanges = false;

      if (
        !payload.storeTypeValuesByStoreTypeKey ||
        typeof payload.storeTypeValuesByStoreTypeKey !== "object" ||
        Object.keys(payload.storeTypeValuesByStoreTypeKey).length === 0
      ) {
        payload.storeTypeValuesByStoreTypeKey =
          globalTemplate.payload?.storeTypeValuesByStoreTypeKey || {};
        hasChanges = true;
      }

      // Backfill prompts if missing
      if (!Array.isArray(payload.prompts) || payload.prompts.length === 0) {
        payload.prompts = globalTemplate.payload?.prompts || [];
        hasChanges = true;
      } else {
        // Ensure cost guardrails exist if it is the supply chain template
        if (globalTemplate.key === this.GLOBAL_DEFAULT_KEY) {
          const patchedPrompts = ensureDefaultCostGuardrailsPrompt(payload.prompts);
          if (patchedPrompts.length !== payload.prompts.length) {
            payload.prompts = patchedPrompts;
            hasChanges = true;
          }
        }
      }

      // Backfill metricDefinitions if missing
      if (
        !Array.isArray(payload.metricDefinitions) ||
        payload.metricDefinitions.length === 0
      ) {
        payload.metricDefinitions = globalTemplate.payload?.metricDefinitions || [];
        hasChanges = true;
      }

      // Backfill profileTypes financial fields (startingBalance, initialStartupCost) if missing
      if (Array.isArray(payload.profileTypes) && payload.profileTypes.length > 0) {
        const byKey = new Map(
          (globalTemplate.payload?.profileTypes || []).map((st) => [st.key, st])
        );
        let profileTypesChanged = false;
        const patched = payload.profileTypes.map((st) => {
          if (!st || !st.key) return st;
          const globalSt = byKey.get(st.key) || {};
          const startingBalance =
            st.startingBalance !== undefined && st.startingBalance !== null
              ? Number(st.startingBalance)
              : Number(globalSt.startingBalance) || 0;
          const initialStartupCost =
            st.initialStartupCost !== undefined &&
              st.initialStartupCost !== null
              ? Number(st.initialStartupCost)
              : Number(globalSt.initialStartupCost) || 0;

          if (st.startingBalance !== startingBalance || st.initialStartupCost !== initialStartupCost) {
            profileTypesChanged = true;
          }

          return {
            ...st,
            startingBalance,
            initialStartupCost,
          };
        });
        if (profileTypesChanged) {
          payload.profileTypes = patched;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        existingOrgTemplate.payload = payload;
        existingOrgTemplate.updatedBy = clerkUserId;
        await existingOrgTemplate.save();
      }

      copiedTemplates.push(existingOrgTemplate);
    } else {
      // Create a brand new copy of this global template for the organization
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
      copiedTemplates.push(orgTemplate);
    }
  }

  // Return the first copied/synced template (or the global default one if present) for backward compatibility
  const defaultTemplate = copiedTemplates.find(t => t.key === this.GLOBAL_DEFAULT_KEY);
  return defaultTemplate || copiedTemplates[0];
};

// ----------------------------
// Apply template to classroom
// ----------------------------

function normalizeVariableDefinitionsByAppliesTo(payload) {
  const src = payload?.variableDefinitionsByAppliesTo || {};
  // Accept both new and legacy keys to ease the rename transition.
  return {
    profileType: Array.isArray(src.profileType)
      ? src.profileType
      : Array.isArray(src.profileType)
        ? src.profileType
        : [],
    profile: Array.isArray(src.profile)
      ? src.profile
      : Array.isArray(src.profile)
        ? src.profile
        : [],
    decision: Array.isArray(src.decision)
      ? src.decision
      : Array.isArray(src.decision)
        ? src.decision
        : [],
    challenge: Array.isArray(src.challenge)
      ? src.challenge
      : Array.isArray(src.challenge)
        ? src.challenge
        : [],
    outcome: Array.isArray(src.outcome) ? src.outcome : [],
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
    metricDefinitionsCreated: 0,
    metricDefinitionsSkipped: 0,
  };

  const payload = this.payload || {};
  const defsByScope = normalizeVariableDefinitionsByAppliesTo(payload);
  const metricDefsPayload = Array.isArray(payload.metricDefinitions)
    ? payload.metricDefinitions
    : [];
  const storeTypesPayload = Array.isArray(payload.profileTypes)
    ? payload.profileTypes
    : [];
  const storeTypeValuesByKey =
    payload.storeTypeValuesByStoreTypeKey &&
      typeof payload.storeTypeValuesByStoreTypeKey === "object"
      ? payload.storeTypeValuesByStoreTypeKey
      : {};

  // 1) Create ProfileTypes (classroom-scoped)
  const storeTypeDocs = [];
  for (const st of storeTypesPayload) {
    if (!st || !st.key) continue;
    const existing = await ProfileType.findOne({
      organization: organizationId,
      classroomId,
      key: st.key,
    }).select("_id");
    if (existing) {
      stats.storeTypesSkipped += 1;
      continue;
    }

    const doc = new ProfileType({
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

  // If template didn't include profile types, we still may want values/defs; profile types are required for values.
  const allStoreTypesInClass = storeTypeDocs.length
    ? storeTypeDocs
    : await ProfileType.find({
      organization: organizationId,
      classroomId,
      isActive: true,
    });

  // 2) Create VariableDefinitions (classroom-scoped, create-only)
  const allDefs = [
    ...defsByScope.profileType,
    ...defsByScope.profile,
    ...defsByScope.decision,
    ...defsByScope.challenge,
    ...defsByScope.outcome,
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

  // 3) Create profileType VariableValues for each profileType × profileType definition (create-only)
  const storeTypeDefs = defsByScope.profileType;
  if (allStoreTypesInClass.length > 0 && storeTypeDefs.length > 0) {
    const storeTypeIds = allStoreTypesInClass.map((s) => s._id);
    const defKeys = storeTypeDefs.map((d) => d.key);

    const existing = await VariableValue.find({
      organization: organizationId,
      classroomId,
      appliesTo: "profileType",
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
              appliesTo: "profileType",
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

  // 4) Create MetricDefinitions
  if (metricDefsPayload.length > 0) {
    const existingMetricKeys = new Set(
      (
        await MetricDefinition.find({
          classroomId,
        }).select("key")
      ).map((d) => d.key)
    );

    for (const md of metricDefsPayload) {
      if (!md || !md.key) continue;
      if (existingMetricKeys.has(md.key)) {
        stats.metricDefinitionsSkipped += 1;
        continue;
      }
      try {
        await MetricDefinition.create({
          classroomId,
          organization: organizationId,
          key: md.key,
          label: md.label || md.key,
          description: md.description || "",
          dataType: md.dataType || "number",
          format: md.format || "count",
          aiPromptRule: md.aiPromptRule || "",
          aggregation: md.aggregation || "last",
          displayIn: md.displayIn || {
            table: true,
            kpi: false,
            chart: false,
            leaderboard: false,
            detail: true,
          },
          defaultInitialValue:
            md.defaultInitialValue !== undefined ? md.defaultInitialValue : null,
          sortOrder: typeof md.sortOrder === "number" ? md.sortOrder : 0,
          isActive: md.isActive !== false,
          createdBy: clerkUserId,
          updatedBy: clerkUserId,
        });
        stats.metricDefinitionsCreated += 1;
      } catch (e) {
        console.error("Failed creating MetricDefinition:", e);
        stats.metricDefinitionsSkipped += 1;
      }
    }
  }

  return stats;
};

const ClassroomTemplate = mongoose.model(
  "ClassroomTemplate",
  classroomTemplateSchema
);

module.exports = ClassroomTemplate;

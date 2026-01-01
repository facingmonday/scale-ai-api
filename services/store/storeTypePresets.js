/**
 * Store Type Presets
 *
 * These presets define default variable values for each store type.
 * They are used only during store creation to populate initial values.
 *
 * Presets do not lock or constrain future edits unless enforced elsewhere.
 */
// Supply-chain defaults (Plan / Source / Make / Deliver)

const IngredientSourceEnum = Object.freeze({
  LOCAL: "local",
  NATIONAL_COST_EFFECTIVE: "national_cost_effective",
  INTERNATIONAL: "international",
  LOCAL_ORGANIC: "local_organic",
  NATIONAL_ORGANIC: "national_organic",
  INTERNATIONAL_ORGANIC: "international_organic",
});

const IngredientCostEnum = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
});

const TariffExposureEnum = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
});

const LogisticsCostEnum = Object.freeze({
  VERY_LOW: "very_low",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  VERY_HIGH: "very_high",
});

const PlanStrategyEnum = Object.freeze({
  FORECAST_DRIVEN: "forecast_driven",
  ROUTINE_REPLENISHMENT: "routine_replenishment",
  EVENT_DRIVEN: "event_driven",
});

const InventoryStrategyEnum = Object.freeze({
  MAKE_TO_ORDER: "make_to_order",
  MAKE_TO_STOCK: "make_to_stock",
  HYBRID: "hybrid",
});

const LeadTimeEnum = Object.freeze({
  SHORT: "short",
  MEDIUM: "medium",
  LONG: "long",
});

const RiskLevelEnum = Object.freeze({
  VERY_LOW: "very_low",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  VERY_HIGH: "very_high",
});

const FulfillmentModelEnum = Object.freeze({
  WALK_UP: "walk_up",
  DINE_IN: "dine_in",
  PICKUP: "pickup",
  DELIVERY_PLATFORM: "delivery_platform",
  CATERING: "catering",
});

const OverflowStoragePolicyEnum = Object.freeze({
  DISCARD_EXCESS: "discard_excess",
  PAY_FOR_OVERFLOW: "pay_for_overflow",
  EMERGENCY_REPLENISHMENT: "emergency_replenishment",
});

// Base preset ensures every store type has the exact same keys (with sensible defaults).
const BASE_PRESET = Object.freeze({
  // ---------------------------------------------------------------------------
  // Identity / copy
  // ---------------------------------------------------------------------------
  label: "",
  description: "",

  // ---------------------------------------------------------------------------
  // PLAN – demand planning & uncertainty
  // ---------------------------------------------------------------------------
  planStrategy: PlanStrategyEnum.FORECAST_DRIVEN,
  forecastReliance: RiskLevelEnum.MEDIUM,
  demandVolatility: RiskLevelEnum.MEDIUM,
  planningHorizonWeeks: 2,

  // ---------------------------------------------------------------------------
  // SOURCE – suppliers, inbound logistics, cost exposure
  // ---------------------------------------------------------------------------
  ingredientSource: IngredientSourceEnum.NATIONAL_COST_EFFECTIVE,
  ingredientCost: IngredientCostEnum.MEDIUM,
  tariffExposure: TariffExposureEnum.MEDIUM,
  supplierLeadTime: LeadTimeEnum.MEDIUM,
  supplierReliability: RiskLevelEnum.MEDIUM,
  backupSupplierAccess: RiskLevelEnum.MEDIUM,
  coldChainDependency: RiskLevelEnum.MEDIUM,
  logisticsCost: LogisticsCostEnum.MEDIUM,

  // ---------------------------------------------------------------------------
  // WAREHOUSING – HARD CONSTRAINTS (unit-based, enforced)
  // ---------------------------------------------------------------------------
  refrigeratedCapacityUnits: 500,
  ambientCapacityUnits: 300,
  notForResaleCapacityUnits: 200,

  // Per-unit holding cost per week
  refrigeratedHoldingCostPerUnit: 2.5,
  ambientHoldingCostPerUnit: 0.75,
  notForResaleHoldingCostPerUnit: 0.25,

  // Behavior when capacity is exceeded
  overflowStoragePolicy: OverflowStoragePolicyEnum.PAY_FOR_OVERFLOW,

  // ---------------------------------------------------------------------------
  // MAKE – production & labor conversion
  // ---------------------------------------------------------------------------
  makeStrategy: InventoryStrategyEnum.HYBRID,
  batchPrepLevel: RiskLevelEnum.MEDIUM,
  capacityFlexibility: RiskLevelEnum.MEDIUM,

  // ---------------------------------------------------------------------------
  // DELIVER – fulfillment & customer behavior
  // ---------------------------------------------------------------------------
  fulfillmentModel: FulfillmentModelEnum.PICKUP,
  deliveryPlatformDependency: RiskLevelEnum.MEDIUM,
  lastMileCostSensitivity: RiskLevelEnum.MEDIUM,

  // ---------------------------------------------------------------------------
  // Financial starting point (initial ledger seed)
  // ---------------------------------------------------------------------------
  startingBalance: 50000,
  initialStartupCost: 0,

  // Starting inventory is now interpreted *by bucket* downstream
  startingInventory: {
    refrigeratedUnits: 500,
    ambientUnits: 300,
    notForResaleUnits: 200,
  },

  // ---------------------------------------------------------------------------
  // Cost anchors (used as AI baselines, not direct math)
  // ---------------------------------------------------------------------------
  rawMaterialCostBaseline: 1000,
  finishedGoodCostBaseline: 1000,

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------
  weeklyRent: 0,
  maxDailyCapacity: 100,
  staffRequired: 2,

  weatherSensitivity: "medium",
  mobility: "none",
  vibe: "standard",
  riskProfile: "balanced",

  peakHours: [],
  customerPatience: "medium",
  marketingPower: "local",
  commonIssues: [],
  growthCeiling: "medium",

  // ---------------------------------------------------------------------------
  // Equipment / facilities (capacity multipliers, not inventory)
  // ---------------------------------------------------------------------------
  numberOfFridges: 1,
  numberOfOvens: 1,
  numberOfWarehouses: 1,

  // ---------------------------------------------------------------------------
  // Selling model
  // ---------------------------------------------------------------------------
  salesMethod: "whole pie",
  costPerSlice: 8,
  costPerPie: 20,

  // ---------------------------------------------------------------------------
  // Franchise-only lever
  // ---------------------------------------------------------------------------
  royaltyRate: 0,

  // ---------------------------------------------------------------------------
  // AI narration helpers
  // ---------------------------------------------------------------------------
  aiFlavor: "",
  pros: "",
  cons: "",
});

const STORE_TYPE_PRESETS = {
  food_truck: {
    ...BASE_PRESET,
    label: "Food Truck",
    description:
      "A scrappy, mobile kitchen that lives or dies by location, weather, and word of mouth.",
    // Plan
    planStrategy: PlanStrategyEnum.EVENT_DRIVEN,
    forecastReliance: RiskLevelEnum.MEDIUM,
    demandVolatility: RiskLevelEnum.HIGH,
    planningHorizonWeeks: 1,
    // Source
    ingredientSource: IngredientSourceEnum.NATIONAL_COST_EFFECTIVE,
    ingredientCost: IngredientCostEnum.LOW,
    tariffExposure: TariffExposureEnum.LOW,
    supplierLeadTime: LeadTimeEnum.SHORT,
    supplierReliability: RiskLevelEnum.MEDIUM,
    backupSupplierAccess: RiskLevelEnum.MEDIUM,
    coldChainDependency: RiskLevelEnum.HIGH,
    logisticsCost: LogisticsCostEnum.LOW,
    refrigeratedStorageSpace: RiskLevelEnum.LOW,
    refrigeratedStorageSpaceCost: RiskLevelEnum.HIGH,
    ambientStorageSpace: RiskLevelEnum.LOW,
    ambientStorageSpaceCost: RiskLevelEnum.HIGH,
    overflowStoragePolicy: OverflowStoragePolicyEnum.PAY_FOR_OVERFLOW,
    // Make
    makeStrategy: InventoryStrategyEnum.MAKE_TO_ORDER,
    batchPrepLevel: RiskLevelEnum.LOW,
    capacityFlexibility: RiskLevelEnum.HIGH,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.WALK_UP,
    deliveryPlatformDependency: RiskLevelEnum.LOW,
    lastMileCostSensitivity: RiskLevelEnum.LOW,

    initialStartupCost: 20000,
    startingBalance: 50000,
    startingInventory: 1000,
    rawMaterialCost: 1000,
    finishedGoodCost: 1000,
    refrigeratedSpaceCost: 1000,
    ambientSpaceCost: 1000,
    weeklyRent: 200,
    maxDailyCapacity: 80,
    staffRequired: 2,
    weatherSensitivity: "high",
    mobility: "high",
    vibe: "mobile",
    riskProfile: "volatile",
    peakHours: ["11:00-14:00", "17:00-20:00"],
    customerPatience: "medium",
    marketingPower: "street",
    commonIssues: ["engine trouble", "permit delays", "weather cancellations"],
    numberOfFridges: 1,
    numberOfOvens: 1,
    numberOfWarehouses: 1,
    salesMethod: "by the slice",
    costPerSlice: 10,
    costPerPie: 24,

    aiFlavor: "hustle energy, improvisation, chasing crowds",
    pros: "Can chase high-traffic locations and events, with lower overhead than brick-and-mortar operations. Flexible schedule and location strategy allow you to adapt to demand patterns, while direct customer interaction builds strong loyalty.",
    cons: "Revenue is heavily weather-dependent, and vehicle maintenance and breakdown risks can disrupt operations. Permit and parking challenges add complexity, and limited capacity during peak times can constrain revenue potential.",
  },

  cafe: {
    ...BASE_PRESET,
    label: "Neighborhood Café",
    salesMethod: "whole pie",
    costPerPie: 20,
    costPerSlice: 8,
    description:
      "A cozy, repeat-customer driven business built on routine and regulars.",
    // Plan
    planStrategy: PlanStrategyEnum.ROUTINE_REPLENISHMENT,
    forecastReliance: RiskLevelEnum.HIGH,
    demandVolatility: RiskLevelEnum.LOW,
    planningHorizonWeeks: 2,
    // Source
    ingredientSource: IngredientSourceEnum.LOCAL,
    ingredientCost: IngredientCostEnum.MEDIUM,
    tariffExposure: TariffExposureEnum.LOW,
    supplierLeadTime: LeadTimeEnum.MEDIUM,
    supplierReliability: RiskLevelEnum.HIGH,
    backupSupplierAccess: RiskLevelEnum.HIGH,
    coldChainDependency: RiskLevelEnum.MEDIUM,
    logisticsCost: LogisticsCostEnum.MEDIUM,
    refrigeratedStorageSpace: RiskLevelEnum.MEDIUM,
    refrigeratedStorageSpaceCost: RiskLevelEnum.MEDIUM,
    ambientStorageSpace: RiskLevelEnum.MEDIUM,
    ambientStorageSpaceCost: RiskLevelEnum.MEDIUM,
    overflowStoragePolicy: OverflowStoragePolicyEnum.PAY_FOR_OVERFLOW,
    // Make
    makeStrategy: InventoryStrategyEnum.HYBRID,
    batchPrepLevel: RiskLevelEnum.MEDIUM,
    capacityFlexibility: RiskLevelEnum.MEDIUM,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.DINE_IN,
    deliveryPlatformDependency: RiskLevelEnum.LOW,
    lastMileCostSensitivity: RiskLevelEnum.LOW,

    startingBalance: 50000,
    initialStartupCost: 25000,
    startingInventory: 1000,
    weeklyRent: 700,
    maxDailyCapacity: 120,
    staffRequired: 3,
    weatherSensitivity: "low",
    mobility: "none",
    vibe: "cozy",
    riskProfile: "stable",
    peakHours: ["07:00-10:00", "14:00-17:00"],
    customerPatience: "high",
    marketingPower: "local",
    commonIssues: ["slow afternoons", "staff burnout", "supply shortages"],
    growthCeiling: "medium",
    aiFlavor: "routine, loyalty, small optimizations",
    pros: "Predictable customer base and revenue provide stability, with weather-independent operations ensuring consistent service. Repeat customers reduce marketing costs, and the lower risk profile compared to high-end restaurants makes it more manageable.",
    cons: "Slow afternoon periods reduce operational efficiency, and staff burnout from long hours can impact service quality. Limited growth potential and competition from chains and other cafes create ongoing challenges.",
  },
  bar_and_grill: {
    ...BASE_PRESET,
    label: "Bar & Grill",
    description:
      "High margins, unpredictable nights, and staffing chaos when things get busy.",
    // Plan
    planStrategy: PlanStrategyEnum.FORECAST_DRIVEN,
    forecastReliance: RiskLevelEnum.MEDIUM,
    demandVolatility: RiskLevelEnum.MEDIUM,
    planningHorizonWeeks: 2,
    // Source
    ingredientSource: IngredientSourceEnum.NATIONAL_COST_EFFECTIVE,
    ingredientCost: IngredientCostEnum.MEDIUM,
    tariffExposure: TariffExposureEnum.LOW,
    supplierLeadTime: LeadTimeEnum.MEDIUM,
    supplierReliability: RiskLevelEnum.MEDIUM,
    backupSupplierAccess: RiskLevelEnum.MEDIUM,
    coldChainDependency: RiskLevelEnum.MEDIUM,
    logisticsCost: LogisticsCostEnum.MEDIUM,
    refrigeratedStorageSpace: RiskLevelEnum.HIGH,
    refrigeratedStorageSpaceCost: RiskLevelEnum.MEDIUM,
    ambientStorageSpace: RiskLevelEnum.HIGH,
    ambientStorageSpaceCost: RiskLevelEnum.MEDIUM,
    overflowStoragePolicy: OverflowStoragePolicyEnum.PAY_FOR_OVERFLOW,
    // Make
    makeStrategy: InventoryStrategyEnum.HYBRID,
    batchPrepLevel: RiskLevelEnum.HIGH,
    capacityFlexibility: RiskLevelEnum.HIGH,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.DINE_IN,
    deliveryPlatformDependency: RiskLevelEnum.MEDIUM,
    lastMileCostSensitivity: RiskLevelEnum.MEDIUM,

    startingBalance: 50000,
    initialStartupCost: 35000,
    startingInventory: 1000,
    weeklyRent: 1600,
    maxDailyCapacity: 180,
    staffRequired: 5,
    weatherSensitivity: "medium",
    mobility: "none",
    vibe: "social",
    riskProfile: "volatile",
    peakHours: ["19:00-01:00"],
    customerPatience: "low",
    marketingPower: "events",
    commonIssues: ["bad reviews", "late staff", "rowdy crowds"],
    growthCeiling: "high",
    salesMethod: "whole pie",
    costPerPie: 22,
    costPerSlice: 9,
    numberOfFridges: 2,
    numberOfOvens: 2,
    numberOfWarehouses: 1,
    aiFlavor: "crowd dynamics, risk management, late-night math",
    pros: "High profit margins on drinks and food create strong revenue potential during peak nights. Event-driven marketing opportunities help build buzz, and the social atmosphere naturally builds customer loyalty.",
    cons: "Unpredictable demand makes staffing difficult, and late-night operations increase labor costs. Customer behavior risks like rowdy crowds and negative reviews can damage reputation, while high overhead costs for rent, licenses, and insurance eat into profits.",
  },

  fine_dining: {
    ...BASE_PRESET,
    label: "Fine Dining Restaurant",
    description:
      "Low volume, high expectations. Reputation is everything and mistakes are expensive.",
    // Plan
    planStrategy: PlanStrategyEnum.FORECAST_DRIVEN,
    forecastReliance: RiskLevelEnum.HIGH,
    demandVolatility: RiskLevelEnum.LOW,
    planningHorizonWeeks: 4,
    // Source
    startingBalance: 50000,
    ingredientSource: IngredientSourceEnum.INTERNATIONAL,
    ingredientCost: IngredientCostEnum.HIGH,
    tariffExposure: TariffExposureEnum.HIGH,
    supplierLeadTime: LeadTimeEnum.LONG,
    supplierReliability: RiskLevelEnum.MEDIUM,
    backupSupplierAccess: RiskLevelEnum.LOW,
    coldChainDependency: RiskLevelEnum.HIGH,
    logisticsCost: LogisticsCostEnum.VERY_HIGH,
    refrigeratedStorageSpace: RiskLevelEnum.HIGH,
    refrigeratedStorageSpaceCost: RiskLevelEnum.HIGH,
    ambientStorageSpace: RiskLevelEnum.MEDIUM,
    ambientStorageSpaceCost: RiskLevelEnum.MEDIUM,
    overflowStoragePolicy: OverflowStoragePolicyEnum.PAY_FOR_OVERFLOW,
    // Make
    makeStrategy: InventoryStrategyEnum.MAKE_TO_ORDER,
    batchPrepLevel: RiskLevelEnum.MEDIUM,
    capacityFlexibility: RiskLevelEnum.LOW,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.DINE_IN,
    deliveryPlatformDependency: RiskLevelEnum.VERY_LOW,
    lastMileCostSensitivity: RiskLevelEnum.LOW,

    initialStartupCost: 45000,
    startingInventory: 10000,
    rawMaterialCost: 2500,
    finishedGoodCost: 2500,
    refrigeratedSpaceCost: 3000,
    ambientSpaceCost: 1500,
    weeklyRent: 2800,
    maxDailyCapacity: 70,
    staffRequired: 10,
    weatherSensitivity: "low",
    mobility: "none",
    vibe: "elegant",
    riskProfile: "high-stakes",
    peakHours: ["18:00-22:00"],
    customerPatience: "very high",
    marketingPower: "critics",
    commonIssues: ["staff skill gaps", "bad reviews", "high food costs"],
    growthCeiling: "medium",
    salesMethod: "whole pie",
    costPerPie: 35,
    costPerSlice: 14,
    numberOfFridges: 3,
    numberOfOvens: 2,
    numberOfWarehouses: 1,
    aiFlavor: "precision, perfectionism, brand protection",
    pros: "High profit margins per customer and premium pricing power create strong financial potential. Critic reviews drive visibility and can significantly boost business, while weather-independent operations provide consistency.",
    cons: "Extremely high startup and operating costs require substantial investment. Requires skilled, expensive staff to maintain standards, and reputation damage from bad reviews can be severe. Limited capacity constrains revenue growth potential.",
  },

  street_cart: {
    ...BASE_PRESET,
    label: "Street Cart",
    description:
      "Ultra-lean operation with massive foot traffic swings and razor-thin margins.",
    // Plan
    planStrategy: PlanStrategyEnum.EVENT_DRIVEN,
    forecastReliance: RiskLevelEnum.LOW,
    demandVolatility: RiskLevelEnum.VERY_HIGH,
    planningHorizonWeeks: 1,
    // Source
    ingredientSource: IngredientSourceEnum.LOCAL,
    ingredientCost: IngredientCostEnum.LOW,
    tariffExposure: TariffExposureEnum.LOW,
    supplierLeadTime: LeadTimeEnum.SHORT,
    supplierReliability: RiskLevelEnum.LOW,
    backupSupplierAccess: RiskLevelEnum.LOW,
    coldChainDependency: RiskLevelEnum.MEDIUM,
    logisticsCost: LogisticsCostEnum.LOW,
    refrigeratedStorageSpace: RiskLevelEnum.VERY_LOW,
    refrigeratedStorageSpaceCost: RiskLevelEnum.VERY_HIGH,
    ambientStorageSpace: RiskLevelEnum.VERY_LOW,
    ambientStorageSpaceCost: RiskLevelEnum.VERY_HIGH,
    overflowStoragePolicy: OverflowStoragePolicyEnum.DISCARD_EXCESS,
    // Make
    makeStrategy: InventoryStrategyEnum.MAKE_TO_ORDER,
    batchPrepLevel: RiskLevelEnum.LOW,
    capacityFlexibility: RiskLevelEnum.HIGH,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.WALK_UP,
    deliveryPlatformDependency: RiskLevelEnum.VERY_LOW,
    lastMileCostSensitivity: RiskLevelEnum.VERY_LOW,

    startingBalance: 50000,
    initialStartupCost: 7000,
    startingInventory: 1000,
    weeklyRent: 50,
    maxDailyCapacity: 60,
    staffRequired: 1,
    weatherSensitivity: "very high",
    mobility: "very high",
    vibe: "gritty",
    riskProfile: "survival",
    peakHours: ["11:00-14:00"],
    customerPatience: "very low",
    marketingPower: "location",
    commonIssues: ["weather shutdowns", "permits", "supply runouts"],
    growthCeiling: "very low",
    salesMethod: "by the slice",
    costPerSlice: 7,
    costPerPie: 18,
    aiFlavor: "scrappy decisions, cash flow panic, opportunistic selling",
    pros: "Lowest startup costs of all options make it accessible, with minimal overhead and operating expenses keeping costs low. Can relocate to high-traffic areas for better opportunities, and simple operation requires minimal staff.",
    cons: "Extremely weather-dependent revenue creates volatility, and razor-thin profit margins leave little room for error. Permit and location challenges add complexity, and very limited growth potential constrains long-term success.",
  },

  late_night_window: {
    ...BASE_PRESET,
    label: "Late-Night Walk-Up Window",
    description:
      "Few hours, huge spikes, and customers who want food immediately.",
    // Plan
    planStrategy: PlanStrategyEnum.EVENT_DRIVEN,
    forecastReliance: RiskLevelEnum.MEDIUM,
    demandVolatility: RiskLevelEnum.HIGH,
    planningHorizonWeeks: 1,
    // Source
    ingredientSource: IngredientSourceEnum.NATIONAL_COST_EFFECTIVE,
    ingredientCost: IngredientCostEnum.MEDIUM,
    tariffExposure: TariffExposureEnum.LOW,
    supplierLeadTime: LeadTimeEnum.SHORT,
    supplierReliability: RiskLevelEnum.MEDIUM,
    backupSupplierAccess: RiskLevelEnum.MEDIUM,
    coldChainDependency: RiskLevelEnum.HIGH,
    logisticsCost: LogisticsCostEnum.MEDIUM,
    refrigeratedStorageSpace: RiskLevelEnum.MEDIUM,
    refrigeratedStorageSpaceCost: RiskLevelEnum.MEDIUM,
    ambientStorageSpace: RiskLevelEnum.LOW,
    ambientStorageSpaceCost: RiskLevelEnum.MEDIUM,
    overflowStoragePolicy: OverflowStoragePolicyEnum.EMERGENCY_REPLENISHMENT,
    // Make
    makeStrategy: InventoryStrategyEnum.HYBRID,
    batchPrepLevel: RiskLevelEnum.HIGH,
    capacityFlexibility: RiskLevelEnum.MEDIUM,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.WALK_UP,
    deliveryPlatformDependency: RiskLevelEnum.LOW,
    lastMileCostSensitivity: RiskLevelEnum.LOW,

    startingBalance: 50000,
    initialStartupCost: 19000,
    startingInventory: 1000,
    weeklyRent: 500,
    maxDailyCapacity: 120,
    staffRequired: 2,
    weatherSensitivity: "medium",
    mobility: "none",
    vibe: "chaotic",
    riskProfile: "burst-driven",
    peakHours: ["22:00-02:00"],
    customerPatience: "very low",
    marketingPower: "location",
    commonIssues: ["staff fatigue", "safety concerns"],
    growthCeiling: "low",
    salesMethod: "by the slice",
    costPerSlice: 11,
    costPerPie: 26,
    numberOfFridges: 2,
    numberOfOvens: 2,
    numberOfWarehouses: 1,
    aiFlavor: "speed under pressure, fatigue management",
    pros: "Limited competition during late hours creates opportunity, with high demand during peak times driving revenue. Lower overhead than full restaurants improves margins, and location-based marketing is straightforward.",
    cons: "Staff fatigue and safety concerns arise from late-night operations, and very limited operating hours constrain revenue. High pressure during rush periods can impact service quality, and limited growth potential restricts expansion.",
  },

  ghost_kitchen: {
    ...BASE_PRESET,
    label: "Ghost Kitchen",
    description:
      "No storefront, no seating, pure delivery math and platform dependency.",
    // Plan
    planStrategy: PlanStrategyEnum.FORECAST_DRIVEN,
    forecastReliance: RiskLevelEnum.MEDIUM,
    demandVolatility: RiskLevelEnum.MEDIUM,
    planningHorizonWeeks: 2,
    // Source
    ingredientSource: IngredientSourceEnum.NATIONAL_COST_EFFECTIVE,
    ingredientCost: IngredientCostEnum.MEDIUM,
    tariffExposure: TariffExposureEnum.MEDIUM,
    supplierLeadTime: LeadTimeEnum.MEDIUM,
    supplierReliability: RiskLevelEnum.MEDIUM,
    backupSupplierAccess: RiskLevelEnum.MEDIUM,
    coldChainDependency: RiskLevelEnum.HIGH,
    logisticsCost: LogisticsCostEnum.HIGH,
    refrigeratedStorageSpace: RiskLevelEnum.HIGH,
    refrigeratedStorageSpaceCost: RiskLevelEnum.MEDIUM,
    ambientStorageSpace: RiskLevelEnum.MEDIUM,
    ambientStorageSpaceCost: RiskLevelEnum.MEDIUM,
    overflowStoragePolicy: OverflowStoragePolicyEnum.PAY_FOR_OVERFLOW,
    // Make
    makeStrategy: InventoryStrategyEnum.HYBRID,
    batchPrepLevel: RiskLevelEnum.HIGH,
    capacityFlexibility: RiskLevelEnum.HIGH,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.DELIVERY_PLATFORM,
    deliveryPlatformDependency: RiskLevelEnum.HIGH,
    lastMileCostSensitivity: RiskLevelEnum.HIGH,

    startingBalance: 50000,
    initialStartupCost: 21000,
    startingInventory: 1000,
    weeklyRent: 600,
    maxDailyCapacity: 150,
    staffRequired: 4,
    weatherSensitivity: "low",
    mobility: "none",
    vibe: "invisible",
    riskProfile: "platform-dependent",
    peakHours: ["11:00-14:00", "18:00-22:00"],
    customerPatience: "low",
    marketingPower: "apps",
    commonIssues: ["delivery fees", "bad reviews", "algorithm changes"],
    growthCeiling: "high",
    salesMethod: "whole pie",
    costPerPie: 24,
    costPerSlice: 10,
    numberOfFridges: 2,
    numberOfOvens: 2,
    numberOfWarehouses: 1,
    aiFlavor: "optimization, ratings anxiety, margin obsession",
    pros: "No front-of-house costs or customer seating reduces overhead significantly. Weather-independent operations provide consistency, and you can scale efficiently with delivery platforms. Lower overhead than traditional restaurants improves profitability.",
    cons: "Platform fees eat into margins and reduce profitability. Dependent on delivery app algorithms for visibility, which can change unpredictably. No direct customer interaction limits relationship building, and bad reviews can kill visibility on platforms.",
  },

  campus_kiosk: {
    ...BASE_PRESET,
    label: "Campus Kiosk",
    description:
      "High volume, low choice, predictable chaos during class transitions.",
    // Plan
    planStrategy: PlanStrategyEnum.ROUTINE_REPLENISHMENT,
    forecastReliance: RiskLevelEnum.HIGH,
    demandVolatility: RiskLevelEnum.LOW,
    planningHorizonWeeks: 2,
    // Source
    ingredientSource: IngredientSourceEnum.NATIONAL_COST_EFFECTIVE,
    ingredientCost: IngredientCostEnum.LOW,
    tariffExposure: TariffExposureEnum.LOW,
    supplierLeadTime: LeadTimeEnum.MEDIUM,
    supplierReliability: RiskLevelEnum.HIGH,
    backupSupplierAccess: RiskLevelEnum.HIGH,
    coldChainDependency: RiskLevelEnum.MEDIUM,
    logisticsCost: LogisticsCostEnum.LOW,
    refrigeratedStorageSpace: RiskLevelEnum.MEDIUM,
    refrigeratedStorageSpaceCost: RiskLevelEnum.MEDIUM,
    ambientStorageSpace: RiskLevelEnum.MEDIUM,
    ambientStorageSpaceCost: RiskLevelEnum.LOW,
    overflowStoragePolicy: OverflowStoragePolicyEnum.PAY_FOR_OVERFLOW,
    // Make
    makeStrategy: InventoryStrategyEnum.HYBRID,
    batchPrepLevel: RiskLevelEnum.MEDIUM,
    capacityFlexibility: RiskLevelEnum.MEDIUM,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.WALK_UP,
    deliveryPlatformDependency: RiskLevelEnum.VERY_LOW,
    lastMileCostSensitivity: RiskLevelEnum.VERY_LOW,

    startingBalance: 50000,
    initialStartupCost: 13000,
    startingInventory: 1000,
    weeklyRent: 500,
    maxDailyCapacity: 180,
    staffRequired: 2,
    weatherSensitivity: "low",
    mobility: "none",
    vibe: "fast",
    riskProfile: "stable",
    peakHours: ["09:00-11:00", "12:00-14:00"],
    customerPatience: "very low",
    marketingPower: "foot traffic",
    commonIssues: ["long lines", "limited menu fatigue"],
    growthCeiling: "low",
    salesMethod: "by the slice",
    costPerSlice: 6,
    costPerPie: 16,
    numberOfFridges: 2,
    numberOfOvens: 2,
    numberOfWarehouses: 1,
    aiFlavor: "speed, throughput, repetition",
    pros: "Predictable high-volume demand provides stability, with weather-independent location ensuring consistent operations. Captive audience during peak hours drives sales, and lower startup costs than full restaurants make it more accessible.",
    cons: "Very limited menu options can lead to customer fatigue, and long lines during rush periods can frustrate customers. Seasonal demand during breaks and summer creates revenue gaps, and limited growth potential restricts expansion.",
  },

  upscale_bistro: {
    ...BASE_PRESET,
    label: "Upscale Bistro",
    description: "Stylish but approachable. Balance quality with consistency.",
    // Plan
    planStrategy: PlanStrategyEnum.FORECAST_DRIVEN,
    forecastReliance: RiskLevelEnum.HIGH,
    demandVolatility: RiskLevelEnum.LOW,
    planningHorizonWeeks: 3,
    // Source
    ingredientSource: IngredientSourceEnum.LOCAL_ORGANIC,
    ingredientCost: IngredientCostEnum.HIGH,
    tariffExposure: TariffExposureEnum.MEDIUM,
    supplierLeadTime: LeadTimeEnum.MEDIUM,
    supplierReliability: RiskLevelEnum.MEDIUM,
    backupSupplierAccess: RiskLevelEnum.MEDIUM,
    coldChainDependency: RiskLevelEnum.HIGH,
    logisticsCost: LogisticsCostEnum.HIGH,
    refrigeratedStorageSpace: RiskLevelEnum.HIGH,
    refrigeratedStorageSpaceCost: RiskLevelEnum.HIGH,
    ambientStorageSpace: RiskLevelEnum.MEDIUM,
    ambientStorageSpaceCost: RiskLevelEnum.MEDIUM,
    overflowStoragePolicy: OverflowStoragePolicyEnum.PAY_FOR_OVERFLOW,
    // Make
    makeStrategy: InventoryStrategyEnum.MAKE_TO_ORDER,
    batchPrepLevel: RiskLevelEnum.MEDIUM,
    capacityFlexibility: RiskLevelEnum.LOW,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.DINE_IN,
    deliveryPlatformDependency: RiskLevelEnum.LOW,
    lastMileCostSensitivity: RiskLevelEnum.LOW,

    startingBalance: 50000,
    initialStartupCost: 32000,
    startingInventory: 1000,
    weeklyRent: 2200,
    maxDailyCapacity: 90,
    staffRequired: 8,
    weatherSensitivity: "low",
    mobility: "none",
    vibe: "refined",
    riskProfile: "high expectations",
    peakHours: ["18:00-22:00"],
    customerPatience: "high",
    marketingPower: "reputation",
    commonIssues: ["labor costs", "menu creep", "review pressure"],
    growthCeiling: "medium",
    salesMethod: "whole pie",
    costPerPie: 30,
    costPerSlice: 12,
    numberOfFridges: 3,
    numberOfOvens: 2,
    numberOfWarehouses: 1,
    aiFlavor: "quality control, steady refinement",
    pros: "Premium pricing with quality positioning creates strong margins, and weather-independent operations provide consistency. Strong reputation-based marketing builds customer trust, with a balanced approach between fine dining and casual appealing to a broader market.",
    cons: "High labor and operating costs reduce profitability, and pressure to maintain quality standards requires constant attention. Review pressure affects reputation significantly, and limited capacity constrains revenue growth.",
  },

  festival_vendor: {
    ...BASE_PRESET,
    label: "Festival Vendor",
    description:
      "Short bursts of extreme volume followed by long quiet stretches.",
    // Plan
    planStrategy: PlanStrategyEnum.EVENT_DRIVEN,
    forecastReliance: RiskLevelEnum.LOW,
    demandVolatility: RiskLevelEnum.VERY_HIGH,
    planningHorizonWeeks: 1,
    // Source
    ingredientSource: IngredientSourceEnum.NATIONAL_COST_EFFECTIVE,
    ingredientCost: IngredientCostEnum.MEDIUM,
    tariffExposure: TariffExposureEnum.LOW,
    supplierLeadTime: LeadTimeEnum.SHORT,
    supplierReliability: RiskLevelEnum.LOW,
    backupSupplierAccess: RiskLevelEnum.MEDIUM,
    coldChainDependency: RiskLevelEnum.HIGH,
    logisticsCost: LogisticsCostEnum.HIGH,
    refrigeratedStorageSpace: RiskLevelEnum.LOW,
    refrigeratedStorageSpaceCost: RiskLevelEnum.VERY_HIGH,
    ambientStorageSpace: RiskLevelEnum.LOW,
    ambientStorageSpaceCost: RiskLevelEnum.HIGH,
    overflowStoragePolicy: OverflowStoragePolicyEnum.EMERGENCY_REPLENISHMENT,
    // Make
    makeStrategy: InventoryStrategyEnum.MAKE_TO_STOCK,
    batchPrepLevel: RiskLevelEnum.HIGH,
    capacityFlexibility: RiskLevelEnum.HIGH,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.WALK_UP,
    deliveryPlatformDependency: RiskLevelEnum.VERY_LOW,
    lastMileCostSensitivity: RiskLevelEnum.LOW,

    startingBalance: 50000,
    initialStartupCost: 11000,
    startingInventory: 1000,
    weeklyRent: 0,
    maxDailyCapacity: 300,
    staffRequired: 5,
    weatherSensitivity: "very high",
    mobility: "high",
    vibe: "chaotic",
    riskProfile: "boom-or-bust",
    peakHours: ["all day"],
    customerPatience: "very low",
    marketingPower: "event-driven",
    commonIssues: ["supply runouts", "staff exhaustion", "weather disasters"],
    growthCeiling: "event-limited",
    salesMethod: "by the slice",
    costPerSlice: 9,
    costPerPie: 22,
    numberOfFridges: 1,
    numberOfOvens: 2,
    numberOfWarehouses: 1,
    aiFlavor: "survival mode, demand spikes, fast decisions",
    pros: "Extremely high volume during events can generate significant revenue, and no weekly rent costs improve margins. Can follow high-traffic events for maximum exposure, with lower startup costs than permanent locations reducing initial investment.",
    cons: "Boom-or-bust revenue model creates financial instability, and extremely weather-dependent operations can shut down unexpectedly. Staff exhaustion during peak events impacts service quality, and being limited to event schedules restricts consistent revenue.",
  },

  franchise_location: {
    ...BASE_PRESET,
    label: "Franchise Location",
    description: "Rules, systems, and brand power at the cost of flexibility.",
    // Plan
    planStrategy: PlanStrategyEnum.ROUTINE_REPLENISHMENT,
    forecastReliance: RiskLevelEnum.HIGH,
    demandVolatility: RiskLevelEnum.LOW,
    planningHorizonWeeks: 3,
    // Source
    ingredientSource: IngredientSourceEnum.NATIONAL_COST_EFFECTIVE,
    ingredientCost: IngredientCostEnum.LOW,
    tariffExposure: TariffExposureEnum.LOW,
    supplierLeadTime: LeadTimeEnum.MEDIUM,
    supplierReliability: RiskLevelEnum.HIGH,
    backupSupplierAccess: RiskLevelEnum.LOW,
    coldChainDependency: RiskLevelEnum.HIGH,
    logisticsCost: LogisticsCostEnum.MEDIUM,
    refrigeratedStorageSpace: RiskLevelEnum.HIGH,
    refrigeratedStorageSpaceCost: RiskLevelEnum.MEDIUM,
    ambientStorageSpace: RiskLevelEnum.HIGH,
    ambientStorageSpaceCost: RiskLevelEnum.MEDIUM,
    overflowStoragePolicy: OverflowStoragePolicyEnum.PAY_FOR_OVERFLOW,
    // Make
    makeStrategy: InventoryStrategyEnum.MAKE_TO_STOCK,
    batchPrepLevel: RiskLevelEnum.HIGH,
    capacityFlexibility: RiskLevelEnum.MEDIUM,
    // Deliver
    fulfillmentModel: FulfillmentModelEnum.PICKUP,
    deliveryPlatformDependency: RiskLevelEnum.MEDIUM,
    lastMileCostSensitivity: RiskLevelEnum.MEDIUM,

    startingBalance: 50000,
    initialStartupCost: 38000,
    startingInventory: 5000,
    weeklyRent: 1800,
    royaltyRate: 0.08,
    maxDailyCapacity: 220,
    staffRequired: 7,
    weatherSensitivity: "low",
    mobility: "none",
    vibe: "corporate",
    riskProfile: "structured",
    peakHours: ["11:00-14:00", "17:00-21:00"],
    customerPatience: "medium",
    marketingPower: "brand",
    commonIssues: ["royalty fees", "limited creativity", "corporate audits"],
    growthCeiling: "high",
    salesMethod: "whole pie",
    costPerPie: 18,
    costPerSlice: 7,
    numberOfFridges: 3,
    numberOfOvens: 3,
    numberOfWarehouses: 1,
    aiFlavor: "rule following, margin squeezing, scale economics",
    pros: "Brand recognition drives customer traffic and reduces marketing needs. Proven systems and operational support provide guidance, while weather-independent operations ensure consistency. Higher growth potential than independent stores offers scalability.",
    cons: "Royalty fees reduce profit margins significantly, and limited flexibility in operations and menu restricts creativity. High startup and franchise fees require substantial initial investment, and corporate oversight and audits add administrative burden.",
  },
};

/**
 * Get preset for a store type
 * @param {string} storeType - Store type ("food_truck", "indoor", "outdoor")
 * @returns {Object} Preset variables object
 */
function getPreset(storeType) {
  if (!storeType) {
    throw new Error("storeType is required");
  }

  const preset = STORE_TYPE_PRESETS[storeType];
  if (!preset) {
    throw new Error(
      `Invalid storeType: ${storeType}. Must be one of: ${Object.keys(STORE_TYPE_PRESETS).join(", ")}`
    );
  }

  // Return a copy to avoid mutations
  return { ...preset };
}

/**
 * Get all available store types
 * @returns {Array<string>} Array of store type keys
 */
function getAvailableStoreTypes() {
  return Object.keys(STORE_TYPE_PRESETS);
}

/**
 * Check if a store type is valid
 * @param {string} storeType - Store type to validate
 * @returns {boolean} True if valid
 */
function isValidStoreType(storeType) {
  return storeType && storeType in STORE_TYPE_PRESETS;
}

module.exports = {
  STORE_TYPE_PRESETS,
  getPreset,
  getAvailableStoreTypes,
  isValidStoreType,
};

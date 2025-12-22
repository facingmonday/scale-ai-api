/**
 * Store Type Presets
 *
 * These presets define default variable values for each store type.
 * They are used only during store creation to populate initial values.
 *
 * Presets do not lock or constrain future edits unless enforced elsewhere.
 */

const STORE_TYPE_PRESETS = {
  food_truck: {
    label: "Food Truck",
    description:
      "A scrappy, mobile kitchen that lives or dies by location, weather, and word of mouth.",
    startingBalance: 5000,
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
    growthCeiling: "low",
    aiFlavor: "hustle energy, improvisation, chasing crowds",
  },

  cafe: {
    label: "Neighborhood Café",
    description:
      "A cozy, repeat-customer driven business built on routine and regulars.",
    startingBalance: 8000,
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
  },
  bar_and_grill: {
    label: "Bar & Grill",
    description:
      "High margins, unpredictable nights, and staffing chaos when things get busy.",
    startingBalance: 14000,
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
    aiFlavor: "crowd dynamics, risk management, late-night math",
  },

  fine_dining: {
    label: "Fine Dining Restaurant",
    description:
      "Low volume, high expectations. Reputation is everything and mistakes are expensive.",
    startingBalance: 25000,
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
    aiFlavor: "precision, perfectionism, brand protection",
  },

  street_cart: {
    label: "Street Cart",
    description:
      "Ultra-lean operation with massive foot traffic swings and razor-thin margins.",
    startingBalance: 2500,
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
    aiFlavor: "scrappy decisions, cash flow panic, opportunistic selling",
  },

  late_night_window: {
    label: "Late-Night Walk-Up Window",
    description:
      "Few hours, huge spikes, and customers who want food immediately.",
    startingBalance: 7000,
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
    aiFlavor: "speed under pressure, fatigue management",
  },

  ghost_kitchen: {
    label: "Ghost Kitchen",
    description:
      "No storefront, no seating, pure delivery math and platform dependency.",
    startingBalance: 9000,
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
    aiFlavor: "optimization, ratings anxiety, margin obsession",
  },

  campus_kiosk: {
    label: "Campus Kiosk",
    description:
      "High volume, low choice, predictable chaos during class transitions.",
    startingBalance: 6000,
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
    aiFlavor: "speed, throughput, repetition",
  },

  upscale_bistro: {
    label: "Upscale Bistro",
    description: "Stylish but approachable. Balance quality with consistency.",
    startingBalance: 18000,
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
    aiFlavor: "quality control, steady refinement",
  },

  festival_vendor: {
    label: "Festival Vendor",
    description:
      "Short bursts of extreme volume followed by long quiet stretches.",
    startingBalance: 6500,
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
    aiFlavor: "survival mode, demand spikes, fast decisions",
  },

  franchise_location: {
    label: "Franchise Location",
    description: "Rules, systems, and brand power at the cost of flexibility.",
    startingBalance: 20000,
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
    aiFlavor: "rule following, margin squeezing, scale economics",
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

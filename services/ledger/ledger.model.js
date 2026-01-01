const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const openai = require("../../lib/openai");
const { v4: uuidv4 } = require("uuid");
const AI_MODEL = process.env.AI_MODEL || "gpt-4o";

const ledgerEntrySchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: false,
    default: null,
  },
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Submission",
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  sales: {
    type: Number,
    required: true,
    min: 0,
  },
  revenue: {
    type: Number,
    required: true,
  },
  costs: {
    type: Number,
    required: true,
    min: 0,
  },
  waste: {
    type: Number,
    required: true,
    min: 0,
  },
  cashBefore: {
    type: Number,
    required: true,
  },
  cashAfter: {
    type: Number,
    required: true,
  },
  inventoryState: {
    refrigeratedUnits: { type: Number, default: 0, min: 0 },
    ambientUnits: { type: Number, default: 0, min: 0 },
    notForResaleUnits: { type: Number, default: 0, min: 0 },
  },
  netProfit: {
    type: Number,
    required: true,
  },
  randomEvent: {
    type: String,
    default: null,
  },
  summary: {
    type: String,
    required: true,
  },
  // AI-calculated educational / explainability metrics for teaching purposes
  // (Kept schema-light; validated via AI JSON schema + app-level checks)
  education: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  aiMetadata: {
    model: {
      type: String,
      required: true,
    },
    runId: {
      type: String,
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  calculationContext: {
    // Store variables at time of calculation
    storeVariables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Scenario variables
    scenarioVariables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Submission variables (student decisions)
    submissionVariables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Outcome variables
    outcomeVariables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Prior ledger state
    priorState: {
      cashBefore: Number,
      inventoryState: {
        refrigeratedUnits: { type: Number, default: 0 },
        ambientUnits: { type: Number, default: 0 },
        notForResaleUnits: { type: Number, default: 0 },
      },
      ledgerHistory: [
        {
          scenarioId: mongoose.Schema.Types.ObjectId,
          scenarioTitle: String,
          netProfit: Number,
          cashAfter: Number,
        },
      ],
    },
    // Full prompt sent to OpenAI (stored as stringified JSON)
    prompt: {
      type: String,
      default: null,
    },
  },
  overridden: {
    type: Boolean,
    default: false,
  },
  overriddenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    default: null,
  },
  overriddenAt: {
    type: Date,
    default: null,
  },
}).add(baseSchema);

// Compound indexes for performance
// Sparse unique index for scenario-based entries (only applies when scenarioId exists)
ledgerEntrySchema.index(
  { scenarioId: 1, userId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { scenarioId: { $ne: null } },
  }
);
// Unique index for initial entries (where scenarioId is null)
ledgerEntrySchema.index(
  { classroomId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { scenarioId: null },
  }
);
ledgerEntrySchema.index({ classroomId: 1, userId: 1, createdDate: 1 });
ledgerEntrySchema.index({ scenarioId: 1 });
ledgerEntrySchema.index({ organization: 1, scenarioId: 1 });
ledgerEntrySchema.index({ organization: 1, classroomId: 1, userId: 1 });
ledgerEntrySchema.index({ submissionId: 1 });

// Validation: cashAfter must equal cashBefore + netProfit
ledgerEntrySchema.pre("save", function (next) {
  const expectedCashAfter = this.cashBefore + this.netProfit;
  if (Math.abs(this.cashAfter - expectedCashAfter) > 0.01) {
    return next(
      new Error(
        `Cash continuity error: cashAfter (${this.cashAfter}) must equal cashBefore (${this.cashBefore}) + netProfit (${this.netProfit})`
      )
    );
  }
  next();
});

// Static methods

/**
 * Get the OpenAI JSON schema for an AI-generated scenario ledger entry payload.
 *
 * Notes:
 * - This schema describes the AI response payload (NOT the full Mongo document).
 * - aiMetadata + calculationContext are added by the application after the AI responds.
 * - Keep this in sync with how SimulationWorker writes ledger entries.
 *
 * @returns {Object} JSON schema object for OpenAI response_format.json_schema.schema
 */
ledgerEntrySchema.statics.getAISimulationResponseJsonSchema = function () {
  return {
    type: "object",
    required: [
      "sales",
      "revenue",
      "costs",
      "waste",
      "cashBefore",
      "cashAfter",
      "inventoryState",
      "netProfit",
      "randomEvent",
      "summary",
      "education",
    ],
    properties: {
      sales: { type: "number" },
      revenue: { type: "number" },
      costs: { type: "number" },
      waste: { type: "number" },
      cashBefore: { type: "number" },
      cashAfter: { type: "number" },
      inventoryState: {
        type: "object",
        required: ["refrigeratedUnits", "ambientUnits", "notForResaleUnits"],
        properties: {
          refrigeratedUnits: { type: "number", minimum: 0 },
          ambientUnits: { type: "number", minimum: 0 },
          notForResaleUnits: { type: "number", minimum: 0 },
        },
      },
      netProfit: { type: "number" },
      randomEvent: { type: ["string", "null"] },
      summary: { type: "string" },
      education: {
        type: "object",
        required: [
          "demandForecast",
          "demandActual",
          "serviceLevel",
          "fillRate",
          "stockoutUnits",
          "lostSalesUnits",
          "backorderUnits",
          "materialFlowByBucket",
          "costBreakdown",
          "teachingNotes",
        ],
        properties: {
          demandForecast: { type: "number" },
          demandActual: { type: "number" },
          serviceLevel: { type: "number" },
          fillRate: { type: "number" },
          stockoutUnits: { type: "number" },
          lostSalesUnits: { type: "number" },
          backorderUnits: { type: "number" },
          materialFlowByBucket: {
            type: "object",
            required: ["refrigerated", "ambient", "notForResaleDry"],
            properties: {
              refrigerated: {
                type: "object",
                required: [
                  "beginUnits",
                  "receivedUnits",
                  "usedUnits",
                  "wasteUnits",
                  "endUnits",
                ],
                properties: {
                  beginUnits: { type: "number" },
                  receivedUnits: { type: "number" },
                  usedUnits: { type: "number" },
                  wasteUnits: { type: "number" },
                  endUnits: { type: "number" },
                },
              },
              ambient: {
                type: "object",
                required: [
                  "beginUnits",
                  "receivedUnits",
                  "usedUnits",
                  "wasteUnits",
                  "endUnits",
                ],
                properties: {
                  beginUnits: { type: "number" },
                  receivedUnits: { type: "number" },
                  usedUnits: { type: "number" },
                  wasteUnits: { type: "number" },
                  endUnits: { type: "number" },
                },
              },
              notForResaleDry: {
                type: "object",
                required: [
                  "beginUnits",
                  "receivedUnits",
                  "usedUnits",
                  "wasteUnits",
                  "endUnits",
                ],
                properties: {
                  beginUnits: { type: "number" },
                  receivedUnits: { type: "number" },
                  usedUnits: { type: "number" },
                  wasteUnits: { type: "number" },
                  endUnits: { type: "number" },
                },
              },
            },
          },
          costBreakdown: {
            type: "object",
            required: [
              "ingredientCost",
              "laborCost",
              "logisticsCost",
              "tariffCost",
              "holdingCost",
              "overflowStorageCost",
              "expediteCost",
              "wasteDisposalCost",
              "otherCost",
            ],
            properties: {
              ingredientCost: { type: "number" },
              laborCost: { type: "number" },
              logisticsCost: { type: "number" },
              tariffCost: { type: "number" },
              holdingCost: { type: "number" },
              overflowStorageCost: { type: "number" },
              expediteCost: { type: "number" },
              wasteDisposalCost: { type: "number" },
              otherCost: { type: "number" },
            },
          },
          teachingNotes: { type: "string" },
        },
      },
    },
  };
};

/**
 * Build warehouse rules message for AI prompt
 * @param {Object} inventoryState - Current inventory state
 * @returns {Object} Message object with warehouse rules
 */
ledgerEntrySchema.statics.buildWarehouseRulesMessage = function (
  inventoryState
) {
  const currentInventoryState = inventoryState || {
    refrigeratedUnits: 0,
    ambientUnits: 0,
    notForResaleUnits: 0,
  };

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

11. FINAL CHECK
Before returning output:
- Buckets reconcile
- No capacity violations
- Costs match inventory state
- No inventory appears or disappears
`;

  return {
    role: "user",
    content: `CURRENT INVENTORY STATE:\n${JSON.stringify(
      currentInventoryState,
      null,
      2
    )}${warehouseRules}\n\nCalculate the ending inventoryState based on production, sales, waste, and orders, strictly following these warehouse rules.`,
  };
};

/**
 * Build OpenAI prompt messages
 * @param {Object} store - Store configuration
 * @param {Object} scenario - Scenario data
 * @param {Object} scenarioOutcome - Global scenario outcome
 * @param {Object} submission - Student submission
 * @param {Array} ledgerHistory - Prior ledger entries
 * @param {Object} inventoryState - Current inventory state (refrigeratedUnits, ambientUnits, notForResaleUnits)
 * @returns {Array} Array of message objects
 */
ledgerEntrySchema.statics.buildAISimulationPrompt = function (
  store,
  scenario,
  scenarioOutcome,
  submission,
  ledgerHistory,
  inventoryState
) {
  const chancePercent =
    scenarioOutcome?.randomEventChancePercent !== undefined
      ? Number(scenarioOutcome.randomEventChancePercent)
      : 0;
  const shouldGenerateEvent =
    Number.isFinite(chancePercent) &&
    chancePercent > 0 &&
    Math.random() * 100 < chancePercent;

  const messages = [
    {
      role: "system",
      content:
        "You are the SCALE.ai simulation engine for a supply chain class using a pizza shop game. Calculate outcomes for one student based on store configuration, scenario context, global outcome, and the student's decisions. Apply realistic business logic and environmental effects.\n\n" +
        "Return ONLY valid JSON matching the provided schema. You may invent reasonable intermediate numbers when needed. Also compute the required education metrics so instructors can explain results (service level, stockouts/lost sales, by-bucket material flow, and cost breakdown).",
    },
    {
      role: "user",
      content: `STORE CONFIGURATION:\n${JSON.stringify(
        {
          shopName: store.shopName || "Student Shop",
          storeType: store.storeType,
          // Variables are flattened by getStoreForSimulation, so all variable keys are at top level
          ...store,
        },
        null,
        2
      )}`,
    },
    {
      role: "user",
      content: `SCENARIO:\n${JSON.stringify(
        {
          title: scenario.title,
          description: scenario.description,
          variables: scenario.variables || {},
        },
        null,
        2
      )}`,
    },
    {
      role: "user",
      content: `GLOBAL SCENARIO OUTCOME:\n${JSON.stringify(
        {
          notes: scenarioOutcome.notes || "",
          hiddenNotes: scenarioOutcome.hiddenNotes || "",
          ...(shouldGenerateEvent
            ? {
                randomEvent: `Generate ONE plausible, educational random operational event grounded in the inputs and set randomEvent to that event text (1-3 sentences). Apply its impact in your calculations.`,
              }
            : {}),
        },
        null,
        2
      )}`,
    },
    {
      role: "user",
      content: `STUDENT DECISIONS:\n${JSON.stringify(
        submission.variables || {},
        null,
        2
      )}`,
    },
  ];

  // Add current inventory state with warehouse rules
  messages.push(this.buildWarehouseRulesMessage(inventoryState));

  // Add ledger history if available
  if (ledgerHistory && ledgerHistory.length > 0) {
    const historyData = ledgerHistory.map((entry) => ({
      scenarioId: entry.scenarioId?._id || entry.scenarioId || null,
      scenarioTitle: entry.scenarioId?.title || "Initial Setup",
      netProfit: entry.netProfit,
      cashAfter: entry.cashAfter,
      inventoryState: entry.inventoryState || {
        refrigeratedUnits: 0,
        ambientUnits: 0,
        notForResaleUnits: 0,
      },
    }));

    messages.push({
      role: "user",
      content: `LEDGER HISTORY:\n${JSON.stringify(
        { entries: historyData },
        null,
        2
      )}`,
    });
  }

  return messages;
};

/**
 * Validate AI response structure
 * @param {Object} response - AI response
 * @throws {Error} If response is invalid
 */
ledgerEntrySchema.statics.validateAISimulationResponse = function (response) {
  const requiredFields = [
    "sales",
    "revenue",
    "costs",
    "waste",
    "cashBefore",
    "cashAfter",
    "inventoryState",
    "netProfit",
    "randomEvent",
    "summary",
    "education",
  ];

  for (const field of requiredFields) {
    if (response[field] === undefined) {
      throw new Error(`Missing required field in AI response: ${field}`);
    }
  }

  // Validate types
  if (typeof response.sales !== "number") {
    throw new Error("sales must be a number");
  }
  if (typeof response.revenue !== "number") {
    throw new Error("revenue must be a number");
  }
  if (typeof response.costs !== "number") {
    throw new Error("costs must be a number");
  }
  if (typeof response.waste !== "number") {
    throw new Error("waste must be a number");
  }
  if (typeof response.cashBefore !== "number") {
    throw new Error("cashBefore must be a number");
  }
  if (typeof response.cashAfter !== "number") {
    throw new Error("cashAfter must be a number");
  }
  if (!response.inventoryState || typeof response.inventoryState !== "object") {
    throw new Error("inventoryState must be an object");
  }
  if (
    typeof response.inventoryState.refrigeratedUnits !== "number" ||
    response.inventoryState.refrigeratedUnits < 0
  ) {
    throw new Error(
      "inventoryState.refrigeratedUnits must be a non-negative number"
    );
  }
  if (
    typeof response.inventoryState.ambientUnits !== "number" ||
    response.inventoryState.ambientUnits < 0
  ) {
    throw new Error(
      "inventoryState.ambientUnits must be a non-negative number"
    );
  }
  if (
    typeof response.inventoryState.notForResaleUnits !== "number" ||
    response.inventoryState.notForResaleUnits < 0
  ) {
    throw new Error(
      "inventoryState.notForResaleUnits must be a non-negative number"
    );
  }
  if (typeof response.netProfit !== "number") {
    throw new Error("netProfit must be a number");
  }
  if (
    response.randomEvent !== null &&
    typeof response.randomEvent !== "string"
  ) {
    throw new Error("randomEvent must be a string or null");
  }
  if (typeof response.summary !== "string") {
    throw new Error("summary must be a string");
  }

  // Education metrics (for teaching/explainability)
  if (typeof response.education !== "object" || response.education === null) {
    throw new Error("education must be an object");
  }
  if (typeof response.education.teachingNotes !== "string") {
    throw new Error("education.teachingNotes must be a string");
  }
  for (const field of ["serviceLevel", "fillRate"]) {
    const v = response.education[field];
    if (typeof v !== "number" || v < 0 || v > 1) {
      throw new Error(`education.${field} must be a number between 0 and 1`);
    }
  }

  // Validate cash continuity
  const expectedCashAfter = response.cashBefore + response.netProfit;
  if (Math.abs(response.cashAfter - expectedCashAfter) > 0.01) {
    throw new Error(
      `Cash continuity error: cashAfter (${response.cashAfter}) must equal cashBefore (${response.cashBefore}) + netProfit (${response.netProfit})`
    );
  }
};

/**
 * Run AI simulation for a student
 * @param {Object} context - Simulation context
 * @param {Object} context.store - Store configuration
 * @param {Object} context.scenario - Scenario data
 * @param {Object} context.scenarioOutcome - Global scenario outcome
 * @param {Object} context.submission - Student submission
 * @param {Array} context.ledgerHistory - Prior ledger entries
 * @param {Object} context.inventoryState - Current inventory state
 * @returns {Promise<Object>} AI response matching ledger entry schema
 */
ledgerEntrySchema.statics.runAISimulation = async function (context) {
  console.log(
    `Running AI simulation for scenario ${context.scenario._id} for submission ${context.submission._id}`
  );
  const {
    store,
    scenario,
    scenarioOutcome,
    submission,
    ledgerHistory,
    inventoryState,
  } = context;

  // Build OpenAI prompt
  const messages = this.buildAISimulationPrompt(
    store,
    scenario,
    scenarioOutcome,
    submission,
    ledgerHistory,
    inventoryState
  );

  const aiResponseSchema = this.getAISimulationResponseJsonSchema();

  // Call OpenAI with JSON schema
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "scenario_ledger_entry",
        schema: aiResponseSchema,
      },
    },
  });

  // Parse response
  const content = response.choices[0].message.content;
  let aiResult;
  try {
    aiResult = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
  }

  console.log(`AI response: ${JSON.stringify(aiResult, null, 2)}`);

  // Validate response structure
  this.validateAISimulationResponse(aiResult);

  // Create a deep copy of the result before adding metadata to avoid circular reference
  // This ensures the copy is completely independent
  const resultCopy = JSON.parse(JSON.stringify(aiResult));

  // Add metadata
  aiResult.aiMetadata = {
    model: AI_MODEL,
    runId: uuidv4(),
    generatedAt: new Date(),
    prompt: messages,
    aiResult: resultCopy, // Use deep copy to avoid circular reference
  };

  return aiResult;
};

/**
 * Create a ledger entry
 * @param {Object} input - Ledger entry data
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created ledger entry
 */
ledgerEntrySchema.statics.createLedgerEntry = async function (
  input,
  organizationId,
  clerkUserId
) {
  // Validate cash continuity
  const expectedCashAfter = input.cashBefore + input.netProfit;
  if (Math.abs(input.cashAfter - expectedCashAfter) > 0.01) {
    throw new Error(
      `Cash continuity error: cashAfter (${input.cashAfter}) must equal cashBefore (${input.cashBefore}) + netProfit (${input.netProfit})`
    );
  }

  // Check if entry already exists
  // For scenario-based entries, check scenarioId + userId
  // For initial entries, check classroomId + userId + scenarioId is null
  let existing;
  if (input.scenarioId) {
    existing = await this.findOne({
      scenarioId: input.scenarioId,
      userId: input.userId,
    });
  } else {
    // Initial entry (no scenarioId)
    existing = await this.findOne({
      classroomId: input.classroomId,
      userId: input.userId,
      scenarioId: null,
    });
  }

  if (existing) {
    const entryType = input.scenarioId ? "scenario" : "initial";
    throw new Error(
      `Ledger entry already exists for this ${entryType} and user. Delete existing entry before creating a new one.`
    );
  }

  const entry = new this({
    classroomId: input.classroomId,
    scenarioId: input.scenarioId || null, // Explicitly set to null if not provided
    submissionId: input.submissionId || null,
    userId: input.userId,
    sales: input.sales,
    revenue: input.revenue,
    costs: input.costs,
    waste: input.waste,
    cashBefore: input.cashBefore,
    cashAfter: input.cashAfter,
    inventoryState: input.inventoryState || {
      refrigeratedUnits: 0,
      ambientUnits: 0,
      notForResaleUnits: 0,
    },
    netProfit: input.netProfit,
    randomEvent: input.randomEvent || null,
    summary: input.summary,
    education: input.education ?? null,
    aiMetadata: {
      model: input.aiMetadata.model,
      runId: input.aiMetadata.runId,
      generatedAt: input.aiMetadata.generatedAt || new Date(),
    },
    calculationContext: input.calculationContext
      ? {
          storeVariables: input.calculationContext.storeVariables || {},
          scenarioVariables: input.calculationContext.scenarioVariables || {},
          submissionVariables:
            input.calculationContext.submissionVariables || {},
          outcomeVariables: input.calculationContext.outcomeVariables || {},
          priorState: input.calculationContext.priorState || {},
          prompt: input.calculationContext.prompt || null,
        }
      : undefined,
    overridden: false,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await entry.save();
  return entry;
};

/**
 * Get ledger history for a user in a class
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @param {string} excludeScenarioId - Optional scenario ID to exclude (for reruns)
 * @returns {Promise<Array>} Ordered list of ledger entries
 */
ledgerEntrySchema.statics.getLedgerHistory = async function (
  classroomId,
  userId,
  excludeScenarioId = null
) {
  const query = { classroomId };

  if (userId) {
    query.userId = userId;
  }

  if (excludeScenarioId) {
    query.scenarioId = { $ne: excludeScenarioId };
  }
  return await this.find(query)
    .sort({ createdDate: 1 })
    .populate({
      path: "scenarioId",
      select: "title",
      options: { strictPopulate: false }, // Allow null values
    });
};

/**
 * Get ledger entry for a specific scenario and user
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Ledger entry or null
 */
ledgerEntrySchema.statics.getLedgerEntry = async function (scenarioId, userId) {
  return await this.findOne({ scenarioId, userId });
};

/**
 * Delete all ledger entries for a scenario (used during reruns)
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Object>} Deletion result
 */
ledgerEntrySchema.statics.deleteLedgerEntriesForScenario = async function (
  scenarioId
) {
  const result = await this.deleteMany({ scenarioId });
  return result;
};

/**
 * Override a ledger entry (admin-only)
 * @param {string} ledgerId - Ledger entry ID
 * @param {Object} patch - Fields to override
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @param {string} adminUserId - Admin member ID for overriddenBy
 * @returns {Promise<Object>} Updated ledger entry
 */
ledgerEntrySchema.statics.overrideLedgerEntry = async function (
  ledgerId,
  patch,
  clerkUserId,
  adminUserId
) {
  const entry = await this.findById(ledgerId);
  if (!entry) {
    throw new Error("Ledger entry not found");
  }

  // Update allowed fields
  const allowedFields = [
    "sales",
    "revenue",
    "costs",
    "waste",
    "cashBefore",
    "cashAfter",
    "inventoryState",
    "netProfit",
    "randomEvent",
    "summary",
  ];

  allowedFields.forEach((field) => {
    if (patch[field] !== undefined) {
      entry[field] = patch[field];
    }
  });

  // Validate cash continuity after override
  const expectedCashAfter = entry.cashBefore + entry.netProfit;
  if (Math.abs(entry.cashAfter - expectedCashAfter) > 0.01) {
    throw new Error(
      `Cash continuity error: cashAfter (${entry.cashAfter}) must equal cashBefore (${entry.cashBefore}) + netProfit (${entry.netProfit})`
    );
  }

  // Mark as overridden
  entry.overridden = true;
  entry.overriddenBy = adminUserId;
  entry.overriddenAt = new Date();
  entry.updatedBy = clerkUserId;

  await entry.save();
  return entry;
};

/**
 * Get all ledger entries for a scenario
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Array>} Array of ledger entries
 */
ledgerEntrySchema.statics.getLedgerEntriesByScenario = async function (
  scenarioId
) {
  return await this.find({ scenarioId })
    .populate("userId", "_id firstName lastName")
    .sort({ userId: 1 });
};

/**
 * Get first ledger entry for a student in a classroom
 * @param {string} classroomId - Classroom ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} First ledger entry or null
 */
ledgerEntrySchema.statics.getFirstLedgerEntryByStudent = async function (
  classroomId,
  userId
) {
  return this.findOne({
    classroomId,
    userId,
  })
    .sort({ createdDate: 1, _id: 1 })
    .lean()
    .exec();
};

/**
 * Get first ledger entry for a student in a classroom
 * @param {string} classroomId - Classroom ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} First ledger entry or null
 */
ledgerEntrySchema.statics.getLastLedgerEntryByStudent = async function (
  classroomId,
  userId
) {
  return await this.findOne({
    classroomId,
    userId,
  })
    .sort({ createdDate: -1, _id: -1 })
    .lean()
    .exec();
};

/**
 * Get calculation details for a ledger entry with variable definitions
 * @param {string} ledgerId - Ledger entry ID
 * @returns {Promise<Object|null>} Calculation details with variable definitions or null
 */
ledgerEntrySchema.statics.getCalculationDetails = async function (ledgerId) {
  const VariableDefinition = require("../variableDefinition/variableDefinition.model");
  const entry = await this.findById(ledgerId);
  if (!entry) {
    return null;
  }

  // Get variable definitions for the classroom
  const allDefinitions = await VariableDefinition.getDefinitionsByClass(
    entry.classroomId
  );

  // Group definitions by appliesTo
  const definitionsByScope = {
    store: [],
    scenario: [],
    submission: [],
    outcome: [],
  };

  allDefinitions.forEach((def) => {
    if (def.appliesTo in definitionsByScope) {
      definitionsByScope[def.appliesTo].push({
        key: def.key,
        label: def.label,
        description: def.description,
        dataType: def.dataType,
        inputType: def.inputType,
      });
    }
  });

  // Convert Map objects to plain objects for JSON serialization
  const calculationContext = entry.calculationContext
    ? {
        storeVariables: entry.calculationContext.storeVariables
          ? Object.fromEntries(entry.calculationContext.storeVariables)
          : {},
        scenarioVariables: entry.calculationContext.scenarioVariables
          ? Object.fromEntries(entry.calculationContext.scenarioVariables)
          : {},
        submissionVariables: entry.calculationContext.submissionVariables
          ? Object.fromEntries(entry.calculationContext.submissionVariables)
          : {},
        outcomeVariables: entry.calculationContext.outcomeVariables
          ? Object.fromEntries(entry.calculationContext.outcomeVariables)
          : {},
        priorState: entry.calculationContext.priorState || {},
        prompt: entry.calculationContext.prompt || null,
      }
    : null;

  return {
    ledgerEntry: {
      _id: entry._id,
      scenarioId: entry.scenarioId,
      submissionId: entry.submissionId,
      sales: entry.sales,
      revenue: entry.revenue,
      costs: entry.costs,
      waste: entry.waste,
      cashBefore: entry.cashBefore,
      cashAfter: entry.cashAfter,
      inventoryState: entry.inventoryState || {
        refrigeratedUnits: 0,
        ambientUnits: 0,
        notForResaleUnits: 0,
      },
      netProfit: entry.netProfit,
      randomEvent: entry.randomEvent,
      summary: entry.summary,
      education: entry.education ?? null,
      overridden: entry.overridden,
      createdDate: entry.createdDate,
    },
    calculationContext,
    variableDefinitions: definitionsByScope,
  };
};

/**
 * Get ledger summary/aggregates for a student
 * Returns totals and current state from all ledger entries
 * @param {string} classroomId - Classroom ID
 * @param {string} userId - Member ID
 * @param {string} excludeScenarioId - Optional scenario ID to exclude (for reruns)
 * @returns {Promise<Object>} Aggregated ledger summary
 */

ledgerEntrySchema.statics.getLedgerSummary = async function (
  classroomId,
  userId,
  excludeScenarioId = null
) {
  const matchQuery = {
    classroomId: new mongoose.Types.ObjectId(classroomId),
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (excludeScenarioId) {
    matchQuery.scenarioId = {
      $ne: new mongoose.Types.ObjectId(excludeScenarioId),
    };
  }

  const results = await this.aggregate([
    { $match: matchQuery },
    { $sort: { createdDate: 1, _id: 1 } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$sales" },
        totalRevenue: { $sum: "$revenue" },
        totalCosts: { $sum: "$costs" },
        totalWaste: { $sum: "$waste" },
        totalNetProfit: { $sum: "$netProfit" },
        scenarioCount: {
          $sum: { $cond: [{ $ne: ["$scenarioId", null] }, 1, 0] },
        },
        totalEntries: { $sum: 1 },
        firstEntryDate: { $min: "$createdDate" },
        lastEntryDate: { $max: "$createdDate" },
        lastCashAfter: { $last: "$cashAfter" },
        lastInventoryState: { $last: "$inventoryState" },
      },
    },
  ]);

  const summary = results[0];

  if (!summary) {
    return {
      totalSales: 0,
      totalRevenue: 0,
      totalCosts: 0,
      totalWaste: 0,
      totalNetProfit: 0,
      scenarioCount: 0,
      totalEntries: 0,
      cashBalance: 0,
      inventoryState: {
        refrigeratedUnits: 0,
        ambientUnits: 0,
        notForResaleUnits: 0,
      },
      firstEntryDate: null,
      lastEntryDate: null,
      lastScenarioId: null,
    };
  }

  // Calculate aggregate inventory from last inventoryState
  const lastInventoryState = summary.lastInventoryState || {
    refrigeratedUnits: 0,
    ambientUnits: 0,
    notForResaleUnits: 0,
  };
  const inventory =
    (lastInventoryState.refrigeratedUnits || 0) +
    (lastInventoryState.ambientUnits || 0) +
    (lastInventoryState.notForResaleUnits || 0);

  return {
    totalSales: summary.totalSales,
    totalRevenue: summary.totalRevenue,
    totalCosts: summary.totalCosts,
    totalWaste: summary.totalWaste,
    totalNetProfit: summary.totalNetProfit,
    scenarioCount: summary.scenarioCount,
    totalEntries: summary.totalEntries,
    cashBalance: summary.lastCashAfter,
    inventory,
    inventoryState: lastInventoryState,
    firstEntryDate: summary.firstEntryDate,
    lastEntryDate: summary.lastEntryDate,
  };
};

const LedgerEntry = mongoose.model("LedgerEntry", ledgerEntrySchema);

module.exports = LedgerEntry;

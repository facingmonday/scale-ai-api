const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const openai = require("../../lib/openai");
const { v4: uuidv4 } = require("uuid");
const AI_MODEL = process.env.AI_MODEL || "gpt-5-mini-2025-08-07";

const ledgerEntrySchema = new mongoose.Schema({
  // Store this entry belongs to (useful for store-centric views)
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: false,
    default: null,
    index: true,
  },
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

// Auto-correct cash continuity: ensure cashAfter = cashBefore + netProfit
// Recalculate netProfit from cashAfter - cashBefore to maintain consistency
ledgerEntrySchema.pre("save", function (next) {
  this._wasNew = this.isNew;
  const expectedNetProfit = this.cashAfter - this.cashBefore;
  if (Math.abs(this.netProfit - expectedNetProfit) > 0.01) {
    console.warn(
      `Cash continuity correction in pre-save hook: netProfit (${this.netProfit}) doesn't match cashAfter (${this.cashAfter}) - cashBefore (${this.cashBefore}) = ${expectedNetProfit}. Correcting netProfit...`
    );
    this.netProfit = expectedNetProfit;
  }
  next();
});

// Post-save hook to create notifications when ledger entries are created
ledgerEntrySchema.post("save", async function (doc) {
  try {
    // Only create notifications for new scenario-based ledger entries
    if (doc._wasNew && doc.scenarioId) {
      await createLedgerCreatedNotification(doc);
    }
  } catch (error) {
    // Don't throw - ledger entry creation succeeded, notification failure shouldn't break the flow
    console.error("Error creating ledger notification:", error);
  }
});

async function createLedgerCreatedNotification(ledgerEntry) {
  // Lazy load to avoid circular dependency
  const Notification = require("../notifications/notifications.model");
  const Scenario = require("../scenario/scenario.model");

  const scenario = await Scenario.findById(ledgerEntry.scenarioId).lean();
  if (!scenario) {
    console.warn(
      `Scenario not found for ledger ${ledgerEntry._id}, skipping notification`
    );
    return;
  }

  const host = process.env.SCALE_ADMIN_HOST || "https://scale.ai";
  const ledgerLink = `${host}/class/${ledgerEntry.classroomId}/scenario/${ledgerEntry.scenarioId}`;

  // Format profit/loss for email
  const profitLoss =
    ledgerEntry.netProfit >= 0
      ? `+$${ledgerEntry.netProfit.toFixed(2)}`
      : `-$${Math.abs(ledgerEntry.netProfit).toFixed(2)}`;

  // Get clerkUserId from ledger entry (createdBy is the clerk user ID)
  const clerkUserId = ledgerEntry.createdBy || ledgerEntry.updatedBy;

  await Notification.create({
    type: "email",
    recipient: {
      id: ledgerEntry.userId,
      type: "Member",
      ref: "Member",
    },
    title: `Scenario Results: ${scenario.title}`,
    message: `Your results for "${scenario.title}" are now available. ${profitLoss} profit.`,
    templateSlug: "scenario-closed",
    templateData: {
      link: ledgerLink,
      profitLoss,
      env: {
        SCALE_ADMIN_HOST: host,
        SCALE_API_HOST: process.env.SCALE_API_HOST || host,
      },
    },
    modelData: {
      ledger: ledgerEntry._id,
      scenario: ledgerEntry.scenarioId,
      member: ledgerEntry.userId,
      classroom: ledgerEntry.classroomId,
    },
    organization: ledgerEntry.organization,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });
}

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
          "realizedUnitPrice",
        ],
        properties: {
          demandForecast: { type: "number" },
          demandActual: { type: "number" },
          serviceLevel: { type: "number" },
          fillRate: { type: "number" },
          stockoutUnits: { type: "number" },
          lostSalesUnits: { type: "number" },
          backorderUnits: { type: "number" },
          realizedUnitPrice: { type: "number" },
          materialFlowByBucket: {
            type: "object",
            required: [
              "refrigerated",
              "ambient",
              "notForResaleDry",
              "explanation",
            ],
            properties: {
              explanation: {
                type: "string",
                description:
                  "Explain in detail using an example based off the store description what the inventory state is and why. Explain what a unit is and how it is used in the store.",
              },
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
              "explanation",
            ],
            properties: {
              explanation: {
                type: "string",
                description:
                  "Explain in detail using an example based off the store description what the cost breakdown is and why. Explain what a unit is and how it is used in the store.",
              },
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
 * Get classroom-level base prompts (system/user) that do NOT depend on scenario/submission/store data.
 * These are stored on the Classroom document and prepended to OpenAI messages.
 *
 * Falls back to developer defaults if the classroom has no prompts (older classrooms).
 */
ledgerEntrySchema.statics.getClassroomBasePrompts = async function (
  classroomId
) {
  const Classroom = require("../classroom/classroom.model");
  const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");

  if (!classroomId) {
    return ClassroomTemplate.getDefaultClassroomPrompts();
  }

  const classDoc = await Classroom.findById(classroomId).select("prompts");
  const prompts = classDoc?.prompts;

  let finalPrompts = [];
  if (Array.isArray(prompts) && prompts.length > 0) {
    finalPrompts = prompts;
  } else {
    finalPrompts = ClassroomTemplate.getDefaultClassroomPrompts();
  }

  const classroomData = await Classroom.findById(classroomId)
    .select("name description")
    .lean();
  return [
    ...finalPrompts,
    {
      role: "user",
      content: `CLASSROOM DATA:\n${JSON.stringify(classroomData, null, 2)}`,
    },
  ];
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
  basePrompts,
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
    ...(Array.isArray(basePrompts) ? basePrompts : []),
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

  messages.push({
    role: "user",
    content: `CURRENT INVENTORY STATE:\n${JSON.stringify(
      inventoryState,
      null,
      2
    )}`,
  });

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
  if (typeof response.education.realizedUnitPrice !== "number") {
    throw new Error("education.realizedUnitPrice must be a number");
  }
  // Validate that revenue matches sales × price (within reasonable tolerance)
  const expectedRevenue = response.sales * response.education.realizedUnitPrice;
  if (Math.abs(response.revenue - expectedRevenue) > 0.5) {
    throw new Error(
      `Revenue mismatch: revenue (${response.revenue}) should equal sales (${response.sales}) × realizedUnitPrice (${response.education.realizedUnitPrice}) = ${expectedRevenue}`
    );
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

  const classroomId =
    scenario?.classroomId ||
    submission?.classroomId ||
    scenarioOutcome?.classroomId ||
    null;

  const basePrompts = await this.getClassroomBasePrompts(classroomId);

  // Build OpenAI prompt
  const messages = this.buildAISimulationPrompt(
    basePrompts,
    store,
    scenario,
    scenarioOutcome,
    submission,
    ledgerHistory,
    inventoryState
  );

  const aiResponseSchema = this.getAISimulationResponseJsonSchema();

  // Call OpenAI with JSON schema
  // Note: Some models (like o1) only support default temperature (1), so we omit it
  // JSON schema mode with strict schema should provide deterministic enough results
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
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

  // Normalize response: Move teachingNotes from root to education if needed
  // This handles cases where the AI places teachingNotes at the root level instead of inside education
  if (aiResult.teachingNotes && typeof aiResult.teachingNotes === "string") {
    if (!aiResult.education) {
      aiResult.education = {};
    }
    // Always move teachingNotes from root to education if it exists at root
    // If education.teachingNotes already exists, prefer the root level one (it's more likely to be correct)
    aiResult.education.teachingNotes = aiResult.teachingNotes;
    delete aiResult.teachingNotes;
  }

  // Normalize inventoryState: Derive from materialFlowByBucket.endUnits if inventoryState doesn't match
  // This ensures inventoryState always reflects the actual ending inventory from material flow calculations
  if (aiResult.education?.materialFlowByBucket) {
    const mfb = aiResult.education.materialFlowByBucket;
    const derivedInventoryState = {
      refrigeratedUnits: mfb.refrigerated?.endUnits ?? 0,
      ambientUnits: mfb.ambient?.endUnits ?? 0,
      notForResaleUnits: mfb.notForResaleDry?.endUnits ?? 0,
    };

    // If inventoryState exists but doesn't match derived state, update it
    if (aiResult.inventoryState) {
      const currentState = aiResult.inventoryState;
      if (
        currentState.refrigeratedUnits !==
          derivedInventoryState.refrigeratedUnits ||
        currentState.ambientUnits !== derivedInventoryState.ambientUnits ||
        currentState.notForResaleUnits !==
          derivedInventoryState.notForResaleUnits
      ) {
        console.warn(
          `inventoryState mismatch detected. Updating from ${JSON.stringify(currentState)} to ${JSON.stringify(derivedInventoryState)}`
        );
        aiResult.inventoryState = derivedInventoryState;
      }
    } else {
      // If inventoryState is missing, set it from materialFlowByBucket
      aiResult.inventoryState = derivedInventoryState;
    }
  }

  // Correct cash continuity: ensure cashAfter = cashBefore + netProfit
  // The AI sometimes returns inconsistent values, so we fix them here
  // We recalculate netProfit from cashAfter - cashBefore since cashAfter
  // is the result of all calculations and is more likely to be correct
  const expectedNetProfit = aiResult.cashAfter - aiResult.cashBefore;
  if (Math.abs(aiResult.netProfit - expectedNetProfit) > 0.01) {
    console.warn(
      `Cash continuity correction: netProfit (${aiResult.netProfit}) doesn't match cashAfter (${aiResult.cashAfter}) - cashBefore (${aiResult.cashBefore}) = ${expectedNetProfit}. Correcting netProfit...`
    );
    aiResult.netProfit = expectedNetProfit;
  }

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
  // Correct cash continuity: ensure cashAfter = cashBefore + netProfit
  // Auto-correct netProfit from cashAfter - cashBefore to maintain consistency
  const expectedNetProfit = input.cashAfter - input.cashBefore;
  if (Math.abs(input.netProfit - expectedNetProfit) > 0.01) {
    console.warn(
      `Cash continuity correction in createLedgerEntry: netProfit (${input.netProfit}) doesn't match cashAfter (${input.cashAfter}) - cashBefore (${input.cashBefore}) = ${expectedNetProfit}. Correcting netProfit...`
    );
    input.netProfit = expectedNetProfit;
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
    storeId: input.storeId || null,
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

  // Correct cash continuity after override: ensure cashAfter = cashBefore + netProfit
  // Auto-correct netProfit from cashAfter - cashBefore to maintain consistency
  const expectedNetProfit = entry.cashAfter - entry.cashBefore;
  if (Math.abs(entry.netProfit - expectedNetProfit) > 0.01) {
    console.warn(
      `Cash continuity correction in overrideLedgerEntry: netProfit (${entry.netProfit}) doesn't match cashAfter (${entry.cashAfter}) - cashBefore (${entry.cashBefore}) = ${expectedNetProfit}. Correcting netProfit...`
    );
    entry.netProfit = expectedNetProfit;
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

ledgerEntrySchema.statics.getLedgerEntriesByStore = async function (storeId) {
  return await this.find({ storeId })
    .populate("userId", "_id firstName lastName")
    .sort({ createdDate: 1 });
};

const LedgerEntry = mongoose.model("LedgerEntry", ledgerEntrySchema);

module.exports = LedgerEntry;

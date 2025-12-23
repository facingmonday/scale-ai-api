const openai = require("./openai");
const { v4: uuidv4 } = require("uuid");
const AI_MODEL = process.env.AI_MODEL || "gpt-4o";
/**
 * AI Simulation Service
 * Handles OpenAI API calls for scenario simulations
 */
class AISimulationService {
  /**
   * Run AI simulation for a student
   * @param {Object} context - Simulation context
   * @param {Object} context.store - Store configuration
   * @param {Object} context.scenario - Scenario data
   * @param {Object} context.scenarioOutcome - Global scenario outcome
   * @param {Object} context.submission - Student submission
   * @param {Array} context.ledgerHistory - Prior ledger entries
   * @returns {Promise<Object>} AI response matching ledger entry schema
   */
  static async runSimulation(context) {
    console.log(
      `Running AI simulation for scenario ${context.scenario._id} for submission ${context.submission._id}`
    );
    const { store, scenario, scenarioOutcome, submission, ledgerHistory } =
      context;

    // Build OpenAI prompt
    const messages = this.buildPrompt(
      store,
      scenario,
      scenarioOutcome,
      submission,
      ledgerHistory
    );

    // Call OpenAI with JSON schema
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      temperature: 0,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scenario_ledger_entry",
          schema: {
            type: "object",
            required: [
              "sales",
              "revenue",
              "costs",
              "waste",
              "cashBefore",
              "cashAfter",
              "inventoryBefore",
              "inventoryAfter",
              "netProfit",
              "randomEvent",
              "summary",
            ],
            properties: {
              sales: { type: "number" },
              revenue: { type: "number" },
              costs: { type: "number" },
              waste: { type: "number" },
              cashBefore: { type: "number" },
              cashAfter: { type: "number" },
              inventoryBefore: { type: "number" },
              inventoryAfter: { type: "number" },
              netProfit: { type: "number" },
              randomEvent: { type: ["string", "null"] },
              summary: { type: "string" },
            },
          },
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
    this.validateAIResponse(aiResult);

    // Add metadata
    aiResult.aiMetadata = {
      model: AI_MODEL,
      runId: uuidv4(),
      generatedAt: new Date(),
      prompt: messages,
      aiResult: aiResult,
    };

    return aiResult;
  }

  /**
   * Build OpenAI prompt messages
   * @param {Object} store - Store configuration
   * @param {Object} scenario - Scenario data
   * @param {Object} scenarioOutcome - Global scenario outcome
   * @param {Object} submission - Student submission
   * @param {Array} ledgerHistory - Prior ledger entries
   * @returns {Array} Array of message objects
   */
  static buildPrompt(
    store,
    scenario,
    scenarioOutcome,
    submission,
    ledgerHistory
  ) {
    const messages = [
      {
        role: "system",
        content:
          "You are the SCALE.ai simulation engine for a supply chain class using a pizza shop game. Calculate outcomes for one student based on store configuration, scenario context, global outcome, and the student's decisions. Apply realistic business logic, environmental effects, and optional random events. Return ONLY valid JSON matching the provided schema. You may invent reasonable intermediate numbers when needed.",
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
            randomEventsEnabled: scenarioOutcome.randomEventsEnabled || false,
            notes: scenarioOutcome.notes || "",
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

    // Add ledger history if available
    if (ledgerHistory && ledgerHistory.length > 0) {
      const historyData = ledgerHistory.map((entry) => ({
        scenarioId: entry.scenarioId?._id || entry.scenarioId || null,
        scenarioTitle: entry.scenarioId?.title || "Initial Setup",
        netProfit: entry.netProfit,
        cashAfter: entry.cashAfter,
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
  }

  /**
   * Validate AI response structure
   * @param {Object} response - AI response
   * @throws {Error} If response is invalid
   */
  static validateAIResponse(response) {
    const requiredFields = [
      "sales",
      "revenue",
      "costs",
      "waste",
      "cashBefore",
      "cashAfter",
      "inventoryBefore",
      "inventoryAfter",
      "netProfit",
      "randomEvent",
      "summary",
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
    if (typeof response.inventoryBefore !== "number") {
      throw new Error("inventoryBefore must be a number");
    }
    if (typeof response.inventoryAfter !== "number") {
      throw new Error("inventoryAfter must be a number");
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

    // Validate cash continuity
    const expectedCashAfter = response.cashBefore + response.netProfit;
    if (Math.abs(response.cashAfter - expectedCashAfter) > 0.01) {
      throw new Error(
        `Cash continuity error: cashAfter (${response.cashAfter}) must equal cashBefore (${response.cashBefore}) + netProfit (${response.netProfit})`
      );
    }
  }
}

module.exports = AISimulationService;

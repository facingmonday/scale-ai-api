const Submission = require("./submission.model");
const Scenario = require("../scenario/scenario.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const Store = require("../store/store.model");

/**
 * Create submissions for missing students using variable definition defaults.
 * For each student missing a submission, creates a new submission with default
 * values from the submission variable definitions.
 *
 * @param {Object} params
 * @param {string} params.scenarioId - Scenario ID
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Result object with created/existing/errors counts
 */
async function useDefaultsForSubmissions({
  scenarioId,
  organizationId,
  clerkUserId,
}) {
  const scenario = await Scenario.findOne({
    _id: scenarioId,
    organization: organizationId,
  });
  if (!scenario) {
    throw new Error("Scenario not found");
  }

  if (!scenario.isPublished || scenario.isClosed) {
    return {
      skipped: true,
      reason: "Scenario not published or already closed",
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  const classroomId = scenario.classroomId;

  // Get missing submissions for this scenario
  const missingUserIds = await Submission.getMissingSubmissions(
    classroomId,
    scenarioId
  );

  if (missingUserIds.length === 0) {
    return {
      skipped: false,
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  // We'll use VariableDefinition.applyDefaults to get all default values
  // This ensures all variables with defaults are included

  // Verify all missing users have stores (required for submission creation)
  const stores = await Store.find({
    classroomId,
    userId: { $in: missingUserIds },
  })
    .select("userId")
    .lean();

  const storeByUserId = new Map(stores.map((s) => [s.userId.toString(), s]));

  let created = 0;
  let existing = 0;
  let missingStore = 0;
  const errors = [];

  // Process each missing student
  for (const userId of missingUserIds) {
    try {
      // Check if submission already exists (race condition protection)
      const existingSubmission = await Submission.findOne({
        classroomId,
        scenarioId,
        userId,
      });

      if (existingSubmission) {
        existing += 1;
        continue;
      }

      // Verify user has a store
      const userIdStr = userId.toString();
      if (!storeByUserId.has(userIdStr)) {
        missingStore += 1;
        errors.push({
          userId: userIdStr,
          error: "No store found for user",
        });
        continue;
      }

      // Apply defaults to get all default values for submission variables
      // Pass empty object - applyDefaults will fill in all defaults from definitions
      const varsWithDefaults = await VariableDefinition.applyDefaults(
        classroomId,
        "submission",
        {}
      );

      // Validate the default values
      const validation = await VariableDefinition.validateValues(
        classroomId,
        "submission",
        varsWithDefaults
      );

      if (!validation.isValid) {
        errors.push({
          userId: userIdStr,
          error: `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
        });
        continue;
      }

      // Create the submission with default values
      await Submission.createSubmission(
        classroomId,
        scenarioId,
        userId,
        varsWithDefaults,
        organizationId,
        clerkUserId,
        {
          generation: {
            method: "DEFAULTS",
            meta: {
              note: "Auto-created on scenario outcome (USE_DEFAULTS)",
            },
          },
        }
      );

      created += 1;
    } catch (error) {
      console.error("Error creating submission with defaults:", error);
      // Check if it's a duplicate error (race condition)
      if (error.message && error.message.includes("already exists")) {
        existing += 1;
      } else {
        errors.push({
          userId: userId.toString(),
          error: error.message || String(error),
        });
      }
    }
  }

  return {
    skipped: false,
    created,
    existing,
    missingStore,
    errors,
  };
}

module.exports = { useDefaultsForSubmissions };

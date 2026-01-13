const Submission = require("./submission.model");
const Scenario = require("../scenario/scenario.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const {
  generateSubmissionVariablesForStoreType,
} = require("./autoSubmissionGenerator");
const Store = require("../store/store.model");
const StoreType = require("../storeType/storeType.model");

/**
 * Forward previous submissions for missing students in a scenario.
 * For each student missing a submission, finds their most recent previous submission
 * and copies those variable values to create a new submission for the current scenario.
 *
 * @param {Object} params
 * @param {string} params.scenarioId - Scenario ID
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.clerkUserId - Clerk user ID for createdBy/updatedBy
 * @param {string} [params.punishAbsentStudents] - Optional: "high", "medium", "low" to punish absent students
 * @returns {Promise<Object>} Result object with created/existing/errors counts
 */
async function forwardPreviousSubmissionsForScenario({
  scenarioId,
  organizationId,
  clerkUserId,
  punishAbsentStudents,
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
      missingPrevious: 0,
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
      missingPrevious: 0,
      errors: [],
    };
  }

  // Get all scenarios for this classroom, sorted by week (ascending)
  const allScenarios = await Scenario.find({ classroomId })
    .sort({ week: 1 })
    .lean();

  // Find the current scenario's index
  const currentScenarioIndex = allScenarios.findIndex(
    (s) => s._id.toString() === scenarioId.toString()
  );

  if (currentScenarioIndex === -1) {
    throw new Error("Current scenario not found in classroom scenarios");
  }

  // Get all previous scenarios (before current one)
  const previousScenarios = allScenarios.slice(0, currentScenarioIndex);

  let created = 0;
  let existing = 0;
  let missingPrevious = 0;
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

      // Find the most recent previous submission for this student
      let previousSubmission = null;

      // Search backwards through previous scenarios to find the most recent submission
      for (let i = previousScenarios.length - 1; i >= 0; i--) {
        const prevScenario = previousScenarios[i];
        const submission = await Submission.getSubmission(
          classroomId,
          prevScenario._id,
          userId
        );

        if (submission && submission.variables) {
          previousSubmission = submission;
          break;
        }
      }

      if (!previousSubmission || !previousSubmission.variables) {
        // Fallback to AI generation if no previous submission exists
        // Check if punishment is enabled via parameter
        let absentPunishmentLevel = null;

        // Normalize punishment level (case-insensitive)
        if (punishAbsentStudents) {
          const normalized =
            typeof punishAbsentStudents === "string"
              ? punishAbsentStudents.toLowerCase()
              : String(punishAbsentStudents).toLowerCase();
          // Only set punishment level if it's not "none"
          if (
            normalized !== "none" &&
            normalized !== null &&
            normalized !== undefined
          ) {
            absentPunishmentLevel = normalized;
          }
        }

        try {
          // Get student's store to determine storeType
          const store = await Store.findOne({
            classroomId,
            userId,
          })
            .select("storeType")
            .lean();

          if (!store) {
            missingPrevious += 1;
            errors.push({
              userId: userId.toString(),
              error:
                "No previous submission found and no store found for AI fallback",
            });
            continue;
          }

          const storeTypeDoc = await StoreType.findOne({
            _id: store.storeType,
            organization: organizationId,
            isActive: true,
          });
          if (!storeTypeDoc) {
            missingPrevious += 1;
            errors.push({
              userId: userId.toString(),
              error:
                "No previous submission found and no storeType found for AI fallback",
            });
            continue;
          }
          await storeTypeDoc._loadVariables();

          // Get hydrated scenario
          const hydratedScenario = await Scenario.getScenarioById(
            scenarioId,
            organizationId
          );

          // Generate AI submission with absence punishment if configured
          const aiVars = await generateSubmissionVariablesForStoreType({
            classroomId,
            storeTypeKey: storeTypeDoc.key,
            storeTypeVariables: storeTypeDoc.variables || {},
            scenario: hydratedScenario,
            organizationId,
            clerkUserId,
            model: process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
            absentPunishmentLevel, // Pass absence punishment level to AI
          });

          // Create submission with AI-generated variables
          await Submission.createSubmission(
            classroomId,
            scenarioId,
            userId,
            aiVars,
            organizationId,
            clerkUserId,
            {
              generation: {
                method: "AI_FALLBACK",
                meta: {
                  model: process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
                  absentPunishmentLevel,
                  reason: "NO_PREVIOUS_SUBMISSION",
                  note: "Forward-previous mode fell back to AI",
                },
              },
            }
          );

          created += 1;
          console.log(
            `Used AI fallback for user ${userId} (no previous submission)${
              absentPunishmentLevel
                ? ` with ${absentPunishmentLevel} absence punishment`
                : ""
            }`
          );
        } catch (fallbackError) {
          missingPrevious += 1;
          errors.push({
            userId: userId.toString(),
            error: `No previous submission found and AI fallback failed: ${
              fallbackError.message || String(fallbackError)
            }`,
          });
        }
        continue;
      }

      // Get variable definitions for validation
      const definitions = await VariableDefinition.getDefinitionsForScope(
        classroomId,
        "submission"
      );

      // Extract variables from previous submission
      // Variables come as an array from the plugin, convert to object
      const previousVars = previousSubmission.variables;
      const varsObject = {};

      if (Array.isArray(previousVars)) {
        for (const varDef of previousVars) {
          if (varDef.key && varDef.value !== undefined) {
            varsObject[varDef.key] = varDef.value;
          }
        }
      } else if (typeof previousVars === "object" && previousVars !== null) {
        // Fallback: if it's already an object
        Object.assign(varsObject, previousVars);
      }

      // Apply defaults for any missing variables (in case new variables were added)
      const varsWithDefaults = await VariableDefinition.applyDefaults(
        classroomId,
        "submission",
        varsObject
      );

      // Validate the variables
      const validation = await VariableDefinition.validateValues(
        classroomId,
        "submission",
        varsWithDefaults
      );

      if (!validation.isValid) {
        errors.push({
          userId: userId.toString(),
          error: `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
        });
        continue;
      }

      // Create the submission with forwarded variables
      await Submission.createSubmission(
        classroomId,
        scenarioId,
        userId,
        varsWithDefaults,
        organizationId,
        clerkUserId,
        {
          generation: {
            method: "FORWARDED_PREVIOUS",
            forwardedFromScenarioId: previousSubmission.scenarioId || null,
            forwardedFromSubmissionId: previousSubmission._id || null,
            meta: {
              note: "Auto-created on scenario outcome (FORWARD_PREVIOUS)",
            },
          },
        }
      );

      created += 1;
    } catch (error) {
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
    missingPrevious,
    errors,
  };
}

module.exports = { forwardPreviousSubmissionsForScenario };

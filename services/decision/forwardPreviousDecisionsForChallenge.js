const Decision = require("./decision.model");
const Challenge = require("../challenge/challenge.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const {
  generateSubmissionVariablesForStoreType,
} = require("./autoDecisionGenerator");
const Profile = require("../profile/profile.model");
const ProfileType = require("../profileType/profileType.model");

/**
 * Forward previous decisions for missing students in a challenge.
 * For each student missing a decision, finds their most recent previous decision
 * and copies those variable values to create a new decision for the current challenge.
 *
 * @param {Object} params
 * @param {string} params.challengeId - Challenge ID
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.clerkUserId - Clerk user ID for createdBy/updatedBy
 * @param {string} [params.punishAbsentStudents] - Optional: "high", "medium", "low" to punish absent students
 * @returns {Promise<Object>} Result object with created/existing/errors counts
 */
async function forwardPreviousDecisionsForChallenge({
  challengeId,
  organizationId,
  clerkUserId,
  punishAbsentStudents,
}) {
  const challenge = await Challenge.findOne({
    _id: challengeId,
    organization: organizationId,
  });
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  if (!challenge.isPublished || challenge.isClosed) {
    return {
      skipped: true,
      reason: "Challenge not published or already closed",
      created: 0,
      existing: 0,
      missingPrevious: 0,
      errors: [],
    };
  }

  const classroomId = challenge.classroomId;

  // Get missing decisions for this challenge
  const missingUserIds = await Decision.getMissingSubmissions(
    classroomId,
    challengeId
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

  // Get all challenges for this classroom, sorted by week (ascending)
  const allScenarios = await Challenge.find({ classroomId })
    .sort({ week: 1 })
    .lean();

  // Find the current challenge's index
  const currentScenarioIndex = allScenarios.findIndex(
    (s) => s._id.toString() === challengeId.toString()
  );

  if (currentScenarioIndex === -1) {
    throw new Error("Current challenge not found in classroom challenges");
  }

  // Get all previous challenges (before current one)
  const previousScenarios = allScenarios.slice(0, currentScenarioIndex);

  let created = 0;
  let existing = 0;
  let missingPrevious = 0;
  const errors = [];

  // Process each missing student
  for (const userId of missingUserIds) {
    try {
      // Check if decision already exists (race condition protection)
      const existingSubmission = await Decision.findOne({
        classroomId,
        challengeId,
        userId,
      });

      if (existingSubmission) {
        existing += 1;
        continue;
      }

      // Find the most recent previous decision for this student
      let previousSubmission = null;

      // Search backwards through previous challenges to find the most recent decision
      for (let i = previousScenarios.length - 1; i >= 0; i--) {
        const prevScenario = previousScenarios[i];
        const decision = await Decision.getSubmission(
          classroomId,
          prevScenario._id,
          userId
        );

        if (decision && decision.variables) {
          previousSubmission = decision;
          break;
        }
      }

      if (!previousSubmission || !previousSubmission.variables) {
        // Fallback to AI generation if no previous decision exists
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
          // Get student's profile to determine profileType
          const profile = await Profile.findOne({
            classroomId,
            userId,
          })
            .select("profileType")
            .lean();

          if (!profile) {
            missingPrevious += 1;
            errors.push({
              userId: userId.toString(),
              error:
                "No previous decision found and no profile found for AI fallback",
            });
            continue;
          }

          const storeTypeDoc = await ProfileType.findOne({
            _id: profile.profileType,
            organization: organizationId,
            isActive: true,
          });
          if (!storeTypeDoc) {
            missingPrevious += 1;
            errors.push({
              userId: userId.toString(),
              error:
                "No previous decision found and no profileType found for AI fallback",
            });
            continue;
          }
          await storeTypeDoc._loadVariables();

          // Get hydrated challenge
          const hydratedScenario = await Challenge.getScenarioById(
            challengeId,
            organizationId
          );

          // Generate AI decision with absence punishment if configured
          const aiVars = await generateSubmissionVariablesForStoreType({
            classroomId,
            storeTypeKey: storeTypeDoc.key,
            storeTypeVariables: storeTypeDoc.variables || {},
            challenge: hydratedScenario,
            organizationId,
            clerkUserId,
            model: process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
            absentPunishmentLevel, // Pass absence punishment level to AI
          });

          // Create decision with AI-generated variables
          await Decision.createSubmission(
            classroomId,
            challengeId,
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
            `Used AI fallback for user ${userId} (no previous decision)${
              absentPunishmentLevel
                ? ` with ${absentPunishmentLevel} absence punishment`
                : ""
            }`
          );
        } catch (fallbackError) {
          missingPrevious += 1;
          errors.push({
            userId: userId.toString(),
            error: `No previous decision found and AI fallback failed: ${
              fallbackError.message || String(fallbackError)
            }`,
          });
        }
        continue;
      }

      // Get variable definitions for validation
      const definitions = await VariableDefinition.getDefinitionsForScope(
        classroomId,
        "decision"
      );

      // Extract variables from previous decision
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
        "decision",
        varsObject
      );

      // Validate the variables
      const validation = await VariableDefinition.validateValues(
        classroomId,
        "decision",
        varsWithDefaults
      );

      if (!validation.isValid) {
        errors.push({
          userId: userId.toString(),
          error: `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
        });
        continue;
      }

      // Create the decision with forwarded variables
      await Decision.createSubmission(
        classroomId,
        challengeId,
        userId,
        varsWithDefaults,
        organizationId,
        clerkUserId,
        {
          generation: {
            method: "FORWARDED_PREVIOUS",
            forwardedFromScenarioId: previousSubmission.challengeId || null,
            forwardedFromSubmissionId: previousSubmission._id || null,
            meta: {
              note: "Auto-created on challenge outcome (FORWARD_PREVIOUS)",
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

module.exports = { forwardPreviousDecisionsForChallenge };

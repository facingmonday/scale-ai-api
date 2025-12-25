const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");
// Note: Classroom, Enrollment, and Member are required inside functions to avoid circular dependencies
const { enqueueEmailSending } = require("../../lib/queues/email-worker");

const scenarioSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  isClosed: {
    type: Boolean,
    default: false,
  },
  week: {
    type: Number,
    default: 0,
  },
}).add(baseSchema);

// Apply variable population plugin
scenarioSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "scenario",
});

// Compound indexes for performance
scenarioSchema.index({ classroomId: 1, week: 1 });
scenarioSchema.index({ classroomId: 1, isPublished: 1, isClosed: 1 });
scenarioSchema.index({ classroomId: 1, createdDate: -1 });
scenarioSchema.index({ organization: 1, classroomId: 1 });

// Static methods - Shared utilities for scenario operations

/**
 * Get next week number for a class
 * @param {string} classroomId - Class ID
 * @returns {Promise<number>} Next week number
 */
scenarioSchema.statics.getNextWeekNumber = async function (classroomId) {
  let week = 0;
  const lastScenario = await this.findOne({ classroomId })
    .sort({ week: -1 })
    .limit(1)
    .lean();

  if (!lastScenario || !lastScenario.week) {
    week = 1;
  } else {
    week = parseInt(lastScenario.week) + 1;
  }

  return week;
};

/**
 * Validate scenario variables against VariableDefinition
 * @param {string} classroomId - Class ID
 * @param {Object} variables - Variables object to validate
 * @returns {Promise<Object>} Validation result
 */
scenarioSchema.statics.validateScenarioVariables = async function (
  classroomId,
  variables
) {
  return await VariableDefinition.validateValues(
    classroomId,
    "scenario",
    variables
  );
};

/**
 * Create a scenario
 * @param {string} classroomId - Class ID
 * @param {Object} scenarioData - Scenario data (title, description, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created scenario with variables populated
 */
scenarioSchema.statics.createScenario = async function (
  classroomId,
  scenarioData,
  organizationId,
  clerkUserId
) {
  // Get next week number
  const week = await this.getNextWeekNumber(classroomId);
  // Extract variables from scenarioData
  const { variables, ...scenarioFields } = scenarioData;

  // Validate variables if provided
  if (variables && Object.keys(variables).length > 0) {
    const validation = await this.validateScenarioVariables(
      classroomId,
      variables
    );

    if (!validation.isValid) {
      throw new Error(
        `Invalid scenario variables: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }

    // Apply defaults
    const variablesWithDefaults = await VariableDefinition.applyDefaults(
      classroomId,
      "scenario",
      variables
    );

    // Create scenario document
    const scenario = new this({
      classroomId,
      week,
      title: scenarioFields.title,
      description: scenarioFields.description || "",
      isPublished: false,
      isClosed: false,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await scenario.save();

    // Create variable values if provided
    const variableEntries = Object.entries(variablesWithDefaults);
    const variableDocs = variableEntries.map(([key, value]) => ({
      appliesTo: "scenario",
      ownerId: scenario._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await VariableValue.insertMany(variableDocs);
    }

    // Return scenario with variables populated (auto-loaded via plugin)
    const createdScenario = await this.findById(scenario._id);
    return createdScenario ? createdScenario.toObject() : null;
  }

  // No variables provided
  const scenario = new this({
    classroomId,
    week,
    title: scenarioFields.title,
    description: scenarioFields.description || "",
    isPublished: false,
    isClosed: false,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await scenario.save();
  // Variables are automatically included via plugin
  return scenario.toObject();
};

/**
 * Get active scenario (published and not closed)
 * @param {string} classroomId - Class ID
 * @returns {Promise<Object|null>} Active scenario with variables or null
 */
scenarioSchema.statics.getActiveScenario = async function (classroomId) {
  const scenario = await this.findOne({
    classroomId,
    isPublished: true,
    isClosed: false,
  }).sort({ week: -1 });

  if (!scenario) {
    return null;
  }

  await scenario._loadVariables();

  // Variables are automatically included via plugin's post-init hook
  return scenario.toObject();
};

/**
 * Get all scenarios for a class
 * @param {string} classroomId - Class ID
 * @param {Object} options - Options (includeClosed)
 * @returns {Promise<Array>} Array of scenarios with variables
 */
scenarioSchema.statics.getScenariosByClass = async function (
  classroomId,
  options = {}
) {
  const query = { classroomId };
  if (!options.includeClosed) {
    query.isClosed = false;
  }

  const scenarios = await this.find(query).sort({ week: 1 });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(scenarios);

  // Variables are automatically included via plugin
  return scenarios.map((scenario) => scenario.toObject());
};

/**
 * Get scenario by ID with class validation
 * @param {string} scenarioId - Scenario ID
 * @param {string} organizationId - Organization ID (optional, for validation)
 * @returns {Promise<Object|null>} Scenario with variables or null
 */
scenarioSchema.statics.getScenarioById = async function (
  scenarioId,
  organizationId = null
) {
  const query = { _id: scenarioId };
  if (organizationId) {
    query.organization = organizationId;
  }

  const scenario = await this.findOne(query);
  if (!scenario) {
    return null;
  }

  // Explicitly load variables to ensure they're cached (post-init hook is async and may not have completed)
  await scenario._loadVariables();

  // Variables are automatically included via plugin's toObject() override
  return scenario.toObject();
};

// Instance methods

/**
 * Get variables for this scenario instance
 * Uses cached variables if available, otherwise loads them
 * @returns {Promise<Object>} Variables object
 */
scenarioSchema.methods.getVariables = async function () {
  // Use plugin's cached variables or load them
  return await this._loadVariables();
};

/**
 * Update variables for this scenario
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} Updated variables object
 */
scenarioSchema.methods.updateVariables = async function (
  variables,
  organizationId,
  clerkUserId
) {
  // Validate variables
  const validation = await this.constructor.validateScenarioVariables(
    this.classroomId,
    variables
  );

  if (!validation.isValid) {
    throw new Error(
      `Invalid scenario variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    this.classroomId,
    "scenario",
    variables
  );

  // Update or create variable values
  const variableEntries = Object.entries(variablesWithDefaults);
  for (const [key, value] of variableEntries) {
    await VariableValue.setVariable(
      "scenario",
      this._id,
      key,
      value,
      organizationId,
      clerkUserId
    );
  }

  // Delete variables that are not in the new set
  const existingVariables = await VariableValue.find({
    appliesTo: "scenario",
    ownerId: this._id,
  });
  const newKeys = new Set(Object.keys(variablesWithDefaults));
  for (const existingVar of existingVariables) {
    if (!newKeys.has(existingVar.variableKey)) {
      await VariableValue.deleteOne({ _id: existingVar._id });
    }
  }

  // Reload variables to update cache
  await this._loadVariables();

  return variablesWithDefaults;
};

/**
 * Publish this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.publish = async function (clerkUserId) {
  // Check if there's already an active published scenario
  const activeScenario = await this.constructor.getActiveScenario(
    this.classroomId
  );
  if (activeScenario && activeScenario._id.toString() !== this._id.toString()) {
    throw new Error("Another scenario is already published and active");
  }

  this.isPublished = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Unpublish this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.unpublish = async function (clerkUserId) {
  this.isPublished = false;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Close this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.close = async function (clerkUserId) {
  this.isClosed = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Open (re-open) this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.open = async function (clerkUserId) {
  this.isClosed = false;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Check if scenario can be edited
 * @returns {boolean} True if can be edited
 */
scenarioSchema.methods.canEdit = function () {
  // Can edit if not published or not closed
  return !this.isPublished || !this.isClosed;
};

/**
 * Check if scenario can be published
 * @returns {Promise<boolean>} True if can be published
 */
scenarioSchema.methods.canPublish = async function () {
  // Can publish if not already published and not closed
  if (this.isPublished || this.isClosed) {
    return false;
  }

  // Check if another scenario is active
  const activeScenario = await this.constructor.getActiveScenario(
    this.classroomId
  );
  return (
    !activeScenario || activeScenario._id.toString() === this._id.toString()
  );
};

// Track creation state for post-save hooks
scenarioSchema.pre("save", function (next) {
  this._wasNew = this.isNew;
  next();
});

// Post-save hook to queue scenario creation emails for students
scenarioSchema.post("save", async function (doc, next) {
  try {
    if (!doc._wasNew) {
      return next();
    }

    await queueScenarioCreatedEmails(doc);
    return next();
  } catch (error) {
    console.error("Error queueing scenario created emails:", error);
    return next();
  }
});

async function queueScenarioCreatedEmails(scenario) {
  // Lazy load to avoid circular dependency
  const Classroom = require("../classroom/classroom.model");
  const Enrollment = require("../enrollment/enrollment.model");
  const Member = require("../members/member.model");

  const classroomId = scenario.classroomId;
  const organizationId = scenario.organization;

  if (!classroomId) {
    console.warn("No classroomId on scenario, skipping notification emails");
    return;
  }

  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    console.error("Classroom not found for scenario email notification");
    return;
  }

  // Get all enrolled students (members only)
  const enrollments = await Enrollment.findByClass(classroomId);
  const memberEnrollments = enrollments.filter((e) => e.role === "member");

  if (memberEnrollments.length === 0) {
    return;
  }

  const host =
    process.env.SCALE_COM_HOST ||
    process.env.SCALE_API_HOST ||
    "https://scale.ai";
  const scenarioLink = `${host}/class/${classroomId}/scenario/${scenario._id}`;

  await Promise.allSettled(
    memberEnrollments.map(async (enrollment) => {
      try {
        const member = await Member.findById(enrollment.userId);
        if (!member) {
          console.warn(`Member not found for enrollment ${enrollment._id}`);
          return;
        }

        const email = await member.getEmailFromClerk();
        if (!email) {
          console.warn(`No email found for member ${member._id}`);
          return;
        }

        await enqueueEmailSending({
          recipient: {
            email,
            name:
              `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
              email,
            memberId: member._id,
          },
          title: `New Scenario: ${scenario.title}`,
          message: `A new scenario "${scenario.title}" has been added to ${classroom.name}.`,
          templateSlug: "scenario-created",
          templateData: {
            scenario: {
              _id: scenario._id,
              title: scenario.title,
              description: scenario.description,
              link: scenarioLink,
            },
            classroom: {
              _id: classroom._id,
              name: classroom.name,
              description: classroom.description,
            },
            member: {
              _id: member._id,
              firstName: member.firstName,
              lastName: member.lastName,
              name: `${member.firstName || ""} ${member.lastName || ""}`.trim(),
              email,
              clerkUserId: member.clerkUserId,
            },
            organization: {
              _id: organizationId,
            },
            link: scenarioLink,
            env: {
              SCALE_COM_HOST: host,
              SCALE_API_HOST: process.env.SCALE_API_HOST || host,
            },
          },
          organizationId,
        });
      } catch (error) {
        console.error(
          `Error queueing email for enrollment ${enrollment._id}:`,
          error.message
        );
      }
    })
  );
}

const Scenario = mongoose.model("Scenario", scenarioSchema);

module.exports = Scenario;

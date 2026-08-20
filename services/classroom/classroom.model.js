const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const Enrollment = require("../enrollment/enrollment.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const LedgerEntry = require("../ledger/ledger.model");
const Outcome = require("../outcome/outcome.model");
const Profile = require("../profile/profile.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");
/**
 * @openapi
 * components:
 *   schemas:
 *     Classroom:
 *       type: object
 *       required:
 *         - name
 *         - ownership
 *       properties:
 *         _id:
 *           type: string
 *           description: The Mongoose ObjectId of the classroom.
 *         name:
 *           type: string
 *           description: Classroom name.
 *         description:
 *           type: string
 *           description: Classroom description.
 *         isActive:
 *           type: boolean
 *           description: Active status of the classroom.
 *         ownership:
 *           type: string
 *           description: The owner Member ObjectId.
 *         imageUrl:
 *           type: string
 *           description: Optional header image URL.
 *         billingMode:
 *           type: string
 *           enum: [student_paid, teacher_paid_roster]
 *         joinPolicy:
 *           type: string
 *           enum: [invite_link, open, roster_only, closed]
 *         studentPaysAllowed:
 *           type: boolean
 *         allowedDomains:
 *           type: array
 *           items:
 *             type: string
 *         accessCode:
 *           type: string
 *         allowAnonymousJoin:
 *           type: boolean
 *         prompts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [system, user, assistant, developer]
 *               content:
 *                 type: string
 *         automationSettings:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *             timezone:
 *               type: string
 *             defaultReleaseDay:
 *               type: string
 *             defaultReleaseTime:
 *               type: string
 *             defaultDueDay:
 *               type: string
 *             defaultDueTime:
 *               type: string
 *             defaultCloseDelayHours:
 *               type: number
 *             defaultProcessDelayHours:
 *               type: number
 *             defaultFeedbackReleaseMode:
 *               type: string
 *               enum: [IMMEDIATE, DELAYED, MANUAL]
 *             missingSubmissionPolicy:
 *               type: string
 *               enum: [FORWARD_PREVIOUS, USE_DEFAULTS, SKIP]
 */
const classroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  ownership: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    index: true,
  },
  imageUrl: {
    type: String,
    required: false,
  },
  billingMode: {
    type: String,
    enum: [
      "student_paid",
      "teacher_paid_roster",
    ],
    default: "student_paid",
    index: true,
  },
  joinPolicy: {
    type: String,
    enum: ["invite_link", "open", "roster_only", "closed"],
    default: "invite_link",
    index: true,
  },
  studentPaysAllowed: {
    type: Boolean,
    default: true,
  },
  allowedDomains: {
    type: [String],
    default: [],
  },
  accessCode: {
    type: String,
    default: "",
  },
  allowAnonymousJoin: {
    type: Boolean,
    default: true,
  },
  // AI prompt building blocks that do NOT depend on challenge/decision/profile data.
  // These are prepended to OpenAI messages for simulations.
  // Example:
  // [{ role: "system", content: "..." }, { role: "user", content: "..." }]
  prompts: {
    type: [
      {
        role: {
          type: String,
          required: true,
          enum: ["system", "user", "assistant", "developer"],
        },
        content: {
          type: String,
          required: true,
        },
      },
    ],
    default: [],
  },
  automationSettings: {
    enabled: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      default: "America/Chicago",
    },
    defaultReleaseDay: {
      type: String,
      default: "Monday",
    },
    defaultReleaseTime: {
      type: String,
      default: "08:00",
    },
    defaultDueDay: {
      type: String,
      default: "Friday",
    },
    defaultDueTime: {
      type: String,
      default: "23:59",
    },
    defaultCloseDelayHours: {
      type: Number,
      default: 0,
    },
    defaultProcessDelayHours: {
      type: Number,
      default: 0,
    },
    defaultFeedbackReleaseMode: {
      type: String,
      enum: ["IMMEDIATE", "DELAYED", "MANUAL"],
      default: "IMMEDIATE",
    },
    missingSubmissionPolicy: {
      type: String,
      enum: ["FORWARD_PREVIOUS", "USE_DEFAULTS", "SKIP"],
      default: "USE_DEFAULTS",
    },
  },
}).add(baseSchema);

// Indexes for performance
classroomSchema.index({ organization: 1, name: 1 });
classroomSchema.index({ organization: 1, isActive: 1 });
classroomSchema.index({ organization: 1, createdDate: -1 });

// Virtual for enrollment count
classroomSchema.virtual("enrollmentCount", {
  ref: "Enrollment",
  localField: "_id",
  foreignField: "classroomId",
  count: true,
});

// Static methods
classroomSchema.statics.findByOrganization = function (orgId) {
  return this.find({ organization: orgId });
};

classroomSchema.statics.findActiveByOrganization = function (orgId) {
  return this.find({ organization: orgId, isActive: true });
};

/**
 * Get dashboard data for a class
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID for scoping
 * @returns {Promise<Object>} Dashboard data
 */
classroomSchema.statics.getDashboard = async function (
  classroomId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });

  if (!classDoc) {
    throw new Error("Class not found");
  }

  // Count students (members with role 'member')
  const studentCount = await Enrollment.countByClass(classroomId);

  // Get active challenge
  const activeScenario = await Challenge.getActiveScenario(classroomId);
  const activeScenarioData = activeScenario
    ? {
        id: activeScenario._id,
        title: activeScenario.title,
        description: activeScenario.description,
        variables: activeScenario.variables,
        isPublished: activeScenario.isPublished,
        isClosed: activeScenario.isClosed,
        isLockedForStudents: activeScenario.isLockedForStudents,
        lifecycleStatus: Challenge.getLifecycleStatus(activeScenario),
      }
    : null;

  // Count completed decisions for active challenge
  let submissionsCompleted = 0;
  if (activeScenario) {
    const decisions = await Decision.getSubmissionsByScenario(
      activeScenario._id
    );
    submissionsCompleted = decisions.length;
  }

  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  const [leaderboardDef, metricDefinitionCount] = await Promise.all([
    MetricDefinition.findOne({
      classroomId,
      organization: organizationId,
      isActive: true,
      dataType: "number",
      "displayIn.leaderboard": true,
    }).sort({ sortOrder: 1, label: 1 }),
    MetricDefinition.countDocuments({
      classroomId,
      organization: organizationId,
    }),
  ]);

  let leaderboardTop10 = [];
  let leaderboardMetric = null;

  if (leaderboardDef) {
    const metricPath = `$metrics.${leaderboardDef.key}`;
    leaderboardMetric = {
      key: leaderboardDef.key,
      label: leaderboardDef.label,
      format: leaderboardDef.format,
    };

    leaderboardTop10 = await LedgerEntry.aggregate([
      {
        $match: {
          classroomId: new mongoose.Types.ObjectId(classroomId),
          challengeId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$userId",
          metricTotal: { $sum: { $ifNull: [metricPath, 0] } },
          classroomId: { $first: "$classroomId" },
        },
      },
      { $sort: { metricTotal: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "profiles",
          let: {
            userIdField: "$_id",
            classroomIdField: "$classroomId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$userIdField"] },
                    { $eq: ["$classroomId", "$$classroomIdField"] },
                  ],
                },
              },
            },
            {
              $project: {
                shopName: 1,
                studentId: 1,
                _id: 1,
              },
            },
          ],
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: false } },
      {
        $project: {
          userId: "$_id",
          metricTotal: 1,
          profileName: "$profile.shopName",
          profileId: "$profile._id",
          studentId: "$profile.studentId",
        },
      },
    ]);
  }

  // Get pending approvals (published challenges with outcomes that are not approved)
  const publishedScenarios = await Challenge.find({
    classroomId,
    isPublished: true,
    isClosed: false,
  }).select("_id");

  let pendingApprovals = 0;
  if (publishedScenarios.length > 0) {
    const scenarioIds = publishedScenarios.map((s) => s._id);
    const pendingOutcomes = await Outcome.countDocuments({
      challengeId: { $in: scenarioIds },
      approved: false,
    });
    pendingApprovals = pendingOutcomes;
  }

  return {
    className: classDoc.name,
    classDescription: classDoc.description,
    isActive: classDoc.isActive,
    students: studentCount,
    activeScenario: activeScenarioData,
    submissionsCompleted: submissionsCompleted,
    leaderboardTop10: leaderboardTop10,
    leaderboardMetric: leaderboardMetric,
    metricDefinitionCount,
    pendingApprovals: pendingApprovals,
  };
};

classroomSchema.statics.getStudentDashboard = async function (
  classroomId,
  organizationId,
  memberId
) {
  const classDoc = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });
  if (!classDoc) {
    throw new Error("Class not found");
  }

  const activeScenario = await Challenge.getActiveScenario(classroomId);
  const visibleScenario = Challenge.isVisibleToStudents(activeScenario)
    ? activeScenario
    : null;
  const activeScenarioData = visibleScenario
    ? {
        id: visibleScenario._id,
        title: visibleScenario.title,
        description: visibleScenario.description,
        variables: visibleScenario.variables,
        isPublished: visibleScenario.isPublished,
        isClosed: visibleScenario.isClosed,
        isLockedForStudents: visibleScenario.isLockedForStudents,
        lifecycleStatus: Challenge.getLifecycleStatus(visibleScenario),
        week: visibleScenario.week,
        publishAt: visibleScenario.publishAt,
        submissionDeadlineAt: visibleScenario.submissionDeadlineAt,
        automationStatus: visibleScenario.automationStatus,
      }
    : null;

  // Get the submission for the student for the active challenge
  const decision = visibleScenario
    ? await Decision.getSubmission(
        classroomId,
        visibleScenario._id,
        memberId
      )
    : null;

  const submissionData = decision
    ? {
        ...decision,
        id: decision._id,
        variables: decision.variables,
      }
    : null;

  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  const [
    profile,
    metricDefinitions,
    releasedChallenges,
    completedChallengeCount,
  ] = await Promise.all([
    Profile.findOne({
      classroomId,
      userId: memberId,
      organization: organizationId,
    })
      .populate("profileType", "key label")
      .lean(),
    MetricDefinition.find({
      classroomId,
      organization: organizationId,
      isActive: true,
    })
      .sort({ sortOrder: 1, label: 1 })
      .lean(),
    Challenge.find({
      classroomId,
      organization: organizationId,
      isPublished: true,
      isClosed: true,
      $or: [
        { isFeedbackReleased: true },
        { feedbackReleaseMode: "IMMEDIATE" },
      ],
    })
      .sort({ week: -1, createdDate: -1 })
      .lean(),
    Challenge.countDocuments({
      classroomId,
      organization: organizationId,
      isPublished: true,
      isClosed: true,
    }),
  ]);

  const challengeIds = releasedChallenges.map((challenge) => challenge._id);
  const [studentEntries, outcomes] = challengeIds.length
    ? await Promise.all([
        LedgerEntry.find({
          classroomId,
          organization: organizationId,
          userId: memberId,
          challengeId: { $in: challengeIds },
        }).lean(),
        Outcome.find({
          organization: organizationId,
          challengeId: { $in: challengeIds },
        })
          .select("challengeId notes")
          .lean(),
      ])
    : [[], []];

  const metricsToObject = (metrics) => {
    if (!metrics) return {};
    if (metrics instanceof Map) return Object.fromEntries(metrics);
    return { ...metrics };
  };

  const entriesByChallenge = new Map(
    studentEntries.map((entry) => [entry.challengeId.toString(), entry])
  );
  const outcomesByChallenge = new Map(
    outcomes.map((outcome) => [outcome.challengeId.toString(), outcome])
  );

  const recentResults = releasedChallenges
    .map((challenge) => {
      const challengeId = challenge._id.toString();
      const entry = entriesByChallenge.get(challengeId);
      if (!entry) return null;

      return {
        challengeId,
        title: challenge.title,
        week: challenge.week,
        completedAt: entry.createdDate,
        metrics: metricsToObject(entry.metrics),
        summary: entry.summary,
        randomEvent: entry.randomEvent,
        outcomeNotes: outcomesByChallenge.get(challengeId)?.notes || "",
      };
    })
    .filter(Boolean);

  let classStatistics = null;
  const latestResult = recentResults[0] || null;
  if (latestResult) {
    const classEntries = await LedgerEntry.find({
      classroomId,
      organization: organizationId,
      challengeId: latestResult.challengeId,
    })
      .select("userId metrics")
      .lean();

    const numericDefinitions = metricDefinitions.filter(
      (definition) => definition.dataType === "number"
    );
    const averages = {};
    numericDefinitions.forEach((definition) => {
      const total = classEntries.reduce((sum, entry) => {
        const value = Number(metricsToObject(entry.metrics)[definition.key]);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      averages[definition.key] =
        classEntries.length > 0 ? total / classEntries.length : 0;
    });

    const leaderboardDefinition =
      numericDefinitions.find(
        (definition) => definition.displayIn?.leaderboard
      ) || numericDefinitions[0] || null;
    let rank = null;

    if (leaderboardDefinition) {
      const rankedEntries = [...classEntries].sort((a, b) => {
        const aValue = Number(
          metricsToObject(a.metrics)[leaderboardDefinition.key]
        );
        const bValue = Number(
          metricsToObject(b.metrics)[leaderboardDefinition.key]
        );
        return (Number.isFinite(bValue) ? bValue : 0) -
          (Number.isFinite(aValue) ? aValue : 0);
      });
      const rankIndex = rankedEntries.findIndex(
        (entry) => entry.userId.toString() === memberId.toString()
      );
      rank = rankIndex >= 0 ? rankIndex + 1 : null;
    }

    classStatistics = {
      challengeId: latestResult.challengeId,
      title: latestResult.title,
      participantCount: classEntries.length,
      rank,
      averages,
      studentMetrics: latestResult.metrics,
      leaderboardMetric: leaderboardDefinition
        ? {
            key: leaderboardDefinition.key,
            label: leaderboardDefinition.label,
            format: leaderboardDefinition.format,
          }
        : null,
    };
  }

  return {
    className: classDoc.name,
    classDescription: classDoc.description,
    isActive: classDoc.isActive,
    activeScenario: activeScenarioData,
    decision: submissionData,
    submissionStatus: decision
      ? { submitted: true, submittedAt: decision.submittedAt }
      : visibleScenario
        ? { submitted: false, submittedAt: null }
        : null,
    profile,
    metricDefinitions,
    latestResult,
    recentResults,
    completedChallengeCount,
    classStatistics,
  };
};

/**
 * Get roster for a class
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID for scoping
 * @returns {Promise<Array>} Roster data with student info
 * @deprecated Use Enrollment.getClassRoster() instead
 */
classroomSchema.statics.getRoster = async function (
  classroomId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });

  if (!classDoc) {
    throw new Error("Class not found");
  }

  // Delegate to Enrollment model
  return await Enrollment.getClassRoster(classroomId);
};

/**
 * Validate admin access to a class
 * @param {string} classroomId - Class ID
 * @param {string} clerkUserId - Clerk user ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Class document if admin, throws error otherwise
 */
classroomSchema.statics.validateAdminAccess = async function (
  classroomId,
  clerkUserId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });

  if (!classDoc) {
    throw new Error("Class not found");
  }

  // Resolve Clerk user -> Member (needed for ownership/enrollment/org-role checks)
  const Member = require("../members/member.model");
  const member = await Member.findOne({ clerkUserId })
    .select("_id organizationMemberships")
    .lean();

  const isOwner =
    !!member &&
    !!classDoc.ownership &&
    classDoc.ownership.toString() === member._id.toString();

  const isEnrollmentAdmin = !!member
    ? !!(await Enrollment.findOne({
        classroomId,
        userId: member._id,
        role: "admin",
        isRemoved: false,
      })
        .select("_id")
        .lean())
    : false;

  const isOrgAdmin =
    !!member &&
    Array.isArray(member.organizationMemberships) &&
    member.organizationMemberships.some((m) => {
      if (!m || !m.organizationId) return false;
      return (
        m.organizationId.toString() === organizationId.toString() &&
        m.role === "org:admin"
      );
    });

  if (!isOwner && !isEnrollmentAdmin && !isOrgAdmin) {
    throw new Error("Insufficient permissions: Admin access required");
  }

  return classDoc;
};

/**
 * Validate student (enrolled user) access to a class
 * @param {string} classroomId - Class ID
 * @param {string} clerkUserId - Clerk user ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Class document if enrolled, throws error otherwise
 */
classroomSchema.statics.validateStudentAccess = async function (
  classroomId,
  clerkUserId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });

  if (!classDoc) {
    throw new Error("Class not found");
  }

  // Resolve Clerk user -> Member
  const Member = require("../members/member.model");
  const member = await Member.findOne({ clerkUserId }).select("_id");
  if (!member) {
    throw new Error("Member not found");
  }

  // Verify enrollment exists (member or admin role)
  const Enrollment = require("../enrollment/enrollment.model");
  const enrollment = await Enrollment.findByClassAndUser(
    classroomId,
    member._id
  );
  if (!enrollment) {
    throw new Error("Not enrolled in this class");
  }

  return classDoc;
};

/**
 * Generate join link for a class
 * @param {string} classroomId - Class ID
 * @returns {string} Join link URL
 */
classroomSchema.statics.generateJoinLink = function (classroomId) {
  const baseUrl = process.env.SCALE_APP_HOST || "http://localhost:5173";
  return `${baseUrl}/class/${classroomId}/join`;
};

/**
 * Get all variable definitions for a classroom, grouped by appliesTo type.
 * Includes classroom-scoped definitions for the new scope set:
 * profile, profileType, challenge, decision, outcome.
 */
classroomSchema.statics.getAllVariableDefinitionsForClassroom = async function (
  classroomId,
  options = {}
) {
  const classroomVariableDefinitions =
    await VariableDefinition.getDefinitionsByClass(classroomId, options);

  const variableDefinitionsByType = {
    profile: [],
    profileType: [],
    challenge: [],
    decision: [],
    outcome: [],
  };

  classroomVariableDefinitions.forEach((def) => {
    if (variableDefinitionsByType[def.appliesTo]) {
      variableDefinitionsByType[def.appliesTo].push(def);
    }
  });

  return variableDefinitionsByType;
};

/**
 * Get all metric definitions for a classroom (for activeClassroom payload).
 */
classroomSchema.statics.getAllMetricDefinitionsForClassroom = async function (
  classroomId,
  options = {}
) {
  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  return await MetricDefinition.getDefinitionsForClassroom(classroomId, options);
};

/**
 * Get the canonical decision variable definitions
 * @returns {Array} Array of decision variable definition objects
 */
classroomSchema.statics.getDefaultSubmissionVariableDefinitions = function () {
  // Backward-compat wrapper: canonical defaults live on ClassroomTemplate
  return ClassroomTemplate.getDefaultSubmissionVariableDefinitions();
};

/**
 * Canonical classroom-scoped profileType variable definitions.
 * @returns {Array} Array of profileType variable definition objects
 */
classroomSchema.statics.getDefaultStoreTypeVariableDefinitions = function () {
  // Backward-compat wrapper: canonical defaults live on ClassroomTemplate
  return ClassroomTemplate.getDefaultStoreTypeVariableDefinitions();
};

/**
 * Seed classroom-scoped profileType VariableDefinitions + ProfileTypes + VariableValues.
 *
 * - Definitions are classroom-scoped and apply only within this class.
 * - ProfileTypes are classroom-scoped and sourced from STORE_TYPE_PRESETS (key/label/description only).
 * - VariableValues are created for each ProfileType × Definition using definition.defaultValue.
 *   Idempotent: does NOT overwrite existing VariableValues.
 *
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Stats
 */
classroomSchema.statics.seedStoreTypesAndVariables = async function (
  classroomId,
  organizationId,
  clerkUserId
) {
  // Deprecated: seeding is now handled by ClassroomTemplate application.
  const defaultKey = ClassroomTemplate.GLOBAL_DEFAULT_KEY;
  let template = await ClassroomTemplate.findOne({
    organization: organizationId,
    key: defaultKey,
    isActive: true,
  });
  if (!template) {
    await ClassroomTemplate.copyGlobalToOrganization(
      organizationId,
      clerkUserId
    );
    template = await ClassroomTemplate.findOne({
      organization: organizationId,
      key: defaultKey,
      isActive: true,
    });
  }

  if (!template) {
    return {
      storeTypesCreated: 0,
      storeTypesSkipped: 0,
      variableDefinitionsCreated: 0,
      variableDefinitionsSkipped: 0,
      variableValuesCreated: 0,
      variableValuesSkipped: 0,
    };
  }

  return await template.applyToClassroom({
    classroomId,
    organizationId,
    clerkUserId,
  });
};

/**
 * Seed decision variable definitions for a classroom
 * Idempotent: skips variables that already exist
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Stats object with created and skipped counts
 */
classroomSchema.statics.seedSubmissionVariables = async function (
  classroomId,
  organizationId,
  clerkUserId
) {
  const variableDefinitions =
    ClassroomTemplate.getDefaultSubmissionVariableDefinitions();
  const stats = {
    created: 0,
    skipped: 0,
    errors: 0,
  };

  for (const def of variableDefinitions) {
    try {
      // Check if variable already exists
      const exists = await VariableDefinition.findOne({
        classroomId,
        key: def.key,
      }).select("_id");

      if (exists) {
        stats.skipped += 1;
        continue;
      }

      // Create the variable definition
      await VariableDefinition.createDefinition(
        classroomId,
        def,
        organizationId,
        clerkUserId
      );
      stats.created += 1;
    } catch (error) {
      console.error(
        `Error creating decision variable ${def.key} for classroom ${classroomId}:`,
        error.message
      );
      stats.errors += 1;
    }
  }

  return stats;
};

/**
 * Admin: delete all VariableDefinitions (and VariableValues) for a classroom.
 * This is destructive and intended for classroom reset/debug tools.
 * @param {string} classroomId
 * @param {string} organizationId
 * @param {Object} options
 * @param {boolean} options.deleteValues - also delete VariableValues to avoid orphaned values (default true)
 * @returns {Promise<Object>} counts
 */
classroomSchema.statics.adminDeleteAllVariableDefinitionsForClassroom =
  async function (classroomId, organizationId, options = {}) {
    const { deleteValues = true } = options;

    const VariableValue = require("../variableDefinition/variableValue.model");

    const defsRes = await VariableDefinition.deleteMany({
      organization: organizationId,
      classroomId,
    });

    let valuesRes = null;
    if (deleteValues) {
      valuesRes = await VariableValue.deleteMany({
        organization: organizationId,
        classroomId,
      });
    }

    return {
      variableDefinitionsDeleted: defsRes?.deletedCount || 0,
      variableValuesDeleted: valuesRes?.deletedCount || 0,
    };
  };

/**
 * Admin: restore a classroom from a template by wiping definitions + values and reapplying.
 * This resets profile/challenge/decision values to template defaultValue (if provided).
 *
 * @param {string} classroomId
 * @param {string} organizationId
 * @param {string} clerkUserId
 * @param {Object} options
 * @param {string} [options.templateId] - org template id to restore from
 * @param {string} [options.templateKey] - org template key (defaults to GLOBAL_DEFAULT_KEY)
 * @returns {Promise<Object>} stats
 */
classroomSchema.statics.adminRestoreTemplateForClassroom = async function (
  classroomId,
  organizationId,
  clerkUserId,
  options = {}
) {
  const { templateId, templateKey } = options;

  const VariableValue = require("../variableDefinition/variableValue.model");
  const Profile = require("../profile/profile.model");
  const Challenge = require("../challenge/challenge.model");
  const Decision = require("../decision/decision.model");

  const key = templateKey || ClassroomTemplate.GLOBAL_DEFAULT_KEY;

  let template = null;
  if (templateId) {
    template = await ClassroomTemplate.findOne({
      _id: templateId,
      organization: organizationId,
      isActive: true,
    });
  } else {
    template = await ClassroomTemplate.findOne({
      organization: organizationId,
      key,
      isActive: true,
    });
  }

  if (!template && key === ClassroomTemplate.GLOBAL_DEFAULT_KEY) {
    await ClassroomTemplate.copyGlobalToOrganization(
      organizationId,
      clerkUserId
    );
    template = await ClassroomTemplate.findOne({
      organization: organizationId,
      key,
      isActive: true,
    });
  }

  if (!template) {
    throw new Error("Template not found");
  }

  // 1) Delete all values first (to avoid unique conflicts), then definitions.
  const valuesRes = await VariableValue.deleteMany({
    organization: organizationId,
    classroomId,
  });
  const defsRes = await VariableDefinition.deleteMany({
    organization: organizationId,
    classroomId,
  });
  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  const metricDefsRes = await MetricDefinition.deleteMany({
    classroomId,
  });

  // 2) Apply template (recreates ProfileType defs + ProfileType values; creates other defs too)
  const templateApply = await template.applyToClassroom({
    classroomId,
    organizationId,
    clerkUserId,
  });

  // 2b) Reset classroom-level prompts to the template prompts (since this is a restore/reset).
  const prompts = template.payload?.prompts;
  if (Array.isArray(prompts) && prompts.length > 0) {
    await this.updateOne(
      { _id: classroomId, organization: organizationId },
      { $set: { prompts, updatedBy: clerkUserId, updatedDate: new Date() } }
    );
  }

  // 3) Reset profile/challenge/decision values to defaults (if template provides defs with defaultValue)
  // Support both new and legacy keys to ease the rename transition.
  const defsBy = template.payload?.variableDefinitionsByAppliesTo || {};
  const storeDefs = Array.isArray(defsBy.profile)
    ? defsBy.profile
    : Array.isArray(defsBy.profile)
      ? defsBy.profile
      : [];
  const scenarioDefs = Array.isArray(defsBy.challenge)
    ? defsBy.challenge
    : Array.isArray(defsBy.challenge)
      ? defsBy.challenge
      : [];
  const submissionDefs = Array.isArray(defsBy.decision)
    ? defsBy.decision
    : Array.isArray(defsBy.decision)
      ? defsBy.decision
      : [];

  const reseed = async (appliesTo, owners, defs) => {
    const usableDefs = (defs || []).filter(
      (d) =>
        d && d.key && d.defaultValue !== undefined && d.defaultValue !== null
    );
    if (owners.length === 0 || usableDefs.length === 0) return 0;

    const ops = [];
    for (const owner of owners) {
      for (const def of usableDefs) {
        ops.push({
          insertOne: {
            document: {
              organization: organizationId,
              classroomId,
              appliesTo,
              ownerId: owner._id,
              variableKey: def.key,
              value: def.defaultValue,
              createdBy: clerkUserId,
              updatedBy: clerkUserId,
            },
          },
        });
      }
    }

    if (ops.length === 0) return 0;
    const res = await VariableValue.bulkWrite(ops, { ordered: false });
    return res?.insertedCount || 0;
  };

  const [profiles, challenges, decisions] = await Promise.all([
    Profile.find({ organization: organizationId, classroomId })
      .select("_id")
      .lean(),
    Challenge.find({ organization: organizationId, classroomId })
      .select("_id")
      .lean(),
    Decision.find({ organization: organizationId, classroomId })
      .select("_id")
      .lean(),
  ]);

  const storeValuesCreated = await reseed("profile", profiles, storeDefs);
  const scenarioValuesCreated = await reseed(
    "challenge",
    challenges,
    scenarioDefs
  );
  const submissionValuesCreated = await reseed(
    "decision",
    decisions,
    submissionDefs
  );

  return {
    variableValuesDeleted: valuesRes?.deletedCount || 0,
    variableDefinitionsDeleted: defsRes?.deletedCount || 0,
    metricDefinitionsDeleted: metricDefsRes?.deletedCount || 0,
    templateApply,
    reseeded: {
      storeValuesCreated,
      scenarioValuesCreated,
      submissionValuesCreated,
    },
  };
};

/**
 * Delete a classroom and all associated data (cascade delete)
 * Deletes: enrollments, challenges, decisions, outcomes, ledgerEntries,
 *          profiles, profileTypes, variableDefinitions, variableValues, simulationJobs, notifications
 *
 * @param {string} classroomId - Classroom ID
 * @param {string} organizationId - Organization ID for validation
 * @returns {Promise<Object>} Deletion stats
 */
classroomSchema.statics.deleteClassroom = async function (
  classroomId,
  organizationId
) {
  // Lazy load models to avoid circular dependencies
  const Profile = require("../profile/profile.model");
  const ProfileType = require("../profileType/profileType.model");
  const SimulationJob = require("../job/job.model");
  const VariableValue = require("../variableDefinition/variableValue.model");
  const Notification = require("../notifications/notifications.model");

  // Verify classroom exists and belongs to organization
  const classroom = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });

  if (!classroom) {
    throw new Error("Classroom not found");
  }

  const stats = {
    classroomDeleted: false,
    enrollmentsDeleted: 0,
    scenariosDeleted: 0,
    submissionsDeleted: 0,
    scenarioOutcomesDeleted: 0,
    ledgerEntriesDeleted: 0,
    storesDeleted: 0,
    storeTypesDeleted: 0,
    variableDefinitionsDeleted: 0,
    variableValuesDeleted: 0,
    metricDefinitionsDeleted: 0,
    simulationJobsDeleted: 0,
    notificationsDeleted: 0,
  };

  // 1. Delete all notifications related to this classroom
  const notificationsResult = await Notification.deleteMany({
    "modelData.classroom": classroomId,
  });
  stats.notificationsDeleted = notificationsResult.deletedCount || 0;

  // 2. Delete all simulation jobs for this classroom
  const simulationJobsResult = await SimulationJob.deleteMany({ classroomId });
  stats.simulationJobsDeleted = simulationJobsResult.deletedCount || 0;

  // 3. Delete all ledger entries for this classroom
  const ledgerEntriesResult = await LedgerEntry.deleteMany({ classroomId });
  stats.ledgerEntriesDeleted = ledgerEntriesResult.deletedCount || 0;

  // 4. Delete all decisions for this classroom
  const submissionsResult = await Decision.deleteMany({ classroomId });
  stats.submissionsDeleted = submissionsResult.deletedCount || 0;

  // 5. Delete all challenge outcomes for challenges in this classroom
  const challenges = await Challenge.find({ classroomId }).select("_id").lean();
  const scenarioIds = challenges.map((s) => s._id);
  if (scenarioIds.length > 0) {
    const scenarioOutcomesResult = await Outcome.deleteMany({
      challengeId: { $in: scenarioIds },
    });
    stats.scenarioOutcomesDeleted = scenarioOutcomesResult.deletedCount || 0;
  }

  // 6. Delete all challenges for this classroom
  const scenariosResult = await Challenge.deleteMany({ classroomId });
  stats.scenariosDeleted = scenariosResult.deletedCount || 0;

  // 7. Delete all profiles for this classroom
  const storesResult = await Profile.deleteMany({ classroomId });
  stats.storesDeleted = storesResult.deletedCount || 0;

  // 8. Delete all profile types for this classroom
  const storeTypesResult = await ProfileType.deleteMany({ classroomId });
  stats.storeTypesDeleted = storeTypesResult.deletedCount || 0;

  // 9. Delete all variable values for this classroom
  const variableValuesResult = await VariableValue.deleteMany({ classroomId });
  stats.variableValuesDeleted = variableValuesResult.deletedCount || 0;

  // 10. Delete all variable definitions for this classroom
  const variableDefinitionsResult = await VariableDefinition.deleteMany({
    classroomId,
  });
  stats.variableDefinitionsDeleted =
    variableDefinitionsResult.deletedCount || 0;

  // 10b. Delete all metric definitions for this classroom
  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  const metricDefinitionsResult = await MetricDefinition.deleteMany({
    classroomId,
  });
  stats.metricDefinitionsDeleted =
    metricDefinitionsResult.deletedCount || 0;

  // 11. Delete all enrollments for this classroom
  const enrollmentsResult = await Enrollment.deleteMany({ classroomId });
  stats.enrollmentsDeleted = enrollmentsResult.deletedCount || 0;

  // 12. Finally, delete the classroom itself
  await this.findByIdAndDelete(classroomId);
  stats.classroomDeleted = true;

  return stats;
};

const { getDefaultFreeTeacherLimits } = require("../licensing/planCatalog");
const { makeLicensingError } = require("../licensing/licensing.errors");

/**
 * Check whether the organization can create another classroom under free-tier limits.
 */
classroomSchema.statics.canCreateClassroom = async function ({ organization }) {
  const freeLimits = getDefaultFreeTeacherLimits();
  const activeClassrooms = await this.countDocuments({
    organization: organization._id,
    isActive: true,
  });

  if (activeClassrooms >= freeLimits.classroomLimit) {
    return {
      allowed: false,
      reason: "free_classroom_limit_reached",
      limit: freeLimits.classroomLimit,
      activeClassrooms,
    };
  }

  return {
    allowed: true,
    reason: "free_teacher_workspace",
    limit: freeLimits.classroomLimit,
    activeClassrooms,
  };
};

/**
 * Require that the organization can create another classroom; throws if not.
 */
classroomSchema.statics.requireCanCreateClassroom = async function ({
  organization,
}) {
  const decision = await this.canCreateClassroom({ organization });
  if (!decision.allowed) {
    throw makeLicensingError(
      "Your free classroom limit has been reached. Buy seats or contact support to add more classrooms.",
      402,
      "CLASSROOM_LIMIT_REACHED",
      decision,
    );
  }
  return decision;
};

/**
 * Summarize seat claims and roster seat status for a classroom.
 */
classroomSchema.statics.getClassroomSeatSummary = async function (classroomId) {
  const SeatClaim = require("../licensing/seatClaim.model");
  const RosterSeat = require("../licensing/rosterSeat.model");

  const [claimedSeats, rosterSeats] = await Promise.all([
    SeatClaim.countActiveClassroomClaims(classroomId),
    RosterSeat.find({ classroomId }).lean(),
  ]);

  return {
    claimedSeats,
    roster: {
      total: rosterSeats.length,
      reserved: rosterSeats.filter((seat) => seat.status === "reserved").length,
      claimed: rosterSeats.filter((seat) => seat.status === "claimed").length,
      revoked: rosterSeats.filter((seat) => seat.status === "revoked").length,
      invalid: rosterSeats.filter((seat) => seat.status === "invalid").length,
    },
  };
};

const Classroom = mongoose.model("Classroom", classroomSchema);

module.exports = Classroom;

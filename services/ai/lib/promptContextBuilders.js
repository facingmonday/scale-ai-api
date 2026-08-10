const Classroom = require("../../classroom/classroom.model");
const Challenge = require("../../challenge/challenge.model");
const Decision = require("../../decision/decision.model");
const Profile = require("../../profile/profile.model");
const MetricDefinition = require("../../metricDefinition/metricDefinition.model");
const Member = require("../../members/member.model");
const ProfileModel = require("../../profile/profile.model");
const SimulationJob = require("../../job/job.model");

class BasePromptContextBuilder {
  constructor(run, trigger) {
    this.run = run;
    this.trigger = trigger;
    this.classroom = null;
    this.challenge = null;
  }

  async initialize() {
    this.classroom = await Classroom.findById(this.run.classroomId).lean();
    if (!this.classroom) throw new Error("Classroom not found");

    this.challenge = await Challenge.findById(this.run.challengeId).lean();
    if (!this.challenge) throw new Error("Challenge not found");
  }

  async buildBaseContext() {
    if (!this.classroom || !this.challenge) {
      await this.initialize();
    }
    return {
      classroomName: this.classroom.name,
      challengeTitle: this.challenge.title,
      challengeDescription: this.challenge.description,
      triggerEvent: this.trigger,
    };
  }

  async build() {
    throw new Error("build() must be implemented by subclass");
  }
}

class AfterChallengeCreatedBuilder extends BasePromptContextBuilder {
  async build() {
    const context = await this.buildBaseContext();
    context.variables = this.challenge.variables || {};
    return context;
  }
}

class AfterStudentSubmissionBuilder extends BasePromptContextBuilder {
  async build() {
    const context = await this.buildBaseContext();

    const decision = await Decision.findById(this.run.decisionId).lean();
    if (!decision) throw new Error(`Decision not found: ${this.run.decisionId}`);

    const profile = await ProfileModel.findOne({
      classroomId: this.run.classroomId,
      userId: decision.userId,
    }).lean();

    const student = await Member.findById(decision.userId)
      .select("firstName lastName maskedEmail")
      .lean();

    context.student = {
      name: student ? `${student.firstName} ${student.lastName}` : "Unknown Student",
      shopName: profile?.shopName || "Unknown Shop",
      profileType: profile?.profileTypeLabel || profile?.profileType?.label || "Unknown Type",
    };
    context.submissionVariables = decision.variables || {};
    return context;
  }
}

class AfterStudentLedgerCompleteBuilder extends BasePromptContextBuilder {
  async build() {
    const context = await this.buildBaseContext();
    const LedgerEntry = require("../../ledger/ledger.model");

    const decisionDoc = await Decision.findOne({
      _id: this.run.decisionId,
      challengeId: this.run.challengeId,
      userId: this.run.userId,
    });
    if (!decisionDoc) {
      throw new Error(`Decision not found for ledger-complete run: ${this.run.decisionId}`);
    }
    await Decision.populateVariablesForMany([decisionDoc]);

    const [profile, student, ledgerEntry] = await Promise.all([
      ProfileModel.findOne({
        classroomId: this.run.classroomId,
        userId: this.run.userId,
      }).lean(),
      Member.findById(this.run.userId)
        .select("firstName lastName maskedEmail")
        .lean(),
      LedgerEntry.findOne({
        classroomId: this.run.classroomId,
        challengeId: this.run.challengeId,
        userId: this.run.userId,
      }).lean(),
    ]);

    if (!ledgerEntry) {
      throw new Error(
        `Ledger entry not found for student ${this.run.userId} and challenge ${this.run.challengeId}`,
      );
    }

    const metrics = ledgerEntry.metrics;
    context.student = {
      name: student
        ? `${student.firstName} ${student.lastName}`
        : "Student",
      shopName: profile?.shopName || "Student Shop",
      profileType:
        profile?.profileTypeLabel || profile?.profileType?.label || "",
    };
    context.submissionVariables = decisionDoc.toObject().variables || {};
    context.studentResults = {
      metrics: metrics instanceof Map ? Object.fromEntries(metrics) : metrics || {},
      summary: ledgerEntry.summary || "",
      randomEvent: ledgerEntry.randomEvent || "",
    };
    return context;
  }
}

class AfterChallengeClosedBuilder extends BasePromptContextBuilder {
  async build() {
    const context = await this.buildBaseContext();

    // 1. Gather all student submissions for this challenge
    const allSubmissions = await Decision.getSubmissionsByScenario(this.run.challengeId);

    // 2. Fetch profiles to attach
    const submissionsWithStores = await Promise.all(
      allSubmissions.map(async (decision) => {
        const profile = await Profile.getStoreByUser(this.run.classroomId, decision.userId);
        return {
          ...decision,
          profile,
        };
      })
    );

    // 3. Compute store type stats using static method
    const metricDefinitions = await MetricDefinition.getActive(this.run.classroomId);
    const storeTypeStats = await Challenge.getStoreTypeStats(submissionsWithStores, metricDefinitions);

    context.totalStudents = submissionsWithStores.length;
    context.studentOutcomes = submissionsWithStores.map((sub) => {
      const metrics = sub.ledgerEntryId?.metrics;
      return {
        studentName: sub.member ? `${sub.member.firstName} ${sub.member.lastName}` : "Unknown Student",
        shopName: sub.profile?.shopName || "Unknown Shop",
        profileType: sub.profile?.profileType?.label || "Unknown Type",
        metrics: metrics instanceof Map ? Object.fromEntries(metrics) : metrics || {},
        summary: sub.ledgerEntryId?.summary || "",
        randomEvent: sub.ledgerEntryId?.randomEvent || "",
        variables: sub.variables || [],
      };
    });
    context.storeTypeStats = storeTypeStats;
    return context;
  }
}

class AfterChallengeClosedPerStudentBuilder extends BasePromptContextBuilder {
  async build() {
    const context = await this.buildBaseContext();

    const LedgerEntry = require("../../ledger/ledger.model");

    // Fetch the decision document and load virtual variables via the plugin
    const decisionDoc = await Decision.findById(this.run.decisionId);
    if (!decisionDoc) {
      throw new Error(`Decision not found: ${this.run.decisionId}`);
    }
    await Decision.populateVariablesForMany([decisionDoc]);
    const decision = decisionDoc.toObject();

    const profile = await ProfileModel.findOne({
      classroomId: this.run.classroomId,
      userId: this.run.userId,
    }).lean();

    const student = await Member.findById(this.run.userId)
      .select("firstName lastName maskedEmail")
      .lean();

    context.student = {
      name: student ? `${student.firstName} ${student.lastName}` : "Unknown Student",
      shopName: profile?.shopName || "Unknown Shop",
      profileType: profile?.profileTypeLabel || profile?.profileType?.label || "Unknown Type",
    };

    // Grab student's specific simulation metrics & ledger summary
    const ledgerEntry = await LedgerEntry.findOne({
      classroomId: this.run.classroomId,
      challengeId: this.run.challengeId,
      userId: this.run.userId,
    }).lean();

    if (ledgerEntry) {
      const metrics = ledgerEntry.metrics;
      context.studentResults = {
        metrics: metrics instanceof Map ? Object.fromEntries(metrics) : metrics || {},
        summary: ledgerEntry.summary || "",
        randomEvent: ledgerEntry.randomEvent || "",
      };
    }

    context.submissionVariables = decision.variables || {};

    // Load class stats for benchmark/comparison context
    const allSubmissions = await Decision.getSubmissionsByScenario(this.run.challengeId);
    const metricDefinitions = await MetricDefinition.getActive(this.run.classroomId);
    const submissionsWithStores = await Promise.all(
      allSubmissions.map(async (dec) => {
        const prof = await Profile.getStoreByUser(this.run.classroomId, dec.userId);
        return { ...dec, profile: prof };
      })
    );
    const storeTypeStats = await Challenge.getStoreTypeStats(submissionsWithStores, metricDefinitions);
    context.classroomAverages = storeTypeStats;

    return context;
  }
}

class PromptContextBuilderFactory {
  static getBuilder(trigger, run) {
    const builders = {
      AFTER_CHALLENGE_CREATED: AfterChallengeCreatedBuilder,
      AFTER_STUDENT_SUBMISSION: AfterStudentSubmissionBuilder,
      AFTER_STUDENT_LEDGER_COMPLETE: AfterStudentLedgerCompleteBuilder,
      AFTER_CHALLENGE_CLOSED: AfterChallengeClosedBuilder,
      AFTER_CHALLENGE_CLOSED_PER_STUDENT: AfterChallengeClosedPerStudentBuilder,
    };

    const BuilderClass = builders[trigger];
    if (!BuilderClass) {
      throw new Error(`Unsupported trigger type: ${trigger}`);
    }

    return new BuilderClass(run, trigger);
  }
}

module.exports = {
  BasePromptContextBuilder,
  AfterChallengeCreatedBuilder,
  AfterStudentSubmissionBuilder,
  AfterStudentLedgerCompleteBuilder,
  AfterChallengeClosedBuilder,
  AfterChallengeClosedPerStudentBuilder,
  PromptContextBuilderFactory,
};

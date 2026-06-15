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

class PromptContextBuilderFactory {
  static getBuilder(trigger, run) {
    const builders = {
      AFTER_CHALLENGE_CREATED: AfterChallengeCreatedBuilder,
      AFTER_STUDENT_SUBMISSION: AfterStudentSubmissionBuilder,
      AFTER_CHALLENGE_CLOSED: AfterChallengeClosedBuilder,
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
  AfterChallengeClosedBuilder,
  PromptContextBuilderFactory,
};

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");
const Classroom = require("./classroom.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const Enrollment = require("../enrollment/enrollment.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");
const Outcome = require("../outcome/outcome.model");
const Profile = require("../profile/profile.model");
const ProfileType = require("../profileType/profileType.model");
const LedgerEntry = require("../ledger/ledger.model");
const SimulationJob = require("../job/job.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const {
  evaluateClassroomReadiness,
  assertClassroomReady,
  ClassroomReadinessBlockedError,
} = require("./classroomReadiness.service");

test.before(async () => {
  // These checks do not depend on indexes. Disabling automatic index builds
  // keeps this isolated integration test from racing database teardown.
  [
    Classroom,
    Challenge,
    Decision,
    Enrollment,
    MetricDefinition,
    Outcome,
    Profile,
    ProfileType,
    LedgerEntry,
    SimulationJob,
    VariableDefinition,
    VariableValue,
  ].forEach((model) => model.schema.set("autoIndex", false));
  await setupTestDb();
});
test.after(teardownTestDb);
test.beforeEach(clearCollections);

const audit = { createdBy: "teacher_test", updatedBy: "teacher_test" };

async function createFixture({ withMetric = false } = {}) {
  const organizationId = new mongoose.Types.ObjectId();
  const teacherId = new mongoose.Types.ObjectId();
  const classroom = await Classroom.create({
    name: "Readiness class",
    ownership: teacherId,
    organization: organizationId,
    ...audit,
  });
  const challenge = await Challenge.create({
    classroomId: classroom._id,
    title: "Week 1",
    week: 1,
    feedbackReleaseMode: "MANUAL",
    organization: organizationId,
    ...audit,
  });
  await Outcome.create({
    classroomId: classroom._id,
    challengeId: challenge._id,
    notes: "Demand increased.",
    approved: true,
    organization: organizationId,
    ...audit,
  });
  if (withMetric) {
    await MetricDefinition.create({
      classroomId: classroom._id,
      key: "profit",
      label: "Profit",
      dataType: "number",
      defaultInitialValue: 0,
      isActive: true,
      organization: organizationId,
      ...audit,
    });
  }
  return { organizationId, teacherId, classroom, challenge };
}

test("zero active numeric metrics block result operations", async () => {
  const fixture = await createFixture();
  const readiness = await evaluateClassroomReadiness({
    classroomId: fixture.classroom._id,
    challengeId: fixture.challenge._id,
    organizationId: fixture.organizationId,
    operation: "process",
  });

  assert.equal(readiness.status, "blocked");
  assert.equal(
    readiness.checks.find((item) => item.key === "active_numeric_metrics")?.status,
    "fail",
  );
  await assert.rejects(
    assertClassroomReady({
      classroomId: fixture.classroom._id,
      challengeId: fixture.challenge._id,
      organizationId: fixture.organizationId,
      operation: "process",
    }),
    ClassroomReadinessBlockedError,
  );
});

test("a submitted student without a Week 0 ledger is blocked", async () => {
  const fixture = await createFixture({ withMetric: true });
  const studentId = new mongoose.Types.ObjectId();
  const profileType = await ProfileType.create({
    classroomId: fixture.classroom._id,
    key: "campus_store",
    label: "Campus Store",
    startingBalance: 10000,
    initialStartupCost: 2000,
    organization: fixture.organizationId,
    ...audit,
  });
  await Profile.create({
    classroomId: fixture.classroom._id,
    userId: studentId,
    studentId: "S-1",
    shopName: "Student Shop",
    storeDescription: "A test shop",
    storeLocation: "Campus",
    profileType: profileType._id,
    organization: fixture.organizationId,
    ...audit,
  });
  await Decision.create({
    classroomId: fixture.classroom._id,
    challengeId: fixture.challenge._id,
    userId: studentId,
    organization: fixture.organizationId,
    ...audit,
  });

  const readiness = await evaluateClassroomReadiness({
    classroomId: fixture.classroom._id,
    challengeId: fixture.challenge._id,
    organizationId: fixture.organizationId,
    operation: "rerun",
  });

  assert.equal(readiness.status, "blocked");
  assert.equal(
    readiness.checks.find((item) => item.key === "week_zero_ledgers")?.status,
    "fail",
  );

  await LedgerEntry.create({
    classroomId: fixture.classroom._id,
    challengeId: null,
    userId: studentId,
    metrics: { profit: "not-a-number" },
    summary: "Opening ledger",
    aiMetadata: { model: "seed", runId: "week-zero", generatedAt: new Date() },
    organization: fixture.organizationId,
    ...audit,
  });
  const invalidReadiness = await evaluateClassroomReadiness({
    classroomId: fixture.classroom._id,
    challengeId: fixture.challenge._id,
    organizationId: fixture.organizationId,
    operation: "process",
  });
  assert.equal(
    invalidReadiness.checks.find((item) => item.key === "week_zero_ledgers")?.status,
    "fail",
  );
});

test("warnings are reported but do not block processing", async () => {
  const fixture = await createFixture({ withMetric: true });
  await Enrollment.create({
    classroomId: fixture.classroom._id,
    userId: new mongoose.Types.ObjectId(),
    role: "member",
    organization: fixture.organizationId,
    ...audit,
  });

  const readiness = await assertClassroomReady({
    classroomId: fixture.classroom._id,
    challengeId: fixture.challenge._id,
    organizationId: fixture.organizationId,
    operation: "preview",
  });

  assert.equal(readiness.status, "warning");
  assert.equal(readiness.blockers, 0);
  assert.ok(readiness.warnings >= 1);
});

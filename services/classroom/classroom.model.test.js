const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const Classroom = require("./classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const LedgerEntry = require("../ledger/ledger.model");
const Outcome = require("../outcome/outcome.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");
const Member = require("../members/member.model");
const Profile = require("../profile/profile.model");
const ProfileType = require("../profileType/profileType.model");
const SimulationJob = require("../job/job.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const SeatClaim = require("../licensing/seatClaim.model");
const RosterSeat = require("../licensing/rosterSeat.model");

test("Classroom Model Integration Tests", async (t) => {
  await setupTestDb();

  t.after(async () => {
    await teardownTestDb();
  });

  t.afterEach(async () => {
    await clearCollections();
  });

  await t.test("Schema defaults and validation", async () => {
    const classroom = new Classroom({
      name: "Supply Chain 101",
      ownership: new mongoose.Types.ObjectId(),
      organization: new mongoose.Types.ObjectId(),
      createdBy: "clerk-user-123",
      updatedBy: "clerk-user-123",
    });

    await classroom.validate();
    assert.equal(classroom.isActive, true);
    assert.equal(classroom.billingMode, "student_paid");
    assert.equal(classroom.joinPolicy, "invite_link");
    assert.equal(classroom.studentPaysAllowed, true);
    assert.deepEqual(classroom.allowedDomains, []);
    assert.equal(classroom.accessCode, "");
    assert.equal(classroom.allowAnonymousJoin, true);
    assert.deepEqual(classroom.prompts, []);
    assert.equal(classroom.automationSettings.enabled, false);
    assert.equal(classroom.automationSettings.timezone, "America/Chicago");
    assert.equal(classroom.automationSettings.defaultReleaseDay, "Monday");
    assert.equal(classroom.automationSettings.defaultReleaseTime, "08:00");
    assert.equal(classroom.automationSettings.defaultDueDay, "Friday");
    assert.equal(classroom.automationSettings.defaultDueTime, "23:59");
    assert.equal(classroom.automationSettings.defaultCloseDelayHours, 0);
    assert.equal(classroom.automationSettings.defaultProcessDelayHours, 0);
    assert.equal(classroom.automationSettings.defaultFeedbackReleaseMode, "IMMEDIATE");
    assert.equal(classroom.automationSettings.missingSubmissionPolicy, "USE_DEFAULTS");

    // Validation fails if name is missing
    const missingName = new Classroom({
      ownership: new mongoose.Types.ObjectId(),
      organization: new mongoose.Types.ObjectId(),
      createdBy: "test",
      updatedBy: "test",
    });
    await assert.rejects(missingName.validate());

    // Validation fails if ownership is missing
    const missingOwner = new Classroom({
      name: "No Owner Class",
      organization: new mongoose.Types.ObjectId(),
      createdBy: "test",
      updatedBy: "test",
    });
    await assert.rejects(missingOwner.validate());
  });

  await t.test("findByOrganization and findActiveByOrganization statics", async () => {
    const orgId1 = new mongoose.Types.ObjectId();
    const orgId2 = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    await Classroom.create([
      {
        name: "Class 1",
        organization: orgId1,
        ownership: ownerId,
        isActive: true,
        createdBy: "test",
        updatedBy: "test",
      },
      {
        name: "Class 2",
        organization: orgId1,
        ownership: ownerId,
        isActive: false,
        createdBy: "test",
        updatedBy: "test",
      },
      {
        name: "Class 3",
        organization: orgId2,
        ownership: ownerId,
        isActive: true,
        createdBy: "test",
        updatedBy: "test",
      }
    ]);

    // findByOrganization
    const org1Classes = await Classroom.findByOrganization(orgId1);
    assert.equal(org1Classes.length, 2);
    assert.ok(org1Classes.some(c => c.name === "Class 1"));
    assert.ok(org1Classes.some(c => c.name === "Class 2"));

    // findActiveByOrganization
    const org1ActiveClasses = await Classroom.findActiveByOrganization(orgId1);
    assert.equal(org1ActiveClasses.length, 1);
    assert.equal(org1ActiveClasses[0].name, "Class 1");
  });

  await t.test("validateAdminAccess static", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const adminUserId = new mongoose.Types.ObjectId();
    const orgAdminUserId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();

    const classDoc = await Classroom.create({
      name: "Admin Access Test",
      organization: orgId,
      ownership: ownerId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create members
    await Member.create([
      {
        _id: ownerId,
        clerkUserId: "clerk-owner",
        createdAt: new Date(),
      },
      {
        _id: adminUserId,
        clerkUserId: "clerk-admin",
        createdAt: new Date(),
      },
      {
        _id: orgAdminUserId,
        clerkUserId: "clerk-org-admin",
        organizationMemberships: [
          {
            id: "mem-org",
            organizationId: orgId,
            role: "org:admin",
            createdAt: new Date(),
          }
        ],
        createdAt: new Date(),
      },
      {
        _id: otherUserId,
        clerkUserId: "clerk-other",
        createdAt: new Date(),
      }
    ]);

    // Setup Enrollment for enrolled admin
    await Enrollment.create({
      classroomId: classDoc._id,
      userId: adminUserId,
      role: "admin",
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // 1. Success as Owner
    const resOwner = await Classroom.validateAdminAccess(classDoc._id, "clerk-owner", orgId);
    assert.equal(resOwner.name, "Admin Access Test");

    // 2. Success as Enrolled Admin
    const resAdmin = await Classroom.validateAdminAccess(classDoc._id, "clerk-admin", orgId);
    assert.equal(resAdmin.name, "Admin Access Test");

    // 3. Success as Org Admin
    const resOrgAdmin = await Classroom.validateAdminAccess(classDoc._id, "clerk-org-admin", orgId);
    assert.equal(resOrgAdmin.name, "Admin Access Test");

    // 4. Failure as Other User
    await assert.rejects(
      Classroom.validateAdminAccess(classDoc._id, "clerk-other", orgId),
      /Insufficient permissions/
    );
  });

  await t.test("validateStudentAccess static", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const enrolledStudentId = new mongoose.Types.ObjectId();
    const nonEnrolledStudentId = new mongoose.Types.ObjectId();

    const classDoc = await Classroom.create({
      name: "Student Access Test",
      organization: orgId,
      ownership: ownerId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create members
    await Member.create([
      {
        _id: enrolledStudentId,
        clerkUserId: "clerk-student-enrolled",
        createdAt: new Date(),
      },
      {
        _id: nonEnrolledStudentId,
        clerkUserId: "clerk-student-nonenrolled",
        createdAt: new Date(),
      }
    ]);

    // Enroll student
    await Enrollment.create({
      classroomId: classDoc._id,
      userId: enrolledStudentId,
      role: "member",
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // 1. Success for enrolled student
    const resEnrolled = await Classroom.validateStudentAccess(classDoc._id, "clerk-student-enrolled", orgId);
    assert.equal(resEnrolled.name, "Student Access Test");

    // 2. Failure for non-enrolled student
    await assert.rejects(
      Classroom.validateStudentAccess(classDoc._id, "clerk-student-nonenrolled", orgId),
      /Not enrolled/
    );

    // 3. Failure for non-existent member
    await assert.rejects(
      Classroom.validateStudentAccess(classDoc._id, "clerk-ghost", orgId),
      /Member not found/
    );
  });

  await t.test("generateJoinLink static", async () => {
    const classId = new mongoose.Types.ObjectId();
    process.env.SCALE_APP_HOST = "https://app.example.com";
    const link = Classroom.generateJoinLink(classId);
    assert.equal(link, `https://app.example.com/class/${classId}/join`);
  });

  await t.test("getDashboard static", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const student1Id = new mongoose.Types.ObjectId();
    const student2Id = new mongoose.Types.ObjectId();

    const classDoc = await Classroom.create({
      name: "Dashboard Test Classroom",
      organization: orgId,
      ownership: ownerId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Set up members with org memberships (role org:member is required by countByClass)
    await Member.create([
      {
        _id: student1Id,
        clerkUserId: "clerk-s1",
        firstName: "John",
        lastName: "Doe",
        organizationMemberships: [
          {
            id: "m1",
            organizationId: orgId,
            role: "org:member",
            createdAt: new Date(),
          }
        ],
        createdAt: new Date(),
      },
      {
        _id: student2Id,
        clerkUserId: "clerk-s2",
        firstName: "Jane",
        lastName: "Smith",
        organizationMemberships: [
          {
            id: "m2",
            organizationId: orgId,
            role: "org:member",
            createdAt: new Date(),
          }
        ],
        createdAt: new Date(),
      }
    ]);

    // Enroll students
    await Enrollment.create([
      {
        classroomId: classDoc._id,
        userId: student1Id,
        role: "member",
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      },
      {
        classroomId: classDoc._id,
        userId: student2Id,
        role: "member",
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      }
    ]);

    // Active Challenge (published, not closed)
    const challenge = await Challenge.create({
      classroomId: classDoc._id,
      title: "Week 1 Scenario",
      isPublished: true,
      isClosed: false,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Submissions
    await Decision.create([
      {
        classroomId: classDoc._id,
        challengeId: challenge._id,
        userId: student1Id,
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      }
    ]);

    // Metric definition for leaderboard
    await MetricDefinition.create({
      classroomId: classDoc._id,
      key: "profit",
      label: "Weekly Profit",
      dataType: "number",
      isActive: true,
      sortOrder: 1,
      displayIn: { leaderboard: true },
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Profiles (stores) for leaderboard aggregation
    const profileType = await ProfileType.create({
      classroomId: classDoc._id,
      key: "truck",
      label: "Food Truck",
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    await Profile.create([
      {
        classroomId: classDoc._id,
        userId: student1Id,
        studentId: "S1",
        shopName: "Slice King",
        storeDescription: "Pizza truck",
        storeLocation: "Campus",
        profileType: profileType._id,
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      },
      {
        classroomId: classDoc._id,
        userId: student2Id,
        studentId: "S2",
        shopName: "Pizza Queen",
        storeDescription: "Dine-in",
        storeLocation: "Downtown",
        profileType: profileType._id,
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      }
    ]);

    // Ledgers for leaderboard
    await LedgerEntry.create([
      {
        classroomId: classDoc._id,
        challengeId: challenge._id,
        userId: student1Id,
        metrics: { profit: 250 },
        summary: "John's Ledger",
        aiMetadata: { model: "gpt-4", runId: "r1" },
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      },
      {
        classroomId: classDoc._id,
        challengeId: challenge._id,
        userId: student2Id,
        metrics: { profit: 500 },
        summary: "Jane's Ledger",
        aiMetadata: { model: "gpt-4", runId: "r2" },
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      }
    ]);

    // Outcome for pending approvals count
    await Outcome.create({
      challengeId: challenge._id,
      classroomId: classDoc._id,
      approved: false,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    const dashboard = await Classroom.getDashboard(classDoc._id, orgId);
    assert.equal(dashboard.className, "Dashboard Test Classroom");
    assert.equal(dashboard.students, 2);
    assert.equal(dashboard.activeScenario.title, "Week 1 Scenario");
    assert.equal(dashboard.submissionsCompleted, 1);
    assert.equal(dashboard.leaderboardMetric.key, "profit");
    assert.equal(dashboard.metricDefinitionCount, 1);
    assert.equal(dashboard.leaderboardTop10.length, 2);
    // Jane (student 2) should be #1 with 500 profit
    assert.equal(dashboard.leaderboardTop10[0].userId.toString(), student2Id.toString());
    assert.equal(dashboard.leaderboardTop10[0].metricTotal, 500);
    assert.equal(dashboard.leaderboardTop10[0].profileName, "Pizza Queen");
    assert.equal(dashboard.pendingApprovals, 1);
  });

  await t.test("getDashboard reports when no metrics are configured", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const classDoc = await Classroom.create({
      name: "Dashboard Class Without Metrics",
      organization: orgId,
      ownership: ownerId,
      createdBy: "test",
      updatedBy: "test",
    });

    const dashboard = await Classroom.getDashboard(classDoc._id, orgId);

    assert.equal(dashboard.metricDefinitionCount, 0);
  });

  await t.test("getStudentDashboard static (with fix verification)", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();

    const classDoc = await Classroom.create({
      name: "Student Dashboard Class",
      organization: orgId,
      ownership: ownerId,
      createdBy: "test",
      updatedBy: "test",
    });

    const challenge = await Challenge.create({
      classroomId: classDoc._id,
      title: "Active Challenge 1",
      isPublished: true,
      isClosed: false,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create decision for student
    await Decision.create({
      classroomId: classDoc._id,
      challengeId: challenge._id,
      userId: studentId,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Call getStudentDashboard with memberId (fixes the old reference error)
    const dashboard = await Classroom.getStudentDashboard(classDoc._id, orgId, studentId);
    assert.equal(dashboard.className, "Student Dashboard Class");
    assert.equal(dashboard.activeScenario.title, "Active Challenge 1");
    assert.ok(dashboard.decision);
    assert.equal(dashboard.decision.userId.toString(), studentId.toString());
  });

  await t.test("getStudentDashboard returns released results and class comparisons", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const peerId = new mongoose.Types.ObjectId();

    const classDoc = await Classroom.create({
      name: "Student Insights Class",
      description: "Weekly simulation results",
      organization: orgId,
      ownership: ownerId,
      createdBy: "test",
      updatedBy: "test",
    });
    const profileType = await ProfileType.create({
      classroomId: classDoc._id,
      key: "bar-grill",
      label: "Bar & Grill",
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });
    await Profile.create({
      classroomId: classDoc._id,
      userId: studentId,
      studentId: "S-100",
      shopName: "Student Cafe",
      storeDescription: "A campus cafe",
      storeLocation: "Campus",
      profileType: profileType._id,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });
    await MetricDefinition.create({
      classroomId: classDoc._id,
      key: "revenue",
      label: "Revenue",
      dataType: "number",
      format: "currency",
      displayIn: {
        table: true,
        kpi: true,
        chart: true,
        leaderboard: true,
        detail: true,
      },
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    const releasedChallenge = await Challenge.create({
      classroomId: classDoc._id,
      title: "Released Week",
      week: 1,
      isPublished: true,
      isClosed: true,
      isFeedbackReleased: true,
      feedbackReleaseMode: "DELAYED",
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });
    const hiddenChallenge = await Challenge.create({
      classroomId: classDoc._id,
      title: "Hidden Week",
      week: 2,
      isPublished: true,
      isClosed: true,
      isFeedbackReleased: false,
      feedbackReleaseMode: "MANUAL",
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    await LedgerEntry.create([
      {
        classroomId: classDoc._id,
        challengeId: releasedChallenge._id,
        userId: studentId,
        metrics: { revenue: 2200 },
        summary: "A profitable week.",
        aiMetadata: { model: "test", runId: "student-result" },
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      },
      {
        classroomId: classDoc._id,
        challengeId: releasedChallenge._id,
        userId: peerId,
        metrics: { revenue: 3000 },
        summary: "Peer result.",
        aiMetadata: { model: "test", runId: "peer-result" },
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      },
      {
        classroomId: classDoc._id,
        challengeId: hiddenChallenge._id,
        userId: studentId,
        metrics: { revenue: 9999 },
        summary: "This result is not released.",
        aiMetadata: { model: "test", runId: "hidden-result" },
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      },
    ]);
    await Outcome.create({
      classroomId: classDoc._id,
      challengeId: releasedChallenge._id,
      notes: "Rain reduced foot traffic.",
      approved: true,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    const dashboard = await Classroom.getStudentDashboard(
      classDoc._id,
      orgId,
      studentId
    );

    assert.equal(dashboard.profile.shopName, "Student Cafe");
    assert.equal(dashboard.profile.profileType.label, "Bar & Grill");
    assert.equal(dashboard.metricDefinitions.length, 1);
    assert.equal(dashboard.completedChallengeCount, 2);
    assert.equal(dashboard.recentResults.length, 1);
    assert.equal(dashboard.latestResult.title, "Released Week");
    assert.equal(dashboard.latestResult.metrics.revenue, 2200);
    assert.equal(
      dashboard.latestResult.outcomeNotes,
      "Rain reduced foot traffic."
    );
    assert.equal(dashboard.classStatistics.participantCount, 2);
    assert.equal(dashboard.classStatistics.rank, 2);
    assert.equal(dashboard.classStatistics.averages.revenue, 2600);
  });

  await t.test("Variable and Metric definition queries", async () => {
    const classId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();

    // Create VariableDefinitions
    await VariableDefinition.create([
      {
        classroomId: classId,
        key: "refrigerated-capacity",
        label: "Refrigerated Capacity",
        appliesTo: "profile",
        dataType: "number",
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      },
      {
        classroomId: classId,
        key: "demand-multiplier",
        label: "Demand Multiplier",
        appliesTo: "challenge",
        dataType: "number",
        organization: orgId,
        createdBy: "test",
        updatedBy: "test",
      }
    ]);

    // Create MetricDefinition
    await MetricDefinition.create({
      classroomId: classId,
      key: "profit",
      label: "Weekly Profit",
      dataType: "number",
      isActive: true,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    const varDefs = await Classroom.getAllVariableDefinitionsForClassroom(classId);
    assert.equal(varDefs.profile.length, 1);
    assert.equal(varDefs.profile[0].key, "refrigerated-capacity");
    assert.equal(varDefs.challenge.length, 1);
    assert.equal(varDefs.challenge[0].key, "demand-multiplier");

    const metricDefs = await Classroom.getAllMetricDefinitionsForClassroom(classId);
    assert.equal(metricDefs.length, 1);
    assert.equal(metricDefs[0].key, "profit");

    // Static wrappers for defaults
    assert.ok(Array.isArray(Classroom.getDefaultSubmissionVariableDefinitions()));
    assert.ok(Array.isArray(Classroom.getDefaultStoreTypeVariableDefinitions()));
  });

  await t.test("seedSubmissionVariables static", async () => {
    const classId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();

    const stats = await Classroom.seedSubmissionVariables(classId, orgId, "clerk-user");
    assert.ok(stats.created > 0);
    assert.equal(stats.skipped, 0);

    // Call again to verify idempotency (skipped count should increase, created should be 0)
    const stats2 = await Classroom.seedSubmissionVariables(classId, orgId, "clerk-user");
    assert.equal(stats2.created, 0);
    assert.ok(stats2.skipped > 0);
  });

  await t.test("seedStoreTypesAndVariables and adminRestoreTemplateForClassroom", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    const classDoc = await Classroom.create({
      name: "Template Test Classroom",
      organization: orgId,
      ownership: ownerId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Seed global default course templates
    await ClassroomTemplate.ensureAllGlobalTemplates();

    // Verify seedStoreTypesAndVariables works and creates ProfileTypes and VariableDefinitions
    const seedStats = await Classroom.seedStoreTypesAndVariables(classDoc._id, orgId, "clerk-user");
    assert.ok(seedStats.variableDefinitionsCreated > 0);

    // Verify definitions were created
    const defs = await VariableDefinition.find({ classroomId: classDoc._id });
    assert.ok(defs.length > 0);

    // adminDeleteAllVariableDefinitionsForClassroom
    const delStats = await Classroom.adminDeleteAllVariableDefinitionsForClassroom(classDoc._id, orgId);
    assert.ok(delStats.variableDefinitionsDeleted > 0);

    const defsAfterDel = await VariableDefinition.find({ classroomId: classDoc._id });
    assert.equal(defsAfterDel.length, 0);

    // adminRestoreTemplateForClassroom
    const restoreStats = await Classroom.adminRestoreTemplateForClassroom(classDoc._id, orgId, "clerk-user");
    assert.ok(restoreStats.templateApply.variableDefinitionsCreated > 0);

    const defsAfterRestore = await VariableDefinition.find({ classroomId: classDoc._id });
    assert.ok(defsAfterRestore.length > 0);
  });

  await t.test("deleteClassroom static (cascade delete)", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();

    const classDoc = await Classroom.create({
      name: "Cascade Delete Classroom",
      organization: orgId,
      ownership: ownerId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create a mock active challenge
    const challenge = await Challenge.create({
      classroomId: classDoc._id,
      title: "Challenge to delete",
      isPublished: true,
      isClosed: false,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create outcome
    await Outcome.create({
      challengeId: challenge._id,
      classroomId: classDoc._id,
      approved: false,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create decision (submission)
    await Decision.create({
      classroomId: classDoc._id,
      challengeId: challenge._id,
      userId: studentId,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create LedgerEntry
    await LedgerEntry.create({
      classroomId: classDoc._id,
      challengeId: challenge._id,
      userId: studentId,
      metrics: {},
      summary: "Ledger description",
      aiMetadata: { model: "gpt-4", runId: "run1" },
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create Enrollment
    await Enrollment.create({
      classroomId: classDoc._id,
      userId: studentId,
      role: "member",
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create SimulationJob
    await SimulationJob.create({
      classroomId: classDoc._id,
      challengeId: challenge._id,
      userId: studentId,
      status: "pending",
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create ProfileType
    const profileType = await ProfileType.create({
      classroomId: classDoc._id,
      key: "truck",
      label: "Food Truck",
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Create Profile
    await Profile.create({
      classroomId: classDoc._id,
      userId: studentId,
      studentId: "S3",
      shopName: "Slice Paradise",
      storeDescription: "A slice of heaven",
      storeLocation: "Mall",
      profileType: profileType._id,
      organization: orgId,
      createdBy: "test",
      updatedBy: "test",
    });

    // Perform cascade delete
    const stats = await Classroom.deleteClassroom(classDoc._id, orgId);
    assert.equal(stats.classroomDeleted, true);
    assert.equal(stats.scenariosDeleted, 1);
    assert.equal(stats.scenarioOutcomesDeleted, 1);
    assert.equal(stats.submissionsDeleted, 1);
    assert.equal(stats.ledgerEntriesDeleted, 1);
    assert.equal(stats.enrollmentsDeleted, 1);
    assert.equal(stats.simulationJobsDeleted, 1);
    assert.equal(stats.storesDeleted, 1);
    assert.equal(stats.storeTypesDeleted, 1);

    // Verify classroom is actually gone
    const classroomCheck = await Classroom.findById(classDoc._id);
    assert.equal(classroomCheck, null);
  });

  await t.test("canCreateClassroom and requireCanCreateClassroom statics", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    const mockOrg = {
      _id: orgId,
    };

    // Free limit is 3 classrooms (from planCatalog.js)
    // Create 3 active classrooms in this org
    await Classroom.create([
      { name: "C1", organization: orgId, ownership: ownerId, isActive: true, createdBy: "test", updatedBy: "test" },
      { name: "C2", organization: orgId, ownership: ownerId, isActive: true, createdBy: "test", updatedBy: "test" },
      { name: "C3", organization: orgId, ownership: ownerId, isActive: true, createdBy: "test", updatedBy: "test" }
    ]);

    // Check limit
    const decision = await Classroom.canCreateClassroom({ organization: mockOrg });
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "free_classroom_limit_reached");

    // requireCanCreateClassroom should throw
    await assert.rejects(
      Classroom.requireCanCreateClassroom({ organization: mockOrg }),
      /Your free classroom limit has been reached/
    );

    // If one is deactivated, it should allow creation
    await Classroom.updateOne({ name: "C3" }, { $set: { isActive: false } });

    const decision2 = await Classroom.canCreateClassroom({ organization: mockOrg });
    assert.equal(decision2.allowed, true);

    const decision3 = await Classroom.requireCanCreateClassroom({ organization: mockOrg });
    assert.equal(decision3.allowed, true);
  });

  await t.test("getClassroomSeatSummary static", async () => {
    const classId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();
    const u1 = new mongoose.Types.ObjectId();
    const u2 = new mongoose.Types.ObjectId();

    // Enroll users so their seat claims are considered active classroom claims
    await Enrollment.create([
      { classroomId: classId, userId: u1, role: "member", organization: orgId, createdBy: "test", updatedBy: "test" },
      { classroomId: classId, userId: u2, role: "member", organization: orgId, createdBy: "test", updatedBy: "test" }
    ]);

    // Create seat claims
    await SeatClaim.create([
      { classroomId: classId, userId: u1, status: "active", source: "stripe_student", organization: orgId, createdBy: "test", updatedBy: "test" },
      { classroomId: classId, userId: u2, status: "active", source: "teacher_assigned", organization: orgId, createdBy: "test", updatedBy: "test" }
    ]);

    // Create roster seats
    await RosterSeat.create([
      { classroomId: classId, email: "s1@example.com", status: "claimed", organization: orgId, createdBy: "test", updatedBy: "test" },
      { classroomId: classId, email: "s2@example.com", status: "reserved", organization: orgId, createdBy: "test", updatedBy: "test" },
      { classroomId: classId, email: "s3@example.com", status: "revoked", organization: orgId, createdBy: "test", updatedBy: "test" }
    ]);

    const summary = await Classroom.getClassroomSeatSummary(classId);
    assert.equal(summary.claimedSeats, 2);
    assert.equal(summary.roster.total, 3);
    assert.equal(summary.roster.claimed, 1);
    assert.equal(summary.roster.reserved, 1);
    assert.equal(summary.roster.revoked, 1);
  });
});

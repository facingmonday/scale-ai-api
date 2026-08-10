require("../lib/load-local-env")();
const mongoose = require("mongoose");
const Classroom = require("../services/classroom/classroom.model");
const Challenge = require("../services/challenge/challenge.model");
const Decision = require("../services/decision/decision.model");
const LedgerEntry = require("../services/ledger/ledger.model");
const Member = require("../services/members/member.model");
const Profile = require("../services/profile/profile.model");
const ProfileType = require("../services/profileType/profileType.model");
const AutomationTask = require("../services/ai/automationTask.model");
const AutomationTaskRun = require("../services/ai/automationTaskRun.model");
const ClassroomReport = require("../services/ai/classroomReport.model");
const GammaService = require("../services/ai/lib/gammaService");

async function runTest() {
  let uri = process.env.MONGO_URL || process.env.MONGO_URI;
  if (!uri && process.env.MONGO_SCHEME) {
    uri = `${process.env.MONGO_SCHEME}://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOSTNAME}/${process.env.MONGO_DB}?authSource=admin`;
  }
  if (!uri) {
    uri = "mongodb://localhost:27017/scale-ai-api";
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB!");

  // If no Gemini API keys are configured, stub the ADK runAgent method to allow the integration test to pass
  if (!process.env.GEMINI_API_KEY) {
    console.log("⚠️ No GEMINI_API_KEY found. Stubbing AutomationTaskRun.runAgent for testing.");
    AutomationTaskRun.runAgent = async (task, context) => {
      if (task.actionType === "GENERATE_SLIDES") {
        return {
          classSummary: "Mock class summary from stubbed runAgent",
          commonMistakes: ["Struggled with holding costs", "Over-ordered in week 1"],
          slideOutline: [
            {
              slideTitle: "Mock Profits & Inventory",
              bullets: ["Profits remained steady", "Holding costs were higher for standard retailers"],
              teachingTip: "Focus on EOQ in the next lecture"
            }
          ]
        };
      } else {
        return {
          outputText: "Mock markdown report/summary from stubbed runAgent"
        };
      }
    };
  }

  // Stub Gamma API to avoid needing a real GAMMA_API_KEY during tests
  if (!process.env.GAMMA_API_KEY) {
    console.log("⚠️ No GAMMA_API_KEY found. Stubbing GammaService.generateAndExport for testing.");
    // Set a fake key so the service branch triggers
    process.env.GAMMA_API_KEY = "test_gamma_key_stub";
    GammaService.generateAndExport = async (inputText, options) => {
      console.log(`🎨 [STUB] Gamma generateAndExport called with title: "${options?.title}", numCards: ${options?.numCards}`);
      return {
        generationId: "mock_gamma_gen_123",
        gammaId: "g_mock_abc123",
        gammaUrl: "https://gamma.app/docs/mock-presentation",
        exportUrl: "https://gamma.app/export/mock-presentation.pptx",
        credits: { deducted: 15, remaining: 485 },
      };
    };
  }


  let classroom, challenge, decision, ledgerEntry, automationTask, automationTaskPerStudent, profile, profileType;

  try {
    // 1. Get or create a Member for ownership/referencing
    let member = await Member.findOne();
    if (!member) {
      console.log("No member found, creating mock member...");
      member = new Member({
        clerkUserId: "user_test_clerk_123",
        firstName: "Test",
        lastName: "User",
        maskedEmail: "test@example.com",
        createdAt: new Date(),
      });
      await member.save();
    }
    console.log(`Using member ID: ${member._id}`);

    const orgId = new mongoose.Types.ObjectId();

    // 2. Create mock Classroom
    classroom = new Classroom({
      name: "Test Automation Classroom",
      ownership: member._id,
      billingMode: "student_paid",
      organization: orgId,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });
    await classroom.save();
    console.log(`Created mock Classroom: ${classroom._id}`);

    // 3. Create mock Challenge
    challenge = new Challenge({
      classroomId: classroom._id,
      title: "Test Automation Challenge",
      description: "Testing dynamic automation task lifecycles",
      isPublished: true,
      isClosed: true,
      week: 1,
      organization: orgId,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });
    await challenge.save();
    console.log(`Created mock Challenge: ${challenge._id}`);

    // Create mock ProfileType
    profileType = new ProfileType({
      classroomId: classroom._id,
      key: "standard_retailer",
      label: "Standard Retailer",
      description: "A simple retailer profile",
      organization: orgId,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });
    await profileType.save();
    console.log(`Created mock ProfileType: ${profileType._id}`);

    // 4. Create mock Student Profile
    profile = new Profile({
      classroomId: classroom._id,
      userId: member._id,
      studentId: "student_123",
      shopName: "Test Shop",
      storeDescription: "A mock retailer store description",
      storeLocation: "Urban",
      profileType: profileType._id,
      organization: orgId,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });
    await profile.save();
    console.log(`Created mock Profile: ${profile._id}`);

    // 5. Create mock Decision
    decision = new Decision({
      classroomId: classroom._id,
      challengeId: challenge._id,
      userId: member._id,
      processingStatus: "completed",
      organization: challenge.organization,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });
    await decision.save();
    console.log(`Created mock Decision: ${decision._id}`);

    // 6. Create mock LedgerEntry
    ledgerEntry = new LedgerEntry({
      classroomId: classroom._id,
      challengeId: challenge._id,
      decisionId: decision._id,
      userId: member._id,
      metrics: {
        profit: 250,
        inventoryCost: 35,
      },
      summary: "Simulated results for test automation",
      randomEvent: "Standard weather",
      aiMetadata: {
        model: "gemini-3.5-flash",
        runId: "test-run-id-123",
        generatedAt: new Date(),
      },
      organization: challenge.organization,
      createdBy: "system",
      updatedBy: "system",
    });
    await ledgerEntry.save();
    console.log(`Created mock LedgerEntry: ${ledgerEntry._id}`);

    // Link ledger entry back to decision
    decision.ledgerEntryId = ledgerEntry._id;
    await decision.save();

    // 7a. Create mock AutomationTask configuration (Classroom-wide)
    automationTask = new AutomationTask({
      classroomId: classroom._id,
      name: "Slide Deck Summarizer",
      trigger: "AFTER_CHALLENGE_CLOSED",
      promptTemplate: "Create a 2-slide overview of the class performance. Slide 1 should focus on profits, Slide 2 on lessons learned.",
      isActive: true,
      actionType: "GENERATE_SLIDES",
      organization: challenge.organization,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });
    await automationTask.save();
    console.log(`Created AutomationTask: ${automationTask._id}`);

    // 7b. Create mock AutomationTask configuration (Per Student)
    automationTaskPerStudent = new AutomationTask({
      classroomId: classroom._id,
      name: "Student Results Slide Deck",
      trigger: "AFTER_CHALLENGE_CLOSED_PER_STUDENT",
      promptTemplate: "Create a slide deck summarizing your individual results and comparisons.",
      isActive: true,
      actionType: "GENERATE_SLIDES",
      organization: challenge.organization,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });
    await automationTaskPerStudent.save();
    console.log(`Created AutomationTask Per Student: ${automationTaskPerStudent._id}`);

    // 8. Trigger task event
    console.log("Triggering AFTER_CHALLENGE_CLOSED...");
    const triggerResult = await AutomationTask.trigger("AFTER_CHALLENGE_CLOSED", {
      classroomId: classroom._id,
      challengeId: challenge._id,
      organizationId: challenge.organization,
      clerkUserId: member.clerkUserId,
    });

    console.log("Trigger result:", triggerResult);

    if (!triggerResult.success || triggerResult.count !== 2) {
      throw new Error(`Trigger failed: expected exactly 2 runs enqueued, got ${triggerResult.count}`);
    }

    // Match runs to their tasks
    let classroomRunId, studentRunId;
    for (const runId of triggerResult.runIds) {
      const r = await AutomationTaskRun.findById(runId);
      if (r.automationTaskId.toString() === automationTask._id.toString()) {
        classroomRunId = r._id;
      } else if (r.automationTaskId.toString() === automationTaskPerStudent._id.toString()) {
        studentRunId = r._id;
      }
    }

    if (!classroomRunId || !studentRunId) {
      throw new Error("Could not find enqueued runs for both tasks.");
    }

    // 9a. Execute classroom run
    console.log("Executing classroom task run synchronously...");
    const classroomExec = await AutomationTaskRun.executeTaskRun(classroomRunId);
    console.log("Classroom execution result:", classroomExec);
    if (!classroomExec.success) {
      throw new Error(`Classroom execution failed: ${classroomExec.error}`);
    }

    // 9b. Execute student run
    console.log("Executing student task run synchronously...");
    const studentExec = await AutomationTaskRun.executeTaskRun(studentRunId);
    console.log("Student execution result:", studentExec);
    if (!studentExec.success) {
      throw new Error(`Student execution failed: ${studentExec.error}`);
    }

    // 10. Verify results in DB
    const finalClassroomRun = await AutomationTaskRun.findById(classroomRunId);
    const finalStudentRun = await AutomationTaskRun.findById(studentRunId);

    if (finalClassroomRun.status !== "completed" || finalStudentRun.status !== "completed") {
      throw new Error(`Expected completed runs, got classroom: ${finalClassroomRun.status}, student: ${finalStudentRun.status}`);
    }

    const classroomReport = await ClassroomReport.findOne({
      classroomId: classroom._id,
      challengeId: challenge._id,
      reportType: "CUSTOM_TASK_OUTPUT",
      userId: null,
    });

    if (!classroomReport) {
      throw new Error("No ClassroomReport created for classroom task!");
    }
    if (classroomReport.visibility !== "everyone") {
      throw new Error(`Expected classroom report visibility 'everyone', got '${classroomReport.visibility}'`);
    }
    console.log("✅ ClassroomReport (everyone) created successfully!");

    const studentReport = await ClassroomReport.findOne({
      classroomId: classroom._id,
      challengeId: challenge._id,
      reportType: "CUSTOM_TASK_OUTPUT",
      userId: member._id,
    });

    if (!studentReport) {
      throw new Error("No ClassroomReport created for student task!");
    }
    if (studentReport.visibility !== "student") {
      throw new Error(`Expected student report visibility 'student', got '${studentReport.visibility}'`);
    }
    if (studentReport.userId.toString() !== member._id.toString()) {
      throw new Error(`Expected student report userId '${member._id}', got '${studentReport.userId}'`);
    }
    console.log("✅ ClassroomReport (student-private) created successfully!");

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n");

  } catch (error) {
    console.error("\n❌ TEST RUN ENCOUNTERED ERROR:\n", error);
  } finally {
    // Cleanup mock data
    console.log("Cleaning up mock database records...");
    if (classroom) {
      await Classroom.deleteOne({ _id: classroom._id });
      console.log("Deleted Classroom");
    }
    if (challenge) {
      await Challenge.deleteOne({ _id: challenge._id });
      console.log("Deleted Challenge");
    }
    if (profile) {
      await Profile.deleteOne({ _id: profile._id });
      console.log("Deleted Profile");
    }
    if (profileType) {
      await ProfileType.deleteOne({ _id: profileType._id });
      console.log("Deleted ProfileType");
    }
    if (decision) {
      await Decision.deleteOne({ _id: decision._id });
      console.log("Deleted Decision");
    }
    if (ledgerEntry) {
      await LedgerEntry.deleteOne({ _id: ledgerEntry._id });
      console.log("Deleted LedgerEntry");
    }
    if (automationTask) {
      await AutomationTask.deleteOne({ _id: automationTask._id });
      console.log("Deleted Classroom AutomationTask");
    }
    if (automationTaskPerStudent) {
      await AutomationTask.deleteOne({ _id: automationTaskPerStudent._id });
      console.log("Deleted Student AutomationTask");
    }
    // Delete any task runs or reports created during test
    if (classroom) {
      await AutomationTaskRun.deleteMany({ classroomId: classroom._id });
      await ClassroomReport.deleteMany({ classroomId: classroom._id });
      console.log("Deleted runs and reports");
    }

    await mongoose.connection.close();
    console.log("Database connection closed. Exiting test.");
  }
}

runTest();

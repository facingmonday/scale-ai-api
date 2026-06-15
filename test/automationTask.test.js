const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
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
const AutomationTaskService = require("../services/ai/automationTask.service");
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
    console.log("⚠️ No GEMINI_API_KEY found. Stubbing AutomationTaskService.runAgent for testing.");
    AutomationTaskService.runAgent = async (task, context) => {
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


  let classroom, challenge, decision, ledgerEntry, automationTask, profile, profileType;

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

    // 7. Create mock AutomationTask configuration
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

    // 8. Trigger task event
    console.log("Triggering AFTER_CHALLENGE_CLOSED...");
    const triggerResult = await AutomationTaskService.trigger("AFTER_CHALLENGE_CLOSED", {
      classroomId: classroom._id,
      challengeId: challenge._id,
      organizationId: challenge.organization,
      clerkUserId: member.clerkUserId,
    });

    console.log("Trigger result:", triggerResult);

    if (!triggerResult.success || triggerResult.count === 0) {
      throw new Error("Trigger failed to enqueue any automation runs");
    }

    const runId = triggerResult.runIds[0];
    console.log(`Enqueued Run ID: ${runId}`);

    // 9. Execute the task run synchronously (simulates background worker processing)
    console.log("Executing task run synchronously...");
    const executionResult = await AutomationTaskService.executeTaskRun(runId);
    console.log("Execution result:", executionResult);

    if (!executionResult.success) {
      throw new Error(`Execution failed: ${executionResult.error}`);
    }

    // 10. Verify results in DB
    const finalRun = await AutomationTaskRun.findById(runId);
    console.log("Final AutomationTaskRun Status:", finalRun.status);
    console.log("Final AutomationTaskRun Result:", JSON.stringify(finalRun.result, null, 2));

    if (finalRun.status !== "completed") {
      throw new Error(`Expected run status 'completed', got '${finalRun.status}'`);
    }

    const report = await ClassroomReport.findOne({
      classroomId: classroom._id,
      challengeId: challenge._id,
      reportType: "CUSTOM_TASK_OUTPUT",
    });

    if (!report) {
      throw new Error("No ClassroomReport created of type CUSTOM_TASK_OUTPUT!");
    }
    console.log("ClassroomReport found! Payload:", JSON.stringify(report.payload, null, 2));

    // Verify Gamma integration data is present
    if (report.payload?.gamma) {
      console.log("✅ Gamma integration data present:");
      console.log(`   gammaUrl: ${report.payload.gamma.gammaUrl}`);
      console.log(`   exportUrl: ${report.payload.gamma.exportUrl}`);
      console.log(`   generationId: ${report.payload.gamma.generationId}`);
    } else if (report.payload?.gammaError) {
      console.log(`⚠️ Gamma generation failed: ${report.payload.gammaError}`);
    } else {
      console.log("ℹ️ No Gamma data (GAMMA_API_KEY not configured or non-slides task)");
    }

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
      console.log("Deleted AutomationTask");
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

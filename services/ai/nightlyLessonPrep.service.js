const { LlmAgent, InMemoryRunner, stringifyContent } = require("@google/adk");
const Classroom = require("../classroom/classroom.model");
const Challenge = require("../challenge/challenge.model");
const LedgerEntry = require("../ledger/ledger.model");
const ClassroomReport = require("./classroomReport.model");

const lessonPrepAgent = new LlmAgent({
  name: "LessonPrepAssistant",
  model: "gemini-3.5-flash",
  description: "Nightly classroom simulation results analyzer.",
  instruction: `
    You are an expert supply chain analytics assistant.
    Your job is to analyze simulation round results for a classroom and generate:
    1. An overall summary of the performance of the class.
    2. Crucial common mistakes students made (e.g. extreme over-ordering, keeping high inventory, running out of stock).
    3. An outline for a 4-slide teaching deck the instructor can use in the next class to explain the results and key supply chain concepts.

    You MUST respond with a single valid JSON object containing exactly the following keys:
    {
      "classSummary": "string",
      "commonMistakes": ["string"],
      "slideOutline": [
        {
          "slideTitle": "string",
          "bullets": ["string"],
          "teachingTip": "string"
        }
      ]
    }
    Do NOT wrap the JSON in markdown code blocks. Output ONLY raw valid JSON.
  `
});

async function runNightlyLessonPrep(options = {}) {
  try {
    console.log("🌙 Running Nightly Lesson Prep Worker...");

    // Find all active classrooms
    const classrooms = await Classroom.find({ isActive: true }).lean();
    console.log(`Found ${classrooms.length} active classrooms to process.`);

    let processedCount = 0;

    for (const classroom of classrooms) {
      const classroomId = classroom._id;

      // Find the most recently closed challenge for this classroom
      const latestClosedChallenge = await Challenge.findOne({
        classroomId,
        isClosed: true
      })
      .sort({ endDate: -1 })
      .lean();

      if (!latestClosedChallenge) {
        console.log(`No closed challenges found for classroom ${classroom.name}. Skipping.`);
        continue;
      }

      // Check if a nightly lesson report was already generated for this challenge
      const existingReport = await ClassroomReport.findOne({
        classroomId,
        challengeId: latestClosedChallenge._id,
        reportType: "NIGHTLY_LESSON_PREP"
      }).select("_id").lean();

      if (existingReport && !options.force) {
        console.log(`Report already exists for challenge "${latestClosedChallenge.title}" in classroom ${classroom.name}. Skipping.`);
        continue;
      }

      console.log(`Analyzing challenge "${latestClosedChallenge.title}" for classroom ${classroom.name}...`);

      // Get all ledger entries for this challenge (which have the metrics)
      const ledgerEntries = await LedgerEntry.find({
        classroomId,
        challengeId: latestClosedChallenge._id
      }).lean();

      if (ledgerEntries.length === 0) {
        console.log(`No student outcomes found for challenge "${latestClosedChallenge.title}". Skipping.`);
        continue;
      }

      // Format ledger entries for prompt payload
      const formattedLedgers = ledgerEntries.map(entry => {
        const metrics = entry.metrics instanceof Map ? Object.fromEntries(entry.metrics) : entry.metrics;
        return {
          studentId: entry.userId,
          metrics,
          summary: entry.summary,
          randomEvent: entry.randomEvent
        };
      });

      const inputPayload = {
        classroomName: classroom.name,
        challengeTitle: latestClosedChallenge.title,
        challengeDescription: latestClosedChallenge.description,
        totalSubmissions: formattedLedgers.length,
        studentOutcomes: formattedLedgers
      };

      const prompt = `Here is the simulation data for the closed round:\n${JSON.stringify(inputPayload, null, 2)}`;

      const runner = new InMemoryRunner({
        agent: lessonPrepAgent,
        appName: "NightlyLessonPrepRunner",
      });

      const eventStream = runner.runEphemeral({
        userId: "system",
        newMessage: {
          role: "user",
          parts: [{ text: prompt }]
        }
      });

      let responseText = "";
      for await (const event of eventStream) {
        if (event.author === "model") {
          responseText += stringifyContent(event);
        }
      }

      // Clean up response text in case it wrapped it in markdown code blocks
      let cleanJsonText = responseText.trim();
      if (cleanJsonText.startsWith("```")) {
        cleanJsonText = cleanJsonText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      let parsedReport;
      try {
        parsedReport = JSON.parse(cleanJsonText);
      } catch (parseError) {
        console.error(`Failed to parse AI output for ${classroom.name}:`, parseError.message);
        console.error("Raw response:", responseText);
        continue;
      }

      // Upsert ClassroomReport
      await ClassroomReport.findOneAndUpdate(
        {
          classroomId,
          challengeId: latestClosedChallenge._id,
          reportType: "NIGHTLY_LESSON_PREP"
        },
        {
          $set: {
            payload: parsedReport,
            updatedBy: "system",
            updatedDate: new Date()
          },
          $setOnInsert: {
            createdBy: "system",
            createdDate: new Date()
          }
        },
        { upsert: true, new: true }
      );

      console.log(`Successfully generated and saved nightly report for classroom: ${classroom.name}`);
      processedCount++;
    }

    return { success: true, processedCount };

  } catch (error) {
    console.error("Error running runNightlyLessonPrep worker:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  runNightlyLessonPrep
};

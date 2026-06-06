const { LlmAgent, InMemoryRunner, stringifyContent } = require("@google/adk");
const AutomationTask = require("./automationTask.model");
const AutomationTaskRun = require("./automationTaskRun.model");
const ClassroomReport = require("./classroomReport.model");
const Classroom = require("../classroom/classroom.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const LedgerEntry = require("../ledger/ledger.model");
const Profile = require("../profile/profile.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");
const SimulationJob = require("../job/job.model");
class AutomationTaskService {
  /**
   * Trigger automation tasks of a specific lifecycle type
   * @param {string} triggerType - The trigger enum value
   * @param {Object} data - Payload parameters (classroomId, challengeId, etc.)
   */
  static async trigger(triggerType, data) {
    try {
      const { enqueueAutomationTaskRun } = require("../../lib/queues/automation-task-worker");
      const { classroomId, challengeId, decisionId, userId, organizationId, clerkUserId } = data;
      if (!classroomId || !challengeId) {
        throw new Error("classroomId and challengeId are required to trigger automation tasks");
      }

      console.log(`📡 Triggering tasks for classroom: ${classroomId}, challenge: ${challengeId}, event: ${triggerType}`);

      // Find all active automation tasks for this classroom and trigger
      const activeTasks = await AutomationTask.find({
        classroomId,
        trigger: triggerType,
        isActive: true,
      }).lean();

      if (activeTasks.length === 0) {
        console.log(`No active automation tasks configured for event "${triggerType}" in classroom ${classroomId}`);
        return { success: true, count: 0 };
      }

      console.log(`Found ${activeTasks.length} active automation tasks to process.`);

      const enqueuedRuns = [];

      for (const task of activeTasks) {
        // Create an AutomationTaskRun audit log in 'pending' status
        const run = new AutomationTaskRun({
          automationTaskId: task._id,
          classroomId,
          challengeId,
          decisionId: decisionId || null,
          userId: userId || null,
          status: "pending",
          organization: organizationId || task.organization,
          createdBy: clerkUserId || "system",
          updatedBy: clerkUserId || "system",
        });

        await run.save();

        // Enqueue Bull queue job
        await enqueueAutomationTaskRun(run._id);
        enqueuedRuns.push(run._id);
      }

      return { success: true, count: enqueuedRuns.length, runIds: enqueuedRuns };
    } catch (error) {
      console.error(`Error in AutomationTaskService.trigger for ${triggerType}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute an individual AutomationTaskRun
   * @param {string} runId - AutomationTaskRun document ID
   */
  static async executeTaskRun(runId) {
    let run;
    try {
      run = await AutomationTaskRun.findById(runId);
      if (!run) {
        throw new Error(`AutomationTaskRun not found: ${runId}`);
      }

      if (run.status !== "pending") {
        console.log(`AutomationTaskRun ${runId} is already in status: ${run.status}. Skipping.`);
        return { success: true, skipped: true };
      }

      // Mark running
      run.status = "running";
      await run.save();

      // Retrieve configured task
      const task = await AutomationTask.findById(run.automationTaskId);
      if (!task) {
        throw new Error(`Associated AutomationTask not found for run ${runId}`);
      }

      console.log(`🤖 Running custom agentic task: "${task.name}" (${task.actionType}) for challenge ${run.challengeId}`);

      // 1. Gather context payload based on trigger type
      const context = await this.buildPromptContext(task.trigger, run);

      // 2. Invoke the Google ADK LLM agent
      const agentResult = await this.runAgent(task, context);

      // 3. Handle outputs based on actionType
      if (task.actionType === "GENERATE_SLIDES" || task.actionType === "GENERATE_REPORT") {
        // Save output to classroom report vault
        await ClassroomReport.findOneAndUpdate(
          {
            classroomId: run.classroomId,
            challengeId: run.challengeId,
            reportType: "CUSTOM_TASK_OUTPUT",
            // Uniquely identify custom report per task
            createdBy: task._id.toString(),
          },
          {
            $set: {
              payload: agentResult,
              updatedBy: "system",
              updatedDate: new Date(),
            },
            $setOnInsert: {
              organization: run.organization || task.organization,
              createdBy: task._id.toString(), // Store task reference here
              createdDate: new Date(),
            },
          },
          { upsert: true, new: true }
        );
        console.log(`Saved output of "${task.name}" as ClassroomReport.`);
      } else if (task.actionType === "SEND_NOTIFICATION") {
        // Create custom notification in database
        const Notification = require("../notifications/notifications.model");
        const classroom = await Classroom.findById(run.classroomId).lean();
        
        await Notification.create({
          type: "email",
          recipient: {
            id: run.userId || run.createdBy,
            type: "Member",
            ref: "Member",
          },
          title: `Automation Alert: ${task.name}`,
          message: agentResult.outputText || JSON.stringify(agentResult),
          templateSlug: "custom-automation-alert",
          templateData: {
            taskName: task.name,
            classroomName: classroom?.name || "Classroom",
            message: agentResult.outputText || JSON.stringify(agentResult),
          },
          organization: run.organization,
          createdBy: "system",
          updatedBy: "system",
        });
        console.log(`Dispatched custom notification alert for "${task.name}".`);
      }

      // 4. Mark completed
      run.status = "completed";
      run.result = agentResult;
      run.error = null;
      await run.save();

      return { success: true, runId: run._id };
    } catch (error) {
      console.error(`Error executing AutomationTaskRun ${runId}:`, error);
      if (run) {
        run.status = "failed";
        run.error = error.message;
        await run.save();
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Build the execution context based on the task trigger event type
   */
  static async buildPromptContext(trigger, run) {
    const classroom = await Classroom.findById(run.classroomId).lean();
    if (!classroom) throw new Error("Classroom not found");

    const challenge = await Challenge.findById(run.challengeId).lean();
    if (!challenge) throw new Error("Challenge not found");

    const context = {
      classroomName: classroom.name,
      challengeTitle: challenge.title,
      challengeDescription: challenge.description,
      triggerEvent: trigger,
    };

    if (trigger === "AFTER_CHALLENGE_CREATED") {
      context.variables = challenge.variables || {};
      return context;
    }

    if (trigger === "AFTER_STUDENT_SUBMISSION") {
      const decision = await Decision.findById(run.decisionId).lean();
      if (!decision) throw new Error(`Decision not found: ${run.decisionId}`);

      const ProfileModel = require("../profile/profile.model");
      const profile = await ProfileModel.findOne({ classroomId: run.classroomId, userId: decision.userId }).lean();
      
      const Member = require("../members/member.model");
      const student = await Member.findById(decision.userId).select("firstName lastName maskedEmail").lean();

      context.student = {
        name: student ? `${student.firstName} ${student.lastName}` : "Unknown Student",
        shopName: profile?.shopName || "Unknown Shop",
        profileType: profile?.profileTypeLabel || profile?.profileType?.label || "Unknown Type",
      };
      context.submissionVariables = decision.variables || {};
      return context;
    }

    if (trigger === "AFTER_CHALLENGE_CLOSED") {
      // 1. Gather all student submissions for this challenge
      const allSubmissions = await Decision.getSubmissionsByScenario(run.challengeId);
      
      // 2. Fetch profiles to attach
      const submissionsWithStores = await Promise.all(
        allSubmissions.map(async (decision) => {
          const profile = await Profile.getStoreByUser(run.classroomId, decision.userId);
          return {
            ...decision,
            profile,
          };
        })
      );

      // 3. Compute store type stats using static method
      const metricDefinitions = await MetricDefinition.getActive(run.classroomId);
      const storeTypeStats = await Challenge.getStoreTypeStats(submissionsWithStores, metricDefinitions);

      context.totalStudents = submissionsWithStores.length;
      context.studentOutcomes = submissionsWithStores.map(sub => {
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

    throw new Error(`Unsupported trigger type: ${trigger}`);
  }

  /**
   * Invoke the Google ADK LLM agent to process the prompt template and context
   */
  static async runAgent(task, context) {
    const isSlides = task.actionType === "GENERATE_SLIDES";

    const agentInstruction = `
      You are an expert supply chain analytics assistant.
      Your task is to review simulation results and data for a classroom challenge and execute the following request:
      "${task.promptTemplate}"

      ${isSlides ? `
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
      ` : `
      You MUST respond with a single valid JSON object containing exactly the following key:
      {
        "outputText": "string" // Containing your markdown report, summary, alert message or response text
      }
      Do NOT wrap the JSON in markdown code blocks. Output ONLY raw valid JSON.
      `}
    `;

    const agent = new LlmAgent({
      name: "AutomationAgent",
      model: "gemini-3.5-flash",
      description: "Generates custom teaching assets and reports dynamically.",
      instruction: agentInstruction,
    });

    const prompt = `Here is the current classroom and simulation context:\n${JSON.stringify(context, null, 2)}`;

    const runner = new InMemoryRunner({
      agent,
      appName: "AutomationTaskRunner",
    });

    const eventStream = runner.runEphemeral({
      userId: "system",
      newMessage: {
        role: "user",
        parts: [{ text: prompt }],
      },
    });

    let responseText = "";
    for await (const event of eventStream) {
      if (event.author === "model") {
        responseText += stringifyContent(event);
      }
    }

    let cleanJsonText = responseText.trim();
    if (cleanJsonText.startsWith("```")) {
      cleanJsonText = cleanJsonText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    try {
      return JSON.parse(cleanJsonText);
    } catch (parseError) {
      console.error(`Failed to parse AI automation output as JSON:`, parseError.message);
      console.error("Raw LLM response:", responseText);
      // Fallback
      return { outputText: responseText };
    }
  }
}

module.exports = AutomationTaskService;

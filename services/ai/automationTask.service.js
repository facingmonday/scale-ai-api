const { LlmAgent, InMemoryRunner, stringifyContent } = require("@google/adk");
const AutomationTask = require("./automationTask.model");
const AutomationTaskRun = require("./automationTaskRun.model");
const ClassroomReport = require("./classroomReport.model");
const Classroom = require("../classroom/classroom.model");
const { PromptContextBuilderFactory } = require("./lib/promptContextBuilders");
const GammaService = require("./lib/gammaService");
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
        // For GENERATE_SLIDES, send AI output to Gamma for polished PPTX generation
        if (task.actionType === "GENERATE_SLIDES" && process.env.GAMMA_API_KEY) {
          try {
            const inputText = this.formatSlideOutlineForGamma(agentResult);
            const Challenge = require("../challenge/challenge.model");
            const challenge = await Challenge.findById(run.challengeId).lean();
            const gammaResult = await GammaService.generateAndExport(inputText, {
              title: `${task.name}${challenge?.week ? ` — Week ${challenge.week}` : ""}`,
              numCards: agentResult.slideOutline?.length || 8,
            });
            agentResult.gamma = gammaResult;
            console.log(`🎨 Gamma presentation ready: ${gammaResult.exportUrl}`);
          } catch (gammaError) {
            console.error(`⚠️ Gamma generation failed, saving AI output only:`, gammaError.message);
            agentResult.gammaError = gammaError.message;
          }
        }

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
    const builder = PromptContextBuilderFactory.getBuilder(trigger, run);
    return builder.build();
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

  /**
   * Convert the AI agent's structured slideOutline into markdown text
   * suitable for Gamma's inputText parameter
   */
  static formatSlideOutlineForGamma(agentResult) {
    const lines = [];

    if (agentResult.classSummary) {
      lines.push(`# ${agentResult.classSummary}`);
      lines.push("");
    }

    if (agentResult.commonMistakes?.length) {
      lines.push("## Common Mistakes");
      for (const mistake of agentResult.commonMistakes) {
        lines.push(`- ${mistake}`);
      }
      lines.push("");
    }

    if (agentResult.slideOutline?.length) {
      for (const slide of agentResult.slideOutline) {
        lines.push(`## ${slide.slideTitle}`);
        if (slide.bullets?.length) {
          for (const bullet of slide.bullets) {
            lines.push(`- ${bullet}`);
          }
        }
        if (slide.teachingTip) {
          lines.push(``);
          lines.push(`> Teaching Tip: ${slide.teachingTip}`);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }
}

module.exports = AutomationTaskService;

const mongoose = require("mongoose");
const { LlmAgent, InMemoryRunner, stringifyContent } = require("@google/adk");
const baseSchema = require("../../lib/baseSchema");
const ClassroomReport = require("./classroomReport.model");
const Classroom = require("../classroom/classroom.model");
const { PromptContextBuilderFactory } = require("./lib/promptContextBuilders");
const GammaService = require("./lib/gammaService");

const automationTaskRunSchema = new mongoose.Schema({
  automationTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AutomationTask",
    required: true,
    index: true,
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Challenge",
    required: true,
    index: true,
  },
  decisionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Decision",
    required: false,
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: false,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "running", "completed", "failed"],
    default: "pending",
    required: true,
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  error: {
    type: String,
    default: null,
  },
  runTime: {
    type: Date,
    default: Date.now,
  },
}).add(baseSchema);

/**
 * Execute an individual AutomationTaskRun
 * @param {string} runId - AutomationTaskRun document ID
 */
automationTaskRunSchema.statics.executeTaskRun = async function (runId) {
  let run;
  try {
    run = await this.findById(runId);
    if (!run) {
      throw new Error(`AutomationTaskRun not found: ${runId}`);
    }

    if (run.status !== "pending") {
      console.log(
        `AutomationTaskRun ${runId} is already in status: ${run.status}. Skipping.`,
      );
      return { success: true, skipped: true };
    }

    run.status = "running";
    await run.save();

    const AutomationTask = require("./automationTask.model");
    const task = await AutomationTask.findById(run.automationTaskId);
    if (!task) {
      throw new Error(`Associated AutomationTask not found for run ${runId}`);
    }

    console.log(
      `🤖 Running custom agentic task: "${task.name}" (${task.actionType}) for challenge ${run.challengeId}`,
    );

    const context = await this.buildPromptContext(task.trigger, run);
    const agentResult = await this.runAgent(task, context);

    if (
      task.actionType === "GENERATE_SLIDES" ||
      task.actionType === "GENERATE_REPORT"
    ) {
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
          console.error(
            `⚠️ Gamma generation failed, saving AI output only:`,
            gammaError.message,
          );
          agentResult.gammaError = gammaError.message;
        }
      }

      const Tag = require("../tags/tags.model");
      const slugify = require("slugify");
      const tagSlug = "classroom-report";
      let tagDoc = await Tag.findOne({
        classroomId: run.classroomId,
        slug: tagSlug,
      });
      if (!tagDoc) {
        tagDoc = await Tag.create({
          title: "Classroom Report",
          slug: tagSlug,
          description: "AI Generated Classroom Reports",
          color: "#e28743",
          type: "file",
          classroomId: run.classroomId,
          organization: run.organization || task.organization,
          createdBy: "system",
          updatedBy: "system",
        });
      }

      const isStudentTask = !!run.userId;
      await ClassroomReport.findOneAndUpdate(
        {
          classroomId: run.classroomId,
          challengeId: run.challengeId,
          reportType: "CUSTOM_TASK_OUTPUT",
          createdBy: task._id.toString(),
          userId: isStudentTask ? run.userId : null,
        },
        {
          $set: {
            title: isStudentTask ? `${task.name} (${context.student?.name || "Student"})` : task.name,
            name: isStudentTask
              ? `${slugify(task.name, { lower: true, strict: true })}-${run.userId}.json`
              : `${slugify(task.name, { lower: true, strict: true })}.json`,
            type: "report",
            tags: [tagDoc._id],
            visibility: isStudentTask ? "student" : "everyone",
            userId: isStudentTask ? run.userId : null,
            payload: agentResult,
            updatedBy: "system",
            updatedDate: new Date(),
          },
          $setOnInsert: {
            organization: run.organization || task.organization,
            createdBy: task._id.toString(),
            createdDate: new Date(),
          },
        },
        { upsert: true, new: true },
      );
      console.log(`Saved output of "${task.name}" as ClassroomReport.`);
    } else if (task.actionType === "SEND_NOTIFICATION") {
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
};

/**
 * Build the execution context based on the task trigger event type
 */
automationTaskRunSchema.statics.buildPromptContext = async function (
  trigger,
  run,
) {
  const builder = PromptContextBuilderFactory.getBuilder(trigger, run);
  return builder.build();
};

/**
 * Invoke the Google ADK LLM agent to process the prompt template and context
 */
automationTaskRunSchema.statics.runAgent = async function (task, context) {
  const isSlides = task.actionType === "GENERATE_SLIDES";

  const agentInstruction = `
      You are an expert supply chain analytics assistant.
      Your task is to review simulation results and data for a classroom challenge and execute the following request:
      "${task.promptTemplate}"

      ${
        isSlides
          ? `
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
          : `
      You MUST respond with a single valid JSON object containing exactly the following key:
      {
        "outputText": "string" // Containing your markdown report, summary, alert message or response text
      }
      Do NOT wrap the JSON in markdown code blocks. Output ONLY raw valid JSON.
      `
      }
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
    cleanJsonText = cleanJsonText
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim();
  }

  try {
    return JSON.parse(cleanJsonText);
  } catch (parseError) {
    console.error(
      `Failed to parse AI automation output as JSON:`,
      parseError.message,
    );
    console.error("Raw LLM response:", responseText);
    return { outputText: responseText };
  }
};

/**
 * Convert the AI agent's structured slideOutline into markdown text
 * suitable for Gamma's inputText parameter
 */
automationTaskRunSchema.statics.formatSlideOutlineForGamma = function (
  agentResult,
) {
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
};

module.exports = mongoose.model("AutomationTaskRun", automationTaskRunSchema);

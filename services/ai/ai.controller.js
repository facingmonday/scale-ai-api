const { LlmAgent, InMemoryRunner, createEvent, stringifyContent } = require("@google/adk");
const ChatMessage = require("./chat.model");
const ClassroomReport = require("./classroomReport.model");
const AutomationTask = require("./automationTask.model");
const AutomationTaskRun = require("./automationTaskRun.model");
const tools = require("./tools");

// Define Student Agent (Tutor)
const studentAgent = new LlmAgent({
  name: "StudentTutor",
  model: "gemini-3.5-flash",
  description: "Personalized AI coach and tutor for students in supply chain simulations.",
  instruction: `
    You are an expert supply chain tutor and coach.
    Your goal is to help the student understand why their simulation metrics (profits, stockouts, holding costs, etc.) changed.
    Use the Socratic method: ask guiding questions, explain underlying supply chain principles (e.g., bullwhip effect, Economic Order Quantity, lead times), and help them interpret demand signals.
    CRITICAL RULES:
    1. NEVER give away the exact optimal values or inputs they should submit. Instead, coach them on the formulas, calculations, or logic to estimate them.
    2. You only have access to information about this student's own shop and performance. Never discuss other students.
    3. Keep responses highly structured, readable, and encouraging.
  `,
  tools: [
    tools.getStudentProfile,
    tools.getStudentSubmissions,
    tools.getStudentLedgerEntries,
    tools.getScenarioDetails
  ]
});

// Define Teacher Agent (Assistant)
const teacherAgent = new LlmAgent({
  name: "TeacherAssistant",
  model: "gemini-3.5-flash",
  description: "Classroom analyst and teaching assistant for instructors.",
  instruction: `
    You are a classroom assistant for instructors.
    Your job is to provide analytical reports of simulation rounds, identify students who are struggling (e.g., high inventory costs, low profits, stockouts), and answer questions about classroom-wide performance.
    You have full access to classroom summaries, roster data, and individual student submissions.
    Use this data to help teachers prepare lessons, highlight classroom trends, and review individual student profiles when requested.
  `,
  tools: [
    tools.getClassroomSummary,
    tools.getClassRoster,
    tools.getStudentProfile,
    tools.getStudentSubmissions,
    tools.getStudentLedgerEntries,
    tools.getScenarioDetails
  ]
});

exports.chat = async function (req, res) {
  try {
    const { prompt } = req.body;
    const userId = req.user._id;
    const classroomId = req.activeClassroom._id;
    const isTeacher = req.classroomRole === "admin";

    if (!prompt) {
      return res.status(400).send("Prompt is required");
    }

    // 1. Fetch DB Chat history (limit to last 20 messages for context window management)
    const dbHistory = await ChatMessage.find({ classroomId, userId })
      .sort({ createdDate: -1 })
      .limit(20)
      .lean();
    
    // Sort chronologically
    dbHistory.reverse();

    const history = dbHistory.map(msg => ({
      role: msg.role === "model" ? "model" : "user",
      content: msg.content
    }));

    // Save the new user prompt to history
    await ChatMessage.create({
      classroomId,
      userId,
      role: "user",
      content: prompt,
      organization: req.organization?._id || req.activeClassroom.organization,
      createdBy: userId.toString(),
      updatedBy: userId.toString(),
    });

    history.push({ role: "user", content: prompt });

    // 2. Select agent based on role
    const agent = isTeacher ? teacherAgent : studentAgent;

    // 3. Setup SSE streaming headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const runner = new InMemoryRunner({
      agent,
      appName: "AIChatRunner",
    });

    const session = await runner.sessionService.createSession({
      appName: "AIChatRunner",
      userId: userId.toString(),
    });

    // Populate history (except the last message, which we will pass as newMessage)
    for (let i = 0; i < history.length - 1; i++) {
      const msg = history[i];
      await runner.sessionService.appendEvent({
        session,
        event: createEvent({
          author: msg.role === "model" ? "model" : "user",
          content: {
            role: msg.role === "model" ? "model" : "user",
            parts: [{ text: msg.content }]
          }
        })
      });
    }

    const lastMsg = history[history.length - 1];
    const eventStream = runner.runAsync({
      userId: userId.toString(),
      sessionId: session.id,
      newMessage: {
        role: "user",
        parts: [{ text: lastMsg.content }]
      }
    });

    let fullResponse = "";

    for await (const event of eventStream) {
      if (event.partial) {
        const text = stringifyContent(event);
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
    }

    // 4. Save the full model response to DB
    await ChatMessage.create({
      classroomId,
      userId,
      role: "model",
      content: fullResponse,
      organization: req.organization?._id || req.activeClassroom.organization,
      createdBy: "system",
      updatedBy: "system",
    });

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (error) {
    console.error("Error in AI Chat assistant:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

exports.getChatHistory = async function (req, res) {
  try {
    const classroomId = req.activeClassroom._id;
    const userId = req.user._id;

    const history = await ChatMessage.find({ classroomId, userId })
      .sort({ createdDate: 1 })
      .lean();

    res.status(200).json({ history });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getClassroomReports = async function (req, res) {
  try {
    const classroomId = req.activeClassroom._id;
    const reports = await ClassroomReport.find({ classroomId })
      .populate("challengeId")
      .sort({ createdDate: -1 })
      .lean();

    const formattedReports = reports.map(report => ({
      _id: report._id,
      challengeTitle: report.challengeId?.title || "Classroom Report",
      challengeId: report.challengeId?._id || null,
      reportType: report.reportType,
      payload: report.payload,
      createdDate: report.createdDate
    }));

    res.status(200).json({ reports: formattedReports });
  } catch (error) {
    console.error("Error fetching classroom reports:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /v1/ai/automation-tasks
exports.getAutomationTasks = async function (req, res) {
  try {
    const classroomId = req.activeClassroom._id;
    const tasks = await AutomationTask.find({ classroomId }).sort({ createdDate: -1 }).lean();
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    console.error("Error fetching automation tasks:", error);
    res.status(500).json({ error: error.message });
  }
};

// POST /v1/ai/automation-tasks
exports.createAutomationTask = async function (req, res) {
  try {
    if (req.classroomRole !== "admin") {
      return res.status(403).json({ error: "Only admins/teachers can manage automation tasks" });
    }

    const classroomId = req.activeClassroom._id;
    const { name, trigger, promptTemplate, isActive, actionType, config } = req.body;

    if (!name || !trigger || !promptTemplate) {
      return res.status(400).json({ error: "name, trigger, and promptTemplate are required" });
    }

    const task = new AutomationTask({
      classroomId,
      name,
      trigger,
      promptTemplate,
      isActive: isActive !== undefined ? isActive : true,
      actionType: actionType || "CUSTOM_PROMPT",
      config: config || {},
      organization: req.organization?._id || req.activeClassroom.organization,
      createdBy: req.clerkUser.id,
      updatedBy: req.clerkUser.id,
    });

    await task.save();
    res.status(201).json({ success: true, task });
  } catch (error) {
    console.error("Error creating automation task:", error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /v1/ai/automation-tasks/:id
exports.updateAutomationTask = async function (req, res) {
  try {
    if (req.classroomRole !== "admin") {
      return res.status(403).json({ error: "Only admins/teachers can manage automation tasks" });
    }

    const { id } = req.params;
    const classroomId = req.activeClassroom._id;

    const task = await AutomationTask.findOne({ _id: id, classroomId });
    if (!task) {
      return res.status(404).json({ error: "Automation task not found" });
    }

    const updatableFields = ["name", "trigger", "promptTemplate", "isActive", "actionType", "config"];
    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    task.updatedBy = req.clerkUser.id;
    task.updatedDate = new Date();

    await task.save();
    res.status(200).json({ success: true, task });
  } catch (error) {
    console.error("Error updating automation task:", error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE /v1/ai/automation-tasks/:id
exports.deleteAutomationTask = async function (req, res) {
  try {
    if (req.classroomRole !== "admin") {
      return res.status(403).json({ error: "Only admins/teachers can manage automation tasks" });
    }

    const { id } = req.params;
    const classroomId = req.activeClassroom._id;

    const result = await AutomationTask.deleteOne({ _id: id, classroomId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Automation task not found" });
    }

    // Clean up associated task runs
    await AutomationTaskRun.deleteMany({ automationTaskId: id });

    res.status(200).json({ success: true, message: "Automation task deleted successfully" });
  } catch (error) {
    console.error("Error deleting automation task:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /v1/ai/automation-tasks/runs
exports.getAutomationTaskRuns = async function (req, res) {
  try {
    if (req.classroomRole !== "admin") {
      return res.status(403).json({ error: "Only admins/teachers can view task runs" });
    }

    const classroomId = req.activeClassroom._id;
    const runs = await AutomationTaskRun.find({ classroomId })
      .populate("automationTaskId", "name trigger actionType")
      .populate("challengeId", "title")
      .sort({ runTime: -1 })
      .lean();

    res.status(200).json({ success: true, runs });
  } catch (error) {
    console.error("Error fetching automation task runs:", error);
    res.status(500).json({ error: error.message });
  }
};

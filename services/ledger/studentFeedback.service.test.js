const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const {
  buildStudentFeedbackRequest,
  generateStudentFeedback,
} = require("./studentFeedback.service");

test("feedback requests contain only student-safe labeled context", () => {
  const request = buildStudentFeedbackRequest({
    summary: "Sales improved.",
    outcomeNotes: "Demand increased.",
    metrics: { profit: 120 },
    decisionVariables: { price: 8 },
    hiddenNotes: "teacher-only note",
    prompt: "internal simulation prompt",
    otherStudents: [{ name: "Other Student" }],
  });
  const requestText = JSON.stringify(request);

  assert.equal(requestText.includes("Sales improved."), true);
  assert.equal(requestText.includes("teacher-only note"), false);
  assert.equal(requestText.includes("internal simulation prompt"), false);
  assert.equal(requestText.includes("Other Student"), false);
});

test("guidance generation failures are persisted as non-throwing failures", async () => {
  const feedback = await generateStudentFeedback(
    { summary: "A valid result" },
    {
      openaiClient: {
        chat: {
          completions: {
            create: async () => {
              throw new Error("temporary guidance outage");
            },
          },
        },
      },
    },
  );

  assert.equal(feedback.status, "failed");
  assert.deepEqual(feedback.nextActions, []);
  assert.match(feedback.error, /temporary guidance outage/);
});

test("completed guidance returns two or three structured next actions", async () => {
  const feedback = await generateStudentFeedback(
    { summary: "A valid result" },
    {
      openaiClient: {
        chat: {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      keyDrivers: [
                        {
                          title: "Pricing",
                          explanation: "The selected price supported demand.",
                          impact: "positive",
                          source: "decision",
                        },
                        {
                          title: "Cash position",
                          explanation: "Starting cash supported flexibility.",
                          impact: "neutral",
                          source: "prior_result",
                        },
                      ],
                      nextActions: [
                        { title: "Test inventory", rationale: "Reduce stockouts." },
                        { title: "Watch cash", rationale: "Protect flexibility." },
                        { title: "Review price", rationale: "Balance margin and demand." },
                      ],
                    }),
                  },
                },
              ],
            }),
          },
        },
      },
    },
  );

  assert.equal(feedback.status, "completed");
  assert.equal(feedback.nextActions.length, 3);
  assert.equal(feedback.keyDrivers[0].source, "decision");
});

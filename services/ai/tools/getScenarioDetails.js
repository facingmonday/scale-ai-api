const { FunctionTool } = require("@google/adk");
const { z } = require("zod");
const Challenge = require("../../challenge/challenge.model");

const getScenarioDetails = new FunctionTool({
  name: "get_scenario_details",
  description: "Fetches details of a specific simulation challenge/scenario in the classroom.",
  parameters: z.object({
    classroomId: z.string().describe("The ID of the classroom."),
    challengeId: z.string().describe("The ID of the scenario/challenge."),
  }),
  execute: async ({ classroomId, challengeId }) => {
    try {
      const challenge = await Challenge.findOne({ classroomId, _id: challengeId }).lean();
      if (!challenge) return { success: false, error: "Scenario not found" };
      return { success: true, scenario: challenge };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
});

module.exports = getScenarioDetails;

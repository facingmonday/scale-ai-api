const { FunctionTool } = require("@google/adk");
const { z } = require("zod");
const mongoose = require("mongoose");
const LedgerEntry = require("../../ledger/ledger.model");

const getClassroomSummary = new FunctionTool({
  name: "get_classroom_summary",
  description: "Teacher Only: Fetches aggregated classroom performance, including average profits and submission completion statistics.",
  parameters: z.object({
    classroomId: z.string().describe("The ID of the classroom."),
  }),
  execute: async ({ classroomId }) => {
    try {
      const stats = await LedgerEntry.aggregate([
        { $match: { classroomId: new mongoose.Types.ObjectId(classroomId), challengeId: { $ne: null } } },
        {
          $group: {
            _id: "$challengeId",
            avgProfit: { $avg: "$metrics.profit" },
            minProfit: { $min: "$metrics.profit" },
            maxProfit: { $max: "$metrics.profit" },
            totalStudents: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: "challenges",
            localField: "_id",
            foreignField: "_id",
            as: "challenge"
          }
        },
        { $unwind: "$challenge" },
        {
          $project: {
            scenarioTitle: "$challenge.title",
            avgProfit: 1,
            minProfit: 1,
            maxProfit: 1,
            totalStudents: 1
          }
        }
      ]);
      return { success: true, summary: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
});

module.exports = getClassroomSummary;

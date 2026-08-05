const { FunctionTool } = require("@google/adk");
const { z } = require("zod");
const mongoose = require("mongoose");
const LedgerEntry = require("../../ledger/ledger.model");

const getStudentLedgerEntries = new FunctionTool({
  name: "get_student_ledger_entries",
  description: "Fetches all simulation results, metrics, profits, and weekly outputs recorded for a specific student.",
  parameters: z.object({
    classroomId: z.string().describe("The ID of the classroom."),
    studentMemberId: z.string().describe("The Member ID of the student."),
  }),
  execute: async ({ classroomId, studentMemberId }) => {
    try {
      const ledgerEntries = await LedgerEntry.find({
        classroomId,
        userId: new mongoose.Types.ObjectId(studentMemberId)
      }).populate("challengeId").lean();

      const formattedEntries = ledgerEntries.map(entry => ({
        week: entry.challengeId ? entry.challengeId.title : "Week 0 (Initial)",
        challengeId: entry.challengeId ? entry.challengeId._id : null,
        metrics: entry.metrics instanceof Map ? Object.fromEntries(entry.metrics) : entry.metrics,
        summary: entry.summary,
        randomEvent: entry.randomEvent,
      }));

      return { success: true, ledgerEntries: formattedEntries };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
});

module.exports = getStudentLedgerEntries;

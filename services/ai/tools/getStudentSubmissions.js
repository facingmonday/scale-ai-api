const { FunctionTool } = require("@google/adk");
const { z } = require("zod");
const Decision = require("../../decision/decision.model");

const getStudentSubmissions = new FunctionTool({
  name: "get_student_submissions",
  description: "Fetches all simulation round decisions submitted by a specific student.",
  parameters: z.object({
    classroomId: z.string().describe("The ID of the classroom."),
    studentMemberId: z.string().describe("The Member ID of the student."),
  }),
  execute: async ({ classroomId, studentMemberId }) => {
    try {
      const submissions = await Decision.getSubmissionsByUser(classroomId, studentMemberId);
      return { success: true, submissions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
});

module.exports = getStudentSubmissions;

const { FunctionTool } = require("@google/adk");
const { z } = require("zod");
const Profile = require("../../profile/profile.model");

const getStudentProfile = new FunctionTool({
  name: "get_student_profile",
  description: "Fetches the student's shop details, including name, location, profile type, and configurations.",
  parameters: z.object({
    classroomId: z.string().describe("The ID of the classroom."),
    studentMemberId: z.string().describe("The Member ID of the student."),
  }),
  execute: async ({ classroomId, studentMemberId }) => {
    try {
      const profile = await Profile.getStoreByUser(classroomId, studentMemberId);
      if (!profile) return { success: false, error: "Profile not found" };
      return { success: true, profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
});

module.exports = getStudentProfile;

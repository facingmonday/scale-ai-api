const { FunctionTool } = require("@google/adk");
const { z } = require("zod");
const Enrollment = require("../../enrollment/enrollment.model");
const Profile = require("../../profile/profile.model");

const getClassRoster = new FunctionTool({
  name: "get_class_roster",
  description: "Teacher Only: Fetches the list of all students enrolled in the classroom, along with their shop names.",
  parameters: z.object({
    classroomId: z.string().describe("The ID of the classroom."),
  }),
  execute: async ({ classroomId }) => {
    try {
      const roster = await Enrollment.getClassRoster(classroomId);
      const profiles = await Profile.find({ classroomId }).lean();
      const profileMap = new Map(profiles.map(p => [p.userId.toString(), p]));

      const formattedRoster = roster.map(student => {
        const studentProfile = profileMap.get(student.userId.toString());
        return {
          userId: student.userId,
          studentId: studentProfile?.studentId || "N/A",
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          shopName: studentProfile?.shopName || "Not Set",
        };
      });

      return { success: true, roster: formattedRoster };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
});

module.exports = getClassRoster;

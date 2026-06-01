const { FunctionTool } = require("@google/adk");
const { z } = require("zod");
const mongoose = require("mongoose");
const Profile = require("../profile/profile.model");
const Decision = require("../decision/decision.model");
const LedgerEntry = require("../ledger/ledger.model");
const Challenge = require("../challenge/challenge.model");
const Enrollment = require("../enrollment/enrollment.model");

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

// -- Teacher Only Tools --

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

module.exports = {
  getStudentProfile,
  getStudentSubmissions,
  getStudentLedgerEntries,
  getScenarioDetails,
  getClassroomSummary,
  getClassRoster,
};

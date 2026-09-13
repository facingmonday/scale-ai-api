const mongoose = require("mongoose");
const Classroom = require("../classroom/classroom.model");
const activity = require("./studentActivity.service");

function handler(isTeacher) {
  return async (req, res) => {
    const classroomId = req.query.classroomId;
    // Student callers cannot select another student's identity.
    const studentId = isTeacher ? req.params.studentId : req.user?._id;
    const organizationId = req.organization?._id;
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 10);
    if (![classroomId, studentId, organizationId].every((id) => mongoose.isValidObjectId(id)) ||
        !Number.isInteger(offset) || offset < 0 || offset > 10000 ||
        !Number.isInteger(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({ error: "Valid classroom/student IDs, offset (0–10000), and limit (1–50) are required." });
    }
    try {
      const validate = isTeacher ? Classroom.validateAdminAccess : Classroom.validateStudentAccess;
      await validate.call(Classroom, classroomId, req.clerkUser.id, organizationId);
      const result = await activity.getActivity({ organizationId, classroomId, studentId, offset, limit });
      return res.json(result);
    } catch (error) {
      if (error.message === "Class not found") return res.status(404).json({ error: "Class not found" });
      if (error.message?.includes("Insufficient permissions")) return res.status(403).json({ error: "You do not have access to this classroom." });
      console.error("Failed to load student activity", error.message);
      return res.status(500).json({ error: "Activity is temporarily unavailable." });
    }
  };
}

module.exports = { getStudentActivity: handler(false), getTeacherActivity: handler(true) };

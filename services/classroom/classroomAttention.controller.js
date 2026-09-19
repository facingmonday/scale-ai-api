const mongoose = require("mongoose");
const Classroom = require("./classroom.model");
const attention = require("./classroomAttention.service");

exports.getClassroomAttention = async (req, res) => {
  const { classroomId } = req.params;
  const organizationId = req.organization?._id;
  if (typeof classroomId !== "string" || !mongoose.isObjectIdOrHexString(classroomId) ||
      !mongoose.isObjectIdOrHexString(organizationId)) {
    return res.status(400).json({ error: "A valid classroom ID is required." });
  }
  try {
    await Classroom.validateAdminAccess(classroomId, req.clerkUser.id, organizationId);
    const report = await attention.getClassroomAttention({ classroomId, organizationId });
    return res.json(report);
  } catch (error) {
    if (error.message === "Class not found") return res.status(404).json({ error: "Class not found" });
    if (error.message?.includes("Insufficient permissions")) {
      return res.status(403).json({ error: "You do not have access to this classroom." });
    }
    console.error("Failed to load classroom attention report", error.message);
    return res.status(500).json({ error: "Needs attention is temporarily unavailable." });
  }
};

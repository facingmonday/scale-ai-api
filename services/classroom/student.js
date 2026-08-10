const express = require("express");
const controller = require("./classroom.controller");
const { requireMemberAuth } = require("../../middleware/auth");

const router = express.Router();

router.get(
  "/:classroomId/dashboard",
  requireMemberAuth(),
  controller.getStudentDashboard
);

module.exports = router;

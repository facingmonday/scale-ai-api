const router = require("express").Router();
const { requireAuth, requireMemberAuth, checkRole } = require("../../middleware/auth");
const controller = require("./studentActivity.controller");

router.get("/student/activity", requireMemberAuth(), controller.getStudentActivity);
router.get("/admin/students/:studentId/activity", requireAuth(), checkRole("org:admin"), controller.getTeacherActivity);

module.exports = router;

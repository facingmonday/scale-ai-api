const express = require("express");
const controller = require("./licensing.controller");
const { requireAuth, checkRole } = require("../../middleware/auth");

const router = express.Router();

router.get("/plans", requireAuth(), controller.getPlans);
router.get("/summary", requireAuth(), controller.getSummary);
router.get("/student/access", requireAuth(), controller.getStudentAccess);
router.post("/student/checkout", requireAuth(), controller.createStudentCheckout);

router.get(
  "/seat-pools",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSeatPools
);
router.post(
  "/seat-pools/manual",
  requireAuth(),
  checkRole("org:admin"),
  controller.createManualSeatPool
);

router.get(
  "/classrooms/:classroomId/summary",
  requireAuth(),
  checkRole("org:admin"),
  controller.getClassroomSummary
);
router.post(
  "/classrooms/:classroomId/allocations",
  requireAuth(),
  checkRole("org:admin"),
  controller.allocateSeats
);
router.get(
  "/classrooms/:classroomId/roster-seats",
  requireAuth(),
  checkRole("org:admin"),
  controller.getRosterSeats
);
router.post(
  "/classrooms/:classroomId/roster-import",
  requireAuth(),
  checkRole("org:admin"),
  controller.importRoster
);

module.exports = router;

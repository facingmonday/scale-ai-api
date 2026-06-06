const express = require("express");
const controller = require("./licensing.controller");
const { requireAuth, checkRole } = require("../../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /v1/licensing/plans:
 *   get:
 *     summary: Get licensing subscription plans
 *     description: Retrieve all available licensing plan configurations.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of available plans.
 */
router.get("/plans", requireAuth(), controller.getPlans);

/**
 * @openapi
 * /v1/licensing/summary:
 *   get:
 *     summary: Get licensing billing summary
 *     description: Retrieve general licensing summary details for active organization.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Summary stats object.
 */
router.get("/summary", requireAuth(), controller.getSummary);

/**
 * @openapi
 * /v1/licensing/student/access:
 *   get:
 *     summary: Get student access credentials
 *     description: Retrieve licensing access settings for the student user.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Access settings data.
 */
router.get("/student/access", requireAuth(), controller.getStudentAccess);

/**
 * @openapi
 * /v1/licensing/student/checkout:
 *   post:
 *     summary: Create student checkout session
 *     description: Initializes a payment checkout flow for the student.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session URL metadata.
 */
router.post("/student/checkout", requireAuth(), controller.createStudentCheckout);

/**
 * @openapi
 * /v1/licensing/seat-pools:
 *   get:
 *     summary: Get seat pools
 *     description: Fetch available seats pools. Requires org:admin role.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Seat pool lists.
 */
router.get(
  "/seat-pools",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSeatPools
);

/**
 * @openapi
 * /v1/licensing/seat-pools/manual:
 *   post:
 *     summary: Create manual seat pool allocation
 *     description: Force assign a manual seat pool definition. Requires org:admin role.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Manual allocation record.
 */
router.post(
  "/seat-pools/manual",
  requireAuth(),
  checkRole("org:admin"),
  controller.createManualSeatPool
);

/**
 * @openapi
 * /v1/licensing/classrooms/{classroomId}/summary:
 *   get:
 *     summary: Get classroom license summary
 *     description: Retrieve license distribution summary for classroom. Requires org:admin role.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary stats.
 */
router.get(
  "/classrooms/:classroomId/summary",
  requireAuth(),
  checkRole("org:admin"),
  controller.getClassroomSummary
);

/**
 * @openapi
 * /v1/licensing/classrooms/{classroomId}/allocations:
 *   post:
 *     summary: Allocate classroom seats
 *     description: Distribute seats dynamically to classroom roster. Requires org:admin role.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Allocated successfully.
 */
router.post(
  "/classrooms/:classroomId/allocations",
  requireAuth(),
  checkRole("org:admin"),
  controller.allocateSeats
);

/**
 * @openapi
 * /v1/licensing/classrooms/{classroomId}/roster-seats:
 *   get:
 *     summary: Get classroom roster seat allocation
 *     description: Fetch detailed distribution list of seats in the roster. Requires org:admin role.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Distribution list.
 */
router.get(
  "/classrooms/:classroomId/roster-seats",
  requireAuth(),
  checkRole("org:admin"),
  controller.getRosterSeats
);

/**
 * @openapi
 * /v1/licensing/classrooms/{classroomId}/roster-import:
 *   post:
 *     summary: Import roster with license allocation
 *     description: Upload student files and pre-allocate seat licenses. Requires org:admin role.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Import log record.
 */
router.post(
  "/classrooms/:classroomId/roster-import",
  requireAuth(),
  checkRole("org:admin"),
  controller.importRoster
);

module.exports = router;

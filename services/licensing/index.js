const express = require("express");
const controller = require("./licensing.controller");
const {
  requireAuth,
  requireMemberAuth,
  checkRole,
} = require("../../middleware/auth");

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
router.get(
  "/student/checkout-status",
  requireMemberAuth(),
  controller.getStudentCheckoutStatus,
);

/**
 * @openapi
 * /v1/licensing/student/checkout:
 *   post:
 *     summary: Create student checkout session
 *     description: Initializes a Stripe checkout flow for a student seat.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session URL metadata.
 */
router.post(
  "/student/checkout",
  requireMemberAuth(),
  controller.createStudentCheckout,
);

/**
 * @openapi
 * /v1/licensing/org/checkout:
 *   post:
 *     summary: Create org seat checkout session
 *     description: Initializes a Stripe checkout flow for org admin seat purchase.
 *     tags:
 *       - Licensing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session URL metadata.
 */
router.post(
  "/org/checkout",
  requireAuth(),
  checkRole("org:admin"),
  controller.createOrgCheckout,
);

/**
 * @openapi
 * /v1/licensing/seat-pools:
 *   get:
 *     summary: Get seat pools
 *     description: Fetch organization seat pool. Requires org:admin role.
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
  controller.getSeatPools,
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
  controller.getClassroomSummary,
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
  controller.getRosterSeats,
);

/**
 * @openapi
 * /v1/licensing/classrooms/{classroomId}/roster-import:
 *   post:
 *     summary: Import roster
 *     description: Upload student roster for classroom access control. Requires org:admin role.
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
  controller.importRoster,
);

router.get(
  "/seat-reservations",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSeatReservations,
);

router.post(
  "/seat-reservations",
  requireAuth(),
  checkRole("org:admin"),
  controller.createSeatReservation,
);

router.delete(
  "/seat-reservations/:id",
  requireAuth(),
  checkRole("org:admin"),
  controller.revokeSeatReservation,
);

router.post(
  "/admin/grant-seat",
  requireAuth(),
  checkRole("org:admin"),
  controller.grantSeat,
);

module.exports = router;
